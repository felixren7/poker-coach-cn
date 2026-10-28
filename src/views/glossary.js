import { GLOSSARY } from '../content/glossary.js';
import { h, clear } from '../ui/dom.js';
import { renderGlossaryList } from '../ui/components.js';

export function renderGlossary() {
  const listHost = h('div', { className: 'glossary-host' });
  const count = h('span', { className: 'muted small' }, `${GLOSSARY.length} 个术语`);
  const search = h('input', {
    type: 'search',
    placeholder: '搜索中文术语、英文缩写或解释…',
    'aria-label': '搜索术语',
    onInput: (event) => {
      clear(listHost);
      const filter = event.target.value;
      const filtered = GLOSSARY.filter((entry) => {
        const q = filter.trim().toLowerCase();
        if (!q) return true;
        return (
          entry.term.toLowerCase().includes(q) ||
          entry.en.toLowerCase().includes(q) ||
          entry.definition.toLowerCase().includes(q)
        );
      });
      count.textContent = `${filtered.length} 个术语`;
      listHost.appendChild(renderGlossaryList(filter));
    }
  });
  listHost.appendChild(renderGlossaryList(''));

  return h(
    'div',
    { className: 'view glossary-view' },
    h(
      'header',
      { className: 'page-head' },
      h(
        'div',
        {},
        h('p', { className: 'eyebrow' }, '术语表'),
        h('h1', {}, '每个术语，都能点开看中文解释与例子'),
        h(
          'p',
          { className: 'page-lead' },
          '首次出现术语时提供中文解释与英文缩写；在课程、提示和反馈中，带下划线的术语都可以点击。理解术语是工具，不是目的。'
        )
      )
    ),
    h(
      'div',
      { className: 'glossary-toolbar' },
      search,
      count
    ),
    listHost,
    h(
      'div',
      { className: 'callout callout-info' },
      h('strong', {}, '关于策略术语'),
      h(
        'p',
        {},
        'GTO、范围优势、阻断牌等概念在本产品中都只做方向性解释，不提供精确求解频率。任何术语都不能脱离对手范围、筹码深度与规则环境单独套用。'
      )
    )
  );
}
