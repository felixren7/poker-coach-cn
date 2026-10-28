import { evaluateBest, describeBest } from '../engine/handEval.js';
import { cardLabel, sortCardsByRank } from '../engine/cards.js';
import {
  LEGAL_OPTIONS,
  actionSpecLabel,
  buildSpotState,
  correctLegalSet
} from '../training/scenario.js';
import { gradeResponse } from '../training/scoring.js';
import { TAGS } from '../content/tags.js';
import {
  cardEl,
  cardRow,
  renderActionPanel,
  renderHints,
  renderSource,
  renderSpot,
  renderTagChips
} from './components.js';
import { h, append, clear, richText, difficultyStars, relativeTime, toast } from './dom.js';

const TYPE_LABEL = {
  action: '情境决策',
  legal: '合法操作',
  'best-five': '最佳五张',
  compare: '牌型比较',
  numeric: '计算题',
  choice: '概念判断'
};

function phaseLabel(phase) {
  return `第 ${phase} 阶段`;
}

function renderRangeAssumption(text) {
  if (!text) return null;
  const unknown = text.includes('未知');
  return h(
    'div',
    { className: `range-assumption ${unknown ? 'is-unknown' : ''}` },
    h('span', { className: 'assumption-label' }, unknown ? '对手范围：未知' : '对手范围假设'),
    h('p', {}, text)
  );
}

function renderDemoAnswer(question) {
  let text = '';
  if (question.type === 'action') {
    text = (question.answer?.recommended || []).map(actionSpecLabel).join(' 或 ');
  } else if (question.type === 'legal') {
    try {
      const state = buildSpotState(question.spot);
      const ids = correctLegalSet(state);
      const labels = Object.fromEntries(LEGAL_OPTIONS.map((o) => [o.id, o.label]));
      text = ids.map((id) => labels[id]).join('、');
    } catch {
      text = '';
    }
  } else if (question.type === 'best-five') {
    const best = evaluateBest([...question.cards.hero, ...question.cards.board]);
    text = sortCardsByRank(best.cards).map(cardLabel).join(' ');
  } else if (question.type === 'compare') {
    const { board, A, B, correct } = question.compare;
    if (correct === 'tie') text = '平局';
    else {
      const winner = correct === 'A' ? A : B;
      const hand = describeBest([...winner.hole, ...board]);
      text = `${winner.name}（${hand.fullName}）`;
    }
  } else if (question.type === 'numeric') {
    text = `${question.numeric.answer}${question.numeric.unit || ''}`;
  } else if (question.type === 'choice') {
    const labels = Object.fromEntries((question.options || []).map((o) => [o.id, o.text]));
    text = (question.correct || []).map((id) => labels[id]).join('；');
  }
  return h(
    'div',
    { className: 'demo-callout' },
    h('span', { className: 'demo-badge' }, '示范答案'),
    h('strong', {}, text || '见下方分析'),
    h('p', {}, question.explanation.summary)
  );
}

function renderHeader(question, options) {
  return h(
    'header',
    { className: 'question-head' },
    h(
      'div',
      { className: 'question-eyebrow' },
      h('span', {}, phaseLabel(question.phase)),
      h('span', { className: 'dot' }, '·'),
      h('span', {}, TYPE_LABEL[question.type] || question.type),
      options.mode === 'demo' ? h('span', { className: 'demo-badge' }, '示范') : null,
      options.mode === 'review' ? h('span', { className: 'review-badge' }, '复盘重做') : null
    ),
    h('h2', { className: 'question-title' }, question.title),
    h(
      'div',
      { className: 'question-subrow' },
      renderTagChips(question.tags),
      difficultyStars(question.difficulty)
    )
  );
}

function renderPrompt(question) {
  const el = h('p', { className: 'question-prompt' });
  el.appendChild(richText(question.prompt));
  return el;
}

