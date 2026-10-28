/**
 * 德州扑克牌力引擎（5–7 张）。
 * 采用“枚举全部五张组合 + 字典序比较”，优先保证正确性与可审计性。
 */

import {
  combosOf,
  assertUniqueCards,
  parseCard,
  rankText,
  sortCardsByRank,
  VALUE_RANK
} from './cards.js';

export const CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8
};

export const CATEGORY_NAMES = [
  '高牌',
  '一对',
  '两对',
  '三条',
  '顺子',
  '同花',
  '葫芦',
  '四条',
  '同花顺'
];

export const CATEGORY_NAMES_EN = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush'
];

function straightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let i = 0; i <= unique.length - 5; i++) {
    if (unique[i] - unique[i + 4] === 4) return unique[i];
  }
  return null;
}

function baseResult(category, score, cards) {
  return {
    category,
    score,
    cards: [...cards],
    name: CATEGORY_NAMES[category],
    nameEn: CATEGORY_NAMES_EN[category]
  };
}

/**
 * 评估恰好五张牌。
 * score 形如 [类别, 比较项1, 比较项2, ...]，可直接做字典序比较。
 */
export function evaluateFive(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) {
    throw new Error('evaluateFive 需要恰好 5 张牌');
  }
  assertUniqueCards(cards, '手牌');
  const parsed = cards.map(parseCard);
  const values = parsed.map((c) => c.value).sort((a, b) => b - a);
  const suits = parsed.map((c) => c.suit);

  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);

  const groups = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const isFlush = suits.every((s) => s === suits[0]);
  const highStraight = straightHigh(values);

  if (isFlush && highStraight) {
    const result = baseResult(CATEGORY.STRAIGHT_FLUSH, [CATEGORY.STRAIGHT_FLUSH, highStraight], cards);
    result.name = highStraight === 14 ? '皇家同花顺' : '同花顺';
    return result;
  }

  if (groups[0].count === 4) {
    const quad = groups[0].value;
    const kicker = groups[1].value;
    return baseResult(CATEGORY.QUADS, [CATEGORY.QUADS, quad, kicker], cards);
  }

  if (groups[0].count === 3 && groups[1]?.count === 2) {
    return baseResult(
      CATEGORY.FULL_HOUSE,
      [CATEGORY.FULL_HOUSE, groups[0].value, groups[1].value],
      cards
    );
  }

  if (isFlush) {
    return baseResult(CATEGORY.FLUSH, [CATEGORY.FLUSH, ...values], cards);
  }

  if (highStraight) {
    return baseResult(CATEGORY.STRAIGHT, [CATEGORY.STRAIGHT, highStraight], cards);
  }

  if (groups[0].count === 3) {
    const trip = groups[0].value;
    const kickers = groups
      .slice(1)
      .map((g) => g.value)
      .sort((a, b) => b - a);
    return baseResult(CATEGORY.TRIPS, [CATEGORY.TRIPS, trip, ...kickers], cards);
  }

  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const pairs = [groups[0].value, groups[1].value].sort((a, b) => b - a);
    const kicker = groups[2].value;
    return baseResult(CATEGORY.TWO_PAIR, [CATEGORY.TWO_PAIR, ...pairs, kicker], cards);
  }

  if (groups[0].count === 2) {
    const pair = groups[0].value;
    const kickers = groups
      .slice(1)
      .map((g) => g.value)
      .sort((a, b) => b - a);
    return baseResult(CATEGORY.PAIR, [CATEGORY.PAIR, pair, ...kickers], cards);
  }

  return baseResult(CATEGORY.HIGH_CARD, [CATEGORY.HIGH_CARD, ...values], cards);
}

export function compareScores(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

export function compareHands(a, b) {
  return compareScores(evaluateFive(a).score, evaluateFive(b).score);
}

/**
 * 从 5–7 张牌中找出最佳五张。
 */
export function evaluateBest(cards) {
  if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7) {
    throw new Error('evaluateBest 需要 5 到 7 张牌');
  }
  assertUniqueCards(cards, '手牌');
  if (cards.length === 5) return evaluateFive(cards);

  let best = null;
  for (const combo of combosOf(cards, 5)) {
    const evaluated = evaluateFive(combo);
    if (!best || compareScores(evaluated.score, best.score) > 0) {
      best = evaluated;
    }
  }
  return best;
}

