/* typesh!t: games, input and routing.
   settings.js handles customize, stats.js draws the stats tab, friends.js runs live matches. */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

let mp=null;                                   /* set while a friends match is running: {kind,opt,rng} */
const rand=()=>mp?mp.rng():Math.random();      /* seeded in a match so everyone gets the same words */
const rnd=a=>a[Math.floor(rand()*a.length)];

const COMMON="the be of and a to in he have it that for they with as not on she at by this we you do but from or which one would all will there say who make when can more if no man out other so what time up go about than into could state only new year some take come these know see use get like then first any work now may such give over think most even find day also after way many must look before great back through long where much should well people down own just because good each those feel seem how high too place little world very still nation hand old life tell write become here show house both between need mean call develop under last right move thing general school never same another begin while number part turn real leave might want point form off child few small since against ask late home interest large person end open public follow during present without again hold govern around possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase early course change help line".split(" ");
const LONG="keyboard language adventure midnight champion notebook fantastic blueberry chocolate dangerous electric festival generous hospital important knowledge lightning mountain neighbor operation paragraph question remember skeleton together umbrella vacation wonderful yesterday absolutely basketball confidence difference experiment friendship government incredible journalism laboratory motorcycle photograph restaurant strawberry technology understand vocabulary watermelon architecture celebration comfortable development environment independent mathematics opportunity perspective temperature accidentally breakthrough civilization disappointed encyclopedia refrigerator thunderstorm".split(" ");
const SENT=["The kettle clicked off just as the rain started, which felt like good timing for once.","Nobody told the cat that the couch was new, so she tested it thoroughly.","If you leave now, you'll beat the traffic; if you wait, you'll get dessert.","My neighbor waters his lawn at midnight and waves like it's perfectly normal.","The map said ten minutes, but the map had never met this hill.","She fixed the printer by glaring at it, a method I've since adopted.","We ordered two pizzas for three people and somehow still ran out.","Every drawer in this house has exactly one battery, and none of them work.","He practiced the speech in the car, at the gym, and once, briefly, in his sleep.","The Wi-Fi password is taped under the desk, where all great secrets live.","Monday showed up early, uninvited, and stayed far too long.","I don't lose socks; the dryer simply collects a small tax.","Typing fast is easy. Typing fast without mistakes is the actual job.","The dog heard the word \"walk\" from two rooms away and has not blinked since.","After the third coffee, the spreadsheet finally started to make sense.","Turn left at the big oak tree, then keep going until you doubt yourself.","The elevator stopped on every floor, as if it wanted company.","Grandpa's chili recipe has one rule: nobody asks what's in it.","It was a quiet Tuesday until the smoke alarm offered its opinion.","You can't rush a good loaf of bread, though I've certainly tried.","The meeting could've been an email, and the email could've been nothing.","Her handwriting looked like a seismograph during a minor earthquake.","We got lost twice, argued once, and still made it before the previews ended.","Somewhere between page one and page two, I forgot what I was searching for."];
const ABC='abcdefghijklmnopqrstuvwxyz';
const ALL=COMMON.concat(LONG), ALLSET=new Set(ALL), MID=COMMON.filter(w=>w.length>=3), CHUNKY=COMMON.filter(w=>w.length>=4);
const SCR=ALL.filter(w=>w.length>=4&&w.length<=8&&new Set(w).size>2);

const MODES={
  classic:{label:'classic',unit:'wpm',desc:'type as much as you can before the clock runs out',opts:[15,30,60],def:30,suffix:'s'},
  sentences:{label:'sentences',unit:'wpm',desc:'real sentences with capitals and punctuation',opts:['short','long'],def:'short'},
  rain:{label:'rain',unit:'words',desc:'words fall. type them before they land. three lives',opts:['drizzle','rain','storm'],def:'rain'},
  death:{label:'sudden death',unit:'words',desc:'one wrong key and the run is over'},
  chase:{label:'outrun',unit:'words',desc:'a red caret hunts you down the page and it keeps speeding up'},
  ghost:{label:'ghost race',unit:'wpm',desc:'race a ghost over 30 words',opts:[40,60,80,100,'my best'],def:60,suffix:' wpm'},
  bomb:{label:'bomb',unit:'words',desc:'finish each word before its fuse burns out. fuses get shorter'},
  memory:{label:'memory',unit:'words',desc:'the word flashes, then vanishes. type it from memory. three lives'},
  scramble:{label:'scramble',unit:'words',desc:'unscramble as many words as you can in 45 seconds'},
  mirror:{label:'mirror',unit:'words',desc:'type each word backwards. 45 seconds'},
  alphabet:{label:'alphabet',unit:'s',lower:true,desc:'the whole alphabet, as fast as your fingers go',opts:['a-z','z-a'],def:'a-z'},
  race:{label:'friends race',unit:'wpm',desc:'',hidden:true},
  daily:{label:'daily',unit:'words',desc:'',hidden:true},
  quake:{label:'earthquake',unit:'wpm',desc:'30 seconds. the ground is not helping',secret:true},
  blackout:{label:'blackout',unit:'wpm',desc:'30 seconds. whatever you type disappears. trust your hands',secret:true},
  reflex:{label:'reflex',unit:'ms',lower:true,desc:'ten letters. hit each one the instant it appears',secret:true}
};
const LINE=['classic','death','ghost','race','sentences','chase','quake','blackout'];
const TIMED30=['quake','blackout'];

