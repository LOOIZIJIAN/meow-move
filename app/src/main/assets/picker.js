(() => {
'use strict';
let active=null,sequence=0;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s).normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const definitions={
 'data-rest':['组后休息时长','timer'],
 'data-trend-exercise':['训练动作','dumbbell'],
 'data-trend-choice':['重量方式与握法','sliders-horizontal'],
 'new-muscle':['主要部位','heart'],
 'new-kind':['默认重量方式','weight'],
 'edit-kind':['重量方式','weight'],
 'export-format':['文件格式','file-text']
};
function definition(select){return definitions[select.id]||Object.entries(definitions).find(([key])=>select.hasAttribute(key))?.[1]||[select.getAttribute('aria-label')||'选项','list-filter'];}
function label(select){return select.selectedOptions[0]?.textContent||'暂无可选项';}
function refresh(select,button){button.querySelector('.mf-picker-value').textContent=label(select);button.setAttribute('aria-label',definition(select)[0]+'：'+label(select));button.disabled=select.disabled||!select.options.length;}
function close(restoreFocus=true){
 if(!active)return false;
 const current=active;active=null;
 current.overlay.remove();current.button.setAttribute('aria-expanded','false');
 for(const [node,inert] of current.background)node.inert=inert;
 document.body.style.overflow=current.overflow;
 if(restoreFocus&&current.button.isConnected)current.button.focus({preventScroll:true});
 return true;
}
function open(root,select,button){
 close(false);const [title,mark]=definition(select),options=[...select.options].filter(o=>!o.hidden),compact=select.hasAttribute('data-rest'),searchable=options.length>8&&!compact;
 const overlay=document.createElement('div'),id='mf-picker-'+(++sequence);
 overlay.className='mf-picker-overlay';
 overlay.innerHTML=`<section class="mf-picker-sheet${compact?' is-time-picker':''}" role="dialog" aria-modal="true" aria-labelledby="${id}-title"><div class="mf-picker-handle" aria-hidden="true"></div><div class="mf-picker-head"><span class="mf-picker-mark">${icon(mark)}</span><div><h2 id="${id}-title">选择${escape(title)}</h2><p>${compact?'下一组之前，给自己一点恢复时间':'点选一项，就为你记好'}</p></div><button class="mf-picker-close" type="button" aria-label="关闭选择面板">${icon('x')}</button></div>${searchable?`<label class="mf-picker-search">${icon('search')}<input type="search" placeholder="搜索${escape(title)}…" aria-label="搜索${escape(title)}" autocomplete="off"><button type="button" class="mf-picker-clear" aria-label="清空搜索" hidden>${icon('x')}</button></label>`:''}<div class="mf-picker-options" role="radiogroup" aria-label="${escape(title)}">${options.map(o=>`<button type="button" class="mf-picker-option" role="radio" aria-checked="${o.selected}" data-picker-value="${escape(o.value)}" ${o.disabled?'disabled':''}><span>${escape(o.textContent)}</span><span class="mf-picker-check" aria-hidden="true">${icon('check')}</span></button>`).join('')}</div><p class="mf-picker-empty" hidden>没有匹配的选项，换个关键词试试。</p></section>`;
 const background=[...root.children].map(node=>[node,node.inert]);for(const [node] of background)node.inert=true;
 active={root,select,button,overlay,background,overflow:document.body.style.overflow};
 document.body.style.overflow='hidden';button.setAttribute('aria-expanded','true');root.appendChild(overlay);
 window.lucide?.createIcons({attrs:{width:18,height:18,'stroke-width':2}});
 const chosen=overlay.querySelector('[aria-checked="true"]'),first=overlay.querySelector('.mf-picker-option:not(:disabled)');
 chosen?.scrollIntoView({block:'nearest'});(chosen&&!chosen.disabled?chosen:first||overlay.querySelector('.mf-picker-close')).focus({preventScroll:true});
 overlay.addEventListener('click',event=>{
  event.stopPropagation();
  if(event.target===overlay||event.target.closest('.mf-picker-close')){close();return;}
  if(event.target.closest('.mf-picker-clear')){const input=overlay.querySelector('input');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();return;}
  const option=event.target.closest('[data-picker-value]');if(!option||option.disabled)return;
  const key=select.dataset.pickerKey;
  select.value=option.dataset.pickerValue;refresh(select,button);close();
  select.dispatchEvent(new Event('change',{bubbles:true}));
  // Existing change handlers may redraw the page; focus the replacement control.
  root.querySelector(`[data-picker-trigger="${key}"]`)?.focus({preventScroll:true});
 });
 overlay.addEventListener('input',event=>{
  if(!event.target.matches('input'))return;
  event.stopPropagation();const query=normalize(event.target.value);
  overlay.querySelectorAll('.mf-picker-option').forEach(option=>option.hidden=!normalize(option.textContent).includes(query));
  overlay.querySelector('.mf-picker-clear').hidden=!query;
  overlay.querySelector('.mf-picker-empty').hidden=Boolean(overlay.querySelector('.mf-picker-option:not([hidden])'));
 });
}
function install(root){
 root.querySelectorAll('select:not([data-picker-ready])').forEach((select,index)=>{
  const key=select.id||[...select.attributes].find(a=>a.name.startsWith('data-'))?.name||'select-'+index;
  select.dataset.pickerReady='true';select.dataset.pickerKey=key;
  select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  const button=document.createElement('button');button.type='button';button.className='mf-picker-trigger'+(select.hasAttribute('data-rest')?' is-compact':'');
  button.dataset.pickerTrigger=key;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
  button.innerHTML=`<span class="mf-picker-value"></span><span class="mf-picker-chevron">${icon('chevron-down')}</span>`;
  select.after(button);refresh(select,button);
  button.addEventListener('click',event=>{event.preventDefault();open(root,select,button);});
 });
}
document.addEventListener('keydown',event=>{
 if(!active)return;
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
 const options=[...active.overlay.querySelectorAll('.mf-picker-option:not([hidden]):not(:disabled)')];
 if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&event.target.matches('.mf-picker-option')){
  event.preventDefault();let index=options.indexOf(event.target);
  index=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
  options[index]?.focus();return;
 }
 if(event.key==='Tab'){
  const nodes=[...active.overlay.querySelectorAll('button:not(:disabled),input')].filter(node=>!node.hidden&&!node.closest('[hidden]'));
  const first=nodes[0],last=nodes.at(-1);
  if(event.shiftKey&&event.target===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&event.target===last){event.preventDefault();first.focus();}
 }
});
window.MeowPicker={install,close,isOpen:()=>Boolean(active)};
})();
