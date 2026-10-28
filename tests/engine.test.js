import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTable,
  startHand,
  applyAction,
  getLegalActions,
  normalizeAction,
  buildPots,
  assertTableIntegrity,
  totalChips,
  positionOf
} from '../src/engine/table.js';
import { createDeck, nextRandom } from '../src/engine/cards.js';
import { chooseBotAction } from '../src/engine/bots.js';

const DEAL_ORDER = [1, 2, 3, 4, 5, 0];

/** 构造一个可预测的牌堆：给定每人的底牌与最终公共牌。 */
function riggedDeck({ holes, board }) {
  assert.equal(board.length, 5);
  const known = new Set([...Object.values(holes).flat(), ...board]);
  assert.equal(known.size, 12 + board.length, 'rigged cards must be unique');
  const pool = createDeck().filter((c) => !known.has(c));
  const burns = pool.splice(0, 3);
  const popOrder = [];
  for (let round = 0; round < 2; round++) {
    for (const seat of DEAL_ORDER) popOrder.push(holes[seat][round]);
  }
  popOrder.push(burns[0], board[0], board[1], board[2], burns[1], board[3], burns[2], board[4]);
  assert.equal(popOrder.length, 20);
  return [...pool, ...popOrder.reverse()];
}

test('初始牌局：盲注、位置、行动者与底池', () => {
  const table = createTable({ seed: 11 });
  startHand(table);
  assert.equal(table.button, 0);
  assert.equal(positionOf(table, 0), 'BTN');
  assert.equal(positionOf(table, 1), 'SB');
  assert.equal(positionOf(table, 2), 'BB');
  assert.equal(table.seats[1].committed, 1);
  assert.equal(table.seats[2].committed, 2);
  assert.equal(table.pot, 3);
  assert.equal(table.currentBet, 2);
  assert.equal(table.actor, 3);
  assert.equal(table.board.length, 0);
  assert.equal(table.seats.flatMap((p) => p.hole).length, 12);
  assertTableIntegrity(table);
  assert.equal(totalChips(table), 1200);
});

test('面对下注的合法操作：不能过牌，最小加注正确', () => {
  const table = createTable({ seed: 12 });
  startHand(table);
  const legal = getLegalActions(table, 3);
  assert.equal(legal.toCall, 2);
  assert.deepEqual(
    legal.actions.map((a) => a.type),
    ['fold', 'call', 'raise']
  );
  assert.equal(legal.actions.find((a) => a.type === 'raise').minTo, 4);
  assert.throws(() => normalizeAction(table, 3, { type: 'check' }), /不能过牌/);

  applyAction(table, 3, { type: 'raise', to: 4 });
  assert.equal(table.actor, 4);
  assert.throws(() => normalizeAction(table, 4, { type: 'raise', to: 5 }), /最小加注/);
  applyAction(table, 4, { type: 'raise', to: 6 });
  assert.equal(table.currentBet, 6);
  assert.equal(table.actor, 5);
  assert.equal(getLegalActions(table, 5).actions.find((a) => a.type === 'raise').minTo, 8);
});

test('大盲最后选项：所有人跟注后仍可过牌或加注', () => {
  const table = createTable({ seed: 13 });
  startHand(table);
  applyAction(table, 3, { type: 'fold' });
  applyAction(table, 4, { type: 'fold' });
  applyAction(table, 5, { type: 'fold' });
  applyAction(table, 0, { type: 'call' });
  applyAction(table, 1, { type: 'call' });
  assert.equal(table.actor, 2);
  const legal = getLegalActions(table, 2);
  assert.equal(legal.toCall, 0);
  assert.ok(legal.actions.some((a) => a.type === 'check'));
  assert.ok(legal.actions.some((a) => a.type === 'raise'));
  applyAction(table, 2, { type: 'check' });
  assert.equal(table.street, 'flop');
  assert.equal(table.board.length, 3);
  assert.equal(table.actor, 1, '翻牌后从 SB 开始');
  assert.equal(table.currentBet, 0);
  assert.equal(table.pot, 6);
});

test('不足额全下不重新开放已行动玩家的加注权', () => {
  const table = createTable({ seed: 14, stacks: [200, 200, 7, 10, 200, 200] });
  startHand(table);
  applyAction(table, 3, { type: 'raise', to: 5 }); // UTG
  applyAction(table, 4, { type: 'call' });
  applyAction(table, 5, { type: 'call' });
  applyAction(table, 0, { type: 'call' });
  applyAction(table, 1, { type: 'call' });
  assert.equal(table.actor, 2);
  const bbLegal = getLegalActions(table, 2);
  assert.equal(bbLegal.actions.find((a) => a.type === 'raise').minTo, 7);
  assert.equal(bbLegal.actions.find((a) => a.type === 'raise').maxTo, 7);
  applyAction(table, 2, { type: 'allin' });
  assert.equal(table.currentBet, 7);
  assert.equal(table.lastRaiseSize, 3);
  assert.equal(table.actor, 3);
  assert.equal(table.seats[3].canRaise, false);
  const utgLegal = getLegalActions(table, 3);
  assert.deepEqual(utgLegal.actions.map((a) => a.type), ['fold', 'call']);
  assert.throws(
    () => normalizeAction(table, 3, { type: 'raise', to: 9 }),
    /没有重新开放|加注权/
  );
});

