(() => {
  'use strict';

  const STORAGE_KEY = 'zero2fit-v1';
  const todayKey = () => new Date().toISOString().slice(0, 10);

  const defaultState = () => ({
    version: 1,
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
    workoutSets: {},
    completedWorkouts: 0,
    workoutDates: [],
    awarded: {}
  });

  const quests = [
    { id: 'move', label: 'Move on purpose', detail: 'Reach 7,000 steps or mark a purposeful walk', xp: 20, attr: 'endurance' },
    { id: 'train', label: 'Training session', detail: 'Complete today\'s planned workout or Quick version', xp: 35, attr: 'strength' },
    { id: 'nutrition', label: 'Log nutrition', detail: 'Record enough food to understand the day', xp: 15, attr: 'nutrition' },
    { id: 'recovery', label: 'Recovery check', detail: 'Acknowledge sleep/recovery before pushing intensity', xp: 10, attr: 'recovery' }
  ];

  const exercises = [
    { id: 'squat', name: 'Chair / Goblet Squat', cue: 'Controlled range · stop before form degrades', sets: 3, reps: 8 },
    { id: 'push', name: 'Incline Push-up', cue: 'Use a height that keeps reps smooth', sets: 3, reps: 8 },
    { id: 'row', name: 'Banded Row', cue: 'Pause briefly with shoulder blades back', sets: 3, reps: 10 },
    { id: 'hinge', name: 'Hip Hinge', cue: 'Practice pattern first; load later', sets: 2, reps: 10 },
    { id: 'core', name: 'Bird Dog', cue: 'Slow, stable and controlled', sets: 2, reps: 8 }
  ];

  const modeLimits = { quick: 3, standard: 4, full: 5 };
  const attributeMeta = {
    strength: ['Strength', 'Training progression'],
    endurance: ['Endurance', 'Walking & cardio'],
    consistency: ['Consistency', 'Showing up'],
    recovery: ['Recovery', 'Sleep & easier days'],
    nutrition: ['Nutrition', 'Food awareness']
  };

  let state = loadState();
  let toastTimer = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
    } catch {
      return defaultState();
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

  function renderSteps() {
    const steps = Number(state.steps[todayKey()] || 0);
    setText('stepValue', steps.toLocaleString()); setText('dataSteps', steps.toLocaleString()); setWidth('stepBar', Math.min(100, steps / 70));
    if (steps >= 7000 && !getDayBucket(state.quests).move) toggleQuest('move', true);
  }

  function renderWorkout() {
    const limit = modeLimits[state.workoutMode] || 4;
    setText('selectedModeLabel', state.workoutMode.charAt(0).toUpperCase() + state.workoutMode.slice(1));
    document.querySelectorAll('[data-workout-mode]').forEach(b => b.classList.toggle('selected', b.dataset.workoutMode === state.workoutMode));
    const selected = exercises.slice(0, limit);
    const bucket = getDayBucket(state.workoutSets);
    const html = selected.map((exercise, eIndex) => {
      const sets = state.workoutMode === 'quick' ? Math.min(2, exercise.sets) : exercise.sets;
      const rows = Array.from({length: sets}, (_, i) => {
        const key = `${exercise.id}:${i}`; const saved = bucket[key] || {};
        return `<div class="set-row"><span>Set ${i+1}</span><input data-set-key="${key}" data-field="reps" type="number" min="0" max="100" value="${saved.reps ?? exercise.reps}" aria-label="${exercise.name} set ${i+1} reps"><input data-set-key="${key}" data-field="load" type="number" min="0" max="1000" step="0.5" value="${saved.load ?? 0}" aria-label="${exercise.name} set ${i+1} load"><button class="set-check ${saved.done ? 'done' : ''}" data-set-check="${key}">${saved.done ? '✓' : '○'}</button></div>`;
      }).join('');
      return `<article class="exercise-card"><div class="exercise-top"><div><div class="eyebrow">Exercise ${eIndex+1}</div><h3>${escapeHtml(exercise.name)}</h3><div class="exercise-meta">${escapeHtml(exercise.cue)}</div></div><span class="small-tag">${sets} sets</span></div><div class="set-list">${rows}</div></article>`;
    }).join('');
    document.getElementById('exerciseList').innerHTML = html;
    document.querySelectorAll('[data-set-key]').forEach(input => input.addEventListener('change', saveSetInput));
    document.querySelectorAll('[data-set-check]').forEach(button => button.addEventListener('click', () => toggleSet(button.dataset.setCheck)));
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
    const limit = modeLimits[state.workoutMode] || 4;
    return exercises.slice(0, limit).flatMap(exercise => Array.from({ length: state.workoutMode === 'quick' ? Math.min(2, exercise.sets) : exercise.sets }, (_, i) => `${exercise.id}:${i}`));
  }

  function updateWorkoutCompletion() {
    const keys = currentWorkoutKeys(); const bucket = getDayBucket(state.workoutSets); const done = keys.filter(k => bucket[k]?.done).length;
    setText('workoutCompletion', `${keys.length ? Math.round(done / keys.length * 100) : 0}%`);
  }

  function finishWorkout() {
    const keys = currentWorkoutKeys(); const bucket = getDayBucket(state.workoutSets); const done = keys.filter(k => bucket[k]?.done).length;
    if (done < Math.ceil(keys.length * .6)) { showToast('Complete at least 60% of the selected workout first.'); return; }
    const awardKey = `workout:${todayKey()}`;
    if (state.awarded[awardKey]) { showToast('Today\'s workout is already recorded.'); return; }
    state.completedWorkouts += 1; state.workoutDates.push(todayKey());
    addXp(45, `Completed ${state.workoutMode} Full Body A`, 'strength', awardKey); state.attributes.consistency += 15;
    getDayBucket(state.quests).train = true; state.awarded[`quest:${todayKey()}:train`] = true;
    saveState(); renderAll(); showToast('+45 XP · Workout complete');
  }

  function renderMeals() {
    const meals = state.meals[todayKey()] || [];
    const calories = meals.reduce((s,m) => s + Number(m.calories || 0), 0);
    const protein = meals.reduce((s,m) => s + Number(m.protein || 0), 0);
    setText('calorieTotal', Math.round(calories).toLocaleString()); setText('proteinTotal', Math.round(protein));
    const list = document.getElementById('mealList');
    list.innerHTML = meals.length ? meals.map((m,i) => `<div class="meal-row"><strong>${escapeHtml(m.name)}</strong><span>${m.calories} kcal</span><span>${m.protein} g protein</span><button data-remove-meal="${i}">Remove</button></div>`).join('') : '<div class="empty-state">No food logged yet.</div>';
    list.querySelectorAll('[data-remove-meal]').forEach(button => button.addEventListener('click', () => { meals.splice(Number(button.dataset.removeMeal),1); saveState(); renderAll(); }));
    if (meals.length && !getDayBucket(state.quests).nutrition) toggleQuest('nutrition', true);
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

  function renderAll() {
    renderQuests(); renderSummary(); renderAttributes(); renderBossAndAchievements(); renderWeight(); renderStepsSafe(); renderWorkout(); renderMealsSafe(); renderJourney();
  }

  function renderStepsSafe() {
    const steps = Number(state.steps[todayKey()] || 0);
    setText('stepValue', steps.toLocaleString()); setText('dataSteps', steps.toLocaleString()); setWidth('stepBar', Math.min(100, steps / 70));
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

  function bindForms() {
    document.getElementById('weightForm').addEventListener('submit', event => {
      event.preventDefault(); const input = document.getElementById('weightInput'); const value = Number(input.value);
      if (!Number.isFinite(value) || value <= 0) return;
      state.weights.push({ date: Date.now(), value }); state.weights = state.weights.slice(-365); input.value = ''; saveState(); renderAll(); showToast('Weight logged.');
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
    document.querySelectorAll('[data-workout-mode]').forEach(button => button.addEventListener('click', () => { state.workoutMode=button.dataset.workoutMode; saveState(); renderWorkout(); }));
    document.getElementById('resetDemo').addEventListener('click', () => {
      if (window.confirm('Reset all local Zero2Fit data in this browser?')) { state=defaultState(); saveState(); renderAll(); showToast('Local data reset.'); }
    });
  }

  function setText(id, value) { const el=document.getElementById(id); if (el) el.textContent=String(value); }
  function setWidth(id, pct) { const el=document.getElementById(id); if (el) el.style.width=`${Math.max(0,Math.min(100,Number(pct)||0))}%`; }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function showToast(message) { const el=document.getElementById('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2300); }

  function init() {
    document.getElementById('todayDate').textContent = new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
    renderNavigation(); bindForms(); renderAll();
  }
  init();
})();
