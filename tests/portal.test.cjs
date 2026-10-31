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
  assert.ok(start >= 0, `missing function ${name}`);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

const names = [
  'ARENA', 'LOBBY_RADIUS', 'PORTAL_RADIUS', 'SHOP_PAD_RADIUS', 'SHOP_STALL_RADIUS',
  'CRAFT_PAD_RADIUS', 'CRAFT_STALL_RADIUS', 'PORTAL_SPOT', 'SHOP_PAD_SPOT',
  'SHOP_STALL_SPOT', 'CRAFT_PAD_SPOT', 'CRAFT_STALL_SPOT', 'LOBBY_SPAWN',
  'RING_MAJOR', 'RING_TUBE', 'FOOD_MODEL_SCALE',
];
const constants = names.map(name => {
  const match = source.match(new RegExp(`^  const ${name} = [^;]+;`, 'm'));
  assert.ok(match, `missing constant ${name}`);
  return match[0];
}).join('\n');

function boot() {
  const state = { mode: 'lobby', running: false, onShopPad: false, onCraftPad: false };
  const net = { role: null, humans: new Map() };
  const ctx = vm.createContext({
    state, net, Math, performance: { now: () => 0 },
    arenaHumans: () => [], netPump() {}, smoothRemotes() {}, stepWorld() {},
    clampToLobby() {}, checkLobbyPads() {},
    equippedTier: () => state.player.tier,
    applyLobbySteer(food) {
      if (state.destination) Object.assign(food, state.destination);
      return !!state.blocked;
    },
    startRun() { state.running = true; state.entries = (state.entries || 0) + 1; },
    enterArena(food) { food.zone = 'arena'; },
    spawnLobbyPlayer() { throw new Error('Unexpected player respawn'); },
  });
  vm.runInContext(`${constants}\n${[
    'ringReach', 'touchesPortal', 'followTarget', 'stepLobbyGuests', 'updateLobby',
    'buildLobby', 'syncLobbyScene',
  ].map(declaration).join('\n')}\n globalThis.api = {
    PORTAL_SPOT, PORTAL_RADIUS, ringReach, touchesPortal, stepLobbyGuests,
    updateLobby, buildLobby, syncLobbyScene
  };`, ctx);
  const api = ctx.api;
  const food = (x, y, radius = 10) => ({
    x, y, tier: {}, zone: 'lobby', drawRadius: () => radius,
  });
  return { ctx, state, net, food, ...api };
}

test('touching the visible portal edge starts contact for small and large foods', () => {
  const g = boot();
  for (const radius of [10, 40, 120]) {
    const food = g.food(g.PORTAL_SPOT.x, g.PORTAL_SPOT.y, radius);
    const edge = g.PORTAL_RADIUS + g.ringReach(food);
    for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
      food.x = g.PORTAL_SPOT.x + Math.cos(angle) * edge;
      food.y = g.PORTAL_SPOT.y + Math.sin(angle) * edge;
      assert.equal(g.touchesPortal(food), true);
      food.x = g.PORTAL_SPOT.x + Math.cos(angle) * (edge + 0.01);
      food.y = g.PORTAL_SPOT.y + Math.sin(angle) * (edge + 0.01);
      assert.equal(g.touchesPortal(food), false);
    }
  }
});

test('movement that crosses the portal between frames is detected without false contacts', () => {
  const g = boot();
  const food = g.food(g.PORTAL_SPOT.x + 300, g.PORTAL_SPOT.y);
  assert.equal(g.touchesPortal(food), false);
  assert.equal(g.touchesPortal(food, {x: g.PORTAL_SPOT.x - 300, y: food.y}), true);
  const outside = g.PORTAL_SPOT.y + g.PORTAL_RADIUS + g.ringReach(food) + 1;
  assert.equal(g.touchesPortal(food, {x: g.PORTAL_SPOT.x - 300, y: outside}, {x: g.PORTAL_SPOT.x + 300, y: outside}), false);
});

