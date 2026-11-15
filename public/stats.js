/* typeshit: the stats tab. Everything is drawn as inline SVG from the history kept in localStorage. */
const SPEED=['classic','ghost','death','race'];
const ROWS=['qwertyuiop','asdfghjkl','zxcvbnm'];
const FINGERS=[['pinky','qaz'],['ring','wsx'],['middle','edc'],['index','rfvtgb'],['thumbs',' '],['index','yhnujm'],['middle','ik'],['ring','ol'],['pinky','p']];
let kbMetric='miss', wipeArmed=false;

const day=t=>{const d=new Date(t);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
const dur=s=>s>=3600?Math.floor(s/3600)+'h '+Math.round(s%3600/60)+'m':s>=60?Math.round(s/60)+'m':Math.round(s)+'s';
const hr=h=>(h%12||12)+(h<12?'am':'pm');
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const tip=s=>`data-tip="${esc(s)}"`;
const svg=(w,h,body,label)=>`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
const empty=t=>`<p class="cap">${t}</p>`;

function sampleData(){
  const r=mulberry(11),now=Date.now(),hist=[],keys={},words={};
  const modes=['classic','classic','classic','ghost','rain','death','bomb','memory','race','classic'];
  for(let i=0;i<84;i++){
    const d=new Date(now-(46-Math.floor(i*46/84))*864e5);
    if(r()<.18)continue;
    const h=r()<.7?19+Math.floor(r()*4):Math.floor(8+r()*10);
    d.setHours(h,Math.floor(r()*60));
    const m=modes[Math.floor(r()*modes.length)];
    const w=Math.round(44+i*.33+(r()-.5)*15+(h>=20?5:h<12?-5:0));
    const a=Math.round(Math.min(100,89+r()*10-(w>68?2:0)));
    hist.push({d:+d,m,o:m==='classic'?30:'',s:SPEED.includes(m)?w:Math.round(8+r()*25),w:m==='memory'?0:w,a,t:m==='classic'?30:Math.round(20+r()*50)});
  }
  const freq='etaoinshrdlcumwfgypbvkjxqz';
  [...freq].forEach((c,i)=>{
    const n=Math.round(2400/(i+2)+40),hard='qzxpbvy'.includes(c);
    keys[c]={n,m:Math.round(n*(hard?.07+r()*.08:.01+r()*.04)),t:0,c:n};
    keys[c].t=Math.round(n*(hard?190+r()*70:105+r()*60));
  });
  keys[' ']={n:1900,m:38,t:1900*96,c:1900};
  [['through',14,6],['because',18,5],['government',7,4],['which',22,4],['between',12,3],['people',25,3],['should',19,2],['their',9,2]].forEach(([w,n,m])=>words[w]=[n,m]);
  return {hist,keys,words,mp:{races:9,wins:4},sample:true};
}

/* ---------- charts ---------- */
function trend(sp){
  if(sp.length<2)return empty('finish two speed tests to draw this.');
  const W=960,H=250,l=28,r=52,t=12,b=18,top=Math.ceil(Math.max(...sp.map(e=>e.w))/20)*20;
  const x=i=>l+i*(W-l-r)/(sp.length-1),y=v=>H-b-v/top*(H-t-b);
  let g='';
  for(let v=0;v<=top;v+=top/4)g+=`<line class="grid" x1="${l}" x2="${W-r}" y1="${y(v)}" y2="${y(v)}"/><text x="${l-6}" y="${y(v)+3}" text-anchor="end">${v}</text>`;
  const roll=sp.map((_,i)=>avg(sp.slice(Math.max(0,i-9),i+1).map(e=>e.w)));
  const best=Math.max(...sp.map(e=>e.w));
  g+=`<line class="dash" x1="${l}" x2="${W-r}" y1="${y(best)}" y2="${y(best)}"/><text class="ink" x="${W-r+5}" y="${y(best)+3}">best ${best}</text>`;
  g+=sp.map((e,i)=>`<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(e.w).toFixed(1)}" r="2.5"/><circle class="hit" cx="${x(i).toFixed(1)}" cy="${y(e.w).toFixed(1)}" r="8" ${tip(`${e.w} wpm · ${e.a}%\n${MODES[e.m].label} · ${new Date(e.d).toLocaleDateString()}`)}/>`).join('');
  g+=`<polyline class="ln" points="${roll.map((v,i)=>x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ')}"/>`;
  const lastY=y(roll[roll.length-1]);
  if(Math.abs(lastY-y(best))>12)g+=`<text class="ink" x="${W-r+5}" y="${lastY+3}">avg ${Math.round(roll[roll.length-1])}</text>`;
  g+=`<text x="${l}" y="${H-3}">first test</text><text x="${W-r}" y="${H-3}" text-anchor="end">latest</text>`;
  const gain=Math.round(roll[roll.length-1]-avg(sp.slice(0,Math.min(10,sp.length)).map(e=>e.w)));
  return svg(W,H,g,'Speed of every test in order with a rolling average')+
    `<p class="cap">each dot is one test. the line is your average over the last 10. ${gain>0?`up ${gain} wpm since you started.`:gain<0?`down ${-gain} wpm since you started.`:''}</p>`;
}

