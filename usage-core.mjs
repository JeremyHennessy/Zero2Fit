export const USAGE_SCHEMA_VERSION = 1;
export const DEFAULT_RETENTION_DAYS = 90;
export const DEFAULT_MAX_EVENTS = 1600;

const DAY_MS = 86400000;
const ALLOWED_METADATA = new Set([
  'page','source','action','kind','mode','location','intent','method','outcome','wallType',
  'completeCount','delta','selected','open','backfilled'
]);

function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return number;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function cleanString(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_:\-.]+/g, '_').slice(0, 48);
}

export function dayKey(value = Date.now()) {
  const date = new Date(timestamp(value));
  return date.toISOString().slice(0, 10);
}

export function sanitizeMetadata(input = {}) {
  const output = {};
  for (const [key, raw] of Object.entries(input || {})) {
    if (!ALLOWED_METADATA.has(key) || raw === undefined || raw === null || raw === '') continue;
    if (typeof raw === 'boolean') {
      output[key] = raw;
      continue;
    }
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) continue;
      if (key === 'completeCount') output[key] = Math.max(0, Math.min(4, Math.round(raw)));
      else if (key === 'delta') output[key] = Math.max(-100, Math.min(100, Math.round(raw)));
      else output[key] = Math.round(raw);
      continue;
    }
    const value = cleanString(raw);
    if (value) output[key] = value;
  }
  return output;
}

export function createUsageEvent({ type, metadata = {}, observedAt = Date.now(), id = null } = {}) {
  const at = timestamp(observedAt);
  const cleanType = cleanString(type || 'unknown');
  if (!cleanType) throw new Error('Usage event type is required.');
  return {
    id:id || `usage:${at}:${Math.random().toString(36).slice(2, 10)}`,
    type:cleanType,
    observedAt:new Date(at).toISOString(),
    day:dayKey(at),
    metadata:sanitizeMetadata(metadata)
  };
}

