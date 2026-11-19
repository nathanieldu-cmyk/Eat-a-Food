const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
const relicSource=fs.readFileSync(path.join(root,'relics.js'),'utf8');
function api(){const window={};vm.runInNewContext(relicSource,{window,Math,Object,Number});return window.GameRelics;}
const plain=value=>JSON.parse(JSON.stringify(value));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function saveFor(a){return {diamonds:10000,inventory:{Peanut:1,'Golden Peanut':1,Cookie:1},relics:a.emptySave()};}
test('Basic packs cost exactly 250 diamonds and give three independent equally likely fragments',()=>{
 const a=api();assert.equal(a.definitions.length,7);
 for(let index=0;index<7;index++)for(const roll of [index/7,(index+1)/7-1e-9]){
  const save=saveFor(a);let calls=0;const result=a.buyPack(save,()=>{calls++;return roll;});
  assert.equal(calls,3);assert.equal(result.length,3);assert.ok(result.every(id=>id===a.definitions[index].id));
  assert.equal(save.diamonds,9750);assert.equal(save.relics.fragments[result[0]],3);
 }
 const save=saveFor(a);save.diamonds=249;const before=JSON.stringify(save);
 assert.equal(a.buyPack(save,()=>assert.fail('unaffordable packs must not roll')),null);assert.equal(JSON.stringify(save),before);
});
test('three matching fragments forge a Basic relic for 50 diamonds and insufficient inputs change nothing',()=>{
 const a=api(),save=saveFor(a);save.relics.fragments={chili:2,magnet:1};
 const before=JSON.stringify(save);assert.equal(a.combine(save,'chili','fragment'),false);assert.equal(JSON.stringify(save),before);
 save.relics.fragments.chili=3;save.diamonds=49;assert.equal(a.combine(save,'chili','fragment'),false);
 save.diamonds=50;assert.equal(a.combine(save,'chili','fragment'),'basic:chili');assert.equal(save.diamonds,0);assert.equal(save.relics.fragments.chili,0);assert.equal(save.relics.fragments.magnet,1);assert.equal(save.relics.items['basic:chili'],1);
});
test('five matching Basics make Advanced for 250; five Advanced make Godly for 2000',()=>{
 const a=api(),save=saveFor(a);save.relics.items={'basic:spoon':25};
 for(let n=0;n<5;n++)assert.equal(a.combine(save,'spoon','basic'),'advanced:spoon');
 assert.equal(save.diamonds,8750);assert.equal(save.relics.items['basic:spoon'],0);assert.equal(save.relics.items['advanced:spoon'],5);
 assert.equal(a.combine(save,'spoon','advanced'),'godly:spoon');assert.equal(save.diamonds,6750);assert.equal(save.relics.items['godly:spoon'],1);
 assert.equal(a.combine(save,'spoon','godly'),false);assert.equal(a.combine(save,'missing','fragment'),false);
});
test('equipping is free, one relic per exact food variant, and one copy cannot be assigned twice',()=>{
 const a=api(),save=saveFor(a);save.relics.items={'basic:chili':1,'advanced:magnet':1};
 assert.equal(a.equip(save,'Peanut','basic:chili'),true);assert.equal(a.equip(save,'Golden Peanut','basic:chili'),false);
 assert.equal(a.equip(save,'Peanut','advanced:magnet'),true);assert.equal(a.available(save,'basic:chili'),1);
 assert.equal(a.equip(save,'Golden Peanut','basic:chili'),true);assert.equal(a.equip(save,'Peanut',null),true);
 assert.equal(a.available(save,'advanced:magnet'),1);assert.equal(save.diamonds,10000);
 assert.equal(a.equip(save,'Missing Food','basic:chili'),false);assert.equal(a.equip(save,'Cookie','godly:missing'),false);
});
test('combining protects equipped copies, and losing the last copy of a food frees its relic',()=>{
 const a=api(),save=saveFor(a);save.relics.items={'basic:fork':5};a.equip(save,'Peanut','basic:fork');
 assert.equal(a.combine(save,'fork','basic'),false);save.relics.items['basic:fork']=6;
 assert.equal(a.combine(save,'fork','basic'),'advanced:fork');assert.equal(save.relics.items['basic:fork'],1);assert.equal(save.relics.equipped.Peanut,'basic:fork');
 save.inventory.Peanut=0;a.cleanAssignments(save);assert.equal(save.relics.equipped.Peanut,undefined);assert.equal(a.available(save,'basic:fork'),1);
});
test('save normalization rejects invalid counts, unknown relics, duplicate assignments and unowned foods',()=>{
 const a=api(),bag=a.normalize({fragments:{chili:-5,magnet:Infinity,apron:3.9},items:{'basic:chili':1,'godly:fake':999},equipped:{Peanut:'basic:chili',Cookie:'basic:chili',Missing:'basic:chili'}},{Peanut:1,Cookie:1});
 assert.equal(bag.fragments.chili,0);assert.equal(bag.fragments.magnet,0);assert.equal(bag.fragments.apron,3);assert.equal(bag.items['godly:fake'],undefined);assert.deepEqual(plain(bag.equipped),{Peanut:'basic:chili'});
});
test('Advanced and Godly double all bonuses and penalties, with Pepper duration fixed at five seconds',()=>{
 const a=api();for(const {id} of a.definitions){const basic=a.effectsForKey(`basic:${id}`);
  for(const [tier,scale]of [['advanced',2],['godly',4]]){const effects=a.effectsForKey(`${tier}:${id}`);
   for(const key of Object.keys(basic)){const base=['luck','pepperSpeed','pepperGrowth'].includes(key)?0:1;near(effects[key]-base,(basic[key]-base)*scale);}
  }
 }
 near(a.effectsForKey('basic:chili').speed,1.05);near(a.effectsForKey('godly:chili').sprinkleGrowth,.92);
 near(a.effectsForKey('basic:magnet').pickup,1.07);near(a.effectsForKey('godly:magnet').points,.88);
 near(a.effectsForKey('advanced:apron').sprinkleGrowth,1.16);near(a.effectsForKey('advanced:apron').speed,.94);
 near(a.effectsForKey('basic:spoon').sprinklePoints,1.05);near(a.effectsForKey('basic:fork').rivalGrowth,1.15);
 assert.match(a.describe('godly:grinder'),/5 seconds/);assert.match(a.describe('advanced:spoon'),/−10%/);
});
// Load the real game/save/physics code with the existing deterministic game harness.
let harness=fs.readFileSync(path.join(__dirname,'bento.test.cjs'),'utf8').split('const thresholds =')[0];
harness=harness.replace('  const storage = new Map();','  let now=1000;const sent=[];const storage = new Map();')
 .replace('window: {}, Math: math, console,','sent, window: {}, Math: math, console, crypto:require("node:crypto"), Date:class extends Date {static now(){return now;}}, performance:{now:()=>now}, setTimeout(){},')
 .replace('  vm.runInContext(foods, context);','  vm.runInContext(fs.readFileSync(path.join(root,"relics.js"),"utf8"),context);\n  vm.runInContext(foods, context);')
 .replace('game.replace(marker,', 'game.replace("  const RING_MAJOR = 0.73;","").replace("  const RING_TUBE = 0.02;","").replace("  const FOOD_MODEL_SCALE = 2.15;","").replace("  const save = loadSave();","  const RING_MAJOR=.73, RING_TUBE=.02, FOOD_MODEL_SCALE=2.15; const save = loadSave();").replace(marker,')
 .replace('    globalThis.api = { save, state, net,','    netSend=msg=>sent.push(msg);\n    globalThis.api = { relics:window.GameRelics, persistSave, refreshPlayerRelics, createFood, moveSpeed, eatSprinkle, growthForEat, tryEatFood, resolveEats, ringReach, bodyReach, guestEatSprinkles, awardRunFood, pullWeight, setPull:fn=>{pullFood=fn;}, onGuestInput, packActor, save, state, net,')
 .replace('return { ...context.api, math, storage, elements };','return { ...context.api, math, storage, elements, sent, setTime:value=>{now=value;} };');
