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
if (missing.length) throw new Error(`Build 004 index contract missing: ${missing.join(', ')}`);
for (const selector of ['today-workout-card','train-header','data-intro','connection-grid','data-table-card','metric-card']) {
  if (!html.includes(selector)) throw new Error(`Build 002/003 selector missing: ${selector}`);
}
for (const script of ['storage.js','ingestion.js','app.js','build003-integration.js','build004-integration.js']) {
  if (!html.includes(`./${script}`)) throw new Error(`Required script missing: ${script}`);
}
console.log('Build 004 index contract passed.');
