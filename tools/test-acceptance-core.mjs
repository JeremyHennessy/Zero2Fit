import assert from 'node:assert/strict';
import {
  ACCEPTANCE_VERSION,
  acceptanceProbeRows,
  preferenceProbeRow,
  restoredPreferenceRow,
  acceptanceMarker,
  summarizeChecks,
  acceptanceDisplay
} from '../acceptance-core.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const ids = {
  sessionId:'22222222-2222-4222-8222-222222222222',
  setId:'33333333-3333-4333-8333-333333333333',
  photoSessionId:'44444444-4444-4444-8444-444444444444',
  photoId:'55555555-5555-4555-8555-555555555555'
};
const runId = 'probe-run';
const now = '2026-09-01T01:40:00.000Z';

const rows = acceptanceProbeRows({ userId, runId, now, ids });
assert.equal(rows.event.user_id, userId);
assert.equal(rows.event.event_id, 'acceptance:probe-run');
assert.equal(rows.workoutSet.session_id, rows.workoutSession.session_id);
assert.equal(rows.photoAsset.session_id, rows.photoSession.session_id);
assert.equal(rows.photoAsset.storage_path, `${userId}/acceptance/${runId}.jpg`);
assert.equal(rows.photoAsset.metadata.acceptance_probe, true);
assert.equal(rows.workoutSet.metadata.run_id, runId);

const existing = {
  preferred_units:{ weight:'lb' },
  workout_location:'apartmentGym',
  settings:{ fuel_v1:{ savedMeals:[{ id:'meal-1' }] }, keep_me:true },
  updated_at:'2026-08-31T10:00:00.000Z'
};
const probePref = preferenceProbeRow(existing, userId, runId, now);
assert.equal(probePref.user_id, userId);
assert.equal(probePref.workout_location, 'apartmentGym');
assert.equal(probePref.settings.keep_me, true);
assert.equal(probePref.settings.acceptance_probe.run_id, runId);

const restored = restoredPreferenceRow(existing, userId);
assert.deepEqual(restored.settings, existing.settings);
assert.equal(restored.updated_at, existing.updated_at);
assert.equal(restoredPreferenceRow(null, userId), null);

const checks = [
  { id:'auth', label:'Auth', status:'pass', detail:'ok' },
  { id:'storage', label:'Storage', status:'pass', detail:'ok' }
];
const summary = summarizeChecks(checks);
assert.equal(summary.passed, true);
assert.equal(summary.passed_count, 2);
assert.equal(summary.failed_count, 0);

const failed = summarizeChecks([...checks, { id:'x', status:'fail' }]);
assert.equal(failed.passed, false);
assert.equal(failed.failed_count, 1);

const result = { run_id:runId, finished_at:now, passed:true, checks };
const marker = acceptanceMarker(existing, userId, result);
assert.equal(marker.settings.keep_me, true);
assert.equal(marker.settings.zero2fit_acceptance_v1.version, ACCEPTANCE_VERSION);
assert.equal(marker.settings.zero2fit_acceptance_v1.build, '024');
assert.equal(marker.settings.zero2fit_acceptance_v1.checks.length, 2);
assert.match(acceptanceDisplay(result), /2\/2 checks passed/);
assert.equal(acceptanceDisplay(null), 'Not run on this browser.');

assert.throws(() => acceptanceMarker(existing, userId, { passed:false }), /passing acceptance result/);
assert.throws(() => acceptanceProbeRows({ userId, runId, now, ids:{ ...ids, setId:null } }), /probe UUIDs/);

console.log('Build 024 acceptance-core tests passed.');