/* ---------- saved data (this browser only) ---------- */
const BLANK=()=>({opt:{},best:{},hist:[],keys:{},words:{},mp:{races:0,wins:0},name:'',cfg:{},secrets:[],daily:{},auth:null});
let store=BLANK();
try{Object.assign(store,JSON.parse(localStorage.getItem('typeshit')||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem('typeshit',JSON.stringify(store))}catch(e){}};

let lastKey=0;
function logKey(ch,ok,untimed){
  if(!untimed&&typeof blip==='function')blip(ok);
  ch=(ch||'').toLowerCase();
  if(!/^[a-z ]$/.test(ch))return;
  const k=store.keys[ch]||(store.keys[ch]={n:0,m:0,t:0,c:0});
  k.n++;if(!ok)k.m++;
  if(untimed)return;
  const now=performance.now(),d=now-lastKey;lastKey=now;
  if(ok&&d>20&&d<1500){k.t+=Math.round(d);k.c++}
}
function logWord(w,ok){w=w.toLowerCase().replace(/[^a-z]/g,'');if(!w)return;const r=store.words[w]||(store.words[w]=[0,0]);r[0]++;if(!ok)r[1]++}
function record(o){
  store.hist.push({d:Date.now(),m:mode,o:opt()??'',s:o.score,w:o.wpm||0,a:o.acc??100,t:Math.round(o.time||0)});
  if(store.hist.length>3000)store.hist.splice(0,store.hist.length-3000);
  save();
}

const shown=k=>MODES[k]&&!MODES[k].hidden&&(!MODES[k].secret||store.secrets.includes(k));
const homeMode=()=>shown(store.mode)?store.mode:'classic';
let view='play', mode=homeMode(), st='idle', loopId=0, tickId=0, tm=0, cdId=0;
const opt=()=>mp?(mp.opt??MODES[mode].def):(store.opt[mode]??MODES[mode].def);
const bestKey=()=>mode+':'+(opt()??'');
const isLine=()=>LINE.includes(mode);
const lineDur=()=>mode==='classic'?opt():TIMED30.includes(mode)?30:0;
const pct=(a,b)=>b?Math.round(100*a/b):100;

const stage=$('#stage'),hud=$('#hud'),inner=$('#inner'),sky=$('#sky'),buf=$('#buf'),big=$('#big'),fuse=$('#fuse'),ans=$('#ans'),kb=$('#kb');
const hint=t=>$('#solohint').textContent=t;
const shake=()=>{big.classList.remove('shake');void big.offsetWidth;big.classList.add('shake')};

/* ---------- chrome ---------- */
function drawNav(){
  $('#modes').innerHTML=Object.keys(MODES).filter(shown).map(k=>`<button data-m="${k}" class="${k===mode?'on':''}">${MODES[k].label}</button>`).join('');
  const m=MODES[mode];
  $('#desc').textContent=m.desc;
  $('#opts').innerHTML=(m.opts||[]).map(o=>`<button data-o="${o}" class="${String(o)===String(opt())?'on':''}">${o}${typeof o==='number'?m.suffix:''}</button>`).join('');
  const b=store.best[bestKey()];
  $('#best').textContent=b?`best ${b} ${m.unit}`:'no best yet';
  const k=t=>`<kbd>${t}</kbd>`;
  $('#keys').innerHTML=mode==='scramble'?`${k('enter')} clear &nbsp; ${k('tab')} reshuffle &nbsp; ${k('space')} skip &nbsp; ${k('esc')} restart`
    :mode==='mirror'?`${k('enter')} clear &nbsp; ${k('space')} skip &nbsp; ${k('tab')} restart`
    :`${k('tab')} restart &nbsp; ${k('esc')} reset`;
}
$('#modes').onclick=e=>{const m=e.target.dataset.m;if(m){mode=m;store.mode=m;save();reset()}};
$('#opts').onclick=e=>{let o=e.target.dataset.o;if(o===undefined)return;store.opt[mode]=isNaN(o)?o:+o;save();reset()};
stage.onclick=()=>focusKb();
function focusKb(){kb.value=' ';kb.focus({preventScroll:true})}
function syncFocus(){stage.classList.toggle('blurred',!document.hasFocus())}
addEventListener('focus',syncFocus);addEventListener('blur',syncFocus);

function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('show',v.id===id));stage.classList.toggle('done',id==='result')}
function stop(){cancelAnimationFrame(loopId);clearInterval(tickId);clearTimeout(tm);clearInterval(cdId)}

