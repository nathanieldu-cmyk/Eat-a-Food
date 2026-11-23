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
    decodeAudioData(bytes) {this.decodeCalls=(this.decodeCalls||0)+1;return Promise.resolve(bytes.byteLength===64?{duration:12.78,numberOfChannels:2,secret:'reference'}:{duration:4.85,numberOfChannels:2,hatch:'clean'});}
    resume() {this.state='running';return Promise.resolve();}
    suspend() {this.state='suspended';return Promise.resolve();}
  }
  const window = {AudioContext:supported ? AudioContext : undefined, addEventListener(k,fn) {windowEvents[k]=fn;}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'relic-opening.js'),'utf8'), {window});
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
 for(const rarity of ['common','uncommon','rare','epic','legendary']){
  const charge=play(`relic-charge-${rarity}`);assert.ok(charge[0].stops[0]>previousCharge);previousCharge=charge[0].stops[0];
  const beats=[1,2,3].map(p=>play(`relic-tick-${rarity}-${p}`).at(-1).frequencyValue);assert.ok(beats[0]<beats[1]&&beats[1]<beats[2]);
  const reveal=play(`relic-reveal-${rarity}`);assert.ok(reveal.length>=previousNotes);previousNotes=reveal.length;
 }
});
test('pack sound handles stop only their own voices; mute and hidden tabs silence every relic cue',()=>{
 const g=boot();g.events.pointerdown();const ctx=g.contexts[0],stop=g.api.play('relic-charge-rare');const charge=[...ctx.voices];g.api.play('collect');stop();stop();assert.ok(charge.every(v=>v.stops.includes('now')));assert.ok(ctx.voices.slice(charge.length).every(v=>!v.stops.includes('now')));
 g.api.play('relic-tick-rare-3');g.button.click();assert.ok(ctx.voices.every(v=>v.stops.includes('now')));const before=ctx.voices.length;g.api.play('relic-reveal-rare');assert.equal(ctx.voices.length,before);
 g.button.click();g.document.hidden=true;g.events.visibilitychange();g.api.play('relic-open');assert.equal(ctx.voices.length,before);
});

test('pack audio mode stops existing game effects and admits only pack cues until completion',()=>{
 const g=boot();g.events.pointerdown();const ctx=g.contexts[0];g.api.play('collect',.6);const existing=[...ctx.voices];g.api.setPackOpening(true);assert.ok(existing.every(v=>v.stops.includes('now')));
 const before=ctx.voices.length;for(const name of ['start','collect','death','orb-xs','bento'])g.api.play(name);assert.equal(ctx.voices.length,before);
 g.api.play('relic-open');g.api.play('relic-charge-rare');g.api.play('relic-tick-rare-1');g.api.play('relic-reveal-rare');assert.ok(ctx.voices.length>before);
 g.api.setPackOpening(false);const complete=ctx.voices.length;g.api.play('collect');assert.equal(ctx.voices.length,complete+3);
 const muted=boot(true);muted.events.pointerdown();muted.api.setPackOpening(true);muted.api.play('relic-open');assert.equal(muted.contexts.length,0);muted.api.setPackOpening(false);assert.equal(muted.storage.get('eatAFoodSfxMuted'),'true');
});






test('ordinary relic reveals keep their high chimes',()=>{
 const g=boot();g.events.pointerdown();const ctx=g.contexts[0];
 for(const rarity of ['common','uncommon','rare','epic','legendary']){
  const before=ctx.voices.length,stop=g.api.play(`relic-reveal-${rarity}`),voices=ctx.voices.slice(before);assert.ok(voices.length>=3);assert.ok(voices.every(v=>v.frequencyValue>=392&&v.type==='sine'&&!v.end),rarity);stop();
 }

});

test('all pack cues are louder while ordinary game effects retain their existing volume',()=>{
 const g=boot();g.events.pointerdown();const ctx=g.contexts[0];
 const peak=name=>{const before=ctx.voices.length,stop=g.api.play(name),voices=ctx.voices.slice(before);const result=voices[0].gainNode.events[1].value;stop();return result;};
 assert.ok(Math.abs(peak('relic-open')-.135)<1e-10);assert.ok(Math.abs(peak('relic-deal')-.135)<1e-10);assert.ok(Math.abs(peak('relic-charge-common')-.0855)<1e-10);
 assert.ok(Math.abs(peak('collect')-.09)<1e-10);assert.ok(Math.abs(peak('orb-small')-.1125)<1e-10);

});



