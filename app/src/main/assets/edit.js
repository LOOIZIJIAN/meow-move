(function(global){
'use strict';
// Full editing of the log: exercise fields, archive/merge/delete, session times and removal, and the
// tidy suggestions read from the data. Removals leave tombstones in state.removed so an import of an
// older backup does not bring them back.
const M=()=>typeof module!=='undefined'&&module.exports?require('./model.js'):global.MeowModel;
const KINDS=['recorded','total','side','body'];
const clone=v=>JSON.parse(JSON.stringify(v));
const used=(state,eid)=>[...state.sessions,...(state.active?[state.active]:[])].reduce((n,s)=>n+s.exercises.filter(e=>e.exerciseId===eid).reduce((k,e)=>k+e.sets.length,0),0);
const inActive=(state,eid)=>Boolean(state.active?.exercises.some(e=>e.exerciseId===eid));
function removed(state){state.removed=state.removed||{sessions:{},exercises:{}};state.removed.sessions=state.removed.sessions||{};state.removed.exercises=state.removed.exercises||{};return state.removed;}
function find(state,eid){const e=state.catalog.find(x=>x.id===eid);if(!e)throw Error('没有这个动作');return e;}

// Muscle and default weight mode; editedAt lets merge keep the newer edit.
function editExercise(state,eid,{muscle,defaultKind}={},now=Date.now()){const e=find(state,eid);let changed=false;
 if(muscle!==undefined&&muscle!==e.muscle){if(!M().MUSCLES.includes(muscle))throw Error('请选择部位');e.muscle=muscle;changed=true;}
 if(defaultKind!==undefined&&defaultKind!==e.defaultKind){if(!KINDS.includes(defaultKind))throw Error('请选择重量方式');e.defaultKind=defaultKind;changed=true;}
 if(changed)e.editedAt=now;return changed;}
function archive(state,eid,value=true,now=Date.now()){const e=find(state,eid);if(value&&inActive(state,eid))throw Error('这个动作在进行中的训练里，先完成训练再归档');e.archived=Boolean(value);e.editedAt=now;return e;}
// Only an exercise with no recorded set can disappear; the rest are archived or merged.
function removeExercise(state,eid,now=Date.now()){find(state,eid);const n=used(state,eid);if(n)throw Error(`已经记录过 ${n} 组，不能直接删除；先合并或归档`);if(inActive(state,eid))throw Error('这个动作在进行中的训练里');
 for(const t of state.templates||[])if(t.entries.some(e=>e.exerciseId===eid))throw Error('有训练模板用到这个动作，先从模板移除');
 for(const g of state.goals||[])if(g.exerciseIds.includes(eid))throw Error('有力量目标用到这个动作，先调整目标');
 state.catalog=state.catalog.filter(e=>e.id!==eid);if(state.exerciseSettings)delete state.exerciseSettings[eid];removed(state).exercises[eid]=now;return true;}
// Every set of `from` moves to `into`, keeping its own session; a session holding both keeps one entry.
function mergeExercise(state,from,into,now=Date.now()){if(from===into)throw Error('请选择另一个动作');find(state,from);find(state,into);let moved=0;
 for(const s of [...state.sessions,...(state.active?[state.active]:[])]){const a=s.exercises.find(e=>e.exerciseId===from);if(!a)continue;moved+=a.sets.length;const b=s.exercises.find(e=>e.exerciseId===into);
  if(b){b.sets.push(...a.sets);if(a.note)b.note=[b.note,a.note].filter(Boolean).join('；');s.exercises=s.exercises.filter(e=>e!==a);}else a.exerciseId=into;
  if(s===state.active){if(s.currentExerciseId===from)s.currentExerciseId=into;if(s.drafts){if(!s.drafts[into]&&s.drafts[from])s.drafts[into]=s.drafts[from];delete s.drafts[from];}if(s.superRounds)for(const r of Object.values(s.superRounds)){r.members=[...new Set(r.members.map(v=>v===from?into:v))];r.completed=[...new Set(r.completed.map(v=>v===from?into:v))];}}
  else s.modifiedAt=now;}
 for(const t of state.templates||[])if(t.entries.some(e=>e.exerciseId===from)){if(t.entries.some(e=>e.exerciseId===into))t.entries=t.entries.filter(e=>e.exerciseId!==from);else t.entries.forEach(e=>{if(e.exerciseId===from)e.exerciseId=into;});t.modifiedAt=now;}
 for(const g of state.goals||[])if(g.exerciseIds.includes(from)){g.exerciseIds=[...new Set(g.exerciseIds.map(v=>v===from?into:v))];g.modifiedAt=now;}
 if(state.exerciseSettings){if(!state.exerciseSettings[into]&&state.exerciseSettings[from])state.exerciseSettings[into]={...state.exerciseSettings[from],modifiedAt:now};delete state.exerciseSettings[from];}
 state.catalog=state.catalog.filter(e=>e.id!==from);removed(state).exercises[from]=now;return moved;}

const hm=v=>{const m=/^(\d{1,2}):(\d{2})$/.exec(v||'');if(!m||Number(m[1])>23||Number(m[2])>59)throw Error('时间格式是 时:分');return Number(m[1])*60+Number(m[2]);};
const at=(date,minutes)=>new Date(`${date}T${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}:00`).getTime();
// Date, start/end (HH:MM, end past midnight rolls to the next day), title and muscles of a saved workout.
function editSession(state,sid,{date,start,end,title,muscles}={},now=Date.now()){const s=state.sessions.find(x=>x.id===sid);if(!s)throw Error('没有这次训练');const next=clone(s);
 if(date!==undefined){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||M().day(new Date(date+'T12:00:00'))!==date)throw Error('日期无效');next.date=date;}
 if(title!==undefined){const t=String(title).trim();if(!t||t.length>100)throw Error('标题需要 1–100 个字');next.title=t;}
 if(muscles!==undefined){if(!Array.isArray(muscles)||!muscles.length||!muscles.every(m=>M().MUSCLES.includes(m)))throw Error('至少选一个部位');next.muscles=[...new Set(muscles)];}
 if(start!==undefined||end!==undefined){const t=M().timing(s),a=hm(start??t?.start),b=end===''||end==null&&!t?.end?null:hm(end??t.end);next.startedAt=at(next.date,a);next.endedAt=b===null?null:at(next.date,b)+(b<a?86400000:0);if(next.endedAt!==null&&next.endedAt-next.startedAt>12*3600000)throw Error('一次训练最长 12 小时');}
 else if(date!==undefined&&Number.isFinite(s.startedAt)){const shift=new Date(date+'T12:00:00')-new Date(s.date+'T12:00:00');next.startedAt+=shift;if(Number.isFinite(next.endedAt))next.endedAt+=shift;}
 next.modifiedAt=now;Object.assign(s,next);return s;}
function removeSessionExercise(state,sid,eid,now=Date.now()){const s=state.sessions.find(x=>x.id===sid);if(!s)throw Error('没有这次训练');if(s.exercises.length<2)throw Error('这是最后一个动作；要删就删除整次训练');s.exercises=s.exercises.filter(e=>e.exerciseId!==eid);s.modifiedAt=now;return s;}
function removeSession(state,sid,now=Date.now()){const s=state.sessions.find(x=>x.id===sid);if(!s)throw Error('没有这次训练');state.sessions=state.sessions.filter(x=>x!==s);removed(state).sessions[sid]=now;return s;}

// Suggestions only; nothing changes until the person taps one.
const LEG=/臀|hip|glute|abduct/i,BACK=/挺身|硬拉|划船|下拉|row|pull/i,SHOULDER=/推肩|肩推|侧平举|前平举|面拉|shoulder|lateral raise|overhead/i,CHEST=/卧推|推胸|飞鸟|chest|bench|fly/i;
const FIX=[[/\bcuel\b/i,'Curl'],[/\bhib\b/i,'Hip'],[/\bchess\b/i,'Chest'],[/\bsited\b/i,'Seated'],[/\bpess\b/i,'Press'],[/\bdeadlfit\b/i,'Deadlift'],[/\bsqaut\b/i,'Squat']];
const key=n=>M().norm(n).replace(/[\s\-_·.()（）]/g,'').replace(/^(器械|坐姿)/,'');
function tidy(state){const live=state.catalog.filter(e=>!e.archived),out={muscle:[],duplicate:[],unused:[],spelling:[]};
 for(const e of live){const n=e.name,to=SHOULDER.test(n)?'肩':CHEST.test(n)?'胸':LEG.test(n)?'臀':BACK.test(n)?'背':null;if(to&&e.muscle==='腿'&&to!==e.muscle)out.muscle.push({id:e.id,name:n,from:e.muscle,to,sets:used(state,e.id)});}
 const groups=new Map();for(const e of live){const k=key(e.name);groups.set(k,[...(groups.get(k)||[]),e]);}
 for(const g of groups.values())if(g.length>1){const ranked=g.map(e=>({id:e.id,name:e.name,sets:used(state,e.id)})).sort((a,b)=>b.sets-a.sets);out.duplicate.push({into:ranked[0],from:ranked.slice(1)});}
 for(const e of live)if(!used(state,e.id)&&!inActive(state,e.id))out.unused.push({id:e.id,name:e.name});
 for(const e of live){let next=e.name;for(const [re,v] of FIX)next=next.replace(re,w=>w[0]===w[0].toLowerCase()?v.toLowerCase():v);if(next!==e.name&&!state.catalog.some(x=>x.id!==e.id&&M().norm(x.name)===M().norm(next)))out.spelling.push({id:e.id,name:e.name,to:next});}
 out.count=out.muscle.length+out.duplicate.length+out.unused.length+out.spelling.length;return out;}

function validate(state){if(state.removed===undefined)return;const r=state.removed;if(!r||typeof r!=='object'||Array.isArray(r))throw Error('删除记录无效');for(const k of ['sessions','exercises']){const v=r[k]||{};if(typeof v!=='object'||Array.isArray(v)||!Object.values(v).every(Number.isFinite))throw Error('删除记录无效');}}
// Applied by MeowModel.merge after the plain merge: newer catalog edits win, tombstones from both sides hold.
function merge(out,incoming){for(const c of incoming.catalog){const old=out.catalog.find(e=>e.id===c.id);if(old&&(c.editedAt||0)>(old.editedAt||0)){old.muscle=c.muscle;old.defaultKind=c.defaultKind;old.archived=c.archived;old.editedAt=c.editedAt;}}
 const r=removed(out);for(const k of ['sessions','exercises'])for(const [id,t] of Object.entries(incoming.removed?.[k]||{}))r[k][id]=Math.max(r[k][id]||0,t);
 out.sessions=out.sessions.filter(s=>!r.sessions[s.id]||lastEdit(s)>r.sessions[s.id]);
 const keep=new Set([...out.sessions,...(out.active?[out.active]:[])].flatMap(s=>s.exercises.map(e=>e.exerciseId)));
 out.catalog=out.catalog.filter(e=>!r.exercises[e.id]||keep.has(e.id));
 for(const eid of Object.keys(out.exerciseSettings||{}))if(!out.catalog.some(e=>e.id===eid))delete out.exerciseSettings[eid];
 if(!Object.keys(r.sessions).length&&!Object.keys(r.exercises).length)delete out.removed;return out;}
const lastEdit=s=>Math.max(s.modifiedAt||0,...s.exercises.flatMap(e=>e.sets.map(x=>Math.max(x.editedAt||0,x.recordedAt||0))));

const api={KINDS,used,editExercise,archive,removeExercise,mergeExercise,editSession,removeSessionExercise,removeSession,tidy,validate,merge};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.MeowEdit=api;
})(typeof window!=='undefined'?window:globalThis);
