'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Boss=require('../js/game/boss.js'),Sim=require('../js/game/simulation.js');
const {environment}=require('./helpers/network.cjs');
const {WP,mkL,ET}=require('../js/core/definitions.js');
function fixture(phase=1,reinforcements=false){const world=Boss.arena({sector:1,dirty:[]});world.boss=Boss.create(1,'sweeper');world.boss.phase=phase;world.boss.summonedPhase=reinforcements?0:phase;world.boss.hp=world.boss.mh*(4-phase)/3;Boss.seedDust(world);return world;}
function player(id='target',x=56,z=58,h=0){return {id,hp:100,pose:{x,z,h}};}
function clean(world){world.D.fill(0);world.rem=0;}
function launch(world,target){world.boss.attack=0;world.boss.wave=0;Boss.step(world,[target],0);assert.equal(world.boss.warning.kind,'nozzle');Boss.step(world,[target],world.boss.warning.left);assert.ok(world.boss.nozzle);}
function dodge(world,target){launch(world,target);target.pose.z+=5;return Boss.step(world,[target],1);}
test('Sweeper phases telegraph deterministic 3/4/5 baseline enemies once, away from players and the pad',()=>{
 assert.equal(Boss.create(1,'sweeper').summonedPhase,0);assert.equal(Boss.create(1,'sweeper').spawnWarning,null);
 for(const phase of [1,2,3]){
  const world=fixture(phase,true),targets=[player('first',35,43),player('second',83,75)];
  const copy=structuredClone(world);assert.deepEqual(Boss.step(world,targets,0),[]);Boss.step(copy,targets,0);
  assert.deepEqual(copy.boss.spawnWarning,world.boss.spawnWarning);assert.equal(world.boss.summonedPhase,phase);
  assert.equal(world.boss.spawnWarning.left,1.5);assert.equal(world.boss.spawnWarning.units.length,phase+2);assert.equal(world.boss.attack,3);
  for(const unit of world.boss.spawnWarning.units){
   assert.equal(unit.hpScale,1);assert.equal(world.M[Math.floor(unit.z/2)*60+Math.floor(unit.x/2)],0);
   assert.ok(Math.hypot(unit.x-world.SH.x,unit.z-world.SH.z)>=8);
   assert.ok(targets.every(target=>Math.hypot(unit.x-target.pose.x,unit.z-target.pose.z)>=8));
  }
  const units=structuredClone(world.boss.spawnWarning.units);assert.deepEqual(Boss.step(world,targets,1.49),[]);
  assert.deepEqual(Boss.step(world,targets,.01),[{type:'summon',units}]);assert.equal(world.boss.spawnWarning,null);
  assert.deepEqual(Boss.step(world,[],20),[]);assert.equal(world.boss.spawnWarning,null);
 }
});
test('Sweeper reinforcement cap counts only living boss minions and never refills a completed phase',()=>{
 const world=fixture(1,true);world.E=[];
 for(const phase of [1,2,3]){
  world.boss.phase=phase;world.boss.hp=world.boss.mh*(4-phase)/3;world.boss.attack=100;
  const effects=Boss.step(world,[],1.5),expected=phase===1?3:phase===2?3:0;
  assert.equal(effects.length,expected?1:0);
  if(expected){assert.equal(effects[0].units.length,expected);world.E.push(...effects[0].units.map(unit=>({...unit,hp:30,bossMinion:true})));}
  assert.ok(world.E.filter(enemy=>enemy.hp>0&&!enemy.gone&&enemy.bossMinion).length<=6);
 }
 world.E=[];assert.deepEqual(Boss.step(world,[],5),[]);assert.equal(world.boss.spawnWarning,null);
 const ignored=fixture(3,true);ignored.E=[{hp:0,bossMinion:true},{hp:10,gone:true,bossMinion:true},{hp:100}];
 assert.equal(Boss.step(ignored,[],1.5)[0].units.length,5);
 const pending=fixture(3,true);Boss.step(pending,[],0);pending.E=Array.from({length:5},()=>({hp:1,bossMinion:true}));
 assert.equal(Boss.step(pending,[],1.5)[0].units.length,1);
});
test('Sweeper reinforcements never gate nozzle exposure or damage and can emerge while exposed',()=>{
 const world=fixture(1,true),target=player('target',72);world.E=[{hp:30,bossMinion:true}];clean(world);
 launch(world,target);target.pose.z+=5;
 assert.deepEqual(Boss.step(world,[target],.17),[]);assert.equal(world.boss.state,'exposed');assert.ok(world.boss.spawnWarning);
 assert.ok(Boss.damage(world,10)>0);const timer=world.boss.timer;
 const effects=Boss.step(world,[target],.2);assert.equal(effects[0].type,'summon');assert.equal(effects[0].units.length,3);
 assert.equal(world.boss.state,'exposed');assert.ok(Math.abs(world.boss.timer-(timer-.2))<1e-9);assert.equal(world.boss.spawnWarning,null);
 assert.ok(Boss.damage(world,10)>0);
 const living=fixture(),dodger=player();living.E=[{hp:30,bossMinion:true}];clean(living);dodge(living,dodger);assert.equal(living.boss.state,'exposed');assert.ok(Boss.damage(living,10)>0);
});
test('Sweeper phase gates cancel obsolete warnings, schedule the new wave and clear warnings at death',()=>{
 const world=fixture(1,true);Boss.step(world,[],0);world.boss.state='exposed';world.boss.timer=4;
 assert.equal(world.boss.spawnWarning.units.length,3);Boss.damage(world,1e9);assert.equal(world.boss.spawnWarning,null);assert.equal(world.boss.summonedPhase,1);
 Boss.step(world,[],0);assert.equal(world.boss.summonedPhase,2);assert.equal(world.boss.spawnWarning.left,1.5);assert.equal(world.boss.spawnWarning.units.length,4);
 world.boss.state='exposed';world.boss.timer=3;Boss.damage(world,1e9);assert.equal(world.boss.spawnWarning,null);
 Boss.step(world,[],0);assert.equal(world.boss.spawnWarning.units.length,5);world.boss.state='exposed';Boss.damage(world,1e9);
 assert.equal(world.boss.state,'dead');assert.equal(world.boss.spawnWarning,null);assert.deepEqual(Boss.step(world,[],2),[{type:'victory'}]);
});
test('Sweeper reinforcement warnings restore shielded/exposed, accept legacy fields and reject invalid state',()=>{
 const world=fixture(2,true);Boss.step(world,[],.4);
 for(const state of ['shielded','exposed']){
  world.boss.state=state;world.boss.timer=3;world.boss.ring=null;world.boss.nozzle=null;
  const copy=structuredClone(world);copy.boss=Boss.restore(copy.boss,1);assert.deepEqual(copy.boss,world.boss);
  assert.deepEqual(Boss.step(copy,[],1.1),Boss.step(structuredClone(world),[],1.1));assert.equal(copy.boss.spawnWarning,null);
 }
 for(const summonedPhase of [-1,3,1.5,NaN,null])assert.equal(Boss.restore({...world.boss,summonedPhase},1),null);
 for(const change of [{left:-1},{left:1.51},{left:Infinity},{units:[]},{units:Array(7).fill(world.boss.spawnWarning.units[0])},{units:[{t:0,x:0,z:43,hpScale:1}]},{units:[{t:0,x:35,z:43,hpScale:NaN}]}]){
  assert.equal(Boss.restore({...world.boss,spawnWarning:{...world.boss.spawnWarning,...change}},1),null);
 }
 assert.equal(Boss.restore({...world.boss,phase:3,hp:0,state:'dead',summonedPhase:3},1),null);
 const legacy=fixture(2).boss;delete legacy.summonedPhase;delete legacy.spawnWarning;
 const restored=Boss.restore(legacy,1);assert.equal(restored.summonedPhase,0);assert.equal(restored.spawnWarning,null);
 for(const boss of [legacy,restored]){
  const oldWorld=fixture(2);oldWorld.boss=boss;Boss.step(oldWorld,[],0);assert.equal(boss.summonedPhase,2);assert.equal(boss.spawnWarning.units.length,4);
 }
 const sovereign=Boss.create(1);sovereign.summonedPhase=1;sovereign.spawnWarning=structuredClone(world.boss.spawnWarning);
 assert.ok(Boss.restore(sovereign,1));assert.equal(Boss.restore({...sovereign,state:'exposed'},1),null);
});
test('Sweeper reinforcement timers and summon effects are substep stable',()=>{
 const world=fixture(3,true),copy=structuredClone(world),target=player();
 const combined=Boss.step(world,[target],1.5),split=[];for(let index=0;index<60;index++)split.push(...Boss.step(copy,[target],.025));
 assert.deepEqual(combined,split);assert.ok(Math.abs(world.boss.attack-copy.boss.attack)<1e-9);copy.boss.attack=world.boss.attack;assert.deepEqual(world.boss,copy.boss);
});
test('authoritative Sweeper reinforcements spawn finite-health boss minions with flying height after the warning',()=>{
 const world=Sim.createWorld(),host=Sim.addPlayer(world,{id:'host'});world.D.fill(0);world.rem=0;world.rngState=0;Sim.step(world);
 Sim.step(world);assert.equal(world.boss.spawnWarning.units.length,3);assert.equal(world.E.length,0);
 const restored=Sim.restore(Sim.snapshot(world));assert.deepEqual(restored.boss,world.boss);
 for(let tick=0;tick<95;tick++){Sim.step(world);Sim.step(restored);}
 assert.equal(world.E.length,3);assert.deepEqual(restored.E,world.E);assert.equal(world.boss.spawnWarning,null);
 for(const enemy of world.E){assert.equal(enemy.bossMinion,true);assert.equal(enemy.hp,ET[enemy.t].hp);assert.equal(enemy.mh,enemy.hp);if(ET[enemy.t].fly)assert.ok(Number.isFinite(enemy.h)&&enemy.h>=.7&&enemy.h<2);else assert.equal(enemy.h,0);}
 assert.ok(world.E.some(enemy=>ET[enemy.t].fly));assert.equal(host.hp,100);
});
test('co-op guests converge on Sweeper reinforcement beacons and spawned boss minions under loss',async()=>{
 const env=environment({latency:100,loss:.02}),host=env.NSR.Session.create({storage:env.storage()}),guest=env.NSR.Session.create({storage:env.storage()});
 const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},30);
 const world=host.view().world;world.D.fill(0);world.rem=0;world.rngState=0;env.advance([host,guest],{},30);
 assert.equal(world.boss.kind,'sweeper');assert.ok(world.boss.spawnWarning);assert.deepEqual(guest.view().world.boss.spawnWarning.units,world.boss.spawnWarning.units);
 assert.ok(Math.abs(guest.view().world.boss.spawnWarning.left-world.boss.spawnWarning.left)<.125);
 env.advance([host,guest],{},100);assert.equal(world.boss.spawnWarning,null);assert.equal(guest.view().world.boss.spawnWarning,null);
 assert.equal(world.E.length,3);assert.ok(world.E.every(enemy=>enemy.bossMinion));assert.deepEqual(guest.view().world.E.map(enemy=>[enemy.id,enemy.t,enemy.hp]),world.E.map(enemy=>[enemy.id,enemy.t,enemy.hp]));
 assert.equal(guest.view().world.boss.summonedPhase,1);await guest.close();await host.close();
});
test('boss selection has an exact 35 percent alternate encounter boundary and legacy defaults',()=>{
 for(const roll of [0,.1,.349999])assert.equal(Boss.choose(1,roll).kind,'sweeper');
 for(const roll of [.35,.9,.999999])assert.equal(Boss.choose(1,roll).kind,'sovereign');
 const legacy=Boss.create(1);delete legacy.kind;assert.equal(Boss.restore(legacy,1).kind,'sovereign');
 assert.equal(Boss.restore({...legacy,kind:'unknown'},1),null);assert.match(Boss.name(Boss.create(1,'sweeper')),/MELTDOWN SWEEPER/);
});
test('chance selection retains Sovereign loadout scaling without tuning the independent Sweeper',()=>{
 const geared={L:mkL(),wl:WP.map(()=>({dmg:40,fr:30,multi:8})),att:WP.map(()=>({b:1}))};
 const sovereign=Boss.choose(3,.35,[geared]);assert.deepEqual(sovereign,Boss.create(3,[geared]));assert.ok(sovereign.power>1);
 const sweeper=Boss.choose(3,0,[geared]);assert.deepEqual(sweeper,Boss.create(3,'sweeper'));assert.equal(sweeper.mh,408);
 const world=Boss.arena({sector:3,dirty:[]});world.boss=sweeper;Boss.seedDust(world);
 const effects=Boss.step(world,[player()],2);assert.equal(effects.find(effect=>effect.type==='summon').units.length,3);assert.equal(sweeper.balanceVersion,undefined);
});
test('Sovereign saves retain exposed attacks and pending pad-targeted blasts',()=>{
 const world=Boss.arena({sector:1,dirty:[]});world.boss=Boss.create(1);world.boss.summonedPhase=1;world.boss.state='exposed';world.boss.timer=8;world.boss.attack=0;
 const target=player('pad',40);Boss.step(world,[target],0);assert.equal(world.boss.warning.x,40);
 const restored=Boss.restore(structuredClone(world.boss),1);assert.deepEqual(restored,world.boss);
 const copy=structuredClone(world);copy.boss=restored;assert.deepEqual(Boss.step(copy,[target],1),Boss.step(world,[target],1));assert.deepEqual(copy.boss,world.boss);
});
test('co-op Sweeper entry never heals and defeat retries before reinforcement telegraphs spawn minions',()=>{
 const world=Sim.createWorld(),host=Sim.addPlayer(world,{id:'host'});host.hp=37;world.E=[];world.D.fill(0);world.rem=0;world.rngState=0;Sim.step(world);
 assert.equal(world.boss.kind,'sweeper');assert.ok(host.hp>=37&&host.hp<38);host.hp=37;Sim.action(world,host.id,{id:1,type:'dock'});assert.equal(host.hp,37);const maximum=world.boss.mh;
 world.boss.phase=2;world.boss.hp=maximum*2/3;host.hp=0;world.rngState=123456789;Sim.step(world);
 assert.equal(world.boss.kind,'sweeper');assert.equal(world.boss.phase,1);assert.equal(world.boss.hp,maximum);assert.equal(host.hp,100);assert.equal(world.E.length,0);
 assert.ok(world.events.some(event=>event.type==='boss-retry'));assert.deepEqual(Sim.restore(Sim.snapshot(world)).boss,world.boss);
});
test('leaks are accessible, fit a baseline tank, and cleaning alone cannot expose the Sweeper',()=>{
 for(let phase=1;phase<=3;phase++){
  const world=fixture(phase);assert.equal(world.D.filter(Boolean).length,[16,22,28][phase-1]);assert.ok(world.rem*10<100);
  world.D.forEach((value,tile)=>{if(value){assert.equal(world.M[tile],0);assert.ok(Math.hypot((tile%60+.5)*2-40,(Math.floor(tile/60)+.5)*2-58)>=8);}});
  assert.equal(Boss.damage(world,999),0);clean(world);Boss.step(world,[],0);assert.equal(world.boss.state,'shielded');assert.equal(Boss.damage(world,999),0);
 }
});
test('a clean arena plus an actual nozzle dodge opens a short, phase-scaled damage window',()=>{
 for(let phase=1;phase<=3;phase++){
  const world=fixture(phase),target=player();clean(world);assert.deepEqual(dodge(world,target),[]);
  assert.equal(world.boss.state,'exposed');assert.ok(world.boss.timer>2.5&&world.boss.timer<=5-phase*.5);assert.ok(Boss.damage(world,10)>0);
  Boss.step(world,[target],world.boss.timer);assert.equal(world.boss.state,'shielded');assert.equal(Boss.damage(world,10),0);
 }
});
test('dirty arenas and nozzle impacts block exposure; continuous collision hits each teammate only once',()=>{
 const dirty=fixture(),dodger=player();dodge(dirty,dodger);assert.equal(dirty.boss.state,'shielded');
 const world=fixture(),target=player(),ally=player('ally',60),safe=player('safe',40),jump=player('jump',60,58,2);clean(world);launch(world,target);
 const effects=Boss.step(world,[target,ally,safe,jump],1);assert.deepEqual(effects.map(effect=>effect.playerId).sort(),['ally','target']);assert.ok(effects.every(effect=>effect.damage===34));assert.equal(world.boss.state,'shielded');
 const team=fixture(),bait=player(),blocker=player('blocker',60);clean(team);launch(team,bait);bait.pose.z+=5;
 assert.equal(Boss.step(team,[bait,blocker],1).length,1);assert.equal(team.boss.state,'shielded');
});
test('disconnects, dead targets and shelter camping do not award a free dodge opening',()=>{
 for(const change of [target=>target.connected=false,target=>target.hp=0,target=>{target.pose.x=40;}]){
  const world=fixture(),target=player();clean(world);launch(world,target);change(target);Boss.step(world,[target],1);assert.equal(world.boss.state,'shielded');
 }
 const world=fixture();world.boss.attack=0;Boss.step(world,[player('safe',40)],5);assert.equal(world.boss.warning,null);assert.equal(world.boss.wave,0);
});
test('dust bombs damage their telegraphed area and add sweepable dust with correct dirty totals',()=>{
 const world=fixture(),target=player(),safe=player('safe',40);clean(world);world.boss.wave=1;world.boss.attack=0;Boss.step(world,[target,safe],0);
 assert.equal(world.boss.warning.kind,'salvo');const effects=Boss.step(world,[target,safe],1.1);assert.equal(effects.length,1);assert.equal(effects[0].damage,27);
 assert.equal(world.D.filter(Boolean).length,5);assert.equal(world.rem,world.D.reduce((sum,value)=>sum+value,0));assert.ok(world.dirty.includes(29*60+28));assert.equal(world.boss.state,'shielded');
 const dodged=fixture(),runner=player();clean(dodged);dodged.boss.wave=1;dodged.boss.attack=0;Boss.step(dodged,[runner],0);runner.pose.z+=5;assert.deepEqual(Boss.step(dodged,[runner],1.1),[]);assert.ok(dodged.rem>0);
});
test('the third attack telegraphs an expanding shock ring with jumping and shelter immunity',()=>{
 const world=fixture(3),ground=player('ground',62),jump=player('jump',62,58,1),safe=player('safe',40);world.boss.wave=3;world.boss.attack=0;
 Boss.step(world,[ground,jump,safe],0);assert.equal(world.boss.warning.kind,'ring');Boss.step(world,[ground,jump,safe],1.1);
 assert.ok(world.boss.ring);assert.deepEqual(Boss.step(world,[ground,jump,safe],1),[{type:'hurt',playerId:'ground',damage:29}]);assert.deepEqual(Boss.step(world,[ground,jump,safe],.1),[]);
});
test('all three phases require new cleanup and a dodge, cap huge damage, and reward victory once',()=>{
 const world=fixture();
 for(let phase=1;phase<=3;phase++){
  world.boss.summonedPhase=phase;
  clean(world);dodge(world,player());assert.equal(Boss.damage(world,1e9),120);assert.equal(world.boss.hp,360-phase*120);
  if(phase<3){assert.equal(world.boss.phase,phase+1);assert.equal(world.boss.state,'shielded');assert.ok(world.rem>0);assert.equal(Boss.damage(world,1e9),0);}
 }
 assert.deepEqual(Boss.step(world,[],0),[{type:'victory'}]);assert.deepEqual(Boss.step(world,[],10),[]);
});
test('Sweeper damage increases across phases without changing nozzle warnings',()=>{
 for(let phase=1;phase<=3;phase++){
  const world=fixture(phase),target=player();world.boss.attack=0;Boss.step(world,[target],0);
  assert.equal(world.boss.warning.left,1.25-phase*.1);Boss.step(world,[target],world.boss.warning.left);
  assert.equal(Boss.step(world,[target],1)[0].damage,[34,37,40][phase-1]);
  const bombs=fixture(phase);bombs.boss.wave=1;bombs.boss.attack=0;Boss.step(bombs,[target],0);
  assert.equal(Boss.step(bombs,[target],1.1)[0].damage,[27,29,31][phase-1]);
  const rings=fixture(phase),nearby=player('nearby',62);rings.boss.wave=3;rings.boss.attack=0;Boss.step(rings,[nearby],0);Boss.step(rings,[nearby],1.1);
  assert.equal(Boss.step(rings,[nearby],1)[0].damage,[25,27,29][phase-1]);
 }
});
test('pressure sweeps join the later-phase pattern without replacing nozzle dodge opportunities',()=>{
 for(let phase=1;phase<=3;phase++)for(let wave=0;wave<8;wave++){
  const world=fixture(phase);world.boss.wave=wave;world.boss.attack=0;Boss.step(world,[player()],0);
  const expected=phase>=2&&wave===5?'sweep':wave%2===0?'nozzle':wave%4===1?'salvo':'ring';
  assert.equal(world.boss.warning.kind,expected);
  if(expected==='sweep'){assert.equal(world.boss.warning.left,1.4);assert.equal(world.boss.warning.x,72);assert.equal(world.boss.warning.z,58);}
 }
});
test('Sweeper recovery gaps are shorter while telegraphs retain their dodge time',()=>{
 for(const [phase,wave,kind,gap] of [[1,1,'salvo',.65],[2,3,'ring',.8],[2,5,'sweep',.8]]){
  const world=fixture(phase),target=player();world.boss.wave=wave;world.boss.attack=0;Boss.step(world,[target],0);
  assert.equal(world.boss.warning.kind,kind);assert.equal(world.boss.warning.left,kind==='sweep'?1.4:1.1);
  Boss.step(world,[target],world.boss.warning.left);assert.ok(Math.abs(world.boss.attack-gap)<1e-9);
  Boss.step(world,[target],gap-.05);assert.equal(world.boss.warning,null);Boss.step(world,[target],.05);
  assert.equal(world.boss.warning.kind,'nozzle');assert.equal(world.boss.warning.left,1.25-phase*.1);
 }
 const world=fixture(),target=player();launch(world,target);
 for(let tick=0;world.boss.nozzle&&tick<100;tick++)Boss.step(world,[target],.025);
 assert.equal(world.boss.nozzle,null);assert.equal(world.boss.attack,1.15);
 Boss.step(world,[target],1.1);assert.equal(world.boss.warning,null);Boss.step(world,[target],.05);assert.equal(world.boss.warning.kind,'salvo');assert.equal(world.boss.warning.left,1.1);
 const exposed=fixture();exposed.boss.state='exposed';exposed.boss.timer=.2;Boss.step(exposed,[target],.2);assert.equal(exposed.boss.attack,.9);
 Boss.step(exposed,[target],.85);assert.equal(exposed.boss.warning,null);Boss.step(exposed,[target],.05);assert.equal(exposed.boss.warning.kind,'nozzle');
});
test('pressure sweeps require a grounded slide, not crouching or jumping, and hit each player once',()=>{
 for(const phase of [2,3]){
  const world=fixture(phase),standing=player('standing',62),sliding=player('sliding',62),crouching=player('crouching',62),jumping=player('jumping',62,58,1),airborne=player('airborne',62,58,1),safe=player('safe',40);
  Object.assign(sliding.pose,{sl:1,g:1});Object.assign(crouching.pose,{low:1,g:1});Object.assign(airborne.pose,{sl:1,g:0});
  const targets=[standing,sliding,crouching,jumping,airborne,safe];world.boss.wave=5;world.boss.attack=0;Boss.step(world,targets,0);
  assert.deepEqual(Boss.step(world,targets,1.4),[]);assert.ok(world.boss.sweep);world.boss.attack=100;
  const effects=Boss.step(world,targets,1);assert.deepEqual(effects.map(effect=>effect.playerId).sort(),['airborne','crouching','jumping','standing']);assert.ok(effects.every(effect=>effect.damage===27+phase*2));
  assert.deepEqual(Boss.step(world,targets,.2),[]);assert.equal(world.boss.state,'shielded');
 }
});
test('authoritative movement distinguishes a real slide from stationary crouching during a sweep',()=>{
 for(const moving of [false,true]){
  const world=Sim.createWorld(),host=Sim.addPlayer(world,{id:'host'});world.D.fill(0);world.rem=0;world.rngState=0;Sim.step(world);
  Object.assign(world.boss,{phase:2,hp:240,attack:100,sweep:{radius:9.4,hit:[]}});Object.assign(host.pose,{x:62,z:58,h:0,g:1,vx:0,vz:moving?-6:0});
  Sim.step(world,{host:{fw:moving,crouch:true,yaw:0,pit:0}});
  assert.equal(!!host.pose.sl,moving);assert.equal(host.hp,moving?100:69);
 }
});
test('pressure telegraphs and active sweeps round-trip and reject malformed checkpoint state',()=>{
 const world=fixture(2),target=player();world.boss.wave=5;world.boss.attack=0;Boss.step(world,[target],0);
 assert.deepEqual(Boss.restore(structuredClone(world.boss),1),world.boss);Boss.step(world,[target],1.4);Boss.step(world,[target],.3);
 const copy=structuredClone(world);copy.boss=Boss.restore(copy.boss,1);assert.deepEqual(copy.boss,world.boss);
 for(const dt of [.5,.4]){assert.deepEqual(Boss.step(copy,[target],dt),Boss.step(world,[target],dt));assert.deepEqual(copy.boss,world.boss);}
 for(const sweep of [{radius:-1,hit:[]},{radius:61,hit:[]},{radius:Infinity,hit:[]},{radius:1,hit:[null]},{radius:1,hit:Array(33).fill('id')}])assert.equal(Boss.restore({...world.boss,sweep},1),null);
 assert.equal(Boss.restore({...world.boss,kind:'sovereign'},1),null);assert.equal(Boss.restore({...world.boss,phase:1,hp:world.boss.mh},1),null);
 const legacy=fixture().boss;assert.deepEqual(Boss.restore(legacy,1),legacy);
});
test('pressure sweeps are substep-stable and disappear on exposure, phase gates, death and expiry',()=>{
 const world=fixture(2);world.boss.sweep={radius:0,hit:[]};world.boss.attack=100;const copy=structuredClone(world),target=player('target',62);
 const combined=Boss.step(world,[target],1),split=[];for(let index=0;index<40;index++)split.push(...Boss.step(copy,[target],.025));assert.deepEqual(combined,split);assert.ok(Math.abs(world.boss.sweep.radius-copy.boss.sweep.radius)<1e-9);
 world.boss.sweep.radius=59.9;Boss.step(world,[],.025);assert.equal(world.boss.sweep,null);
 world.boss.sweep={radius:40,hit:[]};clean(world);dodge(world,player());assert.equal(world.boss.state,'exposed');assert.equal(world.boss.sweep,null);
 world.boss.sweep={radius:1,hit:[]};Boss.damage(world,1e9);assert.equal(world.boss.sweep,null);
 const final=fixture(3);final.boss.state='exposed';final.boss.sweep={radius:1,hit:[]};Boss.damage(final,1e9);assert.equal(final.boss.state,'dead');assert.equal(final.boss.sweep,null);
});
test('pending telegraphs and flying nozzles survive saves deterministically and reject malformed state',()=>{
 const world=fixture(),target=player();launch(world,target);Boss.step(world,[target],.2);
 const copy=structuredClone(world);copy.boss=Boss.restore(copy.boss,1);assert.deepEqual(copy.boss,world.boss);assert.deepEqual(Boss.step(copy,[target],.3),Boss.step(world,[target],.3));assert.deepEqual(copy.boss,world.boss);
 for(const change of [{dx:0,dz:0},{x:0},{travel:-1},{length:Infinity},{hit:[null]}])assert.equal(Boss.restore({...world.boss,nozzle:{...world.boss.nozzle,...change}},1),null);
 assert.equal(Boss.restore({...world.boss,warning:{kind:'nozzle',x:56,z:58,left:1,radius:1.7}},1),null);
 for(const wave of [0,1,3]){const pending=fixture();pending.boss.wave=wave;pending.boss.attack=0;Boss.step(pending,[target],0);assert.deepEqual(Boss.restore(pending.boss,1),pending.boss);assert.equal(Boss.restore({...pending.boss,warning:{...pending.boss.warning,kind:'bad'}},1),null);}
});
test('Sweeper simulation substeps are stable and invalid time does not mutate the encounter',()=>{
 const world=fixture(),target=player();launch(world,target);const copy=structuredClone(world);
 const combined=Boss.step(world,[target],.75),split=[];for(let index=0;index<30;index++)split.push(...Boss.step(copy,[target],.025));assert.deepEqual(combined,split);assert.ok(Math.abs(world.boss.nozzle.travel-copy.boss.nozzle.travel)<1e-9);
 const before=structuredClone(world);for(const dt of [-1,NaN,Infinity])assert.deepEqual(Boss.step(world,[target],dt),[]);assert.deepEqual(world,before);
});
test('nozzles stay inside the arena, handle point-blank targets, and rotate co-op targets',()=>{
 for(const target of [player('edge',34,74),player('edge',72,76),player('close',72,58)]){
  const world=fixture();launch(world,target);const nozzle=world.boss.nozzle,end={x:72+nozzle.dx*nozzle.length,z:58+nozzle.dz*nozzle.length};
  assert.ok(end.x>=33&&end.x<=85&&end.z>=41&&end.z<=77);assert.ok(Boss.restore(world.boss,1));
 }
 const first=player('first',56),second=player('second',62);
 for(const wave of [0,2,4,6]){const world=fixture();world.boss.wave=wave;world.boss.attack=0;Boss.step(world,[first,second],0);assert.equal(world.boss.warning.x,wave%4===0?first.pose.x:second.pose.x);}
});
test('authoritative co-op selects the alternate boss and restores a flying nozzle checkpoint',()=>{
 const world=Sim.createWorld();Sim.addPlayer(world,{id:'host'});world.D.fill(0);world.rem=0;world.rngState=0;Sim.step(world);assert.equal(world.boss.kind,'sweeper');
 const target=world.players.host;target.pose.x=56;target.pose.z=58;launch(world,target);Boss.step(world,[target],.1);
 const restored=Sim.restore(Sim.snapshot(world));assert.deepEqual(restored.boss,world.boss);assert.deepEqual(restored.D,world.D);assert.equal(restored.rem,world.rem);
});
test('co-op guests converge on alternate boss selection, nozzle state and exposure',async()=>{
 const env=environment({latency:100,loss:.02}),host=env.NSR.Session.create({storage:env.storage()}),guest=env.NSR.Session.create({storage:env.storage()});
 const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},30);
 const world=host.view().world;world.D.fill(0);world.rem=0;world.rngState=0;env.advance([host,guest],{},30);assert.equal(world.boss.kind,'sweeper');assert.equal(guest.view().world.boss.kind,'sweeper');
 const target=Object.values(world.players)[0];target.pose.x=56;target.pose.z=58;clean(world);launch(world,target);env.advance([host,guest],{},8);assert.ok(guest.view().world.boss.nozzle);
 target.pose.z=63;env.advance([host,guest],{},50);assert.equal(world.boss.state,'exposed');assert.equal(guest.view().world.boss.state,'exposed');
 await guest.close();await host.close();
});
test('co-op guests receive pressure warnings, active sweeps and authoritative damage under loss',async()=>{
 const env=environment({latency:100,loss:.02}),host=env.NSR.Session.create({storage:env.storage()}),guest=env.NSR.Session.create({storage:env.storage()});
 const result=await host.host();await guest.join(result.invitation);env.advance([host,guest],{},30);
 const world=host.view().world;world.D.fill(0);world.rem=0;world.rngState=0;env.advance([host,guest],{},30);
 const target=world.players[host.view().localId];Object.assign(target.pose,{x:62,z:58,h:0,g:1});Object.assign(world.boss,{phase:2,hp:240,wave:5,attack:0,summonedPhase:2,spawnWarning:null});
 env.advance([host,guest],{},14);assert.equal(world.boss.warning.kind,'sweep');assert.equal(guest.view().world.boss.warning.kind,'sweep');
 assert.deepEqual(env.NSR.Simulation.restore(env.NSR.Simulation.snapshot(world)).boss,world.boss);
 env.advance([host,guest],{},92);assert.ok(world.boss.sweep);assert.ok(guest.view().world.boss.sweep);world.boss.attack=10;
 assert.deepEqual(env.NSR.Simulation.restore(env.NSR.Simulation.snapshot(world)).boss,world.boss);
 env.advance([host,guest],{},60);assert.equal(target.hp,69);assert.equal(guest.view().world.players[target.id].hp,69);assert.deepEqual([...world.boss.sweep.hit],[target.id]);
 await guest.close();await host.close();
});
