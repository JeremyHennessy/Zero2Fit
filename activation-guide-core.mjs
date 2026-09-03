export const ACTIVATION_SNAPSHOT_METRIC = 'acceptance_browser_snapshot';

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function flattenMeals(fuelState = {}) {
  return Object.entries(fuelState?.meals || {}).flatMap(([day, rows]) =>
    (Array.isArray(rows) ? rows : []).map(entry => ({ ...entry, day:entry?.day || day }))
  );
}

export function targetCount(targets = {}) {
  return ['calories','protein','carbs','fat'].filter(key => Number(targets?.[key]) > 0).length;
}

export function fuelEvidence(fuelState = {}, events = [], lastSync = {}) {
  const meals = flattenMeals(fuelState);
  const manual = meals.filter(entry => ['manual','quick_line'].includes(String(entry?.source || '')));
  const provider = meals.filter(entry => String(entry?.source || '') === 'open_food_facts');
  const remoteProvider = (events || []).filter(event => event?.metric_type === 'nutrition_entry' && event?.source_provider === 'open_food_facts');
  const tombstones = (events || []).filter(event => event?.metric_type === 'nutrition_entry_deleted');
  return {
    entries:meals.length,
    manual_entries:manual.length,
    provider_entries:Math.max(provider.length, remoteProvider.length),
    saved_meals:Array.isArray(fuelState?.savedMeals) ? fuelState.savedMeals.length : 0,
    targets_set:targetCount(fuelState?.nutritionTargets),
    tombstones:tombstones.length,
    synced:Boolean(lastSync?.synced_at && Number.isFinite(Number(lastSync?.fuel_history_entries))),
    remote_entries:number(lastSync?.fuel_history_entries),
    remote_deleted:number(lastSync?.fuel_deleted_entries)
  };
}

export function exerciseHistorySignature(state = {}) {
  const rows = Array.isArray(state?.exerciseHistory) ? [...state.exerciseHistory] : [];
  const normalized = rows
    .filter(row => row?.exerciseId && row?.day)
    .sort((a,b) => `${b.day}|${b.exerciseId}`.localeCompare(`${a.day}|${a.exerciseId}`))
    .slice(0, 12)
    .map(row => [
      row.day,
      row.exerciseId,
      number(row.completedSets),
      Number.isFinite(Number(row.workingLoad)) ? Number(row.workingLoad) : null,
      Number.isFinite(Number(row.maxReps)) ? Number(row.maxReps) : null,
      Array.isArray(row.sets) ? row.sets.map(set => [number(set?.reps), Number.isFinite(Number(set?.load)) ? Number(set.load) : null, Boolean(set?.done)]) : []
    ]);
  return normalized.length ? JSON.stringify(normalized) : null;
}

export function workoutEvidence(state = {}, lastSync = {}) {
  const history = Array.isArray(state?.workoutHistory) ? state.workoutHistory : [];
  return {
    completed_sessions:Math.max(history.length, number(state?.completedWorkouts)),
    history_rows:Array.isArray(state?.exerciseHistory) ? state.exerciseHistory.length : 0,
    history_signature:exerciseHistorySignature(state),
    synced_sessions:number(lastSync?.workout_sessions),
    synced_sets:number(lastSync?.workout_sets),
    synced:Boolean(lastSync?.synced_at && number(lastSync?.workout_sessions) > 0 && number(lastSync?.workout_sets) > 0)
  };
}

export function photoEvidence(photoMetadata = [], events = [], lastSync = {}, previous = {}) {
  const tombstones = (events || []).filter(event => event?.metric_type === 'progress_photo_deleted').length;
  return {
    local_assets:Array.isArray(photoMetadata) ? photoMetadata.length : 0,
    remote_assets:number(lastSync?.progress_photo_remote_assets),
    tombstones,
    ever_uploaded:Boolean(previous?.ever_uploaded || number(lastSync?.progress_photo_uploaded) > 0),
    ever_downloaded:Boolean(previous?.ever_downloaded || number(lastSync?.progress_photo_downloaded) > 0),
    ever_deleted_remote:Boolean(previous?.ever_deleted_remote || number(lastSync?.progress_photo_deleted_assets) > 0)
  };
}

