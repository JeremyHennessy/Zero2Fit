import { readFile } from 'node:fs/promises';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const fail = message => { throw new Error(message); };

const exercises = await readJson('../data/generated/exercises.json');
const activities = await readJson('../data/generated/met_activities.json');
const summary = await readJson('../data/generated/catalog_summary.json');
const reconciliation = await readJson('../data/generated/met_reconciliation.json');
const locations = await readJson('../data/location_profiles.json');
const energy = await readJson('../data/energy_model.json');

if (!Array.isArray(exercises) || exercises.length < 800) fail(`Expected >=800 exercises, found ${exercises.length}`);
if (!Array.isArray(activities) || activities.length < 1100) fail(`Expected >=1100 official PDF MET activities, found ${activities.length}`);

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
  if (!activity.sourcePdf || activity.edition !== 2024) fail(`MET activity ${activity.code} lacks canonical PDF provenance`);
}

for (const required of ['02054', '02056', '02101', '02150', '17190', '17200']) {
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

if (locations.apartmentGym.inventoryStatus !== 'pending_photos') fail('Apartment gym must remain pending until photo inventory is verified');
if (!energy.formulas?.grossKcal || !energy.formulas?.activeKcal) fail('Energy model formulas missing');
if (summary.counts.exercises !== exercises.length || summary.counts.metActivities !== activities.length) fail('Catalog summary counts do not match generated data');
if (summary.reconciliation?.officialPdfParsedRows !== activities.length) fail('Catalog summary reconciliation count mismatch');

console.log(`Validated ${exercises.length} exercises and ${activities.length} official-PDF MET activities.`);
console.log(`Website reconciliation rows: ${reconciliation.currentWebsiteParsedRows}`);
console.log(`PDF-only codes: ${reconciliation.pdfOnlyCodes.length}; website-only codes: ${reconciliation.websiteOnlyCodes.length}; MET mismatches: ${reconciliation.metMismatches.length}`);
console.log(`Home-compatible exercises: ${summary.counts.homeCompatibleExercises}`);
