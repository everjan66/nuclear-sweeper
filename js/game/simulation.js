(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
const Defs=NSR.Defs||(typeof require==='function'&&require('../core/definitions.js'));
const Maps=NSR.Map||(typeof require==='function'&&require('../core/map.js'));
const Movement=NSR.Movement||(typeof require==='function'&&require('../core/movement.js'));
const bossApi=()=>NSR.Boss||(typeof require==='function'&&require('./boss.js'));
const {TS,GW,GH,MOVE,ST,WP,ET,U,ATT,MOD,WCLASS,UNLOCK,cl,cost,mkL}=Defs;
const caches=new WeakMap();
const clone=value=>JSON.parse(JSON.stringify(value));
const distance=(first,second)=>Math.hypot(first.x-second.x,first.z-second.z);
const inShelter=(world,player,radius=9)=>distance(player.pose,world.SH)<radius&&player.pose.h<1.2;
const finite=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
function random(world){world.rngState=(Math.imul(world.rngState,1664525)+1013904223)>>>0;return world.rngState/4294967296;}
function event(world,type,data={}){if(world.events.length<256)world.events.push({type,...data});}
function nextId(world,prefix){return prefix+(++world.entitySeq);}
function createWorld({sector=1,dev=false}={}){
 if(!Number.isInteger(sector)||sector<1||sector>100)throw new Error('Invalid site.');
 const world={...Maps.generate(sector),version:1,dev:!!dev,generation:1,time:0,tick:0,rngState:sector*977+11,entitySeq:0,hostId:null,
  team:{cred:0,scrap:0,parts:0,raw:0,ref:0,yld:0},players:{},E:[],Dr:[],EP:[],events:[],dirty:[],story:0,clr:0,vOpen:0,vTaken:0,iTaken:0,boss:null,bossDead:0,bty:null,spawnT:3.5};
 for(let index=0;index<Math.min(6+3*sector,28);index++)spawn(world,false);
 if(world.ISL)for(let index=0;index<2;index++)world.Dr.push({id:nextId(world,'l'),x:world.ISL.x+(index?.8:-.8),z:world.ISL.z,y:.4,vx:0,vz:0,k:'part',a:1,m:'i',bit:1<<index});
 return world;
}
function addPlayer(world,{id,name='Sweeper'}){
 if(typeof id!=='string'||!/^[-\w]{1,80}$/.test(id)||['__proto__','constructor','prototype'].includes(id)||Object.hasOwn(world.players,id))throw new Error('Invalid or duplicate player.');
 if(Object.keys(world.players).length>=32)throw new Error('World character limit reached.');
 const player={id,name:String(name).trim().slice(0,24)||'Sweeper',pose:Movement.createPose(world.SH),move:{},L:mkL(),
  wl:WP.map(()=>({dmg:0,fr:0,multi:0})),att:WP.map(()=>({s:0,b:0,l:0})),unl:{s:0,b:0,l:0},mod:{gr:0,dash:0},
  prog:{dust:0,enemies:ET.map(()=>0),weapons:WP.map(()=>({kills:0,types:ET.map(()=>0)})),ach:[]},
  score:{total:0,run:0,best:0,chain:0,board:[]},streak:{kills:0,heads:0,points:0,bonus:0,left:0},hp:100,tank:0,kills:0,
  wi:0,ammo:WP.map(weapon=>weapon.mag),reserves:WP.map(()=>3),wcd:0,rel:0,relMax:1,ready:false,connected:true,
  lastSeq:0,lastActionId:0,actionResults:[],fireHeld:false,bladeCd:0,canDock:false,exposure:0,present:false,disconnectedRescued:false};
 world.players[id]=player;if(!world.hostId)world.hostId=id;return player;
}
function resupply(player){const stats=ST(player.L);player.hp=stats.hp;player.ammo=WP.map((weapon,index)=>Math.ceil(weapon.mag*(1+.12*player.wl[index].multi)));player.reserves=WP.map(()=>stats.reloads);player.rel=0;}
function dock(world,player){world.team.raw+=player.tank;player.tank=0;resupply(player);player.canDock=false;}
function rescue(world,id){const player=world.players[id];if(!player||(!player.connected&&player.disconnectedRescued))return;if(!player.connected)player.disconnectedRescued=true;finishScore(world,player,'Rescued');player.tank*=.5;player.pose=Movement.createPose(world.SH);player.move={};player.ready=false;dock(world,player);event(world,'rescue',{playerId:id});}
function disconnect(world,id){const player=world.players[id];if(player){player.connected=false;player.present=true;player.disconnectedRescued=false;player.ready=false;player.pose.vx=player.pose.vz=0;}}
function restart(world){world.EP=[];world.events=[];for(const player of Object.values(world.players)){player.pose=Movement.createPose(world.SH);player.move={};player.connected=false;player.present=false;player.disconnectedRescued=false;player.ready=false;player.lastSeq=0;player.fireHeld=false;dock(world,player);}return world;}
function finishScore(world,player,reason){if(player.score.run>0){player.score.board.push({points:player.score.run,site:world.sector,reason});player.score.board.sort((first,second)=>second.points-first.points);player.score.board.length=Math.min(5,player.score.board.length);}player.score.run=0;player.streak={kills:0,heads:0,points:0,bonus:0,left:0};}
function action(world,id,request){
 const player=world.players[id];
 if(!player||!player.connected||!request||!Number.isSafeInteger(request.id)||request.id<=0)return {ok:false,reason:'Invalid action.'};
 const previous=player.actionResults.find(result=>result.id===request.id);if(previous)return previous.result;
 if(request.id<=player.lastActionId)return {ok:false,reason:'Expired action.'};
 player.lastActionId=request.id;
 let result={ok:false,reason:'Return to the shelter first.'};
 if(inShelter(world,player)){
  const upgrade=U.find(entry=>entry[0]===request.upgrade),weapon=Number(request.weapon);
  if(request.type==='dock'){dock(world,player);result={ok:true};}
  else if(request.type==='ready'){player.ready=!!request.value;result={ok:true};}
  else if(request.type==='buy'&&upgrade){
   const personalWeapon=['dmg','fr','multi'].includes(request.upgrade),shared=['ref','yld'].includes(request.upgrade);
   const levels=shared?world.team:personalWeapon?player.wl[weapon]:player.L;
   if(levels&&(!personalWeapon||(Number.isInteger(weapon)&&(weapon===0||player.L['w'+weapon]>0)))){
    const level=levels[request.upgrade],price=cost(upgrade,level),currency=upgrade[2]==='s'?'scrap':'cred';
    result={ok:false,reason:'Maximum level or insufficient team funds.'};
    if(level<upgrade[5]&&world.team[currency]>=price){world.team[currency]-=price;levels[request.upgrade]++;if(['suit','pouch','multi'].includes(request.upgrade))resupply(player);result={ok:true};}
   }
  }else if(request.type==='unlockAttachment'||request.type==='buyModule'){
   const definitions=request.type==='buyModule'?MOD:ATT,owned=request.type==='buyModule'?player.mod:player.unl;
   const definition=Object.hasOwn(definitions,request.key)?definitions[request.key]:null;
   result={ok:false,reason:'Already owned or insufficient team parts.'};
   if(definition&&!owned[request.key]&&world.team.parts>=definition[1]){world.team.parts-=definition[1];owned[request.key]=1;result={ok:true};}
  }else if(request.type==='equipAttachment'&&Object.hasOwn(ATT,request.key)&&player.unl[request.key]&&player.att[weapon]){
   player.att[weapon][request.key]=player.att[weapon][request.key]?0:1;result={ok:true};
  }else if(request.type==='deploy'){
   result={ok:false,reason:'The host can deploy after 97% cleanup when everyone is ready in the shelter.'};
   const connected=Object.values(world.players).filter(member=>member.connected);
   if(id===world.hostId&&world.clr&&(!world.boss||world.bossDead)&&connected.every(member=>member.ready&&inShelter(world,member))){
    const players=world.players,team=world.team,generation=world.generation+1,hostId=world.hostId,entitySeq=world.entitySeq;
    for(const member of Object.values(players)){finishScore(world,member,'Cleared');dock(world,member);}
    Object.assign(world,createWorld({sector:Math.min(100,world.sector+1),dev:world.dev}),{players,team,generation,hostId,entitySeq:entitySeq+1000});
    for(const member of Object.values(players)){member.pose=Movement.createPose(world.SH);member.move={};member.ready=false;}
    caches.delete(world);event(world,'deploy');result={ok:true};
   }
  }
 }
 player.actionResults.push({id:request.id,result});if(player.actionResults.length>128)player.actionResults.shift();
 if(result.ok)event(world,'transaction',{playerId:id,action:request.type});return result;
}
function spawn(world,alert){
 const active=Object.values(world.players).filter(player=>player.connected);
 for(let attempt=0;attempt<30;attempt++){
  const tile=1+(random(world)*(GW*GH-2)|0),x=(tile%GW+.5)*TS,z=((tile/GW|0)+.5)*TS;
  if(world.M[tile]!==0||distance({x,z},world.SH)<10||active.some(player=>distance({x,z},player.pose)<22))continue;
  let type=world.sector>=3&&random(world)<.2?2:world.sector>=2&&random(world)<.4?1:0;if(random(world)<.08)type=3;
  if(Movement.collide(world,x,z,.5*ET[type].sc,0,1.8,1))continue;
  const hp=ET[type].hp*(1+.4*(world.sector-1));world.E.push({id:nextId(world,'e'),t:type,x,z,hp,mh:hp,cd:0,fc:1,al:alert?1:0,ph:random(world)*6,target:null});return true;
 }return false;
}
function recordKill(world,player,enemy,weapon,headshot){
 if(enemy.counted)return;enemy.counted=true;player.kills++;player.prog.enemies[enemy.t]++;player.prog.weapons[weapon].kills++;player.prog.weapons[weapon].types[enemy.t]++;
 if(player.streak.left<=0)player.streak={kills:0,heads:0,points:0,bonus:0,left:0};
 const streak=player.streak;streak.kills++;if(headshot)streak.heads++;const base=100+(headshot?20:0),bonus=Math.round(base*Math.min(.5,Math.floor(streak.kills/5)*.1)),points=base+bonus;
 streak.points+=points;streak.bonus+=bonus;streak.left=5;player.score.run+=points;player.score.total+=points;player.score.best=Math.max(player.score.best,player.score.run);player.score.chain=Math.max(player.score.chain,streak.kills);
 for(let type=1;type<UNLOCK.length;type++){const kills=player.prog.weapons.reduce((total,progress,index)=>total+(WCLASS[index]===type-1?progress.kills:0),0);if(kills>=UNLOCK[type])WP.forEach((_,index)=>{if(WCLASS[index]===type)player.L['w'+index]=1;});}
 const drops=1+(random(world)*2.4|0)+(world.sector>2?1:0)+(enemy.t===2?3:enemy.t===3?1:0);
 for(let index=0;index<drops;index++)world.Dr.push({id:nextId(world,'l'),x:enemy.x,z:enemy.z,y:.4,vx:(random(world)-.5)*6,vz:(random(world)-.5)*6,k:'scrap',a:1});
 event(world,'kill',{playerId:player.id,weapon,headshot,enemyId:enemy.id});
}
function cast(world,origin,direction,max,ignored=new Set()){
 const wall=Movement.ray(world,origin,direction,max);let length=wall.t,enemy=null,headshot=false,boss=false;
 for(const candidate of world.E){if(candidate.hp<=0||ignored.has(candidate.id))continue;
  const scale=ET[candidate.t].sc;
  for(const [height,radius,isHead]of[[.75*scale,.62*scale,false],[1.5*scale,.34*scale,true]]){
   const offset={x:candidate.x-origin.x,y:height-origin.y,z:candidate.z-origin.z};
   const projection=offset.x*direction.x+offset.y*direction.y+offset.z*direction.z;
   const squared=offset.x**2+offset.y**2+offset.z**2,inside=squared<radius**2,perpendicular=squared-projection**2;
   if((inside||projection>0)&&perpendicular<radius**2){const hit=inside?.01:projection-Math.sqrt(radius**2-perpendicular);if(hit>0&&hit<length){length=hit;enemy=candidate;headshot=isHead;}}
  }
 }
 if(world.boss&&!world.bossDead&&world.boss.hp>0){
  const offset={x:world.boss.x-origin.x,y:2.8-origin.y,z:world.boss.z-origin.z},radius=2.7;
  const projection=offset.x*direction.x+offset.y*direction.y+offset.z*direction.z,squared=offset.x**2+offset.y**2+offset.z**2,inside=squared<radius**2,perpendicular=squared-projection**2;
  if((inside||projection>0)&&perpendicular<radius**2){const hit=inside?.01:projection-Math.sqrt(radius**2-perpendicular);if(hit>0&&hit<length){length=hit;enemy=null;headshot=false;boss=true;}}
 }
 return {enemy,headshot,boss,x:origin.x+direction.x*length,y:origin.y+direction.y*length,z:origin.z+direction.z*length};
}
function shoot(world,player,input){
 const weapon=WP[player.wi],attachments=player.att[player.wi],pose=player.pose,levels=player.wl[player.wi];
 const origin={x:pose.x,y:pose.h+(pose.low?.85:1.5),z:pose.z};
 const spread=(input.ads?weapon.sa*(attachments.b?.7:1):weapon.sp*(attachments.b?.85:1)*(attachments.l?.6:1))*(1+Math.hypot(pose.vx,pose.vz)/18)*(pose.g?1:1.8)*Math.PI/180;
 const damage=weapon.d*(1+.1*levels.dmg)*(attachments.s?.94:1)*(attachments.b?1.12:1),traces=[];
 for(let pellet=0;pellet<weapon.pel;pellet++){
  const yaw=pose.yaw+(random(world)-.5)*2*spread,pitch=pose.pit+pose.rp+(random(world)-.5)*2*spread;
  const direction={x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)},ignored=new Set();
  for(let pass=0;pass<(weapon.pen||1);pass++){
   const hit=cast(world,origin,direction,70,ignored);if(traces.length<12)traces.push({x:hit.x,y:hit.y,z:hit.z});
   if(hit.boss){if(bossApi().damage(world,damage*(weapon.big||1)*Math.pow(weapon.fall||1,pass))>0)event(world,'hit',{playerId:player.id,headshot:false,boss:true});break;}
   if(!hit.enemy)break;
   const enemy=hit.enemy;let power=damage*(ET[enemy.t].sc>1.2?(weapon.big||1):1);if(hit.headshot)power=enemy.t===2?power*4:Math.max(power*4,enemy.mh*1.01);
   enemy.hp-=power*Math.pow(weapon.fall||1,pass);enemy.al=1;ignored.add(enemy.id);
   if(enemy.hp<=0)recordKill(world,player,enemy,player.wi,hit.headshot);
   event(world,'hit',{playerId:player.id,headshot:hit.headshot});
  }
 }
 for(const enemy of world.E)if(distance(enemy,pose)<(attachments.s?9:34))enemy.al=1;
 if(!world.dev||!world.assists?.infiniteAmmo)player.ammo[player.wi]--;
 player.wcd+=1/(weapon.r*(1+.06*levels.fr));pose.rp=Math.min(.3,pose.rp+weapon.rc*(input.ads?.5:1)*(attachments.b?1.15:1));
 event(world,'shot',{playerId:player.id,weapon:player.wi,origin,traces});
}
function openVault(world){
 if(world.vOpen)return;world.vOpen=1;for(const tile of world.DOORT)world.M[tile]=0;caches.delete(world);
 const room=world.R[12],x=(room.cx+.5)*TS,z=(room.cz+.5)*TS;
 [['part',2],['part',2],['cred',250],['cred',250],['scrap',6]].forEach(([kind,amount],index)=>world.Dr.push({id:nextId(world,'l'),x:x+(random(world)-.5)*4,z:z+(random(world)-.5)*4,y:.4,vx:0,vz:0,k:kind,a:amount,m:'v',bit:1<<index}));event(world,'vault');
}
function updatePlayer(world,player,input,dt){
 Movement.step(world,player,input,dt);
 const pose=player.pose,stats=ST(player.L),sheltered=inShelter(world,player,7);
 if(!inShelter(world,player))player.ready=false;
 if(Number.isInteger(input.weapon)&&input.weapon>=0&&input.weapon<WP.length&&input.weapon!==player.wi&&(input.weapon===0||player.L['w'+input.weapon]>0)){player.wi=input.weapon;player.rel=0;player.wcd=.25;}
 const weapon=WP[player.wi],magazine=Math.ceil(weapon.mag*(1+.12*player.wl[player.wi].multi));
 player.wcd=Math.max(0,player.wcd-dt);pose.rp*=Math.exp(-(input.fire?1.5:7)*dt);player.streak.left=Math.max(0,player.streak.left-dt);
 if(player.rel>0){player.rel-=dt;if(player.rel<=0&&player.reserves[player.wi]>0){player.reserves[player.wi]--;player.ammo[player.wi]=magazine;}}
 else if(!input.menu){
  if((input.reload||player.ammo[player.wi]<=0)&&player.ammo[player.wi]<magazine&&player.reserves[player.wi]>0)player.rel=player.relMax=weapon.rl/(1+.06*player.wl[player.wi].fr);
  else if(input.fire&&player.wcd<=0&&player.ammo[player.wi]>0&&(weapon.auto||!player.fireHeld))shoot(world,player,input);
 }
 player.fireHeld=!!input.fire&&!input.menu;
 if(pose.st!==2&&pose.st!==5){
  const radius=stats.rad,radiusTiles=radius/TS+.5,centerX=pose.x/TS,centerZ=pose.z/TS;
  for(let row=Math.max(0,Math.floor(centerZ-radiusTiles));row<=Math.min(GH-1,Math.floor(centerZ+radiusTiles));row++)for(let column=Math.max(0,Math.floor(centerX-radiusTiles));column<=Math.min(GW-1,Math.floor(centerX+radiusTiles));column++){
   const tile=row*GW+column,value=world.D[tile];if(value<=0||Math.abs(pose.h-(world.M[tile]===6?3.2:0))>.7)continue;
   const separation=Math.hypot((column+.5)*TS-pose.x,(row+.5)*TS-pose.z),capacity=(stats.cap-player.tank)/10;if(separation>radius||capacity<=0)continue;
   let removed=Math.min(value,stats.sw/(1+.4*(world.sector-1))*dt*(1.2-separation/radius*.7),capacity),remaining=value-removed;
   if(remaining<.02&&capacity>=value){removed=value;remaining=0;}
   world.D[tile]=remaining;world.rem=Math.max(0,world.rem-removed);player.tank+=removed*10;player.prog.dust+=removed*10;world.dirty.push(tile);
  }
 }
 const tile=(pose.z/TS|0)*GW+(pose.x/TS|0),height=world.M[tile]===6?3.2:0,radiation=(pose.h>=height-.3?world.D[tile]||0:0)*(1+.25*(world.sector-1));
 const damage=(sheltered||pose.h-height>.5?0:Math.max(0,radiation*5-stats.suit*.8))+(world.M[tile]===7&&pose.h<.45?Math.max(5,24-stats.suit*2.5):0);
 player.exposure=damage;if(!world.dev||!world.assists?.invincible)player.hp-=damage*dt;
 if(damage<=0)player.hp=Math.min(stats.hp,player.hp+(sheltered?25:1.5)*dt);
 player.bladeCd-=dt;if(world.M[tile]===10&&pose.h<.9&&player.bladeCd<=0&&pose.st===0){hurt(world,player,28);pose.vx*=-.5;pose.vz*=-.5;player.bladeCd=.8;}
 if(world.TERM&&!world.vOpen&&distance(pose,world.TERM)<2.6&&player.tank>=20){player.tank-=20;openVault(world);}
 for(const depot of world.DEP)if(distance(pose,depot)<2.4&&pose.h<1.2&&player.tank>.5){world.team.raw+=player.tank;player.tank=0;event(world,'deposit',{playerId:player.id});}
 const separation=distance(pose,world.SH);if(separation>11)player.canDock=true;if(separation<4&&player.canDock)dock(world,player);
}
function hurt(world,player,damage){if(world.dev&&world.assists?.invincible)return;player.hp-=damage;event(world,'hurt',{playerId:player.id});}
function pathFields(world,players){
 let cache=caches.get(world);if(!cache){cache={next:0,fields:{}};caches.set(world,cache);}if(world.time<cache.next)return cache.fields;cache.next=world.time+.3;
 const neighbors=[[1,0],[-1,0],[0,1],[0,-1]];
 for(const player of players){cache.fields[player.id]=[false,true].map(big=>{
  const field=new Int16Array(GW*GH).fill(-1),queue=new Int32Array(GW*GH);let head=0,tail=0;
  const start=(player.pose.z/TS|0)*GW+(player.pose.x/TS|0);queue[tail++]=start;field[start]=0;
  while(head<tail){const current=queue[head++],column=current%GW,row=current/GW|0;
   for(const [dx,dz]of neighbors){const nextX=column+dx,nextZ=row+dz,next=nextZ*GW+nextX;if(nextX<0||nextZ<0||nextX>=GW||nextZ>=GH||field[next]>=0)continue;
    const kind=world.M[next];if(![0,3,4,6,10].includes(kind))continue;
    if(big&&Movement.collide({...world,SH:{x:-100,z:-100}},(nextX+.5)*TS,(nextZ+.5)*TS,.78,0,1.8,1))continue;
    field[next]=field[current]+1;queue[tail++]=next;
   }
  }return field;
 });}return cache.fields;
}
function clearLine(world,first,second){const length=distance(first,second);for(let travel=.4;travel<length;travel+=.4){const scale=travel/length;if(Movement.solid(world,first.x+(second.x-first.x)*scale,1,first.z+(second.z-first.z)*scale))return false;}return true;}
function updateEnemies(world,players,dt){
 if(world.dev&&world.assists?.freezeEnemies)return;
 const targets=players.filter(player=>!inShelter(world,player,7)),fields=pathFields(world,targets);
 for(const enemy of world.E){if(enemy.hp<=0)continue;const definition=ET[enemy.t],radius=.5*definition.sc,current=(enemy.z/TS|0)*GW+(enemy.x/TS|0);
  const candidates=targets.filter(player=>fields[player.id]?.[definition.sc>1.2?1:0][current]>=0||clearLine(world,enemy,player.pose)).sort((first,second)=>distance(enemy,first.pose)-distance(enemy,second.pose));
  let target=candidates[0];const previous=candidates.find(player=>player.id===enemy.target);if(previous&&target&&distance(enemy,previous.pose)<distance(enemy,target.pose)*1.25)target=previous;
  if(!target)continue;enemy.target=target.id;const separation=distance(enemy,target.pose)||1,visible=separation<24&&clearLine(world,enemy,target.pose);
  if(!enemy.al){if((visible&&separation<15)||separation<5)enemy.al=1;else continue;}
  let destination=target.pose;const field=fields[target.id]?.[definition.sc>1.2?1:0];
  if(!visible&&field){let best=current;for(const offset of [-GW,GW,-1,1]){const next=current+offset;if(next>=0&&next<field.length&&field[next]>=0&&(field[best]<0||field[next]<field[best]))best=next;}destination={x:(best%GW+.5)*TS,z:((best/GW|0)+.5)*TS};}
  let deltaX=destination.x-enemy.x,deltaZ=destination.z-enemy.z,length=Math.hypot(deltaX,deltaZ)||1;
  if(definition.rg&&visible&&separation<16){const direction=separation<8?-1:separation>12?1:0;deltaX=(target.pose.x-enemy.x)/separation*direction;deltaZ=(target.pose.z-enemy.z)/separation*direction;length=1;}
  const speed=definition.sp*(1+.04*(world.sector-1));
  const nextX=enemy.x+deltaX/length*speed*dt,nextZ=enemy.z+deltaZ/length*speed*dt;
  if(!Movement.collide(world,nextX,enemy.z,radius,0,1.8,1))enemy.x=nextX;if(!Movement.collide(world,enemy.x,nextZ,radius,0,1.8,1))enemy.z=nextZ;
  enemy.cd-=dt;enemy.fc-=dt;
  if(!definition.rg&&separation<definition.sc*.9+.8&&target.pose.h<1.4&&enemy.cd<=0){enemy.cd=.9;hurt(world,target,definition.dm*(1+.3*(world.sector-1)));}
  if(definition.rg&&visible&&separation<(definition.rg===2?22:16)&&enemy.fc<=0){
   enemy.fc=definition.rg===2?.3:1.8;const originY=1.1*definition.sc,delta={x:target.pose.x-enemy.x,y:target.pose.h+1-originY,z:target.pose.z-enemy.z},scale=(definition.rg===2?38:17)/(Math.hypot(delta.x,delta.y,delta.z)||1);
   if(world.EP.length<128)world.EP.push({id:nextId(world,'b'),x:enemy.x,y:originY,z:enemy.z,vx:delta.x*scale,vy:delta.y*scale,vz:delta.z*scale,l:3,sz:definition.rg===2?.12:.22,dm:definition.dm*(1+.3*(world.sector-1))});
  }
 }
 world.E=world.E.filter(enemy=>enemy.hp>0);
}
function updateProjectiles(world,players,dt){
 world.EP=world.EP.filter(projectile=>{
  projectile.l-=dt;if(projectile.l<=0)return false;const steps=Math.max(1,Math.ceil(Math.hypot(projectile.vx,projectile.vy,projectile.vz)*dt/.3));
  for(let index=0;index<steps;index++){
   projectile.x+=projectile.vx*dt/steps;projectile.y+=projectile.vy*dt/steps;projectile.z+=projectile.vz*dt/steps;
   if(Movement.solid(world,projectile.x,projectile.y,projectile.z))return false;
   for(const player of players)if(!inShelter(world,player,7)&&Math.abs(projectile.x-player.pose.x)<.6&&Math.abs(projectile.z-player.pose.z)<.6&&projectile.y>player.pose.h&&projectile.y<player.pose.h+(player.pose.low?1.22:1.8)){hurt(world,player,projectile.dm);return false;}
  }return true;
 });
}
function updateLoot(world,players,dt){
 world.Dr=world.Dr.filter(loot=>{
  loot.x+=loot.vx*dt;loot.z+=loot.vz*dt;loot.vx*=Math.exp(-4*dt);loot.vz*=Math.exp(-4*dt);
  const nearest=players.filter(player=>player.pose.h<1.5).sort((first,second)=>distance(loot,first.pose)-distance(loot,second.pose))[0];if(!nearest)return true;
  const separation=distance(loot,nearest.pose);
  if(separation<1.3){world.team[loot.k==='part'?'parts':loot.k==='cred'?'cred':'scrap']+=loot.a;if(loot.m==='v')world.vTaken|=loot.bit;if(loot.m==='i')world.iTaken|=loot.bit;event(world,'pickup',{playerId:nearest.id,kind:loot.k,amount:loot.a});return false;}
  if(separation<7){loot.vx+=(nearest.pose.x-loot.x)/(separation||1)*60*dt;loot.vz+=(nearest.pose.z-loot.z)/(separation||1)*60*dt;}return true;
 });
}
function enterBoss(world){
 const Boss=bossApi();
 Object.assign(world,Boss.arena(Maps.generate(world.sector)),{E:[],Dr:[],EP:[],dirty:[],clr:0,vOpen:0,vTaken:0,iTaken:0,bossDead:0,bty:null,boss:Boss.create(world.sector)});
 for(const player of Object.values(world.players)){dock(world,player);player.pose=Movement.createPose(world.SH);player.pose.z=world.SH.z;player.move={};player.ready=false;player.fireHeld=false;}
 Boss.seedDust(world);world.generation++;caches.delete(world);event(world,'boss');
}
function step(world,inputs={},dt=MOVE.tick){
 if(dt!==MOVE.tick)throw new Error('Simulation requires a fixed 64 Hz tick.');
 world.time+=dt;world.tick++;
 const players=Object.values(world.players).filter(player=>player.connected||player.present);
 for(const player of players){const input=inputs[player.id]||{menu:true};updatePlayer(world,player,input,dt);if(Number.isSafeInteger(input.seq))player.lastSeq=Math.max(player.lastSeq,input.seq);}
 const refined=Math.min(world.team.raw,(2+1.5*world.team.ref)*dt);world.team.raw-=refined;world.team.cred+=refined*(.5+.05*world.team.yld);
 if(world.boss){
  if(!world.bossDead&&(!world.dev||!world.assists?.freezeEnemies))for(const effect of bossApi().step(world,players,dt)||[]){
   if(effect.type==='hurt'){const player=world.players[effect.playerId];if(player)hurt(world,player,effect.damage);}
   else if(effect.type==='victory'&&!world.bossDead){world.bossDead=1;world.clr=1;world.team.cred+=1000+world.sector*250;world.team.parts+=3;event(world,'boss-victory');}
  }
 }else{updateEnemies(world,players,dt);updateProjectiles(world,players,dt);updateLoot(world,players,dt);}
 for(const player of players){if(player.hp<=0)rescue(world,player.id);achievements(player);}
 if(!world.boss&&(!world.dev||!world.assists?.freezeEnemies)){world.spawnT-=dt;if(world.spawnT<=0){world.spawnT=3.5;if(world.E.length<Math.min(8+2*world.sector,26))spawn(world,true);}}
 if(!world.boss&&world.total&&world.rem/world.total<=.03)world.clr=1;
 const transmissions=Defs.getSec(world.sector).b,cleared=100*(1-world.rem/world.total);
 if(!world.boss&&world.story<transmissions.length&&cleared>=transmissions[world.story][0])event(world,'story',{index:world.story++,sector:world.sector});
 if(!world.boss&&bossApi().isClean(world))enterBoss(world);
 if(world.dirty.length>GW*GH)world.dirty=[...new Set(world.dirty)];return world;
}
function snapshot(world){const value=clone(world);delete value.assists;value.events=[];value.dirty=[];return value;}
function achievements(player){
 const goals=[...[500,2500,10000,50000].map((goal,index)=>['dust'+index,player.prog.dust,goal]),
  ...ET.flatMap((_,type)=>[10,50,200].map(goal=>['enemy'+type+'_'+goal,player.prog.enemies[type],goal])),
  ...[10000,50000,250000].map(goal=>['points'+goal,player.score.total,goal]),
  ...[5,10,25].map(goal=>['streak'+goal,player.score.chain,goal])];
 for(const [id,value,goal]of goals)if(value>=goal&&!player.prog.ach.includes(id))player.prog.ach.push(id);
}
function validPlayer(saved){
 const integer=(value,max=1e12)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
 const flags=(value,keys)=>value&&keys.every(key=>value[key]===0||value[key]===1);
 if(!saved||typeof saved.name!=='string'||saved.name.length>24||!saved.L||!saved.pose)return false;
 for(const upgrade of U)if(!integer(saved.L[upgrade[0]],upgrade[5]))return false;
 for(let index=1;index<WP.length;index++)if(!integer(saved.L['w'+index],1))return false;
 if(!finite(saved.hp,-1e6,ST(saved.L).hp)||!finite(saved.tank,0,ST(saved.L).cap)||!integer(saved.wi,6))return false;
 if(!Array.isArray(saved.ammo)||saved.ammo.length!==7||!saved.ammo.every(value=>integer(value,1000))||!Array.isArray(saved.reserves)||saved.reserves.length!==7||!saved.reserves.every(value=>integer(value,13)))return false;
 if(!Array.isArray(saved.wl)||saved.wl.length!==7||saved.wl.some(levels=>!levels||!['dmg','fr','multi'].every(key=>integer(levels[key],U.find(upgrade=>upgrade[0]===key)[5]))))return false;
 if(!Array.isArray(saved.att)||saved.att.length!==7||!saved.att.every(value=>flags(value,['s','b','l']))||!flags(saved.unl,['s','b','l'])||!flags(saved.mod,['gr','dash']))return false;
 for(const key of ['x','z','h','vx','vz','vh','yaw','pit','g','sl','slideLock','st','peak','cy','jb','roll','cd','low','crP','rl','rp','dashed','chain','ss','sa','sT'])if(typeof saved.pose[key]!=='boolean'&&!finite(saved.pose[key],-1e9,1e9))return false;
 if(!finite(saved.pose.x,0,GW*TS)||!finite(saved.pose.z,0,GH*TS)||!finite(saved.pose.h,-10,20)||![0,1,2,4,5,6].includes(saved.pose.st))return false;
 const vector=value=>value&&finite(value.x,-1e6,1e6)&&finite(value.z,-1e6,1e6);
 if(saved.pose.st===1&&(!saved.pose.an||!['t','d','x0','z0','h0','x1','z1','h1','dx','dz','sp','arc'].every(key=>finite(saved.pose.an[key],-1e6,1e6))||saved.pose.an.d<=0))return false;
 if(saved.pose.st===2&&(!vector(saved.pose.hd)||!finite(saved.pose.hT,0,20)))return false;
 if([4,5].includes(saved.pose.st)&&!vector(saved.pose.wn))return false;
 if(saved.pose.st===4&&(!vector(saved.pose.wt)||!finite(saved.pose.wa,-1000,1000)))return false;
 if(saved.pose.gr&&(!vector(saved.pose.gr)||!finite(saved.pose.gr.y,-10,20)||!finite(saved.pose.gr.t,0,3)))return false;
 if(saved.pose.st===6){const zip=saved.pose.zp;if(!zip||!zip.z||!['x0','x1','z0','z1','h0','h1','L','len'].every(key=>finite(zip.z[key],0,300))||zip.z.len<=0||!finite(zip.t,0,1)||![-1,1].includes(zip.dir)||!finite(zip.sp,0,100))return false;}
 if(!saved.move||Object.values(saved.move).some(value=>typeof value!=='boolean'&&!finite(value,-1e6,1e6)))return false;
 for(const key of ['wcd','rel','relMax','bladeCd','exposure'])if(!finite(saved[key],-1e12,1e6))return false;
 for(const key of ['kills','lastSeq','lastActionId'])if(!integer(saved[key]))return false;
 if(typeof saved.connected!=='boolean'||typeof saved.ready!=='boolean')return false;
 const progress=saved.prog;if(!progress||!finite(progress.dust,0,1e12)||!Array.isArray(progress.enemies)||progress.enemies.length!==4||!progress.enemies.every(value=>integer(value))||!Array.isArray(progress.weapons)||progress.weapons.length!==7)return false;
 if(progress.weapons.some(value=>!value||!integer(value.kills)||!Array.isArray(value.types)||value.types.length!==4||!value.types.every(total=>integer(total))))return false;
 if(!Array.isArray(progress.ach)||progress.ach.length>64||!progress.ach.every(value=>typeof value==='string'&&value.length<40))return false;
 if(!saved.score||!['total','run','best','chain'].every(key=>integer(saved.score[key]))||!Array.isArray(saved.score.board)||saved.score.board.length>5||saved.score.board.some(entry=>!entry||!integer(entry.points)||!integer(entry.site,100)||!['Cleared','Rescued'].includes(entry.reason)))return false;
 if(!saved.streak||!['kills','heads','points','bonus'].every(key=>integer(saved.streak[key]))||!finite(saved.streak.left,0,5))return false;
 return Array.isArray(saved.actionResults)&&saved.actionResults.length<=128&&saved.actionResults.every(value=>value&&integer(value.id)&&value.result&&typeof value.result.ok==='boolean');
}
function restore(raw){
 if(!raw||raw.version!==1||!Number.isInteger(raw.sector)||raw.sector<1||raw.sector>100||!raw.team||!raw.players)throw new Error('Unsupported co-op checkpoint.');
 if(!Array.isArray(raw.M)||raw.M.length!==GW*GH||!raw.M.every(value=>Number.isInteger(value)&&value>=0&&value<=10)||!Array.isArray(raw.D)||raw.D.length!==GW*GH||!raw.D.every(value=>finite(value,0,1)))throw new Error('Invalid co-op map.');
 const world=createWorld({sector:raw.sector,dev:raw.dev});let generated=Maps.generate(raw.sector,{vOpen:raw.vOpen}),boss=null;
 if(raw.boss!=null){boss=bossApi().restore(raw.boss,raw.sector);if(!boss)throw new Error('Invalid checkpoint boss.');generated=bossApi().arena(generated);}
 if(raw.M.some((value,index)=>value!==generated.M[index]))throw new Error('Checkpoint geometry does not match this version.');
 for(const key of Object.keys(world.team))if(!finite(raw.team[key],0,1e12))throw new Error('Invalid team resources.');
 if(!Number.isInteger(raw.team.ref)||raw.team.ref>40||!Number.isInteger(raw.team.yld)||raw.team.yld>30)throw new Error('Invalid refinery upgrades.');
 Object.assign(world,generated,{boss,D:raw.D.slice(),team:Object.fromEntries(Object.keys(world.team).map(key=>[key,raw.team[key]])),players:{}});
 for(const key of ['generation','tick','entitySeq','rngState','story','clr','vOpen','vTaken','iTaken','bossDead']){if(!Number.isSafeInteger(raw[key])||raw[key]<0)throw new Error('Invalid checkpoint counters.');world[key]=raw[key];}
 if(!finite(raw.time,0,1e12)||Object.keys(raw.players).length>32)throw new Error('Invalid checkpoint time or characters.');world.time=raw.time;
 for(const [id,saved]of Object.entries(raw.players)){
  if(!validPlayer(saved))throw new Error('Invalid saved character.');const player=addPlayer(world,{id,name:saved.name});
  for(const key of Object.keys(player)){if(Object.hasOwn(saved,key))player[key]=clone(saved[key]);}
 }
 if(!Object.hasOwn(world.players,raw.hostId))throw new Error('Missing host character.');world.hostId=raw.hostId;
 for(const [key,limit]of [['E',64],['Dr',1000],['EP',128]]){
  if(!Array.isArray(raw[key])||raw[key].length>limit||raw[key].some(entity=>!entity||typeof entity.id!=='string'||entity.id.length>80||!finite(entity.x,-100,300)||!finite(entity.z,-100,300)))throw new Error('Invalid checkpoint entities.');
  if(new Set(raw[key].map(entity=>entity.id)).size!==raw[key].length)throw new Error('Duplicate checkpoint entities.');world[key]=clone(raw[key]);
 }
 if(world.E.some(enemy=>!Number.isInteger(enemy.t)||enemy.t<0||enemy.t>=ET.length||!['hp','mh','cd','fc','ph'].every(key=>finite(enemy[key],-1e12,1e6))))throw new Error('Invalid enemy.');
 if(world.EP.some(projectile=>!['y','vx','vy','vz','l','dm'].every(key=>finite(projectile[key],-1000,1e6))))throw new Error('Invalid projectile.');
 if(world.Dr.some(loot=>!['scrap','cred','part'].includes(loot.k)||!finite(loot.a,0,1e9)||!finite(loot.vx,-1000,1000)||!finite(loot.vz,-1000,1000)))throw new Error('Invalid loot.');
 if(!finite(raw.spawnT,0,3.5))throw new Error('Invalid spawn timer.');world.spawnT=raw.spawnT;
 if(boss&&!finite(raw.total,1,1e12))throw new Error('Invalid boss cleanup total.');
 world.total=boss?raw.total:generated.total;world.rem=world.D.reduce((total,value)=>total+value,0);world.events=[];world.dirty=[];return world;
}
NSR.Simulation={createWorld,addPlayer,step,action,snapshot,restore,restart,disconnect,rescue,inShelter,cast,recordKill};
if(typeof module!=='undefined')module.exports=NSR.Simulation;
})(globalThis);
