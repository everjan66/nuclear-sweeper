(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
// The caller owns the subtree and explicitly lists resources shared outside it.
function disposeTree(tree,shared=[]){
 const retained=new Set(shared),disposed=new Set();
 const release=resource=>{if(resource&&!retained.has(resource)&&!disposed.has(resource)){disposed.add(resource);resource.dispose();}};
 tree.traverse(object=>{
  if(object.isInstancedMesh)release(object); // r128 frees instance matrix/color buffers here.
  if(object.geometry)release(object.geometry);
  for(const material of [].concat(object.material||[])){
   if(retained.has(material))continue;
   for(const value of Object.values(material))if(value?.isTexture)release(value);
   release(material);
  }
 });
 tree.parent?.remove(tree);
}
NSR.Resources={disposeTree};
if(typeof module!=='undefined')module.exports=NSR.Resources;
})(globalThis);
