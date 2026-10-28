import fs from 'node:fs';
const APP = process.env.APP_URL || 'http://127.0.0.1:4180/';
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9223';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pages = await (await fetch(`${CDP}/json/list`)).json();
const page = pages.find((p) => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map(); const events = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id) { const p = pending.get(msg.id); if (!p) return; pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
  else events.push(msg);
};
const send = (method, params={}) => new Promise((res, rej) => { const id=++seq; pending.set(id,{res,rej}); ws.send(JSON.stringify({id,method,params})); });
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
  fs.writeFileSync(`/tmp/poker-shots/${name}.png`, Buffer.from(s.data,'base64'));
}
async function nav(hash, wait=800) { await evaluate(`location.hash=${JSON.stringify(hash)}`); await sleep(wait); }
function takeErrors() {
  const out=[];
  for (const e of events.splice(0)) {
    if (e.method==='Runtime.exceptionThrown') out.push('EXCEPTION '+(e.params.exceptionDetails.exception?.description||e.params.exceptionDetails.text));
    if (e.method==='Log.entryAdded' && !/favicon|Failed to load resource/.test(e.params.entry.text)) out.push(`LOG ${e.params.entry.level}: ${e.params.entry.text}`);
    if (e.method==='Runtime.consoleAPICalled' && ['error','warning'].includes(e.params.type)) out.push('CONSOLE '+e.params.type+': '+e.params.args.map(a=>a.value??a.description??'').join(' '));
  }
  return out;
}
async function clickText(selector, text) {
  return evaluate(`(() => { const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.innerText||'').trim().includes(${JSON.stringify(text)})); if(!el) return false; el.click(); return true; })()`);
}
async function feedback() { return evaluate(`document.querySelector('.feedback')?.innerText?.slice(0,500) || ''`); }

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:APP+'#/home'}); await sleep(900);
await evaluate(`localStorage.clear()`);
await send('Page.reload',{ignoreCache:true}); await sleep(1600);
// 让所有题型都可访问，便于冒烟：假设前 7 课已完成（L8 解锁）。
await evaluate(`(() => {
  const d = JSON.parse(localStorage.getItem('poker-coach-cn-v1') || '{}');
  d.version = 1;
  d.lessons = {};
  for (const id of ['L1','L2','L3','L4','L5','L6','L7']) d.lessons[id] = { completedAt: Date.now() };
  localStorage.setItem('poker-coach-cn-v1', JSON.stringify(d));
})()`);
await send('Page.reload',{ignoreCache:true}); await sleep(1600);
const report = {};

// 1. 最佳五张交互
await nav('#/train?mode=single&q=q_best_five_royal', 900);
const labels = ['红桃A','红桃K','红桃Q','红桃J','红桃10'];
for (const label of labels) {
  const ok = await evaluate(`(() => { const el=[...document.querySelectorAll('.best-five-picker .playing-card')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}); if(!el) return false; el.click(); return true; })()`);
  await sleep(70);
  if (!ok) report.bestFiveMissing = label;
}
await sleep(300);
report.bestFiveSelected = await evaluate(`document.querySelector('.selection-readout')?.innerText || ''`);
await clickText('button','提交最佳五张'); await sleep(500);
report.bestFiveFeedback = await feedback(); await shot('interaction-bestfive');

