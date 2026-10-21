// The graph page: one self-contained HTML file (no network, no library). Two views:
// "brain", a force-directed network coloured by folder (files, or folder bubbles on big projects), and
// "columns", pages → blocks → data → database → server → tools. Health and changes panels, filters, deep links.
import { COLUMNS, columnTitle } from './render-md.mjs';
import { famOf, folderHues } from './query.mjs';

export function renderHtml(map, t, { date, lang, html, root = '', health = null, changes = null, hues = folderHues(map.nodes) }) {
  const cols = COLUMNS.map((c) => [c, columnTitle(c, map.web, t)]).filter(([c]) => map.nodes.some((n) => n.col === c));
  const data = {
    title: map.name, kinds: map.kinds, date, cols, T: html, root, hues,
    nodes: map.nodes.map((n) => ({ id: n.id, col: n.col, label: n.label, file: n.file || '', desc: n.desc || '', badge: n.badge || '', uses: n.uses, test: !!n.test, fam: famOf(n) })),
    edges: map.edges,
    health: health ? { unused: health.unused.map((n) => n.id), cycles: health.cycles.map((c) => c.map((n) => n.id)), sensitive: health.sensitive.map((x) => [x.n.id, x.count]) } : null,
    changes: changes ? { added: changes.added, removed: changes.removed.map((n) => n.label), since: changes.since } : null,
  };
  const title = String(map.name).replace(/[<&]/g, (c) => ({ '<': '&lt;', '&': '&amp;' }[c]));
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · carte du code</title>
<style>
:root{--bg:#f6f4ee;--ink:#1f1f1f;--muted:#6b6b6b;--line:#cfcac0;--card:#fff;--hi:#c8102e;--new:#3ddc84}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink)}
body.brain{background:#070b17;color:#e7ecff;overflow:hidden}
header{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 16px;background:var(--bg);border-bottom:1px solid var(--line)}
body.brain header{position:fixed;left:0;right:0;background:rgba(7,11,23,.84);backdrop-filter:blur(6px);border-color:#1d2440}
h1{font-size:17px;margin:0 6px 0 0}header small{color:var(--muted)}body.brain header small{color:#8d97bd}
input[type=search]{flex:1;min-width:170px;max-width:300px;padding:7px 11px;border:1px solid var(--line);border-radius:8px;font:inherit;background:var(--card);color:inherit}
body.brain input[type=search]{background:#0f1530;border-color:#27305a}
button,summary{padding:7px 11px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:inherit;font:inherit;cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
body.brain button,body.brain summary{background:#0f1530;border-color:#27305a}button[aria-pressed=true]{outline:2px solid var(--hi)}
button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid #5b8cff;outline-offset:2px}
.count{display:inline-block;min-width:18px;margin-left:4px;padding:0 5px;border-radius:99px;background:var(--hi);color:#fff;font-size:11px;text-align:center}
details.filters{position:relative}details.filters .menu{position:absolute;top:calc(100% + 6px);left:0;z-index:8;display:grid;gap:6px;min-width:220px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);box-shadow:0 8px 30px rgba(0,0,0,.15)}
body.brain details.filters .menu{background:#0f1530;border-color:#27305a}details.filters label{display:flex;gap:8px;align-items:center;cursor:pointer}
main{position:relative;display:grid;grid-template-columns:repeat(${cols.length},minmax(170px,1fr));gap:28px;padding:20px;min-width:${cols.length * 200}px}
body.brain main{display:none}#cv{display:none;position:fixed;inset:0;cursor:grab;touch-action:none}body.brain #cv{display:block}#cv.drag{cursor:grabbing}
svg{position:absolute;inset:0;pointer-events:none;overflow:visible}
.col h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 10px}
.n{position:relative;display:block;width:100%;text-align:left;margin:0 0 8px;padding:7px 10px;border:1px solid var(--line);border-left:4px solid var(--c);border-radius:8px;background:var(--card);cursor:pointer;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.n[hidden]{display:none}.n small{display:block;color:var(--muted);font-size:11px;overflow:hidden;text-overflow:ellipsis}
.n .b{display:inline-block;margin-left:6px;padding:0 6px;border-radius:99px;background:#fde68a;font-size:10px}.n .nw{background:#bbf7d0}
.dim .n:not(.on){opacity:.25}.n.on{box-shadow:0 0 0 2px var(--c)}.n.sel{background:#fff7e6}
path{fill:none;stroke:#9a958b;stroke-opacity:.18;stroke-width:1.2}path.on{stroke:var(--hi);stroke-opacity:.9;stroke-width:2}
aside{position:fixed;right:16px;bottom:16px;z-index:6;width:min(440px,calc(100vw - 32px));max-height:58vh;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,.12)}
body.brain aside{background:#0f1530;border-color:#27305a;box-shadow:0 8px 40px rgba(0,0,0,.5)}
aside[hidden]{display:none}aside h3{margin:0 0 4px;font-size:15px}aside h4{margin:12px 0 4px;font-size:13px}aside code{font-size:12px;color:var(--muted);word-break:break-all}
aside ul{margin:6px 0 0;padding-left:18px}aside p{margin:6px 0}aside .acts{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}aside .acts a,aside .acts button{font-size:12px;padding:5px 9px;border-radius:7px}
aside a{color:#5b8cff}aside .item{all:unset;cursor:pointer;color:#5b8cff;text-decoration:underline;text-underline-offset:2px}aside .item:focus-visible{outline:2px solid #5b8cff}aside .x{float:right;padding:2px 8px}
.legend{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--muted)}
@media (max-width:640px){header{gap:5px;padding:8px 10px}h1{font-size:15px}header small{flex-basis:100%;font-size:12px}input[type=search]{flex-basis:100%;max-width:none}button,summary{padding:4px 8px;font-size:12.5px}#png{display:none}.legend{flex-basis:100%;flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;scrollbar-width:none}body.brain #help{display:none}aside{right:8px;bottom:8px;width:calc(100vw - 16px);max-height:48vh}}.legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}
#tip{position:fixed;z-index:9;pointer-events:none;padding:4px 8px;border-radius:6px;background:#0f1530;color:#e7ecff;font-size:12px;border:1px solid #27305a}#tip[hidden]{display:none}
#help{position:fixed;left:16px;bottom:14px;z-index:5;font-size:12px;color:#8d97bd;display:none;margin:0}body.brain #help{display:block}
</style></head><body class="brain">
<header><h1>${title}</h1><small id="meta"></small>
<input id="q" type="search">
<button id="vb" type="button"></button><button id="vc" type="button"></button><button id="mode" type="button"></button>
<details class="filters" id="filters"><summary id="fsum"></summary><div class="menu" id="fmenu"></div></details>
<button id="hb" type="button"></button><button id="cb" type="button" hidden></button>
<button id="paint" type="button"></button><button id="png" type="button"></button><button id="all" type="button"></button>
<div class="legend" id="legend"></div></header>
<main id="m"><svg id="s"></svg></main><canvas id="cv" role="img"></canvas><div id="tip" hidden></div><p id="help"></p>
<aside id="info" hidden aria-live="polite"></aside>
<script>
const D=${JSON.stringify(data).replace(/</g, '\\u003c')},T=D.T;
const COLOR={page:'#2563eb',bloc:'#7c3aed',data:'#0d9488',db:'#b45309',server:'#be123c',tool:'#475569'};
const GLOW={page:'#5b8cff',bloc:'#a77bff',data:'#2ee6c9',db:'#ffb347',server:'#ff5d7a',tool:'#9fb0c9'};
const $=(id)=>document.getElementById(id),m=$('m'),s=$('s'),info=$('info'),q=$('q'),cv=$('cv'),tip=$('tip');
const esc=(t)=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
$('meta').textContent=D.kinds.join(' · ')+' · '+D.date+' · '+D.nodes.length+' '+T['html.elements']+', '+D.edges.length+' '+T['html.links'];
q.placeholder=T['html.search'];q.setAttribute('aria-label',T['html.search']);$('vb').textContent=T['html.brain'];$('vc').textContent=T['html.columns'];
$('png').textContent=T['html.png'];$('all').textContent=T['html.all'];$('help').textContent=T[matchMedia('(pointer:coarse)').matches?'html.helpTouch':'html.help'];$('fsum').textContent=T['html.filters'];cv.setAttribute('aria-label',D.title);
const byId=new Map(D.nodes.map(n=>[n.id,n])),out=new Map(),inn=new Map(),el=new Map();
for(const e of D.edges){(out.get(e.from)||out.set(e.from,[]).get(e.from)).push(e);(inn.get(e.to)||inn.set(e.to,[]).get(e.to)).push(e)}
// the highlighted chain follows the data: a file written by a script, and a script reading a table, depend on them
const dep=new Map(),feeds=new Map(),add=(mp,a,b)=>(mp.get(a)||mp.set(a,[]).get(a)).push(b);
for(const e of D.edges){if(e.type==='writes'){add(dep,e.to,e.from);add(feeds,e.from,e.to)}else{add(dep,e.from,e.to);add(feeds,e.to,e.from)}}
function chain(id){const seen=new Set([id]);for(const mp of [dep,feeds]){const st=[id];while(st.length){const x=st.pop();for(const y of mp.get(x)||[]){if(!seen.has(y)){seen.add(y);st.push(y)}}}}return seen}
const NEW=new Set(D.changes?D.changes.added:[]);
let selSet=null,findSet=null,selId=null,hover=null,dragN=null,raf=0,colorMode='folders',view='brain',mode=D.nodes.length>600?'folders':'files';
const colOn=Object.fromEntries(D.cols.map(([c])=>[c,true]));let showTests=true;
try{view=localStorage.getItem('carte-view')||view;colorMode=localStorage.getItem('carte-colors')||colorMode}catch{}
const visible=(n)=>colOn[n.col]!==false&&(showTests||!n.test);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- panels ----------
function vscodeUrl(file){if(!D.root||!file)return '';const p=D.root.split('\\\\').join('/').replace(/\\/$/,'')+'/'+file;return 'vscode://file'+(p.startsWith('/')?'':'/')+p.split('/').map((x,k)=>k===0&&/^[A-Za-z]:$/.test(x)?x:encodeURIComponent(x)).join('/')}
function showInfo(id){const n=byId.get(id),o=[...new Set((out.get(id)||[]).map(e=>byId.get(e.to)))],i=[...new Set((inn.get(id)||[]).map(e=>byId.get(e.from)))];
 const vs=vscodeUrl(n.file);
 info.hidden=false;info.innerHTML='<button class="x" id="close" type="button" aria-label="×">×</button><h3>'+esc(n.label)+'</h3>'+(n.file?'<code>'+esc(n.file)+'</code>':'')+
  '<div class="acts">'+(vs?'<a href="'+esc(vs)+'">'+esc(T['html.vscode'])+'</a>':'')+'<button type="button" id="cp">'+esc(T['html.link'])+'</button></div>'+
  (n.desc?'<p>'+esc(n.desc)+'</p>':'')+(n.badge?'<p>'+esc(n.badge)+'</p>':'')+(NEW.has(id)?'<p>✦ '+esc(T['html.new'])+'</p>':'')+
  (o.length?'<h4>'+esc(T['html.uses'])+'</h4><ul>'+o.map(x=>'<li><button class="item" data-id="'+esc(x.id)+'">'+esc(x.label)+'</button></li>').join('')+'</ul>':'')+
  (i.length?'<h4>'+esc(T['html.usedBy'])+'</h4><ul>'+i.map(x=>'<li><button class="item" data-id="'+esc(x.id)+'">'+esc(x.label)+'</button></li>').join('')+'</ul>':'');
 $('cp').onclick=()=>{if(navigator.clipboard)navigator.clipboard.writeText(location.href).then(()=>flash(T['html.copied']),()=>{})};$('close').onclick=reset}
function listPanel(title,body){info.hidden=false;info.innerHTML='<button class="x" id="close" type="button" aria-label="×">×</button><h3>'+esc(title)+'</h3>'+body;$('close').onclick=()=>{info.hidden=true}}
const itemBtn=(id,extra)=>{const n=byId.get(id);return n?'<li><button class="item" data-id="'+esc(id)+'">'+esc(n.label)+'</button>'+(extra?' · '+esc(extra):'')+(n.file&&n.file!==n.label?' <code>'+esc(n.file)+'</code>':'')+'</li>':''};
info.addEventListener('click',e=>{const b=e.target.closest('.item');if(b)select(b.dataset.id)});
const HL=D.health;const nHealth=HL?HL.unused.length+HL.cycles.length:0;
$('hb').innerHTML=esc(T['html.health'])+(nHealth?'<span class="count">'+nHealth+'</span>':'');$('hb').hidden=!HL;
$('hb').onclick=()=>{if(!HL)return;listPanel(T['html.health'],
 '<h4>'+esc(T['html.unused'])+' ('+HL.unused.length+')</h4>'+(HL.unused.length?'<ul>'+HL.unused.map(id=>itemBtn(id)).join('')+'</ul>':'<p>'+esc(T['html.none'])+'</p>')+
 '<h4>'+esc(T['html.cycles'])+' ('+HL.cycles.length+')</h4>'+(HL.cycles.length?'<ul>'+HL.cycles.slice(0,20).map(c=>'<li>'+c.slice(0,8).map(id=>'<button class="item" data-id="'+esc(id)+'">'+esc(byId.get(id).label)+'</button>').join(' ↔ ')+(c.length>8?' … ('+c.length+')':'')+'</li>').join('')+'</ul>':'<p>'+esc(T['html.none'])+'</p>')+
 '<h4>'+esc(T['html.sensitive'])+'</h4>'+(HL.sensitive.length?'<ul>'+HL.sensitive.map(([id,c])=>itemBtn(id,c+' ←')).join('')+'</ul>':'<p>'+esc(T['html.none'])+'</p>'))};
const CH=D.changes;if(CH&&(CH.added.length||CH.removed.length)){$('cb').hidden=false;$('cb').innerHTML=esc(T['html.changes'])+'<span class="count" style="background:#16a34a">'+(CH.added.length+CH.removed.length)+'</span>';
 $('cb').onclick=()=>listPanel(T['html.changes'],(CH.since?'<p><code>'+esc(new Date(CH.since).toLocaleString())+'</code></p>':'')+(CH.added.length?'<h4>+ '+CH.added.length+'</h4><ul>'+CH.added.map(id=>itemBtn(id)).join('')+'</ul>':'')+(CH.removed.length?'<h4>− '+CH.removed.length+'</h4><ul>'+CH.removed.map(l=>'<li>'+esc(l)+'</li>').join('')+'</ul>':''))}
function flash(text){tip.hidden=false;tip.textContent=text;tip.style.left='50%';tip.style.top='70px';setTimeout(()=>{tip.hidden=true},1400)}

// ---------- filters ----------
$('fmenu').innerHTML=D.cols.map(([c,t])=>'<label><input type="checkbox" data-col="'+c+'" checked> <i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+GLOW[c]+'"></i>'+esc(t)+'</label>').join('')+
 (D.nodes.some(n=>n.test)?'<label><input type="checkbox" id="ftests" checked> '+esc(T['html.tests'])+'</label>':'');
$('fmenu').addEventListener('change',e=>{if(e.target.dataset.col)colOn[e.target.dataset.col]=e.target.checked;if(e.target.id==='ftests')showTests=e.target.checked;applyFilters()});
function applyFilters(){for(const [k,b] of el)b.hidden=!visible(byId.get(k));if(view==='columns')drawCols();else if(mode==='folders')setMode('folders');else drawBrain()}

// ---------- columns ----------
for(const [c,t] of D.cols){const col=document.createElement('section');col.className='col';col.innerHTML='<h2>'+esc(t)+'</h2>';
 for(const n of D.nodes.filter(n=>n.col===c).sort((a,b)=>b.uses-a.uses||a.label.localeCompare(b.label))){const b=document.createElement('button');b.type='button';b.className='n';b.style.setProperty('--c',COLOR[c]);
  b.innerHTML=esc(n.label)+(n.badge?'<span class="b">'+esc(n.badge)+'</span>':'')+(NEW.has(n.id)?'<span class="b nw">'+esc(T['html.new'])+'</span>':'')+'<small>'+esc(n.desc||n.file||'')+'</small>';b.title=n.file||'';b.onclick=()=>select(n.id);el.set(n.id,b);col.append(b)}
 m.append(col)}
const paths=[];function drawCols(){const r=m.getBoundingClientRect();s.setAttribute('width',m.scrollWidth);s.setAttribute('height',m.scrollHeight);s.innerHTML='';paths.length=0;
 for(const e of D.edges){const a=el.get(e.from),b=el.get(e.to);if(!a||!b||a.hidden||b.hidden)continue;const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();
  const ltr=A.left<=B.left,x1=(ltr?A.right:A.left)-r.left,y1=A.top+A.height/2-r.top,x2=(ltr?B.left:B.right)-r.left,y2=B.top+B.height/2-r.top,dx=Math.max(40,Math.abs(x2-x1)/2)*(ltr?1:-1);
  const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d','M'+x1+','+y1+' C'+(x1+dx)+','+y1+' '+(x2-dx)+','+y2+' '+x2+','+y2);p.dataset.f=e.from;p.dataset.t=e.to;s.append(p);paths.push(p)}
 paintCols()}
function paintCols(){const on=selSet||findSet;m.classList.toggle('dim',!!on);for(const [k,b] of el){b.classList.toggle('on',!!on&&on.has(k));b.classList.toggle('sel',k===selId)}
 for(const p of paths)p.classList.toggle('on',!!selSet&&selSet.has(p.dataset.f)&&selSet.has(p.dataset.t))}

// ---------- brain: force-directed network (files, or folder bubbles) ----------
const ctx=cv.getContext('2d');let W=0,H=0,DPR=Math.min(2,devicePixelRatio||1);
let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
const famOf=(n)=>n.fam;
const famSize=new Map();for(const n of D.nodes){const f=famOf(n);famSize.set(f,(famSize.get(f)||0)+1)}
const fams=[...famSize.keys()].sort((a,b)=>famSize.get(b)-famSize.get(a));
const famColor=(f)=>'hsl('+(D.hues[f]??0)+',85%,64%)';
let N=[],L=[],alpha=1;const famC=new Map();
function buildFiles(){const ring=30+Math.sqrt(D.nodes.length)*14,home=new Map(fams.map((f,k)=>{const a=k/fams.length*6.283;return[f,{x:Math.cos(a)*ring,y:Math.sin(a)*ring}]}));
 const nodes=D.nodes.map(n=>{const f=famOf(n),h=home.get(f),a=rnd()*6.283,r=rnd()*(12+Math.sqrt(famSize.get(f))*16);return{...n,fam:f,x:h.x+Math.cos(a)*r,y:h.y+Math.sin(a)*r,vx:0,vy:0,r:3.2+Math.sqrt(n.uses+1)*2.1}});
 const ix=new Map(nodes.map(n=>[n.id,n]));return{nodes,links:D.edges.map(e=>({s:ix.get(e.from),t:ix.get(e.to),w:1})).filter(l=>l.s&&l.t)}}
function buildFolders(){const groups=new Map();for(const n of D.nodes){if(!visible(n))continue;const f=famOf(n);(groups.get(f)||groups.set(f,[]).get(f)).push(n.id)}
 const nodes=[...groups].map(([f,ids],k)=>{const a=k/groups.size*6.283,r=60+Math.sqrt(groups.size)*40;return{id:'fam:'+f,label:f+' ('+ids.length+')',fam:f,members:ids,col:'bloc',uses:ids.length,x:Math.cos(a)*r,y:Math.sin(a)*r,vx:0,vy:0,r:6+Math.sqrt(ids.length)*4.2}});
 const ix=new Map(nodes.map(n=>[n.fam,n])),agg=new Map();
 for(const e of D.edges){const a=byId.get(e.from),b=byId.get(e.to);if(!a||!b||!visible(a)||!visible(b))continue;const fa=famOf(a),fb=famOf(b);if(fa===fb)continue;const k=fa<fb?fa+'|'+fb:fb+'|'+fa;agg.set(k,(agg.get(k)||0)+1)}
 return{nodes,links:[...agg].map(([k,w])=>{const i=k.indexOf('|');return{s:ix.get(k.slice(0,i)),t:ix.get(k.slice(i+1)),w}}).filter(l=>l.s&&l.t)}}
function setGraph(g){N=g.nodes;L=g.links;alpha=1;const pre=reduce?420:N.length>1200?40:N.length>500?90:240;for(let i=0;i<pre;i++)tick();fit()}
function qIns(q,p,d){if(!q.c){if(!q.n){q.n=p;q.m=1;q.cx=p.x;q.cy=p.y;return}if(d>40){q.m++;return}const o=q.n;q.n=null;q.c=[null,null,null,null];q.m=0;q.cx=q.cy=0;qAdd(q,o,d)}qAdd(q,p,d)}
function qAdd(q,p,d){q.cx=(q.cx*q.m+p.x)/(q.m+1);q.cy=(q.cy*q.m+p.y)/(q.m+1);q.m++;const h=q.s/2,i=(p.x>=q.x+h?1:0)+(p.y>=q.y+h?2:0);
 if(!q.c[i])q.c[i]={x:q.x+(i&1?h:0),y:q.y+(i&2?h:0),s:h,m:0,cx:0,cy:0,n:null,c:null};qIns(q.c[i],p,d+1)}
function qPush(q,p,k,strength){if(!q||!q.m||(!q.c&&q.n===p))return;let dx=p.x-q.cx,dy=p.y-q.cy,d2=dx*dx+dy*dy;
 if(d2>360000&&q.s*q.s<0.8*d2)return; // far groups do not push: big projects stay compact
 if(!q.c||q.s*q.s<0.8*d2){if(d2<1){dx=(p.id<(q.n&&q.n.id||'')?-1:1);dy=0;d2=1}const f=strength*q.m/d2*k,d=Math.sqrt(d2);p.vx+=dx/d*f;p.vy+=dy/d*f;return}
 for(const c of q.c)qPush(c,p,k,strength)}
function tick(){const k=alpha,folders=mode==='folders',strength=folders?6000:1100,rest=folders?120:46;
 // repulsion with a Barnes-Hut quadtree: far groups of dots act as one, so it stays fast on big projects
 let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const n of N){if(n.x<x0)x0=n.x;if(n.y<y0)y0=n.y;if(n.x>x1)x1=n.x;if(n.y>y1)y1=n.y}
 const root={x:x0-1,y:y0-1,s:Math.max(x1-x0,y1-y0)+2,m:0,cx:0,cy:0,n:null,c:null};for(const n of N)qIns(root,n,0);for(const n of N)qPush(root,n,k,strength);
 for(const l of L){let dx=l.t.x-l.s.x,dy=l.t.y-l.s.y;const d=Math.sqrt(dx*dx+dy*dy)||1,f=(d-rest-(folders?l.s.r+l.t.r:0))*0.03*k;dx/=d;dy/=d;l.s.vx+=dx*f;l.s.vy+=dy*f;l.t.vx-=dx*f;l.t.vy-=dy*f}
 famC.clear();if(!folders)for(const n of N){const c=famC.get(n.fam)||famC.set(n.fam,{x:0,y:0,c:0}).get(n.fam);c.x+=n.x;c.y+=n.y;c.c++}
 for(const n of N){if(n===dragN)continue;const c=famC.get(n.fam);if(c&&c.c>1){n.vx+=(c.x/c.c-n.x)*0.012*k;n.vy+=(c.y/c.c-n.y)*0.012*k}n.vx-=n.x*0.0035*k;n.vy-=n.y*0.0035*k;n.vx*=0.62;n.vy*=0.62;
  const sp=Math.hypot(n.vx,n.vy);if(sp>24){n.vx*=24/sp;n.vy*=24/sp}if(!isFinite(n.x+n.y)){n.x=rnd()*50;n.y=rnd()*50;n.vx=n.vy=0}n.x+=n.vx;n.y+=n.vy}
 if(folders)for(let a=0;a<N.length;a++)for(let b=a+1;b<N.length;b++){const A=N[a],B=N[b];let dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy)||0.01;const min=A.r+B.r+14;
  if(d<min){const push=(min-d)/2;dx/=d;dy/=d;if(A!==dragN){A.x-=dx*push;A.y-=dy*push}if(B!==dragN){B.x+=dx*push;B.y+=dy*push}}} // bubbles never overlap
 alpha=Math.max(alpha*0.985,dragN?0.25:0)}
const cam={x:0,y:0,z:1};
function fit(only){const pts=N.filter(n=>!only||only.has(n.id));if(!pts.length||!W)return;const xs=pts.map(n=>n.x).sort((a,b)=>a-b),ys=pts.map(n=>n.y).sort((a,b)=>a-b),qq=(a,p)=>a[Math.floor((a.length-1)*p)]||0;
 const lo=only||pts.length<30?0:.04,hi=only||pts.length<30?1:.96,x0=qq(xs,lo),x1=qq(xs,hi),y0=qq(ys,lo),y1=qq(ys,hi);
 cam.z=Math.min(2.2,0.9*Math.min(W/(x1-x0+140),(H-90)/(y1-y0+140)));cam.x=-(x0+x1)/2*cam.z;cam.y=-(y0+y1)/2*cam.z+30}
function resize(){W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+'px';cv.style.height=H+'px'}
const colorOf=(n)=>colorMode==='types'&&mode==='files'?GLOW[n.col]:famColor(n.fam);
function drawBrain(){ctx.setTransform(DPR,0,0,DPR,0,0);const g=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.7);g.addColorStop(0,'#101a3a');g.addColorStop(1,'#060912');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.translate(W/2+cam.x,H/2+cam.y);ctx.scale(cam.z,cam.z);const folders=mode==='folders',on=folders?null:(selSet||findSet);
 const vis=(n)=>folders||visible(n);
 for(const l of L){if(!vis(l.s)||!vis(l.t))continue;const lit=!!(selSet&&!folders&&selSet.has(l.s.id)&&selSet.has(l.t.id));ctx.lineWidth=(lit?1.8:folders?Math.min(7,0.6+Math.sqrt(l.w)):1)/cam.z;
  ctx.strokeStyle=lit?'rgba(255,92,120,.9)':on?'rgba(160,180,255,.035)':folders?'rgba(150,175,255,.22)':'rgba(150,175,255,.13)';ctx.beginPath();ctx.moveTo(l.s.x,l.s.y);ctx.lineTo(l.t.x,l.t.y);ctx.stroke()}
 ctx.lineWidth=1/cam.z;
 for(const n of N){if(!vis(n))continue;const dim=on&&!on.has(n.id),col=colorOf(n);ctx.globalAlpha=dim?.12:1;ctx.shadowColor=col;ctx.shadowBlur=dim||N.length>800?0:14;ctx.fillStyle=col;ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,6.2832);ctx.fill();
  const ring=(c,w,o)=>{ctx.shadowBlur=0;ctx.strokeStyle=c;ctx.lineWidth=w/cam.z;ctx.beginPath();ctx.arc(n.x,n.y,n.r+o/cam.z,0,6.2832);ctx.stroke();ctx.lineWidth=1/cam.z};
  if(!dim&&n.badge)ring('#fde68a',1.5,2.5);if(!dim&&NEW.has(n.id))ring('#3ddc84',1.5,5);if(n.id===selId)ring('#fff',2,4)}
 ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.font=(11.5/cam.z)+'px system-ui,sans-serif';ctx.fillStyle='rgba(231,236,255,.92)';
 const big=on?new Set(N.filter(n=>on.has(n.id)).sort((a,b)=>b.r-a.r).slice(0,Math.round(14+cam.z*10)).map(n=>n.id)):null;
 // labels on screen only, most important first; one that would cover a placed label is left out (hover and selection always shown)
 const x0=(-W/2-cam.x)/cam.z,x1=(W/2-cam.x)/cam.z,y0=(-H/2-cam.y)/cam.z,y1=(H/2-cam.y)/cam.z,must=(n)=>n===hover||n.id===selId;
 const cand=N.filter(n=>vis(n)&&n.x>x0-200/cam.z&&n.x<x1&&n.y>y0&&n.y<y1+20/cam.z&&(folders||must(n)||(on?big.has(n.id):n.r*cam.z>10||cam.z>1.9)))
  .sort((a,b)=>must(b)-must(a)||b.r-a.r).slice(0,350);
 const placed=[],lh=12/cam.z;
 for(const n of cand){const x=n.x+n.r+3/cam.z,y=n.y+4/cam.z,w=ctx.measureText(n.label).width;
  if(!must(n)&&placed.some(p=>x<p[2]&&x+w>p[0]&&y-lh<p[3]&&y>p[1]))continue;placed.push([x,y-lh,x+w,y]);ctx.fillText(n.label,x,y)}}
function loop(){if(alpha>0.004||dragN)tick();drawBrain();raf=(!reduce&&(alpha>0.004||dragN))?requestAnimationFrame(loop):0}
const wake=(a)=>{alpha=Math.max(alpha,a);if(!raf)raf=requestAnimationFrame(loop)};
const world=(x,y)=>({x:(x-W/2-cam.x)/cam.z,y:(y-H/2-cam.y)/cam.z});
const pick=(e)=>{const p=world(e.clientX,e.clientY);let best=null,bd=1e9;for(const n of N){if(mode==='files'&&!visible(n))continue;const d=Math.hypot(n.x-p.x,n.y-p.y);if(d<n.r+6/cam.z&&d<bd){bd=d;best=n}}return best};
// mouse, pen and touch: one pointer drags or pans, two pointers pinch to zoom
const ptrs=new Map();let pan=null,moved=false,pinch=null;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,z:cam.z};dragN=null;pan=null;return}
 moved=false;const n=pick(e);if(n){dragN=n;wake(.25)}else pan={x:e.clientX-cam.x,y:e.clientY-cam.y};cv.classList.add('drag')});
cv.addEventListener('pointermove',e=>{if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()],mx=(a.x+b.x)/2,my=(a.y+b.y)/2,p=world(mx,my);cam.z=Math.min(8,Math.max(0.08,pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d));cam.x=mx-W/2-p.x*cam.z;cam.y=my-H/2-p.y*cam.z;moved=true;drawBrain();return}
 if(dragN){const p=world(e.clientX,e.clientY);dragN.x=p.x;dragN.y=p.y;dragN.vx=dragN.vy=0;moved=true;if(reduce)drawBrain();return}
 if(pan){cam.x=e.clientX-pan.x;cam.y=e.clientY-pan.y;moved=true;drawBrain();return}
 const n=pick(e);if(n!==hover){hover=n;drawBrain()}if(n){tip.hidden=false;tip.textContent=n.label+(n.file&&n.file!==n.label?' · '+n.file:'')+(n.members?' · '+T['html.folderHint']:'');tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY+12)+'px'}else tip.hidden=true});
const up=e=>{ptrs.delete(e.pointerId);if(pinch){if(ptrs.size<2)pinch=null;return}cv.classList.remove('drag');const n=dragN;dragN=null;pan=null;
 if(!moved){const hit=n||pick(e);if(hit&&hit.members)openFolder(hit);else if(hit)select(hit.id);else reset()}};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);cv.addEventListener('pointerleave',()=>{tip.hidden=true});
cv.addEventListener('wheel',e=>{e.preventDefault();const p=world(e.clientX,e.clientY),f=Math.exp(-e.deltaY*0.0015);cam.z=Math.min(8,Math.max(0.08,cam.z*f));cam.x=e.clientX-W/2-p.x*cam.z;cam.y=e.clientY-H/2-p.y*cam.z;drawBrain()},{passive:false});
function openFolder(b){setMode('files');findSet=new Set(b.members);fit(findSet);drawBrain()}

// ---------- shared ----------
function select(id){if(!byId.has(id))return;if(view==='brain'&&mode==='folders')setMode('files');selId=id;selSet=chain(id);findSet=null;showInfo(id);
 try{history.replaceState(null,'','#n='+encodeURIComponent(id))}catch{}
 if(view==='columns'){paintCols();el.get(id).scrollIntoView({block:'nearest',inline:'nearest'})}else drawBrain()}
function reset(){selId=null;selSet=null;findSet=null;info.hidden=true;q.value='';try{history.replaceState(null,'',location.pathname+location.search)}catch{}view==='columns'?paintCols():drawBrain()}
q.oninput=()=>{const text=q.value.trim().toLowerCase();selId=null;selSet=null;info.hidden=true;findSet=text?new Set(D.nodes.filter(n=>(n.label+' '+n.file+' '+n.desc).toLowerCase().includes(text)).map(n=>n.id)):null;
 if(view==='brain'&&mode==='folders'&&findSet)setMode('files');if(view==='columns')paintCols();else drawBrain()};
$('all').onclick=()=>{reset();if(view==='brain'){fit();drawBrain()}};addEventListener('keydown',e=>{if(e.key==='Escape')reset()});
function legend(){$('legend').innerHTML=view==='brain'&&(colorMode==='folders'||mode==='folders')?fams.slice(0,9).map(f=>'<span><i style="background:'+famColor(f)+'"></i>'+esc(f)+'</span>').join('')+(D.nodes.some(n=>n.badge)?'<span>· '+esc(T['html.badgeLegend'])+'</span>':''):D.cols.map(([c,t])=>'<span><i style="background:'+(view==='brain'?GLOW[c]:COLOR[c])+'"></i>'+esc(t)+'</span>').join('')}
function paintLabel(){$('paint').textContent=T['html.colors']+' : '+(colorMode==='folders'?T['html.byFolder']:T['html.byType']);$('mode').textContent=mode==='folders'?T['html.files']:T['html.folders']}
function setMode(mo){mode=mo;setGraph(mode==='folders'?buildFolders():buildFiles());paintLabel();legend();$('paint').hidden=view!=='brain'||mode==='folders';drawBrain();if(!reduce)wake(0.08)}
function setView(v){view=v==='columns'?'columns':'brain';try{localStorage.setItem('carte-view',view)}catch{}document.body.classList.toggle('brain',view==='brain');$('vb').setAttribute('aria-pressed',view==='brain');$('vc').setAttribute('aria-pressed',view==='columns');
 $('png').hidden=$('mode').hidden=view!=='brain';$('paint').hidden=view!=='brain'||mode==='folders';legend();if(view==='columns')drawCols();else{resize();fit();drawBrain()}}
$('vb').onclick=()=>setView('brain');$('vc').onclick=()=>setView('columns');$('mode').onclick=()=>setMode(mode==='folders'?'files':'folders');
$('paint').onclick=()=>{colorMode=colorMode==='folders'?'types':'folders';try{localStorage.setItem('carte-colors',colorMode)}catch{}paintLabel();legend();drawBrain()};
$('png').onclick=()=>cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(D.title||'carte').replace(/[^\\w-]+/g,'-')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
addEventListener('resize',()=>{if(view==='brain'){resize();drawBrain()}else drawCols()});
resize();paintLabel();setGraph(mode==='folders'?buildFolders():buildFiles());setView(view);if(!reduce)wake(0.05);
const deep=decodeURIComponent((location.hash.match(/^#n=(.+)$/)||[])[1]||'');if(deep&&byId.has(deep))select(deep);
</script></body></html>`;
}
