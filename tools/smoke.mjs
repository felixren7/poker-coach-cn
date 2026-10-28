/**
 * 真实 Chrome 冒烟测试（开发工具，不参与应用运行）。
 * 依赖已经在 9223 端口启动的 headless Chrome。
 */
import fs from 'node:fs';

const APP = process.env.APP_URL || 'http://127.0.0.1:4180/';
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9223';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pages = await (await fetch(`${CDP}/json/list`)).json();
const page = pages.find((p) => p.type === 'page');
if (!page) throw new Error('no page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let seq = 0;
const pending = new Map();
const events = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id) {
    const item = pending.get(msg.id);
    if (!item) return;
    pending.delete(msg.id);
    if (msg.error) item.reject(new Error(msg.error.message));
    else item.resolve(msg.result);
    return;
  }
  events.push(msg);
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text + ' ' + JSON.stringify(result.exceptionDetails.exception?.description || ''));
  }
  return result.result?.value;
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(`/tmp/poker-shots/${name}.png`, Buffer.from(shot.data, 'base64'));
}
async function route(hash, wait = 900) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`);
  await sleep(wait);
  return inspect();
}
async function inspect() {
  return evaluate(`(() => {
    const view = document.querySelector('#view');
    const buttons = [...document.querySelectorAll('#view button, #view a.btn')].map(b => (b.innerText || '').trim()).filter(Boolean);
    return {
      hash: location.hash,
      viewClass: view?.className || '',
      title: document.title,
      h1: view?.querySelector('h1')?.innerText || '',
      h2: [...(view?.querySelectorAll('h2') || [])].slice(0,4).map(e=>e.innerText),
      text: (view?.innerText || '').slice(0, 500),
      buttons: buttons.slice(0, 24),
      seats: view?.querySelectorAll('.seat').length || 0,
      cards: view?.querySelectorAll('.playing-card').length || 0,
      questions: view?.querySelectorAll('.question-player').length || 0,
      feedback: view?.querySelector('.feedback')?.innerText?.slice(0,220) || '',
      errorBoxes: [...document.querySelectorAll('.error-box')].map(e=>e.innerText),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  })()`);
}
function takeErrors() {
  const found = [];
  for (const event of events.splice(0)) {
    if (event.method === 'Runtime.exceptionThrown') {
      found.push('EXCEPTION ' + (event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text));
    }
    if (event.method === 'Log.entryAdded') {
      const entry = event.params.entry;
      if (!/favicon|Failed to load resource/.test(entry.text)) found.push(`LOG ${entry.level}: ${entry.text}`);
    }
    if (event.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(event.params.type)) {
      found.push('CONSOLE ' + event.params.type + ': ' + event.params.args.map(a=>a.value ?? a.description ?? '').join(' '));
    }
  }
  return found;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false
});
await send('Page.navigate', { url: APP + '#/home' });
await sleep(1500);

const results = [];
for (const [name, hash, wait] of [
  ['home', '#/home', 700],
  ['learn', '#/learn', 700],
  ['lesson-l1', '#/lesson/L1', 900],
  ['lesson-l9-locked', '#/lesson/L9', 700],
  ['train-home', '#/train', 700],
  ['train-daily', '#/train?mode=daily', 900],
  ['mistakes', '#/mistakes', 700],
  ['progress', '#/progress', 700],
  ['glossary', '#/glossary', 700],
  ['review', '#/review', 700],
  ['play', '#/play', 2600]
]) {
  const info = await route(hash, wait);
  const errors = takeErrors();
  results.push({ name, ...info, errors });
  await screenshot(name);
}

// 单题交互：点击“加注”默认尺度，再确认。
await route('#/train?mode=single&q=q_preflop_aa_utg', 900);
const clickedRaise = await evaluate(`(() => {
  const btns = [...document.querySelectorAll('#view .action-buttons button')];
  const btn = btns.find(b => (b.innerText||'').trim() === '加注');
  if (!btn) return false;
  btn.click();
  return true;
})()`);
await sleep(250);
const clickedConfirm = await evaluate(`(() => {
  const btns = [...document.querySelectorAll('#view .raise-editor button')];
  const btn = btns.find(b => (b.innerText||'').trim() === '确认加注');
  if (!btn) return false;
  btn.click();
  return true;
})()`);
await sleep(600);
const feedback = await inspect();
const storage = await evaluate(`(() => {
  const raw = localStorage.getItem('poker-coach-cn-v1');
  if (!raw) return null;
  const data = JSON.parse(raw);
  return { attempts: data.attempts.length, questions: Object.keys(data.questions).length, verdict: data.questions['q_preflop_aa_utg']?.lastVerdict, dueAt: data.questions['q_preflop_aa_utg']?.dueAt };
})()`);
results.push({ name: 'interaction-action', clickedRaise, clickedConfirm, ...feedback, storage, errors: takeErrors() });
await screenshot('interaction-action');

// 模拟牌局：检查首手是否渲染，等待轮到自己，尝试弃牌。
await route('#/play', 1200);
const beforePlay = await inspect();
const playState = await evaluate(`(() => ({
  hasActionPanel: !!document.querySelector('.sim-action-area .action-panel'),
  waiting: document.querySelector('.sim-waiting')?.innerText || '',
  seatCount: document.querySelectorAll('.sim-table-wrap .seat').length,
  board: [...document.querySelectorAll('.board-cards .playing-card')].map(e=>e.getAttribute('aria-label')),
  handName: document.querySelector('.hero-hand-name')?.innerText || '',
  heroCards: [...document.querySelectorAll('.hero-hand-panel .playing-card')].map(e=>e.getAttribute('aria-label')),
  logRows: document.querySelectorAll('.sim-log-panel .log-row').length
}))()`);
if (playState.hasActionPanel) {
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('.sim-action-area .action-buttons button')].find(b => (b.innerText||'').trim() === '弃牌');
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(4200);
}
const afterPlay = await inspect();
const playResult = await evaluate(`(() => ({
  resultPanel: document.querySelector('.result-panel')?.innerText?.slice(0,240) || '',
  activeSaved: !!JSON.parse(localStorage.getItem('poker-coach-cn-v1') || '{}').sim?.active,
  history: JSON.parse(localStorage.getItem('poker-coach-cn-v1') || '{}').sim?.history?.length || 0
}))()`);
results.push({ name: 'simulation', beforePlay, playState, afterPlay, playResult, errors: takeErrors() });
await screenshot('simulation');

// 复盘：如果有历史，打开第一手。
const historyId = await evaluate(`(() => JSON.parse(localStorage.getItem('poker-coach-cn-v1')||'{}').sim?.history?.[0]?.id || null)()`);
if (historyId) {
  const info = await route('#/review?hand=' + encodeURIComponent(historyId), 900);
  results.push({ name: 'review-detail', ...info, errors: takeErrors() });
  await screenshot('review-detail');
}

// 手机宽度检查。
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true
});
const mobileHome = await route('#/home', 700);
const mobileLearn = await route('#/learn', 700);
const mobileTrain = await route('#/train?mode=single&q=q_postflop_kq_dry', 900);
results.push({ name: 'mobile-home', ...mobileHome, errors: takeErrors() });
results.push({ name: 'mobile-learn', ...mobileLearn, errors: takeErrors() });
results.push({ name: 'mobile-train', ...mobileTrain, errors: takeErrors() });
await screenshot('mobile-home');
await screenshot('mobile-learn');
await screenshot('mobile-train');

console.log(JSON.stringify(results, null, 2));
ws.close();
