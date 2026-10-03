(function(global){
'use strict';
// 质感 layer approved in work/ui-lab: haptics, paw stamps, dial ruler, responsive cats, record
// celebration, rest finale and the jelly nav pill. Purely presentational: it never mutates data
// except by dispatching the same input events a person would type.
let A=null,prefs=()=>({});
const reduce=()=>global.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const PATTERN={tick:8,soft:14,confirm:[12,40,22],success:[16,45,24,45,44],heavy:42,purr:[5,40,5,40,5,40,5]};
let lastTick=0;
function haptic(kind){
  if(prefs().haptics===false)return;const now=performance.now();if(kind==='tick'){if(now-lastTick<28)return;lastTick=now;}
  try{if(A&&A.haptic)A.haptic(kind);else if(navigator.vibrate)navigator.vibrate(PATTERN[kind]);}catch(e){}
}
const SPRITE='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="mf-ink" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="1.6"/></filter><symbol id="mf-paw" viewBox="0 0 40 40"><ellipse cx="20" cy="24.6" rx="6.4" ry="5.2"/><ellipse cx="12.8" cy="17.6" rx="2.6" ry="3.1" transform="rotate(-18 12.8 17.6)"/><ellipse cx="17.4" cy="13.2" rx="2.6" ry="3.2" transform="rotate(-6 17.4 13.2)"/><ellipse cx="22.6" cy="13.2" rx="2.6" ry="3.2" transform="rotate(6 22.6 13.2)"/><ellipse cx="27.2" cy="17.6" rx="2.6" ry="3.1" transform="rotate(18 27.2 17.6)"/></symbol></svg>';
// Stable per-set tilt so a stamp keeps its angle across re-renders.
function seal(id,fresh){let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))|0;const r=-18+Math.abs(h)%25;
  return `<span class="mf-seal${fresh?' is-new':''}" style="--r:${r}deg" aria-hidden="true"><svg viewBox="0 0 40 40"><g filter="url(#mf-ink)" fill="currentColor"><circle cx="20" cy="20" r="17.2" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="20" cy="20" r="13.6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2.3"/><use href="#mf-paw" transform="translate(3.6 3.4) scale(.82)"/></g></svg></span>`;}

// Odometer digits: changed characters roll in the direction of change.
function roll(el,text,dir){
  const old=[...el.querySelectorAll(':scope>.mf-cell>.mf-d:not(.old)')].map(s=>s.textContent);el.textContent='';
  [...text].forEach((c,i)=>{const cell=document.createElement('span');cell.className='mf-cell';const d=document.createElement('span');d.className='mf-d';d.textContent=c;cell.append(d);
    const prev=old[i-(text.length-old.length)];
    if(dir&&!reduce()&&prev!==c){if(prev!==undefined){const o=document.createElement('span');o.className='mf-d old';o.textContent=prev;cell.append(o);o.animate([{transform:'none',opacity:1},{transform:`translateY(${-dir*70}%)`,opacity:0}],{duration:200,easing:'ease-in',fill:'forwards'}).onfinish=()=>o.remove();}
      d.animate([{transform:`translateY(${dir*70}%)`,opacity:0},{transform:'none',opacity:1}],{duration:300,easing:'cubic-bezier(.2,1.35,.4,1)'});}
    el.append(cell);});
}
const shown=v=>v===''||v==null?'—':String(v);
const fmt=v=>String(Number(v.toFixed(2)));

