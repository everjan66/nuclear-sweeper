'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('page exit releases the signaling slot using an authenticated keepalive request',async()=>{
 const listeners=new Map(),requests=[];let pollAborted=false;
 const context=vm.createContext({URL,AbortController,location:{origin:'http://localhost'},performance:{now:()=>0},setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,addEventListener:(name,handler)=>listeners.set(name,handler),removeEventListener:(name)=>listeners.delete(name),fetch:async(url,options)=>{
  requests.push({url,options});
  if(url.includes('/poll?'))return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{pollAborted=true;reject(new Error('aborted'));}));
  return {ok:true,json:async()=>url.endsWith('/create')?{room:'room',token:'invitation',memberId:'host',memberToken:'test-member-token'}:url.endsWith('/ice')?{iceServers:[],turnConfigured:false}:{ok:true}};
 }});
 for(const file of ['protocol','transport'])vm.runInContext(fs.readFileSync('js/net/'+file+'.js','utf8'),context);
 const transport=context.NSR.Transport.create({url:'http://localhost'});await transport.host();assert.ok(listeners.has('pagehide'));
 await listeners.get('pagehide')();const leave=requests.find(request=>request.url.endsWith('/leave'));assert.ok(leave);assert.equal(leave.options.keepalive,true);assert.equal(leave.options.headers.Authorization,'Bearer test-member-token');assert.equal(JSON.parse(leave.options.body).member,'host');assert.equal(pollAborted,true);assert.equal(listeners.has('pagehide'),false);
 await transport.close();assert.equal(requests.filter(request=>request.url.endsWith('/leave')).length,1);
});
