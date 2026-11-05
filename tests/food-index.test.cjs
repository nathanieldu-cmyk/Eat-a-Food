const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
function declaration(name) {
  const start = game.indexOf(`  function ${name}(`);
  const end = game.indexOf('\n  }\n', start);
  assert.ok(start >= 0 && end > start);
  return game.slice(start, end + 5);
}
function boot() {
  const context = vm.createContext({ window: {}, save: { inventory: { Peanut: 1 }, discovered: { Peanut: true } }, indexRowsEl: {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'foods.js'), 'utf8'), context);
  vm.runInContext([
    game.slice(game.indexOf('  const RARITIES ='), game.indexOf('  // Speeds are')) ,
    game.slice(game.indexOf('  const FOOD_TIERS ='), game.indexOf('  // One-time')),
    game.slice(game.indexOf('  const GOLDEN_FOODS ='), game.indexOf('  function variantClass')),
    ...['scaledSpeed', 'makeGoldenFood', 'makeShinyFood', 'makeShadowFood', 'variantClass', 'foodIconHtml', 'ownedCount', 'formatOdds', 'renderFoodIndex'].map(declaration),
    'globalThis.api = { renderFoodIndex, FOOD_TIERS };',
  ].join('\n'), context);
  return context;
}
test('index lists every food once in ascending odds with four versions and visible odds', () => {
  const g = boot();
  g.api.renderFoodIndex();
  const rows = [...g.indexRowsEl.innerHTML.matchAll(/<tr><th scope="row">([^<]+)<\/th>(.*?)<\/tr>/gs)];
  assert.equal(rows.length, g.window.FOOD_LIST.length);
  assert.equal(rows[0][1], 'Peanut');
  const originalOrder = g.api.FOOD_TIERS.map(f => f.name).join(',');
  let previous = 0;
  for (const [, name, cards] of rows) {
    const food = g.window.FOOD_LIST.find(f => f.name === name);
    assert.ok(food.odds >= previous);
    previous = food.odds;
    assert.equal((cards.match(/<td>/g) || []).length, 4);
    assert.equal((cards.match(/class="index-icon"/g) || []).length, 4);
    for (const factor of [1, 4, 16, 64]) assert.ok(cards.includes(`1 in ${(food.odds * factor).toLocaleString('en-US')}`));
  }
  assert.equal(g.api.FOOD_TIERS.map(f => f.name).join(','), originalOrder);
  assert.doesNotMatch(g.indexRowsEl.innerHTML, /(?:growth|speed|multiplier|pts |grw |spd |×1)/);
});
test('discovery is specific to each version, survives crafting, and includes current inventory', () => {
  const g = boot();
  g.save.discovered = { Peanut: true, 'Golden Peanut': true, 'Rainbow Cheese': true, 'Shadow Rice': true };
  g.save.inventory = { 'Golden Corn': 1 };
  g.api.renderFoodIndex();
  const html = g.indexRowsEl.innerHTML;
  for (const name of ['Peanut', 'Golden Peanut', 'Rainbow Cheese', 'Shadow Rice', 'Golden Corn']) {
    assert.ok(html.includes(`aria-label="${name}: collected,`), name);
  }
  for (const name of ['Rainbow Peanut', 'Shadow Peanut', 'Cheese', 'Golden Cheese', 'Rice', 'Corn']) {
    assert.ok(html.includes(`class="index-card index-locked" aria-label="${name}: not collected,`), name);
  }
  for (const style of ['common', 'golden', 'shiny', 'shadow']) assert.ok(html.includes(`index-card rarity-${style}`));
});

test('clipboard counts unique collected versions including crafted-away foods', () => {
  const g = boot();
  g.indexCountEl = {};
  g.indexBtn = { setAttribute(name, value) { this[name] = value; } };
  vm.runInContext(declaration('renderIndexButton'), g);
  g.save.discovered = { Peanut: true, 'Golden Peanut': true, 'Old Food': true };
  g.save.inventory = { Peanut: 20, 'Rainbow Peanut': 1, Cheese: 0 };
  g.renderIndexButton();
  assert.equal(g.indexCountEl.textContent, `3/${g.window.FOOD_LIST.length * 4}`);
  assert.equal(g.indexBtn['aria-label'], `Food Index: 3 of ${g.window.FOOD_LIST.length * 4} foods collected`);
  g.save.discovered['Shadow Peanut'] = true;
  g.renderIndexButton();
  assert.ok(g.indexCountEl.textContent.startsWith('4/'));
});

test('clipboard opens during an active run and clears held movement', () => {
  const classes = new Set(['hidden']);
  const state = { running: true };
  let reset = false, rendered = false, focused = false;
  const ctx = vm.createContext({
    state, moveKeys: new Set(['w']),
    resetTouchControls() { reset = true; },
    closeInventory() {}, closeShop() {}, closeCraft() {}, closeMulti() {},
    renderIndexButton() {}, renderFoodIndex() { rendered = true; },
    document: { activeElement: {}, body: { style: {} } },
    indexReturnFocus: null, indexScrollEl: { scrollTop: 100 },
    indexCloseBtn: { focus() { focused = true; } },
    indexModal: { classList: { remove(c) { classes.delete(c); } }, setAttribute() {} },
  });
  vm.runInContext(declaration('openIndex') + '\nopenIndex();', ctx);
  assert.equal(classes.has('hidden'), false);
  assert.equal(state.running, true);
  assert.equal(ctx.moveKeys.size, 0);
  assert.ok(reset && rendered && focused);
  assert.equal(ctx.indexScrollEl.scrollTop, 0);
});
