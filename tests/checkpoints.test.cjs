'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Checkpoints=require('../js/storage/checkpoints.js');
function fixture(){const values=new Map();let failing=null;const storage={getItem:key=>values.get(key)??null,setItem(key,value){if(key===failing)throw Error('Quota exceeded');values.set(key,value);},removeItem:key=>values.delete(key)};const store=Checkpoints.create({key:'solo',storage,validate:value=>value?.version===1&&Number.isFinite(value.credits)?value:null});return {values,store,fail:key=>failing=key};}
test('rejected saves remain intact until recovery or explicit reset',()=>{
 const {values,store}=fixture();assert.equal(store.load(),null);store.write({version:1,credits:12345});store.write({version:1,credits:12346});
 for(const text of ['{broken',JSON.stringify({version:99,credits:12345})]){values.set('solo',text);assert.throws(()=>store.load());assert.throws(()=>store.write({version:1,credits:0}));assert.equal(values.get('solo'),text);}
 store.restoreBackup();assert.equal(store.load().credits,12345);assert.match(values.get('solo_rejected'),/99/);
 store.reset();assert.equal(store.load(),null);assert.equal(store.backup(),null);assert.match(values.get('solo_rejected'),/12345/);
});
test('quota and validation failures preserve the current valid checkpoint',()=>{
 const {values,store,fail}=fixture();store.write({version:1,credits:123});const original=values.get('solo');
 assert.throws(()=>store.write({version:2,credits:0}));assert.equal(values.get('solo'),original);
 for(const slot of ['solo_backup','solo']){fail(slot);assert.throws(()=>store.write({version:1,credits:456}));assert.equal(values.get('solo'),original);}
 fail('solo_rejected');assert.throws(()=>store.reset());assert.equal(values.get('solo'),original);
});
