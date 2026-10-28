import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_MAP } from '../src/content/questions.js';
import { LESSON_MAP } from '../src/content/lessons.js';
import { gradeResponse } from '../src/training/scoring.js';
import { correctLegalSet, buildSpotState } from '../src/training/scenario.js';
import {
  initStore,
  recordAttempt,
  getQuestionStats,
  getTagStats,
  getTagMastery,
  getMistakeList,
  getReviewQueue,
  getDueQuestionIds,
  markLessonComplete,
  isLessonCompleted,
  isLessonUnlocked,
  getNextLesson,
  getPracticeStatus,
  getOverallMastery,
  exportData,
  importData,
  resetAll,
  recordSimHand,
  getSimStats,
  getSimHistory,
  saveActiveSim,
  getActiveSim,
  clearActiveSim
} from '../src/state/store.js';
import { DAY_MS } from '../src/state/progress.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key)
  };
}

function freshStore() {
  const storage = memoryStorage();
  initStore(storage);
  resetAll();
  return storage;
}

beforeEach(() => {
  freshStore();
});

test('首次作答、到期复测与复习间隔', () => {
  const q = QUESTION_MAP.q_preflop_aa_utg;
  const now = Date.UTC(2026, 0, 1, 12);
  const correct = gradeResponse(q, { type: 'raise', to: 5 });

  const meta1 = recordAttempt(q, correct, 0, now);
  assert.equal(meta1.first, true);
  assert.equal(meta1.delayed, false);
  assert.equal(meta1.intervalDays, 1);

  const stats1 = getQuestionStats(q.id);
  assert.equal(stats1.attempts, 1);
  assert.equal(stats1.firstScore, 1);
  assert.equal(stats1.dueAt, now + DAY_MS);

  const meta2 = recordAttempt(q, correct, 1, now + DAY_MS + 1000);
  assert.equal(meta2.first, false);
  assert.equal(meta2.delayed, true);
  assert.equal(meta2.intervalDays, 3);
  const stats2 = getQuestionStats(q.id);
  assert.equal(stats2.attempts, 2);
  assert.equal(stats2.dueAt, now + DAY_MS + 1000 + 3 * DAY_MS);
});

test('错题记录、解错与重复错误', () => {
  const q = QUESTION_MAP.q_preflop_72o_btn;
  const now = Date.UTC(2026, 0, 2, 12);
  const wrong = gradeResponse(q, { type: 'call' });
  assert.equal(wrong.verdict, 'below_baseline');

  const meta1 = recordAttempt(q, wrong, 0, now);
  assert.equal(meta1.mistake, true);
  assert.equal(getMistakeList().length, 1);
  const mistake = getMistakeList()[0];
  assert.equal(mistake.questionId, q.id);
  assert.equal(mistake.count, 1);

  recordAttempt(q, wrong, 3, now + DAY_MS + 1);
  assert.equal(getMistakeList()[0].count, 2);
  assert.ok(getTagStats('hand-selection').repeatErrors >= 1);

  const correct = gradeResponse(q, { type: 'fold' });
  recordAttempt(q, correct, 0, now + 2 * DAY_MS);
  assert.equal(getMistakeList().length, 0, '达标后应解决未结错题');
});

test('能力信号综合首次表现、提示、重复错误与延迟复测', () => {
  const q = QUESTION_MAP.q_preflop_ato_utg;
  const now = Date.UTC(2026, 0, 3, 12);
  const wrong = gradeResponse(q, { type: 'call' });
  recordAttempt(q, wrong, 3, now);
  recordAttempt(q, wrong, 3, now + DAY_MS + 1);

  const tag = getTagStats('position');
  assert.ok(tag.attempts >= 2);
  assert.ok(tag.hintLevels >= 6);
  assert.ok(tag.repeatErrors >= 1);
  assert.ok(tag.delayedAttempts >= 1);

  const mastery = getTagMastery('position');
  assert.ok(mastery.mastery >= 0 && mastery.mastery <= 1);
  assert.ok(mastery.components.firstTry <= 1);
  assert.ok(mastery.components.hintIndependence < 1);
  assert.ok(mastery.samples.delayedAttempts >= 1);
  const overall = getOverallMastery();
  assert.ok(overall.mastery >= 0 && overall.mastery <= 1);
});

test('课程完成需要全部练习，完成后解锁后续课程', () => {
  const lesson = LESSON_MAP.L1;
  assert.equal(getPracticeStatus(lesson).complete, false);
  assert.throws(() => markLessonComplete(lesson.id), /全部独立练习/);

  const q1 = QUESTION_MAP.q_choice_preflop_order;
  recordAttempt(q1, gradeResponse(q1, ['utg']), 0, Date.now());
  const q2 = QUESTION_MAP.q_legal_flop_no_bet;
  const state = buildSpotState(q2.spot);
  recordAttempt(q2, gradeResponse(q2, correctLegalSet(state)), 0, Date.now());

  assert.equal(getPracticeStatus(lesson).complete, true);
  markLessonComplete(lesson.id);
  assert.equal(isLessonCompleted('L1'), true);
  assert.equal(isLessonUnlocked(LESSON_MAP.L2), true);
  assert.equal(isLessonUnlocked(LESSON_MAP.L3), false);
  assert.equal(getNextLesson().id, 'L2');
});

test('复习队列优先到期题目与同族变式', () => {
  const wrong = QUESTION_MAP.q_preflop_ato_utg;
  const now = Date.UTC(2026, 0, 4, 12);
  recordAttempt(wrong, gradeResponse(wrong, { type: 'call' }), 0, now);
  const due = getDueQuestionIds(now + 2 * DAY_MS);
  assert.ok(due.includes(wrong.id));
  const queue = getReviewQueue(10, now + 2 * DAY_MS);
  assert.ok(queue.includes(wrong.id));
  assert.ok(queue.includes('q_preflop_ato_btn'), '应优先安排同族变式');
});

test('进度写入后可重新加载，导出/导入可用', () => {
  const q = QUESTION_MAP.q_preflop_aa_utg;
  const storage = memoryStorage();
  initStore(storage);
  resetAll();
  recordAttempt(q, gradeResponse(q, { type: 'raise', to: 5 }), 0, Date.UTC(2026, 0, 5));

  initStore(storage);
  assert.equal(getQuestionStats(q.id).attempts, 1);

  const exported = exportData();
  resetAll();
  assert.equal(getQuestionStats(q.id), null);
  importData(exported);
  assert.equal(getQuestionStats(q.id).attempts, 1);
  assert.throws(() => importData('{bad'), /JSON|解析/);
  assert.throws(() => importData('{}'), /不是本应用/);
});

test('模拟牌局记录与 active 恢复', () => {
  const record = {
    id: 'h-test',
    startedAt: Date.now(),
    humanSeat: 0,
    result: { net: [{ seat: 0, net: 4 }] }
  };
  recordSimHand(record);
  const stats = getSimStats();
  assert.equal(stats.hands, 1);
  assert.equal(stats.netChips, 4);
  assert.equal(getSimHistory().length, 1);

  saveActiveSim({ table: { street: 'flop' }, initial: {}, handId: 'x' });
  assert.equal(getActiveSim().table.street, 'flop');
  clearActiveSim();
  assert.equal(getActiveSim(), null);
});
