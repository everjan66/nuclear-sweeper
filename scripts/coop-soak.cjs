'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{performance}=require('node:perf_hooks');
const {environment}=require('../tests/helpers/network.cjs');
async function runSoak({seconds=1800,onProgress=()=>{}}={}){
 const started=performance.now(),env=environment({latency:150,loss:.02,jitter:45}),hostStore=env.storage(),guestStores=Array.from({length:3},()=>env.storage()),errors=[];
 const options=storage=>({storage,onEvent:event=>{if(event.type==='error')errors.push(event.message);}});
 let host=env.NSR.Session.create(options(hostStore)),guests=guestStores.map(storage=>env.NSR.Session.create(options(storage))),invitation=(await host.host()).invitation;
 for(const guest of guests)await guest.join(invitation);
 let sessions=[host,...guests],world=host.view().world,maxStepMs=0,maxQueued=0,purchases=0,deployments=0,reconnects=0,rescues=0,restores=0;
 env.advance(sessions,{},40);const identities=guests.map(guest=>guest.view().localId);
 function checkpoint(){assert.ok(host.save());try{return hostStore.load();}catch(error){error.message+=' '+JSON.stringify({sector:world.sector,tick:world.tick,entities:Object.fromEntries(['E','Dr','EP'].map(key=>[key,{count:world[key].length,invalid:world[key].filter(entity=>!entity||typeof entity.id!=='string'||!Number.isFinite(entity.x)||!Number.isFinite(entity.z)||entity.x< -100||entity.x>300||entity.z< -100||entity.z>300).slice(0,3)}]))});throw error;}}
 function advance(ticks=64,inputs={}){const before=performance.now();env.advance(sessions,inputs,ticks);maxStepMs=Math.max(maxStepMs,(performance.now()-before)/ticks);maxQueued=Math.max(maxQueued,env.pending());}
 function shelter(){for(const player of Object.values(world.players)){player.pose=env.NSR.Movement.createPose(world.SH);player.move={};player.ready=false;}}
 function field(){const tile=world.M.findIndex((value,index)=>value===0&&Math.hypot((index%60+.5)*2-world.SH.x,((index/60|0)+.5)*2-world.SH.z)>20&&world.D[index]>.2);assert.ok(tile>=0);Object.values(world.players).forEach((player,index)=>{player.pose=env.NSR.Movement.createPose({x:(tile%60+.5)*2,z:((tile/60|0)+.5)*2-4});player.pose.yaw=index*Math.PI/2;player.move={};});}
 async function purchase(){
  shelter();advance(40);const price=Math.min(...guests.map(guest=>env.NSR.Defs.cost(env.NSR.Defs.U[0],world.players[guest.view().localId].L.sweep)));world.team.scrap=price;
  const before=Object.values(world.players).reduce((total,player)=>total+player.L.sweep,0),requests=guests.map(guest=>guest.perform('buy',{upgrade:'sweep'}));advance(40);
  const results=await Promise.all(requests);assert.equal(results.filter(result=>result.ok).length,1);assert.equal(Object.values(world.players).reduce((total,player)=>total+player.L.sweep,0),before+1);assert.ok(world.team.scrap>=0);purchases++;
 }
 async function deploy(){
  shelter();advance(40);world.D.fill(0);const remaining=world.M.findIndex((value,index)=>value===0&&Math.hypot((index%60+.5)*2-world.SH.x,((index/60|0)+.5)*2-world.SH.z)>20);assert.ok(remaining>=0);world.D[remaining]=.01;world.rem=.01;world.clr=1;world.dirty=world.D.map((_,index)=>index);
  const requests=sessions.map(session=>session.perform('ready',{value:true}));advance(40);assert.ok((await Promise.all(requests)).every(result=>result.ok));
  const generation=world.generation;assert.equal((await host.perform('deploy')).ok,true);advance(40);assert.equal(world.generation,generation+1);
  for(const guest of guests){assert.equal(guest.view().world.generation,world.generation);assert.equal(guest.view().world.sector,world.sector);}deployments++;field();
 }
 async function reconnect(){
  const id=identities[0];await guests[0].close();sessions=[host,...guests.slice(1)];advance(12*64);assert.equal(world.players[id].disconnectedRescued,true);assert.equal(world.players[id].present,false);rescues++;
  guests[0]=env.NSR.Session.create(options(guestStores[0]));await guests[0].join(invitation);sessions=[host,...guests];advance(40);assert.equal(guests[0].view().localId,id);assert.equal(Object.keys(world.players).length,4);reconnects++;
 }
 async function restart(){
  for(const guest of guests)await guest.close();await host.close();const saved=hostStore.load(),raw=saved.world.team.raw+Object.values(saved.world.players).reduce((total,player)=>total+player.tank,0),credits=saved.world.team.cred,spawn=saved.world.spawnT;
  host=env.NSR.Session.create(options(hostStore));invitation=(await host.host()).invitation;world=host.view().world;assert.ok(Math.abs(world.team.raw-raw)<1e-6);assert.equal(world.team.cred,credits);assert.equal(world.spawnT,spawn);
  guests=guestStores.map(storage=>env.NSR.Session.create(options(storage)));for(const guest of guests)await guest.join(invitation);sessions=[host,...guests];advance(40);
  guests.forEach((guest,index)=>assert.equal(guest.view().localId,identities[index]));assert.equal(Object.keys(world.players).length,4);restores++;
 }
 field();
 for(let second=0;second<seconds;second++){
  const phase=second%120;
  if(phase===30){const player=world.players[identities[1]];player.tank=Math.max(player.tank,20);player.pose=env.NSR.Movement.createPose({x:world.TERM.x,z:world.TERM.z-4});advance(10);assert.equal(world.vOpen,1);}
  if(phase===50)await purchase();
  if(phase===70&&second>120)await reconnect();
  if(phase===90)await deploy();
  if(second===Math.floor(seconds/2))await restart();
  if(phase===15){host.setPaused(true);const tick=world.tick;advance(3*64);assert.equal(world.tick,tick);assert.ok(guests.every(guest=>guest.view().paused));host.setPaused(false);}
  const inputs={};for(let index=0;index<4;index++)inputs[index]={yaw:Math.sin(second*.12+index)*Math.PI,pit:0,fw:phase<28,rt:phase>=5&&phase<20,fire:phase<40&&second%2===0,menu:phase>=40};
  advance(64,inputs);
  for(const player of Object.values(world.players))for(const key of ['x','z','h','vx','vz'])assert.ok(Number.isFinite(player.pose[key]));
  for(const key of ['cred','scrap','parts','raw'])assert.ok(Number.isFinite(world.team[key])&&world.team[key]>=0);
  if(second%60===0){const checked=checkpoint();assert.equal(Object.keys(checked.world.players).length,4);onProgress({second,sector:world.sector,entities:world.E.length,loot:world.Dr.length});await new Promise(resolve=>setImmediate(resolve));}
 }
 shelter();advance(128);host.setPaused(true);advance(64);
 for(const guest of guests){const view=guest.view();assert.equal(view.waiting,false);for(const key of ['cred','scrap','parts'])assert.ok(Math.abs(view.world.team[key]-world.team[key])<1e-6);const authoritative=world.players[view.localId];assert.ok(Math.hypot(authoritative.pose.x-view.player.pose.x,authoritative.pose.z-view.player.pose.z)<.25);}
 assert.deepEqual(errors,[]);assert.ok(checkpoint());
 const report={scenario:'four-player deterministic network soak',requestedSeconds:seconds,simulatedSeconds:Math.round(env.now()/1000),wallSeconds:+((performance.now()-started)/1000).toFixed(2),latencyMs:150,jitterMs:45,unreliableLoss:.02,players:4,purchases,deployments,reconnects,rescues,restores,errors:errors.length,bytes:env.traffic.bytes,averageKbps:+(env.traffic.bytes*8/env.now()).toFixed(1),bytesByType:env.traffic.byType,droppedMessages:env.traffic.dropped,maxQueuedMessages:maxQueued,maxBatchAverageMillisecondsPerTick:+maxStepMs.toFixed(3),finalSector:world.sector};
 for(const guest of guests)await guest.close();await host.close();return report;
}
module.exports={runSoak};
if(require.main===module){const minutes=Number(process.argv[2]||30);if(!Number.isFinite(minutes)||minutes<.1||minutes>120)throw new Error('Choose 0.1-120 simulated minutes.');runSoak({seconds:Math.round(minutes*60),onProgress:progress=>{if(progress.second%300===0)console.log('Soak progress: '+progress.second+' seconds, site '+progress.sector);}}).then(report=>{console.log(JSON.stringify(report,null,2));if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');}).catch(error=>{console.error(error);process.exitCode=1;});}
