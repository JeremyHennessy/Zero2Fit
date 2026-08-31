import { normalizeMealEntry, normalizeMealMap, normalizeSavedMeal, normalizeTargets, mealFingerprint } from './nutrition-core.mjs';

const cleanText = value => String(value ?? '').trim();
const REMOTE_PROVENANCE = new Set(['observed','imported','derived','user-entered']);

function validDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function latestTimestamp(...values) {
  return values.map(validDate).filter(Boolean).sort().at(-1) || null;
}

function meaningfulTargets(targets = {}) {
  return Object.values(normalizeTargets(targets)).some(value => value !== null);
}

export function sessionUserId(session = {}) {
  return session?.user?.id || session?.user_id || null;
}

export function normalizeRemoteProvenance(value) {
  const status = cleanText(value) || 'imported';
  if (REMOTE_PROVENANCE.has(status)) return status;
  if (status === 'user-selected-provider' || status === 'manual' || status === 'user_tracked') return 'user-entered';
  return 'imported';
}

export function eventToRemoteRow(event = {}, userId) {
  if (!userId) throw new Error('A user id is required for remote event storage.');
  if (!event?.event_id || !event?.metric_type || !event?.observed_at) throw new Error('Normalized event is missing its identity, metric type or timestamp.');
  const numeric = typeof event.value === 'number' ? event.value : Number(event.value);
  const hasNumeric = Number.isFinite(numeric) && cleanText(event.value) !== '';
  const provenance = normalizeRemoteProvenance(event.provenance_status);
  const originalProvenance = cleanText(event.provenance_status);
  return {
    user_id: userId,
    event_id: event.event_id,
    metric_type: event.metric_type,
    numeric_value: hasNumeric ? numeric : null,
    text_value: hasNumeric ? null : cleanText(event.value),
    unit: event.unit || 'unknown',
    observed_at: event.observed_at,
    end_at: event.end_at || null,
    source_provider: event.source_provider || 'unknown',
    source_device: event.source_device || null,
    source_record_id: event.source_record_id || null,
    imported_at: event.imported_at || new Date().toISOString(),
    provenance_status: provenance,
    confidence: event.confidence || 'imported',
    metadata: {
      ...(event.metadata || {}),
      ...(originalProvenance && originalProvenance !== provenance ? { original_provenance_status:originalProvenance } : {})
    }
  };
}

export function remoteRowToEvent(row = {}) {
  const value = row.numeric_value !== null && row.numeric_value !== undefined ? Number(row.numeric_value) : row.text_value;
  return {
    event_id: row.event_id,
    metric_type: row.metric_type,
    value,
    unit: row.unit || 'unknown',
    observed_at: row.observed_at,
    end_at: row.end_at || null,
    source_provider: row.source_provider || 'unknown',
    source_device: row.source_device || null,
    source_record_id: row.source_record_id || null,
    imported_at: row.imported_at || null,
    provenance_status: row.provenance_status || 'imported',
    confidence: row.confidence || 'imported',
    metadata: row.metadata || {}
  };
}

export function sourceBundleId(event = {}) {
  return cleanText(event?.metadata?.source_bundle_id);
}

export function verificationMatchesEvent(verification = {}, event = {}) {
  if (event?.source_provider !== 'healthkit_bridge') return false;
  const bundleId = sourceBundleId(event);
  if (!bundleId || cleanText(verification.source_bundle_id) !== bundleId) return false;
  const metrics = Array.isArray(verification.metric_types) ? verification.metric_types.filter(Boolean) : [];
  return metrics.length === 0 || metrics.includes(event.metric_type);
}

export function applySourceVerifications(events = [], verifications = []) {
  return events.map(event => {
    const verification = verifications.find(candidate => verificationMatchesEvent(candidate, event));
    if (!verification) {
      if (event?.source_provider !== 'healthkit_bridge') return event;
      return {
        ...event,
        metadata: {
          ...(event.metadata || {}),
          verified: false,
          source_verification_status: 'unverified'
        }
      };
    }
    return {
      ...event,
      metadata: {
        ...(event.metadata || {}),
        verified: true,
        source_verification_status: 'verified',
        source_verification_id: verification.verification_id,
        verified_provider: verification.provider,
        verified_at: verification.verified_at
      }
    };
  });
}

export function normalizeSourceObservation(observation = {}, userId) {
  if (!userId) throw new Error('A user id is required for source observations.');
  const sourceBundle = cleanText(observation.source_bundle_id);
  const metricType = cleanText(observation.metric_type);
  if (!sourceBundle || !metricType) throw new Error('Source observation requires source_bundle_id and metric_type.');
  return {
    user_id: userId,
    source_bundle_id: sourceBundle,
    source_name: cleanText(observation.source_name) || null,
    metric_type: metricType,
    sample_count: Math.max(0, Number(observation.sample_count || 0)),
    first_observed_at: observation.first_observed_at || null,
    last_observed_at: observation.last_observed_at || null,
    last_sync_at: observation.last_sync_at || new Date().toISOString(),
    metadata: observation.metadata || {}
  };
}