// 02 Number boxes: odometer overlay on the real input (tap still opens the keyboard) and a drag ruler.
const lastValue={};
function numberBox(box){
  const input=box.querySelector('input[data-draft]');if(!input||input.disabled)return;
  const field=input.dataset.draft,step=field==='reps'?1:2.5,px=field==='reps'?15:13,min=field==='reps'?1:0,max=field==='reps'?1000:5000,every=field==='reps'?5:4;
  const out=document.createElement('div');out.className='mf-roll';out.setAttribute('aria-hidden','true');input.after(out);box.classList.add('has-roll');
  // Sit exactly over the input; the app shrinks this font on narrow screens.
  out.style.top=input.offsetTop+'px';out.style.height=input.offsetHeight+'px';out.style.fontSize=getComputedStyle(input).fontSize;
  const prev=lastValue[field],now=input.value;roll(out,shown(now),prev!==undefined&&prev!==now&&prev!==''&&now!==''?(Number(now)>Number(prev)?1:-1):0);lastValue[field]=now;
  input.addEventListener('input',()=>{const dir=Number(input.dataset.feelDir||0);delete input.dataset.feelDir;roll(out,shown(input.value),dir);lastValue[field]=input.value;});
  const ruler=document.createElement('div');ruler.className='mf-ruler';ruler.setAttribute('aria-hidden','true');const track=document.createElement('div');track.className='mf-ruler-track';ruler.append(track);out.after(ruler);
  // Each detent equals one tap of the +/- buttons, counted from the value the drag started on.
  let base=0,n=0,drag=null,raf=0;
  const build=()=>{base=Number(input.value)||min;n=0;track.textContent='';for(let k=-40;k<=40;k++){const v=base+k*step;if(v<min-1e-9||v>max+1e-9)continue;const t=document.createElement('i');if(k%every===0){t.className='major';t.dataset.l=fmt(v);}t.style.left=k*px+'px';track.append(t);}};
  const place=off=>{track.style.transform=`translateX(${ruler.clientWidth/2+off}px)`;};
  const commit=k=>{k=Math.max(Math.ceil((min-base)/step-1e-9),Math.min(Math.floor((max-base)/step+1e-9),k));if(k===n)return k;const dir=k>n?1:-1;n=k;input.dataset.feelDir=dir;input.value=fmt(base+k*step);input.dispatchEvent(new Event('input',{bubbles:true}));haptic('tick');return k;};
  build();place(0);
  ruler.addEventListener('pointerdown',e=>{cancelAnimationFrame(raf);build();place(0);drag={x:e.clientX,lx:e.clientX,lt:e.timeStamp,v:0};ruler.setPointerCapture(e.pointerId);ruler.classList.add('is-dragging');});
  ruler.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;commit(Math.round(-dx/px));place(dx);const dt=e.timeStamp-drag.lt;if(dt>0){drag.v=.75*((e.clientX-drag.lx)/dt)+.25*drag.v;drag.lx=e.clientX;drag.lt=e.timeStamp;}});
  const end=()=>{if(!drag)return;let off=drag.lx-drag.x,v=Math.max(-1.2,Math.min(1.2,drag.v))*10;drag=null;ruler.classList.remove('is-dragging');
    const glide=()=>{v*=.88;off+=v;const k=commit(Math.round(-off/px));if(k!==Math.round(-off/px))v=0;place(off);if(Math.abs(v)>.4&&!reduce())raf=requestAnimationFrame(glide);else snap(off,-n*px);};raf=requestAnimationFrame(glide);};
  const snap=(from,to)=>{const t0=performance.now();const go=t=>{const k=Math.min(1,(t-t0)/200),e=1-Math.pow(1-k,3);place(from+(to-from)*e);if(k<1)raf=requestAnimationFrame(go);};raf=requestAnimationFrame(go);};
  ruler.addEventListener('pointerup',end);ruler.addEventListener('pointercancel',end);
}

// 03 Cats: breathe, tap squish with hearts, long-press purr. Decorative only.
const LINES=['喵！再来一组','今天也很帅','手感不错嘛','收到，记下啦','呼——深呼吸','你比昨天更强'];let line=0;
function layer(){let l=document.getElementById('mf-feel-layer');if(!l){l=document.createElement('div');l.id='mf-feel-layer';document.body.append(l);}return l;}
function at(el){const r=el.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height};}
function bubble(el,text,hold){const p=at(el),b=document.createElement('div');b.className='mf-feel-bubble'+(hold?' is-hold':'');b.textContent=text;b.style.left=p.x+p.w*.5+'px';b.style.top=p.y+Math.min(10,p.h*.05)+'px';
  document.querySelectorAll('.mf-feel-bubble').forEach(x=>x.remove());layer().append(b);if(!hold)setTimeout(()=>b.remove(),1750);return b;}
