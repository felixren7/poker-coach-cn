/**
 * 起手牌范围解析与蒙特卡洛权益。
 * 范围表示例：22+, A2s+, K9s+, QTs+, JTs, ATo+, KQo, random
 */

import {
  RANKS,
  SUITS,
  createDeck,
  mulberry32,
  shuffleInPlace,
  parseCard,
  assertUniqueCards,
  combosOf
} from './cards.js';
import { evaluateBest, compareScores } from './handEval.js';

const RANK_UP = [...RANKS]; // 2..A
const RANK_INDEX = Object.fromEntries(RANK_UP.map((r, i) => [r, i]));

function pairCombos(rank) {
  return combosOf(SUITS, 2).map(([s1, s2]) => [rank + s1, rank + s2]);
}

function suitedCombos(high, low) {
  return SUITS.map((s) => [high + s, low + s]);
}

function offsuitCombos(high, low) {
  const out = [];
  for (const s1 of SUITS) {
    for (const s2 of SUITS) {
      if (s1 !== s2) out.push([high + s1, low + s2]);
    }
  }
  return out;
}

function parseToken(raw) {
  const token = raw.trim();
  if (!token) return [];
  if (/^(random|任意|all)$/i.test(token)) {
    const all = [];
    for (const [a, b] of combosOf(createDeck(), 2)) {
      const [high, low] = parseCard(a).value >= parseCard(b).value ? [a, b] : [b, a];
      all.push([high, low]);
    }
    return all;
  }

  const pairPlus = token.match(/^([AKQJT98765432])\1\+$/i);
  if (pairPlus) {
    const rank = pairPlus[1].toUpperCase();
    const start = RANK_INDEX[rank];
    const combos = [];
    for (let i = start; i < RANK_UP.length; i++) {
      combos.push(...pairCombos(RANK_UP[i]));
    }
    return combos;
  }

  const pair = token.match(/^([AKQJT98765432])\1$/i);
  if (pair) return pairCombos(pair[1].toUpperCase());

  const nonPair = token.match(/^([AKQJT98765432])([AKQJT98765432])(s|o)?(\+)?$/i);
  if (!nonPair) throw new Error(`无法解析范围 token: ${token}`);
  let r1 = nonPair[1].toUpperCase();
  let r2 = nonPair[2].toUpperCase();
  if (r1 === r2) throw new Error(`对子请写成 ${r1}${r2}，不要带花色`);
  const high = RANK_INDEX[r1] >= RANK_INDEX[r2] ? r1 : r2;
  const low = RANK_INDEX[r1] >= RANK_INDEX[r2] ? r2 : r1;
  const suitType = (nonPair[3] || '').toLowerCase();
  const plus = Boolean(nonPair[4]);

  const lows = [];
  if (plus) {
    const highIndex = RANK_INDEX[high];
    const lowIndex = RANK_INDEX[low];
    if (lowIndex >= highIndex) throw new Error(`范围 token 顺序非法: ${token}`);
    for (let i = lowIndex; i < highIndex; i++) lows.push(RANK_UP[i]);
  } else {
    lows.push(low);
  }

  const combos = [];
  for (const l of lows) {
    if (!suitType || suitType === 's') combos.push(...suitedCombos(high, l));
    if (!suitType || suitType === 'o') combos.push(...offsuitCombos(high, l));
  }
  return combos;
}

/**
 * 展开为具体两张牌组合，自动去重（针对同时写了 AKs 与 AKo 的情况）。
 */
export function expandRange(rangeText) {
  const tokens = String(rangeText)
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) throw new Error('范围不能为空');
  const seen = new Set();
  const combos = [];
  for (const token of tokens) {
    for (const combo of parseToken(token)) {
      assertUniqueCards(combo, '范围组合');
      const key = [...combo].sort().join('');
      if (!seen.has(key)) {
        seen.add(key);
        combos.push(combo);
      }
    }
  }
  return combos;
}

export function comboCount(rangeText) {
  return expandRange(rangeText).length;
}

export function rangePercent(rangeText) {
  return (comboCount(rangeText) / 1326) * 100;
}

function compatible(combo, known) {
  return combo.every((c) => !known.has(c));
}

/**
 * 蒙特卡洛权益：hero 对 villain 的给定范围，公共牌按随机补全。
 * 结果包含模拟次数、范围组合数与 95% 近似误差，便于展示估算性质。
 */
export function equityVsRange(hero, board, rangeText, options = {}) {
  const iterations = options.iterations ?? 20000;
  const seed = (options.seed ?? 0xc0ffee) >>> 0;
  assertUniqueCards([...hero, ...board], '已知牌');
  if (hero.length !== 2) throw new Error('英雄必须有两张底牌');
  if (![0, 3, 4, 5].includes(board.length)) throw new Error('公共牌数量必须为 0、3、4 或 5');

  const known = new Set([...hero, ...board]);
  const allCombos = expandRange(rangeText).filter((combo) => compatible(combo, known));
  if (allCombos.length === 0) throw new Error('该范围与已知牌冲突，没有可用组合');

  const boardIsComplete = board.length === 5;
  const rng = mulberry32(seed);
  let wins = 0;
  let ties = 0;
  let played = 0;

  const evaluateOnce = (villain, runout) => {
    const heroHand = evaluateBest([...hero, ...runout]);
    const villainHand = evaluateBest([...villain, ...runout]);
    const cmp = compareScores(heroHand.score, villainHand.score);
    if (cmp > 0) wins++;
    else if (cmp === 0) ties++;
    played++;
  };

  if (boardIsComplete) {
    for (const villain of allCombos) {
      if (!compatible(villain, new Set(hero))) continue;
      evaluateOnce(villain, board);
    }
  } else {
    const need = 5 - board.length;
    for (let i = 0; i < iterations; i++) {
      const villain = allCombos[Math.floor(rng() * allCombos.length)];
      const used = new Set([...known, ...villain]);
      const deck = createDeck().filter((c) => !used.has(c));
      shuffleInPlace(deck, rng);
      const runout = deck.slice(0, need);
      evaluateOnce(villain, [...board, ...runout]);
    }
  }

  const equity = played === 0 ? 0 : (wins + ties / 2) / played;
  const margin = played > 0 ? 1.96 * Math.sqrt((equity * (1 - equity)) / played) : 0;
  return {
    equity,
    winRate: played === 0 ? 0 : wins / played,
    tieRate: played === 0 ? 0 : ties / played,
    iterations: played,
    rangeCombos: allCombos.length,
    range: rangeText,
    hero: [...hero],
    board: [...board],
    seed,
    margin,
    exact: boardIsComplete,
    note: boardIsComplete
      ? '河牌已发完，按范围逐一枚举；仍然依赖对手范围假设。'
      : `蒙特卡洛估算，${played} 次模拟；95% 近似误差约 ±${(margin * 100).toFixed(
          2
        )} 个百分点。结果依赖对手范围假设。`
  };
}

export function equityVsRandom(hero, board, options = {}) {
  return equityVsRange(hero, board, 'random', options);
}
