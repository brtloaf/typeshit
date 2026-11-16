/* typesh!t: live matches with friends. Talks to the Room durable object in src/worker.js over a websocket.
   botRoom() is a stand-in for that server that runs in the page, for practising against bots. */
const KINDS={
  race:{label:'race',mode:'race',unit:'wpm',opts:[15,30,60],def:30,suffix:' words',desc:'same words for everyone. first to finish wins'},
  time:{label:'time attack',mode:'classic',unit:'wpm',opts:[15,30,60],def:30,suffix:'s',desc:'highest wpm when the clock stops'},
  death:{label:'last one standing',mode:'death',unit:'words',desc:'one wrong key and you are out. furthest wins'},
  chase:{label:'outrun',mode:'chase',unit:'words',desc:'the hunter speeds up for everyone. last to get caught wins'},
  scramble:{label:'scramble',mode:'scramble',unit:'solved',desc:'same scrambled words, 45 seconds, most solved wins'},
  rain:{label:'rainstorm',mode:'rain',unit:'caught',desc:'the same storm falls on everyone. most words caught wins'}
};
let ws=null, room=null, code='', myId='', sig='', mpErr='', mpTick=0;
const ord=n=>n+(['th','st','nd','rd'][n%100>10&&n%100<14?0:n%10]||'th');
const newCode=()=>Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random()*24)]).join('');
const mpSend=o=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))};
const mpDone=o=>mpSend({t:'done',score:o.score,wpm:o.wpm||0,acc:o.acc??100});
const me=()=>room?.players.find(p=>p.id===myId);
const isBots=()=>code==='BOTS';

/* what this player's lane should show right now */
function mpSnap(){
  if(isLine()){
    const el=(performance.now()-L.start)/1000,s=lineStats(el);
    if(mode==='race')return {p:myChars()/L.total,score:s.wpm};
    if(mode==='classic')return {p:Math.min(1,el/opt()),score:s.wpm};
    return {p:0,score:L.wi};
  }
  return {p:0,score:mode==='rain'?R.score:P.score};
}

/* called by the router whenever the friends tab is shown */
function mpRoute(wanted){
  if(ws&&(!wanted||wanted===code)){if(room)drawRoom(true);return}
  if(ws&&wanted&&wanted!==code)mpLeave(true);
  drawJoin(wanted);
}

function drawJoin(wanted){
  sig='';
  $('#friends').innerHTML=`
    <div><h2>play with friends</h2><p>make a room, send the link, and the host picks the game: ${Object.values(KINDS).map(k=>k.label).join(', ')}. up to 8 people.</p></div>
    <div class="frow"><label for="fname">your name</label><input type="text" id="fname" maxlength="14" placeholder="anon" value="${esc(store.name||'')}"></div>
    <div class="frow">${wanted?'':'<button class="solid" id="fcreate">create a room</button><span>or join one</span>'}
      <input type="text" id="fcode" maxlength="4" placeholder="CODE" value="${esc(wanted||'')}" aria-label="Room code">
      <button class="${wanted?'solid':'soft'}" id="fjoin">join${wanted?' room '+esc(wanted):''}</button></div>
    <div class="frow"><button class="soft" id="fbots">practise against bots</button><span>no friends online? three bots are always up for it.</span></div>
    <div id="ferr">${esc(mpErr)}</div>`;
  mpErr='';
  const go=c=>{c=(c||'').toUpperCase().replace(/[^A-Z]/g,'');if(c.length!==4){$('#ferr').textContent='room codes are 4 letters.';return}mpConnect(c)};
  if($('#fcreate'))$('#fcreate').onclick=()=>mpConnect(newCode());
  $('#fjoin').onclick=()=>go($('#fcode').value);
  $('#fbots').onclick=()=>{saveName();botRoom()};
  $('#fcode').onkeydown=$('#fname').onkeydown=e=>{if(e.key==='Enter')go($('#fcode').value||(wanted?'':newCode()))};
}
function saveName(){store.name=($('#fname')?.value||'').trim().slice(0,14)||'anon';save()}

