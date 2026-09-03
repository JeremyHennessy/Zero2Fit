import assert from 'node:assert/strict';
import {
  ACTIVATION_SNAPSHOT_METRIC,
  fuelEvidence,
  workoutEvidence,
  photoEvidence,
  privateAcceptanceEvidence,
  deviceEvidence,
  activationSnapshotEventInput,
  latestBrowserSnapshots,
  mergedManualEvidence,
  crossBrowserEvidence,
  build020Steps,
  physicalDeviceSteps,
  summarizeSteps
} from '../activation-guide-core.mjs';

const fuel = {
  meals:{'2026-09-01':[
    {id:'m1',source:'quick_line',calories:500},
    {id:'m2',source:'open_food_facts',calories:200}
  ]},
  savedMeals:[{id:'saved'}],
  nutritionTargets:{calories:2200,protein:180,carbs:200,fat:70}
};
const fuelResult = fuelEvidence(fuel,[
  {metric_type:'nutrition_entry',source_provider:'open_food_facts'},
  {metric_type:'nutrition_entry_deleted'}
],{synced_at:'2026-09-01T01:00:00Z',fuel_history_entries:2,fuel_deleted_entries:1});
assert.equal(fuelResult.manual_entries,1);
assert.equal(fuelResult.provider_entries,1);
assert.equal(fuelResult.saved_meals,1);
assert.equal(fuelResult.targets_set,4);
assert.equal(fuelResult.tombstones,1);
assert.equal(fuelResult.synced,true);

const workoutState={
  completedWorkouts:2,
  workoutHistory:[{day:'2026-08-30'},{day:'2026-09-01'}],
  exerciseHistory:[
    {day:'2026-09-01',exerciseId:'dumbbell-row',completedSets:3,workingLoad:35,maxReps:12,sets:[{reps:12,load:35,done:true}]},
    {day:'2026-08-30',exerciseId:'dumbbell-row',completedSets:3,workingLoad:35,maxReps:12,sets:[{reps:12,load:35,done:true}]}
  ]
};
const workoutResult=workoutEvidence(workoutState,{synced_at:'2026-09-01T01:00:00Z',workout_sessions:2,workout_sets:6});
assert.equal(workoutResult.synced,true);
assert.ok(workoutResult.history_signature.includes('dumbbell-row'));

const photoResult=photoEvidence([{photo_id:'p1'}],[{metric_type:'progress_photo_deleted'}],{
  progress_photo_remote_assets:1,progress_photo_uploaded:1,progress_photo_downloaded:0,progress_photo_deleted_assets:1
});
assert.equal(photoResult.ever_uploaded,true);
assert.equal(photoResult.ever_deleted_remote,true);

const infra=privateAcceptanceEvidence(
  {passed:false,run_id:'local-old'},
  {settings:{zero2fit_acceptance_v1:{passed:true,run_id:'cloud-good',finished_at:'2026-09-01T02:00:00Z',checks:[1,2,3]}}}
);
assert.equal(infra.passed,true);
assert.equal(infra.cloud_passed,true);
assert.equal(infra.run_id,'cloud-good');
assert.equal(infra.check_count,3);

const devices=deviceEvidence(
  [{source_bundle_id:'zepp.bundle',metric_type:'steps'},{source_bundle_id:'renpho.bundle',metric_type:'weight'}],
  [{provider:'zepp',source_bundle_id:'zepp.bundle'},{provider:'renpho',source_bundle_id:'renpho.bundle'}],
  {healthkit_value_parity:true,healthkit_background_delivery:true,renpho_model_label:true}
);
assert.equal(physicalDeviceSteps(devices).every(step=>step.done),true);

const snapshotA={browser_instance_id:'browser-a',account:{signed_in:true},fuel:{entries:2,synced:true,tombstones:1},workout:{history_rows:2,synced:true,history_signature:'same-history'},photos:{ever_uploaded:true,ever_downloaded:false,ever_deleted_remote:true,tombstones:1},manual:{healthkit_value_parity:true}};
const snapshotB={browser_instance_id:'browser-b',account:{signed_in:true},fuel:{entries:2,synced:true,tombstones:1},workout:{history_rows:2,synced:true,history_signature:'same-history'},photos:{ever_uploaded:false,ever_downloaded:true,ever_deleted_remote:false,tombstones:1},manual:{healthkit_background_delivery:true}};
const cross=crossBrowserEvidence([snapshotA,snapshotB]);
assert.deepEqual(cross,{
  browser_count:2,
  fuel_reconstructed:true,
  fuel_deletion_propagated:true,
  workout_reconstructed:true,
  matching_workout_history:true,
  photo_round_trip:true,
  photo_deletion_propagated:true
});
assert.deepEqual(mergedManualEvidence([snapshotA,snapshotB],{renpho_model_label:true}),{
  healthkit_value_parity:true,
  healthkit_background_delivery:true,
  renpho_model_label:true
});

const steps=build020Steps({account:{signed_in:true},infrastructure:infra,fuel:fuelResult,workout:workoutResult,photos:photoResult,cross,manual:{adaptive_second_browser_confirmed:true}});
assert.equal(steps.length,9);
assert.equal(steps.every(step=>step.done),true);
assert.deepEqual(summarizeSteps(steps),{complete:9,partial:0,total:9,done:true});

const noInfra=build020Steps({account:{signed_in:true},infrastructure:{passed:false},fuel:fuelResult,cross:{}});
assert.equal(noInfra.find(step=>step.id==='sync').done,false);
assert.equal(noInfra.find(step=>step.id==='sync').partial,true);

const event=activationSnapshotEventInput(snapshotA,'2026-09-01T01:02:03Z');
assert.equal(event.metricType,ACTIVATION_SNAPSHOT_METRIC);
assert.equal(event.sourceRecordId,'activation:browser-a');
assert.equal(event.metadata.activation_guide_v1.browser_instance_id,'browser-a');

const latest=latestBrowserSnapshots([
  {metric_type:ACTIVATION_SNAPSHOT_METRIC,observed_at:'2026-09-01T01:00:00Z',metadata:{activation_guide_v1:{browser_instance_id:'browser-a',version:1}}},
  {metric_type:ACTIVATION_SNAPSHOT_METRIC,observed_at:'2026-09-01T02:00:00Z',metadata:{activation_guide_v1:{browser_instance_id:'browser-a',version:2}}},
  {metric_type:ACTIVATION_SNAPSHOT_METRIC,observed_at:'2026-09-01T01:30:00Z',metadata:{activation_guide_v1:{browser_instance_id:'browser-b',version:1}}}
]);
assert.equal(latest.length,2);
assert.equal(latest.find(row=>row.browser_instance_id==='browser-a').version,2);

console.log('Build 026 activation-guide core tests passed.');
