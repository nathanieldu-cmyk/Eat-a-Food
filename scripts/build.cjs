const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const JavaScriptObfuscator = require('javascript-obfuscator');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\s+src="([^"?]+)(?:\?[^\"]*)?"\s*><\/script>/g)].map(match => match[1]);
if (!scripts.includes('game.js') || new Set(scripts).size !== scripts.length) {
  throw new Error('Expected one copy of each game script in index.html');
}
fs.rmSync(output, {recursive: true, force: true});
fs.mkdirSync(output, {recursive: true});

// Ship only runtime files. Never copy the project root, source maps, tests or tools.
for (const name of ['index.html', 'style.css', 'relic-art.svg', 'relic-pack.svg', 'secret-pack.svg', 'weather-event.json', 'giveaway-event.json']) {
  fs.copyFileSync(path.join(root, name), path.join(output, name));
}
function copyAssets(directory, extensions) {
  const source = path.join(root, directory);
  for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) copyAssets(relative, extensions);
    else if (extensions.has(path.extname(entry.name))) {
      fs.mkdirSync(path.dirname(path.join(output, relative)), {recursive: true});
      fs.copyFileSync(path.join(root, relative), path.join(output, relative));
    }
  }
}
copyAssets('models', new Set(['.glb']));
copyAssets('audio', new Set(['.mp3', '.ogg', '.wav', '.txt']));
copyAssets('vendor', new Set(['.js']));

for (const filename of scripts) {
  if (!/^[a-z][a-z0-9-]*\.js$/.test(filename)) throw new Error(`Unexpected script: ${filename}`);
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  // Avoid control-flow inflation and debugger traps in an animation-heavy game.
  // Preserve property names shared by modules, DOM APIs and existing player saves.
  const result = JavaScriptObfuscator.obfuscate(source, {
    target: 'browser-no-eval',
    compact: true,
    identifierNamesGenerator: 'hexadecimal',
    identifiersPrefix: `_${filename.replace(/\W/g, '_')}_`,
    renameGlobals: false,
    renameProperties: false,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    selfDefending: false,
    simplify: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.8,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    sourceMap: false,
    seed: createHash('sha256').update(source).digest().readUInt32BE(0) || 1,
  }).getObfuscatedCode();
  new vm.Script(result, {filename});
  fs.writeFileSync(path.join(output, filename), result + '\n');
  console.log(`Protected ${filename}`);
}
console.log('Production files ready in dist/ (no readable game source or source maps).');
