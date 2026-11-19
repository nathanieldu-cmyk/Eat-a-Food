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
    setTimeout() {},
    crypto: { randomUUID: () => `food-${++id}` },
    document: { currentScript: { src: 'game.js?v=197' }, getElementById: () => ({}) },
    localStorage: { getItem: () => null, setItem() {} },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'relics.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'foods.js'), 'utf8'), context);
  const marker = '  bestRunEl.textContent = `${save.bestRun} foods`;';
  assert.ok(source.includes(marker));
  vm.runInContext(source.replace(marker, `
    burst = () => {};
    updateFoods = () => {};
    resolveEats = () => {};
    updateParticles = () => {};
    globalThis.api = { ALL_FOODS, companionTier, spawnBetterRival, createFood,
      stepWorld, moveSpeed, growthForEat, eatSprinkle, foodPower, state, net, ARENA, SPEED_SCALE };
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

test('starter rivals retain the extra ten percent stats after CPU updates across the full food roster', () => {
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
    const matched = g.companionTier(tier);
    assert.ok(Math.abs(g.moveSpeed(starter) - matched.speed * 1.1 * g.SPEED_SCALE) < 1e-9, tier.name);
    assert.ok(Math.abs(starter.tier.growth - matched.growth * 1.1) < 1e-9, tier.name);
    assert.ok(Math.abs(starter.tier.multiplier - matched.multiplier * 1.1) < 1e-9, tier.name);
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

test('every CPU gets exactly 10% better speed, growth and points without changing player or shared food stats',()=>{
 const g=boot();
 for(const tier of g.ALL_FOODS){
   const original={...tier};const player=g.createFood(tier,0,0),cpu=g.createFood(tier,0,0,true);
   for(const stat of ['speed','growth','multiplier'])assert.ok(Math.abs(cpu.tier[stat]-tier[stat]*1.1)<1e-10,`${tier.name} ${stat}`);
   assert.deepEqual({...tier},original);assert.equal(player.tier,tier);assert.notEqual(cpu.tier,tier);
   assert.equal(cpu.tier.name,tier.name);assert.equal(cpu.tier.rarity,tier.rarity);
   const respawn=g.createFood(cpu.tier,0,0,true);
   for(const stat of ['speed','growth','multiplier'])assert.equal(respawn.tier[stat],cpu.tier[stat]);
 }
});
test('CPU bonuses survive repeated world steps without multiplying again',()=>{
 const g=boot();g.state.mode='run';g.state.running=true;
 g.state.player=g.createFood(g.ALL_FOODS[0],0,0);g.spawnBetterRival(g.state.player);
 const cpu=g.state.rivals[0],before={...cpu.tier};
 for(let i=0;i<100;i++)g.stepWorld(0,1000);
 assert.deepEqual({...cpu.tier},before);assert.equal(cpu.speedBoost,1);
});

test('actual CPU orb and prey growth get the bonus while player gains stay normal',()=>{
 const g=boot(),tier=g.ALL_FOODS[0],cpu=g.createFood(tier,0,0,true),player=g.createFood(tier,0,0);g.state.player=player;
 assert.ok(Math.abs(g.growthForEat(cpu)/g.growthForEat(player)-1.1)<1e-10);
 const orb={x:0,y:0,type:{points:25,color:'#fff',key:'small'}};
 g.state.sprinkles=[orb];const before=cpu.size;g.eatSprinkle(cpu,orb,0);
 assert.ok(Math.abs(cpu.size-before-25*tier.growth*1.1)<1e-10);
});
test('multiplayer CPU snapshots retain bonuses across updates and food changes',()=>{
 const g=boot();const start=source.indexOf('    if (msg.rivals) {'),end=source.indexOf('    if (msg.spr) {',start);
 const first=g.ALL_FOODS[0],second=g.ALL_FOODS[1],state={rivals:[]};
 const ctx={state,createFood:g.createFood,tierByName:{[first.name]:first,[second.name]:second},FOOD_TIERS:g.ALL_FOODS,msg:{rivals:[{id:'cpu',food:first.name,x:0,y:0,size:10}]}};
 for(let i=0;i<5;i++)vm.runInNewContext(source.slice(start,end),ctx);
 for(const stat of ['speed','growth','multiplier'])assert.ok(Math.abs(state.rivals[0].tier[stat]-first[stat]*1.1)<1e-10);
 ctx.msg.rivals[0].food=second.name;vm.runInNewContext(source.slice(start,end),ctx);
 for(const stat of ['speed','growth','multiplier'])assert.ok(Math.abs(state.rivals[0].tier[stat]-second[stat]*1.1)<1e-10);
});
