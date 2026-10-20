/* Shared simulation code: no DOM, rendering, audio or browser storage. */
(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
const Maps=NSR.Map||(typeof require==='function'&&require('./map.js'));
const {TS,GW,GH,WH,TT,TB,MOVE,SCORE,cl,lerp,ST,U,cost,WP,ET,ENAMES,WCLASS,CNAMES,UNLOCK,TIERS,mkL,rng,ROOM_DESIGNS,ATT,MOD}=NSR.Defs||(typeof require==='function'&&require('./definitions.js'));
function createPose(SH){return {x:SH.x,z:SH.z+4,h:0,vx:0,vz:0,vh:0,yaw:0,pit:0,g:1,sl:0,slideLock:0,st:0,peak:0,cy:0,jb:0,roll:0,cd:0,low:0,crP:-9,rl:0,rp:0,dashed:0,gr:null,zp:null,chain:0,ss:0,sa:0,sT:0}}
function tile(world,x,z){return x<0||z<0||x>=GW*TS||z>=GH*TS?1:world.M[(z/TS|0)*GW+(x/TS|0)];}
function solid(world,x,y,z){if(y<0||y>Maps.ceiling(world,x,z))return true;const m=tile(world,x,z);return m===1||m===9||TT[m]>0&&y<TT[m]&&y>=TB[m];}
function collide(world,x,z,r,f,h,en=0){const {M,SH}=world;
const rs=(x,y,z)=>{if(x<0||z<0||y<0||y>WH)return 1;const tx=x/TS|0,tz=z/TS|0;if(tx>=GW||tz>=GH)return 1;const m=M[tz*GW+tx];return TT[m]>0&&y<TT[m]&&y>=TB[m]};
const sol=(tx,tz,f,h,en)=>{if(tx<0||tz<0||tx>=GW||tz>=GH)return 1;const m=M[tz*GW+tx];if(f+h>Maps.ceiling(world,(tx+.5)*TS,(tz+.5)*TS)||m==1||m==9)return 1;if(en&&m==7)return 1;if(!TT[m])return 0;if(en)return m==2||m==5||m==8;return f<TT[m]-.05&&f+h>TB[m]};
function bl(x,z,r,f,h,en){if(en&&Math.hypot(x-SH.x,z-SH.z)<7)return 1;for(let tz=Math.floor((z-r)/TS);tz<=Math.floor((z+r)/TS);tz++)for(let tx=Math.floor((x-r)/TS);tx<=Math.floor((x+r)/TS);tx++)if(sol(tx,tz,f,h,en))return 1;return 0}

return bl(x,z,r,f,h,en);}
function ray(world,o,d,max){let t=0;while(t<max){t=Math.min(max,t+.1);if(solid(world,o.x+d.x*t,o.y+d.y*t,o.z+d.z*t))break;}return {t,x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t};}
function step(world,player,input,dt){
 const p=player.pose,S=player,{M,SH,ZIP}=world,s=ST(S.L),tt=world.time||0;
 const kd=k=>!input.menu&&!!input[k];
 let {gCd=0,dCd=0,gsp=0,zpCd=0}=player.move||{};
 gCd-=dt;dCd-=dt;zpCd-=dt;
 p.yaw=Number.isFinite(input.yaw)?input.yaw:p.yaw;p.pit=Number.isFinite(input.pit)?cl(input.pit,-1.45,1.45):p.pit;
 if(input.jump&&!input.menu)p.jb=.15;
 if(input.crouch&&!player.move?.crouch)p.crP=tt;
const tm=(x,z)=>{if(x<0||z<0)return 1;const tx=x/TS|0,tz=z/TS|0;return tx>=GW||tz>=GH?1:M[tz*GW+tx]};
const rs=(x,y,z)=>solid(world,x,y,z);
const sol=(tx,tz,f,h,en)=>{if(tx<0||tz<0||tx>=GW||tz>=GH)return 1;const m=M[tz*GW+tx];if(f+h>Maps.ceiling(world,(tx+.5)*TS,(tz+.5)*TS)||m==1||m==9)return 1;if(en&&m==7)return 1;if(!TT[m])return 0;if(en)return m==2||m==5||m==8;return f<TT[m]-.05&&f+h>TB[m]};
function bl(x,z,r,f,h,en){if(en&&Math.hypot(x-SH.x,z-SH.z)<7)return 1;for(let tz=Math.floor((z-r)/TS);tz<=Math.floor((z+r)/TS);tz++)for(let tx=Math.floor((x-r)/TS);tx<=Math.floor((x+r)/TS);tx++)if(sol(tx,tz,f,h,en))return 1;return 0}
function mv(o,dx,dz,r,en){if(!bl(o.x+dx,o.z,r,0,1.8,en))o.x+=dx;if(!bl(o.x,o.z+dz,r,0,1.8,en))o.z+=dz}
function groundFriction(vel,dt){const speed=Math.hypot(vel.vx,vel.vz);if(speed<=0)return;const scale=Math.max(0,speed-Math.max(speed,MOVE.stopSpeed)*MOVE.friction*dt)/speed;vel.vx*=scale;vel.vz*=scale}
function moveAccelerate(vel,wx,wz,wishSpeed,accel,dt,cap=wishSpeed,accelScale=wishSpeed){const addSpeed=cap-(vel.vx*wx+vel.vz*wz);if(addSpeed<=0||wishSpeed<=0)return;const gain=Math.min(addSpeed,accel*accelScale*dt);vel.vx+=wx*gain;vel.vz+=wz*gain}
function anim(dx,dz,T,dur,arc,sp,len){p.an={t:0,d:dur,x0:p.x,z0:p.z,h0:p.h,x1:p.x+dx*len,z1:p.z+dz*len,h1:T,dx,dz,sp,arc};p.st=1;p.g=0;p.vx=p.vz=p.vh=0;p.sl=0}
function climb(dx,dz){const cur=tm(p.x,p.z);
 for(const dd of[.6,.95]){const m=tm(p.x+dx*dd,p.z+dz*dd);if(m!=2&&m!=3&&m!=5&&m!=6&&m!=8)continue;if(m==6&&cur==6&&p.h<2.9)continue;if(m==3&&cur==3)continue;const T=TT[m],dh=T-p.h;if(dh<=.35)continue;
  if(dh<=1.48||(dh<=1.92&&p.vh>0)){const L=dd+.65;if(bl(p.x+dx*L,p.z+dz*L,.3,T,1.8,0))continue;anim(dx,dz,T,.32+.1*dh,.15,Math.max(3.5,Math.hypot(p.vx,p.vz)),L);return 1}
  if(dh<=2.18&&p.vh>-4&&!p.g){let k=0;while(k<30&&tm(p.x+dx*.5,p.z+dz*.5)!=m){p.x+=dx*.05;p.z+=dz*.05;k++}p.st=2;p.hd={x:dx,z:dz};p.hT=T;p.h=T-1.83;p.vx=p.vz=p.vh=0;p.sl=0;return 1}}
 return 0}
function wallStart(sp0,fwK,gh){if(sp0<2||p.h-gh<.3)return;const fx=-Math.sin(p.yaw),fz=-Math.cos(p.yaw),dx=p.vx/sp0,dz=p.vz/sp0;
 for(const[a,b]of[[1,0],[-1,0],[0,1],[0,-1]]){if(tm(p.x+a*.55,p.z+b*.55)!=1)continue;const N={x:-a,z:-b},into=-(dx*N.x+dz*N.z),face=-(fx*N.x+fz*N.z);
  if(into>.84&&face>=.84&&p.vh>0){const h=Math.max(.8,.6*cl((sp0-4)/2.5,0,1)+1.3*cl(p.vh/3.2,0,1));p.st=5;p.wn=N;p.vh=Math.sqrt(4*h*8);p.vx=p.vz=0;return}
  if(into<=.84&&into>-.2){const t={x:-N.z,z:N.x},al=dx*t.x+dz*t.z;p.st=4;p.wn=N;p.wt=t;p.wa=Math.max(sp0*Math.abs(al),4)*(al>=0?1:-1);p.vh=p.chain>0?Math.min(p.vh,1):Math.max(p.vh,5.3);p.chain++;return}}}
function unstick(hg){if(!bl(p.x,p.z,.4,p.h,hg,0))return;const m=tm(p.x,p.z),top=(m==2||m==3||m==5||m==6||m==8)?TT[m]:0;
 if(top&&p.h<top&&top-p.h<=.7){p.h=top;p.vh=Math.max(p.vh,0);return}
 for(let r=.2;r<=2.2;r+=.2)for(let k=0;k<8;k++){const a=k*Math.PI/4,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!bl(x,z,.4,p.h,hg,0)){p.x=x;p.z=z;return}}}
function tryGrapple(){if(!S.mod.gr)return;if(p.gr){p.gr=null;return}if(gCd>0||p.st==1||p.st==2||p.st==6)return;const h=ray(world,{x:p.x,y:p.h+1.5,z:p.z},{x:-Math.sin(p.yaw)*Math.cos(p.pit),y:Math.sin(p.pit),z:-Math.cos(p.yaw)*Math.cos(p.pit)},32);if(h.t>=31||h.y<.3)return;p.gr={x:h.x,y:h.y,z:h.z,t:0};gsp=Math.max(10,Math.hypot(p.vx,p.vz,p.vh)*.6);p.sl=0;}
function tryDash(){if(!S.mod.dash||dCd>0||p.st==1||p.st==2||p.st==6)return;if(!p.g&&p.dashed)return;
 const fx=-Math.sin(p.yaw),fz=-Math.cos(p.yaw),cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),fw=(kd('fw')?1:0)-(kd('bk')?1:0),sk=(kd('rt')?1:0)-(kd('lf')?1:0);let wx=fx*fw+cy*sk,wz=fz*fw-sy*sk;const m=Math.hypot(wx,wz);if(m>0){wx/=m;wz/=m}else{wx=fx;wz=fz}
 const sp=Math.max(Math.hypot(p.vx,p.vz),13.5);p.vx=wx*sp;p.vz=wz*sp;if(!p.g){p.dashed=1;p.vh=Math.max(p.vh,1.2)}if(p.st>=4)p.st=0;p.gr=null;p.sl=0;dCd=1;
 }
