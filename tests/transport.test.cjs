'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('page exit releases the signaling slot using an authenticated keepalive request',async()=>{
 const listeners=new Map(),requests=[];let pollAborted=false;
 const context=vm.createContext({URL,AbortController,TextEncoder,location:{origin:'http://localhost'},performance:{now:()=>0},setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,addEventListener:(name,handler)=>listeners.set(name,handler),removeEventListener:(name)=>listeners.delete(name),fetch:async(url,options)=>{
  requests.push({url,options});
  if(url.includes('/poll?'))return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{pollAborted=true;reject(new Error('aborted'));}));
  return {ok:true,json:async()=>url.endsWith('/create')?{room:'room',token:'invitation',memberId:'host',memberToken:'test-member-token'}:url.endsWith('/ice')?{iceServers:[],turnConfigured:false}:{ok:true}};
 }});
 for(const file of ['protocol','transport'])vm.runInContext(fs.readFileSync('js/net/'+file+'.js','utf8'),context);
 const transport=context.NSR.Transport.create({url:'http://localhost'});await transport.host();assert.ok(listeners.has('pagehide'));
 await listeners.get('pagehide')();const leave=requests.find(request=>request.url.endsWith('/leave'));assert.ok(leave);assert.equal(leave.options.keepalive,true);assert.equal(leave.options.headers.Authorization,'Bearer test-member-token');assert.equal(JSON.parse(leave.options.body).member,'host');assert.equal(pollAborted,true);assert.equal(listeners.has('pagehide'),false);
 await transport.close();assert.equal(requests.filter(request=>request.url.endsWith('/leave')).length,1);
});

async function connectedTransport({failPoll=false}={}){
 const connections=[],events=[];let offered=false,polls=0;
 class Connection{
  constructor(){this.channels=[];connections.push(this);}
  createDataChannel(label){const channel={label,readyState:'open',bufferedAmount:0,sent:[],send(text){if(this.fail)throw new Error('SCTP buffer full');this.sent.push(text);this.bufferedAmount+=Buffer.byteLength(text);}};this.channels.push(channel);return channel;}
  async createOffer(){return {};}
  async setLocalDescription(){this.localDescription={toJSON:()=>({})};}
  close(){this.closed=true;}
 }
 const context=vm.createContext({URL,AbortController,TextEncoder,RTCPeerConnection:Connection,location:{origin:'http://localhost'},performance:{now:()=>0},setInterval:()=>1,clearInterval(){},setTimeout:(handler,delay)=>{if(delay<=5000)queueMicrotask(handler);return 1;},clearTimeout(){},fetch:async(url,options)=>{
  if(url.includes('/poll?')){
   polls++;if(failPoll&&polls===2)throw new Error('service unavailable');if(failPoll&&polls===3)return {ok:true,json:async()=>[]};
   if(!offered){offered=true;return {ok:true,json:async()=>[{type:'peer-joined',peerId:'guest'}]};}
   return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
  }
  return {ok:true,json:async()=>url.endsWith('/create')?{room:'room',memberId:'host',memberToken:'token'}:url.endsWith('/ice')?{iceServers:[],turnConfigured:false}:{ok:true}};
 }});
 for(const file of ['protocol','transport'])vm.runInContext(fs.readFileSync('js/net/'+file+'.js','utf8'),context);
 const transport=context.NSR.Transport.create({url:'http://localhost',onEvent:event=>events.push(event)});await transport.host();
 await new Promise(resolve=>setImmediate(resolve));
 const connection=connections[0],[reliable,unreliable]=connection.channels;
 reliable.onmessage({data:JSON.stringify({kind:'hello',version:context.NSR.Protocol.VERSION,dev:false})});
 return {transport,reliable,unreliable,connection,events,limit:context.NSR.Protocol.MAX_SNAPSHOT};
}

