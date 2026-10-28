import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTable,
  startHand,
  applyAction,
  cloneTable,
  getLegalActions
} from '../src/engine/table.js';
import { chooseBotAction, decideBotAction } from '../src/engine/bots.js';
import { getPublicView } from '../src/engine/table.js';
import { nextRandom } from '../src/engine/cards.js';
import {
  reconstructDecisions,
  decisionPublicView,
  compareToBaseline
} from '../src/training/replay.js';

function playBotHand(seed) {
  const table = createTable({ seed });
  startHand(table);
  const initial = cloneTable(table);
  let guard = 0;
  while (table.street !== 'complete' && guard++ < 300) {
    const rand = () => {
      const [value, state] = nextRandom(table.rngState);
      table.rngState = state;
      return value;
    };
    const decision = chooseBotAction(table, table.actor, 'normal', rand);
    assert.ok(decision);
    applyAction(table, table.actor, decision.action);
  }
  assert.equal(table.street, 'complete');
  return {
    id: `h-${seed}`,
    startedAt: table.startedAt,
    endedAt: table.endedAt,
    humanSeat: 0,
    difficulty: 'normal',
    initial,
    actions: table.history,
    events: table.events,
    result: table.result
  };
}

function findRecordWithDecisions() {
  for (let seed = 1; seed < 200; seed++) {
    const record = playBotHand(seed);
    const rebuilt = reconstructDecisions(record);
    if (rebuilt.decisions.length > 0) return { record, rebuilt };
  }
  throw new Error('找不到含英雄决策的手牌');
}

test('重放只使用初始快照与行动，结果可复现', () => {
  const { record, rebuilt } = findRecordWithDecisions();
  assert.equal(rebuilt.error, null);
  assert.ok(rebuilt.decisions.length > 0);
  assert.ok(rebuilt.finalTable);
  assert.equal(rebuilt.finalTable.result.type, record.result.type);
  assert.equal(rebuilt.finalTable.result.totalPot, record.result.totalPot);
  assert.deepEqual(
    rebuilt.finalTable.result.net,
    record.result.net
  );
});

test('“当时可知”视图不含牌堆、烧牌和其他玩家暗牌', () => {
  const { record, rebuilt } = findRecordWithDecisions();
  const view = decisionPublicView(rebuilt.decisions[0].snapshot, record.humanSeat);
  assert.equal(view.deck, undefined);
  assert.equal(view.burned, undefined);
  assert.equal(view.result, null);
  assert.equal(view.asOfFuture, undefined);
  assert.equal(view.seats[record.humanSeat].hole.length, 2);
  assert.ok(view.seats[record.humanSeat].hole.every((c) => c !== 'back'));
  for (const seat of view.seats) {
    if (seat.seat !== record.humanSeat) {
      assert.deepEqual(seat.hole, ['back', 'back']);
    }
  }
  assert.ok(view.board.length <= 5);
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes('"deck"'), false);
  assert.equal(serialized.includes('"burned"'), false);
});

test('重做决策时可以用教学基线比较，且不改写原始行动', () => {
  const { record, rebuilt } = findRecordWithDecisions();
  const decision = rebuilt.decisions[0];
  const view = decisionPublicView(decision.snapshot, record.humanSeat);
  const legal = getLegalActions(view, record.humanSeat);
  assert.ok(legal.actions.length > 0);
  const comparison = compareToBaseline(view, record.humanSeat, decision.chosen);
  assert.ok(comparison.baseline);
  assert.ok(['match', 'size', 'different'].includes(comparison.kind));
  assert.deepEqual(decision.chosen, record.actions[decision.index].action);
});

test('电脑对手使用公开视图，不修改牌桌状态', () => {
  const table = createTable({ seed: 99 });
  startHand(table);
  const before = JSON.stringify(table);
  const view = getPublicView(table, table.actor);
  for (const seat of view.seats) {
    if (seat.seat !== table.actor) assert.deepEqual(seat.hole, ['back', 'back']);
  }
  assert.equal(view.deck, undefined);
  const decision = decideBotAction(view, table.actor, 'normal', () => 0.4);
  assert.ok(decision);
  assert.ok(decision.action);
  assert.equal(JSON.stringify(table), before, '决策函数不应修改牌桌');
  const legal = getLegalActions(table, table.actor);
  assert.ok(legal.actions.some((a) => a.type === decision.action.type));
  const chosen = chooseBotAction(table, table.actor, 'hard', () => 0.6);
  assert.ok(chosen);
  assert.equal(JSON.stringify(table), before);
});
