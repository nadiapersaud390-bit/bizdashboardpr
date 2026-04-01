const API_URL = 'https://script.google.com/macros/s/AKfycbwhu0qkKo2wS0tyrpzCY902v6WqcMscCJzCZg_NTaGpKeZ_619J3pzzRxFzmXPtUnrfng/exec';
const WEEKLY_PASSWORD = 'bizlevelup2025';
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri'];
const DAY_FULL  = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
let agents = [], dayHistory = [];
let currentTab = 'daily', currentDayView = 'today', weeklyUnlocked = false;

// ── CLIENT-SIDE GUYANA DAY DETECTION ──
// Uses America/Guyana timezone — same approach as the Apps Script.
// Overrides whatever todayName the API returns, preventing server-side TZ bugs.
function getGuyanaToday() {
  const dayName = new Date().toLocaleDateString('en-US', { timeZone: 'America/Guyana', weekday: 'long' });
  const valid = ['Monday','Tuesday','Wednesday','Thursday','Friday']; // No Saturday
  return valid.includes(dayName) ? dayName : 'Monday';
}
let lookupHistory = [];
try { lookupHistory = JSON.parse(localStorage.getItem('bizlookup_history') || '[]'); } catch(e) {}

function getTeam(name) { return (!name) ? 'PR' : name.trim().startsWith('GYB') ? 'BB' : 'PR'; }

function toggleIndustry(header) {
    const card=header.closest('.industry-card'),body=card.querySelector('.industry-body'),arrow=header.querySelector('.industry-arrow'),isOpen=body.classList.contains('open');
    document.querySelectorAll('.industry-body.open').forEach(b=>b.classList.remove('open'));
    document.querySelectorAll('.industry-arrow.open').forEach(a=>a.classList.remove('open'));
    if(!isOpen){body.classList.add('open');arrow.classList.add('open');}
}

function toggleRebuttal(header) {
    const card = header.closest('.rebuttal-card');
    const body = card.querySelector('.rebuttal-body');
    const arrow = card.querySelector('.rebuttal-arrow');
    const isOpen = body.classList.contains('open');
    document.querySelectorAll('.rebuttal-body.open').forEach(b => b.classList.remove('open'));
    document.querySelectorAll('.rebuttal-arrow.open').forEach(a => a.classList.remove('open'));
    if (!isOpen) { body.classList.add('open'); arrow.classList.add('open'); }
}

const REBUTTAL_TOTAL = 19;

function showRebuttal(idx) {
    // Hide all panels
    for (let i = 0; i < REBUTTAL_TOTAL; i++) {
        const p = document.getElementById('rb-panel-' + i);
        const b = document.getElementById('rb-btn-' + i);
        if (p) p.style.display = 'none';
        if (b) {
            b.style.background = 'rgba(255,255,255,0.04)';
            b.style.borderColor = 'rgba(255,255,255,0.1)';
            b.style.color = '#64748b';
        }
    }
    // Show selected
    const panel = document.getElementById('rb-panel-' + idx);
    const btn = document.getElementById('rb-btn-' + idx);
    if (panel) { panel.style.display = 'block'; }
    if (btn) {
        btn.style.background = 'rgba(20,184,166,0.2)';
        btn.style.borderColor = '#14b8a6';
        btn.style.color = '#2dd4bf';
        btn.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
    }
}

function filterRebuttalSearch(val) {
    const q = val.trim().toLowerCase();
    const noResults = document.getElementById('rebuttal-no-results');
    const btnRow = document.getElementById('rb-btn-row');
    if (!q) {
        // Show all buttons, restore first panel
        if (btnRow) btnRow.style.display = 'flex';
        if (noResults) noResults.style.display = 'none';
        showRebuttal(0);
        return;
    }
    // Search through all panels
    let found = -1;
    for (let i = 0; i < REBUTTAL_TOTAL; i++) {
        const p = document.getElementById('rb-panel-' + i);
        const b = document.getElementById('rb-btn-' + i);
        if (p && p.innerText.toLowerCase().includes(q)) {
            if (found === -1) found = i;
        }
    }
    if (found >= 0) {
        if (noResults) noResults.style.display = 'none';
        showRebuttal(found);
    } else {
        if (noResults) noResults.style.display = 'block';
        for (let i = 0; i < REBUTTAL_TOTAL; i++) {
            const p = document.getElementById('rb-panel-' + i);
            if (p) p.style.display = 'none';
        }
    }
}

function toggleRevenueDropdown() {
    const body = document.getElementById('revenue-body');
    const arrow = document.getElementById('revenue-arrow');
    const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';
    if (isOpen) { body.style.maxHeight = '0px'; arrow.style.transform = 'rotate(0deg)'; }
    else { body.style.maxHeight = '800px'; arrow.style.transform = 'rotate(180deg)'; }
}

async function updateDashboard() {
    const btn=document.getElementById('refresh-btn');btn.classList.add('spin-anim');
    try {
        const res=await fetch(API_URL);agents=await res.json();
        agents.forEach(a=>{if(!a.team)a.team=getTeam(a.name);});
        if(agents.length>0) agents[0].todayName=getGuyanaToday();
        if(agents.length>0){if(agents[0].dayHistory)dayHistory=agents[0].dayHistory;dayHistory.forEach(d=>{d.agents.forEach(a=>{if(!a.team)a.team=getTeam(a.name);});});}
        if(agents.length>0&&!agents[0].prTotal&&!agents[0].bbTotal){let pr=0,bb=0;agents.forEach(a=>{if(a.team==='PR')pr+=(a.dailyLeads||0);else bb+=(a.dailyLeads||0);});agents[0].prTotal=pr;agents[0].bbTotal=bb;}
        if(agents.length>0&&agents[0].prankNumbers&&agents[0].prankNumbers.length>0){agents[0].prankNumbers.forEach(n=>{if(n&&!KNOWN_PRANK_NUMBERS.includes(n))KNOWN_PRANK_NUMBERS.push(n);});}
        checkLeadAlerts(agents);
        render();renderDaySubTabs();
        document.getElementById('timestamp').innerText='Live: '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    } catch(e){document.getElementById('timestamp').innerText='System Offline';}
    finally{setTimeout(()=>btn.classList.remove('spin-anim'),1000);}
}


function renderDaySubTabs() {
    const wrapper=document.getElementById('day-sub-tabs-wrapper'),container=document.getElementById('day-sub-tabs-container');
    if(currentTab!=='daily'){wrapper.classList.add('hidden');return;}
    if(!dayHistory.length){wrapper.classList.add('hidden');return;}
    let html='<button onclick="switchDayView(\'today\')" class="day-sub-tab is-today '+(currentDayView==='today'?'active':'')+'">Today</button>';
    dayHistory.forEach(d=>{html+='<button onclick="switchDayView('+d.day+')" class="day-sub-tab is-history '+(currentDayView===d.day?'active':'')+'">'+DAY_SHORT[d.day]+'<span class="history-dot"></span></button>';});
    container.innerHTML=html;wrapper.classList.remove('hidden');
}

function switchDayView(key){currentDayView=key;renderDaySubTabs();render();}

function requestWeekly(){if(weeklyUnlocked){currentTab='weekly';updateTabUI();render();renderDaySubTabs();return;}document.getElementById('pw-modal').classList.remove('hidden');document.getElementById('pw-input').value='';document.getElementById('pw-error').innerText='';document.getElementById('pw-input').classList.remove('error');setTimeout(()=>document.getElementById('pw-input').focus(),100);}
function checkPassword(){if(document.getElementById('pw-input').value===WEEKLY_PASSWORD){weeklyUnlocked=true;document.getElementById('pw-modal').classList.add('hidden');document.getElementById('tab-weekly').innerHTML='Weekly';currentTab='weekly';currentDayView='today';updateTabUI();render();renderDaySubTabs();}else{const inp=document.getElementById('pw-input');inp.classList.add('error');document.getElementById('pw-error').innerText='Incorrect access code. Try again.';inp.value='';setTimeout(()=>inp.classList.remove('error'),500);setTimeout(()=>inp.focus(),100);}}
function cancelPassword(){document.getElementById('pw-modal').classList.add('hidden');}

function switchTab(tab){
    if(tab==='weekly'){requestWeekly();return;}
    currentTab=tab;currentDayView='today';
    updateTabUI();render();renderDaySubTabs();
    if(tab==='lookup')renderLookupHistory();
    if(tab==='trivia')initTriviaTab();
    if(tab==='online')renderOnlineView();
    if(typeof window._logUserActivity === "function"){var _tn={daily:"\ud83d\udcca Daily Leaderboard",lookup:"\ud83d\udd0d Lead Lookup",playbook:"\ud83d\udccb Playbook",rebuttals:"\ud83d\udcac Rebuttals",prank:"\ud83d\udea8 Prank Guide",weekly:"\ud83c\udfc6 Weekly Rankings",trivia:"\ud83c\udfaf Trivia Blitz",online:"\ud83d\udc41 Who's Online"};window._logUserActivity("tab",_tn[tab]||tab,"");}
    // If a month tab, deactivate main tab highlights
    if(tab.startsWith('month-')){
      ['daily','lookup','playbook','rebuttals','prank','weekly','trivia','online'].forEach(t=>{
        const b=document.getElementById('tab-'+t);
        if(b){b.className='flex-1 glass py-3 rounded-xl text-[10px] md:text-sm font-black uppercase tracking-widest transition-all text-slate-500';b.style.background='';b.style.color='';b.style.borderColor='';}
      });
    }
}

function updateTabUI(){
    ['daily','lookup','playbook','rebuttals','prank','weekly','trivia','online'].forEach(t=>{
        const b=document.getElementById('tab-'+t);
        if(!b) return;
        if(t===currentTab){
            b.className='flex-1 glass py-3 rounded-xl text-[10px] md:text-sm font-black uppercase tracking-widest transition-all tab-active';
            b.style.color='';b.style.borderColor='';b.style.background='';
            if(t==='trivia'){b.style.background='linear-gradient(90deg,rgba(255,229,0,0.2),rgba(255,107,0,0.2))';b.style.borderColor='rgba(255,229,0,0.5)';}
            if(t==='online'){b.style.background='linear-gradient(90deg,rgba(139,92,246,0.25),rgba(109,40,217,0.2))';b.style.borderColor='rgba(139,92,246,0.6)';}
        } else {
            b.className='flex-1 glass py-3 rounded-xl text-[10px] md:text-sm font-black uppercase tracking-widest transition-all text-slate-500';
            b.style.background='';
            if(t==='rebuttals'){b.style.color='#14b8a6';b.style.borderColor='rgba(20,184,166,0.3)';}
            else if(t==='prank'){b.style.color='#a855f7';b.style.borderColor='';}
            else if(t==='trivia'){b.style.color='#f59e0b';b.style.borderColor='rgba(245,158,11,0.3)';}
            else if(t==='online'){b.style.color='#8b5cf6';b.style.borderColor='rgba(139,92,246,0.35)';}
            else{b.style.color='';b.style.borderColor='';}
        }
    });
}

function getLevel(l){if(l>=17)return{title:'CONQUEROR',cls:'conqueror-tier',color:'text-red-500'};if(l>=12)return{title:'MASTER',cls:'gold-tier',color:'text-yellow-500'};if(l>=7)return{title:'ELITE',cls:'orange-tier',color:'text-orange-500'};if(l>=4)return{title:'PRO',cls:'blue-tier',color:'text-blue-500'};return{title:'ROOKIE',cls:'slate-tier',color:'text-slate-500'};}

// ── MONTHLY TAB SYSTEM ──────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_COLORS = ['#38bdf8','#4ade80','#f59e0b','#f472b6','#a78bfa','#34d399','#fb923c','#60a5fa','#e879f9','#facc15','#f87171','#2dd4bf'];

function getCurrentMonthKey() {
  const d = new Date();
  const gStr = d.toLocaleString('en-US', { timeZone: 'America/Guyana' });
  const g = new Date(gStr);
  return { year: g.getFullYear(), month: g.getMonth() };
}

// Build the monthly tabs row dynamically (shows all months from Jan up to current)
function buildMonthlyTabs() {
  const container = document.getElementById('monthly-tabs-row');
  if (!container) return;
  const { year, month: curMonth } = getCurrentMonthKey();
  container.innerHTML = '';
  for (let m = 0; m <= curMonth; m++) {
    const key = year + '-' + String(m + 1).padStart(2, '0');
    const btn = document.createElement('button');
    const color = MONTH_COLORS[m];
    btn.id = 'tab-month-' + key;
    btn.dataset.monthKey = key;
    btn.style.cssText = `background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:6px 14px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:${color};cursor:pointer;transition:all 0.2s;opacity:0.5;border-color:rgba(255,255,255,0.1);font-family:'Orbitron',sans-serif;`;
    btn.textContent = MONTH_NAMES[m].substring(0, 3) + ' ' + year;
    btn.onclick = () => switchTab('month-' + key);
    container.appendChild(btn);
  }
}
buildMonthlyTabs();
// Rebuild tabs at start of each new month
setInterval(() => {
  const { month } = getCurrentMonthKey();
  const existing = document.querySelectorAll('#monthly-tabs-row button').length;
  if (existing !== month + 1) buildMonthlyTabs();
}, 60000);

function activateMonthTab(key) {
  document.querySelectorAll('#monthly-tabs-row button').forEach(b => {
    const active = b.dataset.monthKey === key;
    b.style.opacity = active ? '1' : '0.5';
    b.style.borderColor = active ? MONTH_COLORS[parseInt(key.split('-')[1]) - 1] : 'rgba(255,255,255,0.1)';
    b.style.background = active ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)';
  });
}

