'use strict';
const vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
function environment({latency=0,loss=0,jitter=0,seed=19}={}){
 let time=0,hostEndpoint=null,guestCount=0,packetCount=0,randomState=seed,blackout=false,unreliableBlackout=false;
 const endpoints=new Map(),packets=[],ordered=new Map(),traffic={bytes:0,messages:0,dropped:0,byType:{}};
 const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 const context=vm.createContext({console,crypto:crypto.webcrypto,performance:{now:()=>time},URL,URLSearchParams,btoa,atob});
 for(const file of ['core/definitions','core/map','core/movement','game/simulation','net/protocol','storage/coop','net/session'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../js',file+'.js'),'utf8'),context);
 context.NSR.Transport={create({onEvent}){
  const endpoint={id:null,onEvent,bytesSent:0};
  function send(id,value,reliable=true){
   const destination=endpoint.id==='host'?endpoints.get(id):hostEndpoint;if(!destination||!endpoints.has(destination.id))return false;
   const text=JSON.stringify(value),bytes=Buffer.byteLength(text);packetCount++;traffic.bytes+=bytes;traffic.messages++;endpoint.bytesSent+=bytes;traffic.byType[value.type]=(traffic.byType[value.type]||0)+bytes;
   if(blackout||(!reliable&&(unreliableBlackout||(loss&&packetCount%Math.round(1/loss)===0)))){traffic.dropped++;return true;}
   let at=time+Math.max(0,latency/2+(random()-.5)*jitter*2);
   if(reliable){const route=endpoint.id+'>'+destination.id;at=Math.max(at,(ordered.get(route)||0)+.001);ordered.set(route,at);}
   packets.push({at,destination,source:endpoint.id==='host'?'host':endpoint.id,value:JSON.parse(text),reliable});return true;
  }
  return {
   async host(){endpoint.id='host';hostEndpoint=endpoint;endpoints.set('host',endpoint);return {invitation:{url:'http://localhost',room:'r'.repeat(24),token:'t'.repeat(32)}};},
   async join(){endpoint.id='guest-'+(++guestCount);endpoints.set(endpoint.id,endpoint);onEvent({type:'peer-open',peerId:'host'});hostEndpoint.onEvent({type:'peer-open',peerId:endpoint.id});return endpoint.id;},
   send,broadcast(value,reliable=true){for(const id of endpoints.keys())if(id!=='host')send(id,value,reliable);},
   stats(){return {peers:[...endpoints.keys()].filter(id=>id!==endpoint.id).map(id=>({id,ping:latency,path:'fake',queuedBytes:0})),bytesSent:endpoint.bytesSent};},
   async close(){endpoints.delete(endpoint.id);if(endpoint.id!=='host'&&endpoints.has('host'))hostEndpoint.onEvent({type:'peer-close',peerId:endpoint.id});}
  };
 }};
 function storage(){const values=new Map();return context.NSR.Storage.create({storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}});}
 function deliver(){
  packets.sort((first,second)=>first.at-second.at);
  while(packets.length&&packets[0].at<=time){const packet=packets.shift();if(endpoints.get(packet.destination.id)===packet.destination)packet.destination.onEvent({type:'message',peerId:packet.source,data:packet.value,reliable:packet.reliable});}
 }
 function advance(sessions,inputs={},ticks=1){for(let tick=0;tick<ticks;tick++){time+=1000/64;deliver();for(let index=0;index<sessions.length;index++)sessions[index].advance(1/64,inputs[index]||{yaw:0,pit:0,menu:true});deliver();}}
 return {NSR:context.NSR,storage,advance,deliver,traffic,now:()=>time,pending:()=>packets.length,setBlackout:value=>{blackout=value;},setUnreliableBlackout:value=>{unreliableBlackout=value;}};
}
module.exports={environment};