function renderSelectableBestFive(question, selected, onToggle) {
  const all = [
    { label: '你的底牌', cards: question.cards.hero },
    { label: '公共牌', cards: question.cards.board }
  ];
  const count = selected.size;
  return h(
    'div',
    { className: 'best-five-picker' },
    all.map((group) =>
      h(
        'div',
        { className: 'card-group' },
        h('div', { className: 'card-group-label' }, group.label),
        cardRow(group.cards, {
          onCardClick: (card) => onToggle(card),
          isSelected: (card) => selected.has(card),
          disabled: false
        })
      )
    ),
    h(
      'div',
      { className: 'selection-readout' },
      h('strong', {}, `已选 ${count} / 5 张`),
      h('span', { className: 'muted small' }, count === 5 ? '确认后由牌力引擎判断是否为最佳五张。' : '可以选择 0、1 或 2 张底牌。')
    )
  );
}

function renderComparePicker(question, value, onChange) {
  const { board, A, B } = question.compare;
  const option = (id, title, hole, extra = '') => {
    const selected = value === id;
    return h(
      'button',
      {
        type: 'button',
        className: `compare-option ${selected ? 'is-selected' : ''}`,
        onClick: () => onChange(id)
      },
      h('span', { className: 'compare-title' }, title),
      h('span', { className: 'compare-hand' }, hole.map(cardLabel).join(' ')),
      extra ? h('span', { className: 'compare-extra' }, extra) : null,
      h('span', { className: 'compare-check', 'aria-hidden': 'true' }, selected ? '✓' : '')
    );
  };
  return h(
    'div',
    { className: 'compare-picker' },
    h(
      'div',
      { className: 'card-group' },
      h('div', { className: 'card-group-label' }, '公共牌'),
      cardRow(board)
    ),
    h(
      'div',
      { className: 'compare-options' },
      option('A', A.name, A.hole),
      option('B', B.name, B.hole),
      option('tie', '平局 / 公共牌打满', [], '双方最佳五张相同')
    )
  );
}

function renderChoicePicker(question, selected, onChange) {
  const multi = Array.isArray(question.correct) && question.correct.length > 1;
  return h(
    'div',
    { className: 'choice-list', role: multi ? 'group' : 'radiogroup' },
    (question.options || []).map((option) => {
      const checked = selected.includes(option.id);
      return h(
        'label',
        { className: `choice-option ${checked ? 'is-selected' : ''}` },
        h('input', {
          type: multi ? 'checkbox' : 'radio',
          name: `choice-${question.id}`,
          value: option.id,
          checked,
          onChange: () => onChange(option.id)
        }),
        h('span', { className: 'choice-text' }, option.text)
      );
    })
  );
}

function renderLegalPicker(state, selected, onToggle) {
  return h(
    'div',
    { className: 'legal-picker' },
    h(
      'div',
      { className: 'legal-head' },
      h('strong', {}, '选择当前所有合法操作'),
      h('span', { className: 'muted small' }, '至少一项；可多选')
    ),
    h(
      'div',
      { className: 'choice-list' },
      LEGAL_OPTIONS.map((option) => {
        const checked = selected.includes(option.id);
        return h(
          'label',
          { className: `choice-option ${checked ? 'is-selected' : ''}` },
          h('input', {
            type: 'checkbox',
            value: option.id,
            checked,
            onChange: () => onToggle(option.id)
          }),
          h('span', { className: 'choice-text' }, option.label)
        );
      })
    )
  );
}

function renderNumericInput(question, value, onInput) {
  return h(
    'div',
    { className: 'numeric-input' },
    h(
      'label',
      { className: 'numeric-label' },
      h('span', {}, '你的答案'),
      h(
        'span',
        { className: 'numeric-wrap' },
        h('input', {
          type: 'number',
          step: 'any',
          value,
          placeholder: question.numeric.placeholder || '输入数值',
          onInput: (event) => onInput(event.target.value),
          'aria-label': '输入答案'
        }),
        h('span', { className: 'numeric-unit' }, question.numeric.unit || '')
      )
    )
  );
}

