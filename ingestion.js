(() => {
  'use strict';

  const nowIso = () => new Date().toISOString();

  const appleTypeMap = {
    HKQuantityTypeIdentifierStepCount: ['steps', 'count', 'measured'],
    HKQuantityTypeIdentifierBodyMass: ['weight', null, 'measured'],
    HKQuantityTypeIdentifierBodyFatPercentage: ['body_fat_percentage', '%', 'trend_estimate'],
    HKQuantityTypeIdentifierBodyMassIndex: ['bmi', 'index', 'derived'],
    HKQuantityTypeIdentifierLeanBodyMass: ['lean_body_mass', null, 'trend_estimate'],
    HKQuantityTypeIdentifierHeartRate: ['heart_rate', 'bpm', 'measured'],
    HKQuantityTypeIdentifierRestingHeartRate: ['resting_heart_rate', 'bpm', 'measured'],
    HKQuantityTypeIdentifierHeartRateVariabilitySDNN: ['hrv_sdnn', 'ms', 'measured'],
    HKQuantityTypeIdentifierOxygenSaturation: ['spo2', '%', 'measured'],
    HKQuantityTypeIdentifierActiveEnergyBurned: ['active_energy', 'kcal', 'estimated'],
    HKQuantityTypeIdentifierDistanceWalkingRunning: ['walking_running_distance', null, 'measured'],
    HKQuantityTypeIdentifierAppleExerciseTime: ['exercise_time', 'min', 'measured'],
    HKQuantityTypeIdentifierVO2Max: ['vo2_max', 'mL/kg/min', 'estimated']
  };

  const renphoMetricDefinitions = [
    { metric: 'weight', keys: ['weight', 'bodyweight'], confidence: 'measured', unitFromHeader: true },
    { metric: 'bmi', keys: ['bmi', 'bodymassindex'], confidence: 'derived', unit: 'index' },
    { metric: 'body_fat_percentage', keys: ['bodyfat', 'bodyfatpercentage', 'bodyfatpct'], confidence: 'trend_estimate', unit: '%' },
    { metric: 'fat_free_weight', keys: ['fatfreebodyweight', 'fatfreeweight', 'fatfreemass'], confidence: 'trend_estimate', unitFromHeader: true },
    { metric: 'subcutaneous_fat', keys: ['subcutaneousfat'], confidence: 'trend_estimate', unit: '%' },
    { metric: 'visceral_fat', keys: ['visceralfat'], confidence: 'trend_estimate', unit: 'level' },
    { metric: 'body_water_percentage', keys: ['bodywater', 'water', 'bodywaterpercentage'], confidence: 'trend_estimate', unit: '%' },
    { metric: 'skeletal_muscle_percentage', keys: ['skeletalmuscle', 'skeletalmusclepercentage'], confidence: 'trend_estimate', unit: '%' },
    { metric: 'muscle_mass', keys: ['musclemass', 'muscle'], confidence: 'trend_estimate', unitFromHeader: true },
    { metric: 'bone_mass', keys: ['bonemass', 'bone'], confidence: 'trend_estimate', unitFromHeader: true },
    { metric: 'protein_percentage', keys: ['protein', 'proteinpercentage'], confidence: 'trend_estimate', unit: '%' },
    { metric: 'bmr', keys: ['bmr', 'basalmetabolicrate'], confidence: 'derived', unit: 'kcal/day' },
    { metric: 'metabolic_age', keys: ['metabolicage', 'bodyage'], confidence: 'derived', unit: 'years' },
    { metric: 'heart_rate', keys: ['heartrate'], confidence: 'measured', unit: 'bpm' }
  ];

  function normalizeHeader(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/%/g, 'percentage')
      .replace(/[^a-z0-9]+/g, '');
  }

  function headerMatchesMetric(header, key) {
    if (header === key) return true;
    const suffixes = ['lb', 'lbs', 'kg', 'percentage', 'pct', 'percent', 'level', 'kcal', 'years', 'bpm'];
    return suffixes.some(suffix => header === `${key}${suffix}`);
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(String(value).replace(/[%,$]/g, '').trim());
    return Number.isFinite(numeric) ? numeric : null;
  }

  function normalizeDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  function inferUnitFromHeader(header) {
    const value = String(header || '').toLowerCase();
    if (/\blbs?\b|pound/.test(value)) return 'lb';
    if (/\bkg\b|kilogram/.test(value)) return 'kg';
    if (/\bcm\b/.test(value)) return 'cm';
    if (/\bin\b|inch/.test(value)) return 'in';
    return null;
  }

  function stableHash(input) {
    let hash = 2166136261;
    const text = String(input);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function makeEvent({ metricType, value, unit, observedAt, endAt = null, sourceProvider, sourceDevice = null, sourceRecordId = null, provenanceStatus = 'imported', confidence = 'imported', metadata = {} }) {
    const importedAt = nowIso();
    const identity = sourceRecordId || `${sourceProvider}|${metricType}|${observedAt}|${value}|${unit || ''}`;
    return {
      event_id: `${sourceProvider}:${stableHash(identity)}`,
      metric_type: metricType,
      value,
      unit: unit || 'unknown',
      observed_at: observedAt,
      end_at: endAt,
      source_provider: sourceProvider,
      source_device: sourceDevice,
      source_record_id: sourceRecordId,
      imported_at: importedAt,
      provenance_status: provenanceStatus,
      confidence,
      metadata
    };
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"' && quoted && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(field.trim());
        field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(field.trim());
        field = '';
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
      } else {
        field += char;
      }
    }

    row.push(field.trim());
    if (row.some(cell => cell !== '')) rows.push(row);
    return rows;
  }

  function parseRenphoCsv(text, fileName = 'renpho.csv') {
    const rows = parseCsv(text);
    if (rows.length < 2) return { events: [], warnings: ['RENPHO CSV did not contain data rows.'] };

    const headers = rows[0];
    const normalizedHeaders = headers.map(normalizeHeader);
    const dateCandidates = ['timeofmeasurement', 'measurementtime', 'datetime', 'timestamp', 'date', 'time', 'createdat', 'measuretime'];
    const dateIndex = normalizedHeaders.findIndex(header => dateCandidates.includes(header));
    const warnings = [];

    if (dateIndex < 0) warnings.push('Measurement date column was not recognized; rows without a usable date were skipped.');

    const metricColumns = renphoMetricDefinitions.map(definition => {
      const index = normalizedHeaders.findIndex(header => definition.keys.some(key => headerMatchesMetric(header, key)));
      return { definition, index, header: index >= 0 ? headers[index] : null };
    }).filter(item => item.index >= 0);

    if (!metricColumns.length) warnings.push('No supported RENPHO measurement columns were recognized.');

    const events = [];
    rows.slice(1).forEach((row, rowIndex) => {
      const observedAt = dateIndex >= 0 ? normalizeDate(row[dateIndex]) : null;
      if (!observedAt) return;

      metricColumns.forEach(({ definition, index, header }) => {
        const value = parseNumber(row[index]);
        if (value === null) return;
        const unit = definition.unit || (definition.unitFromHeader ? inferUnitFromHeader(header) : null) || 'unknown';
        events.push(makeEvent({
          metricType: definition.metric,
          value,
          unit,
          observedAt,
          sourceProvider: 'renpho',
          sourceDevice: 'RENPHO scale',
          sourceRecordId: `${fileName}:${rowIndex + 2}:${definition.metric}`,
          confidence: definition.confidence,
          metadata: { original_header: header, import_format: 'renpho_csv' }
        }));
      });
    });

    return { events, warnings };
  }

  function normalizeAppleValue(type, value) {
    const numeric = parseNumber(value);
    if (numeric === null) return value;
    if (type === 'HKQuantityTypeIdentifierBodyFatPercentage' || type === 'HKQuantityTypeIdentifierOxygenSaturation') {
      return numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
    }
    return numeric;
  }

  function parseAppleHealthXml(text) {
    if (typeof DOMParser === 'undefined') {
      return { events: [], warnings: ['XML parsing is not available in this environment.'] };
    }
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) return { events: [], warnings: ['Apple Health XML could not be parsed.'] };

    const events = [];
    const warnings = [];

    doc.querySelectorAll('Record').forEach((record, index) => {
      const type = record.getAttribute('type');
      const mapping = appleTypeMap[type];
      if (!mapping) {
        if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
          const observedAt = normalizeDate(record.getAttribute('startDate'));
          if (!observedAt) return;
          events.push(makeEvent({
            metricType: 'sleep_stage',
            value: record.getAttribute('value') || 'unknown',
            unit: 'category',
            observedAt,
            endAt: normalizeDate(record.getAttribute('endDate')),
            sourceProvider: 'apple_health',
            sourceDevice: record.getAttribute('device') || null,
            sourceRecordId: `apple-record:${index}`,
            confidence: 'measured',
            metadata: { source_name: record.getAttribute('sourceName'), apple_type: type }
          }));
        }
        return;
      }

      const observedAt = normalizeDate(record.getAttribute('startDate'));
      if (!observedAt) return;
      const [metricType, preferredUnit, confidence] = mapping;
      const originalUnit = record.getAttribute('unit');
      let unit = preferredUnit || originalUnit || 'unknown';
      let value = normalizeAppleValue(type, record.getAttribute('value'));

      if ((type === 'HKQuantityTypeIdentifierBodyFatPercentage' || type === 'HKQuantityTypeIdentifierOxygenSaturation') && unit === '%') {
        value = Number(value);
      }

      events.push(makeEvent({
        metricType,
        value,
        unit,
        observedAt,
        endAt: normalizeDate(record.getAttribute('endDate')),
        sourceProvider: 'apple_health',
        sourceDevice: record.getAttribute('device') || null,
        sourceRecordId: `apple-record:${index}`,
        confidence,
        metadata: {
          source_name: record.getAttribute('sourceName'),
          source_version: record.getAttribute('sourceVersion'),
          apple_type: type,
          original_unit: originalUnit
        }
      }));
    });

    doc.querySelectorAll('Workout').forEach((workout, index) => {
      const observedAt = normalizeDate(workout.getAttribute('startDate'));
      if (!observedAt) return;
      const duration = parseNumber(workout.getAttribute('duration'));
      if (duration === null) return;
      events.push(makeEvent({
        metricType: 'workout_session',
        value: duration,
        unit: workout.getAttribute('durationUnit') || 'min',
        observedAt,
        endAt: normalizeDate(workout.getAttribute('endDate')),
        sourceProvider: 'apple_health',
        sourceDevice: null,
        sourceRecordId: `apple-workout:${index}`,
        confidence: 'measured',
        metadata: {
          activity_type: workout.getAttribute('workoutActivityType'),
          source_name: workout.getAttribute('sourceName'),
          total_energy_burned: parseNumber(workout.getAttribute('totalEnergyBurned')),
          total_energy_unit: workout.getAttribute('totalEnergyBurnedUnit')
        }
      }));
    });

    if (!events.length) warnings.push('No supported Health records were found in the XML file.');
    return { events, warnings };
  }

  function normalizeBundle(json) {
    const sourceEvents = Array.isArray(json) ? json : (json.normalized_events || json.events || []);
    const warnings = [];
    const events = sourceEvents.filter(event => event && event.metric_type && event.observed_at).map(event => {
      if (event.event_id && event.source_provider) return { ...event, imported_at: event.imported_at || nowIso() };
      return makeEvent({
        metricType: event.metric_type,
        value: event.value,
        unit: event.unit,
        observedAt: normalizeDate(event.observed_at) || event.observed_at,
        endAt: event.end_at ? (normalizeDate(event.end_at) || event.end_at) : null,
        sourceProvider: event.source_provider || 'healthkit_bridge',
        sourceDevice: event.source_device || null,
        sourceRecordId: event.source_record_id || null,
        provenanceStatus: event.provenance_status || 'imported',
        confidence: event.confidence || 'imported',
        metadata: event.metadata || {}
      });
    });
    if (!events.length) warnings.push('JSON file did not contain normalized Zero2Fit events.');
    return { events, warnings };
  }

  async function importFile(file, sourceHint = 'auto') {
    if (!file) throw new Error('No file selected.');
    const text = await file.text();
    const name = file.name || 'import';
    const lowerName = name.toLowerCase();
    let parsed;
    let sourceProvider;

    if (sourceHint === 'renpho' || lowerName.endsWith('.csv')) {
      parsed = parseRenphoCsv(text, name);
      sourceProvider = 'renpho';
    } else if (sourceHint === 'apple_health' || lowerName.endsWith('.xml')) {
      parsed = parseAppleHealthXml(text);
      sourceProvider = 'apple_health';
    } else if (sourceHint === 'normalized_json' || lowerName.endsWith('.json')) {
      let json;
      try { json = JSON.parse(text); } catch { throw new Error('JSON import file is not valid JSON.'); }
      parsed = normalizeBundle(json);
      sourceProvider = Array.isArray(json) ? 'healthkit_bridge' : (json.source_provider || 'zero2fit_bundle');
    } else {
      throw new Error('Unsupported import type. Use RENPHO CSV, Apple Health export.xml, or normalized JSON.');
    }

    const deduped = [...new Map(parsed.events.map(event => [event.event_id, event])).values()];
    const importedAt = nowIso();
    return {
      events: deduped,
      warnings: parsed.warnings || [],
      importRecord: {
        import_id: `import:${stableHash(`${name}|${file.size}|${file.lastModified}|${importedAt}`)}`,
        imported_at: importedAt,
        source_provider: sourceProvider,
        file_name: name,
        file_size: file.size,
        event_count: deduped.length,
        warnings: parsed.warnings || []
      }
    };
  }

  window.Zero2FitIngestion = {
    makeEvent,
    parseRenphoCsv,
    parseAppleHealthXml,
    normalizeBundle,
    importFile
  };
})();
