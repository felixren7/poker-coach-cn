import { POSITION_ORDER } from '../engine/table.js';
import { cardLabel, formatBB } from '../engine/cards.js';
import { describeBest, describeStartingHand } from '../engine/handEval.js';
import { responseLabel } from '../training/scenario.js';
import {
  reconstructDecisions,
  decisionPublicView,
  compareToBaseline
} from '../training/replay.js';
import { coachDecision } from '../engine/strategy.js';
import { getSimHistory, getActiveSim } from '../state/store.js';
import {
  cardRow,
  renderActionPanel,
  renderLog,
  renderSpot
} from '../ui/components.js';
import { h, clear, append, emptyState, formatDate, relativeTime } from '../ui/dom.js';

function heroPosition(record) {
  const seat = record.humanSeat;
  const button = record.initial?.button ?? 0;
  return POSITION_ORDER[(seat - button + 6) % 6];
}

function netOf(record) {
  return record.result?.net?.find((n) => n.seat === record.humanSeat)?.net || 0;
}

function renderHandList() {
  const history = getSimHistory();
  const active = getActiveSim();
  return h(
    'div',
    { className: 'view review-view' },
    h(
      'header',
      { className: 'page-head' },
      h(
        'div',
        {},
        h('p', { className: 'eyebrow' }, '复盘'),
        h('h1', {}, '把“当时可知”和“后来揭晓”分开'),
        h(
          'p',
          { className: 'page-lead' },
          '每手模拟牌局都保存完整行动与公共牌。复盘时先还原决策时的信息、范围与赔率，再单独查看结果；不能因为最终发牌而反推决策好坏。'
        )
      ),
      h(
        'div',
        { className: 'page-head-actions' },
        h('a', { className: 'btn btn-primary', href: '#/play' }, '继续模拟牌局'),
        active ? h('a', { className: 'btn btn-secondary', href: '#/play' }, '恢复未完成手牌') : null
      )
    ),
    active
      ? h(
          'div',
          { className: 'resume-banner' },
          h('strong', {}, '有一手牌尚未结束'),
          h('span', {}, '返回模拟牌桌继续；当前行动与筹码已保存在本地。'),
          h('a', { className: 'btn btn-secondary btn-sm', href: '#/play' }, '继续这手牌')
        )
      : null,
    history.length
      ? h(
          'div',
          { className: 'hand-history-list' },
          history.map((record) => {
            const net = netOf(record);
            const board = record.result?.board || [];
            const pos = heroPosition(record);
            const actionCount = record.actions?.length || 0;
            return h(
              'a',
              { className: 'hand-history-item', href: `#/review?hand=${encodeURIComponent(record.id)}` },
              h(
                'div',
                { className: 'hand-history-main' },
                h(
                  'div',
                  { className: 'hand-history-title' },
                  h('strong', {}, `${pos} · ${record.difficulty ? record.difficulty.toUpperCase() : 'NORMAL'}`),
                  h('span', { className: `net-badge ${net > 0 ? 'is-win' : net < 0 ? 'is-loss' : ''}` }, `${net > 0 ? '+' : ''}${formatBB(net)} BB`)
                ),
                h(
                  'div',
                  { className: 'hand-history-meta' },
                  h('span', {}, formatDate(record.startedAt)),
                  h('span', {}, `${actionCount} 个行动`),
                  h('span', {}, record.result?.type === 'showdown' ? '摊牌' : '弃牌结束')
                ),
                h(
                  'div',
                  { className: 'hand-history-board' },
                  board.length ? board.map(cardLabel).join(' ') : '翻牌前结束'
                )
              ),
              h('span', { className: 'text-link' }, '查看复盘 →')
            );
          })
        )
      : emptyState(
          '还没有已完成的模拟手牌',
          '完成至少一手模拟牌局后，这里会保存逐街行动、关键决策与结果。',
          h('a', { className: 'btn btn-primary', href: '#/play' }, '开始模拟牌局')
        ),
    h(
      'div',
      { className: 'callout callout-info' },
      h('strong', {}, '复盘的正确顺序'),
      h(
        'p',
        {},
        '先还原决策时的位置、筹码、底池、待跟注、行动历史与公共牌；再检查范围假设与合法操作；最后才看摊牌结果。'
      )
    )
  );
}

function handDescription(view, seat) {
  const hero = view.seats[seat];
  if (!hero || hero.hole.length !== 2) return '—';
  if (view.board.length >= 3) {
    return describeBest([...hero.hole, ...view.board]).fullName;
  }
  return describeStartingHand(hero.hole).text;
}