function section(title, content) {
  if (!content) return null;
  return h(
    'div',
    { className: 'analysis-section' },
    h('h4', {}, title),
    Array.isArray(content)
      ? h('ul', {}, content.map((item) => h('li', {}, item)))
      : h('p', {}, content)
  );
}

function renderFeedback(player) {
  const { grade, question, response, hintsUsed, answerMeta, options } = player;
  if (!grade) return null;
  const wrap = h('div', { className: `feedback tone-${grade.tone}` });
  wrap.appendChild(
    h(
      'div',
      { className: 'feedback-head' },
      h('span', { className: `verdict-badge verdict-${grade.verdict}` }, grade.verdictLabel),
      h('p', { className: 'feedback-summary' }, grade.detail)
    )
  );

  if (grade.userLabel || grade.expectedLabel) {
    wrap.appendChild(
      h(
        'div',
        { className: 'answer-compare' },
        h('div', {}, h('span', {}, '你的选择'), h('strong', {}, grade.userLabel || '—')),
        h('div', {}, h('span', {}, '推荐/正确'), h('strong', {}, grade.expectedLabel || '—'))
      )
    );
  }

  if (question.type === 'best-five') {
    const best = describeBest([...question.cards.hero, ...question.cards.board]);
    wrap.appendChild(
      h(
        'div',
        { className: 'best-five-reveal' },
        h('span', { className: 'label' }, '最佳五张'),
        cardRow(sortCardsByRank(best.cards), { small: true }),
        h('span', { className: 'muted small' }, best.fullName)
      )
    );
  }

  wrap.appendChild(
    h(
      'details',
      { className: 'analysis', open: grade.isError ? true : undefined },
      h('summary', {}, '详细分析'),
      h('div', { className: 'analysis-body' }, [
        section('结论', question.explanation.summary),
        section('你当前的牌', question.explanation.hand),
        section('对手范围', question.explanation.range),
        section('关键因素', question.explanation.factors),
        section('下注尺度', question.explanation.sizing),
        section('其他合理选择', question.explanation.alternatives),
        section('常见错误', question.explanation.mistakes),
        section('后续计划', question.explanation.future)
      ])
    )
  );

  const metaBits = [];
  if (hintsUsed > 0) {
    metaBits.push(`本次使用了 ${hintsUsed} 级提示${hintsUsed >= 3 ? '（含推荐动作）' : ''}。`);
  }
  if (answerMeta?.first) metaBits.push('这是你第一次作答，记录用于“未见题表现”。');
  if (answerMeta?.delayed) metaBits.push('这是一次到期后的延迟复测，记录用于检验长期保持。');
  if (answerMeta?.dueAt) metaBits.push(`下次复习：${relativeTime(answerMeta.dueAt)}。`);
  if (answerMeta?.mistake) metaBits.push('已加入错题本，并安排明日复习。');
  if (options.mode === 'demo') metaBits.push('示范不计入错题与学习进度。');
  if (metaBits.length) {
    wrap.appendChild(h('p', { className: 'feedback-meta' }, metaBits.join(' ')));
  }

  if (options.showSource !== false) {
    wrap.appendChild(renderSource(question.source));
  }

  const actions = h('div', { className: 'feedback-actions' });
  actions.appendChild(
    h(
      'button',
      {
        type: 'button',
        className: 'btn btn-ghost',
        onClick: () => player.reset()
      },
      options.mode === 'demo' ? '再看一次' : '再试一次'
    )
  );
  if (options.onNext) {
    actions.appendChild(
      h(
        'button',
        {
          type: 'button',
          className: 'btn btn-primary',
          onClick: () => options.onNext()
        },
        options.nextLabel || '下一题'
      )
    );
  }
  wrap.appendChild(actions);
  return wrap;
}

