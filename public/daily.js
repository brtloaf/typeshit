/* typesh!t: the daily tab. Four games, same puzzles for everyone, new ones at midnight.
   typeguess (12 letters, 3 minutes), typdle (6 letters, 7 guesses), typetexto (find the word by meaning), typillion (rare answers score more). */
/* shared:start  (this block is identical in public/daily.js and src/worker.js; change both together) */
const DAY_MS = 864e5, DAY_SHIFT = 6 * 36e5, GUESS_SECONDS = 180;   // days roll over at midnight UTC-6
const dayNum = (t = Date.now()) => Math.floor((t - DAY_SHIFT) / DAY_MS);
function seeded(a) { a >>>= 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dailyLetters(day) {
  const r = seeded(day * 2654435761), V = "aaaaeeeeeeiiiooouu", C = "bbccddddffgghhjkllllmmmnnnnppqrrrrrssssttttttvvwwxyyz";
  const out = [], take = (bag, n) => { while (n) { const c = bag[Math.floor(r() * bag.length)]; if (out.filter((x) => x === c).length < 2) { out.push(c); n--; } } };
  take(V, 5); take(C, 7);
  return out.join("");
}
function canMake(word, letters) {
  const pool = [...letters];
  for (const c of word) { const i = pool.indexOf(c); if (i < 0) return false; pool.splice(i, 1); }
  return true;
}
const dleAnswer = (data, day) => data.typdle[(day * 7919) % data.typdle.length];
const textoSecret = (data, day) => data.texto.secrets[(day * 31 + 7) % data.texto.secrets.length];
function illionPrompts(data, day) {
  const r = seeded(day * 40503 + 11), idx = data.trivia.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, 7).map((i) => data.trivia[i]);
}
const ILLION_POINTS = [10, 30, 60, 100];
const normAns = (s) => String(s).toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// an answer counts if it matches an accepted answer exactly, as a plural, or within a small typo
function scoreAnswer(prompt, text) {
  const t = normAns(text);
  let best = null;
  if (t) prompt.tiers.forEach((list, tier) => list.forEach((entry) => entry.split("|").forEach((alias) => {
    const a = normAns(alias);
    const d = a === t || a + "s" === t || a === t + "s" || a + "es" === t || a === t + "es" ? 0 : (a.length >= 5 && t.length >= 5 ? lev(a, t) : 9);
    if ((d === 0 || d === 1 || (d === 2 && a.length >= 9)) && (!best || d < best.d)) best = { d, tier, pts: ILLION_POINTS[tier], match: entry.split("|")[0] };
  })));
  return best ? { pts: best.pts, tier: best.tier, match: best.match } : { pts: 0, tier: -1, match: "" };
}
/* shared:end */

const dayLabel=n=>new Date(n*DAY_MS).toLocaleDateString('en',{timeZone:'UTC',month:'short',day:'numeric'}).toLowerCase();
const mmss=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
function untilNext(){const ms=(dayNum()+1)*DAY_MS+DAY_SHIFT-Date.now(),h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4);return h?`${h}h ${m}m`:`${m}m`}

const DGAMES={guess:'typeguess',dle:'typdle',texto:'typetexto',illion:'typillion'};
let DICT=null, DATA=null, dLoad='', dTick=0, dgame=DGAMES[store.dgame]?store.dgame:'guess', D={state:'idle'};
function loadDaily(){
  if(dLoad)return;dLoad='loading';
  const get=src=>new Promise(done=>{const s=document.createElement('script');s.src=src;s.onload=s.onerror=done;document.head.appendChild(s)});
  Promise.all([get('words.js'),get('daily-data.js')]).then(()=>{
    if(self.WORDLIST&&self.DAILYDATA){DICT=new Set(self.WORDLIST.split(' '));DATA=self.DAILYDATA;dLoad='ok'}else dLoad='failed';
    if(view==='daily')drawDaily();
  });
}
/* today's saved progress: {guess:{}, dle:{}, texto:{}, illion:{}} */
function dayRec(){
  const day=dayNum(),r=store.daily[day]||(store.daily[day]={});
  if(r.words&&!r.guess){store.daily[day]={guess:{t0:r.t0,words:r.words,done:r.done,v:r.score}};return store.daily[day]}
  return r;
}
const statRow=tiles=>`<div class="tiles">${tiles.map(([k,v,b])=>`<div class="stat ${b?'':'s'}"><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
const rankTile=g=>g.rank?[['rank today',`${g.rank}/${g.players}`]]:[];
const sentNote=g=>g.sent?'':`<p class="cap">${apiDown?'saved on this device. it posts to the leaderboard once the site is deployed and online.':'posting your score…'}</p>`;
const foot=()=>`<div class="frow"><a class="btn soft" href="#ranks">see the leaderboard</a><span>new puzzles in ${untilNext()}</span></div>`;

