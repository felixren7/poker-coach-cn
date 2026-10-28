/**
 * 把结构化题目中的“局面快照”转换为规则引擎可读的状态。
 * 快照固定 6 人桌、BTN 在 0 号座位，位置顺序 BTN/SB/BB/UTG/HJ/CO。
 */

import { formatBB, parseCard, assertUniqueCards } from '../engine/cards.js';
import { POSITION_ORDER, getLegalActions } from '../engine/table.js';

export const SPOT_SEAT = Object.fromEntries(POSITION_ORDER.map((pos, i) => [pos, i]));

function defaultStack(committed) {
  return 200 - committed;
}

export function buildSpotState(spot) {
  if (!spot || !spot.heroPos) throw new Error('局面缺少 heroPos');
  if (SPOT_SEAT[spot.heroPos] === undefined) throw new Error(`未知位置: ${spot.heroPos}`);
  const board = spot.board || [];
  if (![0, 3, 4, 5].includes(board.length)) {
    throw new Error('公共牌数量必须为 0、3、4 或 5');
  }
  const expectedStreet = board.length === 0 ? 'preflop' : board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : 'river';
  if (spot.street && spot.street !== expectedStreet) {
    throw new Error(`street=${spot.street} 与公共牌数量不匹配`);
  }

  const seats = POSITION_ORDER.map((pos, seat) => {
    const data = spot.players?.[pos];
    if (!data) throw new Error(`缺少 ${pos} 的状态`);
    const committed = data.committed ?? 0;
    const stack = data.stack ?? defaultStack(committed);
    const streetBet =
      data.streetBet !== undefined
        ? data.streetBet
        : spot.street === 'preflop'
          ? committed
          : 0;
    return {
      seat,
      name: pos,
      isHuman: pos === spot.heroPos,
      stack,
      hole: pos === spot.heroPos ? [...(spot.heroCards || [])] : [],
      folded: Boolean(data.folded),
      allIn: Boolean(data.allIn) || stack === 0,
      streetBet,
      committed,
      hasActed: Boolean(data.hasActed),
      canRaise: pos === spot.heroPos ? spot.canRaise !== false : true,
      lastAction: data.lastAction || null,
      position: pos
    };
  });

  for (const s of seats) {
    if (!Number.isInteger(s.stack) || s.stack < 0) throw new Error(`${s.name} 筹码非法`);
    if (!Number.isInteger(s.committed) || s.committed < 0) throw new Error(`${s.name} 投入非法`);
    if (!Number.isInteger(s.streetBet) || s.streetBet < 0) throw new Error(`${s.name} 本轮投入非法`);
    if (s.streetBet > s.committed) throw new Error(`${s.name} 本轮投入超过总投入`);
    if (s.stack === 0 && !s.allIn && !s.folded) throw new Error(`${s.name} 0 筹码必须标记 allIn`);
  }

  const hero = seats[SPOT_SEAT[spot.heroPos]];
  if (hero.folded) throw new Error('英雄不能已弃牌');
  if (hero.allIn) throw new Error('英雄全下时不应再行动');
  if (!hero.hole || hero.hole.length !== 2) throw new Error('英雄必须有两张底牌');
  assertUniqueCards([...hero.hole, ...board], '已知牌');

  const currentBet = spot.currentBet ?? Math.max(0, ...seats.map((p) => p.streetBet));
  const maxStreetBet = Math.max(0, ...seats.map((p) => p.streetBet));
  if (currentBet !== maxStreetBet) {
    throw new Error(`currentBet=${currentBet} 与最大本轮投入 ${maxStreetBet} 不一致`);
  }
  if (currentBet < 0) throw new Error('currentBet 不能为负');
  const lastRaiseSize = spot.lastRaiseSize ?? (spot.street === 'preflop' ? 2 : currentBet || 2);
  if (!Number.isInteger(lastRaiseSize) || lastRaiseSize <= 0) {
    throw new Error('lastRaiseSize 必须是正整数');
  }

  const pot = seats.reduce((sum, p) => sum + p.committed, 0);
  if (spot.pot !== undefined && spot.pot !== pot) {
    throw new Error(`题目声明的底池 ${spot.pot} 与投入之和 ${pot} 不一致`);
  }

  const state = {
    config: { seatCount: 6, sb: 1, bb: 2, startingStack: 200, ante: 0, rake: 0 },
    seats,
    button: 0,
    nextButton: 1,
    sbSeat: 1,
    bbSeat: 2,
    deck: [],
    burned: [],
    board: [...board],
    street: spot.street || expectedStreet,
    currentBet,
    lastRaiseSize,
    actor: hero.seat,
    handNumber: 1,
    handStacks: seats.map((p) => p.stack + p.committed),
    pot,
    events: (spot.actionLog || []).map((entry, i) => ({
      type: entry.type || 'action',
      street: entry.street || spot.street || expectedStreet,
      pos: entry.pos,
      seat: SPOT_SEAT[entry.pos] ?? null,
      name: entry.pos,
      label: entry.label,
      action: entry.action ? { type: entry.action, to: entry.to, amount: entry.amount } : undefined,
      index: i
    })),
    history: [],
    result: null,
    scene: true
  };

  // 场景合法性：英雄必须是当前行动者；返回的合法操作至少包含弃牌。
  const legal = getLegalActions(state, hero.seat);
  if (!legal.actions.length) throw new Error('该局面中英雄没有合法操作');
  return state;
}