function gripUpd(dt){if(!p.gr)return;const g=p.gr,hy=p.h+1.5,dx=g.x-p.x,dy=g.y-hy,dz=g.z-p.z,dd=Math.hypot(dx,dy,dz)||1;g.t+=dt;gsp=Math.min(24,gsp+45*dt);
 if((!kd('grapple')&&g.t>.25)||dd<2.4||g.t>2.8||p.st>=4||p.st==1||p.st==2){if(dd<2.4)p.vh=Math.max(p.vh,2.5);p.gr=null;gCd=2.2;return}
 p.vx=dx/dd*gsp;p.vz=dz/dd*gsp;p.vh=dy/dd*gsp;p.g=0;p.peak=Math.max(p.peak,p.h);p.sl=0;const h2=Math.hypot(dx,dz);if(h2>.3)climb(dx/h2,dz/h2)}
function nearZip(){const hx=p.x,hy=p.h+2,hz=p.z;let best=null,bd=1.6;for(const z of ZIP){const ax=z.x1-z.x0,ay=z.h1-z.h0,az=z.z1-z.z0,l2=ax*ax+ay*ay+az*az,t=cl(((hx-z.x0)*ax+(hy-(z.h0+2))*ay+(hz-z.z0)*az)/l2,0,1),d=Math.hypot(hx-(z.x0+ax*t),hy-(z.h0+2+ay*t),hz-(z.z0+az*t));if(d<bd){bd=d;best={z,t}}}return best}
function attachZip(n){const z=n.z,ax=z.x1-z.x0,az=z.z1-z.z0,motion=(p.vx*ax+p.vz*az)/z.L,facing=(-Math.sin(p.yaw)*ax-Math.cos(p.yaw)*az)/z.L,dir=Math.abs(motion)>.5?Math.sign(motion):Math.abs(facing)>.1?Math.sign(facing):n.t>.5?-1:1;
 p.st=6;p.zp={z,t:n.t,dir,sp:Math.max(6,Math.hypot(p.vx,p.vz)*.8)};p.gr=null;p.sl=0;p.g=0;p.vx=p.vz=p.vh=0;}
