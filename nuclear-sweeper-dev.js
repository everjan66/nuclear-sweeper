const devStyle=document.createElement('style');
devStyle.textContent=`
#dev-toggle{position:fixed;z-index:8;top:12px;left:50%;transform:translateX(-50%);background:#ffcb66;color:#171309;border:0;border-radius:5px;padding:9px 14px;font:700 12px monospace;cursor:pointer}
#dev-panel{display:none;position:fixed;inset:0;z-index:9;overflow:auto;background:#0b0e08f8;padding:20px;box-sizing:border-box;color:#d7e3c2}
#dev-panel .dev-wrap{max-width:1100px;margin:auto}#dev-panel header{display:flex;gap:12px;align-items:center;justify-content:space-between}#dev-panel h2{color:#ffcb66}#dev-panel h3{margin:0 0 12px;font-size:14px;color:#ffcb66}
#dev-panel .dev-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:12px;margin:16px 0}
#dev-panel section{padding:16px;border:1px solid #465036;border-radius:8px;background:#171e12}#dev-panel button,#dev-panel input,#dev-panel select{font:inherit;border:1px solid #566245;border-radius:4px;padding:7px;color:inherit;background:#27311f}#dev-panel button{cursor:pointer}#dev-panel button:hover{border-color:#ffcb66}#dev-panel button:disabled{opacity:.4;cursor:default}
#dev-panel .dev-actions{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}#dev-panel label{display:flex;align-items:center;gap:8px;margin:8px 0}#dev-panel input[type=number]{width:110px}#dev-panel select{min-width:0;max-width:100%}#dev-panel small{display:block;color:#a9bd94;line-height:1.5}#dev-panel .dev-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #303c26}#dev-panel .dev-row span{flex:1}#dev-panel .dev-row button{white-space:nowrap}#dev-panel .dev-wide{grid-column:1/-1}#dev-panel output{display:block;white-space:pre-line;line-height:1.6}#dev-panel #dev-status{margin:12px 0;color:#a9bd94}#dev-panel #dev-result{min-height:20px;color:#ffcb66}#dev-panel .dev-danger{color:#ff9c8d}
`;
document.head.append(devStyle);
document.title='Nuclear Sweeper: Developer Version';
const devToggle=document.createElement('button');
devToggle.id='dev-toggle';devToggle.textContent='DEV TOOLS [F2]';
devToggle.addEventListener('click',()=>toggleDev());
document.body.append(devToggle);
const devPanel=document.createElement('div');
devPanel.id='dev-panel';
devPanel.setAttribute('role','dialog');
devPanel.setAttribute('aria-modal','true');
devPanel.setAttribute('aria-label','Developer tools');
document.body.append(devPanel);
let devResult='Developer progress is separate from your normal game. F2 opens these tools anywhere.';
let devResetArmed=false;

function toggleDev(open=!devOpen){
 devOpen=open;keys={};ml=0;hf=0;ads=false;syncPause();
 devPanel.style.display=open?'block':'none';devToggle.style.display=open?'none':'block';
 if(open){document.exitPointerLock?.();renderDev();$('#dev-close').focus()}
 else if(!shopOpen&&!setOpen)syncPause();
}

function devBudget(){
 const budget={scrap:0,cred:0,parts:0};
 for(const upgrade of U)for(let level=S.L[upgrade[0]];level<upgrade[5];level++)budget[upgrade[2]=='s'?'scrap':'cred']+=cost(upgrade,level);
 for(const [name,attachment] of Object.entries(ATT))if(!S.unl[name])budget.parts+=attachment[1];
 for(const [name,module] of Object.entries(MOD))if(!S.mod[name])budget.parts+=module[1];
 return budget;
}

function devFund(){
 const budget=devBudget();
 for(const currency of Object.keys(budget))S[currency]=Math.max(S[currency],budget[currency]);
}