const SOLO={bomb:()=>bombInit(),memory:()=>memInit(),scramble:()=>promptInit(),mirror:()=>promptInit(),alphabet:()=>alphaInit(),reflex:()=>rxInit()};
function setup(){
  stop();st='idle';lastKey=0;hud.innerHTML='';document.body.dataset.mode=mode;
  if(isLine()){show('line');lineInit()}
  else if(mode==='rain'){show('rain');rainInit()}
  else{show('solo');ans.style.display='none';fuse.style.display='none';big.className='';SOLO[mode]()}
  focusKb();syncFocus();
}
function reset(){drawNav();setup()}
/* a friends match starts every game on the shared countdown instead of the first key */
function startNow(){if(isLine())lineStart();else if(mode==='rain')rainStart();else promptStart()}

/* ---------- results ---------- */
function chart(s){
  if(s.length<2)return '';
  const W=600,H=110,p=4,max=Math.max(...s,10);
  const pts=s.map((v,i)=>(p+i*(W-2*p)/(s.length-1)).toFixed(1)+','+(H-p-(v/max)*(H-2*p)).toFixed(1)).join(' ');
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Speed over time"><polygon class="area" points="${p},${H-p} ${pts} ${W-p},${H-p}"/><polyline class="ln" points="${pts}"/></svg><figcaption>wpm each second, peak ${Math.max(...s)}</figcaption></figure>`;
}
function finish(o){
  stop();st='done';
  if(mp){record(o);hud.innerHTML=`${o.score}<small>${o.label}. waiting for the others</small>`;return mpDone(o)}
  const key=bestKey(),prev=store.best[key]||0,lower=MODES[mode].lower;
  const isBest=o.score>0&&(lower?(!prev||o.score<prev):o.score>prev);
  if(isBest)store.best[key]=o.score;
  record(o);
  if(typeof submitScore==='function')submitScore(key,o.score);
  const extra=typeof egg==='function'?egg(o):'';
  $('#result').innerHTML=`<div class="top"><div class="stat"><small>${o.label}</small><b>${o.score}</b></div>`+
    o.stats.map(([k,v])=>`<div class="stat s"><small>${k}</small><b>${v}</b></div>`).join('')+`</div>`+
    `<p class="note">${o.note||''} ${isBest?'<em>new best.</em>':prev?`best ${prev}.`:''} ${extra}</p>`+
    chart(o.samples||[])+`<button id="again" class="soft">play again <kbd>tab</kbd></button>`;
  $('#again').onclick=reset;
  hud.innerHTML='';show('result');drawNav();
}

