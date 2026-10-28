import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, QUESTION_MAP } from '../src/content/questions.js';
import { LESSONS, LESSON_MAP, PHASES, PHASE_MAP } from '../src/content/lessons.js';
import { GLOSSARY, GLOSSARY_MAP } from '../src/content/glossary.js';
import { TAGS } from '../src/content/tags.js';
import { buildSpotState, correctLegalSet, actionMatchesSpec } from '../src/training/scenario.js';
import { gradeResponse } from '../src/training/scoring.js';
import { evaluateBest } from '../src/engine/handEval.js';
import { assertUniqueCards } from '../src/engine/cards.js';
import { getLegalActions } from '../src/engine/table.js';

function walkStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) walkStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) walkStrings(item, out);
  return out;
}

test('题库数量、ID 唯一与基础字段完整', () => {
  assert.ok(QUESTIONS.length >= 20, `题目数量 ${QUESTIONS.length}`);
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
  for (const q of QUESTIONS) {
    assert.ok(q.title, q.id);
    assert.ok(q.prompt, q.id);
    assert.ok([1, 2, 3, 4, 5].includes(q.phase), q.id);
    assert.ok(LESSON_MAP[q.lessonId], `${q.id} 的 lessonId 不存在`);
    assert.equal(q.hints.length, 3, `${q.id} 需要三级提示`);
    assert.ok(q.explanation?.summary, `${q.id} 缺少结论`);
    assert.ok(q.teachingGoal, `${q.id} 缺少教学目标`);
    assert.ok(q.source, `${q.id} 缺少来源/假设`);
    for (const tag of q.tags) assert.ok(TAGS[tag], `${q.id} 标签不存在: ${tag}`);
    assert.ok([1, 2, 3, 4, 5].includes(q.difficulty), q.id);
  }
});

test('知识点覆盖第一批验收范围', () => {
  const tags = new Set(QUESTIONS.flatMap((q) => q.tags));
  for (const required of [
    'hand-ranking',
    'best-five',
    'position',
    'preflop-open',
    'made-hand',
    'board-texture',
    'pot-odds',
    'outs',
    'range',
    'resulting'
  ]) {
    assert.ok(tags.has(required), `缺少知识点 ${required}`);
  }
  for (const phase of [1, 2, 3, 4, 5]) {
    assert.ok(QUESTIONS.some((q) => q.phase === phase), `阶段 ${phase} 没有题目`);
  }
});

test('结构化局面自洽：6 人、筹码/投入、公共牌、无重复牌', () => {
  for (const q of QUESTIONS) {
    if (!q.spot) continue;
    assert.equal(Object.keys(q.spot.players).length, 6, `${q.id} 不是 6 人`);
    const state = buildSpotState(q.spot);
    assert.equal(state.seats.length, 6);
    const all = [...q.spot.heroCards, ...q.spot.board];
    assertUniqueCards(all, q.id);
    for (const player of Object.values(q.spot.players)) {
      assert.equal(player.stack + player.committed, 200, `${q.id} 筹码不守恒`);
    }
    const sum = Object.values(q.spot.players).reduce((s, p) => s + p.committed, 0);
    assert.equal(state.pot, sum);
    assert.equal(state.currentBet, Math.max(...state.seats.map((p) => p.streetBet)));
    assert.ok(q.spot.villainRange, `${q.id} 缺少对手范围/未知说明`);
  }
});

test('行动题与合法操作题的推荐/可接受答案均合法', () => {
  for (const q of QUESTIONS.filter((q) => q.type === 'action')) {
    assert.ok(q.answer.recommended.length > 0, `${q.id} 没有推荐操作`);
    for (const spec of [...q.answer.recommended, ...(q.answer.acceptable || [])]) {
      const response =
        spec.type === 'bet'
          ? { type: 'bet', to: spec.min ?? spec.minTo ?? spec.to }
          : spec.type === 'raise'
            ? { type: 'raise', to: spec.minTo ?? spec.to }
            : { type: spec.type };
      const grade = gradeResponse(q, response);
      assert.ok(
        ['goal_met', 'reasonable_tradeoff'].includes(grade.verdict),
        `${q.id} 的答案 ${JSON.stringify(spec)} 不合法或未命中: ${grade.verdict} ${grade.detail}`
      );
      const state = buildSpotState(q.spot);
      const legal = getLegalActions(state, state.actor);
      const ok = legal.actions.some(
        (a) =>
          a.type === response.type &&
          (response.type === 'bet' || response.type === 'raise'
            ? response.to >= (a.min ?? a.minTo) && response.to <= (a.max ?? a.maxTo)
            : true)
      );
      assert.ok(ok, `${q.id} 的答案 ${JSON.stringify(spec)} 不在引擎合法操作内`);
      assert.ok(actionMatchesSpec(response, spec), `${q.id} 的 spec 匹配失败`);
    }
  }
  for (const q of QUESTIONS.filter((q) => q.type === 'legal')) {
    const state = buildSpotState(q.spot);
    const correct = correctLegalSet(state);
    assert.ok(correct.length > 0, `${q.id} 没有合法操作`);
    const grade = gradeResponse(q, correct);
    assert.equal(grade.verdict, 'goal_met');
  }
});