function devUpgrade(id,max=false){
 const upgrade=U.find(entry=>entry[0]===id),target=max?upgrade[5]:Math.min(upgrade[5],S.L[id]+1);
 if(S.L[id]>=target)throw new Error('Already at the maximum level.');
 if(S[upgrade[2]=='s'?'scrap':'cred']<cost(upgrade,S.L[id]))throw new Error('Insufficient resources. Use Fund ALL purchases first.');
 while(S.L[id]<target){const before=S.L[id];buy(id);if(S.L[id]===before)break}
 if(S.L[id]<target)throw new Error('Bought affordable levels. Fund more resources to reach the maximum.');
}

function devResupply(){
 S.hp=ST(S.L).hp;resupplyAmmo();
 rel=0;relPh=0;wcd=0;hf=0;gCd=0;dCd=0;zpCd=0;bladeCd=0;p.dashed=0;
}

function devTravel(site){
 if(!Number.isInteger(site)||site<1||site>100)throw new Error('Choose a whole site number between 1 and 100.');
 S.sector=site;S.story=0;S.clr=0;S.vOpen=0;S.vTaken=0;S.iTaken=0;S.bossDead=0;S.bty=null;
 genMap(site);placeP();devResupply();spawnT=3;bfsT=0;moveAcc=0;dirty=[];
 $('#log').style.display='none';clearTimeout(msgT);camCalc();
}

function devDestinations(){
 const destinations=[{name:'Shelter',...SH},{name:'Reactor core',...CORE}];
 DEP.forEach((depot,index)=>destinations.push({name:'Depot '+(index+1),...depot}));
 if(TERM)destinations.push({name:'Sample terminal (20 dust opens vault)',...TERM});
 if(ISL)destinations.push({name:'Island rare parts',...ISL});
 const vault=R[12];
 if(vault)destinations.push({name:'Vault room',x:(vault.cx+.5)*TS,z:(vault.cz+.5)*TS});
 R.forEach((room,index)=>destinations.push({name:'Room '+(index+1),x:(room.cx+.5)*TS,z:(room.cz+.5)*TS}));
 return destinations;
}

function devSafePosition(target,radius=.4,enemy=false){
 let nearest=null;
 for(let tile=0;tile<M.length;tile++){
  if(M[tile]!==0&&M[tile]!==4)continue;
  const position={x:(tile%GW+.5)*TS,z:((tile/GW|0)+.5)*TS};
  if(bl(position.x,position.z,radius,0,1.8,enemy?1:0))continue;
  const distance=Math.hypot(position.x-target.x,position.z-target.z);
  if(!nearest||distance<nearest.distance)nearest={...position,distance};
 }
 if(!nearest)throw new Error('No safe floor found at this location.');
 return nearest;
}

function devTeleport(index){
 const target=devDestinations()[index];
 if(!target)throw new Error('Choose a destination.');
 const position=devSafePosition(target);
 placeP();Object.assign(p,{x:position.x,z:position.z});
 canDock=Math.hypot(p.x-SH.x,p.z-SH.z)>11;gCd=dCd=zpCd=0;moveAcc=0;camCalc();
 return target.name;
}

function devClean(percent){
 const target=S.total*(1-percent/100),current=D.reduce((total,value)=>total+value,0);
 if(target>current+.0001)throw new Error('Reload this site to restore dust before lowering its cleaned percentage.');
 const scale=current?target/current:0;
 for(let tile=0;tile<D.length;tile++)D[tile]*=scale;
 S.rem=D.reduce((total,value)=>total+value,0);S.clr=percent>=97?1:0;fullRef=true;
}

function devSpawn(type){
 if(!Number.isInteger(type)||type<0||type>=ET.length)throw new Error('Choose a valid enemy type.');
 const radius=.5*ET[type].sc;
 for(let attempt=0;attempt<32;attempt++){
  const angle=p.yaw+attempt*Math.PI/16;
  const position=devSafePosition({x:p.x-Math.sin(angle)*10,z:p.z-Math.cos(angle)*10},radius,true);
  if(Math.hypot(position.x-p.x,position.z-p.z)<4)continue;
  const tile=(position.z/TS|0)*GW+(position.x/TS|0);
  if(ET[type].sc>1.2&&!PB[tile])continue;
  if(spawnE(position.x,position.z,1,type))return;
 }
 throw new Error('No nearby spawn fits this enemy. Teleport to an open room.');
}

