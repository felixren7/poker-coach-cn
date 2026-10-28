import { QUESTIONS, QUESTION_MAP } from '../content/questions.js';
import { PHASES, LESSON_MAP } from '../content/lessons.js';
import { TAGS } from '../content/tags.js';
import {
  getDueCount,
  getDueQuestionIds,
  getMistakeList,
  getQuestionStats,
  getReviewQueue,
  getTagOverview,
  recordAttempt,
  getData,
  isLessonUnlocked,
  isLessonCompleted
} from '../state/store.js';
import { verdictMeta } from '../state/progress.js';
import { createQuestionPlayer } from '../ui/question.js';
import { renderTagChips } from '../ui/components.js';
import { h, append, clear, progressBar, emptyState, toast, relativeTime } from '../ui/dom.js';

let session = null;

function statusLabel(status) {
  return {
    unseen: '未做过',
    due: '待复习',
    learned: '已达标',
    partial: '部分掌握',
    weak: '需巩固'
  }[status] || status;
}

function isQuestionAvailable(q) {
  const lesson = LESSON_MAP[q.lessonId];
  if (!lesson) return false;
  return (
    isLessonUnlocked(lesson) ||
    isLessonCompleted(lesson.id) ||
    (getQuestionStats(q.id)?.attempts || 0) > 0
  );
}

function statusOf(qid) {
  const stats = getQuestionStats(qid);
  if (!stats?.attempts) return 'unseen';
  if (stats.dueAt && stats.dueAt <= Date.now()) return 'due';
  if (stats.lastVerdict === 'goal_met') return 'learned';
  if (stats.lastVerdict === 'reasonable_tradeoff') return 'partial';
  return 'weak';
}

function buildQueue(params) {
  const mode = params.mode;
  if (mode === 'single') {
    const q = QUESTION_MAP[params.q];
    return q && isQuestionAvailable(q)
      ? { ids: [q.id], label: '单题练习', mode }
      : { ids: [], label: '单题练习', mode, unavailable: true };
  }
  if (mode === 'mistakes') {
    const ids = [];
    for (const item of getMistakeList()) {
      if (!ids.includes(item.questionId)) ids.push(item.questionId);
    }
    for (const id of getReviewQueue(30)) {
      const q = QUESTION_MAP[id];
      if (q && isQuestionAvailable(q) && !ids.includes(id)) ids.push(id);
      if (ids.length >= 10) break;
    }
    return { ids: ids.slice(0, 10), label: '错题与弱项复习', mode };
  }
  if (mode === 'filter') {
    const phase = Number(params.phase) || null;
    const tag = params.tag || null;
    const matching = QUESTIONS.filter(
      (q) =>
        isQuestionAvailable(q) &&
        (!phase || q.phase === phase) &&
        (!tag || q.tags.includes(tag))
    );
    const ranked = matching
      .map((q) => {
        const stats = getQuestionStats(q.id);
        const status = statusOf(q.id);
        const rank = status === 'due' ? 0 : status === 'weak' ? 1 : status === 'partial' ? 2 : status === 'unseen' ? 3 : 4;
        return { q, rank, attempts: stats?.attempts || 0 };
      })
      .sort((a, b) => a.rank - b.rank || a.attempts - b.attempts)
      .slice(0, 10)
      .map((x) => x.q.id);
    return { ids: ranked, label: '自由练习', mode };
  }
  // daily / default：只安排已解锁/已练过的题，避免首次进入就堆满高阶术语。
  const ids = getReviewQueue(60).filter((id) => QUESTION_MAP[id] && isQuestionAvailable(QUESTION_MAP[id]));
  if (ids.length < 10) {
    const filler = QUESTIONS.filter((q) => isQuestionAvailable(q) && !ids.includes(q.id));
    filler.sort((a, b) => {
      const sa = getQuestionStats(a.id)?.attempts || 0;
      const sb = getQuestionStats(b.id)?.attempts || 0;
      return sa - sb;
    });
    for (const q of filler) {
      if (ids.length >= 10) break;
      ids.push(q.id);
    }
  }
  return { ids: ids.slice(0, 10), label: '今日训练', mode: 'daily' };
}