/* ---------- line modes: classic, sentences, sudden death, outrun, ghost, friends race, and a couple more ---------- */
let L,wordEls,rowH;
function lineInit(){
  let words=[];
  if(mode==='sentences'){
    const pool=SENT.slice(),n=opt()==='long'?3:1;
    for(let i=0;i<n;i++)words.push(...pool.splice(Math.floor(rand()*pool.length),1)[0].split(' '));
  }else{
    const n=mode==='race'?opt():mode==='ghost'?30:300;
    while(words.length<n){const w=rnd(COMMON);if(w!==words[words.length-1])words.push(w)}
  }
  L={words,typed:[''],wi:0,keys:0,good:0,start:0,samples:[],cw:25};
  L.total=words.reduce((a,w)=>a+w.length+1,-1);
  const best=Math.max(0,...Object.keys(store.best).filter(k=>k.startsWith('classic:')).map(k=>store.best[k]));
  L.gwpm=opt()==='my best'?(best||50):opt();
  inner.innerHTML='<div class="caret idle" id="caret"></div><div class="caret" id="gcaret"></div>'+
    words.map(w=>`<span class="w">${[...w].map(c=>`<i>${esc(c)}</i>`).join('')}</span>`).join('');
  wordEls=inner.querySelectorAll('.w');
  inner.style.transform='';
  const g=$('#gcaret'),second=mode==='ghost'||mode==='chase';
  $('#track').classList.toggle('show',mode==='ghost');
  g.style.display=second?'block':'none';g.classList.toggle('hunter',mode==='chase');
  $('#pme').style.transform=$('#pgh').style.transform='scaleX(0)';
  rowH=parseFloat(getComputedStyle(inner).fontSize)*1.85;
  lineHud();placeCaret();
  if(second)moveTo(g,0);
}
function paintWord(i){
  const w=L.words[i],t=L.typed[i]||'';let h='';
  for(let j=0;j<Math.max(w.length,t.length);j++)
    h+=j<w.length?`<i class="${j<t.length?(t[j]===w[j]?'ok':'bad'):''}">${esc(w[j])}</i>`:`<i class="bad extra">${esc(t[j])}</i>`;
  wordEls[i].innerHTML=h;
  wordEls[i].classList.toggle('err',i<L.wi&&t!==w);
}
function spot(wi,ci){
  const el=wordEls[wi],ls=el.children,l=ls[Math.min(ci,ls.length-1)];
  return [l.offsetLeft+(ci>=ls.length?l.offsetWidth:0),el.offsetTop];
}
function placeCaret(){
  const wi=Math.min(L.wi,L.words.length-1),[x,y]=spot(wi,(L.typed[wi]||'').length);
  $('#caret').style.transform=`translate(${x}px,${y}px)`;
  const lines=typeof cfgv==='function'?cfgv('lines'):3;
  inner.style.transform=`translateY(${-Math.max(0,y-(lines>1?rowH:0))}px)`;
}
function moveTo(el,chars){
  let i=0;while(i<L.words.length-1&&chars>L.words[i].length){chars-=L.words[i].length+1;i++}
  const [x,y]=spot(i,Math.max(0,Math.floor(chars)));
  el.style.transform=`translate(${x}px,${y}px)`;
}
function lineStats(el){
  let chars=0,all=L.wi;
  L.typed.forEach((t,i)=>{
    const w=L.words[i];if(!w)return;all+=t.length;
    if(i<L.wi){if(t===w)chars+=w.length+1}
    else for(let j=0;j<t.length&&t[j]===w[j];j++)chars++;
  });
  const min=Math.max(el,.5)/60;
  return {wpm:Math.round(chars/5/min),raw:Math.round(all/5/min),acc:pct(L.good,L.keys)};
}
function myChars(){let c=0;for(let i=0;i<L.wi&&i<L.words.length;i++)c+=L.words[i].length+1;return Math.min(L.total,c+Math.min(L.typed[L.wi]?.length||0,L.words[L.wi]?.length||0))}
function lineHud(){
  const run=st==='run',el=run?(performance.now()-L.start)/1000:0,s=lineStats(el),d=lineDur();
  if(d)hud.innerHTML=`${Math.max(0,Math.ceil(d-el))}<small>${run?s.wpm+' wpm':''}</small>`;
  else if(mode==='death')hud.innerHTML=`${L.wi}<small>words alive</small>`;
  else if(mode==='chase')hud.innerHTML=`${L.wi}<small>words</small><small>${run?'hunter at '+Math.round(L.cw)+' wpm':'it gives you a two second head start'}</small>`;
  else if(mode==='ghost')hud.innerHTML=`${run?s.wpm:L.gwpm}<small>${run?'wpm':'wpm ghost'}</small>`;
  else hud.innerHTML=run?`${s.wpm}<small>wpm</small>`:'';
}
function lineStart(){st='run';lastKey=0;L.start=performance.now();$('#caret').classList.remove('idle');tickId=setInterval(lineTick,100);lineHud()}
function lineTick(){
  const el=(performance.now()-L.start)/1000;
  if(Math.floor(el)>L.samples.length)L.samples.push(lineStats(el).wpm);
  if(mode==='ghost'){
    const g=Math.min(L.total,el/60*L.gwpm*5);
    $('#pgh').style.transform=`scaleX(${g/L.total})`;
    moveTo($('#gcaret'),g);
  }
  if(mode==='chase'){
    const t=Math.max(0,el-2),c=(25*t+1.1*t*t)*5/60;L.cw=25+2.2*t;
    moveTo($('#gcaret'),Math.min(c,L.total));
    if(t>0&&c>=myChars())return lineEnd();
  }
  lineHud();
  if(lineDur()&&el>=lineDur())lineEnd();
}
function lineEnd(killer){
  const el=lineDur()||(performance.now()-L.start)/1000,s=lineStats(el);
  const base={wpm:s.wpm,acc:s.acc,time:el,samples:L.samples};
  const stats=[['accuracy',s.acc+'%'],['raw',s.raw],['time',el.toFixed(1)+'s']];
  if(mode==='death')finish({label:'words survived',score:L.wi,stats:[['wpm',s.wpm],['time',el.toFixed(1)+'s']],...base,
    note:killer?`killed by <em>${esc(killer)}</em>.`:'you cleared every word.'});
  else if(mode==='chase')finish({label:'words before it got you',score:L.wi,stats:[['wpm',s.wpm],['accuracy',s.acc+'%'],['survived',el.toFixed(1)+'s']],...base,
    note:`the hunter was doing <em>${Math.round(L.cw)} wpm</em> when it caught you.`});
  else if(mode==='ghost'){
    const gt=L.total/5/L.gwpm*60,d=Math.abs(gt-el).toFixed(1);
    finish({label:'wpm',score:s.wpm,stats,...base,
      note:el<gt?`you beat the ${L.gwpm} wpm ghost by <em>${d}s</em>.`:`the ${L.gwpm} wpm ghost won by ${d}s.`});
  }
  else finish({label:'wpm',score:s.wpm,stats,...base});
}
function lineChar(ch){
  if(st==='idle')lineStart();
  const w=L.words[L.wi],t=L.typed[L.wi];
  if(ch===' '){
    if(!t)return;
    L.keys++;logKey(' ',t===w);logWord(w,t===w);
    if(t===w)L.good++;else if(mode==='death'){paintWord(L.wi);return lineEnd(w)}
    L.wi++;L.typed[L.wi]='';paintWord(L.wi-1);
    if(L.wi>=L.words.length)return lineEnd();
  }else{
    if(t.length>=w.length+8)return;
    const ok=ch===w[t.length];
    L.keys++;if(ok)L.good++;
    logKey(w[t.length],ok);
    L.typed[L.wi]=t+ch;paintWord(L.wi);
    if(!ok&&mode==='death'){logWord(w,false);return lineEnd(w)}
    if(L.wi===L.words.length-1&&L.typed[L.wi]===w){logWord(w,true);L.wi++;L.typed[L.wi]='';$('#pme').style.transform='scaleX(1)';return lineEnd()}
  }
  if(mode==='ghost')$('#pme').style.transform=`scaleX(${myChars()/L.total})`;
  placeCaret();
}
function lineBack(whole){
  const t=L.typed[L.wi];
  if(t)L.typed[L.wi]=whole?'':t.slice(0,-1);
  else if(L.wi>0&&L.typed[L.wi-1]!==L.words[L.wi-1]){L.typed.pop();L.wi--;if(whole)L.typed[L.wi]=''}
  paintWord(L.wi);placeCaret();
}

