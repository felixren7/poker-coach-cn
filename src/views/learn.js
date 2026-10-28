import { PHASES, LESSON_MAP } from '../content/lessons.js';
import { TAGS } from '../content/tags.js';
import {
  getLessonStatus,
  getPhaseStatus,
  getPracticeStatus,
  getLessonCompletionCount,
  getNextLesson,
  getDueCount
} from '../state/store.js';
import { h, progressBar } from '../ui/dom.js';
import { renderTagChips } from '../ui/components.js';

function lockReason(lesson) {
  const names = (lesson.prerequisites || [])
    .filter((id) => LESSON_MAP[id])
    .map((id) => LESSON_MAP[id].title);
  return names.length ? `完成 ${names.join('、')} 后解锁` : '完成前一阶段后解锁';
}

export function renderLearn() {
  const next = getNextLesson();
  return h(
    'div',
    { className: 'view learn-view' },
    h(
      'header',
      { className: 'page-head' },
      h(
        'div',
        {},
        h('p', { className: 'eyebrow' }, '课程地图'),
        h('h1', {}, '按依赖顺序，把一件事学透再进入下一件'),
        h(
          'p',
          { className: 'page-lead' },
          '每节课只讲一个核心概念，先示范再练习。高阶课程逐步解锁；锁定不是内容缺失，而是前置能力尚未建立。已完成课程不代表掌握，进度页会分别显示能力信号。'
        )
      ),
      h(
        'div',
        { className: 'page-head-actions' },
        next
          ? h('a', { className: 'btn btn-primary', href: `#/lesson/${next.id}` }, '继续下一课')
          : h('a', { className: 'btn btn-primary', href: '#/train?mode=free' }, '进入训练'),
        h('a', { className: 'btn btn-secondary', href: '#/train?mode=daily' }, `今日复习${getDueCount() ? ` ${getDueCount()} 题` : ''}`)
      )
    ),
    h('div', { className: 'learn-summary' }, [
      h('span', {}, `已完成 ${getLessonCompletionCount()} / 10 课`),
      h('span', {}, '建议顺序：规则 → 翻前 → 翻后 → 概率 → 高阶'),
      h('span', {}, '首次遇到术语可点击查看中文解释')
    ]),
    h(
      'div',
      { className: 'phase-list' },
      PHASES.map((phase) => {
        const phaseStatus = getPhaseStatus(phase);
        return h(
          'section',
          { className: `phase-section phase-${phase.id}` },
          h(
            'div',
            { className: 'phase-head' },
            h(
              'div',
              { className: 'phase-index' },
              h('span', {}, `0${phase.id}`),
              h('small', {}, phaseStatus.complete ? '完成' : `${phaseStatus.completed}/${phaseStatus.total}`)
            ),
            h(
              'div',
              { className: 'phase-head-copy' },
              h('p', { className: 'eyebrow' }, phase.subtitle),
              h('h2', {}, phase.title),
              h('p', {}, phase.description)
            ),
            h(
              'div',
              { className: 'phase-head-progress' },
              progressBar(phaseStatus.completed / phaseStatus.total, phase.title),
              h('span', { className: 'muted small' }, phaseStatus.complete ? '本阶段课程已完成' : '逐步解锁')
            )
          ),
          h(
            'div',
            { className: 'lesson-list' },
            phase.lessons.map((lessonId) => {
              const lesson = LESSON_MAP[lessonId];
              const status = getLessonStatus(lesson);
              const practice = getPracticeStatus(lesson);
              const classes = `lesson-card status-${status}`;
              const content = [
                h(
                  'div',
                  { className: 'lesson-top' },
                  h(
                    'div',
                    { className: 'lesson-title-wrap' },
                    h('span', { className: `status-dot status-${status}`, 'aria-hidden': 'true' }),
                    h('h3', {}, lesson.title)
                  ),
                  h(
                    'span',
                    { className: `status-pill status-${status}` },
                    status === 'completed' ? '已完成' : status === 'available' ? '可学习' : '未解锁'
                  )
                ),
                h('p', { className: 'lesson-subtitle' }, lesson.subtitle),
                h(
                  'div',
                  { className: 'lesson-meta' },
                  renderTagChips(lesson.tags),
                  h('span', { className: 'muted small' }, `${lesson.minutes} 分钟 · 练习 ${practice.attempted}/${practice.total}`)
                ),
                status === 'locked'
                  ? h('p', { className: 'lock-note' }, `🔒 ${lockReason(lesson)}`)
                  : h('span', { className: 'lesson-cta' }, status === 'completed' ? '复习本课 →' : '开始学习 →')
              ];
              return status === 'locked'
                ? h('div', { className: classes }, content)
                : h('a', { className: classes, href: `#/lesson/${lesson.id}` }, content);
            })
          )
        );
      })
    ),
    h(
      'div',
      { className: 'callout callout-warn learn-footnote' },
      h('strong', {}, '关于“解锁”'),
      h(
        'p',
        {},
        '本产品用课程完成情况控制高阶内容入口，避免新手第一次进入就被术语淹没。它不根据短期胜率解锁，也不把完成课程等同于“高手”。'
      )
    )
  );
}