function render(){
    const lView=document.getElementById('leaderboard-view'),pView=document.getElementById('playbook-view'),luView=document.getElementById('lookup-view'),prView=document.getElementById('prank-view'),rbView=document.getElementById('rebuttals-view'),trView=document.getElementById('trivia-view'),mView=document.getElementById('monthly-view'),onView=document.getElementById('online-view');
    [lView,pView,luView,prView,rbView,trView,mView,onView].forEach(v=>{if(v)v.classList.add('hidden');});
    // Deactivate all month tabs when switching away
    if(!currentTab.startsWith('month-')) { document.querySelectorAll('#monthly-tabs-row button').forEach(b=>{b.style.opacity='0.5';b.style.background='rgba(255,255,255,0.03)';b.style.borderColor='rgba(255,255,255,0.1)';}); }
    if(currentTab==='playbook'){pView.classList.remove('hidden');return;}
    if(currentTab==='lookup'){luView.classList.remove('hidden');return;}
    if(currentTab==='prank'){if(prView)prView.classList.remove('hidden');return;}
    if(currentTab==='rebuttals'){if(rbView)rbView.classList.remove('hidden');return;}
    if(currentTab==='trivia'){if(trView)trView.classList.remove('hidden');return;}
    if(currentTab==='online'){if(onView)onView.classList.remove('hidden');return;}
    if(currentTab.startsWith('month-')){
      if(mView) mView.classList.remove('hidden');
      const key=currentTab.replace('month-','');
      const [yr,mo]=key.split('-');
      const mName=MONTH_NAMES[parseInt(mo)-1]+' '+yr;
      const color=MONTH_COLORS[parseInt(mo)-1];
      document.getElementById('monthly-view-title').textContent=mName;
      document.getElementById('monthly-view-title').style.color=color;
      activateMonthTab(key);
      return;
    }
    lView.classList.remove('hidden');
    const isWeekly=currentTab==='weekly',isHistory=currentTab==='daily'&&currentDayView!=='today',target=isWeekly?800:120,todayName=agents.length>0?(agents[0].todayName||'Today'):'Today',banner=document.getElementById('history-banner');
    if(isHistory){const snap=dayHistory.find(d=>d.day===currentDayView);document.getElementById('history-banner-text').innerText='Viewing '+(snap?snap.dayName:DAY_FULL[currentDayView])+' — Final Results';banner.classList.remove('hidden');}else{banner.classList.add('hidden');}
    document.getElementById('goal-label').innerText=isWeekly?'Weekly Team Goal':isHistory?DAY_FULL[currentDayView]+' Final':todayName+' Daily Goal';
    document.getElementById('target-display').innerText='Target: '+target;
    document.getElementById('day-indicator').innerText=isWeekly?'Weekly Sprint':isHistory?DAY_SHORT[currentDayView]+' — Completed':todayName+' Performance';
    let displayData=[],prTotal=0,bbTotal=0;
    if(isHistory){const snap=dayHistory.find(d=>d.day===currentDayView);if(snap){displayData=[...snap.agents].sort((a,b)=>b.leads-a.leads);prTotal=snap.prTotal||0;bbTotal=snap.bbTotal||0;if(!prTotal&&!bbTotal)displayData.forEach(a=>{if(a.team==='PR')prTotal+=a.leads;else bbTotal+=a.leads;});}}
    else{displayData=agents.map(a=>({name:a.name,leads:isWeekly?(a.weeklyLeads||0):(a.dailyLeads||0),team:a.team||getTeam(a.name)})).sort((a,b)=>b.leads-a.leads);if(isWeekly){displayData.forEach(a=>{if(a.team==='PR')prTotal+=a.leads;else bbTotal+=a.leads;});}else if(agents.length>0){prTotal=agents[0].prTotal||0;bbTotal=agents[0].bbTotal||0;if(!prTotal&&!bbTotal)displayData.forEach(a=>{if(a.team==='PR')prTotal+=a.leads;else bbTotal+=a.leads;});}}
    let totalLeads=0,masters=0,activeReps=0;
    document.getElementById('leaderboard').innerHTML=displayData.map((agent,i)=>{
        const lvl=getLevel(agent.leads);totalLeads+=agent.leads;if(agent.leads>=12)masters++;if(agent.leads>0)activeReps++;
        const badge=agent.team==='PR'?'<span style="font-size:8px;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3);border-radius:4px;padding:1px 5px;color:#a78bfa;font-weight:900;margin-left:6px;">PROV</span>':'<span style="font-size:8px;background:rgba(192,132,252,0.15);border:1px solid rgba(192,132,252,0.3);border-radius:4px;padding:1px 5px;color:#c084fc;font-weight:900;margin-left:6px;">BERB</span>';
        return '<div class="glass p-5 rounded-2xl flex justify-between items-center transition-all hover:bg-white/5 '+lvl.cls+' mb-3 md:mb-0 md:m-2"><div class="flex items-center gap-4"><span class="text-xl font-black italic '+(i<3?'text-white':'text-slate-700')+'">'+String(i+1).padStart(2,'0')+'</span><div><div class="font-black text-sm md:text-lg text-white uppercase flex items-center flex-wrap gap-1">'+agent.name+badge+'</div><div class="text-[9px] font-black uppercase tracking-widest '+lvl.color+'">'+lvl.title+' STATUS</div></div></div><div class="text-right"><div class="text-2xl md:text-3xl font-black text-white leading-none">'+agent.leads+'</div><div class="text-[8px] text-slate-500 uppercase font-black mt-1">Transfers</div></div></div>';
    }).join('');
    document.getElementById('floor-total').innerText=totalLeads;document.getElementById('master-count').innerText=String(masters).padStart(2,'0');document.getElementById('active-reps').innerText=activeReps;document.getElementById('current-leads-sum').innerText=totalLeads+' Leads';document.getElementById('pr-count').innerText=prTotal;document.getElementById('bb-count').innerText=bbTotal;
    const pct=Math.min((totalLeads/target)*100,100);document.getElementById('progress-bar').style.width=pct+'%';document.getElementById('goal-percent').innerText=Math.floor(pct)+'%';
}

const KNOWN_PRANK_NUMBERS=['9163656189','7725380078','5155382287','2524125130','3476615074','8034917478','6169472405','8303121902','7817273254','8125934420','2692084907','7347656604','9046699713','5866301595','4696646148','7274393370','7754127556','5202569909','4434637648','4026507658','7347771643','4023781266','4016627245','7208104461','6023413890','2104136710','3042885760','5749711748','8583345667','5409150496','5137086199','6142070065','4095472837','9718066475','6512474567','6162834112','4782998816','9368706243','6783726123','3472378760','7165784421','2029200305','3232748776','5595798373','5129871649','6195403929','4702182848','3107018620','7023711117','4135360569','8594093815','7274233955','9197959486','3619465172','8083040256','6087991146','5302635014','9188559954','7028901379','2188515079','5135081874','9492930673','7657174789','8149772413','6087126517','3162045097','2392097915','7142879786','3103477579','7208789184','2705855042','3024380616','3238259109','3617745483','4136687667','2148682933','5309211552','2142320070','9563795560','7035985800','5864277879','2317293085','4064597681','7042937588','5165099960','4083791440','3259980598','3194613217','5714360194','5027417606','2708737700','7192987437','5305627400','6172331045','3126361686','7072919309','3186216032','6128035158','7607376012','8703120279','5048008555','9704021036','3058047064','5033347391','4013690190','8638851134','4053206801','7167716522','8138166105','9082103977','5715099393','9727682029','7863334920','7863827748','7867590159','34742231119','8507580946','2707991520','9152764716','5127967077','3024948733','7186073225','8603988237'];
const KNOWN_TRUCKING_NUMBERS=['8037355052','9094384996','4073752418','9175613116','9049451857','6122136729','2282787454','4784519553','7708916065','8327711931','7734915634','9196044629','3345908864','5135182367','8646014987','9168786362','9313388267','8126218311','7123308224','9099129813','7739561628','8048220400','8133319694','3302068622','2038855026','6083061773','3252476208','8645852073','8037471102','8043249527','2765664965','8036248184','8593539222','2158506881','3203333445','6692921025','3465228286','3134925553','8636571633','3194503310','2313711551','2677675579','7869012853','9104177920','7708991115','7346120002','2244886335','6066224334','3126759631','3194718151','4069301685','9562633814','3033195765','9095182805','5164440447','3013189419','2602371073','8326128410','9518370245','6156486511','6613756862','6204086324','4697816350','3234473277','7542130413','8645209840','2024251872','7573444483','2108348944','9102319543'];
const KNOWN_NOT_SERIOUS_NUMBERS=['8315969595','6025249999','9545531044','9545998844','6108587766','4049363703','3525526656','4403902075','2482400067','6176920021','7855500429','7074907029','7077389769','3869371667','2172425249','7153401448','8087477788','8635576929','9012192066','5415154514','5607500429','5129379494','3124793437','6265900828','9144699875','7408918422','7862185383','8325151689','9727487356','2173161719','9016128611','9157908824','8132848555','8703120279','8324413144','2103632150','7708996994','6284883332','9287654951','7732506946','3505627400','5806197420','8158146330','3478604021','4809955447','8134654567','5038870600','5083264440','6015736850','5188782513','3046737500','2162693152','8088603481','2533818589','7868283211','9096930598','3083059178','3053218180','7575742897','7012619840','8623687500','3058898191','5326247000','7039693579','8134203849','5314669271','3109087986','3105988171','6023634805','7865976907','6628008473','8054447815','6787566023','3052095548','3053365569'];

