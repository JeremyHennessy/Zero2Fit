import assert from 'node:assert/strict';
import { suggestNextPrescription } from '../adaptive-core.mjs';
import {
  deterministicUuid,
  localWorkoutRows,
  mergeWorkoutRows,
  hydrateWorkoutState,
  workoutSetSyncKey
} from '../workout-sync-core.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const setKey = 'apartmentGym:full_body_a:horizontal_pull:bent_over_two_dumbbell_row:0';
const setKey2 = 'apartmentGym:full_body_a:horizontal_pull:bent_over_two_dumbbell_row:1';

const uuidA = deterministicUuid('workout-set', `2026-08-20|${setKey}`);
const uuidB = deterministicUuid('workout-set', `2026-08-20|${setKey}`);
assert.equal(uuidA, uuidB, 'deterministic ids must remain stable across browsers');
assert.match(uuidA, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'deterministic id must be a valid version/variant UUID');

const sourceState = {
  totalXp:210,
  attributes:{ strength:70, consistency:45 },
  awarded:{ 'workout:2026-08-20':true },
  workoutSets:{
    '2026-08-20':{
      [setKey]:{ reps:12, load:35, done:true },
      [setKey2]:{ reps:12, load:35, done:true }
    }
  },
  workoutSessionStarts:{ '2026-08-20:apartmentGym:full_body_a:standard':Date.parse('2026-08-20T18:00:00Z') },
  workoutHistory:[{
    date:Date.parse('2026-08-20T18:30:00Z'),
    day:'2026-08-20', templateId:'full_body_a', templateName:'Full Body A',
    location:'apartmentGym', mode:'standard', durationMinutes:30,
    completedExerciseIds:['bent_over_two_dumbbell_row'], unavailableIntents:[]
  }],
  workoutDates:['2026-08-20'], completedWorkouts:1
};
const editMeta = {
  [workoutSetSyncKey('2026-08-20', setKey)]:'2026-08-20T18:20:00.000Z',
  [workoutSetSyncKey('2026-08-20', setKey2)]:'2026-08-20T18:21:00.000Z'
};
const rows = localWorkoutRows(sourceState, userId, editMeta);
assert.equal(rows.sessions.length, 1);
assert.equal(rows.sets.length, 2);
assert.equal(rows.sessions[0].mode, 'standard');
assert.equal(rows.sessions[0].completion_fraction, 1);
assert.equal(rows.sets[0].load_value, 35);
assert.equal(rows.sets[0].load_unit, 'lb');

const staleLocal = localWorkoutRows(sourceState, userId, {
  ...editMeta,
  [workoutSetSyncKey('2026-08-20', setKey)]:'2026-08-20T18:10:00.000Z'
});
const remoteNewer = structuredClone(rows);
remoteNewer.sets = remoteNewer.sets.map(row => row.metadata.set_key === setKey
  ? { ...row, reps:10, metadata:{ ...row.metadata, updated_at:'2026-08-20T19:00:00.000Z' } }
  : row);
let merged = mergeWorkoutRows(staleLocal, remoteNewer);
assert.equal(merged.sets.find(row => row.metadata.set_key === setKey).reps, 10, 'newer remote set edit must win');

const newerState = structuredClone(sourceState);
newerState.workoutSets['2026-08-20'][setKey].reps = 13;
const localNewer = localWorkoutRows(newerState, userId, {
  ...editMeta,
  [workoutSetSyncKey('2026-08-20', setKey)]:'2026-08-20T20:00:00.000Z'
});
merged = mergeWorkoutRows(localNewer, remoteNewer);
assert.equal(merged.sets.find(row => row.metadata.set_key === setKey).reps, 13, 'newer local set edit must win');

const hydrated = hydrateWorkoutState({
  totalXp:999,
  attributes:{ strength:123 },
  awarded:{ keep:true },
  workoutSets:{}, workoutHistory:[], workoutDates:[], completedWorkouts:0
}, rows, {});
assert.equal(hydrated.state.workoutSets['2026-08-20'][setKey].load, 35);
assert.equal(hydrated.state.workoutHistory.length, 1);
assert.equal(hydrated.state.completedWorkouts, 1);
assert.equal(hydrated.state.totalXp, 999, 'workout continuity must not synthesize or overwrite Fitness XP');
assert.equal(hydrated.state.attributes.strength, 123, 'workout continuity must preserve permanent attributes');
assert.equal(hydrated.state.awarded.keep, true, 'workout continuity must preserve local XP ledgers');

const progressionState = {
  workoutSets:{
    '2026-08-18':{
      [setKey]:{ reps:12, load:35, done:true },
      [setKey2]:{ reps:12, load:35, done:true }
    },
    '2026-08-20':{
      [setKey]:{ reps:12, load:35, done:true },
      [setKey2]:{ reps:12, load:35, done:true }
    }
  },
  workoutHistory:[
    { date:Date.parse('2026-08-20T18:30:00Z'), day:'2026-08-20', templateId:'full_body_a', templateName:'Full Body A', location:'apartmentGym', mode:'standard', durationMinutes:30 },
    { date:Date.parse('2026-08-18T18:30:00Z'), day:'2026-08-18', templateId:'full_body_a', templateName:'Full Body A', location:'apartmentGym', mode:'standard', durationMinutes:30 }
  ],
  workoutDates:['2026-08-18','2026-08-20'], completedWorkouts:2
};
const progressionRows = localWorkoutRows(progressionState, userId, {});
const restored = hydrateWorkoutState({ workoutSets:{}, workoutHistory:[], workoutDates:[], completedWorkouts:0 }, progressionRows, {}).state;
const prescription = suggestNextPrescription({
  exerciseId:'bent_over_two_dumbbell_row',
  repRange:[8,12],
  workoutSets:restored.workoutSets,
  currentDay:'2026-08-22',
  hasExternalLoad:true,
  loadIncrementLb:5,
  recovery:{ level:'ready' }
});
assert.equal(prescription.action, 'increase_load', 'two restored top-range exposures must still qualify for progression');
assert.equal(prescription.suggestedLoad, 40, 'next suggested load must follow the user across browsers');

console.log('Build 021 workout private-sync contract tests passed.');
