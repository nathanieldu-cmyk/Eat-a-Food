const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
const interval = 900000, duration = 180000;
const noon = Date.parse('2026-11-14T12:00:00-06:00');
const types = ['double-foods','triple-diamonds','bento-frenzy','gold','rainbow','shadow'];
function boot(start = noon + 10 * 60000, feed, saved) {
 let now=start, rolls=0;
 const elements=new Map(),events={},windowEvents={},timers=[],requests=[];
 const math=Object.create(Math);math.random=()=>{rolls++;return .9;};
 class Clock extends Date {static now(){return now;}}
 const window={addEventListener(k,fn){windowEvents[k]=fn;}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'weather.js'),'utf8').replace('window.GameWeather = { current:', 'window.GameWeather = { typeForRoll: eventTypeForRoll, current:'),{
   window,Date:Clock,Math:math,
   document:{createElement(){return {style:{},className:''};},getElementById(id){if(!elements.has(id))elements.set(id,{dataset:{},textContent:'',children:[],appendChild(child){this.children.push(child);}});return elements.get(id);},addEventListener(k,fn){events[k]=fn;}},
   localStorage:{getItem(){return saved;},setItem(){throw Error('storage unavailable');}},
   setInterval(fn,ms){timers.push({fn,ms});},AbortController,setTimeout:()=>1,clearTimeout(){},
   fetch:feed?async(url,options)=>{requests.push({url,options});return feed();}:undefined,
 });
 return {api:window.GameWeather,elements,events,windowEvents,requests,rolls:()=>rolls,setTime:n=>{now=n;},tick:()=>timers.find(t=>t.ms===1000).fn(),sync:()=>timers.find(t=>t.ms===15000).fn()};
}
test('every quarter hour starts one of six events for exactly three minutes',()=>{
 const g=boot();
 for(let n=0;n<96;n++){
   const start=noon+n*interval;
   g.setTime(start-1);assert.equal(g.api.current(),'clear');
   g.setTime(start);g.tick();const type=g.api.current();assert.ok(types.includes(type));
   assert.equal(g.elements.get('weather-effects').dataset.weather,type);
   assert.equal(g.elements.get('weather-countdown').textContent,'Event ends in 3:00');
   g.setTime(start+duration-1);assert.equal(g.api.current(),type);
   g.setTime(start+duration);g.tick();assert.equal(g.api.current(),'clear');
   assert.equal(g.elements.get('weather-countdown').textContent,'Next event in 12:00');
   assert.match(g.elements.get('weather-detail').textContent,/Next at /);
 }
 assert.equal(g.rolls(),0,'weather and visuals never consume gameplay randomness');
});
test('six weighted events use exact probability boundaries and sum to 100%',()=>{
 const g=boot(),counts=Object.fromEntries(types.map(t=>[t,0]));
 for(const [roll,type] of [[0,'double-foods'],[.249999,'double-foods'],[.25,'triple-diamonds'],[.449999,'triple-diamonds'],[.45,'bento-frenzy'],[.649999,'bento-frenzy'],[.65,'gold'],[.849999,'gold'],[.85,'rainbow'],[.949999,'rainbow'],[.95,'shadow'],[.999999,'shadow']])assert.equal(g.api.typeForRoll(roll),type);
 for(let n=0;n<10000;n++)counts[g.api.typeForRoll((n+.5)/10000)]++;
 assert.deepEqual(counts,{'double-foods':2500,'triple-diamonds':2000,'bento-frenzy':2000,gold:2000,rainbow:1000,shadow:500});
 const scheduled=Object.fromEntries(types.map(t=>[t,0]));for(let n=0;n<16384;n++){g.setTime(noon+n*interval);scheduled[g.api.current()]++;}
 for(const type of types)assert.ok(Math.abs(scheduled[type]-counts[type]*16384/10000)<200,JSON.stringify(scheduled));
});
test('late arrivals, reloads, old saves and background restoration share the clock and event type',()=>{
 const start=noon+interval;
 const a=boot(start),b=boot(start+60000,undefined,JSON.stringify({type:'gold',nextRoll:start+12345,endsAt:start+54321}));
 assert.equal(a.api.current(),b.api.current());
 assert.equal(b.elements.get('weather-countdown').textContent,'Event ends in 2:00');
 a.setTime(start+duration);a.events.visibilitychange();assert.equal(a.api.current(),'clear');
 a.setTime(start+10*interval+duration);a.windowEvents.pageshow();
 assert.equal(a.elements.get('weather-countdown').textContent,'Next event in 12:00');
 a.setTime(start+11*interval);a.tick();const next=boot(start+11*interval+1000);
 assert.equal(a.api.current(),next.api.current());
 assert.equal(next.elements.get('weather-countdown').textContent,'Event ends in 2:59');
});
test('Triple Diamonds and Double Foods have distinct names, explanations and effects',()=>{
 const g=boot();const seen=new Set();
 for(let n=0;n<100&&seen.size<6;n++){
   g.setTime(noon+n*interval);g.tick();const type=g.api.current();seen.add(type);
   if(type==='triple-diamonds'){assert.match(g.elements.get('weather-name').textContent,/Triple Diamonds/);assert.match(g.elements.get('weather-detail').textContent,/3× diamonds/);}
   if(type==='double-foods'){assert.match(g.elements.get('weather-name').textContent,/Double Foods/);assert.match(g.elements.get('weather-detail').textContent,/Foods duplicated at collection/);}
 }
 assert.equal(seen.size,6);assert.equal(g.elements.get('weather-effects').children.length,64);
});
let harness=fs.readFileSync(path.join(__dirname,'bento.test.cjs'),'utf8').split('const thresholds =')[0];
harness=harness.replace('window: {}, Math: math, console,','window: {GameWeather:{current:()=>weather}}, Math: math, console,')
 .replace('function boot(saved) {','function boot(saved) {\n  let weather="clear";')
 .replace('globalThis.api = { save, state, net,','globalThis.api = { relics:window.GameRelics, setPull: fn => {pullFood=fn;}, awardRunFood, applyFoodWeather, save, state, net,')
 .replace('return { ...context.api, math, storage, elements };','return { ...context.api, math, storage, elements, setWeather:w=>{weather=w;} };');
