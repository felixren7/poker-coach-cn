import { PHASES } from '../content/lessons.js';
import { TAGS } from '../content/tags.js';
import {
  getNextLesson,
  getDueCount,
  getOpenMistakeCount,
  getOverallMastery,
  getLessonCompletionCount,
  getMistakeList,
  getStreak,
  getData
} from '../state/store.js';
import { h, richText, progressBar, relativeTime, emptyState } from '../ui/dom.js';
import { masteryLabel } from '../state/progress.js';

function statCard(label, value, detail) {
  return h(
    'div',
    { className: 'stat-card' },
    h('span', { className: 'stat-label' }, label),
    h('strong', { className: 'stat-value' }, value),
    detail ? h('span', { className: 'stat-detail' }, detail) : null
  );
}

export function renderHome() {
  const nextLesson = getNextLesson();
  const due = getDueCount();
  const mistakes = getOpenMistakeCount();
  const overall = getOverallMastery();
  const completed = getLessonCompletionCount();
  const streak = getStreak();
  const data = getData();
  const attempts = data.attempts.length;
  const recentMistakes = getMistakeList().slice(0, 3);

  const mainCta = nextLesson
    ? h(
        'a',
        { className: 'btn btn-primary btn-lg', href: `#/lesson/${nextLesson.id}` },
        `继续学习 · ${nextLesson.title}`
      )
    : h('a', { className: 'btn btn-primary btn-lg', href: '#/train?mode=free' }, '进入自由训练');

  return h(
    'div',
    { className: 'view home-view' },
    h(
      'section',
      { className: 'hero-panel' },
      h(
        'div',
        { className: 'hero-copy' },
        h('p', { className: 'eyebrow' }, '河牌之前 · 中文德州扑克教练'),
        h('h1', {}, '用决策质量，而不是一手牌的输赢来衡量进步。'),
        h(
          'p',
          { className: 'hero-lead' },
          '从规则、牌型与位置开始，逐步学会翻前范围、翻后牌力、底池赔率、范围分析与复盘。每个推荐都标注适用条件，不把教学基线伪装成求解器。'
        ),
        h(
          'div',
          { className: 'hero-actions' },
          mainCta,
          h('a', { className: 'btn btn-secondary btn-lg', href: '#/train?mode=daily' }, due ? `今日复习 ${due} 题` : '开始今日训练')
        ),
        h(
          'div',
          { className: 'hero-disclaimer' },
          '默认环境：6 人桌 · 100BB · 无限注 · 无前注/无抽水 · 虚拟筹码。完成课程不等于“高手”，更不承诺盈利。'
        )
      ),
      h(
        'div',
        { className: 'hero-side' },
        h(
          'div',
          { className: 'hero-ring' },
          h('span', { className: 'ring-value' }, `${Math.round(overall.mastery * 100)}%`),
          h('span', { className: 'ring-label' }, '综合能力信号'),
          h('span', { className: 'ring-note' }, overall.lowSample || overall.tags === 0 ? '样本不足，仅供参考' : masteryLabel(overall.mastery))
        ),
        h(
          'div',
          { className: 'hero-side-note' },
          h('p', {}, '能力信号综合首次作答、提示依赖、重复错误与延迟复测；不是胜率。'),
          h('a', { href: '#/progress' }, '查看计算方式 →')
        )
      )
    ),
    h(
      'section',
      { className: 'stat-strip' },
      statCard('已完成课程', `${completed} / 10`, '完成≠掌握，继续看能力信号'),
      statCard('待复习', String(due), due ? '到期题目优先' : '暂无到期'),
      statCard('未解决错题', String(mistakes), mistakes ? '按知识标签归类' : '保持记录'),
      statCard('连续学习', streak ? `${streak} 天` : '今天开始', `累计作答 ${attempts} 次`)
    ),
    h(
      'section',
      { className: 'section-block' },
      h(
        'div',
        { className: 'section-head' },
        h('div', {}, h('p', { className: 'eyebrow' }, '学习闭环'), h('h2', {}, '理解 → 示范 → 决策 → 解释 → 针对训练 → 新场景验证')),
        h('a', { href: '#/learn', className: 'text-link' }, '查看完整学习路径 →')
      ),
      h(
        'div',
        { className: 'loop-grid' },
        [
          ['理解', '先讲清一个核心概念，不堆术语'],
          ['示范', '可操作示例，展示推荐与理由'],
          ['独立决策', '完整局面、合法操作与分级提示'],
          ['获得解释', '结论先行，分析按需展开'],
          ['针对错误', '按知识标签记录并安排变式'],
          ['新场景验证', '延迟复测与未见题，检验是否真的会']
        ].map(([title, text], index) =>
          h(
            'div',
            { className: 'loop-step' },
            h('span', { className: 'loop-index' }, String(index + 1).padStart(2, '0')),
            h('h3', {}, title),
            h('p', {}, text)
          )
        )
      )
    ),
    h(
      'section',
      { className: 'section-block' },
      h(
        'div',
        { className: 'section-head' },
        h('div', {}, h('p', { className: 'eyebrow' }, '五阶段路径'), h('h2', {}, '从看懂一手牌，到能独立复盘')),
        h('a', { href: '#/learn', className: 'text-link' }, '进入学习地图 →')
      ),
      h(
        'div',
        { className: 'phase-grid' },
        PHASES.map((phase) => {
          const phaseLessons = phase.lessons;
          const dataLessons = phaseLessons.map((id) => data.lessons[id]).filter(Boolean);
          const done = dataLessons.length;
          return h(
            'a',
            { className: `phase-card phase-${phase.id}`, href: '#/learn' },
            h('span', { className: 'phase-number' }, `阶段 ${phase.id}`),
            h('h3', {}, phase.title),
            h('p', {}, phase.subtitle),
            h('div', { className: 'phase-progress' }, progressBar(done / phaseLessons.length, phase.title)),
            h('span', { className: 'muted small' }, `${done} / ${phaseLessons.length} 课完成`)
          );
        })
      )
    ),
    recentMistakes.length
      ? h(
          'section',
          { className: 'section-block' },
          h(
            'div',
            { className: 'section-head' },
            h('div', {}, h('p', { className: 'eyebrow' }, '最近需要关注'), h('h2', {}, '错题不是失败，是下一步的训练清单')),
            h('a', { href: '#/mistakes', className: 'text-link' }, '打开错题本 →')
          ),
          h(
            'div',
            { className: 'mistake-list compact' },
            recentMistakes.map((mistake) =>
              h(
                'a',
                { className: 'mistake-row', href: `#/train?mode=single&q=${mistake.questionId}` },
                h(
                  'div',
                  {},
                  h('strong', {}, mistake.question.title),
                  h(
                    'span',
                    { className: 'mistake-tags' },
                    (mistake.tags || []).map((tag) => TAGS[tag]?.name || tag).join(' · ')
                  )
                ),
                h('span', { className: 'mistake-time' }, `${mistake.count} 次 · ${relativeTime(mistake.lastAt)}`)
              )
            )
          )
        )
      : null,
    h(
      'section',
      { className: 'section-block about-block' },
      h('h2', {}, '这个产品不承诺什么'),
      h(
        'div',
        { className: 'about-grid' },
        h(
          'div',
          {},
          h('h3', {}, '不承诺“学完必胜”'),
          h('p', {}, '课程帮助你建立规则、概率与决策框架；长期水平还取决于练习量、对手、情绪与资金管理。')
        ),
        h(
          'div',
          {},
          h('h3', {}, '不伪造求解器精度'),
          h('p', {}, '策略建议标注为教学基线，不提供精确 EV 损失、GTO 频率或“唯一最优”。')
        ),
        h(
          'div',
          {},
          h('h3', {}, '不读取隐藏信息'),
          h('p', {}, '训练建议与电脑对手只读取决策时可知的公开信息；复盘区分“当时可知”与“事后揭晓”。')
        )
      )
    )
  );
}