function drawDaily(){
  clearInterval(dTick);
  const el=$('#daily'),day=dayNum(),rec=dayRec();
  for(const k of Object.keys(store.daily))if(+k<day-40)delete store.daily[k];
  loadDaily();
  el.innerHTML=`<h2>daily <span class="dim">${dayLabel(day)}</span></h2>
    <nav class="bar" id="dnav">${Object.keys(DGAMES).map(k=>`<button data-g="${k}" class="${k===dgame?'on':''}">${DGAMES[k]}${rec[k]&&rec[k].done?' ✓':''}</button>`).join('')}</nav>
    <div id="dbody"></div>`;
  $('#dnav').onclick=e=>{const g=e.target.dataset.g;if(g){dgame=g;store.dgame=g;D={state:'idle'};save();drawDaily()}};
  const body=$('#dbody');
  if(dLoad!=='ok'){body.innerHTML=`<p>${dLoad==='failed'?'could not load the word lists. reload the page to try again.':'loading the word lists…'}</p>`;D={state:'idle'};return}
  ({guess:drawGuess,dle:drawDle,texto:drawTexto,illion:drawIllion})[dgame](body,rec,day);
}
function dailyFinish(game,g){
  g.done=true;save();
  store.hist.push({d:Date.now(),m:'daily',o:game,s:g.v||0,w:0,a:100,t:g.secs||(game==='guess'?GUESS_SECONDS:0)});save();
  dailySend(game);
}
const sending=new Set(),lastTry={};
async function dailySend(game){
  const day=dayNum(),g=dayRec()[game];
  if(!g||!g.done||g.sent||sending.has(game)||Date.now()-(lastTry[game]||0)<60000)return;
  sending.add(game);lastTry[game]=Date.now();
  await ensureUser();
  if(store.auth&&store.auth.token){
    const body={game,day,secs:g.secs};
    if(game==='guess')body.words=g.words;else if(game==='illion')body.answers=g.a.map(x=>x.t);else body.guesses=game==='dle'?g.g:g.g.map(x=>x.w);
    const r=await api('daily',body);
    if(!r.error){g.sent=true;g.rank=r.rank;g.players=r.players}else if(!r.offline)g.sent=true;
  }
  sending.delete(game);save();
  if(g.sent&&view==='daily'&&dgame===game)drawDaily();   /* only redraw when there is a rank to show */
}

