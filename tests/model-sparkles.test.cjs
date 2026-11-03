const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

function declaration(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

async function boot() {
  const THREE = await import(pathToFileURL(path.join(root, 'vendor/three.module.js')).href);
  const texture = new THREE.Texture();
  const context = vm.createContext({ view: { THREE, foodSparkleTexture: texture } });
  vm.runInContext(['makeFoodSparkles', 'syncFoodSparkles', 'disposeFoodSparkles'].map(declaration).join('\n') +
    '\nglobalThis.api = { syncFoodSparkles, disposeFoodSparkles };', context);
  return { THREE, texture, ...context.api };
}

test('variant sparkles reuse one particle cloud, follow growth and animate without affecting plain foods', async () => {
  const g = await boot();
  const entry = { group: new g.THREE.Group(), spin: 0.4 };
  const food = { tier: {} };
  g.syncFoodSparkles(entry, food, 0, 30);
  assert.equal(entry.group.children.length, 0);

  food.tier = { isGolden: true };
  g.syncFoodSparkles(entry, food, 0, 30);
  const points = entry.sparkles;
  assert.equal(points.isPoints, true);
  assert.equal(points.geometry.attributes.position.count, 16);
  assert.equal(entry.group.children.length, 1);
  assert.equal(points.material.map, g.texture);
  assert.equal(points.material.depthWrite, false);
  const positions = Array.from(points.geometry.attributes.position.array);
  const colors = Array.from(points.geometry.attributes.color.array);
  const smallSize = points.material.size;
  for (let i = 1; i < positions.length; i += 3) assert.ok(positions[i] > 0 && positions[i] < 1.2);

  g.syncFoodSparkles(entry, food, 1, 60);
  assert.equal(entry.sparkles, points);
  assert.equal(points.scale.x, 60);
  assert.equal(points.material.size, smallSize * 2);
  assert.notDeepEqual(Array.from(points.geometry.attributes.position.array), positions);
  assert.notDeepEqual(Array.from(points.geometry.attributes.color.array), colors);
  assert.equal(entry.group.children.length, 1);

  food.tier = {};
  g.syncFoodSparkles(entry, food, 2, 60);
  assert.equal(points.visible, false);
});

test('gold, rainbow and shadow particles have distinct color palettes and change with the variant', async () => {
  const g = await boot();
  const entry = { group: new g.THREE.Group(), spin: 0.2 };
  const huesFor = tier => {
    g.syncFoodSparkles(entry, { tier }, 0, 30);
    const colors = entry.sparkles.geometry.attributes.color;
    return Array.from({ length: colors.count }, (_, i) => new g.THREE.Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHSL({}).h);
  };
  const gold = huesFor({ isGolden: true });
  const cloud = entry.sparkles;
  assert.ok(gold.every(hue => hue > 0.1 && hue < 0.16));
  const rainbow = huesFor({ isShiny: true });
  assert.ok(Math.max(...rainbow) - Math.min(...rainbow) > 0.85);
  const shadow = huesFor({ isShadow: true });
  assert.ok(shadow.every(hue => hue > 0.7 && hue < 0.8));
  assert.equal(entry.sparkles, cloud);
  assert.equal(entry.group.children.length, 1);
});

test('removed foods release particle resources while preserving the shared sparkle texture', async () => {
  const g = await boot();
  const entry = { group: new g.THREE.Group(), spin: 0 };
  g.syncFoodSparkles(entry, { tier: { isGolden: true } }, 0, 30);
  let geometryDisposed = false;
  let materialDisposed = false;
  let textureDisposed = false;
  entry.sparkles.geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  entry.sparkles.material.addEventListener('dispose', () => { materialDisposed = true; });
  g.texture.addEventListener('dispose', () => { textureDisposed = true; });
  g.disposeFoodSparkles(entry);
  assert.equal(geometryDisposed, true);
  assert.equal(materialDisposed, true);
  assert.equal(textureDisposed, false);
  assert.equal(entry.sparkles, null);
  assert.equal(entry.group.children.length, 0);
});