test('未被跟注的筹码退回，弃牌者不能继续行动', () => {
  const table = createTable({ seed: 15 });
  startHand(table);
  applyAction(table, 3, { type: 'allin' });
  for (const seat of [4, 5, 0, 1, 2]) applyAction(table, seat, { type: 'fold' });
  assert.equal(table.street, 'complete');
  assert.equal(table.result.type, 'fold');
  assert.equal(table.result.refunds.length, 1);
  assert.equal(table.result.refunds[0].amount, 198);
  assert.equal(table.result.totalPot, 5);
  assert.equal(table.seats[3].stack, 203);
  assert.equal(table.result.net.reduce((s, n) => s + n.net, 0), 0);
  assert.equal(totalChips(table), 1200);
});

test('主池、边池与多人平局分池（含奇数筹码）', () => {
  const table = createTable({ seed: 16, stacks: [200, 200, 20, 20, 20, 200] });
  const deck = riggedDeck({
    holes: {
      0: ['9c', '8c'],
      1: ['9h', '8h'],
      2: ['7c', '7s'],
      3: ['2c', '3d'],
      4: ['4h', '4s'],
      5: ['5c', '6d']
    },
    board: ['As', 'Kd', 'Qc', 'Jh', 'Ts']
  });
  startHand(table, { deck });
  assert.deepEqual(table.seats[3].hole, ['2c', '3d']);
  applyAction(table, 3, { type: 'allin' });
  applyAction(table, 4, { type: 'call' });
  applyAction(table, 5, { type: 'fold' });
  applyAction(table, 0, { type: 'fold' });
  applyAction(table, 1, { type: 'fold' });
  applyAction(table, 2, { type: 'call' });

  assert.equal(table.street, 'complete');
  assert.equal(table.result.type, 'showdown');
  assert.deepEqual(table.board, ['As', 'Kd', 'Qc', 'Jh', 'Ts']);
  assert.equal(table.result.totalPot, 61);
  assert.equal(table.result.refunds.length, 0);
  assert.equal(table.result.pots.length, 2);
  const bySeat = Object.fromEntries(table.result.net.map((n) => [n.seat, n.net]));
  assert.equal(bySeat[2], 1);
  assert.equal(bySeat[3], 0);
  assert.equal(bySeat[4], 0);
  assert.equal(bySeat[1], -1);
  assert.equal(table.seats[2].stack, 21, '奇数筹码给庄位左手第一位赢家');
  assert.equal(totalChips(table), 660);
  assertTableIntegrity(table);
});

test('buildPots 正确计算资格与金额', () => {
  const pots = buildPots([
    { seat: 0, committed: 10, folded: false },
    { seat: 1, committed: 20, folded: false },
    { seat: 2, committed: 10, folded: true }
  ]);
  assert.deepEqual(
    pots.map((p) => ({ amount: p.amount, eligible: p.eligibleSeats })),
    [
      { amount: 30, eligible: [0, 1] },
      { amount: 10, eligible: [1] }
    ]
  );
});

test('自动发完公共牌并在全下后摊牌', () => {
  const table = createTable({ seed: 17, stacks: [200, 200, 200, 20, 20, 20] });
  startHand(table);
  applyAction(table, 3, { type: 'allin' });
  applyAction(table, 4, { type: 'call' });
  applyAction(table, 5, { type: 'call' });
  applyAction(table, 0, { type: 'fold' });
  applyAction(table, 1, { type: 'fold' });
  applyAction(table, 2, { type: 'fold' });
  assert.equal(table.street, 'complete');
  assert.equal(table.board.length, 5);
  assert.equal(table.result.type, 'showdown');
  assert.equal(table.result.net.reduce((s, n) => s + n.net, 0), 0);
  assert.equal(totalChips(table), 660);
});

test('电脑对手全桌对局 80 手：流程完成、筹码守恒、无重复牌', () => {
  const table = createTable({ seed: 24680 });
  let rebuys = 0;
  for (let hand = 0; hand < 80; hand++) {
    for (const player of table.seats) {
      if (player.stack <= 0) {
        player.stack = table.config.startingStack;
        rebuys += table.config.startingStack;
      }
    }
    startHand(table);
    let steps = 0;
    while (table.street !== 'complete' && steps < 300) {
      steps++;
      assert.notEqual(table.actor, null, '行动者不应为空');
      const actor = table.actor;
      const rand = () => {
        const [value, state] = nextRandom(table.rngState);
        table.rngState = state;
        return value;
      };
      const decision = chooseBotAction(table, actor, 'normal', rand);
      assert.ok(decision, '电脑对手必须有决策');
      applyAction(table, actor, decision.action);
      assertTableIntegrity(table);
    }
    assert.equal(table.street, 'complete', `第 ${hand + 1} 手未结束`);
    assert.ok(table.result);
    assert.equal(table.result.net.reduce((s, n) => s + n.net, 0), 0);
    assert.equal(totalChips(table), 1200 + rebuys);
    if (table.result.type === 'showdown') assert.equal(table.board.length, 5);
  }
});
