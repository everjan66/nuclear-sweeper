(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
const VERSION=1,MAX_MESSAGE=256*1024,MAX_SNAPSHOT=2*1024*1024;
const held=['fw','bk','lf','rt','crouch','grapple','fire','ads','reload','menu'];
const edges=['jump','grapplePressed','dash','use'];
function input(raw){
 if(!raw||!Number.isSafeInteger(raw.seq)||raw.seq<1||!Number.isFinite(raw.yaw)||!Number.isFinite(raw.pit)||Math.abs(raw.yaw)>1e9||Math.abs(raw.pit)>1.45)return null;
 const clean={seq:raw.seq,yaw:raw.yaw,pit:raw.pit};
 for(const key of [...held,...edges])clean[key]=raw[key]===true;
 if(Number.isInteger(raw.weapon)&&raw.weapon>=0&&raw.weapon<7)clean.weapon=raw.weapon;
 return clean;
}
function neutral(previous={}){return {seq:previous.seq||0,yaw:previous.yaw||0,pit:previous.pit||0,menu:true};}
function consume(value){const next={...value};for(const key of edges)next[key]=false;return next;}
function invitation(value){
 if(!value||typeof value.room!=='string'||!/^[-\w]{16,80}$/.test(value.room)||typeof value.token!=='string'||!/^[-\w]{24,100}$/.test(value.token))throw new Error('Invalid invitation.');
 const url=new URL(value.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid signaling URL.');
 if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Online signaling requires HTTPS.');
 return {url:url.origin,room:value.room,token:value.token,dev:!!value.dev,version:VERSION};
}
function encodeInvitation(value){return btoa(JSON.stringify(invitation(value)));}
function decodeInvitation(value){
 try{const fragment=value.includes('#')?value.split('#')[1]:value;const encoded=new URLSearchParams(fragment).get('coop')||fragment;return invitation(JSON.parse(atob(encoded)));}catch(error){throw new Error('This invitation is invalid or incomplete.');}
}
NSR.Protocol={VERSION,MAX_MESSAGE,MAX_SNAPSHOT,held,edges,input,neutral,consume,invitation,encodeInvitation,decodeInvitation};
if(typeof module!=='undefined')module.exports=NSR.Protocol;
})(globalThis);
