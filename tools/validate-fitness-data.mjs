import { readFile } from 'node:fs/promises';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const fail = message => { throw new Error(message); };

const exercises = await readJson('../data/generated/exercises.json');
const activities = await readJson('../data/generated/met_activities.json');
const summary = await readJson('../data/generated/catalog_summary.json');
const locations = await readJson('../data/location_profiles.json');
const energy = await readJson('../data/energy_model.json');

if (!Array.isArray(exercises) || exercises.length < 800) fail(`Expected >=800 exercises, found ${exercises.length}`);
if (!Array.isArray(activities) || activities.length < 1000) fail(`Expected >=1000 MET activities, found ${activities.length}`);

const exerciseIds = new Set();
for (const exercise of exercises) {
  if (!exercise.id || !exercise.name) fail('Exercise missing id/name');
  if (exerciseIds.has(exercise.id)) fail(`Duplicate exercise id ${exercise.id}`);
  exerciseIds.add(exercise.id);
  if (!Array.isArray(exercise.primaryMuscles)) fail(`Exercise ${exercise.id} missing primaryMuscles`);
  if (!exercise.equipment || !exercise.movementPattern) fail(`Exercise ${exercise.id} missing normalized equipment/pattern`);
  if (!exercise.locationCompatibility || typeof exercise.locationCompatibility.home !== 'boolean') fail(`Exercise ${exercise.id} missing location compatibility`);
}

const metCodes = new Set();
for (const activity of activities) {
  if (!/^\d{5}$/.test(activity.code)) fail(`Invalid MET activity code ${activity.code}`);
  if (metCodes.has(activity.code)) fail(`Duplicate MET activity code ${activity.code}`);
  metCodes.add(activity.code);
  if (!(activity.met > 0) || !activity.description) fail(`Invalid MET activity ${activity.code}`);
}

for (const required of ['02054', '02056', '02101', '02150', '17190', '17200']) {
  if (!metCodes.has(required)) fail(`Missing required Compendium code ${required}`);
}

for (const requiredLocation of ['home', 'apartmentGym', 'fullGym']) {
  if (!locations[requiredLocation]) fail(`Missing location profile ${requiredLocation}`);
}

if (locations.apartmentGym.inventoryStatus !== 'pending_photos') fail('Apartment gym must remain pending until photo inventory is verified');
if (!energy.formulas?.grossKcal || !energy.formulas?.activeKcal) fail('Energy model formulas missing');
if (summary.counts.exercises !== exercises.length || summary.counts.metActivities !== activities.length) fail('Catalog summary counts do not match generated data');

console.log(`Validated ${exercises.length} exercises and ${activities.length} MET activities.`);
console.log(`Home-compatible exercises: ${summary.counts.homeCompatibleExercises}`);
