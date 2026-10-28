import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_MAP } from '../src/content/questions.js';
import { gradeResponse } from '../src/training/scoring.js';
import { correctLegalSet } from '../src/training/scenario.js';
import { buildSpotState } from '../src/training/scenario.js';

test('行动题：推荐、可接受、低基线、规则错误四类', () => {
  const q = QUESTION_MAP.q_preflop_aa_utg;
  const recommended = gradeResponse(q, { type: 'raise', to: 5 });
  assert.equal(recommended.verdict, 'goal_met');
  assert.equal(recommended.isCorrect, true);
  assert.equal(recommended.isError, false);

  const acceptable = gradeResponse(q, { type: 'raise', to: 9 });
  assert.equal(acceptable.verdict, 'reasonable_tradeoff');
  assert.equal(acceptable.isPartial, true);
  assert.equal(acceptable.isError, false);

  const weak = gradeResponse(q, { type: 'call' });
  assert.equal(weak.verdict, 'below_baseline');
  assert.equal(weak.isError, true);

  const illegal = gradeResponse(q, { type: 'check' });
  assert.equal(illegal.verdict, 'rule_error');
  assert.match(illegal.detail, /不合法/);

  const tooSmall = gradeResponse(q, { type: 'raise', to: 3 });
  assert.equal(tooSmall.verdict, 'rule_error');
});

test('合法操作题按集合判定', () => {
  const q = QUESTION_MAP.q_legal_bb_facing_raise;
  const state = buildSpotState(q.spot);
  const correct = correctLegalSet(state);
  assert.deepEqual(correct.sort(), ['call', 'fold', 'raise'].sort());
  assert.equal(gradeResponse(q, correct).verdict, 'goal_met');
  assert.equal(gradeResponse(q, ['fold', 'check']).verdict, 'rule_error');
});

test('最佳五张与牌型比较按引擎判定', () => {
  const best = gradeResponse(QUESTION_MAP.q_best_five_royal, [
    'Ah',
    'Kh',
    'Qh',
    'Jh',
    'Th'
  ]);
  assert.equal(best.verdict, 'goal_met');
  const wrong = gradeResponse(QUESTION_MAP.q_best_five_royal, [
    'Ah',
    'Kh',
    'Qh',
    'Jh',
    '2c'
  ]);
  assert.equal(wrong.verdict, 'rule_error');

  assert.equal(gradeResponse(QUESTION_MAP.q_compare_kicker, 'A').verdict, 'goal_met');
  assert.equal(gradeResponse(QUESTION_MAP.q_compare_kicker, 'B').verdict, 'rule_error');
  assert.equal(gradeResponse(QUESTION_MAP.q_compare_tie, 'tie').verdict, 'goal_met');
});

test('计算题区分正确数值与计算错误', () => {
  assert.equal(gradeResponse(QUESTION_MAP.q_math_pot_odds, '25').verdict, 'goal_met');
  assert.equal(gradeResponse(QUESTION_MAP.q_math_pot_odds, '33.3').verdict, 'rule_error');
  assert.equal(gradeResponse(QUESTION_MAP.q_math_double_count, '17').verdict, 'rule_error');
  assert.equal(gradeResponse(QUESTION_MAP.q_math_double_count, '15').verdict, 'goal_met');
});

test('概念题错误归入低于教学基线，而不是规则错误', () => {
  const q = QUESTION_MAP.q_choice_resulting;
  assert.equal(gradeResponse(q, ['b']).verdict, 'goal_met');
  const wrong = gradeResponse(q, ['a']);
  assert.equal(wrong.verdict, 'below_baseline');
  assert.equal(wrong.isError, true);
});

test('评分不接收也不依赖最终发牌结果', () => {
  const q = QUESTION_MAP.q_postflop_kq_dry;
  const grade = gradeResponse(q, { type: 'call' });
  assert.equal(grade.verdict, 'goal_met');
  assert.equal(Object.keys(grade).includes('result'), false);
  assert.equal(q.spot.board.length, 3, '评分时只看到翻牌，不能读取未来公共牌');
});
