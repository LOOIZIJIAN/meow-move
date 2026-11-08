(() => {
'use strict';
// 2.1 screens: full exercise settings, 动作整理, editing a saved workout, and today's AI plan.
// app.js hands over its state through ctx and calls dialog(), click() and the small render helpers.
const M=window.MeowModel,X=window.MeowEdit,P=window.MeowPlan,T=window.MeowTraining,ART=window.MeowArt,S=ART.S,tint=ART.tint;
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I=(n,size=17)=>`<i data-lucide="${n}" aria-hidden="true" style="width:${size}px;height:${size}px"></i>`;
const N=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
const KIND=[['recorded','原记录'],['total','总重量'],['side','单边'],['body','自重']];
const STATUS={done:['完成','ok'],partial:['部分','part'],skipped:['跳过','skip']};
let c;const D=()=>c.D,u=()=>c.u,cat=eid=>D().catalog.find(e=>e.id===eid);
const chips=(attr,list,value,was)=>`<div class="mf-filter-list mx-chips">${list.map(([v,l])=>`<button type="button" ${attr}="${E(v)}" aria-pressed="${v===value}"${v===was&&v!==value?' class="mx-was"':''}>${E(l)}</button>`).join('')}</div>`;
const pressed=(sel)=>[...c.root.querySelectorAll(sel+'[aria-pressed=true]')];
function init(ctx){c=ctx;}

// Exercise settings: muscle and weight mode on top of the 2.0 form, tidy actions below it.
function settingsTop(eid){const e=cat(eid);if(!e)return '';return `<span class="mx-label">部位</span>${chips('data-mx-muscle',M.MUSCLES.map(m=>[m,m]),e.muscle)}<span class="mx-label">重量方式（新建一组时默认）</span>${chips('data-mx-kind',KIND,e.defaultKind||'recorded')}<p class="mf-small mx-note" data-mx-muscle-note hidden></p>`;}
function settingsBottom(eid){const e=cat(eid);if(!e)return '';const n=X.used(D(),eid);
 return `<div class="mx-tools"><span class="mx-label">整理这个动作</span><button class="mf-secondary mx-wide" type="button" data-mx="mergePick">${S('repeat',26)}合并到另一个动作…</button><button class="mf-secondary mx-wide" type="button" data-mx="archive">${S('books',26)}${e.archived?'恢复到动作列表':'归档（不再出现在列表里）'}</button><button class="mx-danger" type="button" data-mx="removeExercise" ${n?'disabled':''}>${I('trash-2',16)}删除动作</button><p class="mf-small">${n?`已经记录过 ${n} 组，不能直接删除；先合并或归档。`:'从没记录过，可以删除。'}</p></div>`;}
function settingsValues(){const m=pressed('[data-mx-muscle]')[0],k=pressed('[data-mx-kind]')[0];return {muscle:m?.dataset.mxMuscle,defaultKind:k?.dataset.mxKind};}

function mergeList(eid){const e=cat(eid),q=M.norm(u().mxSearch||''),list=D().catalog.filter(x=>x.id!==eid&&!x.archived&&(!q||M.norm(x.name).includes(q))).sort((a,b)=>(b.muscle===e.muscle)-(a.muscle===e.muscle)||X.used(D(),b.id)-X.used(D(),a.id));
 return `<p class="mf-small">「${E(e.name)}」的 ${X.used(D(),eid)} 组会搬到你选的动作里，然后这个动作消失。目标和模板也跟着改。</p><input class="mf-search mx-search" data-mx-search type="search" placeholder="搜索动作" value="${E(u().mxSearch||'')}"><div class="mx-list">${list.slice(0,60).map(x=>`<button class="mx-row" type="button" data-mx-into="${E(x.id)}"><span class="mf-tile ${tint(x.muscle)}">${S(ART.exercise(D(),x),26)}</span><span class="mx-copy"><b>${E(x.name)}</b><small>${x.muscle} · ${X.used(D(),x.id)} 组</small></span>${I('chevron-right',16)}</button>`).join('')||'<p class="mf-small">没有找到</p>'}</div>`;}

function tidyBody(){const t=X.tidy(D());u().mxTidy=t;if(!t.count)return '<p class="mf-small">动作库很整齐，没有需要整理的地方。</p>';
 const row=(title,sub,label,key,soft)=>`<div class="mx-fix"><span class="mx-copy"><b>${E(title)}</b><small>${E(sub)}</small></span><button type="button" class="${soft?'mx-act is-soft':'mx-act'}" data-mx-tidy="${key}">${label}</button></div>`;
 const sec=(name,list,fn)=>list.length?`<span class="mx-label">${name} · ${list.length}</span>${list.map(fn).join('')}`:'';
 return `<p class="mf-small">从你的 ${D().sessions.length} 次训练里找出来的，只是建议。点了才改；改之前会自动存一个本机备份版本。</p>
 ${sec('疑似分错部位',t.muscle,(x,i)=>row(x.name,`${x.from} → ${x.to}${x.sets?' · '+x.sets+' 组一起改':''}`,'改成'+x.to,'muscle:'+i))}
 ${sec('疑似重复',t.duplicate,(g,i)=>row(g.from.map(x=>x.name).join('、')+' → '+g.into.name,`${g.from.reduce((n,x)=>n+x.sets,0)} 组搬到「${g.into.name}」`,'合并','duplicate:'+i))}
 ${t.unused.length?`<span class="mx-label">从没用过 · ${t.unused.length}</span>${t.unused.slice(0,u().mxUnusedAll?999:5).map((x,i)=>row(x.name,'0 组','归档','unused:'+i,true)).join('')}<div class="mf-inline-actions">${t.unused.length>5&&!u().mxUnusedAll?`<button class="mf-secondary" type="button" data-mx="unusedAll">再看 ${t.unused.length-5} 个</button>`:''}<button class="mf-secondary" type="button" data-mx="unusedArchive">全部归档</button></div>`:''}
 ${sec('可能拼错',t.spelling,(x,i)=>row(x.name,'→ '+x.to,'改名','spelling:'+i))}`;}

// Editing a saved workout. Typed values live in u.mxSession so removing an exercise does not lose them.
function sessionDraft(s){const t=M.timing(s);return {id:s.id,date:s.date,start:t?.start||'',end:t?.end||'',title:s.title,muscles:[...s.muscles]};}
function readSession(){const d=u().mxSession,v=id=>c.root.querySelector('#mx-'+id)?.value;if(!d)return d;for(const k of ['date','start','end','title']){const x=v(k);if(x!==undefined)d[k]=x;}const m=pressed('[data-mx-sess-muscle]');if(c.root.querySelector('[data-mx-sess-muscle]'))d.muscles=m.map(b=>b.dataset.mxSessMuscle);return d;}
function sessionBody(){const d=u().mxSession,s=D().sessions.find(x=>x.id===d?.id);if(!s)return '';const t=M.timing(s),sets=s.exercises.reduce((n,e)=>n+e.sets.length,0);
 return `<label class="mf-field">日期<input id="mx-date" type="date" value="${E(d.date)}"></label><div class="mf-date-grid"><label class="mf-field">开始<input id="mx-start" type="time" value="${E(d.start)}"></label><label class="mf-field">结束<input id="mx-end" type="time" value="${E(d.end)}"></label></div>${t?.minutes>180?`<p class="mf-small mx-warn">现在记的是 ${t.minutes} 分钟，可能当时忘了点完成。改成最后一组的时间就好。</p>`:''}<label class="mf-field">标题<input id="mx-title" type="text" maxlength="100" value="${E(d.title)}"></label><span class="mx-label">部位</span><div class="mf-filter-list mx-chips">${M.MUSCLES.map(m=>`<button type="button" data-mx-sess-muscle="${m}" aria-pressed="${d.muscles.includes(m)}">${m}</button>`).join('')}</div><span class="mx-label">动作 · ${s.exercises.length} 个 · ${sets} 组</span>${s.exercises.map(e=>`<div class="mx-fix"><span class="mf-tile ${tint(cat(e.exerciseId)?.muscle)}">${S(ART.exercise(D(),cat(e.exerciseId)),24)}</span><span class="mx-copy"><b>${E(cat(e.exerciseId)?.name)}</b><small>${e.sets.length} 组</small></span><button type="button" class="mx-act is-soft" data-mx-sess-remove="${E(e.exerciseId)}" ${s.exercises.length<2?'disabled':''}>移除</button></div>`).join('')}<button class="mf-primary mf-primary-full" type="button" data-mx="saveSession">保存</button><button class="mx-danger" type="button" data-mx="deleteSessionAsk">${I('trash-2',16)}删除这次训练</button><p class="mf-small">删除前会自动存一个本机备份版本，可以在 我的 → 历史备份版本 找回。</p>`;}

// Today's plan.
const GUIDE=`# 给 AI 的说明：帮我排喵练的今日计划

我用「喵练」记训练。它每次训练后会把全部记录写进我 Google Drive 里的 meow-move-backup.json。

请你：
1. 读 Drive 里的 meow-move-backup.json，看我最近的训练（sessions，每组有 weight/reps/kind），以及上次计划的完成度（sessions[].plan.result）和训练感受（sessions[].note）。
2. 按我的要求排今天的计划，写进 Drive 里的 meow-move-plan.json。文件已存在就**更新原文件**（不要新建同名文件，否则喵练读不到）。
3. 动作名尽量用备份 catalog 里已有的名字；新动作要写 muscle。

格式（只写 JSON）：
{
  "date": "YYYY-MM-DD",
  "title": "拉 · 背和二头",
  "note": "一句给我的话，比如为什么加重",
  "by": "Claude",
  "items": [
    {"exercise": "高位下拉", "sets": 4, "reps": "8-10", "weight": 57.5, "rest": 120},
    {"exercise": "面拉", "muscle": "肩", "sets": 3, "reps": 15}
  ]
}

字段：sets 1–30；reps 是数字或 "最少-最多"；weight 单位 kg，可省略；rest 是组间休息秒数；kind 可选 recorded/total/side/body（原记录/总重量/单边/自重）；muscle 只能是 胸/背/腿/肩/二头/三头/臀/小腿/核心。`;
function planStatus(){try{return c.A?JSON.parse(c.A.planStatus()):{connected:false};}catch(e){return {connected:false};}}
function planCard(){const a=P.today(D());if(!a||a.status!=='new'||D().active)return '';const p=a.plan;
 return `<section class="mx-plan" aria-label="今日计划"><div class="mx-plan-top"><span class="mx-ai">${S('paw',18)}${E(p.by)} 排的${p.date!==M.day()?' · '+E(p.date):''}</span><button type="button" class="mf-text-button" data-mx="planDismiss" aria-label="今天不用这个计划">${I('x',14)}</button></div><h3>${E(p.title)}</h3>${p.note?`<p class="mf-small">${E(p.note)}</p>`:''}<div class="mx-plan-items">${p.items.map(x=>`<div><span class="mf-tile ${tint(x.muscle)}">${S(ART.exercise(D(),cat(x.exerciseId)||{name:x.name,muscle:x.muscle}),22)}</span><span>${E(x.name)}${x.exerciseId?'':' <em>新</em>'}</span><b>${x.sets}×${x.minReps===x.maxReps?x.minReps:x.minReps+'–'+x.maxReps}${x.weight!=null?' @ '+N(x.weight):''}</b></div>`).join('')}</div><button class="mf-primary mf-primary-full" type="button" data-mx="planStart">${I('play',18)}开始这个计划</button></section>`;}
function planPanel(){const s=planStatus(),a=D().aiPlan;return `<div class="mf-report-panel"><h3>AI 今日计划</h3><p class="mf-small">让手机上的 AI（比如 Claude）读你的 Drive 备份，把今天的计划写进 meow-move-plan.json。喵练每次打开都会读它，练完的完成度写回备份，AI 下次就能看到。</p>${s.connected?`<div class="mf-cloud-note" style="margin:10px 0"><strong>${E(s.name||'meow-move-plan.json')}</strong><br>${s.readAt?'最近读取：'+new Date(s.readAt).toLocaleString('zh-CN'):'等待首次读取'}${s.error?'<br>'+E(s.error):''}${a?`<br>当前计划：${E(a.plan.title)} · ${{new:'等你开始',started:'进行中',done:'已练完',dismissed:'已跳过'}[a.status]}`:''}</div>`:''}<div class="mf-inline-actions"><button class="mf-secondary" type="button" data-mx="planChoose">${I('folder-open',16)}${s.connected?'更换计划文件':'选择计划文件'}</button><button class="mf-secondary" type="button" data-mx="planPaste">${I('clipboard-paste',16)}粘贴计划</button></div><button class="mf-secondary mx-wide" type="button" data-mx="planGuide">${I('share-2',16)}把格式说明发给 AI</button>${s.connected?'<button class="mf-text-button" type="button" data-mx="planDisconnect">不再读取计划文件</button>':''}</div>`;}
function tidyRow(){const n=X.tidy(D()).count;return `<button class="mf-menu-row" data-mx="tidy"><span class="mf-menu-icon">${I('sparkles',22)}</span><div><strong>动作整理</strong><span class="mf-small">${n?n+' 条建议 · 分错部位、重复、拼错':'动作库很整齐'}</span></div>${I('chevron-right',16)}</button>`;}
function result(s){const r=s.plan?.result;if(!r)return '';return `<div class="mf-report-panel mx-result"><div class="mx-ring" style="--p:${r.percent}"><b>${r.percent}%</b><small>计划完成度</small></div><div class="mx-result-list">${r.items.map(x=>`<div><span>${E(cat(x.exerciseId)?.name||x.name)}</span><span class="mx-tag is-${STATUS[x.status][1]}">${x.status==='skipped'?'跳过':`${x.full}/${x.planned}${x.done>x.planned?' · 多做 '+(x.done-x.planned)+' 组':x.status==='partial'&&x.done>x.full?' · 次数没到':''}`}</span></div>`).join('')}${r.extra.length?`<p class="mf-small">计划外：${r.extra.map(x=>E(cat(x.exerciseId)?.name)+' '+x.done+' 组').join('、')}</p>`:''}</div><p class="mf-small">${E(s.plan.title)} · ${E(s.plan.by)} 排的。完成度已写进备份，AI 下次读得到。</p></div>`;}
function target(entry){const p=entry?.plan;return p&&Number.isFinite(p.weight)?' @ '+N(p.weight)+' kg':'';}

// Called with fresh text from the plan file or a paste. A file read at resume is quiet unless it is new.
function receive(text,{fresh=false,paste=false}={}){let plan;const before=M.clone(D());try{plan=P.receive(D(),text);}catch(e){c.D=before;if(fresh||paste)c.toast('计划读不懂：'+e.message);return false;}
 if(!plan){if(fresh||paste)c.toast('已经是这份计划了');return false;}c.write(true);c.toast('收到今日计划：'+plan.title);if(c.u.route==='home'||c.u.modal==='mxPlanPaste'){c.u.modal=null;c.render();}return true;}

function dialog(){const m=u().modal;
 if(m==='mxMerge')return {title:'合并到哪个动作？',body:mergeList(u().settingsExercise)};
 if(m==='mxMergeConfirm'){const a=cat(u().settingsExercise),b=cat(u().mxInto);return {title:'确认合并',body:`<p>「${E(a?.name)}」的 ${X.used(D(),a?.id)} 组会搬到「${E(b?.name)}」，之后只剩「${E(b?.name)}」。改之前自动存一个本机备份版本。</p><button class="mf-primary mf-primary-full" type="button" data-mx="mergeConfirm">合并</button>`};}
 if(m==='mxRemoveExercise'){const a=cat(u().settingsExercise);return {title:'删除动作？',body:`<p>「${E(a?.name)}」从没记录过，删掉后不会出现在动作库里。</p><button class="mx-danger" type="button" data-mx="removeExerciseConfirm">${I('trash-2',16)}删除</button>`};}
 if(m==='mxTidy')return {title:'动作整理',body:tidyBody()};
 if(m==='mxSession')return {title:'编辑这次训练',body:sessionBody()};
 if(m==='mxSessionDelete'){const s=D().sessions.find(x=>x.id===u().mxSession?.id);return {title:'删除这次训练？',body:`<p>${E(s?.date)} · ${E(s?.title)}，${s?.exercises.reduce((n,e)=>n+e.sets.length,0)} 组会从历史、趋势和目标里移除。删除前自动存一个本机备份版本。</p><button class="mx-danger" type="button" data-mx="deleteSession">${I('trash-2',16)}确认删除</button>`};}
 if(m==='mxPlanPaste')return {title:'粘贴今日计划',body:`<p class="mf-small">把 AI 给你的计划 JSON 整段粘贴进来。</p><textarea class="mf-note-input mx-paste" id="mx-paste" rows="9" placeholder='{"title":"拉 · 背和二头","items":[…]}'></textarea><button class="mf-primary mf-primary-full" type="button" data-mx="planPasteSave">读取计划</button>`};
 return null;}

function run(fn,{critical=true}={}){return c.mutate(fn,critical);}
function act(name){const s=u();
 if(name==='mergePick'){s.mxSearch='';s.modal='mxMerge';c.render();return;}
 if(name==='mergeConfirm'){let n;if(run(()=>{n=X.mergeExercise(D(),s.settingsExercise,s.mxInto);})){const to=cat(s.mxInto)?.name;s.modal=null;c.render();c.toast(`已合并：${n} 组搬到「${to}」`);}return;}
 if(name==='archive'){const e=cat(s.settingsExercise);if(run(()=>X.archive(D(),e.id,!e.archived))){s.modal=s.settingsReturn==='library'?'library':null;c.render();c.toast(e.archived?'已归档，历史记录还在':'已恢复到动作列表');}return;}
 if(name==='removeExercise'){s.modal='mxRemoveExercise';c.render();return;}
 if(name==='removeExerciseConfirm'){if(run(()=>X.removeExercise(D(),s.settingsExercise))){s.modal=s.settingsReturn==='library'?'library':null;c.render();c.toast('动作已删除');}return;}
 if(name==='tidy'){s.mxUnusedAll=false;s.modal='mxTidy';c.render();return;}
 if(name==='unusedAll'){s.mxUnusedAll=true;c.render();return;}
 if(name==='unusedArchive'){const list=s.mxTidy?.unused||[];if(list.length&&run(()=>list.forEach(x=>X.archive(D(),x.id)))){c.render();c.toast(`${list.length} 个动作已归档，随时可以在动作设置里恢复`);}return;}
 if(name==='editSession'){s.mxSession=sessionDraft(D().sessions.find(x=>x.id===s.detail));s.modal='mxSession';c.render();return;}
 if(name==='saveSession'){const d=readSession();try{const test=M.clone(D());X.editSession(test,d.id,d);M.validate(test);}catch(e){c.error(e.message);return;}if(run(()=>X.editSession(D(),d.id,d))){s.modal=null;c.render();c.toast('训练已更新');}return;}
 if(name==='deleteSessionAsk'){readSession();s.modal='mxSessionDelete';c.render();return;}
 if(name==='deleteSession'){if(run(()=>X.removeSession(D(),s.mxSession.id))){s.modal=null;s.mxSession=null;c.route('history');c.toast('这次训练已删除，备份版本里还能找回');}return;}
 if(name==='planStart'){const a=P.today(D());if(a&&run(()=>P.start(D(),a.plan))){s.padField=null;s.padFresh=true;c.route('session');}return;}
 if(name==='planDismiss'){if(run(()=>P.dismiss(D()))){c.render();c.toast('好的，今天自己安排');}return;}
 if(name==='planChoose'){if(c.A)c.A.choosePlan();else c.toast('请在手机上选择 Drive 里的计划文件');return;}
 if(name==='planDisconnect'){c.A?.disconnectPlan();setTimeout(c.render,150);return;}
 if(name==='planPaste'){s.modal='mxPlanPaste';c.render();return;}
 if(name==='planPasteSave'){const v=c.root.querySelector('#mx-paste')?.value||'';try{P.parse(v,D());}catch(e){c.error(e.message);return;}receive(v,{paste:true});return;}
 if(name==='planGuide'){c.deliver('meow-move-plan-guide.md','text/markdown',GUIDE,true);return;}
}
function tidyAct(key){const [kind,i]=key.split(':'),t=u().mxTidy,x=t?.[kind]?.[Number(i)];if(!x)return;let msg='';
 const ok=run(()=>{if(kind==='muscle'){X.editExercise(D(),x.id,{muscle:x.to});msg=`${x.name} 改到「${x.to}」`;}
  if(kind==='duplicate'){let n=0;for(const f of x.from)n+=X.mergeExercise(D(),f.id,x.into.id);msg=`已合并进「${x.into.name}」· ${n} 组`;}
  if(kind==='unused'){X.archive(D(),x.id);msg=x.name+' 已归档';}
  if(kind==='spelling'){M.rename(D(),x.id,x.to);msg='已改名为 '+x.to;}});
 if(ok){c.render();c.toast(msg);}}
// Returns true when the button belonged to this module.
function click(b){const d=b.dataset;
 if(d.mxMuscle||d.mxKind||d.mxSessMuscle){const attr=d.mxMuscle?'data-mx-muscle':d.mxKind?'data-mx-kind':'data-mx-sess-muscle';
  if(attr==='data-mx-sess-muscle')b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));
  else{for(const x of c.root.querySelectorAll(`[${attr}]`))x.setAttribute('aria-pressed',String(x===b));}
  if(d.mxMuscle){const e=cat(u().settingsExercise),n=X.used(D(),e?.id),note=c.root.querySelector('[data-mx-muscle-note]');if(note){note.hidden=d.mxMuscle===e.muscle||!n;note.textContent=`保存后，过去 ${n} 组都算进「${d.mxMuscle}」：趋势、每周组数和目标一起更新。`;}}
  window.MeowFeel?.haptic?.('tick');return true;}
 if(d.mxInto){u().mxInto=d.mxInto;u().modal='mxMergeConfirm';c.render();return true;}
 if(d.mxTidy){tidyAct(d.mxTidy);return true;}
 if(d.mxSessRemove){readSession();const eid=d.mxSessRemove,name=cat(eid)?.name;if(run(()=>X.removeSessionExercise(D(),u().mxSession.id,eid))){c.render();c.toast(`已移除「${name}」`);}return true;}
 if(d.mx){act(d.mx);return true;}
 return false;}
function input(t){if(t.hasAttribute('data-mx-search')){u().mxSearch=t.value;const pos=t.selectionStart;c.render();const n=c.root.querySelector('[data-mx-search]');n?.focus();try{n?.setSelectionRange(pos,pos);}catch(e){}return true;}return false;}

window.MeowEditUI={init,settingsTop,settingsBottom,settingsValues,planCard,planPanel,tidyRow,result,target,receive,dialog,click,input,GUIDE};
})();
