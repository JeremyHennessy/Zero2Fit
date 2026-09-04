import assert from 'node:assert/strict';
import fs from 'node:fs';

const usageCore = fs.readFileSync('usage-core.mjs','utf8');
const sw = fs.readFileSync('sw.js','utf8');

for (const marker of [
  "key:'adventure_combat_wall'",
  "key:'adventure_capability_gate'",
  'progressionRuns >= 4',
  'combatWalls >= 3',
  'combatWallRate || 0) >= 0.5',
  'capabilityGates >= 3',
  'not a prompt to train extra',
  'not a prompt to overtrain',
  'adventureCombatWalls + adventureCapabilityGates + adventureAdvancing'
]) {
  assert.ok(usageCore.includes(marker), `Build 047 usage core missing marker: ${marker}`);
}

// Paused/content-complete outcomes must not enter active progression-run denominator.
const progressionLine = usageCore.match(/const adventureProgressionRuns = ([^;]+);/)?.[1] || '';
assert.match(progressionLine,/adventureCombatWalls/);
assert.match(progressionLine,/adventureCapabilityGates/);
assert.match(progressionLine,/adventureAdvancing/);
assert.doesNotMatch(progressionLine,/paused|content_complete/);

// This build is evidence only: no Adventure engine import or write authority is introduced here.
assert.doesNotMatch(usageCore,/from ['"].*adventure-core/);
assert.doesNotMatch(usageCore,/enemy|boss|gearPower|fitnessXp|permanentXp/i);

assert.match(sw,/zero2fit-shell-v47-adventure-friction/);
assert.match(sw,/zero2fit-shell-v46-tuning-review/);
assert.match(sw,/\.\/usage-core\.mjs/);

console.log('Build 047 Adventure-friction authority checks passed.');