/* ---------- rain ---------- */
let R;
function rainInit(){
  const d={drizzle:[26,1.25],rain:[38,1],storm:[54,.8]}[opt()]||[38,1];
  R={items:[],buf:'',score:0,lives:3,keys:0,good:0,chars:0,time:0,spawn:0,v:d[0],gap:d[1],last:0};
  sky.innerHTML=`<div class="hint">${mp?'same storm for everyone':'press any key to start the rain'}</div>`;buf.textContent='';
  rainHud();
}
const dots=n=>'●'.repeat(n)+'○'.repeat(3-n);
function rainHud(){hud.innerHTML=`${R.score}<small>words</small><small>${dots(R.lives)}</small>`}
function rainStart(){st='run';sky.innerHTML='';R.last=performance.now();loopId=requestAnimationFrame(rainLoop)}
function rainSpawn(){
  const w=R.score>12&&rand()<Math.min(.4,R.score*.012)?rnd(LONG):rnd(MID);
  if(R.items.some(i=>i.w===w))return;
  const el=document.createElement('div');el.className='drop';el.textContent=w;sky.appendChild(el);
  const it={w,el,x:rand()*Math.max(0,sky.clientWidth-el.offsetWidth),y:-24,v:R.v+R.score*.7+rand()*8};
  el.style.transform=`translate(${it.x}px,${it.y}px)`;R.items.push(it);
}
function rainPaint(){
  buf.textContent=R.buf;
  for(const it of R.items)it.el.innerHTML=R.buf&&it.w.startsWith(R.buf)?`<b>${R.buf}</b>${it.w.slice(R.buf.length)}`:it.w;
}
function rainLoop(t){
  loopId=requestAnimationFrame(rainLoop);
  const dt=Math.min(.05,(t-R.last)/1000);R.last=t;
  if(!mp&&!document.hasFocus())return;
  R.time+=dt;R.spawn-=dt;
  if(R.spawn<=0){rainSpawn();R.spawn=Math.max(.6,1.9-R.score*.025)*R.gap}
  const H=sky.clientHeight;
  for(const it of [...R.items]){
    it.y+=it.v*dt;it.el.style.transform=`translate(${it.x}px,${it.y}px)`;
    if(it.y>H-28){
      it.el.remove();R.items.splice(R.items.indexOf(it),1);R.lives--;logWord(it.w,false);
      sky.classList.add('hit');setTimeout(()=>sky.classList.remove('hit'),250);
      if(R.buf&&!R.items.some(i=>i.w.startsWith(R.buf))){R.buf='';rainPaint()}
      rainHud();
      if(R.lives<=0){
        const wpm=Math.round(R.chars/5/(R.time/60)||0),acc=pct(R.good,R.keys);
        return finish({label:'words caught',score:R.score,wpm,acc,time:R.time,
          stats:[['wpm',wpm],['accuracy',acc+'%'],['time',R.time.toFixed(0)+'s']],
          note:`the last one to land was <em>${it.w}</em>.`});
      }
    }
  }
}
function rainChar(ch){
  if(st==='idle')return rainStart();
  if(ch===' '){R.buf='';return rainPaint()}
  R.keys++;
  const next=R.buf+ch,hits=R.items.filter(i=>i.w.startsWith(next));
  if(!hits.length){logKey('',false);R.buf='';buf.classList.add('miss');setTimeout(()=>buf.classList.remove('miss'),200);return rainPaint()}
  R.good++;R.buf=next;logKey(ch,true);
  const done=hits.filter(i=>i.w===next).sort((a,b)=>b.y-a.y)[0];
  if(done){done.el.remove();R.items.splice(R.items.indexOf(done),1);R.score++;R.chars+=next.length+1;R.buf='';logWord(next,true);rainHud()}
  rainPaint();
}
function rainBack(whole){R.buf=whole?'':R.buf.slice(0,-1);rainPaint()}

