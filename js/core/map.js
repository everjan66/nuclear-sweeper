/* Shared simulation code: no DOM, rendering, audio or browser storage. */
(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
const {TS,GW,GH,WH,TT,TB,MOVE,SCORE,cl,lerp,ST,U,cost,WP,ET,ENAMES,WCLASS,CNAMES,UNLOCK,TIERS,mkL,rng,ROOM_DESIGNS,ATT,MOD}=NSR.Defs||(typeof require==='function'&&require('./definitions.js'));
function generate(sec,{roomDesign=2,vOpen=0}={}){
function designRooms(sec){const random=rng(7001+sec*193),order=ROOM_DESIGNS.slice(0,6).map((_,index)=>index);
 for(let index=order.length-1;index>0;index--){const swap=random()*(index+1)|0;[order[index],order[swap]]=[order[swap],order[index]]}
 let next=0;for(const room of R){if(room.sh||room.core||room===POOLR)continue;if(!room.large)room.design=order[next++%order.length];room.turn=random()<.5;
  if(room.design!=1&&room.design!=4&&room.design!=5)continue;
  for(let z=room.z0;z<=room.z1;z++)for(let x=room.x0;x<=room.x1;x++){
   const edgeX=Math.min(x-room.x0,room.x1-x),edgeZ=Math.min(z-room.z0,room.z1-z);
   if(Math.abs(x-room.cx)>1&&Math.abs(z-room.cz)>1&&(room.design==4?x<room.cx&&z<room.cz&&edgeX+edgeZ<3:edgeX+edgeZ<2))M[z*GW+x]=1}}}
function furnishRoom(room,sec){if(room.large){
 for(const side of[-1,1])for(const end of[-1,1]){const edgeX=side<0?room.x0+1:room.x1-1,edgeZ=end<0?room.z0+1:room.z1-1;
  for(let across=0;across<2;across++)for(let along=0;along<2;along++)M[(edgeZ-end*along)*GW+edgeX-side*across]=6;
  M[edgeZ*GW+edgeX-side*2]=5;M[edgeZ*GW+edgeX-side*3]=2}
 if(room.design!==7){const z=room.design===6?room.z0+2:room.z1-2;for(let x=room.x0+2;x<room.x1-1;x++)M[z*GW+x]=6}
 room.lasers=[{x0:(room.x0+2)*TS,x1:(room.x1-1)*TS,z:(room.cz+.5)*TS,y:.85,phase:sec%6},
  {x0:(room.x0+1.5)*TS,x1:(room.x1-.5)*TS,z:(room.z0+1.5)*TS,y:4.05,phase:(sec+2)%6}];return}
 const random=rng(sec*977+room.x0*61+room.z0),width=room.x1-room.x0,height=room.z1-room.z0;
 for(let z=room.z0+1;z<room.z1;z++)for(let x=room.x0+1;x<room.x1;x++){
  if(Math.abs(x-room.cx)<=1||Math.abs(z-room.cz)<=1||M[z*GW+x]!=0)continue;
  const along=room.turn?z-room.z0:x-room.x0,across=room.turn?x-room.x0:z-room.z0;
  const edge=Math.min(x-room.x0,room.x1-x,z-room.z0,room.z1-z);let tile=0;
  if(room.design==0&&across%3==1&&edge>1)tile=2;
  else if(room.design==1&&Math.abs(x-room.cx)==2&&Math.abs(z-room.cz)==2)tile=1;
  else if(room.design==2&&edge==1&&along%3!=0)tile=5;
  else if(room.design==3&&across%3==1&&along>1&&along<(room.turn?height:width)-1)tile=1;
  else if(room.design==4&&random()<.36)tile=2;
  M[z*GW+x]=tile}}

let S={roomDesign,vOpen},M,D,R,CO,SH,CORE,DEP,DEPT,POOLR,ISL,TERM,ZIP,DOORT;
const tm=(x,z)=>{if(x<0||z<0)return 1;const tx=x/TS|0,tz=z/TS|0;return tx>=GW||tz>=GH?1:M[tz*GW+tx]};
function genZips(){ZIP=[];for(const o of R){if(!o.pl||o.core||o.sh)continue;const{sd,hzP,st0,len}=o.pl;let x0,z0,x1,z1;
  if(hzP){x0=x1=(o.x0+st0+len/2)*TS;if(sd==0){z0=(o.z0+3)*TS;z1=(o.z1+.5)*TS}else{z0=(o.z1-2)*TS;z1=(o.z0+.5)*TS}}else{z0=z1=(o.z0+st0+len/2)*TS;if(sd==2){x0=(o.x0+3)*TS;x1=(o.x1+.5)*TS}else{x0=(o.x1-2)*TS;x1=(o.x0+.5)*TS}}
  if(M[(z1/TS|0)*GW+(x1/TS|0)]!=0)continue;let ok=true;for(let i=1;i<=20;i++){const f=i/20,m=tm(lerp(x0,x1,f),lerp(z0,z1,f));if(m==1||m==9)ok=false}if(!ok)continue;
  const L=Math.hypot(x1-x0,z1-z0);ZIP.push({x0,z0,h0:3.2,x1,z1,h1:1,len:Math.hypot(L,2.2),L})}}
const r=rng(1000+sec*77);DOORT=[];ZIP=[];POOLR=null;ISL=null;TERM=null;M=new Uint8Array(GW*GH).fill(1);D=new Float32Array(GW*GH);R=[];CO=[];
 const sl=15,carve=(x0,z0,x1,z1)=>{for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)if(x>0&&z>0&&x<GW-1&&z<GH-1)M[z*GW+x]=0};
 for(let j=0;j<4;j++)for(let i=0;i<4;i++){const core=i==1&&j==1,w=core?13:7+(r()*5|0),h=core?13:7+(r()*5|0),x0=i*sl+1+(r()*(sl-w-2)|0),z0=j*sl+1+(r()*(sl-h-2)|0);R.push({x0,z0,x1:x0+w-1,z1:z0+h-1,cx:x0+(w>>1),cz:z0+(h>>1),core,sh:!i&&!j});carve(x0,z0,x0+w-1,z0+h-1)}
 if(roomDesign>=2){const slots=R.map((room,index)=>({room,index,area:(room.x1-room.x0+1)*(room.z1-room.z0+1)})).filter(entry=>!entry.room.sh&&!entry.room.core&&entry.area<=98).sort((first,second)=>first.area-second.area).slice(0,3);
  for(let index=0;index<slots.length;index++){const {room,index:slot,area}=slots[index],largeWidth=Math.ceil(Math.sqrt(area*2)),largeDepth=Math.ceil(area*2/largeWidth);
   for(let z=room.z0;z<=room.z1;z++)for(let x=room.x0;x<=room.x1;x++)M[z*GW+x]=1;
   const x0=(slot%4)*sl+Math.max(1,Math.floor((sl-largeWidth)/2)),z0=(slot/4|0)*sl+Math.max(1,Math.floor((sl-largeDepth)/2));
   Object.assign(room,{x0,z0,x1:x0+largeWidth-1,z1:z0+largeDepth-1,cx:x0+(largeWidth>>1),cz:z0+(largeDepth>>1),large:true,baseArea:area,ceiling:9.6,design:6+(index+sec-1)%3});carve(room.x0,room.z0,room.x1,room.z1)}}
 POOLR=[6,7,11,2,1,14,4,8].map(i=>R[i]).find(o=>!o.large&&o.x1-o.x0>=8&&o.z1-o.z0>=8)||null;
 if(S.roomDesign)designRooms(sec);
 for(let j=0;j<4;j++)for(let i=0;i<4;i++){const a=R[j*4+i];
  if(i<3){const b=R[j*4+i+1];carve(a.cx,a.cz-1,b.cx,a.cz+1);carve(b.cx-1,Math.min(a.cz,b.cz),b.cx+1,Math.max(a.cz,b.cz));CO.push({h:1,a,b})}
  if(j<3){const b=R[(j+1)*4+i];carve(a.cx-1,a.cz,a.cx+1,b.cz);carve(Math.min(a.cx,b.cx),b.cz-1,Math.max(a.cx,b.cx),b.cz+1);CO.push({h:0,a,b})}}
 const c5=R[5];for(let z=c5.cz-2;z<=c5.cz+1;z++)for(let x=c5.cx-2;x<=c5.cx+1;x++)M[z*GW+x]=1;
 for(const c of CO){const{a,b}=c,g0=c.h?a.x1+1:a.z1+1,g1=c.h?b.x0-1:b.z0-1;if(g1<g0+2)continue;const gt=g0+1+(r()*(g1-g0-1)|0),gty=(a===R[12]||b===R[12])?9:(r()<.3?10:3);
  for(let k=g0;k<=g1;k++){const i=c.h?a.cz*GW+k:k*GW+a.cx;if(M[i]==0)M[i]=4}
  for(let o=-1;o<=1;o++){const i=c.h?(a.cz+o)*GW+gt:gt*GW+a.cx+o;if(M[i]==0||M[i]==4){M[i]=gty;if(gty==9)DOORT.push(i)}}}
 if(POOLR){const o=POOLR;for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++)M[(o.cz+dz)*GW+o.cx+dx]=(Math.abs(dx)<=1&&Math.abs(dz)<=1)?0:7;ISL={x:(o.cx+.5)*TS,z:(o.cz+.5)*TS}}
 for(const o of R){if(o.sh)continue;const n=3+(r()*4|0);for(let k=0;k<n;k++){const len=1+(r()*3|0),hz=r()<.5,tx=o.x0+2+(r()*(o.x1-o.x0-3)|0),tz=o.z0+2+(r()*(o.z1-o.z0-3)|0);
  for(let u=0;u<len;u++){const x=tx+(hz?u:0),z=tz+(hz?0:u);if(o.design===undefined&&x>o.x0&&x<o.x1&&z>o.z0&&z<o.z1&&Math.abs(x-o.cx)>1&&Math.abs(z-o.cz)>1&&M[z*GW+x]==0)M[z*GW+x]=2}}}
 for(const o of R){if(o.sh)continue;const ok=(x,z)=>x>o.x0&&x<o.x1&&z>o.z0&&z<o.z1&&Math.abs(x-o.cx)>1&&Math.abs(z-o.cz)>1;
  for(let k=0,n=o.core?2:1+(r()<.6);k<n;k++){const len=3+(r()*4|0),hz=r()<.5,tx=o.x0+2+(r()*(o.x1-o.x0-3)|0),tz=o.z0+2+(r()*(o.z1-o.z0-3)|0);for(let u=0;u<len;u++){const x=tx+(hz?u:0),z=tz+(hz?0:u);if(o.design===undefined&&ok(x,z)&&M[z*GW+x]==0)M[z*GW+x]=1}}
  if(o.design!==undefined)furnishRoom(o,sec);
  if(!o.large&&o!==POOLR&&r()<(o.core?1:.7)){const sd=r()*4|0,hzP=sd<2,sp=hzP?o.x1-o.x0+1:o.z1-o.z0+1,len=Math.min(sp-2,5+(r()*4|0)),st0=1+(r()*(sp-len-1)|0),cells=[];
   for(let u=0;u<len;u++)for(let d=0;d<3;d++){const x=hzP?o.x0+st0+u:(sd==2?o.x0+d:o.x1-d),z=hzP?(sd==0?o.z0+d:o.z1-d):o.z0+st0+u;cells.push([x,z])}
   for(const[x,z]of cells)if(M[z*GW+x]!=1)M[z*GW+x]=6;o.pl={sd,hzP,st0,len};
   const c=[];for(let u=0;u<len;u++){const a=(hzP?o.x0:o.z0)+st0+u;if(Math.abs(a-(hzP?o.cx:o.cz))>1)c.push(a)}
   if(c.length){const a=c[r()*c.length|0];for(const[k,t]of[[1,5],[2,8]]){const x=hzP?a:(sd==2?o.x0+2+k:o.x1-2-k),z=hzP?(sd==0?o.z0+2+k:o.z1-2-k):a;if(M[z*GW+x]!=1)M[z*GW+x]=t}}}}
 DEP=[];DEPT=[];for(const k of[3,10,13,15]){const o=R[k];M[o.cz*GW+o.cx]=0;DEP.push({x:(o.cx+.5)*TS,z:(o.cz+.5)*TS});DEPT.push(o.cz*GW+o.cx)}{const o=R[9];M[o.cz*GW+o.cx]=0;TERM={x:(o.cx+.5)*TS,z:(o.cz+.5)*TS};DEPT.push(o.cz*GW+o.cx)}genZips();
 let tot=0;const dn=R.map(o=>o.sh?0:o.core?1.2:.55+r()*.5);
 for(let z=0;z<GH;z++)for(let x=0;x<GW;x++){const i=z*GW+x;if(M[i]!=0&&M[i]!=4&&M[i]!=6)continue;const k=R.findIndex(o=>x>=o.x0&&x<=o.x1&&z>=o.z0&&z<=o.z1);
  const v=(M[i]==6?1.5:1)*(k>=0?(.15+.85*r())*dn[k]:(r()>.35?.2+.5*r():0));D[i]=v>.1?Math.min(1,v):0;tot+=D[i]}
 for(const t of DEPT){tot-=D[t];D[t]=0}
 S.total=tot;S.rem=tot;SH={x:(R[0].cx+.5)*TS,z:(R[0].cz+.5)*TS};CORE={x:c5.cx*TS,z:c5.cz*TS};
 if(S.vOpen){for(const i of DOORT)M[i]=0}return {M:Array.from(M),D:Array.from(D),R,CO,SH,CORE,DEP,DEPT,POOLR,ISL,TERM,ZIP,DOORT,total:S.total,rem:S.rem,sector:sec,roomDesign:S.roomDesign};}

