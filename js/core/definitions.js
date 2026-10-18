/* Shared simulation code: no DOM, rendering, audio or browser storage. */
(function(root){
'use strict';
const NSR=root.NSR||(root.NSR={});
const TS=2,GW=60,GH=60,WH=6.4;
const TT=[0,WH,1.1,2.6,0,2.2,3.2,0,1.1,WH,0],TB=[0,0,0,1.3,0,0,2.9,0,0,0,0];
const MOVE={tick:1/64,groundAccel:10,airAccel:12,friction:5.2,stopSpeed:80*7.2/250,airWishCap:30*7.2/250,slideMinSpeed:3.5,slideEndSpeed:2.5,slideDrag:2.4,slideTurnRate:1.2};
const SCORE={kill:100,headshot:20,window:5,step:5,maxBonus:.5};
const cl=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const ST=L=>({sw:.6+.12*L.sweep,rad:3+.4*L.rad,suit:1+.6*L.suit,hp:100+10*L.suit,gei:6+2*L.gei,spd:9+.45*L.boots,cap:100+60*L.tank,rate:2+1.5*L.ref,yld:.5+.05*L.yld,reloads:3+L.pouch,w1:L.w1,w2:L.w2,w3:L.w3,w4:L.w4,w5:L.w5,w6:L.w6});
// id, name, currency (s scrap / c credits), base cost, growth, max, stat key, label, decimals
const U=[['sweep','Sweeper motor','s',8,1.32,40,'sw','suction /s',2],['rad','Nozzle width','s',8,1.3,40,'rad','sweep radius m',1],['suit','Hazard suit','s',12,1.34,40,'suit','radiation resistance',1],['gei','Geiger counter','s',8,1.3,40,'gei','detect radius m',0],['boots','Servo skates','s',10,1.3,30,'spd','top sprint speed m/s',1],
['pouch','Ammo pouch','s',12,1.4,10,'reloads','spare reloads per weapon',0],
['tank','Dust tank','c',40,1.38,40,'cap','capacity u',0],['ref','Refinery throughput','c',30,1.36,40,'rate','units /s',1],['yld','Refinery yield','c',60,1.45,30,'yld','credits per unit',2],['dmg','Weapon damage','c',25,1.4,40,'dm','damage x',2],['fr','Cyclic rate','c',35,1.4,30,'fr','fire rate x',2],['multi','Extended mags','c',40,1.5,8,'mg','magazine x',2],
];
const cost=(u,l)=>Math.ceil(u[3]*Math.pow(u[4],l));
const WP=[{n:'Desert Eagle',d:14,pen:2,fall:.6,r:2.6,mag:7,rl:1.8,sp:.7,sa:.08,pel:1,auto:0,z:1.15,rc:.05,sc:0,vm:[0xb9bdc4,.075,.11,.3,.12,1,0]},
{n:'MP7',d:11,r:15.8,mag:30,rl:1.7,sp:2.4,sa:.9,pel:1,auto:1,z:1.5,rc:.007,sc:1,vm:[0x2b2b2b,.06,.09,.38,.16,1,1]},
{n:'SMG-11',d:10,r:21,mag:32,rl:1.6,sp:3.6,sa:2,pel:1,auto:1,z:1.5,rc:.009,sc:1,vm:[0x3a3a3a,.06,.1,.3,.12,1,1]},
{n:'416-C',d:13,pen:2,fall:.6,r:12.3,mag:30,rl:2,sp:1.8,sa:.35,pel:1,auto:1,z:2,rc:.008,sc:1,vm:[0x23252a,.07,.1,.52,.3,1,1]},
{n:'R4-C',d:13,pen:2,fall:.6,r:14.3,mag:30,rl:2.1,sp:2,sa:.4,pel:1,auto:1,z:2,rc:.01,sc:1,vm:[0x3b3326,.07,.1,.52,.3,1,1]},
{n:'Breaker',d:3.8,pen:2,fall:.5,r:1.3,mag:6,rl:2.4,sp:5.5,sa:3.8,pel:9,auto:0,z:1.2,rc:.05,sc:0,vm:[0x4a3b2a,.08,.09,.5,.3,1,0]},
{n:'Vector DMR',d:20,pen:3,fall:.75,big:2.5,r:1.8,mag:8,rl:1.9,sp:1.8,sa:.02,pel:1,auto:0,z:3,rc:.04,sc:1,vm:[0x2d3a2d,.07,.1,.6,.4,1,1]}];
const ET=[{hp:30,sp:5.6,dm:12,sc:1,col:0x4f7a2c},{hp:30,sp:3.8,dm:9,sc:.95,col:0xa0522d,rg:1},{hp:130,sp:3.6,dm:26,sc:1.55,col:0x6a3a28},{hp:30,sp:4.4,dm:6,sc:1,col:0x5b6577,rg:2}];
const ENAMES=['Glower','Spitter','Brute','Gunner'];
const WCLASS=[0,1,1,2,2,3,4],CNAMES=['Pistol','Machine pistol','Assault rifle','Shotgun','Sniper / DMR'],UNLOCK=[0,25,60,90,60];
const TIERS=[{n:'Basic',col:null,k:0,types:[0,0,0,0]},
 {n:'Tier 1 · Gold',col:0xd4af37,k:50,types:[20,5,0,0]},
 {n:'Tier 2 · Platin',col:0xc7dce5,k:150,types:[40,25,10,10]},
 {n:'Tier 3 · Polychrome',col:0xe879f9,k:400,types:[100,60,40,40]}];
const mkL=()=>({sweep:0,rad:0,suit:0,gei:0,boots:0,pouch:0,tank:0,ref:0,yld:0,dmg:0,fr:0,multi:0,w1:0,w2:0,w3:0,w4:0,w5:0,w6:0});
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const ROOM_DESIGNS=[
 {n:'CARGO STORAGE',color:0xd8aa59,tint:[12,5,-10]},
 {n:'TURBINE HALL',color:0x71c9d0,tint:[-12,7,12]},
 {n:'SAMPLE LAB',color:0x9dd5a2,tint:[-10,12,0]},
 {n:'SERVICE ARCHIVE',color:0xafa0dc,tint:[6,-6,14]},
 {n:'COLLAPSED WORKS',color:0xd58b6c,tint:[12,-8,-12]},
 {n:'TRANSFER ATRIUM',color:0xd4d6be,tint:[6,8,2]}
];
const ATT={s:['Suppressor',3,'quiet: only wakes enemies within 9 m; -6% damage'],b:['Extended barrel',4,'+12% damage, tighter aim down sights, +15% recoil'],l:['Laser sight',2,'-40% hip-fire spread, visible laser beam']};
const MOD={gr:['Grapple hook',6,'G: aim at any surface. Hold to reel in, release to keep your momentum. Grabs ledges automatically.'],dash:['Air-dash',5,'F: burst of speed in your move direction. Once per jump, or every second on the ground.']};

const SEC=[
{n:'Kessel-7 Reactor Hall',b:[[0,'Hanne Voss','Sweeper, you\'re live inside Kessel-7. The hall is a maze of corridors and rubble. Skate fast, slide under the beams, vault the crates. Vacuum the dust and bring it home, or drop it at the blue depot pads in the outer rooms.'],[12,'Hanne Voss','Glowers: livestock, mostly. They\'re quick, but you\'re quicker. Keep moving.'],[35,'Intercept: Kessel Control, day 9','"Core is contained. The fields are only residue. Clean them and the site is safe." Hanne, this message was buried. Why?'],[60,'Hanne Voss','...The Council knew. Shelter Nine runs on the isotopes you refine. I should have told you.'],[97,'SITE CLEARED','Kessel-7 is cold. Return to the shelter and deploy to the next site. There are more.']]},
{n:'Harrow Dam Turbine Complex',b:[[0,'Hanne Voss','Harrow Dam. Turbine halls, flooded galleries. The dust sticks harder here, and something shoots back: Spitters. Never stand still.'],[50,'Hanne Voss','The Council pays triple for Harrow isotopes. I\'ve stopped asking where it goes.'],[97,'SITE CLEARED','Dam sealed. The Council already has a new contract. Hanne: I\'m done carrying their messages. Deploy when ready.']]},
{n:'Silo Nine Fuel Depot',b:[[0,'Hanne Voss','Silo Nine. Brutes patrol here, maintenance crews that never left. The dust is tar now. Upgrade your motor.'],[50,'Hanne Voss','I found the Council ledgers. Every site you clear, they sell the fallout to the highest bidder. Not anymore.'],[97,'SITE CLEARED','Ledgers are on every radio. Shelter Nine voted: you stay on. Next site.']]},
{n:'Meridian Breeder Plant',b:[[0,'Hanne Voss','Meridian. The last site on the old maps. Everything here hits harder.'],[97,'SITE CLEARED','Meridian is cold. The old maps are empty, but the fallout isn\'t. There are more sites. You know what you do.']]}];
const getSec=s=>SEC[s-1]||{n:'Deep Site '+s,b:[[0,'Hanne Voss','Another reactor, another grave. Stickier dust, meaner things. Same job.'],[97,'SITE CLEARED','Site sealed. Another beacon goes dark. Next.']]};

NSR.Defs={SEC,getSec,TS,GW,GH,WH,TT,TB,MOVE,SCORE,cl,lerp,ST,U,cost,WP,ET,ENAMES,WCLASS,CNAMES,UNLOCK,TIERS,mkL,rng,ROOM_DESIGNS,ATT,MOD};
if(typeof module!=='undefined')module.exports=NSR.Defs;
})(globalThis);
