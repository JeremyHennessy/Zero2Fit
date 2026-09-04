import fs from 'node:fs';

const runtime = fs.readFileSync('build044-training-friction.js','utf8');
const core = fs.readFileSync('usage-core.mjs','utf8');
const loader = fs.readFileSync('build022-loader.js','utf8');
const sw = fs.readFileSync('sw.js','utf8');
const smoke = fs.readFileSync('tools/browser-smoke.sh','utf8');

for (const marker of [
  "const USAGE_STORAGE_KEY = 'zero2fit-usage-v1'",
  'workout_target_edited',
  'workout_rest_override',
  'workout_skips_resumed',
  'workout_session_left',
  'workout_session_resumed',
  "method:'stepper'",
  "method:'manual'",
  "method:'extend'",
  "method:'start_next'",
  "dataset.zero2fitTrainingFriction = 'ready'",
  "new CustomEvent('zero2fit:usage-updated'"
]) {
  if (!runtime.includes(marker)) throw new Error(`Build 044 runtime missing marker: ${marker}`);
}

for (const marker of [
  'targetEdits',
  'targetEditKinds',
  'targetEditMethods',
  'restOverrides',
  'restOverrideMethods',
  'sessionsLeft',
  'sessionsResumed',
  'sessionResumeRate',
  "key:'workout_target_edits'",
  "key:'rest_shortening'",
  "key:'unfinished_sessions'"
]) {
  if (!core.includes(marker)) throw new Error(`Build 044 usage model missing marker: ${marker}`);
}

if (/\bfetch\s*\(|supabase|service_role|sb_secret_/i.test(runtime)) {
  throw new Error('Build 044 must remain local-only and contain no network/private credential path.');
}

// Build 044 is permitted to classify the edited field as load/reps, but it must not
// put input.value or any numeric set target into usage-event metadata.
const recordCalls = [...runtime.matchAll(/record\((['"])workout_target_edited\1,\s*\{([^}]*)\}/gs)].map(match => match[2]);
if (!recordCalls.length) throw new Error('Build 044 target-edit records were not found.');
for (const metadata of recordCalls) {
  if (/\bvalue\b|target\.value|input\.value|loadValue|repValue/i.test(metadata)) {
    throw new Error('Build 044 target-edit metadata must not persist actual load/rep values.');
  }
}

const order = "'./build043-usage-measurement.js',\n    './build044-training-friction.js'";
if (!loader.includes(order)) throw new Error('Build 044 must load after Build 043.');
if (!sw.includes('zero2fit-shell-v44-training-friction')) throw new Error('Build 044 cache lineage missing.');
if (!sw.includes("'./build044-training-friction.js'")) throw new Error('Build 044 runtime missing from offline shell.');
if (!smoke.includes('data-zero2fit-training-friction=\\"ready\\"') && !smoke.includes('data-zero2fit-training-friction="ready"')) {
  throw new Error('Whole-app browser smoke must require Build 044 readiness.');
}

console.log('Build 044 training-friction privacy/wiring contract passed.');
