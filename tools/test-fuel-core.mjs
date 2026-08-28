import assert from 'node:assert/strict';
import {
  normalizeMeal, mealIdentity, scaleMeal, recentMealOptions, mealsForDay,
  mergeSavedMeals, removeSavedMeal, normalizeTargets, dayOffset
} from '../fuel-core.mjs';

assert.deepEqual(normalizeMeal({name:'  Eggs   and toast ',calories:'410',protein:'27.5'}), {name:'Eggs and toast',calories:410,protein:27.5});
assert.equal(normalizeMeal({name:'',calories:200,protein:10}), null);
assert.equal(mealIdentity({name:'Eggs',calories:200,protein:12}), 'eggs|200|12');
assert.deepEqual(scaleMeal({name:'Pasta',calories:500,protein:20}, .5), {name:'Pasta',calories:250,protein:10,multiplier:.5});
assert.deepEqual(scaleMeal({name:'Pasta',calories:500,protein:20}, 1.5), {name:'Pasta',calories:750,protein:30,multiplier:1.5});

const meals = {
  '2026-08-25':[{name:'Eggs',calories:200,protein:12},{name:'Chicken wrap',calories:550,protein:42}],
  '2026-08-26':[{name:'Eggs',calories:200,protein:12}],
  '2026-08-27':[{name:'Greek yogurt',calories:180,protein:20}]
};
const recent = recentMealOptions(meals, 8);
assert.deepEqual(recent.map(x=>x.name), ['Greek yogurt','Eggs','Chicken wrap']);
assert.equal(recent.find(x=>x.name==='Eggs').uses,2);
assert.equal(recent.find(x=>x.name==='Eggs').lastDay,'2026-08-26');
assert.deepEqual(mealsForDay(meals,'2026-08-25').map(x=>x.name),['Eggs','Chicken wrap']);

let saved = mergeSavedMeals([], {name:'Eggs',calories:200,protein:12});
saved = mergeSavedMeals(saved, {name:'Chicken wrap',calories:550,protein:42});
saved = mergeSavedMeals(saved, {name:'Eggs',calories:200,protein:12});
assert.equal(saved.length,2);
assert.equal(saved[0].name,'Eggs');
saved = removeSavedMeal(saved, saved[0].id);
assert.deepEqual(saved.map(x=>x.name),['Chicken wrap']);

assert.deepEqual(normalizeTargets({calories:2300,protein:160}), {calories:2300,protein:160});
assert.deepEqual(normalizeTargets({calories:200,protein:5}), {calories:null,protein:null});
assert.equal(dayOffset(new Date('2026-08-28T12:00:00Z'), -1), '2026-08-27');

console.log('Build 016 Fuel core tests passed.');
