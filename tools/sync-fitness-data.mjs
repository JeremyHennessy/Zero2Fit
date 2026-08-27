import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);
const OUT_DIR = new URL('../data/generated/', import.meta.url);
const EXERCISE_SOURCE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const EXERCISE_REPO_API = 'https://api.github.com/repos/yuhonas/free-exercise-db/commits/main';
const COMPENDIUM_INDEX = 'https://pacompendium.com/adult-compendium/';
const COMPENDIUM_PDF_FALLBACK = 'https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf';

const HEADING_BY_CODE = {
  '01': 'Bicycling', '02': 'Conditioning Exercise', '03': 'Dancing', '04': 'Fishing & Hunting',
  '05': 'Home Activities', '06': 'Home Repair', '07': 'Inactivity', '08': 'Lawn & Garden',
  '09': 'Miscellaneous', '10': 'Music Playing', '11': 'Occupation', '12': 'Running',
  '13': 'Self Care', '14': 'Sexual Activity', '15': 'Sports', '16': 'Transportation',
  '17': 'Walking', '18': 'Water Activities', '19': 'Winter Activities', '20': 'Religious Activities',
  '21': 'Volunteer Activities', '22': 'Video Games'
};

const PUBLISHED_HEADING_COUNTS = {
  '01': 44, '02': 86, '03': 28, '04': 37, '05': 78, '06': 37,
  '07': 17, '08': 54, '09': 28, '10': 22, '11': 149, '12': 66,
  '13': 11, '14': 3, '15': 158, '16': 12, '17': 93, '18': 87,
  '19': 52, '20': 24, '21': 19, '22': 8
};

const EQUIPMENT_MAP = new Map([
  [null, 'bodyweight'], ['body only', 'bodyweight'], ['bands', 'resistance_band'],
  ['dumbbell', 'dumbbell'], ['barbell', 'barbell'], ['cable', 'cable_machine'],
  ['machine', 'machine'], ['kettlebells', 'kettlebell'], ['exercise ball', 'stability_ball'],
  ['medicine ball', 'medicine_ball'], ['foam roll', 'foam_roller'], ['e-z curl bar', 'ez_bar'], ['other', 'other']
]);

const HOME_EQUIPMENT = new Set(['bodyweight', 'yoga_mat']);
const FULL_GYM_EQUIPMENT = new Set([
  'bodyweight', 'yoga_mat', 'resistance_band', 'dumbbell', 'barbell', 'cable_machine',
  'machine', 'kettlebell', 'stability_ball', 'medicine_ball', 'foam_roller', 'ez_bar', 'other'
]);

function stripHtml(value) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#8211;|&ndash;/gi, '–').replace(/&#8212;|&mdash;/gi, '—')
    .replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
}

