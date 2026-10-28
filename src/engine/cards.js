/**
 * 牌与随机数工具。
 * 内部牌张编码为 "As" / "Td" 这样的两字符字符串，便于序列化、日志与测试。
 * 筹码内部一律使用整数：1 枚 = 0.5BB，2 枚 = 1BB。显示时再换算。
 */

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS = ['s', 'h', 'd', 'c'];

export const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));
export const VALUE_RANK = Object.fromEntries(RANKS.map((r, i) => [i + 2, r]));

export const SUIT_META = {
  s: { symbol: '♠', name: '黑桃', color: 'black' },
  h: { symbol: '♥', name: '红桃', color: 'red' },
  d: { symbol: '♦', name: '方块', color: 'red' },
  c: { symbol: '♣', name: '梅花', color: 'black' }
};

export const CHIPS_PER_BB = 2;

export function chipsToBB(chips) {
  return chips / CHIPS_PER_BB;
}

export function bbToChips(bb) {
  return Math.round(bb * CHIPS_PER_BB);
}

/** 显示为大盲单位，去掉无意义的 .0 */
export function formatBB(chips) {
  const bb = chips / CHIPS_PER_BB;
  if (Number.isInteger(bb)) return String(bb);
  return bb.toFixed(1).replace(/\.0$/, '');
}

export function formatChips(chips) {
  return `${formatBB(chips)} BB`;
}

export function rankText(rank) {
  return rank === 'T' ? '10' : rank;
}

export function parseCard(code) {
  if (typeof code !== 'string' || code.length !== 2) {
    throw new Error(`非法牌张: ${code}`);
  }
  const rank = code[0].toUpperCase();
  const suit = code[1].toLowerCase();
  if (!RANKS.includes(rank) || !SUITS.includes(suit)) {
    throw new Error(`非法牌张: ${code}`);
  }
  return { code: rank + suit, rank, suit, value: RANK_VALUE[rank] };
}

export function cardCode(rank, suit) {
  const r = rank.toUpperCase();
  const s = suit.toLowerCase();
  if (!RANKS.includes(r) || !SUITS.includes(s)) {
    throw new Error(`非法牌张: ${rank}${suit}`);
  }
  return r + s;
}

export function cardLabel(code) {
  const { rank, suit } = parseCard(code);
  return `${rankText(rank)}${SUIT_META[suit].symbol}`;
}

export function cardAriaLabel(code) {
  const { rank, suit } = parseCard(code);
  return `${SUIT_META[suit].name}${rankText(rank)}`;
}

export function cardsFromString(str) {
  if (!str) return [];
  return str
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((c) => parseCard(c).code);
}

export function sortCardsByRank(cards, descending = true) {
  return [...cards].sort((a, b) => {
    const diff = parseCard(a).value - parseCard(b).value;
    return descending ? -diff : diff;
  });
}

export function createDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) deck.push(r + s);
  }
  return deck;
}

export function assertUniqueCards(cards, context = '牌张') {
  const seen = new Set();
  for (const c of cards) {
    parseCard(c);
    if (seen.has(c)) throw new Error(`${context}存在重复牌: ${c}`);
    seen.add(c);
  }
  return true;
}

/** 可复现的 mulberry32 随机数生成器 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 可序列化的 xorshift32：返回 [0,1) 与新状态 */
export function nextRandom(state) {
  let x = state >>> 0;
  if (x === 0) x = 0x9e3779b9;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return [x / 4294967296, x];
}

export function shuffleInPlace(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function shuffle(cards, rng) {
  return shuffleInPlace([...cards], rng);
}

export function randomSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function remainingDeck(knownCards) {
  const known = new Set(knownCards);
  return createDeck().filter((c) => !known.has(c));
}

export function handKey(cards) {
  return [...cards].sort().join('');
}

export function sameCardSet(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((c, i) => c === sortedB[i]);
}

export function combosOf(cards, k) {
  const out = [];
  const pick = (start, acc) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < cards.length; i++) {
      acc.push(cards[i]);
      pick(i + 1, acc);
      acc.pop();
    }
  };
  pick(0, []);
  return out;
}
