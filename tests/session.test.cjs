'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
function environment({latency=0,loss=0}={}){
 let time=0,hostEndpoint=null,guestCount=0,packetCount=0;
 const endpoints=new Map(),packets=[];
 const context=vm.createContext({console,crypto:crypto.webcrypto,performance:{now:()=>time},URL,URLSearchParams,btoa,atob});
 for(const file of ['core/definitions','core/map','core/movement','game/simulation','net/protocol','storage/coop','net/session'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),context);
 context.NSR.Transport={create({onEvent}){
  const endpoint={id:null,onEvent};
  function send(id,value,reliable=true){const destination=endpoint.id==='host'?endpoints.get(id):hostEndpoint;if(!destination)return false;packetCount++;if(!reliable&&loss&&packetCount%Math.round(1/loss)===0)return true;packets.push({at:time+latency/2,destination,source:endpoint.id==='host'?'host':endpoint.id,value:JSON.parse(JSON.stringify(value)),reliable});return true;}
  return {
   async host(){endpoint.id='host';hostEndpoint=endpoint;endpoints.set('host',endpoint);return {invitation:{url:'http://localhost',room:'r'.repeat(24),token:'t'.repeat(32)}};},
   async join(){endpoint.id='guest-'+(++guestCount);endpoints.set(endpoint.id,endpoint);onEvent({type:'peer-open',peerId:'host'});hostEndpoint.onEvent({type:'peer-open',peerId:endpoint.id});return endpoint.id;},
   send,broadcast(value,reliable=true){for(const id of endpoints.keys())if(id!=='host')send(id,value,reliable);},
   stats(){return {peers:[...endpoints.keys()].filter(id=>id!==endpoint.id).map(id=>({id,ping:latency,path:'fake',queuedBytes:0})),bytesSent:0};},
   async close(){endpoints.delete(endpoint.id);if(endpoint.id!=='host')hostEndpoint.onEvent({type:'peer-close',peerId:endpoint.id});}
  };
 }};
 function storage(){const values=new Map();return context.NSR.Storage.create({storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}});}
 function deliver(){let delivered=true;while(delivered){delivered=false;for(let index=packets.length-1;index>=0;index--)if(packets[index].at<=time){const packet=packets.splice(index,1)[0];packet.destination.onEvent({type:'message',peerId:packet.source,data:packet.value,reliable:packet.reliable});delivered=true;}}}
 function advance(sessions,inputs={},ticks=1){for(let tick=0;tick<ticks;tick++){time+=1000/64;deliver();for(let index=0;index<sessions.length;index++)sessions[index].advance(1/64,inputs[index]||{yaw:0,pit:0,menu:true});deliver();}}
 return {NSR:context.NSR,storage,advance,deliver};
}
test('guest prediction converges at 150 ms RTT and 2% loss; stale input stops and actions confirm',async()=>{
 const env=environment({latency:150,loss:.02}),host=env.NSR.Session.create({name:'Host',storage:env.storage()}),guest=env.NSR.Session.create({name:'Guest',storage:env.storage()});
 const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},40);assert.ok(guest.view());
 const world=host.view().world;world.E=[];world.Dr=[];world.M.fill(0);world.D.fill(0);world.TERM=null;world.DEP=[];guest.view().world.M.fill(0);
 const guestId=guest.view().localId;world.players[guestId].pose.x=30;world.players[guestId].pose.z=30;
 env.advance([host,guest],{1:{yaw:0,pit:0,fw:true}},120);env.advance([host,guest],{1:{yaw:0,pit:0}},40);
 const authoritative=world.players[guestId].pose,predicted=guest.view().player.pose;assert.ok(Math.hypot(authoritative.x-predicted.x,authoritative.z-predicted.z)<.2);assert.ok(authoritative.z<30);
 world.players[guestId].pose.x=world.SH.x;world.players[guestId].pose.z=world.SH.z;world.team.scrap=8;env.advance([host,guest],{},20);
 const action=guest.perform('buy',{upgrade:'sweep'});env.advance([host,guest],{},30);assert.equal((await action).ok,true);assert.equal(world.players[guestId].L.sweep,1);assert.equal(world.team.scrap,0);
 host.setPaused(true);const pausedTick=world.tick;env.advance([host,guest],{},150);assert.equal(world.tick,pausedTick);assert.equal(guest.view().paused,true);
 host.setPaused(false);env.advance([host,guest],{},20);assert.ok(world.tick>pausedTick);
 await guest.close();assert.equal(world.players[guestId].connected,false);
 env.advance([host],{},650);assert.equal(world.players[guestId].tank,0);
 await host.close();
});
test('rejoining with a stored identity restores exactly one character',async()=>{
 const env=environment(),guestStorage=env.storage(),host=env.NSR.Session.create({storage:env.storage()}),first=env.NSR.Session.create({storage:guestStorage});
 const result=await host.host();await first.join(result.invitation);env.advance([host,first],{},10);const id=first.view().localId;host.view().world.players[id].L.sweep=3;
 await first.close();const second=env.NSR.Session.create({storage:guestStorage});await second.join(result.invitation);env.advance([host,second],{},10);
 assert.equal(second.view().localId,id);assert.equal(second.view().player.L.sweep,3);assert.equal(Object.keys(host.view().world.players).length,2);
 await second.close();await host.close();
});
test('four clients agree on contested funds, personal gear and deployment generation',async()=>{
 const env=environment({latency:150,loss:.02}),host=env.NSR.Session.create({storage:env.storage()}),guests=Array.from({length:3},()=>env.NSR.Session.create({storage:env.storage()}));
 const result=await host.host();for(const guest of guests)await guest.join(result.invitation);const sessions=[host,...guests];env.advance(sessions,{},40);
 const world=host.view().world;assert.equal(Object.keys(world.players).length,4);world.team.scrap=8;
 const purchases=guests.map(guest=>guest.perform('buy',{upgrade:'sweep'}));env.advance(sessions,{},30);assert.equal((await Promise.all(purchases)).filter(result=>result.ok).length,1);assert.equal(world.team.scrap,0);
 assert.equal(Object.values(world.players).reduce((sum,player)=>sum+player.L.sweep,0),1);
 const readiness=sessions.map(session=>session.perform('ready',{value:true}));env.advance(sessions,{},30);assert.ok((await Promise.all(readiness)).every(result=>result.ok));
 world.clr=1;assert.equal((await host.perform('deploy')).ok,true);env.advance(sessions,{},40);
 for(const session of sessions){assert.equal(session.view().world.sector,2);assert.equal(session.view().world.generation,2);assert.equal(session.view().waiting,false);}
 for(const guest of guests)await guest.close();await host.close();
});