function renderDev(){
 const button=(action,label,extra='')=>`<button data-dev="${action}" ${extra}>${label}</button>`;
 devPanel.innerHTML=`<div class="dev-wrap">
 <header><div><h2>DEVELOPER VERSION</h2><small>Separate save. Gameplay pauses here; the refinery keeps running.</small></div><button id="dev-close">RETURN [F2 / Esc]</button></header>
 <output id="dev-status"></output><output id="dev-result" role="status"></output>
 <div class="dev-grid">
 <section><h3>Purchases & resources</h3><small>Fund every remaining purchase, then buy normally in the shelter or below. Max loadout also equips every attachment.</small>
 <div class="dev-actions">${button('fund','Fund ALL purchases')}${button('shelter','Open shelter shop')}${button('max-all','Buy max loadout')}</div>
 ${[['cred','Credits'],['scrap','Scrap'],['parts','Rare parts']].map(([key,label])=>`<label>${label} <input id="dev-${key}" type="number" min="0" max="1000000000000" step="1" value="${Math.floor(S[key])}"></label>`).join('')}
 <div class="dev-actions">${button('wallet','Set resources')}${button('baseline','Reset equipment to baseline')}</div></section>
 <section><h3>Sites & locations</h3><small>Travel regenerates the destination and resets its dust, vault, loot and radio progress. Equipment and resources carry over.</small>
 <label>Named site <select id="dev-named-site">${SEC.map((site,index)=>`<option value="${index+1}" ${S.sector===index+1?'selected':''}>${index+1}: ${site.n}</option>`).join('')}</select></label>
 <div class="dev-actions">${button('named-site','Travel to named site')}</div>
 <label>Any site <input id="dev-site" type="number" min="1" max="100" step="1" value="${S.sector}"></label>
 <div class="dev-actions">${button('site','Travel')}${button('previous','Previous site')}${button('next','Next site')}${button('reload-site','Reload current site')}</div>
 <label>Location <select id="dev-location">${devDestinations().map((target,index)=>`<option value="${index}">${target.name}</option>`).join('')}</select></label>
 <div class="dev-actions">${button('teleport','Teleport here')}</div><small>Teleports use the nearest safe ground tile. Close these tools and the shelter to explore.</small></section>
 <section><h3>Gameplay loops</h3><div class="dev-actions">${button('heal','Heal & refill ammo')}${button('fill-tank','Fill dust tank')}${button('deposit','Deposit tank')}${button('queue','Add 1,000 refinery dust')}${button('refine','Refine 60 seconds')}${button('clean-97','Set cleaned to 97%')}${button('clean-100','Clean entire site')}${button('vault','Open vault')}${button('story','Replay site radio log')}</div>
 <label>Enemy <select id="dev-enemy"><option value="0">Glower</option><option value="1">Spitter</option><option value="2">Brute</option><option value="3">Ranged enemy</option></select></label>
 <div class="dev-actions">${button('spawn','Spawn nearby')}${button('kill-enemies','Kill enemies / drop loot')}${button('clear-enemies','Remove enemies & projectiles')}${button('death','Test death / rescue')}</div></section>
 <section><h3>Testing assists</h3>${[['invincible','Invincible (combat, radiation & hazards)'],['infiniteAmmo','Infinite ammo'],['freezeEnemies','Freeze enemies & automatic spawns']].map(([key,label])=>`<label><input type="checkbox" data-dev-flag="${key}" ${DEV_TOOLS[key]?'checked':''}>${label}</label>`).join('')}
 <small>Assists start off and reset when you reload. Resources, equipment and site progress use only the developer save.</small><h3 style="margin-top:18px">Developer save</h3><div class="dev-actions">${button('save','Save developer progress')}${button('reset',devResetArmed?'Confirm reset developer save':'Reset developer save','class="dev-danger"')}</div></section>
 <section class="dev-wide"><h3>Every upgrade & weapon purchase</h3><small>Uses the real prices, level limits and shop functions. Fund resources first.</small>
 ${U.map(upgrade=>{const level=S.L[upgrade[0]],maxed=level>=upgrade[5];return `<div class="dev-row"><span>${upgrade[1]}<small>Level ${level} / ${upgrade[5]}${maxed?'':` | Next: ${cost(upgrade,level).toLocaleString()} ${upgrade[2]=='s'?'scrap':'credits'}`}</small></span>${button('buy','Buy +1',`data-id="${upgrade[0]}" ${maxed?'disabled':''}`)}${button('max','Buy to max',`data-id="${upgrade[0]}" ${maxed?'disabled':''}`)}</div>`}).join('')}</section>
 <section><h3>Attachments & movement modules</h3>${Object.entries(ATT).map(([key,attachment])=>`<div class="dev-row"><span>${attachment[0]}<small>${attachment[1]} rare parts</small></span>${button('attachment',S.unl[key]?'Owned':'Buy',`data-id="${key}" ${S.unl[key]?'disabled':''}`)}</div>`).join('')}
 ${Object.entries(MOD).map(([key,module])=>`<div class="dev-row"><span>${module[0]}<small>${module[1]} rare parts</small></span>${button('module',S.mod[key]?'Installed':'Buy',`data-id="${key}" ${S.mod[key]?'disabled':''}`)}</div>`).join('')}</section>
 <section><h3>Equip & compare weapons</h3><label>Weapon <select id="dev-weapon">${WP.map((weapon,index)=>`<option value="${index}" ${index===wi?'selected':''}>${weapon.n}${index&&!S.L['w'+index]?' (locked)':''}</option>`).join('')}</select></label>
 <div class="dev-actions">${button('weapon','Equip weapon')}${Object.entries(ATT).map(([key,attachment])=>button('equip',`Toggle ${attachment[0]}`,`data-id="${key}" ${S.unl[key]?'':'disabled'}`)).join('')}</div><output id="dev-weapon-status"></output></section>
 </div></div>`;
 $('#dev-close').addEventListener('click',()=>toggleDev(false));devRefresh();
}

