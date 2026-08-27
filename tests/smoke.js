'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadBrowserModule(path) {
  const context = { window: {}, console, Date, Map, Number, String, Math, Array, Object, JSON, Set, Error };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
  return context.window;
}

const exerciseWindow = loadBrowserModule('data/exercises.js');
const catalog = exerciseWindow.Zero2FitExercises;
assert.ok(catalog, 'exercise module should expose Zero2FitExercises');
assert.ok(catalog.exercises.length >= 25, 'exercise catalog should contain a useful initial library');

const homeWorkout = catalog.buildWorkout('foundation-a', 'home', 'full');
assert.equal(homeWorkout.selections.length, 5);
assert.ok(homeWorkout.selections.every(slot => slot.selected), 'home workout should resolve every Foundation A movement');
const homeProfile = catalog.equipmentProfiles.home;
assert.ok(homeWorkout.selections.every(slot => slot.selected.requiredEquipment.every(item => homeProfile.equipment.includes(item))), 'home workout must not require unavailable equipment');

const apartmentWorkout = catalog.buildWorkout('foundation-a', 'apartment', 'standard');
const apartmentProfile = catalog.equipmentProfiles.apartment;
assert.ok(apartmentWorkout.selections.every(slot => slot.selected.requiredEquipment.every(item => apartmentProfile.equipment.includes(item))), 'apartment workout must not assume uninventoried equipment');

const gymPullChoices = catalog.choicesForMovement('vertical_pull', 'gym');
assert.ok(gymPullChoices.some(exercise => exercise.id === 'lat-pulldown'), 'full gym vertical pull should include lat pulldown');

const ingestionWindow = loadBrowserModule('ingestion.js');
const ingestion = ingestionWindow.Zero2FitIngestion;
assert.ok(ingestion, 'ingestion module should expose Zero2FitIngestion');

const renphoCsv = [
  'Time of Measurement,Weight(lb),BMI,Body Fat(%),Muscle Mass(lb),Body Water(%)',
  '2026-08-27 08:00:00,238.4,29.8,27.1,164.2,53.4'
].join('\n');
const parsed = ingestion.parseRenphoCsv(renphoCsv, 'renpho-test.csv');
assert.equal(parsed.events.length, 5, 'representative RENPHO row should normalize five supported fields');
const weight = parsed.events.find(event => event.metric_type === 'weight');
assert.equal(weight.value, 238.4);
assert.equal(weight.unit, 'lb');
assert.equal(weight.confidence, 'measured');
const bodyFat = parsed.events.find(event => event.metric_type === 'body_fat_percentage');
assert.equal(bodyFat.confidence, 'trend_estimate');

const bridge = ingestion.normalizeBundle({
  source_provider: 'healthkit_bridge',
  events: [{
    metric_type: 'steps', value: 7000, unit: 'count', observed_at: '2026-08-27T12:00:00-03:00',
    source_provider: 'healthkit_bridge', provenance_status: 'imported', confidence: 'measured', metadata: { aggregation: 'daily_total' }
  }]
});
assert.equal(bridge.events.length, 1);
assert.equal(bridge.events[0].metadata.aggregation, 'daily_total');

console.log(`Zero2Fit smoke checks passed: ${catalog.exercises.length} exercises, ${parsed.events.length} RENPHO fields normalized.`);
