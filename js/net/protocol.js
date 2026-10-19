(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
const VERSION=3,MAX_MESSAGE=256*1024,MAX_SNAPSHOT=2*1024*1024;
const held=['fw','bk','lf','rt','crouch','grapple','fire','ads','reload','menu'];
const edges=['jump','grapplePressed','dash','use'];
const flags=[...held,...edges];
function input(raw){
 if(Array.isArray(raw)){
  if(raw.length!==5||!Number.isInteger(raw[3])||raw[3]<0||raw[3]>=1<<flags.length||!Number.isInteger(raw[4])||raw[4]<-1||raw[4]>6)return null;
  const unpacked={seq:raw[0],yaw:raw[1],pit:raw[2],weapon:raw[4]};for(let index=0;index<flags.length;index++)unpacked[flags[index]]=!!(raw[3]&(1<<index));raw=unpacked;
 }
 if(!raw||!Number.isSafeInteger(raw.seq)||raw.seq<1||!Number.isFinite(raw.yaw)||!Number.isFinite(raw.pit)||Math.abs(raw.yaw)>1e9||Math.abs(raw.pit)>1.45)return null;
 const clean={seq:raw.seq,yaw:raw.yaw,pit:raw.pit};
 for(const key of flags)clean[key]=raw[key]===true;
 if(Number.isInteger(raw.weapon)&&raw.weapon>=0&&raw.weapon<7)clean.weapon=raw.weapon;
 return clean;
}
function packInput(value){let bits=0;for(let index=0;index<flags.length;index++)if(value[flags[index]])bits|=1<<index;return [value.seq,value.yaw,value.pit,bits,value.weapon??-1];}
function neutral(previous={}){return {seq:previous.seq||0,yaw:previous.yaw||0,pit:previous.pit||0,menu:true};}
function consume(value){const next={...value};for(const key of edges)next[key]=false;return next;}
function invitation(value){
 if(value?.version!==undefined&&value.version!==VERSION)throw new Error('This invitation uses a different game version. Reload both clients and ask the host for a new link.');
 if(!value||typeof value.room!=='string'||!/^[-\w]{16,80}$/.test(value.room)||typeof value.token!=='string'||!/^[-\w]{24,100}$/.test(value.token))throw new Error('Invalid invitation.');
 const url=new URL(value.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid signaling URL.');
 if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Online signaling requires HTTPS.');
 return {url:url.origin,room:value.room,token:value.token,dev:!!value.dev,version:VERSION};
}
function encodeInvitation(value){return btoa(JSON.stringify(invitation(value)));}
function decodeInvitation(value){
 try{const fragment=value.includes('#')?value.split('#')[1]:value;const encoded=new URLSearchParams(fragment).get('coop')||fragment;return invitation(JSON.parse(atob(encoded)));}catch(error){throw new Error('This invitation is invalid or incomplete.');}
}
NSR.Protocol={VERSION,MAX_MESSAGE,MAX_SNAPSHOT,held,edges,input,packInput,neutral,consume,invitation,encodeInvitation,decodeInvitation};
if(typeof module!=='undefined')module.exports=NSR.Protocol;
})(globalThis);
