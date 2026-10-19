(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
function create({THREE,scene,template}){
 const players=new Map(),flashes=new Map(),{WP,TIERS}=NSR.Defs;
 function build(member){
  const model=template.clone(),materials=new Set(),geometries=new Set(),textures=new Set();model.name='sweeper:'+member.id;
  model.traverse(object=>{if(object.material){object.material=object.material.clone();materials.add(object.material);}});
  const oldWeapon=model.getObjectByName('held-weapon');if(oldWeapon)oldWeapon.visible=false;
  const box=new THREE.BoxGeometry(1,1,1);geometries.add(box);
  const finish=new THREE.MeshPhongMaterial({color:0x888888,shininess:100}),dark=new THREE.MeshLambertMaterial({color:0x17202a}),red=new THREE.MeshBasicMaterial({color:0xff3030}),fire=new THREE.MeshBasicMaterial({color:0xffde86});
  for(const material of [finish,dark,red,fire])materials.add(material);
  const weapon=new THREE.Group();weapon.name='equipped-weapon';weapon.position.set(.32,1.1,-.18);model.add(weapon);
  const parts=Array.from({length:7},(_,index)=>{const mesh=new THREE.Mesh(box,index===0?finish:index===5?red:index===6?fire:dark);weapon.add(mesh);return mesh;});
  const ropeGeometry=new THREE.BufferGeometry(),ropePositions=new Float32Array(6);ropeGeometry.setAttribute('position',new THREE.BufferAttribute(ropePositions,3));geometries.add(ropeGeometry);
  const ropeMaterial=new THREE.LineBasicMaterial({color:0xc8f0ff});materials.add(ropeMaterial);const rope=new THREE.Line(ropeGeometry,ropeMaterial);rope.frustumCulled=false;rope.visible=false;scene.add(rope);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=48;const context=canvas.getContext('2d');context.fillStyle='#102016dd';context.fillRect(0,0,256,48);context.fillStyle='#b9f4ff';context.font='bold 22px monospace';context.textAlign='center';context.fillText(member.name,128,32,246);
  const texture=new THREE.CanvasTexture(canvas);textures.add(texture);const labelMaterial=new THREE.SpriteMaterial({map:texture,depthTest:false});materials.add(labelMaterial);const label=new THREE.Sprite(labelMaterial);label.position.y=2.1;label.scale.set(2,.38,1);model.add(label);scene.add(model);
  const entry={model,weapon,parts,finish,rope,ropePositions,materials,geometries,textures};players.set(member.id,entry);return entry;
 }
 function remove(id){const entry=players.get(id);if(!entry)return;scene.remove(entry.model,entry.rope);for(const collection of [entry.materials,entry.geometries,entry.textures])for(const resource of collection)resource.dispose();players.delete(id);flashes.delete(id);}
 function update(members,now=performance.now()/1000){
  const active=new Set(members.map(member=>member.id));for(const id of players.keys())if(!active.has(id))remove(id);
  for(const member of members){
   const entry=players.get(member.id)||build(member),pose=member.pose,weapon=WP[member.wi]||WP[0],appearance=member.appearance||NSR.Defs.appearance(member),attachments=appearance.attachments;
   const [,width,height,length,barrel,grip,scope]=weapon.vm,[body,tube,handle,sight,suppressor,laser,flash]=entry.parts;
   entry.model.visible=true;entry.model.position.set(pose.x,pose.h,pose.z);entry.model.rotation.set(0,pose.yaw,pose.st===4?.12:0);entry.model.scale.y=pose.low?.65:1;
   entry.weapon.rotation.x=pose.pit+(member.reloading?-.6:pose.st===6?-.9:0);
   body.scale.set(width,height,length);body.position.set(0,0,-length/2);
   tube.scale.set(width*.55,width*.55,barrel*(attachments.b?1.2:1));tube.position.set(0,height*.2,-length-barrel/2+.02);
   handle.visible=!!grip;handle.scale.set(width*.8,height*1.5,length*.18);handle.position.set(0,-height,-length*.3);
   sight.visible=!!scope;sight.scale.set(width*.6,.05,length*.3);sight.position.set(0,height/2+.035,-length*.5);
   suppressor.visible=attachments.s;suppressor.scale.set(width*.85,width*.85,.2);suppressor.position.set(0,height*.2,-length-barrel-.08);
   laser.visible=attachments.l;laser.scale.set(.03,.03,.07);laser.position.set(width*.8,-height*.2,-length*.65);
   flash.visible=!attachments.s&&(flashes.get(member.id)||0)>now;flash.scale.set(.09,.09,.15);flash.position.set(0,height*.2,-length-barrel-.09);
   if(appearance.tier===3)entry.finish.color.setHSL((now*.08)%1,.85,.65);else entry.finish.color.setHex(TIERS[appearance.tier]?.col||weapon.vm[0]);
   entry.rope.visible=!!pose.gr;
   if(pose.gr){entry.ropePositions.set([pose.x,pose.h+(pose.low?.85:1.3),pose.z,pose.gr.x,pose.gr.y,pose.gr.z]);entry.rope.geometry.attributes.position.needsUpdate=true;}
  }
 }
 return {update,shot(id){flashes.set(id,performance.now()/1000+.08);},clear(){for(const id of [...players.keys()])remove(id);flashes.clear();},stats(){return {players:players.size,ropes:[...players.values()].filter(entry=>entry.rope.visible).length};}};
}
NSR.RemotePlayers={create};
})(globalThis);