const ceilingCache=new WeakMap();
function scanCeiling(rooms,x,z){const room=rooms.find(room=>room.large&&x>=room.x0*TS&&x<(room.x1+1)*TS&&z>=room.z0*TS&&z<(room.z1+1)*TS);return room?room.ceiling:WH;}
// Room arrays are immutable during play. Replacement invalidates automatically;
// editors changing room bounds/heights in place must call invalidateCeilings.
function invalidateCeilings(world){if(world.R)ceilingCache.delete(world.R);}
function ceiling(world,x,z){const rooms=world.R;if(!rooms)return WH;
 if(!Number.isFinite(x)||!Number.isFinite(z)||x<0||z<0||x>=GW*TS||z>=GH*TS)return scanCeiling(rooms,x,z);
 let cells=ceilingCache.get(rooms);if(!cells){cells=new Float64Array(GW*GH);
  for(let row=0;row<GH;row++)for(let col=0;col<GW;col++)cells[row*GW+col]=scanCeiling(rooms,(col+.5)*TS,(row+.5)*TS);
  ceilingCache.set(rooms,cells);}
 return cells[(z/TS|0)*GW+(x/TS|0)];}

function laserState(laser,time){const phase=((time+laser.phase)%6+6)%6;return phase>=1&&phase<3.8?'active':phase>=.4&&phase<1?'warning':'off';}
function laserDamage(world,pose,time){let touching=false;for(const room of world.R||[])for(const laser of room.lasers||[]){if(laserState(laser,time)!=='active'||pose.h>=laser.y+.12||pose.h+(pose.low?1.22:1.8)<=laser.y-.12)continue;
 const along=cl((pose.x-laser.x0)/(laser.x1-laser.x0),0,1),x=lerp(laser.x0,laser.x1,along);if(Math.hypot(pose.x-x,pose.z-laser.z)<.48)touching=true}return touching?18:0;}
NSR.Map={generate,ceiling,invalidateCeilings,laserState,laserDamage};
if(typeof module!=='undefined')module.exports=NSR.Map;
})(globalThis);
