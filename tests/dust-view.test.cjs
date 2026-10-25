'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../js/ui/dust-view.js');
function fixture(){
 const width=8,height=6,tileSize=2,count=width*height;
 const attribute=size=>({array:new Float32Array(size),updateRange:{offset:0,count:-1},needsUpdate:false});
 const matrix=attribute(count*16),color=attribute(count*3),dust=Float32Array.from({length:count},(_,i)=>i%5/4),map=Array.from({length:count},(_,i)=>i%7===0?6:0);
 const state={dust,map,x:5,z:5,radius:6,low:[.1,.2,.3],high:[.7,.8,.9],dirty:[]},view=create({width,height,tileSize,matrix,color});
 const reset=()=>{for(const attr of [matrix,color]){attr.needsUpdate=false;attr.updateRange.count=-1;}};
 function check(){for(let i=0;i<count;i++){
  const x=(i%width+.5)*tileSize,z=(Math.floor(i/width)+.5)*tileSize,k=dust[i]<.02?0:1,gain=Math.hypot(x-state.x,z-state.z)<state.radius?1:.5;
  const expected=Float32Array.from([k,0,0,0,0,k*(.06+dust[i]*.5),0,0,0,0,k,0,x,map[i]===6?3.2:0,z,1]);assert.deepEqual(matrix.array.slice(i*16,i*16+16),expected);
  for(let c=0;c<3;c++)assert.equal(color.array[i*3+c],Math.fround((state.low[c]+(state.high[c]-state.low[c])*dust[i])*gain));
 }}
 view.update({...state,full:true});check();reset();return {matrix,color,state,view,reset,check};
}
test('stationary dust does not upload buffers and a changed tile uploads only its ranges',()=>{
 const f=fixture();f.view.update(f.state);assert.equal(f.matrix.needsUpdate,false);assert.equal(f.color.needsUpdate,false);
 f.state.dust[10]=.63;f.state.dirty=[10,10,10];f.view.update(f.state);f.check();assert.deepEqual(f.matrix.updateRange,{offset:160,count:16});assert.deepEqual(f.color.updateRange,{offset:30,count:3});
 f.reset();f.view.update(f.state);assert.equal(f.matrix.needsUpdate,false);assert.equal(f.color.needsUpdate,false);
});
test('movement, range shrink and teleport recolor cells without changing geometry',()=>{
 const f=fixture();for(const [x,z,radius]of [[6,5,6],[40,30,6],[4,4,90],[4,4,1],[5,5,2]]){
  f.reset();Object.assign(f.state,{x,z,radius});f.view.update(f.state);f.check();assert.equal(f.matrix.needsUpdate,false);
 }
});
test('dust edits, map replacement and palette rebuilds match reference transforms and colors',()=>{
 const f=fixture();f.state.dust[7]=0;f.state.map[12]=6;f.state.dirty=[7,12];f.view.update(f.state);f.check();
 f.reset();f.state.dust.fill(.8);f.state.low=[.4,.3,.2];f.state.high=[.9,.6,.5];f.view.update({...f.state,full:true});f.check();assert.equal(f.matrix.updateRange.count,f.matrix.array.length);assert.equal(f.color.updateRange.count,f.color.array.length);
});
test('multiple edits before GPU consumption retain the union of upload ranges',()=>{
 const f=fixture();f.state.dust[10]=.62;f.state.dirty=[10];f.view.update(f.state);f.state.dust[14]=.73;f.state.dirty=[14];f.view.update(f.state);f.check();assert.deepEqual(f.matrix.updateRange,{offset:160,count:80});
});
