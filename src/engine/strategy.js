/**
 * 教学基线启发式（不是求解器）。
 *
 * 这里的能力边界必须如实展示：
 * - 使用简化的起手牌评分、位置、牌面质地、听牌补牌与底池赔率；
 * - 不输出精确 EV 损失、GTO 频率或“唯一最优”；
 * - 复盘/提示文案应标注“教学基线”，并说明依赖的假设。
 */

import { CATEGORY, evaluateBest, startingHandCode } from './handEval.js';
import { outsProbability, potOdds } from './odds.js';
import { getLegalActions, positionOf, toCall } from './table.js';

const CARD_VALUE = {
  A: 10,
  K: 8,
  Q: 7,
  J: 6,
  T: 5,
  9: 4.5,
  8: 4,
  7: 3.5,
  6: 3,
  5: 2.5,
  4: 2,
  3: 1.5,
  2: 1
};

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const RANK_INDEX = Object.fromEntries(RANK_ORDER.map((r, i) => [r, i]));

export function chenScore(hole) {
  if (!hole || hole.length !== 2) throw new Error('chenScore 需要两张牌');
  const [a, b] = hole
    .map((card) => ({ rank: card[0], suit: card[1] }))
    .sort((x, y) => RANK_INDEX[y.rank] - RANK_INDEX[x.rank]);
  const hi = a.rank;
  const lo = b.rank;
  const pair = hi === lo;
  let score = pair ? Math.max(5, CARD_VALUE[hi] * 2) : CARD_VALUE[hi];
  const suited = a.suit === b.suit;
  if (suited && !pair) score += 2;
  if (!pair) {
    const gap = RANK_INDEX[hi] - RANK_INDEX[lo] - 1;
    if (gap === 1) score -= 1;
    else if (gap === 2) score -= 2;
    else if (gap === 3) score -= 4;
    else if (gap >= 4) score -= 5;
    if (RANK_INDEX[hi] < RANK_INDEX.Q && gap <= 1) score += 1;
  }
  return Math.round(score * 2) / 2;
}

const OPEN_THRESHOLD = { UTG: 9, HJ: 8, CO: 7, BTN: 6, SB: 7, BB: 5 };
const CALL_THRESHOLD = { UTG: 8, HJ: 7, CO: 7, BTN: 6, SB: 7, BB: 5 };

export function openThreshold(position) {
  return OPEN_THRESHOLD[position] ?? 7;
}

export function callThreshold(position) {
  return CALL_THRESHOLD[position] ?? 7;
}

export function isPremiumHand(hole) {
  const [a, b] = hole.map((c) => c[0]).sort((x, y) => RANK_INDEX[y] - RANK_INDEX[x]);
  const pair = a === b;
  if (pair && RANK_INDEX[a] >= RANK_INDEX.Q) return true;
  if (!pair && a === 'A' && (b === 'K' || b === 'Q')) return true;
  return false;
}

export function isPair(hole) {
  return hole[0][0] === hole[1][0];
}

export function boardTexture(board) {
  if (!board || board.length < 3) {
    return { label: '尚未发公共牌', suit: 'none', paired: false, connected: false, wetness: 0 };
  }
  const ranks = board.map((c) => c[0]);
  const suits = board.map((c) => c[1]);
  const suitCounts = suits.reduce((map, s) => map.set(s, (map.get(s) || 0) + 1), new Map());
  const maxSuit = Math.max(...suitCounts.values());
  const suit =
    maxSuit >= 3 ? 'monotone' : maxSuit === 2 ? 'two-tone' : 'rainbow';

  const rankCounts = ranks.reduce((map, r) => map.set(r, (map.get(r) || 0) + 1), new Map());
  const paired = [...rankCounts.values()].some((n) => n >= 2);
  const unique = [...new Set(ranks.map((r) => RANK_INDEX[r]))].sort((a, b) => a - b);
  let connected = false;
  for (let i = 0; i < unique.length - 2; i++) {
    if (unique[i + 2] - unique[i] <= 4) connected = true;
  }
  const broadway = ranks.filter((r) => RANK_INDEX[r] >= RANK_INDEX.T).length >= 2;
  const wetness =
    (maxSuit >= 3 ? 2 : maxSuit === 2 ? 1 : 0) +
    (connected ? 1 : 0) +
    (paired ? 0.5 : 0) +
    (broadway ? 0.5 : 0);
  const labels = [];
  if (maxSuit >= 3) labels.push('单花面');
  else if (maxSuit === 2) labels.push('两同花');
  else labels.push('彩虹面');
  if (paired) labels.push('成对面');
  if (connected) labels.push('连张面');
  labels.push(wetness >= 2.5 ? '湿润' : wetness >= 1.5 ? '中等湿润' : '较干燥');
  return { label: labels.join(' · '), suit, maxSuit, paired, connected, broadway, wetness };
}

