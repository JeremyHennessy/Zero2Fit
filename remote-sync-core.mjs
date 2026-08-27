const cleanText = value => String(value ?? '').trim();

export function sessionUserId(session = {}) {
  return session?.user?.id || session?.user_id || null;
}

export function eventToRemoteRow(event = {}, userId) {
  if (!userId) throw new Error('A user id is required for remote event storage.');
  if (!event?.event_id || !event?.metric_type || !event?.observed_at) throw new Error('Normalized event is missing its identity, metric type or timestamp.');
  const numeric = typeof event.value === 'number' ? event.value : Number(event.value);
  const hasNumeric = Number.isFinite(numeric) && cleanText(event.value) !== '';
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
    provenance_status: event.provenance_status || 'imported',
    confidence: event.confidence || 'imported',
    metadata: event.metadata || {}
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
