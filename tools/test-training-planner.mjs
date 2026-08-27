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
const apartmentA = assertWorkout('apartmentGym', 'full_body_a', 'standard');
const apartmentB = assertWorkout('apartmentGym', 'full_body_b', 'full');
const fullB = assertWorkout('fullGym', 'full_body_b', 'full');

const homeHorizontalPull = homeA.slots.find(item => item.slot.intent === 'horizontal_pull');
const homeLatPull = homeB.slots.find(item => item.slot.intent === 'vertical_pull_lats');
if (homeHorizontalPull?.exercise || homeHorizontalPull?.quality !== 'unavailable') fail('Home horizontal-pull slot must remain unavailable with confirmed mat-only equipment');
if (homeLatPull?.exercise || homeLatPull?.quality !== 'unavailable') fail('Home lat-pull slot must remain unavailable with confirmed mat-only equipment');
if (!homeLatPull?.fallback || homeLatPull.fallback.quality === 'direct_substitute' || homeLatPull.fallback.quality === 'good_substitute') fail('Home lat slot should retain only an explicitly weak informational fallback');

const apartmentHorizontalPull = apartmentA.slots.find(item => item.slot.intent === 'horizontal_pull');
const apartmentLatPull = apartmentB.slots.find(item => item.slot.intent === 'vertical_pull_lats');
if (!apartmentHorizontalPull?.exercise) fail('Photo-verified Apartment Gym horizontal pull is unexpectedly unavailable');
if (!apartmentLatPull?.exercise) fail('Photo-verified Apartment Gym lat pull is unexpectedly unavailable');
if (!['direct_substitute', 'good_substitute'].includes(apartmentHorizontalPull.quality)) fail(`Apartment horizontal pull is too weak: ${apartmentHorizontalPull.quality}`);
if (!['direct_substitute', 'good_substitute'].includes(apartmentLatPull.quality)) fail(`Apartment lat pull is too weak: ${apartmentLatPull.quality}`);
if (!apartmentHorizontalPull.exercise.primaryMuscles.some(muscle => ['middle back', 'lats', 'traps'].includes(muscle)) && apartmentHorizontalPull.exercise.movementPattern !== 'horizontal_pull') {
  fail(`Apartment horizontal pull did not resolve to a true back/pull exercise: ${apartmentHorizontalPull.exercise.name}`);
}
if (!apartmentLatPull.exercise.primaryMuscles.includes('lats') && apartmentLatPull.exercise.movementPattern !== 'vertical_pull') {
  fail(`Apartment lat slot did not resolve to a lat/vertical-pull exercise: ${apartmentLatPull.exercise.name}`);
}

const chairStretch = exercises.find(exercise => exercise.name === 'Chair Lower Back Stretch');
if (chairStretch && !chairStretch.requiredEquipment.includes('chair')) fail('Chair Lower Back Stretch must resolve a chair requirement');
if (chairStretch?.locationCompatibility.home) fail('Chair Lower Back Stretch must not be Home-compatible when no chair is assumed');

const fullPull = fullB.slots.find(item => item.slot.intent === 'vertical_pull_lats');
if (!fullPull?.exercise) fail('Full gym lat slot unexpectedly unavailable');
if (!fullPull.exercise.primaryMuscles.includes('lats') && fullPull.exercise.movementPattern !== 'vertical_pull') {
  fail(`Full gym lat slot did not resolve to a lat/vertical-pull exercise: ${fullPull.exercise.name}`);
}

const fullSubstitutes = rankSubstitutes(exercises, fullPull.exercise, fullPull.slot, 'fullGym', substitutionRules).slice(0, 5);
if (fullSubstitutes.length < 3) fail('Expected at least 3 full-gym substitutes for the lat slot');
if (fullSubstitutes.some(item => !item.exercise.locationCompatibility.fullGym)) fail('Full-gym substitute resolver returned unavailable equipment');
if (fullSubstitutes.some(item => item.exercise.category !== fullPull.exercise.category)) fail('Strength substitute resolver returned a non-strength exercise');
console.log('\nTop full-gym lat substitutes:');
for (const item of fullSubstitutes) console.log(`- ${item.exercise.name}: ${item.quality} (${item.score})`);

const apartmentSubstitutes = rankSubstitutes(exercises, apartmentLatPull.exercise, apartmentLatPull.slot, 'apartmentGym', substitutionRules)
  .filter(item => ['direct_substitute', 'good_substitute'].includes(item.quality))
  .slice(0, 5);
if (apartmentSubstitutes.length < 2) fail('Expected at least 2 good-or-better Apartment Gym substitutes for the lat slot');
if (apartmentSubstitutes.some(item => !item.exercise.locationCompatibility.apartmentGym)) fail('Apartment substitute resolver returned unavailable equipment');
console.log('\nTop Apartment Gym lat substitutes:');
for (const item of apartmentSubstitutes) console.log(`- ${item.exercise.name}: ${item.quality} (${item.score}) equipment=${item.exercise.requiredEquipment.join('+') || 'none'}`);

const fullProfile = sessionEnergyProfile({ locationKey: 'fullGym', mode: 'standard', energyModel });
const fullEstimate = estimateEnergy({ met: fullProfile.met, weightLb: 200, durationMinutes: 30 });
if (!fullEstimate || Math.abs(fullEstimate.grossKcal - 158.7573295) > 0.01) fail(`Energy formula mismatch: ${fullEstimate?.grossKcal}`);

const apartmentProfile = sessionEnergyProfile({ locationKey: 'apartmentGym', mode: 'standard', energyModel });
if (apartmentProfile.code !== (energyModel.referenceProfiles.resistance_general?.code || '02054')) fail(`Apartment Gym should use general resistance-training energy profile, got ${apartmentProfile.code}`);
const apartmentEstimate = estimateEnergy({ met: apartmentProfile.met, weightLb: 200, durationMinutes: 30 });
if (!apartmentEstimate || apartmentEstimate.grossKcal <= 0) fail('Apartment Gym energy estimate missing');
console.log(`\nEnergy formula test: 200 lb · 30 min · ${apartmentProfile.met} MET = ${apartmentEstimate.grossKcal.toFixed(1)} gross kcal`);

if (locationProfiles.apartmentGym.inventoryStatus !== 'verified_from_photos') fail('Apartment gym photo verification status missing');
console.log('\nPlanner integration tests passed.');
