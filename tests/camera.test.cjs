const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');

function declaration(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

const constants = ['ARENA', 'MAP_SCALE', 'RUN_CAMERA_DISTANCE', 'BASE_FOOD_DRAW_RADIUS',
  'MIN_CAMERA_DISTANCE', 'MAX_CAMERA_DISTANCE'].map(name => {
  const match = source.match(new RegExp(`^  const ${name} = [^;]+;`, 'm'));
  assert.ok(match, `missing ${name}`);
  return match[0];
}).join('\n');

function boot() {
  const state = { running: true, player: { x: 100, y: 200, drawRadius: () => 17 } };
  const net = {};
  const camera = { position: { set() {} }, lookAt() {} };
  const view = { distance: 480, zoomFactor: 1, pitch: 0.86, yaw: 0.55, camera };
  const context = vm.createContext({ state, net, view, worldX: x => x, worldZ: y => y });
  vm.runInContext(`${constants}\n${declaration('cameraDistanceForFood')}\n${declaration('updateCamera')}\n` +
    'globalThis.api = { cameraDistanceForFood, updateCamera, BASE_FOOD_DRAW_RADIUS, RUN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE };', context);
  return { state, net, view, ...context.api };
}

test('run camera pulls back at 40% of the visible food growth rate', () => {
  const g = boot();
  const startRadius = g.BASE_FOOD_DRAW_RADIUS;
  g.state.player.drawRadius = () => startRadius;
  const startDistance = g.cameraDistanceForFood(g.state.player);
  assert.equal(startDistance, g.RUN_CAMERA_DISTANCE);

  g.state.player.drawRadius = () => startRadius * 2;
  const grownDistance = g.cameraDistanceForFood(g.state.player);
  assert.equal(grownDistance, startDistance * 1.4);
  assert.ok((startRadius * 2) / grownDistance > startRadius / startDistance, 'growing food stays larger on screen');
  for (let i = 0; i < 40; i++) g.updateCamera();
  assert.ok(Math.abs(g.view.distance - grownDistance) < 7, 'camera eases toward the larger size');

  g.view.zoomFactor = 1.5;
  assert.equal(g.cameraDistanceForFood(g.state.player, g.view.zoomFactor), grownDistance * 1.5);
  for (let i = 0; i < 40; i++) g.updateCamera();
  assert.ok(Math.abs(g.view.distance - grownDistance * 1.5) < 8, 'manual zoom remains applied');
  assert.ok(g.cameraDistanceForFood({ drawRadius: () => 10000 }) <= g.MAX_CAMERA_DISTANCE);
});

test('lobby camera does not zoom with the food size', () => {
  const g = boot();
  g.state.running = false;
  g.view.distance = 1150;
  g.state.player.drawRadius = () => 120;
  g.updateCamera();
  assert.equal(g.view.distance, 1150);
});
