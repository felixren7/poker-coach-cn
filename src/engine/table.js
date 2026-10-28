/**
 * 无限注德州扑克 6 人桌规则引擎。
 *
 * 设计约束：
 * - 筹码为整数（1 = 0.5BB），避免浮点误差。
 * - 状态是纯 JSON，可克隆、持久化、逐手重放。
 * - 只负责规则与筹码，不负责策略；策略模块只能通过 getPublicView 读取信息。
 */

import {
  createDeck,
  shuffleInPlace,
  nextRandom,
  assertUniqueCards,
  parseCard,
  formatBB
} from './cards.js';
import { evaluateBest, describeBest } from './handEval.js';

export const POSITION_ORDER = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];
export const SEAT_COUNT = 6;
export const DEFAULT_NAMES = ['你', '阿北', '小满', '老K', '青禾', '石头'];

export const DEFAULT_CONFIG = Object.freeze({
  seatCount: SEAT_COUNT,
  sb: 1,
  bb: 2,
  startingStack: 200,
  ante: 0,
  rake: 0
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createTable(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
  if (config.seatCount !== SEAT_COUNT) {
    throw new Error('当前版本只支持 6 人桌');
  }
  const names = options.names || DEFAULT_NAMES;
  const humanSeat = options.humanSeat ?? 0;
  const stacks = options.stacks;
  const seed = (options.seed ?? 0x1a2b3c4d) >>> 0;

  const seats = Array.from({ length: SEAT_COUNT }, (_, seat) => ({
    seat,
    name: names[seat] || `玩家${seat + 1}`,
    isHuman: seat === humanSeat,
    stack: stacks ? stacks[seat] : config.startingStack,
    hole: [],
    folded: false,
    allIn: false,
    streetBet: 0,
    committed: 0,
    hasActed: false,
    canRaise: true,
    lastAction: null
  }));

  for (const p of seats) {
    if (!Number.isInteger(p.stack) || p.stack <= 0) {
      throw new Error(`玩家 ${p.name} 的起始筹码必须是正整数`);
    }
  }

  return {
    config,
    seats,
    button: options.button ?? 0,
    nextButton: options.nextButton ?? (options.button ?? 0) % SEAT_COUNT,
    sbSeat: null,
    bbSeat: null,
    deck: [],
    burned: [],
    board: [],
    street: 'idle',
    currentBet: 0,
    lastRaiseSize: config.bb,
    actor: null,
    handNumber: 0,
    handStacks: [],
    pot: 0,
    rngState: seed || 0x9e3779b9,
    seed,
    startedAt: null,
    endedAt: null,
    events: [],
    history: [],
    result: null,
    rebuys: []
  };
}

export function positionOf(table, seat) {
  const offset = (seat - table.button + SEAT_COUNT) % SEAT_COUNT;
  return POSITION_ORDER[offset];
}

export function seatOfPosition(table, position) {
  const offset = POSITION_ORDER.indexOf(position);
  if (offset < 0) throw new Error(`未知位置: ${position}`);
  return (table.button + offset) % SEAT_COUNT;
}

function localRng(table) {
  let state = table.rngState;
  return () => {
    const [value, newState] = nextRandom(state);
    state = newState;
    table.rngState = newState;
    return value;
  };
}

function canAct(player) {
  return Boolean(player) && !player.folded && !player.allIn && player.stack > 0;
}

function needsAction(table, player) {
  return canAct(player) && (!player.hasActed || player.streetBet < table.currentBet);
}

function nextNeedsActionAfter(table, seat) {
  for (let offset = 1; offset <= SEAT_COUNT; offset++) {
    const candidate = table.seats[(seat + offset) % SEAT_COUNT];
    if (needsAction(table, candidate)) return candidate.seat;
  }
  return null;
}

function nextCard(table) {
  const card = table.deck.pop();
  if (!card) throw new Error('牌堆已空');
  return card;
}

function burn(table) {
  table.burned.push(nextCard(table));
}

function dealStreet(table) {
  if (table.street === 'preflop') {
    burn(table);
    for (let i = 0; i < 3; i++) table.board.push(nextCard(table));
    table.street = 'flop';
    return;
  }
  if (table.street === 'flop') {
    burn(table);
    table.board.push(nextCard(table));
    table.street = 'turn';
    return;
  }
  if (table.street === 'turn') {
    burn(table);
    table.board.push(nextCard(table));
    table.street = 'river';
    return;
  }
  throw new Error(`无法从 ${table.street} 继续发牌`);
}

function postBlind(table, seat, amount, label) {
  const player = table.seats[seat];
  const paid = putIn(table, seat, Math.min(amount, player.stack));
  table.events.push({
    type: 'post',
    street: 'preflop',
    seat,
    pos: positionOf(table, seat),
    label,
    amount: paid,
    allIn: player.allIn,
    potAfter: table.pot
  });
  return paid;
}

function putIn(table, seat, amount) {
  const player = table.seats[seat];
  const paid = Math.min(amount, player.stack);
  if (paid < 0) throw new Error('投入筹码不能为负');
  player.stack -= paid;
  player.streetBet += paid;
  player.committed += paid;
  table.pot += paid;
  if (player.stack === 0) player.allIn = true;
  return paid;
}

function resetStreet(table) {
  for (const player of table.seats) {
    player.streetBet = 0;
    player.hasActed = false;
    player.canRaise = true;
    player.lastAction = null;
  }
  table.currentBet = 0;
  table.lastRaiseSize = table.config.bb;
  table.actor = null;
}

export function startHand(table, options = {}) {
  if (table.street !== 'idle' && table.street !== 'complete') {
    throw new Error('上一手牌尚未结束');
  }
  for (const player of table.seats) {
    if (player.stack <= 0) {
      throw new Error(`${player.name} 已无筹码，请先重新买入`);
    }
  }

  table.button = table.nextButton % SEAT_COUNT;
  table.nextButton = (table.button + 1) % SEAT_COUNT;
  table.sbSeat = (table.button + 1) % SEAT_COUNT;
  table.bbSeat = (table.button + 2) % SEAT_COUNT;
  table.handNumber += 1;
  table.startedAt = Date.now();
  table.endedAt = null;
  table.result = null;
  table.board = [];
  table.burned = [];
  table.events = [];
  table.history = [];
  table.pot = 0;
  table.handStacks = table.seats.map((p) => p.stack);
  table.currentBet = table.config.bb;
  table.lastRaiseSize = table.config.bb;
  table.street = 'preflop';
  table.actor = null;

  for (const player of table.seats) {
    player.hole = [];
    player.folded = false;
    player.allIn = false;
    player.streetBet = 0;
    player.committed = 0;
    player.hasActed = false;
    player.canRaise = true;
    player.lastAction = null;
  }

  const deck = options.deck ? [...options.deck] : createDeck();
  assertUniqueCards(deck, '牌堆');
  if (deck.length !== 52) throw new Error('牌堆必须恰好 52 张');
  if (!options.deck) {
    const rng = localRng(table);
    shuffleInPlace(deck, rng);
  }
  table.deck = deck;

  // 从 SB 开始，每人一张，发两轮。
  for (let round = 0; round < 2; round++) {
    for (let offset = 1; offset <= SEAT_COUNT; offset++) {
      const player = table.seats[(table.button + offset) % SEAT_COUNT];
      player.hole.push(nextCard(table));
    }
  }

  postBlind(table, table.sbSeat, table.config.sb, '小盲');
  postBlind(table, table.bbSeat, table.config.bb, '大盲');
  table.currentBet = Math.max(table.config.bb, ...table.seats.map((p) => p.streetBet));

  const first = nextNeedsActionAfter(table, table.bbSeat);
  table.actor = first;
  if (first === null || contenders(table).length <= 1) {
    runoutAndShowdown(table);
  }
  return table;
}

export function toCall(table, seat) {
  const player = table.seats[seat];
  return Math.max(0, table.currentBet - player.streetBet);
}

export function canCheck(table, seat) {
  return toCall(table, seat) === 0;
}

export function getLegalActions(table, seat) {
  const player = table.seats[seat];
  const empty = {
    seat,
    actor: table.actor,
    toCall: 0,
    pot: table.pot,
    actions: [],
    allIn: null
  };
  if (!player || table.street === 'complete' || table.actor !== seat) return empty;
  if (!canAct(player)) return empty;

  const callAmount = toCall(table, seat);
  const actions = [{ type: 'fold' }];

  if (callAmount === 0) {
    actions.push({ type: 'check' });
  } else {
    actions.push({ type: 'call', amount: Math.min(callAmount, player.stack) });
  }

  const maxTo = player.streetBet + player.stack;

  if (table.currentBet === 0) {
    if (player.stack > 0) {
      actions.push({
        type: 'bet',
        min: Math.min(table.config.bb, player.stack),
        max: maxTo
      });
    }
  } else if (player.canRaise && player.stack > callAmount) {
    const fullMin = table.currentBet + table.lastRaiseSize;
    if (maxTo >= fullMin) {
      actions.push({ type: 'raise', minTo: fullMin, maxTo, shortAllIn: false });
    } else if (maxTo > table.currentBet) {
      actions.push({ type: 'raise', minTo: maxTo, maxTo, shortAllIn: true });
    }
  }

  let allIn = null;
  if (callAmount > 0 && callAmount >= player.stack) {
    allIn = { type: 'call', amount: player.stack };
  } else if (callAmount === 0 && table.currentBet === 0) {
    allIn = { type: 'bet', to: maxTo };
  } else if (player.canRaise && maxTo > table.currentBet) {
    allIn = { type: 'raise', to: maxTo };
  }

  return {
    seat,
    actor: table.actor,
    toCall: callAmount,
    pot: table.pot,
    callAmount: Math.min(callAmount, player.stack),
    actions,
    allIn
  };
}

export function getAllInAction(table, seat) {
  const legal = getLegalActions(table, seat);
  return legal.allIn;
}

export function normalizeAction(table, seat, action) {
  if (!action || typeof action.type !== 'string') throw new Error('缺少操作');
  const player = table.seats[seat];
  if (!player) throw new Error('座位不存在');
  if (table.actor !== seat) throw new Error('还没轮到该玩家行动');
  if (!canAct(player)) throw new Error('该玩家当前不能行动');

  const callAmount = toCall(table, seat);
  const maxTo = player.streetBet + player.stack;
  const type = action.type === 'allin' ? null : action.type;

  if (type === 'fold') return { type: 'fold' };

  if (type === 'check') {
    if (callAmount > 0) throw new Error('面对下注不能过牌');
    return { type: 'check' };
  }

  if (type === 'call') {
    if (callAmount === 0) throw new Error('无需跟注，可以过牌');
    return { type: 'call' };
  }

  if (type === 'bet') {
    if (table.currentBet !== 0) throw new Error('已有下注，应使用加注');
    const to = Number(action.to ?? action.amount);
    if (!Number.isInteger(to)) throw new Error('下注金额必须是整数筹码');
    const min = Math.min(table.config.bb, player.stack);
    if (to < min || to > maxTo) throw new Error('下注金额超出合法范围');
    if (to === maxTo) return { type: 'bet', to, allIn: player.stack === to };
    return { type: 'bet', to };
  }

  if (type === 'raise') {
    if (table.currentBet === 0) throw new Error('尚无人下注，应使用下注');
    if (!player.canRaise) throw new Error('本次不足额全下没有重新开放你的加注权');
    const to = Number(action.to ?? action.amount);
    if (!Number.isInteger(to)) throw new Error('加注金额必须是整数筹码');
    if (to <= table.currentBet) throw new Error('加注必须高于当前下注');
    if (to > maxTo) throw new Error('加注超过你的全部筹码');
    const fullMin = table.currentBet + table.lastRaiseSize;
    if (maxTo >= fullMin) {
      if (to < fullMin) throw new Error(`最小加注到 ${formatBB(fullMin)} BB`);
    } else if (to !== maxTo) {
      throw new Error('筹码不足一次完整加注时，只能全下');
    }
    return { type: 'raise', to, allIn: to === maxTo };
  }

  if (action.type === 'allin') {
    const allIn = getAllInAction(table, seat);
    if (!allIn) throw new Error('当前不能全下');
    if (allIn.type === 'call') return { type: 'call' };
    if (allIn.type === 'bet') return normalizeAction(table, seat, { type: 'bet', to: allIn.to });
    return normalizeAction(table, seat, { type: 'raise', to: allIn.to });
  }

  throw new Error(`未知操作: ${action.type}`);
}

function activePlayers(table) {
  return table.seats.filter((p) => !p.folded);
}

function contenders(table) {
  return table.seats.filter((p) => !p.folded && !p.allIn);
}

function isRoundComplete(table) {
  const list = contenders(table);
  if (list.length === 0) return true;
  return list.every((p) => p.hasActed && p.streetBet === table.currentBet);
}

function recordAction(table, seat, action, potBefore) {
  const player = table.seats[seat];
  const event = {
    type: 'action',
    street: table.street,
    seat,
    pos: positionOf(table, seat),
    name: player.name,
    action: cloneJson(action),
    potBefore,
    potAfter: table.pot,
    stackAfter: player.stack,
    allIn: player.allIn
  };
  table.events.push(event);
  table.history.push({
    street: event.street,
    seat,
    action: cloneJson(action),
    potBefore,
    potAfter: table.pot
  });
}

export function applyAction(table, seat, action) {
  if (table.result) throw new Error('本手牌已结束');
  const normalized = normalizeAction(table, seat, action);
  const player = table.seats[seat];
  const potBefore = table.pot;
  const callAmount = toCall(table, seat);
  let reopening = false;

  if (normalized.type === 'fold') {
    player.folded = true;
    player.hasActed = true;
    player.canRaise = false;
    player.lastAction = '弃牌';
  } else if (normalized.type === 'check') {
    player.hasActed = true;
    player.canRaise = false;
    player.lastAction = '过牌';
  } else if (normalized.type === 'call') {
    putIn(table, seat, callAmount);
    player.hasActed = true;
    player.canRaise = false;
    player.lastAction = player.allIn
      ? `跟注全下 ${formatBB(player.streetBet)} BB`
      : `跟注 ${formatBB(callAmount)} BB`;
  } else if (normalized.type === 'bet') {
    const previousBet = table.currentBet;
    putIn(table, seat, normalized.to - player.streetBet);
    table.currentBet = normalized.to;
    table.lastRaiseSize = Math.max(normalized.to, table.config.bb);
    player.hasActed = true;
    player.canRaise = false;
    player.lastAction = player.allIn
      ? `全下 ${formatBB(normalized.to)} BB`
      : `下注 ${formatBB(normalized.to)} BB`;
    reopening = previousBet === 0;
  } else if (normalized.type === 'raise') {
    const previousBet = table.currentBet;
    const increment = normalized.to - previousBet;
    putIn(table, seat, normalized.to - player.streetBet);
    table.currentBet = normalized.to;
    const fullRaise = increment >= table.lastRaiseSize;
    if (fullRaise) table.lastRaiseSize = increment;
    player.hasActed = true;
    player.canRaise = false;
    player.lastAction = player.allIn
      ? `全下到 ${formatBB(normalized.to)} BB`
      : `加注到 ${formatBB(normalized.to)} BB`;
    reopening = fullRaise;
  }

  if (normalized.type === 'bet' || normalized.type === 'raise') {
    for (const other of table.seats) {
      if (other.seat === seat || other.folded || other.allIn) continue;
      other.hasActed = false;
      if (reopening) other.canRaise = true;
    }
  }

  recordAction(table, seat, normalized, potBefore);

  if (activePlayers(table).length === 1) {
    settle(table);
    return table;
  }

  if (isRoundComplete(table)) {
    advanceStreet(table);
  } else {
    const next = nextNeedsActionAfter(table, seat);
    table.actor = next;
    if (next === null) {
      advanceStreet(table);
    }
  }
  return table;
}

function dealRemainingBoard(table) {
  while (table.street !== 'river') {
    dealStreet(table);
    table.events.push({
      type: 'street',
      street: table.street,
      board: [...table.board]
    });
  }
}

function runoutAndShowdown(table) {
  resetStreet(table);
  if (table.board.length === 0) {
    dealStreet(table);
    table.events.push({ type: 'street', street: table.street, board: [...table.board] });
  }
  dealRemainingBoard(table);
  settle(table);
}

function advanceStreet(table) {
  if (table.street === 'river') {
    settle(table);
    return;
  }
  resetStreet(table);
  dealStreet(table);
  table.events.push({
    type: 'street',
    street: table.street,
    board: [...table.board]
  });

  // 只剩一名玩家还能行动、其余人都已全下时，已经没有可继续的下注对抗，
  // 直接发完公共牌并摊牌（不能让他自己对自己下注）。
  if (contenders(table).length <= 1) {
    dealRemainingBoard(table);
    settle(table);
    return;
  }

  const first = nextNeedsActionAfter(table, table.button);
  if (first === null) {
    if (table.street === 'river') settle(table);
    else advanceStreet(table);
    return;
  }
  table.actor = first;
}

/**
 * 构建主池/边池。传入的 committed 应当已经扣除未被跟注的部分。
 */
export function buildPots(players) {
  const levels = [...new Set(players.map((p) => p.committed).filter((v) => v > 0))].sort(
    (a, b) => a - b
  );
  const pots = [];
  let previous = 0;
  for (const level of levels) {
    const contributors = players.filter((p) => p.committed >= level);
    const amount = (level - previous) * contributors.length;
    const eligible = contributors.filter((p) => !p.folded).map((p) => p.seat);
    if (amount > 0) {
      pots.push({ level, amount, eligibleSeats: eligible });
    }
    previous = level;
  }
  return pots;
}

function refundUncalled(table) {
  const players = table.seats;
  const sorted = [...players].sort((a, b) => b.committed - a.committed);
  const highest = sorted[0];
  const second = sorted[1];
  if (!highest || highest.committed === 0) return [];
  if (second && highest.committed === second.committed) return [];
  const refund = highest.committed - (second ? second.committed : 0);
  if (refund <= 0) return [];
  highest.committed -= refund;
  highest.stack += refund;
  table.pot -= refund;
  return [{ seat: highest.seat, pos: positionOf(table, highest.seat), amount: refund }];
}

function clockwiseFromButton(table, seats) {
  return [...seats].sort(
    (a, b) =>
      (a - table.button + SEAT_COUNT) % SEAT_COUNT -
      (b - table.button + SEAT_COUNT) % SEAT_COUNT
  );
}

function settle(table) {
  if (table.result) return table.result;
  table.actor = null;
  const active = activePlayers(table);
  const refunds = refundUncalled(table);
  const contributionsBefore = table.seats.map((p) => p.committed);
  const pots = buildPots(table.seats);
  const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0);
  const resultsBySeat = new Map();
  const handBySeat = new Map();

  for (const p of active) {
    if (table.board.length === 5) {
      handBySeat.set(p.seat, describeBest([...p.hole, ...table.board]));
    }
  }

  const potResults = [];
  for (const pot of pots) {
    const eligible = pot.eligibleSeats;
    if (eligible.length === 0) continue;
    let winners = eligible;
    if (active.length > 1 && table.board.length === 5) {
      let best = null;
      for (const seat of eligible) {
        const evaluated = handBySeat.get(seat);
        if (!evaluated) continue;
        if (!best || compareScoreArrays(evaluated.score, best.score) > 0) {
          best = evaluated;
          winners = [seat];
        } else if (compareScoreArrays(evaluated.score, best.score) === 0) {
          winners.push(seat);
        }
      }
    } else if (active.length === 1) {
      winners = [active[0].seat];
    }

    winners = clockwiseFromButton(table, winners);
    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount % winners.length;
    winners.forEach((seat, index) => {
      const amount = share + (index < remainder ? 1 : 0);
      resultsBySeat.set(seat, (resultsBySeat.get(seat) || 0) + amount);
    });
    potResults.push({
      level: pot.level,
      amount: pot.amount,
      eligibleSeats: [...eligible],
      winners: [...winners],
      handNames: Object.fromEntries(
        eligible
          .filter((seat) => handBySeat.has(seat))
          .map((seat) => [seat, handBySeat.get(seat).fullName])
      )
    });
  }

  for (const [seat, amount] of resultsBySeat.entries()) {
    table.seats[seat].stack += amount;
  }

  const net = table.seats.map((p) => ({
    seat: p.seat,
    pos: positionOf(table, p.seat),
    name: p.name,
    net: p.stack - table.handStacks[p.seat]
  }));

  const winners = [...resultsBySeat.entries()].map(([seat, amount]) => ({
    seat,
    pos: positionOf(table, seat),
    name: table.seats[seat].name,
    amount
  }));

  const reveals =
    table.board.length === 5
      ? active.map((p) => ({
          seat: p.seat,
          pos: positionOf(table, p.seat),
          name: p.name,
          hole: [...p.hole],
          hand: handBySeat.get(p.seat)
            ? {
                name: handBySeat.get(p.seat).name,
                detail: handBySeat.get(p.seat).detail,
                fullName: handBySeat.get(p.seat).fullName,
                bestFive: [...handBySeat.get(p.seat).bestFive]
              }
            : null
        }))
      : [];

  table.result = {
    type: active.length === 1 ? 'fold' : 'showdown',
    totalPot,
    board: [...table.board],
    pots: potResults,
    refunds,
    winners,
    net,
    reveals,
    contributions: table.seats.map((p) => ({
      seat: p.seat,
      pos: positionOf(table, p.seat),
      committed: contributionsBefore[p.seat]
    }))
  };
  table.endedAt = Date.now();
  table.street = 'complete';
  table.actor = null;
  table.pot = 0;
  for (const p of table.seats) {
    p.streetBet = 0;
    p.committed = 0;
    p.lastAction = null;
  }
  table.events.push({ type: 'end', result: table.result, stackStacks: table.seats.map((p) => p.stack) });
  return table.result;
}

function compareScoreArrays(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

/**
 * 公平信息视图：策略、电脑对手和复盘“当时可知”界面只能使用它。
 * 不包含牌堆、烧牌、其他玩家的暗牌（除非明确摊牌）。
 */
export function getPublicView(table, viewerSeat, options = {}) {
  const revealAll = options.revealAll === true;
  return {
    config: table.config,
    seats: table.seats.map((p) => ({
      seat: p.seat,
      name: p.name,
      isHuman: p.isHuman,
      stack: p.stack,
      folded: p.folded,
      allIn: p.allIn,
      streetBet: p.streetBet,
      committed: p.committed,
      hasActed: p.hasActed,
      canRaise: p.canRaise,
      lastAction: p.lastAction,
      pos: positionOf(table, p.seat),
      hole:
        revealAll || p.seat === viewerSeat
          ? [...p.hole]
          : p.hole.map((card, index) => (index === 0 ? 'back' : 'back'))
    })),
    board: [...table.board],
    street: table.street,
    pot: table.pot,
    currentBet: table.currentBet,
    lastRaiseSize: table.lastRaiseSize,
    actor: table.actor,
    button: table.button,
    sbSeat: table.sbSeat,
    bbSeat: table.bbSeat,
    toCall: viewerSeat == null ? 0 : toCall(table, viewerSeat),
    events: cloneJson(table.events),
    history: cloneJson(table.history),
    result: table.result ? cloneJson(table.result) : null
  };
}

export function cloneTable(table) {
  return cloneJson(table);
}

export function totalChips(table) {
  return table.seats.reduce((sum, p) => sum + p.stack, 0) + table.pot;
}

export function assertTableIntegrity(table) {
  const all = [
    ...table.seats.flatMap((p) => p.hole),
    ...table.board,
    ...table.burned,
    ...table.deck
  ];
  assertUniqueCards(all, '全桌');
  for (const p of table.seats) {
    if (!Number.isInteger(p.stack) || p.stack < 0) {
      throw new Error(`玩家 ${p.name} 筹码非法: ${p.stack}`);
    }
    if (!Number.isInteger(p.committed) || p.committed < 0) {
      throw new Error(`玩家 ${p.name} 投入非法`);
    }
    if (p.folded && p.streetBet > 0 && table.street !== 'complete') {
      // 弃牌后未结算前，已投入筹码仍应保留在 committed，streetBet 也保留是正常的。
    }
  }
  if (table.street !== 'complete' && table.pot !== table.seats.reduce((s, p) => s + p.committed, 0)) {
    throw new Error('底池与各玩家投入之和不一致');
  }
  return true;
}

export function describeAction(table, seat, action) {
  const player = table.seats[seat];
  const bb = (n) => `${formatBB(n)} BB`;
  switch (action.type) {
    case 'fold':
      return '弃牌';
    case 'check':
      return '过牌';
    case 'call': {
      const amount = toCall(table, seat);
      return player && amount >= player.stack ? `跟注全下 ${bb(player.stack)}` : `跟注 ${bb(amount)}`;
    }
    case 'bet':
      return `下注 ${bb(action.to ?? action.amount)}`;
    case 'raise':
      return `加注到 ${bb(action.to)}`;
    case 'allin':
      return '全下';
    default:
      return action.type;
  }
}

export function isBettingComplete(table) {
  return isRoundComplete(table);
}

export { canAct, activePlayers, contenders };
