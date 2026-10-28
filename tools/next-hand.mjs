const CDP='http://127.0.0.1:9223';const APP='http://127.0.0.1:4180/';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pages=await (await fetch(`${CDP}/json/list`)).json();const page=pages.find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let id=0;const pend=new Map();const events=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pend.get(m.id);if(p){pend.delete(m.id);m.error?p.j(new Error(m.error.message)):p.r(m.result)}}else events.push(m)};
const send=(method,params={})=>new Promise((r,j)=>{const i=++id;pend.set(i,{r,j});ws.send(JSON.stringify({id:i,method,params}))});
async function ev(x){const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value}
async function click(sel,text){return ev(`(() => { const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>(e.innerText||'').trim().includes(${JSON.stringify(text)})); if(!el) return false; el.click(); return true; })()`)}
function errs(){const o=[];for(const e of events.splice(0)){if(e.method==='Runtime.exceptionThrown')o.push(e.params.exceptionDetails.exception?.description||e.params.exceptionDetails.text);if(e.method==='Log.entryAdded'&&!/favicon|Failed to load resource/.test(e.params.entry.text))o.push(e.params.entry.text)}return o}
await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
await send('Page.navigate',{url:APP+'#/home'});await sleep(900);await ev(`localStorage.clear()`);await send('Page.reload',{ignoreCache:true});await sleep(1500);
await ev(`location.hash='#/play'`);await sleep(1800);
let guard=0;while(guard<30000){const panel=await ev(`!!document.querySelector('.sim-action-area .action-panel')`);const result=await ev(`!!document.querySelector('.result-panel')`);if(panel||result)break;await sleep(500);guard+=500}
const first=await ev(`({panel:!!document.querySelector('.sim-action-area .action-panel'),result:!!document.querySelector('.result-panel'),h1:document.querySelector('.sim-head h1')?.innerText,hero:[...document.querySelectorAll('.sim-table-wrap .seat-hero .playing-card')].map(e=>e.getAttribute('aria-label'))})`);
if(first.panel){await click('.sim-action-area .action-buttons button','弃牌');}
let wait=0;while(wait<60000){const done=await ev(`!!document.querySelector('.result-panel')`);if(done)break;await sleep(700);wait+=700}
const resumed=await ev(`({result:document.querySelector('.result-panel')?.innerText?.slice(0,100)||'',history:JSON.parse(localStorage.getItem('poker-coach-cn-v1')||'{}').sim?.history?.length||0})`);
const nextClicked=await click('.result-panel button','下一手');await sleep(900);
const next=await ev(`({result:!!document.querySelector('.result-panel'),hero:[...document.querySelectorAll('.sim-table-wrap .seat-hero .playing-card')].map(e=>e.getAttribute('aria-label')),h1:document.querySelector('.sim-head h1')?.innerText,active:!!JSON.parse(localStorage.getItem('poker-coach-cn-v1')||'{}').sim?.active,activeStreet:JSON.parse(localStorage.getItem('poker-coach-cn-v1')||'{}').sim?.active?.table?.street})`);
await send('Page.reload',{ignoreCache:true});await sleep(1800);
await ev(`location.hash='#/play'`);await sleep(2000);
const afterReload=await ev(`({hero:[...document.querySelectorAll('.sim-table-wrap .seat-hero .playing-card')].map(e=>e.getAttribute('aria-label')),h1:document.querySelector('.sim-head h1')?.innerText,panel:!!document.querySelector('.sim-action-area .action-panel'),active:!!JSON.parse(localStorage.getItem('poker-coach-cn-v1')||'{}').sim?.active})`);
console.log(JSON.stringify({first,resumed,nextClicked,next,afterReload,errors:errs()},null,2));
ws.close();
