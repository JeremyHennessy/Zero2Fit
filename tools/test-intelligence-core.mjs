import assert from 'node:assert/strict';
import {
  smoothWeightTrend,
  weightTrendSummary,
  estimatedOneRepMax,
  personalRecords,
  strengthTrends,
  pearsonCorrelation,
  workoutCorrelations,
  weeklyReview,
  thenVsNow,
  improvementVerdict,
  buildPersonalIntelligence
} from '../intelligence-core.mjs';

const weights = [240,239,238,237,236,235,234,233].map((value, index) => ({
  value,
  date:new Date(`2026-08-${String(10 + index).padStart(2,'0')}T12:00:00Z`).getTime()
}));
const smoothed = smoothWeightTrend(weights, 7);
assert.equal(smoothed.length, 8);
assert.equal(smoothed.at(-1).sampleCount, 7);
const weight = weightTrendSummary(weights);
assert.equal(weight.direction, 'down');
assert(weight.change < 0);
assert.equal(Math.round(estimatedOneRepMax(100, 10)), 133);

const exerciseHistory = [
  {
    exerciseId:'dumbbell-bench-press', day:'2026-08-10', completedSets:2,
    sets:[{done:true,reps:8,load:40},{done:true,reps:8,load:40}]
  },
  {
    exerciseId:'dumbbell-bench-press', day:'2026-08-17', completedSets:2,
    sets:[{done:true,reps:10,load:45},{done:true,reps:10,load:45}]
  },
  {
    exerciseId:'push-up', day:'2026-08-12', completedSets:2,
    sets:[{done:true,reps:8},{done:true,reps:8}]
  },
  {
    exerciseId:'push-up', day:'2026-08-19', completedSets:2,
    sets:[{done:true,reps:12},{done:true,reps:10}]
  }
];
const prs = personalRecords(exerciseHistory);
const benchPr = prs.find(row => row.exerciseId === 'dumbbell-bench-press');
assert.equal(benchPr.maxLoad, 45);
assert(benchPr.estimated1rm > 55);
const trends = strengthTrends(exerciseHistory);
assert(trends.find(row => row.exerciseId === 'dumbbell-bench-press').changePercent > 0);
assert(trends.find(row => row.exerciseId === 'push-up').changePercent > 0);

const corr = pearsonCorrelation([[1,10],[2,20],[3,30],[4,40],[5,50]]);
assert.equal(corr.n, 5);
assert(Math.abs(corr.r - 1) < 1e-9);
assert.equal(corr.strength, 'strong');

const sleep = (day, hours) => ({
  metric_type:'sleep_stage', value:'asleepCore',
  observed_at:`${day}T23:00:00Z`,
  end_at:new Date(new Date(`${day}T23:00:00Z`).getTime() + hours * 3600000).toISOString()
});
const trustedEvents = [
  sleep('2026-08-09',6), sleep('2026-08-11',7), sleep('2026-08-16',8), sleep('2026-08-18',9)
];
const correlations = workoutCorrelations({ exerciseHistory, trustedEvents });
assert.equal(correlations.sleepVsStrengthVolume.n, 4);
assert(Number.isFinite(correlations.sleepVsStrengthVolume.r));

const workoutHistory = [
  {day:'2026-08-17',date:new Date('2026-08-17T18:00:00Z').getTime(),templateId:'full_body_a'},
  {day:'2026-08-19',date:new Date('2026-08-19T18:00:00Z').getTime(),templateId:'full_body_b'},
  {day:'2026-08-25',date:new Date('2026-08-25T18:00:00Z').getTime(),templateId:'full_body_a'},
  {day:'2026-08-27',date:new Date('2026-08-27T18:00:00Z').getTime(),templateId:'full_body_b'}
];
const weekly = weeklyReview({
  workoutHistory,
  exerciseHistory,
  trustedEvents,
  steps:{'2026-08-25':7000,'2026-08-26':8000,'2026-08-27':9000},
  now:new Date('2026-08-27T20:00:00Z').getTime()
});
assert.equal(weekly.workouts, 2);
assert.equal(weekly.averageSteps, 8000);

const photoMetadata = [
  {photo_id:'1',session_id:'s1',captured_at:'2026-07-01T12:00:00Z',view:'front'},
  {photo_id:'2',session_id:'s2',captured_at:'2026-08-20T12:00:00Z',view:'front'}
];
const thenNow = thenVsNow({weights,exerciseHistory,workoutHistory,photoMetadata});
assert.equal(thenNow.photoSessions, 2);
assert.equal(thenNow.firstPhotoDay, '2026-07-01');
assert(thenNow.strengthImprovers.length >= 1);

const verdict = improvementVerdict({exerciseHistory,workoutHistory,weekly});
assert.equal(verdict.status, 'improving');

const full = buildPersonalIntelligence({
  weights, exerciseHistory, workoutHistory, photoMetadata, trustedEvents,
  steps:{'2026-08-25':7000,'2026-08-26':8000,'2026-08-27':9000},
  now:new Date('2026-08-27T20:00:00Z').getTime(),
  recovery:{level:'ready',reasons:[]}
});
assert.equal(full.verdict.status, 'improving');
assert(full.personalRecords.length >= 2);
assert(full.recommendations.length >= 1);

console.log('Personal intelligence tests passed.');