/* ---------- typeguess ---------- */
function drawGuess(el,rec,day){
  const letters=dailyLetters(day),g=rec.guess;
  if(g&&!g.done&&Date.now()>=g.t0+GUESS_SECONDS*1000){g.v=g.words.length;dailyFinish('guess',g)}
  if(g&&g.done){
    D={state:'done'};
    const all=[...DICT].filter(w=>w.length>=3&&canMake(w,letters)),missed=all.filter(w=>!g.words.includes(w)).sort((a,b)=>b.length-a.length).slice(0,10);
    const longest=g.words.slice().sort((a,b)=>b.length-a.length)[0]||'none';
    el.innerHTML=`<div class="tiles12">${[...letters].map(c=>`<span class="tile">${c}</span>`).join('')}</div>`+
      statRow([['words',g.words.length,1],['longest',longest],['possible',all.length],...rankTile(g)])+
      `<div class="chips">${g.words.slice().sort().map(w=>`<span>${w}</span>`).join('')||'<span class="dim">no words this time</span>'}</div>
      ${missed.length?`<p class="cap">some you missed: ${missed.join(', ')}.</p>`:''}`+foot()+sentNote(g);
    return dailySend('guess');
  }
  if(!g){
    D={state:'ready',start(){rec.guess={t0:Date.now(),words:[],done:false};save();ensureUser();drawDaily()}};
    el.innerHTML=`<p>everyone gets the same 12 letters. you have 3 minutes to make as many words as you can, 3 letters or longer. each tile can be used once per word. one attempt a day.</p>
      <div class="tiles12">${'?'.repeat(12).split('').map(c=>`<span class="tile hid">${c}</span>`).join('')}</div>
      <div class="frow"><button class="solid" id="dgo">start the clock <kbd>enter</kbd></button></div>`;
    $('#dgo').onclick=D.start;return;
  }
  if(D.state!=='guess')D={state:'guess',typed:'',tiles:[...letters].sort(()=>Math.random()-.5),msg:''};
  el.innerHTML=`<div id="dhud" class="hudline"></div><div class="tiles12" id="dtiles"></div><div id="dtyped" class="inbuf"></div><div id="dmsg" class="cap"></div>
    <div class="frow"><button class="soft" data-d="enter">enter</button><button class="soft" data-d="back">delete</button><button class="soft" data-d="shuffle">shuffle <kbd>tab</kbd></button></div>
    <div id="dfound" class="chips"></div>`;
  const paint=()=>{
    const used=[...D.typed];
    $('#dtiles').innerHTML=D.tiles.map(c=>{const i=used.indexOf(c),on=i>=0;if(on)used.splice(i,1);return `<span class="tile${on?' used':''}" data-c="${c}">${c}</span>`}).join('');
    $('#dtyped').textContent=D.typed;$('#dmsg').textContent=D.msg;
    $('#dfound').innerHTML=g.words.slice().reverse().map(w=>`<span>${w}</span>`).join('');
  };
  const hud=()=>{const left=Math.max(0,g.t0/1000+GUESS_SECONDS-Date.now()/1000);$('#dhud').innerHTML=`${g.words.length}<small>words</small><small class="${left<20?'bad':''}">${mmss(left)}</small>`;return left};
  D.char=c=>{if(!/^[a-z]$/.test(c))return;if(!canMake(D.typed+c,D.tiles.join(''))){blip(false);D.msg=`no ${c} left`}else{D.typed+=c;D.msg='';blip(true)}paint()};
  D.back=all=>{D.typed=all?'':D.typed.slice(0,-1);D.msg='';paint()};
  D.shuffle=()=>{D.tiles.sort(()=>Math.random()-.5);paint()};
  D.enter=()=>{
    const w=D.typed;if(!w)return;
    if(w.length<3)D.msg='3 letters or more';else if(g.words.includes(w))D.msg=`already got ${w}`;else if(!DICT.has(w))D.msg=`${w} is not in the dictionary`;
    else{g.words.push(w);save();D.msg=w.length>=7?`${w}. big one`:''}
    blip(!D.msg||D.msg.includes('big'));D.typed='';paint();hud();
  };
  $('#dtiles').onclick=e=>{const c=e.target.dataset.c;if(c)D.char(c)};
  el.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{({enter:D.enter,back:D.back,shuffle:D.shuffle})[b.dataset.d]();focusKb()});
  paint();hud();focusKb();
  dTick=setInterval(()=>{if(view!=='daily'||dgame!=='guess')return clearInterval(dTick);if(hud()<=0){clearInterval(dTick);drawDaily()}},200);
}

