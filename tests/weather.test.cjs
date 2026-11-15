const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
const interval = 900000, duration = 300000;
const noon = Date.parse('2026-11-14T12:00:00-06:00');
const types = ['gold','rainbow','double-diamonds','double-foods'];
function boot(start = noon + 10 * 60000, feed, saved) {
 let now=start, rolls=0;
 const elements=new Map(),events={},windowEvents={},timers=[],requests=[];
 const math=Object.create(Math);math.random=()=>{rolls++;return .9;};
 class Clock extends Date {static now(){return now;}}
 const window={addEventListener(k,fn){windowEvents[k]=fn;}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'weather.js'),'utf8'),{
   window,Date:Clock,Math:math,
   document:{createElement(){return {style:{},className:''};},getElementById(id){if(!elements.has(id))elements.set(id,{dataset:{},textContent:'',children:[],appendChild(child){this.children.push(child);}});return elements.get(id);},addEventListener(k,fn){events[k]=fn;}},
   localStorage:{getItem(){return saved;},setItem(){throw Error('storage unavailable');}},
   setInterval(fn,ms){timers.push({fn,ms});},AbortController,setTimeout:()=>1,clearTimeout(){},
   fetch:feed?async(url,options)=>{requests.push({url,options});return feed();}:undefined,
 });
 return {api:window.GameWeather,elements,events,windowEvents,requests,rolls:()=>rolls,setTime:n=>{now=n;},tick:()=>timers.find(t=>t.ms===1000).fn(),sync:()=>timers.find(t=>t.ms===15000).fn()};
}
test('every quarter hour starts one of four events for exactly five minutes',()=>{
 const g=boot();
 for(let n=0;n<96;n++){
   const start=noon+n*interval;
   g.setTime(start-1);assert.equal(g.api.current(),'clear');
   g.setTime(start);g.tick();const type=g.api.current();assert.ok(types.includes(type));
   assert.equal(g.elements.get('weather-effects').dataset.weather,type);
   assert.equal(g.elements.get('weather-countdown').textContent,'Event ends in 5:00');
   g.setTime(start+duration-1);assert.equal(g.api.current(),type);
   g.setTime(start+duration);g.tick();assert.equal(g.api.current(),'clear');
   assert.equal(g.elements.get('weather-countdown').textContent,'Next event in 10:00');
   assert.match(g.elements.get('weather-detail').textContent,/Next at /);
 }
 assert.equal(g.rolls(),0,'weather and visuals never consume gameplay randomness');
});
test('four equally weighted outcomes fill all clock slots with no clear rolls',()=>{
 const g=boot(),counts=Object.fromEntries(types.map(t=>[t,0]));
 for(let n=0;n<16384;n++){g.setTime(noon+n*interval);counts[g.api.current()]++;}
 assert.deepEqual(Object.keys(counts).sort(),[...types].sort());
 for(const count of Object.values(counts))assert.ok(Math.abs(count-4096)<200,JSON.stringify(counts));
});
test('late arrivals, reloads, old saves and background restoration share the clock and event type',()=>{
 const start=noon+interval;
 const a=boot(start),b=boot(start+60000,undefined,JSON.stringify({type:'gold',nextRoll:start+12345,endsAt:start+54321}));
 assert.equal(a.api.current(),b.api.current());
 assert.equal(b.elements.get('weather-countdown').textContent,'Event ends in 4:00');
 a.setTime(start+duration);a.events.visibilitychange();assert.equal(a.api.current(),'clear');
 a.setTime(start+10*interval+duration);a.windowEvents.pageshow();
 assert.equal(a.elements.get('weather-countdown').textContent,'Next event in 10:00');
 a.setTime(start+11*interval);a.tick();const next=boot(start+11*interval+1000);
 assert.equal(a.api.current(),next.api.current());
 assert.equal(next.elements.get('weather-countdown').textContent,'Event ends in 4:59');
});
test('Double Diamonds and Double Foods have distinct names, explanations and effects',()=>{
 const g=boot();const seen=new Set();
 for(let n=0;n<100&&seen.size<4;n++){
   g.setTime(noon+n*interval);g.tick();const type=g.api.current();seen.add(type);
   if(type==='double-diamonds'){assert.match(g.elements.get('weather-name').textContent,/Double Diamonds/);assert.match(g.elements.get('weather-detail').textContent,/2× diamonds/);}
   if(type==='double-foods'){assert.match(g.elements.get('weather-name').textContent,/Double Foods/);assert.match(g.elements.get('weather-detail').textContent,/2× foods/);}
 }
 assert.equal(seen.size,4);assert.equal(g.elements.get('weather-effects').children.length,64);
});
let harness=fs.readFileSync(path.join(__dirname,'bento.test.cjs'),'utf8').split('const thresholds =')[0];
harness=harness.replace('window: {}, Math: math, console,','window: {GameWeather:{current:()=>weather}}, Math: math, console,')
 .replace('function boot(saved) {','function boot(saved) {\n  let weather="clear";')
 .replace('globalThis.api = { save, state, net,','globalThis.api = { awardRunFood, applyFoodWeather, save, state, net,')
 .replace('return { ...context.api, math, storage, elements };','return { ...context.api, math, storage, elements, setWeather:w=>{weather=w;} };');