function ensureSession(params) {
  const key = JSON.stringify(params);
  if (session && session.key === key) return session;
  const built = buildQueue(params);
  session = {
    key,
    ...built,
    idx: 0,
    results: [],
    startedAt: Date.now()
  };
  return session;
}

function renderLanding() {
  const due = getDueCount();
  const mistakes = getMistakeList();
  const tags = getTagOverview()
    .filter((t) => t.stats.attempts)
    .sort((a, b) => a.mastery.mastery - b.mastery.mastery);
  const weakTags = tags.filter((t) => t.mastery.mastery < 0.6).slice(0, 4);
  const data = getData();

  const filterForm = h(
    'form',
    { className: 'filter-form' },
    h(
      'label',
      {},
      h('span', {}, '阶段'),
      h(
        'select',
        { name: 'phase' },
        h('option', { value: '' }, '全部阶段'),
        PHASES.map((p) => h('option', { value: String(p.id) }, `阶段 ${p.id} · ${p.title}`))
      )
    ),
    h(
      'label',
      {},
      h('span', {}, '知识标签'),
      h(
        'select',
        { name: 'tag' },
        h('option', { value: '' }, '全部标签'),
        Object.entries(TAGS).map(([id, meta]) => h('option', { value: id }, meta.name))
      )
    ),
    h('button', { type: 'submit', className: 'btn btn-primary' }, '开始自由练习')
  );
  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(filterForm);
    const phase = formData.get('phase');
    const tag = formData.get('tag');
    const qs = new URLSearchParams({ mode: 'filter' });
    if (phase) qs.set('phase', phase);
    if (tag) qs.set('tag', tag);
    location.hash = `#/train?${qs.toString()}`;
  });

  const availableQuestions = QUESTIONS.filter(isQuestionAvailable);
  const bank = h('div', { className: 'question-bank' });
  for (const phase of PHASES) {
    const qs = availableQuestions.filter((q) => q.phase === phase.id);
    const details = h(
      'details',
      { className: 'bank-phase' },
      h(
        'summary',
        {},
        qs.length
          ? `阶段 ${phase.id} · ${phase.title}（${qs.length} 题）`
          : `阶段 ${phase.id} · ${phase.title}（完成前置课程后解锁）`
      ),
      h(
        'div',
        { className: 'bank-list' },
        qs.map((q) => {
          const status = statusOf(q.id);
          return h(
            'a',
            { className: 'bank-row', href: `#/train?mode=single&q=${q.id}` },
            h('span', { className: 'bank-title' }, q.title),
            renderTagChips(q.tags.slice(0, 2)),
            h('span', { className: `status-pill status-${status}` }, statusLabel(status))
          );
        })
      )
    );
    bank.appendChild(details);
  }

  return h(
    'div',
    { className: 'view trainer-view' },
    h(
      'header',
      { className: 'page-head' },
      h(
        'div',
        {},
        h('p', { className: 'eyebrow' }, '训练场'),
        h('h1', {}, '每次都基于完整局面，而不是只看两张底牌'),
        h(
          'p',
          { className: 'page-lead' },
          '题目会给出位置、人数、有效筹码、底池、待跟注、此前行动与合法操作。先独立作答，再逐级查看提示；评分只依据当时可知信息与明确假设。'
        )
      ),
      h(
        'div',
        { className: 'page-head-actions' },
        h('a', { className: 'btn btn-primary', href: '#/train?mode=daily' }, due ? `今日复习 ${due} 题` : '开始今日训练'),
        h('a', { className: 'btn btn-secondary', href: '#/train?mode=mistakes' }, `错题复习${mistakes.length ? ` ${mistakes.length}` : ''}`)
      )
    ),
    h(
      'div',
      { className: 'trainer-grid' },
      h(
        'div',
        { className: 'trainer-main' },
        h(
          'section',
          { className: 'trainer-card' },
          h('h2', {}, '今日建议'),
          h(
            'p',
            {},
            due
              ? `有 ${due} 道题已到复习时间。间隔复习会优先安排到期题与同族变式，避免只记住原题答案。`
              : '暂无到期复习。系统会从未见题与薄弱标签中补齐一组训练。'
          ),
          h(
            'div',
            { className: 'quick-actions' },
            h('a', { className: 'quick-action', href: '#/train?mode=daily' }, h('strong', {}, '综合训练'), h('span', {}, '到期 + 未见 + 弱项')),
            h('a', { className: 'quick-action', href: '#/train?mode=mistakes' }, h('strong', {}, '错题复习'), h('span', {}, '按标签与变式')),
            h('a', { className: 'quick-action', href: '#/mistakes' }, h('strong', {}, '错题本'), h('span', {}, '查看全部记录')),
            h('a', { className: 'quick-action', href: '#/progress' }, h('strong', {}, '能力信号'), h('span', {}, '提示依赖与延迟复测'))
          )
        ),
        h(
          'section',
          { className: 'trainer-card' },
          h('h2', {}, '自由练习'),
          h('p', { className: 'muted' }, '按阶段或知识标签筛选，优先安排未做、到期与薄弱题。每次最多 10 题。'),
          filterForm
        ),
        weakTags.length
          ? h(
              'section',
              { className: 'trainer-card' },
              h('h2', {}, '当前薄弱标签'),
              h(
                'div',
                { className: 'weak-tag-list' },
                weakTags.map((tag) =>
                  h(
                    'a',
                    { className: 'weak-tag', href: `#/train?mode=filter&tag=${tag.id}` },
                    h('strong', {}, tag.name),
                    h('span', {}, `能力信号 ${Math.round(tag.mastery.mastery * 100)}%`),
                    progressBar(tag.mastery.mastery, tag.name)
                  )
                )
              )
            )
          : null
      ),
      h(
        'div',
        { className: 'trainer-side' },
        h(
          'section',
          { className: 'trainer-card bank-card' },
          h('h2', {}, '题库'),
          h(
            'p',
            { className: 'muted small' },
            `已解锁 ${availableQuestions.length} / ${QUESTIONS.length} 题。完成课程后逐步开放；已练过的题始终可复习。`
          ),
          bank
        )
      )
    ),
    h(
      'div',
      { className: 'callout callout-info' },
      h('strong', {}, '评分的边界'),
      h(
        'p',
        {},
        '推荐动作来自结构化题目与教学基线；同一题允许“合理但存在取舍”的替代。评分不会读取未来公共牌或对手暗牌，也不会用最终输赢反推决策。'
      )
    )
  );
}

