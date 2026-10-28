import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chenScore,
  boardTexture,
  countDrawOuts,
  madeHandStrength,
  coachDecision,
  drawCompletion,
  isPremiumHand
} from '../src/engine/strategy.js';
import {
  createTable,
  startHand,
  getPublicView,
  getLegalActions
} from '../src/engine/table.js';
import { QUESTION_MAP } from '../src/content/questions.js';
import { buildSpotState } from '../src/training/scenario.js';

test('起手牌评分与强弱方向', () => {
  assert.equal(chenScore(['As', 'Ah']), 20);
  assert.ok(chenScore(['As', 'Ks']) > chenScore(['As', 'Kd']));
  assert.ok(chenScore(['As', 'Kd']) > chenScore(['7d', '2c']));
  assert.ok(isPremiumHand(['Qs', 'Qh']));
  assert.ok(isPremiumHand(['As', 'Kd']));
  assert.equal(isPremiumHand(['7d', '2c']), false);
});

test('听牌补牌不重复计算，且区分完成与胜率', () => {
  const combo = countDrawOuts(['7h', '6h'], ['9h', '8c', '2h']);
  assert.equal(combo.outs, 15);
  const gutshot = countDrawOuts(['9c', '8c'], ['Kh', '7d', '5s']);
  assert.equal(gutshot.outs, 4);
  const madeStraight = countDrawOuts(['7h', '6h'], ['9h', '8c', '5c', '2h']);
  assert.equal(madeStraight.outs, 0);
  assert.ok(Math.abs(drawCompletion(15, 'flop') - 0.5412) < 0.001);
  assert.ok(Math.abs(drawCompletion(4, 'turn') - 4 / 46) < 1e-12);
});

test('牌面质地与成牌强度方向', () => {
  const wet = boardTexture(['Jh', '8h', '7c']);
  const dry = boardTexture(['Ks', '7d', '2c']);
  assert.ok(wet.wetness > dry.wetness);
  assert.equal(wet.suit, 'two-tone');
  assert.equal(dry.suit, 'rainbow');
  assert.ok(madeHandStrength(['Ks', 'Qd'], ['Kd', '8s', '3h', '2c', '2d']) > 0.5);
  assert.ok(madeHandStrength(['7c', '7d'], ['7h', 'Ks', '2d', '4c', '3s']) > 0.7);
});

test('教学基线只读取公开视图，并返回合法操作', () => {
  const table = createTable({ seed: 5 });
  startHand(table);
  const view = getPublicView(table, table.actor);
  const decision = coachDecision(view, table.actor);
  assert.ok(decision);
  assert.ok(decision.assumptions.includes('不是求解器'));
  const legal = getLegalActions(view, table.actor);
  assert.ok(
    legal.actions.some(
      (a) =>
        a.type === decision.action.type &&
        (decision.action.to === undefined ||
          (decision.action.to >= (a.min ?? a.minTo) && decision.action.to <= (a.max ?? a.maxTo)))
    )
  );
});

test('转牌与河牌题目的结构化局面可以被引擎读取', () => {
  for (const id of ['q_turn_gutshot_fold', 'q_river_texture_choice']) {
    const q = QUESTION_MAP[id];
    assert.ok(q, id);
    assert.ok(q.tags.includes('turn-river'));
  }
  const state = buildSpotState(QUESTION_MAP.q_turn_gutshot_fold.spot);
  assert.equal(state.street, 'turn');
  assert.equal(state.board.length, 4);
  assert.equal(state.pot, 29);
  assert.equal(getLegalActions(state, state.actor).toCall, 10);
});
