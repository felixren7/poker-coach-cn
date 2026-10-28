import test from 'node:test';
import assert from 'node:assert/strict';
import {
  potOdds,
  outsProbability,
  combinations,
  impliedOdds,
  evCall
} from '../src/engine/odds.js';
import {
  expandRange,
  comboCount,
  rangePercent,
  equityVsRange
} from '../src/engine/ranges.js';

test('底池赔率按“跟注后底池”计算', () => {
  const result = potOdds(150, 50);
  assert.equal(result.finalPot, 200);
  assert.equal(result.breakeven, 0.25);
  assert.equal(potOdds(100, 50).breakeven, 1 / 3);
  assert.equal(potOdds(100, 0).breakeven, 0);
  assert.throws(() => potOdds(-1, 10));
});

test('9 张补牌从翻牌到河牌约 35.0%', () => {
  const p = outsProbability(9, 47, 46);
  assert.ok(Math.abs(p.oneCard - 9 / 47) < 1e-12);
  assert.ok(Math.abs(p.byRiver - 0.3496762257) < 1e-9);
  const turn = outsProbability(9, 46, null);
  assert.equal(turn.byRiver, null);
  assert.ok(Math.abs(turn.oneCard - 9 / 46) < 1e-12);
});

test('常见听牌的完成概率', () => {
  assert.ok(Math.abs(outsProbability(8, 47, 46).byRiver - 0.3145) < 0.001);
  assert.ok(Math.abs(outsProbability(4, 47, 46).byRiver - 0.1647) < 0.001);
  assert.ok(Math.abs(outsProbability(15, 47, 46).byRiver - 0.5412) < 0.001);
});

test('组合数与隐含赔率/EV 公式', () => {
  assert.equal(combinations(47, 2), 1081);
  const implied = impliedOdds(10, 40, 50);
  assert.equal(implied.breakeven, 10 / 90);
  const ev = evCall(0.3, 100, 50);
  assert.ok(Math.abs(ev.ev - (0.3 * 150 - 50)) < 1e-12);
});

test('范围解析：对子 6、同花 4、非同花 12、AK 16', () => {
  assert.equal(comboCount('QQ'), 6);
  assert.equal(comboCount('AKs'), 4);
  assert.equal(comboCount('AKo'), 12);
  assert.equal(comboCount('AK'), 16);
  assert.equal(comboCount('QQ+'), 18);
  assert.equal(comboCount('22+'), 78);
  assert.equal(comboCount('A2s+'), 48);
  assert.equal(comboCount('random'), 1326);
  assert.ok(Math.abs(rangePercent('AA') - (6 / 1326) * 100) < 1e-9);
  assert.equal(expandRange('AK').length, 16);
  assert.equal(new Set(expandRange('AK, AKs').map((c) => [...c].sort().join(''))).size, 16);
});

test('权益模拟明确标注假设、模拟次数与误差', () => {
  const aa = equityVsRange(['As', 'Ah'], [], 'KK', { iterations: 4000, seed: 42 });
  assert.ok(aa.equity > 0.78 && aa.equity < 0.85, `AA vs KK equity=${aa.equity}`);
  assert.equal(aa.rangeCombos, 6);
  assert.equal(aa.iterations, 4000);
  assert.ok(aa.margin > 0);
  assert.match(aa.note, /蒙特卡洛|模拟/);
  assert.match(aa.note, /假设/);

  const random = equityVsRange(['As', 'Ah'], [], 'random', { iterations: 4000, seed: 7 });
  assert.ok(random.equity > 0.8 && random.equity < 0.9, `AA vs random=${random.equity}`);
});

test('河牌已发完时按范围逐一枚举，不声称模拟误差', () => {
  const result = equityVsRange(
    ['As', 'Ah'],
    ['Kd', 'Kc', '7s', '2h', '3d'],
    'QQ+',
    { iterations: 1000, seed: 1 }
  );
  assert.equal(result.exact, true);
  assert.ok(result.iterations > 0);
  assert.match(result.note, /枚举/);
});

test('范围与已知牌冲突时抛错', () => {
  assert.throws(
    () =>
      equityVsRange(['As', 'Ah'], ['Ad', 'Ac', 'Kd'], 'AA', {
        iterations: 10,
        seed: 1
      }),
    /冲突|没有可用组合/
  );
});
