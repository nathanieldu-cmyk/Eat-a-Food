const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
function boot(saved = 'false', reject = false) {
  const events = {}, windowEvents = {}, tracks = [];
  const button = {textContent: '', setAttribute(k,v) {this[k]=v;}, addEventListener(k,fn) {this[k]=fn;}};
  const storage = new Map([['eatAFoodMusicMuted', saved]]);
  const document = {body:{appendChild() {}}, hidden:false, getElementById:()=>button, addEventListener(k,fn) {events[k]=fn;}};
  const window = {addEventListener(k,fn) {windowEvents[k]=fn;}};
  function Audio(src) {
    Object.assign(this, {src, dataset:{}, paused:true, plays:0, pauses:0});
    this.pause = () => {this.paused=true; this.pauses++;};
    this.play = () => {this.plays++; if (reject) return Promise.reject(new Error('Autoplay blocked')); this.paused=false; return Promise.resolve();};
    tracks.push(this);
  }
  vm.runInNewContext(fs.readFileSync(path.join(root, 'music.js'), 'utf8'), {
    window, document, Audio, localStorage:{getItem:k=>storage.get(k), setItem:(k,v)=>storage.set(k,v)},
  });
  return {events, windowEvents, button, storage, document, tracks, api:window.GameMusic};
}
test('first user gesture starts the looping 82 BPM lobby track; run transitions never overlap or restart a playing track', async () => {
  const g = boot(); const [lobby,run] = g.tracks;
  assert.equal(lobby.plays+run.plays,0);
  assert.match(lobby.src,/local-forecast-elevator/);
  assert.match(run.src,/monkeys-spinning-monkeys/);
  for(const t of g.tracks) {assert.equal(t.loop,true); assert.equal(t.volume,0.3); assert.ok(fs.statSync(path.join(root,t.src)).size>100000);}
  g.events.pointerdown({}); await Promise.resolve();
  assert.equal(lobby.paused,false); assert.equal(run.paused,true);
  g.api.setMode('lobby'); assert.equal(lobby.plays,1);
  g.api.setMode('run'); await Promise.resolve();
  assert.equal(lobby.paused,true); assert.equal(run.paused,false);
  g.api.setMode('run'); assert.equal(run.plays,1);
  g.api.setMode('lobby'); await Promise.resolve();
  assert.equal(lobby.paused,false); assert.equal(run.paused,true);
});
test('mute persists, unmute works, and hidden tabs pause before resuming the correct track', async () => {
  const g = boot('true'); const [lobby,run] = g.tracks;
  g.events.keydown({}); assert.equal(lobby.plays,0);
  g.button.click(); await Promise.resolve();
  assert.equal(lobby.paused,false); assert.equal(g.storage.get('eatAFoodMusicMuted'),'false');
  g.document.hidden=true; g.events.visibilitychange(); assert.equal(lobby.paused,true);
  g.api.setMode('run'); assert.equal(run.plays,0);
  g.document.hidden=false; g.events.visibilitychange(); await Promise.resolve();
  assert.equal(run.paused,false); assert.equal(lobby.paused,true);
  g.button.click(); assert.equal(run.paused,true); assert.equal(g.storage.get('eatAFoodMusicMuted'),'true');
});
test('blocked playback retries on later gestures and a pending play cannot revive the previous mode', async () => {
  const g = boot('false',true);
  g.events.pointerdown({}); await Promise.resolve();
  g.events.pointerdown({}); await Promise.resolve();
  assert.equal(g.tracks[0].plays,2);
  const h = boot(); h.events.pointerdown({}); h.api.setMode('run');
  await Promise.resolve(); assert.equal(h.tracks[0].paused,true); assert.equal(h.tracks[1].paused,false);
});
