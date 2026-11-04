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
  const cache = new Map();
  const context = vm.createContext({ view: { THREE, foodSparkleTexture: texture, foodSparkleShapes: cache } });
  vm.runInContext(['makeFoodSparkleShape', 'makeFoodSparkles', 'syncFoodSparkles', 'disposeFoodSparkles'].map(declaration).join('\n') +
    '\nglobalThis.api = { makeFoodSparkleShape, syncFoodSparkles, disposeFoodSparkles };', context);
  return { THREE, texture, cache, ...context.api };
}

function makeEntry(g, geometry = new g.THREE.SphereGeometry(0.45, 16, 12), modelFile = 'sphere.glb') {
  const group = new g.THREE.Group();
  const holder = new g.THREE.Group();
  geometry.computeBoundingBox();
  const mesh = new g.THREE.Mesh(geometry, new g.THREE.MeshBasicMaterial());
  mesh.position.y = -geometry.boundingBox.min.y;
  holder.add(mesh);
  group.add(holder);
  return { group, holder, modelFile, spin: 0.4 };
}

test('variant sparkles reuse one particle cloud, follow growth and animate without affecting plain foods', async () => {
  const g = await boot();
  const entry = makeEntry(g);
  const food = { tier: {} };
  g.syncFoodSparkles(entry, food, 0, 30);
  assert.equal(entry.group.children.length, 1);

  food.tier = { isGolden: true };
  entry.holder.rotation.y = 0.7;
  entry.holder.scale.setScalar(30);
  g.syncFoodSparkles(entry, food, 0, 30);
  const points = entry.sparkles;
  assert.equal(points.isPoints, true);
  assert.equal(points.geometry.attributes.position.count, 80);
  assert.equal(points.geometry.attributes.color.itemSize, 4);
  assert.equal(entry.group.children.length, 2);
  assert.equal(points.rotation.y, entry.holder.rotation.y);
  assert.equal(points.material.map, g.texture);
  assert.equal(points.material.depthWrite, false);
  assert.equal(points.material.depthTest, false);
  assert.equal(points.material.fog, false);
  const positions = Array.from(points.geometry.attributes.position.array);
  const colors = Array.from(points.geometry.attributes.color.array);
  const smallSize = points.material.size;
  assert.ok(smallSize < 30 * 0.2);
  for (let i = 1; i < positions.length; i += 3) assert.ok(positions[i] > 0 && positions[i] < 1.2);

  const shape = entry.sparkleShape;
  entry.holder.scale.setScalar(60);
  entry.holder.rotation.y = 0.9;
  g.syncFoodSparkles(entry, food, 1, 60);
  assert.equal(entry.sparkles, points);
  assert.equal(points.scale.x, 60);
  assert.equal(points.rotation.y, entry.holder.rotation.y);
  assert.equal(entry.sparkleShape, shape);
  assert.equal(points.material.size, smallSize * 2);
  assert.notDeepEqual(Array.from(points.geometry.attributes.position.array), positions);
  assert.notDeepEqual(Array.from(points.geometry.attributes.color.array), colors);
  assert.equal(entry.group.children.length, 2);

  let previousPositions = Array.from(points.geometry.attributes.position.array);
  let previousAlpha = Array.from({ length: 80 }, (_, i) => points.geometry.attributes.color.getW(i));
  for (let frame = 1; frame <= 120; frame++) {
    g.syncFoodSparkles(entry, food, 1 + frame / 60, 60);
    const positions = points.geometry.attributes.position;
    const colors = points.geometry.attributes.color;
    let visible = 0;
    for (let i = 0; i < positions.count; i++) {
      const movement = Math.hypot(positions.getX(i) - previousPositions[i * 3],
        positions.getY(i) - previousPositions[i * 3 + 1], positions.getZ(i) - previousPositions[i * 3 + 2]);
      assert.ok(movement < 0.05, 'particles orbit continuously without resetting their position');
      const alpha = colors.getW(i);
      assert.ok(alpha >= 0 && alpha <= 1);
      assert.ok(Math.abs(alpha - previousAlpha[i]) < 0.05, 'each particle fades smoothly');
      if (alpha > 0.05) visible++;
    }
    assert.ok(visible > 30, 'the staggered cloud stays visible throughout a run');
    assert.equal(points.visible, true);
    previousPositions = Array.from(positions.array);
    previousAlpha = Array.from({ length: 80 }, (_, i) => colors.getW(i));
  }

  food.tier = {};
  g.syncFoodSparkles(entry, food, 2, 60);
  assert.equal(points.visible, false);
});

test('gold, rainbow and shadow particles have distinct color palettes and change with the variant', async () => {
  const g = await boot();
  const entry = makeEntry(g);
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
  assert.equal(entry.group.children.length, 2);
});