function normalizePhone(q){return q.replace(/\D/g,'');}
function checkKnownBadNumber(q){const digits=normalizePhone(q);if(digits.length<7)return null;const d10=digits.slice(-10);if(KNOWN_PRANK_NUMBERS.includes(d10))return{type:'prank',label:'🎭 CONFIRMED PRANK CALLER',color:'#ef4444',msg:'This number is on the confirmed prank caller list. End the call professionally and move on.'};if(KNOWN_TRUCKING_NUMBERS.includes(d10))return{type:'trucking',label:'🚛 CONFIRMED TRUCKING — DNQ',color:'#f97316',msg:'This number is a confirmed trucking business. They do not qualify. Do not transfer.'};if(KNOWN_NOT_SERIOUS_NUMBERS.includes(d10))return{type:'notserious',label:'⚠️ NOT A SERIOUS LEAD',color:'#eab308',msg:'This number is flagged as not a serious lead. Proceed with extreme caution or skip.'};return null;}
function detectPrank(query){const q=query.trim().toLowerCase();const reasons=[];let score=0;const isPhone=/^[\d\s\-\(\)\+\.]+$/.test(query)&&query.replace(/\D/g,'').length>=7;if(isPhone){const d=query.replace(/\D/g,'');if(/^(\d)\1+$/.test(d)){score+=85;reasons.push('All same digits — clearly fake number');}if(['1234567890','0987654321','1234567'].some(s=>d.includes(s.slice(0,7)))){score+=70;reasons.push('Sequential digits — common fake number');}if(['0000000000','1111111111','1234567890','9999999999'].includes(d)){score+=90;reasons.push('Known placeholder/test phone number');}}const fictional=['dunder mifflin','umbrella corp','initech','globex','vandelay','acme corp','nakatomi','aperture','wayne enterprises','stark industries'];if(fictional.some(f=>q.includes(f))){score+=95;reasons.push('Fictional company name detected');}if(/^[a-z]{1,3}$/.test(q)){score+=85;reasons.push('Too short to be a real business name');}if(/(.)\1{3,}/.test(q)){score+=75;reasons.push('Repeated characters — keyboard mashing');}if(/^(asdf|qwer|zxcv|test|fake|blah|lol|haha)/.test(q)){score+=90;reasons.push('Nonsense or test input');}['business name','company name','my business','test business','sample','placeholder'].forEach(p=>{if(q.includes(p)){score+=88;reasons.push('Generic placeholder name');}});['money inc','cash cash','big bucks','easy money','get rich','bank of nigeria','free money'].forEach(j=>{if(q.includes(j)){score+=80;reasons.push('Matches known scam/joke phrase');}});if(/[!@#$%^&*]{2,}/.test(query)){score+=60;reasons.push('Excessive special characters');}const words=q.split(/\s+/).filter(Boolean);if(words.length>1&&new Set(words).size===1){score+=75;reasons.push('All words identical — suspicious');}score=Math.min(score,100);return{prankScore:score,prankReasons:reasons,prankVerdict:score>=80?'definite_prank':score>=56?'likely_prank':score>=26?'suspicious':'clean'};}
function isPhoneNum(q){return /^[\d\s\-\(\)\+\.]+$/.test(q)&&q.replace(/\D/g,'').length>=7;}
function buildQuery(q){if(isPhoneNum(q))return 'For the phone number '+q+', give me: the business name, the name of the owner, the address, and email if possible';return 'For the business "'+q+'", give me: the business name, the name of the owner, the address, and email if possible';}
function runLookup(){const q=document.getElementById('lookup-input').value.trim();if(!q){document.getElementById('lookup-input').focus();return;}const knownBad=checkKnownBadNumber(q);if(knownBad){showKnownBadAlert(knownBad,q);const entry={query:q,prankScore:knownBad.type==='prank'?100:knownBad.type==='trucking'?90:70,prankVerdict:knownBad.type==='prank'?'definite_prank':'suspicious',prankReasons:['Found in known bad number database: '+knownBad.label],timestamp:new Date().toISOString()};lookupHistory.unshift(entry);if(lookupHistory.length>15)lookupHistory=lookupHistory.slice(0,15);try{localStorage.setItem('bizlookup_history',JSON.stringify(lookupHistory));}catch(e){}renderLookupHistory();return;}const prank=detectPrank(q);showPrankResult(prank);const entry={query:q,prankScore:prank.prankScore,prankVerdict:prank.prankVerdict,prankReasons:prank.prankReasons,timestamp:new Date().toISOString()};lookupHistory.unshift(entry);if(lookupHistory.length>15)lookupHistory=lookupHistory.slice(0,15);try{localStorage.setItem('bizlookup_history',JSON.stringify(lookupHistory));}catch(e){}renderLookupHistory();openSite('google');}
function showKnownBadAlert(bad,q){const el=document.getElementById('lookup-prank-result');const iconMap={prank:'fas fa-ban',trucking:'fas fa-truck',notserious:'fas fa-exclamation-triangle'};const bgMap={prank:'linear-gradient(135deg,rgba(239,68,68,0.25),rgba(185,28,28,0.35))',trucking:'linear-gradient(135deg,rgba(249,115,22,0.2),rgba(194,65,12,0.3))',notserious:'linear-gradient(135deg,rgba(234,179,8,0.18),rgba(161,98,7,0.28))'};const c=bad.color,icon=iconMap[bad.type],bg=bgMap[bad.type];el.innerHTML='<div style="border-radius:18px;overflow:hidden;border:3px solid '+c+';box-shadow:0 0 40px '+c+'55;animation:fadeSlideIn 0.25s ease-out;"><div style="background:'+bg+';padding:20px 22px;position:relative;overflow:hidden;"><div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 10px,'+c+'09 10px,'+c+'09 20px);"></div><div style="position:relative;display:flex;align-items:center;gap:16px;"><div style="width:56px;height:56px;border-radius:50%;background:'+c+'22;border:2px solid '+c+'55;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="'+icon+'" style="color:'+c+';font-size:1.3rem;"></i></div><div style="flex:1;"><div style="font-family:Orbitron,sans-serif;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.12em;color:'+c+';margin-bottom:4px;">'+bad.label+'</div><div style="font-size:12px;font-weight:700;color:#e2e8f0;line-height:1.5;">'+bad.msg+'</div><div style="margin-top:8px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;color:#475569;">Number: <span style="color:'+c+';">'+escapeHtml(q)+'</span> — Found in database</div></div></div></div><div style="background:rgba(2,6,23,0.85);padding:12px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;"><span style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;color:#334155;">Still want to search anyway?</span><button onclick="openSite(\'google\')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 14px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;cursor:pointer;" onmouseover="this.style.color=\'#94a3b8\'" onmouseout="this.style.color=\'#64748b\'">Search Anyway <i class="fas fa-external-link-alt ml-1"></i></button></div></div>';el.classList.remove('hidden');el.scrollIntoView({behavior:'smooth',block:'nearest'});}
function openSite(site){const q=document.getElementById('lookup-input').value.trim();if(!q){document.getElementById('lookup-input').focus();return;}const isPhone=isPhoneNum(q),digits=q.replace(/\D/g,''),gq=buildQuery(q);const urls={google:'https://www.google.com/search?q='+encodeURIComponent(gq)+'&udm=50',bing:'https://www.bing.com/search?q='+encodeURIComponent(gq)+'&showconv=1',yellowpages:isPhone?'https://www.yellowpages.com/phone-lookup?phone='+digits:'https://www.yellowpages.com/search?search_terms='+encodeURIComponent(q)+'&geo_location_terms=United+States',whitepages:isPhone?'https://www.whitepages.com/phone/'+digits:'https://www.whitepages.com/business/'+encodeURIComponent(q),yelp:'https://www.yelp.com/search?find_desc='+encodeURIComponent(q)+'&find_loc=United+States','411':isPhone?'https://www.411.com/phone/'+digits:'https://www.411.com/business/search?q='+encodeURIComponent(q)};if(urls[site])window.open(urls[site],'_blank');}
function showPrankResult(prank){const el=document.getElementById('lookup-prank-result');if(!prank||prank.prankScore<26){el.classList.add('hidden');el.innerHTML='';return;}const s=prank.prankScore,isD=s>=80,isP=s>=56,label=isD?'🚨 DEFINITE PRANK — END CALL &amp; MOVE ON':isP?'⚠️ LIKELY PRANK — PROCEED WITH CAUTION':'👀 SUSPICIOUS — VERIFY CAREFULLY',color=isD?'#ef4444':isP?'#f97316':'#eab308',bg=isD?'linear-gradient(135deg,rgba(239,68,68,0.22),rgba(185,28,28,0.32))':isP?'linear-gradient(135deg,rgba(249,115,22,0.18),rgba(194,65,12,0.28))':'linear-gradient(135deg,rgba(234,179,8,0.14),rgba(161,98,7,0.24))';const rHTML=(prank.prankReasons||[]).map(r=>'<div style="display:flex;align-items:center;gap:8px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:8px;padding:8px 12px;"><i class="fas fa-flag" style="color:'+color+';font-size:10px;flex-shrink:0;"></i><span style="font-size:12px;color:#fca5a5;font-weight:700;">'+escapeHtml(r)+'</span></div>').join('');el.innerHTML='<div style="border-radius:18px;overflow:hidden;border:2px solid '+color+';box-shadow:0 0 30px '+color+'44;animation:fadeSlideIn 0.3s ease-out;"><div style="background:'+bg+';padding:18px 20px;border-bottom:1px solid '+color+'30;position:relative;overflow:hidden;"><div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 10px,'+color+'08 10px,'+color+'08 20px);"></div><div style="position:relative;display:flex;align-items:center;gap:14px;"><div style="width:58px;height:58px;border-radius:50%;background:conic-gradient('+color+' '+s+'%,rgba(255,255,255,0.04) '+s+'%);display:flex;align-items:center;justify-content:center;position:relative;flex-shrink:0;"><div style="position:absolute;inset:6px;border-radius:50%;background:#020617;"></div><span style="position:relative;z-index:1;font-family:Orbitron,sans-serif;font-weight:900;font-size:0.9rem;color:'+color+';">'+s+'</span></div><div><div style="font-family:Orbitron,sans-serif;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:'+color+';margin-bottom:3px;">'+label+'</div><div style="font-size:10px;color:#94a3b8;font-weight:700;">Prank Risk Score: <span style="color:'+color+';font-weight:900;">'+s+'/100</span></div></div></div></div>'+(rHTML?'<div style="background:rgba(2,6,23,0.75);padding:14px;display:flex;flex-direction:column;gap:6px;">'+rHTML+'</div>':'')+'</div>';el.classList.remove('hidden');}
function onLookupInput(val){const q=val.trim(),digits=normalizePhone(q);if(digits.length===10){const bad=checkKnownBadNumber(q);if(bad){showKnownBadAlert(bad,q);return;}}if(!q){const pr=document.getElementById('lookup-prank-result');if(pr){pr.classList.add('hidden');pr.innerHTML='';}}}
async function logPrankCall(){
  const q=document.getElementById('lookup-input').value.trim();
  const statusEl=document.getElementById('prank-log-status');
  if(!q){
    document.getElementById('lookup-input').focus();
    statusEl.style.display='block';
    statusEl.style.background='rgba(234,179,8,0.12)';
    statusEl.style.border='1px solid rgba(234,179,8,0.35)';
    statusEl.style.color='#eab308';
    statusEl.textContent='⚠️ Paste the prank number first';
    setTimeout(()=>{statusEl.style.display='none';},3000);
    return;
  }
  const btn=document.getElementById('log-prank-btn');
  btn.disabled=true;
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>&nbsp;Logging...';
  statusEl.style.display='block';
  statusEl.style.background='rgba(59,130,246,0.1)';
  statusEl.style.border='1px solid rgba(59,130,246,0.3)';
  statusEl.style.color='#60a5fa';
  statusEl.textContent='Sending to sheet...';
  try{
    const body=JSON.stringify({action:'logPrank',number:q,timestamp:new Date().toISOString(),loggedBy:'rep'});
    await fetch(API_URL,{method:'POST',body:body});
    statusEl.style.background='rgba(34,197,94,0.12)';
    statusEl.style.border='1px solid rgba(34,197,94,0.35)';
    statusEl.style.color='#4ade80';
    statusEl.textContent='✅ Prank number logged to sheet!';
    document.getElementById('lookup-input').value='';
    setTimeout(()=>{statusEl.style.display='none';},4000);
  }catch(e){
    statusEl.style.background='rgba(239,68,68,0.12)';
    statusEl.style.border='1px solid rgba(239,68,68,0.35)';
    statusEl.style.color='#f87171';
    statusEl.textContent='❌ Failed to log — check connection';
    setTimeout(()=>{statusEl.style.display='none';},4000);
  }
  btn.disabled=false;
  btn.innerHTML='<i class="fas fa-ban"></i>&nbsp;Log Prank Call &#8594; Sheet';
}

function clearLookup(){document.getElementById('lookup-input').value='';const pr=document.getElementById('lookup-prank-result');if(pr){pr.classList.add('hidden');pr.innerHTML='';}document.getElementById('lookup-input').focus();}
function renderLookupHistory(){const sec=document.getElementById('lookup-history-section'),con=document.getElementById('lookup-history');if(!lookupHistory.length){sec.classList.add('hidden');return;}sec.classList.remove('hidden');con.innerHTML=lookupHistory.map((h,i)=>{const ago=timeAgo(new Date(h.timestamp)),s=h.prankScore||0;const badge=s>=80?'<span style="font-size:9px;font-weight:900;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:20px;padding:2px 7px;margin-left:6px;">🚨 PRANK</span>':s>=56?'<span style="font-size:9px;font-weight:900;background:rgba(249,115,22,0.15);color:#f97316;border:1px solid rgba(249,115,22,0.3);border-radius:20px;padding:2px 7px;margin-left:6px;">⚠️ SUSPECT</span>':s>=26?'<span style="font-size:9px;font-weight:900;background:rgba(234,179,8,0.15);color:#eab308;border:1px solid rgba(234,179,8,0.3);border-radius:20px;padding:2px 7px;margin-left:6px;">👀 CHECK</span>':'';return'<div class="search-history-item" onclick="reloadHistory('+i+')"><div><div class="font-black text-sm text-white">'+escapeHtml(h.query)+badge+'</div><div class="text-[10px] text-slate-600 font-bold mt-0.5 uppercase tracking-wide">'+ago+'</div></div><i class="fas fa-chevron-right text-slate-700 text-xs"></i></div>';}).join('');}
function reloadHistory(i){const h=lookupHistory[i];if(!h)return;document.getElementById('lookup-input').value=h.query;showPrankResult({prankScore:h.prankScore||0,prankReasons:h.prankReasons||[],prankVerdict:h.prankVerdict||'clean'});}
function clearHistory(){lookupHistory=[];try{localStorage.setItem('bizlookup_history','[]');}catch(e){}renderLookupHistory();}
function timeAgo(date){const m=Math.floor((Date.now()-date.getTime())/60000);if(m<1)return'Just now';if(m<60)return m+'m ago';const h=Math.floor(m/60);if(h<24)return h+'h ago';return Math.floor(h/24)+'d ago';}
function escapeHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ============================================================
// CLOCK UPDATE
// ============================================================
function updateClocks(){
  try {
    const now = new Date();
    const fmt = (tz) => {
      return now.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    };
    const gEl = document.getElementById('clock-guyana');
    const cEl = document.getElementById('clock-california');
    if(gEl) gEl.textContent = fmt('America/Guyana');
    if(cEl) cEl.textContent = fmt('America/Los_Angeles');
  } catch(e) {
    const gEl = document.getElementById('clock-guyana');
    const cEl = document.getElementById('clock-california');
    const now = new Date();
    const t = now.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
    if(gEl) gEl.textContent = t;
    if(cEl) cEl.textContent = t;
  }
}
// Run immediately and every second
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', function(){ updateClocks(); setInterval(updateClocks,1000); });
} else {
  updateClocks();
  setInterval(updateClocks,1000);
}

// ============================================================
// TRIVIA QUESTION BANK
// ============================================================
const TRIVIA_BANK=[
  // PLAYBOOK
  {type:'mcq',category:'Playbook',question:'What is the minimum number of months a business must have been operating to qualify for a transfer?',options:['3 months','6 months','12 months','24 months'],correct:2,explanation:'Businesses must be operating for at least 12 months to qualify.'},
  {type:'mcq',category:'Playbook',question:'What is the minimum annual revenue required for a business to qualify?',options:['$50,000','$100,000','$150,000','$200,000'],correct:3,explanation:'The minimum annual revenue threshold is $200,000.'},
  {type:'truefalse',category:'Playbook',question:'You can proceed with a transfer if the prospect only knows their 2024 revenue and not their 2025 revenue.',options:['True','False'],correct:1,explanation:'You need the actual 2025 number — never accept a prior year estimate. Schedule a callback instead.'},
  {type:'mcq',category:'Playbook',question:'If a prospect says "It should be around the same as last year," what should you do?',options:['Accept it and proceed','Push for the actual 2025 figure','Transfer them anyway','End the call immediately'],correct:1,explanation:'Never accept assumptions. Ask for the actual current year revenue or a monthly estimate to calculate annual.'},
  {type:'truefalse',category:'Playbook',question:'A monthly revenue of $15,000 would qualify a business for a transfer.',options:['True','False'],correct:1,explanation:'$15,000/month x 12 = $180,000/year, which is below the $200,000 annual minimum. They do NOT qualify on revenue.'},
  {type:'mcq',category:'Playbook',question:'What do you multiply a prospect\'s monthly revenue by to estimate their annual revenue?',options:['6','10','12','52'],correct:2,explanation:'Multiply monthly revenue by 12 to get the annual estimate.'},
  {type:'truefalse',category:'Playbook',question:'A business open for only 8 months qualifies for a transfer.',options:['True','False'],correct:1,explanation:'Businesses must be operating for at least 12 months — 8 months does not qualify.'},
  // REBUTTALS
  {type:'mcq',category:'Rebuttals',question:'A prospect says "I\'m not interested." What is the best first response?',options:['End the call immediately','Acknowledge and pivot to the business benefit','Argue about why they should be interested','Ask them to call back later'],correct:1,explanation:'Acknowledge their response and pivot — connect the value to their specific business situation.'},
  {type:'mcq',category:'Rebuttals',question:'A prospect asks "What is the interest rate?" How should you respond?',options:['Give them an exact rate immediately','Explain rates depend on risk profile and redirect to qualifying','Tell them it\'s confidential','Say "I don\'t know"'],correct:1,explanation:'Rates depend on risk and credit profile. Redirect to the specialist and keep qualifying.'},
  {type:'truefalse',category:'Rebuttals',question:'If a prospect says "I\'m already pre-qualified, why do you need more questions?" you should stop asking questions.',options:['True','False'],correct:1,explanation:'Pre-qualified means they meet general criteria. You still need to verify details to match them with the right program.'},
  {type:'mcq',category:'Rebuttals',question:'A prospect asks "Why don\'t you have my information?" What is the best response?',options:['Apologize and end the call','Explain you pull from multiple sources but always verify directly with them','Make up an explanation','Tell them it\'s a system error'],correct:1,explanation:'Explain that you always verify directly to ensure accuracy, then redirect to qualifying questions.'},
  {type:'mcq',category:'Rebuttals',question:'When a prospect says "I found a cheaper option elsewhere," what is the strongest counter?',options:['Agree and end the call','Offer to match the price immediately','Suggest cheaper isn\'t always better and offer a side-by-side comparison','Ignore the comment and keep asking questions'],correct:2,explanation:'Point out hidden costs and offer a comparison. Let the specialist handle the detailed comparison.'},
  {type:'mcq',category:'Rebuttals',question:'A prospect asks "What type of loan is this?" The correct answer is:',options:['SBA / Government-backed loans','Lines of credit and working capital — not government-backed','Mortgage and auto loans','Personal loans only'],correct:1,explanation:'These are lines of credit and working capital. Not government-backed. The specialist will explain everything in detail.'},
  {type:'truefalse',category:'Rebuttals',question:'If a prospect says "I didn\'t apply for a loan," you should immediately end the call.',options:['True','False'],correct:1,explanation:'Explain their info came through a partner network and redirect to qualifying. Use one of the prepared Option A/B/C responses.'},
  {type:'mcq',category:'Rebuttals',question:'What should you always do after handling any rebuttal?',options:['Thank them for the question','Transfer them immediately','Go right back to the qualifying questions','Ask if they have more concerns'],correct:2,explanation:'After handling any rebuttal, immediately redirect back to the qualifying questions to keep the call moving forward.'},
  // PRANK DETECTION
  {type:'mcq',category:'Prank Detection',question:'Which of these is the strongest sign that a caller is pranking?',options:['They ask what the interest rate is','They say "yes" to every question instantly without hesitation','They want to know the company name','They ask about the timeline for funding'],correct:1,explanation:'Real business owners push back, ask questions, or pause to think. Instant "yes" to everything is a major prank red flag.'},
  {type:'truefalse',category:'Prank Detection',question:'If a caller gives "OnlyFans" as their business name, you should proceed with qualifying questions.',options:['True','False'],correct:1,explanation:'OnlyFans is an instant disqualifier. End the call professionally and move on immediately.'},
  {type:'mcq',category:'Prank Detection',question:'What should you do if someone asks you to send or wire funds to Mexico?',options:['Ask for their bank details','Proceed if they meet other criteria','End the call immediately — it\'s a confirmed scam','Transfer to a supervisor for approval'],correct:2,explanation:'Any mention of sending funds to Mexico or international wire transfers is a confirmed scam. End professionally and move on.'},
  {type:'mcq',category:'Prank Detection',question:'A caller answers every qualifying question instantly with perfect answers. What should you think?',options:['This is an ideal prospect — transfer fast','Be suspicious — real owners hesitate and recall actual details','Ask for a supervisor to approve','Continue normally without concern'],correct:1,explanation:'Real business owners live their business — they naturally pause to recall revenue, dates, and details. Instant perfect answers are a red flag.'},
  {type:'truefalse',category:'Prank Detection',question:'Hearing whispering or coached answers in the background is a sign of a legitimate business call.',options:['True','False'],correct:1,explanation:'Whispering or coached answers indicate a group prank. Real business owners call independently.'},
  {type:'mcq',category:'Prank Detection',question:'What is the "Supervisor Test" prank strategy?',options:['Ask the prank caller to call back tomorrow','Tell the caller you\'re putting your supervisor on the line — prank callers will hang up','Transfer the call to a manager immediately','Ask the caller for their supervisor\'s number'],correct:1,explanation:'Say you\'re getting your supervisor, put them on hold, then get your actual supervisor. Prank callers hang up. Real customers stay on.'},
  {type:'mcq',category:'Prank Detection',question:'A caller gives their business name as "My Company LLC" — what is this a sign of?',options:['A legitimate small business','A possible prank — generic placeholder name','A large corporation','A non-profit organization'],correct:1,explanation:'Vague generic names like "My Company" or names that change when repeated are classic prank red flags.'},
  // INDUSTRY RULES
  {type:'mcq',category:'Industry Rules',question:'A caller says they own a tractor. What is the first question you must ask?',options:['How long have you owned the tractor?','Is it a detachable tractor?','How much revenue does the tractor business generate?','How many employees do you have?'],correct:1,explanation:'A detachable tractor is classified as a truck — it falls under the No Trucking rule. A non-detachable farm tractor can qualify.'},
  {type:'truefalse',category:'Industry Rules',question:'A detachable tractor qualifies for a transfer.',options:['True','False'],correct:1,explanation:'A detachable tractor is classified as a truck, which falls under the No Trucking rule. It does NOT qualify.'},
  {type:'mcq',category:'Industry Rules',question:'A logging company operates 9 months out of the year. Do they qualify?',options:['Yes, 9 months is enough','No, logging must operate all 12 months','Yes, if their revenue is high enough','It depends on the state'],correct:1,explanation:'Logging businesses must operate ALL 12 months of the year to qualify. Seasonal operators do not qualify.'},
  {type:'truefalse',category:'Industry Rules',question:'A trucking company automatically qualifies if they meet the revenue and time-in-business requirements.',options:['True','False'],correct:1,explanation:'Trucking businesses NEVER qualify — there are no exceptions to the No Trucking rule, regardless of revenue or time in business.'},
  {type:'mcq',category:'Industry Rules',question:'What is the correct way to handle a trucking business that calls in?',options:['Transfer them if revenue is $200k+','End the call immediately','Proceed if they\'ve been open 2+ years','Ask if they also have a non-trucking side business'],correct:3,explanation:'Trucking is a no-go, but you should ask if they have a separate non-trucking business that might qualify.'},
  // QUALIFYING
  {type:'mcq',category:'Qualifying',question:'In what order should you ask qualifying questions?',options:['Revenue first, then time in business','Time in business first, then revenue','Industry first, then everything else','Credit score first, then revenue'],correct:1,explanation:'Always confirm time in business first, then revenue. If they don\'t meet time requirements, there\'s no need to ask about revenue.'},
  {type:'truefalse',category:'Qualifying',question:'A business with $12,000 monthly revenue qualifies based on revenue requirements.',options:['True','False'],correct:1,explanation:'$12,000/month × 12 = $144,000/year, which is below the $200,000 annual minimum. They do NOT qualify on revenue.'},
  {type:'mcq',category:'Qualifying',question:'A prospect hesitates to give their revenue. What should you do?',options:['End the call immediately','Accept their hesitation and move to transfer','Acknowledge the concern and explain why you need it to find the right program','Skip the question and come back to it'],correct:2,explanation:'Explain that the revenue figure is needed to match them with the right lending program — it\'s for their benefit.'},
  {type:'mcq',category:'Qualifying',question:'What does the "12+ Proof" stat on the dashboard represent?',options:['How many months the business has been open','The number of qualifying transfers a rep needs per week to stay off the blacklist','Revenue above $12,000 per month','Total calls made in a day'],correct:1,explanation:'12+ Proof is the weekly transfer target reps must hit to stay safe and avoid being put on the blacklist.'},
  {type:'truefalse',category:'Qualifying',question:'You can transfer a prospect who only tells you their 2024 annual revenue.',options:['True','False'],correct:1,explanation:'You must have the 2025 actual revenue. If they only have 2024, schedule a callback for when they have the current number.'},
];

function getShuffledQuestions(n=5){
  const shuffled=[...TRIVIA_BANK].sort(()=>Math.random()-0.5);
  const cats={};const picked=[];
  for(const q of shuffled){if(picked.length>=n)break;const c=q.category;if(!cats[c]||cats[c]<2){picked.push(q);cats[c]=(cats[c]||0)+1;}}
  while(picked.length<n&&picked.length<TRIVIA_BANK.length){const q=shuffled.find(q2=>!picked.includes(q2));if(q)picked.push(q);else break;}
  return picked.slice(0,n);
}

async function generateAIQuestions(n=5){
  const knowledge = getDashboardKnowledge();
  const categories = ['Playbook','Rebuttals','Prank Detection','Qualifying','Industry Rules'];
  const shuffledCats = [...categories].sort(()=>Math.random()-0.5);
  const selectedCats = [];
  for(let i=0;i<n;i++) selectedCats.push(shuffledCats[i % shuffledCats.length]);

  const prompt = `You are a quiz master for a business loan call center training platform. Generate exactly ${n} trivia questions for agents based ONLY on the following knowledge base from the dashboard.

---KNOWLEDGE BASE---
${knowledge}
---END KNOWLEDGE BASE---

CRITICAL DEFINITIONS (never get these wrong):
- 12+ Proof on the dashboard = the number of qualifying transfers a rep needs per week to stay safe and NOT be on the blacklist. It is a weekly performance target, NOT a reference to months in business.
- The minimum annual revenue to qualify is $200,000

CRITICAL REVENUE RULE (never get this wrong):
- The minimum annual revenue to qualify is $200,000
- $15,000/month = $180,000/year = DOES NOT QUALIFY (below $200k)
- $17,000/month = $204,000/year = QUALIFIES (above $200k)
- Any monthly figure x 12 that is under $200,000 = DOES NOT QUALIFY
- Never say $15,000/month qualifies — it does not

STRICT RULES:
- Questions must be based strictly on specific facts in the knowledge base above
- NEVER use the same wording, scenario, or concept as a previous round — vary completely
- Use question types: mcq (4 options) or truefalse
- Assign one category per question from this list (in order): ${selectedCats.join(', ')}
- For mcq: exactly 4 options, one correct answer
- For truefalse: options must be exactly ["True","False"]
- Make wrong answers plausible, not obviously wrong
- "correct" = 0-based INDEX of the correct option
- Include a 1-2 sentence explanation

Respond ONLY with a valid JSON array. No markdown, no backticks, no preamble. Example format:
[{"type":"mcq","category":"Playbook","question":"...","options":["A","B","C","D"],"correct":2,"explanation":"..."},{"type":"truefalse","category":"Rebuttals","question":"...","options":["True","False"],"correct":1,"explanation":"..."}]`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{role: "user", content: prompt}]
    })
  });
  if(!response.ok) throw new Error('API error '+response.status);
  const data = await response.json();
  const raw = data.content.map(b=>b.text||'').join('').trim();
  const clean = raw.replace(/```json|```/g,'').trim();
  const questions = JSON.parse(clean);
  if(!Array.isArray(questions)||questions.length===0) throw new Error('Bad questions format');
  return questions.slice(0,n);
}
const TRIVIA_ROUNDS=[{label:'🌅 Morning Warm-Up',start:11,end:14},{label:'⚡ Midday Challenge',start:14,end:17},{label:'🔥 End of Day Blitz',start:17,end:23}];
const MOTIVATIONAL_QUOTES=['💥 Lock in — every answer matters!','🔥 You\'re on fire, don\'t slow down!','🧠 Knowledge = Transfers. Let\'s go!','⚡ Trust your training — crush it!','🎯 Real reps know this cold. Show it!','💪 Champions study AND perform!','🚀 Fast mind, sharp answers — that\'s you!','👑 Top reps train harder than anyone!','🎮 This is your moment — own it!','🌟 One question at a time — stay focused!'];
const LOADING_TIPS=['🔄 Mixing up a fresh set of questions just for you...','💡 Every round is different — no two sets are ever the same!','🧠 Questions pulled from everything in this dashboard','🎯 Covering Playbook, Rebuttals, Prank Detection & more','⚡ Stay sharp — these questions change every single round!'];
let triviaState={questions:[],current:0,score:0,timer:null,timeLeft:20,playerName:'',answers:[],roundKey:'',streak:0,loadingTipInterval:null,countdownInterval:null};

