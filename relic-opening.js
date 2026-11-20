(() => {
  const revealTimings = {common:200,uncommon:350,rare:600,epic:900,legendary:1300,mythic:1800,secret:2600};
  function createController(onChange, {schedule = setTimeout, cancel = clearTimeout, reducedMotion = false} = {}) {
    let phase = 'closed', rewards = [], revealed = new Set(), timers = [], generation = 0, packId = 'common', ownedCounts = [], revealingIndex = null;
    const snapshot = () => ({phase, rewards: [...rewards], revealed: [...revealed], packId, ownedCounts: [...ownedCounts], revealingIndex});
    const emit = () => onChange(snapshot());
    function clear() { for (const timer of timers) cancel(timer); timers = []; }
    function later(delay, work) {
      const current = generation;
      timers.push(schedule(() => { if (generation === current && phase !== 'closed') { clear(); work(); } }, delay));
    }
    function openPack() {
      if (phase !== 'sealed') return false;
      phase = 'opening'; emit();
      const finish = () => { phase = 'cards'; emit(); };
      if (reducedMotion) finish(); else later(800, finish);
      return true;
    }
    function reveal(index) {
      if (phase !== 'cards' || !Number.isInteger(index) || index < 0 || index >= rewards.length || revealed.has(index)) return false;
      revealingIndex = index; phase = 'revealing'; emit();
      const finish = () => {
        revealed.add(index); revealingIndex = null;
        phase = revealed.size === rewards.length ? 'complete' : 'cards'; emit();
      };
      if (reducedMotion) finish(); else later(revealTimings[rewards[index].split(':')[0]] || revealTimings.common, finish);
      return true;
    }
    function show(results, options = {}) {
      if (phase !== 'closed' || !Array.isArray(results) || results.length !== 3 || results.some(id => typeof id !== 'string' || !id)) return false;
      packId = options.packId || 'common'; ownedCounts = results.map((_,index) => options.ownedCounts?.[index] || 1);
      rewards = [...results]; revealed = new Set(); revealingIndex = null; phase = 'sealed'; generation++;
      emit(); return true;
    }
    function close() {
      if (phase === 'closed') return;
      clear(); generation++; revealingIndex = null; phase = 'closed'; emit();
    }
    return {show, openPack, reveal, close, snapshot, isOpen: () => phase !== 'closed'};
  }
  window.GameRelicReveal = {createController, revealTimings};
  const root = typeof document === 'undefined' ? null : document.getElementById('relic-reveal');
  const api = window.GameRelics;
  if (!root || !api) return;
  const cards = root.querySelector('.reveal-cards');
  const packButton = root.querySelector('.reveal-pack');
  const title = root.querySelector('#relic-reveal-title');
  const status = root.querySelector('.reveal-status');
  const action = root.querySelector('.reveal-action');
  const swipeHint = root.querySelector('.reveal-swipe-hint');
  const closeButton = root.querySelector('.reveal-close');
  let returnFocus = null, previousCount = 0, previousPhase = 'closed', inerted = [];
  const controller = createController(state => {
    if (state.phase === 'closed') {
      root.hidden = true;
      for (const [element, previous] of inerted) element.inert = previous;
      inerted = []; previousPhase = 'closed';
      returnFocus?.focus({preventScroll: true}); return;
    }
    const firstRender = root.hidden;
    if (firstRender) {
      returnFocus = document.activeElement; previousCount = 0;
      cards.innerHTML = state.rewards.map((id, index) => {
        const item = api.getRelic(id);
        return `<button class="reveal-card relic-${item.rarity}" style="--relic-rarity-color:${item.color};--card-index:${index};--suspense-strength:${api.tiers.indexOf(item.rarity)+1};--suspense-duration:${revealTimings[item.rarity]}ms" type="button" data-card-index="${index}" aria-label="Reveal card ${index+1} of 3">
          <span class="reveal-card-inner">
            <span class="reveal-card-back" aria-hidden="true"><svg viewBox="0 0 96 96"><use href="relic-art.svg?v=3#crest"></use></svg><span>TAP TO REVEAL</span><span class="reveal-back-number">${index + 1} / 3</span></span>
            <span class="reveal-card-front" aria-hidden="true"><span class="reveal-card-type rarity-${item.rarity}">${item.rarity} RELIC</span><span class="reveal-relic-art">${api.artHtml(item.family)}</span><strong>${item.name}</strong><span class="reveal-card-stats">${api.describe(id)}</span><span class="reveal-card-count">Permanent · Owned ×${state.ownedCounts[index]}</span></span>
          </span>
        </button>`;
      }).join('');
      root.hidden = false;
      inerted = ['app', 'shop-modal', 'relic-modal'].map(id => document.getElementById(id)).filter(Boolean).map(element => [element, element.inert]);
      for (const [element] of inerted) element.inert = true;
    }
    root.dataset.phase = state.phase;
    packButton.hidden = !['sealed','opening'].includes(state.phase);
    packButton.disabled = state.phase !== 'sealed';
    cards.inert = ['sealed','opening'].includes(state.phase);
    swipeHint.hidden = ['sealed','opening'].includes(state.phase);
    action.hidden = state.phase !== 'complete';
    for (const card of cards.querySelectorAll('[data-card-index]')) {
      const index = Number(card.dataset.cardIndex), revealed = state.revealed.includes(index), revealing = state.revealingIndex === index;
      card.classList.toggle('is-revealed', revealed);
      card.classList.toggle('is-revealing', revealing);
      card.setAttribute('aria-disabled', String(state.phase !== 'cards' || revealed));
      card.querySelector('.reveal-card-front').setAttribute('aria-hidden', String(!revealed));
      const item = api.getRelic(state.rewards[index]);
      card.setAttribute('aria-label', revealed ? `Card ${index+1} of 3: ${item.name}, ${api.describe(item.key)}, revealed` : revealing ? `Revealing card ${index+1} of 3` : `Reveal card ${index+1} of 3`);
    }
    const pack = api.packs.find(pack => pack.id === state.packId) || api.packs[0];
    root.querySelector('.reveal-eyebrow').textContent = pack.name;
    const active = state.revealingIndex === null ? null : api.getRelic(state.rewards[state.revealingIndex]);
    const best = state.revealed.map(index=>api.getRelic(state.rewards[index])).reduce((best,item) => !best || api.tiers.indexOf(item.rarity)>api.tiers.indexOf(best.rarity) ? item : best, null);
    root.style.setProperty('--relic-rarity-color', (active || best || api.rarities.find(rarity => rarity.id === pack.rarity)).color);
    root.style.setProperty('--suspense-strength', active ? api.tiers.indexOf(active.rarity)+1 : 0);
    title.textContent = state.phase === 'sealed' ? 'Tap your pack to open' : state.phase === 'opening' ? 'Unsealing your pack…' : state.phase === 'complete' ? 'Your three permanent relics' : state.phase === 'revealing' ? 'Something is awakening…' : 'Tap a card to reveal it';
    status.textContent = state.phase === 'sealed' ? 'Your three relics are waiting inside. Tap the pack to break the seal.' : state.phase === 'opening' ? 'Breaking the seal…' : state.phase === 'complete' ? 'All three relics were added permanently to your collection. Repeats count as extra copies. Only your equipped relic provides bonuses.' : state.phase === 'revealing' ? 'Hold on… your relic is emerging.' : `${state.revealed.length} / 3 revealed. Tap one unopened card. Each card needs its own tap.`;
    if (firstRender) packButton.focus({preventScroll: true});
    if (state.phase === 'opening' && previousPhase !== 'opening') window.GameSfx?.play('bento');
    if (state.phase === 'cards' && ['opening','sealed'].includes(previousPhase)) cards.querySelector('[data-card-index="0"]')?.focus({preventScroll: true});
    if (state.phase === 'revealing' && previousPhase !== 'revealing') window.GameSfx?.play('orb-medium');
    if (state.revealed.length > previousCount) window.GameSfx?.play('collect');
    if (state.phase === 'complete' && previousPhase !== 'complete') action.focus({preventScroll: true});
    previousCount = state.revealed.length; previousPhase = state.phase;
  }, {reducedMotion: !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
  packButton.addEventListener('click', controller.openPack);
  cards.addEventListener('click', event => {
    const card = event.target.closest('[data-card-index]');
    if (card) controller.reveal(Number(card.dataset.cardIndex));
  });
  action.addEventListener('click', () => { if (controller.snapshot().phase === 'complete') controller.close(); });
  closeButton.addEventListener('click', controller.close);
  root.addEventListener('click', event => { if (event.target === root) controller.close(); });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); controller.close(); }
    if (event.key === 'Tab') {
      const controls = [...root.querySelectorAll('button')].filter(button=>!button.disabled && button.getClientRects().length && !button.closest('[inert]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  window.GameRelicOpening = {
    show(keys, packId = 'common', ownedCounts = []) { return Array.isArray(keys) && keys.every(key => !!api.getRelic(key)) && controller.show(keys, {packId, ownedCounts}); },
    close: controller.close,
    isOpen: controller.isOpen,
  };
})();
