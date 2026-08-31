import assert from 'node:assert/strict';
import {
  normalizeBarcode,
  normalizeOpenFoodFactsProduct,
  extractOpenFoodFactsProducts,
  lookupCandidate,
  providerCacheKey
} from '../food-lookup-core.mjs';

assert.equal(normalizeBarcode('0 12345-67890 5'), '012345678905');
assert.equal(normalizeBarcode('123'), null);

const serving = normalizeOpenFoodFactsProduct({
  code:'012345678905', product_name:'Greek Yogurt', brands:'Example', serving_size:'170 g',
  nutriments:{'energy-kcal_serving':150,'proteins_serving':17,'carbohydrates_serving':10,'fat_serving':4,'energy-kcal_100g':88}
});
assert.equal(serving.nutritionBasis, 'serving');
assert.equal(serving.calories, 150);
assert.equal(serving.protein, 17);
assert.equal(serving.name, 'Greek Yogurt · Example');

const calculated = normalizeOpenFoodFactsProduct({
  code:'12345678', product_name:'Granola', serving_quantity:40, serving_size:'40 g',
  nutriments:{'energy-kcal_100g':450,'proteins_100g':10,'carbohydrates_100g':65,'fat_100g':16}
});
assert.equal(calculated.nutritionBasis, 'calculated_serving');
assert.equal(calculated.calories, 180);
assert.equal(calculated.protein, 4);
assert.equal(calculated.carbs, 26);
assert.equal(calculated.fat, 6.4);

const reference = normalizeOpenFoodFactsProduct({
  code:'1234567890123', product_name:'Pasta Sauce',
  nutriments:{'energy-kj_100g':418.4,'proteins_100g':2.5,'carbohydrates_100g':12,'fat_100g':3}
});
assert.equal(reference.nutritionBasis, '100g');
assert.equal(reference.serving, '100 g reference');
assert.equal(reference.calories, 100);

assert.equal(normalizeOpenFoodFactsProduct({code:'12345678',product_name:'No nutrition',nutriments:{}}), null);

const extracted = extractOpenFoodFactsProducts({products:[
  {code:'12345678',product_name:'A',nutriments:{'energy-kcal_100g':100}},
  {code:'12345678',product_name:'A duplicate',nutriments:{'energy-kcal_100g':100}},
  {code:'87654321',product_name:'B',nutriments:{'energy-kcal_100g':200}}
]});
assert.deepEqual(extracted.map(row => row.code), ['12345678','87654321']);

const fromHit = extractOpenFoodFactsProducts({hits:[{_source:{code:'11111111',product_name:'Hit',nutriments:{'energy-kcal_100g':120}}}]});
assert.equal(fromHit[0].name, 'Hit');

const candidate = lookupCandidate(serving, 'breakfast');
assert.equal(candidate.mealType, 'breakfast');
assert.equal(candidate.source, 'open_food_facts');
assert.equal(candidate.barcode, '012345678905');
assert.equal(providerCacheKey(' SEARCH ', ' Greek Yogurt '), 'search:greek yogurt');

console.log('Build 018 food-lookup core tests passed.');