export function bestFiveCards(cards) {
  return sortCardsByRank(evaluateBest(cards).cards);
}

export function handNameOf(cards) {
  return describeBest(cards).name;
}

function valueText(value) {
  return rankText(VALUE_RANK[value] ?? String(value));
}

function kickerText(values) {
  if (!values.length) return '';
  return values.map(valueText).join('、');
}

/**
 * 生成中文描述，包含关键比较项，便于新手理解“为什么赢/输”。
 */
export function describeBest(cards) {
  const evaluated = evaluateBest(cards);
  const score = evaluated.score;
  const category = evaluated.category;
  let detail = '';

  switch (category) {
    case CATEGORY.STRAIGHT_FLUSH:
      detail = score[1] === 14 ? 'A 高，五张同花色连续牌' : `${valueText(score[1])} 高`;
      break;
    case CATEGORY.QUADS:
      detail = `${valueText(score[1])}，踢脚 ${valueText(score[2])}`;
      break;
    case CATEGORY.FULL_HOUSE:
      detail = `${valueText(score[1])} 带 ${valueText(score[2])}`;
      break;
    case CATEGORY.FLUSH:
      detail = `${valueText(score[1])} 高，五张同花色`;
      break;
    case CATEGORY.STRAIGHT:
      detail = `${valueText(score[1])} 高`;
      break;
    case CATEGORY.TRIPS:
      detail = `${valueText(score[1])}，踢脚 ${kickerText(score.slice(2))}`;
      break;
    case CATEGORY.TWO_PAIR:
      detail = `${valueText(score[1])} 和 ${valueText(score[2])}，踢脚 ${valueText(score[3])}`;
      break;
    case CATEGORY.PAIR:
      detail = `${valueText(score[1])}，踢脚 ${kickerText(score.slice(2))}`;
      break;
    default:
      detail = `${kickerText(score.slice(1))} 高`;
  }

  return {
    ...evaluated,
    detail,
    fullName: detail ? `${evaluated.name}（${detail}）` : evaluated.name,
    bestFive: sortCardsByRank(evaluated.cards)
  };
}

export function startingHandCode(hole) {
  if (!hole || hole.length !== 2) throw new Error('起手牌需要两张牌');
  const [a, b] = hole.map(parseCard);
  const [high, low] = a.value >= b.value ? [a, b] : [b, a];
  if (high.value === low.value) return high.rank + low.rank;
  return high.rank + low.rank + (high.suit === low.suit ? 's' : 'o');
}

export function describeStartingHand(hole) {
  const [a, b] = hole.map(parseCard);
  const high = a.value >= b.value ? a : b;
  const low = a.value >= b.value ? b : a;
  const pair = high.value === low.value;
  const suited = high.suit === low.suit;
  const gap = Math.abs(high.value - low.value);
  const parts = [];

  if (pair) {
    parts.push(`口袋对子 ${rankText(high.rank)}`);
  } else {
    parts.push(`${rankText(high.rank)}${rankText(low.rank)} ${suited ? '同花' : '非同花'}`);
    if (gap === 1) parts.push('连张');
    else if (gap === 2) parts.push('隔一张');
    else parts.push('不连张');
  }
  if (pair) parts.push('对子');
  return {
    code: startingHandCode(hole),
    text: parts.join('，'),
    pair,
    suited,
    gap
  };
}

export function usedHoleCards(hole, fiveCards) {
  const set = new Set(fiveCards);
  return hole.filter((c) => set.has(c)).length;
}

export function categoryName(category) {
  return CATEGORY_NAMES[category] ?? '未知';
}

export function isStrongMadeHand(category) {
  return category >= CATEGORY.STRAIGHT;
}