test('removed foods release particle resources while preserving the shared sparkle texture', async () => {
  const g = await boot();
  const entry = makeEntry(g);
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
  assert.equal(entry.group.children.length, 1);
  assert.equal(g.cache.size, 1);
});

test('sparkles hug long, flat, round and holed meshes and share cached base-food shapes', async () => {
  const g = await boot();
  const long = makeEntry(g, new g.THREE.BoxGeometry(1, 0.12, 0.12), 'long.glb');
  const flat = makeEntry(g, new g.THREE.BoxGeometry(1, 0.05, 0.8).toNonIndexed(), 'flat.glb');
  const round = makeEntry(g, new g.THREE.SphereGeometry(0.5, 24, 16), 'round.glb');
  const ring = makeEntry(g, new g.THREE.TorusGeometry(0.35, 0.12, 12, 36), 'ring.glb');
  const boundsFor = entry => {
    g.syncFoodSparkles(entry, { tier: { isGolden: true } }, 0.25, 30);
    const bounds = new g.THREE.Box3().setFromBufferAttribute(entry.sparkles.geometry.attributes.position);
    return { bounds, size: bounds.getSize(new g.THREE.Vector3()) };
  };
  const longShape = boundsFor(long);
  assert.ok(longShape.size.x > 0.9);
  assert.ok(longShape.size.z < 0.25 && longShape.bounds.max.y < 0.25);
  const flatShape = boundsFor(flat);
  assert.ok(flatShape.size.x > 0.9 && flatShape.size.z > 0.7);
  assert.ok(flatShape.bounds.max.y < 0.17, 'flat foods do not get a tall generic sparkle cloud');
  const roundShape = boundsFor(round);
  assert.ok(roundShape.size.x > 0.85 && roundShape.bounds.max.y > 0.85);
  boundsFor(ring);
  const ringPositions = ring.sparkles.geometry.attributes.position;
  for (let i = 0; i < ringPositions.count; i++) {
    const radius = Math.hypot(ringPositions.getX(i), ringPositions.getY(i) - 0.47);
    assert.ok(radius > 0.16 && radius < 0.54, 'sparkles follow the ring instead of filling its hole');
  }
  assert.equal(g.cache.size, 4);
  const anotherLong = makeEntry(g, new g.THREE.BoxGeometry(1, 0.12, 0.12), 'long.glb');
  g.syncFoodSparkles(anotherLong, { tier: { isShadow: true } }, 2, 60);
  assert.equal(anotherLong.sparkleShape, long.sparkleShape);
  assert.equal(g.cache.size, 4);
});

test('surface sampling honors nested model transforms but excludes the holder world pose', async () => {
  const g = await boot();
  const root = new g.THREE.Group();
  root.position.set(123, -50, 17);
  root.rotation.set(0.4, 0.7, 0.2);
  root.scale.setScalar(45);
  const child = new g.THREE.Group();
  child.position.set(0.1, 0.2, 0.3);
  child.rotation.set(0.2, 0.5, 0.1);
  child.scale.set(0.7, 0.8, 0.9);
  root.add(child);
  const geometry = new g.THREE.BufferGeometry();
  geometry.setAttribute('position', new g.THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.computeVertexNormals();
  child.add(new g.THREE.Mesh(geometry, new g.THREE.MeshBasicMaterial()));
  const shape = g.makeFoodSparkleShape(g.THREE, root, 80);
  child.updateMatrix();
  const triangle = new g.THREE.Triangle(...[
    new g.THREE.Vector3(0, 0, 0), new g.THREE.Vector3(1, 0, 0), new g.THREE.Vector3(0, 1, 0),
  ].map(point => point.applyMatrix4(child.matrix)));
  const expectedNormal = triangle.getNormal(new g.THREE.Vector3());
  const plane = new g.THREE.Plane().setFromNormalAndCoplanarPoint(expectedNormal, triangle.a);
  for (let i = 0; i < 80; i++) {
    const point = new g.THREE.Vector3().fromArray(shape.position, i * 3);
    const normal = new g.THREE.Vector3().fromArray(shape.normal, i * 3);
    const tangent = new g.THREE.Vector3().fromArray(shape.tangent, i * 3);
    assert.ok(triangle.containsPoint(point));
    assert.ok(Math.abs(plane.distanceToPoint(point)) < 1e-6);
    assert.ok(normal.dot(expectedNormal) > 0.99999);
    assert.ok(Math.abs(normal.length() - 1) < 1e-6);
    assert.ok(Math.abs(normal.dot(tangent)) < 1e-6);
  }
});
