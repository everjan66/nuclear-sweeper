'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createServer}=require('../services/signaling/server.cjs');
const Protocol=require('../js/net/protocol.js');
test('input validation rejects malformed angles and neutralizes stale held keys',()=>{
 assert.equal(Protocol.input({seq:1,yaw:Infinity,pit:0}),null);assert.equal(Protocol.input({seq:1,yaw:0,pit:2}),null);
 const clean=Protocol.input({seq:1,yaw:0,pit:0,fire:true,jump:true,scrap:10000});assert.equal(clean.scrap,undefined);assert.equal(Protocol.consume(clean).jump,false);assert.equal(Protocol.neutral(clean).fire,undefined);
 assert.throws(()=>Protocol.invitation({url:'http://example.com',room:'a'.repeat(24),token:'b'.repeat(32)}));
});
test('packed inputs preserve every control while rejecting invalid flags and versions',()=>{
 const clean=Protocol.input({seq:42,yaw:2.125,pit:-.5,weapon:6,...Object.fromEntries([...Protocol.held,...Protocol.edges].map(key=>[key,true]))}),packed=Protocol.packInput(clean);
 assert.deepEqual(Protocol.input(packed),clean);assert.ok(JSON.stringify(packed).length<JSON.stringify(clean).length/3);
 for(const corrupt of [[42,0,0,-1,0],[42,0,0,1<<20,0],[42,0,0,0,7],[42,0,0,0,0,'extra']])assert.equal(Protocol.input(corrupt),null);
 assert.throws(()=>Protocol.invitation({version:Protocol.VERSION-1}),/version/);
});
test('signaling enforces invitations, four slots, versions, peer isolation and short-lived TURN',async context=>{
 const server=createServer({turnSecret:'test-secret',turnUrls:'turn:relay.example:3478'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));context.after(()=>{server.closeAllConnections();server.close();});
 const base='http://127.0.0.1:'+server.address().port;
 async function post(route,value,member){const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(member?{Authorization:'Bearer '+member.memberToken}:{})},body:JSON.stringify({...value,...(member?{room:member.room,member:member.memberId}:{})})});return {status:response.status,data:await response.json()};}
 assert.equal((await post('create',{version:99})).status,409);
 const host=(await post('create',{version:Protocol.VERSION,dev:false})).data;
 assert.equal((await post('join',{room:host.room,token:'bad',version:Protocol.VERSION})).status,404);
 assert.equal((await post('join',{room:host.room,token:host.token,version:Protocol.VERSION,dev:true})).status,409);
 const guests=[];for(let index=0;index<3;index++)guests.push((await post('join',{room:host.room,token:host.token,version:Protocol.VERSION})).data);
 assert.equal((await post('join',{room:host.room,token:host.token,version:Protocol.VERSION})).status,409);
 assert.equal((await post('signal',{to:guests[1].memberId,data:{type:'offer'}},guests[0])).status,400);
 assert.equal((await post('signal',{to:'host',data:{type:'candidate',candidate:{candidate:'test'}}},guests[0])).status,200);
 const ice=await post('ice',{},host);assert.equal(ice.data.turnConfigured,true);const turn=ice.data.iceServers[1];assert.equal(turn.credential,crypto.createHmac('sha1','test-secret').update(turn.username).digest('base64'));assert.ok(Number(turn.username.split(':')[0])>Date.now()/1000);
 const queue=await fetch(base+'/api/poll?room='+host.room+'&member='+host.memberId,{headers:{Authorization:'Bearer '+host.memberToken}});assert.equal((await queue.json()).filter(message=>message.type==='peer-joined').length,3);
 assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await post('leave',{},host)).status,200);assert.equal((await post('ice',{},guests[0])).status,410);
});

test('queue pressure cannot interrupt leave, expiry or leak rejected join slots',async context=>{
 let clock=0,sweep;
 const server=createServer({now:()=>clock,scheduleMaintenance:callback=>{sweep=callback;return {unref(){}};}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));context.after(()=>{server.closeAllConnections();server.close();});
 const base='http://127.0.0.1:'+server.address().port;
 async function post(route,value={},member){const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(member?{Authorization:'Bearer '+member.memberToken}:{})},body:JSON.stringify({...value,...(member?{room:member.room,member:member.memberId}:{})})});return {status:response.status,data:await response.json()};}
 const create=async()=>(await post('create',{version:Protocol.VERSION})).data;
 const join=host=>post('join',{room:host.room,token:host.token,version:Protocol.VERSION});
 const signal=(from,to)=>post('signal',{to:to.memberId,data:{type:'candidate'}},from);
 const poll=async member=>(await fetch(base+'/api/poll?room='+member.room+'&member='+member.memberId,{headers:{Authorization:'Bearer '+member.memberToken}})).json();
 const host=await create(),guest=(await join(host)).data;
 for(let i=0;i<63;i++)assert.equal((await signal(guest,host)).status,200);
 assert.equal((await signal(guest,host)).status,429);
 for(let i=0;i<4;i++)assert.equal((await join(host)).status,429);
 assert.equal((await post('leave',{},guest)).status,200);
 assert.ok((await poll(host)).some(message=>message.type==='peer-left'));
 const guests=[];for(let i=0;i<3;i++){const joined=await join(host);assert.equal(joined.status,200);guests.push(joined.data);}
 for(const member of guests)for(let i=0;i<64;i++)assert.equal((await signal(host,member)).status,200);
 assert.equal((await post('leave',{},host)).status,200);
 assert.equal((await post('ice',{},guests[0])).status,410);
 const expired=await create(),expiringGuest=(await join(expired)).data;
 for(let i=0;i<64;i++)await signal(expired,expiringGuest);
 clock=61000;
 const healthy=await create();
 assert.doesNotThrow(()=>sweep());
 assert.equal((await post('ice',{},expired)).status,410);
 assert.equal((await post('ice',{},healthy)).status,200);
 // A stale guest also leaves cleanly when the refreshed host has a full queue.
 const stale=(await join(healthy)).data;for(let i=0;i<63;i++)await signal(stale,healthy);
 clock+=61000;await post('ice',{},healthy);assert.doesNotThrow(()=>sweep());
 assert.equal((await post('ice',{},stale)).status,410);
 assert.ok((await poll(healthy)).some(message=>message.type==='peer-left'));
});
