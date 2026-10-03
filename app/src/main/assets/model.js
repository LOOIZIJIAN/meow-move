(function(global){
'use strict';
const Timer=typeof module!=='undefined'&&module.exports?require('./timer.js'):global.MeowTimer;
const Goals=typeof module!=='undefined'&&module.exports?require('./goals.js'):global.MeowGoals;
const MUSCLES=['胸','背','腿','肩','二头','三头','臀','小腿','核心'];
const SPLITS={three:[{name:'推日',muscles:['胸','肩','三头']},{name:'拉日',muscles:['背','二头']},{name:'腿日',muscles:['腿','臀','小腿']}],five:[{name:'胸',muscles:['胸']},{name:'背',muscles:['背']},{name:'腿',muscles:['腿','臀','小腿']},{name:'肩',muscles:['肩']},{name:'手臂',muscles:['二头','三头']}]};
const clone=v=>JSON.parse(JSON.stringify(v));
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
const id=()=>global.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const day=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const norm=s=>String(s).normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const exerciseId=name=>'ex-'+hash(norm(name));
function blank(){return {app:'meow-move',schema:1,catalog:[],sessions:[],sources:[],goals:[],preferences:{split:'three',muscles:['胸','肩','三头'],weeklyGoal:3,costume:'classic',restNotifications:false},restTimer:Timer.blank(),active:null};}
function parseSet(raw){
 const line=raw.replace(/^\d+[.、)]\s*/,'').replace(/，/g,',').trim();
 const kg=line.match(/(\d+(?:\.\d+)?)\s*kg/i),num=line.match(/(\d+(?:\.\d+)?)\s*(?:\([^)]*\))?\s*\*/);
 const body=/自重/.test(line),reps=line.match(/\*\s*(\d+)/),rest=line.match(/(\d+(?:\.\d+)?)\s*\.?\s*min/i);
 const right=line.match(/right\s*\*\s*(\d+)/i),left=line.match(/left\s*\*\s*(\d+)/i);
 const complex=Boolean(right||left||/\+/.test(line.replace(/\([^)]*\)/g,'')));
 const notes=[...line.matchAll(/[（(]([^）)]*)[）)]/g)].map(m=>m[1]);
 const trailing=line.split(',').slice(1).join(',').replace(/\d+(?:\.\d+)?\s*\.?\s*min/i,'').replace(/[（(][^）)]*[）)]/g,'').trim();if(trailing)notes.push(trailing);
 return {id:id(),weight:body?null:kg?Number(kg[1]):num?Number(num[1]):null,unit:body?null:kg?'kg':null,kind:body?'body':/单边/.test(line)?'side':/杠铃\s*\d+\s*kg\s*\+/.test(line)?'total':'recorded',reps:complex?null:reps?Number(reps[1]):null,restSec:rest?Math.round(Number(rest[1])*60):null,feeling:'',note:notes.join('；'),variant:line.match(/^(反手|正手)/)?.[1]||'',complex,sideReps:right||left?{right:right?Number(right[1]):null,left:left?Number(left[1]):null}:null,raw};
}
function parseNote(text,sourceId){
 if(typeof text!=='string'||!text.trim())throw Error('笔记内容为空');
 const lines=text.replace(/\r\n/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean),title=lines[0].replace(/^#+\s*/,'');
 const dt=title.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!dt)throw Error('笔记标题需要日期，例如 练胸 2/10/2026');
 const yyyy=Number(dt[3])<100?2000+Number(dt[3]):Number(dt[3]),mm=Number(dt[2]),dd=Number(dt[1]);const date=`${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
 if(day(new Date(yyyy,mm-1,dd))!==date)throw Error('笔记日期无效');
 const muscle=title.includes('二头')?'二头':title.includes('三头')?'三头':MUSCLES.find(m=>title.includes('练'+m))||'核心';
 const source=sourceId||'note-'+hash(text),entries=[],catalog=[],sessionNotes=[];let current=null;
 for(let n=1;n<lines.length;n++){
  const line=lines[n];if(/^\d+[.、)]/.test(line)){if(!current){sessionNotes.push(line);continue;}const set=parseSet(line);if(current.kind==='side'&&set.kind!=='body')set.kind='side';current.sets.push(set);continue;}
  if(n+1<lines.length&&/^\d+[.、)]/.test(lines[n+1])){
   const notes=[...line.matchAll(/[（(]([^）)]*)[）)]/g)].map(m=>m[1]);
   // Parenthesized machine identifiers remain in the name; subjective notes move to exercise notes.
   const name=line.replace(/[（(]([^）)]*)[）)]/g,(a,b)=>/弱|酸|差距|出力|控制|借力|单边|kg/i.test(b)?'':a).trim();
   const eid=exerciseId(name);let em=muscle;if(/glute|臀/i.test(name))em='臀';if(/extension/i.test(name)&&muscle==='背')em='背';
   current={exerciseId:eid,sets:[],note:notes.filter(s=>!/单边.*kg/i.test(s)).join('；'),kind:/单边/.test(line)?'side':'recorded'};entries.push(current);catalog.push({id:eid,name,muscle:em,defaultKind:current.kind,archived:false});
  }else sessionNotes.push(line);
 }
 if(!entries.length)throw Error('没有找到动作和组数，请检查笔记格式');
 for(const e of entries){if(e.sets.every(s=>s.kind==='body')){e.kind='body';catalog.find(c=>c.id===e.exerciseId).defaultKind='body';}}
 return {catalog,source:{id:source,title,date,raw:text},session:{id:'session-'+source,date,title,muscles:[muscle],startedAt:null,endedAt:null,imported:true,sourceId:source,exercises:entries,note:sessionNotes.join('\n')}};
}
function addNote(state,text,sourceId){const p=parseNote(text,sourceId);if(state.sources.some(s=>s.raw===text||s.id===p.source.id))return false;
 for(const c of p.catalog)if(!state.catalog.some(e=>e.id===c.id))state.catalog.push(c);
 state.sessions.push(p.session);state.sources.push(p.source);return true;
}
function latest(state,eid){return [...state.sessions].sort((a,b)=>b.date.localeCompare(a.date)||(b.endedAt||0)-(a.endedAt||0)).flatMap(s=>s.exercises.filter(e=>e.exerciseId===eid).map(e=>({session:s,entry:e})))[0]||null;}
function draft(state,eid){const e=state.catalog.find(e=>e.id===eid),entry=state.active?.exercises.find(e=>e.exerciseId===eid),index=entry?.sets.length||0,old=latest(state,eid)?.entry.sets||[],baseline=old[index]||old[old.length-1],prev=entry?.sets[index-1];
 return {weight:baseline?.unit==='kg'?baseline.weight:prev?.weight??'',reps:baseline?.reps??prev?.reps??'',restSec:baseline?.restSec??prev?.restSec??150,kind:baseline?.kind||e?.defaultKind||'recorded',feeling:'',note:'',variant:baseline?.variant||'',unit:'kg'};
}
function begin(state,muscles,eids=[]){if(state.active)return state.active;state.active={id:id(),date:day(),muscles:clone(muscles),startedAt:Date.now(),endedAt:null,title:muscles.join('＋')+'训练',exercises:eids.map(eid=>({exerciseId:eid,sets:[],note:''})),currentExerciseId:eids[0]||null,draft:null,restUntil:0,note:''};if(eids[0])state.active.draft=draft(state,eids[0]);return state.active;}
function select(state,eid){if(!state.active)begin(state,state.preferences.muscles,[eid]);const a=state.active;a.drafts=a.drafts||{};if(a.currentExerciseId&&a.draft)a.drafts[a.currentExerciseId]=clone(a.draft);if(!a.exercises.some(e=>e.exerciseId===eid))a.exercises.push({exerciseId:eid,sets:[],note:''});a.currentExerciseId=eid;a.draft=clone(a.drafts[eid]||draft(state,eid));}
function complete(state){const a=state.active;if(!a||!a.currentExerciseId)throw Error('请先选择动作');const d=a.draft;
 if(!['recorded','total','side','body'].includes(d.kind)||d.reps===''||!Number.isInteger(Number(d.reps))||Number(d.reps)<1||Number(d.reps)>1000||(d.kind!=='body'&&(d.weight===''||!Number.isFinite(Number(d.weight))||Number(d.weight)<0||Number(d.weight)>5000))||!Number.isFinite(Number(d.restSec))||Number(d.restSec)<0||Number(d.restSec)>3600)throw Error('请填写有效的重量、次数与休息时间');
 const s={id:id(),weight:d.kind==='body'?null:Number(d.weight),unit:d.kind==='body'?null:'kg',reps:Number(d.reps),kind:d.kind,restSec:Number(d.restSec),feeling:d.feeling||'',note:d.note||'',variant:d.variant||'',complex:false,sideReps:null,raw:null,recordedAt:Date.now()};
 a.exercises.find(e=>e.exerciseId===a.currentExerciseId).sets.push(s);state.restTimer=s.restSec>0?Timer.start(state.restTimer||Timer.blank(),s.restSec,Date.now(),a.id):Timer.reset(state.restTimer||Timer.blank());a.restUntil=state.restTimer.endAt;a.draft=draft(state,a.currentExerciseId);if(a.drafts)a.drafts[a.currentExerciseId]=clone(a.draft);return s;
}
function finish(state){const a=state.active;if(!a)throw Error('没有正在进行的训练');const entries=a.exercises.filter(e=>e.sets.length);if(!entries.length)throw Error('先记录至少一组，或放弃这次空训练');const result={...clone(a),exercises:entries,endedAt:Date.now()};delete result.currentExerciseId;delete result.draft;delete result.drafts;delete result.restUntil;state.sessions.push(result);if(state.restTimer?.sessionId===a.id)state.restTimer=Timer.reset(state.restTimer);state.active=null;return result;}
function weekStart(now=new Date()){const n=new Date(now.getFullYear(),now.getMonth(),now.getDate());n.setDate(n.getDate()-((n.getDay()+6)%7));return day(n);}
function weekly(state,now=new Date()){const from=weekStart(now),to=day(now);return state.sessions.filter(s=>s.date>=from&&s.date<=to).length;}
function stats(state,from='',to='9999-12-31'){const sessions=state.sessions.filter(s=>s.date>=from&&s.date<=to),muscles={};let sets=0;for(const s of sessions)for(const entry of s.exercises){sets+=entry.sets.length;const m=state.catalog.find(e=>e.id===entry.exerciseId)?.muscle||'其他';muscles[m]=(muscles[m]||0)+entry.sets.length;}return {sessions:sessions.length,sets,muscles};}
function series(state,eid,kind='recorded',variant='',metric='weight'){return [...state.sessions].sort((a,b)=>a.date.localeCompare(b.date)).map(s=>{const sets=s.exercises.filter(e=>e.exerciseId===eid).flatMap(e=>e.sets).filter(x=>x.kind===kind&&(x.variant||'')===variant&&!x.complex&&(kind==='body'||x.unit==='kg')&&x.reps!=null);if(!sets.length)return null;const value=metric==='reps'?Math.max(...sets.map(x=>x.reps)):kind==='body'?null:Math.max(...sets.map(x=>x.weight));return value==null?null:{date:s.date,value,sets:sets.length,sessionId:s.id};}).filter(Boolean);}
function choices(state,eid){const values=new Map();for(const s of state.sessions)for(const e of s.exercises.filter(e=>e.exerciseId===eid))for(const set of e.sets){if(set.complex||set.reps==null||(set.kind!=='body'&&set.unit!=='kg'))continue;values.set(`${set.kind}|${set.variant||''}`,{kind:set.kind,variant:set.variant||''});}return [...values.values()];}
const kindName=k=>({recorded:'按原记录重量',total:'总重量',side:'单边重量',body:'自重'}[k]||'未注明');
function setText(s){if(s.complex)return (s.raw||'复杂组')+(s.editedAt?`；休息${s.restSec==null?'未记录':s.restSec+'秒'}${s.feeling?'；感受：'+s.feeling:''}${s.note?'；备注：'+s.note:''}`:'');return `${s.kind==='body'?'自重':`${s.weight??'未记录'} ${s.unit||'（单位未注明）'}`}${s.kind==='side'?' / 单边':s.kind==='total'?' / 总重量':''}${s.variant?' / '+s.variant:''} × ${s.reps??'未记录'}，休息${s.restSec==null?'未记录':s.restSec+'秒'}${s.feeling?'，感受：'+s.feeling:''}${s.note?'，备注：'+s.note:''}`;}
function exportMarkdown(state,from='',to='9999-12-31'){const rows=[`# 喵练 · 训练日志\n\n导出范围：${from||'全部'} 至 ${to==='9999-12-31'?'全部':to}\n\n分析约定：不同器械、握法、单边/总重量/自重分别比较；未注明单位或缺失值不按0计算；复杂组保留原文。\n`];
 for(const s of [...state.sessions].filter(s=>s.date>=from&&s.date<=to).sort((a,b)=>a.date.localeCompare(b.date))){rows.push(`## ${s.date} · ${s.title}\n`);for(const e of s.exercises){const c=state.catalog.find(c=>c.id===e.exerciseId);rows.push(`### ${c?.name||e.exerciseId}\n${e.note?'动作备注：'+e.note+'\n':''}`);e.sets.forEach((set,i)=>rows.push(`${i+1}. ${setText(set)}`));rows.push('');}if(s.note)rows.push('训练感受：'+s.note+'\n');const source=state.sources.find(x=>x.id===s.sourceId);if(source)rows.push('原始笔记（完整保留）：\n\n```text\n'+source.raw.replace(/```/g,'` ` `')+'\n```\n');}if((state.goals||[]).some(g=>!g.archived))rows.push(Goals.markdown(state));return rows.join('\n');}
function csvCell(v){let s=String(v??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function exportCsv(state,from='',to='9999-12-31'){const rows=[['日期','训练','动作','肌群','组','重量','单位','重量方式','握法','次数','右侧次数','左侧次数','休息秒','感受','备注','复杂组原文']];for(const s of state.sessions.filter(s=>s.date>=from&&s.date<=to))for(const e of s.exercises){const c=state.catalog.find(c=>c.id===e.exerciseId);e.sets.forEach((x,i)=>rows.push([s.date,s.title,c?.name||'',c?.muscle||'',i+1,x.weight,x.unit,kindName(x.kind),x.variant,x.reps,x.sideReps?.right,x.sideReps?.left,x.restSec,x.feeling,[e.note,x.note,s.note].filter(Boolean).join('；'),x.raw||'']));}return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');}
function validate(v){if(!v||v.app!=='meow-move'||v.schema!==1||!Array.isArray(v.catalog)||!Array.isArray(v.sessions)||!Array.isArray(v.sources)||!v.preferences)throw Error('不是支持的喵练备份文件');if(v.sessions.length>100000||v.catalog.length>10000)throw Error('备份内容过大');
 if(v.restTimer)Timer.validate(v.restTimer);
 Goals.validate(v);
 const ids=new Set();for(const e of v.catalog){if(typeof e.id!=='string'||typeof e.name!=='string'||!e.name.trim()||!MUSCLES.includes(e.muscle)||ids.has(e.id))throw Error('动作目录无效');ids.add(e.id);}
 for(const source of v.sources)if(typeof source.id!=='string'||typeof source.raw!=='string'||typeof source.title!=='string')throw Error('原始笔记格式无效');
 const sids=new Set();for(const s of [...v.sessions,...(v.active?[v.active]:[])]){if(typeof s.id!=='string'||sids.has(s.id)||typeof s.title!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||day(new Date(s.date+'T12:00:00'))!==s.date||!Array.isArray(s.exercises)||!Array.isArray(s.muscles)||!s.muscles.every(m=>MUSCLES.includes(m)))throw Error('训练内容无效');sids.add(s.id);for(const e of s.exercises){if(!ids.has(e.exerciseId)||!Array.isArray(e.sets))throw Error('训练动作无效');for(const x of e.sets)if((x.weight!=null&&(!Number.isFinite(x.weight)||x.weight<0))||(x.reps!=null&&(!Number.isInteger(x.reps)||x.reps<1))||(x.restSec!=null&&(!Number.isFinite(x.restSec)||x.restSec<0))||!['recorded','side','total','body'].includes(x.kind))throw Error('组数据无效');}}
 if(v.active&&(typeof v.active.restUntil!=='number'||!Number.isFinite(v.active.restUntil)||v.active.restUntil<0||v.active.currentExerciseId&&!v.active.exercises.some(e=>e.exerciseId===v.active.currentExerciseId)||v.active.currentExerciseId&&!v.active.draft))throw Error('进行中的训练无效');
 if(!['three','five'].includes(v.preferences.split)||!Array.isArray(v.preferences.muscles)||!v.preferences.muscles.every(m=>MUSCLES.includes(m))||!Number.isInteger(v.preferences.weeklyGoal)||v.preferences.weeklyGoal<1||v.preferences.weeklyGoal>7)throw Error('偏好设置无效');return v;
}
function lastChanged(s){return Math.max(s.modifiedAt||0,s.endedAt||0,...s.exercises.flatMap(e=>e.sets.map(x=>Math.max(x.editedAt||0,x.recordedAt||0))));}
function merge(state,incoming,{restorePreferences=true}={}){validate(incoming);const out=clone(state);let added=0,updated=0;for(const c of incoming.catalog){const old=out.catalog.find(e=>e.id===c.id);if(old&&norm(old.name)!==norm(c.name))throw Error('备份中的动作标识冲突');if(!old)out.catalog.push(clone(c));}for(const s of incoming.sources)if(!out.sources.some(x=>x.id===s.id||x.raw===s.raw))out.sources.push(clone(s));for(const s of incoming.sessions){const at=out.sessions.findIndex(x=>x.id===s.id);if(at<0&&out.active?.id!==s.id){out.sessions.push(clone(s));added++;}else if(at>=0&&lastChanged(s)>lastChanged(out.sessions[at])){out.sessions[at]=clone(s);updated++;}}if(!out.active&&incoming.active&&!out.sessions.some(s=>s.id===incoming.active.id))out.active=clone(incoming.active);out.goals=Goals.merge(out.goals,incoming.goals);if(restorePreferences)out.preferences=clone(incoming.preferences);validate(out);return {state:out,added,updated};}
const api={MUSCLES,SPLITS,blank,clone,hash,id,day,norm,exerciseId,parseSet,parseNote,addNote,latest,draft,begin,select,complete,finish,weekStart,weekly,stats,series,choices,kindName,setText,exportMarkdown,exportCsv,validate,merge};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.MeowModel=api;
})(typeof window!=='undefined'?window:globalThis);
