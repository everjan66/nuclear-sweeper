'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../js/core/definitions.js');
const Movement=require('../js/core/movement.js'),Presentation=require('../js/ui/presentation.js');
const Sim=require('../js/game/simulation.js');
const {environment}=require('./helpers/network.cjs');
test('frame limiter paces rendered frames without accumulating debt or capping unlimited mode',()=>{
 for(const refresh of [60,144,240])for(const limit of [30,60,120]){
  const clock=Presentation.createFrameClock();let frames=0;
  for(let index=0;index<refresh*5;index++)if(clock.due(index*1000/refresh,limit))frames++;
  assert.ok(Math.abs(frames-Math.min(refresh,limit)*5)<=1,`${refresh} Hz / ${limit} cap: ${frames}`);
 }
 const clock=Presentation.createFrameClock();assert.equal(clock.due(0,30),true);assert.equal(clock.due(1,30),false);
 assert.equal(clock.due(2,60),true);assert.equal(clock.due(3,0),true);assert.equal(clock.due(4,0),true);
 assert.equal(clock.due(10000,30),true);assert.equal(clock.due(10001,30),false);
});
test('FPS measurement counts rendered frames rather than animation callbacks',()=>{
 const clock=Presentation.createFrameClock();let measured=0;
 for(let index=0;index<=240;index++)if(clock.due(index*1000/240,30))measured=clock.rendered(index*1000/240);
 assert.equal(measured,30);
});
test('render poses interpolate position and stance but never delay look or mutate simulation',()=>{
 const previous=Movement.createPose({x:10,z:10}),current={...previous,x:12,h:1,low:1,yaw:2,pit:.7,rl:.2};
 const before=structuredClone(current),visual=Movement.renderPose(previous,current,.5);
 assert.equal(visual.x,11);assert.equal(visual.h,.5);assert.equal(visual.eyeHeight,1.175);assert.equal(visual.rl,.1);
 assert.equal(visual.yaw,2);assert.equal(visual.pit,.7);assert.deepEqual(current,before);
 assert.equal(Movement.renderPose(previous,current,-1).x,10);assert.equal(Movement.renderPose(previous,current,2).x,12);
 assert.deepEqual(Movement.renderPose(previous,{...current,x:90},.5),{...current,x:90});
 assert.deepEqual(Movement.renderPose(null,current,.5),current);
});
test('damage direction stays relative to current look for front, back and side hits',()=>{
 const pose={x:10,z:10,yaw:0},angle=source=>Presentation.damageAngle(pose,source);
 assert.equal(angle({x:10,z:0}),0);assert.equal(angle({x:20,z:10}),Math.PI/2);
 assert.equal(angle({x:0,z:10}),-Math.PI/2);assert.equal(Math.abs(angle({x:10,z:20})),Math.PI);
 pose.yaw=Math.PI/2;assert.equal(angle({x:0,z:10}),0);
});
test('projectile hurt events carry incoming direction and respect invincibility',()=>{
 for(const invincible of [false,true]){
  const world=Sim.createWorld({dev:invincible}),player=Sim.addPlayer(world,{id:'local'});
  world.M.fill(0);world.E=[];world.Dr=[];world.D.fill(0);world.D[3599]=1;world.total=world.rem=1;
  player.pose.x=40;player.pose.z=40;world.assists={invincible};
  world.EP=[{x:39.7,y:1,z:40,vx:10,vy:0,vz:0,l:3,dm:5}];
  Sim.step(world,{local:{yaw:0,pit:0}});
  const hit=world.events.find(event=>event.type==='hurt');
  if(invincible)assert.equal(hit,undefined);else{assert.equal(hit.playerId,'local');assert.ok(hit.source.x<player.pose.x);assert.equal(hit.source.z,40);}
 }
});
test('host presentation interpolates between ticks without changing its authoritative player',async()=>{
 const env=environment(),host=env.NSR.Session.create({storage:env.storage()});await host.host();
 const world=host.view().world;world.M.fill(0);world.E=[];world.Dr=[];
 host.advance(1/64,{fw:true,yaw:0,pit:0});
 const first=host.view(),position=first.player.pose.z;
 host.advance(1/128,{fw:true,yaw:0,pit:0});
 const next=host.view();assert.equal(next.player.pose.z,position);assert.ok(next.renderPose.z<first.renderPose.z);assert.ok(next.renderPose.z>=position);
 host.setPaused(true);assert.equal(host.view().renderPose.z,position);await host.close();
});
test('co-op view refresh preserves unsent mouse look and does not alias simulation pose',()=>{
 const html=fs.readFileSync('nuclear-sweeper-reactor.html','utf8'),source=html.match(/function applyCoopView\(preserveLook=true\)\{[\s\S]*?\n\}/)[0];
 const pose={x:10,z:10,h:0,yaw:0,pit:0},world={team:{},E:[],EP:[],Dr:[]};
 const context=vm.createContext({coopSession:{view:()=>({world,player:{pose,wi:0,L:{}},renderPose:pose,enemies:[],remote:[]})},p:{yaw:1.2,pit:.4},wi:0,fresh:()=>({}),applyWeaponSkin(){},camCalc(){},ads:false});
 vm.runInContext(source+';applyCoopView();',context);
 assert.equal(context.p.yaw,1.2);assert.equal(context.p.pit,.4);assert.notEqual(context.p,pose);assert.equal(pose.yaw,0);
 vm.runInContext('applyCoopView(false)',context);assert.equal(context.p.yaw,0);
});
