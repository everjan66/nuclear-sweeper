(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
const Protocol=NSR.Protocol;
const encoder=new TextEncoder(),byteLength=text=>encoder.encode(text).length;
function create({url,dev=false,onEvent=()=>{},iceTransportPolicy='all'}={}){
 let base=new URL(url||location.origin).origin,member=null,closed=false,pollController=null,iceServers=[],turnConfigured=false;
 const peers=new Map();let bytesSent=0,bytesReceived=0,chunkSequence=0,signalFailures=0;
 const emit=(type,data={})=>onEvent({type,...data});
 async function request(path,body,signal){
  const response=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(member?{Authorization:'Bearer '+member.memberToken}:{})},body:body?JSON.stringify({...body,...(member?{room:member.room,member:member.memberId}:{})}):undefined,signal,keepalive:path==='leave'});
  const value=await response.json();if(!response.ok)throw new Error(value.error||'Signaling service unavailable.');return value;
 }
 async function signal(peerId,data){return request('signal',{to:peerId,data});}
 async function initialize(){const ice=await request('ice',{});iceServers=ice.iceServers;turnConfigured=ice.turnConfigured;if(iceTransportPolicy==='relay'&&!turnConfigured)throw new Error('Relay testing requires TURN configuration on the signaling service.');poll();}
 function peer(peerId,offerer){
  if(peers.has(peerId))return peers.get(peerId);
  const connection=new RTCPeerConnection({iceServers,iceTransportPolicy}),state={id:peerId,connection,reliable:null,unreliable:null,open:false,queue:[],queuedBytes:0,chunks:new Map(),candidates:[],lastSeen:performance.now(),ping:0,path:'connecting'};
  peers.set(peerId,state);
  const timeout=setTimeout(()=>{if(!state.open){emit('error',{peerId,message:'Peer connection timed out. Check TURN configuration or retry.'});drop(peerId);}},20000);state.timeout=timeout;
  function channel(dataChannel){
   const reliable=dataChannel.label==='reliable';state[reliable?'reliable':'unreliable']=dataChannel;dataChannel.bufferedAmountLowThreshold=32768;
   dataChannel.onbufferedamountlow=()=>flush(state);
   dataChannel.onopen=()=>{if(state.reliable?.readyState==='open'&&state.unreliable?.readyState==='open'){clearTimeout(timeout);state.reliable.send(JSON.stringify({kind:'hello',version:Protocol.VERSION,dev:!!dev}));}};
   dataChannel.onmessage=message=>receive(state,message.data,reliable);
   dataChannel.onclose=()=>drop(peerId);
  }
  connection.ondatachannel=event=>channel(event.channel);
  connection.onicecandidate=event=>{if(event.candidate)signal(peerId,{type:'candidate',candidate:event.candidate.toJSON()}).catch(error=>emit('status',{message:error.message}));};
  connection.onconnectionstatechange=()=>{if(['failed','closed'].includes(connection.connectionState))drop(peerId);};
  if(offerer){channel(connection.createDataChannel('reliable',{ordered:true}));channel(connection.createDataChannel('unreliable',{ordered:false,maxRetransmits:0}));}
  return state;
 }
 function drop(peerId){const state=peers.get(peerId);if(!state)return;peers.delete(peerId);clearTimeout(state.timeout);state.connection.close();state.chunks.clear();state.queue=[];emit('peer-close',{peerId});}
 function receive(state,text,reliable){
  if(typeof text!=='string'||text.length>20000||byteLength(text)>20000){drop(state.id);return;}bytesReceived+=byteLength(text);state.lastSeen=performance.now();
  let value;try{value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid message.');}catch(error){drop(state.id);return;}
  if(value.kind==='hello'){
   if(value.version!==Protocol.VERSION||value.dev!==!!dev){emit('error',{message:'Incompatible game version or developer mode.'});drop(state.id);return;}
   if(!state.open){state.open=true;emit('peer-open',{peerId:state.id});}return;
  }
  if(!state.open)return;
  if(value.kind==='ping'){send(state.id,{kind:'pong',at:value.at},false);return;}
  if(value.kind==='pong'){state.ping=performance.now()-value.at;return;}
  if(value.kind==='chunk'){
   if(!reliable||!Number.isInteger(value.total)||value.total<1||value.total>256||!Number.isInteger(value.index)||value.index<0||value.index>=value.total||typeof value.text!=='string'||value.text.length>12000){drop(state.id);return;}
   if(!state.chunks.has(value.id)){if(state.chunks.size>=3){drop(state.id);return;}state.chunks.set(value.id,{total:value.total,parts:[],bytes:0,created:performance.now()});}
   const buffer=state.chunks.get(value.id);if(buffer.total!==value.total||buffer.parts[value.index]!==undefined)return;buffer.parts[value.index]=value.text;buffer.bytes+=byteLength(value.text);
   if(buffer.bytes>Protocol.MAX_SNAPSHOT){drop(state.id);return;}
   if(buffer.parts.filter(part=>part!==undefined).length===buffer.total){state.chunks.delete(value.id);try{value=JSON.parse(buffer.parts.join(''));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid message.');}catch(error){drop(state.id);return;}}
   else return;
  }
  emit('message',{peerId:state.id,data:value,reliable});
 }
 function flush(state){const channel=state.reliable;if(!channel||channel.readyState!=='open')return;while(state.queue.length&&channel.bufferedAmount<65536){const packet=state.queue[0];try{channel.send(packet.text);}catch(error){emit('error',{peerId:state.id,message:'Connection could not send data. Rejoin to retry.'});drop(state.id);return;}state.queue.shift();state.queuedBytes-=packet.bytes;bytesSent+=packet.bytes;}}
 function send(peerId,value,reliable=true){
  const state=peers.get(peerId);if(!state?.open)return false;const text=JSON.stringify(value),bytes=byteLength(text);if(bytes>Protocol.MAX_SNAPSHOT)return false;
  if(!reliable){if(bytes>16000||state.unreliable?.readyState!=='open'||state.unreliable.bufferedAmount+bytes>32768)return false;try{state.unreliable.send(text);}catch(error){return false;}bytesSent+=bytes;return true;}
  const pieces=[];if(bytes<=14000)pieces.push(text);else{
   const id=++chunkSequence,parts=[];
   for(let offset=0;offset<text.length;){let length=Math.min(10000,text.length-offset);while(byteLength(JSON.stringify(text.slice(offset,offset+length)))>19000)length=Math.floor(length/2);parts.push(text.slice(offset,offset+length));offset+=length;}
   if(parts.length>256)return false;
   for(let index=0;index<parts.length;index++)pieces.push(JSON.stringify({kind:'chunk',id,total:parts.length,index,text:parts[index]}));
  }
  const packets=pieces.map(text=>({text,bytes:byteLength(text)})),queuedBytes=packets.reduce((total,packet)=>total+packet.bytes,0);
  if(state.queuedBytes+(state.reliable?.bufferedAmount||0)+queuedBytes>Protocol.MAX_SNAPSHOT){emit('error',{peerId,message:'Connection is too slow to synchronize. Rejoin to retry.'});drop(peerId);return false;}
  state.queue.push(...packets);state.queuedBytes+=queuedBytes;flush(state);return peers.has(peerId);
 }
 async function handle(message){
  if(message.type==='peer-joined'){
   const state=peer(message.peerId,true);await state.connection.setLocalDescription(await state.connection.createOffer());await signal(message.peerId,{type:'offer',description:state.connection.localDescription.toJSON()});
  }else if(message.type==='peer-left')drop(message.peerId);
  else if(message.type==='room-closed'){emit('status',{message:'Signaling room closed. Existing peer connections can continue.'});}
  else if(message.type==='signal'){
   const state=peer(message.peerId,false),data=message.data;
   if(data.type==='candidate'){if(state.connection.remoteDescription)await state.connection.addIceCandidate(data.candidate);else if(state.candidates.length<64)state.candidates.push(data.candidate);}
   else if(data.type==='offer'||data.type==='answer'){
    await state.connection.setRemoteDescription(data.description);for(const candidate of state.candidates.splice(0))await state.connection.addIceCandidate(candidate);
    if(data.type==='offer'){await state.connection.setLocalDescription(await state.connection.createAnswer());await signal(message.peerId,{type:'answer',description:state.connection.localDescription.toJSON()});}
   }
  }
 }
 async function poll(){
  while(!closed&&member){
   try{pollController=new AbortController();const messages=await request('poll?room='+encodeURIComponent(member.room)+'&member='+encodeURIComponent(member.memberId),null,pollController.signal);if(signalFailures)emit('status',{message:'Signaling reconnected. Invitations and peer negotiation are available again.'});signalFailures=0;for(const message of messages)await handle(message);}
   catch(error){if(closed)return;signalFailures++;emit('status',{message:'Signaling unavailable; established peers continue. '+error.message});await new Promise(resolve=>setTimeout(resolve,Math.min(5000,signalFailures*1000)));}
  }
 }
 const heartbeat=setInterval(async()=>{
  for(const state of peers.values()){
   if(state.open){send(state.id,{kind:'ping',at:performance.now()},false);if(performance.now()-state.lastSeen>15000)drop(state.id);}
   for(const [id,buffer]of state.chunks)if(performance.now()-buffer.created>15000)state.chunks.delete(id);
   try{const reports=await state.connection.getStats();reports.forEach(report=>{if(report.type==='candidate-pair'&&report.state==='succeeded'){const candidate=reports.get(report.localCandidateId);state.path=candidate?.candidateType==='relay'?'TURN relay':'direct';}});}catch(error){}
  }
 },2000);
 async function close(){if(closed)return;closed=true;root.removeEventListener?.('pagehide',close);clearInterval(heartbeat);pollController?.abort();if(member)request('leave',{}).catch(()=>{});for(const id of [...peers.keys()])drop(id);}
 root.addEventListener?.('pagehide',close);
 return {
  async host(){try{member=await request('create',{version:Protocol.VERSION,dev});await initialize();const invitation={url:base,room:member.room,token:member.token,dev,version:Protocol.VERSION};return {room:member.room,token:member.token,invitation};}catch(error){await close();throw error;}},
  async join(invitation){try{const value=Protocol.invitation(invitation);base=value.url;member=await request('join',{room:value.room,token:value.token,version:Protocol.VERSION,dev});await initialize();return member.memberId;}catch(error){await close();throw error;}},
  send,broadcast(value,reliable=true){for(const id of peers.keys())send(id,value,reliable);},close,
  stats(){return {bytesSent,bytesReceived,turnConfigured,peers:[...peers.values()].map(state=>({id:state.id,ping:Math.round(state.ping),path:state.path,queuedBytes:state.queuedBytes+(state.reliable?.bufferedAmount||0)}))};}
 };
}
NSR.Transport={create};
})(globalThis);