// 2. 数字题
await nav('#/train?mode=single&q=q_math_pot_odds', 900);
await evaluate(`(() => { const input=document.querySelector('.numeric-wrap input'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,'25'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
await sleep(150);
await clickText('button','提交计算'); await sleep(500);
report.numericFeedback = await feedback();

// 3. 概念题
await nav('#/train?mode=single&q=q_choice_resulting', 900);
await clickText('.choice-option','决策好坏'); await sleep(200);
await clickText('button','提交判断'); await sleep(500);
report.choiceFeedback = await feedback();

// 4. 合法操作题
await nav('#/train?mode=single&q=q_legal_bb_facing_raise', 900);
for (const label of ['弃牌','跟注','加注']) {
  await evaluate(`(() => { const label=[...document.querySelectorAll('.legal-picker .choice-option')].find(l=>(l.innerText||'').includes(${JSON.stringify(label)})); if(!label) return false; label.querySelector('input').click(); return true; })()`);
  await sleep(180);
}
await clickText('button','提交合法操作'); await sleep(500);
report.legalFeedback = await feedback();

// 5. 课程示范
await nav('#/lesson/L1', 900);
await clickText('button','查看示范'); await sleep(400);
report.demoCallout = await evaluate(`document.querySelector('.demo-callout')?.innerText?.slice(0,300) || ''`);
report.demoHints = await evaluate(`document.querySelectorAll('.hint-item.revealed').length`); await shot('lesson-demo');

// 6. 模拟手牌完成
await nav('#/play', 800);
let simWait = 0;
while (simWait < 40000) {
  const state = await evaluate(`({ panel: !!document.querySelector('.sim-action-area .action-panel'), result: !!document.querySelector('.result-panel') })`);
  if (state.result || state.panel) break;
  await sleep(500); simWait += 500;
}
report.simFirstState = await evaluate(`({ panel: !!document.querySelector('.sim-action-area .action-panel'), result: !!document.querySelector('.result-panel'), h1: document.querySelector('.sim-head h1')?.innerText })`);
if (report.simFirstState.panel) {
  await clickText('.sim-action-area .action-buttons button','弃牌');
  await sleep(300);
}
let waitEnd = 0;
while (waitEnd < 45000) {
  const done = await evaluate(`!!document.querySelector('.result-panel')`);
  if (done) break;
  await sleep(700); waitEnd += 700;
}
report.simResult = await evaluate(`({ text: document.querySelector('.result-panel')?.innerText?.slice(0,500) || '', history: JSON.parse(localStorage.getItem('poker-coach-cn-v1')||'{}').sim?.history?.length || 0, active: !!JSON.parse(localStorage.getItem('poker-coach-cn-v1')||'{}').sim?.active })`);
await shot('simulation-result');

// 7. 打开复盘
const reviewHref = await evaluate(`(() => { const a=[...document.querySelectorAll('.result-panel a')].find(a=>(a.innerText||'').includes('查看复盘')); return a?.getAttribute('href')||null; })()`);
if (reviewHref) {
  await evaluate(`location.hash=${JSON.stringify(reviewHref)}`); await sleep(1000);
  report.reviewDetail = await evaluate(`({ h1: document.querySelector('#view h1')?.innerText, decisions: document.querySelectorAll('.decision-card').length, known: document.querySelectorAll('.known-badge').length, reveal: document.querySelectorAll('.reveal-row').length, redo: document.querySelectorAll('.redo-details').length })`);
  await clickText('.redo-details summary','重做这个决策'); await sleep(400);
  report.redoPanel = await evaluate(`({ spot: !!document.querySelector('.redo-wrap .poker-table'), actions: document.querySelectorAll('.redo-wrap .action-buttons button').length })`);
  await shot('review-detail');
}

// 8. 手机截图（每个路由后立即截图）
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await nav('#/home',700); report.mobileHome = await evaluate(`({h1:document.querySelector('#view h1')?.innerText, overflow:document.documentElement.scrollWidth-window.innerWidth})`); await shot('mobile-home');
await nav('#/learn',700); report.mobileLearn = await evaluate(`({h1:document.querySelector('#view h1')?.innerText, overflow:document.documentElement.scrollWidth-window.innerWidth})`); await shot('mobile-learn');
await nav('#/play',900); report.mobilePlay = await evaluate(`({seats:document.querySelectorAll('.sim-table-wrap .seat').length, overflow:document.documentElement.scrollWidth-window.innerWidth})`); await shot('mobile-play');
report.errors = takeErrors();
console.log(JSON.stringify(report,null,2));
ws.close();
