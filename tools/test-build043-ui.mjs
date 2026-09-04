import fs from 'node:fs';

const js = fs.readFileSync('build043-usage-measurement.js','utf8');
const core = fs.readFileSync('usage-core.mjs','utf8');
const css = fs.readFileSync('build043.css','utf8');
const loader = fs.readFileSync('build022-loader.js','utf8');
const sw = fs.readFileSync('sw.js','utf8');
const smoke = fs.readFileSync('tools/browser-smoke.sh','utf8');

for (const marker of [
  'zero2fit-usage-v1',
  'z43TuningSignals',
  'zero2fit:daily-guidance',
  'workout_set_completed',
  'workout_set_skipped',
  'workout_substitute_selected',
  'fuel_entry_logged',
  'manual_health_entry',
  'adventure_run',
  'Clear tuning history',
  "link[href=\"./build043.css\"]",
  "const anchor = document.getElementById('z10Intelligence')",
  "|| document.getElementById('z4BodyComposition')",
  "|| page.querySelector('.content-grid')",
  'if (anchor) anchor.after(panel);',
  'else page.appendChild(panel);'
]) {
  if (!js.includes(marker)) throw new Error(`Build 043 runtime missing marker: ${marker}`);
}

if (/;\s*else\s+[^{};\n]+;\s*else\b/.test(js)) throw new Error('Build 043 contains an invalid chained else fallback.');

for (const marker of [
  'sanitizeMetadata',
  'recordUsageEvent',
  'summarizeUsage',
  'deriveFrictionSignals',
  'DEFAULT_RETENTION_DAYS = 90',
  'DEFAULT_MAX_EVENTS = 1600',
  'manual_health_dependency',
  'quick_mode_preference',
  'fuel_abandonment',
  'workout_skip_rate'
]) {
  if (!core.includes(marker)) throw new Error(`Build 043 usage core missing marker: ${marker}`);
}

for (const forbiddenKey of ["'calories'","'protein'","'carbs'","'fat'","'weight'","'heartRate'","'sleep'","'bundleId'","'userId'","'email'"]) {
  const allowedSection = core.slice(core.indexOf('const ALLOWED_METADATA'), core.indexOf('function timestamp'));
  if (allowedSection.includes(forbiddenKey)) throw new Error(`Sensitive metadata key must not be allowed: ${forbiddenKey}`);
}

if (/\bfetch\s*\(|supabase|service_role|sb_secret_/i.test(js)) throw new Error('Build 043 runtime must remain local-only and must not contain privileged/network persistence.');
if (!loader.includes("'./build042-daily-guidance.js',\n    './build043-usage-measurement.js'")) throw new Error('Build 043 must load after Build 042.');
for (const asset of ["'./build043.css'","'./usage-core.mjs'","'./build043-usage-measurement.js'"]) {
  if (!sw.includes(asset)) throw new Error(`Build 043 offline shell missing ${asset}.`);
}
if (!sw.includes('zero2fit-shell-v43-usage-measurement')) throw new Error('Build 043 cache version missing.');
if (!smoke.includes('id=\"z43TuningSignals\"')) throw new Error('Whole-app browser smoke must require Build 043.');
for (const marker of ['.z43-tuning-signals','.z43-stats','@media(max-width:860px)','grid-template-columns:repeat(2,minmax(0,1fr))']) {
  if (!css.includes(marker)) throw new Error(`Build 043 responsive CSS missing marker: ${marker}`);
}

console.log('Build 043 usage-measurement UI contract checks passed.');
