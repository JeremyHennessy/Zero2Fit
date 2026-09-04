import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path,'utf8');
const loader = read('build022-loader.js');
const runtime = read('build045-fuel-friction.js');
const usageRuntime = read('build043-usage-measurement.js');
const trainingRuntime = read('build044-training-friction.js');
const usageCore = read('usage-core.mjs');
const sw = read('sw.js');
const smoke = read('tools/browser-smoke.sh');
const css = read('build045.css');

const i43 = loader.indexOf('./build043-usage-measurement.js');
const i44 = loader.indexOf('./build044-training-friction.js');
const i45 = loader.indexOf('./build045-fuel-friction.js');
assert.ok(i43 >= 0 && i44 > i43 && i45 > i44, 'Build 045 must load after Builds 043 and 044.');

assert.match(sw, /zero2fit-shell-v45-fuel-friction/);
assert.match(sw, /\.\/build045-fuel-friction\.js/);
assert.match(sw, /\.\/build045\.css/);
assert.ok(smoke.includes('data-zero2fit-fuel-friction="ready"'));
assert.match(smoke, /z45ToggleMeasurement/);
assert.match(css, /z45-tuning-actions/);

for (const source of [runtime,usageRuntime,trainingRuntime]) {
  assert.match(source, /zero2fit-usage-settings-v1/);
  assert.match(source, /measurementEnabled/);
}

assert.match(runtime, /fuel_panel_closed/);
assert.match(runtime, /fuel_lookup_result/);
assert.match(runtime, /outcome:logged \? 'logged' : 'abandoned'/);
assert.match(runtime, /\['success','empty','error'\]/);
assert.match(runtime, /Pause measurement/);
assert.match(runtime, /Resume measurement/);
assert.match(runtime, /Measurement is paused/);
assert.match(runtime, /zero2fitFuelFriction = 'ready'/);

// Build 045 may inspect local Fuel row count only to decide whether the panel completed.
// It must never send tuning events over the network or persist raw food/query/barcode/nutrition values.
assert.doesNotMatch(runtime, /\bfetch\s*\(/);
assert.doesNotMatch(runtime, /supabase/i);
assert.doesNotMatch(runtime, /foodName|mealName|calories|protein|carbs|fat|sourceBundle/i);
assert.doesNotMatch(runtime, /metadata\s*:\s*\{[^}]*query/s);
assert.doesNotMatch(runtime, /metadata\s*:\s*\{[^}]*barcode/s);
assert.doesNotMatch(runtime, /record\([^\n]*input\.value/s);

assert.match(usageCore, /fuel_panel_abandonment/);
assert.match(usageCore, /fuel_lookup_friction/);
assert.match(usageCore, /fuel_manual_reliance/);
assert.match(usageCore, /fuel_panel_closed/);
assert.match(usageCore, /fuel_lookup_result/);

const allowList = usageCore.match(/const ALLOWED_METADATA = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
for (const forbidden of ['foodName','calories','weight','sourceBundle','query','barcode','protein','carbs','fat']) {
  assert.ok(!allowList.includes(`'${forbidden}'`), `Sensitive field ${forbidden} must not enter usage metadata allow-list.`);
}

console.log('Build 045 Fuel-friction privacy/wiring checks passed.');
