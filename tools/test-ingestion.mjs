import assert from 'node:assert/strict';
import { parseAppleHealthXmlText, parseRenphoCsvText, summarizeImport, mergeMeasurements } from '../ingestion-core.mjs';

const apple = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Zepp" unit="count" creationDate="2026-08-27 08:00:00 -0300" startDate="2026-08-27 07:00:00 -0300" endDate="2026-08-27 08:00:00 -0300" value="1432"/>
<Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Amazfit Active 2" unit="count/min" startDate="2026-08-27 08:01:00 -0300" endDate="2026-08-27 08:01:00 -0300" value="71"/>
<Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Zepp" unit="%" startDate="2026-08-27 08:02:00 -0300" endDate="2026-08-27 08:02:00 -0300" value="0.97"/>
<Record type="HKQuantityTypeIdentifierBodyMass" sourceName="RENPHO Health" unit="kg" startDate="2026-08-27 08:03:00 -0300" endDate="2026-08-27 08:03:00 -0300" value="108.4"/>
<Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="42" durationUnit="min" totalDistance="0" totalDistanceUnit="km" totalEnergyBurned="312" totalEnergyBurnedUnit="kcal" sourceName="Zepp" startDate="2026-08-27 09:00:00 -0300" endDate="2026-08-27 09:42:00 -0300"/>
</HealthData>`;

const parsedApple = parseAppleHealthXmlText(apple);
assert.equal(parsedApple.measurements.length, 4);
assert.equal(parsedApple.workouts.length, 1);
assert.equal(parsedApple.measurements.find(item => item.metric === 'steps').source.family, 'amazfit_zepp');
assert.equal(parsedApple.measurements.find(item => item.metric === 'body_mass').source.family, 'renpho');
assert.equal(parsedApple.measurements.find(item => item.metric === 'oxygen_saturation').value, 97);
assert.equal(parsedApple.workouts[0].durationSeconds, 2520);
assert.equal(parsedApple.workouts[0].workoutType, 'Traditional Strength Training');

const renpho = `Time,Weight (lb),BMI,Body Fat %,Fat-Free Body Weight (lb),Subcutaneous Fat %,Visceral Fat,Body Water %,Skeletal Muscle %,Muscle Mass (lb),Bone Mass (lb),Protein %,BMR,Metabolic Age\n2026-08-27 07:30:00,239.0,29.9,28.5,170.9,24.8,12,51.9,44.0,162.1,8.5,16.4,2050,42\n`;
const parsedRenpho = parseRenphoCsvText(renpho, { device: 'RENPHO ES-CS20M (unverified)' });
const summary = summarizeImport(parsedRenpho);
assert.equal(summary.metricCounts.body_mass, 1);
assert.equal(summary.metricCounts.body_fat_percentage, 1);
assert.equal(parsedRenpho.measurements.find(item => item.metric === 'body_mass').unit, 'kg');
assert.ok(Math.abs(parsedRenpho.measurements.find(item => item.metric === 'body_mass').value - 108.4086) < 0.001);
assert.equal(parsedRenpho.measurements.find(item => item.metric === 'bmi').quality, 'derived');
assert.equal(parsedRenpho.measurements.find(item => item.metric === 'muscle_mass').quality, 'estimated');

const duplicateApple = parseAppleHealthXmlText(apple);
const merged = mergeMeasurements(parsedApple.measurements, duplicateApple.measurements);
assert.equal(merged.length, parsedApple.measurements.length, 're-import must be idempotent');

const missingDate = parseRenphoCsvText('Weight (lb),BMI\n239,29.9\n');
assert.equal(missingDate.measurements.length, 0);
assert.ok(missingDate.warnings.some(item => item.includes('date/time')));

console.log(`Ingestion tests passed: ${parsedApple.measurements.length} Apple measurements, ${parsedApple.workouts.length} Apple workout, ${parsedRenpho.measurements.length} RENPHO measurements.`);
