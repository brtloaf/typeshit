/* typesh!t: accounts and leaderboards. Talks to the Board durable object behind /api/ in src/worker.js. */
let apiDown=false;
async function api(path,body){
  try{
    const h={'content-type':'application/json'};
    if(store.auth&&store.auth.token)h.authorization='Bearer '+store.auth.token;
    const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:h,body:body?JSON.stringify(body):undefined});
    const j=await r.json();apiDown=false;
    if(r.status===401&&path!=='login'){store.auth=null;save();drawWho()}
    return r.ok?j:{error:j.error||'something went wrong',status:r.status};
  }catch(e){apiDown=true;return {error:'offline',offline:true}}
}
const GA="sleepy,speedy,grumpy,sneaky,fuzzy,salty,jumpy,cosmic,rusty,mellow,spicy,wobbly".split(","),GB="otter,badger,gecko,walrus,pigeon,moose,ferret,panda,llama,wombat,heron,possum".split(",");
let userWait=null;
function ensureUser(){
  if(store.auth&&store.auth.token)return Promise.resolve();
  return userWait||(userWait=(async()=>{
    const r=await api('guest',{});
    if(!r.error)store.auth={token:r.token,name:r.name,guest:true};
    else if(!store.auth)store.auth={name:`${GA[Math.floor(Math.random()*12)]}-${GB[Math.floor(Math.random()*12)]}-${Math.floor(10+Math.random()*90)}`,guest:true,local:true};
    save();drawWho();userWait=null;
  })());
}
function drawWho(){const a=store.auth;$('#who').textContent=a?a.name:'guest';$('#who').classList.toggle('dim',!a||a.guest)}

/* boards a finished game posts to. the key is the same mode:option key the best scores use */
const GAMEBOARDS=[['classic:15','classic 15s'],['classic:30','classic 30s'],['classic:60','classic 60s'],['sentences:short','sentences'],['sentences:long','long sentences'],
  ['rain:rain','rain'],['rain:storm','storm'],['death:','sudden death'],['chase:','outrun'],['bomb:','bomb'],['memory:','memory'],['scramble:','scramble'],['mirror:','mirror'],['alphabet:a-z','alphabet']];
const BOARDKEYS=new Set(GAMEBOARDS.map(b=>b[0]).concat(['rain:drizzle','alphabet:z-a']));
async function submitScore(board,value){
  if(!BOARDKEYS.has(board)||!(value>0))return;
  await ensureUser();
  if(store.auth&&store.auth.token)api('score',{board,value});
}

