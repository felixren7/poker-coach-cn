import { TAGS } from '../content/tags.js';
import { getMistakeList, getDueCount, getQuestionStats, getData } from '../state/store.js';
import { verdictMeta } from '../state/progress.js';
import { h, emptyState, relativeTime } from '../ui/dom.js';
import { renderTagChips } from '../ui/components.js';

export function renderMistakes() {
  const mistakes = getMistakeList();
  const due = getDueCount();
  const data = getData();
  const resolvedCount = Object.values(data.mistakes).filter((m) => m.resolvedAt).length;
  const byTag = new Map();
  for (const item of mistakes) {
    for (const tag of item.tags || []) {
      byTag.set(tag, (byTag.get(tag) || 0) + 1);
    }
  }

  return h(
    'div',
    { className: 'view mistakes-view' },
    h(
      'header',
      { className: 'page-head' },
      h(
        'div',
        {},
        h('p', { className: 'eyebrow' }, '错题与复习'),
        h('h1', {}, '把错误变成有标签的训练清单'),
        h(
          'p',
          { className: 'page-lead' },
          '错题会按位置判断、牌面识别、跟注过宽、忽视尺度等知识标签归类，并安排同族变式与间隔复习。复习达标会标记解决，但记录仍保留。'
        )
      ),
      h(
        'div',
        { className: 'page-head-actions' },
        h('a', { className: 'btn btn-primary', href: '#/train?mode=mistakes' }, '开始错题复习'),
        h('a', { className: 'btn btn-secondary', href: '#/train?mode=daily' }, `今日到期 ${due} 题`)
      )
    ),
    mistakes.length
      ? h(
          'div',
          { className: 'mistake-dashboard' },
          h(
            'div',
            { className: 'mistake-stat' },
            h('strong', {}, String(mistakes.length)),
            h('span', {}, '未解决错题')
          ),
          h(
            'div',
            { className: 'mistake-stat' },
            h('strong', {}, String(due)),
            h('span', {}, '已到期')
          ),
          h(
            'div',
            { className: 'mistake-stat' },
            h('strong', {}, String(resolvedCount)),
            h('span', {}, '已解决（保留记录）')
          ),
          h(
            'div',
            { className: 'mistake-stat' },
            h('strong', {}, String(byTag.size)),
            h('span', {}, '涉及知识标签')
          )
        )
      : null,
    mistakes.length
      ? h(
          'div',
          { className: 'mistake-table' },
          mistakes.map((item) => {
            const q = item.question;
            const stats = getQuestionStats(item.questionId);
            const verdict = verdictMeta(item.lastVerdict);
            return h(
              'article',
              { className: 'mistake-item' },
              h(
                'div',
                { className: 'mistake-item-main' },
                h(
                  'div',
                  { className: 'mistake-item-head' },
                  h('a', { href: `#/train?mode=single&q=${item.questionId}` }, q.title),
                  h('span', { className: `verdict-badge verdict-${item.lastVerdict}` }, verdict.label)
                ),
                h('p', { className: 'muted small' }, q.explanation?.summary || ''),
                h('div', { className: 'mistake-item-meta' }, [
                  renderTagChips(item.tags || []),
                  h('span', { className: 'muted small' }, `错 ${item.count} 次 · 最近 ${relativeTime(item.lastAt)}`),
                  stats?.dueAt ? h('span', { className: 'muted small' }, `下次复习 ${relativeTime(stats.dueAt)}`) : null
                ])
              ),
              h(
                'div',
                { className: 'mistake-item-actions' },
                h('a', { className: 'btn btn-secondary btn-sm', href: `#/train?mode=single&q=${item.questionId}` }, '重做'),
                h('a', { className: 'btn btn-ghost btn-sm', href: `#/lesson/${q.lessonId}` }, '回课程')
              )
            );
          })
        )
      : emptyState(
          '错题本是空的',
          '目前没有未解决错题。继续训练；答错或低于教学基线时，系统会自动记录并安排复习。',
          h('a', { className: 'btn btn-primary', href: '#/train?mode=daily' }, '开始训练')
        ),
    h(
      'div',
      { className: 'callout callout-info' },
      h('strong', {}, '复习不是重看答案'),
      h(
        'p',
        {},
        '系统优先安排同族变式与延迟复测，而不是把原题立刻再问一遍。只有在新场景中做对，才更能说明概念被你掌握。'
      )
    )
  );
}
