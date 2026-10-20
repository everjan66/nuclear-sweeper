(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
function createFrameClock(){
 let deadline=null,lastLimit=null,sampleAt=null,frames=0,fps=0;
 return {
  due(now,limit=0){
   limit=Number.isFinite(limit)&&limit>0?limit:0;
   if(limit!==lastLimit){deadline=null;lastLimit=limit;}
   if(!limit)return true;
   const interval=1000/limit;
   if(deadline===null||now-deadline>interval){deadline=now+interval;return true;}
   if(now+.1<deadline)return false;
   deadline+=interval;return true;
  },
  rendered(now){
   if(sampleAt===null){sampleAt=now;frames=0;return fps;}
   frames++;
   if(now-sampleAt>=500){fps=Math.round(frames*1000/(now-sampleAt));sampleAt=now;frames=0;}
   return fps;
  }
 };
}
function damageAngle(pose,source){return pose.yaw-Math.atan2(-(source.x-pose.x),-(source.z-pose.z));}
NSR.Presentation={createFrameClock,damageAngle};
if(typeof module!=='undefined')module.exports=NSR.Presentation;
})(globalThis);
