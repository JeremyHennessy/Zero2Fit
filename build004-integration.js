(() => {
  'use strict';

  const STORAGE_KEY = 'zero2fit-v1';
  const storage = window.Zero2FitStorage;
  const pageTitles = {
    today: ['Today', 'Your real-world campaign'],
    character: ['Adventure', 'Power earned outside the game'],
    train: ['Train', 'Location-aware workout'],
    nutrition: ['Fuel', 'Simple nutrition log'],
    journey: ['Progress', 'Body, performance and consistency'],
    data: ['Devices', 'Sources, imports and storage']
  };
  let core = null;
  let cachedEvents = [];

  const readState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };

  const writeState = state => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  function ensureCss() {
    if (document.querySelector('link[href="./build004.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './build004.css';
    document.head.appendChild(link);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function formatNumber(value, digits = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return numeric.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function formatHours(minutes) {
    const numeric = Number(minutes);
    if (!Number.isFinite(numeric) || numeric <= 0) return '—';
    const h = Math.floor(numeric / 60);
    const m = Math.round(numeric % 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  function stateWeightSource(state) {
    const latest = [...(state.weights || [])].sort((a, b) => Number(a.date) - Number(b.date)).at(-1);
    return latest?.sourceLabel || latest?.sourceProvider || latest?.source || 'Manual';
  }

  function relabelNavigation() {
    const labels = {
      today: ['⌂', 'Today'],
      character: ['♜', 'Adventure'],
      train: ['▲', 'Train'],
      nutrition: ['◒', 'Fuel'],
      journey: ['↗', 'Progress'],
      data: ['⌁', 'Devices']
    };
    document.querySelectorAll('.nav-item[data-page]').forEach(button => {
      const [icon, label] = labels[button.dataset.page] || ['•', button.dataset.page];
      button.innerHTML = `<span class="z4-nav-icon" aria-hidden="true">${icon}</span><strong>${label}</strong>`;
    });
    const brandSubtitle = document.querySelector('.brand-subtitle');
    if (brandSubtitle) brandSubtitle.textContent = 'Train outside. Advance inside.';
    const sidebarNote = document.querySelector('.sidebar-note');
    if (sidebarNote) sidebarNote.innerHTML = '<strong>Personal fitness system</strong><span>Device data stays private. Game power comes from real activity.</span>';
  }

  function activePageName() {
    return document.querySelector('.page.active')?.id?.replace('page-', '') || 'today';
  }

  function updatePageHeading() {
    const name = activePageName();
    const [title, subtitle] = pageTitles[name] || ['Zero2Fit', ''];
    setText('pageTitle', title);
    let subtitleNode = document.getElementById('z4PageSubtitle');
    if (!subtitleNode) {
      subtitleNode = document.createElement('div');
      subtitleNode.id = 'z4PageSubtitle';
      subtitleNode.className = 'z4-page-subtitle';
      document.getElementById('pageTitle')?.after(subtitleNode);
    }
    subtitleNode.textContent = subtitle;
  }

  function bindNavigationRefresh() {
    document.querySelectorAll('.nav-item,[data-go-page]').forEach(node => {
      node.addEventListener('click', () => setTimeout(updatePageHeading, 0));
    });
  }

  function ensureTopbar() {
    document.body.classList.add('build004');
    const topActions = document.querySelector('.topbar-actions');
    const sync = topActions?.querySelector('.sync-pill');
    if (sync) {
      sync.classList.add('z4-data-pill');
      sync.innerHTML = '<span class="sync-dot"></span><span id="z4SyncText">Local + device-ready</span>';
    }
    const reset = document.getElementById('resetDemo');
    if (reset) {
      reset.textContent = '↻';
      reset.title = 'Reset Zero2Fit local data';
    }
  }

  function addHeroActions() {
    const copy = document.querySelector('#page-today .character-summary .character-copy');
    if (!copy || document.getElementById('z4HeroActions')) return;
    const paragraph = copy.querySelector('.muted');
    if (paragraph) paragraph.textContent = 'Your level and stats only move when you do. Device-verified activity feeds the same progression system.';
    const actions = document.createElement('div');
    actions.id = 'z4HeroActions';
    actions.className = 'z4-hero-actions';
    actions.innerHTML = `
      <button class="primary-button z4-primary" data-z4-page="train">Start today’s workout</button>
      <button class="z4-secondary" data-z4-page="character">View adventure</button>`;
    copy.appendChild(actions);
  }

  function ensureSensorStrip() {
    const hero = document.querySelector('#page-today .hero-grid');
    if (!hero || document.getElementById('z4SensorStrip')) return;
    const strip = document.createElement('section');
    strip.id = 'z4SensorStrip';
    strip.className = 'z4-sensor-strip';
    strip.innerHTML = `
      <article class="z4-sensor"><div class="z4-sensor-icon">◌</div><div><span>Steps</span><strong id="z4Steps">0</strong><small id="z4StepsSource">Manual</small></div></article>
      <article class="z4-sensor"><div class="z4-sensor-icon">◆</div><div><span>Weight</span><strong id="z4Weight">—</strong><small id="z4WeightSource">Manual</small></div></article>
      <article class="z4-sensor"><div class="z4-sensor-icon">☾</div><div><span>Sleep</span><strong id="z4Sleep">—</strong><small id="z4SleepSource">No device data</small></div></article>
      <article class="z4-sensor"><div class="z4-sensor-icon">♥</div><div><span>Resting HR</span><strong id="z4Rhr">—</strong><small id="z4RhrSource">No device data</small></div></article>
      <article class="z4-sensor"><div class="z4-sensor-icon">≈</div><div><span>HRV</span><strong id="z4Hrv">—</strong><small id="z4HrvSource">No device data</small></div></article>`;
    hero.after(strip);
  }

  function ensureTodayDetails() {
    const workout = document.querySelector('#page-today .today-workout-card');
    if (workout && !document.getElementById('z4WorkoutDeviceLine')) {
      workout.classList.add('z4-feature-card');
      const line = document.createElement('div');
      line.id = 'z4WorkoutDeviceLine';
      line.className = 'z4-device-line';
      line.innerHTML = '<span>⌁</span><span id="z4WorkoutEnergySource">Amazfit workout data will replace estimates when a verified match exists.</span>';
      workout.appendChild(line);
    }
    const momentum = document.querySelector('#page-today .momentum-card');
    momentum?.classList.add('z4-momentum');
    const weightCard = [...document.querySelectorAll('#page-today .metric-card')].find(card => card.querySelector('h2')?.textContent.trim() === 'Weight');
    const stepsCard = [...document.querySelectorAll('#page-today .metric-card')].find(card => card.querySelector('h2')?.textContent.trim() === 'Steps');
    weightCard?.classList.add('z4-manual-card');
    stepsCard?.classList.add('z4-manual-card');
  }

  function ensureAdventureUi() {
    const page = document.getElementById('page-character');
    const lowerGrid = page?.querySelector('.content-grid.two-col');
    if (!page || !lowerGrid || document.getElementById('z4FrontierCard')) return;
    page.querySelector('.attribute-card h2')?.replaceChildren(document.createTextNode('Stats earned by real actions'));
    const card = document.createElement('article');
    card.id = 'z4FrontierCard';
    card.className = 'card z4-frontier-card';
    card.innerHTML = `
      <div class="z4-frontier-copy">
        <div class="eyebrow">Campaign frontier</div>
        <h2>Foundation Gate</h2>
        <p>Verified workouts and daily movement improve the same character. Gear and auto-adventure will use this real-world base power without creating fitness XP themselves.</p>
        <div class="z4-frontier-tags"><span>Real-world XP only</span><span>No pay-to-win</span><span>Auto-adventure next</span></div>
      </div>
      <div class="z4-frontier-stats">
        <div><span>Character level</span><strong id="z4AdventureLevel">1</strong></div>
        <div><span>Verified device workouts</span><strong id="z4VerifiedWorkouts">0</strong></div>
        <div><span>Current objective</span><strong id="z4FrontierProgress">0 / 12</strong></div>
      </div>`;
    lowerGrid.before(card);
  }

  function metricTile(id, label, unit, confidence) {
    return `<article class="z4-body-metric"><span>${escapeHtml(label)}</span><strong><span id="${id}">—</span>${unit ? `<small>${escapeHtml(unit)}</small>` : ''}</strong><small id="${id}Meta">${escapeHtml(confidence)}</small></article>`;
  }

  function ensureProgressUi() {
    const page = document.getElementById('page-journey');
    const hero = page?.querySelector('.journey-hero');
    const oldGrid = page?.querySelector('.content-grid');
    if (!page || !hero || !oldGrid) return;
    hero.classList.add('z4-progress-hero');
    const eyebrow = hero.querySelector('.eyebrow');
    if (eyebrow) eyebrow.textContent = 'Progress';
    const heading = hero.querySelector('h2');
    if (heading) heading.textContent = 'See the work from every angle';
    const copy = hero.querySelector('.muted');
    if (copy) copy.textContent = 'Scale trends, device metrics, training history and eventually aligned progress photos share one timeline.';

    if (!document.getElementById('z4BodyComposition')) {
      const section = document.createElement('section');
      section.id = 'z4BodyComposition';
      section.className = 'z4-progress-section';
      section.innerHTML = `
        <div class="z4-section-heading"><div><div class="eyebrow">RENPHO body composition</div><h2>Latest body snapshot</h2></div><span class="small-tag" id="z4BodySource">Waiting for scale data</span></div>
        <div class="z4-body-grid">
          ${metricTile('z4BodyFat','Body fat','%','BIA trend estimate')}
          ${metricTile('z4MuscleMass','Muscle mass','lb','BIA trend estimate')}
          ${metricTile('z4BodyWater','Body water','%','BIA trend estimate')}
          ${metricTile('z4VisceralFat','Visceral fat','','BIA trend estimate')}
          ${metricTile('z4SkeletalMuscle','Skeletal muscle','%','BIA trend estimate')}
          ${metricTile('z4Bmr','BMR','kcal/day','Derived')}
        </div>`;
      oldGrid.before(section);
    }

    if (!document.getElementById('z4PhotoTrackerPreview')) {
      const preview = document.createElement('article');
      preview.id = 'z4PhotoTrackerPreview';
      preview.className = 'card z4-photo-preview';
      preview.innerHTML = `
        <div class="z4-photo-frames" aria-hidden="true"><span>Front</span><span>Side</span><span>Back</span></div>
        <div><div class="eyebrow">Progress photos</div><h2>Aligned visual timeline</h2><p>Front, side and back sessions with pose guides, ghost overlays and a time scrubber are the next progress module. Private photo metadata is already reserved in storage.</p><span class="z4-status-chip">Planned · storage ready</span></div>`;
      oldGrid.after(preview);
    }
  }

  function ensureDeviceUi() {
    const page = document.getElementById('page-data');
    if (!page) return;
    const intro = page.querySelector('.data-intro');
    if (intro) {
      intro.classList.add('z4-devices-hero');
      const heading = intro.querySelector('h2');
      if (heading) heading.textContent = 'Your devices, one private timeline';
      const copy = intro.querySelector('.muted');
      if (copy) copy.textContent = 'Amazfit/Zepp and RENPHO imports stay source-aware. Re-importing the same normalized records cannot create duplicate fitness rewards.';
    }
    const grid = page.querySelector('.connection-grid');
    grid?.classList.add('z4-device-grid');
  }

  function ensureFuelUi() {
    const page = document.getElementById('page-nutrition');
    const summary = page?.querySelector('.nutrition-summary');
    if (!summary) return;
    const eyebrow = summary.querySelector('.eyebrow');
    if (eyebrow) eyebrow.textContent = 'Fuel';
    const heading = summary.querySelector('h2');
    if (heading) heading.textContent = 'Nutrition without busywork';
  }

  function bindZ4Buttons() {
    document.querySelectorAll('[data-z4-page]').forEach(button => {
      button.addEventListener('click', () => {
        const target = button.dataset.z4Page;
        document.querySelector(`.nav-item[data-page="${target}"]`)?.click();
      });
    });
  }

  function ensureUi() {
    ensureCss();
    relabelNavigation();
    ensureTopbar();
    addHeroActions();
    ensureSensorStrip();
    ensureTodayDetails();
    ensureAdventureUi();
    ensureProgressUi();
    ensureDeviceUi();
    ensureFuelUi();
    bindNavigationRefresh();
    bindZ4Buttons();
    updatePageHeading();
  }

  function latestWeight(state) {
    return [...(state.weights || [])].sort((a, b) => Number(a.date) - Number(b.date)).at(-1) || null;
  }

  function eventMetaText(event, fallback) {
    return event ? core.sourceLabel(event) : fallback;
  }

  function displayMetric(id, event, formatter, confidenceText) {
    if (!event) {
      setText(id, '—');
      setText(`${id}Meta`, confidenceText || 'No data yet');
      return;
    }
    setText(id, formatter ? formatter(event.value, event) : formatNumber(event.value, 1));
    setText(`${id}Meta`, `${core.sourceLabel(event)} · ${confidenceText || event.confidence || 'Imported'}`);
  }

  function renderDeviceMetrics(state, events) {
    const today = core.localDateKey();
    const steps = Number(state.steps?.[today] || 0);
    const stepSource = state.stepSources?.[today];
    const weight = latestWeight(state);
    const sleep = core.summarizeLatestSleep(events);
    const rhr = core.latestMetric(events, 'resting_heart_rate');
    const hrv = core.latestMetric(events, 'hrv_sdnn');

    setText('z4Steps', formatNumber(steps));
    setText('z4StepsSource', stepSource?.label || stepSource?.sourceLabel || (steps ? 'Manual' : 'No data yet'));
    setText('z4Weight', weight ? `${formatNumber(weight.value, 1)} lb` : '—');
    setText('z4WeightSource', weight?.sourceLabel || weight?.sourceProvider || stateWeightSource(state));
    setText('z4Sleep', sleep ? formatHours(sleep.minutes) : '—');
    setText('z4SleepSource', sleep?.source_label || 'No sleep import yet');
    setText('z4Rhr', rhr ? `${formatNumber(rhr.value)} bpm` : '—');
    setText('z4RhrSource', eventMetaText(rhr, 'No resting HR yet'));
    setText('z4Hrv', hrv ? `${formatNumber(hrv.value)} ms` : '—');
    setText('z4HrvSource', eventMetaText(hrv, 'No HRV yet'));

    const bodyFat = core.latestMetric(events, 'body_fat_percentage');
    const muscleMass = core.latestMetric(events, 'muscle_mass');
    const water = core.latestMetric(events, 'body_water_percentage');
    const visceral = core.latestMetric(events, 'visceral_fat');
    const skeletal = core.latestMetric(events, 'skeletal_muscle_percentage');
    const bmr = core.latestMetric(events, 'bmr');
    displayMetric('z4BodyFat', bodyFat, value => formatNumber(value, 1), 'BIA trend estimate');
    displayMetric('z4MuscleMass', muscleMass, (value, event) => {
      const unit = String(event.unit || '').toLowerCase();
      const pounds = unit === 'kg' ? Number(value) * 2.2046226218 : Number(value);
      return formatNumber(pounds, 1);
    }, 'BIA trend estimate');
    displayMetric('z4BodyWater', water, value => formatNumber(value, 1), 'BIA trend estimate');
    displayMetric('z4VisceralFat', visceral, value => formatNumber(value, 1), 'BIA trend estimate');
    displayMetric('z4SkeletalMuscle', skeletal, value => formatNumber(value, 1), 'BIA trend estimate');
    displayMetric('z4Bmr', bmr, value => formatNumber(value), 'Derived');
    const compositionSource = bodyFat || muscleMass || water || visceral || skeletal || bmr;
    setText('z4BodySource', compositionSource ? core.sourceLabel(compositionSource) : 'Waiting for RENPHO data');

    const verifiedCount = Object.values(state.deviceWorkoutSummaries || {}).filter(item => item?.trusted).length;
    setText('z4VerifiedWorkouts', verifiedCount);
    setText('z4AdventureLevel', Math.floor(Number(state.totalXp || 0) / 100) + 1);
    setText('z4FrontierProgress', `${Number(state.completedWorkouts || 0)} / 12`);

    const matched = [...(state.workoutHistory || [])].find(item => item?.deviceEnergyKcal && item.day === today);
    if (matched) setText('z4WorkoutEnergySource', `${formatNumber(matched.deviceEnergyKcal)} kcal from ${matched.deviceSourceLabel || 'device'} · MET estimate preserved separately.`);

    const eventCount = events.length;
    setText('z4SyncText', eventCount ? `${formatNumber(eventCount)} normalized device events` : 'Local + device-ready');
  }

  function addXp(state, amount, reason, attribute, uniqueKey, day) {
    state.awarded ||= {};
    if (uniqueKey && state.awarded[uniqueKey]) return false;
    state.totalXp = Number(state.totalXp || 0) + amount;
    state.attributes ||= {};
    if (attribute) state.attributes[attribute] = Number(state.attributes[attribute] || 0) + amount;
    state.attributes.consistency = Number(state.attributes.consistency || 0) + 5;
    state.xpLog = Array.isArray(state.xpLog) ? state.xpLog : [];
    state.xpLog.unshift({ date: Date.now(), amount, reason, source: 'device', day });
    state.xpLog = state.xpLog.slice(0, 60);
    if (uniqueKey) state.awarded[uniqueKey] = true;
    return true;
  }

  function reconcileSteps(state, events) {
    const summaries = core.aggregateDailySteps(events);
    state.steps ||= {};
    state.stepSources ||= {};
    state.quests ||= {};
    state.awarded ||= {};
    let changed = false;
    const today = core.localDateKey();

    for (const summary of summaries) {
      const current = Number(state.steps[summary.day] || 0);
      const currentSource = state.stepSources[summary.day];
      const shouldReplace = !currentSource || currentSource.provider === 'manual' || currentSource.provider === 'apple_health' || currentSource.provider === 'healthkit_bridge';
      if (shouldReplace && (current !== summary.total || currentSource?.label !== summary.source_label)) {
        state.steps[summary.day] = summary.total;
        state.stepSources[summary.day] = {
          provider: summary.source_provider,
          label: summary.source_label,
          observedAt: `${summary.day}T23:59:59`,
          aggregation: summary.aggregation,
          eventCount: summary.event_count,
          trusted: summary.trusted
        };
        changed = true;
      }
    }

    const todaySummary = summaries.find(item => item.day === today);
    if (todaySummary?.total >= 7000 && todaySummary.trusted && today >= state.deviceXpEligibilityStartDay) {
      const questKey = `quest:${today}:move`;
      state.quests[today] ||= {};
      if (!state.quests[today].move && !state.awarded[questKey]) {
        state.quests[today].move = true;
        if (addXp(state, 20, 'Move on purpose · verified device steps', 'endurance', questKey, today)) changed = true;
      }
    }
    return changed;
  }

  function reconcileWorkouts(state, events) {
    const workouts = events
      .filter(event => event?.metric_type === 'workout_session')
      .sort((a, b) => String(a.observed_at).localeCompare(String(b.observed_at)));
    state.workoutHistory = Array.isArray(state.workoutHistory) ? state.workoutHistory : [];
    state.workoutEnergyLog = Array.isArray(state.workoutEnergyLog) ? state.workoutEnergyLog : [];
    state.workoutDates = Array.isArray(state.workoutDates) ? state.workoutDates : [];
    state.deviceXpAwards ||= {};
    state.deviceWorkoutSummaries ||= {};
    let changed = false;

    const awardsByDay = {};
    Object.values(state.deviceXpAwards).forEach(award => { if (award?.day) awardsByDay[award.day] = (awardsByDay[award.day] || 0) + 1; });

    for (const event of workouts) {
      const day = core.localDateKey(event.observed_at);
      const minutes = core.durationMinutes(event);
      if (!day || !Number.isFinite(minutes)) continue;
      const energy = core.eventEnergyKcal(event);
      const label = core.activityLabel(event);
      const source = core.sourceLabel(event);
      state.deviceWorkoutSummaries[event.event_id] = {
        day, observedAt: event.observed_at, durationMinutes: minutes, activity: label, source, trusted: core.isTrustedDeviceEvent(event), energyKcal: energy
      };

      const match = core.matchLocalWorkout(event, state.workoutHistory);
      if (match) {
        const item = state.workoutHistory[match.index];
        if (item.deviceEventId !== event.event_id || item.deviceEnergyKcal !== energy) {
          item.deviceEventId = event.event_id;
          item.deviceSourceLabel = source;
          item.deviceActivityType = label;
          if (energy !== null) item.deviceEnergyKcal = Math.round(energy * 10) / 10;
          item.deviceVerified = core.isTrustedDeviceEvent(event);
          changed = true;
        }
        const energyRecord = state.workoutEnergyLog.find(row => row.day === item.day && (!item.templateId || row.templateId === item.templateId));
        if (energyRecord && energy !== null && energyRecord.deviceKcal !== energy) {
          energyRecord.deviceKcal = Math.round(energy * 10) / 10;
          energyRecord.deviceSource = source;
          energyRecord.preferredDisplay = 'device';
          changed = true;
        }
        continue;
      }

      const dayAwards = awardsByDay[day] || 0;
      if (!core.isXpEligibleWorkout(event, state.deviceXpEligibilityStartDay, state.deviceXpAwards, dayAwards)) continue;
      const attr = core.activityCategory(event);
      const xp = 20;
      const uniqueKey = `device-workout:${event.event_id}`;
      if (!addXp(state, xp, `Verified ${label} · ${source}`, attr, uniqueKey, day)) continue;
      state.deviceXpAwards[event.event_id] = { day, xp, attribute: attr, source };
      awardsByDay[day] = dayAwards + 1;
      state.completedWorkouts = Number(state.completedWorkouts || 0) + 1;
      if (!state.workoutDates.includes(day)) state.workoutDates.push(day);
      state.workoutHistory.unshift({
        date: new Date(event.end_at || event.observed_at).getTime(), day,
        templateId: null, templateName: label, location: 'external', mode: 'device', durationMinutes: minutes,
        completedExerciseIds: [], unavailableIntents: [], sourceProvider: event.source_provider,
        sourceEventId: event.event_id, sourceLabel: source, verified: true,
        deviceEnergyKcal: energy !== null ? Math.round(energy * 10) / 10 : null,
        deviceSourceLabel: source, deviceActivityType: label, deviceVerified: true
      });
      changed = true;
    }

    state.workoutHistory = state.workoutHistory.slice(0, 500);
    const entries = Object.entries(state.deviceWorkoutSummaries).sort((a, b) => String(b[1].observedAt).localeCompare(String(a[1].observedAt))).slice(0, 250);
    state.deviceWorkoutSummaries = Object.fromEntries(entries);
    return changed;
  }

  async function reconcileDeviceData() {
    if (!storage || !core) return;
    try {
      cachedEvents = await storage.getRecentEvents(50000);
      const state = readState();
      let changed = false;
      if (!state.deviceXpEligibilityStartDay) {
        state.deviceXpEligibilityStartDay = core.localDateKey();
        changed = true;
      }
      if (reconcileSteps(state, cachedEvents)) changed = true;
      if (reconcileWorkouts(state, cachedEvents)) changed = true;
      renderDeviceMetrics(state, cachedEvents);
      if (changed) {
        writeState(state);
        await storage.saveSnapshot(state);
        sessionStorage.setItem('zero2fit-build004-reconciled', String(Date.now()));
        setTimeout(() => window.location.reload(), 80);
      }
    } catch (error) {
      console.warn('Zero2Fit Build 004 reconciliation failed', error);
    }
  }

  async function init() {
    ensureUi();
    if (!storage) return;
    try {
      core = await import('./device-core.mjs');
      await storage.openDb();
      await reconcileDeviceData();
      if (!cachedEvents.length) renderDeviceMetrics(readState(), []);
      window.addEventListener('focus', () => reconcileDeviceData());
    } catch (error) {
      console.warn('Zero2Fit Build 004 initialization failed', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
