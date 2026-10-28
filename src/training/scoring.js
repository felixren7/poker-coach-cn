/**
 * 可复现的评分：只依据题目快照与明确答案，不依据后来发出的牌。
 */

import { evaluateBest, describeBest, compareScores } from '../engine/handEval.js';
import { sortCardsByRank, cardLabel } from '../engine/cards.js';
import {
  actionMatchesSpec,
  actionSpecLabel,
  buildSpotState,
  correctLegalSet,
  isLegalResponse,
  responseLabel,
  LEGAL_OPTIONS
} from './scenario.js';
import { verdictMeta } from '../state/progress.js';

function normalizeSelection(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function sameSet(a, b) {
  const sa = [...new Set(a)].sort();
  const sb = [...new Set(b)].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

function result(verdict, detail, extra = {}) {
  const meta = verdictMeta(verdict);
  return {
    verdict,
    isCorrect: verdict === 'goal_met',
    isPartial: verdict === 'reasonable_tradeoff',
    isError: verdict === 'below_baseline' || verdict === 'rule_error',
    score: meta.score,
    verdictLabel: meta.label,
    tone: meta.tone,
    detail,
    ...extra
  };
}

function gradeAction(question, response) {
  let state;
  try {
    state = buildSpotState(question.spot);
  } catch (error) {
    return result('rule_error', `题目局面无效：${error.message}`);
  }

  if (!response || !response.type) {
    return result('below_baseline', '没有选择任何操作。');
  }

  if (!isLegalResponse(state, response)) {
    return result(
      'rule_error',
      `当前局面下“${responseLabel(response)}”不合法。请检查当前最高下注、待跟注额与你的筹码。`,
      { userLabel: responseLabel(response) }
    );
  }

  const recommended = question.answer?.recommended || [];
  const acceptable = question.answer?.acceptable || [];
  const userLabel = responseLabel(response);
  const expectedLabel = recommended.map(actionSpecLabel).join(' 或 ') || '—';

  if (recommended.some((spec) => actionMatchesSpec(response, spec))) {
    return result('goal_met', '动作落在推荐范围内。', {
      userLabel,
      expectedLabel
    });
  }
  if (acceptable.some((spec) => actionMatchesSpec(response, spec))) {
    return result('reasonable_tradeoff', '动作属于可接受的替代，但有明确取舍。', {
      userLabel,
      expectedLabel,
      alternatives: acceptable.map(actionSpecLabel)
    });
  }
  return result('below_baseline', '动作合法，但在当前教学假设下明显不如推荐动作。', {
    userLabel,
    expectedLabel
  });
}

function gradeLegal(question, response) {
  let state;
  try {
    state = buildSpotState(question.spot);
  } catch (error) {
    return result('rule_error', `题目局面无效：${error.message}`);
  }
  const selected = normalizeSelection(response);
  const correct = correctLegalSet(state);
  const labels = Object.fromEntries(LEGAL_OPTIONS.map((o) => [o.id, o.label]));
  const userLabel = selected.length ? selected.map((id) => labels[id] || id).join('、') : '未选择';
  const expectedLabel = correct.map((id) => labels[id] || id).join('、');
  if (sameSet(selected, correct)) {
    return result('goal_met', '合法操作集合完全正确。', { userLabel, expectedLabel });
  }
  return result('rule_error', '合法操作集合不正确；规则题只按合法性判定。', {
    userLabel,
    expectedLabel
  });
}

function gradeBestFive(question, response) {
  const selected = normalizeSelection(response).filter(Boolean);
  const hero = question.cards?.hero || [];
  const board = question.cards?.board || [];
  const known = new Set([...hero, ...board]);
  if (selected.length !== 5) {
    return result('rule_error', '必须恰好选择 5 张牌。');
  }
  if (new Set(selected).size !== 5) {
    return result('rule_error', '同一张牌不能重复选择。');
  }
  if (!selected.every((c) => known.has(c))) {
    return result('rule_error', '选择中包含不在本手牌里的牌。');
  }
  const best = evaluateBest([...hero, ...board]);
  const chosen = evaluateBest(selected);
  const expectedLabel = sortCardsByRank(best.cards).map(cardLabel).join(' ');
  const userLabel = sortCardsByRank(selected).map(cardLabel).join(' ');
  if (compareScores(chosen.score, best.score) === 0) {
    return result('goal_met', '选择的最佳五张与牌力引擎一致。', { userLabel, expectedLabel });
  }
  return result('rule_error', '这五张不是当前七张牌中的最佳五张。', {
    userLabel,
    expectedLabel
  });
}

function gradeCompare(question, response) {
  const board = question.compare?.board || [];
  const A = question.compare?.A;
  const B = question.compare?.B;
  if (!A || !B) return result('rule_error', '题目缺少比较对象。');
  const evalA = describeBest([...A.hole, ...board]);
  const evalB = describeBest([...B.hole, ...board]);
  const cmp = compareScores(evalA.score, evalB.score);
  const correct = cmp > 0 ? 'A' : cmp < 0 ? 'B' : 'tie';
  const expectedLabel =
    correct === 'tie'
      ? '平局'
      : `${correct === 'A' ? A.name : B.name}（${(correct === 'A' ? evalA : evalB).fullName}）`;
  const selected = normalizeSelection(response)[0];
  const map = { a: 'A', b: 'B', tie: 'tie', A: 'A', B: 'B' };
  const picked = map[selected] || selected;
  if (picked === correct) {
    return result('goal_met', '比较结果正确。', { expectedLabel, userLabel: picked });
  }
  return result('rule_error', '最佳五张的比较结果不正确。', {
    expectedLabel,
    userLabel: picked || '未选择'
  });
}

function gradeNumeric(question, response) {
  const raw = Array.isArray(response) ? response[0] : response;
  const value = Number(String(raw ?? '').replace(/[%％]/g, '').trim());
  if (!Number.isFinite(value)) {
    return result('rule_error', '请输入一个有效数字。');
  }
  const answer = Number(question.numeric.answer);
  const tolerance = Number(question.numeric.tolerance || 0);
  const unit = question.numeric.unit || '';
  const expectedLabel = `${answer}${unit}`;
  if (Math.abs(value - answer) <= tolerance + 1e-9) {
    return result('goal_met', `计算正确：${answer}${unit}。`, {
      expectedLabel,
      userLabel: `${value}${unit}`
    });
  }
  return result('rule_error', `计算结果不正确；按题干公式得到的值是 ${answer}${unit}。`, {
    expectedLabel,
    userLabel: `${value}${unit}`
  });
}

function gradeChoice(question, response) {
  const selected = normalizeSelection(response);
  const correct = normalizeSelection(question.correct);
  const labels = Object.fromEntries((question.options || []).map((o) => [o.id, o.text]));
  const userLabel = selected.map((id) => labels[id] || id).join('；') || '未选择';
  const expectedLabel = correct.map((id) => labels[id] || id).join('；');
  if (sameSet(selected, correct)) {
    return result('goal_met', '概念判断正确。', { userLabel, expectedLabel });
  }
  return result('below_baseline', '概念判断与当前教学基线不一致。', {
    userLabel,
    expectedLabel
  });
}

export function gradeResponse(question, response) {
  if (!question) throw new Error('缺少题目');
  switch (question.type) {
    case 'action':
      return gradeAction(question, response);
    case 'legal':
      return gradeLegal(question, response);
    case 'best-five':
      return gradeBestFive(question, response);
    case 'compare':
      return gradeCompare(question, response);
    case 'numeric':
      return gradeNumeric(question, response);
    case 'choice':
      return gradeChoice(question, response);
    default:
      throw new Error(`未知题目类型: ${question.type}`);
  }
}

export function hintLevels(hints) {
  const filled = (hints || []).filter(Boolean).length;
  return Math.min(3, filled);
}
