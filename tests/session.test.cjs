'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {environment}=require('./helpers/network.cjs');
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
test('an action times out even after the guest stops prediction during an outage',async()=>{
 const env=environment(),host=env.NSR.Session.create({storage:env.storage()}),guest=env.NSR.Session.create({storage:env.storage()});
 const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},20);env.setBlackout(true);
 let answer=null;const action=guest.perform('ready',{value:true}).then(result=>{answer=result;});env.advance([host,guest],{},600);await Promise.resolve();
 assert.equal(guest.view().waiting,true);assert.equal(answer?.ok,false);assert.match(answer.reason,/confirm/);await action;
 env.setBlackout(false);env.advance([host,guest],{},40);assert.equal(guest.view().waiting,false);await guest.close();await host.close();
});
test('remote equipment uses host-confirmed attachments and mastery without sharing inventory',async()=>{
 const env=environment(),host=env.NSR.Session.create({storage:env.storage()}),guest=env.NSR.Session.create({storage:env.storage()});const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},20);
 const player=host.view().player;player.L.w3=1;player.wi=3;player.att[3]={s:1,b:1,l:1};player.prog.weapons[3]={kills:200,types:[50,30,20,20]};env.advance([host,guest],{},20);
 const remote=guest.view().remote.find(member=>member.id===player.id);assert.equal(remote.wi,3);assert.equal(remote.appearance.tier,2);assert.equal(remote.appearance.attachments.s,true);assert.equal(remote.prog,undefined);
 assert.ok(Math.abs(env.NSR.Defs.lerpAngle(3.1,-3.1,.5)-Math.PI)<.01);await guest.close();await host.close();
});
