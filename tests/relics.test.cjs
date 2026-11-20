const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),root=path.resolve(__dirname,'..');
const relicSource=fs.readFileSync(path.join(root,'relics.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function api(){const window={};vm.runInNewContext(relicSource,{window,Math});return window.GameRelics;}
const saveFor=a=>({diamonds:100000,inventory:{Peanut:1},relics:a.emptySave()});
const rarityNames=['common','uncommon','rare','epic','legendary','mythic'];
const expected={
 spoon:{sprinklePoints:[5,8,12,17,23,30]},fork:{sprinkleGrowth:[5,8,12,17,23,30]},chili:{speed:[3,5,7,10,12,15]},dish:{diamonds:[5,10,15,25,35,50]},
 badge:{speed:[1,2,3,4,5,6],sprinkleGrowth:[2,4,6,8,12,15],sprinklePoints:[2,4,6,8,12,15]},
 ladle:{sprinkleGrowth:[8,13,20,28,38,50],speed:[-2,-3,-5,-6,-8,-10]},goblet:{sprinklePoints:[5,8,13,20,30,40],sprinkleGrowth:[-3,-5,-8,-12,-15,-20]},
 tooth:{rivalGrowth:[8,13,20,28,38,50]},crown:{xsPoints:[10,20,35,50,75,100]},medal:{rivalPoints:[8,13,20,28,38,50]},
};
test('all 65 unique relic definitions include the 60 standard relics with exact stats',()=>{
 const a=api();assert.equal(a.relics.length,65);assert.equal(new Set(a.relics.map(relic=>relic.key)).size,65);
 for(const [family,stats]of Object.entries(expected))for(const [index,rarity]of rarityNames.entries()){
  const relic=a.getRelic(`${rarity}:${family}`);assert.ok(relic);assert.equal(relic.name,`${a.rarities[index].label} ${a.definitions.find(row=>row.id===family).name}`);
  assert.deepEqual(plain(relic.stats),Object.fromEntries(Object.entries(stats).map(([stat,values])=>[stat,values[index]])));
  const effects=a.effectsForKey(relic.key);for(const [stat,pct]of Object.entries(relic.stats))near(effects[stat],stat==='diamonds'?pct:1+pct/100);
  assert.ok(a.artHtml(family).includes(`#${family}`));
 }
});
test('all six prices and coalesced rarity odds match the specification and sum to exactly 100%',()=>{
 const a=api(),odds=[[825,100,50,25,0,0,0],[0,824,100,50,25,0,1],[0,0,820,100,50,25,5],[0,0,0,820,100,70,10],[0,0,0,0,900,75,25],[0,0,0,0,0,900,100]];
 assert.deepEqual(Array.from(a.packs,pack=>pack.price),[250,1000,4000,15000,50000,200000]);
 for(const [index,pack]of a.packs.entries()){
  assert.equal(pack.odds.reduce((sum,row)=>sum+row.weight,0),1000);near(pack.odds.reduce((sum,row)=>sum+row.chance,0),100);
  assert.deepEqual([...rarityNames,'secret'].map(rarity=>pack.odds.find(row=>row.rarity===rarity)?.weight||0),odds[index]);
 }
});
test('rarity rolls use exact boundaries, including capped Epic, Legendary and Mythic results',()=>{
 const a=api();for(const pack of a.packs){let low=0;
  for(const row of pack.odds){const high=low+row.weight;
   for(const rarityRoll of [low/1000,high/1000-1e-10]){let calls=0;const result=a.roll(pack.id,()=>{calls++;return calls===1?rarityRoll:0;});assert.equal(a.getRelic(result).rarity,row.rarity);assert.equal(calls,2);}
   low=high;
  }
 }
});
test('every rarity has 8.2% Chef’s Badge and 10.2% for each of the other nine families',()=>{
 const a=api();assert.equal(a.familyWeightTotal,500);
 for(const pack of a.packs){const counts={};for(let index=0;index<500;index++){let call=0;const key=a.roll(pack.id,()=>++call===1?0:(index+.5)/500);const family=a.getRelic(key).family;counts[family]=(counts[family]||0)+1;}
  for(const family of a.definitions.filter(row=>!row.rarities))assert.equal(counts[family.id],family.id==='badge'?41:51);
  assert.equal(Object.values(counts).reduce((sum,n)=>sum+n,0),500);
 }
});
test('purchases deduct one price and award three independent permanent results, including repeats',()=>{
 const a=api();for(const pack of a.packs){const save=saveFor(a);save.diamonds=pack.price*2;let calls=0;
  save.luck=1e9;save.activePotions={luck:{stacks:5}};save.weather='gold';const key=a.buyPack(save,pack.id,false,()=>{calls++;return 0;});
  assert.equal(save.diamonds,pack.price);assert.equal(calls,6);assert.equal(key.length,3);assert.equal(new Set(key).size,1);assert.equal(Object.values(save.relics.items).reduce((sum,n)=>sum+n,0),3);assert.equal(save.relics.items[key[0]],3);
  a.buyPack(save,pack.id,false,()=>0);assert.equal(save.relics.items[key[0]],6);assert.equal(save.relics.equipped,null);
 }
});
test('unaffordable, unknown and in-run purchases/equipment changes have no side effects or rolls',()=>{
 const a=api(),save=saveFor(a);save.diamonds=99;const before=JSON.stringify(save);
 for(const [pack,running]of [['common',false],['invalid',false],['mythic',true]])assert.equal(a.buyPack(save,pack,running,()=>assert.fail('must not roll')),null);
 assert.equal(JSON.stringify(save),before);save.relics.items['common:spoon']=1;a.equip(save,'common:spoon');
 assert.equal(a.equip(save,'mythic:spoon'),false);assert.equal(a.equip(save,null,true),false);assert.equal(save.relics.equipped,'common:spoon');
});
test('one globally equipped relic applies; owned copies and other owned families do not stack',()=>{
 const a=api(),save=saveFor(a);for(const relic of a.relics)save.relics.items[relic.key]=100;
 assert.ok(a.equip(save,'rare:spoon'));let effects=a.effectsForKey(save.relics.equipped);near(effects.sprinklePoints,1.12);near(effects.speed,1);near(effects.sprinkleGrowth,1);near(effects.rivalPoints,1);
 a.equip(save,'mythic:ladle');effects=a.effectsForKey(save.relics.equipped);near(effects.sprinkleGrowth,1.5);near(effects.speed,.9);near(effects.sprinklePoints,1);
 assert.equal(save.relics.items['rare:spoon'],100);a.equip(save,null);near(a.effectsForKey(save.relics.equipped).speed,1);
});
test('Diamond Dish rounds each run independently at every rarity and never saves fractions',()=>{
 const a=api();for(const [index,rarity]of rarityNames.entries()){
  let save=saveFor(a);save.diamonds=0;for(let run=0;run<100;run++){a.bankDiamonds(save,1,`${rarity}:dish`);save.relics=a.normalize(plain(save.relics));}
  assert.equal(save.diamonds,expected.dish.diamonds[index]===50?200:100);assert.equal(save.relics.diamondCarry,undefined);
 }
 for(const [base,bonus]of [[0,0],[9,0],[10,1],[11,1],[29,1],[30,2]]){
  const save=saveFor(a);save.diamonds=0;const reward=a.bankDiamonds(save,base,'common:dish');assert.equal(reward.bonus,bonus);assert.equal(save.diamonds,base+bonus);assert.equal('carry' in reward,false);
 }
 const save=saveFor(a);save.diamonds=0;const reward=a.bankDiamonds(save,303,'mythic:dish');assert.equal(reward.bonus,152);assert.equal(reward.total,455);assert.equal(save.relics.diamondCarry,undefined);
 a.bankDiamonds(save,1,null);a.bankDiamonds(save,2,'common:dish');assert.equal(save.diamonds,458);
});
test('old carried fractions are discarded on reload and cannot increase any future run reward',()=>{
 const a=api(),raw=a.emptySave();raw.items['common:dish']=1;raw.equipped='common:dish';raw.diamondCarry=99;
 const save={diamonds:0,relics:a.normalize(raw)};assert.equal('diamondCarry' in save.relics,false);assert.equal(save.relics.equipped,'common:dish');assert.equal(save.relics.items['common:dish'],1);
 const reward=a.bankDiamonds(save,1,save.relics.equipped);assert.equal(reward.bonus,0);assert.equal(save.diamonds,1);assert.ok(!JSON.stringify(save).includes('diamondCarry'));
});
test('the free Common tutorial pack is claimable once, costs no diamonds, and cannot be claimed in a run',()=>{
 const a=api(),save=saveFor(a);save.diamonds=0;assert.equal(a.claimTutorialPack(save),null);a.unlockTutorialGift(save);
 assert.equal(a.claimTutorialPack(save,true,()=>assert.fail()),null);const key=a.claimTutorialPack(save,false,()=>0);assert.deepEqual(plain(key),['common:spoon','common:spoon','common:spoon']);assert.equal(save.diamonds,0);assert.equal(save.relics.items[key[0]],3);
 save.relics=a.normalize(plain(save.relics),{completedTutorial:true});a.unlockTutorialGift(save);assert.equal(a.claimTutorialPack(save,false,()=>assert.fail('cannot reroll')),null);assert.equal(save.relics.items[key[0]],3);
});
test('old collections migrate once, preserve an archive and keep ownership independent of food inventory',()=>{
 const a=api(),raw={items:{'basic:chili':2,'advanced:apron':1,'godly:spoon':1},fragments:{magnet:6,spoon:2},equipped:{Peanut:'basic:chili'}};
 const bag=a.normalize(raw,{food:'Peanut',completedTutorial:true});assert.equal(bag.schema,2);assert.equal(bag.items['common:chili'],2);assert.equal(bag.items['epic:badge'],1);assert.equal(bag.items['mythic:spoon'],1);assert.equal(bag.items['common:crown'],2);assert.equal(bag.equipped,'common:chili');assert.deepEqual(plain(bag.legacyArchive.fragments),raw.fragments);
 const again=a.normalize(plain(bag));assert.deepEqual(plain(again.items),plain(bag.items));const save={relics:again,inventory:{}};a.cleanAssignments(save);assert.equal(save.relics.equipped,'common:chili');
});
test('normalization rejects unknown relics and invalid counts without creating ownership',()=>{
 const a=api(),bag=a.normalize({schema:2,items:{'mythic:missing':10,'common:spoon':-5,'rare:fork':Infinity,'epic:badge':2.9},equipped:'common:spoon',diamondCarry:-5});
 assert.deepEqual(plain(bag.items),{'epic:badge':2});assert.equal(bag.equipped,null);assert.equal(bag.diamondCarry,undefined);assert.ok(!a.artHtml('<bad>').includes('<bad>'));
});
// Execute the real save, movement, reward and banking functions with a deterministic host.
let harness=fs.readFileSync(path.join(__dirname,'bento.test.cjs'),'utf8').split('const thresholds =')[0];
harness=harness.replace('  const storage = new Map();','  let now=1000;const sent=[];const storage = new Map();')
 .replace('window: {}, Math: math, console,','sent, window: {}, Math: math, console, crypto:require("node:crypto"), Date:class extends Date {static now(){return now;}}, performance:{now:()=>now}, setTimeout(){},')
 .replace('game.replace(marker,','game.replace("  const RING_MAJOR = 0.73;","").replace("  const RING_TUBE = 0.02;","").replace("  const FOOD_MODEL_SCALE = 2.15;","").replace("  const save = loadSave();","  const RING_MAJOR=.73, RING_TUBE=.02, FOOD_MODEL_SCALE=2.15; const save = loadSave();").replace(marker,')
 .replace('    globalThis.api = { save, state, net,','    netSend=msg=>sent.push(msg);\n    globalThis.api = { relics:window.GameRelics, gameWindow:window, setTutorialStep, persistSave, refreshPlayerRelics, createFood, moveSpeed, eatSprinkle, growthForEat, tryEatFood, addEatPoints, foodGainFactor, onGuestInput, save, state, net,')
 .replace('return { ...context.api, math, storage, elements };','return { ...context.api, math, storage, elements, sent };');
const ctx={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.boot=boot;',ctx);
function game(key=null){const g=ctx.boot();if(key){g.save.relics.items[key]=1;g.relics.equip(g.save,key);}g.state.running=true;g.state.runRelicKey=g.save.relics.equipped;g.state.mode='run';g.state.player=g.createFood(g.tierByName.Peanut,100,100);g.refreshPlayerRelics();return g;}
function sprinkle(g,type='small',points=100){const s={x:100,y:100,type:{points,radius:1,key:type,color:'#fff'}};g.state.sprinkles=[s];g.eatSprinkle(g.state.player,s,0);}
test('all ten families apply only their named sources in real sprinkle and rival growth calculations',()=>{
 for(const family of Object.keys(expected)){
  const g=game(`mythic:${family}`),f=g.state.player,e=g.relics.effectsForKey(`mythic:${family}`),baseSpeed=g.tierByName.Peanut.speed*.5;
  near(g.moveSpeed(f),baseSpeed*e.speed);near(g.growthForEat(f),f.tier.growth*e.rivalGrowth);sprinkle(g,'small');near(f.size,10+100*f.tier.growth*e.sprinkleGrowth);near(g.state.points,100*e.sprinklePoints);
  const before=g.state.points;sprinkle(g,'xs');near(g.state.points-before,100*e.sprinklePoints*e.xsPoints);
 }
});
test('food and potion calculations receive each percentage modifier exactly once',()=>{
 const g=game('mythic:badge');for(const id of ['speed','growth','points'])g.save.activePotions[id]={endsAt:999999,stacks:1};
 const f=g.state.player;near(g.moveSpeed(f),f.tier.speed*.5*1.25*1.06);sprinkle(g,'small');near(f.size,10+100*f.tier.growth*1.25*1.15);near(g.state.points*g.foodGainFactor(),100*1.15*((1+f.tier.multiplier)/2)*1.25);
});
test('Feast Medal boosts rival points only and respects ten base food rewards before Double Foods',()=>{
 const g=game('mythic:medal');g.gameWindow.GameWeather={current:()=> 'double-foods'};const f=g.state.player;f.size=2e8;
 const prey=g.createFood(g.tierByName.Peanut,100,100,true);prey.size=1e8;assert.ok(g.tryEatFood(f,prey,[prey],0));assert.equal(g.state.foodsEarned,10);assert.equal(g.bankPendingFoods().length,20);
 const s=game('mythic:medal');sprinkle(s);near(s.state.points,100);const small=s.createFood(s.tierByName.Peanut,100,100,true);small.size=100;s.state.player.size=1000;assert.ok(s.tryEatFood(s.state.player,small,[small],0));near(s.state.points,115);
});
test('Diamond Dish rounds the weather-inclusive bonus once on death and preserves relic ownership',()=>{
 const g=game('mythic:dish');g.state.foodsEarned=3;g.state.foodWeather=['triple-diamonds','triple-diamonds','triple-diamonds'];g.state.player=null;g.endRun(true);
 assert.equal(g.save.diamonds,14);assert.equal(g.save.relics.diamondCarry,undefined);assert.equal(g.save.relics.items['mythic:dish'],1);assert.equal(g.save.relics.equipped,'mythic:dish');g.endRun(true);assert.equal(g.save.diamonds,14);
 const reload=ctx.boot(JSON.parse(g.storage.get('sprinkleFeastSave')));assert.equal(reload.save.relics.diamondCarry,undefined);assert.equal(reload.save.relics.equipped,'mythic:dish');
});
test('run relic stays locked across food changes, attempted equips and guest input updates',()=>{
 const g=game('rare:spoon');g.save.relics.items['mythic:chili']=1;assert.equal(g.relics.equip(g.save,'mythic:chili',g.state.running),false);
 g.state.player.tier=g.tierByName.Cookie;g.refreshPlayerRelics();assert.equal(g.state.player.relicKey,'rare:spoon');near(g.state.player.relicEffects.sprinklePoints,1.12);
 const remote=g.createFood(g.tierByName.Peanut,100,100);remote.netId='guest';remote.zone='lobby';g.net.humans.set('guest',remote);g.onGuestInput({id:'guest',relic:'rare:fork'});remote.zone='arena';g.onGuestInput({id:'guest',relic:'mythic:chili'});assert.equal(remote.relicKey,'rare:fork');near(remote.relicEffects.sprinkleGrowth,1.12);
});
test('host applies Crown and Feast to guest point events once, with potion growth kept separate',()=>{
 const g=game();g.net.role='host';const remote=g.createFood(g.tierByName.Peanut,100,100);remote.netId='guest';remote.zone='lobby';g.net.humans.set('guest',remote);g.onGuestInput({id:'guest',relic:'mythic:crown',growth:1.25,speed:1.25});
 const s={x:100,y:100,type:{points:100,key:'xs',radius:1,color:'#fff'}};g.state.sprinkles=[s];g.eatSprinkle(remote,s,0);near(g.sent.at(-1).pts,200);near(remote.size,10+100*remote.tier.growth*1.25);
 remote.zone='lobby';g.onGuestInput({id:'guest',relic:'mythic:medal',growth:1,speed:1});remote.zone='arena';remote.size=1000;const prey=g.createFood(g.tierByName.Peanut,100,100,true);prey.size=100;assert.ok(g.tryEatFood(remote,prey,[prey],0));near(g.sent.at(-1).pts,15);
});
test('tutorial finish unlocks the gift once, skipping does not, and replay does not renew a claim',()=>{
 const skipped=ctx.boot(undefined,true);skipped.setTutorialStep('done');assert.equal(skipped.save.relics.tutorialGiftEligible,false);
 const g=ctx.boot(undefined,true);g.setTutorialStep('finish');g.setTutorialStep('done');assert.equal(g.save.tutorial.completed,true);assert.equal(g.save.relics.tutorialGiftEligible,true);
 g.relics.claimTutorialPack(g.save,false,()=>0);g.persistSave();const reload=ctx.boot(JSON.parse(g.storage.get('sprinkleFeastSave')));reload.setTutorialStep('start');reload.setTutorialStep('finish');reload.setTutorialStep('done');assert.equal(reload.relics.claimTutorialPack(reload.save),null);
});
test('a confirmed guest run locks the host relic even if the lobby selection changed before confirmation',()=>{
 const source=fs.readFileSync(path.join(root,'game.js'),'utf8'),start=source.indexOf('  function guestBeginRun('),end=source.indexOf('\n  function ',start+1),noop=()=>{},element=()=>({classList:{add:noop},innerHTML:''});
 const state={},c={state,save:{relics:{equipped:'mythic:dish'}},net:{},window:{},performance:{now:()=>1234},view:null,previewId:0,lastTime:0,
  closeRelics:noop,closeIndex:noop,closeInventory:noop,closeShop:noop,closeCraft:noop,closeMulti:noop,restoreCarriedPoints:noop,updateHud:noop,cancelAnimationFrame:noop,requestAnimationFrame:()=>1,loop:noop};
 for(const name of ['pullResultsEl','lobbyHintEl','overlay','endBtn','inventoryBtn','shopBtn','craftBtn'])c[name]=element();
 vm.runInNewContext(source.slice(start,end)+'\nguestBeginRun(7,"rare:fork");',c);assert.equal(state.running,true);assert.equal(state.runRelicKey,'rare:fork');
});
test('five identical copies upgrade every family by exactly one rarity without spending diamonds',()=>{
 const a=api();for(const family of a.definitions.filter(row=>!row.rarities))for(let rank=0;rank<rarityNames.length-1;rank++){
  const source=a.keyFor(family.id,a.rarities[rank].id),target=a.keyFor(family.id,a.rarities[rank+1].id),save=saveFor(a);save.relics.items[source]=5;save.relics.items[target]=2;
  assert.equal(a.nextRelic(source).key,target);assert.equal(a.combine(save,source),target);assert.equal(save.relics.items[source],0);assert.equal(save.relics.items[target],3);assert.equal(save.diamonds,100000);
  assert.equal(a.combine(save,source),null);assert.equal(save.relics.items[target],3);
 }
});
test('combining rejects mixed families/rarities, insufficient copies, Mythic and in-run actions',()=>{
 const a=api(),save=saveFor(a);save.relics.items={'common:spoon':3,'uncommon:spoon':2,'common:fork':2,'mythic:chili':5,'rare:badge':10};
 const before=JSON.stringify(save);for(const [key,running]of [['common:spoon',false],['uncommon:spoon',false],['common:fork',false],['mythic:chili',false],['missing',false],['rare:badge',true]])assert.equal(a.combine(save,key,running),null);
 assert.equal(JSON.stringify(save),before);assert.equal(a.nextRelic('mythic:chili'),null);
});
test('using the last equipped copy equips the upgrade; remaining copies and other equipped families stay selected',()=>{
 const a=api(),save=saveFor(a);save.relics.items={'common:spoon':5,'common:chili':6,'rare:fork':1};a.equip(save,'common:spoon');a.combine(save,'common:spoon');assert.equal(save.relics.equipped,'uncommon:spoon');near(a.effectsForKey(save.relics.equipped).sprinklePoints,1.08);
 a.equip(save,'common:chili');a.combine(save,'common:chili');assert.equal(save.relics.items['common:chili'],1);assert.equal(save.relics.equipped,'common:chili');
 save.relics.items['uncommon:spoon']=5;a.equip(save,'rare:fork');a.combine(save,'uncommon:spoon');assert.equal(save.relics.equipped,'rare:fork');
});
test('combined ownership and the upgraded equipped relic persist across reloads',()=>{
 const a=api(),save=saveFor(a);save.relics.items['legendary:ladle']=5;save.relics.tutorialGiftClaimed=true;a.equip(save,'legendary:ladle');a.combine(save,'legendary:ladle');
 const reloaded=a.normalize(plain(save.relics));assert.equal(reloaded.items['mythic:ladle'],1);assert.equal(reloaded.items['legendary:ladle']||0,0);assert.equal(reloaded.equipped,'mythic:ladle');assert.equal(reloaded.tutorialGiftClaimed,true);
});

const secretStats={dragon:{speed:30,sprinkleGrowth:20},hat:{speed:15,sprinklePoints:20},chopsticks:{rivalGrowth:80,rivalPoints:50},truffle:{diamonds:100},forbidden:{sprinkleGrowth:50,sprinklePoints:25,speed:-15}};
test('all five Secret relics have exact stats, equal conditional odds, unique art and no upgrades',()=>{
 const a=api(),secrets=a.relics.filter(row=>row.rarity==='secret');assert.equal(secrets.length,5);
 for(const relic of secrets){assert.deepEqual(plain(relic.stats),secretStats[relic.family]);assert.equal(a.nextRelic(relic.key),null);assert.ok(a.artHtml(relic.family).includes(`#${relic.family}`));}
 for(const pack of a.packs.slice(1)){
  const counts={};for(let i=0;i<500;i++){let call=0;const key=a.roll(pack.id,()=>++call===1?.99999:(i+.5)/500);assert.equal(a.getRelic(key).rarity,'secret');counts[key]=(counts[key]||0)+1;}
  assert.equal(Object.keys(counts).length,5);for(const n of Object.values(counts))assert.equal(n,100);
 }
 assert.equal(a.getRelic('secret:spoon'),null);assert.equal(a.getRelic('mythic:dragon'),null);
});
test('Secret effects follow real source-specific growth, speed, reward caps and banking paths',()=>{
 for(const [family,stats] of Object.entries(secretStats)){
  const g=game(`secret:${family}`),f=g.state.player,e=g.relics.effectsForKey(f.relicKey);
  near(g.moveSpeed(f),g.tierByName.Peanut.speed*.5*e.speed);near(g.growthForEat(f),f.tier.growth*e.rivalGrowth);
  sprinkle(g);near(f.size,10+100*f.tier.growth*e.sprinkleGrowth);near(g.state.points,100*e.sprinklePoints);
  const reloaded=g.relics.normalize(plain(g.save.relics));assert.equal(reloaded.equipped,`secret:${family}`);assert.equal(reloaded.items[`secret:${family}`],1);
 }
 const g=game('secret:chopsticks');g.state.player.size=2e8;const prey=g.createFood(g.tierByName.Peanut,100,100,true);prey.size=1e8;assert.ok(g.tryEatFood(g.state.player,prey,[prey],0));assert.equal(g.state.foodsEarned,10);
 const t=game('secret:truffle');t.state.foodsEarned=3;t.state.foodWeather=['triple-diamonds','triple-diamonds','triple-diamonds'];t.state.player=null;t.endRun(true);assert.equal(t.save.diamonds,18);t.endRun(true);assert.equal(t.save.diamonds,18);
});

test('three results may have different rarities and families; a failed roll awards nothing and spends nothing',()=>{
 const a=api(),save=saveFor(a),rolls=[0,0,.825,.11,.999,.45];
 assert.deepEqual(plain(a.buyPack(save,'common',false,()=>rolls.shift())),['common:spoon','uncommon:fork','epic:badge']);
 assert.equal(save.diamonds,99750);assert.equal(Object.values(save.relics.items).reduce((sum,n)=>sum+n,0),3);
 const before=JSON.stringify(save);let calls=0;assert.throws(()=>a.buyPack(save,'common',false,()=>++calls===4?NaN:0));assert.equal(JSON.stringify(save),before);
});