function clock(sp){
  if(!sp.length)return empty('play a speed test to draw this.');
  const S=240,c=S/2,r0=30,R=96,by=Array.from({length:24},()=>[]);
  sp.forEach(e=>by[new Date(e.d).getHours()].push(e.w));
  const means=by.map(avg),top=Math.max(...means),maxN=Math.max(...by.map(a=>a.length));
  const pt=(r,a)=>(c+r*Math.cos(a)).toFixed(1)+' '+(c+r*Math.sin(a)).toFixed(1);
  let g=`<circle cx="${c}" cy="${c}" r="${R}" fill="none" class="grid"/><circle cx="${c}" cy="${c}" r="${r0}" fill="none" class="grid"/>`;
  by.forEach((a,h)=>{
    if(!a.length)return;
    const a0=(h/24)*2*Math.PI-Math.PI/2+.02,a1=((h+1)/24)*2*Math.PI-Math.PI/2-.02,r1=r0+means[h]/top*(R-r0);
    g+=`<path class="mark" style="opacity:${(.35+.65*a.length/maxN).toFixed(2)}" d="M${pt(r0,a0)}L${pt(r1,a0)}A${r1} ${r1} 0 0 1 ${pt(r1,a1)}L${pt(r0,a1)}A${r0} ${r0} 0 0 0 ${pt(r0,a0)}Z" ${tip(`${hr(h)} to ${hr((h+1)%24)}\n${Math.round(means[h])} wpm average · ${a.length} test${a.length>1?'s':''}`)}/>`;
  });
  g+=`<text x="${c}" y="${c-R-6}" text-anchor="middle">12am</text><text x="${c+R+6}" y="${c+3}">6am</text><text x="${c}" y="${c+R+14}" text-anchor="middle">12pm</text><text x="${c-R-6}" y="${c+3}" text-anchor="end">6pm</text>`;
  const bestH=means.indexOf(top);
  g+=`<text class="ink" x="${c}" y="${c+4}" text-anchor="middle" style="font-size:12px">${hr(bestH)}</text>`;
  return svg(S+200,S+16,`<g transform="translate(100 8)">${g}</g>`,'Average speed by hour of day')+
    `<p class="cap">a 24 hour clock. longer wedges are faster hours, fainter ones have fewer tests. you peak around ${hr(bestH)} at ${Math.round(top)} wpm.</p>`;
}

function keyboard(keys){
  const ks=Object.keys(keys).filter(k=>keys[k].n>=3);
  if(!ks.length)return empty('type a little to light up the keyboard.');
  const val=k=>{const d=keys[k];if(!d||d.n<3)return null;return kbMetric==='miss'?d.m/d.n:kbMetric==='speed'?(d.c?d.t/d.c:null):d.n};
  const vs=ks.map(val).filter(v=>v!==null),lo=kbMetric==='speed'?Math.min(...vs):0,hi=Math.max(...vs,1e-9);
  const K=40,G=4,off=[0,14,36];let g='';
  const key=(k,x,y,w)=>{
    const d=keys[k],v=val(k),o=v===null?0:.12+.88*((v-lo)/((hi-lo)||1));
    const t=d?`${k===' '?'space':k}\n${d.n.toLocaleString()} presses · ${pct(d.n-d.m,d.n)}% accurate${d.c?` · ${Math.round(d.t/d.c)} ms`:''}`:`${k===' '?'space':k}\nnot typed yet`;
    return `<g ${tip(t)}><rect class="key" x="${x}" y="${y}" width="${w}" height="${K}" rx="6"/><rect class="${kbMetric==='miss'?'miss':'mark'}" style="opacity:${o.toFixed(2)}" x="${x}" y="${y}" width="${w}" height="${K}" rx="6"/>${k===' '?'':`<text class="kl" x="${x+w/2}" y="${y+K/2+4.5}" text-anchor="middle">${k}</text>`}</g>`;
  };
  ROWS.forEach((row,r)=>[...row].forEach((k,i)=>g+=key(k,off[r]+i*(K+G),r*(K+G),K)));
  g+=key(' ',110,3*(K+G),216);
  const rank=ks.filter(k=>k!==' '&&val(k)!==null).sort((a,b)=>val(b)-val(a)).slice(0,3);
  const cap={miss:`the redder the key, the more often you miss it. your shakiest: ${rank.map(k=>`${k} (${pct(keys[k].n-keys[k].m,keys[k].n)}%)`).join(', ')}.`,
    speed:`stronger colour means a slower key. slowest: ${rank.map(k=>`${k} (${Math.round(val(k))} ms)`).join(', ')}.`,
    use:`stronger colour means more presses. most used: ${rank.join(', ')}.`}[kbMetric];
  return svg(436,4*(K+G),g,'Keyboard heatmap')+`<p class="cap">${cap}</p>`;
}