function renderRedo(view, seat, original) {
  const wrap = h('div', { className: 'redo-wrap' });
  const panelHost = h('div', { className: 'redo-panel' });
  wrap.appendChild(
    h(
      'div',
      { className: 'redo-note' },
      h('strong', {}, '重做关键决策'),
      h('span', {}, '只显示当时可知信息；不会模拟后续发牌，也不读取对手暗牌。')
    )
  );
  wrap.appendChild(
    renderSpot(view, {
      heroSeat: seat,
      showLog: true,
      logOpen: false
    })
  );
  wrap.appendChild(panelHost);

  const showPanel = () => {
    clear(panelHost);
    const panel = renderActionPanel(view, {
      seat,
      onSubmit: (action) => {
        const comparison = compareToBaseline(view, seat, action);
        const originalComparison = compareToBaseline(view, seat, original);
        clear(panelHost);
        panelHost.appendChild(
          h(
            'div',
            { className: `redo-result tone-${comparison.kind === 'match' ? 'good' : comparison.kind === 'size' ? 'warn' : 'bad'}` },
            h('h4', {}, comparison.label),
            h(
              'div',
              { className: 'redo-choices' },
              h('div', {}, h('span', {}, '你的重做'), h('strong', {}, responseLabel(action))),
              h(
                'div',
                {},
                h('span', {}, '教学基线'),
                h('strong', {}, comparison.baseline?.label || '—')
              ),
              h('div', {}, h('span', {}, '原始选择'), h('strong', {}, responseLabel(original))),
              h(
                'div',
                {},
                h('span', {}, '原始选择与基线'),
                h('strong', {}, originalComparison.label)
              )
            ),
            h('p', {}, comparison.detail),
            comparison.baseline
              ? h(
                  'div',
                  { className: 'baseline-box' },
                  h('h5', {}, '教学基线理由'),
                  h('ul', {}, comparison.baseline.reasons.map((r) => h('li', {}, r))),
                  h('p', { className: 'muted small' }, comparison.baseline.assumptions)
                )
              : null,
            h(
              'div',
              { className: 'page-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'btn btn-secondary btn-sm',
                  onClick: showPanel
                },
                '再重做一次'
              )
            )
          )
        );
      }
    });
    if (panel) panelHost.appendChild(panel);
    else panelHost.appendChild(h('p', { className: 'muted' }, '当前局面没有可用的行动面板。'));
  };
  showPanel();
  return wrap;
}

function renderDecision(decision, record) {
  const view = decisionPublicView(decision.snapshot, record.humanSeat);
  const hero = view.seats[record.humanSeat];
  const toCall = Math.max(0, view.currentBet - hero.streetBet);
  const baseline = coachDecision(view, record.humanSeat);
  const comparison = compareToBaseline(view, record.humanSeat, decision.chosen);
  const board = view.board;
  return h(
    'article',
    { className: 'decision-card' },
    h(
      'div',
      { className: 'decision-head' },
      h(
        'div',
        {},
        h('span', { className: 'eyebrow' }, `${decision.street || view.street} · 决策 ${decision.index + 1}`),
        h('h3', {}, hero ? hero.name : '你'),
        h('span', { className: 'muted small' }, handDescription(view, record.humanSeat))
      ),
      h('span', { className: 'known-badge' }, '当时可知')
    ),
    h(
      'div',
      { className: 'decision-meta' },
      h('span', {}, `位置 ${hero ? POSITION_ORDER[(hero.seat - view.button + 6) % 6] : '—'}`),
      h('span', {}, `底池 ${formatBB(view.pot)} BB`),
      h('span', {}, `待跟注 ${formatBB(toCall)} BB`),
      h('span', {}, `后手 ${formatBB(hero?.stack || 0)} BB`),
      h('span', {}, `公共牌 ${board.length ? board.map(cardLabel).join(' ') : '无'}`)
    ),
    h(
      'div',
      { className: 'decision-hand' },
      hero ? cardRow(hero.hole, { small: true }) : null,
      h('span', { className: 'decision-chosen' }, h('span', {}, '原始选择'), h('strong', {}, responseLabel(decision.chosen))),
      h('span', { className: `decision-compare tone-${comparison.kind === 'match' ? 'good' : comparison.kind === 'size' ? 'warn' : 'bad'}` }, comparison.label)
    ),
    h(
      'details',
      { className: 'baseline-details' },
      h('summary', {}, '查看教学基线（非 solver）'),
      baseline
        ? h(
            'div',
            { className: 'baseline-box' },
            h('p', {}, h('strong', {}, `动作：${baseline.label}`)),
            h('ul', {}, baseline.reasons.map((r) => h('li', {}, r))),
            h('p', { className: 'muted small' }, baseline.assumptions)
          )
        : h('p', { className: 'muted' }, '这个局面没有可用基线。')
    ),
    h(
      'details',
      { className: 'redo-details' },
      h('summary', {}, '重做这个决策'),
      renderRedo(view, record.humanSeat, decision.chosen)
    )
  );
}

