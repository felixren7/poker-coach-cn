/**
 * 模拟牌局重放与“当时可知”快照。
 * 复盘不能把牌堆、对手暗牌或未来公共牌带进决策界面。
 */

import { cloneTable, applyAction, getPublicView } from '../engine/table.js';
import { coachDecision } from '../engine/strategy.js';

export function reconstructDecisions(record) {
  if (!record?.initial) {
    return { decisions: [], finalTable: null, error: '这条记录缺少初始牌局快照。' };
  }
  let table;
  try {
    table = cloneTable(record.initial);
  } catch (error) {
    return { decisions: [], finalTable: null, error: `初始快照损坏：${error.message}` };
  }
  const decisions = [];
  const actions = record.actions || [];
  for (let index = 0; index < actions.length; index++) {
    const entry = actions[index];
    if (entry.seat === record.humanSeat) {
      decisions.push({
        index,
        street: entry.street,
        snapshot: cloneTable(table),
        chosen: entry.action,
        potBefore: entry.potBefore,
        potAfter: entry.potAfter
      });
    }
    try {
      applyAction(table, entry.seat, entry.action);
    } catch (error) {
      return {
        decisions,
        finalTable: table,
        error: `第 ${index + 1} 个行动无法重放：${error.message}`
      };
    }
  }
  return { decisions, finalTable: table, error: null };
}

/** 只含决策时可知信息的视图。 */
export function decisionPublicView(snapshot, humanSeat) {
  return getPublicView(snapshot, humanSeat, { revealAll: false });
}

/**
 * 与教学基线比较。不是 solver 判定，只用于复盘提示。
 */
export function compareToBaseline(view, seat, action) {
  const baseline = coachDecision(view, seat);
  if (!baseline) {
    return { baseline: null, kind: 'unknown', label: '无法比较', detail: '当前局面没有可用的教学基线。' };
  }
  if (action.type !== baseline.action.type) {
    return {
      baseline,
      kind: 'different',
      label: '与教学基线动作不同',
      detail: '这可能是合理偏离，也可能是需要复查的选择；请结合下方理由与适用条件。'
    };
  }
  if (['fold', 'check', 'call'].includes(action.type)) {
    return {
      baseline,
      kind: 'match',
      label: '与教学基线动作一致',
      detail: '动作类型一致；仍要理解这不是唯一正确答案。'
    };
  }
  const actualTo = action.to || 0;
  const baseTo = baseline.action.to || 0;
  const tolerance = Math.max(2, Math.round(baseTo * 0.2));
  if (Math.abs(actualTo - baseTo) <= tolerance) {
    return {
      baseline,
      kind: 'match',
      label: '与教学基线接近',
      detail: '动作类型与尺度都接近教学基线；这不是 solver 精度。'
    };
  }
  return {
    baseline,
    kind: 'size',
    label: '动作类型一致，尺度不同',
    detail: '尺度会改变对手的继续范围；请检查你希望哪些牌跟注。'
  };
}
