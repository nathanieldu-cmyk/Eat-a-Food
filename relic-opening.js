(() => {
  const revealTimings = {common:650,uncommon:900,rare:1300,epic:1850,legendary:2450,mythic:3200,secret:4800};
  const rarityOrder = Object.keys(revealTimings);
  function createController(onChange, {schedule = setTimeout, cancel = clearTimeout, reducedMotion = false} = {}) {
    let phase = 'closed', rewards = [], revealed = new Set(), timers = new Set(), generation = 0, packId = 'common', ownedCounts = [], revealingIndex = null, pulse = 0, order = [], spotlightIndex = null, spotlightStage = null, batch = [], packNumber = 1, packTotal = 1;
    const canSkip = () => ['opening','cards','revealing'].includes(phase) && spotlightIndex === null && rewards.some((key,index)=>!key.startsWith('secret:')&&!revealed.has(index));
    const snapshot = () => ({canSkip:canSkip(),phase, rewards: [...rewards], revealed: [...revealed], packId, ownedCounts: [...ownedCounts], revealingIndex, pulse, spotlightIndex, spotlightStage, packNumber, packTotal});
    const emit = () => onChange(snapshot());
    function clear() { for (const timer of timers) cancel(timer); timers.clear(); }
    function later(delay, work) {
      const current = generation;
      const timer = schedule(() => { timers.delete(timer); if (generation === current && phase !== 'closed') work(); }, delay);
      timers.add(timer);
    }
    function finishCard() {
      spotlightIndex = null; spotlightStage = null;
      phase = revealed.size === rewards.length ? 'complete' : 'cards'; emit();
      if (phase !== 'complete') later(950, revealNext);
      else if (packNumber < packTotal) later(1200, () => loadPack(packNumber));
    }
    function revealNext() {
      const index = order[revealed.size], secret = rewards[index].startsWith('secret:');
      revealingIndex = index; pulse = 0;
      spotlightIndex = secret ? index : null; spotlightStage = secret ? 'charging' : null;
      phase = 'revealing'; emit();
      const duration = revealTimings[rewards[index].split(':')[0]] || revealTimings.common;
      function beat(step) {
        if (step < 4) { pulse = step; emit(); later(duration / 4, () => beat(step + 1)); return; }
        revealed.add(index); revealingIndex = null; pulse = 0;
        if (secret) { spotlightStage = 'revealed'; phase = 'spotlight'; emit(); later(2600, finishCard); }
        else finishCard();
      }
      later(duration / 4, () => beat(1));
    }
    function openPack() {
      if (phase !== 'sealed') return false;
      phase = 'opening'; emit();
      if (reducedMotion) {
        revealed = new Set(order);
        spotlightIndex = order.filter(index=>rewards[index].startsWith('secret:')).at(-1) ?? null;
        if (spotlightIndex !== null) { spotlightStage = 'revealed'; phase = 'spotlight'; emit(); later(2600, finishCard); }
        else finishCard();
      } else {
        later(1000, () => { phase = 'cards'; emit(); later(650, revealNext); });
      }
      return true;
    }
    function skipReveal() {
      if (!canSkip()) return false;
      clear(); generation++;
      for (const index of order) if (!rewards[index].startsWith('secret:')) revealed.add(index);
      revealingIndex = null; pulse = 0;
      // Keep every Secret hidden so it still gets its full cinematic, in order.
      finishCard();
      return true;
    }
    function loadPack(index) {
      clear(); generation++; packNumber = index+1;
      const arranged = batch[index].map(item=>({...item}))
        .sort((a,b)=>rarityOrder.indexOf(a.key.split(':')[0])-rarityOrder.indexOf(b.key.split(':')[0]));
      rewards = arranged.map(item=>item.key); ownedCounts = arranged.map(item=>item.ownedCount);
      revealed = new Set(); revealingIndex = null; pulse = 0; spotlightIndex = null; spotlightStage = null;
      order = rewards.map((_,index)=>index);
      phase = 'sealed'; emit();
    }
    function showBatch(packs, options = {}) {
      if (phase !== 'closed' || !Array.isArray(packs) || ![1,3].includes(packs.length) || packs.some(keys=>!Array.isArray(keys)||keys.length!==3||keys.some(id=>typeof id!=='string'||!id))) return false;
      packId = options.packId || 'common';
      batch = packs.map((keys,packIndex)=>keys.map((key,index)=>({key,ownedCount:options.ownedCounts?.[packIndex]?.[index] || 1})));
      packTotal = batch.length; loadPack(0); return true;
    }
    function show(results, options = {}) {
      return showBatch([results], {...options,ownedCounts:[options.ownedCounts || []]});
    }
    function close() {
      if (phase === 'closed') return;
      clear(); generation++; revealingIndex = null; spotlightIndex = null; spotlightStage = null; phase = 'closed'; emit();
    }
    return {show, showBatch, openPack, skipReveal, close, snapshot, isOpen: () => phase !== 'closed'};
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
  const skip = root.querySelector('.reveal-skip');
  const swipeHint = root.querySelector('.reveal-swipe-hint');
  const dialog = root.querySelector('.reveal-dialog');
  const secretScene = root.querySelector('.secret-reveal');
  const secretCard = secretScene.querySelector('.secret-card');
  const secretTitle = secretScene.querySelector('#secret-reveal-title');
  let shownSecretIndex = null, renderedPackNumber = 0;
  let returnFocus = null, previousCount = 0, previousPulse = 0, previousPhase = 'closed', inerted = [], soundStops = [];
  const cue = name => { const stop = window.GameSfx?.play(name); if (typeof stop === 'function') soundStops.push(stop); };
  const controller = createController(state => {
    if (state.phase === 'closed') {
      root.hidden = true; secretScene.hidden = true; dialog.inert = false; shownSecretIndex = null; renderedPackNumber = 0;
      window.GameMusic?.setPackOpening?.(false);
      window.GameSfx?.setPackOpening?.(false);
      for (const stop of soundStops) stop(); soundStops = [];
      for (const [element, previous] of inerted) element.inert = previous;
      inerted = []; previousPhase = 'closed';
      returnFocus?.focus({preventScroll: true}); return;
    }
    const firstRender = root.hidden;
    const packChanged = firstRender || renderedPackNumber !== state.packNumber;
    if (packChanged) {
      if (firstRender) {
        window.GameMusic?.setPackOpening?.(true);
        window.GameSfx?.setPackOpening?.(true);
        returnFocus = document.activeElement;
      }
      previousCount = 0; previousPulse = 0; previousPhase = 'closed'; shownSecretIndex = null; renderedPackNumber = state.packNumber;
      cards.scrollLeft = 0;
      cards.innerHTML = state.rewards.map((id, index) => {
        const item = api.getRelic(id);
        return `<button class="reveal-card relic-${item.rarity}" style="--relic-rarity-color:${item.color};--card-index:${index};--suspense-strength:${api.tiers.indexOf(item.rarity)+1};--suspense-duration:${revealTimings[item.rarity]}ms" type="button" data-card-index="${index}" aria-label="Card ${index+1} of 3, waiting to reveal">
          <span class="reveal-card-inner">
            <span class="reveal-card-back" aria-hidden="true"><svg viewBox="0 0 96 96"><use href="relic-art.svg?v=3#crest"></use></svg><span>THE SEAL IS BREAKING</span><span class="reveal-back-number">${index + 1} / 3</span></span>
            <span class="reveal-card-front" aria-hidden="true"><span class="reveal-card-type rarity-${item.rarity}">${item.rarity} RELIC</span><span class="reveal-relic-art">${api.artHtml(item.family)}</span><strong>${item.name}</strong><span class="reveal-card-stats">${api.describe(id)}</span><span class="reveal-card-count">Permanent · Owned ×${state.ownedCounts[index]}</span></span>
          </span>
        </button>`;
      }).join('');
      root.hidden = false;
      if (firstRender) inerted = ['app', 'shop-modal', 'relic-modal'].map(id => document.getElementById(id)).filter(Boolean).map(element => [element, element.inert]);
      for (const [element] of inerted) element.inert = true;
    }
    const spotlight = state.spotlightIndex !== null;
    secretScene.hidden = !spotlight;
    dialog.inert = spotlight;
    if (spotlight) {
      const item = api.getRelic(state.rewards[state.spotlightIndex]);
      if (shownSecretIndex !== state.spotlightIndex) {
        secretCard.innerHTML = `<span class="secret-card-inner"><span class="reveal-card-back secret-card-back" aria-hidden="true"><svg viewBox="0 0 96 96"><use href="relic-art.svg?v=3#crest"></use></svg><span>BEYOND THE ORDINARY</span></span><span class="reveal-card-front secret-card-front"><span class="secret-rarity-seal">SECRET</span><span class="reveal-relic-art">${api.artHtml(item.family)}</span><strong>${item.name}</strong><span class="reveal-card-stats">${api.describe(item.key)}</span><span class="reveal-card-count">Permanent · Owned ×${state.ownedCounts[state.spotlightIndex]}</span></span></span>`;
        shownSecretIndex = state.spotlightIndex;
        secretScene.focus({preventScroll:true});
        if (state.spotlightStage === 'charging') cue('relic-secret-blackout');
      }
      secretScene.dataset.stage = state.spotlightStage;
      secretScene.dataset.pulse = state.pulse;
      secretCard.querySelector('.secret-card-front').setAttribute('aria-hidden', String(state.spotlightStage !== 'revealed'));
      secretTitle.textContent = state.spotlightStage === 'revealed' ? 'Secret discovered' : 'A Secret awakens';
    } else if (shownSecretIndex !== null) {
      shownSecretIndex = null;
      dialog.focus({preventScroll:true});
    }
    root.dataset.phase = state.phase;
    packButton.hidden = !['sealed','opening'].includes(state.phase);
    packButton.disabled = state.phase !== 'sealed';
    cards.inert = ['sealed','opening'].includes(state.phase);
    swipeHint.hidden = ['sealed','opening'].includes(state.phase);
    action.hidden = state.phase !== 'complete' || state.packNumber < state.packTotal;
    skip.hidden = !state.canSkip;
    skip.disabled = !state.canSkip;
    for (const card of cards.querySelectorAll('[data-card-index]')) {
      const index = Number(card.dataset.cardIndex), revealed = state.revealed.includes(index), revealing = state.revealingIndex === index;
      card.classList.toggle('is-revealed', revealed);
      card.classList.toggle('is-revealing', revealing);
      card.setAttribute('aria-disabled', 'true');
      card.classList.toggle('is-fresh', revealed && state.revealed.at(-1) === index && state.revealingIndex === null && state.revealed.length > 0);
      card.querySelector('.reveal-card-front').setAttribute('aria-hidden', String(!revealed));
      const item = api.getRelic(state.rewards[index]);
      card.setAttribute('aria-label', revealed ? `Card ${index+1} of 3: ${item.name}, ${api.describe(item.key)}, revealed` : revealing ? `Revealing card ${index+1} of 3` : `Card ${index+1} of 3, waiting to reveal`);
    }
    const pack = api.packs.find(pack => pack.id === state.packId) || api.packs[0];
    root.querySelector('.reveal-eyebrow').textContent = pack.name + (state.packTotal > 1 ? ` · Pack ${state.packNumber} of ${state.packTotal}` : '');
    const active = state.revealingIndex === null ? null : api.getRelic(state.rewards[state.revealingIndex]);
    const best = state.revealed.map(index=>api.getRelic(state.rewards[index])).reduce((best,item) => !best || api.tiers.indexOf(item.rarity)>api.tiers.indexOf(best.rarity) ? item : best, null);
    root.style.setProperty('--relic-rarity-color', (active || best || api.rarities.find(rarity => rarity.id === pack.rarity)).color);
    root.style.setProperty('--suspense-strength', active ? api.tiers.indexOf(active.rarity)+1 : 0);
    title.textContent = state.phase === 'sealed' ? 'Tap your pack to open' : state.phase === 'opening' ? 'Unsealing your pack…' : state.phase === 'complete' ? 'Your three permanent relics' : state.phase === 'revealing' ? 'Something is awakening…' : 'The next relic is stirring…';
    status.textContent = state.phase === 'sealed' ? 'Your three relics are waiting inside. Tap the pack to break the seal.' : state.phase === 'opening' ? 'Breaking the seal…' : state.phase === 'complete' ? (state.packNumber < state.packTotal ? `Pack ${state.packNumber} of ${state.packTotal} complete. The next pack is coming up…` : `All ${state.packTotal*3} relics were added permanently to your collection. Repeats count as extra copies. Only your equipped relic provides bonuses.`) : state.phase === 'revealing' ? 'Hold on… your relic is emerging.' : `${state.revealed.length} / 3 revealed. The cards will reveal automatically, one at a time.`;
    if (packChanged) packButton.focus({preventScroll: true});
    if (state.phase === 'opening' && previousPhase !== 'opening') { cue('relic-open'); dialog.focus({preventScroll: true}); }
    if (state.phase === 'cards' && previousPhase === 'opening') cue('relic-deal');
    if (state.phase === 'revealing' && previousPhase !== 'revealing') {
      cue(`relic-charge-${active.rarity}`);
      const card = cards.querySelector(`[data-card-index="${state.revealingIndex}"]`);
      if (card && cards.scrollWidth > cards.clientWidth) cards.scrollTo({left:cards.scrollLeft+card.getBoundingClientRect().left-cards.getBoundingClientRect().left,behavior:'smooth'});
    }
    if (state.phase === 'revealing' && state.pulse > previousPulse) cue(`relic-tick-${active.rarity}-${state.pulse}`);
    if (state.revealed.length > previousCount) {
      const item = api.getRelic(state.rewards[state.revealed.at(-1)]);
      cue(item.rarity === 'secret' ? 'relic-secret-impact' : `relic-reveal-${item.rarity}`);
    }
    if (state.phase === 'complete' && previousPhase !== 'complete') { (state.packNumber === state.packTotal ? action : dialog).focus({preventScroll: true}); }
    previousPulse = state.pulse;
    previousCount = state.revealed.length; previousPhase = state.phase;
  }, {reducedMotion: !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
  packButton.addEventListener('click', controller.openPack);
  skip.addEventListener('click', () => {
    if (!controller.snapshot().canSkip) return;
    for (const stop of soundStops) stop(); soundStops = [];
    controller.skipReveal();
    if (controller.snapshot().phase === 'cards') dialog.focus({preventScroll:true});
  });
  action.addEventListener('click', () => { if (controller.snapshot().phase === 'complete') controller.close(); });
  root.addEventListener('click', event => { if (event.target === root) (secretScene.hidden ? dialog : secretScene).focus({preventScroll:true}); });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
    if (event.key === 'Tab') {
      const controls = [...root.querySelectorAll('button')].filter(button=>!button.disabled && button.getClientRects().length && !button.closest('[inert]'));
      if (!controls.length) { event.preventDefault(); (secretScene.hidden ? dialog : secretScene).focus({preventScroll:true}); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (!controls.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  window.GameRelicOpening = {
    show(keys, packId = 'common', ownedCounts = []) { return Array.isArray(keys) && keys.every(key => !!api.getRelic(key)) && controller.show(keys, {packId, ownedCounts}); },
    showBatch(packs, packId = 'common', ownedCounts = []) { return Array.isArray(packs) && packs.every(keys => Array.isArray(keys) && keys.every(key => !!api.getRelic(key))) && controller.showBatch(packs, {packId, ownedCounts}); },
    close: controller.close,
    isOpen: controller.isOpen,
  };
})();
