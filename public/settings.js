/* typesh!t: the customize tab (theme, colours, font, layout, caret, sound) plus a few surprises. */
const COLS=['bg','panel','sub','text','accent','err'];
const THEMES={
  auto:null,
  dusk:{bg:'#24222b',panel:'#1b1a21',sub:'#807c90',text:'#dcd9e4',accent:'#b7a2f7',err:'#f0637a'},
  paper:{bg:'#f2f0f5',panel:'#e5e2ec',sub:'#8f8aa0',text:'#2b2833',accent:'#6a4be0',err:'#d13a55'},
  moss:{bg:'#1f2a24',panel:'#18211c',sub:'#71887a',text:'#dfe8dc',accent:'#9bd67c',err:'#f07a6a'},
  tide:{bg:'#14212b',panel:'#0f1a22',sub:'#628398',text:'#d6e6f0',accent:'#5cc8e8',err:'#ff7a8a'},
  ember:{bg:'#2a1f1c',panel:'#211816',sub:'#967a6d',text:'#f0e2d8',accent:'#ff9d5c',err:'#ff5c7a'},
  sand:{bg:'#e9dfcb',panel:'#ddd0b6',sub:'#978766',text:'#3b3324',accent:'#b0552a',err:'#b3261e'},
  bubblegum:{bg:'#fbe9f1',panel:'#f3d6e3',sub:'#b0839a',text:'#4a2638',accent:'#d6337f',err:'#b81f1f'},
  ink:{bg:'#ffffff',panel:'#ececec',sub:'#959595',text:'#111111',accent:'#111111',err:'#d11a2a'},
  void:{bg:'#000000',panel:'#131313',sub:'#6e6e6e',text:'#eeeeee',accent:'#ffffff',err:'#ff4d4d'},
  gold:{bg:'#17130a',panel:'#0f0c06',sub:'#8a7a48',text:'#f3e7c0',accent:'#ffcf3f',err:'#ff6b5c',secret:true}
};
/* family -> [google fonts spec, group]. "b" marks families that ship a real bold weight */
const FB=':wght@400;700';
const FONTS={
  'JetBrains Mono':['JetBrains+Mono'+FB,'mono'],'IBM Plex Mono':['IBM+Plex+Mono'+FB,'mono'],'Fira Code':['Fira+Code'+FB,'mono'],'Roboto Mono':['Roboto+Mono'+FB,'mono'],
  'Source Code Pro':['Source+Code+Pro'+FB,'mono'],'Inconsolata':['Inconsolata'+FB,'mono'],'Ubuntu Mono':['Ubuntu+Mono'+FB,'mono'],'Space Mono':['Space+Mono'+FB,'mono'],
  'Red Hat Mono':['Red+Hat+Mono'+FB,'mono'],'Martian Mono':['Martian+Mono'+FB,'mono'],'Victor Mono':['Victor+Mono'+FB,'mono'],'Overpass Mono':['Overpass+Mono'+FB,'mono'],
  'Anonymous Pro':['Anonymous+Pro'+FB,'mono'],'DM Mono':['DM+Mono','mono'],'Courier Prime':['Courier+Prime'+FB,'mono'],'Cutive Mono':['Cutive+Mono','mono'],
  'Share Tech Mono':['Share+Tech+Mono','mono'],'Syne Mono':['Syne+Mono','mono'],'Xanh Mono':['Xanh+Mono','mono'],'Nova Mono':['Nova+Mono','mono'],'Major Mono Display':['Major+Mono+Display','mono'],
  'Archivo Black':['Archivo+Black','sans'],'Poppins':['Poppins'+FB,'sans'],'Outfit':['Outfit'+FB,'sans'],'Lexend':['Lexend'+FB,'sans'],'Atkinson Hyperlegible':['Atkinson+Hyperlegible'+FB,'sans'],
  'Fredoka':['Fredoka'+FB,'sans'],'Righteous':['Righteous','sans'],'Orbitron':['Orbitron'+FB,'sans'],
  'VT323':['VT323','pixel'],'Press Start 2P':['Press+Start+2P','pixel'],'Silkscreen':['Silkscreen'+FB,'pixel'],'Pixelify Sans':['Pixelify+Sans'+FB,'pixel'],'DotGothic16':['DotGothic16','pixel'],
  'Special Elite':['Special+Elite','odd'],'Comic Neue':['Comic+Neue'+FB,'odd'],'Caveat':['Caveat'+FB,'odd'],'Permanent Marker':['Permanent+Marker','odd'],'Bungee':['Bungee','odd'],
  'Creepster':['Creepster','odd'],'UnifrakturCook':['UnifrakturCook:wght@700','odd'],
  'Playfair Display':['Playfair+Display'+FB,'serif'],'EB Garamond':['EB+Garamond'+FB,'serif']
};
const FGROUPS=[['mono','monospace'],['sans','sans serif'],['pixel','pixel and retro'],['odd','odd ones'],['serif','serif']];
const DEF={theme:'auto',font:'JetBrains Mono',bold:'off',size:1.6,width:'normal',align:'left',lines:3,caret:'line',smooth:'on',sound:'off',focus:'off'};
const cfgv=k=>store.cfg[k]??DEF[k];
const has=id=>store.secrets.includes(id);
const fontsLoaded={'JetBrains Mono':1};

