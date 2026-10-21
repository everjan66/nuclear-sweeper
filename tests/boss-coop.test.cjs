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
function spawnWave(world){Sim.step(world);if(world.boss.spawnWarning){world.boss.spawnWarning.left=0;Sim.step(world);}}
function expose(world){spawnWave(world);world.E=[];world.D.fill(0);world.rem=0;Sim.step(world);assert.equal(world.boss.state,'exposed');}
test('97% cleanup permits optional deployment but only actual full cleanup enters the boss arena',()=>{
 const {world,host,guest}=fixture();world.D.fill(0);world.D[0]=.01;world.rem=.01;
 Sim.step(world);assert.equal(world.clr,1);assert.equal(world.boss,null);assert.equal(world.generation,1);
 host.ready=true;guest.ready=true;
 assert.equal(Sim.action(world,host.id,{id:1,type:'deploy'}).ok,true);assert.equal(world.sector,2);
 world.D.fill(0);world.D[0]=1e-9;world.rem=0;Sim.step(world);assert.equal(world.boss,null);
 world.D[0]=0;world.rem=.00000001;Sim.step(world);assert.ok(world.boss);assert.equal(world.generation,3);
});
test('arena transition preserves entering health and progression while depositing tanks and supplying ammo',()=>{
 const {world,host,guest}=fixture(),players=world.players,team=world.team;
 host.L.sweep=3;host.prog.dust=200;host.tank=12;guest.tank=23;host.hp=5;guest.hp=10;host.ammo.fill(0);guest.ammo.fill(0);
 host.pose=Movement.createPose({x:world.SH.x+5,z:world.SH.z});guest.pose=Movement.createPose({x:world.SH.x+5,z:world.SH.z});
 guest.connected=false;world.vOpen=1;world.vTaken=7;world.iTaken=3;world.EP=[];
 enter(world);
 assert.equal(world.players,players);assert.equal(world.team,team);assert.equal(world.sector,1);assert.equal(world.generation,2);
 assert.equal(host.L.sweep,3);assert.equal(host.prog.dust,200);assert.ok(team.raw>34);assert.equal(world.R.length,16);
 assert.deepEqual(world.DEP,[world.SH]);assert.equal(world.E.length,0);assert.equal(world.EP.length,0);assert.equal(world.Dr.length,0);
 assert.equal(world.vOpen,0);assert.equal(world.vTaken,0);assert.equal(world.iTaken,0);assert.equal(world.clr,0);
 assert.ok(host.hp>=5&&host.hp<6);assert.equal(guest.hp,10);
 for(const player of [host,guest]){assert.equal(player.tank,0);assert.ok(player.ammo.every(value=>value>0));assert.equal(player.pose.x,world.SH.x);assert.equal(player.pose.z,world.SH.z);assert.equal(player.ready,false);}
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
 world.assists.freezeEnemies=false;expose(world);assert.equal(world.boss.state,'exposed');
});
test('boss effects hurt players, disable regular spawns and reward victory only once before deployment',()=>{
 const {world,host,guest}=fixture();enter(world);spawnWave(world);world.spawnT=0;
 host.pose=Movement.createPose({x:60,z:58});host.pose.z=58;world.boss.warning={x:60,z:58,left:.001,radius:3};
 const hp=host.hp;Sim.step(world);assert.ok(host.hp<hp-17);assert.ok(world.events.some(event=>event.type==='hurt'&&event.playerId==='host'));assert.ok(world.E.length>0&&world.E.every(enemy=>enemy.bossMinion));
 host.pose=Movement.createPose(world.SH);host.ready=true;guest.ready=true;world.clr=1;
 assert.equal(Sim.action(world,host.id,{id:1,type:'deploy'}).ok,false);world.clr=0;
 for(let phase=1;phase<=3;phase++){expose(world);Boss.damage(world,1e9);}
 const cred=world.team.cred,parts=world.team.parts;Sim.step(world);
 assert.equal(world.bossDead,1);assert.equal(world.clr,1);assert.equal(world.team.cred,cred+1250);assert.equal(world.team.parts,parts+3);
 Sim.step(world);assert.equal(world.team.cred,cred+1250);assert.equal(world.events.filter(event=>event.type==='boss-victory').length,1);
 host.ready=true;guest.ready=true;assert.equal(Sim.action(world,host.id,{id:2,type:'deploy'}).ok,true);assert.equal(world.sector,2);assert.equal(world.boss,null);assert.equal(world.bossDead,0);
});
test('Sweeper victory clears surviving reinforcements and projectiles before they can hurt the team',()=>{
 const {world,host}=fixture();world.boss=Boss.create(1,'sweeper');Object.assign(world.boss,{phase:3,hp:0,state:'dead'});
 world.E=[{id:'guard',bossMinion:true,hp:30},{id:'other',hp:30,t:0,x:60,z:58}];world.EP=[{dm:999}];const hp=host.hp;
 Sim.step(world);assert.equal(world.E.length,1);assert.equal(world.E[0].id,'other');assert.equal(world.EP.length,0);assert.equal(host.hp,hp);assert.equal(world.bossDead,1);assert.equal(world.team.parts,3);
 Sim.step(world);assert.equal(world.team.parts,3);assert.equal(world.events.filter(event=>event.type==='boss-victory').length,1);
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
 expose(world);env.advance([host,guest],{},20);assert.equal(guest.view().world.boss.state,'exposed');
 Boss.damage(world,1e9);env.advance([host,guest],{},20);assert.equal(guest.view().world.boss.phase,2);assert.equal(guest.view().world.total,world.total);
 for(let phase=2;phase<=3;phase++){expose(world);env.advance([host,guest],{},2);Boss.damage(world,1e9);}
 env.advance([host,guest],{},30);assert.equal(guest.view().world.bossDead,1);assert.equal(guest.view().world.clr,1);assert.equal(guest.view().world.boss.state,'dead');
 assert.equal(storage.load().world.bossDead,1);assert.equal(storage.load().world.boss.state,'dead');
 await guest.close();await host.close();
 const resumed=env.NSR.Session.create({storage});await resumed.host();assert.equal(resumed.view().world.bossDead,1);assert.equal(resumed.view().world.generation,2);assert.equal(resumed.view().world.boss.state,'dead');await resumed.close();
});
test('boss creation uses connected gear and authoritative mandatory waves survive checkpoints without duplicate summons',()=>{
 const {world,host,guest}=fixture();host.L.w4=1;host.wl[4].dmg=30;host.wl[4].fr=20;host.att[4].b=1;
 guest.connected=false;guest.L.w4=1;guest.wl[4].dmg=40;
 const expected=Boss.create(world.sector,[host]);enter(world);assert.equal(world.boss.mh,expected.mh);
 world.D.fill(0);world.rem=0;spawnWave(world);
 assert.equal(world.boss.state,'shielded');assert.equal(world.boss.summonedPhase,1);assert.ok(world.E.length>=3);
 const ids=world.E.map(enemy=>enemy.id);assert.equal(new Set(ids).size,ids.length);
 for(const enemy of world.E){assert.equal(enemy.bossMinion,true);assert.equal(enemy.mh,Defs.ET[enemy.t].hp*Math.min(12,Math.sqrt(expected.power)));for(const key of ['hp','cd','fc','ph'])assert.ok(Number.isFinite(enemy[key]));}
 const restored=Sim.restore(Sim.snapshot(world));assert.deepEqual(restored.E,world.E);Sim.step(restored);
 assert.deepEqual(restored.E.map(enemy=>enemy.id),ids);assert.equal(restored.boss.state,'shielded');
 restored.boss.state='exposed';assert.equal(Boss.damage(restored,100),0);restored.boss.state='shielded';
 restored.E.forEach(enemy=>enemy.hp=0);Sim.step(restored);assert.equal(restored.boss.state,'exposed');assert.equal(restored.E.length,0);
 Boss.damage(restored,1e9);assert.equal(restored.boss.phase,2);restored.D.fill(0);restored.rem=0;spawnWave(restored);
 assert.equal(restored.boss.state,'shielded');assert.equal(restored.boss.summonedPhase,2);assert.ok(restored.E.length>0);
});
test('boss pad deposits only dust and all health or purchased resupply paths remain disabled',()=>{
 const {world,host}=fixture();enter(world);world.dev=true;world.assists={freezeEnemies:true};
 world.team.cred=1e6;world.team.scrap=1e6;world.team.parts=100;host.hp=37;host.ammo.fill(0);host.reserves.fill(0);host.tank=12;host.canDock=true;
 Sim.step(world);assert.equal(host.hp,37);assert.equal(host.ammo[0],0);assert.equal(host.reserves[0],0);assert.equal(host.tank,0);
 host.tank=8;assert.equal(Sim.action(world,host.id,{id:1,type:'dock'}).ok,true);assert.equal(host.hp,37);assert.equal(host.ammo[0],0);assert.equal(host.reserves[0],0);assert.equal(host.tank,0);
 const before={cred:world.team.cred,scrap:world.team.scrap,parts:world.team.parts};
 for(const [index,request]of [{type:'buy',upgrade:'suit'},{type:'buy',upgrade:'pouch'},{type:'buy',upgrade:'multi',weapon:0},{type:'buyModule',key:'gr'},{type:'unlockAttachment',key:'b'}].entries())assert.equal(Sim.action(world,host.id,{id:index+2,...request}).ok,false);
 assert.deepEqual({cred:world.team.cred,scrap:world.team.scrap,parts:world.team.parts},before);assert.equal(host.hp,37);
 host.pose.x=60;host.pose.z=58;world.D.fill(0);world.rem=0;Sim.step(world);assert.equal(host.hp,37);
});
test('boss reloads take normal time without consuming finite reserves and normal restrictions return after victory',()=>{
 const {world,host}=fixture();enter(world);world.dev=true;world.assists={freezeEnemies:true};
 for(const reserves of [0,2]){
  host.ammo[0]=0;host.reserves[0]=reserves;host.rel=0;Sim.step(world,{host:{reload:true}});
  assert.equal(host.rel,Defs.WP[0].rl);assert.equal(host.ammo[0],0);Sim.step(world);assert.equal(host.ammo[0],0);
  host.rel=Defs.MOVE.tick/2;Sim.step(world);assert.equal(host.ammo[0],Defs.WP[0].mag);assert.equal(host.reserves[0],reserves);
 }
 assert.ok(Sim.restore(Sim.snapshot(world)).players.host.reserves.every(Number.isFinite));
 world.bossDead=1;world.boss.state='dead';world.boss.hp=0;world.boss.phase=3;
 host.ammo[0]=0;host.reserves[0]=0;host.rel=0;host.hp=50;Sim.step(world,{host:{reload:true}});assert.equal(host.rel,0);assert.equal(host.ammo[0],0);assert.ok(host.hp>50);
 host.reserves[0]=2;Sim.step(world,{host:{reload:true}});assert.equal(host.rel,Defs.WP[0].rl);host.rel=Defs.MOVE.tick/2;Sim.step(world);assert.equal(host.reserves[0],1);assert.equal(host.ammo[0],Defs.WP[0].mag);
});
test('boss minions pursue and damage pad occupants in proportion to the actual victim maximum health',()=>{
 const {world,host,guest}=fixture();enter(world);spawnWave(world);guest.pose.x=60;guest.pose.z=70;
 host.L.suit=20;host.hp=Defs.ST(host.L).hp;
 const melee={...world.E[0],t:0,x:host.pose.x+1,z:host.pose.z,cd:0,fc:1};world.E=[melee];const before=host.hp;
 Sim.step(world);assert.equal(melee.target,host.id);assert.ok(melee.x<world.SH.x+1);assert.equal(host.hp,before-Defs.ET[0].dm*3);
 world.E=[{...melee,id:'ranged',t:1,x:host.pose.x+5,z:host.pose.z,fc:0}];Sim.step(world);assert.ok(world.EP.length>0);assert.equal(world.EP[0].bossMinion,true);
 world.E=[];const projectile={...world.EP[0],id:'scaled-shot',x:guest.pose.x,y:1,z:guest.pose.z,vx:0,vy:0,vz:0,dm:9,l:3};world.EP=[projectile];guest.L.suit=10;guest.hp=200;
 Sim.step(world);assert.equal(guest.hp,182);assert.equal(world.EP.length,0);
 world.EP=[{...projectile,x:host.pose.x,z:host.pose.z}];const hp=host.hp;Sim.step(world);assert.equal(host.hp,hp-27);
});
test('freeze pauses both minions and their projectiles while loot still collects during and after the fight',()=>{
 const {world,host}=fixture();enter(world);spawnWave(world);world.EP=[{id:'frozen',x:60,y:1,z:58,vx:1,vy:0,vz:0,l:3,dm:9,bossMinion:true}];
 world.dev=true;world.assists={freezeEnemies:true};const enemies=structuredClone(world.E),projectiles=structuredClone(world.EP),boss=structuredClone(world.boss);
 world.Dr=[{id:'loot',x:host.pose.x,z:host.pose.z,y:.4,vx:0,vz:0,k:'scrap',a:2}];Sim.step(world);
 assert.deepEqual(world.E,enemies);assert.deepEqual(world.EP,projectiles);assert.deepEqual(world.boss,boss);assert.equal(world.team.scrap,2);assert.equal(world.Dr.length,0);
 world.bossDead=1;world.boss.state='dead';world.assists.freezeEnemies=false;world.E[0].hp=0;
 world.EP[0].l=Defs.MOVE.tick/2;world.Dr=[{id:'after',x:host.pose.x,z:host.pose.z,y:.4,vx:0,vz:0,k:'scrap',a:3}];Sim.step(world);
 assert.equal(world.E.length,enemies.length-1);assert.equal(world.EP.length,0);assert.equal(world.Dr.length,0);assert.equal(world.team.scrap,5);
});
test('any current character death or rescue resets the entire encounter as a new attempt',()=>{
 for(const mode of ['death','disconnected-death','rescue']){
  const {world,host,guest}=fixture();enter(world);expose(world);Boss.damage(world,1e9);Sim.step(world);
  const maximum=world.boss.mh,generation=world.generation;host.hp=20;host.ammo.fill(0);host.reserves.fill(0);host.pose.x=60;
  world.EP=[{id:'old-shot',x:60,y:1,z:58,vx:1,vy:0,vz:0,l:3,dm:2,bossMinion:true}];
  if(mode==='rescue')Sim.rescue(world,guest.id);
  else{if(mode==='disconnected-death')Sim.disconnect(world,guest.id);guest.hp=0;Sim.step(world);}
  assert.equal(world.generation,generation+1);assert.equal(world.boss.phase,1);assert.equal(world.boss.hp,maximum);assert.equal(world.boss.summonedPhase,0);assert.equal(world.boss.state,'shielded');assert.equal(world.bossDead,0);
  assert.equal(world.E.length,0);assert.equal(world.EP.length,0);assert.equal(world.Dr.length,0);assert.ok(world.rem>0);assert.equal(world.rem,world.D.reduce((sum,value)=>sum+value,0));
  for(const player of [host,guest]){assert.equal(player.hp,Defs.ST(player.L).hp);assert.equal(player.pose.x,world.SH.x);assert.equal(player.pose.z,world.SH.z);assert.ok(player.ammo.every(value=>value>0));assert.equal(player.reserves[0],Defs.ST(player.L).reloads);}
  assert.ok(world.events.some(event=>event.type==='boss-retry'&&event.playerId===guest.id));
 }
});
test('restart preserves damaged players, boss progress, live waves and projectiles rather than granting a retry',()=>{
 const {world,host}=fixture();enter(world);expose(world);Boss.damage(world,1e9);spawnWave(world);host.hp=24;host.ammo[0]=1;host.reserves[0]=0;host.pose.x=60;host.pose.z=60;
 world.EP=[{id:'saved-shot',x:60,y:1,z:58,vx:1,vy:0,vz:0,l:3,dm:2,bossMinion:true}];const saved=Sim.snapshot(world);
 const restored=Sim.restart(Sim.restore(saved));assert.equal(restored.generation,saved.generation);assert.deepEqual(restored.boss,saved.boss);assert.deepEqual(restored.E,saved.E);assert.deepEqual(restored.EP,saved.EP);
 assert.equal(restored.players.host.hp,24);assert.equal(restored.players.host.ammo[0],1);assert.equal(restored.players.host.reserves[0],0);assert.equal(restored.players.host.pose.x,60);assert.equal(restored.players.host.pose.z,60);assert.equal(restored.players.host.connected,false);
 restored.players.host.connected=true;spawnWave(restored);assert.ok(restored.players.host.hp<=24);assert.equal(restored.boss.phase,2);assert.equal(restored.E.length,saved.E.length);
});
test('lethal boss attacks start a fresh attempt instead of preserving phase progress',()=>{
 const {world,host}=fixture();enter(world);expose(world);Boss.damage(world,1e9);Sim.step(world);
 host.hp=1;world.boss.warning={x:host.pose.x,z:host.pose.z,left:.001,radius:3};const generation=world.generation;
 Sim.step(world);assert.equal(world.generation,generation+1);assert.equal(world.boss.phase,1);assert.equal(world.boss.hp,world.boss.mh);assert.equal(host.hp,Defs.ST(host.L).hp);assert.equal(world.E.length,0);assert.equal(world.EP.length,0);
 assert.ok(world.events.some(event=>event.type==='boss-retry'&&event.playerId===host.id));
});
test('retry generations reliably replace boss, player and minion state for network peers',async()=>{
 const env=environment({latency:150,loss:.02}),storage=env.storage(),host=env.NSR.Session.create({storage}),guest=env.NSR.Session.create({storage:env.storage()});
 const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},40);
 const world=host.view().world;world.D.fill(0);world.rem=0;env.advance([host,guest],{},40);
 expose(world);Boss.damage(world,1e9);env.advance([host,guest],{},20);assert.equal(guest.view().world.boss.phase,2);
 const generation=world.generation,hostId=world.hostId;world.players[hostId].hp=0;env.advance([host,guest],{},40);
 const remote=guest.view().world;assert.equal(world.generation,generation+1);assert.equal(remote.generation,world.generation);assert.equal(remote.boss.phase,1);assert.equal(remote.boss.hp,remote.boss.mh);assert.equal(remote.players[hostId].hp,world.players[hostId].hp);
 assert.deepEqual(Array.from(remote.E,enemy=>[enemy.id,enemy.mh]),Array.from(world.E,enemy=>[enemy.id,enemy.mh]));assert.equal(guest.view().waiting,false);assert.equal(storage.load().world.generation,world.generation);
 await guest.close();await host.close();
});
test('legacy active boss saves upgrade balance without healing players or losing the encounter',()=>{
 const {world,host}=fixture();enter(world);host.hp=32;host.ammo[0]=2;host.reserves[0]=0;
 const saved=Sim.snapshot(world);for(const key of ['summonedPhase','balanceVersion','power','pressure','targetCursor'])delete saved.boss[key];
 const restored=Sim.restart(Sim.restore(saved));assert.equal(restored.players.host.hp,32);assert.equal(restored.players.host.ammo[0],2);assert.equal(restored.players.host.reserves[0],0);
 restored.players.host.connected=true;spawnWave(restored);assert.equal(restored.boss.phase,1);assert.equal(restored.players.host.hp,32);assert.ok(restored.E.length>0);assert.equal(restored.boss.summonedPhase,1);
 const ids=restored.E.map(enemy=>enemy.id);Sim.step(restored);assert.deepEqual(restored.E.map(enemy=>enemy.id),ids);assert.doesNotThrow(()=>Sim.restore(Sim.snapshot(restored)));
});
test('pending reinforcement telegraphs persist across co-op rehost and spawn once at marked coordinates',()=>{
 const {world}=fixture();enter(world);Sim.step(world);
 const marked=structuredClone(world.boss.spawnWarning.units);
 assert.equal(world.E.length,0);assert.ok(world.boss.spawnWarning.left>1.4);
 for(let tick=0;tick<31;tick++)Sim.step(world);
 const saved=Sim.snapshot(world),restored=Sim.restart(Sim.restore(saved));
 restored.players.host.connected=true;assert.deepEqual(restored.boss.spawnWarning,saved.boss.spawnWarning);
 restored.dev=true;restored.assists={freezeEnemies:true};Sim.step(restored);assert.deepEqual(restored.boss.spawnWarning,saved.boss.spawnWarning);
 restored.assists.freezeEnemies=false;
 for(let tick=0;tick<63;tick++){Sim.step(restored);assert.equal(restored.E.length,0);}
 Sim.step(restored);assert.equal(restored.boss.spawnWarning,null);assert.equal(restored.E.length,marked.length);
 for(let index=0;index<marked.length;index++){assert.ok(Math.hypot(restored.E[index].x-marked[index].x,restored.E[index].z-marked[index].z)<.2);assert.equal(restored.E[index].t,marked[index].t);}
 const ids=restored.E.map(enemy=>enemy.id);Sim.step(restored);assert.deepEqual(restored.E.map(enemy=>enemy.id),ids);
});
test('host and guest receive the same pending spawn positions and subsequent enemy wave',async()=>{
 const env=environment(),host=env.NSR.Session.create({storage:env.storage()}),guest=env.NSR.Session.create({storage:env.storage()});
 const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},40);
 const world=host.view().world;world.D.fill(0);world.rem=0;env.advance([host,guest],{},20);
 const warning=world.boss.spawnWarning,remote=guest.view().world.boss.spawnWarning;
 assert.ok(warning&&remote);assert.deepEqual(remote.units,warning.units);assert.equal(world.E.length,0);
 env.advance([host,guest],{},140);
 assert.equal(world.boss.spawnWarning,null);assert.equal(guest.view().world.boss.spawnWarning,null);
 assert.ok(world.E.length>0);assert.deepEqual(guest.view().world.E.map(enemy=>enemy.id),world.E.map(enemy=>enemy.id));
 await guest.close();await host.close();
});
test('boss Shriekers spawn airborne, scale melee damage and gate exposure until cleared',()=>{
 const {world,host,guest}=fixture();enter(world);spawnWave(world);
 const flyer=world.E.find(enemy=>enemy.t===4);assert.ok(flyer);assert.ok(flyer.h>0);assert.equal(flyer.bossMinion,true);
 world.E=[flyer];world.D.fill(0);world.rem=0;world.boss.attack=10;world.boss.warning=null;
 guest.pose.x=80;guest.pose.z=72;host.L.suit=20;host.hp=Defs.ST(host.L).hp;
 flyer.x=host.pose.x+1;flyer.z=host.pose.z;flyer.h=.7;flyer.cd=0;
 const before=host.hp;Sim.step(world);assert.equal(flyer.target,host.id);assert.equal(host.hp,before-Defs.ET[4].dm*3);
 assert.equal(world.boss.state,'shielded');assert.equal(Boss.damage(world,100),0);
 flyer.h=3.2;const restored=Sim.restore(Sim.snapshot(world));assert.equal(restored.E[0].h,3.2);assert.equal(restored.E[0].bossMinion,true);
 flyer.hp=0;Sim.step(world);assert.equal(world.E.length,0);Sim.step(world);assert.equal(world.boss.state,'exposed');
});
