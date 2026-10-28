const CDP='http://127.0.0.1:9223';
const APP='http://127.0.0.1:4180/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pages=await (await fetch(`${CDP}/json/list`)).json();
const page=pages.find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let id=0;const pend=new Map();const events=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pend.get(m.id);if(p){pend.delete(m.id);m.error?p.j(new Error(m.error.message)):p.r(m.result)}}else events.push(m)};
const send=(method,params={})=>new Promise((r,j)=>{const i=++id;pend.set(i,{r,j});ws.send(JSON.stringify({id:i,method,params}))});
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value}
async function nav(hash,wait=800){await ev(`location.hash=${JSON.stringify(hash)}`);await sleep(wait)}
async function click(sel,text){return ev(`(() => { const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>(e.innerText||'').trim().includes(${JSON.stringify(text)})); if(!el) return false; el.click(); return true; })()`)}
function errs(){const o=[];for(const e of events.splice(0)){if(e.method==='Runtime.exceptionThrown')o.push(e.params.exceptionDetails.exception?.description||e.params.exceptionDetails.text);if(e.method==='Log.entryAdded'&&!/favicon|Failed to load resource/.test(e.params.entry.text))o.push(e.params.entry.text)}return o}
await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
await send('Page.navigate',{url:APP+'#/home'});await sleep(800);
await ev(`localStorage.clear()`);await send('Page.reload',{ignoreCache:true});await sleep(1500);
const out={};
await nav('#/lesson/L1',1000);
out.initial={questions:await ev(`document.querySelectorAll('.question-player').length`),demo:await ev(`!!document.querySelector('.demo-start')`),status:await ev(`document.querySelector('.lesson-head .status-pill')?.innerText`)};
await click('button','查看示范');await sleep(400);
out.demo={callout:await ev(`document.querySelector('.demo-callout')?.innerText?.slice(0,200)||''`),hints:await ev(`document.querySelectorAll('.hint-item.revealed').length`)};
await click('.demo-skip','跳过示范');await sleep(300);
// Q1 choice
const q1Selected=await ev(`(() => { const el=[...document.querySelectorAll('.lesson-practice-section .choice-option')].find(e=>(e.innerText||'').includes('UTG')); if(!el) return false; el.click(); return true; })()`);
await sleep(250);
await click('.lesson-practice-section .submit-row button','提交判断');await sleep(500);
out.q1={selected:q1Selected,feedback:(await ev(`document.querySelector('.lesson-practice-section .feedback')?.innerText?.slice(0,220)||''`)),next:await ev(`[...document.querySelectorAll('.lesson-practice-section .feedback-actions button')].map(b=>b.innerText)`)};
await click('.lesson-practice-section .feedback-actions button','下一题');await sleep(500);
out.q2={index:await ev(`document.querySelector('.practice-index')?.innerText||''`),legalOptions:await ev(`document.querySelectorAll('.lesson-practice-section .legal-picker .choice-option').length`)};
for(const label of ['弃牌','过牌','下注']){
  await ev(`(() => { const el=[...document.querySelectorAll('.lesson-practice-section .legal-picker .choice-option')].find(e=>(e.innerText||'').includes(${JSON.stringify(label)})); if(!el) return false; el.querySelector('input').click(); return true; })()`);
  await sleep(160);
}
await click('.lesson-practice-section .submit-row button','提交合法操作');await sleep(500);
out.q2.feedback=await ev(`document.querySelector('.lesson-practice-section .feedback')?.innerText?.slice(0,220)||''`);
out.q2.next=await ev(`[...document.querySelectorAll('.lesson-practice-section .feedback-actions button')].map(b=>b.innerText)`);
await click('.lesson-practice-section .feedback-actions button','查看练习总结');await sleep(600);
out.summary={text:await ev(`document.querySelector('.practice-summary')?.innerText?.slice(0,500)||''`),buttons:await ev(`[...document.querySelectorAll('.practice-summary button, .practice-summary a.btn')].map(b=>b.innerText)`)};
await click('.practice-summary button','完成本课');await sleep(700);
out.afterComplete={status:await ev(`document.querySelector('.lesson-head .status-pill')?.innerText`),summary:await ev(`document.querySelector('.practice-summary')?.innerText?.slice(0,400)||''`),storage:await ev(`(() => { const d=JSON.parse(localStorage.getItem('poker-coach-cn-v1')||'{}'); return {lessons:Object.keys(d.lessons||{}), questions:Object.keys(d.questions||{}), attempts:(d.attempts||[]).length}; })()`)};
await nav('#/learn',700);
out.learn={l1:await ev(`[...document.querySelectorAll('.lesson-card')].find(e=>e.innerText.includes('牌桌、位置与行动'))?.className`),l2:await ev(`[...document.querySelectorAll('.lesson-card')].find(e=>e.innerText.includes('牌型、最佳五张与平局'))?.className`),l3:await ev(`[...document.querySelectorAll('.lesson-card')].find(e=>e.innerText.includes('起手牌与位置'))?.className`)};
await nav('#/train?mode=daily',900);
out.daily={question:await ev(`document.querySelector('.question-title')?.innerText||''`),hintButtons:await ev(`document.querySelectorAll('.hint-locked').length`)};
await click('.hint-locked','提示 1');await sleep(400);
out.hintAfter={revealed:await ev(`document.querySelectorAll('.hint-item.revealed').length`),text:await ev(`document.querySelector('.hint-item.revealed')?.innerText?.slice(0,120)||''`)};
out.errors=errs();
console.log(JSON.stringify(out,null,2));
ws.close();
