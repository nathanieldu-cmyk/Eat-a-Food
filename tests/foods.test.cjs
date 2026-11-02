const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({window: {}});
vm.runInContext(fs.readFileSync(path.join(root, 'foods.js'), 'utf8'), context);
const foods = context.window.FOOD_LIST;
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

function declaration(name) {
  const start = game.indexOf(`  function ${name}(`);
  const end = game.indexOf('\n  }\n', start);
  assert.ok(start >= 0 && end > start);
  return game.slice(start, end + 5);
}
const tierStart = game.indexOf('  const FOOD_TIERS =');
const tierEnd = game.indexOf('  // One-time', tierStart);
const modelStart = game.indexOf('  const FOOD_MODELS =');
const modelEnd = game.indexOf('  let view =', modelStart);
vm.runInContext([
  game.slice(tierStart, tierEnd), game.slice(modelStart, modelEnd),
  ...['scaledSpeed', 'makeGoldenFood', 'makeShinyFood', 'makeShadowFood', 'modelFileFor'].map(declaration),
  'globalThis.foodApi = {FOOD_TIERS, makeGoldenFood, makeShinyFood, makeShadowFood, modelFileFor};',
].join('\n'), context);

test('food definitions have unique names and usable stats', () => {
  assert.ok(foods.length > 0);
  assert.equal(new Set(foods.map(food => food.name)).size, foods.length);
  for (const food of foods) {
    assert.ok(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].includes(food.rarity));
    for (const stat of ['points', 'growth', 'speed', 'odds']) {
      assert.ok(Number.isFinite(food[stat]) && food[stat] > 0, `${food.name}: ${stat}`);
    }
  }
});

test('each food model is a valid GLB containing the corresponding named food', () => {
  const normalize = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const food of foods) {
    const file = path.join(root, 'models', food.model);
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF', food.name);
    assert.equal(bytes.readUInt32LE(4), 2, food.name);
    assert.equal(bytes.readUInt32LE(8), bytes.length, food.name);
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, food.name);
    const model = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    assert.ok(model.meshes.length > 0, `${food.name}: missing geometry`);
    assert.ok(model.nodes.some(node => node.name && normalize(node.name).includes(normalize(food.name))), `${food.name}: model name does not match`);
    for (const resource of [...(model.images || []), ...(model.buffers || [])]) {
      if (resource.uri && !resource.uri.startsWith('data:')) {
        assert.ok(fs.existsSync(path.resolve(path.dirname(file), resource.uri)), `${food.name}: missing ${resource.uri}`);
      }
    }
  }
});

test('Golden, Rainbow and Shadow foods resolve to their own base model', () => {
  const api = context.foodApi;
  for (const food of api.FOOD_TIERS) {
    const golden = api.makeGoldenFood(food);
    const rainbow = api.makeShinyFood(golden);
    const shadow = api.makeShadowFood(rainbow);
    for (const variant of [food, golden, rainbow, shadow]) {
      assert.equal(api.modelFileFor(variant), food.model, variant.name);
    }
  }
});