/* ---------- bomb ---------- */
let B;
function bombInit(){
  B={score:0,keys:0,good:0,chars:0,time:0,last:0};
  fuse.style.display='';
  hint('the fuse lights when you start typing');
  bombNext();hud.innerHTML=`0<small>defused</small>`;
}
function bombNext(){
  let w;do{w=rand()<Math.min(.5,B.score*.03)?rnd(LONG):rnd(CHUNKY)}while(w===B.w);
  B.w=w;B.i=0;B.total=B.left=Math.max(1,3.2*Math.pow(.965,B.score))*(.55+w.length*.09);
  bombPaint();
}
function setFuse(f){fuse.firstElementChild.style.transform=`scaleX(${Math.max(0,f)})`;fuse.classList.toggle('low',f<.3)}
function bombPaint(){
  big.innerHTML=[...B.w].map((c,j)=>`<i class="${j<B.i?'ok':''}">${c}</i>`).join('');
  setFuse(B.left/B.total);
}
function bombLoop(t){
  loopId=requestAnimationFrame(bombLoop);
  const dt=Math.min(.05,(t-B.last)/1000);B.last=t;
  if(!document.hasFocus())return;
  B.time+=dt;B.left-=dt;setFuse(B.left/B.total);
  if(B.left<=0){
    const wpm=Math.round(B.chars/5/(B.time/60)||0),acc=pct(B.good,B.keys);
    logWord(B.w,false);
    finish({label:'words defused',score:B.score,wpm,acc,time:B.time,
      stats:[['wpm',wpm],['accuracy',acc+'%'],['last fuse',B.total.toFixed(1)+'s']],
      note:`<em>${B.w}</em> blew up.`});
  }
}
function bombChar(ch){
  if(st==='idle'){st='run';hint('');B.last=performance.now();loopId=requestAnimationFrame(bombLoop)}
  B.keys++;
  const ok=ch===B.w[B.i];logKey(B.w[B.i],ok);
  if(!ok)return shake();
  B.good++;B.i++;
  if(B.i===B.w.length){B.score++;B.chars+=B.w.length+1;logWord(B.w,true);hud.innerHTML=`${B.score}<small>defused</small>`;bombNext()}
  else bombPaint();
}

/* ---------- memory ---------- */
let M;
function memInit(){
  M={score:0,lives:3,phase:'idle',typed:'',w:'',right:0,total:0,t0:0};
  big.textContent='ready?';hint('press any key to start');memHud();
}
function memHud(){hud.innerHTML=`${M.score}<small>remembered</small><small>${dots(M.lives)}</small>`}
function memNext(){
  let n=Math.min(4+Math.floor(M.score/2),12),pool;
  do{pool=ALL.filter(w=>w.length===n&&w!==M.w);n--}while(!pool.length);
  M.w=rnd(pool);M.typed='';M.phase='show';
  big.className='plain';big.textContent=M.w;hint('memorise it');
  tm=setTimeout(()=>{M.phase='type';hint('now type it');memPaint()},Math.max(350,1100-M.score*45));
}
function memPaint(){
  big.className='';
  big.innerHTML=[...M.w].map((c,j)=>j<M.typed.length?`<i class="ok">${esc(M.typed[j])}</i>`:'<i>_</i>').join('');
}
function memChar(ch){
  if(st==='idle'){st='run';M.t0=performance.now();return memNext()}
  if(M.phase!=='type'||ch===' ')return;
  M.typed+=ch;memPaint();if(typeof blip==='function')blip(true);
  if(M.typed.length<M.w.length)return;
  [...M.w].forEach((c,j)=>{const ok=M.typed[j]===c;M.total++;if(ok)M.right++;logKey(c,ok,true)});
  logWord(M.w,M.typed===M.w);
  if(M.typed===M.w){
    M.score++;M.phase='wait';big.className='good';big.textContent=M.w;memHud();tm=setTimeout(memNext,350);
  }else{
    M.lives--;M.phase='wait';memHud();
    big.innerHTML=[...M.w].map((c,j)=>`<i class="${M.typed[j]===c?'ok':'bad'}">${c}</i>`).join('');
    hint(`you typed ${M.typed}`);
    const w=M.w;
    tm=setTimeout(()=>M.lives>0?memNext():finish({label:'words remembered',score:M.score,acc:pct(M.right,M.total),time:(performance.now()-M.t0)/1000,
      stats:[['letters right',pct(M.right,M.total)+'%'],['last word',w.length+' letters']],note:`<em>${w}</em> got away.`}),1300);
  }
}
function memBack(){if(M.phase==='type'){M.typed=M.typed.slice(0,-1);memPaint()}}

