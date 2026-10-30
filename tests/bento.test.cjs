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
      currentScript: { src: 'game.js?v=173' },
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
    globalThis.api = { save, state, net, bankPendingFoods, pullFood,
      loadSave, endRun, tierByName, rollRunBentoCount, addBento, advanceBento, BENTO_UNLOCK_MS, totalLuckBonus, bentoRarityChances, bentoLuckLine, bentoOddsHtml };
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
            const expected = expectedCount(earned, minimum, maximum, roll);
            assert.equal(g.save.bento.locked, expected);
            assert.equal(calls, 1);
            assert.equal(g.save.diamonds, earned);
            if (expected) assert.ok(g.elements.get('overlay-msg').textContent.includes(`You earned ${expected} bento box`));
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

test('all run rewards are retained beyond five slots and unlock sequentially after reload', () => {
  const g = boot();
  const start = Date.now();
  g.save.bento.locked = 5;
  g.save.bento.unlockStartedAt = start;
  g.state.running = true;
  g.state.foodsEarned = 500;
  g.math.random = () => 0.1;
  g.endRun();
  assert.equal(g.save.bento.locked, 13, 'five existing boxes plus all eight rewarded boxes');
  assert.equal(g.addBento(), false, 'shop purchases still respect the five-slot limit');
  const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
  assert.equal(reloaded.save.bento.locked, 13);
  reloaded.advanceBento(start + 6 * reloaded.BENTO_UNLOCK_MS);
  assert.equal(reloaded.save.bento.locked, 7);
  assert.equal(reloaded.save.bento.ready, 6);
  reloaded.advanceBento(start + 13 * reloaded.BENTO_UNLOCK_MS);
  assert.equal(reloaded.save.bento.locked, 0);
  assert.equal(reloaded.save.bento.ready, 13);
  assert.equal(reloaded.save.bento.unlockStartedAt, 0);
});

function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }

test('Legendary and Mythic luck bonuses reduce only Rare; Epic remains 24.5%', () => {
  for (const opened of [0, 100, 1000, 10000, 20000, 1000000]) {
    for (const types of [1, 50, 264]) {
      const g = boot();
      for (const name of Object.keys(g.tierByName).slice(0, types)) g.save.inventory[name] = 1;
      g.save.bento.opened = opened;
      const luck = Math.min(g.totalLuckBonus(), 125);
      const odds = g.bentoRarityChances();
      near(odds.epic, 24.5);
      near(odds.legendary, luck * 0.5);
      near(odds.mythic, 0.5 + luck * 0.1);
      near(odds.rare, 75 - luck * 0.6);
      near(Object.values(odds).reduce((sum, n) => sum + n, 0), 100);
      assert.ok(Object.values(odds).every(n => n >= 0 && n <= 100));
      const beforePotion = JSON.stringify(odds);
      g.save.activePotions.luck = { endsAt: Date.now() + 60000, stacks: 5 };
      assert.equal(JSON.stringify(g.bentoRarityChances()), beforePotion);
      assert.match(g.bentoOddsHtml(), /Epic 24.5%/);
      assert.match(g.bentoLuckLine(), /taken only from Rare/);
      if (odds.rare === 0) assert.match(g.bentoLuckLine(), /adds \+62.5% legendary and \+12.5% mythic/);
    }
  }
});
