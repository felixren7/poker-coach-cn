import fs from 'node:fs';
const CDP='http://127.0.0.1:9223';const APP='http://127.0.0.1:4180/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pages=await (await fetch(`${CDP}/json/list`)).json();const page=pages.find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pend.get(m.id);if(p){pend.delete(m.id);m.error?p.j(new Error(m.error.message)):p.r(m.result)}}};
const send=(method,params={})=>new Promise((r,j)=>{const i=++id;pend.set(i,{r,j});ws.send(JSON.stringify({id:i,method,params}))});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value};
async function shot(name,full=false){const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:full});fs.writeFileSync(`/tmp/poker-shots/${name}.png`,Buffer.from(s.data,'base64'))}
async function nav(hash,wait=800){await ev(`location.hash=${JSON.stringify(hash)}`);await sleep(wait)}
await send('Page.enable');await send('Runtime.enable');
await send('Page.navigate',{url:APP+'#/home'});await sleep(900);
await ev(`localStorage.clear()`);await send('Page.reload',{ignoreCache:true});await sleep(1600);
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
for(const [name,hash,wait] of [['home','#/home',600],['learn','#/learn',600],['lesson','#/lesson/L1',900],['train','#/train?mode=daily',900],['progress','#/progress',600],['glossary','#/glossary',600],['mistakes','#/mistakes',600],['review','#/review',600]]){
  await nav(hash,wait);await shot(name);if(name==='lesson')await shot('lesson-full',true);
}
await nav('#/play',2600);
const playInfo=await ev(`(() => { const a=document.querySelector('.sim-action-area')?.getBoundingClientRect(); return {actionTop:a?.top, actionBottom:a?.bottom, viewport:innerHeight, scrollHeight:document.documentElement.scrollHeight}; })()`);
await shot('play');
await shot('play-full',true);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
for(const [name,hash,wait] of [['mobile-home','#/home',600],['mobile-learn','#/learn',600],['mobile-lesson','#/lesson/L1',900],['mobile-train','#/train?mode=daily',900]]){
  await nav(hash,wait);await shot(name);
}
await nav('#/play',2400);await shot('mobile-play');
const mobileInfo=await ev(`({overflow:document.documentElement.scrollWidth-innerWidth, actionTop:document.querySelector('.sim-action-area')?.getBoundingClientRect().top, viewport:innerHeight})`);
console.log(JSON.stringify({playInfo,mobileInfo},null,2));
ws.close();