function fingers(keys){
  const f=FINGERS.map(([name,ks])=>{const o={name,n:0,m:0,t:0,c:0};[...ks].forEach(k=>{const d=keys[k];if(d){o.n+=d.n;o.m+=d.m;o.t+=d.t;o.c+=d.c}});return o});
  const total=f.reduce((a,x)=>a+x.n,0);
  if(!total)return empty('type a little to see which fingers do the work.');
  const top=Math.max(...f.map(x=>x.n)),W=436,H=176,cw=32,base=H-22;
  const xs=[14,54,94,134,202,270,310,350,390];
  let g=`<text x="${xs[0]}" y="10">left hand</text><text x="${xs[8]+cw}" y="10" text-anchor="end">right hand</text>`;
  f.forEach((x,i)=>{
    const h=Math.max(cw,x.n/top*(base-30));
    g+=`<g ${tip(`${i<4?'left ':i>4?'right ':''}${x.name}\n${Math.round(100*x.n/total)}% of keys · ${pct(x.n-x.m,x.n)}% accurate${x.c?` · ${Math.round(x.t/x.c)} ms`:''}`)}>
      <path class="mark" d="M${xs[i]} ${base}V${base-h+cw/2}a${cw/2} ${cw/2} 0 0 1 ${cw} 0V${base}Z"/>
      <text class="ink" x="${xs[i]+cw/2}" y="${base-h-5}" text-anchor="middle">${Math.round(100*x.n/total)}%</text>
      <text x="${xs[i]+cw/2}" y="${H-8}" text-anchor="middle">${x.name}</text></g>`;
  });
  const real=f.filter(x=>x.n>20&&x.name!=='thumbs'),worst=real.sort((a,b)=>b.m/b.n-a.m/a.n)[0];
  const wi=f.indexOf(worst);
  return svg(W,H,g,'Share of keystrokes per finger')+
    `<p class="cap">finger height is its share of your keystrokes on a standard touch typing layout.${worst?` least accurate: ${wi<4?'left':'right'} ${worst.name} at ${pct(worst.n-worst.m,worst.n)}%.`:''}</p>`;
}

function calendar(hist){
  const WK=20,C=14,G=3,by={};
  hist.forEach(e=>{const k=day(e.d);(by[k]||(by[k]={n:0,t:0})).n++;by[k].t+=e.t});
  const today=new Date();today.setHours(12,0,0,0);
  const start=new Date(today);start.setDate(start.getDate()-start.getDay()-(WK-1)*7);
  const top=Math.max(1,...Object.values(by).map(d=>d.t));
  let g='',lastM=-1;
  for(let w=0;w<WK;w++)for(let d=0;d<7;d++){
    const dt=new Date(start);dt.setDate(start.getDate()+w*7+d);
    if(dt>today)continue;
    const v=by[day(dt)],x=26+w*(C+G),y=14+d*(C+G);
    if(d===0&&dt.getMonth()!==lastM&&dt.getDate()<=7){lastM=dt.getMonth();g+=`<text x="${x}" y="9">${dt.toLocaleString('en',{month:'short'}).toLowerCase()}</text>`}
    const label=dt.toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'});
    g+=`<g ${tip(v?`${label}\n${v.n} game${v.n>1?'s':''} · ${dur(v.t)}`:`${label}\nno typing`)}><rect class="cell" x="${x}" y="${y}" width="${C}" height="${C}" rx="3"/>${v?`<rect class="mark" style="opacity:${(.25+.75*v.t/top).toFixed(2)}" x="${x}" y="${y}" width="${C}" height="${C}" rx="3"/>`:''}</g>`;
  }
  ['mon','wed','fri'].forEach((n,i)=>g+=`<text x="0" y="${14+(1+i*2)*(C+G)+10}">${n}</text>`);
  const active=Object.keys(by).length;
  return svg(26+WK*(C+G),14+7*(C+G),g,'Typing time per day for the last 20 weeks')+
    `<p class="cap">the last 20 weeks. stronger colour means more time at the keys. ${active} active day${active===1?'':'s'}.</p>`;
}

