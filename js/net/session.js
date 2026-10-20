(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
const {Simulation:Sim,Movement,Protocol,Defs}=NSR;
const copy=value=>JSON.parse(JSON.stringify(value));
const secret=()=>{const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');};
function create({dev=false,name='Sweeper',url,relay=false,onEvent=()=>{},storage=NSR.Storage.create({dev})}={}){
 let role='offline',world=null,worldId=null,identities={},localId=null,sessionId=null,transport=null,closed=false;
 let sequence=0,actionSequence=0,inputHistory=[],inputAccumulator=0,sendAccumulator=0,snapshotAccumulator=0,dustAccumulator=0,saveAccumulator=0;
 let lastHostAt=0,lastFrame=-1,predicted=null,pausedByHost=false,pauseSequence=0,waiting=true,corrections=0,syncing=false,saveError=null;
 const bindings=new Map(),queues=new Map(),lastInputs=new Map(),receivedAt=new Map(),reservations=new Map(),pendingActions=new Map();
 let latestInput={},remoteFrames=[],lastStats=null;
 const emit=(type,data={})=>onEvent({type,...data});
 function status(message){emit('status',{message});}
 function save(){if(role!=='host'||!world)return false;try{storage.save({world,worldId,identities});saveError=null;return true;}catch(error){saveError='Co-op checkpoint could not be saved: '+error.message;emit('error',{message:saveError});return false;}}
 function frame(peerId){
  const own=bindings.get(peerId)||localId,players={};
  for(const player of Object.values(world.players)){
   if(player.id===own){players[player.id]=copy(player);delete players[player.id].actionResults;}
   else {const pose=player.pose;players[player.id]={id:player.id,name:player.name,pose:{x:pose.x,z:pose.z,h:pose.h,yaw:pose.yaw,pit:pose.pit,low:!!pose.low,st:pose.st,gr:pose.gr?{x:pose.gr.x,y:pose.gr.y,z:pose.gr.z}:null},wi:player.wi,appearance:Defs.appearance(player),reloading:player.rel>0,hp:player.hp,ready:player.ready,connected:player.connected,present:player.present};}
  }
  const precision=value=>Math.round(value*1000)/1000;
  return {type:'frame',session:sessionId,generation:world.generation,tick:world.tick,time:world.time,players,team:world.team,rem:world.rem,total:world.total,clr:world.clr,story:world.story,vOpen:world.vOpen,boss:world.boss,bossDead:world.bossDead,paused:pausedByHost,pauseSequence,
   E:world.E.map(enemy=>[enemy.id,enemy.t,precision(enemy.x),precision(enemy.z),precision(enemy.hp),enemy.mh,enemy.al,enemy.ph,precision(enemy.h||0)]),
   EP:world.EP.map(projectile=>[projectile.id,precision(projectile.x),precision(projectile.y),precision(projectile.z),projectile.sz]),
   Dr:world.Dr.map(loot=>[loot.id,precision(loot.x),precision(loot.z),loot.k,loot.a])};
 }
 function sendFrame(){for(const [peerId]of bindings){const value=frame(peerId);if(!transport.send(peerId,value,false)){const peer=transport.stats().peers.find(candidate=>candidate.id===peerId);if(peer&&peer.queuedBytes<32768)transport.send(peerId,value,true);}}}
 function sendSnapshot(peerId){
  transport.send(peerId,{type:'snapshot',session:sessionId,worldId,playerId:bindings.get(peerId),world:Sim.snapshot(world),paused:pausedByHost,pauseSequence},true);
 }
 function validMessage(data){return data&&data.session===sessionId&&data.generation===world?.generation;}
 function applyPause(value,sequence){
  if(!Number.isSafeInteger(sequence)||sequence<pauseSequence)return;
  const changed=sequence>pauseSequence||pausedByHost!==!!value;pauseSequence=sequence;pausedByHost=!!value;
  if(changed){inputAccumulator=0;inputHistory=[];emit('pause',{paused:pausedByHost});}
 }
 function identify(peerId,data){
  if(bindings.has(peerId))return;
  const returning=data.identity&&Object.hasOwn(identities,data.identity.playerId)&&identities[data.identity.playerId]===data.identity.token;
  let player;
  if(returning){
   player=world.players[data.identity.playerId];if(!player)return;
   if([...bindings.values()].includes(player.id)||player.id===localId){transport.send(peerId,{type:'rejected',message:'This character is already connected.'});return;}
  }else{
   const occupied=Object.values(world.players).filter(candidate=>candidate.connected).length+[...reservations.values()].filter(reservation=>reservation.until>performance.now()).length;
   if(occupied>=4){transport.send(peerId,{type:'rejected',message:'Four player slots are occupied or reserved for reconnect.'});return;}
   player=Sim.addPlayer(world,{id:'sweeper-'+secret().slice(0,16),name:data.name});identities[player.id]=secret();
  }
  player.connected=true;player.present=false;player.disconnectedRescued=false;player.ready=false;player.lastSeq=0;player.fireHeld=false;bindings.set(peerId,player.id);reservations.delete(player.id);queues.set(player.id,[]);receivedAt.set(player.id,performance.now());
  transport.send(peerId,{type:'identity',worldId,playerId:player.id,token:identities[player.id]},true);sendSnapshot(peerId);save();emit('roster');
 }
 function reconcile(authoritative){
  const before=predicted?.pose;inputHistory=inputHistory.filter(input=>input.seq>authoritative.lastSeq);
  predicted=copy(authoritative);
  for(const input of inputHistory)Movement.step(world,predicted,input,Defs.MOVE.tick);
  if(before&&Math.hypot(before.x-predicted.pose.x,before.z-predicted.pose.z)>.1)corrections++;
 }
 function events(values){for(const value of values||[])emit('game-event',{event:value});}
 function onTransport(event){
  if(closed)return;
  if(event.type==='error'||event.type==='status'){emit(event.type,{message:event.message});return;}
  if(event.type==='peer-open'){
   if(role==='host')transport.send(event.peerId,{type:'identify',worldId,session:sessionId},true);
   return;
  }
  if(event.type==='peer-close'){
   if(role==='host'){
    const id=bindings.get(event.peerId);bindings.delete(event.peerId);if(id){Sim.disconnect(world,id);queues.delete(id);lastInputs.delete(id);reservations.set(id,{rescueAt:performance.now()+10000,until:performance.now()+60000,rescued:false});save();emit('roster');}
   }else{waiting=true;status('Host connection ended. Your solo save is unchanged. Reopen the invitation to reconnect.');emit('ended');}
   return;
  }
  if(event.type!=='message')return;
  const data=event.data;if(!data||typeof data.type!=='string')return;
  if(role==='host'){
   if(data.type==='introduce'){if(data.session===sessionId)identify(event.peerId,data);return;}
   const id=bindings.get(event.peerId);if(!id)return;
   if(data.type==='synced'&&data.session===sessionId&&data.generation===world.generation){receivedAt.set(id,performance.now());return;}
   if(!validMessage(data))return;
   if(data.type==='inputs'&&Array.isArray(data.inputs)&&data.inputs.length<=16){
    const queue=queues.get(id),player=world.players[id];if(!queue)return;
    for(const raw of data.inputs){const input=Protocol.input(raw);if(input&&input.seq>player.lastSeq&&input.seq<=player.lastSeq+256&&!queue.some(queued=>queued.seq===input.seq))queue.push(input);}
    queue.sort((first,second)=>first.seq-second.seq);if(queue.length>128)queue.splice(0,queue.length-128);receivedAt.set(id,performance.now());
   }else if(data.type==='action'){
    const generation=world.generation,result=pausedByHost?{ok:false,reason:'Wait for the host.'}:Sim.action(world,id,data.action);save();
    if(world.generation!==generation)transition();else transport.send(event.peerId,frame(event.peerId),true);
    transport.send(event.peerId,{type:'action-result',id:data.action?.id,result},true);
   }
   return;
  }
  if(data.type==='identify'){
   sessionId=data.session;worldId=data.worldId;transport.send('host',{type:'introduce',session:sessionId,name,identity:storage.identity(worldId)},true);return;
  }
  if(data.type==='identity'){
   try{storage.remember(data.worldId,{playerId:data.playerId,token:data.token});}catch(error){emit('error',{message:'Reconnect identity could not be stored.'});}return;
  }
  if(data.type==='rejected'){waiting=true;status(data.message);emit('ended');return;}
  if(data.type==='snapshot'&&data.session===sessionId){
   try{
    syncing=true;world=Sim.restore(data.world);localId=data.playerId;if(!world.players[localId])throw new Error('Missing local character.');
    sequence=world.players[localId].lastSeq;actionSequence=world.players[localId].lastActionId;inputHistory=[];remoteFrames=[];predicted=copy(world.players[localId]);lastFrame=world.tick;lastHostAt=performance.now();pausedByHost=data.paused;pauseSequence=data.pauseSequence||0;waiting=false;syncing=false;
    transport.send('host',{type:'synced',session:sessionId,generation:world.generation},true);emit('world',{world});status('Connected. The world continues while menus are open.');
   }catch(error){emit('error',{message:'World synchronization failed: '+error.message});}return;
  }
  if(data.type==='pause'&&validMessage(data)&&typeof data.paused==='boolean'&&Number.isSafeInteger(data.pauseSequence)&&data.pauseSequence>=pauseSequence){
   applyPause(data.paused,data.pauseSequence);lastHostAt=performance.now();waiting=false;return;
  }
  if(data.type==='frame'&&validMessage(data)&&data.tick>=lastFrame&&world.players[localId]){
   lastFrame=data.tick;lastHostAt=performance.now();applyPause(data.paused,data.pauseSequence||0);waiting=false;
   if(!data.players?.[localId])return;
   world.tick=data.tick;world.time=data.time;world.team=data.team;world.rem=data.rem;world.clr=data.clr;world.story=data.story;
   world.boss=data.boss||null;world.bossDead=data.bossDead||0;if(Number.isFinite(data.total))world.total=data.total;
   if(data.vOpen&&!world.vOpen){world.vOpen=1;for(const tile of world.DOORT)world.M[tile]=0;emit('geometry');}
   world.players=data.players;reconcile(data.players[localId]);
   world.E=data.E.map(([id,type,x,z,hp,mh,al,ph,h=0])=>({id,t:type,x,z,hp,mh,al,ph,h}));
   world.EP=data.EP.map(([id,x,y,z,size])=>({id,x,y,z,sz:size}));
   world.Dr=data.Dr.map(([id,x,z,kind,amount])=>({id,x,z,k:kind,a:amount}));
   remoteFrames.push({at:performance.now(),players:copy(data.players),E:copy(world.E)});if(remoteFrames.length>8)remoteFrames.shift();return;
  }
  if(data.type==='dust'&&validMessage(data)&&Array.isArray(data.cells)){
   for(const [tile,value]of data.cells)if(Number.isInteger(tile)&&tile>=0&&tile<world.D.length&&Number.isFinite(value)&&value>=0&&value<=1)world.D[tile]=value;emit('dust',{cells:data.cells});return;
  }
  if(data.type==='events'&&validMessage(data)){events(data.events);return;}
  if(data.type==='action-result'){
   const pending=pendingActions.get(data.id);if(pending){pendingActions.delete(data.id);pending.resolve(data.result);}if(!data.result.ok)status(data.result.reason);else emit('transaction');return;
  }
  if(data.type==='ended'){waiting=true;status('The host ended this session.');emit('ended');}
 }
 function transition(){inputHistory=[];sequence=0;for(const player of Object.values(world.players))player.lastSeq=0;queues.clear();for(const id of bindings.values())queues.set(id,[]);lastInputs.clear();for(const peerId of bindings.keys())sendSnapshot(peerId);emit('world',{world});save();}
 function ownInput(raw){const clean=Protocol.input({...raw,seq:++sequence});return clean||Protocol.neutral({seq:sequence});}
 function authoritativeTick(raw){
  const inputs={[localId]:ownInput(raw)};
  for(const id of bindings.values()){
   const queue=queues.get(id),next=queue?.shift();if(next){inputs[id]=next;lastInputs.set(id,Protocol.consume(next));}
   else inputs[id]=performance.now()-(receivedAt.get(id)||0)>250?Protocol.neutral(lastInputs.get(id)):lastInputs.get(id)||{menu:true};
  }
  const generation=world.generation;Sim.step(world,inputs,Defs.MOVE.tick);if(world.generation!==generation)transition();
  for(const [id,reservation]of reservations){if(!reservation.rescued&&performance.now()>reservation.rescueAt){const player=world.players[id];if(!player.disconnectedRescued)Sim.rescue(world,id);player.present=false;player.disconnectedRescued=true;reservation.rescued=true;save();}if(performance.now()>reservation.until)reservations.delete(id);}
  if(world.events.length){const values=world.events.splice(0);transport.broadcast({type:'events',session:sessionId,generation:world.generation,events:values},true);events(values);if(values.some(value=>['transaction','vault','rescue','boss-victory'].includes(value.type)))save();}
 }
 function advance(dt,raw={}){
  for(const [id,pending]of pendingActions)if(performance.now()>pending.until){pendingActions.delete(id);pending.resolve({ok:false,reason:'Host did not confirm this action. Reconnect before trying again.'});status('Action confirmation timed out.');}
  if(closed||!world||waiting||syncing)return;
  if(pausedByHost){if(role==='host'){snapshotAccumulator+=dt;if(snapshotAccumulator>=.5){snapshotAccumulator=0;sendFrame();}}return;}
  if(role==='guest'&&performance.now()-lastHostAt>1500){waiting=true;status('Waiting for host. Prediction has stopped.');return;}
  inputAccumulator+=Math.min(.05,dt);
  let first=true;
  while(inputAccumulator+1e-9>=Defs.MOVE.tick){
   const input={...raw};if(!first)for(const key of Protocol.edges)input[key]=false;first=false;
   if(role==='host')authoritativeTick(input);
   else{
    const next=ownInput(input);inputHistory.push(next);if(inputHistory.length>128){waiting=true;status('Waiting for host input confirmation.');return;}Movement.step(world,predicted,next,Defs.MOVE.tick);
   }
   inputAccumulator-=Defs.MOVE.tick;
  }
  if(!first)emit('input-consumed');
  if(role==='host'){
   snapshotAccumulator+=dt;dustAccumulator+=dt;saveAccumulator+=dt;
   if(snapshotAccumulator>=.05){snapshotAccumulator=0;sendFrame();}
   if(dustAccumulator>=.1){dustAccumulator=0;const cells=[...new Set(world.dirty.splice(0))].map(tile=>[tile,world.D[tile]]);if(cells.length)transport.broadcast({type:'dust',session:sessionId,generation:world.generation,cells},true);}
   if(saveAccumulator>=8){saveAccumulator=0;save();}
  }else{
   sendAccumulator+=dt;if(sendAccumulator>=1/32){sendAccumulator=0;transport.send('host',{type:'inputs',session:sessionId,generation:world.generation,inputs:inputHistory.slice(-8).map(Protocol.packInput)},false);}
  }
 }
 function perform(type,fields={}){
  if(!world||waiting||pausedByHost)return Promise.resolve({ok:false,reason:'Wait for the host.'});
  const request={...fields,type,id:++actionSequence};
  if(role==='host'){const generation=world.generation,result=Sim.action(world,localId,request);save();if(world.generation!==generation)transition();emit('transaction');if(!result.ok)status(result.reason);return Promise.resolve(result);}
  return new Promise(resolve=>{pendingActions.set(request.id,{resolve,until:performance.now()+8000});transport.send('host',{type:'action',session:sessionId,generation:world.generation,action:request},true);});
 }
 function view(){
  if(!world)return null;const player=role==='guest'?predicted:world.players[localId];if(!player)return null;
  const remote=Object.values(world.players).filter(member=>member.id!==localId&&(member.connected||member.present)).map(member=>({...copy(member),appearance:member.appearance||Defs.appearance(member),reloading:member.reloading??member.rel>0}));
  const target=performance.now()-100,older=remoteFrames.filter(frame=>frame.at<=target).at(-1),newer=remoteFrames.find(frame=>frame.at>target);
  if(older&&newer){const scale=clamp((target-older.at)/(newer.at-older.at));for(const member of remote){const before=older.players[member.id],after=newer.players[member.id];if(before&&after){for(const key of ['x','z','h','pit'])member.pose[key]=before.pose[key]+(after.pose[key]-before.pose[key])*scale;member.pose.yaw=Defs.lerpAngle(before.pose.yaw,after.pose.yaw,scale);}}}
  let enemies=world.E;
  if(older&&newer){const scale=clamp((target-older.at)/(newer.at-older.at)),before=new Map(older.E.map(enemy=>[enemy.id,enemy])),after=new Map(newer.E.map(enemy=>[enemy.id,enemy]));enemies=world.E.map(enemy=>{const first=before.get(enemy.id),last=after.get(enemy.id);return first&&last?{...enemy,x:first.x+(last.x-first.x)*scale,z:first.z+(last.z-first.z)*scale,h:(first.h||0)+((last.h||0)-(first.h||0))*scale}:enemy;});}
  return {world,player,remote,enemies,role,waiting,paused:pausedByHost,localId,saveError};
 }
 const clamp=value=>Math.max(0,Math.min(1,value));
 return {
  async host({resume=true}={}){
   role='host';sessionId=secret();const saved=resume?storage.load():null;
   if(saved){world=Sim.restart(saved.world);worldId=saved.worldId;identities=saved.identities;localId=world.hostId;}
   else{world=Sim.createWorld({dev});worldId=secret();const player=Sim.addPlayer(world,{id:'host-'+secret().slice(0,16),name});localId=player.id;identities[localId]=secret();}
   if(!world.players[localId])throw new Error('Saved host character is missing.');world.players[localId].connected=true;world.players[localId].name=name;world.hostId=localId;actionSequence=world.players[localId].lastActionId;
   transport=NSR.Transport.create({url,dev,iceTransportPolicy:relay?'relay':'all',onEvent:onTransport});
   try{const result=await transport.host();waiting=false;save();emit('world',{world});status('Room open. Share the invitation with up to three friends.');return result;}catch(error){transport.close();throw error;}
  },
  async join(invitation){role='guest';transport=NSR.Transport.create({url:invitation.url,dev,iceTransportPolicy:relay?'relay':'all',onEvent:onTransport});status('Connecting to the host…');return transport.join(invitation);},
  advance,perform,view,save,
  setPaused(value){if(role!=='host'||!world||closed)return;pausedByHost=!!value;pauseSequence++;inputAccumulator=0;lastInputs.clear();for(const queue of queues.values())queue.length=0;if(pausedByHost)save();transport.broadcast({type:'pause',session:sessionId,generation:world.generation,paused:pausedByHost,pauseSequence},true);sendFrame();emit('pause',{paused:pausedByHost});},
  stats(){lastStats={...transport?.stats(),role,corrections,tick:world?.tick,waiting,paused:pausedByHost};return lastStats;},
  exportCheckpoint(){if(role!=='host')throw new Error('Only the host can export this world.');return {format:'nsr-coop',version:1,worldId,identities,world:Sim.snapshot(world)};},
  devCommand(command,fields={}){
   if(!dev||role!=='host'||!world)return false;
   const player=world.players[localId];
   if(command==='fund')Object.assign(world.team,{cred:1e9,scrap:1e9,parts:1e6});
   else if(command==='max'){
    for(const upgrade of Defs.U){if(['ref','yld'].includes(upgrade[0]))world.team[upgrade[0]]=upgrade[5];else if(!['dmg','fr','multi'].includes(upgrade[0]))player.L[upgrade[0]]=upgrade[5];}
    for(let index=1;index<Defs.WP.length;index++)player.L['w'+index]=1;
    player.wl=Defs.WP.map(()=>({dmg:40,fr:30,multi:8}));player.mod={gr:1,dash:1};player.unl={s:1,b:1,l:1};player.att=Defs.WP.map(()=>({s:1,b:1,l:1}));
    player.hp=Defs.ST(player.L).hp;player.ammo=Defs.WP.map((weapon,index)=>Math.ceil(weapon.mag*(1+.12*player.wl[index].multi)));player.reserves=Defs.WP.map(()=>Defs.ST(player.L).reloads);player.rel=0;
   }else if(command==='clean'){world.D.fill(0);world.rem=0;world.clr=1;world.dirty=world.D.map((_,index)=>index);}
   else if(command==='resupply'){player.hp=Defs.ST(player.L).hp;player.ammo=Defs.WP.map((weapon,index)=>Math.ceil(weapon.mag*(1+.12*player.wl[index].multi)));player.reserves=Defs.WP.map(()=>Defs.ST(player.L).reloads);player.rel=0;}
   else if(command==='assist'&&['invincible','infiniteAmmo','freezeEnemies'].includes(fields.key)){world.assists={...world.assists,[fields.key]:!!fields.value};}
   else return false;
   save();sendFrame();return true;
  },
  async close(){if(closed)return;if(role==='host'){save();transport?.broadcast({type:'ended'},true);}closed=true;for(const pending of pendingActions.values())pending.resolve({ok:false,reason:'Session ended.'});await transport?.close();}
 };
}
NSR.Session={create};
})(globalThis);
