import fs from 'node:fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const required = [
  'todayDate','pageTitle','resetDemo','heroLevel','heroXpText','heroTitle','heroXpBar','momentumRing','momentumValue','momentumMessage',
  'questCount','xpToday','weekScore','questList','latestWeight','weightTrend','weightForm','weightInput','stepValue','stepBar','stepsForm','stepsInput',
  'characterTitle','characterLevel','totalXp','characterXpBar','characterXpText','attributeList','bossProgressText','bossPct','bossBar','achievementGrid',
  'selectedModeLabel','workoutCompletion','exerciseList','finishWorkout','calorieTotal','proteinTotal','mealForm','mealName','mealCalories','mealProtein','clearMeals','mealList',
  'journeyXp','weightChart','weightHistoryText','completedWorkouts','weekDots','xpLog','dataWeight','dataSteps','dataMomentum','dataLevel','toast'
];
const missing = required.filter(id => !html.includes(`id="${id}"`));
if (missing.length) throw new Error(`Zero2Fit index contract missing: ${missing.join(', ')}`);
for (const selector of ['today-workout-card','train-header','data-intro','connection-grid','data-table-card','metric-card']) {
  if (!html.includes(selector)) throw new Error(`Build 002/003 selector missing: ${selector}`);
}
for (const stylesheet of ['styles.css','build006.css','build007.css']) {
  if (!html.includes(`./${stylesheet}`)) throw new Error(`Required stylesheet missing: ${stylesheet}`);
}
for (const script of ['storage.js','ingestion.js','app.js','build003-integration.js','build004-integration.js','build007-adventure.js','build008-photos.js']) {
  if (!html.includes(`./${script}`)) throw new Error(`Required script missing: ${script}`);
}
const ordering = ['storage.js','ingestion.js','app.js','build003-integration.js','build004-integration.js','build007-adventure.js','build008-photos.js'].map(script => html.indexOf(`./${script}`));
if (ordering.some((value, index) => index && value <= ordering[index - 1])) throw new Error('Zero2Fit script load order changed unexpectedly.');
console.log('Build 007/008 index compatibility contract passed.');