test('牌型题、计算题与概念题的答案可复现', () => {
  for (const q of QUESTIONS.filter((q) => q.type === 'compare')) {
    const grade = gradeResponse(q, q.compare.correct);
    assert.equal(grade.verdict, 'goal_met', q.id);
  }
  for (const q of QUESTIONS.filter((q) => q.type === 'best-five')) {
    const best = evaluateBest([...q.cards.hero, ...q.cards.board]);
    const grade = gradeResponse(q, best.cards);
    assert.equal(grade.verdict, 'goal_met', q.id);
  }
  for (const q of QUESTIONS.filter((q) => q.type === 'numeric')) {
    const grade = gradeResponse(q, q.numeric.answer);
    assert.equal(grade.verdict, 'goal_met', q.id);
    assert.ok(q.numeric.tolerance >= 0, q.id);
  }
  for (const q of QUESTIONS.filter((q) => q.type === 'choice')) {
    const grade = gradeResponse(q, q.correct);
    assert.equal(grade.verdict, 'goal_met', q.id);
    assert.ok(q.options.length >= 2, q.id);
  }
});

test('课程结构与解锁依赖完整', () => {
  assert.equal(LESSONS.length, 10);
  assert.equal(PHASES.length, 5);
  const seen = new Set();
  for (const phase of PHASES) {
    for (const lessonId of phase.lessons) {
      const lesson = LESSON_MAP[lessonId];
      assert.ok(lesson, `${lessonId} 不存在`);
      assert.equal(lesson.phase, phase.id);
      for (const pre of lesson.prerequisites) {
        assert.ok(LESSON_MAP[pre], `${lessonId} 的前置 ${pre} 不存在`);
        assert.ok(seen.has(pre), `${lessonId} 的前置 ${pre} 不在更早/同一顺序`);
      }
      seen.add(lessonId);
      assert.ok(lesson.sections.length >= 3, `${lessonId} 内容过少`);
      assert.ok(lesson.demoQuestionId, `${lessonId} 缺少示范`);
      assert.ok(QUESTION_MAP[lesson.demoQuestionId], `${lessonId} 示范题不存在`);
      assert.ok(lesson.practiceQuestionIds.length >= 2, `${lessonId} 练习不足`);
      for (const qid of lesson.practiceQuestionIds) {
        assert.ok(QUESTION_MAP[qid], `${lessonId} 练习 ${qid} 不存在`);
      }
      assert.ok(lesson.takeaway, `${lessonId} 缺少结论`);
    }
  }
});

test('每道题都被某节课的示范或练习引用', () => {
  const referenced = new Set();
  for (const lesson of LESSONS) {
    referenced.add(lesson.demoQuestionId);
    for (const qid of lesson.practiceQuestionIds) referenced.add(qid);
  }
  for (const q of QUESTIONS) {
    assert.ok(referenced.has(q.id), `${q.id} 未被课程引用`);
    assert.equal(LESSON_MAP[q.lessonId].phase, q.phase, `${q.id} 阶段与课程不一致`);
  }
});

test('课程与题目里的术语标记都存在', () => {
  for (const entry of GLOSSARY) {
    assert.ok(entry.term && entry.en && entry.definition && entry.example, entry.id);
  }
  const strings = [...LESSONS, ...QUESTIONS].flatMap((item) => walkStrings(item));
  for (const text of strings) {
    for (const match of text.matchAll(/\{\{([a-z0-9-]+)\}\}/g)) {
      assert.ok(GLOSSARY_MAP[match[1]], `未定义术语: ${match[1]}`);
    }
  }
});

test('阶段元数据与课程映射一致', () => {
  for (const phase of PHASES) {
    assert.equal(PHASE_MAP[phase.id].lessons.length, phase.lessons.length);
    assert.ok(phase.lessons.length >= 2);
  }
});