/* ---------- scramble + mirror: a prompt, an answer, 45 seconds ---------- */
let P;
const sorted=w=>[...w].sort().join('');
function promptInit(){
  P={score:0,skips:0,keys:0,good:0,chars:0,time:0,last:0,typed:'',w:'',target:'',dur:45};
  fuse.style.display='';ans.style.display='';ans.textContent='';ans.classList.remove('miss');
  hint(mode==='scramble'?'enter clears your guess. tab reshuffles the letters. space skips':'enter clears your guess. space skips');
  promptNext();setFuse(1);promptHud();
}
function promptHud(){hud.innerHTML=`${P.score}<small>${mode==='scramble'?'unscrambled':'mirrored'}</small><small>${Math.max(0,Math.ceil(P.dur-P.time))}s</small>`}
function promptNext(){
  let w;do{w=rnd(mode==='scramble'?SCR:MID)}while(w===P.w);
  P.w=w;P.typed='';ans.textContent='';ans.classList.remove('miss');
  if(mode==='scramble'){P.target=w;P.shown='';big.textContent=P.shown=scrambled(w,rand)}else{P.target=[...w].reverse().join('');big.textContent=w}
  big.className='plain';
}
function scrambled(w,rng){
  let s,n=0;
  do{const a=[...w];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}s=a.join('')}while((ALLSET.has(s)||s===P.shown)&&++n<60);
  return s;
}
function promptStart(){st='run';P.last=performance.now();loopId=requestAnimationFrame(promptLoop)}
function promptLoop(t){
  loopId=requestAnimationFrame(promptLoop);
  const dt=Math.min(.05,(t-P.last)/1000);P.last=t;
  if(!mp&&!document.hasFocus())return;
  P.time+=dt;setFuse(1-P.time/P.dur);promptHud();
  if(P.time>=P.dur){
    const wpm=Math.round(P.chars/5/(P.dur/60)),acc=pct(P.good,P.keys);
    finish({label:mode==='scramble'?'words unscrambled':'words mirrored',score:P.score,wpm,acc,time:P.dur,
      stats:[['accuracy',acc+'%'],['skipped',P.skips]],note:`the one on screen was <em>${P.w}</em>.`});
  }
}
function promptChar(ch){
  if(st==='idle')promptStart();
  if(ch===' '){P.skips++;logWord(P.w,false);return promptNext()}
  if(P.typed.length>=P.target.length+2)return;
  const ok=ch===P.target[P.typed.length];
  P.keys++;if(ok)P.good++;logKey(P.target[P.typed.length]||ch,ok);
  P.typed+=ch;ans.textContent=P.typed;
  const solved=P.typed===P.target||(mode==='scramble'&&ALLSET.has(P.typed)&&sorted(P.typed)===sorted(P.target));
  if(solved){P.score++;P.chars+=P.target.length+1;logWord(P.w,true);return promptNext()}
  ans.classList.toggle('miss',P.typed.length>=P.target.length);
}
function promptBack(whole){P.typed=whole?'':P.typed.slice(0,-1);ans.textContent=P.typed;ans.classList.remove('miss')}

/* ---------- alphabet ---------- */
let A;
function alphaInit(){
  A={seq:opt()==='z-a'?[...ABC].reverse():[...ABC],i:0,keys:0,t0:0};
  hint('the clock starts on the first letter');hud.innerHTML=`0.00<small>seconds</small>`;alphaPaint();
}
function alphaPaint(){big.className='small';big.innerHTML=A.seq.map((c,j)=>`<i class="${j<A.i?'ok':''}">${c}</i>`).join('')}
function alphaChar(ch){
  if(st==='idle'){st='run';hint('');A.t0=performance.now();tickId=setInterval(()=>hud.innerHTML=`${((performance.now()-A.t0)/1000).toFixed(2)}<small>seconds</small>`,50)}
  A.keys++;
  const ok=ch===A.seq[A.i];logKey(A.seq[A.i],ok);
  if(!ok)return shake();
  A.i++;alphaPaint();
  if(A.i===26){
    const el=(performance.now()-A.t0)/1000;
    finish({label:'seconds',score:+el.toFixed(2),wpm:Math.round(26/5/(el/60)),acc:pct(26,A.keys),time:el,
      stats:[['accuracy',pct(26,A.keys)+'%'],['per letter',Math.round(el*1000/26)+' ms']]});
  }
}

