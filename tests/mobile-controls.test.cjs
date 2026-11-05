const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
function declaration(name) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end);
}
function boot() {
  const listeners = {};
  const captures = new Set();
  const element = () => ({ style: {}, classList: { add() {}, remove() {} } });
  const canvas = Object.assign(element(), {
    parentElement: element(),
    getBoundingClientRect: () => ({left: 10, top: 200, width: 380, height: 500}),
    addEventListener(name, fn) { listeners[name] = fn; },
    setPointerCapture(id) { captures.add(id); },
    hasPointerCapture(id) { return captures.has(id); },
    releasePointerCapture(id) { captures.delete(id); },
  });
  const moveStick = { x: 0, y: 0 };
  const touchControl = { moveId: null, cameraId: null };
  const view = { yaw: 0, pitch: 0.8 };
  const document = {hidden: false, addEventListener(name, fn) { listeners[name] = fn; }};
  const ctx = vm.createContext({
    canvas, moveStick, touchControl, view, touchStickEl: element(), touchKnobEl: element(),
    document, window: {addEventListener(name, fn) { listeners[name] = fn; }},
    moveKeys: new Set(), blocked: false, lobbyBlocked: () => ctx.blocked,
  });
  const endReset = source.indexOf('  canvas.addEventListener("pointerdown"');
  const reset = source.slice(source.indexOf('  function resetTouchControls('), endReset);
  const handlers = source.slice(endReset, source.indexOf('  canvas.addEventListener(\n    "wheel",', endReset));
  vm.runInContext(['updateTouchStick', 'finishControlPointer', 'directionFromKeys', 'keysAreMoving', 'controlDirection', 'playerIsMoving'].map(declaration).join('\n') + '\n' + reset + handlers +
    '\nglobalThis.api={directionFromKeys, keysAreMoving, controlDirection, playerIsMoving, resetTouchControls};', ctx);
  function pointer(type, id, x, y, pointerType = 'touch') {
    listeners[type]({pointerId: id, clientX: x, clientY: y, pointerType, button: 0, preventDefault() {}});
  }
  return {ctx, ...ctx.api, pointer, listeners, captures, moveStick, touchControl, view, document};
}

test('thumbstick has a dead zone, proportional speed, camera-relative steering and capped diagonal speed', () => {
  const g = boot();
  g.pointer('pointerdown', 1, 100, 600);
  g.pointer('pointermove', 1, 103, 600);
  assert.equal(g.controlDirection(), null);
  g.pointer('pointermove', 1, 100, 575);
  const half = g.controlDirection();
  assert.equal(half.strength, 0.5);
  assert.equal(half.y, -1);
  assert.equal(g.playerIsMoving(), true);
  g.pointer('pointermove', 1, 300, 400);
  const diagonal = g.controlDirection();
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-10);
  assert.equal(diagonal.strength, 1);
  g.view.yaw = Math.PI / 2;
  const rotated = g.directionFromKeys([], g.view.yaw, {x: 0, y: -1});
  assert.ok(rotated.x < -0.999 && Math.abs(rotated.y) < 1e-10);
  assert.equal(g.directionFromKeys(['w', 'd'], 0).strength, 1);
  assert.equal(g.directionFromKeys([], 0, {x: NaN, y: Infinity}), null);
});

test('two fingers move and turn independently; a third touch cannot steal either control', () => {
  const g = boot();
  g.pointer('pointerdown', 1, 100, 600);
  g.pointer('pointermove', 1, 100, 556);
  g.pointer('pointerdown', 2, 300, 500);
  g.pointer('pointerdown', 3, 320, 520);
  g.pointer('pointermove', 3, 390, 520);
  assert.equal(g.view.yaw, 0);
  g.pointer('pointermove', 2, 320, 510);
  assert.equal(g.view.yaw, -0.1);
  assert.ok(Math.abs(g.view.pitch - 0.84) < 1e-10);
  assert.equal(g.moveStick.y, -1);
  g.pointer('pointerup', 2, 320, 510);
  assert.equal(g.touchControl.cameraId, null);
  assert.equal(g.moveStick.y, -1);
  g.pointer('pointercancel', 1, 100, 556);
  assert.equal(g.playerIsMoving(), false);
  assert.equal(g.captures.size, 0);
});

test('lost capture, screen changes and backgrounding reset touches; menus block new input', () => {
  for (const interrupt of ['lostpointercapture', 'resize', 'visibilitychange']) {
    const g = boot();
    g.pointer('pointerdown', 1, 100, 600);
    g.pointer('pointermove', 1, 100, 550);
    if (interrupt === 'lostpointercapture') g.pointer(interrupt, 1, 100, 550);
    else { g.document.hidden = true; g.listeners[interrupt](); }
    assert.equal(g.playerIsMoving(), false);
    assert.equal(g.touchControl.moveId, null);
  }
  const g = boot();
  g.ctx.blocked = true;
  g.pointer('pointerdown', 1, 100, 600);
  assert.equal(g.touchControl.moveId, null);
});

test('mouse drags still turn the camera and never activate touch movement', () => {
  const g = boot();
  g.pointer('pointerdown', 1, 100, 600, 'mouse');
  g.pointer('pointermove', 1, 130, 580, 'mouse');
  assert.equal(g.view.yaw, -0.15);
  assert.equal(g.playerIsMoving(), false);
  g.pointer('pointerup', 1, 130, 580, 'mouse');
  assert.equal(g.touchControl.cameraId, null);
});

test('multiplayer guest packets carry analog input and use the same direction on the host', () => {
  const g = boot();
  g.pointer('pointerdown', 1, 100, 600);
  g.pointer('pointermove', 1, 125, 570);
  const net = {role: 'guest', inAcc: 0, place: 2};
  const state = {player: {x: 10, y: 20}, autoFarm: false, running: true, foodsEarned: 4};
  Object.assign(g.ctx, {net, state, netReady: () => true, localZone: () => 'arena',
    equippedTier: () => ({name: 'Peanut'}), boostStacks: () => 0, netSend: msg => { g.ctx.packet = msg; }});
  vm.runInContext(declaration('netPump') + '\nnetPump(0.05);', g.ctx);
  const packet = g.ctx.packet;
  assert.equal(packet.stick.x, g.moveStick.x);
  assert.equal(packet.stick.y, g.moveStick.y);
  const remote = g.directionFromKeys(packet.keys, packet.yaw, packet.stick);
  assert.deepEqual(remote, g.controlDirection());
});


test('portrait screens retain a useful horizontal field of view without changing desktop framing', () => {
  const g = boot();
  let width = 390, height = 650;
  Object.defineProperties(g.ctx.canvas, {clientWidth: {get: () => width}, clientHeight: {get: () => height}});
  g.view.renderer = {setSize() {}};
  g.view.camera = {updateProjectionMatrix() {}};
  vm.runInContext(declaration('resizeView') + '\nresizeView();', g.ctx);
  assert.ok(g.view.camera.fov > 60 && g.view.camera.fov < 70);
  width = 800; height = 500;
  vm.runInContext('resizeView();', g.ctx);
  assert.ok(Math.abs(g.view.camera.fov - 40) < 1e-10);
});
