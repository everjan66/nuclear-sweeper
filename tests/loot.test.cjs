'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Loot=require('../js/game/loot.js'),Sim=require('../js/game/simulation.js');
test('loot stacks conserve long-session rewards and keep rare markers independent',()=>{
 const world=Sim.createWorld({sector:10}),player=Sim.addPlayer(world,{id:'host'});world.Dr=[];
 for(let i=0;i<2000;i++)Sim.recordKill(world,player,{id:'e'+i,t:2,x:(i%60)*2,z:(i/60|0)*2},0,false);
 assert.ok(world.Dr.length<=Loot.LIMIT);const sum=world.Dr.reduce((sum,d)=>sum+d.a,0);assert.ok(sum>10000);
 const restored=Sim.restore(Sim.snapshot(world));assert.equal(restored.Dr.reduce((sum,d)=>sum+d.a,0),sum);
 const legacy=Sim.snapshot(world);legacy.Dr=Array.from({length:2500},(_,i)=>({id:'l'+i,k:'scrap',a:1,x:i%120,z:i%113,y:.4,vx:0,vz:0}));
 legacy.Dr.push({id:'rare',k:'scrap',a:6,x:1,z:1,y:.4,vx:0,vz:0,m:'v',bit:16});
 const recovered=Sim.restore(legacy);assert.ok(recovered.Dr.length<=Loot.LIMIT);assert.equal(recovered.Dr.reduce((sum,d)=>sum+d.a,0),2506);assert.equal(recovered.Dr.filter(d=>d.m).length,1);assert.equal(recovered.Dr.find(d=>d.m).bit,16);
 assert.equal(legacy.Dr.length,2501);
});
test('solo drops with implicit scrap amounts conserve value during compaction',()=>{
 const drops=[];for(let i=0;i<2000;i++)Loot.add(drops,{x:i%120,z:i%113,vx:0,vz:0});assert.ok(drops.length<=Loot.LIMIT);assert.equal(drops.reduce((sum,d)=>sum+(d.a??1),0),2000);
});
