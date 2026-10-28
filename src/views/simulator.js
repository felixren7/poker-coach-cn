import {
  createTable,
  startHand,
  applyAction,
  cloneTable,
  positionOf
} from '../engine/table.js';
import { randomSeed, nextRandom, formatBB, cardLabel } from '../engine/cards.js';
import { describeBest, describeStartingHand } from '../engine/handEval.js';
import { chooseBotAction, DIFFICULTIES } from '../engine/bots.js';
import {
  getActiveSim,
  saveActiveSim,
  clearActiveSim,
  recordSimHand,
  getDifficulty,
  setDifficulty,
  getSimStats,
  getSimHistory
} from '../state/store.js';
import {
  cardRow,
  renderActionPanel,
  renderLog,
  renderSpot
} from '../ui/components.js';
import { h, clear, append, toast, formatDate } from '../ui/dom.js';

let sim = null;
let simRoot = null;

function profile() {
  return DIFFICULTIES[getDifficulty()] || DIFFICULTIES.normal;
}

function saveCurrent() {
  if (!sim) return;
  saveActiveSim({
    table: sim.table,
    initial: sim.initial,
    handId: sim.handId,
    startedAt: sim.startedAt
  });
}

function makeHand(table) {
  const startedAt = Date.now();
  startHand(table);
  const initial = cloneTable(table);
  const handId = `h-${startedAt}-${table.handNumber}`;
  return { table, initial, handId, startedAt, recorded: false, record: null, paused: false };
}

function newTable() {
  const table = createTable({ seed: randomSeed(), humanSeat: 0 });
  return table;
}

function ensureSim() {
  if (sim) return sim;
  const active = getActiveSim();
  if (active?.table && active?.initial && active.table.street !== 'complete') {
    sim = {
      table: active.table,
      initial: active.initial,
      handId: active.handId || `h-${Date.now()}`,
      startedAt: active.startedAt || active.table.startedAt || Date.now(),
      recorded: false,
      record: null,
      paused: false
    };
    return sim;
  }
  const table = newTable();
  sim = makeHand(table);
  saveCurrent();
  return sim;
}

function maybeRebuy() {
  if (!sim) return;
  const busted = sim.table.seats.filter((p) => p.stack <= 0);
  if (!busted.length) return;
  for (const player of busted) {
    player.stack = sim.table.config.startingStack;
  }
  toast(`已为 ${busted.map((p) => p.name).join('、')} 自动补码到 100BB（虚拟筹码）。`, 'info');
}

function startNextHand() {
  if (!sim) return;
  maybeRebuy();
  sim = makeHand(sim.table);
  saveCurrent();
}

function resetTable() {
  clearActiveSim();
  const table = newTable();
  sim = makeHand(table);
  saveCurrent();
}

function recordHand() {
  if (!sim || sim.recorded) return;
  const { table, initial, handId, startedAt } = sim;
  if (table.street !== 'complete' || !table.result) return;
  const record = {
    id: handId,
    startedAt: table.startedAt || startedAt,
    endedAt: table.endedAt || Date.now(),
    humanSeat: 0,
    difficulty: getDifficulty(),
    initial,
    actions: table.history,
    events: table.events,
    result: table.result
  };
  recordSimHand(record);
  clearActiveSim();
  sim.recorded = true;
  sim.record = record;
}

function heroHandDescription(table) {
  const hero = table.seats[0];
  if (!hero || hero.hole.length !== 2) return '';
  if (table.board.length >= 3) {
    const best = describeBest([...hero.hole, ...table.board]);
    return best.fullName;
  }
  return describeStartingHand(hero.hole).text;
}

function difficultySelect(onChange) {
  const select = h(
    'select',
    {
      className: 'inline-select',
      'aria-label': '电脑对手难度',
      onChange: (event) => onChange(event.target.value)
    },
    Object.values(DIFFICULTIES).map((d) =>
      h('option', { value: d.key, selected: d.key === getDifficulty() }, `${d.name}`)
    )
  );
  return select;
}

