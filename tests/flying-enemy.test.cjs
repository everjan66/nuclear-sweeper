'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Defs=require('../js/core/definitions.js'),Maps=require('../js/core/map.js'),Movement=require('../js/core/movement.js'),Sim=require('../js/game/simulation.js');
const {environment}=require('./helpers/network.cjs');
function fixture(){const world=Maps.generate(1);world.M.fill(0);world.SH={x:10,z:10};return world;}
function shrieker(x=29,z=41,h=.7){return {id:'flyer',t:4,x,z,h,hp:38,mh:38,cd:0,fc:1,al:1,ph:0};}
function pursue(world,enemy,target,ticks=640){let hits=0;for(let tick=0;tick<ticks;tick++){
 if(Movement.fly(world,enemy,target,1/64,5))hits++;
 assert.equal(Movement.collide(world,enemy.x,enemy.z,.4,enemy.h,1.44),0);
 assert.ok(enemy.h>=0&&enemy.h+1.44<=Defs.WH);
 }return hits;}
test('boss Shriekers can fly into the arena deposit pad while normal flyers respect shelter safety',()=>{
 const world=fixture();world.SH={x:41,z:41};const target={...world.SH,h:0};
 const minion={...shrieker(51,41),bossMinion:true};
 assert.ok(pursue(world,minion,target)>0);assert.ok(Math.hypot(minion.x-target.x,minion.z-target.z)<1.65);
 const normal=shrieker(51,41);assert.equal(pursue(world,normal,target),0);assert.ok(Math.hypot(normal.x-target.x,normal.z-target.z)>=7);
});
test('Shriekers fly to both raised walkways and floating platforms and deal melee damage',()=>{
 for(const kind of [3,6]){const world=fixture(),enemy=shrieker(),target={x:41,z:41,h:Defs.TT[kind]};
  for(let row=19;row<=21;row++)for(let column=19;column<=21;column++)world.M[row*60+column]=kind;
  assert.ok(pursue(world,enemy,target)>0);assert.ok(Math.abs(enemy.h-target.h)<.2);assert.ok(Math.hypot(enemy.x-target.x,enemy.z-target.z)<1.65);
 }
});
test('flyers cross radioactive pools to reach isolated high ground',()=>{
 const world=fixture(),enemy=shrieker(),target={x:41,z:41,h:3.2};
 for(let row=17;row<=23;row++)for(let column=17;column<=23;column++)world.M[row*60+column]=7;
 world.M[20*60+20]=6;assert.ok(pursue(world,enemy,target)>0);
});
test('a flyer trapped below a floating platform goes around its edge before climbing',()=>{
 const world=fixture(),enemy=shrieker(41,41),target={x:41,z:41,h:3.2};
 for(let row=19;row<=21;row++)for(let column=19;column<=21;column++)world.M[row*60+column]=6;
 assert.ok(pursue(world,enemy,target)>0);assert.ok(enemy.h>=3.2);
});
test('flying pathfinding routes around full-height walls without clipping or waypoint stalls',()=>{
 const world=fixture(),enemy=shrieker(35,41,3.35),target={x:43,z:41,h:0};
 for(let row=17;row<=23;row++)world.M[row*60+19]=1;
 assert.ok(pursue(world,enemy,target,1024)>0);assert.ok(enemy.x>40);
});
test('flight cannot damage through ceilings or walls, or attack from another elevation',()=>{
 const world=fixture(),enemy=shrieker(41,41,.7),target={x:41,z:41,h:3.2};world.M[20*60+20]=6;
 assert.equal(Movement.fly(world,enemy,target,1/64,5),false);
 enemy.x=39.5;enemy.h=.7;target.x=42.5;target.h=.7;world.M[20*60+20]=1;
 assert.equal(Movement.fly(world,enemy,target,1/64,5),false);
});
test('flying melee uses a cooldown, descends to ground targets and respects the shelter',()=>{
 const world=fixture(),enemy=shrieker(40,41,.7),target={x:41,z:41,h:0};
 assert.equal(Movement.fly(world,enemy,target,1/64,5),true);
 for(let tick=0;tick<56;tick++)assert.equal(Movement.fly(world,enemy,target,1/64,5),false);
 assert.ok(pursue(world,enemy,target,20)>0);
 const sheltered=shrieker(18,10,3.35);assert.equal(pursue(world,sheltered,{x:10,z:10,h:0},320),0);assert.ok(Math.hypot(sheltered.x-10,sheltered.z-10)>=7);
});
test('solo and co-op weapon traces hit elevated flyers, not their old ground position',()=>{
 const world=fixture(),enemy=shrieker(41,41,3.2);world.E=[enemy];
 const html=fs.readFileSync('nuclear-sweeper-reactor.html','utf8'),source=html.slice(html.indexOf('function cast(o,'),html.indexOf('// ---------- game flow'));
 const solo=vm.createContext({E:world.E,ET:Defs.ET,S:{},rs:(x,y,z)=>Movement.solid(world,x,y,z)});vm.runInContext(source,solo);
 for(const height of [3.8,4.4,.6]){const origin={x:41,y:height,z:46},direction={x:0,y:0,z:-1};
  assert.equal(Sim.cast(world,origin,direction,10).enemy===enemy,height!==.6);
  assert.equal(solo.cast(origin,direction,10).e===enemy,height!==.6);
 }
});
test('co-op AI attacks a guest on a floating platform while the host is sheltered',()=>{
 const world=Sim.createWorld(),host=Sim.addPlayer(world,{id:'host'}),guest=Sim.addPlayer(world,{id:'guest'});world.M.fill(0);world.D.fill(0);world.D[3599]=1;world.rem=world.total=1;world.SH={x:10,z:10};world.TERM=null;world.DEP=[];
 host.pose=Movement.createPose(world.SH);guest.pose={...guest.pose,x:41,z:41,h:3.2};world.M[20*60+20]=6;world.E=[shrieker(40,41,3.2)];
 Sim.step(world,{});assert.equal(world.E[0].target,'guest');assert.ok(guest.hp<100);assert.equal(host.hp,100);assert.equal(world.EP.length,0);
});
test('co-op checkpoints retain flying altitude and migrate four-type progress without losing kills',()=>{
 const world=Sim.createWorld();const player=Sim.addPlayer(world,{id:'host'});world.E=[shrieker()];player.prog.enemies[4]=3;
 const restored=Sim.restore(Sim.snapshot(world));assert.equal(restored.E[0].h,.7);assert.equal(restored.players.host.prog.enemies[4],3);
 const legacy=Sim.snapshot(world);legacy.players.host.prog.enemies=[10,2,3,4];for(const weapon of legacy.players.host.prog.weapons)weapon.types=[5,1,0,0];
 const migrated=Sim.restore(legacy).players.host;assert.deepEqual(migrated.prog.enemies,[10,2,3,4,0]);assert.deepEqual(migrated.prog.weapons[0].types,[5,1,0,0,0]);
 for(const height of [-1,NaN,Infinity,Defs.WH]){const corrupt=Sim.snapshot(world);corrupt.E[0].h=height;assert.throws(()=>Sim.restore(corrupt),/Invalid enemy/);}
});
test('every mastery tier requires the matching per-weapon Shrieker kills',()=>{
 for(const tier of Defs.TIERS)assert.equal(tier.types.length,Defs.ET.length);
 assert.deepEqual(Defs.TIERS.slice(1).map(tier=>tier.types[4]),[5,15,40]);
 for(let tier=1;tier<Defs.TIERS.length;tier++){
  const requirement=Defs.TIERS[tier],progress={kills:requirement.k,types:requirement.types.slice()};
  progress.types[4]--;assert.equal(Defs.weaponTier(progress),tier-1);
  progress.types[4]++;assert.equal(Defs.weaponTier(progress),tier);
  progress.kills--;assert.equal(Defs.weaponTier(progress),tier-1);
 }
 assert.equal(Defs.weaponTier({kills:500,types:[150,100,80,80]}),0);
});
test('solo lists and awards all Shrieker hunter achievements exactly at their thresholds',()=>{
 const world=Sim.createWorld(),player=Sim.addPlayer(world,{id:'solo'}),notices=[];
 const html=fs.readFileSync('nuclear-sweeper-reactor.html','utf8'),solo=vm.createContext({S:player,ENAMES:Defs.ENAMES,CNAMES:[],celebrate:notice=>notices.push(notice)});
 vm.runInContext(html.slice(html.indexOf('const ACH='),html.indexOf('const count='))+html.slice(html.indexOf('function checkProgress('),html.indexOf('function recordKill('))+html.slice(html.indexOf('function progressionHTML('),html.indexOf('const SEC=')),solo);
 for(const goal of [10,50,200]){
  const id='enemy4_'+goal;player.prog.enemies[4]=goal-1;assert.equal(solo.checkProgress(),false);assert.ok(!player.prog.ach.includes(id));
  player.prog.enemies[4]=goal;assert.equal(solo.checkProgress(),true);assert.ok(player.prog.ach.includes(id));assert.equal(solo.checkProgress(),false);
 }
 assert.equal(notices.length,3);assert.ok(notices.every(notice=>notice.title.startsWith('Shrieker hunter')));
 assert.match(solo.progressionHTML(),/200 \/ 200 Shrieker kills/);
});
test('co-op Shrieker kills advance hunter achievements once and survive checkpoint reload',()=>{
 const world=Sim.createWorld(),player=Sim.addPlayer(world,{id:'host'});world.E=[];
 for(const goal of [10,50,200]){
  const id='enemy4_'+goal;player.prog.enemies[4]=goal-1;Sim.step(world,{});assert.ok(!player.prog.ach.includes(id));
  const enemy=shrieker();Sim.recordKill(world,player,enemy,0,false);Sim.recordKill(world,player,enemy,0,false);Sim.step(world,{});
  assert.equal(player.prog.enemies[4],goal);assert.equal(player.prog.ach.filter(value=>value===id).length,1);
 }
 const restored=Sim.restore(Sim.snapshot(world)).players.host;
 assert.equal(restored.prog.enemies[4],200);assert.equal(restored.prog.weapons[0].types[4],3);
 for(const goal of [10,50,200])assert.ok(restored.prog.ach.includes('enemy4_'+goal));
});
test('guest frames replicate and interpolate flying height without sharing personal inventory',async()=>{
 const env=environment(),host=env.NSR.Session.create({dev:true,storage:env.storage()}),guest=env.NSR.Session.create({dev:true,storage:env.storage()});
 const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},20);
 const world=host.view().world;world.assists={freezeEnemies:true};world.E=[shrieker(41,41,3.2)];env.advance([host,guest],{},20);
 assert.equal(guest.view().world.E[0].h,3.2);assert.equal(guest.view().enemies[0].h,3.2);
 world.E[0].h=4;env.advance([host,guest],{},20);assert.equal(guest.view().enemies[0].h,4);
 await guest.close();await host.close();
});