test('reliable backpressure drains in order and counts UTF-8 bytes including chunk envelopes',async t=>{
 const {transport,reliable,events}=await connectedTransport();t.after(()=>transport.close());
 reliable.bufferedAmount=65536;
 const payload={kind:'snapshot',text:('漢字😀\\"').repeat(12000)};
 assert.equal(transport.send('guest',payload),true);assert.equal(reliable.sent.length,0);
 const queued=transport.stats().peers[0].queuedBytes-65536;assert.ok(queued>Buffer.byteLength(JSON.stringify(payload)));
 while(transport.stats().peers[0].queuedBytes){reliable.bufferedAmount=0;reliable.onbufferedamountlow();}
 assert.equal(transport.stats().bytesSent,queued);
 assert.ok(reliable.sent.every(text=>Buffer.byteLength(text)<=20000));
 const packets=reliable.sent.map(text=>JSON.parse(text));assert.equal(packets.length,packets[0].total);
 assert.deepEqual(JSON.parse(packets.map(packet=>packet.text).join('')),payload);
 // Receiving a complete duplicated/out-of-order burst must emit one intact message.
 for(const text of reliable.sent.slice(1).reverse()){reliable.onmessage({data:text});reliable.onmessage({data:text});}
 reliable.onmessage({data:reliable.sent[0]});
 const messages=events.filter(event=>event.type==='message');assert.equal(messages.length,1);assert.equal(messages[0].data.text,payload.text);
 assert.equal(transport.stats().bytesReceived,Buffer.byteLength(JSON.stringify({kind:'hello',version:2,dev:false}))+queued*2-Buffer.byteLength(reliable.sent[0]));
});

test('reliable burst overflow includes SCTP buffered bytes and disconnects once',async t=>{
 const {transport,reliable,connection,events,limit}=await connectedTransport();t.after(()=>transport.close());
 reliable.bufferedAmount=limit-100;
 assert.equal(transport.send('guest',{kind:'snapshot',text:'x'.repeat(200)}),false);
 assert.equal(connection.closed,true);assert.equal(transport.stats().peers.length,0);assert.equal(reliable.sent.length,0);
 assert.equal(events.filter(event=>event.type==='error').length,1);assert.equal(events.filter(event=>event.type==='peer-close').length,1);
 assert.equal(transport.send('guest',{kind:'retry'}),false);
});

test('a blocked reliable channel has a bounded queue across repeated snapshot bursts',async t=>{
 const {transport,reliable,limit}=await connectedTransport();t.after(()=>transport.close());reliable.bufferedAmount=65536;
 let accepted=0;while(transport.send('guest',{kind:'snapshot',text:'x'.repeat(100000)})){
  accepted++;assert.ok(transport.stats().peers[0].queuedBytes<=limit);assert.ok(accepted<30);
 }
 assert.ok(accepted>1);assert.equal(transport.stats().peers.length,0);
});

test('unreliable congestion drops packets without enqueueing or exceeding the byte budget',async t=>{
 const {transport,unreliable}=await connectedTransport();t.after(()=>transport.close());
 assert.equal(transport.send('guest',{text:'漢'.repeat(6000)},false),false);
 unreliable.bufferedAmount=32760;assert.equal(transport.send('guest',{kind:'frame'},false),false);
 unreliable.bufferedAmount=0;assert.equal(transport.send('guest',{text:'漢'},false),true);
 assert.equal(transport.stats().bytesSent,Buffer.byteLength(unreliable.sent[0]));
 unreliable.fail=true;assert.equal(transport.send('guest',{kind:'frame'},false),false);
 assert.equal(transport.stats().peers[0].queuedBytes,0);
});

test('reliable SCTP send failure becomes a single connection error',async t=>{
 const {transport,reliable,connection,events}=await connectedTransport();t.after(()=>transport.close());reliable.fail=true;
 assert.equal(transport.send('guest',{kind:'snapshot'}),false);assert.equal(connection.closed,true);
 assert.equal(events.filter(event=>event.type==='error').length,1);assert.equal(events.filter(event=>event.type==='peer-close').length,1);
});

test('signaling recovery clears the outage status without closing established peers',async t=>{
 const {transport,connection,events}=await connectedTransport({failPoll:true});t.after(()=>transport.close());
 assert.ok(events.some(event=>event.type==='status'&&event.message.includes('Signaling unavailable')));
 assert.ok(events.some(event=>event.type==='status'&&event.message.includes('Signaling reconnected')));
 assert.equal(connection.closed,undefined);assert.equal(transport.stats().peers.length,1);
 assert.equal(transport.send('guest',{kind:'frame'},false),true);
});

test('malformed message envelopes close the peer without throwing into the game loop',async()=>{
 for(const data of ['null','[]','1',JSON.stringify({kind:'chunk',id:1,total:1,index:0,text:'null'})]){
  const {transport,reliable,connection,events}=await connectedTransport();
  try{assert.doesNotThrow(()=>reliable.onmessage({data}));assert.equal(connection.closed,true);assert.equal(events.filter(event=>event.type==='message').length,0);}finally{await transport.close();}
 }
});
