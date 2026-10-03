const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../app/src/main/assets/model.js'),G=require('../app/src/main/assets/goals.js');
const fixture=()=>{const s=M.blank();s.catalog=[{id:'bench',name:'虚构卧推',muscle:'胸',defaultKind:'total'},{id:'alias',name:'虚构卧推旧名称',muscle:'胸',defaultKind:'total'},{id:'fly',name:'虚构夹胸',muscle:'胸',defaultKind:'recorded'},{id:'row',name:'虚构划船',muscle:'背',defaultKind:'total'}];return s;};
const set=(weight,reps=1,extra={})=>({id:M.id(),weight,reps,kind:'total',unit:'kg',restSec:120,complex:false,variant:'',...extra});
function add(s,id,date,sets,eid='bench',muscles=['胸']){s.sessions.push({id,date,title:'虚构训练 '+id,muscles,exercises:[{exerciseId:eid,sets}],startedAt:null,endedAt:null});}
const goal=(s,extra={})=>G.upsert(s,{title:'虚构卧推100kg',muscle:'胸',exerciseIds:['bench'],kind:'total',variant:'',targetWeight:100,targetReps:1,startDate:'2000-01-01',deadline:'2000-04-01',note:'',...extra},1000);

test('all chest training is linked while unrelated movements and weight bases do not count as bench strength',()=>{
 const s=fixture();add(s,'baseline','1999-12-20',[set(60,8)]);
 add(s,'press','2000-01-10',[set(80,3),set(105,1,{kind:'side'}),set(110,1,{variant:'反手'}),set(120,1,{unit:null}),set(130,1,{complex:true}),set(140,1,{weight:null})]);
 add(s,'fly','2000-01-12',[set(120)],'fly');add(s,'row','2000-01-13',[set(150)],'row',['背']);
 const g=goal(s),p=G.progress(s,g,'2000-02-01');assert.equal(p.sessions,3);assert.equal(p.planSessions,2);assert.equal(p.best.weight,80);assert.equal(p.gap,20);assert.equal(p.percent,80);assert.equal(p.gain,20);assert.equal(p.attained,null);assert.equal(p.excluded,5);assert.equal(p.phase,50);assert.equal(p.milestones.length,4);assert.deepEqual(p.milestones.map(m=>m.weight),[70,80,90,100]);assert.equal(p.milestones[1].reached.sessionId,'press');assert.equal(p.milestones[3].date,g.deadline);
});
test('actual completed repetitions qualify and estimates never substitute for the target',()=>{
 const s=fixture();add(s,'many-reps','2000-01-10',[set(90,10)]);const g=goal(s);assert.equal(G.progress(s,g,'2000-02-01').attained,null);
 add(s,'real-single','2000-02-02',[set(100,1)]);assert.equal(G.progress(s,g,'2000-02-02').attained.sessionId,'real-single');
 const five=goal(s,{targetReps:5});assert.equal(G.progress(s,five,'2000-02-02').best.weight,90);assert.equal(G.progress(s,five,'2000-02-02').attained,null);
 add(s,'real-five','2000-02-03',[set(100,5)]);assert.equal(G.progress(s,five,'2000-02-03').attained.sessionId,'real-five');
});
test('saved active sets count immediately, drafts do not, edits and abandonment revoke derived achievements',()=>{
 const s=fixture(),g=goal(s);M.begin(s,['胸'],['bench']);s.active.date='2000-02-01';s.active.draft={weight:100,reps:1,kind:'total',restSec:0,variant:''};
 assert.equal(G.progress(s,g,'2000-02-01').best,null);M.complete(s);assert.equal(G.progress(s,g,'2000-02-01').attained.active,true);
 s.active.exercises[0].sets[0].weight=95;assert.equal(G.progress(s,g,'2000-02-01').attained,null);s.active=null;assert.equal(G.progress(s,g,'2000-02-01').best,null);
});
test('historical success, late success and future-dated records are distinguished',()=>{
 const s=fixture();add(s,'future','2001-01-01',[set(200)]);const g=goal(s);assert.equal(G.progress(s,g,'2000-02-01').best,null);
 assert.equal(G.progress(s,g,'1999-12-31').status,'scheduled');assert.equal(G.progress(s,g,'2000-04-02').status,'overdue');
 add(s,'late','2000-04-02',[set(100)]);assert.equal(G.progress(s,g,'2000-04-02').late,true);
 add(s,'prior','1999-12-15',[set(105)]);const p=G.progress(s,g,'2000-04-02');assert.equal(p.attained.sessionId,'prior');assert.equal(p.late,false);assert.equal(p.phase,100);
});
test('missing and unmatched records remain unknown rather than zero',()=>{
 const s=fixture(),g=goal(s),p=G.progress(s,g,'2000-02-01');assert.equal(p.best,null);assert.equal(p.percent,null);assert.equal(p.gap,null);assert.equal(p.requiredPerWeek,null);assert.equal(p.baseline,null);assert.equal(p.milestones.length,1);
 assert(G.markdown(s,[g],'2000-02-01').includes('还差：未知'));
});
test('explicit aliases match only the selected exercise names and restore with goal definitions',()=>{
 const s=fixture();add(s,'old-name','1999-12-31',[set(65)],'alias');const g=goal(s);assert.equal(G.progress(s,g,'2000-02-01').best,null);
 const linked=G.upsert(s,{...g,exerciseIds:['bench','alias']},2000);assert.equal(G.progress(s,linked,'2000-02-01').best.weight,65);
 const restored=M.merge(fixture(),JSON.parse(JSON.stringify(s)),{restorePreferences:false}).state;assert.equal(restored.goals.length,1);assert.equal(G.progress(restored,restored.goals[0],'2000-02-01').best.weight,65);
 assert.equal(M.merge(restored,s).state.goals.length,1);
});
test('goal edits and archive state merge by modified time without resurrection from older backups',()=>{
 const s=fixture(),g=goal(s),old=M.clone(s);G.archive(s,g.id,true,5000);const current=M.merge(s,old).state;assert.equal(current.goals[0].archived,true);
 const restored=M.merge(old,current).state;assert.equal(restored.goals[0].archived,true);G.archive(restored,g.id,false,6000);assert.equal(restored.goals[0].archived,false);
 const legacy=fixture();delete legacy.goals;M.validate(legacy);assert.equal(M.merge(restored,legacy).state.goals.length,1);
});
test('invalid goal inputs fail before changing state',()=>{
 for(const extra of [{targetWeight:''},{targetReps:0},{kind:'body'},{deadline:'1999-12-01'},{deadline:'2000-02-31'},{exerciseIds:['row']},{exerciseIds:['bench','bench']},{exerciseIds:[]},{variant:'a'.repeat(101)}]){const s=fixture();assert.throws(()=>goal(s,extra));assert.deepEqual(s.goals,[]);}
});
test('calendar calculations cross leap dates and use the exact deadline',()=>{
 assert.equal(G.days('2000-02-28','2000-03-01'),2);assert.equal(G.dateAt('2000-02-28',1),'2000-02-29');
 const s=fixture();add(s,'first','1999-12-20',[set(60)]);const g=goal(s);const p=G.progress(s,g,'2000-03-25');assert.equal(p.daysLeft,7);assert.equal(p.requiredPerWeek,40);
 assert.equal(G.progress(s,g,g.deadline).status,'active');assert.equal(G.progress(s,g,'2000-04-02').requiredPerWeek,null);
});
test('AI Markdown contains target definitions, progress, milestones and comparison rules',()=>{
 const s=fixture();add(s,'a','1999-12-20',[set(70,5)]);goal(s);const md=M.exportMarkdown(s,'1999-12-20','1999-12-20');assert(md.includes('力量目标与自动追踪'));assert(md.includes('100 kg × 1 次'));assert(md.includes('70 kg × 5 次'));assert(md.includes('阶段里程碑'));assert(md.includes('总重量'));assert(md.includes('不使用估算最大力量'));
});
test('prevalidating a goal then saving it retains the detail-page identifier',()=>{
 const s=fixture(),input={title:'预先验证的目标',muscle:'胸',exerciseIds:['bench'],kind:'total',variant:'',targetWeight:100,targetReps:1,startDate:'2000-01-01',deadline:'2000-04-01',note:''};
 const prepared=G.create(s,input,1000),saved=G.upsert(s,prepared,1001);assert.equal(saved.id,prepared.id);assert.equal(s.goals.find(g=>g.id===prepared.id).targetWeight,100);
});

test('muscle labels also link contextual workouts without inventing same-muscle sets',()=>{
 const s=fixture();add(s,'tagged-chest','2000-02-01',[set(30)],'row',['胸','背']);const g=goal(s),p=G.progress(s,g,'2000-02-01');assert.equal(p.sessions,1);assert.equal(p.planSessions,1);assert.equal(p.planSets,0);assert.equal(p.best,null);
});