const ctx={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.gameBoot=boot;',ctx);
const gameBoot=ctx.gameBoot;
test('each eligible food has exactly 10% conversion, retaining base food and rarity without downgrades', () => {
 const g=gameBoot();
 for(const weather of ['gold','rainbow']) {
   let converted=0;
   for(let n=0;n<1000;n++) {g.math.random=()=> (n+.5)/1000;const food=g.applyFoodWeather(g.tierByName.Peanut,weather);if(food.name!=='Peanut') converted++;}
   assert.equal(converted,100);
   for(const roll of [0,.099999,.1,.999999]) {
     g.math.random=()=>roll;
     const food=g.applyFoodWeather(g.tierByName.Cheese,weather);
     assert.equal(food.name,roll<.1?`${weather==='gold'?'Golden':'Rainbow'} Cheese`:'Cheese');
     assert.equal(food.rarity,g.tierByName.Cheese.rarity);
   }
 }
 g.math.random=()=>0;
 assert.equal(g.applyFoodWeather(g.tierByName.Peanut,'clear').name,'Peanut');
 for(const name of ['Rainbow Peanut','Shadow Peanut']) for(const weather of ['gold','rainbow']) assert.equal(g.applyFoodWeather(g.tierByName[name],weather).name,name);
 assert.equal(g.applyFoodWeather(g.tierByName['Golden Peanut'],'gold').name,'Golden Peanut');
 assert.equal(g.applyFoodWeather(g.tierByName['Golden Peanut'],'rainbow').name,'Rainbow Peanut');
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


test('double food slots count immediately and double diamond slots bank correctly after expiry for every role and ending',()=>{
 for(const role of [null,'host','guest'])for(const death of [false,true]){
   const g=gameBoot();g.state.running=true;g.state.player={tier:g.tierByName.Peanut};g.net.role=role;
   const before=g.save.inventory.Peanut;
   for(const type of ['clear','double-diamonds','double-foods','gold','rainbow','double-diamonds']){g.setWeather(type);g.awardRunFood();}
   assert.equal(g.state.foodsEarned,7);assert.equal(g.elements.get('food-count').textContent,'7');
   assert.equal(g.state.foodWeather.filter(t=>t==='double-foods').length,2);
   g.setWeather('clear');g.math.random=()=>.9;g.endRun(death);
   assert.equal(g.save.inventory.Peanut,before+7);assert.equal(g.save.diamonds,9);assert.equal(g.save.bestRun,7);
   assert.match(g.elements.get('overlay-msg').textContent,/Banked 7 foods and 9 diamonds/);
   const saved=JSON.parse(g.storage.get('sprinkleFeastSave'));const reloaded=gameBoot(saved);
   assert.equal(reloaded.save.inventory.Peanut,before+7);assert.equal(reloaded.save.diamonds,9);
   g.endRun(death);assert.equal(g.save.diamonds,9);
 }
});
test('point progress earns twice the foods during Double Foods and stops doubling at event end',()=>{
 const g=gameBoot();g.state.running=true;g.state.player={tier:g.tierByName.Peanut};
 g.setWeather('double-foods');g.addPoints(1500);assert.equal(g.state.foodsEarned,2);
 assert.equal(g.elements.get('food-fill').style.width,'50%');
 g.setWeather('clear');g.addPoints(500);assert.equal(g.state.foodsEarned,3);
 g.endRun();assert.equal(g.save.diamonds,3);
});
test('new weather cannot retroactively double old rewards and Bento foods stay independent',()=>{
 const g=gameBoot();g.state.running=true;g.state.player={tier:g.tierByName.Peanut};
 g.awardRunFood();g.setWeather('double-diamonds');g.endRun();assert.equal(g.save.diamonds,1);
 for(const type of ['double-diamonds','double-foods']){
   g.setWeather(type);g.save.bento.ready=1;g.save.bento.readyTypes=['normal'];
   const before=Object.values(g.save.inventory).reduce((a,b)=>a+b,0);g.openBento();
   assert.equal(Object.values(g.save.inventory).reduce((a,b)=>a+b,0)-before,3);
   assert.equal(g.save.diamonds,1);
 }
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('all four shared override types use the same end time and leave the quarter-hour clock unchanged',async()=>{
 for(const type of types){
   const start=noon+6*60000,event={id:'shared-'+type,type,startsAt:start,endsAt:start+duration};
   const g=boot(start,()=>({ok:true,json:async()=>event}));await flush();
   assert.equal(g.api.current(),type);assert.equal(g.elements.get('weather-countdown').textContent,'Event ends in 5:00');
   assert.equal(g.requests[0].url,'weather-event.json');assert.equal(g.requests[0].options.cache,'no-store');
   g.setTime(start+60000);await g.sync();assert.equal(g.api.current(),type);
   g.setTime(event.endsAt);g.tick();assert.equal(g.api.current(),'clear');
   assert.equal(g.elements.get('weather-countdown').textContent,'Next event in 4:00');
   g.setTime(noon+interval);g.tick();assert.ok(types.includes(g.api.current()));
   assert.equal(g.elements.get('weather-countdown').textContent,'Event ends in 5:00');
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
 const event={id:'future',type:'gold',startsAt:noon+6*60000,endsAt:noon+11*60000};const feed=()=>({ok:true,json:async()=>event});
 const g=boot(noon,feed);await flush();assert.equal(g.api.current(),boot(noon).api.current());
 g.setTime(event.startsAt);g.tick();assert.equal(g.api.current(),'gold');
 const expired=boot(event.endsAt,feed);await flush();assert.equal(expired.api.current(),'clear');
 const next=boot(noon+interval,feed);await flush();assert.equal(next.api.current(),boot(noon+interval).api.current());
});
