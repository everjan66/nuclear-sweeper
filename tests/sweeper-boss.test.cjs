'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Boss=require('../js/game/boss.js'),Sim=require('../js/game/simulation.js');
const {environment}=require('./helpers/network.cjs');
const {WP,mkL}=require('../js/core/definitions.js');
function fixture(phase=1){const world=Boss.arena({sector:1,dirty:[]});world.boss=Boss.create(1,'sweeper');world.boss.phase=phase;world.boss.hp=world.boss.mh*(4-phase)/3;Boss.seedDust(world);return world;}
function player(id='target',x=56,z=58,h=0){return {id,hp:100,pose:{x,z,h}};}
function clean(world){world.D.fill(0);world.rem=0;}
function launch(world,target){world.boss.attack=0;world.boss.wave=0;Boss.step(world,[target],0);assert.equal(world.boss.warning.kind,'nozzle');Boss.step(world,[target],world.boss.warning.left);assert.ok(world.boss.nozzle);}
function dodge(world,target){launch(world,target);target.pose.z+=5;return Boss.step(world,[target],1);}
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
 assert.ok(!Boss.step(world,[player()],2).some(effect=>effect.type==='summon'));assert.equal(sweeper.balanceVersion,undefined);
});
test('Sovereign saves retain exposed attacks and pending pad-targeted blasts',()=>{
 const world=Boss.arena({sector:1,dirty:[]});world.boss=Boss.create(1);world.boss.summonedPhase=1;world.boss.state='exposed';world.boss.timer=8;world.boss.attack=0;
 const target=player('pad',40);Boss.step(world,[target],0);assert.equal(world.boss.warning.x,40);
 const restored=Boss.restore(structuredClone(world.boss),1);assert.deepEqual(restored,world.boss);
 const copy=structuredClone(world);copy.boss=restored;assert.deepEqual(Boss.step(copy,[target],1),Boss.step(world,[target],1));assert.deepEqual(copy.boss,world.boss);
});
test('co-op Sweeper entry never heals and defeat retries the same boss without minions',()=>{
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
 const effects=Boss.step(world,[target,ally,safe,jump],1);assert.deepEqual(effects.map(effect=>effect.playerId).sort(),['ally','target']);assert.ok(effects.every(effect=>effect.damage===31));assert.equal(world.boss.state,'shielded');
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
 assert.equal(world.boss.warning.kind,'salvo');const effects=Boss.step(world,[target,safe],1.1);assert.equal(effects.length,1);assert.equal(effects[0].damage,24);
 assert.equal(world.D.filter(Boolean).length,5);assert.equal(world.rem,world.D.reduce((sum,value)=>sum+value,0));assert.ok(world.dirty.includes(29*60+28));assert.equal(world.boss.state,'shielded');
 const dodged=fixture(),runner=player();clean(dodged);dodged.boss.wave=1;dodged.boss.attack=0;Boss.step(dodged,[runner],0);runner.pose.z+=5;assert.deepEqual(Boss.step(dodged,[runner],1.1),[]);assert.ok(dodged.rem>0);
});
test('the third attack telegraphs an expanding shock ring with jumping and shelter immunity',()=>{
 const world=fixture(3),ground=player('ground',62),jump=player('jump',62,58,1),safe=player('safe',40);world.boss.wave=3;world.boss.attack=0;
 Boss.step(world,[ground,jump,safe],0);assert.equal(world.boss.warning.kind,'ring');Boss.step(world,[ground,jump,safe],1.1);
 assert.ok(world.boss.ring);assert.deepEqual(Boss.step(world,[ground,jump,safe],1),[{type:'hurt',playerId:'ground',damage:26}]);assert.deepEqual(Boss.step(world,[ground,jump,safe],.1),[]);
});
test('all three phases require new cleanup and a dodge, cap huge damage, and reward victory once',()=>{
 const world=fixture();
 for(let phase=1;phase<=3;phase++){
  clean(world);dodge(world,player());assert.equal(Boss.damage(world,1e9),120);assert.equal(world.boss.hp,360-phase*120);
  if(phase<3){assert.equal(world.boss.phase,phase+1);assert.equal(world.boss.state,'shielded');assert.ok(world.rem>0);assert.equal(Boss.damage(world,1e9),0);}
 }
 assert.deepEqual(Boss.step(world,[],0),[{type:'victory'}]);assert.deepEqual(Boss.step(world,[],10),[]);
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