function renderResult(table, record) {
  const result = table.result;
  if (!result) return null;
  const heroNet = result.net.find((n) => n.seat === 0)?.net || 0;
  const winnerText = result.winners
    .map((w) => `${w.name} 赢得 ${formatBB(w.amount)} BB`)
    .join('；');
  return h(
    'section',
    { className: `result-panel ${heroNet > 0 ? 'win' : heroNet < 0 ? 'loss' : 'push'}` },
    h('p', { className: 'eyebrow' }, result.type === 'showdown' ? '摊牌结果' : '本手结束'),
    h('h2', {}, winnerText || '底池已结算'),
    h(
      'div',
      { className: 'result-net-grid' },
      result.net.map((n) =>
        h(
          'div',
          { className: `net-item ${n.seat === 0 ? 'is-hero' : ''} ${n.net > 0 ? 'is-win' : n.net < 0 ? 'is-loss' : ''}` },
          h('span', {}, `${n.pos} · ${n.name}`),
          h('strong', {}, `${n.net > 0 ? '+' : ''}${formatBB(n.net)} BB`),
          n.seat === 0 ? h('small', {}, '你') : null
        )
      )
    ),
    result.type === 'showdown'
      ? h(
          'div',
          { className: 'result-hands' },
          result.reveals.map((r) =>
            h(
              'div',
              { className: 'result-hand-row' },
              h('span', {}, `${r.pos} · ${r.name}`),
              cardRow(r.hole, { small: true }),
              h('span', { className: 'muted small' }, r.hand?.fullName || '')
            )
          )
        )
      : h('p', { className: 'muted small' }, '对手均弃牌，未摊牌；本手不展示未亮出的暗牌。'),
    h(
      'p',
      { className: 'result-note' },
      '本手输赢不用于评价决策。真正的复盘应还原当时可知信息，检查范围、赔率与备选动作。'
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
            startNextHand();
            refresh();
          }
        },
        '下一手'
      ),
      record
        ? h('a', { className: 'btn btn-secondary', href: `#/review?hand=${encodeURIComponent(record.id)}` }, '查看复盘')
        : null,
      h(
        'button',
        {
          type: 'button',
          className: 'btn btn-ghost',
          onClick: () => {
            if (window.confirm('重置整桌筹码并开始新一轮吗？当前牌桌历史会保留在复盘中。')) {
              resetTable();
              refresh();
            }
          }
        },
        '重置牌桌'
      )
    )
  );
}

function renderSimulatorView(root) {
  const { table } = sim;
  if (table.street === 'complete' && !sim.recorded) recordHand();
  const hero = table.seats[0];
  const position = positionOf(table, 0);
  const stats = getSimStats();
  const isHeroTurn = table.actor === 0 && table.street !== 'complete';
  const isComplete = table.street === 'complete';
  const reveals = table.result?.reveals?.map((r) => r.seat) || [];

  clear(root);
  const view = h('div', {
    className: `view simulator-view ${isHeroTurn ? 'has-action' : ''}`
  });

  view.appendChild(
    h(
      'header',
      { className: 'sim-head' },
      h(
        'div',
        { className: 'sim-head-left' },
        h('a', { href: '#/home', className: 'back-link' }, '← 返回首页'),
        h('div', {}, h('p', { className: 'eyebrow' }, '模拟牌局 · 6-max · 100BB'), h('h1', {}, isComplete ? '本手结束' : isHeroTurn ? '轮到你行动' : '牌局进行中'))
      ),
      h(
        'div',
        { className: 'sim-controls' },
        h(
          'span',
          { className: 'difficulty-control' },
          h('span', { className: 'muted small' }, '对手'),
          difficultySelect((value) => {
            setDifficulty(value);
            toast(`电脑对手已切换为「${DIFFICULTIES[value].name}」：${DIFFICULTIES[value].description}`, 'info');
            refresh();
          })
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'btn btn-secondary btn-sm',
            onClick: () => {
              sim.paused = !sim.paused;
              refresh();
            }
          },
          sim.paused ? '继续自动行动' : '暂停'
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'btn btn-ghost btn-sm',
            onClick: () => {
              saveCurrent();
              location.hash = '#/home';
            }
          },
          '保存并返回'
        )
      )
    )
  );

  if (sim.paused) {
    view.appendChild(h('div', { className: 'pause-banner' }, '已暂停自动行动。你的操作仍可进行；点击“继续自动行动”让电脑对手继续。'));
  }

  const grid = h('div', { className: 'sim-grid' });
  const main = h('div', { className: 'sim-main' });
  main.appendChild(
    h(
      'div',
      { className: 'sim-table-wrap' },
      renderSpot(table, {
        heroSeat: 0,
        showLog: false,
        revealSeats: reveals,
        revealAll: false
      })
    )
  );

  if (isComplete) {
    main.appendChild(renderResult(table, sim.record));
  } else if (isHeroTurn) {
    main.appendChild(
      h(
        'div',
        { className: 'sim-action-area' },
        h(
          'div',
          { className: 'turn-banner' },
          h('span', { className: 'turn-dot' }),
          h('strong', {}, '轮到你行动'),
          h('span', { className: 'muted small' }, '只显示当前合法操作；加注请确认“加到”与“额外投入”。')
        ),
        h(
          'div',
          { className: 'action-hand-line' },
          h('span', {}, '你的手牌'),
          h('strong', {}, hero.hole.map(cardLabel).join(' ')),
          h('span', {}, heroHandDescription(table))
        ),
        renderActionPanel(table, {
          seat: 0,
          onSubmit: (action) => {
            try {
              applyAction(table, 0, action);
              saveCurrent();
              if (table.street === 'complete') recordHand();
              refresh();
            } catch (error) {
              toast(`操作不合法：${error.message}`, 'error');
            }
          }
        })
      )
    );
  } else if (table.actor != null) {
    main.appendChild(
      h(
        'div',
        { className: 'sim-waiting' },
        h('span', { className: 'thinking-dot' }),
        h('strong', {}, `${table.seats[table.actor].name} 正在思考…`),
        h('span', { className: 'muted small' }, '电脑对手只读取公开信息；不会看到你的底牌或未来公共牌。')
      )
    );
  }

  main.appendChild(
    h(
      'div',
      { className: 'hero-hand-panel' },
      h(
        'div',
        { className: 'hero-hand-left' },
        h('span', { className: 'eyebrow' }, `你的手牌 · ${position}`),
        cardRow(hero.hole, { small: false }),
        h('strong', { className: 'hero-hand-name' }, isComplete && !hero.hole.length ? '' : heroHandDescription(table))
      ),
      h(
        'div',
        { className: 'hero-hand-right' },
        h('span', {}, `后手 ${formatBB(hero.stack)} BB`),
        h('span', {}, `底池 ${formatBB(isComplete ? table.result.totalPot : table.pot)} BB`),
        h('span', {}, `有效筹码约 ${formatBB(Math.min(...table.seats.filter((p) => !p.folded && p.seat !== 0).map((p) => p.stack), hero.stack))} BB`)
      )
    )
  );

  main.appendChild(
    h(
      'details',
      { className: 'sim-log-panel', open: isComplete ? true : undefined },
      h('summary', {}, '本手行动记录'),
      renderLog(table.events, { open: true })
    )
  );
  grid.appendChild(main);

  const side = h('aside', { className: 'sim-side' });
  side.appendChild(
    h(
      'section',
      { className: 'side-card' },
      h('h2', {}, '牌桌信息'),
      h(
        'div',
        { className: 'sim-info-list' },
        h('div', {}, h('span', {}, '盲注'), h('strong', {}, '0.5 / 1 BB')),
        h('div', {}, h('span', {}, '起始筹码'), h('strong', {}, '100 BB')),
        h('div', {}, h('span', {}, '前注 / 抽水'), h('strong', {}, '无 / 无')),
        h('div', {}, h('span', {}, '在局'), h('strong', {}, `${table.seats.filter((p) => !p.folded).length} 人`)),
        h('div', {}, h('span', {}, '庄位'), h('strong', {}, positionOf(table, table.button)))
      ),
      h(
        'p',
        { className: 'muted small' },
        `${profile().name}：${profile().description} 这是规则型对手，不是求解器；难度只调整阈值与随机性。`
      )
    )
  );
  side.appendChild(
    h(
      'section',
      { className: 'side-card' },
      h('h2', {}, '本局统计（不计能力）'),
      h(
        'div',
        { className: 'sim-mini-stats' },
        h('div', {}, h('strong', {}, String(stats.hands)), h('span', {}, '完成手数')),
        h('div', {}, h('strong', {}, (stats.netChips / 2).toFixed(1)), h('span', {}, '净 BB')),
        h('div', {}, h('strong', {}, String(stats.wins)), h('span', {}, '盈利手')),
        h('div', {}, h('strong', {}, String(stats.losses)), h('span', {}, '亏损手'))
      ),
      h('p', { className: 'muted small' }, '模拟筹码不用于解锁课程或判定水平。')
    )
  );
  side.appendChild(
    h(
      'section',
      { className: 'side-card' },
      h('h2', {}, '已结束手牌'),
      h(
        'p',
        { className: 'muted small' },
        `${getSimHistory().length} 手可复盘。复盘会区分当时可知信息与事后揭晓。`
      ),
      h('a', { className: 'btn btn-secondary btn-sm', href: '#/review' }, '打开复盘列表')
    )
  );
  grid.appendChild(side);
  view.appendChild(grid);
  root.appendChild(view);
}

