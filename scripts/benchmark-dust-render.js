/* Run in the game's developer console after starting solo:
   await import('/scripts/benchmark-dust-render.js'); await NSR.DustBenchmark.run()
   Serve with a static server: the signaling server deliberately serves only game assets.
   A fixed scene and explicit draws isolate render submission; these are not gameplay FPS.
*/
(function(){
'use strict';
async function run({frames=120,detectorLevel=40}={}){
 if(!gameStarted||coopSession||!paused)throw new Error('Start solo and pause before running this benchmark.');
 const originalUpdate=dustView.update,gl=rend.getContext(),originalUpload=gl.bufferSubData;
 const matrix=bars.instanceMatrix,color=bars.instanceColor,results=[];
 let uploaded=0,updateTime=0;
 gl.bufferSubData=function(...args){const data=args[2];if(data?.buffer===matrix.array.buffer||data?.buffer===color.array.buffer)uploaded+=(args[4]??data.length)*data.BYTES_PER_ELEMENT;return originalUpload.apply(gl,args);};
 function legacy({dust,map,x,z,radius,low,high,dirty,full}){
  function set(i){const v=dust[i],tx=i%GW,tz=i/GW|0,cx=(tx+.5)*TS,cz=(tz+.5)*TS,k=v<.02?0:1;
   dummy.position.set(cx,map[i]===6?3.2:0,cz);dummy.rotation.set(0,0,0);dummy.scale.set(k,k*(.06+v*.5),k);dummy.updateMatrix();bars.setMatrixAt(i,dummy.matrix);
   const theme=TH(),a=theme.dl,b=theme.dh,f=Math.hypot(cx-x,cz-z)<radius?1:.5;col.setRGB(lerp(a[0],b[0],v)*f,lerp(a[1],b[1],v)*f,lerp(a[2],b[2],v)*f);bars.setColorAt(i,col);
  }
  if(full)for(let i=0;i<GW*GH;i++)set(i);else{for(const i of dirty)set(i);const r=radius/TS+2;for(let tz=Math.max(0,Math.floor(z/TS-r));tz<=Math.min(GH-1,Math.floor(z/TS+r));tz++)for(let tx=Math.max(0,Math.floor(x/TS-r));tx<=Math.min(GW-1,Math.floor(x/TS+r));tx++)set(tz*GW+tx);}
  matrix.updateRange.count=color.updateRange.count=-1;matrix.needsUpdate=color.needsUpdate=true;
 }
 const stats=a=>{a.sort((x,y)=>x-y);return {medianMs:a[a.length>>1],p95Ms:a[Math.floor(a.length*.95)]};};
 const saved={x:p.x,z:p.z,gei:S.L.gei};
 try{
  for(const moving of [false,true])for(let round=0;round<3;round++)for(const [label,update]of [['baseline',legacy],['optimized',originalUpdate]]){
   S.L.gei=detectorLevel;fullRef=true;p.x=saved.x;p.z=saved.z;
   dustView.update=function(state){const t=performance.now();update(state);updateTime+=performance.now()-t;};
   const timings=[],updates=[];let bytes=0;
   for(let i=0;i<frames+20;i++){
    if(moving){p.x=saved.x+Math.sin(i*.04)*6;p.z=saved.z+Math.cos(i*.04)*6;}
    uploaded=0;updateTime=0;const start=performance.now();draw();const elapsed=performance.now()-start;
    if(i>=20){timings.push(elapsed);updates.push(updateTime);bytes+=uploaded;}
    if(i%10===0)await new Promise(resolve=>setTimeout(resolve,0));
   }
   results.push({label,moving,round,drawCpu:stats(timings),dustCpu:stats(updates),dustUploadBytesPerFrame:bytes/frames,drawCalls:rend.info.render.calls});
  }
 }finally{dustView.update=originalUpdate;gl.bufferSubData=originalUpload;Object.assign(p,{x:saved.x,z:saved.z});S.L.gei=saved.gei;fullRef=true;draw();}
 const debug=gl.getExtension('WEBGL_debug_renderer_info');
 return {renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown',userAgent:navigator.userAgent,canvas:[gl.drawingBufferWidth,gl.drawingBufferHeight],sector:S.sector,enemies:E.length,detectorLevel,frames,results};
}
NSR.DustBenchmark={run};
})();