const HEART='<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 5 6.4 5c2 0 3.4 1.1 4.1 2.3h3C14.2 6.1 15.6 5 17.6 5 21 5 23.1 8.5 21.6 11.8 19.5 16.4 12 21 12 21z"/></svg>';
function hearts(el,n){if(reduce())return;const p=at(el);for(let i=0;i<n;i++){const f=document.createElement('span'),s=13+Math.random()*11;f.className='mf-feel-float';f.style.cssText=`left:${p.x+p.w*(.3+Math.random()*.4)-s/2}px;top:${p.y+p.h*.35}px;width:${s}px;height:${s}px;color:${['#e57c6a','#f2a65a','#e8899b','#d9a05b'][i%4]}`;
  f.innerHTML=i%2?'<svg viewBox="0 0 40 40"><use href="#mf-paw"/></svg>':HEART;layer().append(f);const dx=(Math.random()-.5)*110,dy=-60-Math.random()*60;
  f.animate([{transform:'scale(.4)',opacity:0},{transform:`translate(${dx*.4}px,${dy*.4}px) scale(1.1) rotate(${dx/6}deg)`,opacity:1,offset:.25},{transform:`translate(${dx}px,${dy}px) scale(.9) rotate(${dx/3}deg)`,opacity:0}],{duration:1100+Math.random()*400,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>f.remove();}}
function hop(el){if(!el)return;el.classList.remove('is-squish');void el.offsetWidth;el.classList.add('is-squish');setTimeout(()=>el.classList.remove('is-squish'),560);}
function liven(img){
  img.classList.add('mf-live-cat');img.draggable=false;img.addEventListener('contextmenu',e=>e.preventDefault());
  let hold=0,purr=0,purring=false,down=0;
  const stop=()=>{clearTimeout(hold);if(!purring)return;purring=false;clearInterval(purr);img.classList.remove('is-purr');document.querySelectorAll('.mf-feel-bubble').forEach(x=>x.remove());hearts(img,6);bubble(img,'舒服～');};
  img.addEventListener('pointerdown',()=>{down=performance.now();hold=setTimeout(()=>{purring=true;img.classList.add('is-purr');bubble(img,'呼噜呼噜……',true);haptic('purr');purr=setInterval(()=>{haptic('purr');hearts(img,1);},760);},420);});
  img.addEventListener('pointerup',()=>{if(purring){stop();return;}clearTimeout(hold);if(performance.now()-down<420){hop(img);hearts(img,5);bubble(img,LINES[line++%LINES.length]);haptic('soft');}});
  img.addEventListener('pointercancel',stop);img.addEventListener('pointerleave',stop);
}
function tilt(room){const img=room.querySelector('img');if(!img)return;room.addEventListener('pointermove',e=>{if(img.classList.contains('is-purr'))return;const r=room.getBoundingClientRect(),k=(e.clientX-r.left)/r.width-.5;img.style.translate=`${k*12}px 0`;img.style.rotate=`${k*8}deg`;});room.addEventListener('pointerleave',()=>{img.style.translate='';img.style.rotate='';});}

// 04 Record celebration: gold card drops in at the top, confetti, then floats away. Never blocks taps.
let canvas=null,ctx=null,parts=[],craf=0;
function sizeCanvas(){const d=devicePixelRatio||1;canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);}
const shapes=[(c)=>{ctx.beginPath();ctx.ellipse(0,0,7,4.2,0,0,Math.PI*2);ctx.moveTo(5,0);ctx.lineTo(11,-4.5);ctx.lineTo(11,4.5);ctx.closePath();ctx.fillStyle=c;ctx.fill();ctx.fillStyle='#fff6';ctx.beginPath();ctx.arc(-3.4,-1,1.1,0,Math.PI*2);ctx.fill();},
  (c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(0,2.6,4,3.3,0,0,Math.PI*2);ctx.fill();for(const [x,y] of [[-4.6,-2],[-1.6,-4.6],[1.6,-4.6],[4.6,-2]]){ctx.beginPath();ctx.ellipse(x,y,1.5,1.9,0,0,Math.PI*2);ctx.fill();}},
  (c)=>{ctx.fillStyle=c;ctx.beginPath();for(let i=0;i<8;i++){const r=i%2?2.2:7,a=i*Math.PI/4;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();}];
function burst(x,y,n){if(reduce())return;if(!canvas){canvas=document.createElement('canvas');canvas.className='mf-feel-confetti';document.body.append(canvas);ctx=canvas.getContext('2d');addEventListener('resize',sizeCanvas);}sizeCanvas();
  const cols=['#e9a45b','#f3c47a','#d98b6a','#f0b59a','#9fd0a9','#ffd56b'];for(let i=0;i<n;i++){const a=-Math.PI/2+(Math.random()-.5)*Math.PI*1.25,s=5+Math.random()*7;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:Math.random()*6,vr:(Math.random()-.5)*.35,k:i%3,c:cols[i%cols.length],life:0,max:70+Math.random()*40,sc:.8+Math.random()*.6});}
  if(!craf)craf=requestAnimationFrame(frame);}