function renderSession(container, params) {
  const s = ensureSession(params);
  if (!s.ids.length) {
    container.appendChild(
      emptyState(
        s.unavailable ? '这组训练还没有解锁' : '没有可用于这组训练的题目',
        s.unavailable
          ? '先完成对应课程的前置课程，再回来练习；已练过的题始终可复习。'
          : '换一个筛选条件，或先完成课程中的示范。',
        h('a', { className: 'btn btn-primary', href: '#/train' }, '返回训练首页')
      )
    );
    return;
  }

  if (s.idx >= s.ids.length) {
    const counts = { goal_met: 0, reasonable_tradeoff: 0, below_baseline: 0, rule_error: 0 };
    for (const result of s.results) counts[result.grade.verdict] = (counts[result.grade.verdict] || 0) + 1;
    const totalHints = s.results.reduce((sum, r) => sum + (r.hintsUsed || 0), 0);
    const stage = PHASES.find((p) => p.id === params.phase);
    const summary = h(
      'div',
      { className: 'view trainer-view session-view' },
      h(
        'header',
        { className: 'session-head' },
        h('a', { href: '#/train', className: 'back-link' }, '← 结束本组'),
        h('div', {}, h('p', { className: 'eyebrow' }, s.label), h('h1', {}, '本组训练完成')),
        h('span', { className: 'muted' }, `${s.results.length} 题 · ${relativeTime(s.startedAt)}开始`)
      ),
      h(
        'div',
        { className: 'session-summary' },
        h(
          'div',
          { className: 'summary-verdict-grid' },
          ['goal_met', 'reasonable_tradeoff', 'below_baseline', 'rule_error'].map((verdict) =>
            h(
              'div',
              { className: `summary-verdict-card tone-${verdictMeta(verdict).tone}` },
              h('strong', {}, String(counts[verdict] || 0)),
              h('span', {}, verdictMeta(verdict).label)
            )
          )
        ),
        h(
          'p',
          { className: 'muted' },
          `共使用 ${totalHints} 级提示。首次作答表现、提示依赖、重复错误与延迟复测会分别计入能力信号；本组结果本身不构成“掌握”或“高手”认证。`
        ),
        h(
          'div',
          { className: 'page-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'btn btn-primary',
              onClick: () => {
                session = null;
                location.hash = `#/train?mode=${s.mode}${stage ? `&phase=${stage.id}` : ''}&t=${Date.now()}`;
              }
            },
            '再来一组'
          ),
          h('a', { className: 'btn btn-secondary', href: '#/progress' }, '查看能力信号'),
          h('a', { className: 'btn btn-ghost', href: '#/learn' }, '返回课程')
        )
      ),
      h(
        'div',
        { className: 'session-results' },
        s.results.map((result) => {
          const q = QUESTION_MAP[result.qid];
          return h(
            'a',
            { className: 'session-result-row', href: `#/train?mode=single&q=${result.qid}` },
            h('span', { className: `result-dot tone-${result.grade.tone}` }),
            h('div', {}, h('strong', {}, q?.title || result.qid), renderTagChips(q?.tags || [])),
            h('span', { className: `status-pill tone-${result.grade.tone}` }, result.grade.verdictLabel),
            h('span', { className: 'muted small' }, result.hintsUsed ? `提示 ${result.hintsUsed} 级` : '无提示')
          );
        })
      )
    );
    container.appendChild(summary);
    return;
  }

  const q = QUESTION_MAP[s.ids[s.idx]];
  if (!q) {
    s.idx += 1;
    renderSession(container, params);
    return;
  }
  const wrap = h('div', { className: 'view trainer-view session-view' });
  wrap.appendChild(
    h(
      'header',
      { className: 'session-head' },
      h('a', { href: '#/train', className: 'back-link' }, '← 结束本组'),
      h(
        'div',
        { className: 'session-head-main' },
        h('p', { className: 'eyebrow' }, s.label),
        h('div', { className: 'session-progress-row' }, [
          h('span', {}, `第 ${s.idx + 1} / ${s.ids.length} 题`),
          progressBar(s.idx / s.ids.length, '训练进度'),
          params.tag ? h('span', { className: 'tag-chip' }, TAGS[params.tag]?.name || params.tag) : null
        ])
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'btn btn-ghost',
          onClick: () => {
            session = null;
            location.hash = '#/train';
          }
        },
        '重新选组'
      )
    )
  );
  const player = createQuestionPlayer(q, {
    mode: 'practice',
    onAnswered: ({ question, grade, hintsUsed }) => {
      const meta = recordAttempt(question, grade, hintsUsed);
      s.results.push({ qid: question.id, grade, hintsUsed });
      return meta;
    },
    onNext: () => {
      s.idx += 1;
      clear(wrap);
      const holder = h('div', {});
      wrap.appendChild(holder);
      renderSessionInto(holder, params, s);
    },
    nextLabel: s.idx === s.ids.length - 1 ? '查看本组总结' : '下一题',
    showSource: true
  });
  const holder = h('div', {});
  wrap.appendChild(holder);
  holder.appendChild(player.root);
  container.appendChild(wrap);
}

// 用于 onNext 时只重绘内容，不重复外层 view。
function renderSessionInto(container, params, s) {
  const temp = h('div', {});
  // 复用 renderSession 的结构，但把结果直接放入 temp；避免无限递归地创建 view。
  const original = session;
  session = s;
  renderSession(temp, params);
  session = original;
  while (temp.firstChild) container.appendChild(temp.firstChild);
}

export function renderTrainer(params = {}) {
  const root = h('div', {});
  if (!params.mode) {
    root.appendChild(renderLanding());
  } else {
    renderSession(root, params);
  }
  return root;
}

export function cleanup() {
  // 会话保留在内存中，便于用户离开后回到同一组训练。
}
