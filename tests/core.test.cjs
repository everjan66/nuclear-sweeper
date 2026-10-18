'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Definitions=require('../js/core/definitions.js'),Maps=require('../js/core/map.js'),Movement=require('../js/core/movement.js');
const Sim=require('../js/game/simulation.js');
function fixture(){const world=Sim.createWorld();world.E=[];world.Dr=[];const host=Sim.addPlayer(world,{id:'host'}),guest=Sim.addPlayer(world,{id:'guest'});return {world,host,guest};}
function openFloor(world){world.M.fill(0);world.D.fill(0);world.total=1;world.rem=1;world.TERM=null;world.DEP=[];world.SH={x:10,z:10};}
test('seeded maps are repeatable, bounded, and preserve legacy layouts',()=>{
 for(const sector of [1,2,3,4,17,100]){
  const first=Maps.generate(sector),second=Maps.generate(sector);assert.deepEqual(first,second);assert.equal(first.M.length,3600);assert.equal(first.D.length,3600);
  assert.ok(first.D.every(value=>value>=0&&value<=1));assert.ok(first.total>0);assert.equal(first.R.length,16);assert.equal(first.D[first.DEPT[0]],0);
 }
 const legacy=Maps.generate(1,{roomDesign:0}),current=Maps.generate(1);assert.notDeepEqual(legacy.M,current.M);assert.ok(legacy.R.every(room=>room.design===undefined));
});
test('movement replay retains slide, airborne dash, grapple and zipline state',()=>{
 const world=Maps.generate(1);openFloor(world);world.M[5*60+20]=1;
 const player={pose:Movement.createPose({x:20,z:20}),move:{},L:Definitions.mkL(),mod:{dash:1,gr:1}};
 const inputs=Array.from({length:200},(_,index)=>({seq:index+1,fw:true,yaw:-Math.PI/2,pit:0,crouch:index>=30&&index<55,jump:index===54,dash:index===65,grapplePressed:index===90,grapple:index>=90&&index<120}));
 const before=structuredClone(player);for(const input of inputs)Movement.step(world,player,input,1/64);
 const replay=structuredClone(before);for(const input of inputs)Movement.step(world,replay,input,1/64);assert.deepEqual(replay,player);assert.ok(Number.isFinite(player.pose.x));assert.ok(player.pose.x>20);
 const zip={x0:20,z0:20,h0:3.2,x1:40,z1:20,h1:1,L:20,len:Math.hypot(20,2.2)};world.ZIP=[zip];
 for(const [direction,position]of [[1,.1],[-1,.9]]){const rider={...structuredClone(before),pose:{...before.pose,x:20+20*position,z:20,h:3.2-2.2*position,st:6,g:0,zp:{z:zip,t:position,dir:direction,sp:6}}};Movement.step(world,rider,{},1/64);assert.equal(Math.sign(rider.pose.vx),direction);}
});
test('two collectors conserve the last dust without creating tank contents',()=>{
 const {world,host,guest}=fixture();openFloor(world);host.pose.x=guest.pose.x=41;host.pose.z=guest.pose.z=41;
 const tile=20*60+20;world.D[tile]=.001;world.total=world.rem=.001;
 Sim.step(world,{});assert.equal(world.D[tile],0);assert.ok(Math.abs(host.tank+guest.tank-.01)<1e-10);assert.ok(Math.abs(host.prog.dust+guest.prog.dust-.01)<1e-10);assert.equal(world.rem,0);
});
test('one loot object is credited once and rescue leaves other projectiles alive',()=>{
 const {world,host,guest}=fixture();openFloor(world);host.pose.x=guest.pose.x=41;host.pose.z=guest.pose.z=41;
 world.Dr=[{id:'loot',x:41,z:41,y:.4,vx:0,vz:0,k:'scrap',a:7}];Sim.step(world,{});assert.equal(world.team.scrap,7);assert.equal(world.Dr.length,0);
 world.EP=[{id:'bullet',x:50,y:1,z:50,vx:1,vy:0,vz:0,l:3,dm:2}];host.tank=40;Sim.rescue(world,'host');assert.equal(world.EP.length,1);assert.equal(guest.pose.x,41);assert.equal(world.team.raw,20);Sim.rescue(world,'host');assert.equal(world.team.raw,20);
});
test('concurrent purchases cannot overdraw team funds and duplicate actions are idempotent',()=>{
 const {world,host,guest}=fixture();world.team.scrap=8;
 const request={id:1,type:'buy',upgrade:'sweep'};assert.equal(Sim.action(world,'host',request).ok,true);assert.equal(Sim.action(world,'host',request).ok,true);assert.equal(Sim.action(world,'guest',request).ok,false);assert.equal(host.L.sweep,1);assert.equal(guest.L.sweep,0);assert.equal(world.team.scrap,0);
 host.pose.x=80;world.team.scrap=100;assert.equal(Sim.action(world,'host',{...request,id:2}).ok,false);
});
test('station upgrades are shared while gear and weapon upgrades remain personal',()=>{
 const {world,host,guest}=fixture();world.team.cred=1000;
 assert.equal(Sim.action(world,'host',{id:1,type:'buy',upgrade:'ref'}).ok,true);assert.equal(world.team.ref,1);assert.equal(guest.L.ref,0);
 assert.equal(Sim.action(world,'host',{id:2,type:'buy',upgrade:'dmg',weapon:0}).ok,true);assert.equal(host.wl[0].dmg,1);assert.equal(guest.wl[0].dmg,0);
 assert.equal(Sim.action(world,'guest',{id:1,type:'buy',upgrade:'dmg',weapon:6}).ok,false);
});
test('collateral and repeated lethal hits assign each kill once to the shooter',()=>{
 const {world,host,guest}=fixture();openFloor(world);host.pose={...host.pose,x:40,z:40,yaw:0,pit:0};guest.pose={...guest.pose,x:40,z:40,yaw:0,pit:0};
 world.E=[{id:'enemy',x:40,z:36,t:0,hp:1,mh:30,al:1,cd:1,fc:1,ph:0}];
 Sim.step(world,{host:{fire:true},guest:{fire:true}});assert.equal(host.kills+guest.kills,1);assert.equal(host.kills,1);assert.equal(host.score.run,120);assert.ok(world.Dr.length>=1);
 Sim.recordKill(world,guest,{id:'dead',counted:true,t:0},0,true);assert.equal(guest.kills,0);
 world.E=[{id:'near',x:40,z:36,t:0,hp:30,mh:30},{id:'far',x:40,z:32,t:0,hp:30,mh:30}];
 const origin={x:40,y:1.5,z:40},direction={x:0,y:0,z:-1};assert.equal(Sim.cast(world,origin,direction,70).enemy.id,'near');assert.equal(Sim.cast(world,origin,direction,70,new Set(['near'])).enemy.id,'far');
 world.M[19*60+20]=1;assert.equal(Sim.cast(world,origin,direction,70).enemy,null);
});
test('AI can target a guest while the host is sheltered',()=>{
 const {world,host,guest}=fixture();openFloor(world);host.pose.x=10;host.pose.z=10;guest.pose.x=40;guest.pose.z=40;
 world.E=[{id:'enemy',x:41,z:41,t:0,hp:30,mh:30,al:1,cd:0,fc:1,ph:0}];Sim.step(world,{});assert.equal(world.E[0].target,'guest');assert.ok(guest.hp<100);assert.equal(host.hp,100);
});
test('deployment requires the host, clearance and readiness; old generations change',()=>{
 const {world,host,guest}=fixture();world.clr=1;host.ready=true;assert.equal(Sim.action(world,'host',{id:1,type:'deploy'}).ok,false);
 guest.ready=true;assert.equal(Sim.action(world,'guest',{id:1,type:'deploy'}).ok,false);assert.equal(Sim.action(world,'host',{id:2,type:'deploy'}).ok,true);assert.equal(world.generation,2);assert.equal(world.sector,2);assert.equal(host.ready,false);assert.equal(world.hostId,'host');
});
test('checkpoint roundtrip and restart preserve resources without offline income or duplicate deposit',()=>{
 const {world,host}=fixture();host.tank=25;host.bladeCd=-400;world.team.raw=10;
 const restored=Sim.restore(Sim.snapshot(world));assert.equal(restored.players.host.tank,25);assert.equal(restored.team.raw,10);
 Sim.restart(restored);assert.equal(restored.team.raw,35);Sim.restart(restored);assert.equal(restored.team.raw,35);assert.equal(restored.EP.length,0);
 const corrupt=Sim.snapshot(world);corrupt.D[0]=-1;assert.throws(()=>Sim.restore(corrupt));
 corrupt.D[0]=0;corrupt.M[0]=0;assert.throws(()=>Sim.restore(corrupt));
});
test('shared radio progress and personal achievements survive checkpoint restore',()=>{
 const {world,host}=fixture();host.prog.dust=500;host.prog.enemies[0]=10;host.score.total=10000;host.score.chain=5;
 Sim.step(world,{});assert.equal(world.story,1);assert.equal(world.events.filter(event=>event.type==='story').length,1);
 for(const id of ['dust0','enemy0_10','points10000','streak5'])assert.ok(host.prog.ach.includes(id));
 const restored=Sim.restore(Sim.snapshot(world));assert.equal(restored.story,1);assert.deepEqual(restored.players.host.prog.ach,host.prog.ach);
 world.rem=world.total*.02;for(let tick=0;tick<5;tick++)Sim.step(world,{});assert.equal(world.story,5);assert.equal(world.clr,1);
});
test('a disconnected character remains vulnerable and can only be rescued once',()=>{
 const {world,guest}=fixture();world.D.fill(0);world.rem=0;guest.tank=20;Sim.disconnect(world,guest.id);assert.equal(guest.present,true);assert.equal(guest.ready,false);
 openFloor(world);guest.pose.x=40;guest.pose.z=40;guest.hp=.1;world.E=[{id:'enemy',x:41,z:41,t:0,hp:30,mh:30,al:1,cd:0,fc:1,ph:0}];Sim.step(world,{});const raw=world.team.raw;assert.equal(guest.disconnectedRescued,true);assert.equal(guest.tank,0);assert.equal(raw,10);
 Sim.rescue(world,guest.id);assert.equal(world.team.raw,raw);assert.equal(world.events.filter(event=>event.type==='rescue').length,1);
});
test('checkpoint restore retains the spawn schedule and rejects invalid ledge state',()=>{
 const {world,host}=fixture();world.spawnT=.75;const restored=Sim.restore(Sim.snapshot(world));assert.equal(restored.spawnT,.75);
 const corrupt=Sim.snapshot(world);corrupt.players.host.pose.st=2;corrupt.players.host.pose.hd={x:1,z:0};corrupt.players.host.pose.hT=null;assert.throws(()=>Sim.restore(corrupt));
});
test('a ranged enemy at the target position keeps finite movement and projectile state',()=>{
 const {world,guest}=fixture();openFloor(world);guest.pose.x=40;guest.pose.z=40;world.E=[{id:'coincident',x:40,z:40,t:1,hp:30,mh:30,al:1,cd:0,fc:0,ph:0}];
 Sim.step(world,{});for(const entity of [...world.E,...world.EP])for(const key of ['x','z'])assert.ok(Number.isFinite(entity[key]));
 for(const projectile of world.EP)for(const key of ['y','vx','vy','vz'])assert.ok(Number.isFinite(projectile[key]));
});
