/**
 * 本地持久化与学习记录。
 * 没有后端时使用 localStorage；测试可注入内存 storage。
 */

import { QUESTION_MAP } from '../content/questions.js';
import { LESSON_MAP, LESSONS } from '../content/lessons.js';
import { TAGS } from '../content/tags.js';
import { computeTagMastery, dueCount, scheduleReview, questionStatus } from './progress.js';

export const STORAGE_KEY = 'poker-coach-cn-v1';
export const SCHEMA_VERSION = 1;

function defaultData() {
  return {
    version: SCHEMA_VERSION,
    createdAt: Date.now(),
    settings: {
      difficulty: 'normal',
      sound: false
    },
    lessons: {},
    questions: {},
    tags: {},
    mistakes: {},
    attempts: [],
    sim: {
      history: [],
      active: null,
      difficulty: 'normal',
      stats: {
        hands: 0,
        netChips: 0,
        wins: 0,
        losses: 0,
        pushes: 0
      }
    }
  };
}

function mergeDefaults(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  const out = { ...base, ...incoming };
  out.settings = { ...base.settings, ...(incoming.settings || {}) };
  out.sim = { ...base.sim, ...(incoming.sim || {}) };
  out.sim.stats = { ...base.sim.stats, ...((incoming.sim || {}).stats || {}) };
  out.lessons = incoming.lessons || {};
  out.questions = incoming.questions || {};
  out.tags = incoming.tags || {};
  out.mistakes = incoming.mistakes || {};
  out.attempts = Array.isArray(incoming.attempts) ? incoming.attempts : [];
  out.sim.history = Array.isArray(out.sim.history) ? out.sim.history : [];
  return out;
}

let storage = null;
let data = defaultData();
let loaded = false;
let lastSaveError = null;

function detectStorage() {
  if (storage) return storage;
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      storage = globalThis.localStorage;
      return storage;
    }
  } catch {
    // 隐私模式可能抛错。
  }
  storage = null;
  return storage;
}

export function initStore(customStorage) {
  if (customStorage) storage = customStorage;
  else detectStorage();
  loaded = true;
  lastSaveError = null;
  if (!storage) {
    data = defaultData();
    return { loaded: false, error: '当前浏览器不可用 localStorage，进度只保存在本次页面内。' };
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      data = mergeDefaults(defaultData(), parsed);
      data.version = SCHEMA_VERSION;
    } else {
      data = defaultData();
    }
    return { loaded: true, error: null };
  } catch (error) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) storage.setItem(`${STORAGE_KEY}.corrupt`, raw);
    } catch {
      // ignore
    }
    data = defaultData();
    return { loaded: false, error: `读取本地进度失败，已使用空白进度：${error.message}` };
  }
}

export function save() {
  if (!loaded) return false;
  const target = detectStorage();
  if (!target) return false;
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(data));
    lastSaveError = null;
    return true;
  } catch (error) {
    lastSaveError = error.message;
    return false;
  }
}

export function getLastSaveError() {
  return lastSaveError;
}

export function getData() {
  return data;
}

export function getSettings() {
  return data.settings;
}

export function setSetting(key, value) {
  data.settings[key] = value;
  save();
}

export function setDifficulty(difficulty) {
  data.sim.difficulty = difficulty;
  data.settings.difficulty = difficulty;
  save();
}

export function getQuestionStats(questionId) {
  return data.questions[questionId] || null;
}

export function getTagStats(tagId) {
  return data.tags[tagId] || null;
}

export function getTagMastery(tagId) {
  return computeTagMastery(data.tags[tagId] || {});
}

export function getTagOverview() {
  return Object.entries(TAGS).map(([id, meta]) => {
    const stats = data.tags[id] || {};
    return {
      id,
      ...meta,
      stats,
      mastery: computeTagMastery(stats)
    };
  });
}

export function getOverallMastery() {
  const entries = Object.entries(data.tags).filter(([, stats]) => (stats.attempts || 0) > 0);
  if (!entries.length) return { mastery: 0, attempts: 0, tags: 0, lowSample: true };
  let weighted = 0;
  let weight = 0;
  let lowSample = false;
  for (const [id, stats] of entries) {
    const m = computeTagMastery(stats);
    if (m.status === 'low-sample') lowSample = true;
    const w = Math.max(1, stats.attempts || 0);
    weighted += m.mastery * w;
    weight += w;
  }
  return {
    mastery: weight ? weighted / weight : 0,
    attempts: entries.reduce((s, [, st]) => s + (st.attempts || 0), 0),
    tags: entries.length,
    lowSample
  };
}

export function getDueQuestionIds(now = Date.now()) {
  return Object.entries(data.questions)
    .filter(([, stats]) => stats.dueAt && stats.dueAt <= now)
    .sort((a, b) => (a[1].dueAt || 0) - (b[1].dueAt || 0))
    .map(([id]) => id)
    .filter((id) => QUESTION_MAP[id]);
}