function histogram(sp){
  if(sp.length<3)return empty('finish three speed tests to draw this.');
  const ws=sp.map(e=>e.w).sort((a,b)=>a-b),lo=Math.floor(ws[0]/10)*10,hi=Math.floor(ws[ws.length-1]/10)*10+10;
  const bins=[];for(let v=lo;v<hi;v+=10)bins.push(ws.filter(w=>w>=v&&w<v+10).length);
  const W=436,H=170,l=6,b=18,t=14,bw=(W-2*l)/bins.length,top=Math.max(...bins),med=ws[Math.floor(ws.length/2)];
  let g=`<line class="grid" x1="${l}" x2="${W-l}" y1="${H-b}" y2="${H-b}"/>`;
  bins.forEach((n,i)=>{
    const h=n/top*(H-b-t-12),x=l+i*bw+1;
    if(n)g+=`<path class="mark" d="M${x} ${H-b}v${-Math.max(0,h-4)}q0 -4 4 -4h${bw-10}q4 0 4 4v${Math.max(0,h-4)}Z" ${tip(`${lo+i*10} to ${lo+i*10+9} wpm\n${n} test${n>1?'s':''}`)}/>`;
    g+=`<text x="${l+i*bw}" y="${H-5}" text-anchor="middle">${lo+i*10}</text>`;
  });
  g+=`<text x="${W-l}" y="${H-5}" text-anchor="middle">${hi}</text>`;
  const mx=l+(med-lo)/10*bw;
  g+=`<line class="dash" x1="${mx}" x2="${mx}" y1="${t}" y2="${H-b}"/><text class="ink" x="${mx}" y="${t-4}" text-anchor="${mx>W-70?'end':mx<70?'start':'middle'}">median ${med}</text>`;
  return svg(W,H,g,'How often you hit each speed')+`<p class="cap">how often you land in each 10 wpm band. a narrow hill means you are consistent.</p>`;
}

function scatter(sp){
  if(sp.length<3)return empty('finish three speed tests to draw this.');
  const W=436,H=190,l=28,r=8,t=8,b=30;
  const a0=Math.min(90,Math.floor(Math.min(...sp.map(e=>e.a))/5)*5),top=Math.ceil(Math.max(...sp.map(e=>e.w))/20)*20;
  const x=a=>l+(a-a0)/(100-a0)*(W-l-r),y=v=>H-b-v/top*(H-t-b);
  let g='';
  for(let v=0;v<=top;v+=top/4)g+=`<line class="grid" x1="${l}" x2="${W-r}" y1="${y(v)}" y2="${y(v)}"/><text x="${l-6}" y="${y(v)+3}" text-anchor="end">${v}</text>`;
  for(let a=a0;a<=100;a+=(100-a0)/4)g+=`<text x="${x(a)}" y="${H-b+12}" text-anchor="middle">${Math.round(a)}%</text>`;
  g+=`<text x="${(l+W-r)/2}" y="${H-3}" text-anchor="middle">accuracy</text>`;
  g+=sp.map(e=>`<circle class="mark" style="opacity:.6" cx="${x(e.a).toFixed(1)}" cy="${y(e.w).toFixed(1)}" r="4" ${tip(`${e.w} wpm at ${e.a}%\n${MODES[e.m].label}`)}/>`).join('');
  const hiA=sp.filter(e=>e.a>=97),loA=sp.filter(e=>e.a<97);
  const note=hiA.length>1&&loA.length>1?`at 97% or better you average ${Math.round(avg(hiA.map(e=>e.w)))} wpm, below it ${Math.round(avg(loA.map(e=>e.w)))}.`:'';
  return svg(W,H,g,'Speed against accuracy for every test')+`<p class="cap">speed (wpm, up) against accuracy (across) for every test. ${note}</p>`;
}

function modeRows(hist,best){
  const ms=Object.keys(MODES).map(k=>{const h=hist.filter(e=>e.m===k);return {k,n:h.length,t:h.reduce((a,e)=>a+e.t,0),top:Math.max(0,...h.map(e=>e.s))}}).filter(m=>m.n);
  if(!ms.length)return empty('nothing played yet.');
  const top=Math.max(...ms.map(m=>m.t));
  return `<div class="rows">${ms.sort((a,b)=>b.t-a.t).map(m=>`<div class="rowi"><span>${MODES[m.k].label}</span><i><b style="width:${Math.max(2,100*m.t/top)}%"></b></i><small>${dur(m.t)} · ${m.n} game${m.n>1?'s':''} · best ${m.top} ${MODES[m.k].unit}</small></div>`).join('')}</div>`;
}