export function sourceObservationKey(observation = {}) {
  return `${cleanText(observation.source_bundle_id)}|${cleanText(observation.metric_type)}`;
}

export function mergeSourceObservations(existing = [], incoming = []) {
  const merged = new Map(existing.map(row => [sourceObservationKey(row), { ...row }]));
  for (const row of incoming) {
    const key = sourceObservationKey(row);
    if (!key || key === '|') continue;
    const prior = merged.get(key);
    if (!prior) {
      merged.set(key, { ...row });
      continue;
    }
    const first = [prior.first_observed_at, row.first_observed_at].filter(Boolean).sort()[0] || null;
    const last = [prior.last_observed_at, row.last_observed_at].filter(Boolean).sort().at(-1) || null;
    merged.set(key, {
      ...prior,
      ...row,
      sample_count: Math.max(Number(prior.sample_count || 0), Number(row.sample_count || 0)),
      first_observed_at: first,
      last_observed_at: last,
      metadata: { ...(prior.metadata || {}), ...(row.metadata || {}) }
    });
  }
  return [...merged.values()];
}

export function fuelEntryEventInput(entry = {}, day = null) {
  const normalized = normalizeMealEntry(entry, { day:day || entry.day });
  const observedAt = validDate(normalized.loggedAt) || validDate(`${normalized.day}T12:00:00`) || new Date().toISOString();
  const provider = normalized.source === 'open_food_facts' ? 'open_food_facts' : 'zero2fit';
  return {
    metricType:'nutrition_entry',
    value:Number(normalized.calories || 0),
    unit:'kcal',
    observedAt,
    sourceProvider:provider,
    sourceDevice:'web_app',
    sourceRecordId:`nutrition:${normalized.id}`,
    provenanceStatus:'user-entered',
    confidence:provider === 'open_food_facts' ? 'provider_reported' : 'user_tracked',
    metadata:{
      fuel_entry_id:normalized.id,
      date:normalized.day,
      name:normalized.name,
      protein_g:Number(normalized.protein || 0),
      carbs_g:Number(normalized.carbs || 0),
      fat_g:Number(normalized.fat || 0),
      meal_type:normalized.mealType,
      serving:normalized.serving || null,
      logging_method:normalized.source || 'manual',
      source_item_id:normalized.sourceItemId || null,
      barcode:normalized.barcode || null,
      selection_provenance:provider === 'open_food_facts' ? 'user-selected-provider' : 'user-entered',
      backfilled:normalized.day !== new Date(observedAt).toLocaleDateString('en-CA')
    }
  };
}

export function fuelDeletionEventInput(entry = {}, deletedAt = new Date().toISOString()) {
  const normalized = normalizeMealEntry(entry, { day:entry.day });
  const observedAt = validDate(deletedAt) || new Date().toISOString();
  return {
    metricType:'nutrition_entry_deleted',
    value:1,
    unit:'flag',
    observedAt,
    sourceProvider:'zero2fit',
    sourceDevice:'web_app',
    sourceRecordId:`nutrition-delete:${normalized.id}`,
    provenanceStatus:'user-entered',
    confidence:'user_tracked',
    metadata:{ fuel_entry_id:normalized.id, date:normalized.day, name:normalized.name, deleted_at:observedAt }
  };
}

export function nutritionEventToFuelEntry(event = {}) {
  if (event?.metric_type !== 'nutrition_entry') return null;
  const metadata = event.metadata || {};
  const recordId = cleanText(event.source_record_id);
  const entryId = cleanText(metadata.fuel_entry_id) || (recordId.startsWith('nutrition:') ? recordId.slice('nutrition:'.length) : '') || cleanText(event.event_id);
  const day = cleanText(metadata.date) || cleanText(event.observed_at).slice(0,10);
  if (!entryId || !day) return null;
  return normalizeMealEntry({
    id:entryId,
    day,
    name:metadata.name || 'Food entry',
    calories:Number(event.value || 0),
    protein:Number(metadata.protein_g || 0),
    carbs:Number(metadata.carbs_g || 0),
    fat:Number(metadata.fat_g || 0),
    serving:metadata.serving || '',
    mealType:metadata.meal_type || 'meal',
    source:metadata.logging_method || event.source_provider || 'manual',
    sourceItemId:metadata.source_item_id || '',
    barcode:metadata.barcode || '',
    loggedAt:event.observed_at
  }, { day });
}

