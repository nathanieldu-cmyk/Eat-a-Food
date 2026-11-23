(() => {
  // Original synthesized effects: frequency, duration, offset, waveform, end frequency, level, attack.
  const sounds = {
    start: [[392, .08, 0], [523.25, .08, .08], [783.99, .18, .16]],
    'orb-xs': [[1568, .045, 0, 'sine', 1174.66]],
    'orb-small': [[1174.66, .075, 0, 'triangle', 1568]],
    'orb-medium': [[783.99, .10, 0], [1046.5, .08, .055]],
    'orb-large': [[523.25, .13, 0, 'triangle'], [783.99, .15, .075]],
    'orb-xl': [[329.63, .14, 0, 'triangle'], [659.25, .16, .065], [987.77, .20, .13]],
    death: [[330, .45, 0, 'triangle', 65], [164.81, .5, .035, 'sine', 41.2]],
    bento: [[220, .09, 0, 'triangle', 880], [659.25, .25, .10], [830.61, .25, .10], [987.77, .3, .10]],
    collect: [[880, .08, 0], [1174.66, .09, .08], [1568, .17, .16]],
  };
  // Original synthesized pack tear, card shuffle, rising tension, and rarity fanfares.
  sounds['relic-open'] = [[92,.24,0,'triangle',370],[1700,.07,.04,'triangle',320],[2200,.08,.14,'triangle',460],[196,.4,.22,'sine',392]];
  sounds['relic-deal'] = [[740,.09,0,'triangle',210],[880,.09,.13,'triangle',250],[1040,.1,.26,'triangle',300]];
  // A physical crash: broadband crack and debris over a falling thud and rumble.
  // For noise layers the frequency values control a low-pass filter cutoff.
  const revealBoom = [[110,.7,0,'sine',28,1.45,.003],[49,2.35,0,'sine',24,1.5,.009],[9500,.16,0,'noise',2200,.85,.002],[3200,.82,.012,'noise',95,1,.004],[170,1.05,.006,'triangle',42,.62,.002],[760,2.2,.035,'noise',55,.68,.012],[1150,.38,.19,'noise',160,.24,.002],[450,.45,.48,'noise',70,.16,.003]];
  const relicRarities = ['common','uncommon','rare','epic','legendary','mythic','secret'];
  const fanfare = [392,493.88,587.33,783.99,987.77,1174.66,1567.98];
  for (const [rank,rarity] of relicRarities.entries()) {
    if (rarity === 'mythic') continue; // Mythics use only the recorded buildup and impact.
    sounds[`relic-charge-${rarity}`] = [[70+rank*9,.3+rank*.4,0,'triangle',150+rank*30],[180+rank*22,.25+rank*.3,.08,'sine',350+rank*75]];
    for (let pulse=1;pulse<=3;pulse++) sounds[`relic-tick-${rarity}-${pulse}`] = [[95+rank*10,.13,0,'triangle',55],[360+rank*45+pulse*90,.10+pulse*.02,.025,'sine',430+rank*55+pulse*110]];
    sounds[`relic-reveal-${rarity}`] = fanfare.slice(0,3+Math.floor(rank/1.5)).map((frequency,index)=>[frequency,.25+rank*.06,index*.065,'sine']);
  }
  // A sudden pitch collapse marks the blackout, then a slow riser and
  // accelerating double heartbeats build toward a brief hush before the flip.
  sounds['relic-secret-blackout'] = [[980,.40,0,'triangle',60,.32],[150,.85,0,'sine',34,1.15],[45,1.4,.02,'triangle',28,.65],[1400,.80,.04,'sine',200,.20]];
  sounds['relic-charge-secret'] = [[46,4.35,0,'sine',68,.75,3.2],[93,4.25,0,'triangle',196,.22,3.4],[185,4.10,.2,'sine',740,.35,3.7],[392,3.4,.65,'sine',1568,.18,3.1]];
  for (let pulse=1;pulse<=3;pulse++) {
    const beats = pulse===1 ? [0,.22] : pulse===2 ? [0,.16,.38,.52] : [0,.11,.23,.34,.46,.57];
    sounds[`relic-tick-secret-${pulse}`] = beats.map((offset,index)=>[index%2?65:84,.16,offset,'sine',34,index%2?.75:1]);
    sounds[`relic-tick-secret-${pulse}`].push([280+pulse*120,.25,beats.at(-1)+.03,'triangle',620+pulse*220,.22,.12]);
  }
  sounds['relic-secret-impact'] = revealBoom;
  const button = document.getElementById('sfx-toggle');
  const active = new Set();
  const lastOrb = new Map();
  let context = null, noiseBuffer = null;
  const mythicSample = {url:'audio/relic-mythic-continuous.wav?v=2', buffer:null, promise:null};
  const mythicImpactOffset = 3.2;
  let mythicVoice = null;
  let unlocked = false;
  let muted = false;
  let packOpening = false;
  try { muted = localStorage.getItem('eatAFoodSfxMuted') === 'true'; } catch (_) {}

  function stopVoice(voice) {
    if (!active.delete(voice)) return;
    if (mythicVoice === voice) mythicVoice = null;
    try { voice.osc.stop(); } catch (_) {}
    voice.osc?.disconnect(); voice.filter?.disconnect(); voice.gain?.disconnect();
  }
  function stopAll() { for (const voice of [...active]) stopVoice(voice); }

  function wake() {
    if (!unlocked || muted || document.hidden) return false;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      if (!context) context = new AudioContext();
      if (context.state === 'suspended' || context.state === 'interrupted') context.resume().catch(() => {});
      return context.state !== 'closed';
    } catch (_) { return false; }
  }

  function impactNoise() {
    if (noiseBuffer) return noiseBuffer;
    noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 3), context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    // Independent from the game's random rolls, with no download on first use.
    let seed = 0x5eed;
    for (let i=0; i<data.length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      data[i] = (seed >>> 0) / 2147483648 - 1;
    }
    return noiseBuffer;
  }

  // Extend only the quiet opening; the main rise, impact and tail stay original.
  function loadMythicSample() {
    if (mythicSample.buffer) return Promise.resolve(mythicSample.buffer);
    if (!mythicSample.promise && context && typeof fetch === 'function') {
      const decoder = context;
      const options = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? {signal:AbortSignal.timeout(5000)} : undefined;
      mythicSample.promise = fetch(mythicSample.url, options)
        .then(response => { if (!response.ok) throw new Error('Hatch sound unavailable'); return response.arrayBuffer(); })
        .then(bytes => decoder.decodeAudioData(bytes))
        .then(buffer => { mythicSample.buffer = buffer; return buffer; })
        .catch(() => null);
    }
    return mythicSample.promise || Promise.resolve(null);
  }
  function prepareMythic() {
    return wake() ? loadMythicSample() : null;
  }
  function playMythic(name, delay) {
    const impactOnly = name === 'relic-reveal-mythic';
    // Repeated buildup or reveal cues must reuse the one active recording.
    if (mythicVoice && active.has(mythicVoice)) {
      const voice = mythicVoice;
      return () => stopVoice(voice);
    }
    if (active.size >= 24) stopAll();
    const voice = {osc:null, gain:null};
    mythicVoice = voice; active.add(voice);
    function start(buffer) {
      if (!active.has(voice) || muted || document.hidden) return;
      if (!buffer) { stopVoice(voice); return; }
      const source = context.createBufferSource(), gain = context.createGain();
      voice.osc = source; voice.gain = gain; source.buffer = buffer;
      const chargeSeconds = (window.GameRelicReveal?.revealTimings.mythic || 3200) / 1000;
      const lead = impactOnly ? 0 : Math.max(0, chargeSeconds - mythicImpactOffset);
      const offset = impactOnly ? mythicImpactOffset : 0;
      const at = context.currentTime + Math.max(0, delay) + lead;
      gain.gain.setValueAtTime(1, at);
      source.connect(gain); gain.connect(context.destination);
      source.onended = () => { active.delete(voice); if (mythicVoice === voice) mythicVoice = null; source.disconnect(); gain.disconnect(); };
      source.start(at, offset); source.stop(at + buffer.duration - offset + .015);
    }
    if (mythicSample.buffer) start(mythicSample.buffer); else loadMythicSample().then(start);
    return () => stopVoice(voice);
  }
  function play(name, delay = 0) {
    if (name === 'relic-charge-mythic' || name === 'relic-reveal-mythic') return wake() ? playMythic(name, delay) : undefined;
    return playSynth(name, delay);
  }

  function playSynth(name, delay = 0) {
    if (packOpening && !name.startsWith('relic-')) return;
    const notes = sounds[name];
    if (!notes || !wake()) return;
    const now = context.currentTime;
    if (name.startsWith('orb-')) {
      if (now - (lastOrb.get(name) ?? -Infinity) < .045) return;
      lastOrb.set(name, now);
    }
    if (active.size + notes.length > 24) {
      if (name.startsWith('orb-')) return;
      stopAll();
    }
    const volume = name.startsWith('orb-') ? 1.25 : name.startsWith('relic-charge-') ? .95 : name.startsWith('relic-') ? 1.5 : 1;
    const voices = [];
    for (const [frequency, duration, offset, wave = 'sine', end, level = 1, attack = .008] of notes) {
      const start = now + Math.max(0, delay) + offset;
      const noisy = wave === 'noise';
      const osc = noisy ? context.createBufferSource() : context.createOscillator();
      const gain = context.createGain();
      const filter = noisy ? context.createBiquadFilter() : null;
      if (noisy) {
        osc.buffer = impactNoise(); filter.type = 'lowpass'; filter.Q.value = .7;
        filter.frequency.setValueAtTime(frequency, start);
        if (end) filter.frequency.exponentialRampToValueAtTime(end, start + duration);
      } else {
        osc.type = wave;
        osc.frequency.setValueAtTime(frequency, start);
        if (end) osc.frequency.exponentialRampToValueAtTime(end, start + duration);
      }
      gain.gain.setValueAtTime(.0001 * volume, start);
      gain.gain.exponentialRampToValueAtTime(.09 * volume * level, start + Math.max(.001, Math.min(attack, duration - .01)));
      gain.gain.exponentialRampToValueAtTime(.0001 * volume, start + duration);
      if (filter) { osc.connect(filter); filter.connect(gain); } else osc.connect(gain);
      gain.connect(context.destination);
      const voice = {osc, gain, filter};
      active.add(voice); voices.push(voice);
      osc.onended = () => { active.delete(voice); osc.disconnect(); filter?.disconnect(); gain.disconnect(); };
      osc.start(start);
      osc.stop(start + duration + .015);
    }
    return () => { for (const voice of voices) stopVoice(voice); };
  }

  function render() {
    button.textContent = muted ? '🔕' : '🔔';
    button.setAttribute('aria-pressed', String(!muted));
    button.title = muted ? 'Unmute sound effects' : 'Mute sound effects';
  }

  function activate() { unlocked = true; wake(); }
  document.addEventListener('pointerdown', activate, {passive:true});
  document.addEventListener('keydown', activate);
  button.addEventListener('click', () => {
    unlocked = true;
    muted = !muted;
    try { localStorage.setItem('eatAFoodSfxMuted', String(muted)); } catch (_) {}
    if (muted) stopAll(); else wake();
    render();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAll();
      lastOrb.clear();
      if (context?.state === 'running') context.suspend().catch(() => {});
    } else wake();
  });
  window.addEventListener('pagehide', stopAll);
  window.GameSfx = {play, prepareMythic, setPackOpening(active) { packOpening = !!active; if (packOpening) { stopAll(); lastOrb.clear(); prepareMythic(); } }};
  render();
})();
