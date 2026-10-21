'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('nuclear-sweeper-reactor.html','utf8');
const Defs=require('../js/core/definitions.js');
function fixture(names,extra={}){
 const context=vm.createContext({S:{boss:{state:'shielded'},bossDead:0,hp:37,L:{},raw:3,tank:12},ammo:[0],reserves:[0],wi:0,mag:()=>7,ST:()=>({hp:100}),canDock:true,save:()=>{},resupplyAmmo:()=>{throw Error('Unexpected resupply');},toast:()=>{},...extra});
 for(const name of ['bossActive',...names]){const line=source.split('\n').find(line=>line.startsWith('function '+name+'('));assert.ok(line,name);vm.runInContext(line,context);}
 return context;
}
test('solo boss reloads at zero reserves and preserves finite inventory until victory',()=>{
 const context=fixture(['canReload','finishReload']);
 assert.equal(context.canReload(),true);context.finishReload();assert.equal(context.ammo[0],7);assert.equal(context.reserves[0],0);
 context.ammo[0]=0;context.reserves[0]=2;context.finishReload();assert.equal(context.reserves[0],2);
 context.S.bossDead=1;context.ammo[0]=0;context.finishReload();assert.equal(context.reserves[0],1);
 context.ammo[0]=0;context.reserves[0]=0;assert.equal(context.canReload(),false);context.finishReload();assert.equal(context.ammo[0],0);
});
test('solo arena dock deposits without healing or resupplying and shop paths are locked',()=>{
 let refills=0;const context=fixture(['dockShelter','openShop','buy'],{resupplyAmmo:()=>refills++});
 context.dockShelter();assert.equal(context.S.hp,37);assert.equal(context.S.raw,15);assert.equal(context.S.tank,0);assert.equal(refills,0);
 context.openShop();context.buy('suit');assert.equal(context.S.hp,37);assert.equal(refills,0);
 context.S.bossDead=1;context.dockShelter();assert.equal(context.S.hp,100);assert.equal(refills,1);
});
test('saved solo boss guards validate and restore their combat state',()=>{
 const context=fixture(['cleanBossEnemies'],{ET:[{}],cl:(value,min,max)=>Math.max(min,Math.min(max,value))});
 const guard={t:0,x:45,z:58,hp:17,mh:80,fc:.4,al:1,bossMinion:true};
 const restored=context.cleanBossEnemies(JSON.parse(JSON.stringify([guard])));
 assert.equal(restored.length,1);assert.equal(restored[0].hp,17);assert.equal(restored[0].fc,.4);assert.equal(restored[0].bossMinion,true);
 assert.equal(context.cleanBossEnemies([{...guard,hp:Infinity}]),null);assert.equal(context.cleanBossEnemies([{...guard,x:0}]),null);
 assert.equal(context.cleanBossEnemies(Array(13).fill(guard)),null);assert.equal(context.cleanBossEnemies(undefined).length,0);
});
test('solo passive regeneration and pad immunity are disabled for active bosses',()=>{
 assert.ok(source.includes('const safe=!bossActive()&&Math.hypot(p.x-SH.x,p.z-SH.z)<7'));
 assert.ok(source.includes('if(!bossActive()&&dm+laserDamage<=0&&S.hp<s.hp)'));
 assert.ok(source.includes('bossEnemies:bossActive()?E.filter(enemy=>enemy.hp>0&&!enemy.gone):[]'));
});
test('solo retries preserve the selected boss instead of rerolling the encounter',()=>{
 for(const kind of ['sovereign','sweeper']){
  let selected;const context=fixture(['retryBoss'],{enterBoss:value=>{selected=value;},say:()=>{}});context.S.boss.kind=kind;
  context.retryBoss();assert.equal(selected,kind);assert.equal(context.S.hp,100);assert.equal(context.S.tank,6);
 }
});
test('both boss renderers retain the nozzle lane and reinforcement indicators',()=>{
 class Visual{constructor(){this.children=[];this.position={set(){}};this.rotation={};this.scale={set(){}};this.userData={};}add(...children){this.children.push(...children);}}
 const THREE=Object.fromEntries(['Group','Mesh','MeshLambertMaterial','MeshBasicMaterial','IcosahedronGeometry','BoxGeometry','ConeGeometry','SphereGeometry','InstancedMesh','CylinderGeometry','OctahedronGeometry'].map(name=>[name,Visual]));
 const build=source.slice(source.indexOf('function buildBossVisuals()'),source.indexOf('function drawBossVisuals()'));
 for(const kind of ['sovereign','sweeper']){
  const context=vm.createContext({THREE,S:{boss:{kind,x:72,z:58}},W3:new Visual(),NSR:{SweeperVisuals:{create:()=>new Visual()}},ring:()=>new Visual()});context.W3.userData.details=new Visual();
  vm.runInContext(build,context);context.buildBossVisuals();const visual=context.W3.userData.boss;
  assert.ok(visual.lane);assert.equal(visual.lane.visible,false);assert.equal(visual.spawnMarkers.length,10);assert.equal(!!visual.sweeper,kind==='sweeper');
 }
});
test('saved solo boss Shriekers retain flying altitude and boss minion status',()=>{
 const context=fixture(['cleanBossEnemies'],{ET:Defs.ET,WH:Defs.WH,cl:Defs.cl});
 const flyer={t:4,x:45,z:58,h:3.2,hp:20,mh:38,fc:1,bossMinion:true};
 const restored=context.cleanBossEnemies(JSON.parse(JSON.stringify([flyer])));
 assert.equal(restored[0].h,3.2);assert.equal(restored[0].t,4);assert.equal(restored[0].bossMinion,true);
 const legacy={...flyer};delete legacy.h;assert.equal(context.cleanBossEnemies([legacy])[0].h,.7);
});
test('solo Sweeper victory removes guards and hostile projectiles before saving',()=>{
 let saved=0;const context=fixture(['tickBoss'],{E:[{bossMinion:true},{bossMinion:false}],EP:[{dm:99}],p:{},bossWorld:()=>({}),syncBossWorld:()=>{},NSR:{Boss:{step:()=>[{type:'victory'}],name:()=> 'THE MELTDOWN SWEEPER'}},celebrate:()=>{},save:()=>saved++});
 Object.assign(context.S,{boss:{kind:'sweeper',state:'shielded'},sector:1,cred:0,parts:0});context.tickBoss(0);
 assert.equal(context.E.length,1);assert.equal(context.E[0].bossMinion,false);assert.equal(context.EP.length,0);assert.equal(context.S.bossDead,1);assert.equal(context.S.cred,1250);assert.equal(context.S.parts,3);assert.equal(saved,1);
});
test('solo Sweeper reinforcement callouts do not claim enemies gate the core opening',()=>{
 const messages=[],context=fixture(['tickBoss'],{E:[],p:{},bossWorld:()=>({}),syncBossWorld:()=>{},NSR:{Boss:{step:()=>[{type:'summon',units:[]}]}},toast:message=>messages.push(message)});
 context.S.boss.kind='sweeper';context.tickBoss(0);assert.match(messages[0],/Keep dodging/);assert.doesNotMatch(messages[0],/clear the enemy wave/);
 context.S.boss.kind='sovereign';context.tickBoss(0);assert.match(messages[1],/clear the enemy wave/);
});
