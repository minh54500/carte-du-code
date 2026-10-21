// The graph page: one self-contained HTML file (no network, no library). Two views:
// "brain", a force-directed network coloured by folder (like graphify), and "columns", pages → blocks → data → database → server → tools.
import { COLUMNS, columnTitle } from './render-md.mjs';

export function renderHtml(map, t, { date, lang, html }) {
  const cols = COLUMNS.map((c) => [c, columnTitle(c, map.web, t)]).filter(([c]) => map.nodes.some((n) => n.col === c));
  const data = {
    title: map.name, kinds: map.kinds, date, cols, T: html,
    nodes: map.nodes.map((n) => ({ id: n.id, col: n.col, label: n.label, file: n.file || '', desc: n.desc || '', badge: n.badge || '', uses: n.uses })),
    edges: map.edges,
  };
  const title = String(map.name).replace(/[<&]/g, (c) => ({ '<': '&lt;', '&': '&amp;' }[c]));
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · carte du code</title>
<style>
:root{--bg:#f6f4ee;--ink:#1f1f1f;--muted:#6b6b6b;--line:#cfcac0;--card:#fff;--hi:#c8102e}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink)}
body.brain{background:#070b17;color:#e7ecff;overflow:hidden}
header{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 16px;background:var(--bg);border-bottom:1px solid var(--line)}
body.brain header{position:fixed;left:0;right:0;background:rgba(7,11,23,.82);backdrop-filter:blur(6px);border-color:#1d2440}
h1{font-size:17px;margin:0}header small{color:var(--muted)}body.brain header small{color:#8d97bd}
input{flex:1;min-width:180px;max-width:320px;padding:7px 11px;border:1px solid var(--line);border-radius:8px;font:inherit;background:var(--card);color:inherit}
body.brain input{background:#0f1530;border-color:#27305a}
button{padding:7px 11px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:inherit;font:inherit;cursor:pointer}
body.brain button{background:#0f1530;border-color:#27305a}button[aria-pressed=true]{outline:2px solid var(--hi)}button:focus-visible,input:focus-visible{outline:2px solid #5b8cff;outline-offset:2px}
main{position:relative;display:grid;grid-template-columns:repeat(${cols.length},minmax(170px,1fr));gap:28px;padding:20px;min-width:${cols.length * 200}px}
body.brain main{display:none}#cv{display:none;position:fixed;inset:0;cursor:grab;touch-action:none}body.brain #cv{display:block}#cv.drag{cursor:grabbing}
svg{position:absolute;inset:0;pointer-events:none;overflow:visible}
.col h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 10px}
.n{position:relative;display:block;width:100%;text-align:left;margin:0 0 8px;padding:7px 10px;border:1px solid var(--line);border-left:4px solid var(--c);border-radius:8px;background:var(--card);cursor:pointer;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.n small{display:block;color:var(--muted);font-size:11px;overflow:hidden;text-overflow:ellipsis}
.n .b{display:inline-block;margin-left:6px;padding:0 6px;border-radius:99px;background:#fde68a;font-size:10px}
.dim .n:not(.on){opacity:.25}.n.on{box-shadow:0 0 0 2px var(--c)}.n.sel{background:#fff7e6}
path{fill:none;stroke:#9a958b;stroke-opacity:.18;stroke-width:1.2}path.on{stroke:var(--hi);stroke-opacity:.9;stroke-width:2}
aside{position:fixed;right:16px;bottom:16px;z-index:6;width:min(420px,calc(100vw - 32px));max-height:50vh;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,.12)}
body.brain aside{background:#0f1530;border-color:#27305a;box-shadow:0 8px 40px rgba(0,0,0,.5)}
aside[hidden]{display:none}aside h3{margin:0 0 4px;font-size:15px}aside code{font-size:12px;color:var(--muted);word-break:break-all}aside ul{margin:6px 0 0;padding-left:18px}aside p{margin:6px 0}
.legend{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--muted)}.legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}
#tip{position:fixed;z-index:7;pointer-events:none;padding:4px 8px;border-radius:6px;background:#0f1530;color:#e7ecff;font-size:12px;border:1px solid #27305a}#tip[hidden]{display:none}
#help{position:fixed;left:16px;bottom:14px;z-index:5;font-size:12px;color:#8d97bd;display:none;margin:0}body.brain #help{display:block}
@media (prefers-reduced-motion:reduce){#cv{transition:none}}
</style></head><body class="brain">
<header><h1>${title}</h1><small id="meta"></small>
<input id="q" type="search"><button id="vb" type="button"></button><button id="vc" type="button"></button>
<button id="paint" type="button"></button><button id="png" type="button"></button><button id="all" type="button"></button>
<div class="legend" id="legend"></div></header>
<main id="m"><svg id="s"></svg></main><canvas id="cv" role="img"></canvas><div id="tip" hidden></div><p id="help"></p>
<aside id="info" hidden aria-live="polite"></aside>
<script>
const D=${JSON.stringify(data).replace(/</g, '\\u003c')},T=D.T;
const COLOR={page:'#2563eb',bloc:'#7c3aed',data:'#0d9488',db:'#b45309',server:'#be123c',tool:'#475569'};
const GLOW={page:'#5b8cff',bloc:'#a77bff',data:'#2ee6c9',db:'#ffb347',server:'#ff5d7a',tool:'#9fb0c9'};
const $=(id)=>document.getElementById(id),m=$('m'),s=$('s'),info=$('info'),q=$('q'),cv=$('cv'),tip=$('tip');
$('meta').textContent=D.kinds.join(' · ')+' · '+D.date+' · '+D.nodes.length+' '+T['html.elements']+', '+D.edges.length+' '+T['html.links'];
q.placeholder=T['html.search'];q.setAttribute('aria-label',T['html.search']);$('vb').textContent=T['html.brain'];$('vc').textContent=T['html.columns'];
$('png').textContent=T['html.png'];$('all').textContent=T['html.all'];$('help').textContent=T['html.help'];cv.setAttribute('aria-label',D.title);
const byId=new Map(D.nodes.map(n=>[n.id,n])),out=new Map(),inn=new Map(),el=new Map();
for(const e of D.edges){(out.get(e.from)||out.set(e.from,[]).get(e.from)).push(e);(inn.get(e.to)||inn.set(e.to,[]).get(e.to)).push(e)}
// the highlighted chain follows the data: a file written by a script, and a script reading a table, depend on them
const dep=new Map(),feeds=new Map(),add=(mp,a,b)=>(mp.get(a)||mp.set(a,[]).get(a)).push(b);
for(const e of D.edges){if(e.type==='writes'){add(dep,e.to,e.from);add(feeds,e.from,e.to)}else{add(dep,e.from,e.to);add(feeds,e.to,e.from)}}
function chain(id){const seen=new Set([id]);for(const mp of [dep,feeds]){const st=[id];while(st.length){const x=st.pop();for(const y of mp.get(x)||[]){if(!seen.has(y)){seen.add(y);st.push(y)}}}}return seen}
function esc(t){return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function showInfo(id){const n=byId.get(id),o=[...new Set((out.get(id)||[]).map(e=>byId.get(e.to)))],i=[...new Set((inn.get(id)||[]).map(e=>byId.get(e.from)))];
 info.hidden=false;info.innerHTML='<h3>'+esc(n.label)+'</h3>'+(n.file?'<code>'+esc(n.file)+'</code>':'')+(n.desc?'<p>'+esc(n.desc)+'</p>':'')+(n.badge?'<p>'+esc(n.badge)+'</p>':'')+
  (o.length?'<p><b>'+T['html.uses']+'</b></p><ul>'+o.map(x=>'<li>'+esc(x.label)+'</li>').join('')+'</ul>':'')+(i.length?'<p><b>'+T['html.usedBy']+'</b></p><ul>'+i.map(x=>'<li>'+esc(x.label)+'</li>').join('')+'</ul>':'')}
let selSet=null,findSet=null,selId=null,hover=null,dragN=null,raf=0,colorMode='folders',view='brain';
try{view=localStorage.getItem('carte-view')||view;colorMode=localStorage.getItem('carte-colors')||colorMode}catch{}

// ---------- columns ----------
for(const [c,t] of D.cols){const col=document.createElement('section');col.className='col';col.innerHTML='<h2>'+esc(t)+'</h2>';
 for(const n of D.nodes.filter(n=>n.col===c).sort((a,b)=>b.uses-a.uses||a.label.localeCompare(b.label))){const b=document.createElement('button');b.type='button';b.className='n';b.style.setProperty('--c',COLOR[c]);
  b.innerHTML=esc(n.label)+(n.badge?'<span class="b">'+esc(n.badge)+'</span>':'')+'<small>'+esc(n.desc||n.file||'')+'</small>';b.title=n.file||'';b.onclick=()=>select(n.id);el.set(n.id,b);col.append(b)}
 m.append(col)}
const paths=[];function drawCols(){const r=m.getBoundingClientRect();s.setAttribute('width',m.scrollWidth);s.setAttribute('height',m.scrollHeight);s.innerHTML='';paths.length=0;
 for(const e of D.edges){const a=el.get(e.from),b=el.get(e.to);if(!a||!b)continue;const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();
  const ltr=A.left<=B.left,x1=(ltr?A.right:A.left)-r.left,y1=A.top+A.height/2-r.top,x2=(ltr?B.left:B.right)-r.left,y2=B.top+B.height/2-r.top,dx=Math.max(40,Math.abs(x2-x1)/2)*(ltr?1:-1);
  const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d','M'+x1+','+y1+' C'+(x1+dx)+','+y1+' '+(x2-dx)+','+y2+' '+x2+','+y2);p.dataset.f=e.from;p.dataset.t=e.to;s.append(p);paths.push(p)}
 paintCols()}
function paintCols(){const on=selSet||findSet;m.classList.toggle('dim',!!on);for(const [k,b] of el){b.classList.toggle('on',!!on&&on.has(k));b.classList.toggle('sel',k===selId)}
 for(const p of paths)p.classList.toggle('on',!!selSet&&selSet.has(p.dataset.f)&&selSet.has(p.dataset.t))}

// ---------- brain: force-directed network ----------
const ctx=cv.getContext('2d');let W=0,H=0,DPR=Math.min(2,devicePixelRatio||1);
let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
// families = folders: same colour, pulled together into lobes; each family starts at its own place on a ring,
// so the layout settles in a few steps even on big projects
const famOf=(n)=>{if(/^(table|rpc|model|bucket|job):/.test(n.id))return 'database';if(n.id.startsWith('npm:'))return 'npm';if(n.id.startsWith('cron:'))return 'cron';
 const f=n.file||'';const d=f.includes('/')?f.slice(0,f.lastIndexOf('/')):'(root)';const p=d.split('/');return p[0]==='src'||p[0]==='app'?p.slice(0,Math.min(p.length,3)).join('/'):p[0]};
const famSize=new Map();for(const n of D.nodes){const f=famOf(n);famSize.set(f,(famSize.get(f)||0)+1)}
const fams=[...famSize.keys()].sort((a,b)=>famSize.get(b)-famSize.get(a)),hue=new Map(fams.map((f,k)=>[f,(k*137.508+205)%360]));
const ring=30+Math.sqrt(D.nodes.length)*14,home=new Map(fams.map((f,k)=>{const a=k/fams.length*6.283;return[f,{x:Math.cos(a)*ring,y:Math.sin(a)*ring}]}));
const N=D.nodes.map(n=>{const h=home.get(famOf(n)),a=rnd()*6.283,r=rnd()*(12+Math.sqrt(famSize.get(famOf(n)))*16);return{...n,x:h.x+Math.cos(a)*r,y:h.y+Math.sin(a)*r,vx:0,vy:0,r:3.2+Math.sqrt(n.uses+1)*2.1}});
const idx=new Map(N.map(n=>[n.id,n]));const L=D.edges.map(e=>({s:idx.get(e.from),t:idx.get(e.to)})).filter(l=>l.s&&l.t);
const fam=new Map(N.map(n=>[n,famOf(n)]));
const colorOf=(n)=>colorMode==='types'?GLOW[n.col]:'hsl('+hue.get(fam.get(n))+',85%,64%)';
const famC=new Map();let alpha=1;
function qIns(q,p,d){if(!q.c){if(!q.n){q.n=p;q.m=1;q.cx=p.x;q.cy=p.y;return}if(d>40){q.m++;return}const o=q.n;q.n=null;q.c=[null,null,null,null];q.m=0;q.cx=q.cy=0;qAdd(q,o,d)}qAdd(q,p,d)}
function qAdd(q,p,d){q.cx=(q.cx*q.m+p.x)/(q.m+1);q.cy=(q.cy*q.m+p.y)/(q.m+1);q.m++;const h=q.s/2,i=(p.x>=q.x+h?1:0)+(p.y>=q.y+h?2:0);
 if(!q.c[i])q.c[i]={x:q.x+(i&1?h:0),y:q.y+(i&2?h:0),s:h,m:0,cx:0,cy:0,n:null,c:null};qIns(q.c[i],p,d+1)}
function qPush(q,p,k){if(!q||!q.m||(!q.c&&q.n===p))return;let dx=p.x-q.cx,dy=p.y-q.cy,d2=dx*dx+dy*dy;
 if(d2>360000&&q.s*q.s<0.8*d2)return; // groups beyond 600 units do not push: big projects stay compact
 if(!q.c||q.s*q.s<0.8*d2){if(d2<1){dx=(p.id<(q.n&&q.n.id||'')?-1:1);dy=0;d2=1}const f=1100*q.m/d2*k,d=Math.sqrt(d2);p.vx+=dx/d*f;p.vy+=dy/d*f;return}
 for(const c of q.c)qPush(c,p,k)}
function bhRepel(k){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const n of N){if(n.x<x0)x0=n.x;if(n.y<y0)y0=n.y;if(n.x>x1)x1=n.x;if(n.y>y1)y1=n.y}
 const root={x:x0-1,y:y0-1,s:Math.max(x1-x0,y1-y0)+2,m:0,cx:0,cy:0,n:null,c:null};for(const n of N)qIns(root,n,0);for(const n of N)qPush(root,n,k)}
function tick(){const k=alpha;
 // repulsion with a Barnes-Hut quadtree: far groups of dots act as one, so it stays fast on big projects
 bhRepel(k);
 for(const l of L){let dx=l.t.x-l.s.x,dy=l.t.y-l.s.y;const d=Math.sqrt(dx*dx+dy*dy)||1,f=(d-46)*0.03*k;dx/=d;dy/=d;l.s.vx+=dx*f;l.s.vy+=dy*f;l.t.vx-=dx*f;l.t.vy-=dy*f}
 famC.clear();for(const n of N){const c=famC.get(fam.get(n))||famC.set(fam.get(n),{x:0,y:0,c:0}).get(fam.get(n));c.x+=n.x;c.y+=n.y;c.c++}
 for(const n of N){if(n===dragN)continue;const c=famC.get(fam.get(n));if(c.c>1){n.vx+=(c.x/c.c-n.x)*0.012*k;n.vy+=(c.y/c.c-n.y)*0.012*k}n.vx-=n.x*0.0035*k;n.vy-=n.y*0.0035*k;n.vx*=0.62;n.vy*=0.62;const sp=Math.hypot(n.vx,n.vy);if(sp>24){n.vx*=24/sp;n.vy*=24/sp}if(!isFinite(n.x+n.y)){n.x=rnd()*50;n.y=rnd()*50;n.vx=n.vy=0}n.x+=n.vx;n.y+=n.vy}
 alpha=Math.max(alpha*0.985,dragN?0.25:0)}
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const pre=reduce?420:N.length>1200?40:N.length>500?90:240;for(let i=0;i<pre;i++)tick();
const cam={x:0,y:0,z:1};
function fit(){const xs=N.map(n=>n.x).sort((a,b)=>a-b),ys=N.map(n=>n.y).sort((a,b)=>a-b),qq=(a,p)=>a[Math.floor((a.length-1)*p)]||0;const x0=qq(xs,.04),x1=qq(xs,.96),y0=qq(ys,.04),y1=qq(ys,.96);
 cam.z=Math.min(2.2,0.9*Math.min(W/(x1-x0+80),(H-90)/(y1-y0+80)));cam.x=-(x0+x1)/2*cam.z;cam.y=-(y0+y1)/2*cam.z+30}
function resize(){W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+'px';cv.style.height=H+'px'}
function drawBrain(){ctx.setTransform(DPR,0,0,DPR,0,0);const g=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.7);g.addColorStop(0,'#101a3a');g.addColorStop(1,'#060912');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.translate(W/2+cam.x,H/2+cam.y);ctx.scale(cam.z,cam.z);const on=selSet||findSet;ctx.lineWidth=1/cam.z;
 for(const l of L){const lit=selSet&&selSet.has(l.s.id)&&selSet.has(l.t.id);ctx.strokeStyle=lit?'rgba(255,92,120,.9)':on?'rgba(160,180,255,.035)':'rgba(150,175,255,.13)';if(lit)ctx.lineWidth=1.8/cam.z;ctx.beginPath();ctx.moveTo(l.s.x,l.s.y);ctx.lineTo(l.t.x,l.t.y);ctx.stroke();if(lit)ctx.lineWidth=1/cam.z}
 for(const n of N){const dim=on&&!on.has(n.id),col=colorOf(n);ctx.globalAlpha=dim?.12:1;ctx.shadowColor=col;ctx.shadowBlur=dim||N.length>800?0:14;ctx.fillStyle=col;ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,6.2832);ctx.fill();
  if(n.badge&&!dim){ctx.shadowBlur=0;ctx.strokeStyle='#fde68a';ctx.lineWidth=1.5/cam.z;ctx.beginPath();ctx.arc(n.x,n.y,n.r+2.5/cam.z,0,6.2832);ctx.stroke();ctx.lineWidth=1/cam.z}
  if(n.id===selId){ctx.shadowBlur=0;ctx.strokeStyle='#fff';ctx.lineWidth=2/cam.z;ctx.beginPath();ctx.arc(n.x,n.y,n.r+4/cam.z,0,6.2832);ctx.stroke();ctx.lineWidth=1/cam.z}}
 ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.font=(11.5/cam.z)+'px system-ui,sans-serif';ctx.fillStyle='rgba(231,236,255,.92)';
 const big=on?new Set(N.filter(n=>on.has(n.id)).sort((a,b)=>b.r-a.r).slice(0,Math.round(14+cam.z*10)).map(n=>n.id)):null;
 for(const n of N){const show=n===hover||n.id===selId||(on?big.has(n.id):n.r*cam.z>10||cam.z>1.9);if(show)ctx.fillText(n.label,n.x+n.r+3/cam.z,n.y+4/cam.z)}}
function loop(){if(alpha>0.004||dragN)tick();drawBrain();raf=(!reduce&&(alpha>0.004||dragN))?requestAnimationFrame(loop):0}
const wake=(a)=>{alpha=Math.max(alpha,a);if(!raf)raf=requestAnimationFrame(loop)};
const world=(e)=>({x:(e.clientX-W/2-cam.x)/cam.z,y:(e.clientY-H/2-cam.y)/cam.z});
const pick=(e)=>{const p=world(e);let best=null,bd=1e9;for(const n of N){const d=Math.hypot(n.x-p.x,n.y-p.y);if(d<n.r+6/cam.z&&d<bd){bd=d;best=n}}return best};
let pan=null,moved=false;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);moved=false;const n=pick(e);if(n){dragN=n;wake(.25)}else pan={x:e.clientX-cam.x,y:e.clientY-cam.y};cv.classList.add('drag')});
cv.addEventListener('pointermove',e=>{if(dragN){const p=world(e);dragN.x=p.x;dragN.y=p.y;dragN.vx=dragN.vy=0;moved=true;if(reduce)drawBrain();return}
 if(pan){cam.x=e.clientX-pan.x;cam.y=e.clientY-pan.y;moved=true;drawBrain();return}
 const n=pick(e);if(n!==hover){hover=n;drawBrain()}if(n){tip.hidden=false;tip.textContent=n.label+(n.file&&n.file!==n.label?' · '+n.file:'');tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY+12)+'px'}else tip.hidden=true});
cv.addEventListener('pointerup',e=>{cv.classList.remove('drag');const n=dragN;dragN=null;pan=null;if(!moved){const hit=n||pick(e);hit?select(hit.id):reset()}});
cv.addEventListener('pointerleave',()=>{tip.hidden=true});
cv.addEventListener('wheel',e=>{e.preventDefault();const p=world(e),f=Math.exp(-e.deltaY*0.0015);cam.z=Math.min(8,Math.max(0.1,cam.z*f));cam.x=e.clientX-W/2-p.x*cam.z;cam.y=e.clientY-H/2-p.y*cam.z;drawBrain()},{passive:false});

// ---------- shared ----------
function select(id){selId=id;selSet=chain(id);findSet=null;showInfo(id);if(view==='columns'){paintCols();el.get(id).scrollIntoView({block:'nearest',inline:'nearest'})}else drawBrain()}
function reset(){selId=null;selSet=null;findSet=null;info.hidden=true;q.value='';view==='columns'?paintCols():drawBrain()}
q.oninput=()=>{const t=q.value.trim().toLowerCase();selId=null;selSet=null;info.hidden=true;findSet=t?new Set(D.nodes.filter(n=>(n.label+' '+n.file+' '+n.desc).toLowerCase().includes(t)).map(n=>n.id)):null;view==='columns'?paintCols():drawBrain()};
$('all').onclick=reset;addEventListener('keydown',e=>{if(e.key==='Escape')reset()});
function legend(){$('legend').innerHTML=view==='brain'&&colorMode==='folders'?fams.slice(0,9).map(f=>'<span><i style="background:hsl('+hue.get(f)+',85%,64%)"></i>'+esc(f)+'</span>').join('')+(D.nodes.some(n=>n.badge)?'<span>· '+T['html.badgeLegend']+'</span>':''):D.cols.map(([c,t])=>'<span><i style="background:'+(view==='brain'?GLOW[c]:COLOR[c])+'"></i>'+esc(t)+'</span>').join('')}
function paintLabel(){$('paint').textContent=T['html.colors']+' : '+(colorMode==='folders'?T['html.byFolder']:T['html.byType'])}
function setView(v){view=v==='columns'?'columns':'brain';try{localStorage.setItem('carte-view',view)}catch{}document.body.classList.toggle('brain',view==='brain');$('vb').setAttribute('aria-pressed',view==='brain');$('vc').setAttribute('aria-pressed',view==='columns');$('paint').hidden=$('png').hidden=view!=='brain';legend();
 if(view==='columns')drawCols();else{resize();drawBrain()}}
$('vb').onclick=()=>setView('brain');$('vc').onclick=()=>setView('columns');
$('paint').onclick=()=>{colorMode=colorMode==='folders'?'types':'folders';try{localStorage.setItem('carte-colors',colorMode)}catch{}paintLabel();legend();drawBrain()};
$('png').onclick=()=>cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(D.title||'carte').replace(/[^\\w-]+/g,'-')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
addEventListener('resize',()=>{if(view==='brain'){resize();drawBrain()}else drawCols()});
paintLabel();resize();fit();setView(view);if(!reduce)wake(0.05);
</script></body></html>`;
}
