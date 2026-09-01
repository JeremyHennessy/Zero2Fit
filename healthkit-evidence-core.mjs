export const HEALTHKIT_EVIDENCE_METRIC = 'healthkit_acceptance_evidence';
export const EVIDENCE_VERSION = 1;
export const EVIDENCE_STATUSES = ['pending','matched','not_provided','mismatch'];

export const PROVIDER_REQUIREMENTS = {
  zepp: [
    { id:'steps', label:'Steps', metricTypes:['steps'], primary:true },
    { id:'heart_rate', label:'Heart rate', metricTypes:['heart_rate'] },
    { id:'resting_heart_rate', label:'Resting heart rate', metricTypes:['resting_heart_rate'] },
    { id:'hrv_sdnn', label:'HRV (SDNN)', metricTypes:['hrv_sdnn'] },
    { id:'sleep_stage', label:'Sleep / stages', metricTypes:['sleep_stage'] },
    { id:'workout_session', label:'Workouts', metricTypes:['workout_session'] },
    { id:'active_energy', label:'Active energy', metricTypes:['active_energy'] }
  ],
  renpho: [
    { id:'weight', label:'Weight', metricTypes:['weight'], primary:true },
    { id:'body_composition', label:'Body composition', metricTypes:['body_fat_percentage','bmi','lean_body_mass'] }
  ]
};

