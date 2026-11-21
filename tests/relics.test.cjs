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
 tooth:{rivalGrowth:[8,13,20,28,38,50]},
};
test('all 47 unique relic definitions include the 36 standard pack relics with exact stats',()=>{
 const a=api();assert.equal(a.relics.length,47);assert.equal(new Set(a.relics.map(relic=>relic.key)).size,47);
 for(const [family,stats]of Object.entries(expected))for(const [index,rarity]of rarityNames.entries()){
  const relic=a.getRelic(`${rarity}:${family}`);assert.ok(relic);assert.equal(relic.name,`${a.rarities[index].label} ${a.definitions.find(row=>row.id===family).name}`);
  assert.deepEqual(plain(relic.stats),Object.fromEntries(Object.entries(stats).map(([stat,values])=>[stat,values[index]])));
  const effects=a.effectsForKey(relic.key);for(const [stat,pct]of Object.entries(relic.stats))near(effects[stat],stat==='diamonds'?pct:1+pct/100);
  assert.ok(a.artHtml(family).includes(`#${family}`));
 }
});
test('all six prices and coalesced rarity odds match the specification and sum to exactly 100%',()=>{
 const a=api(),odds=[[8500,1000,400,100,0,0,0],[0,8500,1000,400,99,0,1],[0,0,8500,1000,400,90,10],[0,0,0,8500,1000,475,25],[0,0,0,0,8800,1100,100],[0,0,0,0,0,9700,300]];
 assert.deepEqual(Array.from(a.packs,pack=>pack.price),[250,1000,4000,12000,30000,90000]);
 for(const [index,pack]of a.packs.entries()){
  assert.equal(pack.odds.reduce((sum,row)=>sum+row.weight,0),10000);near(pack.odds.reduce((sum,row)=>sum+row.chance,0),100);
  assert.deepEqual([...rarityNames,'secret'].map(rarity=>pack.odds.find(row=>row.rarity===rarity)?.weight||0),odds[index]);
 }
});
test('rarity rolls use exact boundaries, including capped Epic, Legendary and Mythic results',()=>{
 const a=api();for(const pack of a.packs){let low=0;
  for(const row of pack.odds){const high=low+row.weight;
   for(const rarityRoll of [low/pack.weightTotal,high/pack.weightTotal-1e-10]){let calls=0;const result=a.roll(pack.id,()=>{calls++;return calls===1?rarityRoll:0;});assert.equal(a.getRelic(result).rarity,row.rarity);assert.equal(calls,2);}
   low=high;
  }
 }
});
test('standard family odds renormalize remaining weights and exclude removed families',()=>{
 const a=api();assert.equal(a.familyWeightTotal,296);
 for(const pack of a.packs){const counts={};for(let index=0;index<296;index++){let call=0;const key=a.roll(pack.id,()=>++call===1?0:(index+.5)/296);const family=a.getRelic(key).family;counts[family]=(counts[family]||0)+1;}
  for(const family of a.definitions.filter(row=>!row.rarities))assert.equal(counts[family.id],family.id==='badge'?41:51);
  assert.equal(Object.values(counts).reduce((sum,n)=>sum+n,0),296);
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
 a.equip(save,'mythic:fork');effects=a.effectsForKey(save.relics.equipped);near(effects.sprinkleGrowth,1.3);near(effects.speed,1);near(effects.sprinklePoints,1);
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
 const bag=a.normalize(raw,{food:'Peanut',completedTutorial:true});assert.equal(bag.schema,2);assert.equal(bag.items['common:chili'],2);assert.equal(bag.items['epic:badge'],1);assert.equal(bag.items['mythic:spoon'],1);assert.equal(bag.items['common:crown'],undefined);assert.equal(bag.equipped,'common:chili');assert.deepEqual(plain(bag.legacyArchive.fragments),raw.fragments);
 const again=a.normalize(plain(bag));assert.deepEqual(plain(again.items),plain(bag.items));const save={relics:again,inventory:{}};a.cleanAssignments(save);assert.equal(save.relics.equipped,'common:chili');
});
test('normalization rejects unknown relics and invalid counts without creating ownership',()=>{
 const a=api(),bag=a.normalize({schema:2,items:{'mythic:missing':10,'common:spoon':-5,'rare:fork':Infinity,'epic:badge':2.9},equipped:'common:spoon',diamondCarry:-5});
 assert.deepEqual(plain(bag.items),{'epic:badge':2});assert.equal(bag.equipped,null);assert.equal(bag.diamondCarry,undefined);assert.ok(!a.artHtml('<bad>').includes('<bad>'));
});
// Execute the real save, movement, reward and banking functions with a deterministic host.
let harness=fs.readFileSync(path.join(__dirname,'bento.test.cjs'),'utf8').split('const thresholds =')[0];
harness=harness.replace('    pullFood = () => tierByName.Peanut;', '    const realPullFood=pullFood; pullFood = () => tierByName.Peanut;').replace('  const storage = new Map();','  let now=1000;const sent=[];const storage = new Map();')
 .replace('window: {}, Math: math, console,','sent, window: {}, Math: math, console, crypto:require("node:crypto"), Date:class extends Date {static now(){return now;}}, performance:{now:()=>now}, setTimeout(){},')
 .replace('game.replace(marker,','game.replace("  const RING_MAJOR = 0.73;","").replace("  const RING_TUBE = 0.02;","").replace("  const FOOD_MODEL_SCALE = 2.15;","").replace("  const save = loadSave();","  const RING_MAJOR=.73, RING_TUBE=.02, FOOD_MODEL_SCALE=2.15; const save = loadSave();").replace(marker,')
 .replace('    globalThis.api = { save, state, net,','    netSend=msg=>sent.push(msg);\n    globalThis.api = { relics:window.GameRelics, gameWindow:window, realPullFood, pullWeight, restoreFoodRolls:()=>{pullFood=realPullFood;}, FOOD_TIERS, rarityById, setTutorialStep, persistSave, refreshPlayerRelics, createFood, moveSpeed, eatSprinkle, growthForEat, tryEatFood, addEatPoints, foodGainFactor, onGuestInput, save, state, net,')
 .replace('return { ...context.api, math, storage, elements };','return { ...context.api, math, storage, elements, sent };');
const ctx={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.boot=boot;',ctx);
function game(key=null){const g=ctx.boot();if(key){g.save.relics.items[key]=1;g.relics.equip(g.save,key);}g.state.running=true;g.state.runRelicKey=g.save.relics.equipped;g.state.mode='run';g.state.player=g.createFood(g.tierByName.Peanut,100,100);g.refreshPlayerRelics();return g;}
function sprinkle(g,type='small',points=100){const s={x:100,y:100,type:{points,radius:1,key:type,color:'#fff'}};g.state.sprinkles=[s];g.eatSprinkle(g.state.player,s,0);}
test('all six families apply only their named sources in real sprinkle and rival growth calculations',()=>{
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
test('Phantom Chopsticks boost rival points only and respect ten base food rewards before Double Foods',()=>{
 const g=game('secret:chopsticks');g.gameWindow.GameWeather={current:()=> 'double-foods'};const f=g.state.player;f.size=2e8;
 const prey=g.createFood(g.tierByName.Peanut,100,100,true);prey.size=1e8;assert.ok(g.tryEatFood(f,prey,[prey],0));assert.equal(g.state.foodsEarned,10);assert.equal(g.bankPendingFoods().length,20);
 const s=game('secret:chopsticks');sprinkle(s);near(s.state.points,100);const small=s.createFood(s.tierByName.Peanut,100,100,true);small.size=100;s.state.player.size=1000;assert.ok(s.tryEatFood(s.state.player,small,[small],0));near(s.state.points,115);
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
test('host applies Spoon and Chopsticks to guest point events once, with potion growth kept separate',()=>{
 const g=game();g.net.role='host';const remote=g.createFood(g.tierByName.Peanut,100,100);remote.netId='guest';remote.zone='lobby';g.net.humans.set('guest',remote);g.onGuestInput({id:'guest',relic:'mythic:spoon',growth:1.25,speed:1.25});
 const s={x:100,y:100,type:{points:100,key:'xs',radius:1,color:'#fff'}};g.state.sprinkles=[s];g.eatSprinkle(remote,s,0);near(g.sent.at(-1).pts,130);near(remote.size,10+100*remote.tier.growth*1.25);
 remote.zone='lobby';g.onGuestInput({id:'guest',relic:'secret:chopsticks',growth:1,speed:1});remote.zone='arena';remote.size=1000;const prey=g.createFood(g.tierByName.Peanut,100,100,true);prey.size=100;assert.ok(g.tryEatFood(remote,prey,[prey],0));near(g.sent.at(-1).pts,15);
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
 const a=api();for(const family of a.definitions.filter(row=>!row.rarities))for(let rank=0;rank<rarityNames.length;rank++){
  const source=a.keyFor(family.id,a.rarities[rank].id),target=a.keyFor(family.id,a.rarities[rank+1].id),save=saveFor(a);save.relics.items[source]=5;save.relics.items[target]=2;
  assert.equal(a.nextRelic(source).key,target);assert.equal(a.combine(save,source),target);assert.equal(save.relics.items[source],0);assert.equal(save.relics.items[target],3);assert.equal(save.diamonds,100000);
  assert.equal(a.combine(save,source),null);assert.equal(save.relics.items[target],3);
 }
});
test('combining rejects mixed families/rarities, insufficient copies, Godly and in-run actions',()=>{
 const a=api(),save=saveFor(a);save.relics.items={'common:spoon':3,'uncommon:spoon':2,'common:fork':2,'godly:chili':5,'rare:badge':10};
 const before=JSON.stringify(save);for(const [key,running]of [['common:spoon',false],['uncommon:spoon',false],['common:fork',false],['godly:chili',false],['missing',false],['rare:badge',true]])assert.equal(a.combine(save,key,running),null);
 assert.equal(JSON.stringify(save),before);assert.equal(a.nextRelic('godly:chili'),null);
});
test('using the last equipped copy equips the upgrade; remaining copies and other equipped families stay selected',()=>{
 const a=api(),save=saveFor(a);save.relics.items={'common:spoon':5,'common:chili':6,'rare:fork':1};a.equip(save,'common:spoon');a.combine(save,'common:spoon');assert.equal(save.relics.equipped,'uncommon:spoon');near(a.effectsForKey(save.relics.equipped).sprinklePoints,1.08);
 a.equip(save,'common:chili');a.combine(save,'common:chili');assert.equal(save.relics.items['common:chili'],1);assert.equal(save.relics.equipped,'common:chili');
 save.relics.items['uncommon:spoon']=5;a.equip(save,'rare:fork');a.combine(save,'uncommon:spoon');assert.equal(save.relics.equipped,'rare:fork');
});
test('combined ownership and the upgraded equipped relic persist across reloads',()=>{
 const a=api(),save=saveFor(a);save.relics.items['legendary:fork']=5;save.relics.tutorialGiftClaimed=true;a.equip(save,'legendary:fork');a.combine(save,'legendary:fork');
 const reloaded=a.normalize(plain(save.relics));assert.equal(reloaded.items['mythic:fork'],1);assert.equal(reloaded.items['legendary:fork']||0,0);assert.equal(reloaded.equipped,'mythic:fork');assert.equal(reloaded.tutorialGiftClaimed,true);
});

const secretStats={dragon:{speed:30,sprinkleGrowth:25},hat:{speed:20,sprinklePoints:25},chopsticks:{rivalGrowth:80,rivalPoints:50},truffle:{diamonds:100},forbidden:{luck:200}};
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
 const a=api(),save=saveFor(a),rolls=[0,0,.85,.18,.999,.75];
 assert.deepEqual(plain(a.buyPack(save,'common',false,()=>rolls.shift())),['common:spoon','uncommon:fork','epic:badge']);
 assert.equal(save.diamonds,99750);assert.equal(Object.values(save.relics.items).reduce((sum,n)=>sum+n,0),3);
 const before=JSON.stringify(save);let calls=0;assert.throws(()=>a.buyPack(save,'common',false,()=>++calls===4?NaN:0));assert.equal(JSON.stringify(save),before);
});

test('buying three of any pack charges the total once and awards nine independent relics with repeats',()=>{
 const a=api();for(const pack of a.packs){const save=saveFor(a);save.diamonds=pack.price*3;let calls=0;const results=a.buyPacks(save,pack.id,3,false,()=>{calls++;return 0;});
  assert.equal(save.diamonds,0);assert.equal(calls,18);assert.equal(results.length,3);assert.ok(results.every(keys=>keys.length===3));assert.equal(Object.values(save.relics.items).reduce((sum,n)=>sum+n,0),9);assert.equal(save.relics.items[results[0][0]],9);
  save.relics=a.normalize(plain(save.relics));assert.equal(save.relics.items[results[0][0]],9);assert.equal(save.relics.equipped,null);
 }
});
test('triple purchases reject insufficient total funds, invalid quantities and active runs without partial awards',()=>{
 const a=api(),save=saveFor(a);save.diamonds=749;const before=JSON.stringify(save);
 for(const [quantity,running]of [[3,false],[3,true],[0,false],[2,false],[4,false],[1.5,false],['3',false]])assert.equal(a.buyPacks(save,'common',quantity,running,()=>assert.fail('must not roll')),null);
 assert.equal(JSON.stringify(save),before);assert.equal(a.buyPacks(save,'missing',3),null);
});
test('a failed roll in the last pack leaves all diamonds and relics unchanged',()=>{
 const a=api(),save=saveFor(a),before=JSON.stringify(save);let calls=0;assert.throws(()=>a.buyPacks(save,'common',3,false,()=>++calls===18?NaN:0));assert.equal(calls,18);assert.equal(JSON.stringify(save),before);
});

test('Godly derives 1.5 times every Mythic bonus, preserves penalties and is combine-only',()=>{
 const a=api();assert.equal(a.relics.filter(row=>row.rarity==='godly').length,6);
 for(const [family,stats]of Object.entries(expected)){
  const relic=a.getRelic(`godly:${family}`);
  assert.deepEqual(plain(relic.stats),Object.fromEntries(Object.entries(stats).map(([stat,values])=>[stat,values[5]>0?values[5]*1.5:values[5]])));
  assert.equal(a.nextRelic(relic.key),null);assert.ok(!a.describe(relic.key).includes('undefined'));
 }
 assert.equal(a.packs.some(pack=>pack.id==='godly'||pack.odds.some(row=>row.rarity==='godly')),false);
});
test('five matching Mythics combine once into Godly, auto-equip, and survive the real save/reload path',()=>{
 const g=ctx.boot();g.save.relics.items={'mythic:fork':5,'mythic:spoon':4,'secret:dragon':1};
 g.relics.equip(g.save,'mythic:fork');const diamonds=g.save.diamonds;
 assert.equal(g.relics.combine(g.save,'mythic:fork',true),null);
 assert.equal(g.relics.combine(g.save,'mythic:spoon'),null);
 assert.equal(g.relics.combine(g.save,'mythic:fork'),'godly:fork');
 assert.equal(g.save.relics.equipped,'godly:fork');assert.equal(g.save.relics.items['mythic:fork'],0);
 assert.equal(g.save.relics.items['godly:fork'],1);assert.equal(g.save.diamonds,diamonds);
 assert.equal(g.relics.combine(g.save,'mythic:fork'),null);g.persistSave();
 const reloaded=ctx.boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
 assert.equal(reloaded.save.relics.equipped,'godly:fork');assert.equal(reloaded.save.relics.items['godly:fork'],1);
 assert.equal(reloaded.save.relics.items['mythic:spoon'],4);assert.equal(reloaded.save.relics.items['secret:dragon'],1);
});
test('Godly source-specific bonuses, diamond rounding and rival cap apply in real gameplay',()=>{
 for(const [family,stats]of Object.entries(expected)){
  const g=game(`godly:${family}`),f=g.state.player;
  const pct=stat=>{const v=stats[stat]?.[5]||0;return v>0?v*1.5:v;};
  const growth=1+pct('growth')/100;
  near(g.moveSpeed(f),f.tier.speed*.5*(1+pct('speed')/100));
  near(g.growthForEat(f),f.tier.growth*growth*(1+pct('rivalGrowth')/100));
  sprinkle(g);near(f.size,10+100*f.tier.growth*growth*(1+pct('sprinkleGrowth')/100));
  near(g.state.points,100*(1+pct('sprinklePoints')/100));
  const before=g.state.points;sprinkle(g,'xs');near(g.state.points-before,100*(1+pct('sprinklePoints')/100)*(1+pct('xsPoints')/100));
 }
 const dish=game('godly:dish');dish.state.foodsEarned=3;dish.state.foodWeather=Array(3).fill('triple-diamonds');dish.state.player=null;dish.endRun(true);assert.equal(dish.save.diamonds,16);dish.endRun(true);assert.equal(dish.save.diamonds,16);
 const medal=game('godly:tooth');medal.state.player.size=2e8;const prey=medal.createFood(medal.tierByName.Peanut,100,100,true);prey.size=1e8;
 assert.ok(medal.tryEatFood(medal.state.player,prey,[prey],0));assert.equal(medal.state.foodsEarned,10);
});

test('removed families have no definitions, drops, upgrades or equipped effects at any rarity',()=>{
 const a=api();for(const family of ['medal','ladle','goblet','crown'])for(const rarity of [...rarityNames,'godly']){
  const key=`${rarity}:${family}`,save=saveFor(a);save.relics.items[key]=10;save.relics.equipped=key;
  assert.equal(a.getRelic(key),null);assert.equal(a.nextRelic(key),null);assert.equal(a.combine(save,key),null);assert.equal(a.equip(save,key),false);
  const bag=a.normalize(plain(save.relics));assert.equal(bag.items[key],undefined);assert.equal(bag.equipped,null);
  near(a.effectsForKey(key).sprinkleGrowth,1);near(a.effectsForKey(key).rivalGrowth,1);near(a.effectsForKey(key).sprinklePoints,1);near(a.effectsForKey(key).rivalPoints,1);
 }
 const allowed=new Set(['spoon','fork','chili','dish','badge','tooth']);
 for(const pack of a.packs)for(const row of pack.odds){
  let lower=0;for(const prev of pack.odds){if(prev===row)break;lower+=prev.weight;}
  for(let index=0;index<296;index++){let calls=0;const key=a.roll(pack.id,()=>++calls===1?(lower+row.weight/2)/pack.weightTotal:(index+.5)/296);if(row.rarity!=='secret')assert.ok(allowed.has(a.getRelic(key).family));}
 }
});
test('existing Forbidden Fork copies become Forbidden Fortune with new stats and ownership intact',()=>{
 const a=api(),raw={schema:2,items:{'secret:forbidden':3,'secret:hat':1,'godly:ladle':2},equipped:'secret:forbidden',tutorialGiftClaimed:true};
 const bag=a.normalize(raw);assert.equal(bag.items['secret:forbidden'],3);assert.equal(bag.equipped,'secret:forbidden');assert.equal(bag.items['godly:ladle'],undefined);assert.equal(bag.items['secret:hat'],1);assert.equal(bag.tutorialGiftClaimed,true);
 const relic=a.getRelic('secret:forbidden');assert.equal(relic.name,'Secret Forbidden Fortune');assert.deepEqual(plain(relic.stats),{luck:200});
 assert.match(a.describe(relic.key),/\+200% food luck during a run/);assert.doesNotMatch(a.describe(relic.key),/movement speed|growth|points from sprinkles/);
 const old=a.normalize({items:{'basic:grinder':5},fragments:{magnet:12},equipped:{Peanut:'basic:grinder'}},{food:'Peanut'});assert.deepEqual(plain(old.items),{});assert.equal(old.equipped,null);
});
test('Forbidden Fortune adds exactly 200% food luck only to the locked run relic and leaves Bento and pack odds unchanged',()=>{
 const g=game('secret:forbidden'),base=g.permanentLuckBonus(),bento=plain(g.bentoRarityChances()),packs=plain(g.relics.packs);
 near(g.totalLuckBonus(),base+2);g.save.relics.items['secret:forbidden']=100;near(g.totalLuckBonus(),base+2);
 g.save.activePotions.luck={endsAt:999999,stacks:5};near(g.totalLuckBonus(),base+2.5+2);
 g.state.player.tier=g.tierByName.Cookie;g.refreshPlayerRelics();near(g.totalLuckBonus(),base+2.5+2);
 assert.deepEqual(plain(g.bentoRarityChances()),bento);assert.deepEqual(plain(g.relics.packs),packs);
 for(const food of g.FOOD_TIERS){const rank=g.rarityById[food.rarity].rank;near(g.pullWeight(food),(1/food.odds)*(1+(base+2.5+2)*rank));}
 g.state.running=false;near(g.totalLuckBonus(),base+2.5);
 g.relics.equip(g.save,'secret:hat');g.state.running=true;g.state.runRelicKey='secret:hat';near(g.totalLuckBonus(),base+2.5);
});
test('banking and death use Forbidden Fortune on the actual run food rolls after the run flag is cleared',()=>{
 for(const wipedOut of [false,true]){
  const g=game('secret:forbidden');g.restoreFoodRolls();g.state.running=false;
  let selected=null;
  for(let index=1;index<1000;index++){
   const roll=index/1000;g.math.random=()=>roll;
   const normal=g.realPullFood(null,null),boosted=g.realPullFood(null,'secret:forbidden');
   if(normal.name!==boosted.name){selected={roll,normal,boosted};break;}
  }
  assert.ok(selected,'the luck bonus changes actual food roll outcomes');
  g.math.random=()=>selected.roll;g.state.running=true;g.state.foodsEarned=1;g.state.foodWeather=['clear'];
  g.endRun(wipedOut);assert.equal(g.save.inventory[selected.boosted.name],selected.boosted.name==='Peanut'?2:1);
  assert.equal(g.save.inventory[selected.normal.name]||0,selected.normal.name==='Peanut'?1:0);
  near(g.totalLuckBonus(),g.permanentLuckBonus());
  const before=JSON.stringify(g.save.inventory);g.endRun(wipedOut);assert.equal(JSON.stringify(g.save.inventory),before);
 }
});
