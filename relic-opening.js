(() => {
  function createController(onChange, {schedule = setTimeout, cancel = clearTimeout, reducedMotion = false} = {}) {
    let phase = 'closed', rewards = [], revealed = new Set(), timers = [], generation = 0, packId = 'common', ownedCounts = [];
    const snapshot = () => ({phase, rewards: [...rewards], revealed: [...revealed], packId, ownedCounts: [...ownedCounts]});
    const emit = () => onChange(snapshot());
    function clear() { for (const timer of timers) cancel(timer); timers = []; }
    function reveal(index) {
      if (phase === 'closed' || !Number.isInteger(index) || index < 0 || index >= rewards.length || revealed.has(index)) return;
      revealed.add(index);
      phase = revealed.size === rewards.length ? 'complete' : 'cards';
      if (phase === 'complete') clear();
      emit();
    }
    function revealAll() {
      if (phase === 'closed') return;
      clear();
      revealed = new Set(rewards.map((_, index) => index));
      phase = 'complete';
      emit();
    }
    function show(results, options = {}) {
      if (phase !== 'closed' || !Array.isArray(results) || results.length !== 3 || results.some(id => typeof id !== 'string' || !id)) return false;
      packId = options.packId || "common"; ownedCounts = results.map((_,index) => options.ownedCounts?.[index] || 1);
      rewards = [...results]; revealed = new Set(); phase = 'opening'; generation++;
      emit();
      if (reducedMotion) { revealAll(); return true; }
      const current = generation;
      const later = (delay, work) => timers.push(schedule(() => { if (generation === current && phase !== 'closed') work(); }, delay));
      later(800, () => { if (phase === 'opening') { phase = 'cards'; emit(); } });
      rewards.map((_, index) => 1200 + index * 450).forEach((delay, index) => later(delay, () => reveal(index)));
      return true;
    }
    function close() {
      if (phase === 'closed') return;
      clear(); generation++; phase = 'closed'; emit();
    }
    return {show, reveal, revealAll, close, snapshot, isOpen: () => phase !== 'closed'};
  }
  window.GameRelicReveal = {createController};
  const root = typeof document === 'undefined' ? null : document.getElementById('relic-reveal');
  const api = window.GameRelics;
  if (!root || !api) return;
  const cards = root.querySelector('.reveal-cards');
  const title = root.querySelector('#relic-reveal-title');
  const status = root.querySelector('.reveal-status');
  const action = root.querySelector('.reveal-action');
  const closeButton = root.querySelector('.reveal-close');
  let returnFocus = null, previousCount = 0, inerted = [];
  const controller = createController(state => {
    if (state.phase === 'closed') {
      root.hidden = true;
      for (const [element, previous] of inerted) element.inert = previous;
      inerted = [];
      returnFocus?.focus({preventScroll: true});
      return;
    }
    if (root.hidden) {
      returnFocus = document.activeElement;
      previousCount = 0;
      cards.innerHTML = state.rewards.map((id, index) => {
        const item = api.getRelic(id);
        return `<button class="reveal-card relic-${item.rarity}" style="--relic-rarity-color:${item.color};--card-index:${index}" type="button" data-card-index="${index}" aria-label="Reveal your relic">
          <span class="reveal-card-inner">
            <span class="reveal-card-back" aria-hidden="true"><svg viewBox="0 0 96 96"><use href="relic-art.svg?v=3#crest"></use></svg><span>RELICS</span><span class="reveal-back-number">${index + 1}</span></span>
            <span class="reveal-card-front" aria-hidden="true"><span class="reveal-card-type rarity-${item.rarity}">${item.rarity} RELIC</span><span class="reveal-relic-art">${api.artHtml(item.family)}</span><strong>${item.name}</strong><span class="reveal-card-stats">${api.describe(id)}</span><span class="reveal-card-count">Permanent · Owned ×${state.ownedCounts[index]}</span></span>
          </span>
        </button>`;
      }).join('');
      root.hidden = false;
      inerted = ['app', 'shop-modal', 'relic-modal'].map(id => document.getElementById(id)).filter(Boolean).map(element => [element, element.inert]);
      for (const [element] of inerted) element.inert = true;
      action.focus({preventScroll: true});
      window.GameSfx?.play('bento');
    }
    root.dataset.phase = state.phase;
    for (const card of cards.querySelectorAll('[data-card-index]')) {
      const index = Number(card.dataset.cardIndex);
      const revealed = state.revealed.includes(index);
      card.classList.toggle('is-revealed', revealed);
      card.querySelector('.reveal-card-front').setAttribute('aria-hidden', String(!revealed));
      const item = api.getRelic(state.rewards[index]);
      card.setAttribute('aria-label', revealed ? `${item.name}, ${api.describe(item.key)}, revealed` : "Reveal your relic");
    }
    const pack = api.packs.find(pack => pack.id === state.packId) || api.packs[0];
    root.querySelector('.reveal-eyebrow').textContent = pack.name;
    const result = state.rewards.map(api.getRelic).reduce((best,item) => api.tiers.indexOf(item.rarity) > api.tiers.indexOf(best.rarity) ? item : best);
    root.style.setProperty('--relic-rarity-color', state.phase === 'complete' ? result.color : api.rarities.find(rarity => rarity.id === pack.rarity).color);
    title.textContent = state.phase === 'opening' ? 'Unsealing your pack…' : state.phase === 'complete' ? 'Your three permanent relics' : 'What’s inside?';
    status.textContent = state.phase === 'complete' ? 'All three relics were added permanently to your collection. Repeats count as extra copies. Only your equipped relic provides bonuses.' : 'Three independent relics. Repeats are allowed. Reveal each card or reveal all.';
    action.textContent = state.phase === 'complete' ? 'Continue' : 'Reveal all';
    if (state.revealed.length > previousCount) window.GameSfx?.play(state.phase === 'complete' ? 'collect' : 'orb-medium');
    previousCount = state.revealed.length;
  }, {reducedMotion: !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
  cards.addEventListener('click', event => {
    const card = event.target.closest('[data-card-index]');
    if (card) controller.reveal(Number(card.dataset.cardIndex));
  });
  action.addEventListener('click', () => controller.snapshot().phase === 'complete' ? controller.close() : controller.revealAll());
  closeButton.addEventListener('click', controller.close);
  root.addEventListener('click', event => { if (event.target === root) controller.close(); });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); controller.close(); }
    if (event.key === 'Tab') {
      const controls = [...root.querySelectorAll('button')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  window.GameRelicOpening = {
    show(keys, packId = 'common', ownedCounts = []) { return Array.isArray(keys) && keys.every(key => !!api.getRelic(key)) && controller.show(keys, {packId, ownedCounts}); },
    close: controller.close,
    isOpen: controller.isOpen,
  };
})();
