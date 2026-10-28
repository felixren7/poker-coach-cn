const CDP='http://127.0.0.1:9223';const APP='http://127.0.0.1:4180/';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pages=await (await fetch(`${CDP}/json/list`)).json();const page=pages.find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let id=0;const pend=new Map();const events=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pend.get(m.id);if(p){pend.delete(m.id);m.error?p.j(new Error(m.error.message)):p.r(m.result)}}else events.push(m)};
const send=(method,params={})=>new Promise((r,j)=>{const i=++id;pend.set(i,{r,j});ws.send(JSON.stringify({id:i,method,params}))});
async function ev(x){const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value}
function errs(){const o=[];for(const e of events.splice(0)){if(e.method==='Runtime.exceptionThrown')o.push(e.params.exceptionDetails.exception?.description||e.params.exceptionDetails.text);if(e.method==='Log.entryAdded'&&!/favicon|Failed to load resource/.test(e.params.entry.text))o.push(e.params.entry.text)}return o}
await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
await send('Page.navigate',{url:APP+'#/home'});await sleep(800);await ev(`localStorage.clear()`);await send('Page.reload',{ignoreCache:true});await sleep(1500);
await ev(`location.hash='#/train'`);await sleep(800);
const newUser={bank:await ev(`[...document.querySelectorAll('.bank-phase summary')].map(e=>e.innerText)`),count:await ev(`[...document.querySelectorAll('.bank-card p.muted')].map(e=>e.innerText)[0]`),lockedRows:await ev(`[...document.querySelectorAll('.bank-row')].length`)};
await ev(`location.hash='#/train?mode=daily'`);await sleep(900);
const daily={title:await ev(`document.querySelector('.question-title')?.innerText||''`),progress:await ev(`document.querySelector('.session-progress-row')?.innerText||''`)};
await ev(`location.hash='#/train?mode=single&q=q_choice_range_advantage'`);await sleep(900);
const lockedDirect={text:await ev(`document.querySelector('#view')?.innerText?.slice(0,300)||''`)};
// 解锁 L2（L1 已完成）
await ev(`(() => { const d=JSON.parse(localStorage.getItem('poker-coach-cn-v1')||'{}'); d.version=1; d.lessons={...(d.lessons||{}),L1:{completedAt:Date.now()}}; localStorage.setItem('poker-coach-cn-v1',JSON.stringify(d)); })()`);
await send('Page.reload',{ignoreCache:true});await sleep(1500);
await ev(`location.hash='#/train'`);await sleep(800);
const afterL1={bank:await ev(`[...document.querySelectorAll('.bank-phase summary')].map(e=>e.innerText)`),count:await ev(`[...document.querySelectorAll('.bank-card p.muted')].map(e=>e.innerText)[0]`),rows:await ev(`document.querySelectorAll('.bank-row').length`)};
console.log(JSON.stringify({newUser,daily,lockedDirect,afterL1,errors:errs()},null,2));
ws.close();
