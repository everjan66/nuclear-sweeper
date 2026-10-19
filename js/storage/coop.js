(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
function validate(value,dev){
 if(!value||value.format!=='nsr-coop'||value.version!==1||typeof value.worldId!=='string'||!value.worldId.length||value.worldId.length>100||!value.identities||typeof value.identities!=='object'||Array.isArray(value.identities)||!value.world)throw new Error('Unsupported co-op save.');
 if(typeof value.world.dev!=='boolean'||value.world.dev!==!!dev)throw new Error('Developer saves are separate from normal co-op.');
 const world=NSR.Simulation.restore(value.world),identities={};
 for(const [id,token]of Object.entries(value.identities)){
  if(!Object.hasOwn(world.players,id)||typeof token!=='string'||!token.length||token.length>128)throw new Error('Invalid character reconnect credentials.');
  Object.defineProperty(identities,id,{value:token,enumerable:true});
 }
 if(!Object.hasOwn(identities,world.hostId)||Object.keys(world.players).some(id=>!Object.hasOwn(identities,id)))throw new Error('Missing character reconnect credentials.');
 return {format:'nsr-coop',version:1,worldId:value.worldId,identities,world};
}
function create({dev=false,storage=root.localStorage}={}){
 const key=dev?'nsr_coop_dev_v1':'nsr_coop_v1',identityKey=key+'_identities';
 return {
  key,
  load(){const text=storage.getItem(key);return text?validate(JSON.parse(text),dev):null;},
  inspect(text){if(typeof text!=='string'||text.length>5e6)throw new Error('That file is too large to be a co-op save.');return validate(JSON.parse(text),dev);},
  importCheckpoint(value){const checked=validate(value,dev);storage.setItem(key,JSON.stringify({...checked,world:NSR.Simulation.snapshot(checked.world),savedAt:Date.now()}));return checked;},
  save(checkpoint){storage.setItem(key,JSON.stringify({format:'nsr-coop',version:1,savedAt:Date.now(),worldId:checkpoint.worldId,identities:checkpoint.identities,world:NSR.Simulation.snapshot(checkpoint.world)}));},
  identity(worldId){try{return JSON.parse(storage.getItem(identityKey)||'{}')[worldId]||null;}catch(error){return null;}},
  remember(worldId,identity){const identities=JSON.parse(storage.getItem(identityKey)||'{}');identities[worldId]=identity;const entries=Object.entries(identities).slice(-20);storage.setItem(identityKey,JSON.stringify(Object.fromEntries(entries)));}
 };
}
NSR.Storage={create};
if(typeof module!=='undefined')module.exports=NSR.Storage;
})(globalThis);
