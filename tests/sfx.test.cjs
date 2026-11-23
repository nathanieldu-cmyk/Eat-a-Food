const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
function boot(muted = false, supported = true, sampleFetch = undefined) {
  const events = {}, windowEvents = {}, contexts = [];
  const button = {addEventListener(k,fn) {this[k]=fn;}, setAttribute(k,v) {this[k]=v;}};
  const storage = new Map([['eatAFoodSfxMuted', String(muted)]]);
  const document = {hidden:false, getElementById:()=>button, addEventListener(k,fn) {events[k]=fn;}};
  class AudioContext {
    constructor() {this.state='running'; this.currentTime=1; this.sampleRate=44100; this.voices=[]; this.buffers=[]; contexts.push(this);}
    createOscillator() {
      const voice = {frequency:{setValueAtTime(f,t) {voice.frequencyValue=f; voice.time=t;}, exponentialRampToValueAtTime(f) {voice.end=f;}},
        connect(node) {voice.gainNode=node;}, disconnect() {}, start() {}, stops:[], stop(time) {voice.stops.push(time ?? 'now');}};
      this.voices.push(voice); return voice;
    }
    createBuffer(channels,length,sampleRate) {const data=new Float32Array(length),buffer={length,sampleRate,getChannelData:()=>data};this.buffers.push(buffer);return buffer;}
    createBufferSource() {const voice={type:'noise',get gainNode(){return this.filterNode?.gainNode || this.filterNode;},connect(node){this.filterNode=node;},disconnect(){this.disconnected=true;},start(time,offset=0){this.time=time;this.offset=offset;},stops:[],stop(time){this.stops.push(time??'now');}};this.voices.push(voice);return voice;}
    createBiquadFilter() {const node={Q:{value:0},frequency:{setValueAtTime(f,time){node.frequencyValue=f;node.time=time;},exponentialRampToValueAtTime(f){node.end=f;}},connect(gain){node.gainNode=gain;},disconnect(){node.disconnected=true;}};return node;}
    createGain() {const events=[];return {events,gain:{setValueAtTime(value,time) {events.push({type:'set',value,time});}, exponentialRampToValueAtTime(value,time) {events.push({type:'ramp',value,time});}}, connect() {}, disconnect() {}};}
    decodeAudioData(bytes) {this.decodeCalls=(this.decodeCalls||0)+1;return Promise.resolve({duration:4.2,numberOfChannels:2,hatch:'clean'});}
    resume() {this.state='running';return Promise.resolve();}
    suspend() {this.state='suspended';return Promise.resolve();}
  }
  const window = {AudioContext:supported ? AudioContext : undefined, addEventListener(k,fn) {windowEvents[k]=fn;}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'sfx.js'),'utf8'), {window,document,fetch:sampleFetch,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
  return {events,windowEvents,button,storage,document,contexts,api:window.GameSfx};
}
test('effects wait for a gesture and all five orb sizes have different notes or timbres', () => {
  const g=boot();g.api.play('start');assert.equal(g.contexts.length,0);
  g.events.pointerdown();const ctx=g.contexts[0];const signatures=[];
  for(const size of ['xs','small','medium','large','xl']) {
    ctx.currentTime+=1;const before=ctx.voices.length;g.api.play(`orb-${size}`);
    signatures.push(JSON.stringify(ctx.voices.slice(before).map(v=>[v.type,v.frequencyValue,v.end])));
  }
  assert.equal(new Set(signatures).size,5);
  const before=ctx.voices.length;g.api.play('orb-xl');assert.equal(ctx.voices.length,before);
});
test('mute persists and cancels current and scheduled effects; hidden tabs stay silent', () => {
  const g=boot();g.events.keydown();const ctx=g.contexts[0];g.api.play('collect',.6);
  assert.ok(ctx.voices.every(v=>v.time>=1.6));
  g.button.click();assert.equal(g.storage.get('eatAFoodSfxMuted'),'true');assert.ok(ctx.voices.every(v=>v.stops.includes('now')));
  const before=ctx.voices.length;g.api.play('death');assert.equal(ctx.voices.length,before);
  g.button.click();g.api.play('start');assert.ok(ctx.voices.length>before);
  g.document.hidden=true;g.events.visibilitychange();const hidden=ctx.voices.length;
  g.api.play('bento');assert.equal(ctx.voices.length,hidden);assert.equal(ctx.state,'suspended');
  g.document.hidden=false;g.events.visibilitychange();assert.equal(ctx.state,'running');
  ctx.state='interrupted';g.events.pointerdown();assert.equal(ctx.state,'running');
});
test('effects are optional, persist independently of music, and bound rapid pickup polyphony', () => {
  const unsupported=boot(false,false);unsupported.events.pointerdown();assert.doesNotThrow(()=>unsupported.api.play('death'));
  const muted=boot(true);muted.events.pointerdown();muted.api.play('start');assert.equal(muted.contexts.length,0);
  const g=boot();g.events.pointerdown();const ctx=g.contexts[0];
  for(let n=0;n<100;n++){ctx.currentTime+=.1;g.api.play('orb-xl');}
  assert.ok(ctx.voices.length<=24);
  const before=ctx.voices.length;g.api.play('death');assert.equal(ctx.voices.length,before+2);
  assert.ok(ctx.voices.slice(0,before).every(v=>v.stops.includes('now')));
  assert.equal(g.storage.has('eatAFoodMusicMuted'),false);
});

