import assert from 'node:assert/strict';
import { summarizeDay, recommendNextAction, buildDailyGuidance } from '../daily-guidance-core.mjs';

const day = '2026-09-04';

let result = buildDailyGuidance({ appState:{}, fuelState:{}, day });
assert.equal(result.action.id, 'start_move');
assert.equal(result.summary.completeCount, 0);

result = buildDailyGuidance({ appState:{ quests:{ [day]:{ move:true } }, steps:{ [day]:1800 } }, fuelState:{}, day });
assert.equal(result.action.id, 'quick_workout');
assert.equal(result.summary.status.move, true);

result = buildDailyGuidance({
  appState:{ quests:{ [day]:{ move:true } }, workoutSessionStarts:{ [`${day}:home:full_body_a:standard`]: Date.now() } },
  fuelState:{}, day
});
assert.equal(result.action.id, 'continue_workout');

result = buildDailyGuidance({
  appState:{ quests:{ [day]:{ move:true, train:true } }, workoutDates:[day] },
  fuelState:{}, day
});
assert.equal(result.action.id, 'log_food');

result = buildDailyGuidance({
  appState:{ quests:{ [day]:{ move:true, train:true } }, workoutDates:[day] },
  fuelState:{ meals:{ [day]:[{name:'meal'}] } }, day
});
assert.equal(result.action.id, 'recovery_check');

result = buildDailyGuidance({
  appState:{ quests:{ [day]:{ move:true, train:true, recovery:true } }, workoutDates:[day] },
  fuelState:{ meals:{ [day]:[{name:'meal'}] } }, day
});
assert.equal(result.action.id, 'day_complete');
assert.equal(result.summary.allComplete, true);

const summary = summarizeDay({ appState:{ steps:{[day]:7000} }, day });
assert.equal(summary.status.move, true);
assert.equal(recommendNextAction(summary).id, 'quick_workout');

console.log('Daily guidance core tests passed.');
