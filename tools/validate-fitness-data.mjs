import { readFile } from 'node:fs/promises';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const fail = message => { throw new Error(message); };

const exercises = await readJson('../data/generated/exercises.json');
const trainingExercises = await readJson('../data/generated/training_exercises.json');
const trainingSummary = await readJson('../data/generated/training_catalog_summary.json');
const activities = await readJson('../data/generated/met_activities.json');
const summary = await readJson('../data/generated/catalog_summary.json');
const reconciliation = await readJson('../data/generated/met_reconciliation.json');
const locations = await readJson('../data/location_profiles.json');
const energy = await readJson('../data/energy_model.json');

if (!Array.isArray(exercises) || exercises.length < 800) fail(`Expected >=800 exercises, found ${exercises.length}`);
if (!Array.isArray(trainingExercises) || trainingExercises.length !== exercises.length) fail('Training catalog must preserve every source exercise');
if (!Array.isArray(activities) || activities.length < 1100) fail(`Expected >=1100 official PDF MET activities, found ${activities.length}`);

const exerciseIds = new Set();
for (const exercise of exercises) {
  if (!exercise.id || !exercise.name) fail('Exercise missing id/name');
  if (exerciseIds.has(exercise.id)) fail(`Duplicate exercise id ${exercise.id}`);
  exerciseIds.add(exercise.id);
  if (!Array.isArray(exercise.primaryMuscles)) fail(`Exercise ${exercise.id} missing primaryMuscles`);
  if (!exercise.equipment || !exercise.movementPattern) fail(`Exercise ${exercise.id} missing normalized equipment/pattern`);
}

const apartmentInventory = new Set(locations.apartmentGym?.equipment || []);
const apartmentMachineKeywords = locations.apartmentGym?.machineExerciseNameKeywords || [];
const trainingIds = new Set();
for (const exercise of trainingExercises) {
  if (!exerciseIds.has(exercise.id)) fail(`Training exercise ${exercise.id} is absent from source catalog`);
  if (trainingIds.has(exercise.id)) fail(`Duplicate training exercise id ${exercise.id}`);
  trainingIds.add(exercise.id);
  if (!Array.isArray(exercise.requiredEquipment) || !Array.isArray(exercise.implicitEquipment)) fail(`Training exercise ${exercise.id} missing equipment resolution`);
  if (!exercise.locationCompatibility || typeof exercise.locationCompatibility.home !== 'boolean') fail(`Training exercise ${exercise.id} missing location compatibility`);
  if (exercise.locationCompatibility.home) {
    const allowed = new Set(locations.home.equipment || []);
    const unavailable = exercise.requiredEquipment.filter(item => !allowed.has(item));
    if (unavailable.length) fail(`Home-compatible exercise ${exercise.id} still requires ${unavailable.join(', ')}`);
  }
  if (exercise.locationCompatibility.apartmentGym) {
    const unavailable = exercise.requiredEquipment.filter(item => !apartmentInventory.has(item));
    if (unavailable.length) fail(`Apartment-compatible exercise ${exercise.id} still requires ${unavailable.join(', ')}`);
    if (exercise.requiredEquipment.includes('machine') && apartmentMachineKeywords.length) {
      const lowerName = exercise.name.toLowerCase();
      if (!apartmentMachineKeywords.some(keyword => lowerName.includes(String(keyword).toLowerCase()))) {
        fail(`Apartment generic-machine filter leaked unverified machine exercise ${exercise.name}`);
      }
    }
  }
}

const pullupLike = trainingExercises.filter(x => /(pull[- ]?ups?|chin[- ]?ups?|hanging)/i.test([x.name, ...(x.instructions || [])].join(' ')));
if (!pullupLike.length) fail('Expected pull-up/hanging exercises for equipment inference test');
if (pullupLike.some(x => x.locationCompatibility.home && !x.requiredEquipment.includes('pullup_bar'))) fail('Pull-up/hanging exercise incorrectly considered apparatus-free at Home');

if (trainingSummary.sourceExerciseCount !== exercises.length || trainingSummary.trainingExerciseCount !== trainingExercises.length) fail('Training summary count mismatch');
if (!(trainingSummary.bodyweightRequiringImplicitApparatus > 0)) fail('Expected at least one bodyweight exercise with inferred apparatus');
if (!(trainingSummary.homeCompatibleCount < trainingSummary.sourceBodyweightCount)) fail('Apparatus resolution should reduce the naive bodyweight Home set');
if (!(trainingSummary.apartmentCompatibleCount > trainingSummary.homeCompatibleCount)) fail('Verified apartment equipment should expand the training catalog beyond Home');
if (!(trainingSummary.apartmentCompatibleMachineCount > 0)) fail('Expected verified apartment machine exercises after capability filtering');

