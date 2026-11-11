(() => {
  // Original synthesized effects: frequency, duration, offset, waveform, end frequency.
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
  const button = document.getElementById('sfx-toggle');
  const active = new Set();
  const lastOrb = new Map();
  let context = null;
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

  function play(name, delay = 0) {
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
      if (context?.state === 'running') context.suspend().catch(() => {});
    } else wake();
  });
  window.addEventListener('pagehide', stopAll);
  window.GameSfx = {play};
  render();
})();