// Use the existing full game/save harness to exercise the actual reward and death code.
let harness=fs.readFileSync(path.join(__dirname,'bento.test.cjs'),'utf8').split('const thresholds =')[0];
harness=harness.replace('  const storage = new Map();','  const events = [];\n  const storage = new Map();')
  .replace('window: {}, Math: math, console,','window: {GameSfx:{play(...args) {events.push(args);}}}, Math: math, console,')
  .replace('cancelAnimationFrame() {},','cancelAnimationFrame() {}, setTimeout() {}, performance:{now:()=>100},')
  .replace('    globalThis.api = { save, state, net,','    ringReach = () => 10; dist = () => 0;\n    globalThis.api = { eatSprinkle, guestEatSprinkles, save, state, net,')
  .replace('return { ...context.api, math, storage, elements };','return { ...context.api, events, math, storage, elements };');
const harnessCtx={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.gameBoot=boot;',harnessCtx);
const gameBoot=harnessCtx.gameBoot;
test('only deaths play the death cue, and collected run foods get one delayed reward cue', () => {
  for(const died of [false,true]) for(const count of [0,2]) {
    const g=gameBoot();g.state.running=true;g.state.foodsEarned=count;g.endRun(died);
    assert.equal(g.events.filter(([name])=>name==='death').length,died?1:0);
    const collected=g.events.filter(([name])=>name==='collect');assert.equal(collected.length,count?1:0);
    if(count) assert.equal(collected[0][1],died?.6:0);
    const before=g.events.length;g.endRun(true);assert.equal(g.events.length,before);
  }
});
test('opening ready Bento Boxes plays opening and collection cues once; invalid opens stay silent', () => {
  const g=gameBoot();g.openBento();assert.equal(g.events.length,0);
  g.save.bento.ready=2;g.save.bento.readyTypes=['normal','rainbow'];g.openBento();
  assert.deepEqual(JSON.parse(JSON.stringify(g.events)),[['bento'],['collect',.45]]);
  g.openBento();assert.equal(g.events.length,2);
});
test('only local orb pickups play cues and guest prediction sounds once without duplicate point sounds', () => {
  for(const size of ['xs','small','medium','large','xl']) {
    const g=gameBoot();const player={tier:g.tierByName.Peanut,size:10};g.state.player=player;
    const orb={x:0,y:0,type:{key:size,points:5,color:'#fff',radius:3}};
    g.state.sprinkles=[orb];g.eatSprinkle(player,orb,0);
    assert.equal(g.events[0][0],`orb-${size}`);
    const before=g.events.length;g.state.sprinkles=[orb];g.eatSprinkle({tier:g.tierByName.Peanut,size:10},orb,0);
    assert.equal(g.events.length,before);
    g.state.sprinkles=[orb];g.guestEatSprinkles();assert.equal(g.events.at(-1)[0],`orb-${size}`);
    const after=g.events.length;g.guestEatSprinkles();assert.equal(g.events.length,after);
  }
});
test('both single-player and multiplayer run starts play one start cue; missing food does not', () => {
  const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
  const declaration=name=>{const start=source.indexOf(`  function ${name}(`);return source.slice(start,source.indexOf('\n  function ',start+1));};
  function run(name,owned=true) {
    const events=[];const element=()=>({classList:{add(){},remove(){}},style:{}});
    const noop=()=>{};const ctx={window:{GameMusic:{setMode:noop},GameSfx:{play:n=>events.push(n)}},save:{inventory:owned?{Peanut:1}:{},equipped:'Peanut'},
      state:{rivals:[]},net:{role:null},view:null,ARENA:1800,lastTime:0,previewId:0,performance:{now:()=>0},
      requestAnimationFrame:()=>1,cancelAnimationFrame:noop,loop:noop,ensureWorld:noop,arenaHumans:()=>[],farArenaSpot:()=>({x:0,y:0}),
      createFood:()=>({}),equippedTier:()=>({}),restoreCarriedPoints:noop,clampToArena:noop,spawnBetterRival:noop,updateHud:noop,
      openInventory:noop,closeRelics:noop,refreshPlayerRelics:noop,closeIndex:noop,closeInventory:noop,closeShop:noop,closeCraft:noop,closeMulti:noop};
    for(const key of ['pullResultsEl','lobbyHintEl','overlay','endBtn','inventoryBtn','shopBtn','craftBtn'])ctx[key]=element();
    vm.runInNewContext(declaration(name)+`\n${name}(1);`,ctx);return events;
  }
  assert.deepEqual(run('startRun'),['start']);assert.deepEqual(run('guestBeginRun'),['start']);assert.deepEqual(run('startRun',false),[]);
});

test('relic openings have distinct tear, deal, rising charges, beats and increasingly rich rarity fanfares',()=>{
 const g=boot();g.events.pointerdown();const ctx=g.contexts[0],play=name=>{const before=ctx.voices.length;const stop=g.api.play(name);const voices=ctx.voices.slice(before);assert.ok(voices.length>0,name);stop();return voices;};
 const tear=play('relic-open'),deal=play('relic-deal');assert.notDeepEqual(tear.map(v=>v.frequencyValue),deal.map(v=>v.frequencyValue));
 let previousNotes=0,previousCharge=0;
 for(const rarity of ['common','uncommon','rare','epic','legendary','secret']){
  const charge=play(`relic-charge-${rarity}`);assert.ok(charge[0].stops[0]>previousCharge);previousCharge=charge[0].stops[0];
  const beats=[1,2,3].map(p=>play(`relic-tick-${rarity}-${p}`).at(-1).frequencyValue);assert.ok(beats[0]<beats[1]&&beats[1]<beats[2]);
  const reveal=play(`relic-reveal-${rarity}`);assert.ok(reveal.length>=previousNotes);previousNotes=reveal.length;
 }
});
test('pack sound handles stop only their own voices; mute and hidden tabs silence every relic cue',()=>{
 const g=boot();g.events.pointerdown();const ctx=g.contexts[0],stop=g.api.play('relic-charge-secret');const charge=[...ctx.voices];g.api.play('collect');stop();stop();assert.ok(charge.every(v=>v.stops.includes('now')));assert.ok(ctx.voices.slice(charge.length).every(v=>!v.stops.includes('now')));
 g.api.play('relic-tick-secret-3');g.button.click();assert.ok(ctx.voices.every(v=>v.stops.includes('now')));const before=ctx.voices.length;g.api.play('relic-reveal-secret');assert.equal(ctx.voices.length,before);
 g.button.click();g.document.hidden=true;g.events.visibilitychange();g.api.play('relic-open');assert.equal(ctx.voices.length,before);
});

test('pack audio mode stops existing game effects and admits only pack cues until completion',()=>{
 const g=boot();g.events.pointerdown();const ctx=g.contexts[0];g.api.play('collect',.6);const existing=[...ctx.voices];g.api.setPackOpening(true);assert.ok(existing.every(v=>v.stops.includes('now')));
 const before=ctx.voices.length;for(const name of ['start','collect','death','orb-xs','bento'])g.api.play(name);assert.equal(ctx.voices.length,before);
 g.api.play('relic-open');g.api.play('relic-charge-secret');g.api.play('relic-tick-secret-1');g.api.play('relic-reveal-secret');assert.ok(ctx.voices.length>before);
 g.api.setPackOpening(false);const complete=ctx.voices.length;g.api.play('collect');assert.equal(ctx.voices.length,complete+3);
 const muted=boot(true);muted.events.pointerdown();muted.api.setPackOpening(true);muted.api.play('relic-open');assert.equal(muted.contexts.length,0);muted.api.setPackOpening(false);assert.equal(muted.storage.get('eatAFoodSfxMuted'),'true');
});

test('Secret cinematic rumble and impact have distinct layers and remain part of pack-only audio',()=>{
 const g=boot();g.events.pointerdown();g.api.setPackOpening(true);const ctx=g.contexts[0];const before=ctx.voices.length;const stop=g.api.play('relic-secret-blackout');const rumble=ctx.voices.slice(before);assert.equal(rumble.length,4);assert.ok(rumble.some(v=>v.frequencyValue<60));
 const impactStart=ctx.voices.length;g.api.play('relic-secret-impact');const impact=ctx.voices.slice(impactStart);assert.equal(impact.length,8);assert.ok(impact.some(v=>v.frequencyValue<60));stop();assert.ok(rumble.every(v=>v.stops.includes('now')));
});

test('Secret blackout is immediate with a downward whoosh; the charge grows for several seconds',()=>{
 const g=boot();g.events.pointerdown();g.api.setPackOpening(true);const ctx=g.contexts[0],start=ctx.currentTime;
 const stop=g.api.play('relic-secret-blackout');const blackout=[...ctx.voices];assert.ok(blackout.some(v=>v.time===start));assert.ok(blackout.every(v=>v.end<v.frequencyValue));assert.ok(blackout.some(v=>v.frequencyValue>=980&&v.end<=60));stop();
 const before=ctx.voices.length;g.api.play('relic-charge-secret');const charge=ctx.voices.slice(before);assert.equal(charge.length,4);assert.ok(charge.every(v=>v.end>v.frequencyValue));assert.ok(charge.every(v=>v.gainNode.events[1].time-v.time>=3));assert.ok(charge.every(v=>v.stops[0]-start<4.8));
});
test('Secret heartbeats accelerate across the three suspense pulses and leave a hush before impact',()=>{
 const g=boot();g.events.pointerdown();const ctx=g.contexts[0],counts=[],intervals=[];
 for(let pulse=1;pulse<=3;pulse++){
  const before=ctx.voices.length;const stop=g.api.play(`relic-tick-secret-${pulse}`);const voices=ctx.voices.slice(before),heartbeats=voices.filter(v=>v.frequencyValue<100);
  counts.push(heartbeats.length);intervals.push(heartbeats[1].time-heartbeats[0].time);assert.ok(voices.every(v=>v.stops[0]-ctx.currentTime<1.1));stop();
 }
 assert.deepEqual(counts,[2,4,6]);assert.ok(intervals[0]>intervals[1]&&intervals[1]>intervals[2]);
});

test('Secret impact retains the deep boom while all non-Secret reveal cues contain only high chimes',()=>{
 const g=boot();g.events.pointerdown();const ctx=g.contexts[0];
 for(const rarity of ['common','uncommon','rare','epic','legendary']){
  const before=ctx.voices.length,stop=g.api.play(`relic-reveal-${rarity}`),voices=ctx.voices.slice(before);assert.ok(voices.length>=3);assert.ok(voices.every(v=>v.frequencyValue>=392&&v.type==='sine'&&!v.end),rarity);stop();
 }
 const before=ctx.voices.length;g.api.play('relic-secret-impact');const voices=ctx.voices.slice(before);assert.equal(voices.length,8);
 assert.ok(voices.some(v=>v.type==='noise'&&v.filterNode.frequencyValue>=9000&&v.stops[0]-v.time<.2));assert.ok(voices.some(v=>v.frequencyValue<60&&v.stops[0]-v.time>1.5));assert.ok(voices.every(v=>v.type==='noise'?v.filterNode.end<v.filterNode.frequencyValue:v.end<v.frequencyValue));
});

test('all pack cues are louder while ordinary game effects retain their existing volume',()=>{
 const g=boot();g.events.pointerdown();const ctx=g.contexts[0];
 const peak=name=>{const before=ctx.voices.length,stop=g.api.play(name),voices=ctx.voices.slice(before);const result=voices[0].gainNode.events[1].value;stop();return result;};
 assert.ok(Math.abs(peak('relic-open')-.135)<1e-10);assert.ok(Math.abs(peak('relic-deal')-.135)<1e-10);assert.ok(Math.abs(peak('relic-charge-common')-.0855)<1e-10);
 assert.ok(Math.abs(peak('collect')-.09)<1e-10);assert.ok(Math.abs(peak('orb-small')-.1125)<1e-10);
 const before=ctx.voices.length;g.api.play('relic-secret-impact');const boom=ctx.voices.slice(before);assert.equal(boom.length,8);assert.ok(boom.some(v=>v.frequencyValue<70&&v.stops[0]-v.time>2));assert.ok(boom.some(v=>v.gainNode.events[1].value>.18));
});

test('Secret explosions layer filtered crack, debris and rolling noise over a deep thud, using one cached buffer',()=>{
 const g=boot();g.events.pointerdown();g.api.setPackOpening(true);const ctx=g.contexts[0];const stop=g.api.play('relic-secret-impact');
 const noise=ctx.voices.filter(v=>v.type==='noise');assert.equal(noise.length,5);assert.ok(noise.every(v=>v.filterNode.type==='lowpass'&&v.filterNode.end<v.filterNode.frequencyValue));
 assert.ok(noise.some(v=>v.stops[0]-v.time>2));assert.ok(noise.some(v=>v.time-ctx.currentTime>=.19));assert.equal(ctx.buffers.length,1);assert.ok(ctx.buffers[0].getChannelData(0).some(v=>v!==0));assert.ok(ctx.buffers[0].getChannelData(0).every(v=>v>=-1&&v<=1));
 stop();assert.ok(noise.every(v=>v.stops.includes('now')&&v.disconnected&&v.filterNode.disconnected));g.api.play('relic-secret-impact');assert.equal(ctx.buffers.length,1);
 g.button.click();assert.ok(ctx.voices.every(v=>v.stops.includes('now')));
});

const flushSample=()=>new Promise(resolve=>setImmediate(resolve));
test('Mythic plays one original-speed stereo recording continuously through buildup and impact',async()=>{
 const urls=[],g=boot(false,true,async url=>{urls.push(url);return{ok:true,arrayBuffer:async()=>new ArrayBuffer(16)};});
 g.events.pointerdown();const ctx=g.contexts[0];g.api.setPackOpening(true);await g.api.prepareMythic();
 assert.deepEqual(urls,['audio/relic-mythic-clean.wav?v=1']);assert.equal(ctx.decodeCalls,1);
 const chargeStop=g.api.play('relic-charge-mythic'),charge=ctx.voices.at(-1);assert.equal(charge.buffer.hatch,'clean');assert.equal(charge.buffer.numberOfChannels,2);assert.equal(charge.buffer.duration,4.2);assert.equal(charge.offset,0);assert.equal(charge.gainNode.events[0].value,1);
 assert.ok(Math.abs(charge.time+1.65-(ctx.currentTime+3.2))<1e-9,'the original impact lands at the visual flip without stretching');
 const count=ctx.voices.length;for(let n=1;n<=3;n++)g.api.play(`relic-tick-mythic-${n}`);assert.equal(ctx.voices.length,count);
 ctx.currentTime+=3.2;const impactStop=g.api.play('relic-reveal-mythic');assert.equal(ctx.voices.length,count,'the flip does not start a second sound');assert.ok(!charge.stops.includes('now'),'the recording is not cut at the flip');
 chargeStop();impactStop();assert.ok(charge.stops.includes('now'));
 await g.api.prepareMythic();assert.equal(urls.length,1);assert.equal(ctx.decodeCalls,1);
 const next=ctx.voices.length;g.api.play('relic-reveal-legendary');assert.ok(ctx.voices.slice(next).every(v=>!v.buffer?.hatch));
 const secret=ctx.voices.length;g.api.play('relic-secret-impact');assert.ok(ctx.voices.slice(secret).every(v=>!v.buffer?.hatch));
});
test('a Mythic impact without an active buildup starts at the original impact rather than replaying the rise',async()=>{
 const g=boot(false,true,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)}));g.events.pointerdown();await g.api.prepareMythic();const ctx=g.contexts[0];
 const stop=g.api.play('relic-reveal-mythic'),voice=ctx.voices.at(-1);assert.equal(voice.time,ctx.currentTime);assert.equal(voice.offset,1.65);assert.ok(Math.abs(voice.stops[0]-voice.time-2.565)<1e-9);stop();assert.ok(voice.stops.includes('now'));
});
test('pending Mythic audio cannot play after cancellation, mute, hiding or leaving the opening',async()=>{
 for(const action of ['cancel','mute','hide','close']){
  const resolvers=[];const g=boot(false,true,()=>new Promise(resolve=>{resolvers.push(resolve);}));g.events.pointerdown();g.api.setPackOpening(true);const ctx=g.contexts[0],stop=g.api.play('relic-reveal-mythic');
  if(action==='cancel'||action==='close')stop();if(action==='mute')g.button.click();if(action==='hide'){g.document.hidden=true;g.events.visibilitychange();}
  if(action==='close')g.api.setPackOpening(false);
  resolvers.forEach(resolve=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)}));await flushSample();assert.equal(ctx.voices.length,0,action);
 }
});
test('an unavailable recording never restores the removed synthesized Mythic sounds',async()=>{
 const g=boot(false,true,async()=>({ok:false}));g.events.pointerdown();const ctx=g.contexts[0];await g.api.prepareMythic();g.api.play('relic-charge-mythic');g.api.play('relic-reveal-mythic');await flushSample();assert.equal(ctx.voices.length,0);
 for(let n=1;n<=3;n++)g.api.play(`relic-tick-mythic-${n}`);assert.equal(ctx.voices.length,0);
 g.api.play('relic-reveal-legendary');assert.ok(ctx.voices.length>0);
 const muted=boot(true,true,()=>assert.fail('muted effects must not request audio'));muted.events.pointerdown();muted.api.play('relic-reveal-mythic');assert.equal(muted.contexts.length,0);
});
