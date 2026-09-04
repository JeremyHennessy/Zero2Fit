const STORAGE_KEY = 'zero2fit-v1';
const storage = window.Zero2FitStorage;
let core = null;
let catalog = null;
let refreshTimer = null;

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  storage?.saveSnapshot?.(state).catch(() => {});
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function legacyAutoMigration(state) {
  const raw = state.adventure;
  if (!raw) return false;
  const version = Number(raw.version || 1);
  const legacyUntouchedDefault = version < 2 && raw.autoEnabled === false && !raw.autoLastProcessedAt;
  if (!legacyUntouchedDefault) return false;
  state.adventure = {
    ...raw,
    version:2,
    autoEnabled:true,
    autoLastProcessedAt:new Date().toISOString()
  };
  writeState(state);
  return true;
}

function ensureUi() {
  const frontier = document.getElementById('z4FrontierCard');
  if (!frontier || document.getElementById('z11AdventureStatus')) return;
  const panel = document.createElement('section');
  panel.id = 'z11AdventureStatus';
  panel.className = 'z7-lower-grid';
  panel.innerHTML = `
    <section>
      <div class="z7-section-title"><div><span>Automatic progression</span><h3 id="z11StageTitle">Stage —</h3></div><strong id="z11StageProgress">—</strong></div>
      <div class="xp-log" id="z11Capabilities"></div>
      <div class="z7-rule-box" id="z11GearCeiling"><strong>Real-world capability ceiling</strong><span>Checking effective gear power…</span></div>
    </section>
    <section>
      <div class="z7-section-title"><div><span>Salvage</span><h3>Materials & progression wall</h3></div><strong id="z11MaterialCount">0</strong></div>
      <div class="xp-log" id="z11Materials"></div>
      <div class="z7-rule-box" id="z11Wall"><strong>Frontier status</strong><span>Advancing while capability allows.</span></div>
    </section>`;
  const lower = frontier.querySelector('.z7-lower-grid');
  if (lower) lower.before(panel);
  else frontier.appendChild(panel);
}

function capabilityRows(capabilities) {
  const rows = [
    {
      name:'Strength',
      level:capabilities.strength.level,
      detail:`Attack +${capabilities.strength.attackBonus} · effective weapon cap ${capabilities.strength.weaponPowerCap}`
    },
    {
      name:'Endurance',
      level:capabilities.endurance.level,
      detail:`HP +${capabilities.endurance.hpBonus} · up to ${capabilities.endurance.encounterCapacity} encounters per expedition`
    },
    {
      name:'Consistency',
      level:capabilities.consistency.level,
      detail:`Defense +${capabilities.consistency.defenseBonus} · improves loot-rarity capability`
    },
    {
      name:'Recovery',
      level:capabilities.recovery.level,
      detail:`${Math.round(capabilities.recovery.betweenBattleHealFraction * 100)}% max-HP recovery between battles · armor cap ${capabilities.recovery.armorPowerCap}`
    },
    {
      name:'Nutrition',
      level:capabilities.nutrition.level,
      detail:`+${Math.round(capabilities.nutrition.materialFindBonus * 100)}% material-find chance · charm cap ${capabilities.nutrition.charmPowerCap}`
    }
  ];
  return rows.map(row => `<div class="xp-row"><span><strong>${row.name}</strong><small>${esc(row.detail)}</small></span><strong>Lv ${row.level}</strong></div>`).join('');
}

function materialRows(adventure) {
  const definitions = new Map((catalog.materials || []).map(item => [item.id, item]));
  const rows = Object.entries(adventure.materials || {})
    .filter(([, quantity]) => Number(quantity) > 0)
    .sort((a,b) => Number(b[1]) - Number(a[1]) || String(a[0]).localeCompare(String(b[0])));
  const total = rows.reduce((sum, [, quantity]) => sum + Number(quantity || 0), 0);
  const count = document.getElementById('z11MaterialCount');
  if (count) count.textContent = `${total} total`;
  if (!rows.length) return '<div class="z7-empty">No materials yet. Victories now supply zone salvage in addition to coins and gear.</div>';
  return rows.map(([id, quantity]) => {
    const def = definitions.get(id) || { name:id, icon:'◆', description:'Adventure salvage.' };
    return `<div class="xp-row"><span><strong>${esc(def.icon || '◆')} ${esc(def.name)}</strong><small>${esc(def.description || 'Adventure salvage.')}</small></span><strong>${Number(quantity).toLocaleString()}</strong></div>`;
  }).join('');
}

function requirementText(requirement) {
  if (requirement.type === 'fitness_level') return `Fitness level ${requirement.current}/${requirement.required}`;
  if (requirement.type === 'prior_victories') {
    const zone = (catalog.zones || []).find(item => item.id === requirement.zoneId);
    return `${zone?.name || requirement.zoneId} wins ${requirement.current}/${requirement.required}`;
  }
  return String(requirement.type || 'unknown requirement');
}

