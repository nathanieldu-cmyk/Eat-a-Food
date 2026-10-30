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
      currentScript: { src: 'game.js?v=172' },
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
  // before animation and rendering bootstraps. Only unrelated view effects are stubbed.
  const marker = '  bestRunEl.textContent = `${save.bestRun} foods`;';
  assert.ok(game.includes(marker));
  vm.runInContext(game.replace(marker, `
    enterLobby = () => {};
    renderEquippedUi = () => {};
    broadcastSnap = () => {};
    draw = () => {};
    startLobbyLoop = () => {};
    renderPotionStatus = () => {};
    globalThis.api = { save, state, net, bankPendingFoods, pullFood,
      loadSave, endRun, tierByName, BENTO_RUN_CHANCE, totalLuckBonus, bentoRarityChances, bentoLuckLine, bentoOddsHtml };
    return;
    ${marker}
  `), context);
  assert.ok(context.api, 'game initializes successfully');
  return { ...context.api, math, storage, elements };
}


test('exact 20% drop threshold regardless of collection luck, permanent luck, potion, score, role or wipeout', () => {
  for (const types of [1, 50, 264]) {
    for (const opened of [0, 10000]) {
      for (const stacks of [0, 5]) {
        for (const earned of [0, 1, 20]) {
          for (const role of [null, 'host', 'guest']) {
            for (const wipedOut of [false, true]) {
              for (const roll of [0.199999, 0.2]) {
                const g = boot();
                for (const name of Object.keys(g.tierByName).slice(0, types)) g.save.inventory[name] = 1;
                g.save.bento.opened = opened;
                g.save.activePotions.luck = {endsAt: Date.now()+60000, stacks};
                g.state.running = true;
                g.state.foodsEarned = earned;
                g.net.role = role;
                let calls = 0;
                g.math.random = () => ++calls <= earned ? 0.5 : roll;
                g.endRun(wipedOut);
                assert.equal(g.BENTO_RUN_CHANCE, 0.2);
                assert.equal(g.save.bento.locked, roll < 0.2 ? 1 : 0);
                assert.equal(calls, earned + 1);
                g.endRun(wipedOut);
                assert.equal(calls, earned + 1, 'ending twice must not roll twice');
                const saved = JSON.parse(g.storage.get('sprinkleFeastSave'));
                assert.equal(saved.bento.locked, roll < 0.2 ? 1 : 0);
              }
            }
          }
        }
      }
    }
  }
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
