'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Defs=require('../js/core/definitions.js');
const html=fs.readFileSync('nuclear-sweeper-reactor.html','utf8'),source=html.match(/function hud\(\)\{[\s\S]*?\n\/\/ ---------- input/)[0].split('\n// ---------- input')[0];
function renderHud(overrides={}){
 const panel={innerHTML:''},shelter={x:0,z:0};let updates=0;
 const context=vm.createContext({NSR:{Defs},S:{total:100,L:{},sector:1,clr:0,bossDead:0,score:{run:1234,best:5678}},D:[10,3.456],ST:()=>({reloads:3}),WP:[{n:'Desert Eagle'}],wi:0,ammo:[7],reserves:[3],mag:()=>7,rel:0,p:{x:0,z:4,vx:3,vz:4,yaw:0,sl:false,st:0,roll:0},SH:shelter,DEP:[],getSec:()=>({n:'Kessel-7 Reactor Hall'}),bossActive:()=>false,kn:()=> 'E',CFG:{KB:{use:'KeyE'}},$:()=>panel,barUpd:()=>updates++,...overrides});
 vm.runInContext(source+';hud();',context);
 assert.equal(updates,1);return {markup:panel.innerHTML,context};
}
test('hazard-suit HUD preserves live mission, movement, ammo, navigation and score readouts',()=>{
 const {markup}=renderHud();
 for(const text of ['S9 / HAZARD SUIT','SITE 1','Kessel-7 Reactor Hall','86.5','width:86.5%','2 dust patches remaining','5.0','Desert Eagle','7<small>/7','Spare reloads: 3/3','Shelter','4 <small>m','[E] open shelter shop','1,234','BEST 5,678'])assert.ok(markup.includes(text),text);
 assert.equal((markup.match(/<section /g)||[]).length,5);
});
test('hazard-suit HUD retains cleanup precision and early-deployment and boss alerts',()=>{
 const {markup,context}=renderHud({D:[.01]});
 assert.ok(markup.includes('99.9'));assert.ok(markup.includes('1 dust patch remaining'));
 context.S.clr=1;vm.runInContext('hud()',context);assert.ok(context.$().innerHTML.includes('EARLY DEPLOY AVAILABLE'));
 context.S.bossDead=1;vm.runInContext('hud()',context);assert.ok(context.$().innerHTML.includes('BOSS DEFEATED'));
});
test('hazard-suit HUD distinguishes empty weapons, reloading and boss supply rules',()=>{
 assert.ok(renderHud({ammo:[0],reserves:[0]}).markup.includes('OUT OF AMMO - RETURN TO SHELTER'));
 assert.ok(renderHud({rel:1}).markup.includes('RELOADING'));
 const {markup}=renderHud({ammo:[0],reserves:[0],bossActive:()=>true});
 assert.ok(markup.includes('Spare reloads: UNLIMITED'));
 assert.ok(markup.includes('deposit dust (no healing)'));assert.ok(!markup.includes('OUT OF AMMO'));
});
test('hazard-suit HUD retains closest-depot navigation and traversal state',()=>{
 const {markup}=renderHud({DEP:[{x:0,z:3}],p:{x:0,z:4,vx:0,vz:0,yaw:0,sl:false,st:4,roll:0}});
 assert.ok(markup.includes('Depot'));assert.ok(markup.includes('1 <small>m'));assert.ok(markup.includes('WALLRUN'));
});
