(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
function install(shell){
 const dev=shell.dev;let session=null,invitation='',busy=false,worldActive=false,pendingImport=null;
 const checkpointStore=NSR.Storage.create({dev});
 const style=document.createElement('style');style.textContent=`
 #coop-menu{position:fixed;inset:0;z-index:15;background:#080e0cf5;overflow:auto;color:#d7e3d5;display:grid;place-items:center;padding:24px;box-sizing:border-box;font:14px/1.55 monospace}
 #coop-menu[hidden],#coop-menu [hidden]{display:none!important}#coop-menu .coop-wrap{width:min(100%,760px)}#coop-menu h1{font-size:clamp(25px,5vw,40px);line-height:1.1;letter-spacing:-1px;color:#d1f36a;margin:12px 0}
 #coop-menu .coop-eyebrow{color:#8eaa96;letter-spacing:3px;font-size:11px}#coop-menu .coop-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:24px 0}#coop-menu section{padding:20px;border:1px solid #344b3d;border-radius:10px;background:#142019}
 #coop-menu h2{font-size:17px;margin:0 0 10px}#coop-menu p{color:#a8bcae;margin:10px 0}#coop-menu label{display:block;margin:12px 0 6px;color:#a8bcae}
 #coop-menu input,#coop-menu textarea{display:block;width:100%;box-sizing:border-box;border:1px solid #48614e;border-radius:5px;padding:10px;background:#09120d;color:#edf6e8;font:inherit}#coop-menu textarea{min-height:70px;resize:vertical;word-break:break-all}
 #coop-menu button,#coop-toggle{border:1px solid #648344;border-radius:5px;padding:11px 15px;background:#d1f36a;color:#13200e;font:700 12px monospace;cursor:pointer}#coop-menu button:disabled{opacity:.45;cursor:default}#coop-menu button.secondary,#coop-toggle{background:#1c3024;color:#d3e4cd;border-color:#496347}#coop-menu .coop-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
 #coop-status{min-height:24px;color:#d1f36a!important;white-space:pre-wrap}#coop-status.error{color:#ffb09c!important}#coop-toggle{position:fixed;z-index:7;right:14px;top:274px;padding:8px 12px}#coop-indicator{position:fixed;z-index:6;right:14px;top:316px;font:11px monospace;color:#c6dfbb;pointer-events:none;text-align:right;max-width:280px}
 #coop-roster{list-style:none;padding:0;margin:10px 0}#coop-roster li{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #2f4835;padding:10px 0}#coop-menu summary{cursor:pointer;color:#afc693}#coop-stats{white-space:pre-wrap;overflow-wrap:anywhere;color:#94ad9c;font-size:11px}#coop-menu .wide{grid-column:1/-1}#coop-menu small{color:#8eaa96}
 @media(max-width:620px){#coop-menu{padding:16px}#coop-menu .coop-grid{grid-template-columns:1fr}#coop-menu section{padding:16px}#coop-indicator{max-width:160px}}
 `;document.head.append(style);
 const menu=document.createElement('div');menu.id='coop-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-modal','true');menu.setAttribute('aria-label','Choose solo or private co-op');
 menu.innerHTML=`<div class="coop-wrap"><div class="coop-eyebrow">SHELTER NINE / ${dev?'DEVELOPER BUILD':'REACTOR RUN'}</div><h1>Clean up. Together.</h1><p>A private expedition for up to four sweepers. The host keeps the world; every sweeper keeps their own equipment.</p>
 <div id="coop-start" class="coop-grid"><section><h2>Solo expedition</h2><p>Your existing progress, weapons, and records. Play immediately, including from the local HTML file.</p><button id="coop-solo">CONTINUE SOLO</button></section>
 <section><h2>Private co-op</h2><label for="coop-name">Your callsign</label><input id="coop-name" maxlength="24" value="Sweeper" autocomplete="nickname"><label for="coop-url">Signaling service</label><input id="coop-url" type="url"><small>For local testing, run npm start. Online rooms need HTTPS and TURN.</small><div class="coop-actions"><button id="coop-host">HOST / CONTINUE WORLD</button></div></section>
 <section class="wide"><h2>Join an expedition</h2><label for="coop-invite">Invitation link</label><textarea id="coop-invite" placeholder="Paste the host's invitation link"></textarea><div class="coop-actions"><button id="coop-join">JOIN ROOM</button></div><details style="margin-top:14px"><summary>Connection testing</summary><label><input id="coop-relay" type="checkbox" style="display:inline;width:auto"> Force TURN relay</label></details></section></div>
 <div id="coop-room" hidden><section><h2>Your expedition</h2><p>Credits, scrap, parts, refinery, dust, and loot are shared. Gear, ammo, health, and records are personal. Menus stop your input while the world keeps running.</p><label for="coop-share">Private invitation</label><textarea id="coop-share" readonly></textarea><div class="coop-actions"><button id="coop-copy" class="secondary">COPY INVITATION</button><button id="coop-play">ENTER WORLD</button><button id="coop-ready" class="secondary">READY IN SHELTER</button><button id="coop-deploy" class="secondary">DEPLOY NEXT SITE</button></div><ul id="coop-roster"></ul><div class="coop-actions"><button id="coop-resume-world" hidden>RESUME SHARED WORLD</button><button id="coop-export" class="secondary">EXPORT CO-OP BACKUP</button><button id="coop-leave" class="secondary">SAVE & LEAVE</button></div><details style="margin-top:16px"><summary>Network diagnostics</summary><pre id="coop-stats"></pre></details><div id="coop-dev" hidden><h2>Host testing controls</h2><div class="coop-actions"><button data-coop-dev="fund">FUND TEAM</button><button data-coop-dev="max">MAX MY LOADOUT</button><button data-coop-dev="clean">CLEAN SITE</button><button data-coop-dev="resupply">RESUPPLY ME</button></div><label><input type="checkbox" data-coop-assist="invincible" style="display:inline;width:auto"> Invincible</label><label><input type="checkbox" data-coop-assist="freezeEnemies" style="display:inline;width:auto"> Freeze enemies</label><label><input type="checkbox" data-coop-assist="infiniteAmmo" style="display:inline;width:auto"> Infinite ammo</label></div></section></div><p id="coop-status" role="status" aria-live="polite">Solo and co-op use separate saves.</p><small>Host closes the browser: session ends. Host hides the tab: everyone pauses. Guests can reconnect with their browser identity.</small></div>`;
 document.body.append(menu);
 const query=selector=>menu.querySelector(selector),toggle=document.createElement('button');toggle.id='coop-toggle';toggle.textContent='EXPEDITION';toggle.hidden=true;document.body.append(toggle);
 const backup=document.createElement('section');backup.className='wide';backup.innerHTML='<h2>Restore a co-op world</h2><p>Choose an exported co-op backup. Review it before replacing this browser\'s co-op checkpoint. Host the world afterward to continue.</p><label for="coop-import-file">Co-op backup file</label><input id="coop-import-file" type="file" accept=".json,application/json"><p id="coop-import-preview" role="status"></p><button id="coop-import-confirm" hidden>REPLACE CO-OP CHECKPOINT</button>';
 query('#coop-start').append(backup);
 query('#coop-import-file').onchange=async event=>{
  pendingImport=null;query('#coop-import-confirm').hidden=true;const file=event.target.files[0];if(!file)return;
  try{if(file.size>5e6)throw new Error('That file is too large to be a co-op save.');const checked=checkpointStore.inspect(await file.text());if(busy||session)throw new Error('Leave the active expedition before importing.');pendingImport=checked;query('#coop-import-preview').textContent='Site '+checked.world.sector+' / '+Object.keys(checked.world.players).length+' saved characters / '+Math.floor(checked.world.team.cred)+' team credits. Confirm to replace the current co-op checkpoint.';query('#coop-import-confirm').hidden=false;}catch(error){query('#coop-import-preview').textContent=error.message;}
 };
 query('#coop-import-confirm').onclick=()=>{try{if(busy||session||!pendingImport)return;checkpointStore.importCheckpoint(pendingImport);pendingImport=null;query('#coop-import-confirm').hidden=true;query('#coop-import-preview').textContent='Co-op checkpoint restored. Choose HOST / CONTINUE WORLD to resume.';}catch(error){query('#coop-import-preview').textContent=error.message;}};
 const indicator=document.createElement('div');indicator.id='coop-indicator';document.body.append(indicator);
 query('#coop-url').value=location.protocol==='file:'?'http://localhost:8787':location.origin;
 try{const settings=JSON.parse(localStorage.getItem(dev?'nsr_coop_ui_dev':'nsr_coop_ui')||'{}');if(settings.name)query('#coop-name').value=settings.name;if(settings.url)query('#coop-url').value=settings.url;}catch(error){}
 if(location.hash.includes('coop='))query('#coop-invite').value=location.href;
 function setStatus(message,error=false){const output=query('#coop-status');output.textContent=message;output.classList.toggle('error',error);}
 function show(){menu.hidden=false;shell.menuOpen();refresh();}
 function hide(){if(!worldActive&&!shell.started())return;menu.hidden=true;shell.menuClose();}
 function download(value){const blob=new Blob([JSON.stringify(value)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='nuclear-sweeper-coop-'+new Date().toISOString().slice(0,10)+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 function refresh(){
  const view=session?.view();if(!view)return;
  const roster=query('#coop-roster');roster.replaceChildren();
  for(const player of Object.values(view.world.players)){
   if(!player.connected)continue;const row=document.createElement('li'),label=document.createElement('span'),state=document.createElement('span');label.textContent=player.name+(player.id===view.localId?' (you)':'')+(player.id===view.world.hostId?' / HOST':'');state.textContent=player.ready?'READY':NSR.Simulation.inShelter(view.world,player)?'IN SHELTER':'IN THE FIELD';row.append(label,state);roster.append(row);
  }
  query('#coop-ready').textContent=view.player.ready?'CANCEL READINESS':'READY IN SHELTER';query('#coop-ready').disabled=!NSR.Simulation.inShelter(view.world,view.player);
  query('#coop-deploy').hidden=view.role!=='host';query('#coop-deploy').disabled=!view.world.clr;query('#coop-export').hidden=view.role!=='host';
  query('#coop-resume-world').hidden=view.role!=='host'||!view.paused;query('#coop-dev').hidden=!dev||view.role!=='host';
  query('#coop-stats').textContent=JSON.stringify(session.stats(),null,2);
  const stats=session.stats(),peers=stats.peers||[],ping=peers.length?Math.max(...peers.map(peer=>peer.ping)):0;
  indicator.textContent=(view.waiting?'WAITING FOR HOST':view.paused?'WORLD PAUSED':view.role.toUpperCase()+' / '+Object.values(view.world.players).filter(player=>player.connected).length+' SWEEPERS')+(peers.length?'\n'+ping+' ms / '+peers.map(peer=>peer.path).join(', '):'');
 }
 function onEvent(event){
  if(event.type==='status'||event.type==='error')setStatus(event.message,event.type==='error');
  if(event.type==='world'){worldActive=true;shell.startCoop(session);query('#coop-start').hidden=true;query('#coop-room').hidden=false;toggle.hidden=false;shell.worldChanged();refresh();}
  if(event.type==='geometry')shell.worldChanged();if(event.type==='dust')shell.dustChanged(event.cells);
  if(event.type==='game-event')shell.gameEvent(event.event);if(event.type==='input-consumed')shell.consumeInput();
  if(event.type==='transaction')shell.transaction();if(event.type==='ended'){show();query('#coop-play').disabled=true;}
  if(event.type==='pause'){show();refresh();}
 }
 async function connect(host){
  if(busy)return;busy=true;for(const button of query('#coop-start').querySelectorAll('button'))button.disabled=true;
  try{
   if(!root.RTCPeerConnection)throw new Error('This browser does not support WebRTC.');
   const name=query('#coop-name').value.trim()||'Sweeper',url=query('#coop-url').value;
   const invitationValue=host?null:NSR.Protocol.decodeInvitation(query('#coop-invite').value.trim());
   if(invitationValue&&invitationValue.dev!==dev)throw new Error('Open the matching normal or developer build before joining.');
   try{localStorage.setItem(dev?'nsr_coop_ui_dev':'nsr_coop_ui',JSON.stringify({name,url}));}catch(error){}
   session=NSR.Session.create({dev,name,url,relay:query('#coop-relay').checked,onEvent});shell.bindSession(session);
   setStatus(host?'Opening the expedition...':'Connecting to the host...');
   if(host){const result=await session.host();const address=new URL(location.protocol==='file:'?result.invitation.url+'/nuclear-sweeper-reactor.html':location.href);address.hash='coop='+encodeURIComponent(NSR.Protocol.encodeInvitation(result.invitation));if(dev)address.searchParams.set('dev','1');invitation=address.href;query('#coop-share').value=invitation;}
   else{await session.join(invitationValue);invitation=query('#coop-invite').value;query('#coop-share').value=invitation;}
  }catch(error){await session?.close();session=null;shell.bindSession(null);setStatus(error.message,true);}
  finally{busy=false;for(const button of query('#coop-start').querySelectorAll('button'))button.disabled=false;}
 }
 query('#coop-solo').onclick=()=>{menu.hidden=true;toggle.hidden=false;shell.startSolo();};
 query('#coop-host').onclick=()=>connect(true);query('#coop-join').onclick=()=>connect(false);toggle.onclick=show;query('#coop-play').onclick=hide;
 query('#coop-copy').onclick=async()=>{try{await navigator.clipboard.writeText(invitation);setStatus('Invitation copied.');}catch(error){query('#coop-share').select();setStatus('Select and copy the invitation above.');}};
 query('#coop-ready').onclick=async()=>{const result=await session.perform('ready',{value:!session.view().player.ready});if(!result.ok)setStatus(result.reason,true);refresh();};
 query('#coop-deploy').onclick=async()=>{const result=await session.perform('deploy');if(!result.ok)setStatus(result.reason,true);refresh();};
 query('#coop-resume-world').onclick=()=>session.setPaused(false);
 query('#coop-export').onclick=()=>{try{download(session.exportCheckpoint());setStatus('Co-op backup exported. Keep it private: it contains character reconnect tokens.');}catch(error){setStatus(error.message,true);}};
 query('#coop-leave').onclick=async()=>{await session?.close();location.hash='';location.reload();};
 query('#coop-dev').onclick=event=>{const command=event.target.dataset.coopDev;if(command){session.devCommand(command);shell.worldChanged();refresh();}};
 query('#coop-dev').onchange=event=>{const assist=event.target.dataset.coopAssist;if(assist)session.devCommand('assist',{key:assist,value:event.target.checked});};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&session?.view()?.role==='host')session.setPaused(true);});
 addEventListener('beforeunload',()=>session?.save());setInterval(refresh,500);
 return {show,hidden:()=>menu.hidden,session:()=>session};
}
NSR.CoopUI={install};
})(globalThis);
