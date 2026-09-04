import fs from 'node:fs';

const js = fs.readFileSync('build038-product-rebuild.js','utf8');
const css = fs.readFileSync('build038.css','utf8');
const loader = fs.readFileSync('build022-loader.js','utf8');
const sw = fs.readFileSync('sw.js','utf8');

const requiredJs = [
  'z38Today',
  'z38Train',
  'z38Fuel',
  'z38Adventure',
  'z38Progress',
  'z38Devices',
  'z38SetFuelSheet',
  'z38FuelSheet',
  'z38-train-stage',
  'z38FuelSheet',
  'Your health stack',
  'Match your real sources',
  "document.body.classList.add('z38-rebuild')"
];
for (const marker of requiredJs) {
  if (!js.includes(marker)) throw new Error(`Build 038 missing UI marker: ${marker}`);
}

const requiredCss = [
  'body.z38-rebuild',
  '.z38-today-hero',
  '.z38-health-strip',
  '.z38-train-stage',
  '.z38-sheet-backdrop',
  '.z38-adventure',
  '.z38-progress-tabs',
  '.z38-device-stack',
  '@media (max-width:820px)'
];
for (const marker of requiredCss) {
  if (!css.includes(marker)) throw new Error(`Build 038 missing CSS marker: ${marker}`);
}

if (!loader.includes("'./build038-product-rebuild.js'")) throw new Error('Build 038 loader wiring missing.');
if (loader.includes("'./build036-ui-overhaul.js'")) throw new Error('Build 038 must replace, not stack on, Build 036 UI composition.');
if (!sw.includes("'./build038.css'") || !sw.includes("'./build038-product-rebuild.js'")) throw new Error('Build 038 offline assets missing.');
if (!sw.includes('zero2fit-shell-v38-product-rebuild')) throw new Error('Build 038 cache version missing.');
if (/service_role|sb_secret_/i.test(js + css)) throw new Error('Build 038 UI must not contain privileged credentials.');

console.log('Build 038 product-shell contract checks passed.');
