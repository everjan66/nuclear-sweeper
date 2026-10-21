'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createState,create}=require('../js/ui/suit-interference.js');
const html=fs.readFileSync('nuclear-sweeper-reactor.html','utf8');
test('interference intensity scales with relative hit damage and fades after 1.5 seconds',()=>{
 const small=createState(),large=createState(),upgraded=createState();
 assert.equal(small.intensity(0),.16);
 small.hit(5,100,0);large.hit(25,100,0);upgraded.hit(25,500,0);
 assert.ok(large.intensity(0)>small.intensity(0));assert.equal(upgraded.intensity(0),small.intensity(0));
 assert.ok(large.intensity(750)<large.intensity(0));assert.ok(large.intensity(750)>.16);
 assert.equal(large.intensity(1500),.16);assert.equal(large.intensity(9000),.16);
});
test('repeated hits and hazard exposure are bounded and invalid damage never triggers a burst',()=>{
 const state=createState();
 for(const damage of [0,-1,NaN,Infinity])state.hit(damage,100,0);
 for(const health of [0,-1,NaN,Infinity])state.hit(20,health,0);
 state.hit(20,100,NaN);assert.equal(state.intensity(0),.16);
 state.hit(5,100,0);const initial=state.intensity(0);state.hit(5,100,100);assert.ok(state.intensity(100)>initial);
 for(let index=0;index<100;index++)state.hit(1000,100,100);
 assert.equal(state.intensity(100,1000),1);state.reset();assert.equal(state.intensity(100),.16);
 assert.ok(state.intensity(100,18)>.16);assert.equal(state.intensity(100,-10),.16);assert.equal(state.intensity(100,NaN),.16);
});
function rendererFixture(){
 const calls={frames:0,tears:0,colors:[]},context={createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData(){},createPattern:()=> 'noise',clearRect(){calls.frames++;},save(){},restore(){},translate(){},drawImage(){calls.tears++;},fillRect(){calls.colors.push(this.fillStyle);}};
 const canvas={getContext:()=>context,ownerDocument:{createElement:()=>({getContext:()=>context})}},effect=create(canvas,{width:1280,height:800},()=>.5);
 return {calls,canvas,effect};
}
test('interference draws green static at no more than 30 Hz and reserves tearing for damage',()=>{
 const {calls,canvas,effect}=rendererFixture();
 assert.equal(canvas.hidden,true);effect.render(0);assert.equal(canvas.hidden,false);assert.equal(calls.frames,1);assert.equal(calls.tears,0);
 assert.ok(calls.colors.some(color=>color.startsWith('rgba(155,229,100,')));
 effect.render(10);assert.equal(calls.frames,1);effect.hit(25,100,20);effect.render(40);
 assert.equal(calls.frames,2);assert.ok(calls.tears>0);
});
test('pause, disabled effects and reduced motion hide interference and clear pending damage',()=>{
 for(const option of [{paused:true},{enabled:false},{reducedMotion:true}]){
  const {calls,canvas,effect}=rendererFixture();effect.hit(25,100,0);effect.render(0,option);
  assert.equal(canvas.hidden,true);assert.equal(calls.frames,0);effect.render(1);
  assert.equal(canvas.hidden,false);assert.equal(calls.frames,1);assert.equal(calls.tears,0);
 }
 const canvas={getContext:()=>null},effect=create(canvas);assert.doesNotThrow(()=>effect.render(0));assert.equal(canvas.hidden,true);
});
test('solo damage triggers a burst but developer invincibility does not',()=>{
 const source=html.split('\n').find(line=>line.startsWith('function hurt(')),hits=[];
 const context=vm.createContext({DEV_MODE:true,DEV_TOOLS:{invincible:false},S:{hp:100,L:{}},ST:()=>({hp:100}),suitInterference:{hit:(...values)=>hits.push(values)},performance:{now:()=>123},showDamageDirection(){},hpFlash:0,hitT:0,tt:7});
 vm.runInContext(source+';hurt(12);',context);assert.equal(context.S.hp,88);assert.deepEqual(hits,[[12,100,123]]);
 context.DEV_TOOLS.invincible=true;vm.runInContext('hurt(12)',context);assert.equal(context.S.hp,88);assert.equal(hits.length,1);
});
test('co-op bursts use the damage amount and never react to another player being hit',()=>{
 const source=html.slice(html.indexOf('function coopGameEvent('),html.indexOf('function coopInput(')),hits=[];
 const context=vm.createContext({coopSession:{view:()=>({localId:'local'})},S:{L:{}},ST:()=>({hp:200}),suitInterference:{hit:(...values)=>hits.push(values)},performance:{now:()=>456},showDamageDirection(){},hpFlash:0});
 vm.runInContext(source,context);context.coopGameEvent({type:'hurt',playerId:'other',damage:20});assert.equal(hits.length,0);
 context.coopGameEvent({type:'hurt',playerId:'local',damage:20});assert.deepEqual(hits,[[20,200,456]]);
 context.coopGameEvent({type:'hurt',playerId:'local'});assert.deepEqual(hits[1],[5,200,456]);
});
test('backup imports preserve the interference setting and default older backups safely',()=>{
 const source=html.slice(html.indexOf('function cleanSettings('),html.indexOf('let pendingImport='));
 const context=vm.createContext({CFG:{suitInterference:true},KBD:{},KEYCODE:/^Key[A-Z]$/});vm.runInContext(source,context);
 assert.equal(context.cleanSettings({suitInterference:false}).suitInterference,false);
 assert.equal(context.cleanSettings({}).suitInterference,true);assert.equal(context.cleanSettings({suitInterference:'false'}).suitInterference,true);
});