function lum(hex){const n=parseInt(hex.slice(1),16);return(.299*(n>>16&255)+.587*(n>>8&255)+.114*(n&255))/255}
function loadFont(f){
  if(fontsLoaded[f]||!FONTS[f])return;
  fontsLoaded[f]=1;const l=document.createElement('link');l.rel='stylesheet';l.href=`https://fonts.googleapis.com/css2?family=${FONTS[f][0]}&display=swap`;document.head.appendChild(l);
}
function applyCfg(){
  const r=document.documentElement,b=document.body,th=THEMES[cfgv('theme')],ov=store.cfg.colors||{};
  for(const k of COLS){const v=ov[k]||(th&&th[k]);v?r.style.setProperty('--'+k,v):r.style.removeProperty('--'+k)}
  const bg=ov.bg||(th&&th.bg);r.style.colorScheme=bg?(lum(bg)<.5?'dark':'light'):'';
  const f=FONTS[cfgv('font')]?cfgv('font'):DEF.font;
  loadFont(f);
  r.style.setProperty('--mono',`'${f}',ui-monospace,Menlo,Consolas,monospace`);
  cfgv('bold')==='on'?r.style.setProperty('--weight','700'):r.style.removeProperty('--weight');
  cfgv('size')===DEF.size?r.style.removeProperty('--fs'):r.style.setProperty('--fs',cfgv('size')+'rem');
  r.style.setProperty('--lines',cfgv('lines'));
  b.dataset.width=cfgv('width');b.dataset.align=cfgv('align');b.dataset.caret=cfgv('caret');
  b.classList.toggle('snap',cfgv('smooth')==='off');b.classList.toggle('focus',cfgv('focus')==='on');
}
setInterval(()=>document.body.classList.toggle('playing',st==='run'&&typing()),200);

/* ---------- key sounds ---------- */
let actx;
function blip(ok){
  const s=cfgv('sound');if(s==='off')return;
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    const o=actx.createOscillator(),g=actx.createGain(),t=actx.currentTime;
    if(s==='quack'){o.type='sawtooth';o.frequency.setValueAtTime(ok?620:300,t);o.frequency.exponentialRampToValueAtTime(ok?280:120,t+.11);g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.0001,t+.13)}
    else if(s==='pop'){o.type='sine';o.frequency.setValueAtTime(ok?500+Math.random()*120:170,t);g.gain.setValueAtTime(.09,t);g.gain.exponentialRampToValueAtTime(.0001,t+.08)}
    else{o.type='square';o.frequency.setValueAtTime(ok?1700+Math.random()*200:140,t);g.gain.setValueAtTime(.025,t);g.gain.exponentialRampToValueAtTime(.0001,t+(ok?.02:.07))}
    o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+.15);
  }catch(e){}
}