function getCurrentRound(){const h=new Date().getHours();if(h>=17)return TRIVIA_ROUNDS[2];if(h>=14)return TRIVIA_ROUNDS[1];if(h>=11)return TRIVIA_ROUNDS[0];return null;}
function getRoundKey(){const d=new Date(),r=getCurrentRound();return'trivia_'+d.toDateString()+'_'+(r?r.label:'free');}
function getNextRoundTime(){const h=new Date().getHours();let tH;if(h<11)tH=11;else if(h<14)tH=14;else if(h<17)tH=17;else return null;const t=new Date();t.setHours(tH,0,0,0);return t;}

function updateNextRoundCountdown(){
  const next=getNextRoundTime(),el=document.getElementById('trivia-next-countdown'),bar=document.getElementById('trivia-countdown-bar');
  if(!next||!el){if(bar)bar.classList.add('hidden');return;}
  const diff=next-Date.now();
  if(diff<=0){if(bar)bar.classList.add('hidden');return;}
  if(bar)bar.classList.remove('hidden');
  const hrs=Math.floor(diff/3600000),mins=Math.floor((diff%3600000)/60000),secs=Math.floor((diff%60000)/1000);
  el.textContent=hrs>0?hrs+'h '+String(mins).padStart(2,'0')+'m':String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
}

function initTriviaTab(){
  const r=getCurrentRound();
  const badge=document.getElementById('trivia-round-badge');
  const next=document.getElementById('trivia-next-round');
  if(badge)badge.textContent=r?r.label:'⏳ Next Round Soon';
  if(next){const nt=getNextRoundTime();if(!nt&&!r)next.textContent='Rounds at 11am, 2pm & 5pm';else next.textContent='';}
  if(triviaState.countdownInterval)clearInterval(triviaState.countdownInterval);
  updateNextRoundCountdown();
  triviaState.countdownInterval=setInterval(updateNextRoundCountdown,1000);
  renderTriviaLeaderboard();
}

function getDashboardKnowledge(){
  const sections=['playbook-view','rebuttals-view','prank-view'];
  let k='';
  sections.forEach(id=>{const el=document.getElementById(id);if(el)k+=el.innerText+'\n\n';});
  return k.slice(0,8000);
}

