import assert from 'node:assert/strict';
import { sanitizeMetadata, recordUsageEvent, summarizeUsage, normalizeUsageState } from '../usage-core.mjs';

const now = Date.parse('2026-09-04T14:00:00Z');
const clean = sanitizeMetadata({
  page:'Today Screen', method:'Quick Line', completeCount:12, delta:999,
  backfilled:true, foodName:'Secret Food', calories:700, weight:230, sourceBundle:'com.vendor.secret'
});
assert.deepEqual(clean, { page:'today_screen', method:'quick_line', completeCount:4, delta:100, backfilled:true });

let state = {};
const add = (type, metadata = {}, offset = 0) => {
  const result = recordUsageEvent(state, { type, metadata, observedAt:now + offset }, { now:now + offset, dedupeWindowMs:0 });
  state = result.state;
};

add('guidance_shown',{action:'start_move'},0);
add('guidance_shown',{action:'quick_workout'},1000);
add('guidance_shown',{action:'log_food'},2000);
add('guidance_shown',{action:'recovery_check'},3000);
add('guidance_acted',{action:'start_move'},4000);
for (let i=0;i<8;i++) add('workout_set_completed',{},5000+i*1000);
for (let i=0;i<3;i++) add('workout_set_skipped',{},15000+i*1000);
for (let i=0;i<3;i++) add('workout_substitute_selected',{intent:'horizontal_pull'},20000+i*1000);
for (let i=0;i<4;i++) add('workout_mode_selected',{mode:i<3?'quick':'standard'},25000+i*1000);
for (let i=0;i<5;i++) add('fuel_panel_opened',{},30000+i*1000);
add('fuel_entry_logged',{method:'repeat'},36000);
add('fuel_entry_logged',{method:'saved'},37000);
add('adventure_run',{outcome:'combat_wall'},38000);
add('manual_health_entry',{kind:'steps'},39000);
add('manual_health_entry',{kind:'weight'},40000);
add('manual_health_entry',{kind:'steps'},41000);
add('workout_target_edited',{kind:'load',method:'stepper'},42000);
add('workout_target_edited',{kind:'load',method:'manual'},43000);
add('workout_target_edited',{kind:'reps',method:'stepper'},44000);
add('workout_target_edited',{kind:'reps',method:'manual'},45000);
add('workout_rest_override',{method:'start_next'},46000);
add('workout_rest_override',{method:'start_next'},47000);
add('workout_rest_override',{method:'start_next'},48000);
add('workout_skips_resumed',{outcome:'resumed'},49000);
add('workout_session_left',{outcome:'incomplete',source:'navigation'},50000);
add('workout_session_resumed',{outcome:'resumed',source:'navigation'},51000);
add('workout_session_left',{outcome:'incomplete',source:'background'},52000);
add('workout_session_left',{outcome:'incomplete',source:'navigation'},53000);

const summary = summarizeUsage(state,{now:now+60000,days:14});
assert.equal(summary.guidance.shown,4);
assert.equal(summary.guidance.acted,1);
assert.equal(summary.workout.setsCompleted,8);
assert.equal(summary.workout.setsSkipped,3);
assert.equal(summary.workout.preferredMode,'quick');
assert.equal(summary.workout.targetEdits,4);
assert.deepEqual(summary.workout.targetEditKinds,{load:2,reps:2});
assert.equal(summary.workout.restOverrides,3);
assert.equal(summary.workout.restOverrideMethods.start_next,3);
assert.equal(summary.workout.skipsResumed,1);
assert.equal(summary.workout.sessionsLeft,3);
assert.equal(summary.workout.sessionsResumed,1);
assert.equal(summary.workout.sessionResumeRate,1/3);
assert.equal(summary.fuel.entriesLogged,2);
assert.equal(summary.adventure.topOutcome,'combat_wall');
assert.equal(summary.manualHealth.total,3);
assert.ok(summary.signals.some(signal => signal.key === 'guidance_follow_through'));
assert.ok(summary.signals.some(signal => signal.key === 'workout_skip_rate'));
assert.ok(summary.signals.some(signal => signal.key === 'substitution_demand'));
assert.ok(summary.signals.some(signal => signal.key === 'workout_target_edits'));
assert.ok(summary.signals.some(signal => signal.key === 'rest_shortening'));
assert.ok(summary.signals.some(signal => signal.key === 'unfinished_sessions'));
assert.ok(summary.signals.some(signal => signal.key === 'fuel_abandonment'));
assert.ok(summary.signals.some(signal => signal.key === 'quick_mode_preference'));
assert.ok(summary.signals.some(signal => signal.key === 'manual_health_dependency'));

const pruned = normalizeUsageState({events:[
  {id:'old',type:'page_view',observedAt:'2025-01-01T00:00:00Z',metadata:{page:'today'}},
  {id:'new',type:'page_view',observedAt:'2026-09-04T13:00:00Z',metadata:{page:'today'}}
]}, {now,retentionDays:90});
assert.equal(pruned.events.length,1);
assert.equal(pruned.events[0].id,'new');

console.log('Build 044 usage-core friction tests passed.');
