import { LESSON_MAP, PHASE_MAP } from '../content/lessons.js';
import { getQuestion } from '../content/questions.js';
import { GLOSSARY_MAP } from '../content/glossary.js';
import { TAGS } from '../content/tags.js';
import {
  getLessonStatus,
  getPracticeStatus,
  getQuestionStats,
  isLessonCompleted,
  markLessonComplete,
  recordAttempt,
  getNextLesson
} from '../state/store.js';
import { verdictMeta } from '../state/progress.js';
import { createQuestionPlayer } from '../ui/question.js';
import { cardRow, renderTagChips, openGlossary } from '../ui/components.js';
import { renderProbabilityTools } from '../ui/probability-tools.js';
import { h, append, clear, richText, progressBar, toast, relativeTime } from '../ui/dom.js';

function renderSection(section) {
  switch (section.type) {
    case 'p': {
      const p = h('p', { className: 'lesson-p' });
      p.appendChild(richText(section.text));
      return p;
    }
    case 'h':
      return h('h3', { className: 'lesson-h' }, section.text);
    case 'list': {
      const wrap = h('div', { className: 'lesson-list-block' });
      if (section.title) wrap.appendChild(h('h4', {}, section.title));
      const ul = h('ul', { className: 'lesson-ul' });
      for (const item of section.items || []) {
        const li = h('li', {});
        li.appendChild(richText(item));
        ul.appendChild(li);
      }
      wrap.appendChild(ul);
      return wrap;
    }
    case 'callout': {
      const div = h('div', { className: `callout callout-${section.tone || 'info'}` });
      if (section.title) div.appendChild(h('strong', {}, section.title));
      const p = h('p', {});
      p.appendChild(richText(section.text));
      div.appendChild(p);
      return div;
    }
    case 'table': {
      const wrap = h('div', { className: 'lesson-table-wrap' });
      const table = h('table', { className: 'lesson-table' });
      const thead = h('thead', {});
      const tr = h('tr', {});
      for (const header of section.headers || []) {
        const th = h('th', {});
        th.appendChild(richText(header));
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      table.appendChild(thead);
      const tbody = h('tbody', {});
      for (const row of section.rows || []) {
        const rowEl = h('tr', {});
        for (const cell of row) {
          const td = h('td', {});
          td.appendChild(richText(cell));
          rowEl.appendChild(td);
        }
        tbody.appendChild(rowEl);
      }
      table.appendChild(tbody);
      wrap.appendChild(table);
      return wrap;
    }
    case 'cards': {
      const wrap = h('div', { className: 'lesson-cards' });
      if (section.title) wrap.appendChild(h('h4', {}, section.title));
      for (const group of section.groups || []) {
        wrap.appendChild(
          h(
            'div',
            { className: 'lesson-card-example' },
            h('div', { className: 'card-group-label' }, group.label),
            cardRow(group.cards, { small: true }),
            group.note ? h('p', { className: 'muted small' }, group.note) : null
          )
        );
      }
      return wrap;
    }
    default:
      return null;
  }
}

function renderLocked(lesson) {
  const prerequisites = (lesson.prerequisites || []).map((id) => LESSON_MAP[id]).filter(Boolean);
  return h(
    'div',
    { className: 'view lesson-locked' },
    h('p', { className: 'eyebrow' }, `阶段 ${lesson.phase} · ${lesson.title}`),
    h('h1', {}, '这节课还没有解锁'),
    h(
      'p',
      { className: 'page-lead' },
      '课程按依赖顺序解锁，避免在基础概念尚未建立时堆入过多术语。先完成前置课程，再回来。'
    ),
    h(
      'div',
      { className: 'callout callout-warn' },
      h('strong', {}, '前置课程'),
      prerequisites.length
        ? h(
            'ul',
            { className: 'plain-list' },
            prerequisites.map((pre) =>
              h(
                'li',
                {},
                h('a', { href: `#/lesson/${pre.id}` }, `${pre.title}`),
                isLessonCompleted(pre.id) ? '（已完成）' : '（尚未完成）'
              )
            )
          )
        : h('p', {}, '完成前一阶段课程后解锁。')
    ),
    h(
      'div',
      { className: 'page-actions' },
      h('a', { className: 'btn btn-primary', href: '#/learn' }, '返回学习地图')
    )
  );
}

export function renderLesson(params = {}) {
  const lesson = LESSON_MAP[params.id];
  if (!lesson) {
    return h(
      'div',
      { className: 'view' },
      h('h1', {}, '课程不存在'),
      h('a', { className: 'btn btn-secondary', href: '#/learn' }, '返回学习地图')
    );
  }
  if (getLessonStatus(lesson) === 'locked') return renderLocked(lesson);

  const phase = PHASE_MAP[lesson.phase];
  const demoQuestion = getQuestion(lesson.demoQuestionId);
  const practiceQuestions = (lesson.practiceQuestionIds || []).map(getQuestion).filter(Boolean);
  let practiceIndex = practiceQuestions.findIndex((q) => !getQuestionStats(q.id)?.attempts);
  if (practiceIndex < 0) practiceIndex = practiceQuestions.length;

  const root = h('div', { className: 'view lesson-view' });
  const statusBadge = h(
    'span',
    { className: `status-pill status-${getLessonStatus(lesson)}` },
    isLessonCompleted(lesson.id) ? '已完成' : '学习中'
  );

  root.appendChild(
    h(
      'header',
      { className: 'lesson-head' },
      h(
        'div',
        { className: 'lesson-head-top' },
        h('a', { href: '#/learn', className: 'back-link' }, '← 返回课程地图'),
        statusBadge
      ),
      h('p', { className: 'eyebrow' }, `阶段 ${lesson.phase} · ${phase?.title || ''}`),
      h('h1', {}, lesson.title),
      h('p', { className: 'page-lead' }, lesson.subtitle),
      h(
        'div',
        { className: 'lesson-head-meta' },
        renderTagChips(lesson.tags),
        h('span', { className: 'muted small' }, `${lesson.minutes} 分钟`)
      )
    )
  );

  const content = h('div', { className: 'lesson-content' });
  for (const section of lesson.sections || []) {
    const el = renderSection(section);
    if (el) content.appendChild(el);
  }
  root.appendChild(content);

  if (lesson.id === 'L7') {
    root.appendChild(renderProbabilityTools());
  }

  if (demoQuestion) {
    root.appendChild(
      h(
        'section',
        { className: 'lesson-demo-section' },
        h('div', { className: 'section-head' }, h('div', {}, h('p', { className: 'eyebrow' }, '可操作示范'), h('h2', {}, '先看一次，再自己做'))),
        h(
          'p',
          { className: 'section-lead' },
          '示范不会计入练习成绩。你可以先展开提示，观察推荐动作与理由，再在下面的独立练习中自己做决定。'
        ),
        createQuestionPlayer(demoQuestion, {
          mode: 'demo',
          onAnswered: () => null,
          onNext: () => document.getElementById('lesson-practice')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          nextLabel: '进入独立练习',
          showSource: true
        }).root,
        h(
          'button',
          {
            type: 'button',
            className: 'btn btn-ghost demo-skip',
            onClick: () => document.getElementById('lesson-practice')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          },
          '跳过示范，直接练习 ↓'
        )
      )
    );
  }

  const practiceSection = h(
    'section',
    { className: 'lesson-practice-section', id: 'lesson-practice' },
    h(
      'div',
      { className: 'section-head' },
      h('div', {}, h('p', { className: 'eyebrow' }, '独立练习'), h('h2', {}, '现在轮到你做决定'))
    ),
    h(
      'p',
      { className: 'section-lead' },
      '先自己作答，再使用提示。每题都会记录首次表现、提示依赖与下次复习时间；完成练习不等于掌握。'
    )
  );
  const practiceContainer = h('div', { className: 'practice-container' });
  practiceSection.appendChild(practiceContainer);
  root.appendChild(practiceSection);

  const renderPractice = () => {
    clear(practiceContainer);
    const currentStatus = getPracticeStatus(lesson);
    practiceContainer.appendChild(
      h(
        'div',
        { className: 'practice-status' },
        h('span', {}, `练习进度 ${currentStatus.attempted} / ${currentStatus.total}`),
        progressBar(currentStatus.attempted / currentStatus.total, '本课练习进度')
      )
    );

    if (practiceIndex >= practiceQuestions.length) {
      const complete = currentStatus.complete;
      const allDone = isLessonCompleted(lesson.id);
      const next = getNextLesson();
      const wrap = h('div', { className: 'practice-summary' });
      wrap.appendChild(
        h(
          'div',
          { className: `callout ${allDone ? 'callout-good' : complete ? 'callout-good' : 'callout-info'}` },
          h('strong', {}, allDone ? '本课已完成' : complete ? '独立练习已完成' : '还有题目未完成'),
          h(
            'p',
            {},
            complete
              ? '完成练习只代表你走过这些题目。真正的掌握还要看未见题表现、提示依赖、重复错误与延迟复测。'
              : '完成所有独立练习后，才能标记本课完成并解锁后续课程。'
          )
        )
      );
      const list = h('div', { className: 'practice-summary-list' });
      for (const q of practiceQuestions) {
        const stats = getQuestionStats(q.id);
        const verdict = stats?.lastVerdict ? verdictMeta(stats.lastVerdict) : null;
        list.appendChild(
          h(
            'div',
            { className: 'practice-summary-row' },
            h('span', { className: 'summary-title' }, q.title),
            h(
              'span',
              { className: `summary-verdict ${verdict ? `tone-${verdict.tone}` : ''}` },
              verdict ? verdict.label : '未作答'
            ),
            h(
              'span',
              { className: 'muted small' },
              stats?.dueAt ? `下次复习 ${relativeTime(stats.dueAt)}` : '—'
            )
          )
        );
      }
      wrap.appendChild(list);
      const actions = h('div', { className: 'page-actions' });
      if (complete && !allDone) {
        actions.appendChild(
          h(
            'button',
            {
              type: 'button',
              className: 'btn btn-primary',
              onClick: () => {
                try {
                  markLessonComplete(lesson.id);
                  statusBadge.className = 'status-pill status-completed';
                  statusBadge.textContent = '已完成';
                  toast('本课已标记完成；后续课程已解锁。', 'success');
                  renderPractice();
                } catch (error) {
                  toast(error.message, 'error');
                }
              }
            },
            '完成本课并解锁后续'
          )
        );
      }
      if (complete) {
        actions.appendChild(
          h(
            'button',
            {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: () => {
                practiceIndex = 0;
                renderPractice();
                practiceContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            },
            '重新练习'
          )
        );
      }
      if (allDone || complete) {
        if (next && next.id !== lesson.id) {
          actions.appendChild(
            h('a', { className: 'btn btn-primary', href: `#/lesson/${next.id}` }, `下一课：${next.title}`)
          );
        } else {
          actions.appendChild(h('a', { className: 'btn btn-secondary', href: '#/learn' }, '返回课程地图'));
        }
      }
      wrap.appendChild(actions);
      practiceContainer.appendChild(wrap);
      return;
    }

    const question = practiceQuestions[practiceIndex];
    practiceContainer.appendChild(
      h(
        'div',
        { className: 'practice-index' },
        h('span', {}, `第 ${practiceIndex + 1} / ${practiceQuestions.length} 题`),
        h('span', { className: 'muted small' }, '先独立作答；提示会记录依赖程度')
      )
    );
    const player = createQuestionPlayer(question, {
      mode: 'practice',
      onAnswered: ({ question: q, grade, hintsUsed }) =>
        recordAttempt(q, grade, hintsUsed),
      onNext: () => {
        practiceIndex += 1;
        renderPractice();
        practiceContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      nextLabel:
        practiceIndex === practiceQuestions.length - 1 ? '查看练习总结' : '下一题',
      showSource: true
    });
    practiceContainer.appendChild(player.root);
  };

  renderPractice();

  if (lesson.terms?.length) {
    root.appendChild(
      h(
        'section',
        { className: 'lesson-terms' },
        h('h3', {}, '本课术语'),
        h(
          'div',
          { className: 'term-chip-row' },
          lesson.terms
            .filter((id) => GLOSSARY_MAP[id])
            .map((id) =>
              h(
                'button',
                {
                  type: 'button',
                  className: 'term-chip',
                  onClick: () => openGlossary(id)
                },
                `${GLOSSARY_MAP[id].term} · ${GLOSSARY_MAP[id].en}`
              )
            )
        )
      )
    );
  }

  root.appendChild(
    h(
      'div',
      { className: 'lesson-takeaway' },
      h('span', { className: 'eyebrow' }, '本课结论'),
      h('p', {}, lesson.takeaway)
    )
  );

  return root;
}
