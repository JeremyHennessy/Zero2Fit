const appleMetricMap = {
  HKQuantityTypeIdentifierBodyMass: ['body_mass', 'observed'],
  HKQuantityTypeIdentifierStepCount: ['steps', 'observed'],
  HKQuantityTypeIdentifierHeartRate: ['heart_rate', 'observed'],
  HKQuantityTypeIdentifierRestingHeartRate: ['resting_heart_rate', 'observed'],
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: ['hrv_sdnn', 'observed'],
  HKQuantityTypeIdentifierOxygenSaturation: ['oxygen_saturation', 'observed'],
  HKQuantityTypeIdentifierActiveEnergyBurned: ['active_energy', 'observed'],
  HKQuantityTypeIdentifierBasalEnergyBurned: ['basal_energy', 'observed'],
  HKQuantityTypeIdentifierDistanceWalkingRunning: ['walking_running_distance', 'observed'],
  HKQuantityTypeIdentifierBodyFatPercentage: ['body_fat_percentage', 'estimated'],
  HKQuantityTypeIdentifierLeanBodyMass: ['lean_body_mass', 'estimated']
};

const renphoAliases = {
  observedAt: ['time', 'date', 'measurement time', 'measurement date', 'create time', 'created at'],
  body_mass: ['weight', 'body weight'],
  bmi: ['bmi'],
  body_fat_percentage: ['body fat', 'body fat %', 'body fat percentage'],
  fat_free_mass: ['fat-free body weight', 'fat free body weight', 'fat-free mass', 'fat free mass'],
  subcutaneous_fat: ['subcutaneous fat', 'subcutaneous fat %'],
  visceral_fat: ['visceral fat'],
  body_water_percentage: ['body water', 'body water %', 'water', 'water %'],
  skeletal_muscle_percentage: ['skeletal muscle', 'skeletal muscle %'],
  muscle_mass: ['muscle mass'],
  bone_mass: ['bone mass'],
  protein_percentage: ['protein', 'protein %'],
  bmr: ['bmr', 'basal metabolic rate'],
  metabolic_age: ['metabolic age', 'body age']
};

const renphoQuality = {
  body_mass: 'observed',
  bmi: 'derived',
  body_fat_percentage: 'estimated',
  fat_free_mass: 'estimated',
  subcutaneous_fat: 'estimated',
  visceral_fat: 'estimated',
  body_water_percentage: 'estimated',
  skeletal_muscle_percentage: 'estimated',
  muscle_mass: 'estimated',
  bone_mass: 'estimated',
  protein_percentage: 'estimated',
  bmr: 'derived',
  metabolic_age: 'derived'
};

export function parseAppleHealthXmlText(xmlText) {
  const measurements = [];
  const workouts = [];
  const recordRe = /<Record\s+([^>]*?)(?:\/?>)/g;
  const workoutRe = /<Workout\s+([^>]*?)(?:\/?>)/g;
  let match;

  while ((match = recordRe.exec(xmlText))) {
    const attrs = parseXmlAttributes(match[1]);
    const mapped = appleMetricMap[attrs.type];
    if (!mapped || attrs.value == null || !attrs.startDate) continue;
    const numeric = Number(attrs.value);
    if (!Number.isFinite(numeric)) continue;
    const [metric, quality] = mapped;
    const normalizedValue = normalizeAppleValue(attrs.type, numeric, attrs.unit);
    const unit = normalizeAppleUnit(attrs.type, attrs.unit);
    measurements.push(makeMeasurement({
      metric,
      value: normalizedValue,
      unit,
      observedAt: attrs.startDate,
      quality,
      sourceFamily: inferAppleSourceFamily(attrs),
      app: attrs.sourceName || 'Apple Health',
      device: attrs.device || null,
      transport: 'apple_health_export',
      sourceRecordId: attrs.uuid || null,
      raw: attrs
    }));
  }

  while ((match = workoutRe.exec(xmlText))) {
    const attrs = parseXmlAttributes(match[1]);
    if (!attrs.startDate) continue;
    const durationSeconds = convertDurationToSeconds(Number(attrs.duration), attrs.durationUnit);
    workouts.push({
      id: stableId(['apple_health', 'workout', attrs.uuid || '', attrs.workoutActivityType || '', attrs.startDate, attrs.endDate || '', durationSeconds || '']),
      workoutType: normalizeWorkoutType(attrs.workoutActivityType),
      startedAt: attrs.startDate,
      endedAt: attrs.endDate || null,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null,
      activeEnergyKcal: numberOrNull(attrs.totalEnergyBurned),
      totalEnergyKcal: null,
      distanceMeters: normalizeDistance(attrs.totalDistance, attrs.totalDistanceUnit),
      source: {
        family: inferAppleSourceFamily(attrs),
        app: attrs.sourceName || 'Apple Health',
        device: attrs.device || null,
        transport: 'apple_health_export'
      },
      raw: attrs
    });
  }

  return dedupeBundle({ measurements, workouts });
}