/**
 * 创建一道题的交互组件。
 * 不直接写存储；通过 onAnswered 把结果交给页面。
 */
export function createQuestionPlayer(question, options = {}) {
  const root = h('article', { className: `question-player ${options.compact ? 'is-compact' : ''}` });
  const mode = options.mode || 'practice';
  let state = null;
  let stateError = null;
  if (question.type === 'action' || question.type === 'legal') {
    try {
      state = buildSpotState(question.spot);
    } catch (error) {
      stateError = error;
    }
  }

  const player = {
    root,
    question,
    options,
    state,
    stateError,
    answered: false,
    grade: null,
    response: null,
    hintsUsed: 0,
    demoRevealed: mode !== 'demo',
    selectedCards: new Set(),
    selectedOptions: [],
    numericValue: '',
    compareChoice: null,
    answerMeta: null,
    options
  };

  const render = () => {
    clear(root);
    root.appendChild(renderHeader(question, { mode }));
    root.appendChild(renderPrompt(question));

    if (stateError) {
      root.appendChild(
        h(
          'div',
          { className: 'error-box' },
          '这个局面暂时无法加载：',
          stateError.message,
          ' 请报告内容问题。'
        )
      );
      return;
    }

    if (question.type === 'action' || question.type === 'legal') {
      root.appendChild(
        renderSpot(state, {
          showLog: true,
          note: question.spot.note,
          logOpen: false
        })
      );
      const rangeEl = renderRangeAssumption(question.spot.villainRange);
      if (rangeEl) root.appendChild(rangeEl);
    }

    if (mode === 'demo' && !player.demoRevealed) {
      if (question.type === 'best-five') {
        root.appendChild(
          h(
            'div',
            { className: 'demo-preview' },
            h(
              'div',
              { className: 'card-group' },
              h('div', { className: 'card-group-label' }, '你的底牌'),
              cardRow(question.cards.hero)
            ),
            h(
              'div',
              { className: 'card-group' },
              h('div', { className: 'card-group-label' }, '公共牌'),
              cardRow(question.cards.board)
            )
          )
        );
      } else if (question.type === 'compare') {
        root.appendChild(
          h(
            'div',
            { className: 'demo-preview' },
            h(
              'div',
              { className: 'card-group' },
              h('div', { className: 'card-group-label' }, '公共牌'),
              cardRow(question.compare.board)
            ),
            h(
              'div',
              { className: 'compare-preview-hands' },
              h(
                'div',
                { className: 'card-group' },
                h('div', { className: 'card-group-label' }, question.compare.A.name),
                cardRow(question.compare.A.hole)
              ),
              h(
                'div',
                { className: 'card-group' },
                h('div', { className: 'card-group-label' }, question.compare.B.name),
                cardRow(question.compare.B.hole)
              )
            )
          )
        );
      }
      root.appendChild(
        h(
          'div',
          { className: 'demo-start' },
          h('p', {}, '示范模式会先展示一个推荐动作与理由。你也可以在揭示后自己点选，看看反馈是否一致。'),
          h(
            'button',
            {
              type: 'button',
              className: 'btn btn-primary',
              onClick: () => {
                player.demoRevealed = true;
                player.hintsUsed = 3;
                render();
              }
            },
            '查看示范'
          )
        )
      );
      return;
    }

    if (mode === 'demo' && player.demoRevealed && !player.answered) {
      root.appendChild(renderDemoAnswer(question));
    }

    if (!player.answered) {
      if (options.showHints !== false) {
        root.appendChild(
          renderHints(
            question.hints,
            player.hintsUsed,
            (level) => {
              player.hintsUsed = Math.max(player.hintsUsed, level);
              render();
            },
            { locked: mode === 'demo' && player.demoRevealed }
          )
        );
      }

      if (question.type === 'action') {
        const panel = renderActionPanel(state, {
          seat: state.actor,
          onSubmit: (response) => submit(response)
        });
        if (panel) root.appendChild(panel);
      } else if (question.type === 'legal') {
        root.appendChild(
          renderLegalPicker(state, player.selectedOptions, (id) => {
            player.selectedOptions = player.selectedOptions.includes(id)
              ? player.selectedOptions.filter((v) => v !== id)
              : [...player.selectedOptions, id];
            render();
          })
        );
        root.appendChild(submitRow('提交合法操作', player.selectedOptions.length > 0, () =>
          submit([...player.selectedOptions])
        ));
      } else if (question.type === 'best-five') {
        root.appendChild(
          renderSelectableBestFive(question, player.selectedCards, (card) => {
            if (player.selectedCards.has(card)) player.selectedCards.delete(card);
            else if (player.selectedCards.size < 5) player.selectedCards.add(card);
            else toast('已选满 5 张；先取消一张再换牌。', 'info');
            render();
          })
        );
        root.appendChild(
          submitRow('提交最佳五张', player.selectedCards.size === 5, () =>
            submit([...player.selectedCards])
          )
        );
      } else if (question.type === 'compare') {
        root.appendChild(
          renderComparePicker(question, player.compareChoice, (value) => {
            player.compareChoice = value;
            render();
          })
        );
        root.appendChild(submitRow('提交比较结果', Boolean(player.compareChoice), () =>
          submit(player.compareChoice)
        ));
      } else if (question.type === 'numeric') {
        root.appendChild(
          renderNumericInput(question, player.numericValue, (value) => {
            player.numericValue = value;
            const btn = root.querySelector('.submit-row .btn');
            if (btn) btn.disabled = value.trim() === '';
          })
        );
        root.appendChild(
          submitRow('提交计算', player.numericValue.trim() !== '', () => submit(player.numericValue))
        );
      } else if (question.type === 'choice') {
        const multi = Array.isArray(question.correct) && question.correct.length > 1;
        root.appendChild(
          renderChoicePicker(question, player.selectedOptions, (id) => {
            if (multi) {
              player.selectedOptions = player.selectedOptions.includes(id)
                ? player.selectedOptions.filter((v) => v !== id)
                : [...player.selectedOptions, id];
            } else {
              player.selectedOptions = [id];
            }
            render();
          })
        );
        root.appendChild(
          submitRow('提交判断', player.selectedOptions.length > 0, () => submit([...player.selectedOptions]))
        );
      }
    } else {
      root.appendChild(renderFeedback(player));
    }
  };

  const submit = (response) => {
    if (player.answered) return;
    let grade;
    try {
      grade = gradeResponse(question, response);
    } catch (error) {
      toast(`评分失败：${error.message}`, 'error');
      return;
    }
    player.response = response;
    player.grade = grade;
    player.answered = true;
    if (typeof options.onAnswered === 'function') {
      try {
        player.answerMeta = options.onAnswered({
          question,
          response,
          grade,
          hintsUsed: player.hintsUsed
        });
      } catch (error) {
        toast(`记录失败：${error.message}`, 'error');
      }
    }
    render();
    setTimeout(() => {
      const feedback = root.querySelector('.feedback');
      if (feedback) feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  };

  player.reset = () => {
    player.answered = false;
    player.grade = null;
    player.response = null;
    player.answerMeta = null;
    player.hintsUsed = 0;
    player.demoRevealed = mode !== 'demo';
    player.selectedCards = new Set();
    player.selectedOptions = [];
    player.numericValue = '';
    player.compareChoice = null;
    render();
  };

  player.render = render;
  render();
  return player;
}

function submitRow(label, enabled, onClick) {
  return h(
    'div',
    { className: 'submit-row' },
    h(
      'button',
      {
        type: 'button',
        className: 'btn btn-primary',
        disabled: !enabled,
        onClick
      },
      label
    )
  );
}
