import assert from 'node:assert/strict';
import {
  defaultEvidence,
  normalizeEvidence,
  assignCandidate,
  setMetricStatus,
  setPhysicalField,
  groupObservations,
  providerParity,
  physicalParityComplete,
  manualActivationFlags,
  verificationReadiness,
  evidenceEventInput,
  latestEvidence,
  mergeEvidence
} from '../healthkit-evidence-core.mjs';

const observations = [
  { source_bundle_id:'com.zepp.health', source_name:'Zepp', metric_type:'steps', sample_count:30 },
  { source_bundle_id:'com.zepp.health', source_name:'Zepp', metric_type:'heart_rate', sample_count:55 },
  { source_bundle_id:'com.zepp.health', source_name:'Zepp', metric_type:'sleep_stage', sample_count:20 },
  { source_bundle_id:'com.zepp.health', source_name:'Zepp', metric_type:'workout_session', sample_count:4 },
  { source_bundle_id:'com.zepp.health', source_name:'Zepp', metric_type:'active_energy', sample_count:4 },
  { source_bundle_id:'com.renpho.health', source_name:'RENPHO Health', metric_type:'weight', sample_count:3 },
  { source_bundle_id:'com.renpho.health', source_name:'RENPHO Health', metric_type:'body_fat_percentage', sample_count:3 },
  { source_bundle_id:'com.renpho.health', source_name:'RENPHO Health', metric_type:'bmi', sample_count:3 }
];

assert.equal(groupObservations(observations).length, 2);

let evidence = defaultEvidence();
evidence = assignCandidate(evidence, 'zepp', 'com.zepp.health', 'Zepp', '2026-09-01T10:00:00Z');
evidence = assignCandidate(evidence, 'renpho', 'com.renpho.health', 'RENPHO Health', '2026-09-01T10:00:01Z');

for (const [metric,status] of Object.entries({
  steps:'matched', heart_rate:'matched', resting_heart_rate:'not_provided', hrv_sdnn:'not_provided',
  sleep_stage:'matched', workout_session:'matched', active_energy:'matched'
})) evidence = setMetricStatus(evidence,'zepp',metric,status,'2026-09-01T10:01:00Z');
for (const [metric,status] of Object.entries({ weight:'matched', body_composition:'matched' })) evidence = setMetricStatus(evidence,'renpho',metric,status,'2026-09-01T10:02:00Z');

evidence = setPhysicalField(evidence,'background_delivery',true,'2026-09-01T10:03:00Z');
evidence = setPhysicalField(evidence,'renpho_model_label','ES-CS20M','2026-09-01T10:04:00Z');

const zepp = providerParity('zepp',evidence,observations);
const renpho = providerParity('renpho',evidence,observations);
assert.equal(zepp.ready,true);
assert.equal(renpho.ready,true);
assert.equal(physicalParityComplete(evidence,observations),true);
assert.deepEqual(manualActivationFlags(evidence,observations),{
  healthkit_value_parity:true,
  healthkit_background_delivery:true,
  renpho_model_label:true
});
assert.equal(verificationReadiness('zepp',evidence,observations).ready,true);
assert.equal(verificationReadiness('renpho',evidence,observations).ready,true);

let mismatch = setMetricStatus(evidence,'zepp','heart_rate','mismatch','2026-09-01T10:05:00Z');
assert.equal(providerParity('zepp',mismatch,observations).ready,false);
assert.match(verificationReadiness('zepp',mismatch,observations).reason,/mismatch/i);

let invalidNotProvided = setMetricStatus(evidence,'zepp','heart_rate','not_provided','2026-09-01T10:05:00Z');
assert.equal(providerParity('zepp',invalidNotProvided,observations).ready,false);
assert.ok(providerParity('zepp',invalidNotProvided,observations).blockers.some(x => /present/i.test(x)));

let invalidMatched = setMetricStatus(evidence,'zepp','hrv_sdnn','matched','2026-09-01T10:05:00Z');
assert.equal(providerParity('zepp',invalidMatched,observations).ready,false);
assert.ok(providerParity('zepp',invalidMatched,observations).blockers.some(x => /has not written/i.test(x)));

let duplicate = assignCandidate(evidence,'renpho','com.zepp.health','Zepp','2026-09-01T10:06:00Z');
assert.equal(providerParity('zepp',duplicate,observations).ready,false);
assert.ok(providerParity('zepp',duplicate,observations).blockers.some(x => /same HealthKit source bundle/i.test(x)));

let missingPrimary = setMetricStatus(evidence,'renpho','weight','not_provided','2026-09-01T10:07:00Z');
assert.equal(providerParity('renpho',missingPrimary,observations).ready,false);
assert.ok(providerParity('renpho',missingPrimary,observations).blockers.some(x => /Weight must be physically matched/i.test(x)));

const eventInput = evidenceEventInput(evidence,'2026-09-01T10:10:00Z');
assert.equal(eventInput.metricType,'healthkit_acceptance_evidence');
assert.equal(eventInput.sourceProvider,'zero2fit_physical_acceptance');
assert.equal(eventInput.metadata.healthkit_evidence_v1.renpho_model_label,'ES-CS20M');
assert.equal(JSON.stringify(eventInput).includes('heart_rate_value'),false);

const remoteEvents = [{
  metric_type:'healthkit_acceptance_evidence',
  observed_at:'2026-09-01T10:10:00Z',
  metadata:eventInput.metadata
}];
assert.equal(latestEvidence(remoteEvents).providers.zepp.candidate_bundle_id,'com.zepp.health');
assert.equal(mergeEvidence(defaultEvidence(),latestEvidence(remoteEvents)).providers.renpho.metrics.weight,'matched');
assert.equal(normalizeEvidence({providers:{zepp:{metrics:{steps:'garbage'}}}}).providers.zepp.metrics.steps,'pending');

console.log('Build 028 HealthKit evidence core tests passed.');