/* ---------- typdle: six letters, seven guesses, timed from your first key ---------- */
function dleMarks(guess,answer){
  const m=Array(6).fill('a'),left=[...answer];
  for(let i=0;i<6;i++)if(guess[i]===answer[i]){m[i]='c';left[i]=null}
  for(let i=0;i<6;i++)if(m[i]!=='c'){const j=left.indexOf(guess[i]);if(j>=0){m[i]='p';left[j]=null}}
  return m;
}
function drawDle(el,rec,day){
  const answer=dleAnswer(DATA,day),g=rec.dle||(rec.dle={g:[],cur:'',done:false});
  const keyState={};
  g.g.forEach(w=>dleMarks(w,answer).forEach((m,i)=>{const c=w[i];if(m==='c'||(m==='p'&&keyState[c]!=='c')||!keyState[c])keyState[c]=m}));
  const rows=Array.from({length:7},(_,r)=>{
    const w=g.g[r]||(r===g.g.length&&!g.done?g.cur:''),marks=g.g[r]?dleMarks(g.g[r],answer):[];
    return `<div class="drow">${Array.from({length:6},(_,i)=>`<span class="dcell ${marks[i]||''}${w[i]&&!marks[i]?' fill':''}">${w[i]||''}</span>`).join('')}</div>`;
  }).join('');
  const kbRows=['qwertyuiop','asdfghjkl','↵zxcvbnm⌫'].map(r=>`<div>${[...r].map(c=>`<button class="dkey ${keyState[c]||''}" data-k="${c}">${c}</button>`).join('')}</div>`).join('');
  const won=g.done&&g.g[g.g.length-1]===answer;
  el.innerHTML=`<p>guess the 6 letter word in 7 tries. <span class="dcell c mini">a</span> right spot, <span class="dcell p mini">a</span> wrong spot, <span class="dcell a mini">a</span> not in the word. the clock starts on your first key and counts on the leaderboard.</p>
    <div id="dhud" class="hudline"></div><div class="dgrid">${rows}</div><div id="dmsg" class="cap">${D.msg||''}</div>`+
    (g.done?statRow([[won?'solved in':'the word was',won?`${g.g.length}/7`:answer,1],['time',mmss(g.secs)],...(won?[]:[['guesses','7/7']]),...rankTile(g)])+foot()+sentNote(g):`<div class="dkeys">${kbRows}</div>`);
  D={state:g.done?'done':'dle',msg:''};
  const hud=()=>{const s=g.done?g.secs:g.t0?(Date.now()-g.t0)/1000:0;$('#dhud').innerHTML=`${g.g.length}/7<small>guesses</small><small>${mmss(s)}</small>`};
  hud();
  if(g.done)return dailySend('dle');
  D.char=c=>{if(!/^[a-z]$/.test(c)||g.cur.length>=6)return;if(!g.t0){g.t0=Date.now();ensureUser()}g.cur+=c;blip(true);save();drawDaily()};
  D.back=all=>{g.cur=all?'':g.cur.slice(0,-1);save();drawDaily()};
  D.enter=()=>{
    const w=g.cur;
    if(w.length<6){D.msg='6 letters';blip(false)}
    else if(!DICT.has(w)&&!DATA.typdle.includes(w)){D.msg=`${w} is not in the dictionary`;blip(false)}
    else if(g.g.includes(w)){D.msg='already tried that';blip(false)}
    else{
      g.g.push(w);g.cur='';
      if(w===answer||g.g.length===7){g.secs=Math.max(1,Math.round((Date.now()-g.t0)/1000));g.v=w===answer?g.g.length:0;dailyFinish('dle',g)}
    }
    const msg=D.msg;save();drawDaily();D.msg='';if(msg)$('#dmsg').textContent=msg;
  };
  el.querySelector('.dkeys').onclick=e=>{const k=e.target.dataset.k;if(!k)return;k==='↵'?D.enter():k==='⌫'?D.back():D.char(k);focusKb()};
  focusKb();
  dTick=setInterval(()=>{if(view!=='daily'||dgame!=='dle')return clearInterval(dTick);hud()},500);
}

