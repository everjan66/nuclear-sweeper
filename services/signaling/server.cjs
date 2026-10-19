'use strict';
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {VERSION}=require('../../js/net/protocol.js');
const ROOT=path.resolve(__dirname,'../..');
const token=()=>crypto.randomBytes(24).toString('base64url');
function createServer({allowedOrigin=process.env.ALLOWED_ORIGIN,turnSecret=process.env.TURN_SECRET,turnUrls=process.env.TURN_URLS,stunUrl=process.env.STUN_URL||'stun:stun.l.google.com:19302',now=Date.now}={}){
 const rooms=new Map(),rates=new Map();
 function json(response,status,value){if(response.writableEnded)return;response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value));}
 function fail(message,status=400){return Object.assign(new Error(message),{status});}
 function notify(member,message){if(member.queue.length>=64)throw fail('Signaling queue is full.',429);member.queue.push(message);if(member.waiting){clearTimeout(member.waiting.timer);json(member.waiting.response,200,member.queue.splice(0));member.waiting=null;}}
 function remove(room,id){const member=room.members.get(id);if(!member)return;if(member.waiting)json(member.waiting.response,410,{error:'Room closed.'});room.members.delete(id);if(id==='host'){for(const guest of room.members.values())notify(guest,{type:'room-closed'});rooms.delete(room.id);}else if(room.members.has('host'))notify(room.members.get('host'),{type:'peer-left',peerId:id});}
 const maintenance=setInterval(()=>{for(const room of rooms.values()){if(now()-room.created>12*3600000||now()-room.members.get('host')?.seen>60000){remove(room,'host');continue;}for(const member of room.members.values())if(member.id!=='host'&&now()-member.seen>60000)remove(room,member.id);}for(const [key,rate]of rates)if(now()-rate.since>60000)rates.delete(key);},10000);
 maintenance.unref();
 const server=http.createServer(async(request,response)=>{
  try{
   const origin=request.headers.origin;
   if(origin&&allowedOrigin&&origin!==allowedOrigin)throw fail('Origin not allowed.',403);
   if(origin){response.setHeader('Access-Control-Allow-Origin',allowedOrigin||origin);response.setHeader('Vary','Origin');}
   response.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');response.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');response.setHeader('X-Content-Type-Options','nosniff');
   if(request.method==='OPTIONS'){response.writeHead(204);response.end();return;}
   const url=new URL(request.url,'http://localhost');
   if(!url.pathname.startsWith('/api/')){
    if(request.method!=='GET'&&request.method!=='HEAD')throw fail('Method not allowed.',405);
    let pathname;try{pathname=decodeURIComponent(url.pathname);}catch(error){throw fail('Invalid path.');}
    if(pathname==='/')pathname='/nuclear-sweeper-reactor.html';
    if(!/^\/(nuclear-sweeper-(reactor|dev)\.html|nuclear-sweeper-dev\.js|js\/[\w/-]+\.js|assets\/[\w.-]+)$/.test(pathname))throw fail('Not found.',404);
    const filename=path.resolve(ROOT,'.'+pathname);if(!filename.startsWith(ROOT+path.sep))throw fail('Not found.',404);
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
    fs.stat(filename,(error,stat)=>{if(error||!stat.isFile()){json(response,404,{error:'Not found.'});return;}response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache'});if(request.method==='HEAD')response.end();else fs.createReadStream(filename).pipe(response);});return;
   }
   const address=request.socket.remoteAddress,rate=rates.get(address)||{since:now(),count:0};if(now()-rate.since>60000){rate.since=now();rate.count=0;}rate.count++;rates.set(address,rate);if(rate.count>1200)throw fail('Too many requests. Try again shortly.',429);
   let body={};if(request.method==='POST'){
    let text='';for await(const chunk of request){text+=chunk;if(Buffer.byteLength(text)>65536)throw fail('Message too large.',413);}try{body=JSON.parse(text||'{}');}catch(error){throw fail('Invalid JSON.');}
   }
   if(url.pathname==='/api/create'&&request.method==='POST'){
    if(body.version!==VERSION)throw fail('Incompatible game version.',409);if(rooms.size>=200)throw fail('The signaling service is full.',503);
    const room={id:token(),invitation:token(),created:now(),dev:!!body.dev,members:new Map()};const member={id:'host',token:token(),seen:now(),queue:[]};room.members.set('host',member);rooms.set(room.id,room);
    json(response,200,{room:room.id,token:room.invitation,memberId:member.id,memberToken:member.token});return;
   }
   if(url.pathname==='/api/join'&&request.method==='POST'){
    const room=rooms.get(body.room);if(!room||room.invitation!==body.token)throw fail('Invitation expired or room unavailable.',404);
    if(body.version!==VERSION||!!body.dev!==room.dev)throw fail('Game version or developer mode does not match the host.',409);
    if(room.members.size>=4)throw fail('This room is full (four players).',409);
    const member={id:'peer-'+token(),token:token(),seen:now(),queue:[]};room.members.set(member.id,member);notify(room.members.get('host'),{type:'peer-joined',peerId:member.id});
    json(response,200,{room:room.id,memberId:member.id,memberToken:member.token});return;
   }
   const room=rooms.get(url.searchParams.get('room')||body.room),member=room?.members.get(url.searchParams.get('member')||body.member);
   if(!member||request.headers.authorization!=='Bearer '+member.token)throw fail('Room expired. Create or open a new invitation.',410);member.seen=now();
   if(url.pathname==='/api/poll'&&request.method==='GET'){
    if(member.waiting)json(member.waiting.response,200,[]);
    if(member.queue.length){json(response,200,member.queue.splice(0));return;}
    const timer=setTimeout(()=>{if(member.waiting?.response===response)member.waiting=null;json(response,200,[]);},20000);member.waiting={response,timer};response.on('close',()=>{clearTimeout(timer);if(member.waiting?.response===response)member.waiting=null;});return;
   }
   if(url.pathname==='/api/signal'&&request.method==='POST'){
    const destination=room.members.get(body.to);if(!destination||body.to===member.id||(member.id!=='host'&&body.to!=='host'))throw fail('Invalid signaling destination.');
    const data=body.data;if(!data||!['offer','answer','candidate'].includes(data.type))throw fail('Invalid signaling message.');
    notify(destination,{type:'signal',peerId:member.id,data});json(response,200,{ok:true});return;
   }
   if(url.pathname==='/api/ice'&&request.method==='POST'){
    const iceServers=stunUrl?[{urls:stunUrl}]:[];
    if(turnSecret&&turnUrls){const username=Math.floor(now()/1000+3600)+':'+member.id;iceServers.push({urls:turnUrls.split(',').map(value=>value.trim()),username,credential:crypto.createHmac('sha1',turnSecret).update(username).digest('base64')});}
    json(response,200,{iceServers,turnConfigured:!!(turnSecret&&turnUrls)});return;
   }
   if(url.pathname==='/api/leave'&&request.method==='POST'){remove(room,member.id);json(response,200,{ok:true});return;}
   throw fail('Not found.',404);
  }catch(error){json(response,error.status||500,{error:error.status?error.message:'Signaling failed.'});}
 });
 server.on('close',()=>{clearInterval(maintenance);for(const room of rooms.values())for(const member of room.members.values()){if(member.waiting){clearTimeout(member.waiting.timer);member.waiting.response.end();}}});
 return server;
}
if(require.main===module){const server=createServer();server.listen(process.env.PORT===undefined?8787:Number(process.env.PORT),process.env.BIND||'127.0.0.1',()=>console.log('Nuclear Sweeper: http://'+(process.env.BIND||'127.0.0.1')+':'+server.address().port));}
module.exports={createServer};