export function parseRenphoCsvText(csvText, options = {}) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { measurements: [], workouts: [], warnings: ['RENPHO CSV contains no data rows.'] };
  const headers = rows[0].map(normalizeHeader);
  const columns = resolveRenphoColumns(headers);
  const measurements = [];
  const warnings = [];

  if (columns.observedAt == null) warnings.push('No recognized RENPHO date/time column; rows without a parseable timestamp are skipped.');
  if (columns.body_mass == null) warnings.push('No recognized RENPHO weight column was found.');

  for (const row of rows.slice(1)) {
    if (!row.some(cell => String(cell).trim())) continue;
    const observedRaw = columns.observedAt == null ? '' : row[columns.observedAt];
    const observedAt = normalizeDate(observedRaw);
    if (!observedAt) continue;

    for (const metric of Object.keys(renphoQuality)) {
      const index = columns[metric];
      if (index == null) continue;
      const parsed = parseNumberAndUnit(row[index]);
      if (!Number.isFinite(parsed.value)) continue;
      const normalized = normalizeRenphoMetric(metric, parsed.value, parsed.unit, headers[index]);
      measurements.push(makeMeasurement({
        metric,
        value: normalized.value,
        unit: normalized.unit,
        observedAt,
        quality: renphoQuality[metric],
        sourceFamily: 'renpho',
        app: options.app || 'RENPHO Health',
        device: options.device || 'RENPHO scale (model pending verification)',
        transport: 'csv_export',
        raw: Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
      }));
    }
  }

  return { ...dedupeBundle({ measurements, workouts: [] }), warnings };
}

export function summarizeImport(bundle) {
  const metricCounts = {};
  for (const item of bundle.measurements || []) metricCounts[item.metric] = (metricCounts[item.metric] || 0) + 1;
  return {
    measurementCount: (bundle.measurements || []).length,
    workoutCount: (bundle.workouts || []).length,
    metricCounts,
    warnings: bundle.warnings || []
  };
}

export function mergeMeasurements(existing = [], incoming = []) {
  const map = new Map();
  for (const item of [...existing, ...incoming]) map.set(item.id, item);
  return [...map.values()].sort((a, b) => String(a.observedAt).localeCompare(String(b.observedAt)));
}

function makeMeasurement({ metric, value, unit, observedAt, quality, sourceFamily, app, device, transport, sourceRecordId, raw }) {
  const source = { family: sourceFamily, app, device, transport };
  return {
    id: stableId([sourceFamily, metric, sourceRecordId || '', observedAt, value, unit || '']),
    metric,
    value,
    unit: unit || null,
    observedAt,
    source,
    quality,
    raw: raw || {}
  };
}

function parseXmlAttributes(text) {
  const attrs = {};
  const attrRe = /([\w:.-]+)="([^"]*)"/g;
  let match;
  while ((match = attrRe.exec(text))) attrs[match[1]] = decodeXml(match[2]);
  return attrs;
}

