import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));

const exercises = await readJson('data/generated/exercises.json');
const locations = await readJson('data/location_profiles.json');

const IMPLICIT_RULES = [
  { id: 'pullup_bar', equipment: 'pullup_bar', pattern: /(pull[- ]?ups?|chin[- ]?ups?|muscle[- ]?ups?|hanging|toes? to bar|knee raises?.*hang|leg raises?.*hang|windshield wiper)/i },
  { id: 'low_bar', equipment: 'low_bar', pattern: /(inverted rows?|body rows?|australian pull)/i },
  { id: 'dip_station', equipment: 'dip_station', pattern: /\b(parallel bar|dips?)\b/i, exclude: /(bench dips?|chair dips?)/i },
  { id: 'bench', equipment: 'bench', pattern: /(bench dips?|bench push|incline push[- ]?ups?|decline push[- ]?ups?|feet elevated push[- ]?ups?|rear foot elevated|bulgarian split squat)/i },
  { id: 'box', equipment: 'box', pattern: /(box jump|box squat|depth jump|depth push|box step)/i },
  { id: 'step_platform', equipment: 'step_platform', pattern: /(step[- ]?ups?|step down|stair)/i },
  { id: 'anchor_or_ghd', equipment: 'anchor_or_ghd', pattern: /(nordic|glute[- ]?ham|natural glute ham)/i },
  { id: 'roman_chair', equipment: 'roman_chair', pattern: /(hyperextension|back extension)/i },
  { id: 'climbing_rope', equipment: 'climbing_rope', pattern: /(rope climb|climbing rope)/i },
  { id: 'sled', equipment: 'sled', pattern: /(prowler|sled push|sled drag|sled pull)/i },
  { id: 'partner', equipment: 'partner', pattern: /\bpartner\b/i },
  { id: 'wall', equipment: 'wall', pattern: /(wall sit|wall push|wall handstand|handstand push[- ]?up)/i },
  { id: 'chair', equipment: 'chair', pattern: /\bchair\b/i }
];

const NON_APPARATUS_SOURCE_EQUIPMENT = new Set(['bodyweight']);

function searchableText(exercise) {
  return [exercise.name, ...(exercise.instructions || [])].join(' ');
}

function inferImplicitEquipment(exercise) {
  const text = searchableText(exercise);
  return [...new Set(IMPLICIT_RULES
    .filter(rule => rule.pattern.test(text) && !(rule.exclude && rule.exclude.test(text)))
    .map(rule => rule.equipment))];
}

function requiredEquipment(exercise, implicit) {
  const required = [];
  if (!NON_APPARATUS_SOURCE_EQUIPMENT.has(exercise.equipment)) required.push(exercise.equipment);
  required.push(...implicit);
  return [...new Set(required.filter(Boolean))];
}

function machineCapabilitySupports(location, requirements, exercise) {
  if (!requirements.includes('machine')) return true;
  const keywords = location.machineExerciseNameKeywords || [];
  if (!keywords.length) return true;
  const name = String(exercise?.name || '').toLowerCase();
  return keywords.some(keyword => name.includes(String(keyword).toLowerCase()));
}

function locationSupports(location, requirements, exercise) {
  const inventory = new Set(location.equipment || []);
  if (!requirements.every(item => inventory.has(item))) return false;
  return machineCapabilitySupports(location, requirements, exercise);
}

const trainingExercises = exercises.map(exercise => {
  const implicitEquipment = inferImplicitEquipment(exercise);
  const required = requiredEquipment(exercise, implicitEquipment);
  return {
    ...exercise,
    implicitEquipment,
    requiredEquipment: required,
    locationCompatibility: {
      home: locationSupports(locations.home, required, exercise),
      apartmentGym: locationSupports(locations.apartmentGym, required, exercise),
      fullGym: locationSupports(locations.fullGym, required, exercise)
    },
    equipmentResolution: {
      sourceEquipment: exercise.equipment,
      sourceEquipmentClass: NON_APPARATUS_SOURCE_EQUIPMENT.has(exercise.equipment) ? 'no_explicit_apparatus' : 'explicit_apparatus',
      implicitRuleVersion: 1,
      derivedImplicitEquipment: implicitEquipment,
      apartmentMachineCapabilityFiltered: required.includes('machine') && Array.isArray(locations.apartmentGym.machineExerciseNameKeywords)
    }
  };
}).sort((a, b) => a.name.localeCompare(b.name));

const implicitCounts = {};
for (const exercise of trainingExercises) {
  for (const item of exercise.implicitEquipment) implicitCounts[item] = (implicitCounts[item] || 0) + 1;
}

const summary = {
  generatedAt: new Date().toISOString(),
  sourceExerciseCount: exercises.length,
  trainingExerciseCount: trainingExercises.length,
  sourceBodyweightCount: exercises.filter(x => x.equipment === 'bodyweight').length,
  homeCompatibleCount: trainingExercises.filter(x => x.locationCompatibility.home).length,
  apartmentCompatibleCount: trainingExercises.filter(x => x.locationCompatibility.apartmentGym).length,
  fullGymCompatibleCount: trainingExercises.filter(x => x.locationCompatibility.fullGym).length,
  apartmentCompatibleMachineCount: trainingExercises.filter(x => x.equipment === 'machine' && x.locationCompatibility.apartmentGym).length,
  bodyweightRequiringImplicitApparatus: trainingExercises.filter(x => x.equipment === 'bodyweight' && x.implicitEquipment.length).length,
  implicitEquipmentCounts: implicitCounts,
  apartmentMachineCapabilityKeywords: locations.apartmentGym.machineExerciseNameKeywords || [],
  policy: {
    home: 'Bodyweight/yoga-mat/wall only; no bar, bench, chair, box, anchor or other apparatus is assumed.',
    apartmentGym: 'Photo-verified cable/Smith/machine profile. Generic machine exercises are limited to explicitly observed machine functions; the cable trainer remains broadly usable.',
    fullGym: 'Generic full-gym profile includes standard apparatus categories plus inferred bodyweight apparatus.'
  }
};

await Promise.all([
  writeFile(new URL('data/generated/training_exercises.json', ROOT), JSON.stringify(trainingExercises)),
  writeFile(new URL('data/generated/training_catalog_summary.json', ROOT), JSON.stringify(summary, null, 2) + '\n')
]);

console.log(`Training catalog: ${trainingExercises.length} exercises`);
console.log(`Source bodyweight: ${summary.sourceBodyweightCount}`);
console.log(`Bodyweight with inferred apparatus: ${summary.bodyweightRequiringImplicitApparatus}`);
console.log(`Home-compatible after apparatus resolution: ${summary.homeCompatibleCount}`);
console.log(`Apartment-compatible after photo verification: ${summary.apartmentCompatibleCount}`);
console.log(`Apartment-compatible generic-machine entries after capability filter: ${summary.apartmentCompatibleMachineCount}`);
