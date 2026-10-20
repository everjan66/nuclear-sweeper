'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Defs=require('../js/core/definitions.js'),Maps=require('../js/core/map.js'),Movement=require('../js/core/movement.js'),Sim=require('../js/game/simulation.js');
function playerAt(world,x,z){return {pose:{...Movement.createPose(world.SH),x,z},L:Defs.mkL(),mod:{gr:0,dash:0},move:{}};}
test('all sites include three double-footprint halls, distinct designs and clear entrances',()=>{
 for(let sector=1;sector<=100;sector++){
  const world=Maps.generate(sector),legacy=Maps.generate(sector,{roomDesign:1}),rooms=world.R.filter(room=>room.large);
  assert.equal(rooms.length,3);assert.equal(new Set(rooms.map(room=>room.design)).size,3);
  const start=(world.SH.z/2|0)*60+(world.SH.x/2|0),connected=new Set([start]),queue=[start];
  for(let index=0;index<queue.length;index++){const tile=queue[index],column=tile%60,row=tile/60|0;
   for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=column+dx,z=row+dz,next=z*60+x;
    if(x>=0&&x<60&&z>=0&&z<60&&world.M[next]!==1&&!connected.has(next)){connected.add(next);queue.push(next)}}}
  for(const room of rooms){const old=legacy.R[world.R.indexOf(room)],area=(old.x1-old.x0+1)*(old.z1-old.z0+1);
   assert.equal(room.baseArea,area);assert.ok((room.x1-room.x0+1)*(room.z1-room.z0+1)>=area*2);assert.equal(room.ceiling,9.6);
   assert.ok(room.x0>0&&room.z0>0&&room.x1<59&&room.z1<59);assert.equal(world.M[room.cz*60+room.cx],0);assert.ok(connected.has(room.cz*60+room.cx));
   assert.equal(room.lasers.length,2);assert.ok(world.M.slice(room.z0*60,(room.z1+1)*60).includes(6));
  }
  assert.deepEqual(world,Maps.generate(sector));
 }
});
test('legacy map versions retain their exact geometry, dust and metadata',()=>{
 for(const [version,hash]of [[0,'c6fd998533a79e4a542dcd3bbd5bd7dc9af8eed21ca6e3839a08d2c6cfcf5900'],[1,'ec41c5361bae7280c880668332a8e0dc15b1371c6bfa70e65ae5c913805e0941']]){
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(Maps.generate(1,{roomDesign:version}))).digest('hex'),hash);
 }
});
test('every corner platform is reachable with baseline boots and no grapple',()=>{
 for(let sector=1;sector<=100;sector++){const world=Maps.generate(sector);
  for(const room of world.R.filter(room=>room.large))for(const side of[-1,1])for(const end of[-1,1]){
   const edgeX=side<0?room.x0+1:room.x1-1,edgeZ=end<0?room.z0+1:room.z1-1,player=playerAt(world,(edgeX-side*3+.5)*2,(edgeZ+end+.5)*2);
   const targets=[[edgeX-side*3,edgeZ,1.1],[edgeX-side*2,edgeZ,2.2],[edgeX-side,edgeZ,3.2]];let stage=0;
   for(let tick=0;tick<600&&stage<targets.length;tick++){const [x,z,height]=targets[stage],dx=(x+.5)*2-player.pose.x,dz=(z+.5)*2-player.pose.z;
    Movement.step(world,player,{fw:Math.hypot(dx,dz)>.1,jump:tick%24===0,yaw:Math.atan2(-dx,-dz)},1/64);
    if(player.pose.h>=height-.05&&Math.hypot(dx,dz)<1&&player.pose.st===0)stage++}
   assert.equal(stage,targets.length,`site ${sector}, design ${room.design}, corner ${side}/${end}`);
  }
 }
});
test('high ceilings support grapples while regular ceilings and upper walls stay solid',()=>{
 const world=Maps.generate(1),room=world.R.find(room=>room.large),x=(room.cx+.5)*2,z=(room.cz+.5)*2;
 assert.equal(Maps.ceiling(world,x,z),9.6);assert.equal(Movement.solid(world,x,8,z),false);assert.equal(Movement.solid(world,x,9.7,z),true);
 assert.equal(Movement.solid(world,world.SH.x,7,world.SH.z),true);assert.equal(Movement.solid(world,0,8,0),true);
 const player=playerAt(world,x,z);player.mod.gr=1;Movement.step(world,player,{grapplePressed:true,grapple:true,pit:1.45},1/64);
 assert.ok(player.pose.gr);assert.ok(player.pose.gr.y>9.5);
 for(let tick=0;tick<50;tick++)Movement.step(world,player,{grapple:true,pit:1.45},1/64);
 assert.ok(player.pose.h>4.6);assert.ok(player.pose.h+1.8<=9.6+.001);
 assert.equal(Movement.collide(world,world.SH.x,world.SH.z,.4,5,1.8),1);
});
test('lasers telegraph, cycle, respect player height and allow end-runs',()=>{
 const world=Maps.generate(1),room=world.R.find(room=>room.large),laser=room.lasers[0],time=2-laser.phase,pose={x:(laser.x0+laser.x1)/2,z:laser.z,h:0,low:0};
 assert.equal(Maps.laserState(laser,.7-laser.phase),'warning');assert.equal(Maps.laserState(laser,time),'active');assert.equal(Maps.laserState(laser,5-laser.phase),'off');
 assert.equal(Maps.laserDamage(world,pose,time),18);assert.equal(Maps.laserDamage(world,pose,5-laser.phase),0);
 assert.equal(Maps.laserDamage(world,{...pose,h:1.1},time),0);assert.equal(Maps.laserDamage(world,{...pose,x:laser.x0-1},time),0);
 const elevated=room.lasers[1],upper={x:elevated.x0,z:elevated.z,h:3.2,low:0};assert.equal(Maps.laserDamage(world,upper,2-elevated.phase),18);
 assert.equal(Maps.laserDamage(world,{...upper,h:0},2-elevated.phase),0);
});
test('co-op laser contact deals gradual damage and honors invincibility',()=>{
 for(const invincible of[false,true]){const world=Sim.createWorld({dev:true}),player=Sim.addPlayer(world,{id:'host'}),room=world.R.find(room=>room.large),laser=room.lasers[0];
  world.E=[];world.D.fill(0);world.D[world.DEPT[0]+1]=1;world.rem=world.total=1;world.assists={invincible,freezeEnemies:true};world.time=(2-laser.phase+6)%6;
  Object.assign(player.pose,{x:(laser.x0+laser.x1)/2,z:laser.z,h:0});const before=player.hp;
  Sim.step(world,{});assert.ok(player.hp>0);assert.ok(Math.abs(player.hp-(invincible?before:before-18/64))<1e-9);
 }
});
test('old and new co-op checkpoints restore their own room version',()=>{
 for(const roomDesign of[0,1,2]){const world=Sim.createWorld({roomDesign});Sim.addPlayer(world,{id:'host'});const saved=Sim.snapshot(world),restored=Sim.restore(saved);
  assert.equal(restored.roomDesign,roomDesign);assert.deepEqual(restored.R,world.R);assert.deepEqual(restored.M,world.M);
 }
 const world=Sim.createWorld({roomDesign:1});Sim.addPlayer(world,{id:'host'});const saved=Sim.snapshot(world);delete saved.roomDesign;assert.equal(Sim.restore(saved).roomDesign,1);
});
