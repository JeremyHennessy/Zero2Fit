import assert from 'node:assert/strict';
import {
  migrateNutritionState,
  summarizeDay,
  recentMealCandidates,
  savedMealCandidates,
  searchMealCandidates,
  createMealEntry,
  createSavedMeal,
  parseQuickLine,
  nutritionConsistency,
  normalizeTargets
} from '../nutrition-core.mjs';

const legacy = {
  meals:{
    '2026-08-29':[
      {name:'Chicken bowl',calories:620,protein:48},
      {name:'Greek yogurt',calories:170,protein:17}
    ],
    '2026-08-30':[
      {name:'Chicken bowl',calories:620,protein:48,carbs:64,fat:18}
    ]
  }
};

const migrated = migrateNutritionState(legacy);
assert.equal(migrated.state.nutritionSchemaVersion, 1);
assert.equal(migrated.state.meals['2026-08-29'].length, 2);
assert(migrated.state.meals['2026-08-29'][0].id.startsWith('meal_'));
assert.equal(migrated.state.meals['2026-08-29'][0].carbs, 0);
assert.deepEqual(migrated.state.nutritionTargets, {calories:null,protein:null,carbs:null,fat:null});

const day = summarizeDay([
  {name:'A',calories:500,protein:40,carbs:55,fat:15},
  {name:'B',calories:300,protein:20,carbs:30,fat:10}
], {calories:2200,protein:160,carbs:250,fat:70});
assert.equal(day.totals.calories, 800);
assert.equal(day.totals.protein, 60);
assert.equal(day.totals.carbs, 85);
assert.equal(day.totals.fat, 25);
assert(Math.round(day.progress.protein) === 38);

const recent = recentMealCandidates(migrated.state.meals, {limit:10});
assert.equal(recent.length, 2, 'duplicate chicken bowl should collapse to one recent candidate');
assert.equal(recent[0].name, 'Chicken bowl');

const saved = createSavedMeal({name:'Breakfast oats',calories:410,protein:28,carbs:52,fat:10,mealType:'breakfast'}, {now:new Date('2026-08-30T12:00:00Z').getTime()});
const savedCandidates = savedMealCandidates([saved]);
assert.equal(savedCandidates[0].kind, 'saved');
assert.equal(savedCandidates[0].name, 'Breakfast oats');

const results = searchMealCandidates('chick', {savedMeals:[saved], meals:migrated.state.meals, limit:5});
assert.equal(results[0].name, 'Chicken bowl');
const savedFirst = searchMealCandidates('', {savedMeals:[saved], meals:migrated.state.meals, limit:5});
assert.equal(savedFirst[0].kind, 'saved');

const repeated = createMealEntry(recent[0], {day:'2026-08-31',source:'repeat',now:new Date('2026-08-31T10:00:00Z').getTime()});
assert.equal(repeated.day, '2026-08-31');
assert.equal(repeated.source, 'repeat');
assert.equal(repeated.calories, 620);

const parsed = parseQuickLine('Turkey wrap | 540 kcal | 42p | 48c | 17f');
assert.equal(parsed.name, 'Turkey wrap');
assert.equal(parsed.calories, 540);
assert.equal(parsed.protein, 42);
assert.equal(parsed.carbs, 48);
assert.equal(parsed.fat, 17);
assert.equal(parseQuickLine('just a name'), null);

const consistency = nutritionConsistency({
  ...migrated.state.meals,
  '2026-08-31':[repeated]
}, {now:new Date('2026-08-31T12:00:00Z').getTime(),days:7});
assert.equal(consistency.daysLogged, 3);
assert(consistency.averageCalories > 0);
assert.equal(consistency.entries, 4);

assert.deepEqual(normalizeTargets({calories:2300,protein:160,carbs:0,fat:''}), {calories:2300,protein:160,carbs:null,fat:null});

console.log('Build 017 nutrition-core tests passed.');
