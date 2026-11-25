const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const read = (dir, name) => fs.readFileSync(path.join(dir, name), 'utf8');
const html = read(output, 'index.html');
const plain = value => JSON.parse(JSON.stringify(value));
const scripts = [...html.matchAll(/<script\s+src="([^"?]+)(?:\?[^\"]*)?"\s*><\/script>/g)].map(match => match[1]);

test('every game script is transformed, parses and has no source maps', () => {
  assert.equal(scripts.length, 10);
  for (const name of scripts) {
    const built = read(output, name);
    assert.notEqual(built, read(root, name), name);
    assert.ok(built.includes('_0x'), `Expected obfuscated identifiers in ${name}`);
    assert.doesNotMatch(built, /sourceMappingURL|sourceURL=/);
    new vm.Script(built, {filename: name});
  }
  assert.doesNotMatch(read(output, 'game.js'), /function (loadSave|pullFood|awardRunFood|buyRelicPack)\(/);
});

test('deployment contains only runtime assets, with no original sources or project tools', () => {
  const allowed = new Set([...scripts, 'index.html', 'style.css', 'relic-art.svg', 'relic-pack.svg', 'secret-pack.svg', 'weather-event.json', 'giveaway-event.json']);
  for (const entry of fs.readdirSync(output, {withFileTypes: true})) {
    if (entry.isDirectory()) assert.ok(['models', 'audio', 'vendor'].includes(entry.name), entry.name);
    else assert.ok(allowed.has(entry.name), entry.name);
  }
  for (const name of ['tests', 'scripts', 'node_modules', '.git', 'package.json', 'package-lock.json', 'trailer.html', 'render_trailer.py', 'FRONTEND-PROTECTION.md']) {
    assert.equal(fs.existsSync(path.join(output, name)), false, name);
  }
  for (const name of fs.readdirSync(output, {recursive: true})) assert.doesNotMatch(name, /\.map$/);
  assert.equal(JSON.parse(read(root, 'vercel.json')).outputDirectory, 'dist');
});

test('script ordering and versions are preserved for multiplayer updates and saves', () => {
  assert.equal(html, read(root, 'index.html'));
  assert.match(html, /game\.js\?v=\d+/);
  for (const [, url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(https?:|data:|#)/.test(url)) continue;
    assert.ok(fs.existsSync(path.join(output, url.split(/[?#]/)[0])), url);
  }
  assert.equal(read(output, 'giveaway-event.json'), read(root, 'giveaway-event.json'));
  assert.equal(read(output, 'weather-event.json'), read(root, 'weather-event.json'));
});

function load(dir) {
  const context = vm.createContext({window: {}, Math});
  for (const name of ['foods.js', 'relics.js', 'relic-opening.js']) {
    vm.runInContext(read(dir, name), context, {filename: name, timeout: 10000});
  }
  return context.window;
}

test('protected food definitions and relic save normalization match editable source', () => {
  const source = load(root), built = load(output);
  assert.deepEqual(plain(built.FOOD_LIST), plain(source.FOOD_LIST));
  assert.deepEqual(plain(built.GameRelics.config), plain(source.GameRelics.config));
  assert.deepEqual(plain(built.GameRelics.relics), plain(source.GameRelics.relics));
  for (const saved of [null, {}, {schema: 2, items: {'rare:spoon': 3}, equipped: 'rare:spoon'}]) {
    assert.deepEqual(plain(built.GameRelics.normalize(saved)), plain(source.GameRelics.normalize(saved)));
  }
  assert.deepEqual(plain(built.GameRelicReveal.revealTimings), plain(source.GameRelicReveal.revealTimings));
});

test('protected pack purchases, rolls, equipment effects and diamond rewards match source', () => {
  const source = load(root).GameRelics, built = load(output).GameRelics;
  for (const pack of source.packs) {
    const sourceSave = {diamonds: 1000000, inventory: {Peanut: 1}, relics: source.emptySave()};
    const builtSave = plain(sourceSave);
    for (const roll of [0, 0.5, 0.94, 0.995, 0.999999]) {
      assert.deepEqual(plain(built.buyPack(builtSave, pack.id, false, () => roll)), plain(source.buyPack(sourceSave, pack.id, false, () => roll)));
      assert.deepEqual(plain(builtSave), plain(sourceSave));
    }
  }
  for (const relic of source.relics) {
    assert.deepEqual(plain(built.effectsForKey(relic.key)), plain(source.effectsForKey(relic.key)));
  }
});
