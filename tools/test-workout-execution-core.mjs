import assert from 'node:assert/strict';
import {
  parseWorkoutSetKey, completionSummary, chooseActiveSet, nextIncompleteSet,
  restSecondsForIntent, adjustNumber, formatTarget, setPosition, exercisePosition
} from '../workout-execution-core.mjs';

const keyA0 = 'apartmentGym:full_body_a:horizontal_pull:exercise:db-row:0';
const parsed = parseWorkoutSetKey(keyA0);
assert.deepEqual(parsed, {
  location:'apartmentGym', templateId:'full_body_a', intent:'horizontal_pull', exerciseId:'exercise:db-row', setIndex:0
});
assert.equal(parseWorkoutSetKey('bad-key'), null);

const sets = [
  { key:'home:full_body_a:knee_dominant:squat:0', exerciseId:'squat', done:true },
  { key:'home:full_body_a:knee_dominant:squat:1', exerciseId:'squat', done:false },
  { key:'home:full_body_a:horizontal_push:pushup:0', exerciseId:'pushup', done:false },
  { key:'home:full_body_a:horizontal_push:pushup:1', exerciseId:'pushup', done:false }
];
assert.deepEqual(completionSummary(sets), { total:4, completed:1, remaining:3, percent:25, complete:false });
assert.equal(chooseActiveSet(sets).key, sets[1].key);
assert.equal(chooseActiveSet(sets, { preferredKey:sets[2].key }).key, sets[2].key);
assert.equal(chooseActiveSet(sets, { skippedKeys:[sets[1].key] }).key, sets[2].key);
assert.equal(chooseActiveSet(sets, { skippedKeys:sets.filter(item => !item.done).map(item => item.key) }), null);
assert.equal(nextIncompleteSet(sets, sets[1].key).key, sets[2].key);
assert.equal(nextIncompleteSet(sets, sets[2].key, { skippedKeys:[sets[3].key] }).key, sets[1].key);
assert.equal(nextIncompleteSet(sets, sets[2].key, { skippedKeys:[sets[1].key,sets[3].key] }), null);
assert.equal(chooseActiveSet(sets.map(item => ({...item, done:true}))), null);

assert.equal(restSecondsForIntent('horizontal_pull'), 90);
assert.equal(restSecondsForIntent('core'), 60);
assert.equal(restSecondsForIntent('unknown'), 75);
assert.equal(restSecondsForIntent('core', { core:45 }), 45);
assert.equal(restSecondsForIntent('core', { core:500 }), 300);

assert.equal(adjustNumber(35, 5, { min:0, max:1000, precision:1 }), 40);
assert.equal(adjustNumber(2, -5, { min:0, max:1000, precision:1 }), 0);
assert.equal(adjustNumber(9.5, .5, { min:0, max:100, precision:1 }), 10);
assert.equal(formatTarget({ reps:10, load:35 }), '35 lb × 10 reps');
assert.equal(formatTarget({ reps:12, bodyweight:true }), 'Bodyweight × 12 reps');

assert.deepEqual(setPosition(sets, sets[2].key), { index:3, total:4, label:'Set 3 of 4' });
assert.deepEqual(exercisePosition(sets, sets[2].key), { index:2, total:2, label:'Exercise 2 of 2' });

console.log('Build 014 workout execution core tests passed.');
