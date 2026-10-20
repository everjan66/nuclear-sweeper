'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('nuclear-sweeper-reactor.html','utf8');
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
 assert.ok(source.includes('if(!bossActive()&&dm<=0&&S.hp<s.hp)'));
 assert.ok(source.includes('bossEnemies:bossActive()?E.filter(enemy=>enemy.hp>0&&!enemy.gone):[]'));
});