export function getSpotLegal(state) {
  return getLegalActions(state, state.actor);
}

export function legalCategorySet(state) {
  const legal = getSpotLegal(state);
  const types = new Set(legal.actions.map((a) => a.type));
  return {
    fold: types.has('fold'),
    check: types.has('check'),
    call: types.has('call'),
    bet: types.has('bet'),
    raise: types.has('raise')
  };
}

export const LEGAL_OPTIONS = [
  { id: 'fold', label: '弃牌' },
  { id: 'check', label: '过牌' },
  { id: 'call', label: '跟注' },
  { id: 'bet', label: '下注' },
  { id: 'raise', label: '加注' }
];

export function correctLegalSet(state) {
  const set = legalCategorySet(state);
  return LEGAL_OPTIONS.filter((option) => set[option.id]).map((option) => option.id);
}

export function actionSpecLabel(spec) {
  if (!spec) return '—';
  const b = (n) => `${formatBB(n)} BB`;
  switch (spec.type) {
    case 'fold':
      return '弃牌';
    case 'check':
      return '过牌';
    case 'call':
      return '跟注';
    case 'bet':
      if (spec.min !== undefined) return `下注 ${b(spec.min)}–${b(spec.max)}`;
      if (spec.minTo !== undefined) return `下注 ${b(spec.minTo)}–${b(spec.maxTo)}`;
      return spec.to !== undefined ? `下注 ${b(spec.to)}` : '下注';
    case 'raise':
      if (spec.minTo !== undefined) return `加注到 ${b(spec.minTo)}–${b(spec.maxTo)}`;
      return spec.to !== undefined ? `加注到 ${b(spec.to)}` : '加注';
    case 'allin':
      return '全下';
    default:
      return spec.type;
  }
}

export function actionMatchesSpec(actual, spec) {
  if (!actual || !spec) return false;
  if (actual.type !== spec.type) return false;
  if (spec.type === 'fold' || spec.type === 'check' || spec.type === 'call') return true;
  const to = actual.to;
  if (to === undefined) return false;
  if (spec.minTo !== undefined && spec.maxTo !== undefined) {
    return to >= spec.minTo && to <= spec.maxTo;
  }
  if (spec.min !== undefined && spec.max !== undefined) {
    return to >= spec.min && to <= spec.max;
  }
  if (spec.to !== undefined) return to === spec.to;
  return true;
}

export function isLegalResponse(state, response) {
  if (!response) return false;
  const legal = getSpotLegal(state);
  const type = response.type;
  if (type === 'fold' || type === 'check' || type === 'call') {
    return legal.actions.some((a) => a.type === type);
  }
  if (type === 'bet' || type === 'raise') {
    const option = legal.actions.find((a) => a.type === type);
    if (!option) return false;
    if (response.to === undefined) return false;
    if (type === 'bet') {
      return response.to >= option.min && response.to <= option.max;
    }
    return response.to >= option.minTo && response.to <= option.maxTo;
  }
  return false;
}

export function responseLabel(response) {
  if (!response) return '—';
  const b = (n) => `${formatBB(n)} BB`;
  switch (response.type) {
    case 'fold':
      return '弃牌';
    case 'check':
      return '过牌';
    case 'call':
      return '跟注';
    case 'bet':
      return `下注 ${b(response.to)}`;
    case 'raise':
      return `加注到 ${b(response.to)}`;
    default:
      return response.type;
  }
}

export function heroSeatOf(state) {
  return state.seats.find((s) => s.isHuman)?.seat ?? null;
}

export function parseSpotCards(cards) {
  return (cards || []).map((c) => parseCard(c).code);
}
