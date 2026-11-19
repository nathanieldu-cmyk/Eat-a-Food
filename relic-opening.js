(() => {
  function createController(onChange, {schedule = setTimeout, cancel = clearTimeout, reducedMotion = false} = {}) {
    let phase = 'closed', rewards = [], revealed = new Set(), timers = [], generation = 0;
    const snapshot = () => ({phase, rewards: [...rewards], revealed: [...revealed]});
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
    function show(results) {
      if (phase !== 'closed' || !Array.isArray(results) || results.length !== 3 || results.some(id => typeof id !== 'string' || !id)) return false;
      rewards = [...results]; revealed = new Set(); phase = 'opening'; generation++;
      emit();
      if (reducedMotion) { revealAll(); return true; }
      const current = generation;
      const later = (delay, work) => timers.push(schedule(() => { if (generation === current && phase !== 'closed') work(); }, delay));
      later(800, () => { if (phase === 'opening') { phase = 'cards'; emit(); } });
      [1200, 1750, 2300].forEach((delay, index) => later(delay, () => reveal(index)));
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
        const item = api.definitions.find(item => item.id === id);
        return `<button class="reveal-card" type="button" data-card-index="${index}" style="--card-index:${index}" aria-label="Reveal fragment ${index + 1}">
          <span class="reveal-card-inner">
            <span class="reveal-card-back" aria-hidden="true"><svg viewBox="0 0 96 96"><use href="relic-art.svg?v=1#crest"></use></svg><span>RELICS</span><span class="reveal-back-number">${index + 1}</span></span>
            <span class="reveal-card-front" aria-hidden="true"><span class="reveal-card-type">RELIC FRAGMENT</span><span class="reveal-fragment">${api.artHtml(id)}</span><strong>${item.name}</strong><span class="reveal-card-count">+1 fragment</span></span>
          </span>
        </button>`;
      }).join('');
      root.hidden = false;
      inerted = ['app', 'relic-modal'].map(id => document.getElementById(id)).filter(Boolean).map(element => [element, element.inert]);
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
      const item = api.definitions.find(item => item.id === state.rewards[index]);
      card.setAttribute('aria-label', revealed ? `${item.name}, 1 fragment, revealed` : `Reveal fragment ${index + 1}`);
    }
    title.textContent = state.phase === 'opening' ? 'Unsealing your pack…' : state.phase === 'complete' ? 'Your fragments' : 'What’s inside?';
    const names = state.revealed.map(index => api.definitions.find(item => item.id === state.rewards[index]).name);
    status.textContent = state.phase === 'complete' ? `3 fragments added to your collection: ${names.join(', ')}.` : names.length ? `${names.length} of 3 revealed: ${names.join(', ')}.` : 'Three fragments. Seven possibilities.';
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
    show(results) { return Array.isArray(results) && results.every(id => api.definitions.some(item => item.id === id)) && controller.show(results); },
    close: controller.close,
    isOpen: controller.isOpen,
  };
})();
