'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {environment}=require('./helpers/network.cjs'),{MOVE}=require('../js/core/definitions.js');
const source=fs.readFileSync('nuclear-sweeper-reactor.html','utf8');
function solo(){
 const context=vm.createContext({last:0,MOVE,moveAcc:0,p:{},previousPose:null,gameStarted:true,coopSession:null,paused:false,ticks:0,refine(){},upd(){context.ticks++},frameClock:{due:()=>false},CFG:{fpsLimit:0},requestAnimationFrame(){}});
 vm.runInContext(source.slice(source.indexOf('function loop(now)'),source.indexOf('coopUI=NSR.CoopUI.install')),context);return context;
}
test('solo fixed steps retain elapsed time across callback rates and bound long stalls',()=>{
 for(const fps of [10,30,60,144]){const c=solo();for(let i=1;i<=fps*2;i++)c.loop(i*1000/fps);assert.equal(c.ticks,128);assert.ok(c.moveAcc<MOVE.tick);c.paused=true;c.loop(10000);assert.equal(c.ticks,128);c.paused=false;c.loop(10000+1000/64);assert.equal(c.ticks,129);}
 const c=solo();c.loop(10000);assert.equal(c.ticks,16);c.loop(10000+1000/64);assert.equal(c.ticks,17);
});
test('host catch-up retains elapsed time and consumes edge input once per callback',async()=>{
 for(const fps of [10,30,60,144]){
  let pendingJump=true;const env=environment(),host=env.NSR.Session.create({storage:env.storage(),onEvent:event=>{if(event.type==='input-consumed')pendingJump=false;}});await host.host();const world=host.view().world;let edges=0;
  const original=env.NSR.Movement.step;env.NSR.Movement.step=(world,player,input,dt)=>{if(input.jump)edges++;return original(world,player,input,dt)};
  for(let i=0;i<fps*2;i++)host.advance(1/fps,{yaw:0,pit:0,fw:true,jump:pendingJump});
  assert.equal(world.tick,128);assert.equal(edges,1);
  host.setPaused(true);host.advance(10,{fw:true});assert.equal(world.tick,128);host.setPaused(false);host.advance(1/64,{});assert.equal(world.tick,129);
  host.advance(10,{});assert.equal(world.tick,145);host.advance(1/64,{});assert.equal(world.tick,146);await host.close();
 }
});

test('low-rate guest callbacks transmit every catch-up input within the protocol batch',async()=>{
 for(const fps of [4,10,30,60,144]){
  const env=environment(),host=env.NSR.Session.create({storage:env.storage()}),guest=env.NSR.Session.create({storage:env.storage()});
  const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},10);
  const world=host.view().world,id=guest.view().localId,initial=world.players[id].lastSeq,tick=world.tick;
  env.advance([host,guest],{1:{yaw:0,pit:0,fw:true}},fps*2,1/fps);
  assert.equal(world.tick-tick,128);assert.ok(world.players[id].lastSeq-initial>=112,`guest input progress at ${fps} FPS`);assert.equal(guest.view().waiting,false);
  await guest.close();await host.close();
 }
});
