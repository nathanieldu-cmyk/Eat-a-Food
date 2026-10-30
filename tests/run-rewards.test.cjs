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
      currentScript: { src: 'game.js?v=163' },
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
    globalThis.api = { save, state, net, bankPendingFoods, pullFood,
      loadSave, endRun, tierByName, foodOddsLabel };
    return;
    ${marker}
  `), context);
  assert.ok(context.api, 'game initializes successfully');
  return { ...context.api, math, storage, elements };
}

test('Bento bonus wins below 0.2 and loses at or above 0.2 regardless of luck', () => {
  for (const types of [1, 10, 50]) {
    for (const potionStacks of [0, 1, 5]) {
      for (const [roll, expected] of [[0, 1], [0.199999, 1], [0.2, 0], [0.999999, 0]]) {
        const g = boot();
        for (const name of Object.keys(g.tierByName).slice(0, types)) g.save.inventory[name] = 1;
        delete g.save.inventory['Bento Box'];
        g.save.activePotions.luck = { endsAt: Date.now() + 60000, stacks: potionStacks };
        g.math.random = () => roll;
        const gained = g.bankPendingFoods();
        assert.equal(gained.filter((name) => name === 'Bento Box').length, expected);
        assert.equal(g.save.inventory['Bento Box'] || 0, expected);
      }
    }
  }
});

test('bonus rolls once per run regardless of earned food count; normal rolls exclude Bento', () => {
  for (const earned of [0, 1, 25]) {
    for (const bonusRoll of [0.1, 0.2]) {
      const g = boot();
      g.state.foodsEarned = earned;
      let calls = 0;
      g.math.random = () => ++calls <= earned ? 0.5 : bonusRoll;
      const gained = g.bankPendingFoods();
      assert.equal(calls, earned + 1);
      assert.equal(gained.length, earned + (bonusRoll < 0.2 ? 1 : 0));
      assert.equal(gained.filter((name) => name === 'Bento Box').length, bonusRoll < 0.2 ? 1 : 0);
    }
  }
  const g = boot();
  for (let i = 0; i < 1000; i++) {
    g.math.random = () => i / 1000;
    assert.notEqual(g.pullFood().name, 'Bento Box');
  }
});

test('ending solo, hosted, or guest runs banks one bonus, shows it, and cannot award twice', () => {
  for (const role of [null, 'host', 'guest']) {
    for (const wipedOut of [false, true]) {
      const g = boot();
      g.net.role = role;
      g.state.running = true;
      g.state.foodsEarned = 2;
      g.math.random = () => 0.1;
      g.endRun(wipedOut);
      assert.equal(g.save.inventory['Bento Box'], 1);
      assert.equal(g.save.diamonds, 2, 'bonus does not mint extra diamonds');
      assert.equal(g.save.bestRun, 2, 'bonus does not inflate the earned-food record');
      assert.equal(g.save.discovered['Bento Box'], true);
      assert.match(g.elements.get('overlay-msg').textContent, /Banked 3 foods and 2 diamonds/);
      assert.ok(g.elements.get('pull-results').children.some((row) => row.innerHTML.includes('Bento Box')));
      g.endRun(wipedOut);
      assert.equal(g.save.inventory['Bento Box'], 1);
      const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
      assert.equal(reloaded.save.inventory['Bento Box'], 1);
      assert.equal(reloaded.save.discovered['Bento Box'], true);
    }
  }
});

test('Bento and crafted variants survive reload without becoming Ramen', () => {
  const g = boot();
  const saved = JSON.parse(JSON.stringify(g.save));
  for (const name of ['Bento Box', 'Golden Bento Box', 'Rainbow Bento Box', 'Shadow Bento Box']) {
    saved.inventory[name] = 2;
    saved.discovered[name] = true;
  }
  saved.equipped = 'Bento Box';
  const reloaded = boot(saved);
  assert.equal(reloaded.save.equipped, 'Bento Box');
  assert.equal(reloaded.save.inventory.Ramen || 0, 0);
  for (const name of Object.keys(saved.inventory)) assert.equal(reloaded.save.inventory[name], saved.inventory[name]);
  assert.match(reloaded.foodOddsLabel(reloaded.tierByName['Bento Box']), /1 in 5 per run \(no luck bonuses\)/);
  assert.equal(reloaded.foodOddsLabel(reloaded.tierByName['Golden Bento Box']), 'Craft only');
});