function devRefresh(){
 if(!devOpen)return;
 const stats=ST(S.L);
 $('#dev-status').textContent=`Site ${S.sector}: ${getSec(S.sector).n} | Cleaned ${pct().toFixed(2)}% | HP ${S.hp.toFixed(0)}/${stats.hp}\nCredits ${Math.floor(S.cred).toLocaleString()} | Scrap ${S.scrap.toLocaleString()} | Parts ${S.parts} | Tank ${S.tank.toFixed(1)}/${stats.cap} | Queue ${S.raw.toFixed(1)}\nPosition ${p.x.toFixed(1)}, ${p.h.toFixed(1)}, ${p.z.toFixed(1)} | Speed ${Math.hypot(p.vx,p.vz).toFixed(2)} m/s | Enemies ${E.length} | Vault ${S.vOpen?'open':'locked'}`;
 $('#dev-result').textContent=devResult;
 const selected=Number($('#dev-weapon').value);
 $('#dev-weapon-status').textContent=`Active: ${WP[wi].n}\nSelected attachments: ${Object.keys(ATT).filter(key=>S.att[selected][key]).map(key=>ATT[key][0]).join(', ')||'none'}`;
}

devPanel.addEventListener('change',event=>{
 const flag=event.target.dataset.devFlag;
 if(flag&&Object.hasOwn(DEV_TOOLS,flag)){
  DEV_TOOLS[flag]=event.target.checked;
  if(flag==='freezeEnemies')EP=[];
  if(flag==='infiniteAmmo')devResupply();
 }
 devRefresh();
});