test('local lobby entry happens at first contact while modal dialogs still block entry', () => {
  for (const blocked of [false, true]) {
    const g = boot();
    g.state.player = g.food(g.PORTAL_SPOT.x, g.PORTAL_SPOT.y + 300);
    g.state.destination = {x: g.PORTAL_SPOT.x, y: g.PORTAL_SPOT.y + g.PORTAL_RADIUS + g.ringReach(g.state.player)};
    g.state.blocked = blocked;
    assert.equal(g.updateLobby(1 / 60), !blocked);
    assert.equal(g.state.running, !blocked);
    assert.equal(g.state.entries || 0, blocked ? 0 : 1);
  }
});

test('multiplayer guests enter on their reported contact before smoothing catches up', () => {
  const g = boot();
  const guest = g.food(g.PORTAL_SPOT.x, g.PORTAL_SPOT.y + 300);
  guest.tx = g.PORTAL_SPOT.x;
  guest.ty = g.PORTAL_SPOT.y + g.PORTAL_RADIUS + g.ringReach(guest);
  g.net.humans.set('guest', guest);
  g.stepLobbyGuests(0.001);
  assert.ok(guest.y > guest.ty + 100, 'rendered position is still far from contact');
  assert.equal(guest.zone, 'arena');
});

test('portal has a marked spinning O, a raised 3D rim, and a flat glow', async () => {
  const THREE = await import(pathToFileURL(path.join(root, 'vendor/three.module.js')).href);
  const g = boot();
  Object.assign(g.ctx, {
    worldX: x => x - 1440, worldZ: y => y - 1440,
    makeLabelSprite: () => new THREE.Sprite(new THREE.SpriteMaterial()),
    writeLabel() {},
  });
  const lobby = g.buildLobby(THREE);
  const portal = lobby.portalRing.parent;
  for (const mesh of portal.children.filter(child => child.isMesh)) {
    if (mesh === lobby.portalRing) continue;
    assert.ok(['RingGeometry', 'CircleGeometry'].includes(mesh.geometry.type));
    assert.ok(mesh.position.y < 2, 'inner ring and glow stay on the floor');
  }
  assert.equal(lobby.portalSwirl.geometry.parameters.thetaLength, Math.PI * 2);
  assert.equal(lobby.portalGlow.geometry.type, 'RingGeometry');
  assert.equal(lobby.portalRing.geometry.type, 'TorusGeometry');
  assert.ok(lobby.portalRing.position.y > 8, 'outer rim is raised above the floor');
  const rim = lobby.portalRing.geometry.parameters;
  assert.equal(rim.radius + rim.tube, g.PORTAL_RADIUS, 'collision radius matches the rim outer edge');
  assert.ok(lobby.portalRing.material.isMeshStandardMaterial);
  const colors = lobby.portalSwirl.geometry.getAttribute('color');
  const shades = Array.from({length: colors.count}, (_, i) => colors.getX(i));
  assert.ok(Math.max(...shades) - Math.min(...shades) > 0.8, 'blue markings make the spin obvious');
  assert.ok(Array.from({length: colors.count}, (_, i) => colors.getZ(i) - colors.getX(i)).some(delta => delta > 0.7), 'markings are blue');
  g.ctx.view = {arenaGroup: {}, lobby};
  g.syncLobbyScene(0);
  const initial = lobby.portalSwirl.rotation.z;
  g.syncLobbyScene(0.5);
  assert.notEqual(lobby.portalSwirl.rotation.z, initial);
  for (const mesh of [lobby.portalSwirl, lobby.portalRing, lobby.portalGlow]) {
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(mesh.rotation);
    assert.ok(Math.abs(normal.x) < 1e-9 && Math.abs(normal.z) < 1e-9);
    assert.ok(Math.abs(Math.abs(normal.y) - 1) < 1e-9);
  }
});
