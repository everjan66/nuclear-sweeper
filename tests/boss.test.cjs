'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Boss=require('../js/game/boss.js');
const Maps=require('../js/core/map.js');
const {WP,mkL}=require('../js/core/definitions.js');
function fixture(phase=1){const world=Boss.arena({sector:1,dirty:[]});world.boss=Boss.create(1);world.boss.phase=phase;world.boss.hp=world.boss.mh*(4-phase)/3;Boss.seedDust(world);Boss.step(world,[],0);return world;}
function clean(world){world.D.fill(0);world.rem=0;Boss.step(world,[],0);Boss.step(world,[],0);}
function player(id,x=56,z=58,h=0){return {id,pose:{x,z,h}};}
function geared(id='gear'){return {...player(id),L:mkL(),wl:WP.map(()=>({dmg:0,fr:0,multi:0})),att:WP.map(()=>({s:0,b:0,l:0}))};}
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
test('Float32 sweeping drift cannot block full-site completion or boss exposure',()=>{
 function sweep(world){for(let tile=0;tile<world.D.length;tile++)while(world.D[tile]>0){const value=world.D[tile];let taken=Math.min(value,.6/(1+.4*(world.sector-1))/64*1.2),remaining=value-taken;if(remaining<.02){taken=value;remaining=0}world.D[tile]=remaining;world.rem-=taken;}}
 const site=Maps.generate(1);site.D=Float32Array.from(site.D);sweep(site);
 assert.ok(Math.abs(site.rem)>1e-6);assert.ok(site.D.every(value=>value===0));assert.equal(Boss.isClean(site),true);assert.equal(site.rem,0);
 const world=Boss.arena(Maps.generate(2));world.boss=Boss.create(2);world.D=Float32Array.from(world.D);Boss.seedDust(world);sweep(world);
 assert.ok(world.rem>1e-6);Boss.step(world,[],0);assert.equal(world.rem,0);assert.equal(world.boss.state,'shielded');Boss.step(world,[],0);assert.equal(world.boss.state,'exposed');
});
test('huge damage stops at each boundary and cannot skip shields or phases',()=>{
 const world=fixture();
 for(let phase=1;phase<=3;phase++){
  clean(world);assert.equal(Boss.damage(world,Infinity),0);assert.equal(Boss.damage(world,-5),0);assert.ok(Math.abs(Boss.damage(world,100000)-world.boss.mh/3)<1e-9);
  assert.ok(Math.abs(world.boss.hp-world.boss.mh*(3-phase)/3)<1e-9);
  if(phase<3){assert.equal(world.boss.phase,phase+1);assert.equal(world.boss.state,'shielded');assert.ok(world.rem>0);assert.equal(Boss.damage(world,100000),0);}
 }
 assert.equal(world.boss.state,'dead');assert.deepEqual(Boss.step(world,[],0),[{type:'victory'}]);assert.deepEqual(Boss.step(world,[],20),[]);
});
test('telegraphed blasts hit depot/menu players, scale with health, and can be dodged',()=>{
 const world=fixture(),target={...geared(),pose:{x:40,z:58,h:0},menu:true};target.L.suit=20;world.boss.attack=0;
 Boss.step(world,[target],0);const delay=world.boss.warning.left;assert.ok(delay<=1);assert.equal(world.boss.warning.x,40);
 assert.deepEqual(Boss.step(world,[target],delay-.1),[]);assert.deepEqual(Boss.step(world,[target],.1),[{type:'hurt',playerId:target.id,damage:66,source:{x:world.boss.x,z:world.boss.z}}]);
 world.boss.attack=0;Boss.step(world,[target],0);target.pose.z+=4;assert.deepEqual(Boss.step(world,[target],delay),[]);
 world.boss.attack=0;Boss.step(world,[{...target,connected:false}],0);assert.equal(world.boss.warning,null);
});
test('all phases attack promptly with faster sustained cadence even while exposed',()=>{
 for(let phase=1;phase<=3;phase++){
  const world=fixture(phase),target=player('target');clean(world);
  Boss.step(world,[target],1.05);assert.ok(world.boss.warning);assert.equal(world.boss.wave,1);assert.ok(world.boss.warning.left<=[1,.85,.7][phase-1]);
  Boss.step(world,[target],3);assert.ok(world.boss.wave>=[3,4,4][phase-1]);assert.equal(world.boss.state,'exposed');
 }
});
test('phase three shockwave expands, hits once, and can be jumped',()=>{
 const world=fixture(3),ground=player('ground',62),jump=player('jump',72,48,1),safe=player('safe',40);world.boss.attack=0;
 Boss.step(world,[ground,jump,safe],0);assert.equal(world.boss.ring.radius,0);
 const effects=Boss.step(world,[ground,jump,safe],1);assert.equal(effects.filter(effect=>effect.playerId==='ground'&&effect.damage===30).length,2);assert.ok(!effects.some(effect=>effect.playerId==='jump'));
 assert.deepEqual(Boss.step(world,[ground,jump,safe],.1),[]);assert.ok(world.boss.ring.radius>=14);
 assert.ok(Boss.step(world,[safe],1.3).some(effect=>effect.playerId==='safe'));
});
test('restore validates state, clamps timers and preserves pending attacks without aliases',()=>{
 const world=fixture(3);world.boss.attack=0;Boss.step(world,[player('target')],0);Boss.step(world,[],.2);
 const raw=JSON.parse(JSON.stringify(world.boss)),restored=Boss.restore(raw,1);assert.deepEqual(restored,world.boss);restored.ring.hit.push('other');assert.deepEqual(raw.ring.hit,[]);
 for(const change of [{hp:NaN},{timer:Infinity},{state:'bad'},{phase:4},{phase:1.5},{mh:0},{warning:{x:NaN,z:0,left:1,radius:3}},{ring:{radius:1,hit:[null]}},{victory:true}])assert.equal(Boss.restore({...raw,...change},1),null);
 assert.equal(Boss.restore(null,1),null);assert.equal(Boss.restore([],1),null);assert.equal(Boss.restore(new Date(),1),null);
 const clamped=Boss.restore({...Boss.create(1),hp:1000,timer:99,attack:-10,wave:-1},1);assert.equal(clamped.hp,clamped.mh);assert.equal(clamped.timer,10);assert.equal(clamped.attack,0);assert.equal(clamped.wave,0);
});
test('restoring death preserves exactly-once victory delivery',()=>{
 const world=fixture(3);clean(world);Boss.damage(world,100000);world.boss=Boss.restore(JSON.parse(JSON.stringify(world.boss)),1);
 assert.deepEqual(Boss.step(world,[],0),[{type:'victory'}]);world.boss=Boss.restore(JSON.parse(JSON.stringify(world.boss)),1);assert.deepEqual(Boss.step(world,[],0),[]);
});
test('fractional phase boundaries and saved attack timings remain deterministic',()=>{
 const world=fixture();world.boss=Boss.create(2);clean(world);
 assert.ok(Math.abs(Boss.damage(world,100000)-world.boss.mh/3)<1e-10);assert.equal(world.boss.phase,2);assert.equal(world.boss.hp,world.boss.mh*2/3);
 world.boss.attack=0;Boss.step(world,[player('target')],0);Boss.step(world,[],.4);
 const copy=JSON.parse(JSON.stringify(world));copy.boss=Boss.restore(copy.boss,2);assert.ok(copy.boss);
 assert.deepEqual(Boss.step(copy,[player('target')],1),Boss.step(world,[player('target')],1));assert.deepEqual(copy.boss,world.boss);
});
test('strongest owned sustained weapon scales health regardless of equipped selection',()=>{
 const base=geared(),baseline=Boss.create(1,[base]);assert.equal(baseline.power,1);assert.equal(baseline.mh,Boss.create(1).mh);
 const locked=geared();locked.wl[4]={dmg:40,fr:30,multi:8};locked.wi=4;locked.att[4].b=1;
 assert.equal(Boss.create(1,[locked]).power,1);
 locked.L.w4=1;const owned=Boss.create(1,[locked]);assert.ok(owned.mh>baseline.mh*5);locked.wi=0;assert.equal(Boss.create(1,[locked]).mh,owned.mh);
 const upgraded=geared();upgraded.wl[0]={dmg:20,fr:10,multi:4};const boosted=Boss.create(1,[upgraded]);assert.ok(boosted.mh>baseline.mh);assert.equal(boosted.mh/baseline.mh,Math.pow(boosted.power,.9));
 for(const key of ['dmg','fr','multi']){const member=geared();member.wl[0][key]=1;assert.ok(Boss.create(1,[member]).power>1);}
 const attached=geared();attached.att[0].b=1;assert.ok(Boss.create(1,[attached]).power>1);
 for(const index of [5,6]){const member=geared();member.L['w'+index]=1;assert.ok(Boss.create(1,[member]).power>1);}
 const party=Boss.create(1,[base,geared('two')]);assert.equal(party.power,2);assert.ok(party.mh>baseline.mh);assert.equal(Boss.create(1,[base,{...base,connected:false}]).mh,baseline.mh);
 assert.ok(owned.pressure<=1.5);assert.ok(owned.mh<1000000);
});
test('waves gate damage and exposure once per phase, not once per cleanup',()=>{
 const world=Boss.arena({sector:1});world.boss=Boss.create(1);
 for(let phase=1;phase<=3;phase++){
  const effects=Boss.step(world,[player('target')],0);assert.equal(effects.length,1);assert.equal(effects[0].type,'summon');assert.equal(effects[0].units.length,phase+2);assert.equal(world.boss.summonedPhase,phase);assert.equal(world.boss.state,'shielded');
  if(phase>=2){assert.ok(effects[0].units.some(unit=>unit.t===2));assert.ok(effects[0].units.some(unit=>unit.t===3));}
  world.E=[{hp:1,gone:false}];world.D.fill(0);Boss.step(world,[],0);assert.equal(world.boss.state,'shielded');
  world.boss.state='exposed';assert.equal(Boss.damage(world,100000),0);world.boss.state='shielded';world.E[0].gone=true;clean(world);assert.equal(world.boss.state,'exposed');
  Boss.step(world,[],11-phase);assert.equal(world.boss.state,'shielded');assert.equal(Boss.step(world,[],0).filter(effect=>effect.type==='summon').length,0);
  clean(world);Boss.damage(world,100000);
 }
 assert.equal(world.boss.state,'dead');
});
test('deferred summons never expose during the emitting step even with large dt',()=>{
 const world=Boss.arena({sector:1});world.boss=Boss.create(1);const effects=Boss.step(world,[],20);
 assert.equal(effects[0].type,'summon');assert.equal(world.boss.state,'shielded');assert.equal(Boss.damage(world,10),0);
 Boss.step(world,[],0);assert.equal(world.boss.state,'exposed');
 world.E=[{hp:0},{hp:100,gone:true}];assert.equal(Boss.damage(world,10),10);
});
test('spawn spots are deterministic interior floor, spaced away from players and boss',()=>{
 const target=player('target',35,43),make=()=>{const world=Boss.arena({sector:1});world.boss=Boss.create(1,[target]);return {world,effect:Boss.step(world,[target],0)[0]};};
 const {world,effect}=make();assert.deepEqual(effect,make().effect);
 for(const unit of effect.units){assert.equal(world.M[Math.floor(unit.z/2)*60+Math.floor(unit.x/2)],0);assert.ok(unit.x>32&&unit.x<86&&unit.z>40&&unit.z<78);assert.ok(Math.hypot(unit.x-target.pose.x,unit.z-target.pose.z)>=8);assert.ok(Math.hypot(unit.x-world.boss.x,unit.z-world.boss.z)>=6);assert.equal(unit.hpScale,1);}
 const strong=geared();strong.L.w4=1;strong.wl[4]={dmg:40,fr:30,multi:8};world.boss=Boss.create(1,Array(8).fill(strong));const scaled=Boss.step(world,[strong],0)[0];assert.ok(scaled.units.length<=10&&scaled.units.length>3);assert.ok(scaled.units.every(unit=>unit.hpScale===Math.min(12,Math.sqrt(world.boss.power))));
});
test('wave, balance, targeting and exposed attacks restore and reject invalid new fields',()=>{
 const world=fixture();clean(world);world.boss.attack=0;Boss.step(world,[player('target',40)],0);
 const raw=JSON.parse(JSON.stringify(world.boss));assert.deepEqual(Boss.restore(raw,1),world.boss);
 const restored=Boss.restore(raw,1);world.boss=restored;assert.ok(!Boss.step(world,[],0).some(effect=>effect.type==='summon'));
 for(const change of [{power:0},{power:Infinity},{pressure:2},{summonedPhase:4},{summonedPhase:.5},{summonedPhase:2},{balanceVersion:2},{balanceVersion:NaN},{targetCursor:-1},{targetCursor:.5}])assert.equal(Boss.restore({...raw,...change},1),null);
 const legacy={...raw,mh:500,hp:450};for(const key of ['power','pressure','summonedPhase','balanceVersion','targetCursor'])delete legacy[key];
 world.boss=Boss.restore(legacy,1);assert.ok(world.boss);assert.equal(world.boss.balanceVersion,0);
 const strong=geared();strong.wl[0].dmg=20;assert.equal(Boss.step(world,[strong],0)[0].type,'summon');assert.equal(world.boss.balanceVersion,1);assert.ok(world.boss.mh>500);assert.equal(world.boss.hp/world.boss.mh,.9);
 const mh=world.boss.mh;Boss.step(world,[geared()],0);assert.equal(world.boss.mh,mh);assert.ok(!Boss.step(world,[],0).some(effect=>effect.type==='summon'));
});
