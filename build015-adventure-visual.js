const Z15_STORAGE_KEY = 'zero2fit-v1';
let z15AdventureCore = null;
let z15VisualCore = null;
let z15Catalog = null;
let z15Timer = null;

function z15ReadState() {
  try { return JSON.parse(localStorage.getItem(Z15_STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function z15Esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function z15EnsureUi() {
  const frontier = document.getElementById('z4FrontierCard');
  if (!frontier || document.getElementById('z15Battlefield')) return;
  const battlefield = document.createElement('section');
  battlefield.id = 'z15Battlefield';
  battlefield.className = 'z15-battlefield';
  battlefield.innerHTML = `
    <div class="z15-scene-head">
      <div><div class="eyebrow">Current expedition</div><h3 id="z15ZoneTitle">Foundation Trail</h3><p id="z15SceneMeta">Stage 1 · preparing frontier</p></div>
      <span class="z15-outcome" id="z15Outcome">Threat ahead</span>
    </div>
    <div class="z15-arena">
      <section class="z15-side z15-player-side">
        <div class="z15-portrait-shell">
          <div class="z15-player-figure" aria-hidden="true"><span class="z15-head"></span><span class="z15-torso"></span><span class="z15-arm left"></span><span class="z15-arm right"></span><span class="z15-weapon"></span></div>
          <span class="z15-level-badge" id="z15Level">LV 1</span>
        </div>
        <div class="z15-side-copy"><span>You</span><strong id="z15CharacterTitle">The Rebuilder</strong><small id="z15FieldRating">Field rating —</small></div>
        <div class="z15-hp"><div><i id="z15PlayerHpBar"></i></div><span id="z15PlayerHp">— HP</span></div>
      </section>
      <div class="z15-versus"><span>VS</span><i></i></div>
      <section class="z15-side z15-enemy-side">
        <div class="z15-portrait-shell enemy" id="z15EnemyShell" data-kind="guardian">
          <div class="z15-enemy-figure" aria-hidden="true"><span class="z15-enemy-body"></span><span class="z15-enemy-head"></span><span class="z15-enemy-eye one"></span><span class="z15-enemy-eye two"></span><b id="z15EnemySigil">◆</b></div>
          <span class="z15-boss-badge" id="z15BossBadge" hidden>BOSS</span>
        </div>
        <div class="z15-side-copy"><span id="z15EnemyRole">Frontier threat</span><strong id="z15EnemyName">Unknown enemy</strong><small id="z15EnemyStage">Stage —</small></div>
        <div class="z15-hp enemy"><div><i id="z15EnemyHpBar"></i></div><span id="z15EnemyHp">— HP</span></div>
      </section>
    </div>
    <div class="z15-stage-path" id="z15StagePath"></div>
    <div class="z15-gear-strip" id="z15GearStrip"></div>
    <div class="z15-field-actions">
      <button class="primary-button" type="button" id="z15Run">Run expedition</button>
      <button type="button" id="z15AutoEquip">Auto-equip best</button>
    </div>
    <div class="z15-lower">
      <section class="z15-odds"><div class="z15-subhead"><span>What improves your odds</span><strong id="z15WallState">Advancing</strong></div><div id="z15OddsRows"></div></section>
      <section class="z15-reward"><div class="z15-subhead"><span>Last expedition</span><strong id="z15RewardTitle">No rewards yet</strong></div><div id="z15RewardRows"></div></section>
    </div>`;
  const primary = document.getElementById('z12AdventurePrimary');
  const grid = frontier.querySelector('.z7-adventure-grid');
  if (primary) primary.after(battlefield);
  else if (grid) grid.before(battlefield);
  else frontier.appendChild(battlefield);
  z15Bind();
}

function z15TitleForLevel(level) {
  if (level >= 10) return 'Built Different';
  if (level >= 7) return 'Momentum Keeper';
  if (level >= 4) return 'Foundation Forged';
  if (level >= 2) return 'Getting Moving';
  return 'The Rebuilder';
}

function z15SetText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value);
}

function z15Health(id, pct) {
  const node = document.getElementById(id);
  if (node) node.style.width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
}

function z15RenderPath(status) {
  const target = document.getElementById('z15StagePath');
  if (!target) return;
  const nodes = z15VisualCore.stagePathModel(status);
  target.innerHTML = nodes.map((node, index) => `
    <div class="z15-path-node ${node.type} ${node.completed ? 'complete' : ''} ${node.current ? 'current' : ''} ${node.locked ? 'locked' : ''}">
      <span>${node.type === 'boss' ? '♛' : node.stage}</span><small>${z15Esc(node.label)}</small>${index < nodes.length - 1 ? '<i></i>' : ''}
    </div>`).join('');
}

function z15RenderGear(adventure, status) {
  const target = document.getElementById('z15GearStrip');
  if (!target) return;
  const gear = z15VisualCore.gearVisualModel(adventure, status, z15Catalog);
  target.innerHTML = gear.map(item => `
    <article class="z15-gear ${z15Esc(item.rarity)} ${item.equipped ? '' : 'empty'}">
      <div class="z15-gear-icon">${z15Esc(item.icon)}</div>
      <div><span>${z15Esc(item.slot)}</span><strong>${z15Esc(item.name)}</strong><small>${item.equipped ? `usable ${item.effectivePower}/${item.rawPower}${item.lockedPower ? ` · ${item.lockedPower} locked` : ''}` : 'No item equipped'}</small></div>
    </article>`).join('');
  const weapon = gear.find(item => item.slot === 'weapon');
  const figure = document.querySelector('.z15-player-figure');
  if (figure) figure.dataset.weapon = weapon?.equipped ? 'equipped' : 'empty';
}

function z15RenderOdds(status) {
  const target = document.getElementById('z15OddsRows');
  if (!target) return;
  const rows = z15VisualCore.oddsLevers(status);
  target.innerHTML = rows.map(row => `<div class="z15-odds-row"><span><strong>${z15Esc(row.title)}</strong><small>${z15Esc(row.detail)}</small></span><b>›</b></div>`).join('');
  const wall = status.wall;
  z15SetText('z15WallState', !status.wallActive ? 'Advancing' : wall?.type === 'combat_defeat' ? 'Combat wall' : wall?.type === 'capability_gate' ? 'Real-progress gate' : wall?.type === 'content_complete' ? 'Arc clear' : 'Paused');
}

function z15RenderRewards(adventure) {
  const target = document.getElementById('z15RewardRows');
  if (!target) return;
  const reward = z15VisualCore.rewardRevealModel(adventure, z15Catalog);
  if (!reward.hasResult) {
    z15SetText('z15RewardTitle', 'No rewards yet');
    target.innerHTML = '<div class="z15-empty">Complete an expedition to reveal coins, materials and gear here.</div>';
    return;
  }
  const entries = [];
  if (reward.coins) entries.push(`<div class="z15-reward-chip"><span>◉</span><strong>${reward.coins}</strong><small>coins</small></div>`);
  for (const item of reward.loot.slice(0,2)) entries.push(`<div class="z15-reward-chip ${z15Esc(item.rarity)}"><span>${z15Esc(item.icon)}</span><strong>${z15Esc(item.name)}</strong><small>+${item.power} ${z15Esc(item.slot)}</small></div>`);
  for (const item of reward.materials.slice(0,3)) entries.push(`<div class="z15-reward-chip"><span>${z15Esc(item.icon)}</span><strong>${item.quantity}× ${z15Esc(item.name)}</strong><small>material</small></div>`);
  z15SetText('z15RewardTitle', `${reward.coins} coins · ${reward.loot.length} gear · ${reward.materials.reduce((sum,item)=>sum+item.quantity,0)} materials`);
  target.innerHTML = entries.join('') || '<div class="z15-empty">Expedition recorded with no item or material drop.</div>';
}

function z15RenderEncounter(status, adventure) {
  const encounter = z15VisualCore.encounterVisualModel({ status, adventure, catalog:z15Catalog });
  const caps = status.capabilities || {};
  const level = Number(caps.level || 1);
  z15SetText('z15ZoneTitle', status.zone?.name || 'Frontier');
  z15SetText('z15SceneMeta', `Stage ${status.stage?.stage || 1}/${status.stage?.stageCount || 4} · ${status.stage?.victories || 0}/${status.stage?.clearVictories || 0} wins`);
  z15SetText('z15Level', `LV ${level}`);
  z15SetText('z15CharacterTitle', z15TitleForLevel(level));
  z15SetText('z15FieldRating', `Field rating ${Math.round(Number(caps.attack || 0) + Number(caps.defense || 0) + Number(caps.maxHp || 0) / 10)}`);
  z15SetText('z15Outcome', encounter?.outcome || 'Threat ahead');
  if (!encounter) return;
  z15SetText('z15EnemyName', encounter.name);
  z15SetText('z15EnemyRole', encounter.boss ? 'Boss' : encounter.source === 'last_battle' ? 'Last opponent' : 'Encounter pool');
  z15SetText('z15EnemyStage', `Stage ${encounter.stage || status.stage?.stage || 1}${encounter.source === 'encounter_pool' ? ' · possible threat' : encounter.turns ? ` · ${encounter.turns} turns` : ''}`);
  z15SetText('z15EnemySigil', encounter.sigil);
  const shell = document.getElementById('z15EnemyShell');
  if (shell) shell.dataset.kind = encounter.kind;
  const boss = document.getElementById('z15BossBadge');
  if (boss) boss.hidden = !encounter.boss;
  z15Health('z15PlayerHpBar', encounter.playerHpPercent);
  z15Health('z15EnemyHpBar', encounter.enemyHpPercent);
  z15SetText('z15PlayerHp', encounter.source === 'last_battle' ? `${encounter.playerHp}/${encounter.playerMaxHp} HP` : `${encounter.playerMaxHp} max HP`);
  z15SetText('z15EnemyHp', encounter.source === 'last_battle' ? `${encounter.enemyHp}/${encounter.enemyMaxHp} HP` : `${encounter.enemyMaxHp} HP`);
}

function z15Render() {
  if (!z15AdventureCore || !z15VisualCore || !z15Catalog) return;
  z15EnsureUi();
  const appState = z15ReadState();
  const adventure = z15AdventureCore.normalizeAdventureState(appState.adventure || {}, z15Catalog);
  const status = z15AdventureCore.progressionStatus(appState, adventure, z15Catalog);
  z15RenderEncounter(status, adventure);
  z15RenderPath(status);
  z15RenderGear(adventure, status);
  z15RenderOdds(status);
  z15RenderRewards(adventure);
  const originalRun = document.getElementById('z7RunNow');
  const run = document.getElementById('z15Run');
  if (run && originalRun) {
    run.disabled = originalRun.disabled;
    run.textContent = originalRun.disabled ? originalRun.textContent : 'Run expedition · 1 energy';
  }
}

function z15Schedule(delay = 0) {
  clearTimeout(z15Timer);
  z15Timer = setTimeout(z15Render, delay);
}

function z15Bind() {
  document.getElementById('z15Run')?.addEventListener('click', () => {
    const original = document.getElementById('z7RunNow');
    if (!original || original.disabled) return;
    original.click();
    navigator.vibrate?.([20,30,20]);
    z15Schedule(120);
  });
  document.getElementById('z15AutoEquip')?.addEventListener('click', () => {
    document.getElementById('z7AutoEquip')?.click();
    z15Schedule(80);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-zone-id],[data-equip-id],#z7AutoToggle,#z7RunNow,#z7AutoEquip')) z15Schedule(100);
  });
  window.addEventListener('focus', () => z15Schedule(80));
  window.addEventListener('zero2fit:remote-sync', () => z15Schedule(80));
  window.addEventListener('zero2fit:personal-intelligence', () => z15Schedule(80));
}

async function z15Init() {
  try {
    [z15AdventureCore, z15VisualCore, z15Catalog] = await Promise.all([
      import('./adventure-core.mjs'),
      import('./adventure-visual-core.mjs'),
      fetch('./data/adventure_catalog.json', { cache:'no-store' }).then(response => {
        if (!response.ok) throw new Error(`Adventure catalog failed: ${response.status}`);
        return response.json();
      })
    ]);
    z15EnsureUi();
    z15Schedule(150);
  } catch (error) {
    console.warn('Zero2Fit Build 015 Adventure visual layer failed', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', z15Init, { once:true });
else z15Init();