export function deletedFuelEntryIds(events = []) {
  const deleted = new Map();
  for (const event of events) {
    if (event?.metric_type !== 'nutrition_entry_deleted') continue;
    const id = cleanText(event?.metadata?.fuel_entry_id) || cleanText(event.source_record_id).replace(/^nutrition-delete:/,'');
    if (!id) continue;
    const timestamp = validDate(event?.metadata?.deleted_at || event.observed_at) || '';
    const prior = deleted.get(id);
    if (!prior || timestamp > prior) deleted.set(id, timestamp);
  }
  return deleted;
}

export function mergeFuelHistory(localMeals = {}, events = []) {
  const result = normalizeMealMap(localMeals || {});
  const deleted = deletedFuelEntryIds(events);
  const byDay = new Map();
  for (const [day, entries] of Object.entries(result)) {
    byDay.set(day, new Map(entries.filter(entry => !deleted.has(entry.id)).map(entry => [entry.id, entry])));
  }
  for (const event of events) {
    const entry = nutritionEventToFuelEntry(event);
    if (!entry || deleted.has(entry.id)) continue;
    if (!byDay.has(entry.day)) byDay.set(entry.day, new Map());
    const existing = byDay.get(entry.day).get(entry.id);
    byDay.get(entry.day).set(entry.id, existing ? { ...entry, ...existing } : entry);
  }
  return Object.fromEntries([...byDay.entries()]
    .map(([day,map]) => [day,[...map.values()].sort((a,b) => String(a.loggedAt).localeCompare(String(b.loggedAt)))])
    .filter(([,entries]) => entries.length));
}

export function normalizeFuelPreferences(payload = {}) {
  const saved = Array.isArray(payload.saved_meals) ? payload.saved_meals.map((entry,index) => normalizeSavedMeal(entry,index)) : [];
  return {
    schemaVersion:Number(payload.schema_version || 1),
    nutritionTargets:normalizeTargets(payload.nutrition_targets || {}),
    targetsUpdatedAt:validDate(payload.targets_updated_at),
    savedMeals:saved,
    savedMealsUpdatedAt:validDate(payload.saved_meals_updated_at)
  };
}

export function fuelPreferencesFromState(state = {}) {
  const targets = normalizeTargets(state.nutritionTargets || {});
  const savedMeals = Array.isArray(state.savedMeals) ? state.savedMeals.map((entry,index) => normalizeSavedMeal(entry,index)) : [];
  const syncMeta = state.syncMeta || {};
  const inferredTargetAt = meaningfulTargets(targets) ? validDate(state.updatedAt || state.migratedFromLegacyAt) : null;
  const inferredSavedAt = savedMeals.length ? latestTimestamp(...savedMeals.map(entry => entry.savedAt), state.updatedAt || state.migratedFromLegacyAt) : null;
  return {
    schemaVersion:1,
    nutritionTargets:targets,
    targetsUpdatedAt:validDate(syncMeta.targetsUpdatedAt) || inferredTargetAt,
    savedMeals,
    savedMealsUpdatedAt:validDate(syncMeta.savedMealsUpdatedAt) || inferredSavedAt
  };
}

export function mergeFuelPreferences(localState = {}, remotePayload = {}) {
  const local = fuelPreferencesFromState(localState);
  const remote = normalizeFuelPreferences(remotePayload);
  const remoteTargetsWin = Boolean(remote.targetsUpdatedAt && (!local.targetsUpdatedAt || remote.targetsUpdatedAt > local.targetsUpdatedAt));
  const remoteSavedWin = Boolean(remote.savedMealsUpdatedAt && (!local.savedMealsUpdatedAt || remote.savedMealsUpdatedAt > local.savedMealsUpdatedAt));
  const nutritionTargets = remoteTargetsWin ? remote.nutritionTargets : local.nutritionTargets;
  const savedMeals = remoteSavedWin ? remote.savedMeals : local.savedMeals;
  const targetsUpdatedAt = remoteTargetsWin ? remote.targetsUpdatedAt : local.targetsUpdatedAt;
  const savedMealsUpdatedAt = remoteSavedWin ? remote.savedMealsUpdatedAt : local.savedMealsUpdatedAt;
  return {
    nutritionTargets,
    savedMeals,
    syncMeta:{ targetsUpdatedAt:targetsUpdatedAt || null, savedMealsUpdatedAt:savedMealsUpdatedAt || null },
    remotePayload:{
      schema_version:1,
      nutrition_targets:nutritionTargets,
      targets_updated_at:targetsUpdatedAt || null,
      saved_meals:savedMeals,
      saved_meals_updated_at:savedMealsUpdatedAt || null
    }
  };
}

export function fuelPreferenceFingerprint(state = {}) {
  const value = fuelPreferencesFromState(state);
  return JSON.stringify({
    targets:value.nutritionTargets,
    targetsUpdatedAt:value.targetsUpdatedAt,
    saved:value.savedMeals.map(item => mealFingerprint(item)),
    savedUpdatedAt:value.savedMealsUpdatedAt
  });
}
