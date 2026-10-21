(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
const {TS,GW,GH,WP,ST,ET}=NSR.Defs||(typeof require==='function'&&require('../core/definitions.js'));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(first,second)=>Math.hypot(first.x-second.x,first.z-second.z);
const plain=value=>!!value&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
function arena(baseMap){
 baseMap.M=Array(GW*GH).fill(1);baseMap.D=Array(GW*GH).fill(0);
 for(let row=20;row<=38;row++)for(let column=16;column<=42;column++)baseMap.M[row*GW+column]=0;
 baseMap.R=Array.from({length:16},()=>({x0:28,z0:29,x1:28,z1:29,cx:28,cz:29,sh:false,core:false}));
 baseMap.R[0]={x0:17,z0:26,x1:23,z1:32,cx:20,cz:29,sh:true,core:false};
 baseMap.R[5]={x0:33,z0:26,x1:39,z1:32,cx:36,cz:29,sh:false,core:true};
 baseMap.SH={x:20*TS,z:29*TS};baseMap.CORE={x:36*TS,z:29*TS};baseMap.DEP=[baseMap.SH];baseMap.DEPT=[29*GW+20];
 baseMap.POOLR=null;baseMap.ISL=null;baseMap.TERM=null;baseMap.ZIP=[];baseMap.DOORT=[];baseMap.CO=[];baseMap.total=1;baseMap.rem=0;
 return baseMap;
}
function sustained(player,index){
 const weapon=WP[index],levels=player.wl?.[index]||player.L||{},attachments=player.att?.[index]||{};
 const level=(key,max)=>clamp(Number.isFinite(levels[key])?levels[key]:0,0,max);
 const magazine=Math.ceil(weapon.mag*(1+.12*level('multi',8))),rate=weapon.r*(1+.06*level('fr',30));
 return weapon.d*(1+.1*level('dmg',40))*(weapon.pel||1)*(weapon.big||1)*(attachments.s?.94:1)*(attachments.b?1.12:1)*magazine/(magazine/rate+weapon.rl);
}
function create(sector,players=[],kind='sovereign'){
 if(typeof players==='string'){kind=players;players=[];}
 if(kind==='sweeper'){const mh=360+24*(clamp(Number.isFinite(sector)?Math.floor(sector):1,1,100)-1);return {kind:'sweeper',x:72,z:58,hp:mh,mh,phase:1,state:'shielded',timer:0,attack:3,wave:0,warning:null};}
 const active=players.filter(player=>player&&player.connected!==false),baseline=sustained({},0);
 const power=clamp(active.reduce((sum,player)=>sum+Math.max(...WP.map((weapon,index)=>index===0||player.L?.['w'+index]>0?sustained(player,index)/baseline:0)),0)||1,1,256);
 const mh=(360+20*clamp(Number.isFinite(sector)?Math.floor(sector):1,1,100))*Math.pow(power,.9);
 return {kind:'sovereign',x:72,z:58,hp:mh,mh,phase:1,state:'shielded',timer:0,attack:1,wave:0,warning:null,spawnWarning:null,power,pressure:clamp(1+.1*Math.log2(power),1,1.5),summonedPhase:0,balanceVersion:1,targetCursor:0};
}
const liveEnemies=world=>(world.E||[]).some(enemy=>enemy&&enemy.hp>0&&!enemy.gone);
function summons(world,players){
 const boss=world.boss,spots=[];
 for(let row=21;row<=37;row++)for(let column=17;column<=41;column++){
  const point={x:(column+.5)*TS,z:(row+.5)*TS};
  if((row===21||row===37||column===17||column===41)&&world.M[row*GW+column]===0&&distance(point,boss)>=6)spots.push(point);
 }
 const distant=spots.filter(point=>players.every(player=>distance(point,player.pose)>=8)),available=distant.length?distant:spots;
 const count=Math.min(10,2+boss.phase+Math.floor(Math.log2(boss.power)/2)),units=[];
 for(let index=0;index<Math.min(count,available.length);index++){
  const point=available[(boss.phase*11+Math.floor(index*available.length/count))%available.length];
  units.push({t:index===2||boss.phase===3&&index>=4&&index%2===0?4:boss.phase>=2&&index===0?2:boss.phase>=2&&index===1?3:index%2,x:point.x,z:point.z,hpScale:Math.min(12,Math.sqrt(boss.power))});
 }
 return {type:'summon',units};
}
function choose(sector,roll,players=[]){return create(sector,players,roll<.35?'sweeper':'sovereign');}
function name(boss){return boss?.kind==='sweeper'?'THE MELTDOWN SWEEPER':'THE DUST SOVEREIGN';}
function seedDust(world){
 const boss=world.boss,shelter=world.SH||{x:40,z:58},candidates=[];
 for(let row=21;row<=37;row++)for(let column=17;column<=41;column++){
  const tile=row*GW+column,point={x:(column+.5)*TS,z:(row+.5)*TS};
  if(world.M[tile]===0&&distance(point,shelter)>=8&&distance(point,boss)>=5)candidates.push(tile);
 }
 const count=(boss.kind==='sweeper'?[16,22,28]:[12,18,24])[boss.phase-1],offset=((world.sector||1)*17+boss.phase*31)%Math.max(1,candidates.length),changed=new Set();
 for(let tile=0;tile<world.D.length;tile++)if(world.D[tile]!==0){world.D[tile]=0;changed.add(tile);}
 for(let index=0;index<Math.min(count,candidates.length);index++){
  const tile=candidates[(offset+Math.floor(index*candidates.length/count))%candidates.length];world.D[tile]=.3;changed.add(tile);
 }
 world.rem=world.D.reduce((sum,value)=>sum+value,0);world.total=Math.max(world.total||1,world.rem);
 if(!Array.isArray(world.dirty))world.dirty=[];
 world.dirty.push(...changed);
}
function shield(world){
 const boss=world.boss;boss.state='shielded';boss.timer=0;boss.attack=boss.kind==='sweeper'?3:1/(boss.pressure||1);boss.warning=null;boss.ring=null;boss.nozzle=null;boss.sweep=null;boss.burst=0;seedDust(world);
}
function damage(world,amount){
 const boss=world.boss;
 if(!boss||boss.state!=='exposed'||boss.kind!=='sweeper'&&(boss.spawnWarning||boss.summonedPhase!==boss.phase||liveEnemies(world))||!Number.isFinite(amount)||amount<=0)return 0;
 const floor=boss.phase<3?boss.mh*(3-boss.phase)/3:0,actual=Math.min(amount,Math.max(0,boss.hp-floor));boss.hp-=actual;
 if(boss.hp<=floor){
  if(boss.phase<3){boss.phase++;shield(world);}
  else{boss.hp=0;boss.state='dead';boss.warning=null;boss.ring=null;boss.nozzle=null;boss.sweep=null;}
 }
 return actual;
}
function isClean(world){world.rem=world.D.reduce((total,value)=>total+value,0);return world.rem===0;}
function leak(world,point){
 const column=Math.floor(point.x/TS),row=Math.floor(point.z/TS),shelter=world.SH||{x:40,z:58};
 for(const [across,along] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
  const tile=(row+along)*GW+column+across,position={x:(column+across+.5)*TS,z:(row+along+.5)*TS};
  if(world.M[tile]!==0||distance(position,shelter)<8||distance(position,world.boss)<5)continue;
  world.D[tile]=Math.max(world.D[tile],.2);if(!Array.isArray(world.dirty))world.dirty=[];world.dirty.push(tile);
 }
 world.rem=world.D.reduce((sum,value)=>sum+value,0);world.total=Math.max(world.total||1,world.rem);
}
function stepSweeper(world,players,dt){
 const boss=world.boss,effects=[],shelter=world.SH||{x:40,z:58};
 const targets=players.filter(player=>player&&player.pose&&Number.isFinite(player.pose.x)&&Number.isFinite(player.pose.z)&&player.connected!==false&&!(player.hp<=0));
 const safe=player=>distance(player.pose,shelter)<=7;
 let remaining=dt;
 do{
  const elapsed=Math.min(remaining,.025);remaining=Math.max(0,remaining-elapsed);
  if(boss.state==='exposed'){
   boss.timer=Math.max(0,boss.timer-elapsed);
   if(boss.timer<=1e-9){boss.state='shielded';boss.attack=.9;boss.timer=0;}
   continue;
  }
  boss.hp=Math.min(boss.mh*(4-boss.phase)/3,boss.hp+boss.mh*.005*elapsed);
  if(boss.sweep){
   const sweep=boss.sweep,previous=sweep.radius;sweep.radius+=(12+boss.phase)*elapsed;
   for(const player of targets){const range=distance(player.pose,boss),sliding=player.pose.sl&&player.pose.g&&player.pose.h<=.2;
    if(!safe(player)&&!sliding&&!sweep.hit.includes(player.id)&&range>=previous-.6&&range<=sweep.radius+.6){sweep.hit.push(player.id);effects.push({type:'hurt',playerId:player.id,damage:27+boss.phase*2});}
   }
   if(sweep.radius>=60)boss.sweep=null;
  }
  if(boss.ring){
   const ring=boss.ring,previous=ring.radius;ring.radius+=(11+boss.phase)*elapsed;
   for(const player of targets){const range=distance(player.pose,boss);
    if(!safe(player)&&!(player.pose.h>.8)&&!ring.hit.includes(player.id)&&range>=previous-.6&&range<=ring.radius+.6){ring.hit.push(player.id);effects.push({type:'hurt',playerId:player.id,damage:23+boss.phase*2});}
   }
   if(ring.radius>=60)boss.ring=null;
  }
  if(boss.nozzle){
   const nozzle=boss.nozzle,previous=nozzle.travel;nozzle.travel=Math.min(nozzle.length,nozzle.travel+(22+boss.phase*3)*elapsed);
   nozzle.x=boss.x+nozzle.dx*nozzle.travel;nozzle.z=boss.z+nozzle.dz*nozzle.travel;
   for(const player of targets){
    const offset={x:player.pose.x-boss.x,z:player.pose.z-boss.z},along=offset.x*nozzle.dx+offset.z*nozzle.dz,across=Math.abs(offset.x*nozzle.dz-offset.z*nozzle.dx);
    if(!safe(player)&&!(player.pose.h>1.4)&&!nozzle.hit.includes(player.id)&&along>=previous-1&&along<=nozzle.travel+1&&across<=3.6){nozzle.hit.push(player.id);effects.push({type:'hurt',playerId:player.id,damage:31+boss.phase*3});}
   }
   if(nozzle.travel>=nozzle.length){
    if(nozzle.hit.length===0&&targets.some(player=>!safe(player))&&isClean(world)){boss.state='exposed';boss.timer=5-boss.phase*.5;boss.ring=null;boss.sweep=null;}
    boss.nozzle=null;boss.attack=1.15;
   }
   continue;
  }
  if(boss.warning){
   boss.warning.left-=elapsed;
   if(boss.warning.left<=1e-9){
    const warning=boss.warning;boss.warning=null;
    if(warning.kind==='nozzle'){
     const length=Math.hypot(warning.x-boss.x,warning.z-boss.z),dx=length>.01?(warning.x-boss.x)/length:-1,dz=length>.01?(warning.z-boss.z)/length:0;
     const wallX=dx>0?(85-boss.x)/dx:dx<0?(33-boss.x)/dx:44,wallZ=dz>0?(77-boss.z)/dz:dz<0?(41-boss.z)/dz:44;
     boss.nozzle={x:boss.x,z:boss.z,dx,dz,travel:0,length:Math.min(44,length+4,wallX,wallZ),hit:[]};
    }else if(warning.kind==='salvo'){
     for(const player of targets)if(!safe(player)&&distance(player.pose,warning)<=warning.radius)effects.push({type:'hurt',playerId:player.id,damage:25+boss.phase*2});
     leak(world,warning);boss.attack=.65;
    }else if(warning.kind==='sweep'){boss.sweep={radius:0,hit:[]};boss.attack=.8;}
    else{boss.ring={radius:0,hit:[]};boss.attack=.8;}
   }
   continue;
  }
  boss.attack=Math.max(0,boss.attack-elapsed);
  if(boss.attack<=1e-9){
   const active=targets.filter(player=>!safe(player)&&distance(player.pose,shelter)>=10);
   if(!active.length){boss.attack=.25;continue;}
   const target=active[Math.floor(boss.wave/2)%active.length],kind=boss.phase>=2&&boss.wave%8===5?'sweep':boss.wave%2===0?'nozzle':boss.wave%4===1?'salvo':'ring';boss.wave++;
   boss.warning={kind,x:kind==='ring'||kind==='sweep'?boss.x:target.pose.x,z:kind==='ring'||kind==='sweep'?boss.z:target.pose.z,left:kind==='nozzle'?1.25-boss.phase*.1:kind==='sweep'?1.4:1.1,radius:kind==='salvo'?3.4:kind==='nozzle'?3.6:3};
  }
 }while(remaining>0);
 return effects;
}
function step(world,players,dt){
 const boss=world.boss,effects=[];
 if(!boss)return effects;
 if(boss.state==='dead'){if(!boss.victory){boss.victory=true;effects.push({type:'victory'});}return effects;}
 if(!Number.isFinite(dt)||dt<0)return effects;
 if(boss.kind==='sweeper')return stepSweeper(world,players,dt);
 if(boss.balanceVersion!==1){
  const tuned=create(world.sector,players),ratio=boss.hp/boss.mh;
  boss.mh=tuned.mh;boss.hp=tuned.mh*ratio;boss.power=tuned.power;boss.pressure=tuned.pressure;boss.balanceVersion=1;boss.summonedPhase=0;boss.targetCursor=0;boss.attack=Math.min(boss.attack,tuned.attack);
 }
 const targets=players.filter(player=>player&&player.pose&&Number.isFinite(player.pose.x)&&Number.isFinite(player.pose.z)&&player.connected!==false&&!(player.hp<=0));
 const pending=boss.summonedPhase!==boss.phase;
 if(pending){boss.state='shielded';boss.timer=0;boss.summonedPhase=boss.phase;boss.spawnWarning={left:1.5,units:summons(world,targets).units};}
 const hitDamage=player=>[22,26,30][boss.phase-1]*(ST({suit:0,...player.L}).hp/100);
 let remaining=dt,spawned=false;
 do{
  const elapsed=Math.min(remaining,.05);remaining=Math.max(0,remaining-elapsed);
  if(boss.spawnWarning){boss.spawnWarning.left=Math.max(0,boss.spawnWarning.left-elapsed);if(boss.spawnWarning.left<=1e-9){effects.push({type:'summon',units:boss.spawnWarning.units});boss.spawnWarning=null;spawned=true;}}
  if(boss.state==='shielded'&&isClean(world)&&!pending&&!boss.spawnWarning&&!spawned&&!liveEnemies(world)){boss.state='exposed';boss.timer=11-boss.phase;}
  if(boss.state==='exposed'){
   boss.timer=Math.max(0,boss.timer-elapsed);
   if(boss.timer<=1e-9)shield(world);
  }else boss.hp=Math.min(boss.mh*(4-boss.phase)/3,boss.hp+boss.mh*.015*elapsed);
  if(boss.ring){
   const ring=boss.ring,previous=ring.radius;ring.radius+=14*boss.pressure*elapsed;
   for(const player of targets){const range=distance(player.pose,boss);
    if(!(player.pose.h>.8)&&!ring.hit.includes(player.id)&&range>=previous-.6&&range<=ring.radius+.6){ring.hit.push(player.id);effects.push({type:'hurt',playerId:player.id,damage:hitDamage(player),source:{x:boss.x,z:boss.z}});}
   }
   if(ring.radius>=60)boss.ring=null;
  }
  boss.attack=Math.max(0,boss.attack-elapsed);
  if(boss.warning){
   boss.warning.left-=elapsed;
   if(boss.warning.left<=1e-9){
    for(const player of targets)if(distance(player.pose,boss.warning)<=boss.warning.radius)effects.push({type:'hurt',playerId:player.id,damage:hitDamage(player),source:{x:boss.x,z:boss.z}});
    boss.warning=null;
   }
  }else{
   if(boss.attack<=1e-9){
    const target=targets.length?targets[boss.targetCursor%targets.length]:null;
    if(target){
     boss.targetCursor=(boss.targetCursor+1)%1000000;
     boss.warning={x:target.pose.x,z:target.pose.z,left:[1,.85,.7][boss.phase-1]/Math.sqrt(boss.pressure),radius:3};boss.wave++;
     boss.attack=[1.4,.9,.65][boss.phase-1]/boss.pressure;
     if(boss.phase===3&&!boss.ring)boss.ring={radius:0,hit:[]};
    }else boss.attack=.25;
   }
  }
 }while(remaining>0);
 return effects;
}
function restore(raw,sector){
 if(!plain(raw)||!['shielded','exposed','dead'].includes(raw.state))return null;
 for(const key of ['x','z','hp','mh','phase','timer','attack','wave'])if(!Number.isFinite(raw[key]))return null;
 if(raw.mh<=0||!Number.isInteger(raw.phase)||raw.phase<1||raw.phase>3)return null;
 if(raw.kind!==undefined&&!['sovereign','sweeper'].includes(raw.kind))return null;
 const boss=create(sector,[],raw.kind);boss.mh=clamp(raw.mh,1,1000000);boss.phase=raw.phase;boss.state=raw.state;
 if(boss.kind!=='sweeper'){
 for(const [key,min,max,integer] of [['power',1,256,false],['pressure',1,1.5,false],['summonedPhase',0,3,true],['balanceVersion',0,1,true],['targetCursor',0,999999,true]]){
  if(raw[key]!==undefined){if(!Number.isFinite(raw[key])||raw[key]<min||raw[key]>max||(integer&&!Number.isInteger(raw[key])))return null;boss[key]=raw[key];}
 }
 if(raw.balanceVersion===undefined)boss.balanceVersion=0;
 if(boss.summonedPhase>boss.phase)return null;
 if(raw.spawnWarning!==undefined&&raw.spawnWarning!==null){
  const warning=raw.spawnWarning;
  if(raw.state!=='shielded'||boss.summonedPhase!==boss.phase||!plain(warning)||!Number.isFinite(warning.left)||warning.left<0||warning.left>1.5||!Array.isArray(warning.units)||warning.units.length<1||warning.units.length>10)return null;
  if(!warning.units.every(unit=>plain(unit)&&Number.isInteger(unit.t)&&!!ET[unit.t]&&Number.isFinite(unit.x)&&unit.x>=35&&unit.x<=83&&Number.isFinite(unit.z)&&unit.z>=43&&unit.z<=75&&Number.isFinite(unit.hpScale)&&unit.hpScale>=1&&unit.hpScale<=12))return null;
  boss.spawnWarning={left:warning.left,units:warning.units.map(unit=>({t:unit.t,x:unit.x,z:unit.z,hpScale:unit.hpScale}))};
 }
 }
 boss.hp=clamp(raw.hp,0,boss.mh*(4-boss.phase)/3);boss.timer=clamp(raw.timer,0,11-boss.phase);boss.attack=clamp(raw.attack,0,10);boss.wave=clamp(Math.floor(raw.wave),0,1000000);
 if(raw.state==='dead'){if(raw.hp!==0||raw.phase!==3)return null;boss.hp=0;}
 else if(boss.hp<=boss.mh*(3-boss.phase)/3)return null;
 if(raw.warning!==null){
  if(!plain(raw.warning)||!['x','z','left','radius'].every(key=>Number.isFinite(raw.warning[key])))return null;
  if(boss.kind==='sweeper'&&(!['nozzle','salvo','ring','sweep'].includes(raw.warning.kind)||raw.warning.kind==='sweep'&&boss.phase<2))return null;
  boss.warning={x:clamp(raw.warning.x,16*TS,43*TS),z:clamp(raw.warning.z,20*TS,39*TS),left:clamp(raw.warning.left,0,1.4),radius:boss.kind==='sweeper'?(raw.warning.kind==='salvo'?3.4:raw.warning.kind==='nozzle'?3.6:3):3};
  if(boss.kind==='sweeper')boss.warning.kind=raw.warning.kind;
  if(boss.kind==='sweeper'&&distance(boss.warning,{x:40,z:58})<10)return null;
 }
 if(raw.burst!==undefined){if(!Number.isInteger(raw.burst)||raw.burst<0||raw.burst>1)return null;boss.burst=raw.burst;}
 if(raw.victory!==undefined){if(typeof raw.victory!=='boolean')return null;boss.victory=raw.victory;}
 if(raw.ring!==undefined&&raw.ring!==null){
  if(!plain(raw.ring)||!Number.isFinite(raw.ring.radius)||!Array.isArray(raw.ring.hit)||raw.ring.hit.length>32||!raw.ring.hit.every(id=>typeof id==='string'&&id.length<=80))return null;
  boss.ring={radius:clamp(raw.ring.radius,0,60),hit:[...new Set(raw.ring.hit)]};
 }else if(raw.ring===null)boss.ring=null;
 if(raw.sweep!=null){
  if(boss.kind!=='sweeper'||boss.phase<2||!plain(raw.sweep)||!Number.isFinite(raw.sweep.radius)||raw.sweep.radius<0||raw.sweep.radius>60||!Array.isArray(raw.sweep.hit)||raw.sweep.hit.length>32||!raw.sweep.hit.every(id=>typeof id==='string'&&id.length<=80))return null;
  boss.sweep={radius:raw.sweep.radius,hit:[...new Set(raw.sweep.hit)]};
 }else if(raw.sweep===null)boss.sweep=null;
 if(raw.nozzle!=null){
  const nozzle=raw.nozzle;
  if(boss.kind!=='sweeper'||!plain(nozzle)||!['x','z','dx','dz','travel','length'].every(key=>Number.isFinite(nozzle[key]))||nozzle.length<=0||nozzle.length>44||nozzle.travel<0||nozzle.travel>nozzle.length||Math.abs(Math.hypot(nozzle.dx,nozzle.dz)-1)>.001||!Array.isArray(nozzle.hit)||nozzle.hit.length>32||!nozzle.hit.every(id=>typeof id==='string'&&id.length<=80))return null;
  if(distance(nozzle,{x:boss.x+nozzle.dx*nozzle.travel,z:boss.z+nozzle.dz*nozzle.travel})>.01)return null;
  boss.nozzle={x:nozzle.x,z:nozzle.z,dx:nozzle.dx,dz:nozzle.dz,travel:nozzle.travel,length:nozzle.length,hit:[...new Set(nozzle.hit)]};
  if(boss.warning)return null;
 }else if(raw.nozzle===null)boss.nozzle=null;
 if(boss.state==='dead'||boss.kind==='sweeper'&&boss.state!=='shielded'){boss.warning=null;boss.ring=null;boss.nozzle=null;if(boss.sweep)boss.sweep=null;}
 if(boss.state!=='dead'&&boss.victory)return null;
 return boss;
}
NSR.Boss={arena,create,choose,name,seedDust,isClean,step,damage,restore};
if(typeof module!=='undefined')module.exports=NSR.Boss;
})(typeof globalThis!=='undefined'?globalThis:window);