/* ---------- leaderboard tab ---------- */
let lb={board:'daily:guess',range:'day',day:0},lbSeq=0;
const DBOARDS=[['daily:guess','typeguess'],['daily:dle','typdle'],['daily:texto','typetexto'],['daily:illion','typillion']];
const lbUnit=b=>b.startsWith('daily')?'':MODES[b.split(':')[0]].unit;
/* how a daily row reads, per game */
function lbDaily(b,p){
  if(b==='daily:guess')return [`${p.v} words`,`${p.x} letter longest`];
  if(b==='daily:dle')return [p.v?`${p.v}/7`:'missed',mmss(p.secs)];
  if(b==='daily:texto')return [p.v?`${p.v} guesses`:'gave up',mmss(p.secs)];
  return [`${p.v} points`,''];
}
function sampleRows(){
  const names=['turbo-walrus-41','keysmash','grandma','sleepy-otter-17','qwertyqueen','mittens','homerow_hero','fuzzy-gecko-88'],r=mulberry(lb.board.length*7+lb.range.length),b=lb.board;
  const low=b.startsWith('alphabet'),top=b.startsWith('classic')||b.startsWith('sentences')?112:44;
  return names.map((name,i)=>{
    const p={rank:i+1,name,guest:name.includes('-')};
    if(b==='daily:guess'){p.v=48-i*5;p.x=9-Math.floor(i/2)}
    else if(b==='daily:dle'){p.v=i<7?2+Math.floor(i/2):0;p.secs=41+i*37}
    else if(b==='daily:texto'){p.v=i<7?9+i*11:0;p.secs=95+i*64}
    else if(b==='daily:illion'){p.v=610-i*50}
    else if(b==='daily-total'){p.v=1840-i*190;p.x=28-i*2}
    else p.v=low?+(3.1+i*.9+r()).toFixed(2):Math.max(1,Math.round(top*(1-i*.09)-r()*3));
    return p;
  });
}
async function drawRanks(){
  const el=$('#ranks'),today=dayNum();if(!lb.day||lb.day>today)lb.day=today;
  const isDaily=lb.board.startsWith('daily:'),isTotal=lb.board==='daily-total';
  if(isTotal&&lb.range==='day')lb.range='week';
  const pill=(k,v,l)=>`<button data-${k}="${v}" class="${String(lb[k])===String(v)?'on':''}">${l}</button>`;
  const range=isDaily?`<div class="bar"><button data-nav="-1">&lsaquo;</button><span class="pad">${lb.day===today?'today':dayLabel(lb.day)}</span><button data-nav="1" ${lb.day>=today?'disabled':''}>&rsaquo;</button></div>`
    :`<div class="bar">${isTotal?'':pill('range','day','today')}${pill('range','week','last 7 days')}${pill('range','all','all time')}</div>`;
  el.innerHTML=`<h2>leaderboard</h2>
    <div class="lbctl"><div class="bar">${DBOARDS.map(([k,l])=>pill('board',k,l)).join('')}${pill('board','daily-total','daily totals')}</div>
    <div class="bar">${GAMEBOARDS.map(([k,l])=>pill('board',k,l)).join('')}</div>${range}</div>
    <div id="lbbody"><p class="cap">loading…</p></div>`;
  const seq=++lbSeq;
  await ensureUser();
  const r=await api(`board?board=${encodeURIComponent(lb.board)}&range=${lb.range}&day=${lb.day}`);
  if(seq!==lbSeq||view!=='ranks')return;
  let rows=r.rows||[],mine=r.mine,note='';
  if(r.error){
    rows=sampleRows();mine=null;
    note=`<p class="sample"><b>sample players.</b> ${r.offline?'the real leaderboard appears once the site is deployed with its cloudflare worker.':esc(r.error)}</p>`;
  }
  const unit=lbUnit(lb.board),heads=isDaily?{'daily:guess':['words','longest word'],'daily:dle':['guesses','time'],'daily:texto':['guesses','time'],'daily:illion':['points','']}[lb.board]:isTotal?['points','games played']:['score',''];
  const cells=p=>isDaily?lbDaily(lb.board,p):isTotal?[`${p.v} points`,p.x]:[`${p.v} <span class="dim">${unit}</span>`,''];
  const row=p=>{const c=cells(p);return `<tr class="${p.me?'me':''}"><td>${p.rank}</td><td>${esc(p.name)}${p.guest?' <span class="dim">guest</span>':''}${p.me?' <span class="dim">(you)</span>':''}</td><td>${c[0]}</td>${heads[1]?`<td>${c[1]}</td>`:''}</tr>`};
  $('#lbbody').innerHTML=note+(isTotal?'<p class="cap">every daily game is worth up to 100 points a day. this adds them up.</p>':'')+(rows.length?`<table class="lb"><thead><tr><th>#</th><th>player</th><th>${heads[0]}</th>${heads[1]?`<th>${heads[1]}</th>`:''}</tr></thead><tbody>${rows.map(row).join('')}${mine?`<tr class="gap"><td colspan="4">…</td></tr>`+row(mine):''}</tbody></table>`
    :`<p class="cap">nobody is on this board yet. ${isDaily?'play today to be first.':'finish a game in this mode to be first.'}</p>`);
}
$('#ranks').addEventListener('click',e=>{
  const d=e.target.dataset;
  if(d.board){lb.board=d.board}else if(d.range){lb.range=d.range}else if(d.nav){lb.day+=+d.nav}else return;
  drawRanks();
});

/* ---------- account tab ---------- */
async function drawAccount(msg){
  const el=$('#account');
  await ensureUser();
  const a=store.auth||{};
  if(a.token&&!a.guest){
    el.innerHTML=`<h2>account</h2><p>signed in as <b class="ink">${esc(a.name)}</b>. your scores post to the leaderboards under this name.</p>
      <div class="frow"><button class="soft" id="aout">sign out</button></div>`;
    $('#aout').onclick=async()=>{await api('logout',{});store.auth=null;save();drawWho();drawAccount()};
    return;
  }
  el.innerHTML=`<h2>account</h2>
    <p>you are playing as guest <b class="ink">${esc(a.name||'')}</b>. ${a.local?'this preview has no server, so accounts are switched off here. they work once the site is deployed.':'make an account to pick your own name and keep it on any device. everything you have scored as a guest comes with you.'}</p>
    <form id="aform" class="aform">
      <label for="aname">name</label><input type="text" id="aname" maxlength="14" autocomplete="username" placeholder="3 to 14 characters">
      <label for="apass">password</label><input type="password" id="apass" maxlength="200" autocomplete="current-password" placeholder="8 or more characters">
      <span></span><div class="frow"><button class="solid" type="submit" data-a="signup">create account</button><button class="soft" type="submit" data-a="login">sign in instead</button></div>
    </form>
    <p id="aerr" class="bad">${esc(msg||'')}</p>
    <p class="cap">there is no email on file, so a forgotten password cannot be recovered.</p>`;
  $('#aform').onsubmit=async e=>{
    e.preventDefault();
    const act=(e.submitter&&e.submitter.dataset.a)||'signup',name=$('#aname').value.trim(),pass=$('#apass').value;
    if(a.local)return $('#aerr').textContent='accounts need the deployed site.';
    $('#aerr').textContent='';
    const r=await api(act,{name,pass});
    if(r.error)return $('#aerr').textContent=r.offline?'could not reach the server.':r.error;
    store.auth={token:r.token,name:r.name,guest:false};save();drawWho();drawAccount();
  };
}
drawWho();
