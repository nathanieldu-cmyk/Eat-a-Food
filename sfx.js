(() => {
  // Original synthesized effects: frequency, duration, offset, waveform, end frequency.
  const sounds = {
    start: [[392, .08, 0], [523.25, .08, .08], [783.99, .18, .16]],
    death: [[330, .45, 0, 'triangle', 65], [164.81, .5, .035, 'sine', 41.2]],
    bento: [[220, .09, 0, 'triangle', 880], [659.25, .25, .10], [830.61, .25, .10], [987.77, .3, .10]],
    collect: [[880, .08, 0], [1174.66, .09, .08], [1568, .17, .16]],
  };
  // Layer a crisp bite, a rounded impact, and a short juicy pop. Larger orbs have more weight.
  const crunches = {
    'orb-xs': {size: 0, duration: .075, pitch: 240},
    'orb-small': {size: 1, duration: .105, pitch: 205},
    'orb-medium': {size: 2, duration: .14, pitch: 170},
    'orb-large': {size: 3, duration: .185, pitch: 135},
    'orb-xl': {size: 4, duration: .24, pitch: 105},
  };
  const crunchBuffers = new Map();
  const button = document.getElementById('sfx-toggle');
  const active = new Set();
  const lastOrb = new Map();
  let context = null;
  let lastPickupAt = -Infinity;
  let pickupChain = 0;
  let biteVariation = 0;
  let unlocked = false;
  let muted = false;
  try { muted = localStorage.getItem('eatAFoodSfxMuted') === 'true'; } catch (_) {}

  function stopAll() {
    for (const voice of active) {
      try { voice.osc.stop(); } catch (_) {}
      voice.osc.disconnect();
      voice.gain.disconnect();
    }
    active.clear();
  }

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

  function crunchBuffer(name, profile) {
    if (crunchBuffers.has(name)) return crunchBuffers.get(name);
    const {size, duration, pitch} = profile;
    const rate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.ceil(duration * rate), rate);
    const data = buffer.getChannelData(0);
    const grain = Math.max(1, Math.round(rate / (11000 - size * 1100)));
    let seed = 12791 + size * 7919;
    let noise = 0, low = 0, phase = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      if (i % grain === 0) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        noise = ((seed >>> 0) / 4294967296) * 2 - 1;
      }
      low += .28 * (noise - low);
      const crisp = (noise - low) * .65 + low * .35;
      let envelope = Math.exp(-t / .006);
      for (let crack = 1; crack <= size + 3; crack++) {
        const elapsed = t - crack * (.006 + size * .0018);
        if (elapsed >= 0) envelope += .7 * Math.pow(.72, crack) * Math.exp(-elapsed / (.003 + size * .0007));
      }
      const frequency = pitch * (.3 + .7 * Math.exp(-t * 75));
      phase += 2 * Math.PI * frequency / rate;
      const body = (Math.sin(phase) + .22 * Math.sin(phase * 2.03)) * Math.exp(-t / (.023 + size * .013));
      const popTime = t - (.018 + size * .004);
      const popPhase = 2 * Math.PI * (70 * popTime + (450 - size * 45) * .008 * (1 - Math.exp(-Math.max(0, popTime) / .008)));
      const pop = popTime > 0 ? Math.sin(popPhase) * Math.exp(-popTime / (.012 + size * .003)) * Math.min(1, popTime / .001) : 0;
      const bite = crisp * envelope * .95 + body * 1.1 + pop * .42;
      const fade = Math.min(1, t / .0008, (duration - t) / .004);
      data[i] = Math.tanh(bite * 1.5) * .85 * fade * Math.pow(1 - t / duration, 1.2);
    }
    crunchBuffers.set(name, buffer);
    return buffer;
  }

  function play(name, delay = 0) {
    const notes = sounds[name];
    const crunch = crunches[name];
    if ((!notes && !crunch) || !wake()) return;
    const now = context.currentTime;
    if (name === 'start') { pickupChain = 0; lastPickupAt = -Infinity; }
    if (name.startsWith('orb-')) {
      if (now - (lastOrb.get(name) ?? -Infinity) < .045) return;
      lastOrb.set(name, now);
    }
    if (active.size + (crunch ? 1 : notes.length) > 24) {
      if (name.startsWith('orb-')) return;
      stopAll();
    }
    if (crunch) {
      const source = context.createBufferSource();
      source.buffer = crunchBuffer(name, crunch);
      pickupChain = now - lastPickupAt < .22 ? Math.min(5, pickupChain + 1) : 0;
      lastPickupAt = now;
      biteVariation = (biteVariation + 1) % 3;
      // Tiny pitch variation keeps repeated bites lively without changing the size hierarchy.
      source.playbackRate.value = 1 + pickupChain * .015 + biteVariation * .008;
      const gain = context.createGain();
      const start = now + Math.max(0, delay);
      gain.gain.setValueAtTime(.22, start);
      source.connect(gain);
      gain.connect(context.destination);
      const voice = {osc: source, gain};
      active.add(voice);
      source.onended = () => { active.delete(voice); source.disconnect(); gain.disconnect(); };
      source.start(start);
      source.stop(start + crunch.duration + .015);
      return;
    }
    for (const [frequency, duration, offset, wave = 'sine', end] of notes) {
      const start = now + Math.max(0, delay) + offset;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(frequency, start);
      if (end) osc.frequency.exponentialRampToValueAtTime(end, start + duration);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.09, start + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      osc.connect(gain);
      gain.connect(context.destination);
      const voice = {osc, gain};
      active.add(voice);
      osc.onended = () => { active.delete(voice); osc.disconnect(); gain.disconnect(); };
      osc.start(start);
      osc.stop(start + duration + .015);
    }
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
      pickupChain = 0; lastPickupAt = -Infinity;
      if (context?.state === 'running') context.suspend().catch(() => {});
    } else wake();
  });
  window.addEventListener('pagehide', stopAll);
  window.GameSfx = {play};
  render();
})();
