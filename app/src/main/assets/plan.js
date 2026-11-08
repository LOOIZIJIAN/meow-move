(function(global){
'use strict';
// Today's plan written by an AI assistant into meow-move-plan.json (or pasted). It becomes a normal
// templated workout: each item is the entry's prescription plus an optional target weight. When the
// workout ends the result is kept on the session, so the next backup carries the completion back.
const node=typeof module!=='undefined'&&module.exports;
const M=()=>node?require('./model.js'):global.MeowModel,T=()=>node?require('./training.js'):global.MeowTraining;
const KINDS=['recorded','total','side','body'];
const int=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
function reps(v){if(Number.isInteger(v))return [v,v];const m=/^\s*(\d{1,4})\s*(?:[-–~至到]\s*(\d{1,4}))?\s*$/.exec(String(v??''));if(!m)return null;const a=Number(m[1]),b=Number(m[2]||m[1]);return a>=1&&a<=b&&b<=1000?[a,b]:null;}
function find(state,name){const n=M().norm(name),k=s=>M().norm(s).replace(/[\s\-_·]/g,'');return state.catalog.find(e=>M().norm(e.name)===n)||state.catalog.find(e=>k(e.name)===k(name))||null;}
// Accepts the documented format; anything unclear is an error in plain words rather than a guess.
function parse(text,state){let v;try{v=typeof text==='string'?JSON.parse(text.replace(/^﻿/,'').trim().replace(/^```(?:json)?\s*|\s*```$/g,'')):text;}catch(e){throw Error('计划不是有效的 JSON');}
 if(!v||typeof v!=='object'||!Array.isArray(v.items)||!v.items.length)throw Error('计划里没有动作（items）');if(v.items.length>30)throw Error('一次计划最多 30 个动作');
 const date=v.date==null?M().day():String(v.date);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('计划日期要写成 2026-11-04');
 const title=String(v.title||'今日计划').trim().slice(0,100),seen=new Set(),items=v.items.map((x,i)=>{const at=`第 ${i+1} 个动作`;
  const name=String(x?.exercise??x?.name??'').trim();if(!name||name.length>100)throw Error(at+'没有名称');const hit=find(state,name);
  const muscle=x.muscle??hit?.muscle;if(!M().MUSCLES.includes(muscle))throw Error(`${name} 不在动作库里，请在计划里写上 muscle（${M().MUSCLES.join('/')}）`);
  const sets=Number(x.sets??3);if(!int(sets,1,30))throw Error(name+' 的组数要在 1–30');const r=reps(x.reps??10);if(!r)throw Error(name+' 的次数写成 8 或 "8-10"');
  const weight=x.weight==null||x.weight===''?null:Number(x.weight);if(weight!==null&&!(Number.isFinite(weight)&&weight>=0&&weight<=5000))throw Error(name+' 的重量无效');
  const restSec=Number(x.rest??x.restSec??(hit?T().settings(state,hit.id).restSec:120));if(!int(restSec,0,3600))throw Error(name+' 的休息秒数无效');
  const kind=x.kind??hit?.defaultKind??'recorded';if(!KINDS.includes(kind))throw Error(name+' 的 kind 只能是 '+KINDS.join('/'));
  const key=hit?.id||M().norm(name);if(seen.has(key))throw Error(name+' 在计划里出现了两次');seen.add(key);
  return {name:hit?.name||name,exerciseId:hit?.id||null,muscle,sets,minReps:r[0],maxReps:r[1],weight,restSec,kind,note:String(x.note||'').slice(0,200)};});
 const muscles=[...new Set(items.map(x=>x.muscle))];
 return {id:'plan-'+M().hash(JSON.stringify([date,title,items])),date,title,note:String(v.note||'').slice(0,500),by:String(v.by||'AI').slice(0,40),items,muscles};}
// Unknown exercises are added to the library with the muscle the plan gave.
function start(state,plan,now=Date.now()){if(state.active)throw Error('请先完成当前训练，再开始计划');
 const entries=plan.items.map(x=>{let eid=x.exerciseId&&state.catalog.some(e=>e.id===x.exerciseId)?x.exerciseId:find(state,x.name)?.id;
  if(!eid){eid='custom-'+M().id();state.catalog.push({id:eid,name:x.name,muscle:x.muscle,defaultKind:x.kind,archived:false});}
  else{const e=state.catalog.find(e=>e.id===eid);if(e.archived)e.archived=false;}
  return {exerciseId:eid,enabled:true,sets:x.sets,minReps:x.minReps,maxReps:x.maxReps,increment:2.5,kind:x.kind,variant:'',restSec:x.restSec,group:'',weight:x.weight};});
 T().applyTemplate(state,{name:plan.title,muscles:plan.muscles,entries,id:plan.id},M());delete state.active.templateId;
 state.active.plan={id:plan.id,title:plan.title,date:plan.date,by:plan.by,note:plan.note,items:entries.map((e,i)=>({exerciseId:e.exerciseId,name:plan.items[i].name,sets:e.sets,minReps:e.minReps,maxReps:e.maxReps,weight:e.weight}))};
 state.aiPlan={...(state.aiPlan||{}),plan,status:'started',sessionId:state.active.id,changedAt:now};return state.active;}
// Done = non-warm-up sets; a set counts fully when it reaches the planned minimum reps.
function result(session){const p=session.plan;if(!p)return null;let target=0,got=0;const items=p.items.map(x=>{const sets=(session.exercises.find(e=>e.exerciseId===x.exerciseId)?.sets||[]).filter(s=>s.type!=='warmup'),full=sets.filter(s=>s.complex||s.reps==null||s.reps>=x.minReps).length;
  target+=x.sets;got+=Math.min(x.sets,full)+Math.min(Math.max(0,x.sets-full),sets.length-full)*0.5;
  const status=!sets.length?'skipped':full>=x.sets?'done':'partial';return {exerciseId:x.exerciseId,name:x.name,planned:x.sets,done:sets.length,full,status};});
 const extra=session.exercises.filter(e=>!p.items.some(x=>x.exerciseId===e.exerciseId)).map(e=>({exerciseId:e.exerciseId,done:e.sets.length}));
 return {percent:target?Math.round(got/target*100):0,items,extra};}
function finish(state,now=Date.now()){const planned=state.active?.plan;const s=M().finish(state);if(planned){s.plan.result=result(s);if(state.aiPlan?.sessionId===s.id)state.aiPlan={...state.aiPlan,status:'done',changedAt:now};}return s;}
// What the home card shows: a plan for today (or undated) the person has not finished or set aside.
function today(state,day=M().day()){const a=state.aiPlan;if(!a?.plan||a.plan.date<day||a.status==='dismissed'||a.status==='done')return null;if(a.status==='started'&&state.active?.id!==a.sessionId)return null;return a;}
function receive(state,text,now=Date.now()){const plan=parse(text,state);if(state.aiPlan?.plan?.id===plan.id)return false;state.aiPlan={plan,status:'new',receivedAt:now,changedAt:now};return plan;}
function dismiss(state,now=Date.now()){if(state.aiPlan)state.aiPlan={...state.aiPlan,status:'dismissed',changedAt:now};}
function validate(state){const a=state.aiPlan;if(a===undefined||a===null)return;if(typeof a!=='object'||!a.plan||!Array.isArray(a.plan.items)||!['new','started','done','dismissed'].includes(a.status))throw Error('今日计划无效');}

const api={parse,start,result,finish,today,receive,dismiss,validate,reps};
if(node)module.exports=api;else global.MeowPlan=api;
})(typeof window!=='undefined'?window:globalThis);
