import assert from 'node:assert/strict';
import {
  aggregateDailySteps,
  summarizeLatestSleep,
  latestMetric,
  matchLocalWorkout,
  isXpEligibleWorkout,
  isTrustedDeviceEvent,
  activityCategory,
  activityLabel,
  eventEnergyKcal,
  sourceLabel
} from '../device-core.mjs';

const importedApple = {
  source_provider: 'apple_health',
  source_device: null,
  metadata: { source_name: 'Zepp' }
};
const verifiedBridgeMetadata = {
  source_name:'Zepp',
  source_bundle_id:'com.example.zepp.observed-on-device',
  bridge_transport_verified:true,
  verified:true,
  source_verification_status:'verified',
  source_verification_id:'11111111-1111-1111-1111-111111111111'
};

const stepEvents = [
  { ...importedApple, event_id:'s1', metric_type:'steps', value:1200, unit:'count', observed_at:'2026-08-27T10:00:00-03:00' },
  { ...importedApple, event_id:'s2', metric_type:'steps', value:2300, unit:'count', observed_at:'2026-08-27T12:00:00-03:00' },
  { ...importedApple, event_id:'s3', metric_type:'steps', value:4100, unit:'count', observed_at:'2026-08-27T15:00:00-03:00' },
  { source_provider:'apple_health', metadata:{source_name:'iPhone'}, event_id:'p1', metric_type:'steps', value:9000, unit:'count', observed_at:'2026-08-27T15:01:00-03:00' }
];
const daily = aggregateDailySteps(stepEvents);
assert.equal(daily.length, 1);
assert.equal(daily[0].total, 7600);
assert.match(daily[0].source_label, /Amazfit/);
assert.equal(daily[0].trusted, false, 'Apple Health XML/source-name evidence must not authorize permanent progression');

const totalPreferred = aggregateDailySteps([
  ...stepEvents,
  { ...importedApple, event_id:'sum1', metric_type:'steps', value:8123, unit:'count', observed_at:'2026-08-27T23:50:00-03:00', metadata:{source_name:'Zepp',aggregation:'daily_total',date:'2026-08-27'} }
]);
assert.equal(totalPreferred[0].total, 8123);
assert.equal(totalPreferred[0].aggregation, 'provided_daily_total');
assert.equal(totalPreferred[0].trusted, false);

const verifiedStep = aggregateDailySteps([{
  source_provider:'healthkit_bridge',
  metadata:{...verifiedBridgeMetadata, aggregation:'daily_total', date:'2026-08-27'},
  event_id:'bridge-steps', metric_type:'steps', value:8123, unit:'count', observed_at:'2026-08-27T23:50:00-03:00'
}]);
assert.equal(verifiedStep[0].trusted, true);
assert.equal(verifiedStep[0].total, 8123);

const sleepEvents = [
  { ...importedApple, event_id:'sl1', metric_type:'sleep_stage', value:'HKCategoryValueSleepAnalysisAsleepCore', observed_at:'2026-08-26T23:00:00-03:00', end_at:'2026-08-27T02:00:00-03:00' },
  { ...importedApple, event_id:'sl2', metric_type:'sleep_stage', value:'HKCategoryValueSleepAnalysisAsleepDeep', observed_at:'2026-08-27T02:00:00-03:00', end_at:'2026-08-27T04:00:00-03:00' },
  { ...importedApple, event_id:'sl3', metric_type:'sleep_stage', value:'HKCategoryValueSleepAnalysisAsleepREM', observed_at:'2026-08-27T04:00:00-03:00', end_at:'2026-08-27T06:30:00-03:00' },
  { ...importedApple, event_id:'sl4', metric_type:'sleep_stage', value:'HKCategoryValueSleepAnalysisAwake', observed_at:'2026-08-27T06:30:00-03:00', end_at:'2026-08-27T07:00:00-03:00' }
];
const sleep = summarizeLatestSleep(sleepEvents);
assert.equal(sleep.minutes, 450);
assert.match(sleep.source_label, /Amazfit/);

const metric = latestMetric([
  { source_provider:'apple_health', metadata:{source_name:'iPhone'}, metric_type:'resting_heart_rate', value:70, observed_at:'2026-08-27T08:00:00-03:00' },
  { ...importedApple, metric_type:'resting_heart_rate', value:62, observed_at:'2026-08-27T07:56:00-03:00' }
], 'resting_heart_rate');
assert.equal(metric.value, 62);

const importedWorkout = {
  ...importedApple,
  event_id:'w1', metric_type:'workout_session', value:42, unit:'min',
  observed_at:'2026-08-27T12:00:00-03:00', end_at:'2026-08-27T12:42:00-03:00',
  metadata:{source_name:'Zepp',activity_type:'HKWorkoutActivityTypeFunctionalStrengthTraining',total_energy_burned:321,total_energy_unit:'kcal'}
};
const match = matchLocalWorkout(importedWorkout, [{date:new Date('2026-08-27T12:44:00-03:00').getTime(),day:'2026-08-27',durationMinutes:40,templateName:'Full Body A'}]);
assert.equal(match.index, 0);
assert.equal(isTrustedDeviceEvent(importedWorkout), false);
assert.equal(isXpEligibleWorkout(importedWorkout, '2026-08-27', {}, 0), false);
assert.equal(activityCategory(importedWorkout), 'strength');
assert.equal(activityLabel(importedWorkout), 'Functional Strength Training');
assert.equal(Math.round(eventEnergyKcal(importedWorkout)), 321);
assert.match(sourceLabel(importedWorkout), /Amazfit/);

const verifiedWorkout = {
  ...importedWorkout,
  event_id:'bridge-w1',
  source_provider:'healthkit_bridge',
  metadata:{...importedWorkout.metadata, ...verifiedBridgeMetadata}
};
assert.equal(isTrustedDeviceEvent(verifiedWorkout), true);
assert.equal(isXpEligibleWorkout(verifiedWorkout, '2026-08-27', {}, 0), true);
assert.equal(isXpEligibleWorkout(verifiedWorkout, '2026-08-28', {}, 0), false);

const unverifiedBridge = {
  ...verifiedWorkout,
  event_id:'bridge-unverified',
  metadata:{...verifiedWorkout.metadata, verified:false, source_verification_status:'unverified', source_verification_id:null}
};
assert.equal(isTrustedDeviceEvent(unverifiedBridge), false);
assert.equal(isXpEligibleWorkout(unverifiedBridge, '2026-08-27', {}, 0), false);

console.log('Build 008 device trust tests passed: imported source names are display-only; verified HealthKit bridge mappings can drive progression.');
