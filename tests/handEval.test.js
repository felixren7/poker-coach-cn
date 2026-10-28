import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY,
  evaluateFive,
  evaluateBest,
  compareHands,
  describeBest,
  startingHandCode,
  describeStartingHand
} from '../src/engine/handEval.js';

test('识别全部牌型等级', () => {
  assert.equal(evaluateFive(['Ah', 'Kh', 'Qh', 'Jh', 'Th']).category, CATEGORY.STRAIGHT_FLUSH);
  assert.equal(evaluateFive(['Ah', 'Kh', 'Qh', 'Jh', 'Th']).name, '皇家同花顺');
  assert.equal(evaluateFive(['9s', '9h', '9d', '9c', 'As']).category, CATEGORY.QUADS);
  assert.equal(evaluateFive(['Ks', 'Kh', 'Kd', '7c', '7d']).category, CATEGORY.FULL_HOUSE);
  assert.equal(evaluateFive(['As', 'Js', '8s', '5s', '2s']).category, CATEGORY.FLUSH);
  assert.equal(evaluateFive(['9h', '8c', '7d', '6s', '5h']).category, CATEGORY.STRAIGHT);
  assert.equal(evaluateFive(['Qs', 'Qh', 'Qd', 'Ac', '9d']).category, CATEGORY.TRIPS);
  assert.equal(evaluateFive(['As', 'Ad', '9c', '9h', 'Kd']).category, CATEGORY.TWO_PAIR);
  assert.equal(evaluateFive(['Js', 'Jd', 'Ac', '8h', '3d']).category, CATEGORY.PAIR);
  assert.equal(evaluateFive(['As', 'Qd', '9c', '6h', '3s']).category, CATEGORY.HIGH_CARD);
});

test('A2345 是 5 高顺子，A 不能绕回去', () => {
  const wheel = evaluateFive(['Ad', '2h', '3c', '4s', '5d']);
  assert.equal(wheel.category, CATEGORY.STRAIGHT);
  assert.equal(wheel.score[1], 5);
  const sixHigh = evaluateFive(['2h', '3c', '4s', '5d', '6h']);
  assert.equal(sixHigh.score[1], 6);
  assert.equal(compareHands(['Ad', '2h', '3c', '4s', '5d'], ['2h', '3c', '4s', '5d', '6h']), -1);
  assert.equal(compareHands(['Ah', '2h', '3h', '4h', '5h'], ['Ah', '2h', '3h', '4h', '5h']), 0);
});

test('踢脚在主要牌型相同时决定胜负', () => {
  const aceKing = ['Ah', 'Ac', 'Ad', 'Kc', '9s'];
  const aceQueen = ['As', 'Ac', 'Ad', 'Qc', '9s'];
  assert.equal(compareHands(aceKing, aceQueen), 1);
  assert.match(describeBest([...aceKing, '7h', '4c']).detail, /踢脚 K、9/);
});

test('七张牌中选出最佳五张，公共牌可以打满', () => {
  const board = ['As', 'Kd', 'Qc', 'Jh', 'Ts'];
  const a = evaluateBest([...board, '2c', '3d']);
  const b = evaluateBest([...board, '4h', '4s']);
  assert.equal(a.category, CATEGORY.STRAIGHT);
  assert.equal(b.category, CATEGORY.STRAIGHT);
  assert.deepEqual(a.score, b.score);
  assert.equal(a.fullName ?? describeBest([...board, '2c', '3d']).fullName, '顺子（A 高）');
});

test('七张牌能正确处理葫芦压同花', () => {
  const best = evaluateBest(['7c', '7d', '7h', 'As', 'Ad', 'Ks', '2s']);
  assert.equal(best.category, CATEGORY.FULL_HOUSE);
  assert.equal(describeBest(['7c', '7d', '7h', 'As', 'Ad', 'Ks', '2s']).name, '葫芦');
});

test('花色不参与非同一牌型的比较', () => {
  const hearts = ['Ah', 'Kh', 'Qh', 'Jh', '9h'];
  const spades = ['As', 'Ks', 'Qs', 'Js', '9s'];
  assert.equal(compareHands(hearts, spades), 0);
});

test('起手牌编码与描述', () => {
  assert.equal(startingHandCode(['As', 'Ks']), 'AKs');
  assert.equal(startingHandCode(['As', 'Kd']), 'AKo');
  assert.equal(startingHandCode(['Ah', 'Ad']), 'AA');
  assert.match(describeStartingHand(['7h', '6h']).text, /同花/);
  assert.match(describeStartingHand(['7h', '6h']).text, /连张/);
});

test('重复牌会抛错', () => {
  assert.throws(() => evaluateFive(['Ah', 'Ah', 'Kd', 'Qc', 'Js']), /重复牌/);
  assert.throws(() => evaluateBest(['Ah', 'Kh']), /5 到 7/);
});
