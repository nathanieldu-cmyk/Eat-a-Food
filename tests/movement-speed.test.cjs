const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
function declaration(name){const start=source.indexOf(`  function ${name}(`);assert.ok(start>=0);const end=source.indexOf('\n  function ',start+1);return source.slice(start,end);}
function boot(){
 let stacks=0;const state={player:null};
 const ctx={state,Math,uuid:()=> 'food',boostStacks:()=>stacks};
 const constants=['SPEED_SCALE','SPRINKLE_GROWTH_SCALE','BASE_FOOD_DRAW_RADIUS'].map(name=>source.match(new RegExp(`  const ${name} = [^;]+;`))[0]);
 vm.runInNewContext(constants.join('\n')+'\n'+declaration('createFood')+'\n'+declaration('moveSpeed')+'\nglobalThis.api={createFood,moveSpeed,SPEED_SCALE,BASE_FOOD_DRAW_RADIUS};',ctx);
 return {...ctx.api,state,setStacks:n=>{stacks=n;}};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('starting speed is preserved, with slowdown proportional to visible radius and a half-speed floor',()=>{
 const g=boot(),food=g.createFood({speed:2},0,0);g.state.player=food;
 near(g.moveSpeed(food),2*g.SPEED_SCALE);
 for(const [ratio,factor] of [[1,1],[2,1/Math.sqrt(2)],[4,.5],[7,.5]]){
   food.drawRadius=()=>g.BASE_FOOD_DRAW_RADIUS*ratio;near(g.moveSpeed(food),factor);
 }
});
test('growing foods slow smoothly without immediately crawling and stop slowing when visual growth caps',()=>{
 const g=boot(),food=g.createFood({speed:1},0,0);g.state.player=food;const start=g.moveSpeed(food);let previous=start;
 for(const size of [10,25,50,100,250,500,1000,2500,5000,10000,25000,50000,100000,1000000]){
   food.size=size;const speed=g.moveSpeed(food);
   assert.ok(Number.isFinite(speed)&&speed>0);assert.ok(speed<=previous+1e-10);assert.ok(speed>=start*.5);previous=speed;
 }
 food.size=400;assert.ok(g.moveSpeed(food)>start*.9,'small visible growth should not lose most movement speed');
 food.size=1000000;const max=g.moveSpeed(food);food.size=10000000;near(g.moveSpeed(food),max);
});
test('tier speed advantages and potion bonuses remain proportional for local, remote and CPU foods at every size',()=>{
 const g=boot();
 for(const size of [10,1000,10000,1000000]){
   const local=g.createFood({speed:2},0,0),remote=g.createFood({speed:2},0,0),cpu=g.createFood({speed:3},0,0,true);
   local.size=remote.size=cpu.size=size;g.state.player=local;g.setStacks(0);
   near(g.moveSpeed(local),g.moveSpeed(remote));near(g.moveSpeed(cpu)/g.moveSpeed(local),1.5);
   g.setStacks(1);remote.speedBoost=1.25;near(g.moveSpeed(local),g.moveSpeed(remote));
   cpu.speedBoost=1.4;near(g.moveSpeed(cpu)/g.moveSpeed(remote),3*1.4/(2*1.25));
 }
});
