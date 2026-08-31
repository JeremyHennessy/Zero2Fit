type CacheEntry = { expires: number; value: unknown };
type RateEntry = { search: number[]; barcode: number[] };

const cache = new Map<string, CacheEntry>();
const rates = new Map<string, RateEntry>();
const ALLOWED_ORIGINS = new Set([
  'https://jeremyhennessy.github.io',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174'
]);
const USER_AGENT = 'Zero2Fit/0.18 (https://jeremyhennessy.github.io/Zero2Fit/)';
const PRODUCT_FIELDS = 'code,product_name,product_name_en,generic_name,abbreviated_product_name,brands,brands_tags,quantity,serving_size,serving_quantity,nutriments,completeness';

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://jeremyhennessy.github.io';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function publishableKeys() {
  const values = new Set<string>();
  try {
    const map = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    Object.values(map).forEach(value => { if (typeof value === 'string') values.add(value); });
  } catch {}
  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) values.add(legacy);
  return values;
}

function callerIp(req: Request) {
  return (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown').split(',')[0].trim();
}

function allowRate(ip: string, mode: 'search' | 'barcode') {
  const now = Date.now();
  const cutoff = now - 60_000;
  const row = rates.get(ip) || { search: [], barcode: [] };
  row.search = row.search.filter(time => time >= cutoff);
  row.barcode = row.barcode.filter(time => time >= cutoff);
  const bucket = row[mode];
  const limit = mode === 'search' ? 8 : 12;
  if (bucket.length >= limit) {
    rates.set(ip, row);
    return false;
  }
  bucket.push(now);
  rates.set(ip, row);
  return true;
}

function cleanQuery(value: unknown) {
  return String(value ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
}

function barcode(value: unknown) {
  const code = String(value ?? '').replace(/\D/g, '');
  return code.length >= 8 && code.length <= 14 ? code : null;
}

async function externalJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cachePut(key: string, value: unknown, ttlMs: number) {
  if (cache.size > 100) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

async function searchProducts(query: string) {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '8',
    fields: PRODUCT_FIELDS
  });
  const data = await externalJson(`https://world.openfoodfacts.org/cgi/search.pl?${params}`) as Record<string, unknown>;
  return {
    provider: 'open_food_facts',
    mode: 'search',
    query,
    count: Number(data.count || 0),
    products: Array.isArray(data.products) ? data.products : []
  };
}

async function barcodeProduct(code: string) {
  const params = new URLSearchParams({ fields: PRODUCT_FIELDS });
  const data = await externalJson(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}?${params}`) as Record<string, unknown>;
  const product = data.product && typeof data.product === 'object' ? data.product : null;
  return {
    provider: 'open_food_facts',
    mode: 'barcode',
    barcode: code,
    found: Boolean(product),
    product
  };
}

export default {
  async fetch(req: Request) {
    const origin = req.headers.get('origin');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== 'POST') return json(origin, 405, { error: 'method_not_allowed' });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(origin, 403, { error: 'origin_not_allowed' });

    const key = req.headers.get('apikey') || '';
    if (!key || !publishableKeys().has(key)) return json(origin, 401, { error: 'invalid_client_key' });

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return json(origin, 400, { error: 'invalid_json' }); }

    const mode = body.mode === 'barcode' ? 'barcode' : body.mode === 'search' ? 'search' : null;
    if (!mode) return json(origin, 400, { error: 'invalid_mode' });
    const ip = callerIp(req);
    if (!allowRate(ip, mode)) return json(origin, 429, { error: 'rate_limited', retry_after_seconds: 60 });

    try {
      if (mode === 'barcode') {
        const code = barcode(body.barcode);
        if (!code) return json(origin, 400, { error: 'invalid_barcode' });
        const cacheKey = `barcode:${code}`;
        const cached = cacheGet(cacheKey);
        if (cached) return json(origin, 200, { ...(cached as object), cached: true });
        const value = await barcodeProduct(code);
        cachePut(cacheKey, value, 60 * 60_000);
        return json(origin, 200, { ...value, cached: false });
      }

      const query = cleanQuery(body.query);
      if (query.length < 2) return json(origin, 400, { error: 'query_too_short' });
      const cacheKey = `search:${query.toLowerCase()}`;
      const cached = cacheGet(cacheKey);
      if (cached) return json(origin, 200, { ...(cached as object), cached: true });
      const value = await searchProducts(query);
      cachePut(cacheKey, value, 15 * 60_000);
      return json(origin, 200, { ...value, cached: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'provider_failed';
      return json(origin, 502, { error: 'provider_failed', detail: message.slice(0, 100) });
    }
  }
};