const cleanText = value => String(value ?? '').trim();
const isoOrNull = value => {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function blankProvider(provider) {
  const metrics = {};
  for (const row of PROVIDER_REQUIREMENTS[provider] || []) metrics[row.id] = 'pending';
  return { candidate_bundle_id:null, source_name:null, metrics, updated_at:null };
}

export function defaultEvidence() {
  return {
    version:EVIDENCE_VERSION,
    providers:{ zepp:blankProvider('zepp'), renpho:blankProvider('renpho') },
    background_delivery:false,
    renpho_model_label:'',
    updated_at:null
  };
}

export function normalizeStatus(value) {
  const status = cleanText(value).toLowerCase();
  return EVIDENCE_STATUSES.includes(status) ? status : 'pending';
}

export function normalizeEvidence(input = {}) {
  const base = defaultEvidence();
  for (const provider of ['zepp','renpho']) {
    const current = input?.providers?.[provider] || {};
    const metrics = { ...base.providers[provider].metrics };
    for (const key of Object.keys(metrics)) metrics[key] = normalizeStatus(current?.metrics?.[key]);
    base.providers[provider] = {
      candidate_bundle_id:cleanText(current.candidate_bundle_id) || null,
      source_name:cleanText(current.source_name) || null,
      metrics,
      updated_at:isoOrNull(current.updated_at)
    };
  }
  base.background_delivery = Boolean(input?.background_delivery);
  base.renpho_model_label = cleanText(input?.renpho_model_label);
  base.updated_at = isoOrNull(input?.updated_at);
  return base;
}

export function groupObservations(observations = []) {
  const bundles = new Map();
  for (const row of observations || []) {
    const bundle = cleanText(row?.source_bundle_id);
    if (!bundle) continue;
    if (!bundles.has(bundle)) {
      bundles.set(bundle, {
        bundle_id:bundle,
        source_name:cleanText(row?.source_name) || null,
        metrics:new Map(),
        sample_count:0,
        first_observed_at:null,
        last_observed_at:null,
        last_sync_at:null
      });
    }
    const item = bundles.get(bundle);
    const metric = cleanText(row?.metric_type);
    const count = Number.isFinite(Number(row?.sample_count)) ? Number(row.sample_count) : 0;
    if (metric) item.metrics.set(metric, (item.metrics.get(metric) || 0) + count);
    item.sample_count += count;
    item.source_name ||= cleanText(row?.source_name) || null;
    const first = isoOrNull(row?.first_observed_at);
    const last = isoOrNull(row?.last_observed_at);
    const sync = isoOrNull(row?.last_sync_at);
    if (first && (!item.first_observed_at || first < item.first_observed_at)) item.first_observed_at = first;
    if (last && (!item.last_observed_at || last > item.last_observed_at)) item.last_observed_at = last;
    if (sync && (!item.last_sync_at || sync > item.last_sync_at)) item.last_sync_at = sync;
  }
  return [...bundles.values()].sort((a,b) => (a.source_name || a.bundle_id).localeCompare(b.source_name || b.bundle_id));
}

export function assignCandidate(evidenceInput, provider, bundle = null, sourceName = null, now = new Date().toISOString()) {
  if (!PROVIDER_REQUIREMENTS[provider]) throw new Error(`Unsupported provider: ${provider}`);
  const evidence = normalizeEvidence(evidenceInput);
  const current = evidence.providers[provider];
  const nextBundle = cleanText(bundle) || null;
  if (current.candidate_bundle_id !== nextBundle) {
    evidence.providers[provider] = blankProvider(provider);
    evidence.providers[provider].candidate_bundle_id = nextBundle;
    evidence.providers[provider].source_name = cleanText(sourceName) || null;
  } else if (sourceName) {
    evidence.providers[provider].source_name = cleanText(sourceName) || null;
  }
  evidence.providers[provider].updated_at = new Date(now).toISOString();
  evidence.updated_at = new Date(now).toISOString();
  return evidence;
}

export function setMetricStatus(evidenceInput, provider, metricId, status, now = new Date().toISOString()) {
  const evidence = normalizeEvidence(evidenceInput);
  if (!Object.prototype.hasOwnProperty.call(evidence.providers?.[provider]?.metrics || {}, metricId)) throw new Error(`Unsupported ${provider} metric: ${metricId}`);
  evidence.providers[provider].metrics[metricId] = normalizeStatus(status);
  evidence.providers[provider].updated_at = new Date(now).toISOString();
  evidence.updated_at = new Date(now).toISOString();
  return evidence;
}

export function setPhysicalField(evidenceInput, field, value, now = new Date().toISOString()) {
  const evidence = normalizeEvidence(evidenceInput);
  if (field === 'background_delivery') evidence.background_delivery = Boolean(value);
  else if (field === 'renpho_model_label') evidence.renpho_model_label = cleanText(value);
  else throw new Error(`Unsupported physical field: ${field}`);
  evidence.updated_at = new Date(now).toISOString();
  return evidence;
}

export function observedMetricTypes(bundleId, observations = []) {
  const grouped = groupObservations(observations);
  const bundle = grouped.find(row => row.bundle_id === bundleId);
  return new Set(bundle ? [...bundle.metrics.keys()] : []);
}

export function metricObservation(provider, requirement, candidateBundleId, observations = []) {
  const observed = observedMetricTypes(candidateBundleId, observations);
  const actual = (requirement?.metricTypes || []).filter(metric => observed.has(metric));
  return { observed:actual.length > 0, metric_types:actual };
}

function duplicateCandidate(evidence, provider) {
  const own = evidence.providers?.[provider]?.candidate_bundle_id;
  const otherProvider = provider === 'zepp' ? 'renpho' : 'zepp';
  const other = evidence.providers?.[otherProvider]?.candidate_bundle_id;
  return Boolean(own && other && own === other);
}

export function providerParity(provider, evidenceInput, observations = []) {
  const evidence = normalizeEvidence(evidenceInput);
  const candidate = evidence.providers?.[provider];
  const requirements = PROVIDER_REQUIREMENTS[provider] || [];
  const result = {
    provider,
    candidate_bundle_id:candidate?.candidate_bundle_id || null,
    source_name:candidate?.source_name || null,
    ready:false,
    has_mismatch:false,
    resolved:0,
    total:requirements.length,
    rows:[],
    blockers:[]
  };
  if (!candidate?.candidate_bundle_id) {
    result.blockers.push('Select the observed source bundle to evaluate.');
    return result;
  }
  const bundles = groupObservations(observations);
  if (!bundles.some(row => row.bundle_id === candidate.candidate_bundle_id)) {
    result.blockers.push('The selected bundle is not present in the current HealthKit source observations.');
  }
  if (duplicateCandidate(evidence, provider)) result.blockers.push('Zepp and RENPHO cannot use the same HealthKit source bundle.');

  let primaryMatched = false;
  for (const requirement of requirements) {
    const observation = metricObservation(provider, requirement, candidate.candidate_bundle_id, observations);
    const status = normalizeStatus(candidate.metrics?.[requirement.id]);
    const resolved = status === 'matched' || status === 'not_provided';
    const validMatched = status !== 'matched' || observation.observed;
    const validNotProvided = status !== 'not_provided' || !observation.observed;
    const row = {
      ...requirement,
      status,
      observed:observation.observed,
      observed_metric_types:observation.metric_types,
      resolved:Boolean(resolved && validMatched && validNotProvided)
    };
    result.rows.push(row);
    if (status === 'mismatch') {
      result.has_mismatch = true;
      result.blockers.push(`${requirement.label} is marked mismatch.`);
    } else if (status === 'pending') {
      result.blockers.push(`${requirement.label} is still pending.`);
    } else if (!validMatched) {
      result.blockers.push(`${requirement.label} cannot be marked matched because the selected bundle has not written that metric.`);
    } else if (!validNotProvided) {
      result.blockers.push(`${requirement.label} is present in the selected bundle and cannot be marked not provided.`);
    } else if (row.resolved) {
      result.resolved += 1;
    }
    if (requirement.primary && status === 'matched' && observation.observed) primaryMatched = true;
  }
  if (!primaryMatched) result.blockers.push(`${provider === 'zepp' ? 'Steps' : 'Weight'} must be physically matched before source verification.`);
  result.ready = result.blockers.length === 0 && result.resolved === result.total && primaryMatched;
  return result;
}

export function physicalParityComplete(evidenceInput, observations = []) {
  return providerParity('zepp', evidenceInput, observations).ready && providerParity('renpho', evidenceInput, observations).ready;
}

export function manualActivationFlags(evidenceInput, observations = []) {
  const evidence = normalizeEvidence(evidenceInput);
  return {
    healthkit_value_parity:physicalParityComplete(evidence, observations),
    healthkit_background_delivery:Boolean(evidence.background_delivery),
    renpho_model_label:Boolean(cleanText(evidence.renpho_model_label))
  };
}

export function verificationReadiness(provider, evidenceInput, observations = []) {
  const parity = providerParity(provider, evidenceInput, observations);
  return { ready:parity.ready, reason:parity.ready ? 'Physical source/metric evidence is resolved.' : parity.blockers[0] || 'Physical evidence is incomplete.', parity };
}

export function evidenceEventInput(evidenceInput, observedAt = new Date().toISOString()) {
  const evidence = normalizeEvidence(evidenceInput);
  const id = evidence.updated_at || observedAt;
  return {
    metricType:HEALTHKIT_EVIDENCE_METRIC,
    value:1,
    unit:'check',
    observedAt,
    sourceProvider:'zero2fit_physical_acceptance',
    sourceDevice:'web_app',
    sourceRecordId:'healthkit-acceptance-v1',
    provenanceStatus:'user-entered',
    confidence:'user_tracked',
    metadata:{
      healthkit_evidence_v1:{ ...evidence, recorded_at:id }
    }
  };
}

export function latestEvidence(events = []) {
  let latest = null;
  let timestamp = '';
  for (const event of events || []) {
    if (event?.metric_type !== HEALTHKIT_EVIDENCE_METRIC) continue;
    const raw = event?.metadata?.healthkit_evidence_v1;
    if (!raw) continue;
    const when = cleanText(event.observed_at || raw.updated_at || raw.recorded_at);
    if (!latest || when >= timestamp) {
      latest = normalizeEvidence(raw);
      timestamp = when;
    }
  }
  return latest;
}

export function mergeEvidence(localInput, remoteInput) {
  const local = normalizeEvidence(localInput || {});
  const remote = remoteInput ? normalizeEvidence(remoteInput) : null;
  if (!remote) return local;
  const localWhen = local.updated_at || '';
  const remoteWhen = remote.updated_at || '';
  return remoteWhen > localWhen ? remote : local;
}