export function privateAcceptanceEvidence(localResult = null, preferenceRow = null) {
  const cloud = preferenceRow?.settings?.zero2fit_acceptance_v1 || null;
  const localPassed = Boolean(localResult?.passed);
  const cloudChecks = Array.isArray(cloud?.checks) ? cloud.checks : [];
  const legacyCloudPassed = Boolean(cloud?.passed_at && cloudChecks.length > 0 && cloudChecks.every(check => check?.status === 'pass'));
  const cloudPassed = Boolean(cloud?.passed === true || legacyCloudPassed);
  return {
    passed:Boolean(localPassed || cloudPassed),
    local_passed:localPassed,
    cloud_passed:cloudPassed,
    run_id:cloud?.run_id || localResult?.run_id || null,
    finished_at:cloud?.finished_at || cloud?.passed_at || localResult?.finished_at || null,
    check_count:cloudChecks.length || (Array.isArray(localResult?.checks) ? localResult.checks.length : 0)
  };
}

export function deviceEvidence(observations = [], verifications = [], manual = {}) {
  const bundles = new Map();
  for (const row of observations || []) {
    const bundle = row?.source_bundle_id;
    if (!bundle) continue;
    if (!bundles.has(bundle)) bundles.set(bundle, new Set());
    if (row?.metric_type) bundles.get(bundle).add(row.metric_type);
  }
  const providerRows = provider => (verifications || []).filter(row => row?.provider === provider);
  const verifiedMetrics = provider => {
    const metrics = new Set();
    for (const row of providerRows(provider)) {
      for (const metric of bundles.get(row.source_bundle_id) || []) metrics.add(metric);
    }
    return metrics.size;
  };
  return {
    observed_bundles:bundles.size,
    zepp_verified:providerRows('zepp').length > 0,
    renpho_verified:providerRows('renpho').length > 0,
    zepp_metric_types:verifiedMetrics('zepp'),
    renpho_metric_types:verifiedMetrics('renpho'),
    value_parity_confirmed:Boolean(manual?.healthkit_value_parity),
    background_delivery_confirmed:Boolean(manual?.healthkit_background_delivery),
    renpho_label_confirmed:Boolean(manual?.renpho_model_label)
  };
}

export function activationSnapshotEventInput(snapshot, observedAt = new Date().toISOString()) {
  if (!snapshot?.browser_instance_id) throw new Error('Activation snapshot requires browser_instance_id.');
  return {
    metricType:ACTIVATION_SNAPSHOT_METRIC,
    value:1,
    unit:'check',
    observedAt,
    sourceProvider:'zero2fit_activation_guide',
    sourceDevice:'web_app',
    sourceRecordId:`activation:${snapshot.browser_instance_id}`,
    provenanceStatus:'user-entered',
    confidence:'system_verified',
    metadata:{ activation_guide_v1:snapshot }
  };
}

export function latestBrowserSnapshots(events = []) {
  const latest = new Map();
  for (const event of events || []) {
    if (event?.metric_type !== ACTIVATION_SNAPSHOT_METRIC) continue;
    const snapshot = event?.metadata?.activation_guide_v1;
    const id = snapshot?.browser_instance_id;
    if (!id) continue;
    const prior = latest.get(id);
    if (!prior || String(event.observed_at || '') >= String(prior.observed_at || '')) {
      latest.set(id, { ...snapshot, observed_at:event.observed_at || snapshot.recorded_at || null });
    }
  }
  return [...latest.values()];
}

export function mergedManualEvidence(snapshots = [], local = {}) {
  const merged = {};
  for (const row of snapshots || []) {
    for (const [key,value] of Object.entries(row?.manual || {})) if (value) merged[key] = true;
  }
  for (const [key,value] of Object.entries(local || {})) merged[key] = Boolean(value);
  return merged;
}

function browserCountWhere(snapshots, predicate) {
  return new Set((snapshots || []).filter(predicate).map(row => row.browser_instance_id)).size;
}