const ctx={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.gameBoot=boot;',ctx);
const gameBoot=ctx.gameBoot;
test('Gold retains its odds while Rainbow uses lower rarity odds, preserving identity and ignoring luck', () => {
 const ratesByWeather={
   gold:{common:.10,uncommon:.075,rare:.05,epic:.025,legendary:.01,mythic:.005},
   rainbow:{common:.075,uncommon:.05,rare:.025,epic:.01,legendary:.005,mythic:.005},
 };
 for(const boosted of [false,true]) {
   const g=gameBoot();
   if(boosted){g.save.bento.opened=100000;g.save.activePotions.luck={endsAt:Date.now()+60000,stacks:5};}
   for(const weather of ['gold','rainbow']) {
     const rates=ratesByWeather[weather];
     for(const base of Object.values(g.tierByName).filter(t=>!t.isGolden&&!t.isShiny&&!t.isShadow)) {
       const chance=rates[base.rarity];assert.ok(chance);
       for(const roll of [0,chance-1e-9,chance,.999999]) {
         g.math.random=()=>roll;
         const food=g.applyFoodWeather(base,weather);
         assert.equal(food.name,roll<chance?`${weather==='gold'?'Golden':'Rainbow'} ${base.name}`:base.name);
         assert.equal(food.rarity,base.rarity);
       }
     }
     for(const [rarity,chance] of Object.entries(rates)) {
       const base=Object.values(g.tierByName).find(t=>t.rarity===rarity&&!t.isGolden&&!t.isShiny&&!t.isShadow);
       let converted=0;
       for(let n=0;n<2000;n++){g.math.random=()=> (n+.5)/2000;if(g.applyFoodWeather(base,weather).name!==base.name)converted++;}
       assert.equal(converted,chance*2000,`${weather} ${rarity}`);
     }
   }
   g.math.random=()=>0;
   assert.equal(g.applyFoodWeather(g.tierByName.Peanut,'clear').name,'Peanut');
   for(const name of ['Rainbow Peanut','Shadow Peanut'])for(const weather of ['gold','rainbow'])assert.equal(g.applyFoodWeather(g.tierByName[name],weather).name,name);
   assert.equal(g.applyFoodWeather(g.tierByName['Golden Peanut'],'gold').name,'Golden Peanut');
   assert.equal(g.applyFoodWeather(g.tierByName['Golden Peanut'],'rainbow').name,'Rainbow Peanut');
 }
});
test('weather is captured for each earned food, survives expiration, banks and discovers on manual end or death for every role', () => {
 for(const role of [null,'host','guest']) for(const death of [false,true]) {
   const g=gameBoot();g.state.running=true;g.state.player={tier:g.tierByName.Peanut};g.net.role=role;
   for(const weather of ['clear','gold','rainbow','gold']) {g.setWeather(weather);g.awardRunFood();}
   g.setWeather('clear');g.math.random=()=>0;g.endRun(death);
   assert.equal(g.save.inventory['Golden Peanut'],2);
   assert.equal(g.save.inventory['Rainbow Peanut'],1);
   assert.equal(g.save.discovered['Golden Peanut'],true);assert.equal(g.save.discovered['Rainbow Peanut'],true);
   const saved=JSON.parse(g.storage.get('sprinkleFeastSave'));
   assert.equal(saved.inventory['Golden Peanut'],2);assert.equal(saved.inventory['Rainbow Peanut'],1);
   const before=JSON.stringify(saved.inventory);g.endRun(death);assert.equal(JSON.stringify(g.save.inventory),before);
 }
});
test('weather leaves Bento contents and non-weather run foods unchanged', () => {
 const g=gameBoot();g.setWeather('rainbow');g.math.random=()=>0;
 g.save.bento.ready=1;g.save.bento.readyTypes=['normal'];g.openBento();
 assert.ok(Object.keys(g.save.inventory).every(n=>!n.startsWith('Rainbow ')&&!n.startsWith('Golden ')));
 g.setWeather('clear');g.awardRunFood();g.setWeather('rainbow');assert.equal(g.bankPendingFoods()[0],'Peanut');
});


test('Double Foods keeps base counts and duplicates at collection while Triple Diamonds banks independently for every role and ending',()=>{
 for(const role of [null,'host','guest'])for(const death of [false,true]){
   const g=gameBoot();g.state.running=true;g.state.player={tier:g.tierByName.Peanut};g.net.role=role;
   const before=g.save.inventory.Peanut;
   for(const type of ['clear','triple-diamonds','double-foods','gold','rainbow','triple-diamonds']){g.setWeather(type);g.awardRunFood();}
   assert.equal(g.state.foodsEarned,6);assert.equal(g.elements.get('food-count').textContent,'6');
   assert.equal(g.state.foodWeather.filter(t=>t==='double-foods').length,1);
   g.setWeather('clear');g.math.random=()=>.9;g.endRun(death);
   assert.equal(g.save.inventory.Peanut,before+7);assert.equal(g.save.diamonds,10);assert.equal(g.save.bestRun,6);
   assert.match(g.elements.get('overlay-msg').textContent,/Banked 7 foods and 10 diamonds/);
   const saved=JSON.parse(g.storage.get('sprinkleFeastSave'));const reloaded=gameBoot(saved);
   assert.equal(reloaded.save.inventory.Peanut,before+7);assert.equal(reloaded.save.diamonds,10);
   g.endRun(death);assert.equal(g.save.diamonds,10);
 }
});
test('Double Foods preserves point progress and live counts, then duplicates only eligible food slots at collection',()=>{
 const g=gameBoot();g.state.running=true;g.state.player={tier:g.tierByName.Peanut};
 g.setWeather('double-foods');g.addPoints(1500);assert.equal(g.state.foodsEarned,1);
 assert.equal(g.elements.get('food-fill').style.width,'50%');
 g.setWeather('clear');g.addPoints(500);assert.equal(g.state.foodsEarned,2);
 const before=g.save.inventory.Peanut;g.endRun();assert.equal(g.save.diamonds,2);
 assert.equal(g.save.inventory.Peanut,before+3);assert.match(g.elements.get('overlay-msg').textContent,/Banked 3 foods and 2 diamonds/);
});
test('new weather cannot retroactively double old rewards and Bento foods stay independent',()=>{
 const g=gameBoot();g.state.running=true;g.state.player={tier:g.tierByName.Peanut};
 g.awardRunFood();g.setWeather('triple-diamonds');g.endRun();assert.equal(g.save.diamonds,1);
 for(const type of ['triple-diamonds','double-foods']){
   g.setWeather(type);g.save.bento.ready=1;g.save.bento.readyTypes=['normal'];
   const before=Object.values(g.save.inventory).reduce((a,b)=>a+b,0);g.openBento();
   assert.equal(Object.values(g.save.inventory).reduce((a,b)=>a+b,0)-before,3);
   assert.equal(g.save.diamonds,1);
 }
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('all six shared override types use the same end time and leave the quarter-hour clock unchanged',async()=>{
 for(const type of types){
   const start=noon+6*60000,event={id:'shared-'+type,type,startsAt:start,endsAt:start+duration};
   const g=boot(start,()=>({ok:true,json:async()=>event}));await flush();
   assert.equal(g.api.current(),type);assert.equal(g.elements.get('weather-countdown').textContent,'Event ends in 3:00');
   assert.equal(g.requests[0].url,'weather-event.json');assert.equal(g.requests[0].options.cache,'no-store');
   g.setTime(start+60000);await g.sync();assert.equal(g.api.current(),type);
   g.setTime(event.endsAt);g.tick();assert.equal(g.api.current(),'clear');
   assert.equal(g.elements.get('weather-countdown').textContent,'Next event in 6:00');
   g.setTime(noon+interval);g.tick();assert.ok(types.includes(g.api.current()));
   assert.equal(g.elements.get('weather-countdown').textContent,'Event ends in 3:00');
 }
});
test('live events arrive on open pages, invalid or failed feeds do not extend them',async()=>{
 const start=noon+6*60000,event={id:'live',type:'double-foods',startsAt:start,endsAt:start+duration};let data=null,fail=false;
 const g=boot(start,()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>data};});await flush();
 assert.equal(g.api.current(),'clear');data=event;await g.sync();assert.equal(g.api.current(),'double-foods');
 data={...event,type:'clear'};await g.sync();assert.equal(g.api.current(),'double-foods');
 data={...event,endsAt:event.endsAt+1};await g.sync();assert.equal(g.api.current(),'double-foods');
 fail=true;g.setTime(event.endsAt-1000);await g.sync();g.tick();assert.match(g.elements.get('weather-countdown').textContent,/0:01/);
 g.setTime(event.endsAt);g.tick();assert.equal(g.api.current(),'clear');
});
test('future and expired shared overrides do not block scheduled events or restart on reload',async()=>{
 const event={id:'future',type:'gold',startsAt:noon+6*60000,endsAt:noon+9*60000};const feed=()=>({ok:true,json:async()=>event});
 const g=boot(noon,feed);await flush();assert.equal(g.api.current(),boot(noon).api.current());
 g.setTime(event.startsAt);g.tick();assert.equal(g.api.current(),'gold');
 const expired=boot(event.endsAt,feed);await flush();assert.equal(expired.api.current(),'clear');
 const next=boot(noon+interval,feed);await flush();assert.equal(next.api.current(),boot(noon+interval).api.current());
});

test('Double Foods duplicates the exact rolled food and version without additional rolls or diamonds',()=>{
 const g=gameBoot(),names=['Cheese','Golden Cheese','Rainbow Cheese','Shadow Cheese'];let pulls=0;
 const before=Object.fromEntries(names.map(name=>[name,g.save.inventory[name]||0]));
 g.state.running=true;g.state.player={tier:g.tierByName.Peanut};g.setWeather('double-foods');
 for(const name of names){assert.ok(g.tierByName[name]);g.awardRunFood();}
 assert.equal(g.state.foodsEarned,4);assert.equal(g.elements.get('food-count').textContent,'4');
 g.setPull(()=>g.tierByName[names[pulls++]]);g.setWeather('clear');g.endRun();
 assert.equal(pulls,4);assert.equal(g.save.diamonds,4);assert.equal(g.save.bestRun,4);
 for(const name of names){assert.equal(g.save.inventory[name],before[name]+2);assert.equal(g.save.discovered[name],true);}
 assert.match(g.elements.get('overlay-msg').textContent,/Banked 8 foods and 4 diamonds/);
 g.endRun();assert.equal(pulls,4);assert.equal(g.save.diamonds,4);
});
test('duplicated foods do not advance run milestones or inflate diamond payouts',()=>{
 const g=gameBoot();g.state.running=true;g.state.player={tier:g.tierByName.Peanut};g.setWeather('double-foods');
 for(let i=0;i<24;i++)g.awardRunFood();
 g.math.random=()=>.9;const before=g.save.inventory.Peanut;g.endRun();
 assert.equal(g.state.foodsEarned,24);assert.equal(g.save.bestRun,24);assert.equal(g.save.diamonds,24);
 assert.equal(g.save.inventory.Peanut,before+48);assert.equal(g.bentoInventoryCount(),0);
 assert.match(g.elements.get('overlay-msg').textContent,/Banked 48 foods and 24 diamonds/);
});


test('Shadow overrides last exactly three minutes, use a countdown and leave regular event odds intact',async()=>{
 const start=noon+6*60000,event={id:'shadow-live',type:'shadow',startsAt:start,endsAt:start+180000};
 let record=event;const feed=()=>({ok:true,json:async()=>record});const g=boot(start-1,feed);await flush();assert.equal(g.api.current(),'clear');
 g.setTime(start);g.tick();assert.equal(g.api.current(),'shadow');assert.equal(g.elements.get('weather-name').textContent,'🌑 Shadow weather');assert.equal(g.elements.get('weather-countdown').textContent,'Event ends in 3:00');
 assert.equal(g.elements.get('weather-effects').dataset.weather,'shadow');
 g.setTime(event.endsAt-1);g.tick();assert.equal(g.api.current(),'shadow');
 g.setTime(event.endsAt);g.tick();assert.equal(g.api.current(),'clear');
 const expired=boot(event.endsAt,feed);await flush();assert.equal(expired.api.current(),'clear');
 record={...event,endsAt:start+300000};const invalid=boot(start,feed);await flush();assert.equal(invalid.api.current(),'clear');
 g.setTime(noon+interval);g.tick();assert.ok(types.includes(g.api.current()));
});
test('Shadow food odds match the requested rates across rarities, upgrade all lower versions and bank after expiry',()=>{
 const g=gameBoot(),rates={common:.05,uncommon:.025,rare:.02,epic:.01,legendary:.005,mythic:.001};
 for(const base of Object.values(g.tierByName).filter(t=>!t.isGolden&&!t.isShiny&&!t.isShadow))for(const prefix of ['','Golden ','Rainbow ']){
   const original=g.tierByName[prefix+base.name];const chance=rates[base.rarity];
   for(const roll of [0,chance-1e-9,chance,.999999]){g.math.random=()=>roll;assert.equal(g.applyFoodWeather(original,'shadow').name,roll<chance?'Shadow '+base.name:original.name);}
 }
 g.math.random=()=>0;assert.equal(g.applyFoodWeather(g.tierByName['Shadow Peanut'],'shadow').name,'Shadow Peanut');
 g.state.running=true;g.state.player={tier:g.tierByName.Peanut};g.setWeather('shadow');g.awardRunFood();g.setWeather('clear');g.endRun();
 assert.equal(g.save.inventory['Shadow Peanut'],1);assert.equal(g.save.discovered['Shadow Peanut'],true);assert.equal(g.save.diamonds,1);
});


test('Triple Diamonds grants exactly three diamonds per eligible food without multiplying food counts',()=>{
 for(const role of [null,'host','guest'])for(const died of [false,true]){
   const g=gameBoot();g.state.running=true;g.net.role=role;g.state.player={tier:g.tierByName.Peanut};g.setWeather('triple-diamonds');
   const before=g.save.inventory.Peanut;for(let i=0;i<5;i++)g.awardRunFood();
   assert.equal(g.state.foodsEarned,5);g.setWeather('clear');g.endRun(died);
   assert.equal(g.save.diamonds,15);assert.equal(g.save.inventory.Peanut,before+5);assert.equal(g.save.bestRun,5);
   assert.match(g.elements.get('overlay-msg').textContent,/Banked 5 foods and 15 diamonds/);
   g.endRun(died);assert.equal(g.save.diamonds,15);
 }
});

test('Bento Frenzy doubles the exact Gold and Rainbow shop chances and restores normal odds afterward',()=>{
 const g=gameBoot();g.setWeather('bento-frenzy');const counts={normal:0,gold:0,rainbow:0};
 for(let n=0;n<1000;n++){g.math.random=()=> (n+.5)/1000;counts[g.rollBentoType()]++;}
 assert.deepEqual(counts,{normal:916,gold:80,rainbow:4});
 for(const [roll,type] of [[.079999,'gold'],[.08,'rainbow'],[.083999,'rainbow'],[.084,'normal']]){g.math.random=()=>roll;assert.equal(g.rollBentoType(),type);}
 g.setWeather('clear');g.math.random=()=>.079999;assert.equal(g.rollBentoType(),'normal');
 g.setWeather('bento-frenzy');g.save.diamonds=1000;g.math.random=()=>.083;g.buyBento();assert.equal(g.save.diamonds,0);assert.equal(g.save.bento.locked,1);assert.equal(g.save.bento.lockedTypes[0],'rainbow');
});
test('Frenzy doubles each milestone Gold and Rainbow probability without altering guarantees or the 1100-food pair',()=>{
 const g=gameBoot();
 for(const [earned,denominator] of [[25,25],[50,20],[100,15],[200,10],[300,10],[400,5]]){
   for(const roll of [2/denominator-1e-9,2/denominator]){g.math.random=()=>roll;assert.equal(g.rollRunGoldBentoCount(earned,2),roll<2/denominator?1:0);}
 }
 for(const [earned,denominator,count] of [[500,50,1],[700,45,1],[900,40,1],[1100,35,2],[1300,30,1],[1500,25,1],[1750,20,1],[2000,15,1],[2250,10,1],[2500,5,1],[2750,5,1]]){
   for(const roll of [2/denominator-1e-9,2/denominator]){g.math.random=()=>roll;assert.equal(g.rollRunRainbowBentoCount(earned,2),roll<2/denominator?count:0);}
 }
 g.math.random=()=>.999;assert.equal(g.rollRunGoldBentoCount(500,2),1);assert.equal(g.rollRunRainbowBentoCount(3000,2),1);
 assert.equal(g.rollRunGoldBentoCount(24,2),0);assert.equal(g.rollRunRainbowBentoCount(499,2),0);
});
test('Frenzy doubles run rewards for every role and ending, preserves expiry eligibility and keeps foods and diamonds unchanged',()=>{
 for(const role of [null,'host','guest'])for(const died of [false,true])for(const retained of [false,true]){
   const g=gameBoot();g.state.running=true;g.net.role=role;g.state.player={tier:g.tierByName.Peanut};
   const before=g.save.inventory.Peanut;
   if(retained){g.setWeather('bento-frenzy');g.awardRunFood();g.setWeather('clear');}
   else g.awardRunFood();
   while(g.state.foodsEarned<25)g.awardRunFood();
   if(!retained)g.setWeather('bento-frenzy');
   g.math.random=()=>.9;g.endRun(died);
   assert.equal(g.save.bento.locked,2);assert.deepEqual(Array.from(g.save.bento.lockedTypes),['normal','normal']);
   assert.equal(g.save.inventory.Peanut,before+25);assert.equal(g.save.diamonds,25);assert.equal(g.state.foodsEarned,25);
   const reloaded=gameBoot(JSON.parse(g.storage.get('sprinkleFeastSave')));assert.equal(reloaded.save.bento.locked,2);
   g.endRun(died);assert.equal(g.save.bento.locked,2);
 }
});
test('Frenzy duplicates guaranteed special boxes, honors doubled odds, capacity and full-inventory upgrades',()=>{
 for(const [foods,roll,expected] of [[25,.079999,['gold','gold']],[500,.039999,['rainbow','rainbow','gold','gold','normal']],[3000,.999,['rainbow','rainbow','gold','gold','normal']]]){
   const g=gameBoot();g.state.running=true;g.state.foodsEarned=foods;g.setWeather('bento-frenzy');let calls=0;
   g.math.random=()=>++calls===1?.9:roll;g.endRun();assert.deepEqual(Array.from(g.save.bento.lockedTypes),expected);assert.ok(g.bentoInventoryCount()<=5);
 }
 const full=gameBoot();full.save.bento.ready=5;full.save.bento.readyTypes=Array(5).fill('normal');full.state.running=true;full.state.foodsEarned=3000;full.setWeather('bento-frenzy');full.math.random=()=>.9;full.endRun();
 assert.deepEqual(Array.from(full.save.bento.readyTypes),['rainbow','rainbow','gold','gold','normal']);assert.equal(full.bentoInventoryCount(),5);
 const empty=gameBoot();empty.state.running=true;empty.setWeather('bento-frenzy');empty.endRun();assert.equal(empty.bentoInventoryCount(),0);
});

const cloverWeatherRates={
 gold:{common:.10,uncommon:.075,rare:.05,epic:.025,legendary:.01,mythic:.005},
 rainbow:{common:.075,uncommon:.05,rare:.025,epic:.01,legendary:.005,mythic:.005},
 shadow:{common:.05,uncommon:.025,rare:.02,epic:.01,legendary:.005,mythic:.001},
};
const cloverRarities=['common','uncommon','rare','epic','legendary','mythic','godly'];
const weatherPrefix={gold:'Golden ',rainbow:'Rainbow ',shadow:'Shadow '};
test('every Clover rarity preserves exact Gold, Rainbow and Shadow weather upgrade odds for every base food',()=>{
 for(const cloverRarity of cloverRarities){
  const g=gameBoot(),key=`${cloverRarity}:clover`;g.save.relics.items[key]=100;g.save.relics.equipped=key;g.state.running=true;g.state.runRelicKey=key;
  g.save.bento.opened=100000;g.save.activePotions.luck={endsAt:Date.now()+60000,stacks:5};
  assert.ok(g.totalLuckBonus()>g.permanentLuckBonus()+2.5,'Clover food luck is active during the checks');
  const bases=Object.values(g.tierByName).filter(food=>!food.isGolden&&!food.isShiny&&!food.isShadow);
  for(const [weather,rates]of Object.entries(cloverWeatherRates))for(const base of bases){
   const chance=rates[base.rarity];assert.ok(chance);
   for(const roll of [0,chance-1e-10,chance,.999999]){
    let calls=0;g.math.random=()=>{calls++;return roll;};
    const food=g.applyFoodWeather(base,weather);
    assert.equal(food.name,roll<chance?weatherPrefix[weather]+base.name:base.name,`${cloverRarity} Clover, ${weather}, ${base.name}, ${roll}`);
    assert.equal(calls,1,'weather uses one independent upgrade roll');
   }
  }
 }
});
test('Clover cannot boost weather upgrades when run foods bank after event expiry or death',()=>{
 for(const cloverRarity of cloverRarities)for(const weather of Object.keys(cloverWeatherRates))for(const success of [false,true]){
  const g=gameBoot(),key=`${cloverRarity}:clover`,base=g.tierByName.Peanut,chance=cloverWeatherRates[weather].common;
  g.save.relics.items[key]=1;g.save.relics.equipped=key;g.state.runRelicKey=key;
  // endRun clears running before banking; the earned weather is preserved separately.
  g.state.running=false;g.state.foodsEarned=1;g.state.foodWeather=[weather];g.setWeather('clear');
  g.setPull(()=>base);let calls=0;g.math.random=()=>{calls++;return success?chance-1e-10:chance;};
  const banked=g.bankPendingFoods();assert.deepEqual(Array.from(banked),[success?weatherPrefix[weather]+'Peanut':'Peanut']);assert.equal(calls,1);
  assert.equal(g.save.relics.equipped,key);assert.equal(g.save.relics.items[key],1);
 }
});