function zipUpd(dt,cr){const q=p.zp,z=q.z;q.sp=Math.min(15,q.sp+9*dt);q.t+=q.dir*q.sp*dt/z.len;const t=cl(q.t,0,1),end=q.dir>0?q.t>=1:q.t<=0;p.x=lerp(z.x0,z.x1,t);p.z=lerp(z.z0,z.z1,t);p.h=lerp(z.h0,z.h1,t);
 p.vx=(z.x1-z.x0)/z.len*q.sp*q.dir;p.vz=(z.z1-z.z0)/z.len*q.sp*q.dir;p.vh=(z.h1-z.h0)/z.len*q.sp*q.dir;p.g=0;p.peak=p.h;
 if(p.jb>0||end||cr){p.vh=(p.jb>0&&!end)?6:0;p.jb=0;p.st=0;p.zp=null;p.cd=.3;zpCd=.6}}

if(input.grapplePressed&&!input.menu)tryGrapple();if(input.dash&&!input.menu)tryDash();if(input.use&&!input.menu&&p.st===0&&zpCd<=0){const n=nearZip();if(n)attachZip(n);}
 const fx=-Math.sin(p.yaw),fz=-Math.cos(p.yaw),cy=Math.cos(p.yaw),sy=Math.sin(p.yaw);
 const fwK=(kd('fw')?1:0)-(kd('bk')?1:0),stK=(kd('rt')?1:0)-(kd('lf')?1:0),cr=kd('crouch')||kd('crouch2');
 if(!cr)p.slideLock=0;
 let wx=fx*fwK+cy*stK,wz=fz*fwK-sy*stK;const wm=Math.hypot(wx,wz);if(wm>0){wx/=wm;wz/=wm}
 p.jb-=dt;p.cd-=dt;p.cy-=dt;p.roll-=dt;const sp0=Math.hypot(p.vx,p.vz);
 const m0=tm(p.x,p.z),top0=(m0==2||m0==3||m0==5||m0==6||m0==8)?TT[m0]:0,gh=p.h>=top0-.1?top0:0;
 let hg=p.low?1.22:(!p.g&&cr&&p.st==0?1.2:1.8);
 if(p.st==1){const a=p.an;a.t+=dt;const f=Math.min(1,a.t/a.d),e=f*f*(3-2*f);p.x=lerp(a.x0,a.x1,e);p.z=lerp(a.z0,a.z1,e);p.h=lerp(a.h0,a.h1,Math.min(1,f*1.4))+Math.sin(Math.PI*f)*a.arc;
  if(f>=1){p.st=0;p.g=1;p.vh=0;p.vx=a.dx*a.sp;p.vz=a.dz*a.sp;p.peak=p.h;p.chain=0}}
 else if(p.st==2){p.vx=p.vz=p.vh=0;if(cr){p.st=0;p.cd=.4}else if(p.jb>0||fwK>0){p.jb=0;anim(p.hd.x,p.hd.z,p.hT,.55,0,3.5,.8)}}
 else{
  const slideJump=!!(p.sl&&p.jb>0);
  if(!p.sl&&!p.slideLock&&cr&&p.g&&p.roll<=0&&p.st==0&&sp0>=MOVE.slideMinSpeed){p.sl=1;p.sT=0;p.ss=sp0;p.sa=Math.atan2(-p.vx,-p.vz);}
  if(p.sl&&(p.jb>0||!cr||!p.g||sp0<MOVE.slideEndSpeed)){p.sl=0;p.slideLock=cr?1:0}
  else if(p.sl){p.sT+=dt;p.ss=Math.max(0,Math.min(p.ss,sp0)-MOVE.slideDrag*dt);if(wm>0){const target=Math.atan2(-wx,-wz),turn=Math.atan2(Math.sin(target-p.sa),Math.cos(target-p.sa));p.sa+=cl(turn,-MOVE.slideTurnRate*dt,MOVE.slideTurnRate*dt)}p.vx=-Math.sin(p.sa)*p.ss;p.vz=-Math.cos(p.sa)*p.ss}
  p.low=!!(p.sl||p.roll>0||(cr&&p.g)||(p.low&&bl(p.x,p.z,.4,p.h,1.8,0)));hg=p.low?1.22:(!p.g&&cr&&p.st==0?1.2:1.8);if(p.st<6)unstick(hg);
  if(p.st==0){
   if(p.g)p.cy=.12;
   if(p.jb>0&&(p.g||p.cy>0)&&!p.sl&&p.roll<=0){if(!slideJump&&fwK>0&&climb(wm>0?wx:fx,wm>0?wz:fz))p.jb=0;else{p.vh=6.3;p.g=0;p.cy=0;p.jb=0;p.peak=p.h;}}
   if(p.st==0&&!p.sl){
    if(p.g){const top=p.roll>0?sp0:s.spd*(cr?.35:1)*(m0==4?1.3:1)*(m0==7?.5:1);if(p.roll<=0)groundFriction(p,dt);if(wm>0)moveAccelerate(p,wx,wz,top,MOVE.groundAccel,dt,top,Math.max(s.spd*(cr?.35:1),top))}
    else if(wm>0)moveAccelerate(p,wx,wz,s.spd,MOVE.airAccel,dt,Math.min(s.spd,MOVE.airWishCap));
   }
   if(p.st==0&&!p.g){p.vh-=16.4*dt;p.peak=Math.max(p.peak,p.h);
    if(fwK>0&&(sp0>1.5||wm>0)){if(p.vh>-6)climb(sp0>1.5?p.vx/sp0:wx,sp0>1.5?p.vz/sp0:wz);if(p.st==0&&p.cd<=0)wallStart(sp0,fwK,gh)}}}
  else if(p.st==4){const N=p.wn,t=p.wt;p.vh-=(p.vh>0?8.2:5)*dt;p.wa*=1-.05*dt;p.vx=t.x*p.wa;p.vz=t.z*p.wa;
   if(p.jb>0){const lk=cl(fx*N.x+fz*N.z,0,1),al=p.wa*lerp(1,.1,lk),out=1.2+4*lk;p.vx=t.x*al+N.x*out;p.vz=t.z*al+N.z*out;p.vh=Math.sqrt(2*16.4*(1+.6*lk));p.st=0;p.cd=.25;p.jb=0;p.g=0;}
   else if(!(fwK>0)||p.vh<-5||tm(p.x-N.x*.55,p.z-N.z*.55)!=1||Math.abs(p.wa)<1.5){p.st=0;p.cd=.2}}
  else if(p.st==5){const N=p.wn;p.vh-=8*dt;p.vx=p.vz=0;
   if(p.jb>0){p.vx=N.x*4;p.vz=N.z*4;p.vh=9;p.st=0;p.cd=.4;p.jb=0;}
   else if(cr||p.vh<-1||tm(p.x-N.x*.55,p.z-N.z*.55)!=1){p.st=0;p.cd=.4}}
  else if(p.st==6)zipUpd(dt,cr);
  gripUpd(dt);
  if(p.st==0||p.st==4||p.st==5){
   p.h+=p.vh*dt;
   if(p.h<=gh&&p.vh<=0){if(!p.g){const fh=p.peak-p.h;if(fh>=2){if(tt-p.crP<.25){p.roll=.5;p.low=1;}else{p.vx*=.7;p.vz*=.7;}}p.chain=0;p.dashed=0;}p.h=gh;p.vh=0;p.g=1;p.peak=p.h;if(p.st>3)p.st=0}else if(p.h>gh+.02)p.g=0;
   const ceiling=Maps.ceiling(world,p.x,p.z);if(m0==6&&p.h<2.9&&p.h+hg>2.9){p.h=2.9-hg;if(p.vh>0)p.vh=0}else if(p.h+hg>ceiling){p.h=ceiling-hg;p.vh=Math.min(0,p.vh)}
   const nx=p.x+p.vx*dt;if(!bl(nx,p.z,.4,p.h,hg,0))p.x=nx;else{p.vx=0;if(p.st==4)p.wa*=.5}const nz=p.z+p.vz*dt;if(!bl(p.x,nz,.4,p.h,hg,0))p.z=nz;else{p.vz=0;if(p.st==4)p.wa*=.5}}}
 {const rtg=p.st==4?((-cy*p.wn.x+sy*p.wn.z)>0?.21:-.21):0;p.rl+=(rtg-p.rl)*Math.min(1,dt*8)}

player.move={gCd,dCd,gsp,zpCd,crouch:!!input.crouch};
}

NSR.Movement={createPose,tile,solid,collide,ray,step};
if(typeof module!=='undefined')module.exports=NSR.Movement;
})(globalThis);
