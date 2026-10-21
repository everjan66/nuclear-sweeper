(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
function createState(){
 let peak=0,hitAt=-Infinity;
 const burst=now=>peak*Math.pow(Math.max(0,1-Math.max(0,now-hitAt)/1500),2);
 return {
  hit(damage,maxHealth,now){
   if(!Number.isFinite(damage)||damage<=0||!Number.isFinite(maxHealth)||maxHealth<=0||!Number.isFinite(now))return;
   peak=Math.min(.84,.22+Math.min(.62,damage/maxHealth*2.4)+burst(now)*.35);hitAt=now;
  },
  intensity(now,exposure=0){return Math.min(1,.16+burst(now)+(Number.isFinite(exposure)?Math.min(.35,Math.max(0,exposure)/60):0));},
  reset(){peak=0;hitAt=-Infinity;}
 };
}
function create(canvas,source,random=Math.random){
 const state=createState(),context=canvas.getContext('2d');let nextDraw=0;
 canvas.width=640;canvas.height=400;canvas.hidden=true;
 const width=canvas.width,height=canvas.height;let grain=null;
 if(context){
  const noise=canvas.ownerDocument.createElement('canvas');noise.width=128;noise.height=128;
  const noiseContext=noise.getContext('2d'),pixels=noiseContext.createImageData(noise.width,noise.height),data=pixels.data;
  for(let index=0;index<data.length;index+=4){const value=random()*255;data[index]=value*.75;data[index+1]=value;data[index+2]=value*.72;data[index+3]=random()*65;}
  noiseContext.putImageData(pixels,0,0);grain=context.createPattern(noise,'repeat');context.imageSmoothingEnabled=false;
 }
 return {
  hit:state.hit,
  render(now,{enabled=true,paused=false,reducedMotion=false,exposure=0}={}){
   if(!context||!enabled||paused||reducedMotion){canvas.hidden=true;nextDraw=0;state.reset();return;}
   canvas.hidden=false;if(now<nextDraw)return;nextDraw=now+1000/30;
   const intensity=state.intensity(now,exposure);
   context.clearRect(0,0,width,height);context.save();context.globalAlpha=intensity;
   context.translate(-random()*128,-random()*128);context.fillStyle=grain;context.fillRect(0,0,width+128,height+128);context.restore();
   if(intensity>.4&&source?.width&&source.height){
    for(let index=0;index<Math.ceil((intensity-.4)*5);index++){
     const line=random()*(height-5),band=1+random()*3,shift=(random()-.5)*intensity*24;
     context.drawImage(source,0,line/height*source.height,source.width,band/height*source.height,shift,line,width,band);
    }
   }
   for(let index=0;index<8+intensity*44;index++){
    const edge=random()<.7,line=edge?(random()<.5?random()*16:height-16+random()*16):random()*height;
    const start=random()*width,length=3+random()*(35+intensity*40);
    context.fillStyle=random()<.65?'rgba(155,229,100,'+(.15+intensity*.5)+')':'rgba(220,250,207,'+(.1+intensity*.45)+')';
    for(let offset=0;offset<length;offset+=3+random()*5)context.fillRect(start+offset,line,1+random()*5,1);
   }
   context.fillStyle='rgba(10,24,14,'+(.015+intensity*.025)+')';
   for(let line=0;line<height;line+=3)context.fillRect(0,line,width,1);
  }
 };
}
NSR.SuitInterference={createState,create};
if(typeof module!=='undefined')module.exports=NSR.SuitInterference;
})(globalThis);
