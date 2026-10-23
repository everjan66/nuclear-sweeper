'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {disposeTree}=require('../js/ui/resources.js');
test('owned subtree disposal deduplicates resources and retains explicitly shared assets',()=>{
 const resource=(extra={})=>({count:0,dispose(){this.count++},...extra});
 const geometry=resource(),texture=resource({isTexture:true}),material=resource({map:texture}),shared=resource({map:texture}),instance=resource({isInstancedMesh:true,geometry,material:[material,shared]});
 const tree={parent:{remove(value){assert.equal(value,tree);this.removed=true;}},traverse(fn){fn(instance);fn({geometry,material});}};
 disposeTree(tree,[shared,texture]);assert.equal(instance.count,1);assert.equal(geometry.count,1);assert.equal(material.count,1);assert.equal(shared.count,0);assert.equal(texture.count,0);assert.equal(tree.parent.removed,true);
});
