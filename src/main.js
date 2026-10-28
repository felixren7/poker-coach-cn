import { initStore, getDueCount, getOverallMastery, getLastSaveError } from './state/store.js';
import { openGlossary } from './ui/components.js';
import { h, clear, toast } from './ui/dom.js';
import { renderHome } from './views/home.js';
import { renderLearn } from './views/learn.js';
import { renderLesson } from './views/lesson.js';
import { renderTrainer, cleanup as cleanupTrainer } from './views/trainer.js';
import { renderSimulator, cleanup as cleanupSimulator } from './views/simulator.js';
import { renderReview } from './views/review.js';
import { renderMistakes } from './views/mistakes.js';
import { renderProgress } from './views/progress.js';
import { renderGlossary } from './views/glossary.js';

const ROUTES = {
  home: { render: renderHome, title: '首页', nav: 'home', cleanup: null },
  learn: { render: renderLearn, title: '学习路径', nav: 'learn', cleanup: null },
  lesson: { render: renderLesson, title: '课程', nav: 'learn', cleanup: null },
  train: { render: renderTrainer, title: '训练场', nav: 'train', cleanup: cleanupTrainer },
  play: { render: renderSimulator, title: '模拟牌局', nav: 'play', cleanup: cleanupSimulator },
  review: { render: renderReview, title: '复盘', nav: 'review', cleanup: null },
  mistakes: { render: renderMistakes, title: '错题本', nav: 'mistakes', cleanup: null },
  progress: { render: renderProgress, title: '学习进度', nav: 'progress', cleanup: null },
  glossary: { render: renderGlossary, title: '术语表', nav: 'glossary', cleanup: null }
};

const NAV = [
  { id: 'home', label: '首页', href: '#/home' },
  { id: 'learn', label: '课程', href: '#/learn' },
  { id: 'train', label: '训练', href: '#/train' },
  { id: 'play', label: '模拟牌局', href: '#/play' },
  { id: 'review', label: '复盘', href: '#/review' },
  { id: 'mistakes', label: '错题本', href: '#/mistakes' },
  { id: 'progress', label: '进度', href: '#/progress' },
  { id: 'glossary', label: '术语', href: '#/glossary' }
];

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [pathPart, queryPart = ''] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(queryPart));
  const routeName = segments[0] || 'home';
  if (routeName === 'lesson' && segments[1]) params.id = segments[1];
  return { routeName: ROUTES[routeName] ? routeName : 'home', params };
}

let currentCleanup = null;
let shell = null;
let viewHost = null;
let navHost = null;

function renderShell() {
  const app = document.getElementById('app');
  clear(app);
  const due = getDueCount();
  const overall = getOverallMastery();
  const navLinks = () =>
    NAV.map((item) =>
      h(
        'a',
        {
          className: 'nav-link',
          href: item.href,
          dataset: { nav: item.id }
        },
        item.label
      )
    );

  const header = h(
    'header',
    { className: 'topbar' },
    h(
      'div',
      { className: 'topbar-inner' },
      h(
        'a',
        { className: 'brand', href: '#/home', 'aria-label': '河牌之前首页' },
        h('span', { className: 'brand-mark', 'aria-hidden': 'true' }, '♠'),
        h(
          'span',
          { className: 'brand-text' },
          h('strong', {}, '河牌之前'),
          h('small', {}, '德州扑克教练')
        )
      ),
      navHost = h('nav', { className: 'main-nav', 'aria-label': '主导航' }, navLinks()),
      h(
        'div',
        { className: 'topbar-side' },
        h(
          'a',
          { className: 'mini-status', href: '#/train?mode=daily', title: '今日到期复习' },
          h('span', { className: 'mini-dot' }),
          due ? `待复习 ${due}` : `进度 ${Math.round(overall.mastery * 100)}%`
        )
      )
    )
  );

  viewHost = h('main', { id: 'view', className: 'view-host', tabindex: '-1' });

  const footer = h(
    'footer',
    { className: 'site-footer' },
    h(
      'div',
      { className: 'footer-inner' },
      h(
        'div',
        {},
        h('strong', {}, '河牌之前 · 德州扑克教练'),
        h(
          'p',
          {},
          '默认环境：6 人桌 · 无限注 · 100BB · 无前注/无抽水 · 虚拟筹码。策略为教学基线，不是求解器；不承诺盈利。'
        )
      ),
      h(
        'div',
        { className: 'footer-links' },
        h('a', { href: '#/glossary' }, '术语表'),
        h('a', { href: '#/progress' }, '进度与数据'),
        h('a', { href: '#/learn' }, '课程')
      )
    )
  );

  app.appendChild(header);
  app.appendChild(viewHost);
  app.appendChild(footer);
  shell = app;
}

function updateNav(routeName) {
  const route = ROUTES[routeName];
  if (!navHost) return;
  for (const link of navHost.querySelectorAll('.nav-link')) {
    const active = link.dataset.nav === route?.nav;
    link.classList.toggle('is-active', Boolean(active));
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function renderRoute() {
  const { routeName, params } = parseRoute();
  const route = ROUTES[routeName] || ROUTES.home;
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch {
      // ignore cleanup failures
    }
    currentCleanup = null;
  }
  clear(viewHost);
  const result = route.render(params);
  if (result instanceof Node) viewHost.appendChild(result);
  else if (Array.isArray(result)) {
    for (const node of result) if (node instanceof Node) viewHost.appendChild(node);
  }
  currentCleanup = route.cleanup || null;
  updateNav(routeName);
  document.title = `${route.title} · 河牌之前`;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  viewHost.focus({ preventScroll: true });
}

function notFound() {
  return h(
    'div',
    { className: 'view' },
    h('h1', {}, '页面不存在'),
    h('p', { className: 'muted' }, '检查地址，或回到首页继续学习。'),
    h('a', { className: 'btn btn-primary', href: '#/home' }, '回到首页')
  );
}

function boot() {
  const result = initStore();
  renderShell();
  if (!location.hash) {
    history.replaceState(null, '', '#/home');
  }
  renderRoute();
  if (result.error) toast(result.error, 'error');
  window.addEventListener('hashchange', renderRoute);
  document.addEventListener('click', (event) => {
    const term = event.target.closest('[data-term]');
    if (term) {
      event.preventDefault();
      openGlossary(term.dataset.term);
    }
  });
  // 首次进入没有本地记录时，不弹通知；让首页的引导自然开始。
  const saveError = getLastSaveError();
  if (saveError) toast(`本地保存失败：${saveError}`, 'error');
}

boot();