function eventTimestamp(event) {
  const value = new Date(event?.observedAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function normalizeUsageState(input = {}, { now = Date.now(), retentionDays = DEFAULT_RETENTION_DAYS, maxEvents = DEFAULT_MAX_EVENTS } = {}) {
  const cutoff = timestamp(now) - Math.max(1, retentionDays) * DAY_MS;
  const events = Array.isArray(input?.events) ? input.events : [];
  const normalized = events
    .map(event => {
      const at = eventTimestamp(event);
      if (!at || at < cutoff || !event?.type) return null;
      return {
        id:String(event.id || `usage:${at}`),
        type:cleanString(event.type),
        observedAt:new Date(at).toISOString(),
        day:dayKey(at),
        metadata:sanitizeMetadata(event.metadata || {})
      };
    })
    .filter(Boolean)
    .sort((a,b) => eventTimestamp(a) - eventTimestamp(b))
    .slice(-Math.max(20,maxEvents));
  return {
    version:USAGE_SCHEMA_VERSION,
    events:normalized,
    updatedAt:input?.updatedAt || null
  };
}

function metadataSignature(metadata) {
  return JSON.stringify(Object.fromEntries(Object.entries(metadata || {}).sort(([a],[b]) => a.localeCompare(b))));
}

export function recordUsageEvent(inputState,eventInput,{
  now=Date.now(),retentionDays=DEFAULT_RETENTION_DAYS,maxEvents=DEFAULT_MAX_EVENTS,dedupeWindowMs=700
}={}) {
  const state = normalizeUsageState(inputState,{now,retentionDays,maxEvents});
  const event = createUsageEvent(eventInput);
  const last = state.events.at(-1);
  const duplicate = last && last.type===event.type && metadataSignature(last.metadata)===metadataSignature(event.metadata)
    && Math.abs(eventTimestamp(event)-eventTimestamp(last))<=dedupeWindowMs;
  if (duplicate) return {state,event:last,recorded:false};
  state.events.push(event);
  const cutoff = timestamp(now)-Math.max(1,retentionDays)*DAY_MS;
  state.events = state.events.filter(item => eventTimestamp(item)>=cutoff).slice(-Math.max(20,maxEvents));
  state.updatedAt = event.observedAt;
  return {state,event,recorded:true};
}

function countBy(events,type,predicate=null) {
  return events.filter(event => event.type===type && (!predicate || predicate(event))).length;
}

function dayCount(events,predicate) {
  return new Set(events.filter(predicate).map(event => event.day).filter(Boolean)).size;
}

function tally(events,type,key) {
  const result={};
  for (const event of events) {
    if (event.type!==type) continue;
    const value=event.metadata?.[key];
    if (!value) continue;
    result[value]=(result[value]||0)+1;
  }
  return result;
}

function topEntry(map) {
  return Object.entries(map||{}).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||null;
}

function sumMap(map={}) {
  return Object.values(map).reduce((sum,value)=>sum+Number(value||0),0);
}

function evidenceSuffix(days) {
  return ` Evidence spans ${days} day${days===1?'':'s'}.`;
}

export function deriveFrictionSignals(summary={}) {
  const signals=[];
  const guidance=summary.guidance||{};
  const workout=summary.workout||{};
  const fuel=summary.fuel||{};
  const manualHealth=summary.manualHealth||{};
  const adventure=summary.adventure||{};

  if (guidance.shown>=4 && guidance.days>=2 && guidance.followRate<0.5) {
    signals.push({key:'guidance_follow_through',severity:'medium',title:'Daily guidance is often bypassed',detail:`${guidance.acted} of ${guidance.shown} shown next actions were opened.${evidenceSuffix(guidance.days)}`});
  }

  const handledSets=Number(workout.setsCompleted||0)+Number(workout.setsSkipped||0);
  if (handledSets>=6 && workout.handledDays>=2 && workout.skipRate>=0.2) {
    signals.push({key:'workout_skip_rate',severity:'high',title:'Workout queue has repeated skips',detail:`${workout.setsSkipped} of ${handledSets} handled sets were skipped.${evidenceSuffix(workout.handledDays)}`});
  }

  if (Number(workout.substitutionsSelected||0)>=3 && workout.substitutionDays>=2) {
    signals.push({key:'substitution_demand',severity:'medium',title:'Exercise substitutions are a recurring need',detail:`${workout.substitutionsSelected} substitute selections were made in the measurement window.${evidenceSuffix(workout.substitutionDays)}`});
  }

  if (Number(workout.targetEdits||0)>=4 && workout.targetEditDays>=2) {
    const loads=Number(workout.targetEditKinds?.load||0);
    const reps=Number(workout.targetEditKinds?.reps||0);
    signals.push({key:'workout_target_edits',severity:'medium',title:'Workout targets are frequently edited',detail:`${workout.targetEdits} set-target edits were recorded (${loads} load · ${reps} reps).${evidenceSuffix(workout.targetEditDays)}`});
  }

  const shortened=Number(workout.restOverrideMethods?.start_next||0);
  if (shortened>=3 && workout.restShorteningDays>=2) {
    signals.push({key:'rest_shortening',severity:'medium',title:'Default rest is often shortened',detail:`Rest was ended early ${shortened} times in the measurement window.${evidenceSuffix(workout.restShorteningDays)}`});
  }

  if (Number(workout.sessionsLeft||0)>=3 && workout.sessionLeaveDays>=2 && Number(workout.sessionResumeRate||0)<0.5) {
    signals.push({key:'unfinished_sessions',severity:'medium',title:'Workouts are often left unfinished',detail:`${workout.sessionsLeft} unfinished-session exits were recorded and ${workout.sessionsResumed||0} were later resumed.${evidenceSuffix(workout.sessionLeaveDays)}`});
  }

  if (Number(fuel.panelClosed||0)>=4 && fuel.panelClosedDays>=2 && Number(fuel.panelAbandonRate||0)>=0.5) {
    signals.push({key:'fuel_panel_abandonment',severity:'medium',title:'Add Food sessions are often abandoned',detail:`${fuel.panelAbandoned} of ${fuel.panelClosed} closed Add Food sessions ended without a new entry.${evidenceSuffix(fuel.panelClosedDays)}`});
  } else if (!fuel.panelClosed && Number(fuel.panelOpened||0)>=4 && fuel.panelOpenedDays>=2 && Number(fuel.entriesLogged||0)/Math.max(1,fuel.panelOpened)<0.65) {
    signals.push({key:'fuel_abandonment',severity:'medium',title:'Fuel entry is opened more often than it is completed',detail:`${fuel.entriesLogged} food entries were logged after ${fuel.panelOpened} Add Food opens.${evidenceSuffix(fuel.panelOpenedDays)}`});
  }

  if (Number(fuel.lookupResolved||0)>=4 && fuel.lookupDays>=2 && Number(fuel.lookupSuccessRate||0)<0.5) {
    const unsuccessful=Number(fuel.lookupEmpty||0)+Number(fuel.lookupErrors||0);
    signals.push({key:'fuel_lookup_friction',severity:'medium',title:'Food lookup often misses a usable result',detail:`${unsuccessful} of ${fuel.lookupResolved} resolved lookups were empty or failed.${evidenceSuffix(fuel.lookupDays)}`});
  }

  if (Number(fuel.entriesLogged||0)>=6 && fuel.entryDays>=2 && Number(fuel.manualEntryRate||0)>=0.6 && Number(fuel.shortcutEntries||0)<=2) {
    signals.push({key:'fuel_manual_reliance',severity:'low',title:'Fuel logging still leans on manual entry',detail:`${fuel.manualEntries} of ${fuel.entriesLogged} measured entries used the full manual form.${evidenceSuffix(fuel.entryDays)}`});
  }

  if (Number(manualHealth.total||0)>=3 && manualHealth.days>=2) {
    signals.push({key:'manual_health_dependency',severity:'medium',title:'Manual health entry is still doing repeated work',detail:`${manualHealth.total} manual weight/steps interactions were recorded in the measurement window.${evidenceSuffix(manualHealth.days)}`});
  }

  const modeTotal=sumMap(workout.modes||{});
  if (modeTotal>=4 && workout.modeChoiceDays>=2 && Number(workout.modes?.quick||0)/modeTotal>=0.6) {
    signals.push({key:'quick_mode_preference',severity:'low',title:'Quick training is the dominant choice',detail:`Quick was selected ${workout.modes.quick} of ${modeTotal} recorded workout-mode choices.${evidenceSuffix(workout.modeChoiceDays)}`});
  }

  const progressionRuns=Number(adventure.progressionRuns||0);
  const combatWalls=Number(adventure.combatWalls||0);
  if (progressionRuns>=4 && adventure.progressionDays>=2 && combatWalls>=3 && adventure.combatWallDays>=2 && Number(adventure.combatWallRate||0)>=0.5) {
    signals.push({key:'adventure_combat_wall',severity:'medium',title:'Adventure repeatedly stops at combat walls',detail:`${combatWalls} of ${progressionRuns} active progression runs ended at a combat wall.${evidenceSuffix(adventure.combatWallDays)} Treat this as pacing evidence, not a prompt to train extra.`});
  }

  const capabilityGates=Number(adventure.capabilityGates||0);
  if (capabilityGates>=3 && adventure.capabilityGateDays>=2) {
    signals.push({key:'adventure_capability_gate',severity:'low',title:'Adventure is repeatedly waiting on real-world capability',detail:`${capabilityGates} runs ended at a real-progress capability gate.${evidenceSuffix(adventure.capabilityGateDays)} This is expected fitness-ceiling evidence, not a prompt to overtrain.`});
  }

  return signals;
}

export function summarizeUsage(inputState={}, {now=Date.now(),days=14}={}) {
  const state=normalizeUsageState(inputState,{now});
  const cutoff=timestamp(now)-Math.max(1,days)*DAY_MS;
  const events=state.events.filter(event=>eventTimestamp(event)>=cutoff);
  const guidanceShown=countBy(events,'guidance_shown');
  const guidanceActed=countBy(events,'guidance_acted');
  const setsCompleted=countBy(events,'workout_set_completed');
  const setsSkipped=countBy(events,'workout_set_skipped');
  const handledSets=setsCompleted+setsSkipped;
  const pageViews=tally(events,'page_view','page');
  const modes=tally(events,'workout_mode_selected','mode');
  const locations=tally(events,'workout_location_selected','location');
  const targetEditKinds=tally(events,'workout_target_edited','kind');
  const targetEditMethods=tally(events,'workout_target_edited','method');
  const restOverrideMethods=tally(events,'workout_rest_override','method');
  const fuelMethods=tally(events,'fuel_entry_logged','method');
  const fuelPanelOutcomes=tally(events,'fuel_panel_closed','outcome');
  const fuelLookupOutcomes=tally(events,'fuel_lookup_result','outcome');
  const fuelLookupMethods=tally(events,'fuel_lookup_result','method');
  const adventureOutcomes=tally(events,'adventure_run','outcome');
  const guidanceActions=tally(events,'guidance_acted','action');
  const manualHealthKinds=tally(events,'manual_health_entry','kind');
  const sessionsLeft=countBy(events,'workout_session_left');
  const sessionsResumed=countBy(events,'workout_session_resumed');
  const fuelPanelClosed=sumMap(fuelPanelOutcomes);
  const fuelPanelAbandoned=Number(fuelPanelOutcomes.abandoned||0);
  const fuelLookupResolved=sumMap(fuelLookupOutcomes);
  const fuelLookupSuccess=Number(fuelLookupOutcomes.success||0);
  const fuelLookupEmpty=Number(fuelLookupOutcomes.empty||0);
  const fuelLookupErrors=Number(fuelLookupOutcomes.error||0);
  const fuelEntriesLogged=countBy(events,'fuel_entry_logged');
  const fuelManualEntries=Number(fuelMethods.manual||0);
  const fuelShortcutEntries=['repeat','saved','reusable','open_food_facts'].reduce((sum,key)=>sum+Number(fuelMethods[key]||0),0);
  const adventureCombatWalls=Number(adventureOutcomes.combat_wall||0);
  const adventureCapabilityGates=Number(adventureOutcomes.capability_gate||0);
  const adventureAdvancing=Number(adventureOutcomes.advancing||0);
  const adventureProgressionRuns=adventureCombatWalls+adventureCapabilityGates+adventureAdvancing;
  const activeAdventureOutcomes=new Set(['combat_wall','capability_gate','advancing']);

  const summary={
    windowDays:Math.max(1,days),
    eventCount:events.length,
    activeDays:new Set(events.map(event=>event.day)).size,
    pageViews,
    preferredPage:topEntry(pageViews)?.[0]||null,
    guidance:{
      shown:guidanceShown,
      acted:guidanceActed,
      followRate:guidanceShown?guidanceActed/guidanceShown:0,
      actions:guidanceActions,
      days:dayCount(events,event=>event.type==='guidance_shown')
    },
    workout:{
      modes,
      locations,
      preferredMode:topEntry(modes)?.[0]||null,
      preferredLocation:topEntry(locations)?.[0]||null,
      modeChoiceDays:dayCount(events,event=>event.type==='workout_mode_selected'),
      setsCompleted,
      setsSkipped,
      skipRate:handledSets?setsSkipped/handledSets:0,
      handledDays:dayCount(events,event=>event.type==='workout_set_completed'||event.type==='workout_set_skipped'),
      substitutionsOpened:countBy(events,'workout_substitute_opened'),
      substitutionsSelected:countBy(events,'workout_substitute_selected'),
      substitutionDays:dayCount(events,event=>event.type==='workout_substitute_selected'),
      targetEdits:countBy(events,'workout_target_edited'),
      targetEditKinds,
      targetEditMethods,
      targetEditDays:dayCount(events,event=>event.type==='workout_target_edited'),
      restOverrides:countBy(events,'workout_rest_override'),
      restOverrideMethods,
      restShorteningDays:dayCount(events,event=>event.type==='workout_rest_override'&&event.metadata?.method==='start_next'),
      skipsResumed:countBy(events,'workout_skips_resumed'),
      sessionsLeft,
      sessionsResumed,
      sessionLeaveDays:dayCount(events,event=>event.type==='workout_session_left'),
      sessionResumeRate:sessionsLeft?Math.min(1,sessionsResumed/sessionsLeft):0,
      finishesRecorded:countBy(events,'workout_finish',event=>event.metadata?.outcome==='recorded'),
      finishesBlocked:countBy(events,'workout_finish',event=>event.metadata?.outcome==='blocked')
    },
    fuel:{
      panelOpened:countBy(events,'fuel_panel_opened'),
      panelOpenedDays:dayCount(events,event=>event.type==='fuel_panel_opened'),
      panelClosed:fuelPanelClosed,
      panelClosedDays:dayCount(events,event=>event.type==='fuel_panel_closed'),
      panelOutcomes:fuelPanelOutcomes,
      panelAbandoned:fuelPanelAbandoned,
      panelCompleted:Number(fuelPanelOutcomes.logged||0),
      panelAbandonRate:fuelPanelClosed?fuelPanelAbandoned/fuelPanelClosed:0,
      entriesLogged:fuelEntriesLogged,
      entryDays:dayCount(events,event=>event.type==='fuel_entry_logged'),
      entriesRemoved:countBy(events,'fuel_entry_removed'),
      methods:fuelMethods,
      preferredMethod:topEntry(fuelMethods)?.[0]||null,
      manualEntries:fuelManualEntries,
      manualEntryRate:fuelEntriesLogged?fuelManualEntries/fuelEntriesLogged:0,
      shortcutEntries:fuelShortcutEntries,
      lookupAttempts:countBy(events,'fuel_lookup'),
      lookupResolved:fuelLookupResolved,
      lookupDays:dayCount(events,event=>event.type==='fuel_lookup_result'),
      lookupResults:fuelLookupOutcomes,
      lookupMethods:fuelLookupMethods,
      lookupSuccess:fuelLookupSuccess,
      lookupEmpty:fuelLookupEmpty,
      lookupErrors:fuelLookupErrors,
      lookupSuccessRate:fuelLookupResolved?fuelLookupSuccess/fuelLookupResolved:0
    },
    manualHealth:{
      total:countBy(events,'manual_health_entry'),
      days:dayCount(events,event=>event.type==='manual_health_entry'),
      kinds:manualHealthKinds
    },
    adventure:{
      runs:countBy(events,'adventure_run'),
      autoEquips:countBy(events,'adventure_auto_equip'),
      outcomes:adventureOutcomes,
      topOutcome:topEntry(adventureOutcomes)?.[0]||null,
      combatWalls:adventureCombatWalls,
      combatWallDays:dayCount(events,event=>event.type==='adventure_run'&&event.metadata?.outcome==='combat_wall'),
      capabilityGates:adventureCapabilityGates,
      capabilityGateDays:dayCount(events,event=>event.type==='adventure_run'&&event.metadata?.outcome==='capability_gate'),
      advancing:adventureAdvancing,
      progressionRuns:adventureProgressionRuns,
      progressionDays:dayCount(events,event=>event.type==='adventure_run'&&activeAdventureOutcomes.has(event.metadata?.outcome)),
      combatWallRate:adventureProgressionRuns?adventureCombatWalls/adventureProgressionRuns:0
    }
  };
  summary.signals=deriveFrictionSignals(summary);
  return summary;
}
