const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const foods = fs.readFileSync(path.join(root, 'foods.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

function boot(saved) {
  const storage = new Map();
  if (saved) storage.set('sprinkleFeastSave', JSON.stringify(saved));
  const elements = new Map();
  const element = () => ({
    textContent: '', innerHTML: '', children: [],
    classList: { add() {}, remove() {} },
    appendChild(child) { this.children.push(child); },
  });
  const math = Object.create(Math);
  math.random = () => 0.9;
  const context = vm.createContext({
    window: {}, Math: math, console,
    document: {
      currentScript: { src: 'game.js?v=176' },
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      createElement: element,
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    cancelAnimationFrame() {},
  });
  vm.runInContext(foods, context);
  // Run the real save/food initialization, then expose the actual game functions
  // before animation and rendering bootstraps. View effects and the unrelated
  // normal-food selection are stubbed; actual food banking and Bento rewards run.
  const marker = '  bestRunEl.textContent = `${save.bestRun} foods`;';
  assert.ok(game.includes(marker));
  vm.runInContext(game.replace(marker, `
    pullFood = () => tierByName.Peanut;
    enterLobby = () => {};
    renderEquippedUi = () => {};
    broadcastSnap = () => {};
    draw = () => {};
    startLobbyLoop = () => {};
    renderPotionStatus = () => {};
    renderShop = () => {};
    globalThis.api = { save, state, net, bankPendingFoods, pullFood,
      loadSave, endRun, tierByName, rollRunBentoCount, addBento, advanceBento, bentoInventoryCount, buyBento, skipBento, openBento, BENTO_UNLOCK_MS, totalLuckBonus, bentoRarityChances, bentoLuckLine, bentoOddsHtml };
    return;
    ${marker}
  `), context);
  assert.ok(context.api, 'game initializes successfully');
  return { ...context.api, math, storage, elements };
}


const thresholds = [
  [0, 0, 1], [9, 0, 1], [10, 0, 2], [49, 0, 2],
  [50, 1, 3], [99, 1, 3], [100, 2, 4], [199, 2, 4],
  [200, 3, 5], [299, 3, 5], [300, 4, 6], [399, 4, 6],
  [400, 5, 7], [999, 10, 12], [1000, 11, 13],
];

function expectedCount(earned, minimum, maximum, roll) {
  if (earned < 10) return roll < 0.25 ? 1 : 0;
  return roll < 0.25 ? maximum : roll < 0.5 ? minimum + 1 : minimum;
}

test('all food milestones and exact 25%/50% probability boundaries', () => {
  const g = boot();
  for (const [earned, minimum, maximum] of thresholds) {
    for (const roll of [0, 0.249999, 0.25, 0.499999, 0.5, 0.999999]) {
      g.math.random = () => roll;
      assert.equal(g.rollRunBentoCount(earned), expectedCount(earned, minimum, maximum, roll));
    }
    const outcomes = [];
    for (let n = 0; n < 1000; n++) {
      g.math.random = () => n / 1000;
      outcomes.push(g.rollRunBentoCount(earned));
    }
    assert.equal(outcomes.filter(n => n >= maximum).length, 250);
    if (earned >= 10) assert.equal(outcomes.filter(n => n >= minimum + 1).length, 500);
    assert.equal(outcomes.filter(n => n >= minimum).length, 1000);
  }
});

test('one reward total per run regardless of luck, role or wipeout; counts and save persist', () => {
  for (const boosted of [false, true]) {
    for (const [earned, minimum, maximum] of thresholds) {
      for (const role of [null, 'host', 'guest']) {
        for (const wipedOut of [false, true]) {
          for (const roll of [0.249999, 0.25, 0.5]) {
            const g = boot();
            if (boosted) {
              for (const name of Object.keys(g.tierByName)) g.save.inventory[name] = 1;
              g.save.bento.opened = 10000;
              g.save.activePotions.luck = {endsAt: Date.now()+60000, stacks: 5};
            }
            g.state.running = true;
            g.state.foodsEarned = earned;
            g.net.role = role;
            let calls = 0;
            g.math.random = () => { calls += 1; return roll; };
            g.endRun(wipedOut);
            const expected = Math.min(5, expectedCount(earned, minimum, maximum, roll));
            assert.equal(g.save.bento.locked, expected);
            assert.equal(calls, 1);
            assert.equal(g.save.diamonds, earned);
            if (expected) assert.ok(g.elements.get('overlay-msg').textContent.includes(`You earned ${expectedCount(earned, minimum, maximum, roll)} bento box`));
            g.endRun(wipedOut);
            assert.equal(calls, 1, 'ending twice must not roll twice');
            const saved = JSON.parse(g.storage.get('sprinkleFeastSave'));
            assert.equal(saved.bento.locked, expected);
          }
        }
      }
    }
  }
});

test('full and partially full inventories reject extra run boxes and show Inventory is full', () => {
  for (const [locked, ready] of [[5, 0], [0, 5], [3, 2], [4, 0], [1, 3], [0, 0]]) {
    const g = boot();
    g.save.bento.locked = locked;
    g.save.bento.ready = ready;
    g.save.bento.unlockStartedAt = locked ? Date.now() : 0;
    g.state.running = true;
    g.state.foodsEarned = 100;
    g.math.random = () => 0.1; // Four boxes rolled at this milestone.
    g.endRun();
    const accepted = Math.min(4, 5 - locked - ready);
    assert.equal(g.bentoInventoryCount(), locked + ready + accepted);
    assert.equal(g.save.bento.ready, ready);
    const message = g.elements.get('overlay-msg').textContent;
    assert.equal(message.includes('inventory is full.'), accepted < 4);
    if (accepted < 4) assert.ok(message.endsWith('You earned 4 bento boxes, inventory is full.'));
    else assert.ok(message.includes('You earned 4 bento boxes!'));
    const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
    assert.equal(reloaded.bentoInventoryCount(), locked + ready + accepted);
  }
});

test('unlocking and skipping do not free inventory space; opening does', () => {
  const g = boot();
  const start = Date.now();
  g.save.bento.locked = 5;
  g.save.bento.unlockStartedAt = start;
  g.save.diamonds = 10000;
  assert.equal(g.addBento(), false);
  g.buyBento();
  assert.equal(g.save.diamonds, 10000, 'no diamonds charged for a rejected purchase');
  g.advanceBento(start + 2 * g.BENTO_UNLOCK_MS);
  assert.equal(g.save.bento.locked, 3);
  assert.equal(g.save.bento.ready, 2);
  assert.equal(g.addBento(), false, 'ready boxes still occupy capacity');
  g.skipBento();
  assert.equal(g.bentoInventoryCount(), 5, 'skipping only changes locked into ready');
  assert.equal(g.addBento(), false);
  const ready = g.save.bento.ready;
  g.openBento();
  assert.equal(g.save.bento.ready, 0);
  assert.equal(g.bentoInventoryCount(), 5 - ready);
  for (let i = 0; i < ready; i++) assert.equal(g.addBento(), true);
  assert.equal(g.bentoInventoryCount(), 5);
  assert.equal(g.addBento(), false);
});

test('older saves above capacity are capped to five, preserving ready boxes first', () => {
  for (const [locked, ready, expectedLocked, expectedReady] of [
    [13, 0, 5, 0], [13, 3, 2, 3], [2, 13, 0, 5], [5, 5, 0, 5], [4, 1, 4, 1],
  ]) {
    const original = boot();
    const saved = JSON.parse(JSON.stringify(original.save));
    saved.bento = {locked, ready, unlockStartedAt: Date.now(), opened: 123};
    const g = boot(saved);
    assert.equal(g.save.bento.locked, expectedLocked);
    assert.equal(g.save.bento.ready, expectedReady);
    assert.equal(g.save.bento.opened, 123);
    assert.equal(g.save.bento.locked === 0, g.save.bento.unlockStartedAt === 0);
    const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
    assert.equal(reloaded.bentoInventoryCount(), 5);
  }
});

function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }

test('Legendary and Mythic luck bonuses reduce only Rare; Epic remains 24.5%', () => {
  for (const opened of [0, 100, 1000, 10000, 20000, 1000000]) {
    for (const types of [1, 50, 264]) {
      const g = boot();
      for (const name of Object.keys(g.tierByName).slice(0, types)) g.save.inventory[name] = 1;
      g.save.bento.opened = opened;
      const luck = Math.min(g.totalLuckBonus(), 74 / 0.6);
      const odds = g.bentoRarityChances();
      near(odds.epic, 24.5);
      near(odds.legendary, 1 + luck * 0.5);
      near(odds.mythic, 0.5 + luck * 0.1);
      near(odds.rare, 74 - luck * 0.6);
      near(Object.values(odds).reduce((sum, n) => sum + n, 0), 100);
      assert.ok(Object.values(odds).every(n => n >= 0 && n <= 100));
      const beforePotion = JSON.stringify(odds);
      g.save.activePotions.luck = { endsAt: Date.now() + 60000, stacks: 5 };
      assert.equal(JSON.stringify(g.bentoRarityChances()), beforePotion);
      assert.match(g.bentoOddsHtml(), /Epic 24.5%/);
      assert.match(g.bentoLuckLine(), /taken only from Rare/);
      if (odds.rare === 0) assert.match(g.bentoLuckLine(), /adds \+61.7% legendary and \+12.3% mythic/);
    }
  }
});


test('full inventory message shows the rolled reward count and correct singular or plural', () => {
  for (const [foods, roll, expected] of [
    [0, 0.1, 'You earned 1 bento box, inventory is full.'],
    [50, 0.1, 'You earned 3 bento boxes, inventory is full.'],
    [1000, 0.1, 'You earned 13 bento boxes, inventory is full.'],
    [0, 0.9, null],
  ]) {
    const g = boot();
    g.save.bento.ready = 5;
    g.state.running = true;
    g.state.foodsEarned = foods;
    g.math.random = () => roll;
    g.endRun();
    const message = g.elements.get('overlay-msg').textContent;
    if (expected) assert.ok(message.endsWith(expected), message);
    else assert.ok(!message.includes('inventory is full'));
    assert.equal(g.bentoInventoryCount(), 5);
  }
});