function refresh() {
  if (!sim || !simRoot) return;
  renderSimulatorView(simRoot);
  scheduleNext();
}

function scheduleNext() {
  if (!sim) return;
  if (sim.timer) {
    clearTimeout(sim.timer);
    sim.timer = null;
  }
  if (!sim || sim.paused || sim.table.street === 'complete') return;
  const actor = sim.table.actor;
  if (actor == null || actor === 0) return;
  sim.timer = setTimeout(stepBot, 480 + Math.random() * 320);
}

function stepBot() {
  if (!sim || sim.paused || sim.table.street === 'complete') return;
  const { table } = sim;
  const actor = table.actor;
  if (actor == null || actor === 0) return;
  try {
    const rand = () => {
      const [value, state] = nextRandom(table.rngState);
      table.rngState = state;
      return value;
    };
    const decision = chooseBotAction(table, actor, getDifficulty(), rand);
    if (!decision) {
      sim.paused = true;
      toast(`${table.seats[actor].name} 没有可用决策，已暂停。`, 'error');
      refresh();
      return;
    }
    applyAction(table, actor, decision.action);
    saveCurrent();
    if (table.street === 'complete') recordHand();
    refresh();
  } catch (error) {
    sim.paused = true;
    toast(`电脑对手行动失败：${error.message}`, 'error');
    refresh();
  }
}

export function renderSimulator() {
  ensureSim();
  const root = h('div', { className: 'simulator-root' });
  simRoot = root;
  renderSimulatorView(root);
  scheduleNext();
  return root;
}

export function cleanup() {
  if (sim?.timer) {
    clearTimeout(sim.timer);
    sim.timer = null;
  }
  simRoot = null;
  // 保留 sim 内存状态；刷新页面时从 localStorage 恢复。离开路由时停止计时器。
}