/* ---------- typetexto: every guess gets a number for how close its meaning is. 1 is the word ---------- */
let textoCache=null;
function textoRanks(day){
  if(textoCache&&textoCache.day===day)return textoCache;
  const s=textoSecret(DATA,day),cats=DATA.texto.cats,r=seeded(day*977+3),order=[s.w],seen=new Set(order);
  const add=ws=>ws.forEach(w=>{if(!seen.has(w)){seen.add(w);order.push(w)}});
  const mix=ws=>{const a=ws.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  add(s.close);
  add(mix(s.near.flatMap(c=>cats[c])));
  add(mix(s.far.flatMap(c=>cats[c])));
  add(mix(Object.values(cats).flat()));
  const map=new Map(order.map((w,i)=>[w,i+1]));
  return textoCache={day,secret:s.w,order,map};
}
function textoRank(T,w){
  if(T.map.has(w))return T.map.get(w);
  let h=2166136261;for(const c of w+T.secret)h=Math.imul(h^c.charCodeAt(0),16777619);
  return T.order.length+1+((h>>>0)%42000);
}
function drawTexto(el,rec,day){
  const T=textoRanks(day),g=rec.texto||(rec.texto={g:[],done:false,hints:0});
  const best=g.g.length?Math.min(...g.g.map(x=>x.r)):0,last=g.g[g.g.length-1];
  const band=r=>r===1?'hit':r<=60?'hot':r<=700?'warm':'cold';
  const row=x=>`<div class="trow ${band(x.r)}${x===last?' last':''}"><i style="width:${Math.max(2,100*(1-Math.log(x.r)/Math.log(45000)))}%"></i><span>${esc(x.w)}${x.h?' <small>hint</small>':''}</span><b>${x.r}</b></div>`;
  const found=g.done&&!g.gaveUp;
  el.innerHTML=`<p>find the secret word. every guess gets a number for how close its meaning is: 1 is the word itself, bigger is further away. unlimited guesses. fewer guesses rank higher, then time.</p>
    <div id="dhud" class="hudline"></div>`+
    (g.done?statRow([[found?'found in':'the word was',found?`${g.g.length} guesses`:T.secret,1],['time',mmss(g.secs||0)],['hints',g.hints],...rankTile(g)])+foot()+sentNote(g)
      :`<form id="tform" class="frow"><input type="text" id="tin" maxlength="24" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="type a word" aria-label="Your guess">
        <button class="solid" type="submit">guess</button><button class="soft" type="button" id="thint">hint</button><button type="button" id="tgive">give up</button></form><div id="dmsg" class="cap"></div>`)+
    (last&&!g.done&&g.g.length>1?`<div class="tlist">${row(last)}</div>`:'')+
    `<div class="tlist">${g.g.slice().sort((a,b)=>a.r-b.r).map(row).join('')}</div>`;
  D={state:g.done?'done':'texto'};
  const hud=()=>{const s=g.done?g.secs||0:g.t0?(Date.now()-g.t0)/1000:0;$('#dhud').innerHTML=`${g.g.length}<small>guesses</small><small>${best?'best '+best:''}</small><small>${mmss(s)}</small>`};
  hud();
  if(g.done)return dailySend('texto');
  const push=(w,h)=>{
    if(!g.t0){g.t0=Date.now();ensureUser()}
    const r=textoRank(T,w);g.g.push(h?{w,r,h:1}:{w,r});blip(r<=700);
    if(r===1){g.secs=Math.max(1,Math.round((Date.now()-g.t0)/1000));g.v=g.g.length;dailyFinish('texto',g)}
    save();drawDaily();
  };
  $('#tform').onsubmit=e=>{
    e.preventDefault();
    let w=$('#tin').value.toLowerCase().replace(/[^a-z]/g,'');if(!w)return;
    if(!T.map.has(w)){const base=[w.replace(/ies$/,'y'),w.replace(/es$/,''),w.replace(/s$/,'')].find(b=>b!==w&&T.map.has(b));if(base)w=base}
    if(g.g.some(x=>x.w===w)){$('#dmsg').textContent=`you already tried ${w} (${g.g.find(x=>x.w===w).r})`;$('#tin').value='';return}
    if(!T.map.has(w)&&!DICT.has(w)){$('#dmsg').textContent=`${w} is not a word i know`;blip(false);return}
    push(w);
  };
  $('#thint').onclick=()=>{
    const target=Math.max(2,Math.floor((best||600)/2));
    for(let r=target;r>=2;r--){const w=T.order[r-1];if(!g.g.some(x=>x.w===w)){g.hints++;return push(w,true)}}
    $('#dmsg').textContent='no closer hint left. you are right next to it.';
  };
  let sure=false;
  $('#tgive').onclick=e=>{
    if(!sure){sure=true;e.target.textContent='click again to give up';return}
    if(!g.t0)g.t0=Date.now();
    g.gaveUp=true;g.secs=Math.max(1,Math.round((Date.now()-g.t0)/1000));g.v=0;dailyFinish('texto',g);drawDaily();
  };
  $('#tin').focus();
  dTick=setInterval(()=>{if(view!=='daily'||dgame!=='texto')return clearInterval(dTick);hud()},500);
}

/* ---------- typillion: seven prompts, no clock. the rarer your answer, the more it scores ---------- */
const TIERS=['everyone says it','solid','rare','one in a typillion'];
function drawIllion(el,rec,day){
  const ps=illionPrompts(DATA,day),g=rec.illion||(rec.illion={a:[],done:false}),n=g.a.length,total=g.a.reduce((s,x)=>s+x.pts,0);
  const line=(x,i)=>`<div class="irow t${x.tier}"><span>${esc(ps[i].q)}</span><b>${esc(x.match||x.t||'no answer')}</b><em>${x.tier<0?'not on the list':TIERS[x.tier]}</em><i>+${x.pts}</i></div>`;
  D={state:g.done?'done':'illion'};
  if(g.done){
    el.innerHTML=statRow([['points',total,1],['out of',700],['best answer',esc((g.a.slice().sort((a,b)=>b.pts-a.pts)[0]||{}).match||'none')],...rankTile(g)])+
      `<div class="ilist">${g.a.map(line).join('')}</div>
      <p class="cap">answers that would have scored 100: ${ps.map(p=>`${p.q.replace(/^an? /,'')}: ${p.tiers[3].slice(0,3).map(e=>e.split('|')[0]).join(', ')}`).join('. ')}.</p>`+foot()+sentNote(g);
    return dailySend('illion');
  }
  el.innerHTML=`<p>seven prompts, the same for everyone, one answer each and no time limit. the obvious answer scores 10. the rarer your answer, the more it is worth, up to 100. an answer that is not on the list scores 0.</p>
    <div class="hudline">${total}<small>points</small><small>prompt ${n+1} of 7</small></div>
    <div class="iprompt">name <b>${esc(ps[n].q)}</b></div>
    <form id="iform" class="frow"><input type="text" id="iin" maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="your answer" aria-label="Your answer">
      <button class="solid" type="submit">lock it in</button></form>
    <div id="dmsg" class="cap">take your time. you cannot change an answer once it is locked in.</div>
    <div class="ilist">${g.a.map(line).reverse().join('')}</div>`;
  $('#iform').onsubmit=e=>{
    e.preventDefault();
    const t=$('#iin').value.trim();if(!t){$('#dmsg').textContent='type an answer first.';return}
    if(!n)ensureUser();
    const s=scoreAnswer(ps[n],t);g.a.push({t,pts:s.pts,tier:s.tier,match:s.match});blip(s.pts>0);
    if(g.a.length===7){g.v=g.a.reduce((a,x)=>a+x.pts,0);dailyFinish('illion',g)}
    save();drawDaily();
  };
  $('#iin').focus();
}

/* keys while the daily tab is open. returns true when the key was used */
function dailyKey(e){
  if(e.target.tagName==='INPUT'&&e.target!==kb)return false;
  if(D.state==='ready'){if(e.key==='Enter'){D.start();return true}return false}
  if((D.state!=='guess'&&D.state!=='dle')||e.metaKey||(e.ctrlKey&&e.key!=='Backspace'))return false;
  if(e.key==='Enter')D.enter();
  else if(e.key==='Backspace')D.back(e.ctrlKey||e.altKey);
  else if((e.key==='Tab'||e.key===' ')&&D.shuffle)D.shuffle();
  else if(e.key.length===1&&e.key!==' ')D.char(e.key.toLowerCase());
  else return false;
  return true;
}
const dailyChar=c=>{if(D.char)D.char(c)}, dailyBack=()=>{if(D.back)D.back()};
