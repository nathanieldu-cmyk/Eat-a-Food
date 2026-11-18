const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
let harness=fs.readFileSync(path.join(__dirname,'bento.test.cjs'),'utf8').split('const thresholds =')[0];
harness=harness.replace('    pullFood = () => tierByName.Peanut;','').replace('globalThis.api = { save, state, net,','globalThis.api = { setTutorialStep, save, state, net,');
const ctx={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.gameBoot=boot;',ctx);
const fresh=()=>ctx.gameBoot(undefined,true);
function usePeanutRoll(g){
 for(let i=0;i<1000;i++){const roll=i/1000;g.math.random=()=>roll;if(g.pullFood().name==='Peanut')return;}
 assert.fail('normal food pool must still include Peanut');
}
test('first-time players start with only Peanut and their first run reward cannot be Peanut',()=>{
 const g=fresh();assert.equal(g.save.equipped,'Peanut');assert.equal(JSON.stringify(g.save.inventory),JSON.stringify({Peanut:1}));assert.equal(JSON.stringify(g.save.discovered),JSON.stringify({Peanut:true}));
 // The same roll normally produces Peanut, but the first reward excludes it.
 usePeanutRoll(g);assert.equal(g.pullFood().name,'Peanut');
 g.state.foodsEarned=1;const first=g.bankPendingFoods();assert.notEqual(first[0],'Peanut');assert.equal(g.save.firstRunRewardClaimed,true);
 const reloaded=ctx.gameBoot(JSON.parse(g.storage.get('sprinkleFeastSave')));usePeanutRoll(reloaded);reloaded.state.foodsEarned=1;
 assert.equal(reloaded.bankPendingFoods()[0],'Peanut','later rewards restore normal odds');
});
test('no-food runs and reloads preserve the first reward guarantee; tutorial replay cannot renew it',()=>{
 const g=fresh();g.bankPendingFoods();assert.equal(g.save.firstRunRewardClaimed,false);
 const reloaded=ctx.gameBoot(JSON.parse(g.storage.get('sprinkleFeastSave')));assert.equal(reloaded.save.firstRunRewardClaimed,false);
 usePeanutRoll(reloaded);reloaded.state.foodsEarned=1;assert.notEqual(reloaded.bankPendingFoods()[0],'Peanut');
 reloaded.setTutorialStep('start');assert.equal(reloaded.save.firstRunRewardClaimed,true);assert.equal(reloaded.bankPendingFoods()[0],'Peanut');
});
test('existing players keep their foods and normal reward odds',()=>{
 const old=JSON.parse(JSON.stringify(fresh().save));delete old.firstRunRewardClaimed;old.inventory={Peanut:4,Cheese:2};old.equipped='Cheese';
 const g=ctx.gameBoot(old);assert.equal(g.save.firstRunRewardClaimed,true);assert.equal(g.save.inventory.Peanut,4);assert.equal(g.save.equipped,'Cheese');usePeanutRoll(g);g.state.foodsEarned=1;assert.equal(g.bankPendingFoods()[0],'Peanut');
});
test('double foods duplicates the non-Peanut first reward, and weather keeps the guarantee',()=>{
 for(const weather of ['double-foods','gold','rainbow','shadow']){
  const g=fresh();usePeanutRoll(g);g.state.foodsEarned=1;g.state.foodWeather=[weather];const foods=g.bankPendingFoods();
  assert.ok(foods.every(name=>!name.includes('Peanut')));assert.equal(foods.length,weather==='double-foods'?2:1);
  if(foods.length===2)assert.equal(foods[0],foods[1]);
 }
});

test('fresh Peanut inventory survives reload and empty-inventory recovery',()=>{
 const initial=JSON.parse(JSON.stringify(fresh().save));
 for(const inventory of [initial.inventory,{}, {Popcorn:0}]){
  const g=ctx.gameBoot({...initial,inventory});
  assert.equal(JSON.stringify(g.save.inventory),JSON.stringify({Peanut:1}));
  assert.equal(g.save.equipped,'Peanut');assert.equal(g.save.firstRunRewardClaimed,false);
  usePeanutRoll(g);g.state.foodsEarned=1;assert.notEqual(g.bankPendingFoods()[0],'Peanut');
 }
});
