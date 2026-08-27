(() => {
  'use strict';

  const STORAGE_KEY = 'zero2fit-v1';
  const todayKey = () => new Date().toISOString().slice(0, 10);

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
    meals: {},
    workoutMode: 'standard',
    workoutLocation: 'home',
    plannedTemplates: {},
    workoutSelections: {},
    workoutSets: {},
    workoutSessionStarts: {},
    workoutHistory: [],
    workoutEnergyLog: [],
    completedWorkouts: 0,
    workoutDates: [],
    awarded: {}
  });

  const quests = [
    { id: 'move', label: 'Move on purpose', detail: 'Reach 7,000 steps or mark a purposeful walk', xp: 20, attr: 'endurance' },
    { id: 'train', label: 'Training session', detail: 'Complete today\'s generated workout or Quick version', xp: 35, attr: 'strength' },
    { id: 'nutrition', label: 'Log nutrition', detail: 'Record enough food to understand the day', xp: 15, attr: 'nutrition' },
    { id: 'recovery', label: 'Recovery check', detail: 'Acknowledge sleep/recovery before pushing intensity', xp: 10, attr: 'recovery' }
  ];

  const attributeMeta = {
    strength: ['Strength', 'Training progression'],
    endurance: ['Endurance', 'Walking & cardio'],
    consistency: ['Consistency', 'Showing up'],
    recovery: ['Recovery', 'Sleep & easier days'],
    nutrition: ['Nutrition', 'Food awareness']
  };

  const intentLabels = {
    knee_dominant: 'Knee-dominant legs',
    horizontal_push: 'Horizontal push',
    horizontal_pull: 'Horizontal pull / back',
    hip_hinge: 'Hip hinge',
    core_stability: 'Core stability',
    single_leg: 'Single-leg legs',
    vertical_push: 'Vertical push',
    vertical_pull_lats: 'Vertical pull / lats',
    posterior_chain: 'Posterior chain',
    core: 'Core'
  };

  const equipmentLabels = {
    bodyweight: 'Bodyweight', yoga_mat: 'Yoga mat', wall: 'Wall', resistance_band: 'Resistance band',
    dumbbell: 'Dumbbell', barbell: 'Barbell', cable_machine: 'Cable machine', machine: 'Machine',
    kettlebell: 'Kettlebell', stability_ball: 'Stability ball', medicine_ball: 'Medicine ball',
    foam_roller: 'Foam roller', ez_bar: 'EZ bar', pullup_bar: 'Pull-up bar', low_bar: 'Low bar',
    dip_station: 'Dip station', bench: 'Bench', box: 'Box', step_platform: 'Step/platform',
    anchor_or_ghd: 'Anchor/GHD', roman_chair: 'Roman chair', climbing_rope: 'Climbing rope',
    sled: 'Sled', partner: 'Partner', chair: 'Chair', other: 'Gym apparatus'
  };

  let state = loadState();
  let toastTimer = null;
  let trainingCore = null;
  let trainingData = null;
  let trainingError = null;
  let openSubstituteIntent = null;

  function loadState() {
    const defaults = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        ...parsed,
        version: 2,
        attributes: { ...defaults.attributes, ...(parsed.attributes || {}) },
        plannedTemplates: parsed.plannedTemplates || {},
        workoutSelections: parsed.workoutSelections || {},
        workoutSessionStarts: parsed.workoutSessionStarts || {},
        workoutHistory: parsed.workoutHistory || [],
        workoutEnergyLog: parsed.workoutEnergyLog || [],
        workoutLocation: parsed.workoutLocation || 'home'
      };
    } catch {
      return defaults;
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getDayBucket(map) {
    const key = todayKey();
    if (!map[key]) map[key] = {};
    return map[key];
  }

  function addXp(amount, reason, attr, uniqueKey) {
    if (uniqueKey && state.awarded[uniqueKey]) return false;
    state.totalXp += amount;
    if (attr) state.attributes[attr] = (state.attributes[attr] || 0) + amount;
    if (reason) state.xpLog.unshift({ date: Date.now(), amount, reason });
    state.xpLog = state.xpLog.slice(0, 30);
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
    document.getElementById('pageTitle').textContent = titles[pageName] || 'Zero2Fit';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderQuests() {
    const container = document.getElementById('questList');
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
    const xpToday = state.xpLog.filter(x => new Date(x.date).toISOString().slice(0,10) === todayKey()).reduce((sum, x) => sum + x.amount, 0);
    const momentum = momentumScore();
    const activeDays = weekActiveDays();
    const now = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - i); return d.toISOString().slice(0,10);
    });
    const weekCount = last7.filter(d => activeDays.has(d)).length;

    setText('heroLevel', level); setText('characterLevel', level); setText('dataLevel', level);
    setText('heroXpText', `${intoLevel} / 100 XP`); setWidth('heroXpBar', intoLevel); setWidth('characterXpBar', intoLevel);
    setText('heroTitle', title); setText('characterTitle', title); setText('totalXp', state.totalXp); setText('journeyXp', state.totalXp);
    setText('characterXpText', `${remaining} XP until Level ${level + 1}`);
    setText('momentumValue', momentum); setText('dataMomentum', momentum); document.getElementById('momentumRing').style.setProperty('--p', momentum);
    setText('questCount', `${done} / ${quests.length}`); setText('xpToday', xpToday); setText('weekScore', `${weekCount} / 7`);
    setText('momentumMessage', momentum >= 80 ? 'Strong day. You have already done enough to protect momentum.' : momentum >= 50 ? 'Good progress. One more useful action moves the day forward.' : momentum > 0 ? 'Momentum started. Keep the next action small.' : 'Complete one useful action to get moving.');
  }

  function renderAttributes() {
    const list = document.getElementById('attributeList');
    list.innerHTML = Object.entries(attributeMeta).map(([key, [name, desc]]) => {
      const raw = state.attributes[key] || 0;
      const statLevel = Math.floor(raw / 50) + 1;
      const pct = raw % 50 * 2;
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
    document.getElementById('achievementGrid').innerHTML = achievements.map(a => `<div class="achievement ${a.unlocked ? '' : 'locked'}"><div class="achievement-icon">${a.icon}</div><div><strong>${a.name}</strong><span>${a.unlocked ? 'Unlocked' : a.desc}</span></div></div>`).join('');
  }

  function renderWeight() {
    const sorted = [...state.weights].sort((a,b) => a.date - b.date);
    const latest = sorted.at(-1);
    setText('latestWeight', latest ? latest.value.toFixed(1) : '—');
    setText('dataWeight', latest ? `${latest.value.toFixed(1)} lb` : '—');
    if (sorted.length >= 2) {
      const diff = latest.value - sorted[0].value;
      const direction = diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
      setText('weightTrend', `${direction} ${Math.abs(diff).toFixed(1)} lb since first logged weigh-in`);
      setText('weightHistoryText', `${sorted.length} weigh-ins · first ${sorted[0].value.toFixed(1)} lb · latest ${latest.value.toFixed(1)} lb`);
    } else {
      setText('weightTrend', latest ? 'First weigh-in recorded. Trend needs more data.' : 'Add your first weigh-in.');
      setText('weightHistoryText', latest ? 'One weigh-in recorded. Add more to establish a trend.' : 'No weigh-ins yet.');
    }
    renderWeightChart(sorted.slice(-14));
  }

  function renderWeightChart(values) {
    const chart = document.getElementById('weightChart');
    if (!values.length) { chart.innerHTML = '<div class="empty-state">Weight trend will appear here.</div>'; return; }
    const nums = values.map(v => v.value);
    const min = Math.min(...nums); const max = Math.max(...nums); const range = Math.max(1, max - min);
    chart.innerHTML = values.map(v => {
      const height = 35 + ((v.value - min) / range) * 65;
      return `<div class="weight-bar" style="height:${height}%" title="${v.value.toFixed(1)} lb"></div>`;
    }).join('');
  }

  function latestWeight() {
    if (!state.weights.length) return null;
    return [...state.weights].sort((a,b) => a.date - b.date).at(-1)?.value ?? null;
  }

  function renderStepsSafe() {
    const steps = Number(state.steps[todayKey()] || 0);
    setText('stepValue', steps.toLocaleString()); setText('dataSteps', steps.toLocaleString()); setWidth('stepBar', Math.min(100, steps / 70));
  }

  function getTodayTemplateId() {
    const day = todayKey();
    if (!state.plannedTemplates[day]) {
      state.plannedTemplates[day] = state.completedWorkouts % 2 === 0 ? 'full_body_a' : 'full_body_b';
      saveState();
    }
    return state.plannedTemplates[day];
  }

  function getTemplate() {
    const id = getTodayTemplateId();
    return trainingData?.programmingRules?.templates?.find(template => template.id === id) || null;
  }

  function selectionContextKey() {
    return `${state.workoutLocation}:${getTodayTemplateId()}`;
  }

  function previousSelections() {
    return state.workoutSelections[selectionContextKey()] || {};
  }

  function getCurrentPlan() {
    if (!trainingCore || !trainingData) return null;
    return trainingCore.generateWorkout({
      exercises: trainingData.exercises,
      template: getTemplate(),
      locationKey: state.workoutLocation,
      mode: state.workoutMode,
      previousSelections: previousSelections(),
      programmingRules: trainingData.programmingRules,
      substitutionRules: trainingData.substitutionRules
    });
  }

  function workoutContextKey() {
    return `${todayKey()}:${state.workoutLocation}:${getTodayTemplateId()}:${state.workoutMode}`;
  }

  function setKeyFor(item, setIndex) {
    return `${state.workoutLocation}:${getTodayTemplateId()}:${item.slot.intent}:${item.exercise.id}:${setIndex}`;
  }

  function formatEquipment(exercise) {
    if (!exercise?.requiredEquipment?.length) return 'Bodyweight / no apparatus';
    return exercise.requiredEquipment.map(item => equipmentLabels[item] || item.replaceAll('_', ' ')).join(' + ');
  }

  function renderTrainingContext() {
    const template = getTemplate();
    const location = trainingData?.locations?.[state.workoutLocation];
    setText('selectedModeLabel', state.workoutMode.charAt(0).toUpperCase() + state.workoutMode.slice(1));
    setText('trainingTemplateName', template?.name || 'Loading workout…');
    setText('todayWorkoutName', template?.name || 'Loading workout…');
    setText('todayTrainingLocation', location?.label || 'Loading equipment profile…');
    setText('trainingLocationStatus', location ? (location.inventoryStatus === 'pending_photos' ? 'Equipment profile pending photos · Home-safe fallback active' : location.notes) : 'Loading researched equipment data…');
    document.querySelectorAll('[data-workout-location]').forEach(button => button.classList.toggle('selected', button.dataset.workoutLocation === state.workoutLocation));
    document.querySelectorAll('[data-workout-mode]').forEach(button => button.classList.toggle('selected', button.dataset.workoutMode === state.workoutMode));
  }

  function energyPreview(plan) {
    if (!trainingCore || !trainingData || !plan) return null;
    const profile = trainingCore.sessionEnergyProfile({ locationKey: state.workoutLocation, mode: state.workoutMode, energyModel: trainingData.energyModel });
    const start = Number(state.workoutSessionStarts[workoutContextKey()] || 0);
    const elapsed = start ? Math.max(1, (Date.now() - start) / 60000) : plan.targetMinutes;
    const weight = latestWeight();
    const estimate = weight ? trainingCore.estimateEnergy({ met: profile.met, weightLb: weight, durationMinutes: elapsed }) : null;
    return { profile, estimate, durationMinutes: elapsed, isLive: !!start, weight };
  }

  function renderEnergy(plan) {
    const preview = energyPreview(plan);
    if (!preview) {
      setText('energyValue', '—');
      setText('energyMeta', trainingError ? 'Reference data unavailable.' : 'Loading energy model…');
      return;
    }
    if (!preview.estimate) {
      setText('energyValue', '—');
      setText('energyMeta', `${preview.profile.met} MET · latest body weight required for automatic estimate`);
      setText('todayEnergyPreview', 'Energy estimate will calculate automatically once a weight is available.');
      return;
    }
    setText('energyValue', `~${Math.round(preview.estimate.grossKcal)} kcal`);
    setText('energyMeta', `${preview.isLive ? 'Session-to-now estimate' : 'Planned-session estimate'} · ${preview.profile.met} MET · ${Math.round(preview.durationMinutes)} min`);
    setText('todayEnergyPreview', `~${Math.round(preview.estimate.grossKcal)} kcal planned · calculated automatically from ${preview.profile.met} MET, latest weight and ${Math.round(preview.durationMinutes)} min`);
  }

  function substituteHtml(item) {
    if (!openSubstituteIntent || openSubstituteIntent !== item.slot.intent || !item.exercise || !trainingCore) return '';
    const alternatives = trainingCore.rankSubstitutes(
      trainingData.exercises,
      item.exercise,
      item.slot,
      state.workoutLocation,
      trainingData.substitutionRules
    ).filter(option => ['direct_substitute', 'good_substitute'].includes(option.quality)).slice(0, 4);
    const choices = alternatives.length ? alternatives.map(option => `
      <button class="substitute-option" data-choose-substitute="${escapeHtml(option.exercise.id)}" data-substitute-intent="${escapeHtml(item.slot.intent)}">
        <span><strong>${escapeHtml(option.exercise.name)}</strong><small>${escapeHtml(formatEquipment(option.exercise))}</small></span>
        <span>${escapeHtml(trainingCore.formatQuality(option.quality))}</span>
      </button>`).join('') : '<div class="empty-state compact">No other good-or-better match at this location.</div>';
    return `<div class="substitute-panel"><div class="substitute-heading"><strong>Choose another good match</strong><button class="text-button" data-auto-substitute="${escapeHtml(item.slot.intent)}">Use automatic pick</button></div>${choices}</div>`;
  }

  function renderWorkout() {
    renderTrainingContext();
    const container = document.getElementById('exerciseList');
    if (trainingError) {
      container.innerHTML = `<article class="exercise-card unavailable-card"><h3>Workout reference data could not load</h3><p>${escapeHtml(trainingError)}</p></article>`;
      setText('workoutCompletion', '—');
      renderEnergy(null);
      return;
    }
    const plan = getCurrentPlan();
    if (!plan) {
      container.innerHTML = '<article class="exercise-card"><div class="empty-state">Loading researched exercise catalog…</div></article>';
      setText('workoutCompletion', '—');
      renderEnergy(null);
      return;
    }

    const bucket = getDayBucket(state.workoutSets);
    const html = plan.slots.map((item, eIndex) => {
      const intent = intentLabels[item.slot.intent] || item.slot.intent.replaceAll('_', ' ');
      if (!item.exercise) {
        const fullGymPlan = state.workoutLocation !== 'fullGym' ? trainingCore.generateWorkout({
          exercises: trainingData.exercises,
          template: getTemplate(),
          locationKey: 'fullGym',
          mode: state.workoutMode,
          programmingRules: trainingData.programmingRules,
          substitutionRules: trainingData.substitutionRules
        }) : null;
        const gymMatch = fullGymPlan?.slots?.find(slot => slot.slot.intent === item.slot.intent)?.exercise;
        return `<article class="exercise-card unavailable-card">
          <div class="exercise-top"><div><div class="eyebrow">Slot ${eIndex + 1} · ${escapeHtml(intent)}</div><h3>No true substitute here</h3></div><span class="small-tag unavailable-tag">Unavailable</span></div>
          <p class="exercise-meta">${escapeHtml(item.unavailableReason)}</p>
          ${gymMatch ? `<div class="location-unlock"><strong>Full Gym unlock:</strong> ${escapeHtml(gymMatch.name)} · ${escapeHtml(formatEquipment(gymMatch))}</div>` : ''}
          <p class="muted compact">This slot is not counted against workout completion. Zero2Fit will not replace it with a stretch or unrelated exercise.</p>
        </article>`;
      }

      const rows = Array.from({length: item.sets}, (_, i) => {
        const key = setKeyFor(item, i);
        const saved = bucket[key] || {};
        const reps = saved.reps ?? item.repRange[0];
        const loadInput = item.exercise.requiredEquipment.length
          ? `<input data-set-key="${escapeHtml(key)}" data-field="load" type="number" min="0" max="1000" step="0.5" value="${saved.load ?? ''}" placeholder="lb" aria-label="${escapeHtml(item.exercise.name)} set ${i+1} load in pounds">`
          : '<span class="bodyweight-load">Bodyweight</span>';
        return `<div class="set-row"><span>Set ${i+1}</span><input data-set-key="${escapeHtml(key)}" data-field="reps" type="number" min="0" max="100" value="${reps}" aria-label="${escapeHtml(item.exercise.name)} set ${i+1} reps">${loadInput}<button class="set-check ${saved.done ? 'done' : ''}" data-set-check="${escapeHtml(key)}">${saved.done ? '✓' : '○'}</button></div>`;
      }).join('');
      const muscles = item.exercise.primaryMuscles.join(', ') || item.slot.primaryMuscles.join(', ');
      return `<article class="exercise-card">
        <div class="exercise-top"><div><div class="eyebrow">Slot ${eIndex+1} · ${escapeHtml(intent)}</div><h3>${escapeHtml(item.exercise.name)}</h3><div class="exercise-meta">${escapeHtml(muscles)} · ${escapeHtml(formatEquipment(item.exercise))}</div></div><span class="small-tag">${escapeHtml(trainingCore.formatQuality(item.quality))}</span></div>
        <div class="exercise-guidance"><span>${item.sets} set${item.sets === 1 ? '' : 's'} · ${item.repRange[0]}–${item.repRange[1]} reps</span><button class="text-button" data-show-substitutes="${escapeHtml(item.slot.intent)}">Substitute</button></div>
        ${substituteHtml(item)}
        <div class="set-list">${rows}</div>
        ${item.exercise.instructions?.[0] ? `<details class="exercise-instructions"><summary>How to do it</summary><p>${escapeHtml(item.exercise.instructions.slice(0,2).join(' '))}</p></details>` : ''}
      </article>`;
    }).join('');

    container.innerHTML = html;
    document.querySelectorAll('[data-set-key]').forEach(input => input.addEventListener('change', saveSetInput));
    document.querySelectorAll('[data-set-check]').forEach(button => button.addEventListener('click', () => toggleSet(button.dataset.setCheck)));
    document.querySelectorAll('[data-show-substitutes]').forEach(button => button.addEventListener('click', () => {
      openSubstituteIntent = openSubstituteIntent === button.dataset.showSubstitutes ? null : button.dataset.showSubstitutes;
      renderWorkout();
    }));
    document.querySelectorAll('[data-choose-substitute]').forEach(button => button.addEventListener('click', () => chooseSubstitute(button.dataset.substituteIntent, button.dataset.chooseSubstitute)));
    document.querySelectorAll('[data-auto-substitute]').forEach(button => button.addEventListener('click', () => clearSubstitute(button.dataset.autoSubstitute)));
    updateWorkoutCompletion(plan);
    renderEnergy(plan);
    renderWorkoutWarnings(plan);
  }

  function renderWorkoutWarnings(plan) {
    const box = document.getElementById('workoutWarnings');
    if (!box) return;
    box.innerHTML = plan?.warnings?.length ? plan.warnings.map(warning => `<div class="training-warning">${escapeHtml(warning)}</div>`).join('') : '';
  }

  function chooseSubstitute(intent, exerciseId) {
    const key = selectionContextKey();
    state.workoutSelections[key] = state.workoutSelections[key] || {};
    state.workoutSelections[key][intent] = exerciseId;
    openSubstituteIntent = null;
    saveState();
    renderWorkout();
    showToast('Exercise substitute selected.');
  }

  function clearSubstitute(intent) {
    const key = selectionContextKey();
    if (state.workoutSelections[key]) delete state.workoutSelections[key][intent];
    openSubstituteIntent = null;
    saveState();
    renderWorkout();
    showToast('Automatic exercise selection restored.');
  }

  function saveSetInput(event) {
    const bucket = getDayBucket(state.workoutSets);
    const key = event.target.dataset.setKey;
    bucket[key] = bucket[key] || {};
    bucket[key][event.target.dataset.field] = Number(event.target.value || 0);
    saveState();
  }

  function toggleSet(key) {
    const bucket = getDayBucket(state.workoutSets);
    bucket[key] = bucket[key] || {};
    const next = !bucket[key].done;
    bucket[key].done = next;
    const context = workoutContextKey();
    if (next && !state.workoutSessionStarts[context]) state.workoutSessionStarts[context] = Date.now();
    saveState();
    renderWorkout();
  }

  function currentWorkoutKeys(plan = getCurrentPlan()) {
    if (!plan) return [];
    return plan.slots.filter(item => item.exercise).flatMap(item => Array.from({ length: item.sets }, (_, i) => setKeyFor(item, i)));
  }

  function updateWorkoutCompletion(plan = getCurrentPlan()) {
    const keys = currentWorkoutKeys(plan);
    const bucket = getDayBucket(state.workoutSets);
    const done = keys.filter(k => bucket[k]?.done).length;
    setText('workoutCompletion', `${keys.length ? Math.round(done / keys.length * 100) : 0}%`);
  }

  function finishWorkout() {
    const plan = getCurrentPlan();
    const keys = currentWorkoutKeys(plan);
    const bucket = getDayBucket(state.workoutSets);
    const done = keys.filter(k => bucket[k]?.done).length;
    if (!keys.length) { showToast('No available exercises in this workout.'); return; }
    if (done < Math.ceil(keys.length * .6)) { showToast('Complete at least 60% of the available workout first.'); return; }
    const awardKey = `workout:${todayKey()}`;
    if (state.awarded[awardKey]) { showToast('Today\'s workout is already recorded.'); return; }

    const template = getTemplate();
    const context = workoutContextKey();
    const start = Number(state.workoutSessionStarts[context] || 0);
    const durationMinutes = start ? Math.max(1, (Date.now() - start) / 60000) : plan.targetMinutes;
    const preview = energyPreview(plan);
    const completedExerciseIds = plan.slots.filter(item => item.exercise).map(item => item.exercise.id);
    const unavailableIntents = plan.slots.filter(item => !item.exercise).map(item => item.slot.intent);

    state.completedWorkouts += 1;
    state.workoutDates.push(todayKey());
    state.workoutHistory.unshift({
      date: Date.now(),
      day: todayKey(),
      templateId: template?.id,
      templateName: template?.name,
      location: state.workoutLocation,
      mode: state.workoutMode,
      durationMinutes,
      completedExerciseIds,
      unavailableIntents
    });
    state.workoutHistory = state.workoutHistory.slice(0, 180);
    if (preview?.estimate) {
      state.workoutEnergyLog.unshift({
        date: Date.now(),
        day: todayKey(),
        location: state.workoutLocation,
        mode: state.workoutMode,
        templateId: template?.id,
        durationMinutes,
        met: preview.profile.met,
        compendiumCode: preview.profile.code,
        grossKcal: preview.estimate.grossKcal,
        activeKcal: preview.estimate.activeKcal,
        method: '2024 Adult Compendium MET estimate'
      });
      state.workoutEnergyLog = state.workoutEnergyLog.slice(0, 180);
    }
    delete state.workoutSessionStarts[context];
    addXp(45, `Completed ${state.workoutMode} ${template?.name || 'workout'} · ${trainingData.locations[state.workoutLocation].label}`, 'strength', awardKey);
    state.attributes.consistency += 15;
    getDayBucket(state.quests).train = true;
    state.awarded[`quest:${todayKey()}:train`] = true;
    saveState();
    renderAll();
    showToast('+45 XP · Workout complete');
  }

  function renderMealsSafe() {
    const meals = state.meals[todayKey()] || [];
    const calories = meals.reduce((s,m) => s + Number(m.calories || 0), 0);
    const protein = meals.reduce((s,m) => s + Number(m.protein || 0), 0);
    setText('calorieTotal', Math.round(calories).toLocaleString()); setText('proteinTotal', Math.round(protein));
    const list = document.getElementById('mealList');
    list.innerHTML = meals.length ? meals.map((m,i) => `<div class="meal-row"><strong>${escapeHtml(m.name)}</strong><span>${m.calories} kcal</span><span>${m.protein} g protein</span><button data-remove-meal="${i}">Remove</button></div>`).join('') : '<div class="empty-state">No food logged yet.</div>';
    list.querySelectorAll('[data-remove-meal]').forEach(button => button.addEventListener('click', () => { meals.splice(Number(button.dataset.removeMeal),1); saveState(); renderAll(); }));
  }

  function renderJourney() {
    setText('completedWorkouts', state.completedWorkouts);
    const active = weekActiveDays(); const now = new Date();
    document.getElementById('weekDots').innerHTML = Array.from({length:7}, (_,offset) => {
      const d = new Date(now); d.setDate(now.getDate() - (6 - offset)); const key = d.toISOString().slice(0,10);
      return `<div class="week-dot ${active.has(key) ? 'active' : ''}" title="${key}">${d.toLocaleDateString(undefined,{weekday:'narrow'})}</div>`;
    }).join('');
    document.getElementById('xpLog').innerHTML = state.xpLog.length ? state.xpLog.slice(0,8).map(x => `<div class="xp-log-row"><strong>${escapeHtml(x.reason)}</strong><span>+${x.amount} XP</span></div>`).join('') : '<div class="empty-state">Your XP history will appear here.</div>';
  }

  function renderDataCatalog() {
    if (!document.getElementById('fitnessCatalogStatus')) return;
    if (!trainingData) {
      setText('fitnessCatalogStatus', trainingError ? 'Unavailable' : 'Loading…');
      setText('fitnessCatalogDetail', trainingError || 'Loading researched exercise and MET catalogs.');
      return;
    }
    const summary = trainingData.catalogSummary;
    const trainingSummary = trainingData.trainingCatalogSummary;
    setText('fitnessCatalogStatus', 'Active');
    setText('fitnessCatalogDetail', `${summary.counts.exercises} exercises · ${trainingSummary.homeCompatibleCount} confirmed Home-compatible · ${summary.counts.metActivities} MET activities · equipment-aware substitutions`);
  }

  function renderAll() {
    renderQuests();
    renderSummary();
    renderAttributes();
    renderBossAndAchievements();
    renderWeight();
    renderStepsSafe();
    renderWorkout();
    renderMealsSafe();
    renderJourney();
    renderDataCatalog();
  }

  function bindForms() {
    document.getElementById('weightForm').addEventListener('submit', event => {
      event.preventDefault(); const input = document.getElementById('weightInput'); const value = Number(input.value);
      if (!Number.isFinite(value) || value <= 0) return;
      state.weights.push({ date: Date.now(), value, source: 'manual' }); state.weights = state.weights.slice(-365); input.value = ''; saveState(); renderAll(); showToast('Weight logged.');
    });
    document.getElementById('stepsForm').addEventListener('submit', event => {
      event.preventDefault(); const input = document.getElementById('stepsInput'); const value = Math.max(0, Number(input.value || 0)); state.steps[todayKey()] = value; input.value='';
      if (value >= 7000 && !getDayBucket(state.quests).move) { const q = quests.find(x=>x.id==='move'); getDayBucket(state.quests).move=true; addXp(q.xp,q.label,q.attr,`quest:${todayKey()}:move`); state.attributes.consistency += 5; }
      saveState(); renderAll(); showToast('Steps updated.');
    });
    document.getElementById('mealForm').addEventListener('submit', event => {
      event.preventDefault(); const name=document.getElementById('mealName'); const calories=document.getElementById('mealCalories'); const protein=document.getElementById('mealProtein');
      const bucket = state.meals[todayKey()] || (state.meals[todayKey()] = []); bucket.push({name:name.value.trim(),calories:Number(calories.value||0),protein:Number(protein.value||0)}); name.value=''; calories.value=''; protein.value='';
      if (!getDayBucket(state.quests).nutrition) { const q=quests.find(x=>x.id==='nutrition'); getDayBucket(state.quests).nutrition=true; addXp(q.xp,q.label,q.attr,`quest:${todayKey()}:nutrition`); state.attributes.consistency += 5; }
      saveState(); renderAll(); showToast('Nutrition entry added.');
    });
    document.getElementById('clearMeals').addEventListener('click', () => { state.meals[todayKey()] = []; saveState(); renderAll(); showToast('Today\'s food log cleared.'); });
    document.getElementById('finishWorkout').addEventListener('click', finishWorkout);
    document.querySelectorAll('[data-workout-mode]').forEach(button => button.addEventListener('click', () => {
      state.workoutMode = button.dataset.workoutMode;
      openSubstituteIntent = null;
      saveState();
      renderWorkout();
    }));
    document.querySelectorAll('[data-workout-location]').forEach(button => button.addEventListener('click', () => {
      state.workoutLocation = button.dataset.workoutLocation;
      openSubstituteIntent = null;
      saveState();
      renderWorkout();
      showToast(`${button.textContent.trim()} workout loaded.`);
    }));
    document.getElementById('resetDemo').addEventListener('click', () => {
      if (window.confirm('Reset all local Zero2Fit data in this browser?')) { state=defaultState(); saveState(); renderAll(); showToast('Local data reset.'); }
    });
  }

  function ensureBuild002Ui() {
    if (!document.querySelector('link[href="./build002.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './build002.css';
      document.head.appendChild(link);
    }

    const todayCard = document.querySelector('.today-workout-card');
    if (todayCard && !document.getElementById('todayTrainingContext')) {
      const context = document.createElement('div');
      context.id = 'todayTrainingContext';
      context.className = 'today-training-context';
      context.innerHTML = '<strong id="todayTrainingLocation">Home</strong><span id="todayEnergyPreview">Workout and energy estimate loading…</span>';
      const heading = todayCard.querySelector('h2');
      if (heading) heading.id = 'todayWorkoutName';
      todayCard.querySelector('p')?.after(context);
    }

    const exerciseList = document.getElementById('exerciseList');
    if (exerciseList && !document.getElementById('trainingContextCard')) {
      const card = document.createElement('article');
      card.id = 'trainingContextCard';
      card.className = 'card training-context-card';
      card.innerHTML = `
        <div class="training-context-top">
          <div><div class="eyebrow">Training location</div><h2>Use what is actually available</h2></div>
          <div class="energy-estimate"><span>Estimated workout energy</span><strong id="energyValue">—</strong><small id="energyMeta">Loading energy model…</small></div>
        </div>
        <div class="location-grid">
          <button class="location-button selected" data-workout-location="home"><strong>Home</strong><span>Bodyweight + yoga mat</span></button>
          <button class="location-button" data-workout-location="apartmentGym"><strong>Apartment Gym</strong><span>Photo inventory pending</span></button>
          <button class="location-button" data-workout-location="fullGym"><strong>Full Gym</strong><span>All standard equipment</span></button>
        </div>
        <p class="muted compact" id="trainingLocationStatus">Loading researched equipment profile…</p>
        <div id="workoutWarnings" class="workout-warnings"></div>`;
      exerciseList.before(card);
    }

    const trainHeader = document.querySelector('.train-header');
    if (trainHeader) {
      const heading = trainHeader.querySelector('h2');
      if (heading) heading.id = 'trainingTemplateName';
      const eyebrow = trainHeader.querySelector('.eyebrow');
      if (eyebrow) eyebrow.textContent = 'Auto-generated workout';
    }

    const dataIntro = document.querySelector('.data-intro');
    if (dataIntro && !document.getElementById('fitnessCatalogCard')) {
      const card = document.createElement('article');
      card.id = 'fitnessCatalogCard';
      card.className = 'connection-card connected fitness-catalog-card';
      card.innerHTML = '<div class="connection-icon">ƒ</div><div><strong>Exercise + MET intelligence</strong><span id="fitnessCatalogDetail">Loading researched catalogs…</span></div><span id="fitnessCatalogStatus">Loading…</span>';
      document.querySelector('.connection-grid')?.prepend(card);
    }
  }

  async function loadTrainingResources() {
    try {
      const [core, exercises, programmingRules, substitutionRules, locations, energyModel, catalogSummary, trainingCatalogSummary] = await Promise.all([
        import('./training-core.mjs'),
        fetch('./data/generated/training_exercises.json').then(requireOk).then(r => r.json()),
        fetch('./data/programming_rules.json').then(requireOk).then(r => r.json()),
        fetch('./data/substitution_rules.json').then(requireOk).then(r => r.json()),
        fetch('./data/location_profiles.json').then(requireOk).then(r => r.json()),
        fetch('./data/energy_model.json').then(requireOk).then(r => r.json()),
        fetch('./data/generated/catalog_summary.json').then(requireOk).then(r => r.json()),
        fetch('./data/generated/training_catalog_summary.json').then(requireOk).then(r => r.json())
      ]);
      trainingCore = core;
      trainingData = { exercises, programmingRules, substitutionRules, locations, energyModel, catalogSummary, trainingCatalogSummary };
      trainingError = null;
    } catch (error) {
      console.error('Zero2Fit training reference load failed', error);
      trainingError = 'The researched workout catalog did not load. Workout completion is disabled until the reference files are available.';
    }
    renderAll();
  }

  function requireOk(response) {
    if (!response.ok) throw new Error(`${response.status} ${response.url}`);
    return response;
  }

  function setText(id, value) { const el=document.getElementById(id); if (el) el.textContent=String(value); }
  function setWidth(id, pct) { const el=document.getElementById(id); if (el) el.style.width=`${Math.max(0,Math.min(100,Number(pct)||0))}%`; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function showToast(message) { const el=document.getElementById('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2300); }

  function init() {
    document.getElementById('todayDate').textContent = new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
    ensureBuild002Ui();
    renderNavigation();
    bindForms();
    renderAll();
    loadTrainingResources();
  }

  init();
})();
