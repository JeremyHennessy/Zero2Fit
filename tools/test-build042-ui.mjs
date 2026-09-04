import fs from 'node:fs';

const js = fs.readFileSync('build042-daily-guidance.js','utf8');
const core = fs.readFileSync('daily-guidance-core.mjs','utf8');
const css = fs.readFileSync('build042.css','utf8');
const loader = fs.readFileSync('build022-loader.js','utf8');
const sw = fs.readFileSync('sw.js','utf8');

for (const marker of [
  'z42NextAction',
  'z42ActionButton',
  'zero2fit:daily-guidance',
  'zero2fit-fuel-v2',
  'data-workout-mode',
  'z40AddFood',
  'if (intro) intro.after(card);',
  'else if (brief) brief.before(card);'
]) {
  if (!js.includes(marker)) throw new Error(`Build 042 UI missing marker: ${marker}`);
}

for (const marker of [
  'summarizeDay',
  'recommendNextAction',
  'continue_workout',
  'start_move',
  'quick_workout',
  'log_food',
  'recovery_check',
  'day_complete',
  'steps >= 7000'
]) {
  if (!core.includes(marker)) throw new Error(`Build 042 guidance core missing marker: ${marker}`);
}

for (const marker of [
  '.z42-next-action',
  '.z42-status-row',
  '@media(max-width:860px)',
  'grid-template-columns:repeat(2,minmax(0,1fr))'
]) {
  if (!css.includes(marker)) throw new Error(`Build 042 responsive CSS missing marker: ${marker}`);
}

if (!loader.includes("'./build042-daily-guidance.js'")) throw new Error('Build 042 loader wiring missing.');
for (const asset of ["'./build042.css'","'./daily-guidance-core.mjs'","'./build042-daily-guidance.js'"]) {
  if (!sw.includes(asset)) throw new Error(`Build 042 offline shell missing ${asset}.`);
}
if (!sw.includes('zero2fit-shell-v42-daily-guidance')) throw new Error('Build 042 cache version missing.');
if (/calorie target inferred|infer.*calorie target/i.test(js + core)) throw new Error('Build 042 must not infer a nutrition target.');
if (/service_role|sb_secret_/i.test(js + core + css)) throw new Error('Build 042 must not contain privileged credentials.');

console.log('Build 042 daily-guidance UI contract checks passed.');
