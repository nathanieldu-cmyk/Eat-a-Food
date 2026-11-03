const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

function boot() {
  let id = 0;
  const math = Object.create(Math);
  math.random = () => 0.9;
  const context = vm.createContext({
    window: {}, console, Math: math, performance: { now: () => 1000 },
    crypto: { randomUUID: () => `food-${++id}` },
    document: { currentScript: { src: 'game.js?v=197' }, getElementById: () => ({}) },
    localStorage: { getItem: () => null, setItem() {} },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'foods.js'), 'utf8'), context);
  const marker = '  bestRunEl.textContent = `${save.bestRun} foods`;';
  assert.ok(source.includes(marker));
  vm.runInContext(source.replace(marker, `
    updateFoods = () => {};
    resolveEats = () => {};
    updateParticles = () => {};
    globalThis.api = { ALL_FOODS, companionTier, spawnBetterRival, createFood,
      stepWorld, moveSpeed, foodPower, state, net, ARENA, SPEED_SCALE };
    return;
    ${marker}
  `), context);
  return context.api;
}

test('every equipped food gets the closest growth plus one within 0.5 speed and never lower growth', () => {
  const g = boot();
  for (const tier of g.ALL_FOODS) {
    const rival = g.companionTier(tier);
    assert.ok(Math.abs(rival.speed - tier.speed) <= 0.5 + 1e-9, tier.name);
    assert.ok(rival.growth >= tier.growth, tier.name);
    const eligible = g.ALL_FOODS.filter(food => Math.abs(food.speed - tier.speed) <= 0.5 + 1e-9 && food.growth >= tier.growth);
    const minimumGrowthGap = Math.min(...eligible.map(food => Math.abs(food.growth - (tier.growth + 1))));
    assert.ok(Math.abs(Math.abs(rival.growth - (tier.growth + 1)) - minimumGrowthGap) < 1e-9, tier.name);
  }
});

test('starter rivals retain matched speed after CPU updates across the full food roster', () => {
  const g = boot();
  g.state.mode = 'run';
  g.state.running = true;
  for (const tier of g.ALL_FOODS) {
    g.state.rivals = [];
    g.state.player = g.createFood(tier, g.ARENA / 2, g.ARENA / 2);
    g.spawnBetterRival(g.state.player);
    assert.equal(g.state.rivals.length, 1);
    const starter = g.state.rivals[0];
    assert.equal(starter.isCompanion, true);
    assert.equal(starter.size, 10);
    assert.ok(Math.hypot(starter.x - g.state.player.x, starter.y - g.state.player.y) >= g.ARENA * 0.32);
    const extra = g.createFood(tier, 80, 80, true);
    g.state.rivals.push(extra);
    g.stepWorld(0, 1000);
    assert.equal(starter.speedBoost, 1);
    assert.ok(Math.abs(g.moveSpeed(starter) - g.moveSpeed(g.state.player)) <= 0.5 * g.SPEED_SCALE + 1e-9, tier.name);
    assert.ok(starter.tier.growth >= tier.growth, tier.name);
    assert.equal(extra.speedBoost, 1 + g.foodPower(tier) * 0.025);
  }
});

test('speed boundary is strict, all rarities are eligible, and growth ties are deterministic', () => {
  const start = source.indexOf('  function companionTier(');
  const end = source.indexOf('\n  // Every entry', start);
  const fn = source.slice(start, end);
  function choose(player, foods) {
    const ctx = vm.createContext({ ALL_FOODS: foods, player });
    vm.runInContext(`${fn}\nglobalThis.chosen = companionTier(player);`, ctx);
    return ctx.chosen;
  }
  const player = { name: 'Player', speed: 1.2, growth: 3 };
  const boundary = { name: 'Boundary', speed: 1.7, growth: 3.9 };
  const outside = { name: 'Outside', speed: 1.70001, growth: 4 };
  assert.equal(choose(player, [player, boundary, outside]), boundary);
  const slowerBoundary = { name: 'Slower boundary', speed: 0.7, growth: 4 };
  const tooSlow = { name: 'Too slow', speed: 0.69999, growth: 4 };
  assert.equal(choose(player, [player, boundary, slowerBoundary]), slowerBoundary);
  assert.equal(choose(player, [player, boundary, tooSlow]), boundary);
  const lessGrowth = { name: 'Less growth', speed: 1.2, growth: 2.99999 };
  const moreGrowth = { name: 'More growth', speed: 1.2, growth: 5.5 };
  assert.equal(choose(player, [lessGrowth, moreGrowth]), moreGrowth);
  assert.equal(choose(player, [lessGrowth]), player);
  const common = { name: 'Common', rarity: 'common', speed: 1.21, growth: 4 };
  assert.equal(choose(player, [player, boundary, common]), common);
  const lower = { name: 'Lower', speed: 1.2, growth: 3.8 };
  const higher = { name: 'Higher', speed: 1.2, growth: 4.2 };
  assert.equal(choose(player, [player, lower, higher]), higher);
  assert.equal(choose(player, [player, higher, lower]), higher);
  const other = { ...player, name: 'Other' };
  assert.equal(choose(player, [player, other]), other);
  assert.equal(choose(player, [player]), player);
});

test('turning CPUs off for a multiplayer room prevents starter rival spawning', () => {
  const g = boot();
  g.net.role = 'host';
  g.net.roster = [{ id: 'host' }, { id: 'guest' }];
  g.net.cpus = false;
  const player = g.createFood(g.ALL_FOODS[0], 1440, 1440);
  g.spawnBetterRival(player);
  assert.equal(g.state.rivals.length, 0);
});