const flushSample=()=>new Promise(resolve=>setImmediate(resolve));
test('Mythic plays one original-speed stereo recording continuously through buildup and impact',async()=>{
 const urls=[],g=boot(false,true,async url=>{urls.push(url);return{ok:true,arrayBuffer:async()=>new ArrayBuffer(16)};});
 g.events.pointerdown();const ctx=g.contexts[0];g.api.setPackOpening(true);await g.api.prepareMythic();
 assert.deepEqual(urls,['audio/relic-mythic-continuous.wav?v=10']);assert.equal(ctx.decodeCalls,1);
 const chargeStop=g.api.play('relic-charge-mythic'),charge=ctx.voices.at(-1);assert.equal(charge.buffer.hatch,'clean');assert.equal(charge.buffer.numberOfChannels,2);assert.equal(charge.buffer.duration,4.85);assert.equal(charge.offset,0);assert.equal(charge.gainNode.events[0].value,1);
 assert.equal(charge.time,ctx.currentTime,'buildup starts with the moving outline');
 assert.ok(Math.abs((ctx.currentTime+2.5)-(charge.time+2.3)-.2)<1e-9,'the audio moves 100ms later while the card reveal stays at 2.5 seconds');
 const count=ctx.voices.length;g.api.play('relic-charge-mythic');assert.equal(ctx.voices.length,count,'a repeated charge cue cannot layer or restart the recording');assert.ok(!charge.stops.includes('now'));for(let n=1;n<=3;n++)g.api.play(`relic-tick-mythic-${n}`);assert.equal(ctx.voices.length,count);
 ctx.currentTime+=2.5;const impactStop=g.api.play('relic-reveal-mythic');assert.equal(ctx.voices.length,count,'the flip does not start a second sound');assert.ok(!charge.stops.includes('now'),'the recording is not cut at the flip');
 chargeStop();impactStop();assert.ok(charge.stops.includes('now'));
 await g.api.prepareMythic();assert.equal(urls.length,1);assert.equal(ctx.decodeCalls,1);
 const next=ctx.voices.length;g.api.play('relic-reveal-legendary');assert.ok(ctx.voices.slice(next).every(v=>!v.buffer?.hatch));
 const secret=ctx.voices.length;g.api.play('relic-secret-impact');assert.ok(ctx.voices.slice(secret).every(v=>!v.buffer?.hatch));
});
test('a Mythic impact without an active buildup starts at the original impact rather than replaying the rise',async()=>{
 const g=boot(false,true,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)}));g.events.pointerdown();await g.api.prepareMythic();const ctx=g.contexts[0];
 const stop=g.api.play('relic-reveal-mythic'),voice=ctx.voices.at(-1);assert.equal(voice.time,ctx.currentTime);assert.equal(voice.offset,2.3);assert.ok(Math.abs(voice.stops[0]-voice.time-2.565)<1e-9);stop();assert.ok(voice.stops.includes('now'));
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


test('Mythic has a silent lead-in followed by the complete untouched original recording',()=>{
 const wav=rel=>{
  const bytes=fs.readFileSync(path.join(root,rel));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
  let format,data;for(let pos=12;pos+8<=bytes.length;){const size=bytes.readUInt32LE(pos+4),id=bytes.toString('ascii',pos,pos+4);if(id==='fmt ')format=bytes.subarray(pos+8,pos+8+size);if(id==='data')data=bytes.subarray(pos+8,pos+8+size);pos+=8+size+(size%2);}
  assert.ok(format&&data);assert.equal(format.readUInt16LE(0),1);assert.equal(format.readUInt16LE(2),2);assert.equal(format.readUInt32LE(4),44100);assert.equal(format.readUInt16LE(14),16);return data;
 };
 const original=wav('audio/relic-mythic-clean.wav'),refined=wav('audio/relic-mythic-continuous.wav'),frame=seconds=>Math.round(seconds*44100)*4;
 assert.equal(refined.length,frame(4.85));assert.equal(original.length,frame(4.2));
 assert.ok(refined.subarray(0,frame(.65)).every(sample=>sample===0),'the beginning is truly silent');
 assert.deepEqual(refined.subarray(frame(.65)),original,'the entire original buildup, boom and tail are unprocessed');
 assert.deepEqual(refined.subarray(frame(2.3)),original.subarray(frame(1.65)),'the original boom is preserved after moving the audio 100ms later');
 for(let offset=0;offset<refined.length;offset+=2)assert.ok(Math.abs(refined.readInt16LE(offset))<32767,'no clipped samples');
});


