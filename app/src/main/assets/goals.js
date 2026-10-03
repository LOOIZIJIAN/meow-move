(function(global){
'use strict';
// Progress is derived from saved sets on every read, so edits, imports and abandoned
// workouts cannot leave stale achievements behind. No predicted lift counts as a win.
const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const day=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const days=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const dateAt=(start,n)=>new Date(Date.parse(start+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const round=n=>Math.round(n*100)/100;
function validate(state){
 if(state.goals===undefined)return;
 if(!Array.isArray(state.goals)||state.goals.length>1000)throw Error('力量目标格式无效');
 const ids=new Set();
 for(const g of state.goals){
  if(!g||typeof g.id!=='string'||!g.id||ids.has(g.id)||!Array.isArray(g.exerciseIds)||!g.exerciseIds.length||new Set(g.exerciseIds).size!==g.exerciseIds.length||g.exerciseIds.some(id=>!state.catalog.some(e=>e.id===id&&e.muscle===g.muscle))||!['recorded','total','side'].includes(g.kind)||typeof g.variant!=='string'||g.variant.length>100||typeof g.title!=='string'||!g.title.trim()||g.title.length>100||typeof g.note!=='string'||g.note.length>2000||!Number.isFinite(g.targetWeight)||g.targetWeight<=0||g.targetWeight>5000||!Number.isInteger(g.targetReps)||g.targetReps<1||g.targetReps>1000||!dateOK(g.startDate)||!dateOK(g.deadline)||g.deadline<=g.startDate||!Number.isFinite(g.createdAt)||g.createdAt<0||!Number.isFinite(g.modifiedAt)||g.modifiedAt<0||typeof g.archived!=='boolean')throw Error('力量目标内容无效，请检查动作、重量、次数与日期');
  ids.add(g.id);
 }
}
function create(state,input,now=Date.now()){
 const old=(state.goals||[]).find(g=>g.id===input.id);
 const g={id:old?.id||input.id||global.crypto?.randomUUID?.()||`goal-${now}-${Math.random().toString(36).slice(2)}`,muscle:input.muscle,exerciseIds:[...input.exerciseIds],kind:input.kind,variant:(input.variant||'').trim(),title:input.title.trim(),note:(input.note||'').trim(),targetWeight:Number(input.targetWeight),targetReps:Number(input.targetReps),startDate:input.startDate,deadline:input.deadline,createdAt:old?.createdAt??now,modifiedAt:now,archived:old?.archived||false};
 validate({...state,goals:[...(state.goals||[]).filter(v=>v.id!==g.id),g]});return g;
}
function upsert(state,input,now=Date.now()){const g=create(state,input,now);state.goals=state.goals||[];const at=state.goals.findIndex(v=>v.id===g.id);if(at<0)state.goals.push(g);else state.goals[at]=g;return g;}
function archive(state,id,value=true,now=Date.now()){const g=(state.goals||[]).find(v=>v.id===id);if(!g)throw Error('找不到这个目标');g.archived=value;g.modifiedAt=now;}
function merge(local,incoming){const out=JSON.parse(JSON.stringify(local||[]));for(const g of incoming||[]){const at=out.findIndex(v=>v.id===g.id);if(at<0)out.push(JSON.parse(JSON.stringify(g)));else if(g.modifiedAt>out[at].modifiedAt)out[at]=JSON.parse(JSON.stringify(g));}return out;}
function matches(g,eid,set){return g.exerciseIds.includes(eid)&&set.kind===g.kind&&(set.variant||'')===g.variant&&!set.complex&&set.unit==='kg'&&Number.isFinite(set.weight)&&set.weight>0&&Number.isInteger(set.reps)&&set.reps>=g.targetReps;}
function progress(state,g,today=day()){
 const sessions=[...state.sessions,...(state.active?[state.active]:[])].filter(s=>s.date<=today).sort((a,b)=>a.date.localeCompare(b.date)||(a.startedAt||0)-(b.startedAt||0));
 const records=[],related=[];let excluded=0;
 for(const s of sessions){let muscleSets=0,matchedSets=0,candidateSets=0;
  for(const entry of s.exercises){const linked=g.exerciseIds.includes(entry.exerciseId),muscle=state.catalog.find(e=>e.id===entry.exerciseId)?.muscle===g.muscle;
   if(muscle||linked)muscleSets+=entry.sets.length;
   if(linked)entry.sets.forEach((set,index)=>{candidateSets++;if(matches(g,entry.exerciseId,set)){matchedSets++;records.push({date:s.date,weight:set.weight,reps:set.reps,sessionId:s.id,exerciseId:entry.exerciseId,setId:set.id||null,index,active:s.id===state.active?.id});}else excluded++;});
  }
  if(muscleSets||candidateSets||(s.muscles.includes(g.muscle)&&s.exercises.some(e=>e.sets.length)))related.push({sessionId:s.id,date:s.date,title:s.title,muscleSets,matchedSets,candidateSets,active:s.id===state.active?.id});
 }
 const bestOf=list=>list.reduce((best,r)=>!best||r.weight>best.weight||r.weight===best.weight&&r.reps>best.reps?r:best,null);
 const best=bestOf(records),prior=records.filter(r=>r.date<g.startDate),after=records.filter(r=>r.date>=g.startDate);
 const firstDate=after[0]?.date,baseline=bestOf(prior)||bestOf(after.filter(r=>r.date===firstDate));
 const attained=records.find(r=>r.weight>=g.targetWeight)||null,latestDate=records.at(-1)?.date,latest=bestOf(records.filter(r=>r.date===latestDate));
 const gap=best?round(Math.max(0,g.targetWeight-best.weight)):null,percent=best?round(Math.min(100,best.weight/g.targetWeight*100)):null;
 const duration=days(g.startDate,g.deadline),elapsed=Math.max(0,days(g.startDate,today)),daysLeft=days(today,g.deadline);
 const phase=baseline&&baseline.weight>=g.targetWeight?100:baseline?round(Math.max(0,Math.min(100,(best.weight-baseline.weight)/Math.max(.00001,g.targetWeight-baseline.weight)*100))):null;
 const expected=baseline&&baseline.weight<g.targetWeight?round(baseline.weight+(g.targetWeight-baseline.weight)*Math.min(1,elapsed/duration)):null;
 const status=attained?'achieved':today<g.startDate?'scheduled':daysLeft<0?'overdue':'active';
 const points=[];for(const r of records){let p=points.find(p=>p.date===r.date);if(!p){p={date:r.date,value:r.weight,sessionId:r.sessionId};points.push(p);}else if(r.weight>p.value){p.value=r.weight;p.sessionId=r.sessionId;}}
 const milestones=baseline&&baseline.weight<g.targetWeight?[.25,.5,.75,1].map((fraction,i)=>{
  const weight=i===3?g.targetWeight:round(baseline.weight+(g.targetWeight-baseline.weight)*fraction),date=dateAt(g.startDate,Math.round(duration*fraction)),reached=records.find(r=>r.weight>=weight)||null;
  return {weight,date,reached,final:i===3};
 }):[{weight:g.targetWeight,date:g.deadline,reached:attained,final:true}];
 const since=related.filter(s=>s.date>=g.startDate),last30=related.filter(s=>days(s.date,today)<30),goalDays=new Set(after.map(r=>r.date)).size;
 return {best,latest,baseline,attained,percent,phase,gap,status,daysLeft,expected,requiredPerWeek:gap!==null&&daysLeft>0?round(gap/(daysLeft/7)):null,gain:best&&baseline?round(Math.max(0,best.weight-baseline.weight)):null,points,milestones,related:[...related].reverse(),records,excluded,sessions:related.length,planSessions:since.length,planSets:since.reduce((n,s)=>n+s.muscleSets,0),goalDays,last30:last30.length,late:attained?attained.date>g.deadline:false};
}
function markdown(state,goals=state.goals||[],today=day()){
 const rows=['## 力量目标与自动追踪','达成标准：实际完成目标重量，且单组次数不少于目标次数；不使用估算最大力量。', '目标追踪使用截至今天的全部已保存记录（含训练中已保存的组），训练日志的导出日期筛选不影响目标状态。'];
 for(const g of goals.filter(g=>!g.archived)){const p=progress(state,g,today),names=g.exerciseIds.map(id=>state.catalog.find(e=>e.id===id)?.name||id).join(' / ');
  rows.push(`\n### ${g.title}`,`部位：${g.muscle}；关联动作：${names}；重量方式：${{total:'总重量',side:'单边重量',recorded:'按原记录重量'}[g.kind]}；握法：${g.variant||'未标记'}`,`计划：${g.startDate} 至 ${g.deadline}；目标：${g.targetWeight} kg × ${g.targetReps} 次`, `当前最好实际成绩：${p.best?`${p.best.weight} kg × ${p.best.reps} 次（${p.best.date}${p.best.active?'，本次训练中已保存的组':''}）`:'暂无符合次数和重量方式的记录'}`,`状态：${p.attained?`已达成（${p.attained.date}${p.late?'，晚于截止日':''}）`:p.status==='overdue'?'已到期，尚未达成':p.status==='scheduled'?'尚未开始':'进行中'}；目标重量进度：${p.percent===null?'未知':p.percent+'%'}；还差：${p.gap===null?'未知':p.gap+' kg'}`,`自动关联全部历史同部位训练：${p.sessions} 次；计划开始后的同部位训练：${p.planSessions} 次 / ${p.planSets} 组；符合目标规则的训练日：${p.goalDays} 天`, '阶段里程碑：'+p.milestones.map(m=>`${m.weight} kg × ${g.targetReps} 次，计划 ${m.date}，${m.reached?'实际达成 '+m.reached.date:'待达成'}`).join('；'));
  if(p.requiredPerWeek!==null&&!p.attained)rows.push(`按剩余日历时间均分差距：${p.requiredPerWeek} kg / 周（仅作目标进度参考，不是加重建议或达成预测）`);
  if(g.note)rows.push('计划备注：'+g.note);
 }
 return rows.join('\n')+'\n';
}
const api={dateOK,days,dateAt,validate,create,upsert,archive,merge,matches,progress,markdown};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.MeowGoals=api;
})(typeof window!=='undefined'?window:globalThis);
