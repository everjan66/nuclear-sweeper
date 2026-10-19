'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Boss=require('../js/game/boss.js');
function fixture(phase=1){const world=Boss.arena({sector:1,dirty:[]});world.boss=Boss.create(1);world.boss.phase=phase;world.boss.hp=world.boss.mh*(4-phase)/3;Boss.seedDust(world);return world;}
function clean(world){world.D.fill(0);world.rem=0;Boss.step(world,[],0);}
function player(id,x=56,z=58,h=0){return {id,pose:{x,z,h}};}
test('arena mutates the map into a bounded 27 by 19 floor with renderer rooms',()=>{
 const base={sector:5},world=Boss.arena(base);assert.equal(world,base);assert.equal(world.sector,5);
 assert.equal(world.M.length,3600);assert.equal(world.D.length,3600);assert.equal(world.M.filter(tile=>tile===0).length,27*19);
 for(let row=0;row<60;row++)for(let column=0;column<60;column++)assert.equal(world.M[row*60+column],column>=16&&column<=42&&row>=20&&row<=38?0:1);
 assert.ok(world.D.every(value=>value===0));assert.equal(world.R.length,16);assert.equal(world.R[0].sh,true);assert.equal(world.R[5].core,true);
 assert.deepEqual(world.SH,{x:40,z:58});assert.deepEqual(world.CORE,{x:72,z:58});assert.deepEqual(world.DEP,[world.SH]);assert.deepEqual(world.DEPT,[1760]);
 for(const key of ['POOLR','ISL','TERM'])assert.equal(world[key],null);
 for(const key of ['ZIP','DOORT','CO'])assert.deepEqual(world[key],[]);
 assert.equal(world.total,1);assert.equal(world.rem,0);
});
test('dust is deterministic, accessible, affordable and correctly accounted for',()=>{
 for(let phase=1;phase<=3;phase++){
  const world=fixture(phase),copy=fixture(phase);assert.deepEqual(world.D,copy.D);assert.equal(world.D.filter(Boolean).length,[12,18,24][phase-1]);
  assert.equal(world.rem,world.D.reduce((sum,value)=>sum+value,0));assert.ok(world.rem*10<100);assert.ok(world.total>=world.rem);
  world.D.forEach((value,tile)=>{if(!value)return;const point={x:(tile%60+.5)*2,z:(Math.floor(tile/60)+.5)*2};assert.equal(value,.3);assert.equal(world.M[tile],0);assert.ok(Math.hypot(point.x-40,point.z-58)>=8);assert.ok(Math.hypot(point.x-72,point.z-58)>=5);assert.ok(world.dirty.includes(tile));});
  const previous=world.D.map((value,tile)=>value?tile:-1).filter(tile=>tile>=0);world.boss.phase=phase%3+1;world.dirty=[];Boss.seedDust(world);
  for(const tile of previous)assert.ok(world.dirty.includes(tile));assert.equal(world.rem,world.D.reduce((sum,value)=>sum+value,0));
 }
});
test('shield blocks damage and regeneration never crosses the current phase ceiling',()=>{
 for(let phase=1;phase<=3;phase++){const world=fixture(phase),ceiling=world.boss.hp;assert.equal(Boss.damage(world,100000),0);world.boss.hp-=10;Boss.step(world,[],10);assert.equal(world.boss.hp,ceiling);}
});
test('only actual zero cleanup exposes the core, not a percentage or stale counter',()=>{
 const world=fixture();world.D.fill(0);world.D[1500]=.001;world.rem=.001;Boss.step(world,[],0);assert.equal(world.boss.state,'shielded');
 world.rem=0;Boss.step(world,[],0);assert.equal(world.boss.state,'shielded');assert.equal(world.rem,.001);
 world.D[1500]=1e-9;world.rem=0;Boss.step(world,[],0);assert.equal(world.boss.state,'shielded');assert.equal(world.rem,1e-9);
 clean(world);assert.equal(world.boss.state,'exposed');assert.equal(world.boss.timer,10);
});
test('each exposure expires and reseeds a complete phase wave',()=>{
 for(let phase=1;phase<=3;phase++){const world=fixture(phase);clean(world);assert.equal(world.boss.timer,11-phase);Boss.step(world,[],10-phase);assert.equal(world.boss.state,'exposed');Boss.step(world,[],1);assert.equal(world.boss.state,'shielded');assert.equal(world.D.filter(Boolean).length,[12,18,24][phase-1]);}
});
test('huge damage stops at each boundary and cannot skip shields or phases',()=>{
 const world=fixture();
 for(let phase=1;phase<=3;phase++){
  clean(world);assert.equal(Boss.damage(world,Infinity),0);assert.equal(Boss.damage(world,-5),0);assert.equal(Boss.damage(world,100000),100);
  assert.equal(world.boss.hp,300-phase*100);
  if(phase<3){assert.equal(world.boss.phase,phase+1);assert.equal(world.boss.state,'shielded');assert.ok(world.rem>0);assert.equal(Boss.damage(world,100000),0);}
 }
 assert.equal(world.boss.state,'dead');assert.deepEqual(Boss.step(world,[],0),[{type:'victory'}]);assert.deepEqual(Boss.step(world,[],20),[]);
});
test('telegraphed blasts hit, can be dodged, and never hurt sheltered players',()=>{
 const world=fixture(),target=player('target'),safe=player('safe',40);world.boss.attack=0;
 Boss.step(world,[safe,target],0);assert.deepEqual(world.boss.warning,{x:56,z:58,left:1.4,radius:3});
 assert.deepEqual(Boss.step(world,[safe,target],1.3),[]);assert.deepEqual(Boss.step(world,[safe,target],.1),[{type:'hurt',playerId:'target',damage:18}]);
 world.boss.attack=0;Boss.step(world,[target],0);target.pose.z+=4;assert.deepEqual(Boss.step(world,[target],1.4),[]);
 world.boss.attack=0;assert.deepEqual(Boss.step(world,[safe],0),[]);assert.equal(world.boss.warning,null);
 world.boss.warning={x:47,z:58,left:.1,radius:3};assert.deepEqual(Boss.step(world,[player('edge',47)],.1),[]);
});
test('phase two fires a faster second blast after the first warning',()=>{
 const world=fixture(2),target=player('target');world.boss.attack=0;Boss.step(world,[target],0);assert.equal(world.boss.burst,1);
 Boss.step(world,[target],1.4);Boss.step(world,[target],.35);assert.ok(world.boss.warning);assert.equal(world.boss.wave,2);assert.equal(world.boss.burst,0);
});
test('phase three shockwave expands, hits once, and can be jumped',()=>{
 const world=fixture(3),ground=player('ground',62),jump=player('jump',62,58,1),safe=player('safe',40);world.boss.attack=0;
 Boss.step(world,[ground,jump,safe],0);assert.equal(world.boss.ring.radius,0);
 const effects=Boss.step(world,[ground,jump,safe],1);assert.deepEqual(effects,[{type:'hurt',playerId:'ground',damage:18}]);
 assert.deepEqual(Boss.step(world,[ground,jump,safe],.1),[]);assert.ok(world.boss.ring.radius>10);
});
test('restore validates state, clamps timers and preserves pending attacks without aliases',()=>{
 const world=fixture(3);world.boss.attack=0;Boss.step(world,[player('target')],0);Boss.step(world,[],.2);
 const raw=JSON.parse(JSON.stringify(world.boss)),restored=Boss.restore(raw,1);assert.deepEqual(restored,world.boss);restored.ring.hit.push('other');assert.deepEqual(raw.ring.hit,[]);
 for(const change of [{hp:NaN},{timer:Infinity},{state:'bad'},{phase:4},{phase:1.5},{mh:0},{warning:{x:NaN,z:0,left:1,radius:3}},{ring:{radius:1,hit:[null]}},{victory:true}])assert.equal(Boss.restore({...raw,...change},1),null);
 assert.equal(Boss.restore(null,1),null);assert.equal(Boss.restore([],1),null);assert.equal(Boss.restore(new Date(),1),null);
 const clamped=Boss.restore({...Boss.create(1),hp:1000,timer:99,attack:-10,wave:-1},1);assert.equal(clamped.hp,300);assert.equal(clamped.timer,10);assert.equal(clamped.attack,0);assert.equal(clamped.wave,0);
});
test('restoring death preserves exactly-once victory delivery',()=>{
 const world=fixture(3);clean(world);Boss.damage(world,100000);world.boss=Boss.restore(JSON.parse(JSON.stringify(world.boss)),1);
 assert.deepEqual(Boss.step(world,[],0),[{type:'victory'}]);world.boss=Boss.restore(JSON.parse(JSON.stringify(world.boss)),1);assert.deepEqual(Boss.step(world,[],0),[]);
});
test('fractional phase boundaries and saved attack timings remain deterministic',()=>{
 const world=fixture();world.boss=Boss.create(2);clean(world);
 assert.ok(Math.abs(Boss.damage(world,100000)-320/3)<1e-10);assert.equal(world.boss.phase,2);assert.equal(world.boss.hp,640/3);
 world.boss.attack=0;Boss.step(world,[player('target')],0);Boss.step(world,[],.4);
 const copy=JSON.parse(JSON.stringify(world));copy.boss=Boss.restore(copy.boss,2);assert.ok(copy.boss);
 assert.deepEqual(Boss.step(copy,[player('target')],1),Boss.step(world,[player('target')],1));assert.deepEqual(copy.boss,world.boss);
});