/* ---------- customize page ---------- */
function drawCustom(){
  Object.keys(FONTS).forEach(loadFont);
  const pills=(k,vals,lab=v=>v)=>`<div class="bar">${vals.map(v=>`<button data-c="${k}" data-v="${v}" class="${String(cfgv(k))===String(v)?'on':''}">${lab(v)}</button>`).join('')}</div>`;
  const row=(name,html)=>`<span>${name}</span><div>${html}</div>`;
  const cs=getComputedStyle(document.documentElement);
  const themes=Object.keys(THEMES).filter(k=>!THEMES[k]?.secret||has(k));
  const sw=k=>THEMES[k]?`<span class="sw" style="background:${THEMES[k].bg}"><i style="background:${THEMES[k].accent}"></i><i style="background:${THEMES[k].text}"></i></span>`:'';
  $('#custom').innerHTML=`<h2>customize</h2>
    <div class="pv"><span class="ok">make it</span> <span class="ok">yo</span><span class="cur"></span>urs <span class="bad">exactyl</span> how you like it</div>
    <div class="opts">
    ${row('theme',pills('theme',themes,k=>sw(k)+k))}
    ${row('colours',`<div class="cols">${[['bg','background'],['text','typed text'],['sub','untyped text'],['accent','accent'],['err','mistakes'],['panel','panels']].map(([k,l])=>`<label><input type="color" id="col-${k}" data-col="${k}" value="${cs.getPropertyValue('--'+k).trim()}">${l}</label>`).join('')}<button class="soft" data-act="colors">reset colours</button></div>`)}
    ${FGROUPS.map(([g,name],i)=>row(i?'':'font',`<p class="cap fg">${name}</p><div class="bar">${Object.keys(FONTS).filter(f=>FONTS[f][1]===g).map(f=>`<button data-c="font" data-v="${f}" style="font-family:'${f}',var(--mono)" class="${cfgv('font')===f?'on':''}">${f}</button>`).join('')}</div>`)).join('')}
    ${row('bold text',pills('bold',['off','on']))}
    ${row('text size',`<input type="range" id="fsize" min="1" max="3" step="0.1" value="${cfgv('size')}" aria-label="Text size">`)}
    ${row('page width',pills('width',['narrow','normal','wide']))}
    ${row('align words',pills('align',['left','center']))}
    ${row('lines shown',pills('lines',[1,2,3,5]))}
    ${row('caret',pills('caret',['line','block','underline','none']))}
    ${row('smooth caret',pills('smooth',['on','off']))}
    ${row('key sounds',pills('sound',['off','tick','pop'].concat(has('quack')?['quack']:[])))}
    ${row('focus mode',pills('focus',['off','on'])+'<p class="cap">hides the menus while you are typing.</p>')}
    ${row('',`<button class="soft" data-act="all">reset everything on this page</button>`)}
    </div>`;
}
$('#custom').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.c){
    const k=b.dataset.c,v=b.dataset.v;store.cfg[k]=isNaN(v)?v:+v;
    if(k==='theme')delete store.cfg.colors;
    if(k==='sound')setTimeout(()=>blip(true),0);
  }else if(b.dataset.act==='colors')delete store.cfg.colors;
  else if(b.dataset.act==='all')store.cfg={};
  else return;
  save();applyCfg();drawCustom();
});
$('#custom').addEventListener('input',e=>{
  if(e.target.dataset.col){(store.cfg.colors||(store.cfg.colors={}))[e.target.dataset.col]=e.target.value}
  else if(e.target.id==='fsize')store.cfg.size=+e.target.value;
  else return;
  save();applyCfg();
});

/* ---------- toast + confetti ---------- */
let toastTm;
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toastTm);toastTm=setTimeout(()=>el.classList.remove('on'),3200)}
function confetti(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const c=document.createElement('canvas');c.id='confetti';c.width=innerWidth;c.height=innerHeight;document.body.appendChild(c);
  const x=c.getContext('2d'),cs=getComputedStyle(document.documentElement),cols=['--accent','--text','--err'].map(k=>cs.getPropertyValue(k).trim());
  const ps=Array.from({length:120},()=>({x:c.width/2,y:c.height*.6,vx:(Math.random()-.5)*16,vy:-Math.random()*17-4,s:4+Math.random()*5,c:cols[Math.floor(Math.random()*3)],r:Math.random()*6}));
  let n=0;(function f(){
    x.clearRect(0,0,c.width,c.height);
    for(const p of ps){p.x+=p.vx;p.y+=p.vy;p.vy+=.45;p.r+=.2;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);x.restore()}
    if(++n<130)requestAnimationFrame(f);else c.remove();
  })();
}

/* ---------- surprises ---------- */
const SECRETS=5;
function unlock(id,msg){
  if(has(id))return false;
  store.secrets.push(id);save();toast(msg);setTimeout(confetti,30);
  if(view==='play'&&st!=='run')drawNav();
  return true;
}
function egg(o){
  let s='';
  if(mode==='classic'&&o.acc===100&&o.score>=30&&unlock('blackout','flawless. a new game just appeared: blackout'))s+='<em>something unlocked.</em> ';
  if(o.wpm===69)s+='nice. ';
  if(o.score===0&&!MODES[mode].lower)s+='were you typing with your elbows? ';
  if(o.wpm>=120&&o.acc>=97)s+='certified typeshit. ';
  return s;
}
let logoN=0,logoT=0,seq=[],word='';
$('.logo').addEventListener('click',()=>{
  const now=Date.now();logoN=now-logoT<600?logoN+1:1;logoT=now;
  if(logoN>=5){logoN=0;unlock('quake','you shook something loose. new game: earthquake')}
});
const KON='ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a';
document.addEventListener('keydown',e=>{
  seq.push(e.key);seq=seq.slice(-10);
  if(seq.join()===KON)unlock('reflex','cheat code accepted. new game: reflex');
  if(!typing()&&e.target.tagName!=='INPUT'&&e.key.length===1){
    word=(word+e.key.toLowerCase()).slice(-8);
    if(word==='typeshit'&&unlock('gold','you said the magic word. new theme: gold')){store.cfg.theme='gold';delete store.cfg.colors;save();applyCfg();if(view==='custom')drawCustom()}
  }
});
let spell='';
function heatKey(k){
  spell=(spell+k).slice(-4);
  if(spell==='shit')unlock('quack','the keyboard heard that. new key sound: quack');
}

applyCfg();