function decodeXml(value) {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function inferAppleSourceFamily(attrs) {
  const source = `${attrs.sourceName || ''} ${attrs.device || ''}`.toLowerCase();
  if (source.includes('zepp') || source.includes('amazfit')) return 'amazfit_zepp';
  if (source.includes('renpho')) return 'renpho';
  return 'apple_health';
}

function normalizeAppleValue(type, value, unit) {
  if (type === 'HKQuantityTypeIdentifierOxygenSaturation' && unit === '%') return value;
  if (type === 'HKQuantityTypeIdentifierOxygenSaturation' && value <= 1) return value * 100;
  if (type === 'HKQuantityTypeIdentifierBodyFatPercentage' && value <= 1) return value * 100;
  return value;
}

function normalizeAppleUnit(type, unit) {
  if (type === 'HKQuantityTypeIdentifierOxygenSaturation' || type === 'HKQuantityTypeIdentifierBodyFatPercentage') return '%';
  return unit || null;
}

function normalizeWorkoutType(type = '') {
  return type.replace(/^HKWorkoutActivityType/, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim() || 'Workout';
}

function convertDurationToSeconds(value, unit = '') {
  if (!Number.isFinite(value)) return null;
  const normalized = String(unit).toLowerCase();
  if (normalized.startsWith('sec')) return value;
  if (normalized.startsWith('hour')) return value * 3600;
  return value * 60;
}

function normalizeDistance(value, unit = '') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const normalized = String(unit).toLowerCase();
  if (normalized === 'km') return numeric * 1000;
  if (normalized === 'mi') return numeric * 1609.344;
  if (normalized === 'ft') return numeric * 0.3048;
  return numeric;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  row.push(cell.replace(/\r$/, ''));
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || '').replace(/^\ufeff/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveRenphoColumns(headers) {
  const result = {};
  for (const [field, aliases] of Object.entries(renphoAliases)) {
    const index = headers.findIndex(header => aliases.some(alias => header === alias || header.startsWith(`${alias} (`) || header.startsWith(`${alias}[`) || header.startsWith(`${alias} `)));
    if (index >= 0) result[field] = index;
  }
  return result;
}

function parseNumberAndUnit(value) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { value: NaN, unit: '' };
  return { value: Number(match[1]), unit: match[2].trim().toLowerCase() };
}

function normalizeRenphoMetric(metric, value, unit, header) {
  const h = String(header || '').toLowerCase();
  if (metric === 'body_mass' || metric === 'fat_free_mass' || metric === 'muscle_mass' || metric === 'bone_mass') {
    if (unit.includes('lb') || h.includes('(lb') || h.includes('[lb')) return { value: round(value * 0.45359237, 4), unit: 'kg' };
    if (unit.includes('stone') || unit === 'st') return { value: round(value * 6.35029318, 4), unit: 'kg' };
    return { value, unit: 'kg' };
  }
  if (metric.includes('percentage') || metric === 'subcutaneous_fat') return { value, unit: '%' };
  if (metric === 'visceral_fat' || metric === 'metabolic_age' || metric === 'bmi') return { value, unit: null };
  if (metric === 'bmr') return { value, unit: 'kcal/day' };
  return { value, unit: unit || null };
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if (!match) return null;
  let [, a, b, year, hour = '0', minute = '0', second = '0', ampm] = match;
  let month = Number(a);
  let day = Number(b);
  if (month > 12 && day <= 12) [month, day] = [day, month];
  let h = Number(hour);
  if (ampm) {
    const upper = ampm.toUpperCase();
    if (upper === 'PM' && h < 12) h += 12;
    if (upper === 'AM' && h === 12) h = 0;
  }
  const date = new Date(Number(year), month - 1, day, h, Number(minute), Number(second));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stableId(parts) {
  const input = parts.map(part => String(part ?? '')).join('|');
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `z2f_${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

function dedupeBundle(bundle) {
  const measurements = [...new Map((bundle.measurements || []).map(item => [item.id, item])).values()];
  const workouts = [...new Map((bundle.workouts || []).map(item => [item.id, item])).values()];
  return { measurements, workouts, warnings: bundle.warnings || [] };
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function round(value, digits) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
