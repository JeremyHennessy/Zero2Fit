const Z16_STORAGE_KEY = 'zero2fit-v1';
let z16AdventureCore = null;
let z16VisualCore = null;
let z16Catalog = null;
let z16Timer = null;
let z16Bound = false;

function z16ReadState() {
  try { return JSON.parse(localStorage.getItem(Z16_STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function z16Esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function z16EnsureStylesheet() {
  if (document.querySelector('link[href="./build016.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './build016.css';
  document.head.appendChild(link);
}

function z16EnsureUi() {
  const frontier = document.getElementById('z4FrontierCard');
  if (!frontier) return false;
  frontier.classList.add('z16-ready');
  if (document.getElementById('z16Battlefield')) return true;

  const battlefield = document.createElement('section');
  battlefield.id = 'z16Battlefield';
  battlefield.className = 'z16-battlefield';
  battlefield.innerHTML = `
    <div class="z16-scene-head">
      <div><div class="eyebrow">Current expedition</div><h3 id="z16ZoneTitle">Foundation Trail</h3><p id="z16SceneMeta">Stage 1 · preparing frontier</p></div>
      <span class="z16-outcome" id="z16Outcome">Threat ahead</span>
    </div>
    <div class="z16-arena">
      <section class="z16-side z16-player-side">
        <div class="z16-portrait-shell">
          <div class="z16-player-figure" aria-hidden="true"><span class="z16-head"></span><span class="z16-torso"></span><span class="z16-arm left"></span><span class="z16-arm right"></span><span class="z16-weapon"></span></div>
          <span class="z16-level-badge" id="z16Level">LV 1</span>
        </div>
        <div class="z16-side-copy"><span>You</span><strong id="z16CharacterTitle">The Rebuilder</strong><small id="z16FieldRating">Field rating —</small></div>
        <div class="z16-hp"><div><i id="z16PlayerHpBar"></i></div><span id="z16PlayerHp">— HP</span></div>
      </section>
      <div class="z16-versus"><span>VS</span><i></i></div>
      <section class="z16-side z16-enemy-side">
        <div class="z16-portrait-shell enemy" id="z16EnemyShell" data-kind="guardian">
          <div class="z16-enemy-figure" aria-hidden="true"><span class="z16-enemy-body"></span><span class="z16-enemy-head"></span><span class="z16-enemy-eye one"></span><span class="z16-enemy-eye two"></span><b id="z16EnemySigil">◆</b></div>
          <span class="z16-boss-badge" id="z16BossBadge" hidden>BOSS</span>
        </div>
        <div class="z16-side-copy"><span id="z16EnemyRole">Frontier threat</span><strong id="z16EnemyName">Unknown enemy</strong><small id="z16EnemyStage">Stage —</small></div>
        <div class="z16-hp enemy"><div><i id="z16EnemyHpBar"></i></div><span id="z16EnemyHp">— HP</span></div>
      </section>
    </div>
    <div class="z16-stage-path" id="z16StagePath" aria-label="Adventure stage path"></div>
    <div class="z16-gear-strip" id="z16GearStrip"></div>
    <div class="z16-field-actions">
      <button class="primary-button" type="button" id="z16Run">Run expedition</button>
      <button type="button" id="z16AutoEquip">Auto-equip best</button>
    </div>
    <div class="z16-lower">
      <section class="z16-odds"><div class="z16-subhead"><span>What improves your odds</span><strong id="z16WallState">Advancing</strong></div><div id="z16OddsRows"></div></section>
      <section class="z16-reward"><div class="z16-subhead"><span>Last expedition</span><strong id="z16RewardTitle">No rewards yet</strong></div><div id="z16RewardRows"></div></section>
    </div>`;

  const primary = document.getElementById('z12AdventurePrimary');
  const grid = frontier.querySelector('.z7-adventure-grid');
  if (primary) primary.after(battlefield);
  else if (grid) grid.before(battlefield);
  else frontier.appendChild(battlefield);
  z16Bind();
  return true;
}

function z16TitleForLevel(level) {
  if (level >= 10) return 'Built Different';
  if (level >= 7) return 'Momentum Keeper';
  if (level >= 4) return 'Foundation Forged';
  if (level >= 2) return 'Getting Moving';
  return 'The Rebuilder';
}

function z16SetText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value);
}

function z16Health(id, pct) {
  const node = document.getElementById(id);
  if (node) node.style.width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
}

function z16RenderPath(status) {
  const target = document.getElementById('z16StagePath');
  if (!target) return;
  const nodes = z16VisualCore.stagePathModel(status);
  target.innerHTML = nodes.map((node, index) => `
    <div class="z16-path-node ${node.type} ${node.completed ? 'complete' : ''} ${node.current ? 'current' : ''} ${node.locked ? 'locked' : ''}">
      <span>${node.type === 'boss' ? '♛' : node.stage}</span><small>${z16Esc(node.label)}</small>${index < nodes.length - 1 ? '<i></i>' : ''}
    </div>`).join('');
}

function z16RenderGear(adventure, status) {
  const target = document.getElementById('z16GearStrip');
  if (!target) return;
  const gear = z16VisualCore.gearVisualModel(adventure, status);
  target.innerHTML = gear.map(item => `
    <article class="z16-gear ${z16Esc(item.rarity)} ${item.equipped ? '' : 'empty'}">
      <div class="z16-gear-icon">${z16Esc(item.icon)}</div>
      <div><span>${z16Esc(item.slot)}</span><strong>${z16Esc(item.name)}</strong><small>${item.equipped ? `usable ${item.effectivePower}/${item.rawPower}${item.lockedPower ? ` · ${item.lockedPower} locked` : ''}` : 'No item equipped'}</small></div>
    </article>`).join('');
  const weapon = gear.find(item => item.slot === 'weapon');
  const figure = document.querySelector('.z16-player-figure');
  if (figure) figure.dataset.weapon = weapon?.equipped ? 'equipped' : 'empty';
}

function z16RenderOdds(status) {
  const target = document.getElementById('z16OddsRows');
  if (!target) return;
  const rows = z16VisualCore.oddsLevers(status);
  target.innerHTML = rows.map(row => `<div class="z16-odds-row"><span><strong>${z16Esc(row.title)}</strong><small>${z16Esc(row.detail)}</small></span><b>›</b></div>`).join('');
  const wall = status.wall;
  z16SetText('z16WallState', !status.wallActive ? 'Advancing' : wall?.type === 'combat_defeat' ? 'Combat wall' : wall?.type === 'capability_gate' ? 'Real-progress gate' : wall?.type === 'content_complete' ? 'Arc clear' : 'Paused');
}

function z16RenderRewards(adventure) {
  const target = document.getElementById('z16RewardRows');
  if (!target) return;
  const reward = z16VisualCore.rewardRevealModel(adventure, z16Catalog);
  if (!reward.hasResult) {
    z16SetText('z16RewardTitle', 'No rewards yet');
    target.innerHTML = '<div class="z16-empty">Complete an expedition to reveal coins, materials and gear here.</div>';
    return;
  }
  const entries = [];
  if (reward.coins) entries.push(`<div class="z16-reward-chip"><span>◉</span><strong>${reward.coins}</strong><small>coins</small></div>`);
  for (const item of reward.loot.slice(0, 2)) entries.push(`<div class="z16-reward-chip ${z16Esc(item.rarity)}"><span>${z16Esc(item.icon)}</span><strong>${z16Esc(item.name)}</strong><small>+${item.power} ${z16Esc(item.slot)}</small></div>`);
  for (const item of reward.materials.slice(0, 3)) entries.push(`<div class="z16-reward-chip"><span>${z16Esc(item.icon)}</span><strong>${item.quantity}× ${z16Esc(item.name)}</strong><small>material</small></div>`);
  z16SetText('z16RewardTitle', `${reward.coins} coins · ${reward.loot.length} gear · ${reward.materials.reduce((sum, item) => sum + item.quantity, 0)} materials`);
  target.innerHTML = entries.join('') || '<div class="z16-empty">Expedition recorded with no item or material drop.</div>';
}

function z16RenderEncounter(status, adventure, profile) {
  const encounter = z16VisualCore.encounterVisualModel({ status, adventure, catalog:z16Catalog });
  const level = Number(profile?.level || 1);
  z16SetText('z16ZoneTitle', status.zone?.name || 'Frontier');
  z16SetText('z16SceneMeta', `Stage ${status.stage?.stage || 1}/${status.stage?.stageCount || 4} · ${status.stage?.victories || 0}/${status.stage?.clearVictories || 0} wins`);
  z16SetText('z16Level', `LV ${level}`);
  z16SetText('z16CharacterTitle', z16TitleForLevel(level));
  z16SetText('z16FieldRating', `Field rating ${Math.round(Number(profile?.attack || 0) + Number(profile?.defense || 0) + Number(profile?.maxHp || 0) / 10)}`);
  z16SetText('z16Outcome', encounter?.outcome || 'Threat ahead');
  if (!encounter) return;
  z16SetText('z16EnemyName', encounter.name);
  z16SetText('z16EnemyRole', encounter.boss ? 'Boss' : encounter.source === 'last_battle' ? 'Last opponent' : 'Encounter pool');
  z16SetText('z16EnemyStage', `Stage ${encounter.stage || status.stage?.stage || 1}${encounter.source === 'encounter_pool' ? ' · possible threat' : encounter.turns ? ` · ${encounter.turns} turns` : ''}`);
  z16SetText('z16EnemySigil', encounter.sigil);
  const shell = document.getElementById('z16EnemyShell');
  if (shell) shell.dataset.kind = encounter.kind;
  const boss = document.getElementById('z16BossBadge');
  if (boss) boss.hidden = !encounter.boss;
  z16Health('z16PlayerHpBar', encounter.playerHpPercent);
  z16Health('z16EnemyHpBar', encounter.enemyHpPercent);
  z16SetText('z16PlayerHp', encounter.source === 'last_battle' ? `${encounter.playerHp}/${encounter.playerMaxHp} HP` : `${encounter.playerMaxHp} max HP`);
  z16SetText('z16EnemyHp', encounter.source === 'last_battle' ? `${encounter.enemyHp}/${encounter.enemyMaxHp} HP` : `${encounter.enemyMaxHp} HP`);
}

function z16Render() {
  if (!z16AdventureCore || !z16VisualCore || !z16Catalog || !z16EnsureUi()) return;
  const appState = z16ReadState();
  const adventure = z16AdventureCore.normalizeAdventureState(appState.adventure || {}, z16Catalog);
  const status = z16AdventureCore.progressionStatus(appState, adventure, z16Catalog);
  const profile = z16AdventureCore.fitnessProfile(appState, adventure, z16Catalog);
  z16RenderEncounter(status, adventure, profile);
  z16RenderPath(status);
  z16RenderGear(adventure, status);
  z16RenderOdds(status);
  z16RenderRewards(adventure);
  const originalRun = document.getElementById('z7RunNow');
  const run = document.getElementById('z16Run');
  if (run && originalRun) {
    run.disabled = originalRun.disabled;
    run.textContent = originalRun.disabled ? originalRun.textContent : 'Run expedition · 1 energy';
  }
}

function z16Schedule(delay = 0) {
  clearTimeout(z16Timer);
  z16Timer = setTimeout(z16Render, delay);
}

function z16Bind() {
  if (z16Bound) return;
  z16Bound = true;
  document.getElementById('z16Run')?.addEventListener('click', () => {
    const original = document.getElementById('z7RunNow');
    if (!original || original.disabled) return;
    original.click();
    navigator.vibrate?.([20, 30, 20]);
    z16Schedule(120);
  });
  document.getElementById('z16AutoEquip')?.addEventListener('click', () => {
    document.getElementById('z7AutoEquip')?.click();
    z16Schedule(80);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-zone-id],[data-equip-id],#z7AutoToggle,#z7RunNow,#z7AutoEquip')) z16Schedule(100);
  });
  window.addEventListener('focus', () => z16Schedule(80));
  window.addEventListener('zero2fit:remote-sync', () => z16Schedule(80));
  window.addEventListener('zero2fit:personal-intelligence', () => z16Schedule(80));
}

async function z16Init() {
  try {
    z16EnsureStylesheet();
    [z16AdventureCore, z16VisualCore, z16Catalog] = await Promise.all([
      import('./adventure-core.mjs'),
      import('./adventure-visual-core.mjs'),
      fetch('./data/adventure_catalog.json', { cache:'no-store' }).then(response => {
        if (!response.ok) throw new Error(`Adventure catalog failed: ${response.status}`);
        return response.json();
      })
    ]);
    z16EnsureUi();
    z16Schedule(150);
  } catch (error) {
    console.warn('Zero2Fit Build 016 Adventure visual layer failed', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', z16Init, { once:true });
else z16Init();

import('./build017-fuel.js').catch(error => console.warn('Zero2Fit Build 017 Fuel extension failed to load', error));
