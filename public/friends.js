/* typeshit: live races with friends. Talks to the Room durable object in src/worker.js over a websocket. */
let ws=null, room=null, code='', myId='', sig='', mpErr='';
const ord=n=>n+(['th','st','nd','rd'][n%100>10&&n%100<14?0:n%10]||'th');
const newCode=()=>Array.from({length:4},()=>rnd([...'ABCDEFGHJKLMNPQRSTUVWXYZ'])).join('');
const mpSend=o=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))};
const mpProg=(p,wpm)=>mpSend({t:'prog',p,wpm});
const mpDone=(s,el)=>mpSend({t:'done',wpm:s.wpm,acc:s.acc,time:el});
const me=()=>room?.players.find(p=>p.id===myId);

function seedWords(seed,n){
  const r=mulberry(seed),out=[];
  while(out.length<n){const w=COMMON[Math.floor(r()*COMMON.length)];if(w!==out[out.length-1])out.push(w)}
  return out;
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
    <div><h2>play with friends</h2><p>everyone in a room races the same words at the same time. up to 8 people.</p></div>
    <div class="frow"><label for="fname">your name</label><input type="text" id="fname" maxlength="14" placeholder="anon" value="${esc(store.name||'')}"></div>
    <div class="frow">${wanted?'':'<button class="solid" id="fcreate">create a room</button><span>or join one</span>'}
      <input type="text" id="fcode" maxlength="4" placeholder="CODE" value="${esc(wanted||'')}" aria-label="Room code">
      <button class="${wanted?'solid':'soft'}" id="fjoin">join${wanted?' room '+esc(wanted):''}</button></div>
    <div id="ferr">${esc(mpErr)}</div>`;
  mpErr='';
  const go=c=>{c=(c||'').toUpperCase().replace(/[^A-Z]/g,'');if(c.length!==4){$('#ferr').textContent='room codes are 4 letters.';return}mpConnect(c)};
  if($('#fcreate'))$('#fcreate').onclick=()=>mpConnect(newCode());
  $('#fjoin').onclick=()=>go($('#fcode').value);
  $('#fcode').onkeydown=$('#fname').onkeydown=e=>{if(e.key==='Enter')go($('#fcode').value||(wanted?'':newCode()))};
}

function mpConnect(c){
  store.name=($('#fname')?.value||'').trim().slice(0,14)||'anon';save();
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
    mpErr=e.reason||(was?'you were disconnected from the room.':'could not reach the room server. friends mode only works once the site is deployed as the cloudflare worker (see the readme).');
    if(view==='friends'){if(location.hash!=='#friends')location.hash='friends';else drawJoin()}
  };
}

function mpLeave(quiet){
  const s=ws;ws=null;room=null;if(s)s.close();
  mpEndLocal();
  if(!quiet)location.hash='friends';
}
function mpEndLocal(){
  if(mode==='race'){stop();st='idle';mode=MODES[store.mode]&&!MODES[store.mode].hidden?store.mode:'classic'}
  document.body.classList.remove('racing');
}

function mpMsg(m){
  if(m.t==='you')myId=m.id;
  else if(m.t==='go')mpCountdown(m);
  else if(m.t==='state'){
    const prev=room;room=m;
    if(m.phase==='results'&&prev&&prev.phase!=='results'){
      const p=me();
      if(p&&!p.sit){store.mp.races++;if(p.place===1&&m.players.filter(x=>!x.sit).length>1)store.mp.wins++;save()}
    }
    if(m.phase==='lobby'||m.phase==='results')mpEndLocal();
    if(view==='friends')drawRoom();
  }
}

function mpCountdown(m){
  mode='race';raceWords=seedWords(m.seed,m.n);
  document.body.classList.add('racing');
  stop();st='idle';show('line');lineInit();focusKb();syncFocus();
  const t0=performance.now()+m.in;
  cdId=setInterval(()=>{
    const left=t0-performance.now();
    if(left<=0){clearInterval(cdId);lineStart()}
    else hud.innerHTML=`${Math.ceil(left/1000)}<small>get ready</small>`;
  },50);
}

function laneText(p){
  if(p.sit)return 'joins the next race';
  if(p.done)return `${ord(p.place)} · ${p.wpm} wpm · ${p.acc}%`;
  if(room.phase==='race'||room.phase==='countdown')return `${p.wpm} wpm`;
  if(room.phase==='results')return 'did not finish';
  return p.id===room.host?'host':'ready';
}

function drawRoom(force){
  const el=$('#friends'),host=room.host===myId,idle=room.phase==='lobby'||room.phase==='results';
  let ps=room.players.slice();
  if(room.phase==='results')ps.sort((a,b)=>(a.place||99)-(b.place||99)||b.p-a.p);
  const s=[room.phase,room.host,room.n,myId,ps.map(p=>p.id+p.name).join()].join('|');
  if(force||s!==sig){
    sig=s;
    const hostName=room.players.find(p=>p.id===room.host)?.name||'the host';
    let ctl='';
    if(idle&&host)ctl=`<span>words</span><div class="bar">${[15,30,60].map(n=>`<button data-n="${n}" class="${n===room.n?'on':''}">${n}</button>`).join('')}</div>
      <button class="solid" id="fstart">${room.phase==='results'?'race again':'start the race'}</button>`;
    else if(idle)ctl=`<span>waiting for ${esc(hostName)} to start a ${room.n} word race.</span>`;
    else if(me()?.sit)ctl=`<span>a race is running. you are in the next one.</span>`;
    el.innerHTML=`
      <div class="roomhead"><div><small>room</small><b class="code">${esc(code)}</b></div><span class="sp"></span>
        <button class="soft" id="fcopy">copy invite link</button><button id="fleave">leave</button></div>
      <div id="racers">${ps.map(p=>`<div class="lane${p.id===myId?' me':''}${p.place===1?' win':''}" data-id="${p.id}"><span>${esc(p.name)}</span><i><b></b></i><span></span></div>`).join('')}</div>
      <div class="frow" id="fctl">${ctl}</div>`;
    $('#fleave').onclick=()=>mpLeave();
    $('#fcopy').onclick=e=>{
      const link=location.origin+location.pathname+'#room-'+code,b=e.currentTarget;
      const done=t=>{b.textContent=t;setTimeout(()=>b.textContent='copy invite link',1800)};
      try{navigator.clipboard.writeText(link).then(()=>done('copied'),()=>done(link))}catch(err){done(link)}
    };
    if($('#fstart'))$('#fstart').onclick=()=>mpSend({t:'start'});
    $('#fctl').onclick=e=>{const n=e.target.dataset.n;if(n)mpSend({t:'cfg',n:+n})};
  }
  for(const p of room.players){
    const row=el.querySelector(`.lane[data-id="${p.id}"]`);if(!row)continue;
    row.querySelector('b').style.transform=`scaleX(${p.p})`;
    row.lastElementChild.textContent=laneText(p);
  }
  if(room.phase==='race'&&room.endsIn>0&&!$('#fctl').textContent.includes('you are in'))
    $('#fctl').innerHTML=`<span>race closes ${Math.ceil(room.endsIn/1000)}s after the first finisher.</span>`;
}
