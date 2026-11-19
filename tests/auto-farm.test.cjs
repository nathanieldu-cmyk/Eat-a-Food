const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
function declaration(name){const start=source.indexOf(`  function ${name}(`);assert.ok(start>=0);return source.slice(start,source.indexOf('\n  function ',start+1));}
let harness=fs.readFileSync(path.join(__dirname,'bento.test.cjs'),'utf8').split('const thresholds =')[0];
harness=harness.replace('  const storage = new Map();',`  let now=100,nextTimer=1;const timers=new Map(),starts=[],sent=[],events=[];
  const advance=ms=>{now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now&&timers.delete(id))timer.fn();};
  const storage = new Map();`)
 .replace('window: {}, Math: math, console,', 'starts, sent, clock:{now:()=>now}, window: {GameSfx:{play(...args){events.push(args);}}}, Math: math, console,')
 .replace('cancelAnimationFrame() {},',`cancelAnimationFrame() {}, performance:{now:()=>now},
    setTimeout(fn,delay){const id=nextTimer++;timers.set(id,{fn,at:now+delay});return id;},clearTimeout(id){timers.delete(id);},`)
 .replace('    globalThis.api = { save, state, net,',`    startRun=()=>{starts.push(clock.now());state.running=true;state.runStartedAt=clock.now();state.foodsEarned=0;state.foodWeather=[];};
    netSend=msg=>sent.push(msg);stepWorld=()=>{};stepLobbyGuests=()=>{};netPump=()=>{};
    applyRunSteer=()=>{};guestEatSprinkles=()=>{};smoothRemotes=()=>{};updateParticles=()=>{};
    globalThis.api = { setAutoFarm, queueAutoFarmRun, checkAutoFarmRun, runStep, save, state, net,`)
 .replace('return { ...context.api, math, storage, elements };','return { ...context.api, math, storage, elements, timers, starts, sent, events, advance, setNow:n=>{now=n;} };');
