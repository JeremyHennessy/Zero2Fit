function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function nutriment(product, key) {
  return number(product?.nutriments?.[key]);
}

function kcal(product, suffix) {
  const direct = nutriment(product, `energy-kcal_${suffix}`);
  if (direct != null) return direct;
  const kj = nutriment(product, `energy-kj_${suffix}`);
  return kj == null ? null : kj / 4.184;
}

function round(value, digits = 1) {
  if (value == null) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sourceProduct(row) {
  if (!row || typeof row !== 'object') return null;
  return row._source && typeof row._source === 'object' ? row._source : row;
}

export function normalizeBarcode(value) {
  const barcode = clean(value).replace(/[^0-9]/g, '');
  return barcode.length >= 8 && barcode.length <= 14 ? barcode : null;
}

export function normalizeOpenFoodFactsProduct(input = {}) {
  const product = sourceProduct(input) || {};
  const code = normalizeBarcode(product.code || product._id || product.id);
  const name = clean(product.product_name || product.product_name_en || product.generic_name || product.abbreviated_product_name);
  if (!code || !name) return null;

  const brand = clean(product.brands || (Array.isArray(product.brands_tags) ? product.brands_tags[0] : ''));
  const servingText = clean(product.serving_size);
  const servingQuantity = number(product.serving_quantity);

  const perServing = {
    calories:kcal(product, 'serving'),
    protein:nutriment(product, 'proteins_serving'),
    carbs:nutriment(product, 'carbohydrates_serving'),
    fat:nutriment(product, 'fat_serving')
  };
  const per100 = {
    calories:kcal(product, '100g'),
    protein:nutriment(product, 'proteins_100g'),
    carbs:nutriment(product, 'carbohydrates_100g'),
    fat:nutriment(product, 'fat_100g')
  };

  let basis = '100g';
  let factor = 1;
  let nutrients = per100;
  let serving = servingText || '100 g reference';

  if (perServing.calories != null) {
    basis = 'serving';
    nutrients = perServing;
    serving = servingText || '1 serving';
  } else if (servingQuantity != null && servingQuantity > 0 && per100.calories != null) {
    basis = 'calculated_serving';
    factor = servingQuantity / 100;
    nutrients = Object.fromEntries(Object.entries(per100).map(([key,value]) => [key, value == null ? null : value * factor]));
    serving = servingText || `${round(servingQuantity, 1)} g serving`;
  }

  if (nutrients.calories == null || nutrients.calories <= 0) return null;

  return {
    provider:'open_food_facts',
    providerLabel:'Open Food Facts',
    code,
    barcode:code,
    sourceItemId:code,
    name:brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} · ${brand}` : name,
    productName:name,
    brand,
    serving,
    nutritionBasis:basis,
    calories:Math.max(0, Math.round(nutrients.calories)),
    protein:round(Math.max(0, nutrients.protein ?? 0)),
    carbs:round(Math.max(0, nutrients.carbs ?? 0)),
    fat:round(Math.max(0, nutrients.fat ?? 0)),
    quantity:clean(product.quantity),
    completeness:number(product.completeness),
    source:'open_food_facts'
  };
}

export function extractOpenFoodFactsProducts(payload = {}) {
  const rows = Array.isArray(payload) ? payload
    : Array.isArray(payload.products) ? payload.products
      : Array.isArray(payload.hits) ? payload.hits
        : Array.isArray(payload.results) ? payload.results
          : Array.isArray(payload.items) ? payload.items
            : payload.product ? [payload.product] : [];
  const seen = new Set();
  const normalized = [];
  for (const row of rows) {
    const product = normalizeOpenFoodFactsProduct(row);
    if (!product || seen.has(product.code)) continue;
    seen.add(product.code);
    normalized.push(product);
  }
  return normalized;
}

export function lookupCandidate(product, mealType = 'meal') {
  const normalized = normalizeOpenFoodFactsProduct(product) || product;
  if (!normalized?.name || !Number.isFinite(Number(normalized.calories))) return null;
  return {
    name:normalized.name,
    calories:Number(normalized.calories || 0),
    protein:Number(normalized.protein || 0),
    carbs:Number(normalized.carbs || 0),
    fat:Number(normalized.fat || 0),
    serving:normalized.serving || '',
    mealType,
    source:'open_food_facts',
    sourceItemId:normalized.code || normalized.sourceItemId || '',
    barcode:normalized.barcode || normalized.code || ''
  };
}

export function providerCacheKey(mode, value) {
  return `${clean(mode).toLowerCase()}:${clean(value).toLowerCase()}`;
}
