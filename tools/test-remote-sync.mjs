import assert from 'node:assert/strict';
import {
  eventToRemoteRow,
  remoteRowToEvent,
  verificationMatchesEvent,
  applySourceVerifications,
  normalizeSourceObservation,
  mergeSourceObservations,
  normalizeRemoteProvenance,
  fuelEntryEventInput,
  fuelDeletionEventInput,
  nutritionEventToFuelEntry,
  mergeFuelHistory,
  mergeFuelPreferences,
  fuelPreferencesFromState
} from '../remote-sync-core.mjs';

const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const event = {
  event_id:'healthkit_bridge:step-1',
  metric_type:'steps',
  value:8123,
  unit:'count',
  observed_at:'2026-08-27T23:50:00-03:00',
  source_provider:'healthkit_bridge',
  source_record_id:'step-1',
  provenance_status:'observed',
  confidence:'measured',
  metadata:{
    source_name:'Zepp',
    source_bundle_id:'com.example.zepp.observed-on-device',
    aggregation:'daily_total',
    bridge_transport_verified:true
  }
};
const row = eventToRemoteRow(event, userId);
assert.equal(row.user_id, userId);
assert.equal(row.numeric_value, 8123);
assert.equal(row.text_value, null);
assert.deepEqual(remoteRowToEvent(row).metadata, event.metadata);

assert.equal(normalizeRemoteProvenance('user-selected-provider'), 'user-entered');
const providerRow = eventToRemoteRow({
  event_id:'open_food_facts:abc',metric_type:'nutrition_entry',value:150,unit:'kcal',observed_at:'2026-08-31T12:00:00Z',
  source_provider:'open_food_facts',source_record_id:'nutrition:meal-1',provenance_status:'user-selected-provider',confidence:'provider_reported',metadata:{name:'Yogurt'}
}, userId);
assert.equal(providerRow.provenance_status, 'user-entered');
assert.equal(providerRow.metadata.original_provenance_status, 'user-selected-provider');

const verification = {
  verification_id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  provider:'zepp',
  source_bundle_id:'com.example.zepp.observed-on-device',
  source_name:'Zepp',
  metric_types:['steps','workout_session'],
  verified_at:'2026-08-27T20:00:00Z'
};
assert.equal(verificationMatchesEvent(verification, event), true);
assert.equal(verificationMatchesEvent({...verification, metric_types:['weight']}, event), false);
assert.equal(verificationMatchesEvent(verification, {...event, source_provider:'apple_health'}), false);

const [verified] = applySourceVerifications([event], [verification]);
assert.equal(verified.metadata.verified, true);
assert.equal(verified.metadata.source_verification_status, 'verified');
assert.equal(verified.metadata.source_verification_id, verification.verification_id);
const [unverified] = applySourceVerifications([event], []);
assert.equal(unverified.metadata.verified, false);
assert.equal(unverified.metadata.source_verification_status, 'unverified');

const observation = normalizeSourceObservation({
  source_bundle_id:'com.example.zepp.observed-on-device', source_name:'Zepp', metric_type:'steps', sample_count:3,
  first_observed_at:'2026-08-25T10:00:00Z', last_observed_at:'2026-08-27T10:00:00Z'
}, userId);
assert.equal(observation.user_id, userId);
assert.equal(observation.sample_count, 3);

const merged = mergeSourceObservations([observation], [{
  ...observation,
  sample_count:8,
  first_observed_at:'2026-08-24T10:00:00Z',
  last_observed_at:'2026-08-28T10:00:00Z'
}]);
assert.equal(merged.length, 1);
assert.equal(merged[0].sample_count, 8);
assert.equal(merged[0].first_observed_at, '2026-08-24T10:00:00Z');
assert.equal(merged[0].last_observed_at, '2026-08-28T10:00:00Z');

const fuelEntry = {
  id:'meal-abc',day:'2026-08-30',name:'Chicken bowl',calories:620,protein:48,carbs:64,fat:18,serving:'regular bowl',mealType:'lunch',
  source:'open_food_facts',sourceItemId:'1234567890123',barcode:'1234567890123',loggedAt:'2026-08-30T13:00:00-03:00'
};
const fuelInput = fuelEntryEventInput(fuelEntry);
assert.equal(fuelInput.metricType, 'nutrition_entry');
assert.equal(fuelInput.sourceProvider, 'open_food_facts');
assert.equal(fuelInput.provenanceStatus, 'user-entered');
assert.equal(fuelInput.metadata.fuel_entry_id, 'meal-abc');
assert.equal(fuelInput.metadata.selection_provenance, 'user-selected-provider');

