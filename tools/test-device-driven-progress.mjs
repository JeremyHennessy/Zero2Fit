import assert from 'node:assert/strict';
import {
  aggregateDailySteps,
  summarizeLatestSleep,
  latestMetric,
  matchLocalWorkout,
  isXpEligibleWorkout,
  activityCategory,
  activityLabel,
  eventEnergyKcal,
  sourceLabel
} from '../device-core.mjs';

const base = {
  source_provider: 'apple_health',
  source_device: null,
  metadata: { source_name: 'Zepp' }
};

const stepEvents = [
  { ...base, event_id:'s1', metric_type:'steps', value:1200, unit:'count', observed_at:'2026-08-27T10:00:00-03:00' },
  { ...base, event_id:'s2', metric_type:'steps', value:2300, unit:'count', observed_at:'2026-08-27T12:00:00-03:00' },
  { ...base, event_id:'s3', metric_type:'steps', value:4100, unit:'count', observed_at:'2026-08-27T15:00:00-03:00' },
  { source_provider:'apple_health', metadata:{source_name:'iPhone'}, event_id:'p1', metric_type:'steps', value:9000, unit:'count', observed_at:'2026-08-27T15:01:00-03:00' }
];
const daily = aggregateDailySteps(stepEvents);
assert.equal(daily.length, 1);
assert.equal(daily[0].total, 7600);
assert.match(daily[0].source_label, /Amazfit/);
assert.equal(daily[0].trusted, true);

const totalPreferred = aggregateDailySteps([
  ...stepEvents,
  { ...base, event_id:'sum1', metric_type:'steps', value:8123, unit:'count', observed_at:'2026-08-27T23:50:00-03:00', metadata:{source_name:'Zepp',aggregation:'daily_total',date:'2026-08-27'} }
]);
assert.equal(totalPreferred[0].total, 8123);
assert.equal(totalPreferred[0].aggregation, 'provided_daily_total');

const sleepEvents = [
  { ...base, event_id:'sl1', metric_type:'sleep_stage', value:'HKCategoryValueSleepAnalysisAsleepCore', observed_at:'2026-08-26T23:00:00-03:00', end_at:'2026-08-27T02:00:00-03:00' },
  { ...base, event_id:'sl2', metric_type:'sleep_stage', value:'HKCategoryValueSleepAnalysisAsleepDeep', observed_at:'2026-08-27T02:00:00-03:00', end_at:'2026-08-27T04:00:00-03:00' },
  { ...base, event_id:'sl3', metric_type:'sleep_stage', value:'HKCategoryValueSleepAnalysisAsleepREM', observed_at:'2026-08-27T04:00:00-03:00', end_at:'2026-08-27T06:30:00-03:00' },
  { ...base, event_id:'sl4', metric_type:'sleep_stage', value:'HKCategoryValueSleepAnalysisAwake', observed_at:'2026-08-27T06:30:00-03:00', end_at:'2026-08-27T07:00:00-03:00' }
];
const sleep = summarizeLatestSleep(sleepEvents);
assert.equal(sleep.minutes, 450);
assert.match(sleep.source_label, /Amazfit/);

const metric = latestMetric([
  { source_provider:'apple_health', metadata:{source_name:'iPhone'}, metric_type:'resting_heart_rate', value:70, observed_at:'2026-08-27T08:00:00-03:00' },
  { ...base, metric_type:'resting_heart_rate', value:62, observed_at:'2026-08-27T07:56:00-03:00' }
], 'resting_heart_rate');
assert.equal(metric.value, 62);

const workout = {
  ...base,
  event_id:'w1', metric_type:'workout_session', value:42, unit:'min',
  observed_at:'2026-08-27T12:00:00-03:00', end_at:'2026-08-27T12:42:00-03:00',
  metadata:{source_name:'Zepp',activity_type:'HKWorkoutActivityTypeFunctionalStrengthTraining',total_energy_burned:321,total_energy_unit:'kcal'}
};
const match = matchLocalWorkout(workout, [{date:new Date('2026-08-27T12:44:00-03:00').getTime(),day:'2026-08-27',durationMinutes:40,templateName:'Full Body A'}]);
assert.equal(match.index, 0);
assert.equal(isXpEligibleWorkout(workout, '2026-08-27', {}, 0), true);
assert.equal(isXpEligibleWorkout(workout, '2026-08-28', {}, 0), false);
assert.equal(activityCategory(workout), 'strength');
assert.equal(activityLabel(workout), 'Functional Strength Training');
assert.equal(Math.round(eventEnergyKcal(workout)), 321);
assert.match(sourceLabel(workout), /Amazfit/);

console.log('Build 004 device-driven progress tests passed.');
