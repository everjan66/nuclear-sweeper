'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../js/game/simulation.js');const Storage=require('../js/storage/coop.js');
test('solo, developer, co-op and reconnect storage remain isolated',()=>{
 const values=new Map([['nsr1','solo'],['nsr1_dev','developer'],['nsr_cfg','settings']]);
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const normal=Storage.create({storage}),developer=Storage.create({dev:true,storage});
 const world=NSR.Simulation.createWorld();NSR.Simulation.addPlayer(world,{id:'host'});
 normal.save({world,worldId:'world',identities:{host:'private'}});normal.remember('world',{playerId:'guest',token:'resume'});
 assert.equal(normal.load().world.hostId,'host');assert.equal(normal.identity('world').token,'resume');assert.equal(developer.load(),null);assert.equal(developer.identity('world'),null);
 assert.equal(values.get('nsr1'),'solo');assert.equal(values.get('nsr1_dev'),'developer');assert.equal(values.get('nsr_cfg'),'settings');
 const publicSnapshot=NSR.Simulation.snapshot(world);assert.equal(JSON.stringify(publicSnapshot).includes('private'),false);
});
test('checkpoint import validates characters and credentials before replacing any save',()=>{
 const values=new Map([['nsr1','solo'],['nsr_coop_v1','previous']]),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const store=Storage.create({storage}),world=NSR.Simulation.createWorld();NSR.Simulation.addPlayer(world,{id:'host'});
 const backup={format:'nsr-coop',version:1,worldId:'imported',identities:{host:'private'},world:NSR.Simulation.snapshot(world)};
 const inspected=store.inspect(JSON.stringify(backup));assert.equal(values.get('nsr_coop_v1'),'previous');store.importCheckpoint(inspected);assert.equal(store.load().worldId,'imported');
 const saved=values.get('nsr_coop_v1');
 for(const corrupt of [{...backup,identities:{}},{...backup,world:{...backup.world,dev:true}},{...backup,world:{...backup.world,team:{...backup.world.team,cred:-1}}}])assert.throws(()=>store.importCheckpoint(corrupt));
 const corrupt=JSON.parse(JSON.stringify(backup));corrupt.world.players.host.pose.x=null;assert.throws(()=>store.inspect(JSON.stringify(corrupt)));
 assert.equal(values.get('nsr_coop_v1'),saved);assert.equal(values.get('nsr1'),'solo');assert.throws(()=>store.inspect('x'.repeat(5000001)));
});

test('autosave validates before replacing a known checkpoint',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},store=Storage.create({storage});
 const world=NSR.Simulation.createWorld();NSR.Simulation.addPlayer(world,{id:'host'});const checkpoint={world,worldId:'world',identities:{host:'private'}};
 store.save(checkpoint);const previous=values.get(store.key);world.players.host.pose.x=NaN;assert.throws(()=>store.save(checkpoint));assert.equal(values.get(store.key),previous);
});
