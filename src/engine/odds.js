/**
 * 概率与赔率公式。所有函数只做数学，不读取牌局隐藏信息。
 *
 * 术语边界：
 * - outs 完成概率：补牌在后续街道出现的概率，不等于胜率。
 * - 权益（equity）：在给定对手范围假设下，摊牌时赢得底池的份额（含平局半分）。
 * - 底池赔率：跟注额 / 跟注后底池，得到“立即盈亏平衡权益”。
 */

export function combinations(n, k) {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= kk; i++) {
    result = (result * (n - kk + i)) / i;
  }
  return Math.round(result);
}

/**
 * @param {number} potBeforeCall 对手下注后、你跟注前的底池（含对手本次下注）
 * @param {number} callAmount 你需要跟注的金额
 */
export function potOdds(potBeforeCall, callAmount) {
  if (potBeforeCall < 0 || callAmount < 0) throw new Error('底池与跟注额不能为负');
  if (callAmount === 0) {
    return { breakeven: 0, finalPot: potBeforeCall, ratio: 0, formula: '无需跟注' };
  }
  const finalPot = potBeforeCall + callAmount;
  return {
    breakeven: callAmount / finalPot,
    finalPot,
    ratio: callAmount / potBeforeCall,
    formula: `${callAmount} / (${potBeforeCall} + ${callAmount}) = ${(
      (callAmount / finalPot) *
      100
    ).toFixed(2)}%`
  };
}

/**
 * 一张牌或两张牌内完成听牌的概率。
 * 翻牌圈：unseenTurn=47, unseenRiver=46。
 * 转牌圈：只传 unseenTurn=46。
 */
export function outsProbability(outs, unseenTurn = 47, unseenRiver = 46) {
  if (!Number.isInteger(outs) || outs < 0) throw new Error('补牌数必须是非负整数');
  if (!Number.isInteger(unseenTurn) || unseenTurn <= 0) throw new Error('未见牌数非法');
  if (outs > unseenTurn) throw new Error('补牌数不能超过未见牌数');
  const oneCard = outs / unseenTurn;
  if (unseenRiver == null) {
    return { oneCard, byRiver: null, formula: `${outs} / ${unseenTurn}` };
  }
  if (!Number.isInteger(unseenRiver) || unseenRiver <= 0 || unseenRiver >= unseenTurn) {
    throw new Error('转牌后未见牌数必须小于翻牌后未见牌数');
  }
  if (outs > unseenRiver && unseenRiver < unseenTurn) {
    // 理论上不会发生；保留防御。
  }
  const missBoth = ((unseenTurn - outs) / unseenTurn) * ((unseenRiver - outs) / unseenRiver);
  return {
    oneCard,
    byRiver: 1 - missBoth,
    formula: `1 - (${unseenTurn - outs}/${unseenTurn}) × (${unseenRiver - outs}/${unseenRiver})`
  };
}

export function percent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

/** 常见翻牌圈听牌的补牌数（仅完成概率，未考虑能否赢）。 */
export const COMMON_DRAWS = Object.freeze({
  flush: { outs: 9, label: '同花听牌' },
  oesd: { outs: 8, label: '两头顺听牌' },
  gutshot: { outs: 4, label: '卡顺听牌' },
  comboDraw: { outs: 15, label: '同花 + 两头顺（重叠 2 张）' },
  overcards: { outs: 6, label: '两张高牌（未计重叠与反超）' }
});

/**
 * 考虑未来可赢筹码的简化隐含赔率。
 * @param {number} callAmount 当前跟注
 * @param {number} potAfterCall 当前跟注后的底池
 * @param {number} futureWinnings 预计后续还能从对手赢到的筹码
 */
export function impliedOdds(callAmount, potAfterCall, futureWinnings) {
  if (callAmount <= 0) throw new Error('跟注额必须为正');
  const total = potAfterCall + futureWinnings;
  return {
    breakeven: callAmount / total,
    total,
    formula: `${callAmount} / (${potAfterCall} + ${futureWinnings}) = ${(
      (callAmount / total) *
      100
    ).toFixed(2)}%`
  };
}

/**
 * 简化的跟注 EV。仅在该权益与底池假设成立时有效；不包含后续下注。
 */
export function evCall(equity, potBeforeCall, callAmount) {
  if (equity < 0 || equity > 1) throw new Error('权益必须在 0 到 1 之间');
  return {
    ev: equity * (potBeforeCall + callAmount) - callAmount,
    formula: `${(equity * 100).toFixed(1)}% × (${potBeforeCall} + ${callAmount}) - ${callAmount}`
  };
}

/** 常见“二四法则”的近似值，仅用于教学直觉，精确计算请用 outsProbability。 */
export function ruleOfThumb(outs, streets = 2) {
  return (outs * (streets === 2 ? 4 : 2)) / 100;
}