export function getDueCount(now = Date.now()) {
  return dueCount(data.questions, now);
}

export function getMistakeList() {
  return Object.entries(data.mistakes)
    .filter(([, m]) => !m.resolvedAt)
    .map(([questionId, m]) => ({
      questionId,
      ...m,
      question: QUESTION_MAP[questionId] || null
    }))
    .filter((m) => m.question)
    .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
}

export function getReviewQueue(limit = 10, now = Date.now()) {
  const queue = [];
  const add = (id) => {
    if (id && QUESTION_MAP[id] && !queue.includes(id)) queue.push(id);
  };

  // 1. 到期复习
  for (const id of getDueQuestionIds(now)) add(id);

  // 2. 错题的同族变式（优先未见过）
  const openMistakes = Object.entries(data.mistakes)
    .filter(([, m]) => !m.resolvedAt)
    .sort((a, b) => (b[1].lastAt || 0) - (a[1].lastAt || 0));
  for (const [qid] of openMistakes) {
    const q = QUESTION_MAP[qid];
    if (!q) continue;
    const variants = Object.values(QUESTION_MAP)
      .filter((candidate) => candidate.family === q.family && candidate.id !== qid)
      .sort((a, b) => (data.questions[a.id]?.attempts || 0) - (data.questions[b.id]?.attempts || 0));
    for (const v of variants.slice(0, 2)) add(v.id);
    if (queue.length >= limit * 2) break;
  }

  // 3. 薄弱/部分掌握
  const weak = Object.entries(data.questions)
    .filter(([, stats]) => stats.lastVerdict && stats.lastVerdict !== 'goal_met')
    .sort((a, b) => (a[1].lastVerdict === 'rule_error' ? -1 : 1) - (b[1].lastVerdict === 'rule_error' ? -1 : 1))
    .map(([id]) => id);
  for (const id of weak) add(id);

  // 4. 未见过的题，作为补充
  const unseen = Object.keys(QUESTION_MAP).filter((id) => !data.questions[id]?.attempts);
  for (const id of unseen) add(id);

  return queue.slice(0, limit);
}