const ctx={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.boot=boot;',ctx);
function game(){const g=ctx.boot();g.state.running=true;g.state.mode='run';g.state.player=g.createFood(g.tierByName.Peanut,100,100);return g;}
function attach(g,key){g.save.relics.items[key]=1;assert.ok(g.relics.equip(g.save,'Peanut',key));g.refreshPlayerRelics();}
function sprinkle(g,points=100){const s={x:100,y:100,type:{points,radius:1,key:'small',color:'#fff'}};g.state.sprinkles=[s];g.eatSprinkle(g.state.player,s,0);}
test('food attachments persist through reload, remain tied to an exact food, and free themselves after food crafting',()=>{
 const g=game();attach(g,'advanced:chili');g.persistSave();const saved=JSON.parse(g.storage.get('sprinkleFeastSave'));const reload=ctx.boot(saved);
 assert.equal(reload.save.relics.equipped.Peanut,'advanced:chili');reload.state.player=reload.createFood(reload.tierByName.Peanut,0,0);reload.refreshPlayerRelics();near(reload.state.player.relicEffects.speed,1.1);
 reload.state.player=reload.createFood(reload.tierByName['Golden Peanut'],0,0);reload.refreshPlayerRelics();near(reload.state.player.relicEffects.speed,1);
 delete reload.save.inventory.Peanut;reload.persistSave();assert.equal(reload.save.relics.equipped.Peanut,undefined);assert.equal(reload.save.relics.items['advanced:chili'],1);
});
test('Chili, Apron, Spoon and Fork apply their exact movement, sprinkle growth, rival growth and point changes',()=>{
 for(const [id,speed,growth,points,rival]of [['chili',1.05,.98,1,.98],['apron',.97,1.08,1,1],['spoon',1,.95,1.05,1],['fork',1,.96,1,1.15]]){
  const g=game(),normal=g.moveSpeed(g.state.player);attach(g,`basic:${id}`);near(g.moveSpeed(g.state.player)/normal,speed);
  near(g.growthForEat(g.state.player),g.tierByName.Peanut.growth*rival);sprinkle(g);near(g.state.player.size,10+100*g.tierByName.Peanut.growth*growth);near(g.state.points,100*points);
 }
});
test('Magnet extends only sprinkle pickup, preserves eating range and reduces both sprinkle and rival points',()=>{
 const g=game();attach(g,'basic:magnet');const f=g.state.player;f.size=100;const body=g.bodyReach(f),ring=g.ringReach(f);
 const s={x:f.x+ring*1.04+1,y:f.y,type:{points:100,radius:1,key:'small',color:'#fff'}};g.state.sprinkles=[s];g.resolveEats();assert.equal(g.state.sprinkles.length,0);near(g.state.points,97);
 near(g.bodyReach(f),.5*f.drawRadius()*2.15);const prey=g.createFood(g.tierByName.Peanut,f.x,f.y,true);prey.size=10;prey.x=f.x+g.bodyReach(f)+g.bodyReach(prey)+1;
 assert.equal(g.tryEatFood(f,prey,[prey],0),false);prey.x=f.x;assert.equal(g.tryEatFood(f,prey,[prey],0),true);near(g.state.points,97+.97);
});
test('Pepper Grinder activates after eating a rival, refreshes without stacking, and expires at five seconds',()=>{
 const g=game();attach(g,'basic:grinder');const f=g.state.player;f.size=100;const normal=g.moveSpeed(f);
 const eat=()=>{const prey=g.createFood(g.tierByName.Peanut,100,100,true);prey.size=5;assert.ok(g.tryEatFood(f,prey,[prey],0));};
 eat();assert.equal(f.relicBuffUntil,6000);near(g.moveSpeed(f),g.tierByName.Peanut.speed*.5*1.1/Math.sqrt(Math.max(1,f.drawRadius()/(10+Math.sqrt(10)*2.2))));
 const before=f.size;sprinkle(g);near(f.size-before,100*g.tierByName.Peanut.growth*1.05);
 g.setTime(4000);eat();assert.equal(f.relicBuffUntil,9000);g.setTime(9000);near(g.growthForEat(f),g.tierByName.Peanut.growth);
 assert.ok(normal>0);g.relics.equip(g.save,'Peanut',null);g.refreshPlayerRelics();near(f.relicEffects.pepperSpeed,0);
});
test('Lucky Wishbone is captured per earned food, survives unequipping and death, and does not raise Bento luck',()=>{
 const g=game();attach(g,'godly:wishbone');near(g.state.player.relicEffects.luck,2);const permanent=g.permanentLuckBonus();
 g.awardRunFood();g.relics.equip(g.save,'Peanut',null);g.refreshPlayerRelics();g.awardRunFood();
 const seen=[];g.setPull((excluded,luck)=>{seen.push(luck);return g.tierByName.Peanut;});g.state.player=null;g.bankPendingFoods();assert.deepEqual(seen,[2,0]);near(g.permanentLuckBonus(),permanent);
 const uncommon=g.tierByName.Corn;assert.ok(g.pullWeight(uncommon,2)>g.pullWeight(uncommon,0));
});
test('multiplayer host applies the guest relic to growth and sends already-adjusted points exactly once',()=>{
 const g=game();g.net.role='host';const remote=g.createFood(g.tierByName.Peanut,100,100);remote.netId='guest';remote.zone='arena';g.net.humans.set('guest',remote);
 g.onGuestInput({id:'guest',relic:'basic:spoon',growth:1,speed:1});const s={x:100,y:100,type:{points:100,radius:1,color:'#fff'}};g.state.sprinkles=[s];g.eatSprinkle(remote,s,0);
 near(remote.size,10+100*g.tierByName.Peanut.growth*.95);near(g.sent.at(-1).pts,105);
 g.onGuestInput({id:'guest',relic:'godly:fake',growth:1,speed:1});near(remote.relicEffects.sprinklePoints,1);
});

test('a failed relic script stops startup before any saved inventory can be overwritten',()=>{
 const window={},message={},errors=[];let reads=0,writes=0;
 const context={window,document:{currentScript:{src:'game.js?v=240'},getElementById:()=>message},console:{error:(...args)=>errors.push(args)},
  localStorage:{getItem(){reads++;return '{}';},setItem(){writes++;}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'foods.js'),'utf8'),context);
 vm.runInNewContext(fs.readFileSync(path.join(root,'game.js'),'utf8'),context);
 assert.equal(reads,0);assert.equal(writes,0);assert.equal(errors.length,1);assert.match(message.textContent,/Relics failed to load/);
});