async function startTrivia(anon=false){
  const ni=document.getElementById('trivia-name-input');
  triviaState.playerName=anon?'Anonymous':(ni?ni.value.trim()||'Anonymous':'Anonymous');
  triviaState.roundKey=getRoundKey();
  triviaState.streak=0;
  document.getElementById('trivia-name-screen').classList.add('hidden');
  document.getElementById('trivia-loading-screen').classList.remove('hidden');
  document.getElementById('trivia-result-screen').classList.add('hidden');
  document.getElementById('trivia-question-screen').classList.add('hidden');
  // loading tips ticker
  let tipIdx=0;
  const tipEl=document.getElementById('trivia-loading-tips');
  if(tipEl)tipEl.textContent=LOADING_TIPS[0];
  triviaState.loadingTipInterval=setInterval(()=>{
    tipIdx=(tipIdx+1)%LOADING_TIPS.length;
    if(tipEl){tipEl.style.opacity=0;setTimeout(()=>{tipEl.textContent=LOADING_TIPS[tipIdx];tipEl.style.opacity=1;},300);}
  },1800);
  try {
    // Short simulated loading delay for UX
    triviaState.questions=await generateAIQuestions(5).catch(async err=>{
      console.warn('AI generation failed, falling back to bank:',err);
      await new Promise(res=>setTimeout(res,800));
      return getShuffledQuestions(5);
    });
    triviaState.current=0;triviaState.score=0;triviaState.answers=[];
    clearInterval(triviaState.loadingTipInterval);
    document.getElementById('trivia-loading-screen').classList.add('hidden');
    document.getElementById('trivia-question-screen').classList.remove('hidden');
    document.getElementById('trivia-explanation').classList.add('hidden');
    showTriviaQuestion();
  }catch(e){
    clearInterval(triviaState.loadingTipInterval);
    document.getElementById('trivia-loading-screen').classList.add('hidden');
    document.getElementById('trivia-name-screen').classList.remove('hidden');
    console.error('Trivia error:',e);
    alert('Could not load questions — please try again!');
  }
}

function showTriviaQuestion(){
  const q=triviaState.questions[triviaState.current];
  const total=triviaState.questions.length;
  const idx=triviaState.current;
  document.getElementById('trivia-progress').style.width=((idx/total)*100)+'%';
  document.getElementById('trivia-q-counter').textContent='Q'+(idx+1)+' of '+total;
  const sLabel=document.getElementById('trivia-streak-label');
  if(triviaState.streak>=2)sLabel.textContent='🔥 '+triviaState.streak+' Streak!';else sLabel.textContent='';
  // motivational quote
  const motiv=document.getElementById('trivia-motiv-bar');
  if(motiv){motiv.style.opacity=0;setTimeout(()=>{motiv.textContent=MOTIVATIONAL_QUOTES[idx%MOTIVATIONAL_QUOTES.length];motiv.style.opacity=1;},200);}
  // category pill
  const catColors={'Playbook':'rgba(57,255,20,0.15)','Rebuttals':'rgba(0,245,255,0.15)','Prank Detection':'rgba(255,45,120,0.15)','Qualifying':'rgba(255,229,0,0.15)','Industry Rules':'rgba(255,107,0,0.15)'};
  const catTC={'Playbook':'#39FF14','Rebuttals':'#00F5FF','Prank Detection':'#FF2D78','Qualifying':'#FFE500','Industry Rules':'#FF6B00'};
  const bg=catColors[q.category]||'rgba(255,255,255,0.08)';
  const tc=catTC[q.category]||'#94a3b8';
  const typeLabel=q.type==='truefalse'?'True / False':q.type==='scenario'?'🎭 Scenario':'🎯 Multiple Choice';
  document.getElementById('trivia-category-pill').innerHTML=
    '<span style="background:'+bg+';border:1px solid '+tc+'44;border-radius:20px;padding:4px 12px;font-size:10px;font-weight:900;text-transform:uppercase;color:'+tc+';letter-spacing:0.1em;">'+escapeHtml(q.category)+'</span>'+
    '<span style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:4px 10px;font-size:10px;font-weight:900;text-transform:uppercase;color:#475569;letter-spacing:0.08em;">'+typeLabel+'</span>';
  document.getElementById('trivia-question-text').textContent=q.question;
  document.getElementById('trivia-explanation').classList.add('hidden');
  // options
  const optEl=document.getElementById('trivia-options');
  if(q.type==='truefalse'){
    optEl.style.flexDirection='row';
    optEl.innerHTML=
      '<button class="tf-option tf-true" onclick="answerTrivia(0)" style="flex:1;padding:18px 14px;border-radius:16px;font-family:\'Boogaloo\',cursive;font-size:18px;text-align:center;cursor:pointer;background:rgba(57,255,20,0.08);border:2px solid rgba(57,255,20,0.3);color:#39FF14;transition:all 0.15s;" onmouseover="if(!this.disabled)this.style.background=\'rgba(57,255,20,0.2)\'" onmouseout="if(!this.disabled)this.style.background=\'rgba(57,255,20,0.08)\'">✅ True</button>'+
      '<button class="tf-option tf-false" onclick="answerTrivia(1)" style="flex:1;padding:18px 14px;border-radius:16px;font-family:\'Boogaloo\',cursive;font-size:18px;text-align:center;cursor:pointer;background:rgba(255,45,120,0.08);border:2px solid rgba(255,45,120,0.3);color:#FF2D78;transition:all 0.15s;" onmouseover="if(!this.disabled)this.style.background=\'rgba(255,45,120,0.2)\'" onmouseout="if(!this.disabled)this.style.background=\'rgba(255,45,120,0.08)\'">❌ False</button>';
    optEl.style.display='flex';
    optEl.style.gap='12px';
  }else{
    optEl.style.flexDirection='column';
    optEl.style.display='flex';
    const letters=['A','B','C','D'];
    optEl.innerHTML=q.options.map((opt,i)=>'<button class="opt-btn" onclick="answerTrivia('+i+')" style="width:100%;background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.1);border-radius:14px;padding:14px 18px;text-align:left;color:#e2e8f0;cursor:pointer;display:flex;align-items:center;gap:12px;font-family:\'Boogaloo\',cursive;font-size:16px;transition:all 0.15s;" onmouseover="if(!this.disabled){this.style.background=\'rgba(255,229,0,0.1)\';this.style.borderColor=\'rgba(255,229,0,0.5)\';this.style.color=\'#FFE500\';this.querySelector(\'.ol\').style.borderColor=\'rgba(255,229,0,0.5)\';}" onmouseout="if(!this.disabled){this.style.background=\'rgba(255,255,255,0.04)\';this.style.borderColor=\'rgba(255,255,255,0.1)\';this.style.color=\'#e2e8f0\';this.querySelector(\'.ol\').style.borderColor=\'rgba(255,255,255,0.15)\';}"><span class="ol" style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0;border:2px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);">'+letters[i]+'</span><span>'+escapeHtml(opt)+'</span></button>').join('');
  }
  // timer
  triviaState.timeLeft=20;
  updateCountdownRing(20,20);
  clearInterval(triviaState.timer);
  triviaState.timer=setInterval(()=>{
    triviaState.timeLeft--;
    updateCountdownRing(triviaState.timeLeft,20);
    if(triviaState.timeLeft<=0){clearInterval(triviaState.timer);answerTrivia(-1);}
  },1000);
}

function updateCountdownRing(left,total){
  const circ=138.2,pct=left/total,offset=circ*(1-pct);
  const ring=document.getElementById('trivia-ring-fill'),txt=document.getElementById('trivia-timer-text');
  if(!ring||!txt)return;
  ring.setAttribute('stroke-dashoffset',offset);
  const color=left>10?'var(--neon-yellow)':left>5?'var(--neon-orange)':'var(--neon-pink)';
  ring.setAttribute('stroke',color);
  txt.textContent=left;txt.style.color=color;
}

function answerTrivia(chosen){
  clearInterval(triviaState.timer);
  const q=triviaState.questions[triviaState.current];
  const correct=q.correct;
  const isRight=chosen===correct;
  if(isRight){triviaState.score++;triviaState.streak++;}else{triviaState.streak=0;}
  triviaState.answers.push({question:q.question,chosen,correct,isRight,explanation:q.explanation,type:q.type});
  // highlight
  const optEl=document.getElementById('trivia-options');
  const btns=optEl.querySelectorAll('button');
  btns.forEach((btn,i)=>{
    btn.disabled=true;
    if(i===correct){
      btn.style.background='rgba(57,255,20,0.2)';
      btn.style.borderColor='#39FF14';
      btn.style.color='#39FF14';
    }else if(i===chosen&&!isRight){
      btn.style.background='rgba(255,45,120,0.2)';
      btn.style.borderColor='#FF2D78';
      btn.style.color='#FF2D78';
    }
  });
  if(q.explanation){
    document.getElementById('trivia-explanation-text').textContent=q.explanation;
    document.getElementById('trivia-explanation').classList.remove('hidden');
  }
  if(isRight)spawnConfetti();
  setTimeout(()=>{
    triviaState.current++;
    document.getElementById('trivia-explanation').classList.add('hidden');
    if(triviaState.current>=triviaState.questions.length)finishTrivia();
    else showTriviaQuestion();
  },isRight?900:1800);
}

function spawnConfetti(){
  const card=document.getElementById('trivia-question-card');
  if(!card)return;
  const colors=['#FFE500','#FF6B00','#FF2D78','#00F5FF','#39FF14'];
  for(let i=0;i<10;i++){
    const dot=document.createElement('div');
    dot.className='confetti-dot';
    dot.style.cssText='left:'+Math.random()*100+'%;top:-10px;background:'+colors[Math.floor(Math.random()*colors.length)]+';animation-delay:'+Math.random()*0.4+'s;animation-duration:'+(0.8+Math.random()*0.6)+'s;';
    card.appendChild(dot);
    setTimeout(()=>dot.remove(),1500);
  }
}

function finishTrivia(){
  const score=triviaState.score,total=triviaState.questions.length,pct=Math.round(score/total*100);
  document.getElementById('trivia-question-screen').classList.add('hidden');
  document.getElementById('trivia-result-screen').classList.remove('hidden');
  document.getElementById('trivia-progress').style.width='100%';
  const emoji=pct===100?'🏆':pct>=80?'🔥':pct>=60?'💪':pct>=40?'📚':'😅';
  const msg=pct===100?'Perfect score! You know this cold!':pct>=80?'Outstanding — nearly flawless!':pct>=60?'Solid round. Keep sharpening!':pct>=40?'Good effort — review the playbook.':'Study those rebuttals & try again!';
  document.getElementById('trivia-result-emoji').textContent=emoji;
  document.getElementById('trivia-result-name').textContent=triviaState.playerName==='Anonymous'?'Anonymous Player':triviaState.playerName;
  document.getElementById('trivia-result-score').textContent=score+'/'+total;
  document.getElementById('trivia-result-msg').textContent=msg;
  const bd=document.getElementById('trivia-result-breakdown');
  bd.innerHTML=triviaState.answers.map((a,i)=>{
    const q=triviaState.questions[i];
    const chosenText=a.chosen>=0?(q.options[a.chosen]||'Time Up!'):'⏱ Time Up!';
    const correctText=q.options[a.correct];
    return'<div style="background:'+(a.isRight?'rgba(57,255,20,0.06)':'rgba(255,45,120,0.06)')+';border:1px solid '+(a.isRight?'rgba(57,255,20,0.2)':'rgba(255,45,120,0.2)')+';border-radius:12px;padding:12px 14px;"><div style="display:flex;align-items:flex-start;gap:8px;"><span style="font-size:16px;flex-shrink:0;">'+(a.isRight?'✅':'❌')+'</span><div><div style="font-family:\'Boogaloo\',cursive;font-size:14px;color:white;line-height:1.4;margin-bottom:4px;">'+escapeHtml(a.question)+'</div>'+(!a.isRight?'<div style="font-size:11px;color:#39FF14;margin-bottom:2px;">✔ '+escapeHtml(correctText)+'</div>':'')+(!a.isRight&&a.chosen>=0?'<div style="font-size:11px;color:#FF2D78;">✘ You said: '+escapeHtml(chosenText)+'</div>':'')+(a.explanation?'<div style="font-size:11px;color:#475569;margin-top:4px;font-style:italic;">'+escapeHtml(a.explanation)+'</div>':'')+'</div></div></div>';
  }).join('');
  saveTriviaScore(triviaState.playerName,score,total);
  renderTriviaLeaderboard();
}