const ctx={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.gameBoot=boot;',ctx);
function boot(role=null){const g=ctx.gameBoot();g.net.role=role;g.net.run=7;g.net.hostConn={open:true};g.state.running=true;g.state.player={};g.state.runStartedAt=100;g.setAutoFarm(true);return g;}
test('death collects rewards once and auto farm reenters for solo, host and guest players',()=>{
 for(const role of [null,'host','guest']){
  const g=boot(role);g.state.foodsEarned=2;g.endRun(true);
  assert.equal(g.save.diamonds,2);assert.equal(g.save.inventory.Peanut,3);assert.equal(g.state.running,false);assert.equal(g.timers.size,1);
  g.endRun(true);assert.equal(g.save.diamonds,2);assert.equal(g.timers.size,1);
  g.advance(999);assert.equal(g.starts.length+g.sent.length,0);g.advance(1);
  if(role==='guest'){
   assert.equal(g.sent[0].t,'farm-start');assert.equal(g.state.running,false,'wait for the host to confirm');
   g.advance(1000);assert.equal(g.sent.length,2,'lost requests retry');
   g.state.running=true;g.advance(1000);assert.equal(g.sent.length,2);assert.equal(g.timers.size,0);
  }else{assert.equal(g.starts.length,1);assert.equal(g.state.running,true);assert.equal(g.state.foodsEarned,0);}
 }
});
test('each auto-farm run banks at exactly ten minutes and starts a fresh ten-minute clock',()=>{
 for(const role of [null,'host','guest']){
  const g=boot(role);g.state.foodsEarned=3;
  assert.equal(g.checkAutoFarmRun(600099),false);assert.equal(g.state.running,true);
  g.setNow(600100);assert.equal(g.runStep(.016,600100),false);assert.equal(g.save.diamonds,3);assert.equal(g.state.running,false);
  assert.equal(g.events.some(([name])=>name==='death'),false,'time resets are normal endings');
  assert.equal(g.checkAutoFarmRun(600101),false);assert.equal(g.save.diamonds,3);
  if(role==='guest'){assert.equal(g.sent[0].t,'end');assert.equal(g.net.endedRun,7);}
  g.advance(1000);
  if(role==='guest')assert.equal(g.sent.at(-1).t,'farm-start');
  else{
   assert.equal(g.state.runStartedAt,601100);assert.equal(g.checkAutoFarmRun(1201099),false);
   assert.equal(g.checkAutoFarmRun(1201100),true);assert.equal(g.save.diamonds,3);
  }
 }
});
test('turning off auto farm cancels restarts, manual endings stay in the lobby, and ordinary runs have no time limit',()=>{
 const g=boot();g.endRun(true);g.setAutoFarm(false);assert.equal(g.timers.size,0);g.advance(2000);assert.equal(g.starts.length,0);
 const manual=boot();manual.endRun(false);manual.advance(2000);assert.equal(manual.starts.length,0);assert.equal(manual.timers.size,0);
 const ordinary=boot();ordinary.setAutoFarm(false);assert.equal(ordinary.checkAutoFarmRun(3600100),false);assert.equal(ordinary.state.running,true);
 const replaced=boot();replaced.endRun(true);replaced.state.running=true;replaced.advance(1000);assert.equal(replaced.starts.length,0,'manual entry prevents duplicate runs');
});
test('ten-minute reset preserves normal food, diamond, progress and Bento rewards',()=>{
 const reset=boot(),manual=boot();
 for(const g of [reset,manual]){g.state.foodsEarned=500;g.state.points=27;g.state.foodWeather=['double-foods','triple-diamonds','bento-frenzy'];}
 manual.endRun(false);assert.equal(reset.checkAutoFarmRun(600100),true);
 for(const name of ['inventory','diamonds','carryPoints','bestRun'])assert.deepEqual(JSON.parse(JSON.stringify(reset.save[name])),JSON.parse(JSON.stringify(manual.save[name])));
 assert.deepEqual(Array.from(reset.save.bento.lockedTypes),Array.from(manual.save.bento.lockedTypes));assert.equal(reset.save.bento.locked,manual.save.bento.locked);
 assert.equal(reset.save.diamonds,502);assert.equal(reset.save.inventory.Peanut,502);
});
test('guest retries wait for reconnection and stop if auto farm is disabled',()=>{
 const g=boot('guest');g.net.migrating=true;g.endRun(true);g.advance(1000);assert.equal(g.sent.length,0);
 g.net.migrating=false;g.net.hostConn.open=false;g.advance(1000);assert.equal(g.sent.length,0);
 g.net.hostConn.open=true;g.advance(1000);assert.equal(g.sent[0].t,'farm-start');g.setAutoFarm(false);g.advance(1000);assert.equal(g.sent.length,1);
});
test('host starts only the requesting guest and duplicate start requests cannot reset an active run',()=>{
 const listeners={},sent=[],entered=[],snaps=[];const food={zone:'lobby',run:0},other={zone:'arena',run:25};
 const net={role:'host',guests:new Map(),humans:new Map([['one',food],['two',other]])};
 const conn={peer:'one',on:(event,fn)=>{listeners[event]=fn;},send:msg=>sent.push(msg)};
 const context={net,GAME_VERSION:232,MAX_ROOM_PLAYERS:8,ensureNetHuman:()=>food,hostRoster:()=>[],shareRoster(){},
  enterArena(f){entered.push(f);f.zone='arena';f.run++;},sendToLobby(f){f.zone='lobby';},broadcastSnap:force=>snaps.push(force)};
 vm.runInNewContext(declaration('hostAccept')+'\nglobalThis.accept=hostAccept;',context);context.accept(conn);
 listeners.data({t:'farm-start'});assert.equal(entered.length,0,'unjoined connections cannot start');
 listeners.data({t:'join',v:232,name:'One'});listeners.data({t:'farm-start'});assert.equal(entered.length,1);assert.equal(entered[0],food);assert.equal(other.run,25);assert.equal(snaps.length,1);
 listeners.data({t:'farm-start'});assert.equal(entered.length,1);
 listeners.data({t:'end'});listeners.data({t:'farm-start'});assert.equal(entered.length,2);assert.equal(food.run,2);
});
test('both local and confirmed guest run starts reset the clock',()=>{
 for(const name of ['startRun','guestBeginRun']){
  const noop=()=>{},el=()=>({classList:{add:noop,remove:noop}}),state={rivals:[],runStartedAt:1};
  const c={state,save:{inventory:{Peanut:1},equipped:'Peanut'},net:{role:null},window:{},performance:{now:()=>12345},view:null,ARENA:1800,
   closeRelics:noop,refreshPlayerRelics:noop,closeIndex:noop,closeInventory:noop,closeShop:noop,closeCraft:noop,closeMulti:noop,ensureWorld:noop,arenaHumans:()=>[],farArenaSpot:()=>({x:0,y:0}),createFood:()=>({}),equippedTier:()=>({}),restoreCarriedPoints:noop,clampToArena:noop,spawnBetterRival:noop,updateHud:noop,cancelAnimationFrame:noop,requestAnimationFrame:()=>1,loop:noop,lastTime:0,previewId:0};
  for(const key of ['pullResultsEl','lobbyHintEl','overlay','endBtn','inventoryBtn','shopBtn','craftBtn'])c[key]=el();
  vm.runInNewContext(declaration(name)+`\n${name}(8);`,c);assert.equal(state.runStartedAt,12345);assert.equal(state.running,true);
 }
});
test('host lobby snapshots recover guest deaths even when a death message was missed',()=>{
 const ends=[];const c={refreshPlayerRelics(){},net:{role:'guest',id:'one',run:7,endedRun:0,humans:new Map()},state:{running:true,rivals:[]},performance:{now:()=>0},endRun:died=>{ends.push(died);c.state.running=false;},spawnLobbyPlayer(){c.state.player={tier:{}};},createFood(){},tierByName:{},FOOD_TIERS:[]};
 vm.runInNewContext(declaration('applySnap')+'\nglobalThis.snap=applySnap;',c);
 c.snap({players:[{id:'one',zone:'lobby'}]});assert.deepEqual(ends,[true]);assert.equal(c.net.endedRun,7);
 c.snap({players:[{id:'one',zone:'arena',run:7}]});assert.deepEqual(ends,[true],'old snapshots cannot restart an ended run');
});
