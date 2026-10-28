import fs from 'node:fs';
const CDP='http://127.0.0.1:9223';const APP='http://127.0.0.1:4180/';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pages=await (await fetch(`${CDP}/json/list`)).json();const page=pages.find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let id=0;const pend=new Map();const events=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pend.get(m.id);if(p){pend.delete(m.id);m.error?p.j(new Error(m.error.message)):p.r(m.result)}}else events.push(m)};
const send=(method,params={})=>new Promise((r,j)=>{const i=++id;pend.set(i,{r,j});ws.send(JSON.stringify({id:i,method,params}))});
async function ev(x){const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value}
function errs(){const o=[];for(const e of events.splice(0)){if(e.method==='Runtime.exceptionThrown')o.push(e.params.exceptionDetails.exception?.description||e.params.exceptionDetails.text);if(e.method==='Log.entryAdded'&&!/favicon|Failed to load resource/.test(e.params.entry.text))o.push(e.params.entry.text)}return o}
await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
await send('Page.navigate',{url:APP+'#/home'});await sleep(800);
const completed={};for(const id of ['L1','L2','L3','L4','L5','L6'])completed[id]={completedAt:Date.now()};
await ev(`localStorage.setItem('poker-coach-cn-v1', JSON.stringify({version:1,createdAt:Date.now(),lessons:${JSON.stringify(completed)},questions:{},tags:{},mistakes:{},attempts:[],sim:{history:[],active:null,stats:{hands:0,netChips:0,wins:0,losses:0,pushes:0}} ,settings:{difficulty:'normal'}}))`);
await send('Page.reload',{ignoreCache:true});await sleep(1600);
await ev(`location.hash='#/lesson/L7'`);await sleep(1100);
const initial=await ev(`({title:document.querySelector('.lesson-head h1')?.innerText, tools:!!document.querySelector('.prob-tools'), out:[...document.querySelectorAll('.prob-output')].map(e=>e.innerText)})`);
// Pot odds 100/50/50
const potOutput=await ev(`(() => { const card=document.querySelectorAll('.prob-card')[0]; const inputs=card.querySelectorAll('input'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(inputs[0],'100'); inputs[0].dispatchEvent(new Event('input',{bubbles:true})); setter.call(inputs[1],'50'); inputs[1].dispatchEvent(new Event('input',{bubbles:true})); setter.call(inputs[2],'50'); inputs[2].dispatchEvent(new Event('input',{bubbles:true})); return card.querySelector('.prob-output')?.innerText; })()`);
// Outs turn 9
const outsOutput=await ev(`(() => { const card=document.querySelectorAll('.prob-card')[1]; const input=card.querySelector('input'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,'9'); input.dispatchEvent(new Event('input',{bubbles:true})); const select=card.querySelector('select'); select.value='turn'; select.dispatchEvent(new Event('input',{bubbles:true})); return card.querySelector('.prob-output')?.innerText; })()`);
// Equity default
await ev(`document.querySelector('.prob-card-wide .btn').click()`);await sleep(1600);
const equity=await ev(`document.querySelector('.prob-card-wide .prob-output')?.innerText||''`);
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await sleep(300);
const shot=await send('Page.captureScreenshot',{format:'png'});
fs.writeFileSync('/tmp/poker-shots/prob-tool.png',Buffer.from(shot.data,'base64'));
console.log(JSON.stringify({initial,potOutput,outsOutput,equity,errors:errs()},null,2));
ws.close();