function saveTriviaScore(name,score,total){
  const key=triviaState.roundKey;
  const entry={name,score,total,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
  // Save to Firebase so everyone can see it
  if(window._fbSaveTriviaScore){
    window._fbSaveTriviaScore(key, entry).catch(()=>{});
  }
  // Also save locally as fallback
  let board=[];
  try{board=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){}
  board.push(entry);board.sort((a,b)=>b.score-a.score);board=board.slice(0,50);
  try{localStorage.setItem(key,JSON.stringify(board));}catch(e){}
}

function renderTriviaLeaderboard(){
  const key=getRoundKey(),r=getCurrentRound();
  const lbRound=document.getElementById('trivia-lb-round');
  if(lbRound)lbRound.textContent=r?r.label:'Today';
  const lb=document.getElementById('trivia-leaderboard');
  if(!lb)return;

  // Merge Firebase scores + local fallback
  let board=[];
  // From Firebase
  const fbData=window._triviaFirebaseScores;
  if(fbData&&fbData[key]){
    const entries=Object.values(fbData[key]);
    board=[...entries];
  }
  // Fallback: local storage
  if(!board.length){
    try{board=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){}
  }

  board.sort((a,b)=>b.score-a.score||a.time.localeCompare(b.time));

  const countEl=document.getElementById('trivia-lb-count');
  if(countEl)countEl.textContent=board.length?board.length+' player'+(board.length!==1?'s':''):'';

  if(!board.length){lb.innerHTML='<div style="text-align:center;font-family:\'Boogaloo\',cursive;font-size:14px;color:#334155;padding:18px 0;">No scores yet this round — be the first! 🎯</div>';return;}

  const medals=['🥇','🥈','🥉'];
  lb.innerHTML=board.map((e,i)=>{
    const isPerfect=e.score===e.total;
    const pct=Math.round(e.score/e.total*100);
    const barColor=pct===100?'#FFE500':pct>=80?'#39FF14':pct>=60?'#3b82f6':'#ef4444';
    return `<div class="trivia-lb-row" style="flex-wrap:wrap;gap:6px;padding:12px 8px;border-radius:12px;margin-bottom:4px;background:${isPerfect?'rgba(255,229,0,0.05)':'rgba(255,255,255,0.02)'};border:1px solid ${isPerfect?'rgba(255,229,0,0.15)':'rgba(255,255,255,0.04)'};">
      <span style="font-size:18px;width:28px;text-align:center;flex-shrink:0;">${medals[i]||'<span style="font-family:Orbitron,sans-serif;font-size:11px;font-weight:900;color:#475569;">#'+(i+1)+'</span>'}</span>
      <div style="flex:1;min-width:100px;">
        <div style="font-family:'Boogaloo',cursive;font-size:15px;color:white;">${escapeHtml(e.name)}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
          <div style="flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,0.06);">
            <div style="height:100%;border-radius:2px;background:${barColor};width:${pct}%;transition:width 0.5s;"></div>
          </div>
          <span style="font-size:10px;font-weight:900;color:#475569;">${pct}%</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-family:'Lilita One',cursive;font-size:20px;color:${isPerfect?'var(--neon-yellow)':'#64748b'};">${e.score}/${e.total}</div>
        <div style="font-size:9px;font-weight:700;color:#334155;text-transform:uppercase;">${e.time||''}</div>
      </div>
    </div>`;
  }).join('');
}

function resetTrivia(){
  clearInterval(triviaState.timer);
  document.getElementById('trivia-result-screen').classList.add('hidden');
  document.getElementById('trivia-question-screen').classList.add('hidden');
  document.getElementById('trivia-name-screen').classList.remove('hidden');
  document.getElementById('trivia-progress').style.width='0%';
}

// ============================================================
// LEAD ALERT SYSTEM
// ============================================================
const LEAD_ALERT_QUOTES = [
  // Original 20
  "Success is not final, failure is not fatal — it is the courage to continue that counts.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Don't watch the clock; do what it does. Keep going.",
  "Every transfer is proof you belong here. Keep pushing.",
  "Champions aren't made in the gym — they're made from the stuff they have inside them.",
  "You didn't come this far to only come this far.",
  "Small steps every day lead to big results. You're proving it right now.",
  "Your attitude determines your direction. Stay locked in.",
  "The top of the leaderboard has your name on it.",
  "Consistency is the secret weapon. You've got it.",
  "Momentum is everything — you just started yours.",
  "Winners find a way. You just proved you're one of them.",
  "One transfer closer to the goal. Don't stop now.",
  "The grind is real, and so is the reward. Keep dialing.",
  "Energy is contagious — you just raised the whole floor.",
  "Every call is a new opportunity. You just seized one.",
  "The best reps don't wait for motivation — they create it.",
  "You're not just sending leads, you're building your legacy.",
  "Results speak louder than words. Yours just did.",
  "Stay hungry. Stay focused. The board is watching.",

  // 100 Call Center Specific Quotes
  "Every dial is a chance to change someone's business forever.",
  "The best call center reps don't just talk — they listen, qualify, and deliver.",
  "Rejection is just redirection — the next call is your transfer.",
  "You're not just making calls, you're opening doors for business owners.",
  "A great rep turns a cold call into a warm transfer every time.",
  "The phone is your tool, your voice is your power — use both.",
  "Every no gets you closer to the yes that matters.",
  "Top reps don't hope for good calls — they create them.",
  "Your mindset before the dial determines the outcome after it.",
  "One qualified transfer can change a business owner's life — that's your job.",
  "The floor is only as good as its hardest workers — be one of them.",
  "Consistency beats talent when talent takes breaks.",
  "You have 60 seconds to earn their attention — make it count.",
  "A transfer on the board means a business got a lifeline today.",
  "Call center excellence is built rep by rep, lead by lead.",
  "The best time to make your next call is right now.",
  "Champions dial through the noise and deliver anyway.",
  "Your voice on that phone is the difference between a closed and open door.",
  "Quality calls + consistent effort = a leaderboard with your name at the top.",
  "Don't count your calls — make your calls count.",
  "Every qualified transfer is a win for you AND the business owner.",
  "The reps who dominate are the ones who don't wait for motivation.",
  "Your script is a guide — your confidence is the closer.",
  "Handle the objection, redirect the conversation, lock in the transfer.",
  "A rep who never gives up is a rep who always gets results.",
  "The floor rewards the ones who show up and push through.",
  "One more call could be your best transfer of the day.",
  "Skill gets you started, persistence keeps you going.",
  "The difference between good and great is one more dial.",
  "Every call is a new opportunity — don't carry the last one.",
  "Build your rhythm: qualify, connect, transfer, repeat.",
  "Your results today are a direct reflection of your effort right now.",
  "Stay in your lane, keep your energy up, and the board will reflect it.",
  "Objections are just questions waiting to be answered — answer them.",
  "The best reps treat every call like it's their most important one.",
  "You're building a skill set that pays off every single day.",
  "Speed matters — get to the transfer before they change their mind.",
  "Every rep who hit their goal today started with one lead.",
  "The harder you work now, the easier it gets later.",
  "Your transfers today are tomorrow's success stories.",
  "You're not just hitting numbers — you're helping businesses get funded.",
  "A focused rep on a good run is unstoppable — stay focused.",
  "When the call gets tough, that's when the real rep shows up.",
  "Trust your training, trust your script, trust your ability.",
  "Momentum is your best friend on the floor — protect it.",
  "Every transfer you send represents a business owner who needed you.",
  "The rep who qualifies fast and transfers clean always wins.",
  "Your energy through the phone is your greatest qualifying tool.",
  "Top performers don't take bad calls personally — they take the next one seriously.",
  "The leaderboard doesn't lie — effort shows up every time.",
  "Each transfer is proof that your work matters and your calls land.",
  "Stay sharp, stay focused, and the floor will notice.",
  "Great call center reps are made in the moments others give up.",
  "You earn your spot on the board one qualified transfer at a time.",
  "The call you're about to make could be your best one today.",
  "Real reps finish what they start — start a transfer, finish it.",
  "Your tone, your pace, your confidence — that's what gets the transfer.",
  "The best qualifying happens when you're genuinely curious about their business.",
  "Transfers stack up when you stop making excuses and start making calls.",
  "You belong on this floor — your results prove it every shift.",
  "Stay dialed in — the leads are there for the reps who want them.",
  "A great transfer starts with a great opener — nail it every time.",
  "You're one call away from turning this shift around.",
  "The reps who lead the board all share one trait: they never stopped.",
  "Your job is simple: qualify fast, transfer confidently, reset, repeat.",
  "When you pick up that phone, bring everything you've got.",
  "The floor has energy — yours is the one that sets the pace.",
  "Business owners need funding. You connect them. That's meaningful work.",
  "Top of the leaderboard isn't luck — it's one transfer at a time.",
  "Don't dial just to dial — dial with purpose and watch your numbers rise.",
  "Confidence on the call starts with believing in what you're offering.",
  "You're not interrupting their day — you're potentially changing their business.",
  "A rep with great energy keeps prospects on the line and gets the transfer.",
  "The fastest way to improve your numbers is to improve your next call.",
  "Work smart, work fast, and the leaderboard takes care of itself.",
  "Your best call today is the one you're about to make.",
  "When the call gets hard, lean into your training — it works.",
  "One focused hour on this floor can change your whole day.",
  "Make the call. Qualify the lead. Send the transfer. That's the formula.",
  "The reps who hit their numbers do one thing differently — they don't stop.",
  "Your commitment to quality transfers makes this floor better.",
  "Dial with intention, qualify with skill, transfer with confidence.",
  "Every single call has potential — you decide how much.",
  "The clock is running. Your competition is dialing. Are you?",
  "Top reps know this: every objection handled is a transfer earned.",
  "One more transfer and you're telling the whole floor what you're made of.",
  "Your attitude on this call will determine the outcome — choose well.",
  "When you send that transfer, someone's business just got a real shot.",
  "Keep showing up, keep dialing, keep delivering — that's how legends are built.",
  "Real call center grind looks like: dial, qualify, transfer, repeat. All day.",
  "Don't let one hard call slow down ten great ones.",
  "The rep who recovers fastest is always the one who leads the board.",
  "Your confidence is your most powerful qualifying tool — use it.",
  "Every transfer you lock in today is a win you earned with your skill.",
  "Reps who dominate know this: momentum beats motivation every time.",
  "Make your next call your best call — it's always possible.",
  "This floor is full of opportunity — and you're right in the middle of it.",
  "You don't need a perfect day. You need consistent transfers. Go get them.",
  // 30 Famous Quotes
  "The secret of getting ahead is getting started. — Mark Twain",
  "It always seems impossible until it's done. — Nelson Mandela",
  "Don't count the days, make the days count. — Muhammad Ali",
  "Hard work beats talent when talent doesn't work hard. — Tim Notke",
  "The only way to do great work is to love what you do. — Steve Jobs",
  "I find that the harder I work, the more luck I seem to have. — Thomas Jefferson",
  "You miss 100% of the shots you don't take. — Wayne Gretzky",
  "Whether you think you can or you think you can't, you're right. — Henry Ford",
  "The difference between ordinary and extraordinary is that little extra. — Jimmy Johnson",
  "Success usually comes to those who are too busy to be looking for it. — Henry David Thoreau",
  "Opportunities don't happen. You create them. — Chris Grosser",
  "Don't wish it were easier. Wish you were better. — Jim Rohn",
  "The only place where success comes before work is in the dictionary. — Vidal Sassoon",
  "If you are not willing to risk the usual, you will have to settle for the ordinary. — Jim Rohn",
  "The man who moves a mountain begins by carrying away small stones. — Confucius",
  "It's not whether you get knocked down, it's whether you get up. — Vince Lombardi",
  "Do what you can, with what you have, where you are. — Theodore Roosevelt",
  "Winning isn't everything, but wanting to win is. — Vince Lombardi",
  "The more I practice, the luckier I get. — Gary Player",
  "I've failed over and over — and that is why I succeed. — Michael Jordan",
  "Great things are done by a series of small things brought together. — Vincent Van Gogh",
  "Success is walking from failure to failure with no loss of enthusiasm. — Winston Churchill",
  "You don't have to be great to start, but you have to start to be great. — Zig Ziglar",
  "Believe you can and you're halfway there. — Theodore Roosevelt",
  "The future belongs to those who believe in the beauty of their dreams. — Eleanor Roosevelt",
  "Go as far as you can see; when you get there, you'll be able to see further. — Thomas Carlyle",
  "I never dreamed about success. I worked for it. — Estée Lauder",
  "The only limit to our realization of tomorrow is our doubts of today. — Franklin D. Roosevelt",
  "Excellence is not a destination but a continuous journey that never ends. — Brian Tracy",
  "Your time is limited, so don't waste it living someone else's life. — Steve Jobs"
];

const LEAD_ALERT_MESSAGES = [
  // Original 15
  "You're on fire! That transfer just hit the board! 🔥",
  "That's what we're talking about! Keep the energy up! ⚡",
  "Another one! You're making it look easy! 💪",
  "Locked in and getting results! That's the spirit! 🎯",
  "The leaderboard just noticed you. Keep climbing! 🚀",
  "That's a transfer! You're proving why you belong here! 🏆",
  "Yes! The hustle is paying off! Don't slow down! 💥",
  "Look at you go! Another lead sent — beast mode activated! 🦁",
  "Transfer confirmed! You're in the zone right now! ⚡",
  "That's your name on the board! Own it! 🌟",
  "One more and the floor is taking notes! Keep pushing! 🔥",
  "Dialed in and delivering! That's how it's done! 💎",
  "You just set the pace! Now let's keep it! 🏃",
  "Built different! Another transfer, another step to the top! 👑",
  "That lead is on its way! You're unstoppable right now! 🚀",
  // 50 New Messages
  "Another transfer locked in — you make this look too easy! 😤",
  "The grind never stops and neither do you! Keep going! 🔄",
  "Stack it up! Every lead is money in the bank! 💰",
  "You just moved up the board — keep that energy! 📈",
  "That's a certified banger! Another lead secured! 🎯",
  "Nobody on the floor right now harder than you! 👊",
  "Transfer after transfer — this is your day! ☀️",
  "You're not stopping and neither is that leaderboard! 🏆",
  "Ice cold under pressure and still delivering! 🧊",
  "Straight up locked in! That's elite performance right there! 🔐",
  "Another one bites the dust — lead confirmed! 😎",
  "You just made it look effortless — transfer on the board! ✨",
  "The floor is watching and you're giving them a show! 🎭",
  "Don't stop now — the board has your back! 📋",
  "You just raised the bar for everyone on the floor! 📊",
  "Transfer sent — now go get the next one! 🔁",
  "Nothing but results — that's your brand today! 💼",
  "You're running this shift right now! Pure dominance! 👑",
  "Another one down — you're in full control! 🎮",
  "That transfer just elevated your whole day! Keep stacking! 🏗️",
  "Focused, fearless, and delivering — that's you right now! 💡",
  "The phones don't scare you and the board shows it! 📞",
  "Drop after drop — you're flooding the board! 🌊",
  "That's elite rep behavior! Transfer confirmed! 🦅",
  "Built for this moment — and you just proved it! 💪",
  "Every dial is a door and you just walked through another one! 🚪",
  "You're not chasing results — you're creating them! 🛠️",
  "That's the stuff legends are made of! Keep dialing! 📖",
  "One more notch on the belt — transfer secured! 🥊",
  "You just turned a call into cash — that's the skill! 💸",
  "Relentless. Consistent. You. Keep it rolling! ⚙️",
  "Another lead hits — the floor is feeling your energy! ⚡",
  "That's called professionalism — transfer on the board! 🎩",
  "You make it look easy but we know the work behind it! 🙌",
  "Locked, loaded, and delivering — that's your vibe today! 🎯",
  "The hustle is louder than words — board update proves it! 📣",
  "You just added to your legacy — lead confirmed! 🏛️",
  "Not slowing down, not looking back — lead secured! 🏎️",
  "The clock is ticking and you're making every second count! ⏱️",
  "Rep of the day energy right here — keep pushing! 🌟",
  "You just made the leaderboard sweat — great work! 😤",
  "That call had your name written all over it! 🖊️",
  "Clutch when it counts — another transfer in! 🎯",
  "Zero hesitation, full execution — that's a transfer! ✅",
  "Another proof point that you belong at the top! 🔝",
  "You're not on a roll — you ARE the roll! 🎲",
  "Smooth operator — that transfer landed perfectly! 🎶",
  "The scoreboard agrees: you're having a great day! 🗓️",
  // 100 Call Center Specific - Regular Lead Messages
  "Dialed in and delivered — that transfer is officially on the board! 📞",
  "You just turned a conversation into a transfer — that's the skill! 🎯",
  "Phone down, lead sent — now reset and go get another one! 🔄",
  "That's what qualifying looks like! Transfer locked and loaded! ✅",
  "Another business owner connected — because of YOU! 💼",
  "You handled the objection AND got the transfer — that's elite! 🏆",
  "Transfer sent! The floor just felt that energy! ⚡",
  "That's how you work a call from open to close — beautiful! 🎶",
  "The script worked because YOU worked it! Transfer confirmed! 📋",
  "Objection handled, redirect done, transfer sent — textbook! 📖",
  "You didn't just dial — you delivered. Lead on the board! 🚀",
  "That business owner is getting funded because you stayed on the call! 💰",
  "Clean qualifier, smooth transfer — the board has your name! 🌟",
  "You just showed the floor what a great call looks like! 👀",
  "Another one sent! Your phone is your weapon and you're using it! ⚔️",
  "That transfer just wrote your name in today's story — keep going! ✍️",
  "Call center excellence — transfer confirmed, rep on fire! 🔥",
  "You didn't let go of that call and the lead proves it! 💪",
  "The leaderboard is loving you right now — keep feeding it! 📈",
  "From dial to transfer in record time — that's your speed! ⏱️",
  "Every time you send a transfer, a business gets a real opportunity! 🏢",
  "You stayed calm, you qualified, you transferred — that's the formula! 🧪",
  "Rep on a tear right now! Transfer after transfer! 🌊",
  "You made that call look easy — it's because you're good at this! 😎",
  "Transfer confirmed! The floor is taking notes on how you do it! 📝",
  "You qualify fast and transfer clean — that's a top rep right there! 👑",
  "Another lead hits! Your energy through the phone is unmatched! 📡",
  "You turned skepticism into interest and interest into a transfer! 🔄",
  "The board doesn't update itself — you just did it again! 💻",
  "That call had everything: rapport, qualification, and a clean close! 🎯",
  "Rep who doesn't stop = board that doesn't slow down! Keep it rolling! 🎲",
  "You just proved why you're on this floor — transfer locked in! 🔐",
  "Another transfer in! The business owners on your list are lucky! 🍀",
  "Zero hesitation, full commitment — that transfer landed perfectly! 🎯",
  "The phones are ringing in your favor today — answer that energy! 📲",
  "Transfer sent to the advisors — your job done, now go get the next one! ✔️",
  "You read that call perfectly and delivered the transfer! Genius! 🧠",
  "Your pace on the floor is setting the standard today! 🏃",
  "That rebuttal was smooth and the transfer was smoother! 🌊",
  "Another notch! The board is proof your effort isn't going unnoticed! 🗓️",
  "You pushed through and sent the transfer — that's what champions do! 🏅",
  "Lead logged! The floor is cheering for you right now! 🎉",
  "That call started cold and ended hot — you made that happen! 🔥",
  "You didn't rush the call and you didn't drag it — perfect execution! ⚖️",
  "Transfer confirmed! Your training is showing up in real time! 📚",
  "Another business owner is one step closer to funding because of you! 🏦",
  "You got the transfer without breaking stride — absolute pro! 👔",
  "The qualifying was tight and the transfer was right — good work! ✅",
  "Your consistency on the floor is what top reps are built on! 🏗️",
  "Transfer hit the board — your name is echoing through the floor! 📣"
];

const FIRST_LEAD_MESSAGES = [
  "First one on the board today — let's gooo! 🏆",
  "Day one, lead one — the grind has officially started! 🔥",
  "First blood of the day! Who's next?! 🩸",
  "Opening the scoreboard! That's how you start a shift! 🎯",
  "First transfer of the day is always the sweetest! 💛",
  "Zero to one — the hardest step done! Keep stacking! 🚀",
  "First one in the bag! Now don't stop there! 💪",
  "The board just woke up! First lead of the day secured! ⚡",
  "Day started RIGHT! First transfer is on the books! 📖",
  "First lead of the day — the momentum is yours now! 🌟",
  "Off zero! That's all it takes to get going! 🏃",
  "First one hits different! Now build on it! 💥",
  "Up and running! First lead locked in — don't look back! 👑",
  "One on the day! The rest of the floor just got put on notice! 👀",
  "First transfer secured! You just set the tone for today! 🎶",
  "Day started! First lead in — now chase the next one! 🦁",
  "Zero to hero — first lead of the day belongs to you! 🌠",
  "First one of the day! The grind is already paying off! 💎",
  "Early lead on the board — you're already ahead of yesterday! 📈",
  "First one down, let's see how many more you can stack today! 🃏",
  "The scoreboard is alive! First transfer of the shift is yours! ⚡",
  "First lead secured — you just told the day who's boss! 😤",
  "Off to the races! First one in the books! 🏁",
  "First transfer of the day — the energy is set, now match it! 🔋",
  "Day one lead secured! You didn't come here to sit still! 🚀",
  "First of many today — that's the mindset, keep it locked! 🔒",
  "Board is open! First lead just dropped — who's adding theirs?! 🙌",
  "One on the day! Small start, big finish — let's go! 🌅",
  "First lead = first step to the top today. Keep climbing! 🧗",
  "You broke the ice! First transfer is done — now flood the board! 🌊",
  // 100 Call Center Specific - First Lead Messages
  "First transfer of the day — you broke the seal! Now stack them! 🔓",
  "Day officially started! First lead on the board from YOU! 📞",
  "First dial to first transfer — that's how you open a shift! 🌅",
  "You're on the board before most people are even warmed up! ⚡",
  "First transfer in — the floor just woke up and it's because of you! 🔔",
  "Day one lead secured! This shift just got real! 💼",
  "First qualifier of the day goes to you — keep that energy alive! 🏆",
  "You didn't let the morning slow you down — first transfer confirmed! ☀️",
  "Off zero! First lead of the day belongs to the rep who didn't wait! 🏃",
  "First transfer sent — you just set the pace for the whole floor! 🎯",
  "The scoreboard just opened and your name is already on it! 📋",
  "You couldn't wait to get started — first transfer proves it! 🔥",
  "First one in is the hardest — and you just made it look easy! 💪",
  "That first lead of the day changes everything — now don't stop! 📈",
  "You came here to work and the board already knows it — first lead in! 🎉",
  "First transfer of the shift goes to the rep who picks up and dials first! 📲",
  "Zero to one — you just crossed the hardest line of the day! 🚧",
  "First lead secured! The rest of the floor is watching now! 👀",
  "You started your day the right way — first transfer confirmed! ✅",
  "First qualifier of the shift! Now double it, then triple it! 🔢",
  "First transfer of the day logged! Your shift has officially begun! 🕐",
  "That first lead always feels good — remember this feeling all day! 💡",
  "First one on the board and the shift isn't even warmed up yet! 🌡️",
  "You're already ahead of where you were yesterday — first lead in! 📊",
  "First transfer of the day means momentum is officially yours now! 🏄",
  "Board opened! First name up? Yours. Now let's go! 🏁",
  "You dialed, you qualified, you transferred — all before most reps settle in! ⏰",
  "First transfer in the books — now your only job is to add more! ➕",
  "You started strong and that's exactly how champions get built! 💎",
  "First lead of the day is yours — now make it the first of many! 🌟",
  "First transfer confirmed! The advisors love hearing your name already! 📡",
  "You opened the board — now let's fill it! First lead done! 🖊️",
  "Starting the day right takes discipline — you just showed you have it! 🧠",
  "Your first transfer today is proof you came here ready to work! 🔑",
  "First transfer sent — you just set the tone for your entire shift! 🎶",
  "Zero to hero in record time — first lead locked and confirmed! 🦸",
  "First transfer of the day! Your call started someone's funding journey! 🏦",
  "The board has a new name up first — and it's yours! Own it! 👑",
  "First one down before the shift gets going — that's called hunger! 🍽️",
  "You didn't need a warmup — you came ready! First transfer in! 💥",
  "First transfer confirmed! The floor energy just shifted in your direction! 🌬️",
  "You're always the rep who starts fast — and today proves it again! 🚀",
  "First lead of the day goes to the rep who doesn't hit snooze on their goals! ⏰",
  "One transfer down, the rest of the day to build on it — let's go! 🧱",
  "First transfer in = you just told today who's running things! 😤",
  "The board is live and you put the first mark on it — beautiful! 🖼️",
  "First lead secured! This is going to be a good shift — keep going! 🌈",
  "You didn't wait for the floor to heat up — you heated it yourself! 🌡️",
  "First transfer of the day confirmed! Your advisors are already impressed! 🎖️",
  "First lead in and the day is young — imagine where this ends up! 🔭"
];


const TWO_LEAD_MESSAGES = [
  "TWO on the board! You're not slowing down — double confirmed! 🔥🔥",
  "2 transfers in! You just told the floor you mean business today! 💼",
  "Back to back! Second transfer locked — the rhythm is yours now! 🎶",
  "Two and climbing! The advisors are loving your name right now! 📞",
  "Second transfer of the day — you're already in beast mode! 🦁",
  "2 leads down and the shift is wide open! Keep stacking! 📈",
  "Double digits on the way — second transfer confirmed! ✌️",
  "Two transfers! You're building something special today! 🏗️",
  "Second one in! You went from first lead to momentum — fast! ⚡",
  "2 on the board! You're showing the floor how it's done! 👀",
  "Back-to-back transfers — that's the mark of a rep locked in! 🔐",
  "Two and going! The leaderboard is paying attention to you! 📋",
  "Second transfer secured! The floor has noticed your pace! 👁️",
  "2 leads confirmed! You're officially on a run — don't break it! 🏃",
  "Double transfer day! You came here to work and work you did! 💪",
  "Two on the board — your shift is building beautifully! 🌅",
  "Second one sent! Your confidence on the call is showing! 🎯",
  "2 transfers and climbing — the advisors know your name today! 🏆",
  "Back-to-back! You found your rhythm and you're not letting go! 🎵",
  "Two leads in — you're showing everyone what consistent looks like! 🔄"
];

const THREE_PLUS_LEAD_MESSAGES = [
  "THREE or more! You're officially dominating this shift! 👑",
  "3+ transfers and you're not done yet! This is your floor today! 🏆",
  "Multiple transfers locked in — you're running the board right now! 📊",
  "3 or more leads! Elite rep behavior — pure and simple! 💎",
  "You're not just on the board — you're leading it! Keep going! 🥇",
  "Three-plus and counting! The floor is watching a master at work! 🎓",
  "Multiple transfers in! You've moved from rep to LEGEND today! 🌟",
  "3+ on the board! Call center greatness is happening right now! 🔥",
  "You're stacking transfers like a pro — because you ARE one! 💼",
  "Three or more leads today? The leaderboard has your name LOUD! 📣",
  "Multiple transfers locked! You came, you dialed, you conquered! ⚔️",
  "3+ confirmed! You've set the pace for the entire floor today! 🏁",
  "You're in elite territory now — three or more transfers and climbing! 🧗",
  "Multiple transfers on the board — your work ethic is unmatched! 🔋",
  "3 or more leads! The advisors can't get enough of your name today! 📡",
  "You're putting on a clinic! Three-plus transfers and still going! 🎪",
  "Three or more! You turned today's shift into something memorable! 🎬",
  "Multiple transfers in! You've earned every single one with skill! 🏅",
  "3+ on the board — you belong at the top and you're proving it! ⬆️",
  "Three-plus transfers! The floor knows, the board shows, you GLOW! ✨"
];

let prevLeadCounts = {};
let leadAlertInitialized = false;

function getFirstName(fullName) {
  if (!fullName) return 'Rep';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1 && parts[0].length <= 3 && /^[A-Z]+$/.test(parts[0])) return parts[1];
  return parts[0];
}

