import assert from 'node:assert/strict';
import {
  parseSetKey,
  suggestNextPrescription,
  chooseNextTemplate,
  computeRecoveryStatus,
  selectWorkoutEnergy
} from '../adaptive-core.mjs';

assert.deepEqual(parseSetKey('apartmentGym:full_body_a:horizontal_pull:dumbbell-row:1'), {
  location:'apartmentGym', templateId:'full_body_a', intent:'horizontal_pull', exerciseId:'dumbbell-row', setIndex:1
});

const workoutSets = {
  '2026-08-20': {
    'apartmentGym:full_body_a:horizontal_push:dumbbell-bench-press:0': { reps:12, load:40, done:true },
    'apartmentGym:full_body_a:horizontal_push:dumbbell-bench-press:1': { reps:12, load:40, done:true }
  },
  '2026-08-24': {
    'apartmentGym:full_body_a:horizontal_push:dumbbell-bench-press:0': { reps:12, load:40, done:true },
    'apartmentGym:full_body_a:horizontal_push:dumbbell-bench-press:1': { reps:12, load:40, done:true }
  }
};

const ready = suggestNextPrescription({
  exerciseId:'dumbbell-bench-press', repRange:[8,12], workoutSets, currentDay:'2026-08-27', hasExternalLoad:true, recovery:{ level:'ready' }
});
assert.equal(ready.action, 'increase_load');
assert.equal(ready.suggestedLoad, 45);
assert.equal(ready.suggestedReps, 8);

const moderate = suggestNextPrescription({
  exerciseId:'dumbbell-bench-press', repRange:[8,12], workoutSets, currentDay:'2026-08-27', hasExternalLoad:true, recovery:{ level:'moderate' }
});
assert.equal(moderate.action, 'recovery_hold');
assert.equal(moderate.suggestedLoad, 40);

const low = suggestNextPrescription({
  exerciseId:'dumbbell-bench-press', repRange:[8,12], workoutSets, currentDay:'2026-08-27', hasExternalLoad:true, recovery:{ level:'low' }
});
assert.equal(low.action, 'recovery_reduce');
assert.equal(low.suggestedLoad, 35);

const bodyweightSets = {
  '2026-08-20': {
    'home:full_body_a:horizontal_push:push-up:0': { reps:12, done:true },
    'home:full_body_a:horizontal_push:push-up:1': { reps:12, done:true }
  },
  '2026-08-24': {
    'home:full_body_a:horizontal_push:push-up:0': { reps:12, done:true },
    'home:full_body_a:horizontal_push:push-up:1': { reps:12, done:true }
  }
};
const bodyweight = suggestNextPrescription({
  exerciseId:'push-up', repRange:[8,12], workoutSets:bodyweightSets, currentDay:'2026-08-27', hasExternalLoad:false, recovery:{ level:'ready' }
});
assert.equal(bodyweight.action, 'harder_variant_ready');
assert.equal(bodyweight.suggestedLoad, null);
assert.equal(bodyweight.suggestedReps, 8);

const template = chooseNextTemplate({
  today:'2026-08-27',
  workoutHistory:[
    { day:'2026-08-26', date:new Date('2026-08-26T18:00:00Z').getTime(), templateId:'full_body_a' },
    { day:'2026-08-22', date:new Date('2026-08-22T18:00:00Z').getTime(), templateId:'full_body_b' }
  ]
});
assert.equal(template.templateId, 'full_body_b');

const sleepEvent = (start, end) => ({ metric_type:'sleep_stage', value:'asleepCore', observed_at:start, end_at:end });
const events = [
  sleepEvent('2026-08-26T05:00:00Z','2026-08-26T10:00:00Z'),
  sleepEvent('2026-08-25T03:00:00Z','2026-08-25T10:00:00Z'),
  sleepEvent('2026-08-24T03:00:00Z','2026-08-24T10:00:00Z'),
  { metric_type:'resting_heart_rate', value:78, observed_at:'2026-08-27T10:00:00Z' },
  { metric_type:'resting_heart_rate', value:68, observed_at:'2026-08-26T10:00:00Z' },
  { metric_type:'resting_heart_rate', value:67, observed_at:'2026-08-25T10:00:00Z' },
  { metric_type:'hrv_sdnn', value:30, observed_at:'2026-08-27T10:00:00Z' },
  { metric_type:'hrv_sdnn', value:50, observed_at:'2026-08-26T10:00:00Z' },
  { metric_type:'hrv_sdnn', value:52, observed_at:'2026-08-25T10:00:00Z' }
];
const recovery = computeRecoveryStatus({ events, workoutHistory:[], now:new Date('2026-08-27T15:00:00Z').getTime() });
assert.equal(recovery.level, 'low');
assert(recovery.reasons.includes('sleep below 5.5 h'));
assert(recovery.reasons.includes('resting HR above recent baseline'));
assert(recovery.reasons.includes('HRV below recent baseline'));

const energy = selectWorkoutEnergy({
  day:'2026-08-27', templateId:'full_body_a', location:'apartmentGym',
  workoutHistory:[{ day:'2026-08-27', date:10, templateId:'full_body_a', location:'apartmentGym', deviceEnergyKcal:318.4, deviceSourceLabel:'Amazfit via Apple Health' }],
  workoutEnergyLog:[{ day:'2026-08-27', date:9, templateId:'full_body_a', location:'apartmentGym', grossKcal:355, method:'2024 Adult Compendium MET estimate' }]
});
assert.equal(energy.preferred, 'observed');
assert.equal(energy.kcal, 318.4);
assert.equal(energy.fallbackKcal, 355);

console.log('Adaptive core tests passed.');