function renderHandDetail(record) {
  const reconstructed = reconstructDecisions(record);
  const net = netOf(record);
  const board = record.result?.board || [];
  const initial = record.initial;
  const result = record.result;
  return h(
    'div',
    { className: 'view review-view review-detail' },
    h(
      'header',
      { className: 'sim-head' },
      h(
        'div',
        {},
        h('a', { href: '#/review', className: 'back-link' }, '← 返回复盘列表'),
        h('p', { className: 'eyebrow' }, `${formatDate(record.startedAt)} · ${heroPosition(record)} · ${record.difficulty || 'normal'}`),
        h('h1', {}, net > 0 ? `本手 +${formatBB(net)} BB` : net < 0 ? `本手 ${formatBB(net)} BB` : '本手打平'),
        h('p', { className: 'page-lead' }, result?.type === 'showdown' ? '本手进入摊牌。' : '本手以弃牌结束。')
      ),
      h(
        'div',
        { className: 'page-head-actions' },
        h('a', { className: 'btn btn-secondary', href: '#/review' }, '复盘列表'),
        h('a', { className: 'btn btn-primary', href: '#/play' }, '再打一手')
      )
    ),
    h(
      'div',
      { className: 'hand-detail-grid' },
      h(
        'section',
        { className: 'hand-result-card' },
        h('div', { className: 'eyebrow' }, '结果信息（事后可知）'),
        h(
          'div',
          { className: 'board-large' },
          board.length ? cardRow(board) : h('span', { className: 'muted' }, '未发公共牌')
        ),
        result
          ? h(
              'div',
              { className: 'result-summary-lines' },
              result.winners.map((w) => h('p', {}, `${w.pos} · ${w.name}：+${formatBB(w.amount)} BB`)),
              result.refunds?.length
                ? h('p', { className: 'muted small' }, `退回未跟注筹码：${result.refunds.map((r) => `${r.pos} +${formatBB(r.amount)}`).join('、')}`)
                : null,
              h('p', { className: 'muted small' }, `总底池 ${formatBB(result.totalPot)} BB`)
            )
          : null,
        h(
          'div',
          { className: 'reveal-block' },
          h('h3', {}, '摊牌 / 事后暗牌'),
          h(
            'p',
            { className: 'muted small' },
            '这些是牌局结束后才能知道的信息；重做决策时不会使用它们。'
          ),
          h(
            'div',
            { className: 'reveal-grid' },
            (initial?.seats || []).map((p) =>
              h(
                'div',
                { className: 'reveal-row' },
                h('span', {}, `${POSITION_ORDER[(p.seat - initial.button + 6) % 6]} · ${p.name}${p.folded ? '（已弃牌）' : ''}`),
                p.hole?.length ? cardRow(p.hole, { small: true }) : null,
                h(
                  'span',
                  { className: 'muted small' },
                  p.hole?.length >= 2 && board.length === 5
                    ? describeBest([...p.hole, ...board]).fullName
                    : ''
                )
              )
            )
          )
        )
      ),
      h(
        'section',
        { className: 'hand-log-card' },
        h('h2', {}, '逐街行动'),
        renderLog(record.events || [], { open: true }),
        reconstructed.error
          ? h('div', { className: 'error-box' }, reconstructed.error)
          : null
      )
    ),
    h(
      'section',
      { className: 'decision-section' },
      h(
        'div',
        { className: 'section-head' },
        h('div', {}, h('p', { className: 'eyebrow' }, '关键决策'), h('h2', {}, '重做时，只使用当时可知的信息')),
        h('span', { className: 'muted small' }, `${reconstructed.decisions.length} 个你的决策`)
      ),
      reconstructed.decisions.length
        ? reconstructed.decisions.map((d) => renderDecision(d, record))
        : emptyState('没有可重做的决策', '这手牌可能在你行动前就结束了。', null)
    ),
    h(
      'div',
      { className: 'callout callout-warn' },
      h('strong', {}, '不要用结果评价决策'),
      h(
        'p',
        {},
        '本手赢了，不代表每个决策都正确；本手输了，也不代表每个决策都错误。复盘只检查当时可知信息、范围假设与赔率。'
      )
    )
  );
}

export function renderReview(params = {}) {
  if (params.hand) {
    const record = getSimHistory().find((h) => h.id === params.hand);
    if (!record) {
      return h(
        'div',
        { className: 'view' },
        h('h1', {}, '找不到这手牌'),
        h('a', { className: 'btn btn-secondary', href: '#/review' }, '返回复盘列表')
      );
    }
    return renderHandDetail(record);
  }
  return renderHandList();
}