export function madeHandStrength(hole, board) {
  if (!board || board.length < 3) return 0.1;
  const hand = evaluateBest([...hole, ...board]);
  const boardRanks = board.map((c) => RANK_INDEX[c[0]]);
  const maxBoard = Math.max(...boardRanks);
  switch (hand.category) {
    case CATEGORY.STRAIGHT_FLUSH:
      return 1;
    case CATEGORY.QUADS:
      return 0.99;
    case CATEGORY.FULL_HOUSE:
      return 0.96;
    case CATEGORY.FLUSH:
      return 0.92;
    case CATEGORY.STRAIGHT:
      return 0.88;
    case CATEGORY.TRIPS:
      return 0.8;
    case CATEGORY.TWO_PAIR:
      return 0.66;
    case CATEGORY.PAIR: {
      const pairRank = hand.score[1];
      if (pairRank > maxBoard) return 0.62;
      if (pairRank === maxBoard) return 0.55;
      if (boardRanks.filter((r) => r === pairRank).length === 1) return 0.42;
      return 0.32;
    }
    default:
      return 0.12;
  }
}

/**
 * 只数“下一张牌能完成顺子/同花”的具体补牌，天然处理重叠。
 * 这是完成补牌数，不是赢牌补牌数。
 */
export function countDrawOuts(hole, board) {
  if (!board || board.length < 3 || board.length >= 5) return { outs: 0, cards: [] };
  const known = new Set([...hole, ...board]);
  const current = evaluateBest([...hole, ...board]);
  if (current.category >= CATEGORY.STRAIGHT) return { outs: 0, cards: [] };
  const deck = [];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const suits = ['s', 'h', 'd', 'c'];
  for (const r of ranks) for (const s of suits) if (!known.has(r + s)) deck.push(r + s);
  const cards = [];
  for (const card of deck) {
    const result = evaluateBest([...hole, ...board, card]);
    if (
      result.category === CATEGORY.STRAIGHT ||
      result.category === CATEGORY.FLUSH ||
      result.category === CATEGORY.STRAIGHT_FLUSH
    ) {
      cards.push(card);
    }
  }
  return { outs: cards.length, cards };
}

export function drawCompletion(outs, street) {
  if (street === 'flop') return outsProbability(outs, 47, 46).byRiver;
  if (street === 'turn') return outsProbability(outs, 46, null).oneCard;
  return 0;
}

function legalRaiseTo(legal, target) {
  const raise = legal.actions.find((a) => a.type === 'raise');
  if (!raise) return null;
  const to = Math.max(raise.minTo, Math.min(raise.maxTo, Math.round(target)));
  return { type: 'raise', to };
}

function legalBetTo(legal, target) {
  const bet = legal.actions.find((a) => a.type === 'bet');
  if (!bet) return null;
  const to = Math.max(bet.min, Math.min(bet.max, Math.round(target)));
  return { type: 'bet', to };
}

function hasAction(legal, type) {
  return legal.actions.some((a) => a.type === type);
}

function fmtAction(action, bb = 2) {
  if (!action) return '—';
  const b = (n) => `${(n / bb).toFixed(n % bb === 0 ? 0 : 1)}BB`;
  switch (action.type) {
    case 'fold':
      return '弃牌';
    case 'check':
      return '过牌';
    case 'call':
      return '跟注';
    case 'bet':
      return `下注到 ${b(action.to)}`;
    case 'raise':
      return `加注到 ${b(action.to)}`;
    default:
      return action.type;
  }
}

/**
 * 教练决策：只用于“教学基线”提示/复盘，不是 solver。
 * @param {object} tableLike 包含公共信息的牌桌状态（可以来自场景快照）
 * @param {number} seat
 */