devPanel.addEventListener('click',event=>{
 const control=event.target.closest('[data-dev]');
 if(!control||control.disabled)return;
 const action=control.dataset.dev;
 if(action!=='reset')devResetArmed=false;
 try{
  devResult=control.textContent+' completed.';
  if(action==='fund')devFund();
  else if(action==='wallet'){
   const wallet=Object.fromEntries(['cred','scrap','parts'].map(key=>[key,Number($('#dev-'+key).value)]));
   if(Object.values(wallet).some(value=>!Number.isFinite(value)||value<0||value>1e12||!Number.isInteger(value)))throw new Error('Resources must be whole numbers between 0 and 1,000,000,000,000.');
   Object.assign(S,wallet);
  }
  else if(action==='buy'||action==='max')devUpgrade(control.dataset.id,action==='max');
  else if(action==='max-all'){
   devFund();
   for(const upgrade of U)if(S.L[upgrade[0]]<upgrade[5])devUpgrade(upgrade[0],true);
   for(const key of Object.keys(ATT))shopClick({dataset:{un:key}});
   for(const key of Object.keys(MOD))shopClick({dataset:{md:key}});
   for(const attachment of S.att)for(const key of Object.keys(ATT))attachment[key]=1;
   devResupply();
  }
  else if(action==='baseline'){S.L=mkL();S.att=WP.map(()=>({s:0,b:0,l:0}));S.unl={s:0,b:0,l:0};S.mod={gr:0,dash:0};wi=0;S.tank=Math.min(S.tank,ST(S.L).cap);placeP();devResupply()}
  else if(action==='attachment'||action==='module'){
   const key=control.dataset.id,price=action==='attachment'?ATT[key][1]:MOD[key][1];
   if(S.parts<price)throw new Error('Insufficient rare parts. Use Fund ALL purchases first.');
   shopClick({dataset:action==='attachment'?{un:key}:{md:key}});
  }
  else if(action==='equip'||action==='weapon'){
   const weapon=Number($('#dev-weapon').value);
   if(weapon&&!S.L['w'+weapon])throw new Error('Purchase this weapon first.');
   if(action==='weapon')setW(weapon);else shopClick({dataset:{eq:weapon+','+control.dataset.id}});
  }
  else if(action==='site'||action==='named-site')devTravel(Number($(action==='site'?'#dev-site':'#dev-named-site').value));
  else if(action==='previous'||action==='next'||action==='reload-site')devTravel(S.sector+(action==='next'?1:action==='previous'?-1:0));
  else if(action==='teleport')devResult='Teleported to '+devTeleport(Number($('#dev-location').value))+'.';
  else if(action==='shelter'){placeP();openShop();toggleDev(false);return}
  else if(action==='heal')devResupply();
  else if(action==='fill-tank')S.tank=ST(S.L).cap;
  else if(action==='deposit'){S.raw+=S.tank;S.tank=0}
  else if(action==='queue')S.raw+=1000;
  else if(action==='refine')refine(60);
  else if(action==='clean-97'||action==='clean-100')devClean(action==='clean-97'?97:100);
  else if(action==='vault'){if(!S.vOpen)openVault(true)}
  else if(action==='story')S.story=0;
  else if(action==='spawn')devSpawn(Number($('#dev-enemy').value));
  else if(action==='kill-enemies')for(const enemy of E)enemy.hp=0;
  else if(action==='clear-enemies'){E=[];EP=[];spawnT=3}
  else if(action==='death'){
   setOpen=false;$('#set').style.display='none';shopOpen=false;$('#shop').style.display='none';S.hp=-ST(S.L).hp;toggleDev(false);return;
  }
  else if(action==='reset'){
   if(!devResetArmed){devResetArmed=true;devResult='Click confirm to replace only your developer progress.'}
   else{S=fresh();devTravel(1);wi=0;devResetArmed=false;devResult='Developer progress reset. Normal save is untouched.'}
  }
  else if(action!=='save')throw new Error('Unknown developer action.');
  save();renderShop();hud();
 }catch(error){devResult=error.message}
 const scroll=devPanel.scrollTop,weapon=$('#dev-weapon').value,enemy=$('#dev-enemy').value;
 renderDev();$('#dev-weapon').value=weapon;$('#dev-enemy').value=enemy;devRefresh();devPanel.scrollTop=scroll;
});

setInterval(devRefresh,250);
toggleDev(true);
