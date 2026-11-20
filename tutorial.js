(() => {
  const api = window.GameTutorialApi;
  if (!api) return;
  if (window.location) {
    const url = new URL(window.location.href);
    if (url.searchParams.get('tutorial') === '1') {
      api.setStep('start');
      // Consume this request so refreshing resumes progress rather than restarting.
      url.searchParams.delete('tutorial');
      window.history.replaceState(window.history.state, '', url.href);
    }
  }
  if (api.snapshot().step === 'done') return;

  function nextTutorialStep(step, state, ui, equipped) {
    switch (step) {
      case 'start': return state.running ? 'collect' : step;
      case 'collect': return state.running ? state.foods >= 1 ? 'end-run' : step : state.foods >= 1 ? 'inventory' : 'start';
      case 'end-run': return state.running ? step : state.foods >= 1 ? 'inventory' : 'start';
      case 'inventory': return ui.inventory ? 'equip' : step;
      case 'equip': return !ui.inventory ? 'inventory' : equipped && state.equipped === state.best ? 'close-inventory' : step;
      case 'close-inventory': return ui.inventory ? step : 'shop';
      case 'shop': return ui.shop ? 'bento' : step;
      case 'bento': case 'potions': return ui.shop ? step : 'shop';
      case 'close-shop': return ui.shop ? step : 'craft';
      case 'craft': return ui.craft ? 'craft-info' : step;
      case 'craft-info': return ui.craft ? step : 'craft';
      case 'close-craft': return ui.craft ? step : 'multiplayer';
      case 'multiplayer': return ui.multiplayer ? 'multiplayer-info' : step;
      case 'multiplayer-info': return ui.multiplayer ? step : 'multiplayer';
      default: return step;
    }
  }
  const steps = {
    start: {title: 'Start your first run', text: 'Walk into the blue Start Run circle. Use WASD or the arrow keys. On a phone, drag on the left side to move.', portal: true},
    collect: {title: 'Earn your first food', text: 'Eat the glowing orbs to fill this bar. Keep collecting until Foods this run reaches 1.', target: '.food-meter'},
    'end-run': {title: 'Collect your food', text: 'You earned a food! Press End Run to collect it.', target: '#end-btn'},
    inventory: {title: 'Open your inventory', text: 'Your new food is ready. Open Inventory to see it.', target: '#inventory-btn', overlayTarget: '#overlay-inventory-btn'},
    equip: {title: 'Equip your best food', text: 'Press Equip Best Overall to choose your strongest food. Better foods help you collect more!', target: '#equip-best-overall'},
    'close-inventory': {title: 'Back to the game', text: 'Your best food is equipped. Close Inventory.', target: '#inv-close'},
    shop: {title: 'Visit the shop', text: 'Open Shop to learn about Bento Boxes and potions.', target: '#shop-btn', overlayTarget: '#overlay-shop-btn'},
    bento: {title: 'Bento Boxes', text: 'Earn boxes from runs or buy them with diamonds. Unlock one at a time, then open it for 3 foods and +5% luck forever. You can hold 5 boxes.', target: '#bento-slot', next: 'potions'},
    potions: {title: 'Scroll down to potions', text: 'Scroll down in the shop. Potions cost 500 diamonds and give a 10-minute boost to luck, speed, growth, or points. Buy one, then press Use.', target: '#shop-list', next: 'close-shop', requireVisible: true},
    'close-shop': {title: 'Leave the shop', text: 'Close Shop. Next, let’s see crafting.', target: '#shop-close'},
    craft: {title: 'Open crafting', text: 'Open Craft to see how food upgrades work.', target: '#craft-btn', overlayTarget: '#overlay-craft-btn'},
    'craft-info': {title: 'Upgrade your foods', text: 'Combine 50 matching foods for 1 Golden. Combine 50 matching Goldens for 1 Rainbow, then 50 matching Rainbows for 1 Shadow. Each upgrade makes your food stronger.', target: '#craft-list', next: 'close-craft'},
    'close-craft': {title: 'Back to the lobby', text: 'Close Craft to learn about playing with friends.', target: '#craft-close'},
    multiplayer: {title: 'Play with friends', text: 'Open Multiplayer to see how to invite a friend.', target: '#multi-btn'},
    'multiplayer-info': {title: 'Multiplayer', text: 'Create a room and share its code with friends. To join a friend, enter their code and press Join. You can keep collecting foods together!', target: '#multi-setup', next: 'finish'},
    finish: {title: 'Continue collecting new foods', text: 'You’re ready! Finish to unlock a free Common Relic Pack in Shop. Try stronger foods, permanent relics, and Golden, Rainbow, and Shadow foods.', next: 'done'},
  };
  const root = document.createElement('div');
  root.className = 'tutorial-root';
  root.hidden = true;
  root.innerHTML = `<div class="tutorial-highlight" aria-hidden="true"></div><div class="tutorial-arrow" aria-hidden="true">↓</div>
    <section class="tutorial-card" aria-label="Game tutorial"><p class="tutorial-progress"></p><h2></h2><p class="tutorial-copy" role="status" aria-live="polite"></p>
    <div class="tutorial-actions"><button class="tutorial-skip" type="button">Skip tutorial</button><button class="btn primary small tutorial-next" type="button">Next</button></div></section>`;
  document.body.appendChild(root);
  const card = root.querySelector('.tutorial-card'), highlight = root.querySelector('.tutorial-highlight'), arrow = root.querySelector('.tutorial-arrow');
  const title = card.querySelector('h2'), copy = card.querySelector('.tutorial-copy'), progress = card.querySelector('.tutorial-progress');
  const next = card.querySelector('.tutorial-next');
  const open = id => !document.getElementById(id).classList.contains('hidden');
  let currentConfig = null, displayKey = '';
  let current = '', equipBaseline = api.snapshot().equipRevision, scrollTarget = null;
  let prepared = false, stopped = false;
  let timer;
  function finish() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    window.removeEventListener('resize', tick);
    document.removeEventListener('scroll', position, true);
    root.remove();
  }
  function setStep(step) {
    api.setStep(step);
    if (step === 'done') finish();
  }
  function elementFor(config) {
    if (config.overlayTarget && open('overlay')) return document.querySelector(config.overlayTarget);
    return config.target ? document.querySelector(config.target) : null;
  }
  function clippedRect(element) {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    let left = Math.max(8, box.left), top = Math.max(8, box.top), right = Math.min(innerWidth - 8, box.right), bottom = Math.min(innerHeight - 8, box.bottom);
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|hidden)/.test(style.overflowY)) {
        const clip = parent.getBoundingClientRect();
        top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom);
      }
      if (/(auto|scroll|hidden)/.test(style.overflowX)) {
        const clip = parent.getBoundingClientRect();
        left = Math.max(left, clip.left); right = Math.min(right, clip.right);
      }
    }
    return right - left > 12 && bottom - top > 12 ? {left, top, right, bottom, width: right - left, height: bottom - top} : null;
  }
  const clamp = (n, low, high) => Math.max(low, Math.min(n, Math.max(low, high)));
  function keepTutorialClearOfFood(x, y, width, height, food, viewportWidth, viewportHeight) {
    const fit = p => ({x: clamp(p.x, 12, viewportWidth - width - 12), y: clamp(p.y, 12, viewportHeight - height - 12)});
    const preferred = fit({x, y});
    if (!food) return preferred;
    const candidates = [preferred,
      {x: 12, y: 12}, {x: viewportWidth - width - 12, y: 12},
      {x: 12, y: viewportHeight - height - 12}, {x: viewportWidth - width - 12, y: viewportHeight - height - 12},
      {x: food.left - width - 16, y: food.top}, {x: food.right + 16, y: food.top},
      {x: food.left, y: food.top - height - 16}, {x: food.left, y: food.bottom + 16},
    ].map(fit);
    const overlap = p => Math.max(0, Math.min(p.x + width, food.right) - Math.max(p.x, food.left)) *
      Math.max(0, Math.min(p.y + height, food.bottom) - Math.max(p.y, food.top));
    return candidates.reduce((best, candidate) => overlap(candidate) < overlap(best) ? candidate : best, preferred);
  }

  function position() {
    if (stopped) return;
    const config = currentConfig;
    if (!config) return;
    let rect;
    if (config.portal) {
      const portal = api.portalBounds();
      if (portal) {
        const left = clamp(portal.left, 8, innerWidth - 40), top = clamp(portal.top, 8, innerHeight - 40);
        rect = {left, top, right: Math.min(innerWidth - 8, left + portal.width), bottom: Math.min(innerHeight - 8, top + portal.height)};
        rect.width = rect.right - left; rect.height = rect.bottom - top;
      }
    } else rect = clippedRect(elementFor(config));
    if (config.requireVisible) next.disabled = !rect || rect.height < 48;
    const width = card.offsetWidth, height = card.offsetHeight;
    highlight.hidden = !rect; arrow.hidden = !rect;
    let x = (innerWidth - width) / 2, y = 12;
    if (rect) {
      Object.assign(highlight.style, {left: `${rect.left - 4}px`, top: `${rect.top - 4}px`, width: `${rect.width + 8}px`, height: `${rect.height + 8}px`});
      let ax, ay;
      if (rect.right + width + 50 < innerWidth) {
        x = rect.right + 42; y = rect.top; ax = rect.right + 6; ay = rect.top + Math.min(rect.height / 2, 40) - 20; arrow.textContent = '←';
      } else if (rect.bottom + height + 46 < innerHeight) {
        x = rect.left + rect.width / 2 - width / 2; y = rect.bottom + 40; ax = rect.left + rect.width / 2 - 16; ay = rect.bottom + 4; arrow.textContent = '↑';
      } else if (rect.top - height - 46 > 8) {
        x = rect.left + rect.width / 2 - width / 2; y = rect.top - height - 40; ax = rect.left + rect.width / 2 - 16; ay = rect.top - 38; arrow.textContent = '↓';
      } else {
        y = innerHeight - height - 12; ax = clamp(rect.right - 32, 8, innerWidth - 38); ay = rect.top + 8; arrow.textContent = '↓';
      }
      Object.assign(arrow.style, {left: `${ax}px`, top: `${ay}px`});
    }
    if (current === 'finish') y = (innerHeight - height) / 2;
    const food = config.portal || config.target === '.food-meter' || config.target === '#end-btn' ? api.foodBounds?.() : null;
    const placement = keepTutorialClearOfFood(x, y, width, height, food, innerWidth, innerHeight);
    Object.assign(card.style, {left: `${placement.x}px`, top: `${placement.y}px`});
  }
  function tick() {
    if (stopped || document.hidden) return;
    const state = api.snapshot();
    if (state.step === 'done') { finish(); return; }
    if (!steps[state.step]) {setStep('done'); return;}
    if (!state.ready) {root.hidden = true; return;}
    root.hidden = false;
    if (!prepared) {api.prepare(); prepared = true;}
    const ui = {inventory: open('inventory-modal'), shop: open('shop-modal'), craft: open('craft-modal'), multiplayer: open('multi-modal')};
    const changed = nextTutorialStep(state.step, state, ui, state.equipRevision > equipBaseline);
    if (changed !== state.step) {setStep(changed); return;}
    const expected = {
      equip: 'inventory-modal', 'close-inventory': 'inventory-modal',
      bento: 'shop-modal', potions: 'shop-modal', 'close-shop': 'shop-modal',
      'craft-info': 'craft-modal', 'close-craft': 'craft-modal',
      'multiplayer-info': 'multi-modal',
    }[state.step];
    const unexpected = [
      ['inventory-modal', '#inv-close', 'Inventory'], ['shop-modal', '#shop-close', 'Shop'],
      ['craft-modal', '#craft-close', 'Craft'], ['multi-modal', '#multi-close', 'Multiplayer'],
      ['index-modal', '#index-close', 'Food Index'], ['relic-modal', '#relic-close', 'Relics'],
    ].find(([id]) => id !== expected && open(id));
    const config = unexpected ? {title: `Close ${unexpected[2]}`, text: `Close ${unexpected[2]} to continue your tutorial.`, target: unexpected[1]} : steps[state.step];
    const key = state.step + (unexpected?.[0] || '');
    if (displayKey !== key) {
      current = state.step; currentConfig = config; displayKey = key;
      if (current === 'start') api.prepare();
      if (current === 'equip') equipBaseline = state.equipRevision;
      title.textContent = config.title; copy.textContent = config.text;
      progress.textContent = `Quick start · ${Object.keys(steps).indexOf(current) + 1} / ${Object.keys(steps).length}`;
      next.hidden = !config.next; next.disabled = false; next.textContent = current === 'finish' ? 'Let’s go!' : 'Next';
      const target = elementFor(config);
      if (target && !config.requireVisible) {target.scrollIntoView({block: 'nearest', inline: 'nearest'}); scrollTarget = target;}
    }
    // The equip bar is rebuilt after choosing a food; never rely on a stale node.
    if (current === 'equip' && elementFor(config) !== scrollTarget) {
      scrollTarget = elementFor(config); scrollTarget?.scrollIntoView({block: 'nearest'});
    }
    position();
  }
  root.querySelector('.tutorial-skip').addEventListener('click', () => setStep('done'));
  next.addEventListener('click', () => {
    const config = currentConfig;
    if (!config?.next || next.disabled) return;
    if (config.next === 'finish') api.closeMultiplayer();
    setStep(config.next); tick();
  });
  window.addEventListener('resize', tick);
  document.addEventListener('scroll', position, true);
  timer = setInterval(tick, 150);
  tick();
})();
