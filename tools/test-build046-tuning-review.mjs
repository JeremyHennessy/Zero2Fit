import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path,'utf8');
const runtime = read('build043-usage-measurement.js');
const css = read('build046.css');
const sw = read('sw.js');
const smoke = read('tools/browser-smoke.sh');

assert.match(runtime, /DEFAULT_VISIBLE_SIGNALS = 3/);
assert.match(runtime, /showAllSignals/);
assert.match(runtime, /summary\.signals\.slice\(0, DEFAULT_VISIBLE_SIGNALS\)/);
assert.match(runtime, /Showing all \$\{signals\.length\} signals/);
assert.match(runtime, /Showing \$\{DEFAULT_VISIBLE_SIGNALS\} of \$\{signals\.length\} signals/);
assert.match(runtime, /Show top 3/);
assert.match(runtime, /Show all \$\{signals\.length\}/);
assert.match(runtime, /aria-expanded/);
assert.match(runtime, /zero2fitTuningReview = 'ready'/);
assert.match(runtime, /qaTuning/);

// Review changes visibility only. Signal derivation remains in usage-core and is not reordered here.
assert.doesNotMatch(runtime, /summary\.signals\.sort\s*\(/);
assert.doesNotMatch(runtime, /summary\.signals\.reverse\s*\(/);

assert.match(css, /z46-signal-review/);
assert.match(css, /min-height:40px/);
assert.match(sw, /zero2fit-shell-v46-tuning-review/);
assert.match(sw, /\.\/build046\.css/);
assert.ok(smoke.includes('data-zero2fit-tuning-review="ready"'));
assert.match(smoke, /z46SignalToggle/);
assert.match(smoke, /build046\.css/);

console.log('Build 046 tuning-review contract checks passed.');
