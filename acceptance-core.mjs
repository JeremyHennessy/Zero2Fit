export const ACCEPTANCE_VERSION = 1;

export function acceptanceProbeRows({ userId, runId, now, ids }) {
  if (!userId || !runId || !now) throw new Error('userId, runId and now are required.');
  const sessionId = ids?.sessionId;
  const setId = ids?.setId;
  const photoSessionId = ids?.photoSessionId;
  const photoId = ids?.photoId;
  if (![sessionId, setId, photoSessionId, photoId].every(Boolean)) throw new Error('All probe UUIDs are required.');

  const eventId = `acceptance:${runId}`;
  const storagePath = `${userId}/acceptance/${runId}.jpg`;
  return {
    eventId,
    storagePath,
    event:{
      user_id:userId,
      event_id:eventId,
      metric_type:'acceptance_probe',
      numeric_value:1,
      text_value:'zero2fit-private-acceptance',
      unit:'probe',
      observed_at:now,
      end_at:null,
      source_provider:'zero2fit_acceptance',
      source_device:'browser',
      source_record_id:runId,
      imported_at:now,
      provenance_status:'user-entered',
      confidence:'verified-software-probe',
      metadata:{ acceptance_probe:true, run_id:runId, phase:'insert' }
    },
    workoutSession:{
      user_id:userId,
      session_id:sessionId,
      template_id:'acceptance-probe',
      workout_name:'Zero2Fit acceptance probe',
      mode:'probe',
      location:'home',
      started_at:now,
      completed_at:now,
      completion_fraction:1,
      source_provider:'zero2fit_acceptance',
      source_record_id:runId,
      metadata:{ acceptance_probe:true, run_id:runId }
    },
    workoutSet:{
      user_id:userId,
      set_id:setId,
      session_id:sessionId,
      exercise_id:'acceptance-probe',
      set_number:1,
      reps:3,
      load_value:10,
      load_unit:'lb',
      completed:true,
      metadata:{ acceptance_probe:true, run_id:runId, phase:'insert' }
    },
    photoSession:{
      user_id:userId,
      session_id:photoSessionId,
      captured_at:now,
      notes:'Zero2Fit acceptance probe',
      metadata:{ acceptance_probe:true, run_id:runId }
    },
    photoAsset:{
      user_id:userId,
      photo_id:photoId,
      session_id:photoSessionId,
      view:'other',
      storage_path:storagePath,
      mime_type:'image/jpeg',
      width:1,
      height:1,
      metadata:{ acceptance_probe:true, run_id:runId, local_view:'other' }
    }
  };
}

export function preferenceProbeRow(existing, userId, runId, now) {
  const base = existing || {};
  return {
    user_id:userId,
    preferred_units:base.preferred_units || {},
    workout_location:base.workout_location || 'home',
    settings:{
      ...(base.settings || {}),
      acceptance_probe:{ run_id:runId, written_at:now }
    },
    updated_at:now
  };
}

export function restoredPreferenceRow(existing, userId) {
  if (!existing) return null;
  return {
    user_id:userId,
    preferred_units:existing.preferred_units || {},
    workout_location:existing.workout_location || 'home',
    settings:existing.settings || {},
    updated_at:existing.updated_at || new Date(0).toISOString()
  };
}

export function acceptanceMarker(existing, userId, result) {
  const passed = Boolean(result?.passed);
  if (!passed) throw new Error('Only a passing acceptance result may be persisted.');
  return {
    user_id:userId,
    preferred_units:existing?.preferred_units || {},
    workout_location:existing?.workout_location || 'home',
    settings:{
      ...(existing?.settings || {}),
      zero2fit_acceptance_v1:{
        version:ACCEPTANCE_VERSION,
        passed:true,
        passed_at:result.finished_at,
        run_id:result.run_id,
        build:'024',
        checks:(result.checks || []).map(check => ({ id:check.id, status:check.status })),
        note:'Authenticated browser infrastructure acceptance. Repeat on a second browser for cross-browser acceptance.'
      }
    },
    updated_at:result.finished_at
  };
}

export function summarizeChecks(checks = []) {
  const normalized = checks.map(check => ({
    id:String(check?.id || ''),
    label:String(check?.label || check?.id || ''),
    status:check?.status === 'pass' ? 'pass' : 'fail',
    detail:String(check?.detail || '')
  }));
  const passed = normalized.length > 0 && normalized.every(check => check.status === 'pass');
  return {
    passed,
    passed_count:normalized.filter(check => check.status === 'pass').length,
    failed_count:normalized.filter(check => check.status !== 'pass').length,
    checks:normalized
  };
}

export function acceptanceDisplay(result) {
  if (!result) return 'Not run on this browser.';
  const summary = summarizeChecks(result.checks || []);
  if (!summary.passed) return `${summary.passed_count}/${summary.checks.length} checks passed`;
  return `${summary.checks.length}/${summary.checks.length} checks passed · ${result.finished_at ? new Date(result.finished_at).toLocaleString() : 'completed'}`;
}