export function coachDecision(tableLike, seat) {
  const legal = getLegalActions(tableLike, seat);
  if (!legal.actions.length) return null;
  const position = positionOf(tableLike, seat);
  const player = tableLike.seats[seat];
  const hole = player.hole;
  const opponents = tableLike.seats.filter((p) => p.seat !== seat && !p.folded).length;
  const bb = tableLike.config?.bb ?? 2;
  const toCallAmount = legal.toCall;
  const pot = tableLike.pot;
  const reasons = [];
  const alternatives = [];
  let action = null;
  let confidence = '中';

  if (tableLike.street === 'preflop') {
    const chen = chenScore(hole);
    reasons.push(`起手牌 ${startingHandCode(hole)}（简化 Chen 评分 ${chen}）`);
    reasons.push(`位置 ${position}，身后还有 ${opponents} 名对手`);

    if (toCallAmount === 0) {
      const raise = legalRaiseTo(legal, bb * 2.5);
      if (raise && (chen >= openThreshold(position) + 1 || (hasAction(legal, 'check') && chen >= 12))) {
        action = raise;
        reasons.push('无人下注/盲注选项，简化开池范围支持主动加注。');
      } else if (hasAction(legal, 'check')) {
        action = { type: 'check' };
        reasons.push('当前可以免费看牌，简化基线选择过牌。');
      }
    } else {
      const openSize = toCallAmount + player.streetBet;
      const premium = isPremiumHand(hole);
      const raise = legalRaiseTo(legal, Math.max(bb * 6, openSize * 3));
      if (premium && raise) {
        action = raise;
        reasons.push('属于简化定义的强牌（QQ+/AK/AQ），可再加注获取价值。');
        alternatives.push({ action: { type: 'call' }, note: '慢打/控池，但会让更多对手便宜看翻牌。' });
      } else {
        const pair = isPair(hole);
        const impliedOk = pair && toCallAmount <= bb * 4 && player.stack > toCallAmount * 12;
        const baselineOk =
          chen >= callThreshold(position) + (position === 'BB' ? -1 : 0) &&
          toCallAmount <= bb * 5;
        if (impliedOk || baselineOk) {
          action = { type: 'call' };
          reasons.push(
            impliedOk
              ? '小对子有隐含赔率，跟注成本相对后手较低。'
              : '牌力达到该位置的简化跟注线，且跟注额相对可控。'
          );
          if (raise) alternatives.push({ action: raise, note: '有条件时可用再加注施压，但并非默认。' });
        } else {
          action = { type: 'fold' };
          reasons.push('牌力/赔率不足以支持继续，简化基线弃牌。');
          if (hasAction(legal, 'call')) {
            alternatives.push({ action: { type: 'call' }, note: '仅在对手范围极宽、你有明确翻后计划时考虑。' });
          }
        }
      }
    }
  } else {
    const texture = boardTexture(tableLike.board);
    const made = madeHandStrength(hole, tableLike.board);
    const draw = countDrawOuts(hole, tableLike.board);
    const drawEq = drawCompletion(draw.outs, tableLike.street);
    const required = toCallAmount > 0 ? potOdds(pot, toCallAmount).breakeven : 0;
    const strengthEstimate = Math.max(0, Math.min(1, made + drawEq * 0.6 - 0.05 * Math.max(0, opponents - 1)));

    reasons.push(`牌面：${texture.label}`);
    reasons.push(`当前成牌强度（简化 0–1）：${made.toFixed(2)}`);
    if (draw.outs > 0) {
      reasons.push(
        `下一张可完成顺/同花的补牌约 ${draw.outs} 张；完成概率 ${(drawEq * 100).toFixed(
          1
        )}%（不等于胜率）`
      );
    }
    if (toCallAmount > 0) {
      reasons.push(`底池赔率要求约 ${(required * 100).toFixed(1)}% 的盈亏平衡权益`);
    }

    if (toCallAmount === 0) {
      const valueBet = legalBetTo(legal, pot * 0.6);
      const semiBluff = legalBetTo(legal, pot * 0.55);
      if (valueBet && made >= 0.72 && opponents <= 2) {
        action = valueBet;
        reasons.push('成牌较强且对手不多，简化基线选择中等尺度价值下注。');
        alternatives.push({ action: { type: 'check' }, note: '控池/诱导，但可能错过价值。' });
      } else if (semiBluff && draw.outs >= 8) {
        action = semiBluff;
        reasons.push('有较强听牌，下注可同时获取弃牌权益与做大底池。');
        alternatives.push({ action: { type: 'check' }, note: '免费看下一张，保留摊牌价值。' });
      } else if (hasAction(legal, 'check')) {
        action = { type: 'check' };
        reasons.push('没有足够价值或弃牌权益，简化基线过牌。');
      }
    } else {
      const valueRaise = legalRaiseTo(legal, tableLike.currentBet + (pot + toCallAmount) * 0.65);
      if (made >= 0.82 && valueRaise && opponents <= 2) {
        action = valueRaise;
        reasons.push('强成牌，面对下注可加注获取价值。');
        alternatives.push({ action: { type: 'call' }, note: '慢打，适合对手容易继续下注的牌面。' });
      } else if (
        (strengthEstimate >= required + 0.03 && made >= 0.4) ||
        (draw.outs >= 8 && drawEq >= required - 0.04)
      ) {
        action = { type: 'call' };
        reasons.push(
          draw.outs >= 8 && made < 0.4
            ? '听牌完成概率接近或超过底池赔率要求，简化基线跟注；实际还要考虑隐含赔率与反超。'
            : '简化牌力与听牌完成概率的综合评估高于底池赔率要求，简化基线跟注。'
        );
        if (valueRaise) alternatives.push({ action: valueRaise, note: '强牌/强听牌可加注，但会放大波动。' });
      } else {
        action = { type: 'fold' };
        reasons.push('简化牌力评估不足以覆盖底池赔率，且没有足够隐含赔率，简化基线弃牌。');
        alternatives.push({ action: { type: 'call' }, note: '仅在对手范围很宽、后续赔付潜力大时考虑。' });
      }
    }
    confidence = draw.outs >= 8 ? '低' : '中';
  }

  if (!action) action = { type: hasAction(legal, 'check') ? 'check' : 'fold' };

  return {
    action,
    label: fmtAction(action, bb),
    reasons,
    alternatives,
    confidence,
    assumptions:
      '教学基线：100BB 6-max、无前注/无抽水、简化范围与启发式牌力。不是求解器，不提供精确 EV 损失或 GTO 频率。',
    position,
    street: tableLike.street,
    toCall: toCallAmount,
    pot
  };
}

export function evaluateDecisionBaseline(tableLike, seat) {
  return coachDecision(tableLike, seat);
}
