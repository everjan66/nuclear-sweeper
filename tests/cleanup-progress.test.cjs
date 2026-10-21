'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cleanupProgress}=require('../js/core/definitions.js');
const Boss=require('../js/game/boss.js');
test('cleanup display never rounds remaining dust to full completion',()=>{
 for(const remaining of [.4,.01,1e-10,Number.MIN_VALUE]){
  const dust=[0,remaining,0],world={D:dust,rem:0};
  const progress=cleanupProgress(1000,dust);
  assert.equal(progress.percent,99.9);assert.equal(progress.patches,1);
  assert.equal(progress.remaining,remaining);assert.equal(Boss.isClean(world),false);
 }
});
test('cleanup display and teleport agree on actual zero dust, not a stale counter',()=>{
 const world={D:Float32Array.from([0,.25,0]),rem:0};
 assert.equal(cleanupProgress(1000,world.D).patches,1);assert.equal(Boss.isClean(world),false);
 world.D[1]=0;world.rem=.25;
 assert.deepEqual(cleanupProgress(1000,world.D),{percent:100,remaining:0,patches:0});
 assert.equal(Boss.isClean(world),true);
});
test('cleanup display preserves normal rounding and counts every remaining patch',()=>{
 assert.deepEqual(cleanupProgress(100,[10,3.456,0]),{percent:86.5,remaining:13.456,patches:2});
 assert.equal(cleanupProgress(100,[3]).percent,97);
 assert.equal(cleanupProgress(0,[1]).percent,0);assert.equal(cleanupProgress(1,[2]).percent,0);
 assert.equal(cleanupProgress(0,[]).percent,100);
});
