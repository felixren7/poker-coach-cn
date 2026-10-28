/**
 * 学习进度、评分口径与间隔复习的纯函数。
 * 进度不是胜率，也不把“原题记住”当成掌握。
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export const VERDICTS = {
  goal_met: {
    label: '符合教学目标',
    tone: 'good',
    score: 1,
    description: '动作/数值符合当前题目的教学基线，且合法。'
  },
  reasonable_tradeoff: {
    label: '合理但存在取舍',
    tone: 'warn',
    score: 0.6,
    description: '存在明确理由的可接受替代；不是错误，但需要理解取舍。'
  },
  below_baseline: {
    label: '低于教学基线',
    tone: 'bad',
    score: 0,
    description: '合法但在当前假设下明显较差；需要复习相关概念。'
  },
  rule_error: {
    label: '规则/计算错误',
    tone: 'bad',
    score: 0,
    description: '违反规则，或牌型/概率/数值计算明确错误。'
  }
};

export function verdictMeta(verdict) {
  return VERDICTS[verdict] || VERDICTS.below_baseline;
}

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

/**
 * 返回下一次复习安排。错题/规则错误第二天复习；达标后逐步拉长。
 */
export function scheduleReview(verdict, reviewCount = 0, now = Date.now()) {
  if (verdict === 'goal_met') {
    const nextCount = Math.max(0, reviewCount) + 1;
    const days = REVIEW_INTERVALS[Math.min(nextCount - 1, REVIEW_INTERVALS.length - 1)];
    return { dueAt: now + days * DAY_MS, intervalDays: days, reviewCount: nextCount };
  }
  if (verdict === 'reasonable_tradeoff') {
    return { dueAt: now + DAY_MS, intervalDays: 1, reviewCount: Math.max(1, reviewCount) };
  }
  return { dueAt: now + DAY_MS, intervalDays: 1, reviewCount: 0 };
}

function safeRatio(numerator, denominator) {
  if (!denominator) return null;
  return numerator / denominator;
}

/**
 * 能力信号（0–1）由四部分构成：
 * - 首次尝试表现（未见过的题）
 * - 提示依赖（越少使用提示越好）
 * - 重复错误（同一标签反复错）
 * - 延迟复测（到期后再次作答）
 * 这不是“胜率”，也不代表长期赢家。
 */
export function computeTagMastery(stats = {}) {
  const attempts = stats.attempts || 0;
  const firstAttempts = stats.firstAttempts || 0;
  const hintLevels = stats.hintLevels || 0;
  const repeatErrors = stats.repeatErrors || 0;
  const delayedAttempts = stats.delayedAttempts || 0;

  if (!attempts) {
    return {
      mastery: 0,
      status: 'no-data',
      components: null,
      samples: { attempts: 0, firstAttempts: 0, delayedAttempts: 0 }
    };
  }

  const firstTry = safeRatio(stats.firstScoreSum || 0, firstAttempts);
  const hintIndependence = Math.max(0, Math.min(1, 1 - hintLevels / (attempts * 3)));
  const repeatAvoidance = Math.max(0, Math.min(1, 1 - repeatErrors / attempts));
  const delayed = safeRatio(stats.delayedScoreSum || 0, delayedAttempts);

  const components = {
    firstTry: firstTry ?? 0,
    hintIndependence,
    repeatAvoidance,
    delayed
  };

  let mastery;
  if (delayed == null) {
    // 没有延迟复测时，不把“延迟”当成 0 分，而是重新分配权重。
    mastery = 0.5 * components.firstTry + 0.3 * components.hintIndependence + 0.2 * components.repeatAvoidance;
  } else {
    mastery =
      0.4 * components.firstTry +
      0.2 * components.hintIndependence +
      0.15 * components.repeatAvoidance +
      0.25 * components.delayed;
  }

  const lowSample = firstAttempts < 3 || delayedAttempts < 2;
  return {
    mastery: Math.max(0, Math.min(1, mastery)),
    status: lowSample ? 'low-sample' : 'ok',
    components,
    samples: { attempts, firstAttempts, delayedAttempts }
  };
}

export function masteryLabel(mastery) {
  if (mastery >= 0.8) return '较稳定';
  if (mastery >= 0.6) return '正在形成';
  if (mastery >= 0.4) return '需要巩固';
  if (mastery > 0) return '初学';
  return '未开始';
}

export function dueCount(questions, now = Date.now()) {
  return Object.values(questions || {}).filter((q) => q.dueAt && q.dueAt <= now).length;
}

export function questionStatus(stats, now = Date.now()) {
  if (!stats || !stats.attempts) return 'unseen';
  if (stats.dueAt && stats.dueAt <= now) return 'due';
  if (stats.lastVerdict === 'goal_met') return 'learned';
  if (stats.lastVerdict === 'reasonable_tradeoff') return 'partial';
  return 'weak';
}
