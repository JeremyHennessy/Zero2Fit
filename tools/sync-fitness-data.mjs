import { mkdir, writeFile } from 'node:fs/promises';

const OUT_DIR = new URL('../data/generated/', import.meta.url);
const EXERCISE_SOURCE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const EXERCISE_REPO_API = 'https://api.github.com/repos/yuhonas/free-exercise-db/commits/main';
const COMPENDIUM_INDEX = 'https://pacompendium.com/adult-compendium/';

const EQUIPMENT_MAP = new Map([
  [null, 'bodyweight'],
  ['body only', 'bodyweight'],
  ['bands', 'resistance_band'],
  ['dumbbell', 'dumbbell'],
  ['barbell', 'barbell'],
  ['cable', 'cable_machine'],
  ['machine', 'machine'],
  ['kettlebells', 'kettlebell'],
  ['exercise ball', 'stability_ball'],
  ['medicine ball', 'medicine_ball'],
  ['foam roll', 'foam_roller'],
  ['e-z curl bar', 'ez_bar'],
  ['other', 'other']
]);

const HOME_EQUIPMENT = new Set(['bodyweight', 'yoga_mat']);
const FULL_GYM_EQUIPMENT = new Set([
  'bodyweight', 'yoga_mat', 'resistance_band', 'dumbbell', 'barbell',
  'cable_machine', 'machine', 'kettlebell', 'stability_ball',
  'medicine_ball', 'foam_roller', 'ez_bar', 'other'
]);

function stripHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&#8212;|&mdash;/gi, '—')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Zero2Fit-data-sync/1.0 (+https://github.com/JeremyHennessy/Zero2Fit)',
      accept: 'text/html,application/json;q=0.9,*/*;q=0.8'
    }
  });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} ${url}`);
  return response.text();
}

function inferMovementPattern(exercise) {
  const name = exercise.name.toLowerCase();
  const primary = new Set(exercise.primaryMuscles || []);
  const category = exercise.category;

  if (category === 'cardio') return 'cardio';
  if (category === 'stretching') return 'mobility';
  if (category === 'olympic weightlifting') return 'olympic_lift';
  if (category === 'plyometrics') return 'plyometric';
  if (category === 'strongman' && /(carry|walk|farmer|yoke)/.test(name)) return 'carry';

  if (/(pull[- ]?up|chin[- ]?up|pulldown|pull down|lat pull)/.test(name)) return 'vertical_pull';
  if (/(row|rowing)/.test(name) && !/(upright row)/.test(name)) return 'horizontal_pull';
  if (/(bench press|chest press|push[- ]?up|push up|fly|flye)/.test(name)) return 'horizontal_push';
  if (/(overhead press|shoulder press|military press|arnold press|push press)/.test(name)) return 'vertical_push';
  if (/(squat|leg press|hack squat)/.test(name)) return 'squat';
  if (/(lunge|split squat|step[- ]?up|step up)/.test(name)) return 'lunge';
  if (/(deadlift|good morning|hip hinge|romanian|stiff[- ]leg|hip thrust|glute bridge|kettlebell swing)/.test(name)) return 'hinge';
  if (/(leg extension|knee extension)/.test(name)) return 'knee_extension';
  if (/(leg curl|hamstring curl)/.test(name)) return 'knee_flexion';
  if (/(calf raise|calf press)/.test(name) || primary.has('calves')) return 'calf_raise';
  if (/(biceps|curl)/.test(name) && primary.has('biceps')) return 'elbow_flexion';
  if (/(triceps|pushdown|pressdown|skull crusher)/.test(name) && primary.has('triceps')) return 'elbow_extension';
  if (primary.has('abductors')) return 'hip_abduction';
  if (primary.has('adductors')) return 'hip_adduction';
  if (primary.has('forearms')) return 'forearm';
  if (primary.has('neck')) return 'neck';
  if (primary.has('abdominals') || /(plank|crunch|sit[- ]?up|ab |core|bird dog|dead bug)/.test(name)) return 'core';
  if (primary.has('shoulders')) return 'shoulder_isolation';
  if (primary.has('lats') || primary.has('middle back') || primary.has('traps')) return exercise.force === 'pull' ? 'pull_other' : 'upper_back';
  if (primary.has('chest') || primary.has('triceps')) return exercise.force === 'push' ? 'push_other' : 'upper_push';
  if (primary.has('quadriceps')) return 'knee_dominant';
  if (primary.has('hamstrings') || primary.has('glutes') || primary.has('lower back')) return 'posterior_chain';
  return 'other';
}

function metProfileFor(exercise, normalizedEquipment) {
  if (exercise.category === 'stretching') {
    return { code: '02101', met: 2.3, basis: 'stretching_mild' };
  }
  if (exercise.category === 'cardio') {
    return { code: null, met: null, basis: 'select_specific_cardio_activity_from_compendium' };
  }
  if (normalizedEquipment === 'bodyweight') {
    return { code: '02056', met: 3.0, basis: 'bodyweight_resistance_general' };
  }
  if (/(squat|deadlift)/i.test(exercise.name)) {
    return { code: '02052', met: 5.0, basis: 'resistance_squat_deadlift' };
  }
  if (['powerlifting', 'olympic weightlifting', 'strongman'].includes(exercise.category)) {
    return { code: '02050', met: 6.0, basis: 'vigorous_resistance' };
  }
  if (['strength', 'plyometrics'].includes(exercise.category)) {
    return { code: '02054', met: 3.5, basis: 'resistance_multiple_exercises' };
  }
  return { code: '02064', met: 3.8, basis: 'home_exercise_general' };
}

function normalizeExercise(exercise) {
  const equipment = EQUIPMENT_MAP.get(exercise.equipment ?? null) || 'other';
  const movementPattern = inferMovementPattern(exercise);
  const metProfile = metProfileFor(exercise, equipment);
  return {
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    level: exercise.level,
    force: exercise.force ?? null,
    mechanic: exercise.mechanic ?? null,
    equipment,
    sourceEquipment: exercise.equipment ?? null,
    primaryMuscles: exercise.primaryMuscles || [],
    secondaryMuscles: exercise.secondaryMuscles || [],
    instructions: exercise.instructions || [],
    movementPattern,
    locationCompatibility: {
      home: HOME_EQUIPMENT.has(equipment),
      apartmentGym: HOME_EQUIPMENT.has(equipment),
      fullGym: FULL_GYM_EQUIPMENT.has(equipment)
    },
    energyReference: metProfile,
    source: {
      dataset: 'yuhonas/free-exercise-db',
      id: exercise.id,
      license: 'Unlicense / public domain'
    }
  };
}

function parseCompendiumLinks(indexHtml) {
  const links = [];
  const seen = new Set();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of indexHtml.matchAll(anchorPattern)) {
    const href = match[1];
    const label = stripHtml(match[2]);
    let url;
    try { url = new URL(href, COMPENDIUM_INDEX); } catch { continue; }
    if (url.hostname !== 'pacompendium.com') continue;
    if (!/^\d{2}$/.test((label.match(/\((\d{2})\)/) || [])[1] || '')) continue;
    url.hash = '';
    const key = url.toString();
    if (!seen.has(key)) {
      seen.add(key);
      links.push({ url: key, label });
    }
  }
  return links;
}

function parseCompendiumPage(html, pageMeta) {
  const rows = [];
  const headingMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const heading = headingMatch ? stripHtml(headingMatch[1]) : pageMeta.label.replace(/\s*\(\d{2}\)\s*$/, '');
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const match of html.matchAll(rowPattern)) {
    const rowHtml = match[1];
    const cells = [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => stripHtml(cell[1]));
    if (cells.length < 3) continue;
    const code = cells[0].replace(/\D/g, '');
    const met = Number(cells[1]);
    const description = cells.slice(2).join(' ').trim();
    if (!/^\d{5}$/.test(code) || !Number.isFinite(met) || !description) continue;
    rows.push({
      code,
      majorHeadingCode: code.slice(0, 2),
      majorHeading: heading,
      met,
      description,
      evidenceStatus: /(color\s*:\s*(red|#ff0000)|has-text-color[^>]*red)/i.test(rowHtml) ? 'estimated' : 'published_or_unspecified',
      sourcePage: pageMeta.url,
      edition: 2024
    });
  }
  return rows;
}

function buildSummary(exercises, activities, exerciseCommit) {
  const byEquipment = {};
  const byMuscle = {};
  const byPattern = {};
  const byHeading = {};
  for (const exercise of exercises) {
    byEquipment[exercise.equipment] = (byEquipment[exercise.equipment] || 0) + 1;
    byPattern[exercise.movementPattern] = (byPattern[exercise.movementPattern] || 0) + 1;
    for (const muscle of exercise.primaryMuscles) byMuscle[muscle] = (byMuscle[muscle] || 0) + 1;
  }
  for (const activity of activities) byHeading[activity.majorHeading] = (byHeading[activity.majorHeading] || 0) + 1;
  return {
    generatedAt: new Date().toISOString(),
    sources: {
      exerciseCatalog: {
        repository: 'yuhonas/free-exercise-db',
        commit: exerciseCommit,
        license: 'Unlicense / public domain',
        sourceUrl: EXERCISE_SOURCE
      },
      metCatalog: {
        name: '2024 Adult Compendium of Physical Activities',
        sourceUrl: COMPENDIUM_INDEX,
        edition: 2024
      }
    },
    counts: {
      exercises: exercises.length,
      metActivities: activities.length,
      homeCompatibleExercises: exercises.filter(x => x.locationCompatibility.home).length,
      fullGymCompatibleExercises: exercises.filter(x => x.locationCompatibility.fullGym).length
    },
    byEquipment,
    byPrimaryMuscle: byMuscle,
    byMovementPattern: byPattern,
    byCompendiumHeading: byHeading
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const [exerciseRaw, exerciseCommitRaw, compendiumIndexHtml] = await Promise.all([
    fetchText(EXERCISE_SOURCE),
    fetchText(EXERCISE_REPO_API),
    fetchText(COMPENDIUM_INDEX)
  ]);

  const sourceExercises = JSON.parse(exerciseRaw);
  if (!Array.isArray(sourceExercises)) throw new Error('Exercise source did not return an array');
  const exerciseCommit = JSON.parse(exerciseCommitRaw).sha;
  const exercises = sourceExercises.map(normalizeExercise).sort((a, b) => a.name.localeCompare(b.name));

  const compendiumLinks = parseCompendiumLinks(compendiumIndexHtml);
  if (compendiumLinks.length < 20) throw new Error(`Expected about 22 Compendium headings; found ${compendiumLinks.length}`);
  const activities = [];
  for (const page of compendiumLinks) {
    const html = await fetchText(page.url);
    const parsed = parseCompendiumPage(html, page);
    if (!parsed.length) throw new Error(`No MET rows parsed from ${page.url}`);
    activities.push(...parsed);
  }
  activities.sort((a, b) => a.code.localeCompare(b.code));

  const summary = buildSummary(exercises, activities, exerciseCommit);
  await Promise.all([
    writeFile(new URL('exercises.json', OUT_DIR), JSON.stringify(exercises)),
    writeFile(new URL('met_activities.json', OUT_DIR), JSON.stringify(activities)),
    writeFile(new URL('catalog_summary.json', OUT_DIR), JSON.stringify(summary, null, 2) + '\n')
  ]);

  console.log(`Synced ${exercises.length} exercises from ${exerciseCommit.slice(0, 12)}`);
  console.log(`Synced ${activities.length} MET activities from ${compendiumLinks.length} Compendium headings`);
  console.log(`Home-compatible exercises: ${summary.counts.homeCompatibleExercises}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
