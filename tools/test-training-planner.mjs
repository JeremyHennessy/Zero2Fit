import { readFile } from 'node:fs/promises';
import { generateWorkout, rankSubstitutes, estimateEnergy, sessionEnergyProfile } from '../training-core.mjs';

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
    if (!item.exercise) {
      if (item.quality !== 'unavailable' || !item.unavailableReason) fail(`${locationKey}: unavailable slot missing reason for ${item.slot.intent}`);
      continue;
    }
    if (item.exercise.category !== 'strength') fail(`${locationKey}: strength template selected non-strength exercise ${item.exercise.name}`);
    if (!['direct_substitute', 'good_substitute'].includes(item.quality)) fail(`${locationKey}: weak automatic match ${item.exercise.name} (${item.quality})`);
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

const homeA = assertWorkout('home', 'full_body_a', 'standard');
const homeB = assertWorkout('home', 'full_body_b', 'full');
const fullB = assertWorkout('fullGym', 'full_body_b', 'full');
const apartmentQuick = assertWorkout('apartmentGym', 'full_body_a', 'quick');

const homeHorizontalPull = homeA.slots.find(item => item.slot.intent === 'horizontal_pull');
const homeLatPull = homeB.slots.find(item => item.slot.intent === 'vertical_pull_lats');
const apartmentHorizontalPull = apartmentQuick.slots.find(item => item.slot.intent === 'horizontal_pull');
if (homeHorizontalPull?.exercise || homeHorizontalPull?.quality !== 'unavailable') fail('Home horizontal-pull slot must be unavailable with confirmed mat-only equipment');
if (homeLatPull?.exercise || homeLatPull?.quality !== 'unavailable') fail('Home lat-pull slot must be unavailable with confirmed mat-only equipment');
if (apartmentHorizontalPull?.exercise || apartmentHorizontalPull?.quality !== 'unavailable') fail('Apartment Gym must inherit the conservative Home pull limitation until equipment photos are verified');
if (!homeLatPull?.fallback || homeLatPull.fallback.quality === 'direct_substitute' || homeLatPull.fallback.quality === 'good_substitute') fail('Home lat slot should retain only an explicitly weak informational fallback');

const chairStretch = exercises.find(exercise => exercise.name === 'Chair Lower Back Stretch');
if (chairStretch && !chairStretch.requiredEquipment.includes('chair')) fail('Chair Lower Back Stretch must resolve a chair requirement');
if (chairStretch?.locationCompatibility.home) fail('Chair Lower Back Stretch must not be Home-compatible when no chair is assumed');

const fullPull = fullB.slots.find(item => item.slot.intent === 'vertical_pull_lats');
if (!fullPull?.exercise) fail('Full gym lat slot unexpectedly unavailable');
if (!fullPull.exercise.primaryMuscles.includes('lats') && fullPull.exercise.movementPattern !== 'vertical_pull') {
  fail(`Full gym lat slot did not resolve to a lat/vertical-pull exercise: ${fullPull.exercise.name}`);
}

const substitutes = rankSubstitutes(exercises, fullPull.exercise, fullPull.slot, 'fullGym', substitutionRules).slice(0, 5);
if (substitutes.length < 3) fail('Expected at least 3 full-gym substitutes for the lat slot');
if (substitutes.some(item => !item.exercise.locationCompatibility.fullGym)) fail('Substitute resolver returned unavailable equipment');
if (substitutes.some(item => item.exercise.category !== fullPull.exercise.category)) fail('Strength substitute resolver returned a non-strength exercise');
console.log('\nTop full-gym lat substitutes:');
for (const item of substitutes) console.log(`- ${item.exercise.name}: ${item.quality} (${item.score})`);

const profile = sessionEnergyProfile({ locationKey: 'fullGym', mode: 'standard', energyModel });
const estimate = estimateEnergy({ met: profile.met, weightLb: 200, durationMinutes: 30 });
if (!estimate || Math.abs(estimate.grossKcal - 158.7573295) > 0.01) fail(`Energy formula mismatch: ${estimate?.grossKcal}`);
console.log(`\nEnergy formula test: 200 lb · 30 min · ${profile.met} MET = ${estimate.grossKcal.toFixed(1)} gross kcal`);

if (locationProfiles.apartmentGym.inventoryStatus !== 'pending_photos') fail('Apartment gym was unexpectedly marked verified');
console.log('\nPlanner integration tests passed.');