export function getStreak(now = Date.now()) {
  // 以“有作答的连续天数”计，不涉及输赢。
  const days = new Set(
    data.attempts.map((a) => {
      const d = new Date(a.at);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    })
  );
  let streak = 0;
  const cursor = new Date(now);
  for (let i = 0; i < 3650; i++) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`;
    if (days.has(key)) streak++;
    else if (i > 0) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * 记录一次作答。只更新学习记录，不影响题目本身的推荐。
 */
export function recordAttempt(question, grade, hintsUsed = 0, now = Date.now()) {
  const qid = question.id;
  const prev = data.questions[qid] || null;
  const first = !prev || !prev.attempts;
  const wasDue = Boolean(prev?.dueAt && prev.dueAt <= now);
  const delayed = Boolean(prev && prev.attempts > 0 && wasDue);
  const prevWasError = prev && ['below_baseline', 'rule_error'].includes(prev.lastVerdict);
  const repeatError = Boolean(prevWasError && grade.isError);
  const reviewCount = prev?.reviewCount || 0;
  const schedule = scheduleReview(grade.verdict, reviewCount, now);

  const qstats = {
    ...(prev || {}),
    attempts: (prev?.attempts || 0) + 1,
    correct: (prev?.correct || 0) + (grade.isError ? 0 : 1),
    scoreSum: (prev?.scoreSum || 0) + grade.score,
    firstScore: prev?.firstScore ?? grade.score,
    firstVerdict: prev?.firstVerdict ?? grade.verdict,
    lastVerdict: grade.verdict,
    lastAt: now,
    dueAt: schedule.dueAt,
    intervalDays: schedule.intervalDays,
    reviewCount: schedule.reviewCount,
    hintLevels: (prev?.hintLevels || 0) + hintsUsed,
    family: question.family,
    tags: [...(question.tags || [])]
  };
  data.questions[qid] = qstats;

  for (const tag of question.tags || []) {
    const st = data.tags[tag] || {
      attempts: 0,
      correct: 0,
      scoreSum: 0,
      firstAttempts: 0,
      firstScoreSum: 0,
      hintLevels: 0,
      repeatErrors: 0,
      delayedAttempts: 0,
      delayedScoreSum: 0,
      delayedCorrect: 0,
      lastAt: null
    };
    st.attempts += 1;
    st.correct += grade.isError ? 0 : 1;
    st.scoreSum += grade.score;
    if (first) {
      st.firstAttempts += 1;
      st.firstScoreSum += grade.score;
    }
    st.hintLevels += hintsUsed;
    if (delayed) {
      st.delayedAttempts += 1;
      st.delayedScoreSum += grade.score;
      st.delayedCorrect += grade.isError ? 0 : 1;
    }
    if (repeatError) st.repeatErrors += 1;
    st.lastAt = now;
    data.tags[tag] = st;
  }

  if (grade.isError) {
    const existing = data.mistakes[qid];
    data.mistakes[qid] = {
      questionId: qid,
      count: (existing?.count || 0) + 1,
      lastAt: now,
      lastVerdict: grade.verdict,
      resolvedAt: null,
      tags: [...(question.tags || [])]
    };
  } else if (grade.verdict === 'goal_met' && data.mistakes[qid] && !data.mistakes[qid].resolvedAt) {
    data.mistakes[qid].resolvedAt = now;
  }

  data.attempts.push({
    qid,
    at: now,
    verdict: grade.verdict,
    score: grade.score,
    hints: hintsUsed,
    delayed,
    first
  });
  if (data.attempts.length > 500) data.attempts.splice(0, data.attempts.length - 500);

  save();
  return {
    first,
    delayed,
    repeatError,
    dueAt: schedule.dueAt,
    intervalDays: schedule.intervalDays,
    mistake: grade.isError
  };
}

export function getPracticeStatus(lesson) {
  const ids = lesson.practiceQuestionIds || [];
  const attempted = ids.filter((id) => (data.questions[id]?.attempts || 0) > 0).length;
  return {
    total: ids.length,
    attempted,
    complete: ids.length > 0 && attempted >= ids.length
  };
}

export function markLessonComplete(lessonId, now = Date.now()) {
  const lesson = LESSON_MAP[lessonId];
  if (!lesson) throw new Error('课程不存在');
  const status = getPracticeStatus(lesson);
  if (!status.complete) throw new Error('请先完成本课全部独立练习');
  data.lessons[lessonId] = {
    completedAt: now,
    practice: status
  };
  save();
  return data.lessons[lessonId];
}

export function isLessonCompleted(lessonId) {
  return Boolean(data.lessons[lessonId]?.completedAt);
}

export function isLessonUnlocked(lesson) {
  if (!lesson) return false;
  return (lesson.prerequisites || []).every((id) => isLessonCompleted(id));
}

export function getLessonStatus(lesson) {
  if (isLessonCompleted(lesson.id)) return 'completed';
  if (isLessonUnlocked(lesson)) return 'available';
  return 'locked';
}

export function getPhaseStatus(phase) {
  const lessons = phase.lessons.map((id) => LESSON_MAP[id]).filter(Boolean);
  const completed = lessons.filter((l) => isLessonCompleted(l.id)).length;
  const available = lessons.some((l) => isLessonUnlocked(l));
  return { completed, total: lessons.length, available, complete: completed === lessons.length };
}

export function getNextLesson() {
  return LESSONS.find((lesson) => isLessonUnlocked(lesson) && !isLessonCompleted(lesson.id)) || null;
}

export function getLessonCompletionCount() {
  return Object.values(data.lessons).filter((l) => l.completedAt).length;
}

export function getOpenMistakeCount() {
  return Object.values(data.mistakes).filter((m) => !m.resolvedAt).length;
}

// ---------------------------------------------------------------- 模拟牌局

export function saveActiveSim(table) {
  data.sim.active = table ? JSON.parse(JSON.stringify(table)) : null;
  save();
}

export function getActiveSim() {
  return data.sim.active ? JSON.parse(JSON.stringify(data.sim.active)) : null;
}

export function clearActiveSim() {
  data.sim.active = null;
  save();
}

export function recordSimHand(record) {
  const human = record.result?.net?.find((n) => n.seat === record.humanSeat);
  const net = human?.net || 0;
  data.sim.history.unshift(record);
  if (data.sim.history.length > 30) data.sim.history.length = 30;
  data.sim.stats.hands += 1;
  data.sim.stats.netChips += net;
  if (net > 0) data.sim.stats.wins += 1;
  else if (net < 0) data.sim.stats.losses += 1;
  else data.sim.stats.pushes += 1;
  data.sim.active = null;
  save();
}

export function getSimHistory() {
  return data.sim.history;
}

export function getSimStats() {
  return data.sim.stats;
}

export function getDifficulty() {
  return data.sim.difficulty || data.settings.difficulty || 'normal';
}

// ---------------------------------------------------------------- 备份

export function exportData() {
  return JSON.stringify(data, null, 2);
}

export function importData(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON 解析失败：${error.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.version) {
    throw new Error('不是本应用导出的进度文件');
  }
  data = mergeDefaults(defaultData(), parsed);
  data.version = SCHEMA_VERSION;
  save();
  return data;
}

export function resetAll() {
  data = defaultData();
  save();
  return data;
}

export function getQuestionListStatus(now = Date.now()) {
  return Object.fromEntries(
    Object.keys(QUESTION_MAP).map((id) => [id, questionStatus(data.questions[id], now)])
  );
}

export function getMistakeForQuestion(questionId) {
  return data.mistakes[questionId] || null;
}