function wallText(status) {
  const wall = status.wall;
  if (!status.wallActive || !wall) {
    return {
      title:'Frontier advancing',
      detail:'Auto-adventure continues whenever Adventure Energy and the current real-world capability ceiling allow it.'
    };
  }
  if (wall.type === 'combat_defeat') {
    return {
      title:'Combat wall reached',
      detail:`Stage ${wall.stage} · ${wall.enemyName || 'enemy'} stopped the run · field rating ${wall.playerRating ?? '—'} vs enemy ${wall.enemyRating ?? '—'}. More real-world capability or a better usable gear loadout can change this wall.`
    };
  }
  if (wall.type === 'capability_gate') {
    const next = (catalog.zones || []).find(item => item.id === wall.nextZoneId);
    const requirements = (wall.requirements || []).map(requirementText).join(' · ');
    return {
      title:`${next?.name || 'Next zone'} locked by real progress`,
      detail:requirements || 'The next frontier requires a higher real-world capability ceiling.'
    };
  }
  if (wall.type === 'content_complete') {
    return {
      title:'Current frontier arc cleared',
      detail:'All currently defined stages and bosses are cleared. Fitness progress can continue, but Adventure will not invent content beyond the catalog.'
    };
  }
  return { title:'Progression paused', detail:'Adventure is paused at a persistent progression wall.' };
}

function renderStage(status) {
  const stage = status.stage;
  const zone = status.zone;
  if (!stage || !zone) return;
  const title = document.getElementById('z11StageTitle');
  const progress = document.getElementById('z11StageProgress');
  if (title) title.textContent = `${zone.name} · Stage ${stage.stage}/${stage.stageCount}`;
  if (progress) {
    const suffix = stage.cleared ? ' · cleared' : stage.bossDue ? ' · boss next' : '';
    progress.textContent = `${stage.victories}/${stage.clearVictories} wins${suffix}`;
  }
}

function renderCapabilities(status) {
  const target = document.getElementById('z11Capabilities');
  if (target) target.innerHTML = capabilityRows(status.capabilities);
  const ceiling = document.getElementById('z11GearCeiling');
  if (!ceiling) return;
  const raw = status.capabilities.rawGear;
  const effective = status.capabilities.gear;
  const banked = status.capabilities.lockedGearPower;
  const span = ceiling.querySelector('span');
  if (span) {
    span.textContent = banked > 0
      ? `Equipped raw power ${raw.total}; ${effective.total} currently usable. ${banked} gear power is banked until real-world capability rises.`
      : `Equipped power ${effective.total}/${raw.total} usable. Gear is not currently exceeding the real-world capability ceiling.`;
  }
}

function renderWall(status) {
  const box = document.getElementById('z11Wall');
  if (!box) return;
  const copy = wallText(status);
  const strong = box.querySelector('strong');
  const span = box.querySelector('span');
  if (strong) strong.textContent = copy.title;
  if (span) span.textContent = copy.detail;

  const runButton = document.getElementById('z7RunNow');
  if (runButton && status.wallActive) {
    runButton.disabled = true;
    runButton.textContent = status.wall?.type === 'content_complete' ? 'Frontier arc cleared' : 'Progression wall · improve capability or gear';
  }
}

function render() {
  if (!core || !catalog) return;
  ensureUi();
  let state = readState();
  if (legacyAutoMigration(state)) state = readState();
  const adventure = core.normalizeAdventureState(state.adventure || {}, catalog);
  const status = core.progressionStatus(state, adventure, catalog);
  renderStage(status);
  renderCapabilities(status);
  const materials = document.getElementById('z11Materials');
  if (materials) materials.innerHTML = materialRows(adventure);
  renderWall(status);

  const toggle = document.getElementById('z7AutoToggle');
  const autoText = document.getElementById('z7AutoText');
  if (toggle) toggle.checked = !!adventure.autoEnabled;
  if (autoText) autoText.textContent = adventure.autoEnabled ? 'On' : 'Off';
}

function scheduleRender(delay = 0) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(render, delay);
}

function bind() {
  document.addEventListener('click', event => {
    if (event.target.closest('#z7RunNow,#z7AutoEquip,#z7AutoToggle,[data-equip-id],[data-zone-id]')) scheduleRender(80);
  });
  window.addEventListener('focus', () => scheduleRender(80));
  window.addEventListener('zero2fit:personal-intelligence', () => scheduleRender(80));
  window.addEventListener('zero2fit:remote-sync', () => scheduleRender(80));
}

async function init() {
  // Mount the status shell before asynchronous data dependencies resolve so
  // the Adventure page remains structurally ready even on a slow catalog read.
  ensureUi();
  try {
    [core, catalog] = await Promise.all([
      import('./adventure-core.mjs'),
      fetch('./data/adventure_catalog.json', { cache:'no-store' }).then(response => {
        if (!response.ok) throw new Error(`Adventure catalog failed: ${response.status}`);
        return response.json();
      })
    ]);
    ensureUi();
    bind();
    render();
  } catch (error) {
    console.warn('Zero2Fit Build 011 Adventure status failed', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();

import('./build012-productization.js').catch(error => console.warn('Zero2Fit Build 012 productization extension failed to load', error));
