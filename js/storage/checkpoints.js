(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
function create({key,validate,storage=root.localStorage}){
 const backupKey=key+'_backup',rejectedKey=key+'_rejected';
 function parse(text){const value=validate(JSON.parse(text));if(!value)throw new Error('This checkpoint is invalid or unsupported.');return value;}
 function read(slot){const text=storage.getItem(slot);return text===null?null:parse(text);}
 function preserve(){const text=storage.getItem(key);if(text!==null)storage.setItem(rejectedKey,text);}
 return {
  load:()=>read(key),backup:()=>read(backupKey),original:()=>storage.getItem(key),
  write(value){const text=JSON.stringify(value);parse(text);const previous=storage.getItem(key);if(previous!==null){parse(previous);storage.setItem(backupKey,previous);}storage.setItem(key,text);},
  restoreBackup(){const text=storage.getItem(backupKey);if(text===null)throw new Error('No previous checkpoint is available.');parse(text);preserve();storage.setItem(key,text);},
  reset(){preserve();storage.removeItem(key);storage.removeItem(backupKey);}
 };
}
NSR.Checkpoints={create};
if(typeof module!=='undefined')module.exports=NSR.Checkpoints;
})(globalThis);
