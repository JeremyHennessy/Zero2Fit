(() => {
  'use strict';

  const STORAGE_KEY = 'zero2fit-v1';
  const BUILD = '002';
  const storage = window.Zero2FitStorage || null;
  const ingestion = window.Zero2FitIngestion || null;
  const exerciseSystem = window.Zero2FitExercises || null;
  let localStateLoaded = false;

  function dateKey(value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const todayKey = () => dateKey(new Date());

  const defaultState = () => ({
    version: 2,
    totalXp: 0,
    xpLog: [],
    attributes: {
      strength: 0,
      endurance: 0,
      consistency: 0,
      recovery: 0,
      nutrition: 0
    },
    quests: {},
    weights: [],
    steps: {},
    stepSources: {},
    meals: {},
    workoutMode: 'standard',
    workoutLocation: 'home',
    workoutTemplate: 'foundation-a',
    exerciseChoices: {},
    workoutSets: {},
    completedWorkouts: 0,
    workoutDates: [],
    awarded: {},
    importedEventIds: {},
    importSummary: null
  });

  const quests = [
    { id: 'move', label: 'Move on purpose', detail: 'Reach 7,000 steps or mark a purposeful walk', xp: 20, attr: 'endurance' },
    { id: 'train', label: 'Training session', detail: 'Complete today\'s planned workout or Quick version', xp: 35, attr: 'strength' },
    { id: 'nutrition', label: 'Log nutrition', detail: 'Record enough food to understand the day', xp: 15, attr: 'nutrition' },
    { id: 'recovery', label: 'Recovery check', detail: 'Acknowledge sleep/recovery before pushing intensity', xp: 10, attr: 'recovery' }
  ];

  const fallbackExercises = [
    { id: 'chair-squat', name: 'Chair Squat', cue: 'Controlled range · stop before form degrades', defaultSets: 3, defaultReps: 8, movement: 'squat', muscles: ['quadriceps','glutes'], requiredEquipment: ['chair'] },
    { id: 'incline-push-up', name: 'Incline Push-up', cue: 'Use a height that keeps reps smooth', defaultSets: 3, defaultReps: 8, movement: 'horizontal_push', muscles: ['chest','triceps'], requiredEquipment: ['stable_surface'] },
    { id: 'prone-w-raise', name: 'Prone W Raise', cue: 'Lift only as far as you can without shrugging', defaultSets: 2, defaultReps: 10, movement: 'horizontal_pull', muscles: ['upper_back'], requiredEquipment: ['yoga_mat'] },
    { id: 'bodyweight-good-morning', name: 'Bodyweight Good Morning', cue: 'Push hips back while keeping the trunk long', defaultSets: 2, defaultReps: 10, movement: 'hinge', muscles: ['hamstrings','glutes'], requiredEquipment: ['bodyweight'] },
    { id: 'bird-dog', name: 'Bird Dog', cue: 'Slow, stable and controlled', defaultSets: 2, defaultReps: 8, movement: 'core', muscles: ['core'], requiredEquipment: ['yoga_mat'] }
  ];

  const attributeMeta = {
    strength: ['Strength', 'Training progression'],
    endurance: ['Endurance', 'Walking & cardio'],
    consistency: ['Consistency', 'Showing up'],
    recovery: ['Recovery', 'Sleep & easier days'],
    nutrition: ['Nutrition', 'Food awareness']
  };

  let state = loadState();
  let toastTimer = null;

  function migrateState(input) {
    const base = defaultState();
    if (!input || typeof input !== 'object') return base;
    return {
      ...base,
      ...input,
      version: 2,
      attributes: { ...base.attributes, ...(input.attributes || {}) },
      quests: input.quests || {},
      weights: Array.isArray(input.weights) ? input.weights : [],
      steps: input.steps || {},
      stepSources: input.stepSources || {},
      meals: input.meals || {},
      exerciseChoices: input.exerciseChoices || {},
      workoutSets: input.workoutSets || {},
      workoutDates: Array.isArray(input.workoutDates) ? input.workoutDates : [],
      awarded: input.awarded || {},
      importedEventIds: input.importedEventIds || {}
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      localStateLoaded = Boolean(parsed && typeof parsed === 'object');
      return migrateState(parsed);
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (storage) storage.saveSnapshot(state).catch(error => console.warn('IndexedDB snapshot failed:', error));
  }

  function getDayBucket(map) {
    const key = todayKey();
    if (!map[key]) map[key] = {};
    return map[key];
  }

  function normalizedEvent(fields) {
    if (!ingestion) return null;
    return ingestion.makeEvent(fields);
  }

  function persistEvents(events) {
    if (!storage || !events?.length) return;
    storage.upsertEvents(events).catch(error => console.warn('Event persistence failed:', error));
  }

  function addXp(amount, reason, attr, uniqueKey) {
    if (uniqueKey && state.awarded[uniqueKey]) return false;
    state.totalXp += amount;
    if (attr) state.attributes[attr] = (state.attributes[attr] || 0) + amount;
    if (reason) state.xpLog.unshift({ date: Date.now(), amount, reason });
    state.xpLog = state.xpLog.slice(0, 50);
    if (uniqueKey) state.awarded[uniqueKey] = true;
    saveState();
    return true;
  }

  function levelInfo() {
    const level = Math.floor(state.totalXp / 100) + 1;
    const intoLevel = state.totalXp % 100;
    return { level, intoLevel, remaining: 100 - intoLevel };
  }

  function titleForLevel(level) {
    if (level >= 10) return 'Built Different';
    if (level >= 7) return 'Momentum Keeper';
    if (level >= 4) return 'Foundation Forged';
    if (level >= 2) return 'Getting Moving';
    return 'The Rebuilder';
  }

  function todayQuests() {
    const day = getDayBucket(state.quests);
    return quests.map(q => ({ ...q, done: !!day[q.id] }));
  }

  function toggleQuest(id, forcedValue) {
    const q = quests.find(item => item.id === id);
    if (!q) return;
    const day = getDayBucket(state.quests);
    const current = !!day[id];
    const next = forcedValue === undefined ? !current : forcedValue;
    day[id] = next;
    if (next && !current) {
      addXp(q.xp, q.label, q.attr, `quest:${todayKey()}:${id}`);
      if (id !== 'recovery') state.attributes.consistency += 5;
      showToast(`+${q.xp} XP · ${q.label}`);
    }
    saveState();
    renderAll();
  }

  function momentumScore() {
    const done = todayQuests().filter(q => q.done).length;
    const steps = Number(state.steps[todayKey()] || 0);
    const base = done * 20;
    const movementBonus = Math.min(15, Math.round((steps / 7000) * 15));
    const loggedFood = (state.meals[todayKey()] || []).length > 0 ? 5 : 0;
    return Math.min(100, base + movementBonus + loggedFood);
  }

  function weekActiveDays() {
    const keys = new Set();
    Object.entries(state.quests).forEach(([date, values]) => {
      if (Object.values(values).some(Boolean)) keys.add(date);
    });
    state.workoutDates.forEach(date => keys.add(date));
    return keys;
  }

  function renderNavigation() {
    document.querySelectorAll('.nav-item').forEach(button => {
      button.addEventListener('click', () => openPage(button.dataset.page));
    });
    document.querySelectorAll('[data-go-page]').forEach(button => {
      button.addEventListener('click', () => openPage(button.dataset.goPage));
    });
  }

  function openPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(`page-${pageName}`)?.classList.add('active');
    document.querySelector(`.nav-item[data-page="${pageName}"]`)?.classList.add('active');
    const titles = { today: 'Today', character: 'Character', train: 'Train', nutrition: 'Nutrition', journey: 'Journey', data: 'Data' };
    setText('pageTitle', titles[pageName] || 'Zero2Fit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderQuests() {
    const container = document.getElementById('questList');
    if (!container) return;
    container.innerHTML = todayQuests().map(q => `
      <button class="quest-item ${q.done ? 'done' : ''}" data-quest="${q.id}">
        <span class="quest-check">${q.done ? '✓' : ''}</span>
        <span class="quest-copy"><strong>${escapeHtml(q.label)}</strong><span>${escapeHtml(q.detail)}</span></span>
        <span class="quest-xp">+${q.xp} XP</span>
      </button>`).join('');
    container.querySelectorAll('[data-quest]').forEach(button => button.addEventListener('click', () => toggleQuest(button.dataset.quest)));
  }

  function renderSummary() {
    const { level, intoLevel, remaining } = levelInfo();
    const title = titleForLevel(level);
    const done = todayQuests().filter(q => q.done).length;
    const xpToday = state.xpLog.filter(x => dateKey(new Date(x.date)) === todayKey()).reduce((sum, x) => sum + x.amount, 0);
    const momentum = momentumScore();
    const activeDays = weekActiveDays();
    const now = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - i); return dateKey(d);
    });
    const weekCount = last7.filter(d => activeDays.has(d)).length;

    setText('heroLevel', level); setText('characterLevel', level); setText('dataLevel', level);
    setText('heroXpText', `${intoLevel} / 100 XP`); setWidth('heroXpBar', intoLevel); setWidth('characterXpBar', intoLevel);
    setText('heroTitle', title); setText('characterTitle', title); setText('totalXp', state.totalXp); setText('journeyXp', state.totalXp);
    setText('characterXpText', `${remaining} XP until Level ${level + 1}`);
    setText('momentumValue', momentum); setText('dataMomentum', momentum);
    document.getElementById('momentumRing')?.style.setProperty('--p', momentum);
    setText('questCount', `${done} / ${quests.length}`); setText('xpToday', xpToday); setText('weekScore', `${weekCount} / 7`);
    setText('momentumMessage', momentum >= 80 ? 'Strong day. You have already done enough to protect momentum.' : momentum >= 50 ? 'Good progress. One more useful action moves the day forward.' : momentum > 0 ? 'Momentum started. Keep the next action small.' : 'Complete one useful action to get moving.');
  }

  function renderAttributes() {
    const list = document.getElementById('attributeList');
    if (!list) return;
    list.innerHTML = Object.entries(attributeMeta).map(([key, [name, desc]]) => {
      const raw = state.attributes[key] || 0;
      const statLevel = Math.floor(raw / 50) + 1;
      const pct = (raw % 50) * 2;
      return `<div class="attribute-row"><div class="attribute-name"><strong>${name}</strong><span>${desc}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><div class="attribute-value">${statLevel}</div></div>`;
    }).join('');
  }

  function renderBossAndAchievements() {
    const pct = Math.min(100, Math.round((state.completedWorkouts / 12) * 100));
    setText('bossProgressText', `${state.completedWorkouts} / 12 workouts`); setText('bossPct', `${pct}%`); setWidth('bossBar', pct);
    const achievements = [
      { icon: 'Ⅰ', name: 'First Step', desc: 'Complete one quest', unlocked: state.totalXp > 0 },
      { icon: '▲', name: 'First Session', desc: 'Finish one workout', unlocked: state.completedWorkouts >= 1 },
      { icon: 'Ⅴ', name: 'Five Sessions', desc: 'Finish five workouts', unlocked: state.completedWorkouts >= 5 },
      { icon: '⚑', name: 'Gate Cleared', desc: 'Finish 12 workouts', unlocked: state.completedWorkouts >= 12 }
    ];
    const grid = document.getElementById('achievementGrid');
    if (grid) grid.innerHTML = achievements.map(a => `<div class="achievement ${a.unlocked ? '' : 'locked'}"><div class="achievement-icon">${a.icon}</div><div><strong>${a.name}</strong><span>${a.unlocked ? 'Unlocked' : a.desc}</span></div></div>`).join('');
  }

  function renderWeight() {
    const sorted = [...state.weights].sort((a,b) => a.date - b.date);
    const latest = sorted.at(-1);
    setText('latestWeight', latest ? Number(latest.value).toFixed(1) : '—');
    setText('dataWeight', latest ? `${Number(latest.value).toFixed(1)} lb` : '—');
    setText('weightSourceLabel', latest?.sourceLabel || (latest?.sourceProvider === 'renpho' ? 'RENPHO' : latest?.sourceProvider === 'apple_health' ? 'Apple Health' : 'Manual'));
    if (sorted.length >= 2) {
      const diff = Number(latest.value) - Number(sorted[0].value);
      const direction = diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
      setText('weightTrend', `${direction} ${Math.abs(diff).toFixed(1)} lb since first logged weigh-in`);
      setText('weightHistoryText', `${sorted.length} weigh-ins · first ${Number(sorted[0].value).toFixed(1)} lb · latest ${Number(latest.value).toFixed(1)} lb`);
    } else {
      setText('weightTrend', latest ? 'First weigh-in recorded. Trend needs more data.' : 'Add your first weigh-in.');
      setText('weightHistoryText', latest ? 'One weigh-in recorded. Add more to establish a trend.' : 'No weigh-ins yet.');
    }
    renderWeightChart(sorted.slice(-14));
  }

  function renderWeightChart(values) {
    const chart = document.getElementById('weightChart');
    if (!chart) return;
    if (!values.length) { chart.innerHTML = '<div class="empty-state">Weight trend will appear here.</div>'; return; }
    const nums = values.map(v => Number(v.value));
    const min = Math.min(...nums); const max = Math.max(...nums); const range = Math.max(1, max - min);
    chart.innerHTML = values.map(v => {
      const height = 35 + ((Number(v.value) - min) / range) * 65;
      return `<div class="weight-bar" style="height:${height}%" title="${Number(v.value).toFixed(1)} lb"></div>`;
    }).join('');
  }

  function renderSteps() {
    const steps = Number(state.steps[todayKey()] || 0);
    setText('stepValue', steps.toLocaleString()); setText('dataSteps', steps.toLocaleString()); setWidth('stepBar', Math.min(100, steps / 70));
    const source = state.stepSources[todayKey()];
    setText('stepSourceLabel', source?.label || 'Manual');
  }

  function workoutModel() {
    if (!exerciseSystem) {
      const limit = { quick: 3, standard: 4, full: 5 }[state.workoutMode] || 4;
      return {
        template: { id: 'foundation-a', name: 'Full Body A', focus: 'Foundation strength' },
        location: state.workoutLocation,
        mode: state.workoutMode,
        selections: fallbackExercises.slice(0, limit).map(exercise => ({ movement: exercise.movement, selected: exercise, choices: [exercise] }))
      };
    }
    return exerciseSystem.buildWorkout(state.workoutTemplate, state.workoutLocation, state.workoutMode, state.exerciseChoices);
  }

  function renderWorkout() {
    const model = workoutModel();
    const profile = exerciseSystem?.equipmentProfiles?.[state.workoutLocation];
    setText('selectedModeLabel', state.workoutMode.charAt(0).toUpperCase() + state.workoutMode.slice(1));
    setText('trainWorkoutName', model.template.name);
    setText('todayWorkoutName', model.template.name);
    setText('trainWorkoutFocus', model.template.focus || 'Foundation strength');
    setText('todayWorkoutLocation', profile?.label || 'Home');
    setText('workoutEquipmentNote', profile?.note || 'Workout substitutions follow the selected location.');
    document.querySelectorAll('[data-workout-mode]').forEach(b => b.classList.toggle('selected', b.dataset.workoutMode === state.workoutMode));
    document.querySelectorAll('[data-workout-location]').forEach(b => b.classList.toggle('selected', b.dataset.workoutLocation === state.workoutLocation));

    const bucket = getDayBucket(state.workoutSets);
    const html = model.selections.map((slot, eIndex) => {
      const exercise = slot.selected;
      if (!exercise) return `<article class="exercise-card"><div class="eyebrow">${escapeHtml(slot.movement)}</div><h3>No verified exercise available</h3><p class="muted compact">Update the equipment profile before this movement is assigned here.</p></article>`;
      const baseSets = Number(exercise.defaultSets || exercise.sets || 2);
      const sets = state.workoutMode === 'quick' ? Math.min(2, baseSets) : baseSets;
      const defaultReps = Number(exercise.defaultReps || exercise.reps || 8);
      const unit = exercise.repUnit || 'reps';
      const rows = Array.from({length: sets}, (_, i) => {
        const key = `${exercise.id}:${i}`;
        const saved = bucket[key] || {};
        return `<div class="set-row"><span>Set ${i+1}</span><input data-set-key="${key}" data-field="reps" type="number" min="0" max="1000" value="${saved.reps ?? defaultReps}" aria-label="${escapeHtml(exercise.name)} set ${i+1} ${unit}"><input data-set-key="${key}" data-field="load" type="number" min="0" max="2000" step="0.5" value="${saved.load ?? 0}" aria-label="${escapeHtml(exercise.name)} set ${i+1} load"><button class="set-check ${saved.done ? 'done' : ''}" data-set-check="${key}">${saved.done ? '✓' : '○'}</button></div>`;
      }).join('');
      const choices = slot.choices || [exercise];
      const substitution = choices.length > 1 ? `<div class="exercise-substitution"><label for="sub-${slot.movement}">Substitute</label><select id="sub-${slot.movement}" data-exercise-choice="${slot.movement}">${choices.map(choice => `<option value="${choice.id}" ${choice.id === exercise.id ? 'selected' : ''}>${escapeHtml(choice.name)}</option>`).join('')}</select></div>` : '';
      return `<article class="exercise-card">
        <div class="exercise-top"><div><div class="eyebrow">${escapeHtml(slot.movement.replaceAll('_',' '))}</div><h3>${escapeHtml(exercise.name)}</h3><div class="exercise-meta">${escapeHtml(exercise.cue)}</div></div><span class="small-tag">${sets} sets</span></div>
        <div class="exercise-details"><span><strong>Targets:</strong> ${escapeHtml((exercise.muscles || []).join(', '))}</span><span><strong>Equipment:</strong> ${escapeHtml((exercise.requiredEquipment || []).join(', ').replaceAll('_',' '))}</span></div>
        ${substitution}
        <div class="set-list">${rows}</div>
      </article>`;
    }).join('');
    const list = document.getElementById('exerciseList');
    if (list) list.innerHTML = html;
    document.querySelectorAll('[data-set-key]').forEach(input => input.addEventListener('change', saveSetInput));
    document.querySelectorAll('[data-set-check]').forEach(button => button.addEventListener('click', () => toggleSet(button.dataset.setCheck)));
    document.querySelectorAll('[data-exercise-choice]').forEach(select => select.addEventListener('change', event => {
      state.exerciseChoices[event.target.dataset.exerciseChoice] = event.target.value;
      saveState();
      renderWorkout();
    }));
    updateWorkoutCompletion();
  }

  function saveSetInput(event) {
    const bucket = getDayBucket(state.workoutSets); const key = event.target.dataset.setKey;
    bucket[key] = bucket[key] || {}; bucket[key][event.target.dataset.field] = Number(event.target.value || 0); saveState();
  }

  function toggleSet(key) {
    const bucket = getDayBucket(state.workoutSets); bucket[key] = bucket[key] || {}; bucket[key].done = !bucket[key].done; saveState(); renderWorkout();
  }

  function currentWorkoutKeys() {
    const model = workoutModel();
    return model.selections.flatMap(slot => {
      const exercise = slot.selected;
      if (!exercise) return [];
      const baseSets = Number(exercise.defaultSets || exercise.sets || 2);
      const sets = state.workoutMode === 'quick' ? Math.min(2, baseSets) : baseSets;
      return Array.from({length: sets}, (_, i) => `${exercise.id}:${i}`);
    });
  }

  function updateWorkoutCompletion() {
    const keys = currentWorkoutKeys(); const bucket = getDayBucket(state.workoutSets); const done = keys.filter(k => bucket[k]?.done).length;
    setText('workoutCompletion', `${keys.length ? Math.round(done / keys.length * 100) : 0}%`);
  }

  function latestWeightLb() {
    const latest = [...state.weights].sort((a,b) => a.date - b.date).at(-1);
    return latest ? Number(latest.value) : null;
  }

  function finishWorkout() {
    const keys = currentWorkoutKeys(); const bucket = getDayBucket(state.workoutSets); const done = keys.filter(k => bucket[k]?.done).length;
    if (!keys.length || done < Math.ceil(keys.length * .6)) { showToast('Complete at least 60% of the selected workout first.'); return; }
    const awardKey = `workout:${todayKey()}`;
    if (state.awarded[awardKey]) { showToast('Today\'s workout is already recorded.'); return; }
    const model = workoutModel();
    state.completedWorkouts += 1;
    state.workoutDates.push(todayKey());
    addXp(45, `Completed ${state.workoutMode} ${model.template.name}`, 'strength', awardKey);
    state.attributes.consistency += 15;
    getDayBucket(state.quests).train = true;
    state.awarded[`quest:${todayKey()}:train`] = true;

    const energy = exerciseSystem?.estimateSessionEnergy({ templateId: state.workoutTemplate, mode: state.workoutMode, bodyWeightLb: latestWeightLb() }) || null;
    const event = normalizedEvent({
      metricType: 'workout_completed',
      value: done / keys.length,
      unit: 'fraction',
      observedAt: new Date().toISOString(),
      sourceProvider: 'zero2fit',
      sourceDevice: 'web_app',
      sourceRecordId: awardKey,
      provenanceStatus: 'observed',
      confidence: 'user_tracked',
      metadata: {
        template_id: state.workoutTemplate,
        workout_name: model.template.name,
        mode: state.workoutMode,
        location: state.workoutLocation,
        completed_sets: done,
        planned_sets: keys.length,
        exercise_ids: model.selections.map(slot => slot.selected?.id).filter(Boolean),
        fallback_energy_estimate: energy
      }
    });
    if (event) persistEvents([event]);
    saveState(); renderAll(); showToast('+45 XP · Workout complete');
  }

  function renderMeals() {
    const meals = state.meals[todayKey()] || [];
    const calories = meals.reduce((s,m) => s + Number(m.calories || 0), 0);
    const protein = meals.reduce((s,m) => s + Number(m.protein || 0), 0);
    setText('calorieTotal', Math.round(calories).toLocaleString()); setText('proteinTotal', Math.round(protein));
    const list = document.getElementById('mealList');
    if (!list) return;
    list.innerHTML = meals.length ? meals.map((m,i) => `<div class="meal-row"><strong>${escapeHtml(m.name)}</strong><span>${m.calories} kcal</span><span>${m.protein} g protein</span><button data-remove-meal="${i}">Remove</button></div>`).join('') : '<div class="empty-state">No food logged yet.</div>';
    list.querySelectorAll('[data-remove-meal]').forEach(button => button.addEventListener('click', () => { meals.splice(Number(button.dataset.removeMeal),1); saveState(); renderAll(); }));
  }

  function renderJourney() {
    setText('completedWorkouts', state.completedWorkouts);
    const active = weekActiveDays(); const now = new Date();
    const weekDots = document.getElementById('weekDots');
    if (weekDots) weekDots.innerHTML = Array.from({length:7}, (_,offset) => {
      const d = new Date(now); d.setDate(now.getDate() - (6 - offset)); const key = dateKey(d);
      return `<div class="week-dot ${active.has(key) ? 'active' : ''}" title="${key}">${d.toLocaleDateString(undefined,{weekday:'narrow'})}</div>`;
    }).join('');
    const xpLog = document.getElementById('xpLog');
    if (xpLog) xpLog.innerHTML = state.xpLog.length ? state.xpLog.slice(0,8).map(x => `<div class="xp-log-row"><strong>${escapeHtml(x.reason)}</strong><span>+${x.amount} XP</span></div>`).join('') : '<div class="empty-state">Your XP history will appear here.</div>';
  }

  async function renderDataStatus() {
    setText('buildNumber', BUILD);
    const remote = storage?.remoteStatus?.() || { configured: false, active: false, mode: 'unavailable' };
    setText('cloudStatus', remote.active ? 'Active' : remote.configured ? 'Prepared' : 'Not configured');
    setText('cloudStatusDetail', remote.note || 'Local-only runtime.');
    if (!storage) return;
    try {
      const stats = await storage.getStats();
      setText('indexedDbStatus', stats.indexedDb ? 'Active' : 'Unavailable');
      setText('normalizedEventCount', Number(stats.events || 0).toLocaleString());
      setText('importRunCount', Number(stats.imports || 0).toLocaleString());
      setText('lastLocalSave', stats.lastSavedAt ? new Date(stats.lastSavedAt).toLocaleString() : '—');
    } catch (error) {
      setText('indexedDbStatus', 'Error');
      console.warn(error);
    }
    const summary = state.importSummary;
    setText('lastImportSummary', summary ? `${summary.eventCount} events · ${summary.source} · ${new Date(summary.at).toLocaleString()}` : 'No device file imported yet.');
  }

  function renderAll() {
    renderQuests(); renderSummary(); renderAttributes(); renderBossAndAchievements(); renderWeight(); renderSteps(); renderWorkout(); renderMeals(); renderJourney();
    renderDataStatus();
  }

  function logManualWeight(value) {
    const observedAt = new Date().toISOString();
    state.weights.push({ date: Date.now(), value, sourceProvider: 'manual', sourceLabel: 'Manual', observedAt });
    state.weights = state.weights.slice(-1000);
    const event = normalizedEvent({ metricType:'weight', value, unit:'lb', observedAt, sourceProvider:'manual', sourceDevice:'web_app', provenanceStatus:'user-entered', confidence:'measured' });
    if (event) persistEvents([event]);
  }

  function logManualSteps(value) {
    const key = todayKey(); const observedAt = new Date().toISOString();
    state.steps[key] = value;
    state.stepSources[key] = { provider:'manual', label:'Manual', observedAt };
    const event = normalizedEvent({ metricType:'steps', value, unit:'count', observedAt, sourceProvider:'manual', sourceDevice:'web_app', provenanceStatus:'user-entered', confidence:'measured', metadata:{ aggregation:'daily_total', date:key } });
    if (event) persistEvents([event]);
  }

  function applyImportedEvents(events) {
    let appliedWeight = false;
    let appliedSteps = false;
    events.forEach(event => {
      if (state.importedEventIds[event.event_id]) return;
      state.importedEventIds[event.event_id] = true;

      if (event.metric_type === 'weight' && Number.isFinite(Number(event.value))) {
        let pounds = null;
        const unit = String(event.unit || '').toLowerCase();
        if (unit === 'lb' || unit === 'lbs') pounds = Number(event.value);
        if (unit === 'kg') pounds = Number(event.value) * 2.2046226218;
        if (pounds !== null && Number.isFinite(pounds)) {
          state.weights.push({
            date: new Date(event.observed_at).getTime(), value: pounds,
            sourceProvider: event.source_provider,
            sourceLabel: event.source_provider === 'renpho' ? 'RENPHO' : event.source_provider === 'apple_health' ? 'Apple Health' : event.source_provider,
            sourceEventId: event.event_id,
            observedAt: event.observed_at
          });
          appliedWeight = true;
        }
      }

      if (event.metric_type === 'steps' && event.metadata?.aggregation === 'daily_total' && Number.isFinite(Number(event.value))) {
        const key = dateKey(new Date(event.observed_at));
        state.steps[key] = Math.max(0, Math.round(Number(event.value)));
        state.stepSources[key] = { provider:event.source_provider, label:event.source_provider === 'apple_health' ? 'Apple Health' : 'Health bridge', observedAt:event.observed_at };
        appliedSteps = true;
      }
    });
    state.weights.sort((a,b) => a.date - b.date);
    state.weights = state.weights.slice(-1000);
    return { appliedWeight, appliedSteps };
  }

  async function handleDeviceImport(event) {
    event.preventDefault();
    const fileInput = document.getElementById('deviceImportFile');
    const sourceSelect = document.getElementById('deviceImportSource');
    const button = document.getElementById('deviceImportButton');
    const file = fileInput?.files?.[0];
    if (!file || !ingestion || !storage) { showToast('Select a supported import file first.'); return; }
    button.disabled = true;
    setText('importWarning', '');
    try {
      const result = await ingestion.importFile(file, sourceSelect?.value || 'auto');
      await storage.upsertEvents(result.events);
      await storage.recordImport(result.importRecord);
      const applied = applyImportedEvents(result.events);
      state.importSummary = { at: Date.now(), source: result.importRecord.source_provider, eventCount: result.events.length, warnings: result.warnings };
      saveState(); renderAll();
      const details = [applied.appliedWeight ? 'weight updated' : null, applied.appliedSteps ? 'daily steps updated' : null].filter(Boolean).join(' · ');
      setText('importWarning', result.warnings.join(' '));
      showToast(`${result.events.length} events imported${details ? ` · ${details}` : ''}`);
      fileInput.value = '';
    } catch (error) {
      setText('importWarning', error.message || 'Import failed.');
      showToast('Import failed. See Data for details.');
    } finally {
      button.disabled = false;
    }
  }

  async function exportBackup() {
    if (!storage) { showToast('Backup storage module is unavailable.'); return; }
    try {
      const backup = await storage.exportBackup(state);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zero2fit-backup-${todayKey()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Zero2Fit backup exported.');
    } catch (error) {
      console.warn(error); showToast('Backup export failed.');
    }
  }

  function bindForms() {
    document.getElementById('weightForm')?.addEventListener('submit', event => {
      event.preventDefault(); const input = document.getElementById('weightInput'); const value = Number(input.value);
      if (!Number.isFinite(value) || value <= 0) return;
      logManualWeight(value); input.value = ''; saveState(); renderAll(); showToast('Weight logged.');
    });

    document.getElementById('stepsForm')?.addEventListener('submit', event => {
      event.preventDefault(); const input = document.getElementById('stepsInput'); const value = Math.max(0, Number(input.value || 0));
      logManualSteps(value); input.value='';
      if (value >= 7000 && !getDayBucket(state.quests).move) { const q = quests.find(x=>x.id==='move'); getDayBucket(state.quests).move=true; addXp(q.xp,q.label,q.attr,`quest:${todayKey()}:move`); state.attributes.consistency += 5; }
      saveState(); renderAll(); showToast('Steps updated.');
    });

    document.getElementById('mealForm')?.addEventListener('submit', event => {
      event.preventDefault(); const name=document.getElementById('mealName'); const calories=document.getElementById('mealCalories'); const protein=document.getElementById('mealProtein');
      const bucket = state.meals[todayKey()] || (state.meals[todayKey()] = []); bucket.push({name:name.value.trim(),calories:Number(calories.value||0),protein:Number(protein.value||0)}); name.value=''; calories.value=''; protein.value='';
      if (!getDayBucket(state.quests).nutrition) { const q=quests.find(x=>x.id==='nutrition'); getDayBucket(state.quests).nutrition=true; addXp(q.xp,q.label,q.attr,`quest:${todayKey()}:nutrition`); state.attributes.consistency += 5; }
      saveState(); renderAll(); showToast('Nutrition entry added.');
    });

    document.getElementById('clearMeals')?.addEventListener('click', () => { state.meals[todayKey()] = []; saveState(); renderAll(); showToast('Today\'s food log cleared.'); });
    document.getElementById('finishWorkout')?.addEventListener('click', finishWorkout);
    document.querySelectorAll('[data-workout-mode]').forEach(button => button.addEventListener('click', () => { state.workoutMode=button.dataset.workoutMode; saveState(); renderWorkout(); }));
    document.querySelectorAll('[data-workout-location]').forEach(button => button.addEventListener('click', () => { state.workoutLocation=button.dataset.workoutLocation; saveState(); renderWorkout(); }));
    document.getElementById('deviceImportForm')?.addEventListener('submit', handleDeviceImport);
    document.getElementById('exportBackup')?.addEventListener('click', exportBackup);

    document.getElementById('resetDemo')?.addEventListener('click', async () => {
      if (window.confirm('Reset all local Zero2Fit data in this browser?')) {
        state=defaultState(); localStorage.removeItem(STORAGE_KEY);
        if (storage) { try { await storage.clearAll(); } catch (error) { console.warn(error); } }
        saveState(); renderAll(); showToast('Local data reset.');
      }
    });
  }

  async function initStorage() {
    if (!storage) return;
    try {
      await storage.openDb();
      if (!localStateLoaded) {
        const snapshot = await storage.loadSnapshot();
        if (snapshot) {
          state = migrateState(snapshot);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          localStateLoaded = true;
          renderAll();
          showToast('Local data restored from IndexedDB.');
        } else {
          await storage.saveSnapshot(state);
        }
      } else {
        await storage.saveSnapshot(state);
      }
      renderDataStatus();
    } catch (error) {
      console.warn('IndexedDB initialization failed:', error);
      setText('indexedDbStatus', 'Unavailable');
    }
  }

  function setText(id, value) { const el=document.getElementById(id); if (el) el.textContent=String(value); }
  function setWidth(id, pct) { const el=document.getElementById(id); if (el) el.style.width=`${Math.max(0,Math.min(100,Number(pct)||0))}%`; }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function showToast(message) { const el=document.getElementById('toast'); if (!el) return; el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2300); }

  function init() {
    setText('todayDate', new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}));
    renderNavigation(); bindForms(); renderAll(); initStorage();
  }

  init();
})();
