import { TAG_GROUPS, TAGS } from '../content/tags.js';
import {
  getTagOverview,
  getOverallMastery,
  getLessonCompletionCount,
  getDueCount,
  getOpenMistakeCount,
  getStreak,
  getSimStats,
  exportData,
  importData,
  resetAll,
  getData
} from '../state/store.js';
import { masteryLabel } from '../state/progress.js';
import { h, progressBar, downloadFile, toast, formatDate } from '../ui/dom.js';

function componentRow(label, value, note) {
  if (value == null) {
    return h(
      'div',
      { className: 'component-row' },
      h('span', {}, label),
      h('span', { className: 'muted small' }, '暂无数据'),
      h('div', { className: 'component-track' })
    );
  }
  return h(
    'div',
    { className: 'component-row' },
    h('span', {}, label),
    h('span', { className: 'component-value' }, `${Math.round(value * 100)}%`),
    progressBar(value, label),
    note ? h('span', { className: 'muted small component-note' }, note) : null
  );
}

function tagCard(tag) {
  const mastery = tag.mastery;
  const has = tag.stats.attempts > 0;
  return h(
    'article',
    { className: `tag-progress-card ${has ? '' : 'is-empty'}` },
    h(
      'div',
      { className: 'tag-progress-head' },
      h('div', {}, h('h3', {}, tag.name), h('span', { className: 'muted small' }, TAGS[tag.id]?.phase ? `阶段 ${TAGS[tag.id].phase}` : '')),
      h(
        'div',
        { className: 'tag-mastery-value' },
        h('strong', {}, has ? `${Math.round(mastery.mastery * 100)}%` : '—'),
        h('span', { className: `mastery-label ${mastery.status}` }, has ? masteryLabel(mastery.mastery) : '未开始')
      )
    ),
    has ? progressBar(mastery.mastery, tag.name) : null,
    has
      ? h(
          'div',
          { className: 'tag-components' },
          componentRow('未见题首次表现', mastery.components.firstTry, `首次作答 ${mastery.samples.firstAttempts} 题`),
          componentRow('提示独立性', mastery.components.hintIndependence, '提示使用越少越高'),
          componentRow('重复错误控制', mastery.components.repeatAvoidance, `${tag.stats.repeatErrors || 0} 次重复错误`),
          componentRow(
            '延迟复测',
            mastery.components.delayed,
            mastery.samples.delayedAttempts ? `到期后作答 ${mastery.samples.delayedAttempts} 次` : '尚无到期复测'
          )
        )
      : h('p', { className: 'muted small' }, '完成相关训练后，这里会显示分项能力信号。'),
    h(
      'div',
      { className: 'tag-card-actions' },
      h(
        'a',
        { className: 'text-link', href: `#/train?mode=filter&tag=${tag.id}` },
        has ? '针对训练 →' : '开始练习 →'
      ),
      h('span', { className: 'muted small' }, `${tag.stats.attempts || 0} 次作答`)
    )
  );
}