async function fetchResponse(url, accept = '*/*') {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Zero2Fit-data-sync/1.0 (+https://github.com/JeremyHennessy/Zero2Fit)',
      accept
    }
  });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} ${url}`);
  return response;
}

const fetchText = async url => (await fetchResponse(url, 'text/html,application/json;q=0.9,*/*;q=0.8')).text();
const fetchBytes = async url => Buffer.from(await (await fetchResponse(url, 'application/pdf,*/*;q=0.8')).arrayBuffer());

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
  if (exercise.category === 'stretching') return { code: '02101', met: 2.3, basis: 'stretching_mild' };
  if (exercise.category === 'cardio') return { code: null, met: null, basis: 'select_specific_cardio_activity_from_compendium' };
  if (normalizedEquipment === 'bodyweight') return { code: '02056', met: 3.0, basis: 'bodyweight_resistance_general' };
  if (/(squat|deadlift)/i.test(exercise.name)) return { code: '02052', met: 5.0, basis: 'resistance_squat_deadlift' };
  if (['powerlifting', 'olympic weightlifting', 'strongman'].includes(exercise.category)) return { code: '02050', met: 6.0, basis: 'vigorous_resistance' };
  if (['strength', 'plyometrics'].includes(exercise.category)) return { code: '02054', met: 3.5, basis: 'resistance_multiple_exercises' };
  return { code: '02064', met: 3.8, basis: 'home_exercise_general' };
}

function normalizeExercise(exercise) {
  const equipment = EQUIPMENT_MAP.get(exercise.equipment ?? null) || 'other';
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
    movementPattern: inferMovementPattern(exercise),
    locationCompatibility: {
      home: HOME_EQUIPMENT.has(equipment),
      apartmentGym: HOME_EQUIPMENT.has(equipment),
      fullGym: FULL_GYM_EQUIPMENT.has(equipment)
    },
    energyReference: metProfileFor(exercise, equipment),
    source: { dataset: 'yuhonas/free-exercise-db', id: exercise.id, license: 'Unlicense / public domain' }
  };
}

function parseCompendiumLinks(indexHtml) {
  const links = [];
  const seen = new Set();
  for (const match of indexHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = stripHtml(match[2]);
    let url;
    try { url = new URL(match[1], COMPENDIUM_INDEX); } catch { continue; }
    if (url.hostname !== 'pacompendium.com') continue;
    if (!/^\d{2}$/.test((label.match(/\((\d{2})\)/) || [])[1] || '')) continue;
    url.hash = '';
    if (!seen.has(url.toString())) {
      seen.add(url.toString());
      links.push({ url: url.toString(), label });
    }
  }
  return links;
}

function findCompendiumPdfUrl(indexHtml) {
  const candidates = [...indexHtml.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)]
    .map(match => { try { return new URL(match[1], COMPENDIUM_INDEX).toString(); } catch { return null; } })
    .filter(Boolean)
    .filter(url => /adult[-_ ]?compendium/i.test(url) && !/tracking|guide/i.test(url));
  return candidates[0] || COMPENDIUM_PDF_FALLBACK;
}

function parseCompendiumWebPage(html, pageMeta) {
  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
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
      majorHeading: HEADING_BY_CODE[code.slice(0, 2)] || pageMeta.label,
      met,
      description,
      evidenceStatus: /(color\s*:\s*(red|#ff0000)|has-text-color[^>]*red)/i.test(rowHtml) ? 'estimated' : 'published_or_unspecified',
      sourcePage: pageMeta.url
    });
  }
  return rows;
}

function isPdfNoise(line) {
  const normalized = line.replace(/\s+/g, ' ').trim();
  return !normalized || /^\d+$/.test(normalized) || /^2024 Adult Compendium of Physical Activities/i.test(normalized)
    || /^(Major Heading|5-digit|Activity Code|MET Value|METs|Description)/i.test(normalized)
    || /^(Adult Compendium|Table \d|Appendix|Page \d)/i.test(normalized);
}

function parseCompendiumPdfText(text, pdfUrl) {
  const records = [];
  let current = null;
  const rowRegex = /^\s*(.*?)\s+(\d{5})\s+(\d+(?:\.\d+)?)(?:\s+(.*?))?\s*$/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\f/g, '');
    const match = line.match(rowRegex);
    if (match) {
      const code = match[2];
      const majorHeadingCode = code.slice(0, 2);
      if (!HEADING_BY_CODE[majorHeadingCode]) continue;
      const met = Number(match[3]);
      if (!Number.isFinite(met) || met <= 0) continue;
      current = {
        code,
        majorHeadingCode,
        majorHeading: HEADING_BY_CODE[majorHeadingCode],
        met,
        description: (match[4] || '').replace(/\s+/g, ' ').trim(),
        pdfPrintedHeading: match[1].replace(/\s+/g, ' ').trim() || null,
        sourcePdf: pdfUrl,
        edition: 2024
      };
      records.push(current);
      continue;
    }

    if (!current || isPdfNoise(line) || !/^\s{2,}\S/.test(rawLine)) continue;
    const continuation = line.replace(/\s+/g, ' ').trim();
    if (continuation.length < 2 || /^https?:\/\//i.test(continuation)) continue;
    current.description = `${current.description} ${continuation}`.replace(/\s+/g, ' ').trim();
  }

  const unique = new Map();
  for (const row of records) if (!unique.has(row.code)) unique.set(row.code, row);
  return [...unique.values()].sort((a, b) => a.code.localeCompare(b.code));
}

async function extractCompendiumPdf(indexHtml) {
  const pdfUrl = findCompendiumPdfUrl(indexHtml);
  const pdfPath = join(tmpdir(), `zero2fit-compendium-${process.pid}.pdf`);
  const textPath = join(tmpdir(), `zero2fit-compendium-${process.pid}.txt`);
  try {
    await writeFile(pdfPath, await fetchBytes(pdfUrl));
    await execFileAsync('pdftotext', ['-layout', '-nopgbrk', pdfPath, textPath], { maxBuffer: 20 * 1024 * 1024 });
    const rows = parseCompendiumPdfText(await readFile(textPath, 'utf8'), pdfUrl);
    if (rows.length < 1100) throw new Error(`Expected >=1100 unique official PDF MET rows; parsed ${rows.length}`);
    return { pdfUrl, rows };
  } finally {
    await Promise.allSettled([unlink(pdfPath), unlink(textPath)]);
  }
}

function mergePdfWithWebsite(pdfRows, websiteRows) {
  const websiteByCode = new Map(websiteRows.map(row => [row.code, row]));
  return pdfRows.map(pdf => {
    const web = websiteByCode.get(pdf.code);
    return {
      ...pdf,
      description: web?.description || pdf.description,
      evidenceStatus: web?.evidenceStatus || 'not_available_from_current_web_table',
      sourcePage: web?.sourcePage || null,
      currentWebsiteMatch: !!web,
      currentWebsiteMet: web?.met ?? null,
      sourceAgreement: web ? (Math.abs(web.met - pdf.met) < 1e-9 ? 'met_match' : 'met_mismatch') : 'pdf_only'
    };
  });
}

function countByHeading(rows) {
  const result = {};
  for (const row of rows) result[row.majorHeadingCode] = (result[row.majorHeadingCode] || 0) + 1;
  return result;
}

function buildReconciliation(pdfRows, websiteRows, pdfUrl) {
  const pdfCodes = new Set(pdfRows.map(row => row.code));
  const websiteCodes = new Set(websiteRows.map(row => row.code));
  const websiteByCode = new Map(websiteRows.map(row => [row.code, row]));
  const pdfOnlyCodes = [...pdfCodes].filter(code => !websiteCodes.has(code)).sort();
  const websiteOnlyCodes = [...websiteCodes].filter(code => !pdfCodes.has(code)).sort();
  const metMismatches = pdfRows.map(pdf => {
    const web = websiteByCode.get(pdf.code);
    return web && Math.abs(web.met - pdf.met) > 1e-9 ? { code: pdf.code, pdfMet: pdf.met, websiteMet: web.met } : null;
  }).filter(Boolean);
  const publishedHeadingSum = Object.values(PUBLISHED_HEADING_COUNTS).reduce((sum, value) => sum + value, 0);
  return {
    generatedAt: new Date().toISOString(),
    canonicalSource: 'official_2024_compendium_pdf',
    sourcePdf: pdfUrl,
    publishedReportedTotal: 1114,
    publishedHeadingCounts: PUBLISHED_HEADING_COUNTS,
    publishedHeadingSum,
    officialPdfParsedRows: pdfRows.length,
    currentWebsiteParsedRows: websiteRows.length,
    pdfHeadingCounts: countByHeading(pdfRows),
    websiteHeadingCounts: countByHeading(websiteRows),
    pdfOnlyCodes,
    websiteOnlyCodes,
    metMismatches,
    note: 'The 2024 publication reports 1,114 activities, while the published per-heading counts sum to 1,113. The current official PDF and website are reconciled by activity code. Zero2Fit does not fabricate missing records.'
  };
}

function buildSummary(exercises, activities, exerciseCommit, reconciliation) {
  const byEquipment = {}, byMuscle = {}, byPattern = {}, byHeading = {};
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
        repository: 'yuhonas/free-exercise-db', commit: exerciseCommit,
        license: 'Unlicense / public domain', sourceUrl: EXERCISE_SOURCE
      },
      metCatalog: {
        name: '2024 Adult Compendium of Physical Activities', canonical: 'official PDF',
        sourceUrl: reconciliation.sourcePdf, websiteIndex: COMPENDIUM_INDEX, edition: 2024
      }
    },
    counts: {
      exercises: exercises.length,
      metActivities: activities.length,
      homeCompatibleExercises: exercises.filter(x => x.locationCompatibility.home).length,
      fullGymCompatibleExercises: exercises.filter(x => x.locationCompatibility.fullGym).length
    },
    reconciliation: {
      publishedReportedTotal: reconciliation.publishedReportedTotal,
      publishedHeadingSum: reconciliation.publishedHeadingSum,
      officialPdfParsedRows: reconciliation.officialPdfParsedRows,
      currentWebsiteParsedRows: reconciliation.currentWebsiteParsedRows,
      pdfOnlyCount: reconciliation.pdfOnlyCodes.length,
      websiteOnlyCount: reconciliation.websiteOnlyCodes.length,
      metMismatchCount: reconciliation.metMismatches.length
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
    fetchText(EXERCISE_SOURCE), fetchText(EXERCISE_REPO_API), fetchText(COMPENDIUM_INDEX)
  ]);

  const sourceExercises = JSON.parse(exerciseRaw);
  if (!Array.isArray(sourceExercises)) throw new Error('Exercise source did not return an array');
  const exerciseCommit = JSON.parse(exerciseCommitRaw).sha;
  const exercises = sourceExercises.map(normalizeExercise).sort((a, b) => a.name.localeCompare(b.name));

  const compendiumLinks = parseCompendiumLinks(compendiumIndexHtml);
  if (compendiumLinks.length < 20) throw new Error(`Expected about 22 Compendium headings; found ${compendiumLinks.length}`);
  const websiteActivities = [];
  for (const page of compendiumLinks) websiteActivities.push(...parseCompendiumWebPage(await fetchText(page.url), page));
  websiteActivities.sort((a, b) => a.code.localeCompare(b.code));

  const { pdfUrl, rows: pdfActivities } = await extractCompendiumPdf(compendiumIndexHtml);
  const reconciliation = buildReconciliation(pdfActivities, websiteActivities, pdfUrl);
  const activities = mergePdfWithWebsite(pdfActivities, websiteActivities);
  const summary = buildSummary(exercises, activities, exerciseCommit, reconciliation);

  await Promise.all([
    writeFile(new URL('exercises.json', OUT_DIR), JSON.stringify(exercises)),
    writeFile(new URL('met_activities.json', OUT_DIR), JSON.stringify(activities)),
    writeFile(new URL('catalog_summary.json', OUT_DIR), JSON.stringify(summary, null, 2) + '\n'),
    writeFile(new URL('met_reconciliation.json', OUT_DIR), JSON.stringify(reconciliation, null, 2) + '\n')
  ]);

  console.log(`Synced ${exercises.length} exercises from ${exerciseCommit.slice(0, 12)}`);
  console.log(`Canonical official PDF MET rows: ${activities.length}`);
  console.log(`Current website MET rows: ${websiteActivities.length}`);
  console.log(`PDF-only codes: ${reconciliation.pdfOnlyCodes.join(', ') || 'none'}`);
  console.log(`Website-only codes: ${reconciliation.websiteOnlyCodes.join(', ') || 'none'}`);
  console.log(`MET mismatches: ${reconciliation.metMismatches.length}`);
  console.log(`Home-compatible exercises: ${summary.counts.homeCompatibleExercises}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
