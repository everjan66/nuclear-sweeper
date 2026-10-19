'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Defs=require('../js/core/definitions.js'),Movement=require('../js/core/movement.js');
const Boss=require('../js/game/boss.js'),Sim=require('../js/game/simulation.js');
const {environment}=require('./helpers/network.cjs');
function fixture(){
 const world=Sim.createWorld(),host=Sim.addPlayer(world,{id:'host'}),guest=Sim.addPlayer(world,{id:'guest'});
 world.E=[];world.Dr=[];return {world,host,guest};
}
function enter(world){world.D.fill(0);world.rem=0;Sim.step(world);}
function expose(world){world.D.fill(0);world.rem=0;Sim.step(world);assert.equal(world.boss.state,'exposed');}
test('97% cleanup permits optional deployment but only actual full cleanup enters the boss arena',()=>{
 const {world,host,guest}=fixture();world.D.fill(0);world.D[0]=.01;world.rem=.01;
 Sim.step(world);assert.equal(world.clr,1);assert.equal(world.boss,null);assert.equal(world.generation,1);
 host.ready=true;guest.ready=true;
 assert.equal(Sim.action(world,host.id,{id:1,type:'deploy'}).ok,true);assert.equal(world.sector,2);
 world.D.fill(0);world.D[0]=1e-9;world.rem=0;Sim.step(world);assert.equal(world.boss,null);
 world.D[0]=0;world.rem=.00000001;Sim.step(world);assert.ok(world.boss);assert.equal(world.generation,3);
});
test('arena transition preserves the team and progression, deposits tanks and resupplies every character',()=>{
 const {world,host,guest}=fixture(),players=world.players,team=world.team;
 host.L.sweep=3;host.prog.dust=200;host.tank=12;guest.tank=23;host.hp=5;guest.hp=10;host.ammo.fill(0);guest.ammo.fill(0);
 host.pose=Movement.createPose({x:world.SH.x+5,z:world.SH.z});guest.pose=Movement.createPose({x:world.SH.x+5,z:world.SH.z});
 guest.connected=false;world.vOpen=1;world.vTaken=7;world.iTaken=3;world.EP=[];
 enter(world);
 assert.equal(world.players,players);assert.equal(world.team,team);assert.equal(world.sector,1);assert.equal(world.generation,2);
 assert.equal(host.L.sweep,3);assert.equal(host.prog.dust,200);assert.ok(team.raw>34);assert.equal(world.R.length,16);
 assert.deepEqual(world.DEP,[world.SH]);assert.equal(world.E.length,0);assert.equal(world.EP.length,0);assert.equal(world.Dr.length,0);
 assert.equal(world.vOpen,0);assert.equal(world.vTaken,0);assert.equal(world.iTaken,0);assert.equal(world.clr,0);
 for(const player of [host,guest]){assert.equal(player.tank,0);assert.equal(player.hp,Defs.ST(player.L).hp);assert.ok(player.ammo.every(value=>value>0));assert.equal(player.pose.x,world.SH.x);assert.equal(player.pose.z,world.SH.z);assert.equal(player.ready,false);}
 assert.ok(world.rem>0&&world.rem<25);assert.ok(world.D.some(value=>value>0));assert.equal(world.boss.state,'shielded');
 const generation=world.generation;expose(world);assert.equal(world.clr,0);assert.equal(world.generation,generation);
});
test('co-op boss casts route weapon damage through shield and phase gates without headshots',()=>{
 const {world,host}=fixture();enter(world);
 host.pose=Movement.createPose({x:world.boss.x,z:world.boss.z+8});host.pose.yaw=0;host.pose.pit=0;
 const origin={x:host.pose.x,y:1.5,z:host.pose.z},hit=Sim.cast(world,origin,{x:0,y:0,z:-1},70);
 assert.equal(hit.boss,true);assert.equal(hit.enemy,null);assert.equal(hit.headshot,false);
 const initial=world.boss.hp;Sim.step(world,{host:{yaw:0,pit:0,fire:true}});assert.equal(world.boss.hp,initial);
 assert.equal(world.events.some(event=>event.type==='hit'&&event.boss),false);
 expose(world);host.wcd=0;host.fireHeld=false;host.pose.rp=0;
 Sim.step(world,{host:{yaw:0,pit:0,fire:true}});assert.ok(world.boss.hp<initial);assert.ok(world.boss.hp>initial*.8);assert.equal(host.kills,0);
 Boss.damage(world,1e9);assert.equal(world.boss.phase,2);assert.equal(world.boss.state,'shielded');assert.ok(world.boss.hp>0);assert.ok(world.rem>0);
 const gated=world.boss.hp;Boss.damage(world,1e9);assert.equal(world.boss.hp,gated);
});
test('developer freeze pauses boss timers and attacks without blocking sweeping',()=>{
 const {world,host}=fixture();world.dev=true;enter(world);world.assists={freezeEnemies:true};
 host.pose.x=60;host.pose.z=58;world.boss.warning={x:60,z:58,left:.001,radius:3};
 const hp=host.hp;Sim.step(world);assert.ok(host.hp>=hp);assert.equal(world.boss.warning.left,.001);
 world.D.fill(0);world.rem=0;Sim.step(world);assert.equal(world.boss.state,'shielded');
 world.assists.freezeEnemies=false;Sim.step(world);assert.equal(world.boss.state,'exposed');
});
test('boss effects hurt players, disable regular spawns and reward victory only once before deployment',()=>{
 const {world,host,guest}=fixture();enter(world);world.spawnT=0;
 host.pose=Movement.createPose({x:60,z:58});host.pose.z=58;world.boss.warning={x:60,z:58,left:.001,radius:3};
 const hp=host.hp;Sim.step(world);assert.ok(host.hp<hp-17);assert.ok(world.events.some(event=>event.type==='hurt'&&event.playerId==='host'));assert.equal(world.E.length,0);
 host.pose=Movement.createPose(world.SH);host.ready=true;guest.ready=true;world.clr=1;
 assert.equal(Sim.action(world,host.id,{id:1,type:'deploy'}).ok,false);world.clr=0;
 for(let phase=1;phase<=3;phase++){expose(world);Boss.damage(world,1e9);}
 const cred=world.team.cred,parts=world.team.parts;Sim.step(world);
 assert.equal(world.bossDead,1);assert.equal(world.clr,1);assert.equal(world.team.cred,cred+1250);assert.equal(world.team.parts,parts+3);
 Sim.step(world);assert.equal(world.team.cred,cred+1250);assert.equal(world.events.filter(event=>event.type==='boss-victory').length,1);
 host.ready=true;guest.ready=true;assert.equal(Sim.action(world,host.id,{id:2,type:'deploy'}).ok,true);assert.equal(world.sector,2);assert.equal(world.boss,null);assert.equal(world.bossDead,0);
});
test('boss checkpoints restore arena geometry, preserve dust totals repeatedly and restart in place',()=>{
 const {world,host}=fixture();enter(world);expose(world);Boss.damage(world,1e9);
 let saved=Sim.snapshot(world);const total=saved.total,rem=saved.rem;
 for(let index=0;index<3;index++){const restored=Sim.restore(saved);assert.equal(restored.total,total);assert.ok(Math.abs(restored.rem-rem)<1e-9);assert.deepEqual(restored.M,world.M);assert.equal(restored.boss.phase,2);saved=Sim.snapshot(restored);}
 const restored=Sim.restart(Sim.restore(saved));assert.equal(restored.boss.phase,2);assert.equal(restored.players[host.id].connected,false);assert.equal(restored.players[host.id].pose.x,restored.SH.x);assert.equal(restored.generation,2);
 assert.throws(()=>Sim.restore({...saved,boss:{...saved.boss,phase:9}}),/boss/i);
 const invalid=structuredClone(saved);invalid.M[0]=0;assert.throws(()=>Sim.restore(invalid),/geometry/i);
 const normal=fixture().world;const legacy=Sim.snapshot(normal);delete legacy.boss;assert.equal(Sim.restore(legacy).boss,null);
});
test('automatic boss generation snapshots and subsequent boss frames converge for all peers',async()=>{
 const env=environment({latency:150,loss:.02}),storage=env.storage(),host=env.NSR.Session.create({storage}),guest=env.NSR.Session.create({storage:env.storage()});
 const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},40);
 const world=host.view().world;world.D.fill(0);world.rem=0;env.advance([host,guest],{},50);
 const remote=guest.view().world;assert.equal(remote.generation,2);assert.equal(remote.sector,1);assert.ok(remote.boss);assert.equal(remote.R.length,16);assert.deepEqual(Array.from(remote.M),Array.from(world.M));assert.equal(guest.view().waiting,false);
 assert.equal(storage.load().world.generation,2);assert.equal(storage.load().world.boss.state,'shielded');
 world.D.fill(0);world.rem=0;env.advance([host,guest],{},20);assert.equal(guest.view().world.boss.state,'exposed');
 Boss.damage(world,1e9);env.advance([host,guest],{},20);assert.equal(guest.view().world.boss.phase,2);assert.equal(guest.view().world.total,world.total);
 for(let phase=2;phase<=3;phase++){world.D.fill(0);world.rem=0;env.advance([host,guest],{},2);Boss.damage(world,1e9);}
 env.advance([host,guest],{},30);assert.equal(guest.view().world.bossDead,1);assert.equal(guest.view().world.clr,1);assert.equal(guest.view().world.boss.state,'dead');
 assert.equal(storage.load().world.bossDead,1);assert.equal(storage.load().world.boss.state,'dead');
 await guest.close();await host.close();
 const resumed=env.NSR.Session.create({storage});await resumed.host();assert.equal(resumed.view().world.bossDead,1);assert.equal(resumed.view().world.generation,2);assert.equal(resumed.view().world.boss.state,'dead');await resumed.close();
});
