import fs from 'node:fs';

const js = fs.readFileSync('build040-blue-orange-ui.js','utf8');
const cssBase = fs.readFileSync('build040.css','utf8');
const cssPages = fs.readFileSync('build040-pages.css','utf8');
const cssMobile = fs.readFileSync('build040-mobile.css','utf8');
const css = cssBase + '\n' + cssPages + '\n' + cssMobile;
const loader = fs.readFileSync('build022-loader.js','utf8');
const sw = fs.readFileSync('sw.js','utf8');

const requiredJs = [
  'z40Today',
  'z40Train',
  'z40Fuel',
  'z40Adventure',
  'z40Progress',
  'z40Devices',
  'z40SetFuelPanel',
  'z40FuelSheet',
  'z40TrainStage',
  'DAILY BRIEF',
  'Trust the source before the score',
  "document.body.classList.add('z40-rebuild')",
  "window.matchMedia('(min-width:861px)').matches",
  'foodCard.scrollTop = 0',
  'Devices are available from the main navigation and Settings.'
];
for (const marker of requiredJs) {
  if (!js.includes(marker)) throw new Error(`Build 040 missing UI marker: ${marker}`);
}

const requiredCss = [
  'body.z40-rebuild',
  '--z40-blue:#1e66e8',
  '--z40-orange:#f47a22',
  '--z40-bg:#f6f8fc',
  '-webkit-text-size-adjust:100%',
  '.nav-item>span:last-child{width:auto!important',
  'grid-template-columns:repeat(6,1fr)!important',
  '.nav-item[data-page="data"]{display:flex!important;order:6!important',
  '.z40-settings #resetDemo.z12-reset-action{width:100%!important',
  'body.z40-rebuild .z40-health-row{grid-template-columns:repeat(2,minmax(0,1fr))!important',
  'body.z40-rebuild .z40-today-grid{display:block!important;grid-template-columns:minmax(0,1fr)!important',
  'body.z40-rebuild .z40-exercise-list{grid-template-columns:minmax(0,1fr)!important',
  'body.z40-rebuild .z40-progress .content-grid{display:block!important;grid-template-columns:minmax(0,1fr)!important',
  '.z40-day-brief',
  '.z40-train-stage',
  '.z40-food-panel',
  '.z40-adventure',
  '.z40-progress-tabs',
  '.z40-device-list',
  '@media(max-width:860px)'
];
for (const marker of requiredCss) {
  if (!css.includes(marker)) throw new Error(`Build 040 missing CSS marker: ${marker}`);
}

const styleMarkers = ["'./build040.css'","'./build040-pages.css'","'./build040-mobile.css'"];
const stylePositions = styleMarkers.map(marker => js.indexOf(marker));
if (stylePositions.some(position => position < 0) || !(stylePositions[0] < stylePositions[1] && stylePositions[1] < stylePositions[2])) {
  throw new Error('Build 040 styles must load base → page → mobile so responsive overrides win the cascade.');
}
if (/^\s*@import/m.test(cssBase)) throw new Error('Build 040 base stylesheet must not pre-import page/mobile layers ahead of base rules.');

if (!loader.includes("'./build040-blue-orange-ui.js'")) throw new Error('Build 040 loader wiring missing.');
if (loader.includes("'./build038-product-rebuild.js'")) throw new Error('Build 040 must replace, not stack on, the Build 038 composition layer.');
if (!sw.includes("'./build040.css'") || !sw.includes("'./build040-pages.css'") || !sw.includes("'./build040-mobile.css'") || !sw.includes("'./build040-blue-orange-ui.js'")) throw new Error('Build 040 offline assets missing.');
if (!sw.includes('zero2fit-shell-v40-blue-orange-ui')) throw new Error('Build 040 cache lineage marker missing.');
if (sw.includes("'./build038.css'") || sw.includes("'./build038-product-rebuild.js'")) throw new Error('Build 038 visual assets must not remain in the active offline shell.');

if (!/\.sidebar\s*\{[\s\S]*?background:rgba\(255,255,255/.test(css)) throw new Error('Desktop shell must use a light header rather than the previous dark rail.');
if (!/\.z40-adventure[\s\S]*?color:var\(--z40-ink\)/.test(css)) throw new Error('Adventure must stay in the new light visual system.');
if (/service_role|sb_secret_/i.test(js + css)) throw new Error('Build 040 UI must not contain privileged credentials.');

console.log('Build 040 clean blue/orange UI contract checks passed.');