function wordRows(words){
  const ws=Object.entries(words).filter(([,v])=>v[1]>0).sort((a,b)=>b[1][1]-a[1][1]||a[1][0]-b[1][0]).slice(0,8);
  if(!ws.length)return empty('no fumbled words yet. suspicious.');
  return `<div class="rows">${ws.map(([w,[n,m]])=>`<div class="rowi nem"><span>${esc(w)}</span><i><b style="width:${Math.max(2,100*m/n)}%"></b></i><small>fumbled ${m} of ${n}</small></div>`).join('')}</div>`;
}

/* ---------- page ---------- */
function statsHTML(D){
  const {hist,keys,words,mp}=D,sp=hist.filter(e=>SPEED.includes(e.m)&&e.w>0);
  const secs=hist.reduce((a,e)=>a+e.t,0),kn=Object.values(keys).reduce((a,k)=>a+k.n,0),km=Object.values(keys).reduce((a,k)=>a+k.m,0);
  const days=new Set(hist.map(e=>day(e.d)));let streak=0;const d=new Date();
  if(!days.has(day(d)))d.setDate(d.getDate()-1);
  while(days.has(day(d))){streak++;d.setDate(d.getDate()-1)}
  const tiles=[['best wpm',sp.length?Math.max(...sp.map(e=>e.w)):0,1],['average, last 10',Math.round(avg(sp.slice(-10).map(e=>e.w)))],['accuracy',pct(kn-km,kn)+'%'],
    ['games',hist.length],['time typing',dur(secs)],['keys pressed',kn.toLocaleString()],['day streak',streak],['race wins',`${mp.wins}/${mp.races}`]];
  const card=(title,body,cls='',extra='')=>`<section class="card ${cls}"><h3><span>${title}</span>${extra}</h3>${body}</section>`;
  const toggle=`<div class="bar">${[['miss','misses'],['speed','speed'],['use','usage']].map(([k,l])=>`<button data-kb="${k}" class="${k===kbMetric?'on':''}">${l}</button>`).join('')}</div>`;
  return `<h2>stats</h2>`+
    (D.sample?`<p class="sample"><b>sample data.</b> this is what the page looks like after a few weeks. play a game and your own numbers replace it.</p>`:`<p class="sample">saved in this browser only.</p>`)+
    `<div class="tiles">${tiles.map(([k,v,big])=>`<div class="stat ${big?'':'s'}"><small>${k}</small><b>${v}</b></div>`).join('')}</div>`+
    `<div class="cards">`+
    card('speed over time',trend(sp),'wide')+
    card('keyboard heatmap',keyboard(keys),'',toggle)+
    card('finger workload',fingers(keys))+
    card('when you type fastest',clock(sp))+
    card('activity',calendar(hist))+
    card('speed distribution',histogram(sp))+
    card('speed vs accuracy',scatter(sp))+
    card('time per mode',modeRows(hist))+
    card('nemesis words',wordRows(words))+
    `</div>`+(D.sample?'':`<button id="wipe" class="soft">${wipeArmed?'click again to erase everything':'erase my stats'}</button>`);
}

function drawStats(){
  const el=$('#stats');
  el.innerHTML=statsHTML(store.hist.length?{hist:store.hist,keys:store.keys,words:store.words,mp:store.mp}:sampleData());
  el.onclick=e=>{
    const k=e.target.dataset.kb;
    if(k){kbMetric=k;return drawStats()}
    if(e.target.id==='wipe'){
      if(!wipeArmed){wipeArmed=true;return drawStats()}
      wipeArmed=false;const keep={mode:store.mode,opt:store.opt,name:store.name};
      store=Object.assign(BLANK(),keep);save();drawStats();
    }
  };
  const tipEl=$('#tip');
  el.onmousemove=el.ontouchstart=e=>{
    const t=e.target.closest&&e.target.closest('[data-tip]'),p=e.touches?e.touches[0]:e;
    if(!t){tipEl.style.display='none';return}
    tipEl.textContent=t.dataset.tip;tipEl.style.display='block';
    const w=tipEl.offsetWidth;
    tipEl.style.left=Math.max(8,Math.min(innerWidth-w-8,p.clientX+14))+'px';
    tipEl.style.top=(p.clientY+16)+'px';
  };
  el.onmouseleave=()=>tipEl.style.display='none';
}