export function crossBrowserEvidence(snapshots = []) {
  const clean = (snapshots || []).filter(row => row?.browser_instance_id && row?.account?.signed_in);
  const browserCount = new Set(clean.map(row => row.browser_instance_id)).size;
  const fuelReconstructed = browserCountWhere(clean, row => number(row?.fuel?.entries) > 0 && row?.fuel?.synced) >= 2;
  const fuelDeletionPropagated = browserCountWhere(clean, row => number(row?.fuel?.tombstones) > 0) >= 2;
  const workoutReconstructed = browserCountWhere(clean, row => number(row?.workout?.history_rows) > 0 && row?.workout?.synced) >= 2;

  const signatures = new Map();
  for (const row of clean) {
    const signature = row?.workout?.history_signature;
    if (!signature) continue;
    if (!signatures.has(signature)) signatures.set(signature, new Set());
    signatures.get(signature).add(row.browser_instance_id);
  }
  const matchingWorkoutHistory = [...signatures.values()].some(ids => ids.size >= 2);

  let photoRoundTrip = false;
  for (const upload of clean.filter(row => row?.photos?.ever_uploaded)) {
    if (clean.some(download => download.browser_instance_id !== upload.browser_instance_id && download?.photos?.ever_downloaded)) {
      photoRoundTrip = true;
      break;
    }
  }
  const photoDeletionPropagated = browserCountWhere(clean, row => number(row?.photos?.tombstones) > 0) >= 2
    && clean.some(row => row?.photos?.ever_deleted_remote);

  return {
    browser_count:browserCount,
    fuel_reconstructed:fuelReconstructed,
    fuel_deletion_propagated:fuelDeletionPropagated,
    workout_reconstructed:workoutReconstructed,
    matching_workout_history:matchingWorkoutHistory,
    photo_round_trip:photoRoundTrip,
    photo_deletion_propagated:photoDeletionPropagated
  };
}

export function build020Steps({ account = {}, infrastructure = {}, fuel = {}, workout = {}, photos = {}, cross = {}, manual = {} } = {}) {
  return [
    { id:'account', label:'Real private account signed in', done:Boolean(account.signed_in) },
    { id:'manual-food', label:'Manual food logged', done:number(fuel.manual_entries) > 0 },
    { id:'provider-food', label:'Open Food Facts item logged', done:number(fuel.provider_entries) > 0 },
    { id:'saved-meal', label:'Saved meal created', done:number(fuel.saved_meals) > 0 },
    { id:'targets', label:'Explicit nutrition targets set', done:number(fuel.targets_set) === 4, partial:number(fuel.targets_set) > 0 && number(fuel.targets_set) < 4 },
    { id:'sync', label:'Private sync completed after infrastructure self-test', done:Boolean(infrastructure.passed && fuel.synced), partial:Boolean(fuel.synced) },
    { id:'second-browser', label:'Second browser reconstructed Fuel', done:Boolean(cross.fuel_reconstructed && number(cross.browser_count) >= 2) },
    { id:'fuel-delete', label:'Fuel deletion tombstone propagated', done:Boolean(cross.fuel_deletion_propagated) },
    { id:'workout', label:'Workout history reconstructed + adaptive target checked', done:Boolean(cross.workout_reconstructed && cross.matching_workout_history && manual.adaptive_second_browser_confirmed), partial:Boolean(cross.workout_reconstructed && cross.matching_workout_history) },
  ];
}

export function physicalDeviceSteps(devices = {}) {
  return [
    { id:'zepp', label:'Exact Zepp HealthKit source verified', done:Boolean(devices.zepp_verified && number(devices.zepp_metric_types) > 0) },
    { id:'renpho', label:'Exact RENPHO HealthKit source verified', done:Boolean(devices.renpho_verified && number(devices.renpho_metric_types) > 0) },
    { id:'parity', label:'Representative values match source app → Apple Health → Zero2Fit', done:Boolean(devices.value_parity_confirmed) },
    { id:'background', label:'Physical HealthKit background delivery confirmed', done:Boolean(devices.background_delivery_confirmed) },
    { id:'renpho-label', label:'RENPHO underside model label confirmed', done:Boolean(devices.renpho_label_confirmed) }
  ];
}

export function summarizeSteps(steps = []) {
  const complete = steps.filter(step => step.done).length;
  const partial = steps.filter(step => !step.done && step.partial).length;
  return { complete, partial, total:steps.length, done:complete === steps.length && steps.length > 0 };
}
