/**
 * 规则型电脑对手。
 *
 * 只接受 getPublicView 产出的公开信息视图：自己的底牌、公共牌、筹码、行动历史；
 * 看不到牌堆、烧牌和其他玩家的暗牌。难度只调整阈值/随机性，不改变信息边界。
 */

import { getLegalActions, getPublicView, positionOf } from './table.js';
import {
  boardTexture,
  callThreshold,
  chenScore,
  countDrawOuts,
  drawCompletion,
  isPair,
  isPremiumHand,
  madeHandStrength,
  openThreshold
} from './strategy.js';
import { potOdds } from './odds.js';

export const DIFFICULTIES = {
  easy: {
    key: 'easy',
    name: '轻松',
    description: '偏紧、偏被动，诈唬很少；适合熟悉操作。',
    openBonus: 1.5,
    callBonus: -1,
    aggression: 0.18,
    bluff: 0.015,
    callMargin: 0.08,
    semiBluff: 0.2
  },
  normal: {
    key: 'normal',
    name: '标准',
    description: '按简化的位置与牌力规则行动，有一定半诈唬。',
    openBonus: 0,
    callBonus: 0,
    aggression: 0.4,
    bluff: 0.06,
    callMargin: 0.03,
    semiBluff: 0.5
  },
  hard: {
    key: 'hard',
    name: '挑战',
    description: '更宽、更主动，会更多半诈唬；仍是规则型对手，不是求解器。',
    openBonus: -0.5,
    callBonus: 1,
    aggression: 0.62,
    bluff: 0.12,
    callMargin: -0.01,
    semiBluff: 0.68
  }
};

function pickRaise(legal, target) {
  const raise = legal.actions.find((a) => a.type === 'raise');
  if (!raise) return null;
  return {
    type: 'raise',
    to: Math.max(raise.minTo, Math.min(raise.maxTo, Math.round(target)))
  };
}

function pickBet(legal, target) {
  const bet = legal.actions.find((a) => a.type === 'bet');
  if (!bet) return null;
  return {
    type: 'bet',
    to: Math.max(bet.min, Math.min(bet.max, Math.round(target)))
  };
}

function has(legal, type) {
  return legal.actions.some((a) => a.type === type);
}

/**
 * 纯函数版本：view 必须来自 getPublicView（或等价的公开信息对象）。
 */
export function decideBotAction(view, seat, difficulty = 'normal', rand = Math.random) {
  const profile = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const legal = getLegalActions(view, seat);
  if (!legal.actions.length) return null;
  const player = view.seats[seat];
  const hole = player.hole;
  const position = positionOf(view, seat);
  const opponents = view.seats.filter((p) => p.seat !== seat && !p.folded).length;
  const bb = view.config.bb;
  const toCall = legal.toCall;

  if (view.street === 'preflop') {
    const chen = chenScore(hole);
    if (toCall === 0) {
      if (has(legal, 'check') && view.currentBet > 0) {
        const raise = pickRaise(legal, bb * 2.5 + Math.floor(rand() * bb));
        if (raise && chen >= openThreshold(position) + profile.openBonus + 1.5 && rand() < 0.55) {
          return { action: raise, note: '大盲选项，强牌主动加注' };
        }
        return { action: { type: 'check' }, note: '免费看翻牌' };
      }
      return { action: { type: 'check' }, note: '过牌' };
    }

    if (isPremiumHand(hole) && has(legal, 'raise') && rand() < profile.aggression + 0.25) {
      const target = Math.max(bb * 6, (player.streetBet + toCall) * 3);
      const raise = pickRaise(legal, target);
      if (raise) return { action: raise, note: '强起手牌再加注' };
    }

    const pair = isPair(hole);
    const implied = pair && toCall <= bb * 4 && player.stack > toCall * 12;
    const chenLine =
      chen >= callThreshold(position) + profile.openBonus - 1 + profile.callBonus &&
      toCall <= bb * 5;
    const bbDiscount =
      position === 'BB' && toCall <= bb * 3 && chen >= 4 + profile.callBonus;
    if (implied || chenLine || bbDiscount) {
      if (has(legal, 'call')) {
        return { action: { type: 'call' }, note: implied ? '小对子按隐含赔率跟注' : '牌力达到跟注线' };
      }
    }
    return { action: { type: 'fold' }, note: '牌力/赔率不足' };
  }

  const texture = boardTexture(view.board);
  const made = madeHandStrength(hole, view.board);
  const draw = countDrawOuts(hole, view.board);
  const drawEq = drawCompletion(draw.outs, view.street);
  const required = toCall > 0 ? potOdds(view.pot, toCall).breakeven : 0;
  const multiwayPenalty = 0.05 * Math.max(0, opponents - 1);
  const estimate = Math.max(0, Math.min(1, made + drawEq * 0.55 - multiwayPenalty));

  if (toCall === 0) {
    if (has(legal, 'bet')) {
      const valueTarget = view.pot * (0.55 + rand() * 0.25);
      if (made >= 0.7 && opponents <= 3 && rand() < 0.8) {
        const bet = pickBet(legal, valueTarget);
        if (bet) return { action: bet, note: '价值下注' };
      }
      if (draw.outs >= 8 && rand() < profile.semiBluff) {
        const bet = pickBet(legal, view.pot * 0.6);
        if (bet) return { action: bet, note: '半诈唬下注' };
      }
      if (
        draw.outs <= 4 &&
        made < 0.4 &&
        opponents <= 2 &&
        texture.wetness < 2 &&
        rand() < profile.bluff
      ) {
        const bet = pickBet(legal, view.pot * 0.5);
        if (bet) return { action: bet, note: '偶尔诈唬' };
      }
    }
    return { action: { type: 'check' }, note: '过牌' };
  }

  if (made >= 0.82 && has(legal, 'raise') && opponents <= 2 && rand() < profile.aggression) {
    const raise = pickRaise(legal, view.currentBet + (view.pot + toCall) * 0.7);
    if (raise) return { action: raise, note: '强成牌加注' };
  }

  if (estimate >= required + profile.callMargin + multiwayPenalty) {
    if (has(legal, 'call')) return { action: { type: 'call' }, note: '简化牌力评估覆盖底池赔率' };
  }

  if (draw.outs >= 8 && toCall <= player.stack * 0.18 && rand() < 0.55) {
    if (has(legal, 'call')) return { action: { type: 'call' }, note: '强听牌按隐含赔率跟注' };
  }

  return { action: { type: 'fold' }, note: '简化牌力评估不足' };
}

/**
 * 供 UI 使用：从完整牌桌生成公开视图后决策，不修改牌桌。
 */
export function chooseBotAction(table, seat, difficulty = 'normal', rand = Math.random) {
  const view = getPublicView(table, seat);
  return decideBotAction(view, seat, difficulty, rand);
}
