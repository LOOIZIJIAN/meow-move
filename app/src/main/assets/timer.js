(function(global){
'use strict';
const MAX_SECONDS=3600;
const duration=value=>{const n=Number(value);if(!Number.isInteger(n)||n<1||n>MAX_SECONDS)throw Error('休息时长请选择1秒至60分钟');return n;};
function blank(seconds=150){return {status:'idle',durationSec:duration(seconds),remainingMs:Number(seconds)*1000,endAt:0,cycleId:null,sessionId:null,notified:false,controlRevision:0};}
function validate(t){if(!t||t.controlRevision!==undefined&&(!Number.isSafeInteger(t.controlRevision)||t.controlRevision<0)||!['idle','running','paused','done'].includes(t.status)||!Number.isInteger(t.durationSec)||t.durationSec<1||t.durationSec>MAX_SECONDS||!Number.isFinite(t.remainingMs)||t.remainingMs<0||t.remainingMs>MAX_SECONDS*1000||!Number.isFinite(t.endAt)||t.endAt<0||t.status==='running'&&(t.endAt===0||typeof t.cycleId!=='string')||typeof t.notified!=='boolean'||t.sessionId!=null&&typeof t.sessionId!=='string'||t.cycleId!=null&&typeof t.cycleId!=='string')throw Error('计时器数据无效');return t;}
function remaining(t,now=Date.now()){validate(t);return t.status==='running'?Math.max(0,Math.min(MAX_SECONDS*1000,t.endAt-now)):t.remainingMs;}
function settle(t,now=Date.now()){return t.status==='running'&&remaining(t,now)===0?{...t,status:'done',remainingMs:0,endAt:0}:t;}
function start(t,seconds=t.durationSec,now=Date.now(),sessionId=null){const out=blank(seconds);return {...out,controlRevision:t.controlRevision||0,status:'running',endAt:now+out.remainingMs,cycleId:global.crypto?.randomUUID?.()||`${now}-${Math.random().toString(36).slice(2)}`,sessionId};}
function pause(t,now=Date.now()){t=settle(t,now);return t.status==='running'?{...t,status:'paused',remainingMs:remaining(t,now),endAt:0}:t;}
function resume(t,now=Date.now()){return t.status==='paused'?{...t,status:'running',endAt:now+t.remainingMs}:t;}
function reset(t){return {...blank(t.durationSec),controlRevision:t.controlRevision||0};}
function select(t,seconds){if(t.status==='running'||t.status==='paused')throw Error('先重置，再更改下一次的时长');return {...blank(seconds),controlRevision:t.controlRevision||0};}
function adjust(t,delta,now=Date.now()){if(!Number.isFinite(delta))throw Error('时间调整无效');t=settle(t,now);if(t.status==='idle'||t.status==='done')return {...blank(Math.max(1,Math.min(MAX_SECONDS,t.durationSec+delta))),controlRevision:t.controlRevision||0};const ms=Math.max(0,Math.min(MAX_SECONDS*1000,remaining(t,now)+delta*1000));return {...t,status:ms===0?'done':t.status,remainingMs:ms,endAt:t.status==='running'&&ms>0?now+ms:0};}
const api={MAX_SECONDS,blank,validate,remaining,settle,start,pause,resume,reset,select,adjust};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.MeowTimer=api;
})(typeof window!=='undefined'?window:globalThis);
