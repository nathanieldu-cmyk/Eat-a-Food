const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
const interval = 600000, duration = 300000;
function boot(saved, start = 1000000, blocked = false, feed) {
  let now = start, rolls = 0;
  const storage = new Map(saved ? [['eatAFoodWeather', JSON.stringify(saved)]] : []);
  const elements = new Map();
  const events = {}, windowEvents = {}, timers = [], requests = [];
  const math = Object.create(Math);
  math.random = () => { rolls++; return .9; };
  class Clock extends Date { static now() {return now;} }
  const window = {addEventListener(k,fn) {windowEvents[k]=fn;}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'weather.js'),'utf8'), {
    window, Date:Clock, Math:math,
    document:{createElement() {return {style:{},className:''};},getElementById(id) {if (!elements.has(id)) elements.set(id,{dataset:{},textContent:'',children:[],appendChild(child) {this.children.push(child);}}); return elements.get(id);},addEventListener(k,fn) {events[k]=fn;}},
    localStorage:{getItem:k=>{if(blocked) throw Error();return storage.get(k);},setItem:(k,v)=>{if(blocked) throw Error();storage.set(k,v);}},
    setInterval(fn,ms) {timers.push({fn,ms});},
    AbortController, setTimeout:()=>1, clearTimeout() {},
    fetch:feed ? async (url,options)=>{requests.push({url,options});return feed();} : undefined,
  });
  return {api:window.GameWeather,storage,elements,math,events,windowEvents,
    setTime:n=>{now=n;},tick:()=>timers.find(t=>t.ms===1000).fn(),sync:()=>timers.find(t=>t.ms===15000).fn(), requests, rolls:()=>rolls,
    saved:()=>JSON.parse(storage.get('eatAFoodWeather'))};
}
test('10-minute shared roll has exact 25% Gold, 25% Rainbow, 50% clear boundaries, never overlapping', () => {
  for(const [roll,expected] of [[0,'gold'],[.249999,'gold'],[.25,'rainbow'],[.499999,'rainbow'],[.5,'clear'],[.99999,'clear']]) {
    const g=boot(); const start=g.saved().nextRoll;
    assert.equal(g.api.current(),'clear');assert.equal(g.rolls(),0);
    g.math.random=()=>roll;
    g.setTime(start-1);assert.equal(g.api.current(),'clear');
    g.setTime(start);g.tick();assert.equal(g.api.current(),expected);
    assert.equal(g.elements.get('weather-effects').dataset.weather,expected);
    if(expected!=='clear') {
      assert.match(g.elements.get('weather-detail').textContent,/10% .*food chance/);
      assert.match(g.elements.get('weather-countdown').textContent,/Event ends in 5:00/);
      g.setTime(start+duration-1);assert.equal(g.api.current(),expected);
      g.setTime(start+duration);g.tick();assert.equal(g.api.current(),'clear');
    }
    assert.equal(g.saved().nextRoll,start+interval);
  }
  const g=boot(), first=g.saved().nextRoll, counts={gold:0,rainbow:0,clear:0};
  for(let n=0;n<400;n++) {g.math.random=()=> (n+.5)/400;g.setTime(first+n*interval);counts[g.api.current()]++;}
  assert.deepEqual(counts,{gold:100,rainbow:100,clear:200});
});
test('reloads preserve countdown and current weather without rerolling; stale and corrupt saves recover', () => {
  const g=boot();const first=g.saved().nextRoll;g.math.random=()=>0;
  g.setTime(first);g.tick();const h=boot(g.saved(),first+60000);
  assert.equal(h.api.current(),'gold');assert.equal(h.rolls(),0);
  assert.match(h.elements.get('weather-countdown').textContent,/Event ends in 4:00/);
  h.setTime(first+duration);h.events.visibilitychange();assert.equal(h.api.current(),'clear');
  h.setTime(first+interval);h.tick();assert.equal(h.rolls(),1);h.tick();assert.equal(h.rolls(),1);
  const overdue=boot(g.saved(),first+100*interval+duration);
  assert.equal(overdue.api.current(),'clear');assert.equal(overdue.rolls(),0);
  assert.equal(overdue.saved().nextRoll,first+101*interval);
  assert.doesNotThrow(()=>boot(null,1000000,true).api.current());
  const corrupt=boot({type:'gold',endsAt:Infinity,nextRoll:'oops'});
  assert.equal(corrupt.api.current(),'clear');assert.equal(corrupt.saved().nextRoll,1000000+interval);
});
test('other tabs and visibility restoration refresh weather visuals and timers', () => {
  const g=boot();const first=g.saved().nextRoll;
  g.storage.set('eatAFoodWeather',JSON.stringify({type:'rainbow',endsAt:first+duration,nextRoll:first+interval}));
  g.setTime(first+10000);g.windowEvents.storage({key:'eatAFoodWeather'});
  assert.equal(g.api.current(),'rainbow');assert.equal(g.elements.get('weather-effects').dataset.weather,'rainbow');
  g.setTime(first+duration);g.windowEvents.pageshow();
  assert.equal(g.elements.get('weather-effects').dataset.weather,'clear');
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

const flush = () => new Promise(resolve=>setImmediate(resolve));
test('shared event overrides every local weather with the same expiry and polls without cache', async () => {
 const start=1000000, event={id:'shared-gold',type:'gold',startsAt:start,endsAt:start+duration};
 for(const localType of ['clear','gold','rainbow']) {
   const local={type:localType,endsAt:localType==='clear'?0:start+duration,nextRoll:start+interval};
   const g=boot(local,start,false,()=>({ok:true,json:async()=>event}));await flush();
   assert.equal(g.api.current(),'gold');assert.equal(g.elements.get('weather-effects').dataset.weather,'gold');
   assert.match(g.elements.get('weather-countdown').textContent,/Event ends in 5:00/);
   assert.equal(g.requests[0].url,'weather-event.json');assert.equal(g.requests[0].options.cache,'no-store');
   assert.equal(g.elements.get('weather-effects').children.length,64);assert.equal(g.rolls(),0);
   g.setTime(start+100000);await g.sync();assert.equal(g.api.current(),'gold');
   assert.equal(g.saved().nextRoll,event.endsAt+duration,'polling cannot restart the event or its schedule');
   g.setTime(event.endsAt);g.tick();assert.equal(g.api.current(),'clear');
   assert.match(g.elements.get('weather-countdown').textContent,/Next roll in 5:00/);
 }
});
test('live event changes arrive on an already-open page; failed or invalid feeds cannot extend it', async () => {
 const start=1000000,event={id:'live-rainbow',type:'rainbow',startsAt:start,endsAt:start+duration};
 let data=null,fail=false;
 const g=boot(null,start,false,()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>data};});await flush();
 assert.equal(g.api.current(),'clear');data=event;await g.sync();assert.equal(g.api.current(),'rainbow');
 data={...event,id:'bad',endsAt:start+duration+1};await g.sync();assert.equal(g.api.current(),'rainbow');
 fail=true;g.setTime(start+duration-1000);await g.sync();g.tick();assert.match(g.elements.get('weather-countdown').textContent,/0:01/);
 g.setTime(start+duration);g.tick();assert.equal(g.api.current(),'clear');
});
test('future shared events begin only at their start and expire without restarting on reload', async () => {
 const now=1000000,event={id:'scheduled',type:'gold',startsAt:now+60000,endsAt:now+60000+duration};
 const feed=()=>({ok:true,json:async()=>event});
 const g=boot(null,now,false,feed);await flush();assert.equal(g.api.current(),'clear');
 g.setTime(event.startsAt);g.tick();assert.equal(g.api.current(),'gold');
 const after=boot(null,event.endsAt,false,feed);await flush();assert.equal(after.api.current(),'clear');
});
