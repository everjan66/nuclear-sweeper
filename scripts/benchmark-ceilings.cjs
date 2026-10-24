'use strict';
const {performance}=require('node:perf_hooks');
const Sim=require('../js/game/simulation.js'),Maps=require('../js/core/map.js'),Movement=require('../js/core/movement.js');
const cached=Maps.ceiling;
function original(world,x,z){const r=(world.R||[]).find(r=>r.large&&x>=r.x0*2&&x<(r.x1+1)*2&&z>=r.z0*2&&z<(r.z1+1)*2);return r?r.ceiling:6.4;}
function bench(fn){Maps.ceiling=fn;const w=Sim.createWorld({sector:10,dev:true});w.assists={invincible:true};for(let i=0;i<4;i++){const p=Sim.addPlayer(w,{id:'p'+i}),r=w.R[[3,7,10,15][i]];p.pose=Movement.createPose({x:(r.cx+.5)*2,z:(r.cz+.5)*2});p.L.suit=40;p.L.gei=40;}
 for(let i=0;i<128;i++){Sim.step(w);w.events=[];w.dirty=[];}const times=[];for(let i=0;i<3000;i++){const start=performance.now();Sim.step(w);times.push(performance.now()-start);w.events=[];w.dirty=[];}times.sort((a,b)=>a-b);return {medianMs:times[1500],p95Ms:times[2850],p99Ms:times[2970]};}
const runs=[];for(let i=0;i<3;i++)runs.push({baseline:bench(original),cachedCeiling:bench(cached)});Maps.ceiling=cached;const result={experiment:'Four-player simulation: room scan versus production ceiling cache',runs};console.log(JSON.stringify(result,null,2));