const fuelEvent = {
  event_id:'open_food_facts:test',metric_type:fuelInput.metricType,value:fuelInput.value,unit:fuelInput.unit,observed_at:fuelInput.observedAt,
  source_provider:fuelInput.sourceProvider,source_device:fuelInput.sourceDevice,source_record_id:fuelInput.sourceRecordId,
  provenance_status:fuelInput.provenanceStatus,confidence:fuelInput.confidence,metadata:fuelInput.metadata
};
const reconstructed = nutritionEventToFuelEntry(fuelEvent);
assert.equal(reconstructed.id, 'meal-abc');
assert.equal(reconstructed.calories, 620);
assert.equal(reconstructed.barcode, '1234567890123');

const localMeals = {'2026-08-30':[{...fuelEntry, protein:50}]};
const remoteOnlyInput = fuelEntryEventInput({...fuelEntry,id:'meal-remote',day:'2026-08-29',name:'Greek yogurt',calories:170,protein:17,carbs:9,fat:4,source:'manual',barcode:'',sourceItemId:'',loggedAt:'2026-08-29T09:00:00-03:00'});
const remoteOnlyEvent = {
  event_id:'zero2fit:remote',metric_type:'nutrition_entry',value:remoteOnlyInput.value,unit:'kcal',observed_at:remoteOnlyInput.observedAt,
  source_provider:'zero2fit',source_record_id:remoteOnlyInput.sourceRecordId,provenance_status:'user-entered',confidence:'user_tracked',metadata:remoteOnlyInput.metadata
};
const deletionInput = fuelDeletionEventInput(fuelEntry, '2026-08-31T14:00:00Z');
const deletionEvent = {
  event_id:'zero2fit:delete',metric_type:deletionInput.metricType,value:1,unit:'flag',observed_at:deletionInput.observedAt,
  source_provider:'zero2fit',source_record_id:deletionInput.sourceRecordId,provenance_status:'user-entered',confidence:'user_tracked',metadata:deletionInput.metadata
};
const history = mergeFuelHistory(localMeals, [fuelEvent, remoteOnlyEvent, deletionEvent]);
assert.equal(history['2026-08-30'], undefined, 'remote deletion tombstone should suppress the matching local Fuel entry');
assert.equal(history['2026-08-29'][0].name, 'Greek yogurt');

const localPreferences = {
  nutritionTargets:{calories:2300,protein:160,carbs:250,fat:70},
  savedMeals:[{id:'saved-local',name:'Oats',calories:410,protein:28,carbs:52,fat:10,mealType:'breakfast',savedAt:'2026-08-30T10:00:00Z'}],
  syncMeta:{targetsUpdatedAt:'2026-08-30T10:00:00Z',savedMealsUpdatedAt:'2026-08-30T10:00:00Z'}
};
const remotePreferences = {
  schema_version:1,
  nutrition_targets:{calories:2400,protein:170,carbs:260,fat:75},
  targets_updated_at:'2026-08-31T10:00:00Z',
  saved_meals:[{id:'saved-remote',name:'Turkey wrap',calories:540,protein:42,carbs:48,fat:17,mealType:'lunch',savedAt:'2026-08-29T10:00:00Z'}],
  saved_meals_updated_at:'2026-08-29T10:00:00Z'
};
const preferences = mergeFuelPreferences(localPreferences, remotePreferences);
assert.equal(preferences.nutritionTargets.calories, 2400, 'newer remote target edit should win');
assert.equal(preferences.savedMeals[0].name, 'Oats', 'newer local saved-meal list should win');
assert.equal(preferences.remotePayload.targets_updated_at, '2026-08-31T10:00:00.000Z');

const inferred = fuelPreferencesFromState({
  nutritionTargets:{calories:null,protein:null,carbs:null,fat:null},savedMeals:[],updatedAt:'2026-08-31T12:00:00Z'
});
assert.equal(inferred.targetsUpdatedAt, null, 'an empty default target set must not look like a newer user preference');
assert.equal(inferred.savedMealsUpdatedAt, null, 'an empty default saved list must not look like a user deletion without a sync timestamp');

console.log('Build 019 remote sync contract tests passed.');
