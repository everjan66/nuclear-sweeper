(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={}),LIMIT=256,ORDINARY_LIMIT=249;
// Reserve seven slots for the five vault and two island rewards. Marked rewards
// never merge: their collection bits must remain independent.
function add(list,drop){
 if(drop.m){list.push(drop);return;}
 let closest=null,distance=Infinity,ordinary=0;
 for(const other of list){if(other.m)continue;ordinary++;if((other.k||'scrap')!==(drop.k||'scrap'))continue;const d=(other.x-drop.x)**2+(other.z-drop.z)**2;if(d<distance){distance=d;closest=other;}}
 if(closest&&(distance<=4||ordinary>=ORDINARY_LIMIT)){closest.a=(closest.a??1)+(drop.a??1);return;}
 if(ordinary>=ORDINARY_LIMIT)throw new Error('Too many incompatible loot stacks.');
 list.push(drop);
}
function compact(list){const result=[];for(const drop of list)add(result,drop);if(result.length>LIMIT)throw new Error('Too many marked rewards.');return result;}
NSR.Loot={LIMIT,add,compact};
if(typeof module!=='undefined')module.exports=NSR.Loot;
})(globalThis);
