import assert from 'node:assert/strict';
import {
  eventToRemoteRow,
  remoteRowToEvent,
  verificationMatchesEvent,
  applySourceVerifications,
  normalizeSourceObservation,
  mergeSourceObservations
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

console.log('Build 008 remote sync contract tests passed.');