function mpConnect(c){
  saveName();
  code=c;room=null;$('#ferr').textContent='connecting…';
  let sock;
  try{sock=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/${c}`)}
  catch(e){mpErr='could not open a connection from this page.';return drawJoin()}
  ws=sock;
  const ping=setInterval(()=>mpSend({t:'ping'}),25000);
  sock.onopen=()=>{sock.send(JSON.stringify({t:'join',name:store.name}));if(location.hash!=='#room-'+c)location.hash='room-'+c};
  sock.onmessage=e=>{if(ws===sock)mpMsg(JSON.parse(e.data))};
  sock.onclose=e=>{
    clearInterval(ping);if(ws!==sock)return;
    const was=!!room;ws=null;room=null;mpEndLocal();
    mpErr=e.reason||(was?'you were disconnected from the room.':'could not reach the room server. rooms only work once the site is deployed as the cloudflare worker (see the readme). bots work anywhere.');
    if(view==='friends'){if(location.hash!=='#friends')location.hash='friends';else drawJoin()}
  };
}

function mpLeave(quiet){
  const s=ws;ws=null;room=null;if(s)s.close();
  mpEndLocal();
  if(!quiet){if(location.hash!=='#friends')location.hash='friends';else drawJoin()}
}
function mpEndLocal(){
  clearInterval(mpTick);
  if(mp){stop();st='idle';mp=null;mode=homeMode()}
  document.body.classList.remove('racing');
}

function mpMsg(m){
  if(m.t==='you')myId=m.id;
  else if(m.t==='go')mpCountdown(m);
  else if(m.t==='state'){
    const prev=room;room=m;
    if(m.phase==='results'&&prev&&prev.phase!=='results'&&!isBots()){
      const p=me();
      if(p&&!p.sit){store.mp.races++;if(p.place===1&&m.players.filter(x=>!x.sit).length>1)store.mp.wins++;save()}
    }
    if(m.phase==='lobby'||m.phase==='results')mpEndLocal();
    if(view==='friends')drawRoom();
  }
}

function mpCountdown(m){
  const k=KINDS[m.kind]||KINDS.race;
  mp={kind:m.kind,opt:m.kind==='rain'?'rain':m.opt,rng:mulberry(m.seed)};mode=k.mode;
  document.body.classList.add('racing');
  setup();
  const t0=performance.now()+m.in;
  cdId=setInterval(()=>{
    const left=t0-performance.now();
    if(left<=0){clearInterval(cdId);startNow()}
    else hud.innerHTML=`${Math.ceil(left/1000)}<small>${k.label}. get ready</small>`;
  },50);
  clearInterval(mpTick);
  mpTick=setInterval(()=>{if(mp&&st==='run')mpSend({t:'prog',...mpSnap()})},300);
}

function laneText(p){
  const k=KINDS[room.kind],busy=room.phase==='race'||room.phase==='countdown';
  if(p.sit)return 'joins the next game';
  if(p.place)return `${ord(p.place)} · ${p.score} ${k.unit}`+(k.unit==='wpm'&&p.done?` · ${p.acc}%`:'');
  if(busy)return `${p.score} ${k.unit}`+(p.done?' · out':'');
  if(room.phase==='results')return 'did not finish';
  return p.id===room.host?'host':'ready';
}

function drawRoom(force){
  const el=$('#friends'),host=room.host===myId,idle=room.phase==='lobby'||room.phase==='results',k=KINDS[room.kind];
  let ps=room.players.slice();
  if(room.phase==='results')ps.sort((a,b)=>(a.place||99)-(b.place||99));
  const s=[room.phase,room.host,room.kind,room.opt,myId,ps.map(p=>p.id+p.name).join()].join('|');
  if(force||s!==sig){
    sig=s;
    const hostName=room.players.find(p=>p.id===room.host)?.name||'the host';
    let ctl='';
    if(idle&&host)ctl=`<div class="bar">${Object.keys(KINDS).map(id=>`<button data-kind="${id}" class="${id===room.kind?'on':''}">${KINDS[id].label}</button>`).join('')}</div>
      ${k.opts?`<div class="bar">${k.opts.map(n=>`<button data-opt="${n}" class="${n===room.opt?'on':''}">${n}${k.suffix}</button>`).join('')}</div>`:''}
      <button class="solid" id="fstart">${room.phase==='results'?'play again':'start'}</button>`;
    else if(idle)ctl=`<span>waiting for ${esc(hostName)} to start. next up: ${k.label}${k.opts?', '+room.opt+k.suffix:''}.</span>`;
    else if(me()?.sit)ctl=`<span>a game is running. you are in the next one.</span>`;
    else if(host)ctl=`<button id="fend">end this round for everyone</button>`;
    el.innerHTML=`
      <div class="roomhead"><div><small>${isBots()?'practice room':'room'}</small><b class="code">${esc(code)}</b></div><span class="sp"></span>
        ${isBots()?'':'<button class="soft" id="fcopy">copy invite link</button>'}<button id="fleave">leave</button></div>
      <div id="racers">${ps.map(p=>`<div class="lane${p.id===myId?' me':''}${p.place===1?' win':''}" data-id="${p.id}"><span>${esc(p.name)}</span><i><b></b></i><span></span></div>`).join('')}</div>
      <div class="frow" id="fctl">${ctl}</div>
      ${idle?`<div class="kinddesc">${k.desc}.</div>`:''}`;
    $('#fleave').onclick=()=>mpLeave();
    if($('#fcopy'))$('#fcopy').onclick=e=>{
      const link=location.origin+location.pathname+'#room-'+code,b=e.currentTarget;
      const done=t=>{b.textContent=t;setTimeout(()=>b.textContent='copy invite link',1800)};
      try{navigator.clipboard.writeText(link).then(()=>done('copied'),()=>done(link))}catch(err){done(link)}
    };
    if($('#fstart'))$('#fstart').onclick=()=>mpSend({t:'start'});
    if($('#fend'))$('#fend').onclick=()=>mpSend({t:'end'});
    $('#fctl').onclick=e=>{
      const d=e.target.dataset;
      if(d.kind)mpSend({t:'cfg',kind:d.kind,opt:KINDS[d.kind].def??null});
      else if(d.opt)mpSend({t:'cfg',kind:room.kind,opt:+d.opt});
    };
  }
  const top=Math.max(1,...room.players.map(p=>p.score));
  for(const p of room.players){
    const row=el.querySelector(`.lane[data-id="${p.id}"]`);if(!row)continue;
    row.querySelector('b').style.transform=`scaleX(${room.kind==='race'?p.p:room.phase==='lobby'?0:p.score/top})`;
    row.lastElementChild.textContent=laneText(p);
  }
  if(room.phase==='race'&&room.endsIn>0&&!host&&!me()?.sit)
    $('#fctl').innerHTML=`<span>round closes ${Math.ceil(room.endsIn/1000)}s after the first finisher.</span>`;
}

/* ---------- practice room: the same protocol as the worker, with three bots, all in the page ---------- */
function rankPlayers(list,kind){
  if(kind==='race'){list.filter(p=>!p.done).forEach(p=>p.place=0);return}
  list.slice().sort((a,b)=>b.score-a.score||(a.doneAt||9e15)-(b.doneAt||9e15)).forEach((p,i)=>p.place=i+1);
}
function botRoom(){
  const blank={p:0,score:0,wpm:0,acc:0,done:false,place:0,sit:false,doneAt:0};
  const you={id:'p1',name:store.name||'you',...blank};
  const bots=[['mittens',46],['turbo',71],['grandma',97]].map(([name,sk],i)=>({id:'b'+i,name,sk,...blank}));
  const all=[you,...bots],S={phase:'lobby',kind:'race',opt:30,fin:0,t0:0,iv:0,to:0};
  const out=m=>setTimeout(()=>{if(ws===sock)mpMsg(m)},0);
  const state=()=>out({t:'state',phase:S.phase,host:'p1',kind:S.kind,opt:S.opt,endsIn:0,players:all.map(({sk,die,doneAt,...p})=>({...p}))});
  const finish=()=>{if(S.phase!=='race'&&S.phase!=='countdown')return;clearInterval(S.iv);clearTimeout(S.to);S.phase='results';rankPlayers(all,S.kind);state()};
  const done=p=>{p.done=true;p.doneAt=Date.now();if(S.kind==='race'){p.p=1;p.place=++S.fin;if(S.fin===1){clearTimeout(S.to);S.to=setTimeout(finish,30000)}}};
  function tick(){
    const t=(Date.now()-S.t0)/1000,j=()=>Math.round((Math.random()-.5)*6);
    for(const b of bots){
      if(b.done)continue;
      if(you.done)b.die=Math.min(b.die,t+2);
      if(S.kind==='race'){b.p=Math.min(1,t*b.sk*5/60/(S.opt*5.6));b.score=b.wpm=b.sk+j();b.acc=94+b.id.charCodeAt(1)%5;if(b.p>=1)done(b)}
      else if(S.kind==='time'){b.score=b.wpm=b.sk+j();b.acc=95;if(t>=S.opt)done(b)}
      else if(S.kind==='scramble'){b.score=Math.floor(t/(9-b.sk/16));if(t>=45)done(b)}
      else{b.score=Math.floor(t*b.sk/60*(S.kind==='rain'?.55:1));if(t>=b.die)done(b)}
    }
    if(all.every(p=>p.done))finish();else state();
  }
  function handle(m){
    const idle=S.phase==='lobby'||S.phase==='results';
    if(m.t==='cfg'&&idle&&KINDS[m.kind]){S.kind=m.kind;S.opt=m.opt;state()}
    else if(m.t==='start'&&idle){
      all.forEach(p=>Object.assign(p,blank));S.fin=0;S.phase='countdown';
      bots.forEach(b=>b.die=S.kind==='chase'?Math.max(4,(b.sk-25)/2.2+2+Math.random()*4):S.kind==='rain'?25+b.sk/2+Math.random()*20:6+Math.random()*b.sk/2);
      out({t:'go',seed:(Math.random()*0xffffffff)>>>0,kind:S.kind,opt:S.opt,in:3500});state();
      S.to=setTimeout(()=>{S.phase='race';S.t0=Date.now();state();S.iv=setInterval(tick,300)},3500);
    }
    else if(m.t==='prog'&&S.phase==='race'&&!you.done){you.p=m.p;you.score=m.score;if(S.kind==='race'||S.kind==='time')you.wpm=m.score}
    else if(m.t==='done'&&S.phase==='race'&&!you.done){you.score=m.score;you.wpm=m.wpm;you.acc=m.acc;done(you)}
    else if(m.t==='end')finish();
  }
  const sock={readyState:1,send:s=>handle(JSON.parse(s)),close(){clearInterval(S.iv);clearTimeout(S.to)}};
  ws=sock;code='BOTS';myId='p1';room=null;state();
}
