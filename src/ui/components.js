import {
  cardLabel,
  cardAriaLabel,
  formatBB,
  parseCard,
  SUIT_META
} from '../engine/cards.js';
import { POSITION_ORDER, getLegalActions } from '../engine/table.js';
import { GLOSSARY_MAP } from '../content/glossary.js';
import { TAGS } from '../content/tags.js';
import {
  h,
  append,
  clear,
  richText,
  openModal,
  difficultyStars,
  formatDate
} from './dom.js';

export function cardEl(code, options = {}) {
  const {
    hidden = false,
    small = false,
    selected = false,
    muted = false,
    disabled = false,
    onClick = null,
    label = null
  } = options;

  const className = [
    'playing-card',
    small ? 'card-small' : '',
    selected ? 'is-selected' : '',
    muted ? 'is-muted' : '',
    hidden ? 'card-back' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const attrs = {
    className,
    'aria-label': hidden ? '对手暗牌' : cardAriaLabel(code),
    'aria-pressed': onClick ? String(selected) : undefined,
    type: onClick ? 'button' : undefined,
    disabled: onClick ? disabled : undefined
  };
  if (onClick) attrs.onClick = onClick;

  if (hidden) {
    return h('div', attrs, h('span', { className: 'card-back-mark', 'aria-hidden': 'true' }, '♠'));
  }

  const parsed = parseCard(code);
  const suit = SUIT_META[parsed.suit];
  return h(
    'div',
    attrs,
    h('span', { className: 'card-rank' }, parsed.rank === 'T' ? '10' : parsed.rank),
    h('span', { className: `card-suit suit-${suit.color}`, 'aria-hidden': 'true' }, suit.symbol),
    small ? null : h('span', { className: 'card-corner', 'aria-hidden': 'true' }, suit.symbol)
  );
}

export function cardRow(cards, options = {}) {
  return h(
    'div',
    { className: `card-row ${options.className || ''}` },
    cards.map((card, index) =>
      cardEl(card, {
        ...options,
        onClick: options.onCardClick ? () => options.onCardClick(card, index) : null,
        selected: options.isSelected ? options.isSelected(card) : false
      })
    )
  );
}

export function renderTagChips(tags = [], options = {}) {
  return h(
    'div',
    { className: 'tag-row' },
    tags.map((id) => {
      const meta = TAGS[id];
      return h(
        'span',
        { className: `tag-chip tag-${meta?.group || 'misc'}`, title: options.title || '' },
        meta?.name || id
      );
    })
  );
}

export function renderSource(source) {
  if (!source) return null;
  return h(
    'div',
    { className: 'source-note' },
    h('span', { className: 'source-label' }, '依据与边界'),
    h('p', {}, source)
  );
}

export function openGlossary(termId) {
  const term = GLOSSARY_MAP[termId];
  if (!term) return;
  const content = h(
    'div',
    { className: 'glossary-modal' },
    h('div', { className: 'glossary-en' }, term.en),
    h('p', { className: 'glossary-def' }, term.definition),
    h(
      'div',
      { className: 'glossary-example' },
      h('span', { className: 'label' }, '例子'),
      h('p', {}, term.example)
    ),
    h(
      'p',
      { className: 'muted small' },
      '术语会在课程与反馈中反复出现；理解含义比记住英文缩写更重要。'
    )
  );
  openModal({ title: term.term, content });
}

function positionOfState(state, seat) {
  return POSITION_ORDER[(seat - state.button + 6) % 6];
}

function streetLabel(street) {
  return {
    preflop: '翻牌前',
    flop: '翻牌',
    turn: '转牌',
    river: '河牌',
    complete: '本手结束',
    idle: '等待发牌'
  }[street] || street;
}

function seatStatus(player, state) {
  if (player.folded) return '已弃牌';
  if (player.allIn) return '已全下';
  if (state.actor === player.seat) return '行动中';
  return '';
}

export function renderTable(state, options = {}) {
  const heroSeat =
    options.heroSeat ??
    state.seats.find((p) => p.isHuman)?.seat ??
    state.actor ??
    0;
  const revealAll = options.revealAll === true;
  const revealSeats = new Set(options.revealSeats || []);
  const table = h('div', { className: 'poker-table', role: 'group', 'aria-label': '牌桌状态' });

  const centerPot = state.result ? state.result.totalPot : state.pot;
  const centerToCall = state.result ? 0 : state.currentBet - (state.seats[heroSeat]?.streetBet || 0);

  const center = h(
    'div',
    { className: 'table-center' },
    h('div', { className: 'street-badge' }, streetLabel(state.street)),
    h(
      'div',
      { className: 'board-cards', 'aria-label': '公共牌' },
      Array.from({ length: 5 }).map((_, i) =>
        state.board[i]
          ? cardEl(state.board[i], { small: state.board.length > 3 })
          : h('div', { className: 'card-placeholder', 'aria-hidden': 'true' })
      )
    ),
    h(
      'div',
      { className: 'pot-line' },
      h('span', {}, '底池'),
      h('strong', {}, `${formatBB(centerPot)} BB`)
    ),
    centerToCall > 0
      ? h('div', { className: 'to-call-line' }, `待跟注 ${formatBB(centerToCall)} BB`)
      : h('div', { className: 'to-call-line muted' }, state.result ? '本手已结束' : '无人下注')
  );

  const seats = state.seats.map((player) => {
    const rel = (player.seat - heroSeat + 6) % 6;
    const pos = positionOfState(state, player.seat);
    const isHero = player.seat === heroSeat;
    const showCards = revealAll || isHero || revealSeats.has(player.seat);
    const hasHole = player.hole && player.hole.length === 2 && player.hole[0] !== 'back';
    const hole = showCards && hasHole
      ? cardRow(player.hole, { small: true })
      : !player.folded
        ? cardRow(['back', 'back'], { small: true, hidden: true })
        : null;
    const classes = [
      'seat',
      `seat-slot-${rel}`,
      isHero ? 'seat-hero' : '',
      player.folded ? 'seat-folded' : '',
      player.allIn ? 'seat-allin' : '',
      state.actor === player.seat ? 'seat-active' : ''
    ]
      .filter(Boolean)
      .join(' ');

    return h(
      'div',
      { className: classes, dataset: { seat: player.seat } },
      h(
        'div',
        { className: 'seat-head' },
        h('span', { className: `pos-badge pos-${pos.toLowerCase()}` }, pos),
        player.name && player.name !== pos
          ? h('span', { className: 'seat-name' }, player.name)
          : null,
        pos === 'BTN' ? h('span', { className: 'dealer-chip', title: '庄位' }, 'D') : null
      ),
      hole,
      h(
        'div',
        { className: 'seat-stack' },
        h('strong', {}, `${formatBB(player.stack)} BB`),
        player.streetBet > 0
          ? h('span', { className: 'seat-bet' }, `本轮 ${formatBB(player.streetBet)}`)
          : null
      ),
      h(
        'div',
        { className: 'seat-status' },
        seatStatus(player, state) || (player.lastAction || ''),
        player.allIn ? h('span', { className: 'badge badge-allin' }, 'ALL-IN') : null
      )
    );
  });

  table.appendChild(center);
  for (const seat of seats) table.appendChild(seat);
  return table;
}

function eventActionLabel(event) {
  const action = event.action || event;
  const b = (n) => `${formatBB(n)} BB`;
  switch (action.type) {
    case 'post':
      return `${event.label || '盲注'} ${b(action.amount ?? 0)}`;
    case 'fold':
      return '弃牌';
    case 'check':
      return '过牌';
    case 'call':
      return action.amount != null ? `跟注 ${b(action.amount)}` : '跟注';
    case 'bet':
      return `下注 ${b(action.to ?? action.amount ?? 0)}`;
    case 'raise':
      return `加注到 ${b(action.to ?? action.amount ?? 0)}`;
    case 'allin':
      return '全下';
    default:
      return event.label || action.type || '';
  }
}

export function renderLog(events = [], options = {}) {
  if (!events.length) {
    return h('p', { className: 'muted small' }, '还没有行动记录。');
  }
  const rows = [];
  let lastStreet = null;
  for (const event of events) {
    if (event.type === 'street') {
      rows.push(
        h(
          'div',
          { className: 'log-street' },
          h('span', {}, streetLabel(event.street)),
          h('span', { className: 'log-board' }, (event.board || []).map(cardLabel).join(' '))
        )
      );
      lastStreet = event.street;
      continue;
    }
    if (event.type === 'end') continue;
    if (event.type === 'action' || event.type === 'post') {
      if (event.street && event.street !== lastStreet) {
        rows.push(h('div', { className: 'log-street' }, streetLabel(event.street)));
        lastStreet = event.street;
      }
      rows.push(
        h(
          'div',
          { className: 'log-row' },
          h('span', { className: 'log-pos' }, event.pos || ''),
          h('span', { className: 'log-name' }, event.name && event.name !== event.pos ? event.name : ''),
          h('span', { className: 'log-action' }, eventActionLabel(event)),
          h('span', { className: 'log-pot' }, event.potAfter != null ? `底池 ${formatBB(event.potAfter)}` : '')
        )
      );
    }
  }
  return h(
    'details',
    { className: 'action-log', open: options.open ? true : undefined },
    h('summary', {}, `完整行动记录（${rows.length}）`),
    h('div', { className: 'log-body' }, rows)
  );
}

export function effectiveStack(state, heroSeat) {
  const hero = state.seats[heroSeat];
  const heroStack = hero?.stack || 0;
  const others = state.seats.filter((p) => p.seat !== heroSeat && !p.folded);
  if (!others.length) return heroStack;
  return Math.min(heroStack, Math.max(...others.map((p) => p.stack)));
}

export function renderSpotMeta(state, options = {}) {
  const heroSeat =
    options.heroSeat ??
    state.seats.find((p) => p.isHuman)?.seat ??
    state.actor ??
    0;
  const hero = state.seats[heroSeat];
  const active = state.seats.filter((p) => !p.folded);
  const pos = positionOfState(state, heroSeat);
  const actorSeat = state.actor;
  const actorPos = actorSeat != null ? positionOfState(state, actorSeat) : null;
  const toCall = state.result ? 0 : Math.max(0, state.currentBet - hero.streetBet);
  const eff = effectiveStack(state, heroSeat);
  const canActSeats = state.seats
    .filter((p) => !p.folded && !p.allIn && p.stack > 0)
    .map((p) => p.seat);
  let order = [];
  if (!state.result && actorSeat != null) {
    for (let offset = 0; offset < 6; offset++) {
      const seat = (actorSeat + offset) % 6;
      if (canActSeats.includes(seat)) order.push(positionOfState(state, seat));
    }
  }
  return h(
    'div',
    { className: 'spot-meta-block' },
    h(
      'div',
      { className: 'spot-meta' },
      h(
        'div',
        { className: 'meta-cell' },
        h('span', {}, '你的位置'),
        h('strong', {}, pos)
      ),
      h(
        'div',
        { className: 'meta-cell' },
        h('span', {}, '在局人数'),
        h('strong', {}, `${active.length} 人`)
      ),
      h(
        'div',
        { className: 'meta-cell' },
        h('span', {}, '有效筹码'),
        h('strong', {}, `${formatBB(eff)} BB`)
      ),
      h(
        'div',
        { className: 'meta-cell' },
        h('span', {}, '当前行动'),
        h('strong', {}, actorPos || '—')
      ),
      h(
        'div',
        { className: 'meta-cell' },
        h('span', {}, '底池 / 待跟注'),
        h('strong', {}, `${formatBB(state.result ? state.result.totalPot : state.pot)} / ${formatBB(toCall)} BB`)
      )
    ),
    h(
      'div',
      { className: 'meta-order' },
      state.result
        ? '本手已结束。'
        : order.length
          ? `在局位置顺序（从当前行动者起）：${order.join(' → ')}`
          : '当前没有可继续行动的玩家。'
    )
  );
}

export function renderSpot(state, options = {}) {
  const heroSeat =
    options.heroSeat ??
    state.seats.find((p) => p.isHuman)?.seat ??
    state.actor ??
    0;
  return h(
    'div',
    { className: 'spot' },
    h(
      'div',
      { className: 'table-wrap' },
      renderTable(state, { ...options, heroSeat })
    ),
    renderSpotMeta(state, { ...options, heroSeat }),
    options.showLog === false ? null : renderLog(options.log || state.events || [], { open: options.logOpen }),
    options.note ? h('p', { className: 'spot-note' }, options.note) : null
  );
}

export function renderHints(hints, revealed, onReveal, options = {}) {
  const total = Math.min(3, (hints || []).length);
  return h(
    'div',
    { className: 'hint-box' },
    h(
      'div',
      { className: 'hint-head' },
      h('span', { className: 'hint-title' }, '分级提示'),
      h(
        'span',
        { className: 'muted small' },
        options.locked ? '示范模式显示全部提示' : `已使用 ${Math.min(revealed, total)}/${total} 级`
      )
    ),
    h(
      'div',
      { className: 'hint-list' },
      (hints || []).slice(0, total).map((hint, index) => {
        const unlocked = options.locked || index < revealed;
        return unlocked
          ? h(
              'div',
              { className: 'hint-item revealed' },
              h('span', { className: 'hint-level' }, `提示 ${index + 1}`),
              h('p', {}, hint)
            )
          : h(
              'button',
              {
                type: 'button',
                className: 'hint-item hint-locked',
                onClick: () => onReveal(index + 1)
              },
              h('span', { className: 'hint-level' }, `提示 ${index + 1}`),
              h('span', { className: 'hint-peek' }, '点击查看')
            );
      })
    ),
    options.locked
      ? null
      : h(
          'p',
          { className: 'hint-foot' },
          '提示使用会记录在学习进度中；先独立作答，再逐级查看。'
        )
  );
}

export function renderPresets(legal, kind, state, onPick) {
  const hero = state.seats[state.actor];
  const toCall = legal.toCall || 0;
  const potAfterCall = state.pot + toCall;
  const option = legal.actions.find((a) => a.type === kind);
  if (!option) return [];
  const min = kind === 'bet' ? option.min : option.minTo;
  const max = kind === 'bet' ? option.max : option.maxTo;
  const targets = [];
  if (kind === 'bet') {
    targets.push({ label: '1/2 池', value: state.pot * 0.5 });
    targets.push({ label: '3/4 池', value: state.pot * 0.75 });
    targets.push({ label: '满池', value: state.pot });
  } else {
    targets.push({ label: '1/2 池', value: state.currentBet + potAfterCall * 0.5 });
    targets.push({ label: '3/4 池', value: state.currentBet + potAfterCall * 0.75 });
    targets.push({ label: '满池', value: state.currentBet + potAfterCall });
  }
  targets.push({ label: '最小', value: min });
  targets.push({ label: '全下', value: max });
  const seen = new Set();
  return targets
    .map((t) => ({ ...t, value: Math.max(min, Math.min(max, Math.round(t.value))) }))
    .filter((t) => {
      if (seen.has(t.value)) return false;
      seen.add(t.value);
      return true;
    })
    .map((t) =>
      h(
        'button',
        {
          type: 'button',
          className: 'preset-btn',
          onClick: () => onPick(t.value)
        },
        `${t.label} · ${formatBB(t.value)}`
      )
    );
}

/**
 * 行动面板：只展示引擎计算出的合法操作；加注区分“加到”与“额外投入”。
 */
export function renderActionPanel(state, options = {}) {
  const seat = options.seat ?? state.actor;
  if (seat == null) return null;
  const legal = getLegalActions(state, seat);
  if (!legal.actions.length) return null;
  const player = state.seats[seat];
  const callOption = legal.actions.find((a) => a.type === 'call');
  const betOption = legal.actions.find((a) => a.type === 'bet');
  const raiseOption = legal.actions.find((a) => a.type === 'raise');
  const aggressive = betOption || raiseOption;
  const kind = betOption ? 'bet' : raiseOption ? 'raise' : null;
  const allIn = legal.allIn;
  let stagedTo = aggressive
    ? kind === 'bet'
      ? Math.max(aggressive.min, Math.min(aggressive.max, Math.round(state.pot * 0.5)))
      : Math.max(aggressive.minTo, Math.min(aggressive.maxTo, Math.round(state.currentBet + (state.pot + legal.toCall) * 0.5)))
    : null;

  const wrap = h('div', { className: 'action-panel' });
  const meta = h(
    'div',
    { className: 'action-meta' },
    h('span', {}, `底池 ${formatBB(state.pot)} BB`),
    h('span', {}, legal.toCall > 0 ? `待跟注 ${formatBB(legal.toCall)} BB` : '无人下注'),
    h('span', {}, `后手 ${formatBB(player.stack)} BB`)
  );
  wrap.appendChild(meta);

  const buttons = h('div', { className: 'action-buttons' });
  buttons.appendChild(
    h(
      'button',
      {
        type: 'button',
        className: 'btn btn-danger',
        onClick: () => options.onSubmit({ type: 'fold' })
      },
      '弃牌'
    )
  );
  if (legal.actions.some((a) => a.type === 'check')) {
    buttons.appendChild(
      h(
        'button',
        {
          type: 'button',
          className: 'btn btn-secondary',
          onClick: () => options.onSubmit({ type: 'check' })
        },
        '过牌'
      )
    );
  }
  if (callOption) {
    const callLabel =
      callOption.amount >= player.stack
        ? `跟注全下 ${formatBB(callOption.amount)} BB`
        : `跟注 ${formatBB(callOption.amount)} BB`;
    buttons.appendChild(
      h(
        'button',
        {
          type: 'button',
          className: 'btn btn-secondary',
          onClick: () => options.onSubmit({ type: 'call' })
        },
        callLabel
      )
    );
  }
  if (aggressive) {
    buttons.appendChild(
      h(
        'button',
        {
          type: 'button',
          className: 'btn btn-primary',
          onClick: () => {
            editor.hidden = false;
            editor.querySelector('input[type="range"]')?.focus();
          }
        },
        kind === 'bet' ? '下注' : '加注'
      )
    );
  }
  if (allIn && allIn.type !== 'call' && !(aggressive && allIn.to === (kind === 'bet' ? aggressive.max : aggressive.maxTo))) {
    const target = allIn.to;
    buttons.appendChild(
      h(
        'button',
        {
          type: 'button',
          className: 'btn btn-outline',
          onClick: () =>
            options.onSubmit({
              type: allIn.type,
              to: target
            })
        },
        allIn.type === 'bet' ? '全下下注' : '全下加注'
      )
    );
  }
  wrap.appendChild(buttons);

  const editor = h('div', { className: 'raise-editor', hidden: true });
  if (aggressive) {
    const min = kind === 'bet' ? aggressive.min : aggressive.minTo;
    const max = kind === 'bet' ? aggressive.max : aggressive.maxTo;
    const slider = h('input', {
      type: 'range',
      min: String(min),
      max: String(max),
      step: '1',
      value: String(stagedTo),
      className: 'raise-slider',
      'aria-label': kind === 'bet' ? '下注金额' : '加注到金额'
    });
    const number = h('input', {
      type: 'number',
      min: String(min),
      max: String(max),
      step: '1',
      value: String(stagedTo),
      className: 'raise-number',
      'aria-label': kind === 'bet' ? '下注筹码' : '加注到筹码'
    });
    const summary = h('div', { className: 'raise-summary' });
    const update = (value) => {
      const v = Math.max(min, Math.min(max, Math.round(Number(value) || min)));
      stagedTo = v;
      slider.value = String(v);
      number.value = String(v);
      const additional = kind === 'bet' ? v : v - player.streetBet;
      clear(summary);
      append(
        summary,
        h('strong', {}, `${kind === 'bet' ? '下注' : '加注到'} ${formatBB(v)} BB`),
        h('span', {}, `（额外投入 ${formatBB(additional)} BB）`),
        v === max ? h('span', { className: 'badge badge-allin' }, '全下') : null
      );
    };
    slider.addEventListener('input', () => update(slider.value));
    number.addEventListener('input', () => update(number.value));
    const presets = h(
      'div',
      { className: 'preset-row' },
      renderPresets(legal, kind, state, (value) => update(value))
    );
    const confirm = h(
      'button',
      {
        type: 'button',
        className: 'btn btn-primary',
        onClick: () => options.onSubmit({ type: kind, to: stagedTo })
      },
      kind === 'bet' ? '确认下注' : '确认加注'
    );
    editor.appendChild(
      h(
        'div',
        { className: 'editor-head' },
        h('span', {}, kind === 'bet' ? '下注尺度' : '加注尺度'),
        h('span', { className: 'muted small' }, kind === 'bet' ? '本轮总投入' : '本轮最终总投入，不是额外金额')
      )
    );
    editor.appendChild(presets);
    editor.appendChild(
      h(
        'div',
        { className: 'slider-row' },
        slider,
        h('div', { className: 'number-wrap' }, number, h('span', {}, '枚')),
        confirm
      )
    );
    editor.appendChild(summary);
    if (aggressive.shortAllIn) {
      editor.appendChild(
        h('p', { className: 'muted small' }, '你的后手不足一次完整加注，只能全下或选择其他合法操作。')
      );
    }
    update(stagedTo);
    wrap.appendChild(editor);
  }

  return wrap;
}

export function renderGlossaryList(filter = '') {
  const q = filter.trim().toLowerCase();
  const entries = Object.values(GLOSSARY_MAP).filter((entry) => {
    if (!q) return true;
    return (
      entry.term.toLowerCase().includes(q) ||
      entry.en.toLowerCase().includes(q) ||
      entry.definition.toLowerCase().includes(q)
    );
  });
  return h(
    'div',
    { className: 'glossary-grid' },
    entries.map((entry) =>
      h(
        'article',
        { className: 'glossary-card', dataset: { glossary: entry.id } },
        h('div', { className: 'glossary-card-head' }, h('h3', {}, entry.term), h('span', {}, entry.en)),
        h('p', {}, entry.definition),
        h('div', { className: 'glossary-example small' }, h('span', { className: 'label' }, '例子'), entry.example)
      )
    )
  );
}