function checkLeadAlerts(newAgents) {
  if (!newAgents || !newAgents.length) return;

  // Use providenceTracker for PR reps only
  const tracker = (newAgents[0] && newAgents[0].providenceTracker) || {};
  let snapshot = Object.keys(tracker).length ? tracker : {};
  if (!Object.keys(snapshot).length) {
    newAgents.forEach(a => {
      if ((a.team || getTeam(a.name)) === 'PR') snapshot[a.name] = a.dailyLeads || 0;
    });
  }
  if (!Object.keys(snapshot).length) return;

  // First load — store silently, no alerts
  if (!leadAlertInitialized) {
    Object.entries(snapshot).forEach(([n, c]) => { prevLeadCounts[n] = c; });
    leadAlertInitialized = true;
    return;
  }

  // Find reps with new leads
  const newReps = [];
  Object.entries(snapshot).forEach(([name, count]) => {
    const c = Number(count) || 0;
    const prev = Number(prevLeadCounts[name]) || 0;
    if (c > prev) newReps.push({ name, count: c, isFirst: prev === 0 });
    prevLeadCounts[name] = c;
  });
  if (!newReps.length) return;

  if (newReps.length === 1) {
    const { name, count, isFirst } = newReps[0];
    const firstName = getFirstName(name);
    const quote = LEAD_ALERT_QUOTES[Math.floor(Math.random() * LEAD_ALERT_QUOTES.length)];
    if (isFirst) {
      const msg = FIRST_LEAD_MESSAGES[Math.floor(Math.random() * FIRST_LEAD_MESSAGES.length)];
      _renderAlert({ icon: '🥇', name: firstName + ' is on the board!', msg, quote, firstLead: true });
    } else if (count === 2) {
      const msg = TWO_LEAD_MESSAGES[Math.floor(Math.random() * TWO_LEAD_MESSAGES.length)];
      _renderAlert({ icon: '✌️', name: firstName + ' with 2 leads!', msg, quote, firstLead: false });
    } else if (count >= 3 && count <= 5) {
      const msg = THREE_PLUS_LEAD_MESSAGES[Math.floor(Math.random() * THREE_PLUS_LEAD_MESSAGES.length)];
      _renderAlert({ icon: '🔥', name: firstName + ' — ' + count + ' leads today!', msg, quote, firstLead: false });
    } else if (count >= 6 && count < 12) {
      const msg = THREE_PLUS_LEAD_MESSAGES[Math.floor(Math.random() * THREE_PLUS_LEAD_MESSAGES.length)];
      _renderAlert({ icon: '💥', name: firstName + ' is on FIRE — ' + count + ' leads!', msg, quote, firstLead: false });
    } else if (count >= 12) {
      const msg = THREE_PLUS_LEAD_MESSAGES[Math.floor(Math.random() * THREE_PLUS_LEAD_MESSAGES.length)];
      _renderAlert({ icon: '👑', name: firstName + ' — MASTER STATUS! ' + count + ' leads!', msg, quote, firstLead: true });
    } else {
      const msg = LEAD_ALERT_MESSAGES[Math.floor(Math.random() * LEAD_ALERT_MESSAGES.length)];
      _renderAlert({ icon: '🔥', name: 'Good Job, ' + firstName + '!', msg, quote, firstLead: false });
    }
  } else {
    const hasFirstLeads = newReps.some(r => r.isFirst);
    const names = newReps.map(r => getFirstName(r.name));
    const nameStr = names.length === 2 ? names[0] + ' & ' + names[1]
      : names.slice(0,-1).join(', ') + ' & ' + names[names.length-1];
    const quote = LEAD_ALERT_QUOTES[Math.floor(Math.random() * LEAD_ALERT_QUOTES.length)];
    if (hasFirstLeads) {
      _renderAlert({ icon: '🥇', name: nameStr + ' hit the board!', msg: "Multiple reps getting their first lead of the day — the floor is heating up! 🔥", quote, firstLead: true });
    } else {
      _renderAlert({ icon: '⚡', name: nameStr + '!', msg: "Look at the team go! Everyone's putting up numbers! 💪", quote, firstLead: false });
    }
  }
}

