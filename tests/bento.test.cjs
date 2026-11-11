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
      currentScript: { src: 'game.js?v=198' },
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
      loadSave, endRun, addPoints, restoreCarriedPoints, updateHud, tierByName, rollRunGoldBentoCount, rollRunRainbowBentoCount, storeBento, rollBentoType, rollRunBentoCount, addBento, advanceBento, bentoInventoryCount, buyBento, skipBento, openBento, BENTO_UNLOCK_MS, BENTO_BASE_CHANCES, permanentLuckBonus, totalLuckBonus, bentoRarityChances, bentoLuckLine, bentoOddsHtml, bentoLuckBonus };
    return;
    ${marker}
  `), context);
  assert.ok(context.api, 'game initializes successfully');
  return { ...context.api, math, storage, elements };
}


const thresholds = [
  [0, 0, 0], [1, 0, 1], [4, 0, 1], [5, 0, 1], [9, 0, 1],
  [10, 0, 1], [19, 0, 1], [20, 0, 2], [24, 0, 2], [25, 1, 3], [49, 1, 3],
  [50, 2, 4], [99, 2, 4], [100, 3, 5], [149, 3, 5],
  [150, 4, 6], [199, 4, 6], [200, 4, 6], [299, 4, 6],
  [300, 5, 7], [399, 5, 7], [400, 5, 7], [499, 5, 7],
  [500, 6, 8], [749, 6, 8], [750, 7, 9], [999, 7, 9],
  [1000, 8, 10], [1249, 8, 10], [1250, 9, 11], [1500, 10, 12],
];

const goldThresholds = [
  [0, 0, 0], [1, 0, 0], [24, 0, 0], [25, 0, 25], [49, 0, 25],
  [50, 0, 20], [99, 0, 20], [100, 0, 15], [199, 0, 15],
  [200, 0, 10], [299, 0, 10], [300, 0, 10], [399, 0, 10], [400, 0, 5], [499, 0, 5],
  [500, 1, 0], [699, 1, 0], [700, 1, 0], [900, 1, 0], [1100, 1, 0],
  [1300, 1, 0], [1500, 1, 0], [2000, 1, 0], [2750, 1, 0], [126500, 1, 0],
];

test('gold counts follow every food milestone and exact bonus probability boundary without luck', () => {
  for (const boosted of [false, true]) {
    const g = boot();
    if (boosted) {
      g.save.bento.opened = 10000;
      g.save.activePotions.luck = { endsAt: Date.now() + 60000, stacks: 5 };
    }
    for (const [foods, guaranteed, denominator] of goldThresholds) {
      for (const roll of denominator ? [0, 1 / denominator - 1e-9, 1 / denominator, 0.999999] : [0, 0.999999]) {
        let calls = 0;
        g.math.random = () => { calls++; return roll; };
        assert.equal(g.rollRunGoldBentoCount(foods), guaranteed + (denominator && roll < 1 / denominator ? 1 : 0), `foods=${foods}, roll=${roll}`);
        assert.equal(calls, denominator ? 1 : 0);
      }
      if (denominator) {
        let bonus = 0;
        for (let n = 0; n < 300; n++) {
          g.math.random = () => n / 300;
          if (g.rollRunGoldBentoCount(foods) > guaranteed) bonus++;
        }
        assert.equal(bonus, 300 / denominator);
      }
    }
  }
});

test('shop buys have 1/25 Gold and 1/500 Rainbow chances and preserve the awarded type', () => {
  for (const [roll, expected] of [[0, 'gold'], [0.02, 'gold'], [0.025, 'gold'], [0.039999, 'gold'], [0.04, 'rainbow'], [0.041999, 'rainbow'], [0.042, 'normal'], [0.999999, 'normal']]) {
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
    if (expected === 'rainbow') assert.match(g.elements.get('bento-results').innerHTML, /turned rainbow!/);
  }
});

test('gold rewards depend on foods instead of the number of Bento Boxes rolled', () => {
  for (const countRoll of [0.1, 0.3, 0.9]) {
    const g = boot();
    g.state.running = true;
    g.state.foodsEarned = 200;
    let calls = 0;
    g.math.random = () => ++calls === 1 ? countRoll : 0.099999;
    g.endRun();
    assert.equal(calls, 2);
    assert.equal(g.save.bento.lockedTypes.filter(type => type === 'gold').length, 1);
    assert.equal(g.bentoInventoryCount(), countRoll < 0.5 ? 5 : 4);
    assert.equal(g.save.bento.lockedTypes[0], 'gold');
  }

  const many = boot();
  many.state.running = true;
  many.state.foodsEarned = 1250;
  let rolls = 0;
  many.math.random = () => ++rolls === 1 ? 0.1 : 0.999999;
  many.endRun(); // Eleven boxes earned still guarantee only one gold at this food milestone.
  assert.equal(rolls, 2);
  assert.deepEqual(Array.from(many.save.bento.lockedTypes), ['gold', 'normal', 'normal', 'normal', 'normal']);
});

test('runs below 25 foods no longer get random gold upgrades', () => {
  for (const foods of [1, 4, 5, 9, 10, 24]) {
    const g = boot();
    g.state.running = true;
    g.state.foodsEarned = foods;
    let calls = 0;
    g.math.random = () => { calls++; return 0; };
    g.endRun();
    assert.equal(calls, 1);
    assert.ok(g.save.bento.lockedTypes.length > 0);
    assert.ok(g.save.bento.lockedTypes.every(type => type === 'normal'));
  }
});

const rainbowThresholds = [
  [0, 0, 0], [499, 0, 0], [500, 50, 1], [700, 45, 1], [900, 40, 1],
  [1100, 35, 2], [1300, 30, 1], [1500, 25, 1], [1750, 20, 1],
  [2000, 15, 1], [2250, 10, 1], [2500, 5, 1], [2750, 5, 1], [2999, 5, 1], [3000, 1, 1], [100000, 1, 1],
];

test('Rainbow odds follow every milestone, stop at one guaranteed box, and ignore luck', () => {
  for (const boosted of [false, true]) {
    const g = boot();
    if (boosted) {
      g.save.bento.opened = 10000;
      g.save.activePotions.luck = {endsAt: Date.now() + 60000, stacks: 5};
    }
    for (let i = 0; i < rainbowThresholds.length; i++) {
      const [foods, denominator, count] = rainbowThresholds[i];
      const upper = i + 1 < rainbowThresholds.length ? rainbowThresholds[i+1][0] - 1 : foods;
      for (const earned of [foods, upper]) {
        for (const roll of denominator > 1 ? [0, 1/denominator - 1e-9, 1/denominator, 0.999999] : [0, 0.999999]) {
          let calls = 0;
          g.math.random = () => { calls++; return roll; };
          assert.equal(g.rollRunRainbowBentoCount(earned), denominator === 1 || denominator && roll < 1/denominator ? count : 0, `foods=${earned}, roll=${roll}`);
          assert.equal(calls, denominator > 1 ? 1 : 0);
        }
      }
    }
  }
});

test('run rewards grant one Gold from 500 and the correct Rainbow count within normal rewards', () => {
  for (const [foods, denominator, rainbowCount] of rainbowThresholds.filter(([n]) => n >= 500)) {
    for (const won of [true, false]) {
      const g = boot();
      g.state.running = true;
      g.state.foodsEarned = foods;
      let calls = 0;
      g.math.random = () => ++calls === 1 ? 0.9 : won ? 0 : 0.999999;
      g.endRun();
      const rainbows = won || denominator === 1 ? rainbowCount : 0;
      assert.equal(g.save.bento.lockedTypes.filter(t => t === 'gold').length, 1);
      assert.equal(g.save.bento.lockedTypes.filter(t => t === 'rainbow').length, rainbows, `foods=${foods}`);
      assert.equal(calls, denominator === 1 ? 1 : 2);
      assert.equal(g.bentoInventoryCount(), 5);
      const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
      assert.deepEqual(Array.from(reloaded.save.bento.lockedTypes), Array.from(g.save.bento.lockedTypes));
      if (rainbows) assert.match(g.elements.get('overlay-msg').textContent, /Rainbow Bento Box/);
    }
  }
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

test('Rainbow and Gold rewards upgrade normal slots across ready and locked groups without losing progress', () => {
  for (let ready = 0; ready <= 5; ready++) {
    const fixture = boot().save;
    const started = ready < 5 ? Date.now() - 2000 : 0;
    fixture.bento = { ready, readyTypes: Array(ready).fill('normal'), locked: 5-ready,
      lockedTypes: Array(5-ready).fill('normal'), unlockStartedAt: started, opened: 7 };
    const g = boot(fixture);
    g.state.running = true;
    g.state.foodsEarned = 1100;
    g.math.random = () => 0;
    g.endRun();
    assert.equal(g.save.bento.ready, ready);
    assert.equal(g.save.bento.locked, 5-ready);
    assert.equal(g.save.bento.unlockStartedAt, started);
    const types = [...g.save.bento.readyTypes, ...g.save.bento.lockedTypes];
    assert.equal(types.filter(t => t === 'rainbow').length, 2);
    assert.equal(types.filter(t => t === 'gold').length, 1);
    assert.equal(types.filter(t => t === 'normal').length, 2);
    const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
    assert.deepEqual(Array.from([...reloaded.save.bento.readyTypes, ...reloaded.save.bento.lockedTypes]), types);
  }
});

test('Rainbow prefers normal slots, upgrades Gold when needed, and can never be downgraded', () => {
  const g = boot();
  g.save.bento = {ready: 2, readyTypes: ['normal', 'rainbow'], locked: 3,
    lockedTypes: ['gold', 'gold', 'gold'], unlockStartedAt: Date.now(), opened: 0};
  assert.equal(g.storeBento('rainbow'), 'replaced');
  assert.deepEqual(Array.from(g.save.bento.lockedTypes), ['gold', 'gold', 'gold']);
  assert.deepEqual(Array.from(g.save.bento.readyTypes), ['rainbow', 'rainbow']);
  assert.equal(g.storeBento('rainbow'), 'replaced');
  assert.deepEqual(Array.from(g.save.bento.lockedTypes), ['gold', 'gold', 'rainbow']);
  assert.equal(g.storeBento('gold'), false);
  assert.equal(g.storeBento('normal'), false);
  g.save.bento.lockedTypes = ['rainbow', 'rainbow', 'rainbow'];
  assert.equal(g.storeBento('rainbow'), false);
});

test('Rainbow survives timed unlocking, skipping, saving and opening as Rainbow foods', () => {
  const fixture = boot().save;
  const start = Date.now();
  fixture.diamonds = 100000;
  fixture.bento = {ready: 1, readyTypes: ['rainbow'], locked: 2,
    lockedTypes: ['rainbow', 'gold'], unlockStartedAt: start, opened: 0};
  const g = boot(fixture);
  g.advanceBento(start + g.BENTO_UNLOCK_MS);
  g.skipBento();
  const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
  assert.deepEqual(Array.from(reloaded.save.bento.readyTypes), ['rainbow', 'rainbow', 'gold']);
  reloaded.math.random = () => 0.1;
  reloaded.openBento();
  const rainbowFoods = Object.entries(reloaded.save.inventory).filter(([name])=>reloaded.tierByName[name].isShiny);
  assert.equal(rainbowFoods.reduce((n,[,count])=>n+count,0), 6);
  for (const [name] of rainbowFoods) assert.equal(reloaded.save.discovered[name], true);
  assert.equal(reloaded.save.bento.opened, 3);
  assert.equal(reloaded.bentoInventoryCount(), 0);
  assert.match(reloaded.elements.get('bento-results').innerHTML, /2 rainbow/);
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
  g.state.foodsEarned = 25;
  g.math.random = () => 0;
  g.endRun();
  assert.equal(g.save.bento.ready, 5);
  assert.equal(g.save.bento.locked, 0);
  assert.deepEqual(Array.from(g.save.bento.readyTypes), ['gold', 'normal', 'normal', 'normal', 'normal']);
  g.openBento();
  assert.equal(g.bentoInventoryCount(), 0);
  const goldenCount = Object.entries(g.save.inventory).filter(([name]) => g.tierByName[name].isGolden)
    .reduce((sum, [, count]) => sum + count, 0);
  assert.equal(goldenCount, 3);
});

test('run rewards place the food-based gold quota before normal boxes', () => {
  const g = boot();
  g.state.running = true;
  g.state.foodsEarned = 25;
  const rolls = [0.1, 0];
  let calls = 0;
  g.math.random = () => rolls[calls++];
  g.endRun();
  assert.equal(calls, 2);
  assert.deepEqual(Array.from(g.save.bento.lockedTypes), ['gold', 'normal', 'normal']);
  assert.equal(g.bentoInventoryCount(), 3);
});

test('finishing a run prioritizes existing gold boxes within ready and locked groups without resetting the timer', () => {
  const fixture = boot().save;
  const started = Date.now() - 60000;
  fixture.bento = { ready: 2, readyTypes: ['normal', 'gold'], locked: 3,
    lockedTypes: ['normal', 'gold', 'normal'], unlockStartedAt: started, opened: 0 };
  const g = boot(fixture);
  g.state.running = true;
  g.state.foodsEarned = 0;
  g.endRun();
  assert.deepEqual(Array.from(g.save.bento.readyTypes), ['gold', 'normal']);
  assert.deepEqual(Array.from(g.save.bento.lockedTypes), ['gold', 'normal', 'normal']);
  assert.equal(g.save.bento.ready, 2);
  assert.equal(g.save.bento.locked, 3);
  assert.equal(g.save.bento.unlockStartedAt, started);
  const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
  assert.deepEqual(Array.from(reloaded.save.bento.lockedTypes), ['gold', 'normal', 'normal']);
  reloaded.advanceBento(started + reloaded.BENTO_UNLOCK_MS);
  assert.deepEqual(Array.from(reloaded.save.bento.readyTypes), ['gold', 'normal', 'gold']);
  assert.deepEqual(Array.from(reloaded.save.bento.lockedTypes), ['normal', 'normal']);
});

function expectedCount(earned, minimum, maximum, roll) {
  if (earned < 1) return 0;
  if (earned < 5) return roll < 0.125 ? 1 : 0;
  if (earned < 20) return roll < 0.25 ? 1 : 0;
  return roll < 0.25 ? maximum : roll < 0.5 ? minimum + 1 : minimum;
}

test('all food milestones and exact 12.5%/25%/50% probability boundaries', () => {
  const g = boot();
  for (const [earned, minimum, maximum] of thresholds) {
    for (const roll of [0, 0.124999, 0.125, 0.249999, 0.25, 0.499999, 0.5, 0.999999]) {
      g.math.random = () => roll;
      assert.equal(g.rollRunBentoCount(earned), expectedCount(earned, minimum, maximum, roll));
    }
    const outcomes = [];
    for (let n = 0; n < 1000; n++) {
      g.math.random = () => n / 1000;
      outcomes.push(g.rollRunBentoCount(earned));
    }
    assert.equal(outcomes.filter(n => n >= maximum).length, earned < 1 ? 1000 : earned < 5 ? 125 : 250);
    if (earned >= 20) assert.equal(outcomes.filter(n => n >= minimum + 1).length, 500);
    assert.equal(outcomes.filter(n => n >= minimum).length, 1000);
  }
});

test('one reward-count roll plus at most one gold-quota roll regardless of luck, role or wipeout', () => {
  for (const boosted of [false, true]) {
    for (const [earned, minimum, maximum] of thresholds) {
      for (const role of [null, 'host', 'guest']) {
        for (const wipedOut of [false, true]) {
          for (const roll of [0.124999, 0.125, 0.249999, 0.25, 0.5]) {
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
            assert.equal(calls, earned >= 25 ? 2 : 1);
            assert.equal(g.save.diamonds, earned);
            const [, guaranteedGold, goldDenominator] = goldThresholds.findLast(([foods]) => foods <= earned);
            const goldCount = Math.min(rolled, guaranteedGold + (goldDenominator && roll < 1 / goldDenominator ? 1 : 0));
            if (expected) assert.ok(g.elements.get('overlay-msg').textContent.includes(`You earned ${rolled - goldCount} normal bento box`));
            g.endRun(wipedOut);
            assert.equal(calls, earned >= 25 ? 2 : 1, 'ending twice must not roll twice');
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
    if (accepted < 5) assert.ok(message.endsWith('You earned 5 normal bento boxes, inventory is full.'));
    else assert.ok(message.includes('You earned 5 normal bento boxes!'));
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

test('Epic, Legendary and Mythic bonuses come only from Rare, respect caps, and ignore potions', () => {
  for (const opened of [0, 100, 1000, 10000, 20000, 1000000]) {
    for (const types of [1, 50, 264]) {
      const g = boot();
      for (const name of Object.keys(g.tierByName).slice(0, types)) g.save.inventory[name] = 1;
      g.save.bento.opened = opened;
      const luck = g.permanentLuckBonus();
      const epicBonus = Math.min(10.5, luck * 1.5);
      const legendaryBonus = Math.min(9, luck * 0.5);
      const mythicBonus = Math.min(69 - epicBonus - legendaryBonus, luck * 0.1);
      const odds = g.bentoRarityChances();
      near(odds.epic, 29.5 + epicBonus);
      near(odds.legendary, 1 + legendaryBonus);
      near(odds.mythic, 0.5 + mythicBonus);
      near(odds.rare, 69 - epicBonus - legendaryBonus - mythicBonus);
      near(Object.values(odds).reduce((sum, n) => sum + n, 0), 100);
      assert.ok(Object.values(odds).every(n => n >= 0 && n <= 100));
      assert.ok(odds.epic <= 40 && odds.legendary <= 10);
      const beforePotion = JSON.stringify(odds);
      g.save.activePotions.luck = { endsAt: Date.now() + 60000, stacks: 5 };
      assert.equal(JSON.stringify(g.bentoRarityChances()), beforePotion);
      assert.ok(g.bentoOddsHtml().includes(`Epic ${Number(odds.epic.toFixed(1))}%`));
      assert.match(g.bentoLuckLine(), /% mythic\.$/);
      if (odds.rare === 0) assert.match(g.bentoLuckLine(), /adds \+10.5% epic and \+9.0% legendary and \+49.5% mythic/);
    }
  }
});

test('approved base rates sum to 100 and capped chances never decrease as luck grows', () => {
  const g = boot();
  assert.deepEqual({ ...g.BENTO_BASE_CHANCES }, { rare: 69, epic: 29.5, legendary: 1, mythic: 0.5 });
  near(Object.values(g.BENTO_BASE_CHANCES).reduce((sum, chance) => sum + chance, 0), 100);
  let previous = null;
  for (const [opened, rare, epic, legendary, mythic] of [
    [0, 66.9, 31, 1.5, 0.6],
    [119, 54.405, 39.925, 4.475, 1.195],
    [120, 54.3, 40, 4.5, 1.2],
    [121, 54.27, 40, 4.525, 1.205],
    [339, 47.73, 40, 9.975, 2.295],
    [340, 47.7, 40, 10, 2.3],
    [341, 47.695, 40, 10, 2.305],
    [9879, 0.005, 40, 10, 49.995],
    [9880, 0, 40, 10, 50],
    [9881, 0, 40, 10, 50],
    [1000000, 0, 40, 10, 50],
  ]) {
    g.save.bento.opened = opened;
    const odds = g.bentoRarityChances();
    for (const [rarity, expected] of Object.entries({ rare, epic, legendary, mythic })) near(odds[rarity], expected);
    near(Object.values(odds).reduce((sum, chance) => sum + chance, 0), 100);
    if (previous) {
      assert.ok(odds.rare <= previous.rare);
      for (const rarity of ['epic', 'legendary', 'mythic']) assert.ok(odds[rarity] >= previous[rarity]);
    }
    previous = odds;
  }
});


test('full inventory message shows only normal rewards with correct singular or plural and no replacement text', () => {
  for (const [foods, roll, expected] of [
    [1, 0.1, 'You earned 1 normal bento box, inventory is full.'],
    [25, 0.1, 'You earned 3 normal bento boxes, inventory is full.'],
    [1000, 0.1, 'You earned 9 normal bento boxes, inventory is full.'],
    [25, [0.9, 0], 'You earned 0 normal bento boxes, inventory is full.'],
    [25, [0.3, 0], 'You earned 1 normal bento box, inventory is full.'],
    [0, 0.9, null],
  ]) {
    const g = boot();
    g.save.bento.ready = 5;
    g.state.running = true;
    g.state.foodsEarned = foods;
    let calls = 0;
    g.math.random = () => Array.isArray(roll) ? roll[calls++] : roll;
    g.endRun();
    const message = g.elements.get('overlay-msg').textContent;
    assert.ok(!message.includes('replaced'));
    if (expected) assert.ok(message.endsWith(expected), message);
    else assert.ok(!message.includes('inventory is full'));
    assert.equal(g.bentoInventoryCount(), 5);
  }
});


test('Rainbow Bento Boxes use normal box rolls and only convert the three foods to Rainbow', () => {
  for (const roll of [0.1, 0.8, 0.985, 0.9999]) {
    const normal = boot();
    const rainbow = boot();
    normal.save.bento.ready = rainbow.save.bento.ready = 1;
    normal.save.bento.readyTypes = ['normal'];
    rainbow.save.bento.readyTypes = ['rainbow'];
    normal.math.random = rainbow.math.random = () => roll;
    normal.openBento();
    rainbow.openBento();
    const baseName = Object.keys(normal.save.inventory).find(name => name !== 'Peanut');
    const rainbowName = Object.keys(rainbow.save.inventory).find(name => name !== 'Peanut');
    assert.ok(baseName && rainbowName);
    assert.equal(rainbow.tierByName[rainbowName].baseName, baseName);
    assert.equal(rainbow.tierByName[rainbowName].isShiny, true);
    assert.equal(rainbow.tierByName[rainbowName].rarity, normal.tierByName[baseName].rarity);
    assert.equal(normal.save.inventory[baseName], 3);
    assert.equal(rainbow.save.inventory[rainbowName], 3);
    assert.equal(rainbow.save.discovered[rainbowName], true);
    assert.equal(normal.save.bento.opened, rainbow.save.bento.opened);
    assert.equal(normal.totalLuckBonus(), rainbow.totalLuckBonus());
    assert.match(rainbow.elements.get('bento-results').innerHTML, /Rainbow Bento Box opened!/);
  }
});


test('one shared shop roll gives exactly 4% Gold and 0.2% Rainbow independent of luck', () => {
  for (const boosted of [false, true]) {
    const g = boot();
    if (boosted) {
      g.save.bento.opened = 10000;
      g.save.activePotions.luck = {endsAt: Date.now() + 60000, stacks: 5};
    }
    const counts = {normal: 0, gold: 0, rainbow: 0};
    let calls = 0;
    for (let n = 0; n < 500; n++) {
      g.math.random = () => { calls++; return (n + 0.5) / 500; };
      counts[g.rollBentoType()]++;
    }
    assert.deepEqual(counts, {normal: 479, gold: 20, rainbow: 1});
    assert.equal(calls, 500);
  }
});


test('every Bento type gives five permanent luck percentage points per box, including mixed batches and reloads', () => {
  for (const types of [['normal'], ['gold'], ['rainbow'], ['normal','gold','rainbow']]) {
    const g = boot();
    g.save.bento.opened = 7;
    near(g.bentoLuckBonus(), .35);
    const before = g.permanentLuckBonus(0);
    g.save.bento.ready = types.length;
    g.save.bento.readyTypes = [...types];
    g.math.random = () => .1;
    g.openBento();
    near(g.bentoLuckBonus(), .35 + types.length * .05);
    near(g.permanentLuckBonus(0) - before, types.length * .05);
    const reloaded = boot(JSON.parse(g.storage.get('sprinkleFeastSave')));
    assert.equal(reloaded.save.bento.opened, 7 + types.length);
    near(reloaded.bentoLuckBonus(), (7 + types.length) * .05);
    const after = g.bentoLuckBonus();
    g.openBento();
    near(g.bentoLuckBonus(), after);
    g.save.activePotions.luck = {endsAt: Date.now() + 60000, stacks:5};
    near(g.bentoLuckBonus(), after);
  }
});
