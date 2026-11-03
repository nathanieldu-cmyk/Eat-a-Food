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
    textContent: '', innerHTML: '', children: [], style: {},
    classList: { classes: new Set(), add(name) { this.classes.add(name); }, remove(name) { this.classes.delete(name); }, toggle(name, on) { if (on) this.classes.add(name); else this.classes.delete(name); }, contains(name) { return this.classes.has(name); } },
    setAttribute() {},
    appendChild(child) { this.children.push(child); },
  });
  const math = Object.create(Math);
  math.random = () => 0.9;
  const context = vm.createContext({
    window: {}, Math: math, console,
    document: {
      currentScript: { src: 'game.js?v=191' },
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
      loadSave, endRun, addPoints, restoreCarriedPoints, updateHud, tierByName, goldBentoDenominator, rollRunBentoCount, addBento, advanceBento, bentoInventoryCount, buyBento, skipBento, openBento, BENTO_UNLOCK_MS, totalLuckBonus, bentoRarityChances, bentoLuckLine, bentoOddsHtml };
    return;
    ${marker}
  `), context);
  assert.ok(context.api, 'game initializes successfully');
  return { ...context.api, math, storage, elements };
}


const thresholds = [
  [0, 0, 0], [1, 0, 1], [4, 0, 1], [5, 0, 1], [9, 0, 1],
  [10, 0, 2], [24, 0, 2], [25, 1, 3], [49, 1, 3],
  [50, 2, 4], [99, 2, 4], [100, 3, 5], [149, 3, 5],
  [150, 4, 6], [199, 4, 6], [200, 4, 6], [299, 4, 6],
  [300, 5, 7], [399, 5, 7], [400, 5, 7], [499, 5, 7],
  [500, 6, 8], [749, 6, 8], [750, 7, 9], [999, 7, 9],
  [1000, 8, 10], [1249, 8, 10], [1250, 9, 11], [1500, 10, 12],
];

test('gold upgrade odds follow every box-count milestone through 1/5 then 1/1', () => {
  for (const boosted of [false, true]) {
    for (const [boxes, denominator] of [[1, 50], [2, 45], [3, 40], [4, 35], [5, 30],
      [6, 25], [7, 20], [8, 15], [9, 10], [10, 5], [11, 1], [12, 1], [100, 1]]) {
      for (const [roll, gold] of [[0, true], [1 / denominator - 1e-9, true],
        ...(denominator > 1 ? [[1 / denominator, false], [0.999999, false]] : [[0.999999, true]])]) {
        const g = boot();
        if (boosted) {
          g.save.bento.opened = 10000;
          g.save.activePotions.luck = { endsAt: Date.now() + 60000, stacks: 5 };
        }
        assert.equal(g.goldBentoDenominator(boxes), denominator);
        g.math.random = () => roll;
        assert.equal(g.addBento(boxes), true);
        assert.equal(g.save.bento.lockedTypes[0], gold ? 'gold' : 'normal');
      }
    }
  }
});

test('buying uses 1/50 even when four boxes are already owned, and saves the gold type', () => {
  for (const [roll, expected] of [[0.019999, 'gold'], [0.02, 'normal'], [0.025, 'normal']]) {
    const g = boot();
    g.save.diamonds = 1000;
    g.save.bento.locked = 4;
    g.save.bento.unlockStartedAt = Date.now();
    g.math.random = () => roll;
    g.buyBento();
    assert.equal(g.save.diamonds, 0);
    assert.equal(g.save.bento.locked, 5);
    assert.equal(g.save.bento.lockedTypes[4], expected);
    const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
    assert.equal(reloaded.save.bento.lockedTypes[4], expected);
    if (expected === 'gold') assert.match(g.elements.get('bento-results').innerHTML, /turned gold!/);
  }
});

test('run gold rolls use the total earned boxes, including when some do not fit', () => {
  const g = boot();
  g.state.running = true;
  g.state.foodsEarned = 200;
  let calls = 0;
  g.math.random = () => ++calls === 1 ? 0.1 : 0.035;
  g.endRun(); // Six boxes earned: 1/25 for each, rather than 1/30 for five accepted.
  assert.equal(calls, 7);
  assert.deepEqual(Array.from(g.save.bento.lockedTypes), Array(5).fill('gold'));
  assert.match(g.elements.get('overlay-msg').textContent, /5 Bento Boxes turned gold!/);
  assert.ok(g.elements.get('overlay-msg').textContent.endsWith('You earned 6 bento boxes, inventory is full.'));

  const many = boot();
  many.state.running = true;
  many.state.foodsEarned = 1250;
  let rolls = 0;
  many.math.random = () => ++rolls === 1 ? 0.1 : 0.999999;
  many.endRun(); // Eleven boxes earned: every accepted box is gold.
  assert.deepEqual(Array.from(many.save.bento.lockedTypes), Array(5).fill('gold'));
});

test('mixed box types survive timed unlocking, skipping, opening and reloads', () => {
  const fixture = boot().save;
  const start = Date.now();
  fixture.diamonds = 100000;
  fixture.bento = { locked: 3, lockedTypes: ['gold', 'normal', 'gold'], ready: 1,
    readyTypes: ['normal'], unlockStartedAt: start, opened: 0 };
  const g = boot(fixture);
  g.advanceBento(start + g.BENTO_UNLOCK_MS);
  assert.deepEqual(Array.from(g.save.bento.readyTypes), ['normal', 'gold']);
  assert.deepEqual(Array.from(g.save.bento.lockedTypes), ['normal', 'gold']);
  g.skipBento();
  const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
  assert.deepEqual(Array.from(reloaded.save.bento.readyTypes), ['normal', 'gold', 'normal']);
  assert.deepEqual(Array.from(reloaded.save.bento.lockedTypes), ['gold']);
  reloaded.openBento();
  assert.equal(reloaded.save.bento.ready, 0);
  assert.equal(reloaded.save.bento.readyTypes.length, 0);
  assert.equal(reloaded.save.bento.locked, 1);
  assert.deepEqual(Array.from(reloaded.save.bento.lockedTypes), ['gold']);
  assert.equal(reloaded.save.bento.opened, 3);
  const goldenCount = Object.entries(reloaded.save.inventory)
    .filter(([name]) => reloaded.tierByName[name].isGolden).reduce((sum, [, count]) => sum + count, 0);
  assert.equal(goldenCount, 3);
});

test('Gold Bento Boxes use identical food rolls and award their Golden versions', () => {
  for (const roll of [0.1, 0.8, 0.985, 0.9999]) {
    const normal = boot();
    const gold = boot();
    normal.save.bento.ready = gold.save.bento.ready = 1;
    normal.save.bento.readyTypes = ['normal'];
    gold.save.bento.readyTypes = ['gold'];
    normal.math.random = gold.math.random = () => roll;
    normal.openBento();
    gold.openBento();
    const baseName = Object.keys(normal.save.inventory).find(name => name !== 'Peanut');
    const goldenName = Object.keys(gold.save.inventory).find(name => name !== 'Peanut');
    assert.ok(baseName && goldenName);
    assert.equal(gold.tierByName[goldenName].baseName, baseName);
    assert.equal(gold.tierByName[goldenName].isGolden, true);
    assert.equal(gold.tierByName[goldenName].rarity, normal.tierByName[baseName].rarity);
    assert.equal(gold.save.inventory[goldenName], 3);
    assert.equal(gold.save.discovered[goldenName], true);
    assert.equal(normal.save.bento.opened, gold.save.bento.opened);
    assert.equal(normal.totalLuckBonus(), gold.totalLuckBonus());
    assert.match(gold.elements.get('bento-results').innerHTML, /Gold Bento Box opened!/);
  }
});

test('old saves migrate to normal boxes and over-capacity mixed saves retain ready types first', () => {
  const old = boot().save;
  old.bento = { locked: 2, ready: 1, opened: 10, unlockStartedAt: Date.now() };
  const migrated = boot(old);
  assert.deepEqual(Array.from(migrated.save.bento.readyTypes), ['normal']);
  assert.deepEqual(Array.from(migrated.save.bento.lockedTypes), ['normal', 'normal']);

  old.bento = { locked: 4, lockedTypes: ['gold', 'gold', 'gold', 'gold'], ready: 4,
    readyTypes: ['gold', 'normal', 'gold', 'invalid'], opened: 10, unlockStartedAt: Date.now() };
  const capped = boot(old);
  assert.equal(capped.bentoInventoryCount(), 5);
  assert.deepEqual(Array.from(capped.save.bento.readyTypes), ['gold', 'normal', 'gold', 'normal']);
  assert.deepEqual(Array.from(capped.save.bento.lockedTypes), ['gold']);
});

test('two gold rewards replace the final two normal slots in every ready/locked split', () => {
  for (let ready = 0; ready <= 5; ready++) {
    const fixture = boot().save;
    const started = ready < 5 ? Date.now() - 2000 : 0;
    fixture.bento = { ready, readyTypes: Array(ready).fill('normal'), locked: 5 - ready,
      lockedTypes: Array(5 - ready).fill('normal'), unlockStartedAt: started, opened: 7 };
    const g = boot(fixture);
    g.state.running = true;
    g.state.foodsEarned = 10;
    let calls = 0;
    g.math.random = () => ++calls === 1 ? 0.1 : 0;
    g.endRun();
    assert.equal(calls, 3);
    assert.equal(g.bentoInventoryCount(), 5);
    assert.equal(g.save.bento.ready, ready);
    assert.equal(g.save.bento.locked, 5 - ready);
    assert.equal(g.save.bento.unlockStartedAt, started);
    assert.deepEqual(Array.from([...g.save.bento.readyTypes, ...g.save.bento.lockedTypes]),
      ['normal', 'normal', 'normal', 'gold', 'gold']);
    assert.match(g.elements.get('overlay-msg').textContent, /2 normal Bento Boxes were replaced with gold\./);
    assert.ok(g.elements.get('overlay-msg').textContent.endsWith('You earned 2 bento boxes, inventory is full.'));
    const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
    assert.deepEqual(Array.from([...reloaded.save.bento.readyTypes, ...reloaded.save.bento.lockedTypes]),
      ['normal', 'normal', 'normal', 'gold', 'gold']);
  }
});

test('gold rewards skip existing gold boxes and replace earlier normal slots', () => {
  const fixture = boot().save;
  fixture.bento = { ready: 2, readyTypes: ['gold', 'normal'], locked: 3,
    lockedTypes: ['normal', 'gold', 'normal'], unlockStartedAt: Date.now(), opened: 0 };
  const g = boot(fixture);
  g.state.running = true;
  g.state.foodsEarned = 25;
  let calls = 0;
  g.math.random = () => ++calls === 1 ? 0.1 : 0;
  g.endRun();
  assert.equal(g.bentoInventoryCount(), 5);
  assert.deepEqual(Array.from([...g.save.bento.readyTypes, ...g.save.bento.lockedTypes]), Array(5).fill('gold'));
  assert.match(g.elements.get('overlay-msg').textContent, /3 normal Bento Boxes were replaced with gold\./);
});

test('overflow rolls continue after rejected normal boxes and can upgrade newly filled slots', () => {
  for (const initialLocked of [3, 5]) {
    const g = boot();
    g.save.bento.locked = initialLocked;
    g.save.bento.unlockStartedAt = Date.now();
    g.state.running = true;
    g.state.foodsEarned = initialLocked === 3 ? 200 : 25;
    const rolls = initialLocked === 3 ? [0.1, 0.9, 0.9, 0.9, 0, 0, 0.9] : [0.1, 0.9, 0, 0.9];
    let calls = 0;
    g.math.random = () => rolls[calls++];
    g.endRun();
    assert.equal(calls, rolls.length);
    assert.equal(g.bentoInventoryCount(), 5);
    assert.deepEqual(Array.from(g.save.bento.lockedTypes), initialLocked === 3
      ? ['normal', 'normal', 'normal', 'gold', 'gold']
      : ['normal', 'normal', 'normal', 'normal', 'gold']);
  }
});

test('a full inventory of gold boxes stays intact and buying while full charges nothing', () => {
  const fixture = boot().save;
  fixture.diamonds = 10000;
  fixture.bento = { ready: 2, readyTypes: ['gold', 'gold'], locked: 3,
    lockedTypes: ['gold', 'gold', 'gold'], unlockStartedAt: Date.now(), opened: 5 };
  const g = boot(fixture);
  const before = JSON.stringify(g.save.bento);
  g.state.running = true;
  g.state.foodsEarned = 25;
  g.math.random = () => 0;
  g.endRun();
  assert.equal(JSON.stringify(g.save.bento), before);
  assert.equal(g.bentoInventoryCount(), 5);
  assert.ok(!g.elements.get('overlay-msg').textContent.includes('turned gold'));
  const diamonds = g.save.diamonds;
  g.math.random = () => { throw new Error('Buying while full should not roll'); };
  g.buyBento();
  assert.equal(g.save.diamonds, diamonds);
  assert.equal(JSON.stringify(g.save.bento), before);
});

test('upgrading a ready normal box keeps it ready and gives Golden food when opened', () => {
  const g = boot();
  g.save.bento.ready = 5;
  g.state.running = true;
  g.state.foodsEarned = 1;
  g.math.random = () => 0;
  g.endRun();
  assert.equal(g.save.bento.ready, 5);
  assert.equal(g.save.bento.locked, 0);
  assert.deepEqual(Array.from(g.save.bento.readyTypes), ['normal', 'normal', 'normal', 'normal', 'gold']);
  g.openBento();
  assert.equal(g.bentoInventoryCount(), 0);
  const goldenCount = Object.entries(g.save.inventory).filter(([name]) => g.tierByName[name].isGolden)
    .reduce((sum, [, count]) => sum + count, 0);
  assert.equal(goldenCount, 3);
});

function expectedCount(earned, minimum, maximum, roll) {
  if (earned < 1) return 0;
  if (earned < 5) return roll < 0.25 ? 1 : 0;
  if (earned < 10) return roll < 0.5 ? 1 : 0;
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
    assert.equal(outcomes.filter(n => n >= maximum).length, earned < 1 ? 1000 : earned < 10 && earned >= 5 ? 500 : 250);
    if (earned >= 10) assert.equal(outcomes.filter(n => n >= minimum + 1).length, 500);
    assert.equal(outcomes.filter(n => n >= minimum).length, 1000);
  }
});

test('one reward-count roll plus one gold roll per earned box regardless of luck, role or wipeout', () => {
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
            const rolled = expectedCount(earned, minimum, maximum, roll);
            const expected = Math.min(5, rolled);
            assert.equal(g.save.bento.locked, expected);
            assert.equal(calls, 1 + rolled);
            assert.equal(g.save.diamonds, earned);
            if (expected) assert.ok(g.elements.get('overlay-msg').textContent.includes(`You earned ${expectedCount(earned, minimum, maximum, roll)} bento box`));
            g.endRun(wipedOut);
            assert.equal(calls, 1 + rolled, 'ending twice must not roll twice');
            const saved = JSON.parse(g.storage.get('sprinkleFeastSave'));
            assert.equal(saved.bento.locked, expected);
          }
        }
      }
    }
  }
});

test('unfinished food progress survives a run and a reload', () => {
  const first = boot();
  first.state.running = true;
  first.state.player = { tier: first.tierByName.Peanut };
  first.addPoints(1350);
  assert.equal(first.state.foodsEarned, 1);
  assert.equal(first.elements.get('food-fill').style.width, '35%');
  assert.equal(first.elements.get('peanut-meter-hint').classList.contains('active'), true);
  first.endRun();
  assert.equal(first.save.carryPoints, 350);
  assert.equal(first.elements.get('next-food').textContent, '350 / 1000');
  assert.equal(first.elements.get('food-fill').style.width, '35%');
  assert.equal(first.elements.get('peanut-meter-hint').classList.contains('active'), false);

  const second = boot(JSON.parse(first.storage.get('sprinkleFeastSave')));
  second.updateHud();
  assert.equal(second.elements.get('next-food').textContent, '350 / 1000');
  assert.equal(second.elements.get('food-fill').style.width, '35%');
  second.state.running = true;
  second.state.player = { tier: second.tierByName.Peanut };
  second.restoreCarriedPoints();
  second.updateHud();
  assert.equal(second.state.points, 350);
  assert.equal(second.elements.get('food-fill').style.width, '35%');
  second.addPoints(650);
  assert.equal(second.state.foodsEarned, 1);
  second.endRun();
  assert.equal(second.save.carryPoints, 0);
});

test('carried bar progress remains the same after switching foods', () => {
  const g = boot();
  g.save.carryPoints = 750;
  g.save.equipped = 'Cheese';
  g.updateHud();
  assert.equal(g.elements.get('food-fill').style.width, '75%');
  g.state.running = true;
  g.state.player = { tier: g.tierByName.Cheese };
  g.restoreCarriedPoints();
  g.updateHud();
  assert.equal(g.elements.get('food-fill').style.width, '75%');
  assert.equal(g.elements.get('peanut-meter-hint').classList.contains('active'), false);
  g.addPoints(250 / ((1 + g.tierByName.Cheese.multiplier) / 2));
  assert.equal(g.state.foodsEarned, 1);
});

test('full and partially full inventories reject extra run boxes and show Inventory is full', () => {
  for (const [locked, ready] of [[5, 0], [0, 5], [3, 2], [4, 0], [1, 3], [0, 0]]) {
    const g = boot();
    g.save.bento.locked = locked;
    g.save.bento.ready = ready;
    g.save.bento.unlockStartedAt = locked ? Date.now() : 0;
    g.state.running = true;
    g.state.foodsEarned = 100;
    g.math.random = () => 0.1; // Five boxes rolled at this milestone.
    g.endRun();
    const accepted = Math.min(5, 5 - locked - ready);
    assert.equal(g.bentoInventoryCount(), locked + ready + accepted);
    assert.equal(g.save.bento.ready, ready);
    const message = g.elements.get('overlay-msg').textContent;
    assert.equal(message.includes('inventory is full.'), accepted < 5);
    if (accepted < 5) assert.ok(message.endsWith('You earned 5 bento boxes, inventory is full.'));
    else assert.ok(message.includes('You earned 5 bento boxes!'));
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
      assert.match(g.bentoLuckLine(), /% mythic\.$/);
      if (odds.rare === 0) assert.match(g.bentoLuckLine(), /adds \+61.7% legendary and \+12.3% mythic/);
    }
  }
});


test('full inventory message shows the rolled reward count and correct singular or plural', () => {
  for (const [foods, roll, expected] of [
    [1, 0.1, 'You earned 1 bento box, inventory is full.'],
    [25, 0.1, 'You earned 3 bento boxes, inventory is full.'],
    [1000, 0.1, 'You earned 10 bento boxes, inventory is full.'],
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