function _renderAlert({icon, name, msg, quote, firstLead=false}) {
  const banner = document.getElementById('lead-alert-banner');
  const inner = banner.querySelector('.lab-inner');
  if (firstLead) { inner.classList.add('first-lead'); } else { inner.classList.remove('first-lead'); }
  document.querySelector('.lab-icon').textContent = icon;
  document.getElementById('lab-text').innerHTML =
    escapeHtml(name) + '<span>' + escapeHtml(msg) + ' — ❭' + escapeHtml(quote) + '❮</span>';
  banner.classList.add('show');
  document.body.style.paddingTop = '72px';
  startTabBlink(icon + ' ' + name + (firstLead ? ' — First Lead Today!' : ' — New Lead!'));
}

function dismissLeadAlert() {
  document.getElementById('lead-alert-banner').classList.remove('show');
  document.body.style.paddingTop = '';
  stopTabBlink();
}

updateDashboard();
setInterval(updateDashboard,5000);

// ===== BROADCAST SYSTEM =====
const BC_ADMIN_PASSWORD = 'bizadmin2025'; // 🔑 Change this to your secret password
let bcAdminUnlocked = false;
let bcDismissedTs = 0;
let titleTapCount = 0;
let titleTapTimer = null;

function handleTitleTap(){
  titleTapCount++;
  clearTimeout(titleTapTimer);
  titleTapTimer = setTimeout(()=>{ titleTapCount=0; }, 800);
  if(titleTapCount >= 5){
    titleTapCount = 0;
    clearTimeout(titleTapTimer);
    // Unlock admin silently — no password needed
    if(!bcAdminUnlocked){
      bcAdminUnlocked = true;
      const floatBtn = document.getElementById('bc-float-btn');
      floatBtn.classList.add('unlocked');
      floatBtn.style.animation = 'bcBtnAppear 0.4s cubic-bezier(0.34,1.56,0.64,1) both';
      // Add preview button if not already there
      const panel = document.getElementById('bc-panel');
      if(!document.getElementById('bc-tp-preview-btn')){
        const btn = document.createElement('button');
        btn.id='bc-tp-preview-btn';
        btn.className='bc-clear-btn';
        btn.style.cssText='margin-top:6px;color:#FFD700;border-color:rgba(255,215,0,0.25);';
        btn.innerHTML='👑 Preview Top Performers';
        btn.onclick=()=>showTopPerformerPopup(true);
        panel.appendChild(btn);
      }
    }
    toggleBcPanel();
  }
}

function checkBcPassword(){
  const val = document.getElementById('bc-pw-input').value;
  const errEl = document.getElementById('bc-pw-error');
  if(val === BC_ADMIN_PASSWORD){
    bcAdminUnlocked = true;
    document.getElementById('bc-login-modal').classList.add('hidden');
    document.getElementById('bc-pw-input').value = '';
    errEl.textContent = '';
    const floatBtn = document.getElementById('bc-float-btn');
    floatBtn.classList.add('unlocked');
    floatBtn.style.animation = 'bcBtnAppear 0.4s cubic-bezier(0.34,1.56,0.64,1) both';
    const panel = document.getElementById('bc-panel');
    panel.classList.add('show');
    floatBtn.textContent = '✕';
    setTimeout(()=>document.getElementById('bc-input').focus(),100);
    if(!document.getElementById('bc-tp-preview-btn')){
      const btn = document.createElement('button');
      btn.id='bc-tp-preview-btn';
      btn.className='bc-clear-btn';
      btn.style.cssText='margin-top:6px;color:#FFD700;border-color:rgba(255,215,0,0.25);';
      btn.innerHTML='👑 Preview Top Performers';
      btn.onclick=()=>showTopPerformerPopup(true);
      panel.appendChild(btn);
    }
  } else {
    errEl.textContent = 'Incorrect password.';
    const inp = document.getElementById('bc-pw-input');
    inp.classList.add('error');
    setTimeout(()=>inp.classList.remove('error'), 500);
    setTimeout(()=>{ errEl.textContent=''; }, 2000);
  }
}

function toggleBcPanel(){
  const panel = document.getElementById('bc-panel');
  const floatBtn = document.getElementById('bc-float-btn');
  if(panel.classList.contains('show')){
    panel.classList.remove('show');
    floatBtn.textContent = '📣';
    floatBtn.style.transform = '';
  } else {
    panel.classList.add('show');
    floatBtn.textContent = '✕';
    setTimeout(()=>document.getElementById('bc-input').focus(),100);
  }
}

async function sendBroadcast(){
  const msg = document.getElementById('bc-input').value.trim();
  const statusEl = document.getElementById('bc-status');
  if(!msg){ statusEl.textContent='Enter a message first!'; statusEl.className='bc-status err'; return; }
  if(!window._fbSendBroadcast){
    statusEl.textContent='Firebase not configured yet!';
    statusEl.className='bc-status err';
    // Fallback: show locally for testing
    showBroadcastBar(msg);
    return;
  }
  try {
    statusEl.textContent='Sending...'; statusEl.className='bc-status';
    await window._fbSendBroadcast(msg);
    statusEl.textContent='✓ Sent to everyone!'; statusEl.className='bc-status ok';
    setTimeout(()=>{ statusEl.textContent=''; statusEl.className='bc-status'; }, 3000);
  } catch(e){
    statusEl.textContent='Error: '+e.message; statusEl.className='bc-status err';
  }
}

async function clearBroadcast(){
  const statusEl = document.getElementById('bc-status');
  if(!window._fbClearBroadcast){
    hideBroadcastBar();
    return;
  }
  try {
    await window._fbClearBroadcast();
    statusEl.textContent='✓ Message cleared!'; statusEl.className='bc-status ok';
    setTimeout(()=>{ statusEl.textContent=''; statusEl.className='bc-status'; }, 2000);
  } catch(e){
    statusEl.textContent='Error: '+e.message; statusEl.className='bc-status err';
  }
}

function showBroadcastBar(msg){
  const bar = document.getElementById('broadcast-bar');
  document.getElementById('bc-message-text').textContent = msg;
  bar.classList.add('show');
  document.body.style.paddingTop = (parseInt(getComputedStyle(document.body).paddingTop)||16) + 'px';
  startTabBlink('📢 New Message!');
}

function hideBroadcastBar(){
  const bar = document.getElementById('broadcast-bar');
  bar.classList.remove('show');
  stopTabBlink();
}

function dismissBroadcast(){
  hideBroadcastBar();
  bcDismissedTs = Date.now();
}

// ===== TAB BLINK SYSTEM =====
let _tabBlinkInterval = null;
const _originalTitle = document.title;

function startTabBlink(alertTitle, stopOnFocus = true) {
  stopTabBlink();
  let toggle = true;
  _tabBlinkInterval = setInterval(() => {
    document.title = toggle ? alertTitle : _originalTitle;
    toggle = !toggle;
  }, 900);
  // Only stop on focus for broadcast/trivia — NOT for lead alerts
  if (stopOnFocus) {
    window.addEventListener('focus', stopTabBlink, { once: true });
  }
}

function stopTabBlink() {
  if (_tabBlinkInterval) { clearInterval(_tabBlinkInterval); _tabBlinkInterval = null; }
  document.title = _originalTitle;
}

// ===== TOP PERFORMER AUTO-POPUP SYSTEM =====
let tpConfettiParticles = [];
let tpConfettiFrame = null;
let tpLastShownHour = -1;

function getGuyanaHour() {
  return parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/Guyana', hour: 'numeric', hour12: false }));
}
function getGuyanaMinute() {
  return parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/Guyana', minute: 'numeric' }));
}

function checkTopPerformerSchedule() {
  const hour = getGuyanaHour();
  const min = getGuyanaMinute();
  // Fire every 2 hours from 12pm to 8pm: 12, 14, 16, 18, 20
  const triggerHours = [12, 14, 16, 18, 20];
  if (triggerHours.includes(hour) && min === 0 && tpLastShownHour !== hour) {
    tpLastShownHour = hour;
    showTopPerformerPopup();
  }
}

function showTopPerformerPopup(manualTrigger = false, daySnap = null) {
  let sorted, titleLabel;

  if (daySnap) {
    // Previous day mode — top 5 only
    sorted = [...(daySnap.agents || [])]
      .filter(a => a.name && (a.leads || 0) > 0)
      .sort((a, b) => (b.leads || 0) - (a.leads || 0))
      .slice(0, 5);
    titleLabel = `🏆 ${daySnap.dayName || 'Previous Day'} — Top 5`;
  } else {
    // Live daily mode
    sorted = [...agents]
      .filter(a => a.name && (a.dailyLeads || 0) > 0)
      .sort((a, b) => (b.dailyLeads || 0) - (a.dailyLeads || 0));
    if (!sorted.length && !manualTrigger) return;
    const hour = getGuyanaHour();
    const period = hour < 12 ? 'Morning' : hour < 16 ? 'Afternoon' : 'Evening';
    titleLabel = `🔥 ${period} Standings`;
  }

  document.getElementById('tp-time-label').textContent = titleLabel;

  const medals = ['🥇','🥈','🥉'];
  const rowColors = [
    'background:linear-gradient(90deg,rgba(255,215,0,0.12),rgba(255,140,0,0.08));border:1px solid rgba(255,215,0,0.25);',
    'background:linear-gradient(90deg,rgba(192,192,192,0.1),rgba(192,192,192,0.04));border:1px solid rgba(192,192,192,0.2);',
    'background:linear-gradient(90deg,rgba(205,127,50,0.1),rgba(205,127,50,0.04));border:1px solid rgba(205,127,50,0.2);',
  ];
  const scoreColors = ['#FFD700','#C0C0C0','#CD7F32'];

  const list = document.getElementById('tp-list');
  const display = daySnap ? sorted : sorted.slice(0, 10);

  if (!display.length) {
    list.innerHTML = '<div style="text-align:center;padding:30px;font-family:\'Boogaloo\',cursive;font-size:16px;color:#475569;">No leads recorded yet — keep pushing! 💪</div>';
  } else {
    list.innerHTML = display.map((a, i) => {
      const style = rowColors[i] || 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);';
      const color = scoreColors[i] || '#64748b';
      const medal = medals[i] || `<span style="font-family:Orbitron,sans-serif;font-size:12px;font-weight:900;color:#475569;">#${i+1}</span>`;
      const leads = daySnap ? (a.leads || 0) : (a.dailyLeads || 0);
      return `<div class="tp-row" style="${style}animation-delay:${i*0.08}s;">
        <div class="tp-rank">${medal}</div>
        <div class="tp-name">${escapeHtml(a.name)}</div>
        <div style="text-align:right;">
          <div class="tp-score" style="color:${color};">${leads}</div>
          <div class="tp-label">leads</div>
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById('top-performer-modal').classList.remove('hidden');
  startTpConfetti();
  startTabBlink('👑 Top Performers!');
}

function closeTopPerformer() {
  document.getElementById('top-performer-modal').classList.add('hidden');
  stopTpConfetti();
  stopTabBlink();
}

function startTpConfetti() {
  const canvas = document.getElementById('tp-confetti-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#FFD700','#FFA500','#FF6B00','#FF2D78','#00F5FF','#39FF14','#a855f7','#3b82f6'];
  tpConfettiParticles = Array.from({length:120},()=>({
    x:Math.random()*canvas.width, y:Math.random()*canvas.height - canvas.height,
    r:Math.random()*7+3, color:colors[Math.floor(Math.random()*colors.length)],
    tiltAngle:0, tiltSpeed:Math.random()*0.1+0.05,
    speed:Math.random()*3+1.5, opacity:Math.random()*0.6+0.4,
    shape:Math.random()>0.5?'rect':'circle'
  }));
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    tpConfettiParticles.forEach(p=>{
      ctx.save();ctx.globalAlpha=p.opacity;ctx.fillStyle=p.color;
      ctx.translate(p.x,p.y);ctx.rotate(p.tiltAngle);
      if(p.shape==='rect'){ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*2);}
      else{ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      p.y+=p.speed;p.tiltAngle+=p.tiltSpeed;p.x+=Math.sin(p.tiltAngle)*1.5;
      if(p.y>canvas.height){p.y=-10;p.x=Math.random()*canvas.width;}
    });
    tpConfettiFrame=requestAnimationFrame(draw);
  }
  draw();
  setTimeout(stopTpConfetti,8000);
}

function stopTpConfetti(){
  if(tpConfettiFrame){cancelAnimationFrame(tpConfettiFrame);tpConfettiFrame=null;}
  const canvas=document.getElementById('tp-confetti-canvas');
  canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
}

// Check every minute
setInterval(checkTopPerformerSchedule, 60000);
