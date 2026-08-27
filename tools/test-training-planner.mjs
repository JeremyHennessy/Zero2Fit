import { readFile } from 'node:fs/promises';
import { generateWorkout, rankCandidates, rankSubstitutes, estimateEnergy, sessionEnergyProfile } from '../training-core.mjs';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const exercises = await readJson('../data/generated/training_exercises.json');
const programmingRules = await readJson('../data/programming_rules.json');
const substitutionRules = await readJson('../data/substitution_rules.json');
const locationProfiles = await readJson('../data/location_profiles.json');
const energyModel = await readJson('../data/energy_model.json');

const fail = message => { throw new Error(message); };
const templates = new Map(programmingRules.templates.map(template => [template.id, template]));

function assertWorkout(locationKey, templateId, mode) {
  const plan = generateWorkout({
    exercises,
    template: templates.get(templateId),
    locationKey,
    mode,
    programmingRules,
    substitutionRules
  });
  const expected = programmingRules.foundationPhase[`${mode}Mode`].slotLimit;
  if (plan.slots.length !== expected) fail(`${locationKey}/${templateId}/${mode}: expected ${expected} slots, got ${plan.slots.length}`);
  const ids = new Set();
  for (const item of plan.slots) {
    if (!item.exercise) continue;
    if (!item.exercise.locationCompatibility[locationKey]) fail(`${locationKey}: selected incompatible ${item.exercise.name}`);
    if (ids.has(item.exercise.id)) fail(`${locationKey}: duplicate exercise ${item.exercise.name}`);
    ids.add(item.exercise.id);
    const inventory = new Set(locationProfiles[locationKey].equipment || []);
    const unavailable = item.exercise.requiredEquipment.filter(requirement => !inventory.has(requirement));
    if (unavailable.length) fail(`${locationKey}: ${item.exercise.name} requires unavailable ${unavailable.join(', ')}`);
  }
  console.log(`\n${locationKey} · ${templateId} · ${mode} · ${plan.targetMinutes} min`);
  for (const item of plan.slots) {
    console.log(`- ${item.slot.intent}: ${item.exercise ? item.exercise.name : 'UNAVAILABLE'} [${item.quality}] equipment=${item.exercise?.requiredEquipment.join('+') || 'none'}`);
  }
  for (const warning of plan.warnings) console.log(`  warning: ${warning}`);
  return plan;
}

const templateA = templates.get('full_body_a');
const templateB = templates.get('full_body_b');
const horizontalPullSlot = templateA.slots.find(slot => slot.intent === 'horizontal_pull');
const latSlot = templateB.slots.find(slot => slot.intent === 'vertical_pull_lats');

for (const [label, slot] of [['horizontal_pull', horizontalPullSlot], ['vertical_pull_lats', latSlot]]) {
  const candidates = rankCandidates(exercises, slot, 'home', { preferSimpleEquipment: true }).slice(0, 15);
  console.log(`\nDIAGNOSTIC top Home ${label} candidates:`);
  for (const item of candidates) {
    console.log(`- ${item.exercise.name} | score=${item.score} | category=${item.exercise.category} | pattern=${item.exercise.movementPattern} | primary=${item.exercise.primaryMuscles.join('+')} | secondary=${item.exercise.secondaryMuscles.join('+')} | equipment=${item.exercise.requiredEquipment.join('+') || 'none'}`);
  }
}

const homeA = assertWorkout('home', 'full_body_a', 'standard');
const homeB = assertWorkout('home', 'full_body_b', 'full');
const fullB = assertWorkout('fullGym', 'full_body_b', 'full');
assertWorkout('apartmentGym', 'full_body_a', 'quick');

const homePull = homeB.slots.find(item => item.slot.intent === 'vertical_pull_lats');
const fullPull = fullB.slots.find(item => item.slot.intent === 'vertical_pull_lats');
if (!fullPull?.exercise?.primaryMuscles.includes('lats') && fullPull?.exercise?.movementPattern !== 'vertical_pull') {
  fail(`Full gym lat slot did not resolve to a lat/vertical-pull exercise: ${fullPull?.exercise?.name}`);
}
if (homePull?.exercise?.requiredEquipment.some(item => !locationProfiles.home.equipment.includes(item))) {
  fail(`Home lat fallback requires unavailable apparatus: ${homePull.exercise.name}`);
}

const substitutes = rankSubstitutes(exercises, fullPull.exercise, fullPull.slot, 'fullGym', substitutionRules).slice(0, 5);
if (substitutes.length < 3) fail('Expected at least 3 full-gym substitutes for the lat slot');
if (substitutes.some(item => !item.exercise.locationCompatibility.fullGym)) fail('Substitute resolver returned unavailable equipment');
console.log('\nTop full-gym lat substitutes:');
for (const item of substitutes) console.log(`- ${item.exercise.name}: ${item.quality} (${item.score})`);

const profile = sessionEnergyProfile({ locationKey: 'fullGym', mode: 'standard', energyModel });
const estimate = estimateEnergy({ met: profile.met, weightLb: 200, durationMinutes: 30 });
if (!estimate || Math.abs(estimate.grossKcal - 158.7573295) > 0.01) fail(`Energy formula mismatch: ${estimate?.grossKcal}`);
console.log(`\nEnergy formula test: 200 lb · 30 min · ${profile.met} MET = ${estimate.grossKcal.toFixed(1)} gross kcal`);

if (locationProfiles.apartmentGym.inventoryStatus !== 'pending_photos') fail('Apartment gym was unexpectedly marked verified');
console.log('\nPlanner integration tests passed.');
