(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
const TAU=Math.PI*2;
function create(THREE){
 const group=new THREE.Group();group.name='sweeper-visuals';
 const body=new THREE.Group();group.add(body);
 const material=(color,roughness=.8,metalness=.5)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const metal=material(0x15191a),edge=material(0x424747,.7,.8),rubber=material(0x090c0b,1,0);
 const red=material(0xa72d16),orange=material(0xd66a24),rust=material(0x70462a,1,.25),dark=material(0x020604,1,0);
 const glow=(color,emissive,intensity)=>new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness:.4});
 const leak=glow(0x70e827,0x48dd0c,1.3),coreMaterial=glow(0xb4ff5a,0x85ff20,2),eyeMaterial=glow(0xffdf83,0xff8b18,1.2);
 function mesh(parent,geometry,surface,x,y,z){
  const item=new THREE.Mesh(geometry,surface);item.position.set(x,y,z);
  item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;
 }
 const box=(parent,width,height,depth,surface,x,y,z)=>mesh(parent,new THREE.BoxGeometry(width,height,depth),surface,x,y,z);
 const cylinder=(parent,top,bottom,height,surface,x,y,z)=>mesh(parent,new THREE.CylinderGeometry(top,bottom,height,24),surface,x,y,z);
 const sphere=(parent,radius,surface,x,y,z)=>mesh(parent,new THREE.SphereGeometry(radius,16,12),surface,x,y,z);
 cylinder(body,1.88,1.72,3.45,metal,0,2.72,0);
 cylinder(body,1.98,1.98,.24,edge,0,1.04,0);
 cylinder(body,1.96,1.96,.16,edge,0,4.39,0);
 for(const height of [1.35,3.75]){
  const band=mesh(body,new THREE.TorusGeometry(1.89,.065,6,32),edge,0,height,0);band.rotation.x=Math.PI/2;
 }
 const dome=mesh(body,new THREE.SphereGeometry(1.96,32,16,0,TAU,0,Math.PI/2),red,0,4.47,0);dome.scale.y=.64;
 cylinder(body,1.98,1.98,.14,orange,0,4.48,0);
 for(const side of [-1,1]){
  box(body,.18,.67,.25,edge,side*.65,5.91,0);box(body,.29,.46,.25,orange,side*1.85,4.37,0);
 }
 box(body,1.48,.22,.3,rubber,0,6.16,0);
 for(let index=0;index<8;index++){
  const angle=index*TAU/8;sphere(body,.075,rust,Math.sin(angle)*1.98,4.48,Math.cos(angle)*1.98);
 }
 const wheels=[];
 for(const side of [-1,1]){
  const wheel=cylinder(body,.73,.73,.42,rubber,side*2.06,.77,.37);wheel.rotation.z=Math.PI/2;wheels.push(wheel);
  cylinder(body,.34,.34,.45,edge,side*2.08,.77,.37).rotation.z=Math.PI/2;
  for(let index=0;index<10;index++){
   const angle=index*TAU/10;box(wheel,.14,.44,.1,edge,Math.sin(angle)*.7,0,Math.cos(angle)*.7).rotation.y=angle;
  }
 }
 sphere(body,.34,rubber,0,.4,1.2).scale.x=.7;
 for(let index=0;index<12;index++){
  const angle=.6+index*2.39996,height=1.65+(index%4)*.64;
  const scar=box(body,.12+(index%3)*.09,.035,.025,index%2?rust:edge,Math.sin(angle)*1.885,height,Math.cos(angle)*1.885);
  scar.rotation.y=angle;scar.rotation.z=(index%3-1)*.4;
 }
 for(const side of [-1,1]){
  sphere(body,.48,edge,side*.74,4.17,-1.57).scale.set(1,.78,.52);
  sphere(body,.33,eyeMaterial,side*.74,4.18,-1.8).scale.set(1,.7,.3);
  box(body,.12,.31,.06,dark,side*.74,4.18,-1.91).rotation.z=side*-.12;
  box(body,.92,.17,.29,metal,side*.75,4.48,-1.66).rotation.z=side*.18;
 }
 cylinder(body,.64,.64,.18,edge,0,2.86,-1.81).rotation.x=Math.PI/2;
 const core=sphere(body,.53,coreMaterial,0,2.86,-1.92);core.scale.z=.38;
 const coreCage=new THREE.Group();coreCage.position.set(0,2.86,-2.04);body.add(coreCage);
 for(let index=0;index<3;index++)box(coreCage,.09,1.02,.08,edge,(index-1)*.29,0,0).rotation.z=.12;
 const shutters=[];
 for(const side of [-1,1]){
  const shutter=box(body,.59,1.24,.14,metal,side*.31,2.86,-2.12);shutters.push({mesh:shutter,side});
  box(shutter,.42,.06,.04,orange,0,-.4,-.09);
 }
 const crackGeometry=new THREE.CylinderGeometry(.025,.05,1,5),vertical=new THREE.Vector3(0,1,0);
 for(let index=0;index<5;index++)for(let step=0;step<4;step++){
  const angle=.75+index*1.19,startAngle=angle+(step%2)*.065,endAngle=angle+((step+1)%2)*.065;
  const height=3.65-step*.38-(index%2)*.4;
  const start=new THREE.Vector3(Math.sin(startAngle)*1.9,height,Math.cos(startAngle)*1.9);
  const end=new THREE.Vector3(Math.sin(endAngle)*1.9,height-.38,Math.cos(endAngle)*1.9);
  const direction=new THREE.Vector3().subVectors(end,start),segment=mesh(body,crackGeometry,leak,0,0,0);
  segment.position.copy(start).add(end).multiplyScalar(.5);segment.scale.y=direction.length();
  segment.quaternion.setFromUnitVectors(vertical,direction.normalize());
 }
 const particles=[],particleGeometry=new THREE.IcosahedronGeometry(.075,0);
 for(let index=0;index<18;index++)particles.push({mesh:mesh(body,particleGeometry,leak,0,0,0),angle:index*2.39996,phase:index/18});
 cylinder(body,.48,.48,.32,edge,0,1.91,-1.8).rotation.x=Math.PI/2;
 const hoseRig=new THREE.Group();group.add(hoseRig);
 const hoseCurve=new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,1.91,-1.91),new THREE.Vector3(0,1.65,-2.65),
  new THREE.Vector3(0,.97,-3.16),new THREE.Vector3(0,.74,-4.05)
 ]);
 mesh(hoseRig,new THREE.TubeGeometry(hoseCurve,28,.3,10,false),rubber,0,0,0);
 const ribGeometry=new THREE.TorusGeometry(.32,.065,6,12),forward=new THREE.Vector3(0,0,1);
 for(let index=0;index<=22;index++){
  const fraction=index/22,position=hoseCurve.getPointAt(fraction);
  const rib=mesh(hoseRig,ribGeometry,index%4===0?edge:metal,position.x,position.y,position.z);
  rib.quaternion.setFromUnitVectors(forward,hoseCurve.getTangentAt(fraction));
 }
 const nozzle=new THREE.Group();nozzle.name='floor-sweeper-nozzle';group.add(nozzle);nozzle.position.set(0,.6,-4.45);
 box(nozzle,6.9,.54,1.35,metal,0,0,0);box(nozzle,6.65,.12,1.5,edge,0,-.29,-.04);
 box(nozzle,6.4,.22,.045,dark,0,-.08,-.7);box(nozzle,6.48,.075,.08,orange,0,.19,-.7);
 box(nozzle,6.3,.055,.065,leak,0,-.16,-.735);
 cylinder(nozzle,.36,.48,.6,edge,0,.22,.54).rotation.x=Math.PI/2;
 for(const side of [-1,1]){
  box(nozzle,.19,.65,1.42,rubber,side*3.4,-.02,0);
  cylinder(nozzle,.22,.22,.28,rubber,side*2.78,-.26,.35).rotation.z=Math.PI/2;
 }
 for(let index=0;index<13;index++){
  box(nozzle,.1,.21,.07,edge,(index-6)*.48,-.08,-.74);
  box(nozzle,.25,.025,.48,dark,(index-6)*.43,.282,.07).rotation.y=-.28;
 }
 group.userData.sweeperVisuals={body,core,coreCage,shutters,hoseRig,nozzle,wheels,particles,
  leak,coreMaterial,eyeMaterial,worldPoint:new THREE.Vector3(),worldDirection:new THREE.Vector3()};
 return group;
}
function draw(group,boss,time){
 const visual=group&&group.userData.sweeperVisuals;
 if(!visual||!boss)return;
 const clock=Number.isFinite(time)?time:0,exposed=boss.state==='exposed',dead=boss.state==='dead';
 group.visible=!dead;
 if(dead)return;
 const warning=boss.warning,pulse=.5+.5*Math.sin(clock*5);
 visual.body.position.y=Math.sin(clock*3)*.025;visual.core.rotation.z=clock*.8;
 visual.coreMaterial.emissiveIntensity=exposed?2.1+pulse*1.5:.5;
 visual.leak.emissiveIntensity=exposed?1.7+pulse*.6:.8+pulse*.4;
 visual.eyeMaterial.emissiveIntensity=warning?1.6+.7*Math.sin(clock*15):1.1;
 visual.coreCage.rotation.z=exposed?Math.sin(clock*2)*.1:0;
 for(const shutter of visual.shutters){
  shutter.mesh.position.x=shutter.side*(exposed?.97:.31);shutter.mesh.rotation.y=exposed?shutter.side*.25:0;
 }
 for(const particle of visual.particles){
  const progress=((clock*.33+particle.phase)%1+1)%1,radius=2.03+.14*Math.sin(progress*Math.PI);
  particle.mesh.position.set(Math.sin(particle.angle)*radius,3.7-progress*3.35,Math.cos(particle.angle)*radius);
  particle.mesh.scale.setScalar(.45+.65*Math.sin(progress*Math.PI));particle.mesh.rotation.set(clock+particle.angle,clock*.7,particle.angle);
 }
 visual.hoseRig.visible=!boss.nozzle;visual.hoseRig.rotation.y=0;
 visual.nozzle.position.set(0,.6,-4.45);visual.nozzle.rotation.set(0,0,0);
 group.updateWorldMatrix(true,true);
 const projectile=boss.nozzle;
 if(projectile&&Number.isFinite(projectile.x)&&Number.isFinite(projectile.z)){
  const position=visual.worldPoint.set(projectile.x,.6,projectile.z);
  group.worldToLocal(position);visual.nozzle.position.copy(position);
  const directionX=Number.isFinite(projectile.dx)?projectile.dx:0,directionZ=Number.isFinite(projectile.dz)?projectile.dz:-1;
  const direction=visual.worldDirection.set(projectile.x+directionX,.6,projectile.z+directionZ);
  group.worldToLocal(direction);direction.sub(position);
  if(direction.lengthSq()>1e-8)visual.nozzle.rotation.y=Math.atan2(-direction.x,-direction.z);
  visual.nozzle.rotation.z=Math.sin(clock*24)*.025;
 }else if(warning&&warning.kind==='nozzle'&&Number.isFinite(warning.x)&&Number.isFinite(warning.z)){
  const target=visual.worldPoint.set(warning.x,.6,warning.z);group.worldToLocal(target);
  if(target.x*target.x+target.z*target.z>1e-8){
   const angle=Math.atan2(-target.x,-target.z);visual.hoseRig.rotation.y=angle;
   visual.nozzle.position.set(-Math.sin(angle)*4.45,.6,-Math.cos(angle)*4.45);visual.nozzle.rotation.y=angle;
  }
 }
 const travel=projectile&&Number.isFinite(projectile.travel)?projectile.travel:0;
 for(const wheel of visual.wheels)wheel.rotation.x=Math.sin(clock*3)*.035+travel*.03;
}
NSR.SweeperVisuals={create,draw};
if(typeof module!=='undefined')module.exports=NSR.SweeperVisuals;
})(typeof globalThis!=='undefined'?globalThis:this);
