import { cardsFromString, assertUniqueCards, cardLabel } from '../engine/cards.js';
import { outsProbability, potOdds } from '../engine/odds.js';
import { equityVsRange, rangePercent } from '../engine/ranges.js';
import { h, clear } from './dom.js';

function parseCardsInput(text, label) {
  const cards = cardsFromString(text || '');
  assertUniqueCards(cards, label);
  return cards;
}

function percent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function outputLine(label, value, note) {
  return h(
    'div',
    { className: 'prob-result-line' },
    h('span', {}, label),
    h('strong', {}, value),
    note ? h('small', {}, note) : null
  );
}

export function renderProbabilityTools() {
  const wrap = h(
    'section',
    { className: 'prob-tools' },
    h(
      'div',
      { className: 'section-head' },
      h(
        'div',
        {},
        h('p', { className: 'eyebrow' }, '动手算一算'),
        h('h2', {}, '概率工具箱'),
        h(
          'p',
          { className: 'section-lead' },
          '公式是工具，不是结论。先明确金额口径与假设，再看数字；补牌完成概率、权益与最终赢池概率不是同一件事。'
        )
      )
    )
  );

  const grid = h('div', { className: 'prob-grid' });

  // 底池赔率
  const potInput = h('input', { type: 'number', min: '0', step: '1', value: '100', 'aria-label': '对手下注前底池' });
  const betInput = h('input', { type: 'number', min: '0', step: '1', value: '50', 'aria-label': '对手下注' });
  const callInput = h('input', { type: 'number', min: '0', step: '1', value: '50', 'aria-label': '你需要跟注' });
  const potOutput = h('div', { className: 'prob-output' });
  const calcPot = () => {
    clear(potOutput);
    const before = Number(potInput.value);
    const bet = Number(betInput.value);
    const call = Number(callInput.value);
    if (![before, bet, call].every((n) => Number.isFinite(n) && n >= 0)) {
      potOutput.appendChild(h('p', { className: 'error-box' }, '请输入非负金额。'));
      return;
    }
    const result = potOdds(before + bet, call);
    appendPot(result);
  };
  const appendPot = (result) => {
    potOutput.appendChild(
      outputLine('跟注后底池', `${result.finalPot}`, '对手下注 + 你的跟注都算进去')
    );
    potOutput.appendChild(
      outputLine('盈亏平衡权益', percent(result.breakeven, 2), result.formula)
    );
    potOutput.appendChild(
      h('p', { className: 'prob-note' }, '如果后面还有转牌/河牌下注，不能只用这个比例决定整手牌。')
    );
  };
  [potInput, betInput, callInput].forEach((input) => input.addEventListener('input', calcPot));
  const potCard = h(
    'div',
    { className: 'prob-card' },
    h('h3', {}, '底池赔率'),
    h(
      'div',
      { className: 'prob-fields' },
      h('label', {}, h('span', {}, '对手下注前底池'), potInput),
      h('label', {}, h('span', {}, '对手下注'), betInput),
      h('label', {}, h('span', {}, '你需要跟注'), callInput)
    ),
    potOutput
  );
  calcPot();
  grid.appendChild(potCard);

  // 补牌完成概率
  const outsInput = h('input', { type: 'number', min: '0', max: '47', step: '1', value: '9', 'aria-label': '补牌数' });
  const streetSelect = h(
    'select',
    { 'aria-label': '当前街道' },
    h('option', { value: 'flop' }, '翻牌圈（两张牌未发）'),
    h('option', { value: 'turn' }, '转牌圈（只剩河牌）')
  );
  const outsOutput = h('div', { className: 'prob-output' });
  const calcOuts = () => {
    clear(outsOutput);
    const outs = Number(outsInput.value);
    const street = streetSelect.value;
    const maxOuts = street === 'flop' ? 47 : 46;
    if (!Number.isInteger(outs) || outs < 0 || outs > maxOuts) {
      outsOutput.appendChild(
        h('p', { className: 'error-box' }, `当前街道的补牌数需为 0–${maxOuts} 的整数。`)
      );
      return;
    }
    if (street === 'flop') {
      const p = outsProbability(outs, 47, 46);
      outsOutput.appendChild(outputLine('转牌完成', percent(p.oneCard, 1), '仅一张牌'));
      outsOutput.appendChild(outputLine('到河牌完成', percent(p.byRiver, 1), p.formula));
      outsOutput.appendChild(
        h('p', { className: 'prob-note' }, '这里只算“完成牌型”的概率；有些补牌会完成但输给更大牌。')
      );
    } else {
      const p = outsProbability(outs, 46, null);
      outsOutput.appendChild(outputLine('河牌完成', percent(p.oneCard, 1), `${outs} / 46`));
      outsOutput.appendChild(
        h('p', { className: 'prob-note' }, '只剩一张牌时，补牌完成概率通常远低于两张牌的情况。')
      );
    }
  };
  [outsInput, streetSelect].forEach((input) => input.addEventListener('input', calcOuts));
  const outsCard = h(
    'div',
    { className: 'prob-card' },
    h('h3', {}, '补牌完成概率'),
    h(
      'div',
      { className: 'prob-fields' },
      h('label', {}, h('span', {}, '不同补牌数'), outsInput),
      h('label', {}, h('span', {}, '当前街道'), streetSelect)
    ),
    outsOutput
  );
  calcOuts();
  grid.appendChild(outsCard);

  // 权益模拟器
  const heroInput = h('input', { type: 'text', value: 'As Ah', placeholder: '例如 As Ah', 'aria-label': '英雄底牌' });
  const boardInput = h('input', { type: 'text', value: '', placeholder: '例如 Ks 7d 2c（可留空）', 'aria-label': '公共牌' });
  const rangeInput = h('input', { type: 'text', value: 'KK+, AKs', placeholder: '例如 QQ+, AKs', 'aria-label': '对手范围' });
  const iterationsSelect = h(
    'select',
    { 'aria-label': '模拟次数' },
    h('option', { value: '5000' }, '5,000 次'),
    h('option', { value: '10000', selected: true }, '10,000 次'),
    h('option', { value: '20000' }, '20,000 次')
  );
  const equityOutput = h('div', { className: 'prob-output' });
  const runEquity = () => {
    clear(equityOutput);
    try {
      const hero = parseCardsInput(heroInput.value, '底牌');
      const board = parseCardsInput(boardInput.value, '公共牌');
      if (hero.length !== 2) throw new Error('底牌必须恰好两张，例如 As Ah。');
      if (![0, 3, 4, 5].includes(board.length)) throw new Error('公共牌只能是 0、3、4 或 5 张。');
      assertUniqueCards([...hero, ...board], '已知牌');
      const range = rangeInput.value.trim();
      if (!range) throw new Error('请填写对手范围，例如 QQ+, AKs。');
      const iterations = Number(iterationsSelect.value);
      const result = equityVsRange(hero, board, range, { iterations, seed: 20261028 });
      equityOutput.appendChild(
        h(
          'div',
          { className: 'equity-hero' },
          h('strong', {}, percent(result.equity, 1)),
          h('span', {}, `± ${(result.margin * 100).toFixed(2)} 个百分点（95% 近似）`)
        )
      );
      equityOutput.appendChild(
        outputLine('模拟次数', result.iterations.toLocaleString('zh-CN'), result.exact ? '河牌已发完，按范围枚举' : '蒙特卡洛估算')
      );
      equityOutput.appendChild(
        outputLine(
          '可用范围组合',
          `${result.rangeCombos} 组`,
          `已扣除与已知牌冲突的组合；原始范围约占全部起手牌 ${rangePercent(result.range).toFixed(1)}%`
        )
      );
      equityOutput.appendChild(
        outputLine(
          '已知牌',
          [...hero, ...board].map(cardLabel).join(' '),
          board.length ? '公共牌按输入' : '无公共牌'
        )
      );
      equityOutput.appendChild(h('p', { className: 'prob-note' }, result.note));
      equityOutput.appendChild(
        h(
          'p',
          { className: 'prob-note warn' },
          '这是对“你输入的范围”的估算，不是对真实对手的读牌，也不是最终赢池概率。'
        )
      );
    } catch (error) {
      equityOutput.appendChild(h('p', { className: 'error-box' }, `无法估算：${error.message}`));
    }
  };
  const equityButton = h('button', { type: 'button', className: 'btn btn-primary', onClick: runEquity }, '估算权益');
  const equityCard = h(
    'div',
    { className: 'prob-card prob-card-wide' },
    h('h3', {}, '范围权益模拟'),
    h(
      'p',
      { className: 'muted small' },
      '输入底牌、公共牌与对手范围；结果附带模拟次数、范围组合数与近似误差。没有范围假设，就没有可解释的权益数字。'
    ),
    h(
      'div',
      { className: 'prob-fields equity-fields' },
      h('label', {}, h('span', {}, '你的底牌'), heroInput),
      h('label', {}, h('span', {}, '公共牌（可留空）'), boardInput),
      h('label', {}, h('span', {}, '对手范围'), rangeInput),
      h('label', {}, h('span', {}, '模拟次数'), iterationsSelect)
    ),
    h('div', { className: 'prob-actions' }, equityButton),
    equityOutput
  );
  grid.appendChild(equityCard);
  wrap.appendChild(grid);
  wrap.appendChild(
    h(
      'div',
      { className: 'callout callout-warn' },
      h('strong', {}, '这些数字的边界'),
      h(
        'p',
        {},
        '范围权益取决于你输入的对手范围；范围错了，数字再精确也没有意义。补牌完成概率不等于获胜概率。本工具不预测最终赢池概率，也不提供 EV 或 GTO 频率。'
      )
    )
  );
  return wrap;
}