const metCodes = new Set();
for (const activity of activities) {
  if (!/^\d{5}$/.test(activity.code)) fail(`Invalid MET activity code ${activity.code}`);
  if (metCodes.has(activity.code)) fail(`Duplicate MET activity code ${activity.code}`);
  metCodes.add(activity.code);
  if (!(activity.met > 0) || !activity.description) fail(`Invalid MET activity ${activity.code}`);
  if (!activity.sourcePdf || activity.edition !== 2024) fail(`MET activity ${activity.code} lacks canonical PDF provenance`);
}

for (const required of ['02050', '02054', '02056', '02101', '02150', '17190', '17200']) {
  if (!metCodes.has(required)) fail(`Missing required Compendium code ${required}`);
}

if (reconciliation.canonicalSource !== 'official_2024_compendium_pdf') fail('Official PDF is not marked as canonical MET source');
if (reconciliation.officialPdfParsedRows !== activities.length) fail('PDF reconciliation row count does not match canonical catalog');
if (reconciliation.publishedReportedTotal !== 1114) fail('Expected publication-reported total of 1114');
if (reconciliation.publishedHeadingSum !== 1113) fail(`Expected published heading-count sum of 1113, got ${reconciliation.publishedHeadingSum}`);
if (reconciliation.currentWebsiteParsedRows < 1100) fail(`Current website reconciliation unexpectedly low: ${reconciliation.currentWebsiteParsedRows}`);
if (!Array.isArray(reconciliation.pdfOnlyCodes) || !Array.isArray(reconciliation.websiteOnlyCodes)) fail('Reconciliation code-difference arrays missing');
if (!Array.isArray(reconciliation.metMismatches)) fail('Reconciliation MET mismatch array missing');

for (const requiredLocation of ['home', 'apartmentGym', 'fullGym']) {
  if (!locations[requiredLocation]) fail(`Missing location profile ${requiredLocation}`);
}

if (locations.apartmentGym.inventoryStatus !== 'verified_from_photos') fail('Apartment gym must be marked photo-verified after the equipment review');
for (const requiredEquipment of ['cable_machine', 'machine', 'bench', 'pullup_bar', 'dip_station', 'stability_ball']) {
  if (!apartmentInventory.has(requiredEquipment)) fail(`Apartment gym is missing verified equipment ${requiredEquipment}`);
}
if (apartmentInventory.has('dumbbell') || apartmentInventory.has('barbell') || apartmentInventory.has('kettlebell')) {
  fail('Apartment gym must not infer unpictured free weights');
}
if (!Array.isArray(apartmentMachineKeywords) || apartmentMachineKeywords.length < 5) fail('Apartment machine capability filter is missing');
if (!Array.isArray(locations.apartmentGym.verifiedStations) || locations.apartmentGym.verifiedStations.length < 8) fail('Apartment photo inventory is incomplete');

const smithSquat = trainingExercises.find(x => x.name === 'Smith Machine Squat');
if (!smithSquat?.locationCompatibility.apartmentGym) fail('Verified Smith station did not unlock Smith Machine Squat');
const genericLegPress = trainingExercises.find(x => /leg press/i.test(x.name) && x.equipment === 'machine' && !/smith/i.test(x.name));
if (genericLegPress?.locationCompatibility.apartmentGym) fail(`Unpictured generic leg-press machine was incorrectly unlocked: ${genericLegPress.name}`);

if (!energy.formulas?.grossKcal || !energy.formulas?.activeKcal) fail('Energy model formulas missing');
if (summary.counts.exercises !== exercises.length || summary.counts.metActivities !== activities.length) fail('Catalog summary counts do not match generated data');
if (summary.reconciliation?.officialPdfParsedRows !== activities.length) fail('Catalog summary reconciliation count mismatch');

console.log(`Validated ${exercises.length} source exercises and ${trainingExercises.length} apparatus-aware training exercises.`);
console.log(`Home-safe after apparatus resolution: ${trainingSummary.homeCompatibleCount} of ${trainingSummary.sourceBodyweightCount} source bodyweight exercises.`);
console.log(`Apartment-compatible after photo verification: ${trainingSummary.apartmentCompatibleCount}; generic-machine entries: ${trainingSummary.apartmentCompatibleMachineCount}.`);
console.log(`Validated ${activities.length} official-PDF MET activities; website reconciliation rows: ${reconciliation.currentWebsiteParsedRows}.`);
console.log(`PDF-only codes: ${reconciliation.pdfOnlyCodes.length}; website-only codes: ${reconciliation.websiteOnlyCodes.length}; MET mismatches: ${reconciliation.metMismatches.length}.`);