test('Secret uses the supplied stereo recording once for blackout, pack animation and reward burst',async()=>{
 const urls=[],g=boot(false,true,async url=>{urls.push(url);return{ok:true,arrayBuffer:async()=>new ArrayBuffer(64)};});g.events.pointerdown();
 await g.api.prepareSecret();const ctx=g.contexts[0];assert.deepEqual(urls,['audio/relic-secret-reference.wav?v=1']);assert.equal(ctx.decodeCalls,1);
 const stop=g.api.play('relic-secret-blackout'),voice=ctx.voices.at(-1);assert.equal(voice.buffer.secret,'reference');assert.equal(voice.buffer.duration,12.78);assert.equal(voice.buffer.numberOfChannels,2);assert.equal(voice.offset,0);assert.equal(voice.time,ctx.currentTime);assert.equal(voice.gainNode.events[0].value,1);
 const count=ctx.voices.length;g.api.play('relic-charge-secret');for(let pulse=1;pulse<=3;pulse++)g.api.play(`relic-tick-secret-${pulse}`);assert.equal(ctx.voices.length,count,'no old synthesized heartbeat or charge layers');
 ctx.currentTime+=10.48;g.api.play('relic-secret-impact');assert.equal(ctx.voices.length,count,'the recorded reward burst is not played twice');assert.ok(!voice.stops.includes('now'));
 await g.api.prepareSecret();assert.equal(urls.length,1);assert.equal(ctx.decodeCalls,1);stop();assert.ok(voice.stops.includes('now'));
 const next=ctx.voices.length;g.api.play('relic-secret-blackout');assert.equal(ctx.voices.length,next+1,'another Secret starts the complete recording again');g.button.click();assert.ok(ctx.voices.at(-1).stops.includes('now'));
});
test('Secret reveal audio can resume at the recorded burst without replaying the blackout',async()=>{
 const g=boot(false,true,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(64)}));g.events.pointerdown();await g.api.prepareSecret();const ctx=g.contexts[0];
 const stop=g.api.play('relic-secret-impact'),voice=ctx.voices.at(-1);assert.equal(voice.offset,10.48);assert.equal(voice.time,ctx.currentTime);assert.ok(Math.abs(voice.stops[0]-voice.time-2.315)<1e-9);stop();assert.ok(voice.stops.includes('now'));
});
test('pending Secret audio respects cancellation, muting, hidden tabs and closing the opening',async()=>{
 for(const action of ['cancel','mute','hide','close']){
  let resolve;const g=boot(false,true,()=>new Promise(done=>{resolve=done;}));g.events.pointerdown();g.api.prepareSecret();const ctx=g.contexts[0],stop=g.api.play('relic-secret-blackout');
  if(action==='cancel'||action==='close')stop();if(action==='mute')g.button.click();if(action==='hide'){g.document.hidden=true;g.events.visibilitychange();}if(action==='close')g.api.setPackOpening(false);
  resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(64)});await flushSample();assert.equal(ctx.voices.length,0,action);
 }
 const muted=boot(true,true,()=>assert.fail('muted audio must not be fetched'));muted.events.pointerdown();assert.equal(muted.api.prepareSecret(),null);muted.api.play('relic-secret-blackout');assert.equal(muted.contexts.length,0);
});
test('failed Secret recordings remain silent rather than restoring the removed synthetic sounds',async()=>{
 const g=boot(false,true,async()=>({ok:false}));g.events.pointerdown();await g.api.prepareSecret();
 for(const name of ['relic-secret-blackout','relic-charge-secret','relic-tick-secret-1','relic-tick-secret-2','relic-tick-secret-3','relic-secret-impact'])g.api.play(name);
 await flushSample();assert.equal(g.contexts[0].voices.length,0);g.api.play('relic-reveal-rare');assert.ok(g.contexts[0].voices.length>0);
});
test('Secret reference asset has the full scene duration, a louder blackout and no clipped samples',()=>{
 const bytes=fs.readFileSync(path.join(root,'audio/relic-secret-reference.wav'));let format,data;
 for(let pos=12;pos+8<=bytes.length;){const size=bytes.readUInt32LE(pos+4),id=bytes.toString('ascii',pos,pos+4);if(id==='fmt ')format=bytes.subarray(pos+8,pos+8+size);if(id==='data')data=bytes.subarray(pos+8,pos+8+size);pos+=8+size+(size%2);}
 assert.ok(format&&data);assert.equal(format.readUInt16LE(0),1);assert.equal(format.readUInt16LE(2),2);assert.equal(format.readUInt32LE(4),44100);assert.equal(format.readUInt16LE(14),16);assert.equal(data.length,Math.round(12.78*44100)*4);
 let blackoutEnergy=0;const blackoutBytes=Math.round(1.6*44100)*4;
 for(let i=0;i<data.length;i+=2){const sample=data.readInt16LE(i)/32768;assert.ok(Math.abs(sample)<.999,'no clipping');if(i<blackoutBytes)blackoutEnergy+=sample*sample;}
 assert.ok(Math.sqrt(blackoutEnergy/(blackoutBytes/2))>.1,'blackout is boosted above its original level');
});