function frame(){ctx.clearRect(0,0,innerWidth,innerHeight);parts=parts.filter(p=>p.life<p.max);for(const p of parts){p.life++;p.vy+=.28;p.vx*=.985;p.vy*=.985;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;ctx.save();ctx.globalAlpha=Math.min(1,(p.max-p.life)/20);ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.scale(p.sc,p.sc);shapes[p.k](p.c);ctx.restore();}craf=parts.length?requestAnimationFrame(frame):0;}
function celebrate({label,value,unit,note}){
  haptic('success');document.querySelectorAll('.mf-feel-pr').forEach(x=>x.remove());
  const card=document.createElement('div');card.className='mf-feel-pr';card.setAttribute('role','status');
  card.innerHTML=`<span class="mf-feel-ribbon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.6 3.3a.5.5 0 0 1 .8 0l2.9 4.1a1 1 0 0 0 1.5.2l3-2.6a.5.5 0 0 1 .8.5L18.8 15H5.2L3.4 5.5a.5.5 0 0 1 .8-.5l3 2.6a1 1 0 0 0 1.5-.2z"/><path d="M5 19h14"/></svg>新纪录</span><div class="mf-feel-pr-label"></div><div class="mf-feel-pr-value"><b></b><span></span></div><div class="mf-feel-pr-note"></div>`;
  card.querySelector('.mf-feel-pr-label').textContent=label;card.querySelector('b').textContent=value;card.querySelector('.mf-feel-pr-value span').textContent=unit;card.querySelector('.mf-feel-pr-note').textContent=note;
  document.body.append(card);requestAnimationFrame(()=>{const r=card.getBoundingClientRect();burst(r.left+r.width*.72,r.top+30,52);});
  hop(document.querySelector('.mf-exercise-hero img'));setTimeout(()=>{card.classList.add('is-leaving');setTimeout(()=>card.remove(),420);},2600);
}

// 05 Rest finale on the timer dial and the session rest card.
let lastSec=-1;
function rest(t,ms){
  const running=t.status==='running',sec=Math.ceil(ms/1000),hot=running&&sec<=5&&sec>0;
  const dial=document.querySelector('.mf-rest-dial');
  if(dial){let r=dial.querySelector('.mf-rest-rider');if(!r){r=document.createElement('span');r.className='mf-rest-rider';r.setAttribute('aria-hidden','true');dial.append(r);}
    const f=t.durationSec?Math.max(0,Math.min(1,ms/(t.durationSec*1000))):0,a=f*2*Math.PI,s=dial.clientWidth/248;r.style.left=(124+Math.sin(a)*104)*s+'px';r.style.top=(124-Math.cos(a)*104)*s+'px';dial.classList.toggle('is-hot',hot);}
  document.querySelectorAll('.mf-timer,.mf-rest-mini').forEach(el=>el.classList.toggle('is-hot',hot));
  if(hot&&sec!==lastSec){haptic('tick');document.querySelectorAll('[data-rest-countdown]').forEach(el=>{el.classList.remove('is-beat');void el.offsetWidth;el.classList.add('is-beat');});}
  lastSec=running?sec:-1;
}
function restDone(){const dial=document.querySelector('.mf-rest-dial');if(dial){const b=document.createElement('span');b.className='mf-rest-burst';dial.append(b);setTimeout(()=>b.remove(),760);}
  const btn=document.querySelector('.mf-rest-main-actions .mf-primary,.mf-timer button');if(btn){btn.classList.remove('is-wiggle');void btn.offsetWidth;btn.classList.add('is-wiggle');}
  hop(document.querySelector('.mf-rest-adjust img,.mf-exercise-hero img'));}