/* ---------- reflex ---------- */
let X;
function rxInit(){
  X={n:0,times:[],miss:0,phase:'idle',ch:'',t:0,t0:0};
  big.textContent='ready?';hint('press any key to start. then hit each letter the instant it shows up');
  hud.innerHTML=`0/10<small>letters</small>`;
}
function rxWait(){
  X.phase='wait';big.className='';big.textContent='···';
  tm=setTimeout(()=>{X.ch=ABC[Math.floor(Math.random()*26)];X.phase='go';X.t=performance.now();big.className='plain';big.textContent=X.ch},600+Math.random()*1600);
}
function rxChar(ch){
  if(st==='idle'){st='run';X.t0=performance.now();hint('');return rxWait()}
  if(X.phase==='wait'){clearTimeout(tm);X.miss++;hint('too soon');return rxWait()}
  if(ch!==X.ch){X.miss++;logKey(X.ch,false);return shake()}
  logKey(X.ch,true,true);if(typeof blip==='function')blip(true);
  X.times.push(performance.now()-X.t);X.n++;hint('');
  hud.innerHTML=`${X.n}/10<small>letters</small><small>${Math.round(X.times[X.times.length-1])} ms</small>`;
  if(X.n<10)return rxWait();
  const mean=Math.round(X.times.reduce((a,b)=>a+b,0)/10);
  finish({label:'ms average',score:mean,acc:pct(10,10+X.miss),time:(performance.now()-X.t0)/1000,
    stats:[['fastest',Math.round(Math.min(...X.times))+' ms'],['slowest',Math.round(Math.max(...X.times))+' ms'],['slips',X.miss]]});
}

/* ---------- input ---------- */
const ENG={rain:[rainChar,rainBack],bomb:[bombChar],memory:[memChar,memBack],scramble:[promptChar,promptBack],mirror:[promptChar,promptBack],alphabet:[alphaChar],reflex:[rxChar]};
const typing=()=>view==='play'||(view==='friends'&&document.body.classList.contains('racing'));
function onChar(ch){
  if(st==='done'||(mp&&st==='idle'))return;
  if(mode!=='sentences')ch=ch.toLowerCase();
  if(isLine())lineChar(ch);else ENG[mode][0](ch);
}
function onBack(whole){
  if(st!=='run')return;
  if(isLine())lineBack(whole);else if(ENG[mode][1])ENG[mode][1](whole);
}
document.addEventListener('keydown',e=>{
  if(view==='daily'){if(dailyKey(e))e.preventDefault();return}
  if(!typing()||(e.target.tagName==='INPUT'&&e.target!==kb))return;
  if(st==='run'&&(mode==='scramble'||mode==='mirror')){
    if(e.key==='Enter'){e.preventDefault();return promptBack(true)}
    if(e.key==='Tab'&&mode==='scramble'){e.preventDefault();big.textContent=P.shown=scrambled(P.w,Math.random);return}
  }
  if(e.key==='Tab'||e.key==='Escape'||(e.key==='Enter'&&st==='done')){
    if(e.key==='Tab')e.preventDefault();
    return mp?0:reset();
  }
  if(e.target.tagName==='BUTTON'&&(e.key===' '||e.key==='Enter'))return;
  if(e.key==='Backspace'){e.preventDefault();return onBack(e.ctrlKey||e.altKey||e.metaKey)}
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.key.length===1){e.preventDefault();if(document.activeElement!==kb)focusKb();onChar(e.key)}
});
kb.addEventListener('input',()=>{            /* touch keyboards that skip keydown */
  const v=kb.value;kb.value=' ';
  if(view==='daily'){if(!v.length)dailyBack();else for(const ch of v.slice(1))dailyChar(ch.toLowerCase());return}
  if(!typing())return;
  if(!v.length)return onBack(false);
  for(const ch of v.slice(1))onChar(ch);
});

/* ---------- routing: #play, #daily, #friends, #ranks, #stats, #custom, #account, #room-CODE ---------- */
function route(){
  const h=location.hash.slice(1);
  const v=h.startsWith('room-')?'friends':['friends','stats','custom','daily','ranks','account'].includes(h)?h:'play';
  if(view==='friends'&&v!=='friends')mpLeave(true);
  view=v;document.body.dataset.view=v;
  document.querySelectorAll('#tabs a').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  if(v==='play')reset();
  else{stop();if(v==='stats')drawStats();else if(v==='custom')drawCustom();else if(v==='daily')drawDaily();else if(v==='ranks')drawRanks();else if(v==='account')drawAccount();else mpRoute(h.startsWith('room-')?h.slice(5).toUpperCase():'')}
}
addEventListener('hashchange',route);
addEventListener('DOMContentLoaded',route);