export function renderProgress() {
  const overall = getOverallMastery();
  const tags = getTagOverview();
  const sim = getSimStats();
  const data = getData();
  const importInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onChange: (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importData(String(reader.result));
          toast('学习记录已导入，正在刷新。', 'success');
          setTimeout(() => location.reload(), 500);
        } catch (error) {
          toast(`导入失败：${error.message}`, 'error');
        }
      };
      reader.readAsText(file);
    }
  });

  return h(
    'div',
    { className: 'view progress-view' },
    h(
      'header',
      { className: 'page-head' },
      h(
        'div',
        {},
        h('p', { className: 'eyebrow' }, '学习进度'),
        h('h1', {}, '看清具体能力，而不是一个“高手”标签'),
        h(
          'p',
          { className: 'page-lead' },
          '进度综合未见题首次表现、提示依赖、重复错误与延迟复测。它不把虚拟筹码收益或短期胜率当成能力证明，也不承诺“学完必胜”。'
        )
      ),
      h(
        'div',
        { className: 'page-head-actions' },
        h('a', { className: 'btn btn-primary', href: '#/train?mode=daily' }, '继续训练'),
        h('a', { className: 'btn btn-secondary', href: '#/mistakes' }, `错题本 ${getOpenMistakeCount()}`)
      )
    ),
    h(
      'section',
      { className: 'progress-overview' },
      h(
        'div',
        { className: 'overview-main' },
        h(
          'div',
          { className: 'overview-number' },
          h('strong', {}, `${Math.round(overall.mastery * 100)}%`),
          h('span', {}, '综合能力信号')
        ),
        h(
          'div',
          { className: 'overview-copy' },
          h('h2', {}, overall.lowSample || overall.tags === 0 ? '样本不足，先继续积累' : masteryLabel(overall.mastery)),
          h(
            'p',
            {},
            overall.tags === 0
              ? '还没有作答记录。完成几道题后，这里会按知识标签展示分项信息。'
              : `覆盖 ${overall.tags} 个已练习标签、${overall.attempts} 次作答。综合值按作答量加权，不代表胜率。`
          ),
          h(
            'p',
            { className: 'muted small' },
            overall.lowSample ? '部分标签的首次作答或延迟复测样本不足，请把百分比视为方向而非结论。' : '当前样本可以显示方向，但仍不能预测长期盈利。'
          )
        )
      ),
      h(
        'div',
        { className: 'overview-stats' },
        h('div', {}, h('strong', {}, `${getLessonCompletionCount()} / 10`), h('span', {}, '课程完成')),
        h('div', {}, h('strong', {}, String(getDueCount())), h('span', {}, '待复习')),
        h('div', {}, h('strong', {}, String(getStreak())), h('span', {}, '连续学习天数')),
        h('div', {}, h('strong', {}, String(data.attempts.length)), h('span', {}, '累计作答'))
      )
    ),
    h(
      'div',
      { className: 'progress-layout' },
      h(
        'div',
        { className: 'progress-tags' },
        TAG_GROUPS.map((group) => {
          const groupTags = tags.filter((tag) => tag.group === group.id);
          return h(
            'section',
            { className: 'tag-group' },
            h(
              'div',
              { className: 'tag-group-head' },
              h('h2', {}, group.name),
              h(
                'span',
                { className: 'muted small' },
                `${groupTags.filter((t) => t.stats.attempts).length} / ${groupTags.length} 个标签有记录`
              )
            ),
            h(
              'div',
              { className: 'tag-card-grid' },
              groupTags.map((tag) => tagCard(tag))
            )
          );
        })
      ),
      h(
        'aside',
        { className: 'progress-side' },
        h(
          'section',
          { className: 'side-card' },
          h('h2', {}, '这个数字怎么来'),
          h(
            'details',
            { open: true },
            h('summary', {}, '四项信号'),
            h(
              'ul',
              { className: 'plain-list' },
              h('li', {}, h('strong', {}, '未见题首次表现：'), '第一次遇到某题时的得分，避免用“记住原题”冒充掌握。'),
              h('li', {}, h('strong', {}, '提示独立性：'), '使用提示越少，该项越高；第三级提示包含推荐动作。'),
              h('li', {}, h('strong', {}, '重复错误控制：'), '同一标签反复出错的次数越多，该项越低。'),
              h('li', {}, h('strong', {}, '延迟复测：'), '到期后再次作答的表现，用来检验是否真的保留。')
            ),
            h(
              'p',
              { className: 'muted small' },
              '没有延迟复测时，权重会重新分配，而不是把该项粗暴记为 0。样本不足会明确标注。'
            )
          )
        ),
        h(
          'section',
          { className: 'side-card' },
          h('h2', {}, '模拟牌局'),
          h(
            'div',
            { className: 'sim-mini-stats' },
            h('div', {}, h('strong', {}, String(sim.hands)), h('span', {}, '完成手数')),
            h('div', {}, h('strong', {}, `${(sim.netChips / 2).toFixed(1)}`), h('span', {}, '净赢/输 BB')),
            h('div', {}, h('strong', {}, String(sim.wins)), h('span', {}, '盈利手')),
            h('div', {}, h('strong', {}, String(sim.losses)), h('span', {}, '亏损手'))
          ),
          h(
            'p',
            { className: 'muted small' },
            '模拟牌局的筹码结果不进入能力信号，也不用于解锁课程。它只用于练习完整流程与复盘。'
          ),
          h('a', { className: 'btn btn-secondary btn-sm', href: '#/play' }, '进入模拟牌局'),
          h('a', { className: 'btn btn-ghost btn-sm', href: '#/review' }, '查看已结束手牌')
        ),
        h(
          'section',
          { className: 'side-card' },
          h('h2', {}, '数据与隐私'),
          h(
            'p',
            { className: 'muted small' },
            '学习记录保存在本浏览器 localStorage，没有后端上传。换设备/清站点数据会丢失；可导出备份。'
          ),
          h(
            'div',
            { className: 'data-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'btn btn-secondary btn-sm',
                onClick: () => downloadFile(`poker-progress-${Date.now()}.json`, exportData())
              },
              '导出进度'
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'btn btn-secondary btn-sm',
                onClick: () => importInput.click()
              },
              '导入进度'
            ),
            importInput,
            h(
              'button',
              {
                type: 'button',
                className: 'btn btn-danger btn-sm',
                onClick: () => {
                  if (window.confirm('确定清空全部学习记录、错题与模拟牌局历史吗？此操作不可撤销。')) {
                    resetAll();
                    location.reload();
                  }
                }
              },
              '重置全部'
            )
          ),
          h('p', { className: 'muted small' }, `记录创建时间：${formatDate(data.createdAt)}`)
        ),
        h(
          'section',
          { className: 'side-card warning-card' },
          h('h2', {}, '能力的边界'),
          h(
            'p',
            {},
            '本产品的策略模型是简化教学基线，不是求解器。它适合建立规则、概率与范围框架，但不能替代针对具体对手、筹码深度、前注/抽水规则的高阶训练。'
          ),
          h('p', { className: 'muted small' }, '任何“完成课程/高掌握度”的展示都不构成盈利承诺。')
        )
      )
    )
  );
}
