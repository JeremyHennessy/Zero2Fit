import fs from 'node:fs';

const js = fs.readFileSync('build036-ui-overhaul.js','utf8');
const css = fs.readFileSync('build036.css','utf8');
const loader = fs.readFileSync('build022-loader.js','utf8');
const sw = fs.readFileSync('sw.js','utf8');

const requiredJs = [
  'z36EnhanceToday',
  'z36EnhanceTrain',
  'z36EnhanceFuel',
  'z36EnhanceAdventure',
  'z36EnhanceProgress',
  'z36EnhanceDevices',
  'z36SetFuelSheet',
  'z36EnhanceSaveFeedback',
  "document.body.classList.add('z36-ui')"
];
for (const marker of requiredJs) {
  if (!js.includes(marker)) throw new Error(`Build 036 missing UI marker: ${marker}`);
}

const requiredCss = [
  'body.z36-ui',
  '.z36-sheet-backdrop',
  '.z36-nav-icon svg',
  '#page-today .z36-today-overview',
  '#page-train .z36-focus',
  '#page-nutrition .z36-food-log',
  '#page-character .z36-adventure-hero',
  '#page-journey .z36-progress-hero',
  '#page-data .z36-device-list',
  '@media (max-width:820px)'
];
for (const marker of requiredCss) {
  if (!css.includes(marker)) throw new Error(`Build 036 missing CSS marker: ${marker}`);
}

if (!loader.includes("'./build036-ui-overhaul.js'")) throw new Error('Build 036 loader wiring missing.');
if (!sw.includes("'./build036.css'") || !sw.includes("'./build036-ui-overhaul.js'")) throw new Error('Build 036 offline assets missing.');
if (!sw.includes("zero2fit-shell-v36-modern-ui")) throw new Error('Build 036 cache version missing.');
if (/service_role|sb_secret_/i.test(js + css)) throw new Error('Build 036 UI must not contain privileged credentials.');

console.log('Build 036 modern UI contract checks passed.');
