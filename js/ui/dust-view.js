(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
function create({width,height,tileSize,matrix,color}){
 const count=width*height,values=new Float64Array(count).fill(NaN),tiles=new Int16Array(count).fill(-1),near=new Uint8Array(count);
 let lastX=NaN,lastZ=NaN,lastRadius=NaN;
 function upload(attribute,first,last,stride){if(last<first)return;const range=attribute.updateRange,start=first*stride,end=(last+1)*stride;
  const from=range.count>0?Math.min(start,range.offset):start,to=range.count>0?Math.max(end,range.offset+range.count):end;
  range.offset=from;range.count=to-from;attribute.needsUpdate=true;
 }
 return {update({dust,map,x,z,radius,low,high,dirty=[],full=false}){
  let matrixFirst=count,matrixLast=-1,colorFirst=count,colorLast=-1;
  const inside=i=>((i%width+.5)*tileSize-x)**2+((Math.floor(i/width)+.5)*tileSize-z)**2<radius*radius;
  function paint(i){const value=dust[i],gain=near[i]?1:.5,offset=i*3;for(let k=0;k<3;k++)color.array[offset+k]=(low[k]+(high[k]-low[k])*value)*gain;colorFirst=Math.min(colorFirst,i);colorLast=Math.max(colorLast,i);}
  function change(i){const value=dust[i],tile=map[i];if(!full&&values[i]===value&&tiles[i]===tile)return;
   values[i]=value;tiles[i]=tile;near[i]=inside(i)?1:0;const offset=i*16,visible=value<.02?0:1;
   matrix.array.fill(0,offset,offset+16);matrix.array[offset]=matrix.array[offset+10]=visible;matrix.array[offset+5]=visible*(.06+value*.5);
   matrix.array[offset+12]=(i%width+.5)*tileSize;matrix.array[offset+13]=tile===6?3.2:0;matrix.array[offset+14]=(Math.floor(i/width)+.5)*tileSize;matrix.array[offset+15]=1;
   matrixFirst=Math.min(matrixFirst,i);matrixLast=Math.max(matrixLast,i);paint(i);
  }
  if(full)for(let i=0;i<count;i++)change(i);else{
   for(const i of dirty)change(i);
   if(x!==lastX||z!==lastZ||radius!==lastRadius)for(let i=0;i<count;i++){const value=inside(i)?1:0;if(value!==near[i]){near[i]=value;paint(i);}}
  }
  lastX=x;lastZ=z;lastRadius=radius;upload(matrix,matrixFirst,matrixLast,16);upload(color,colorFirst,colorLast,3);
 }};
}
NSR.DustView={create};
if(typeof module!=='undefined')module.exports=NSR.DustView;
})(globalThis);