// 07 Jelly nav: the pill keeps its last position across re-renders and springs to the active tab.
const pill={x:null,w:0,vx:0,vw:0,route:null};let nraf=0;
function navPill(root){
  const nav=root.querySelector('.mf-nav'),b=nav&&nav.querySelector('[aria-pressed=true]');if(!b)return;
  nav.classList.add('has-pill');const el=document.createElement('span');el.className='mf-nav-pill';el.setAttribute('aria-hidden','true');nav.prepend(el);
  const target=()=>{const nr=nav.getBoundingClientRect(),r=b.getBoundingClientRect();return {x:r.left-nr.left-nav.clientLeft,w:r.width,y:r.top-nr.top-nav.clientTop,h:r.height};};
  const t0=target();el.style.top=t0.y+'px';el.style.height=t0.h+'px';
  if(pill.route&&pill.route!==b.dataset.route&&!reduce()){const ic=b.querySelector('.mf-nav-icon');if(ic)ic.classList.add('is-pop');}
  if(pill.x===null||reduce()){pill.x=t0.x;pill.w=t0.w;}pill.route=b.dataset.route;cancelAnimationFrame(nraf);
  const step=()=>{if(!el.isConnected)return;const t=target();pill.vx=(pill.vx+(t.x-pill.x)*.16)*.72;pill.vw=(pill.vw+(t.w-pill.w)*.16)*.72;pill.x+=pill.vx;pill.w+=pill.vw;
    const st=Math.min(.22,Math.abs(pill.vx)/60);el.style.width=pill.w+'px';el.style.transform=`translateX(${pill.x}px) scaleX(${1+st}) scaleY(${1-st*.55})`;
    if(Math.abs(t.x-pill.x)>.3||Math.abs(pill.vx)>.3||Math.abs(t.w-pill.w)>.3)nraf=requestAnimationFrame(step);else{pill.x=t.x;pill.w=t.w;pill.vx=pill.vw=0;el.style.width=t.w+'px';el.style.transform=`translateX(${t.x}px)`;}};
  step();
}

function afterRender(root){
  root.classList.toggle('is-paper',prefs().paper!==false);
  root.querySelectorAll('.mf-number-box').forEach(numberBox);
  root.querySelectorAll('.mf-hero-cat,.mf-exercise-hero img,.mf-rest-adjust img,.mf-costume img').forEach(liven);
  const room=root.querySelector('.mf-cat-room');if(room)tilt(room);
  const fresh=root.querySelector('.mf-seal.is-new');
  if(fresh)setTimeout(()=>{haptic('confirm');const table=fresh.closest('table');if(table){table.classList.remove('is-bump');void table.offsetWidth;table.classList.add('is-bump');}
    const p=at(fresh),ring=document.createElement('span');ring.className='mf-feel-ink';ring.style.left=p.x+'px';ring.style.top=p.y+'px';ring.style.width=p.w+'px';ring.style.height=p.h+'px';layer().append(ring);setTimeout(()=>ring.remove(),560);
    hop(root.querySelector('.mf-exercise-hero img'));},reduce()?0:230);
  navPill(root);
}

// Stepper hold-to-repeat: re-query the button each time because every step re-renders the page.
let repeat=0;
function holdSteps(){
  const stop=()=>clearTimeout(repeat);
  document.addEventListener('pointerdown',e=>{const b=e.target.closest('#meow-app button');if(!b||b.disabled)return;haptic('tick');
    if(!b.dataset.step)return;const sel=`#meow-app [data-step="${b.dataset.step}"]`;let gap=150;stop();
    const go=()=>{const cur=document.querySelector(sel);if(!cur||cur.disabled)return;haptic('tick');cur.click();gap=Math.max(70,gap*.86);repeat=setTimeout(go,gap);};repeat=setTimeout(go,380);});
  for(const ev of ['pointerup','pointercancel'])document.addEventListener(ev,stop);
}

function init(o){A=o.bridge||null;prefs=o.prefs||prefs;document.body.insertAdjacentHTML('afterbegin',SPRITE);holdSteps();}
global.MeowFeel={init,haptic,seal,afterRender,celebrate,rest,restDone};
})(window);
