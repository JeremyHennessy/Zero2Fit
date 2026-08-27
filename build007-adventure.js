(() => {
  'use strict';

  const STORAGE_KEY = 'zero2fit-v1';
  let core = null;
  let catalog = null;

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  };

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.Zero2FitStorage?.saveSnapshot?.(state).catch(() => {});
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function ensureStyles() {
    if (document.querySelector('link[href="./build007.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './build007.css';
    document.head.appendChild(link);
  }

  function getAdventureState(appState) {
    return core.normalizeAdventureState(appState.adventure || {}, catalog);
  }

  function saveAdventure(adventure) {
    const state = readState();
    state.adventure = adventure;
    writeState(state);
  }

  function ensureUi() {
    const frontier = document.getElementById('z4FrontierCard');
    if (!frontier) return false;
    frontier.classList.add('z7-adventure-card');
    frontier.innerHTML = `
      <div class="z7-adventure-header">
        <div>
          <div class="eyebrow">Auto-adventure</div>
          <h2>Frontier expedition</h2>
          <p>Real fitness creates Adventure Energy. Battles, loot and gear improve the RPG only — they never create Fitness XP.</p>
        </div>
        <div class="z7-adventure-kpis">
          <div><span>Energy</span><strong id="z7Energy">0</strong></div>
          <div><span>Coins</span><strong id="z7Coins">0</strong></div>
          <div><span>Victories</span><strong id="z7Victories">0</strong></div>
        </div>
      </div>
      <div class="z7-zone-list" id="z7ZoneList"></div>
      <div class="z7-adventure-grid">
        <section class="z7-expedition-panel">
          <div class="z7-panel-heading"><div><span>Selected frontier</span><strong id="z7ZoneName">Foundation Trail</strong></div><span id="z7ZoneTier">Tier 1</span></div>
          <p id="z7ZoneDescription" class="z7-subtle"></p>
          <div id="z7LastEncounter" class="z7-encounter"></div>
          <div class="z7-expedition-actions">
            <button class="primary-button" id="z7RunNow">Run expedition · 1 energy</button>
            <button class="z4-secondary" id="z7AutoEquip">Auto-equip best gear</button>
          </div>
        </section>
        <section class="z7-auto-panel">
          <div class="z7-auto-status"><span class="z7-orb"></span><div><strong>Offline auto-adventure</strong><small>Reconciles when Zero2Fit opens; no background service is required.</small></div></div>
          <label class="z7-toggle"><input type="checkbox" id="z7AutoToggle"><span></span><b id="z7AutoText">Off</b></label>
          <div class="z7-rule-box"><strong>Energy rule</strong><span id="z7EnergyRule">+1 charge per 25 lifetime Fitness XP</span></div>
          <div class="z7-rule-box"><strong>Auto cadence</strong><span id="z7Cadence">Every 2 hours · max 6 catch-up runs</span></div>
          <div class="z7-gear-summary" id="z7GearSummary"></div>
        </section>
      </div>
      <div class="z7-lower-grid">
        <section>
          <div class="z7-section-title"><div><span>Battle record</span><h3>Recent expedition</h3></div></div>
          <div id="z7BattleLog" class="z7-battle-log"></div>
        </section>
        <section>
          <div class="z7-section-title"><div><span>Inventory</span><h3>Loot & equipment</h3></div><strong id="z7InventoryCount">0</strong></div>
          <div id="z7Inventory" class="z7-inventory"></div>
        </section>
      </div>`;
    bindUi();
    return true;
  }

  function currentZone(adventure) {
    return catalog.zones.find(zone => zone.id === adventure.selectedZoneId) || catalog.zones[0];
  }

  function renderZoneButtons(appState, adventure) {
    const zones = core.unlockedZones(appState, adventure, catalog);
    const container = document.getElementById('z7ZoneList');
    if (!container) return;
    container.innerHTML = zones.map(zone => {
      const progress = adventure.zoneProgress?.[zone.id]?.victories || 0;
      const selected = zone.id === adventure.selectedZoneId;
      const requirement = !zone.unlocked
        ? `Lv ${zone.minFitnessLevel}${zone.requires ? ` · ${zone.requires.victories} prior wins` : ''}`
        : `${progress} wins`;
      return `<button class="z7-zone ${selected ? 'selected' : ''} ${zone.unlocked ? '' : 'locked'}" data-zone-id="${esc(zone.id)}" ${zone.unlocked ? '' : 'disabled'}>
        <span>Tier ${zone.tier}</span><strong>${esc(zone.name)}</strong><small>${esc(requirement)}</small>
      </button>`;
    }).join('');
    container.querySelectorAll('[data-zone-id]').forEach(button => button.addEventListener('click', () => {
      const state = readState();
      const next = getAdventureState(state);
      next.selectedZoneId = button.dataset.zoneId;
      saveAdventure(next);
      render();
    }));
  }

  function itemHtml(item, adventure) {
    const equipped = adventure.equipped?.[item.slot] === item.instanceId;
    return `<article class="z7-loot ${esc(item.rarity)} ${equipped ? 'equipped' : ''}">
      <div class="z7-loot-icon">${esc(item.icon || '◆')}</div>
      <div class="z7-loot-copy"><span>${esc(item.rarity)} · ${esc(item.slot)}</span><strong>${esc(item.name)}</strong><small>Power +${Number(item.power || 0)}</small></div>
      <button class="z7-equip" data-equip-id="${esc(item.instanceId)}" ${equipped ? 'disabled' : ''}>${equipped ? 'Equipped' : 'Equip'}</button>
    </article>`;
  }

  function renderInventory(adventure) {
    const container = document.getElementById('z7Inventory');
    if (!container) return;
    const items = adventure.inventory || [];
    document.getElementById('z7InventoryCount').textContent = `${items.length} items`;
    container.innerHTML = items.length ? items.slice(0, 18).map(item => itemHtml(item, adventure)).join('') : '<div class="z7-empty">No loot yet. Run an expedition after earning Adventure Energy.</div>';
    container.querySelectorAll('[data-equip-id]').forEach(button => button.addEventListener('click', () => {
      const state = readState();
      const next = core.equipItem(getAdventureState(state), button.dataset.equipId, catalog);
      saveAdventure(next);
      render();
    }));
  }

  function renderGear(adventure, appState) {
    const profile = core.fitnessProfile(appState, adventure, catalog);
    const slots = ['weapon', 'armor', 'charm'];
    const html = slots.map(slot => {
      const id = adventure.equipped?.[slot];
      const item = adventure.inventory.find(candidate => candidate.instanceId === id);
      return `<div><span>${slot}</span><strong>${item ? esc(item.name) : 'Empty'}</strong><small>${item ? `+${item.power}` : '—'}</small></div>`;
    }).join('');
    const box = document.getElementById('z7GearSummary');
    if (box) box.innerHTML = `${html}<div class="z7-combat-rating"><span>Field rating</span><strong>${Math.round(profile.attack + profile.defense + profile.maxHp / 10)}</strong></div>`;
  }

  function renderLastResult(adventure) {
    const result = adventure.lastResult;
    const encounter = document.getElementById('z7LastEncounter');
    const log = document.getElementById('z7BattleLog');
    if (!result) {
      encounter.innerHTML = '<div class="z7-empty">Your next expedition will resolve up to three encounters and persist the result locally.</div>';
      log.innerHTML = '<div class="z7-empty">No expeditions recorded yet.</div>';
      return;
    }
    const lastBattle = result.battles.at(-1);
    const outcome = result.defeated ? 'Retreated' : 'Expedition clear';
    encounter.innerHTML = `<div class="z7-encounter-title"><span>${esc(outcome)}</span><strong>${esc(lastBattle?.enemyName || result.zoneName)}</strong></div>
      <div class="z7-health-row"><span>You</span><div><i style="width:${lastBattle ? Math.max(0, Math.round(lastBattle.playerHp / lastBattle.playerMaxHp * 100)) : 100}%"></i></div><b>${lastBattle ? lastBattle.playerHp : '—'}</b></div>
      <div class="z7-health-row enemy"><span>Enemy</span><div><i style="width:${lastBattle ? Math.max(0, Math.round(lastBattle.enemyHp / lastBattle.enemyMaxHp * 100)) : 0}%"></i></div><b>${lastBattle ? lastBattle.enemyHp : '—'}</b></div>
      <div class="z7-result-rewards"><span>${result.wins} wins</span><span>+${result.coinsEarned} coins</span><span>${result.loot.length} loot</span></div>`;
    log.innerHTML = result.battles.map((battle, index) => `<article class="z7-battle-row ${battle.victory ? 'win' : 'loss'}">
      <div><span>${battle.boss ? 'Boss' : `Encounter ${index + 1}`}</span><strong>${esc(battle.enemyName)}</strong></div>
      <div><b>${battle.victory ? 'Victory' : 'Defeat'}</b><small>${battle.turns} turns · ${battle.playerDamage} dealt</small></div>
    </article>`).join('');
  }

  function render() {
    if (!core || !catalog) return;
    const appState = readState();
    let adventure = getAdventureState(appState);
    const auto = core.processAutoAdventure({ appState, adventure, catalog, now: Date.now() });
    if (JSON.stringify(auto.adventure) !== JSON.stringify(adventure)) {
      adventure = auto.adventure;
      appState.adventure = adventure;
      writeState(appState);
    }
    const energy = core.availableEnergy(appState, adventure, catalog);
    const zone = currentZone(adventure);
    document.getElementById('z7Energy').textContent = energy;
    document.getElementById('z7Coins').textContent = Number(adventure.coins || 0).toLocaleString();
    document.getElementById('z7Victories').textContent = Number(adventure.victories || 0).toLocaleString();
    document.getElementById('z7ZoneName').textContent = zone.name;
    document.getElementById('z7ZoneTier').textContent = `Tier ${zone.tier}`;
    document.getElementById('z7ZoneDescription').textContent = zone.description;
    const runButton = document.getElementById('z7RunNow');
    runButton.disabled = energy <= 0;
    runButton.textContent = energy > 0 ? 'Run expedition · 1 energy' : 'Earn Fitness XP for Adventure Energy';
    const toggle = document.getElementById('z7AutoToggle');
    toggle.checked = !!adventure.autoEnabled;
    document.getElementById('z7AutoText').textContent = adventure.autoEnabled ? 'On' : 'Off';
    document.getElementById('z7EnergyRule').textContent = `+1 charge per ${catalog.energyXpPerCharge} lifetime Fitness XP · ${energy} available`;
    document.getElementById('z7Cadence').textContent = `Every ${catalog.autoIntervalMinutes / 60} hours · max ${catalog.maxOfflineRuns} catch-up runs`;
    renderZoneButtons(appState, adventure);
    renderGear(adventure, appState);
    renderLastResult(adventure);
    renderInventory(adventure);
  }

  function bindUi() {
    document.getElementById('z7RunNow')?.addEventListener('click', () => {
      const state = readState();
      const adventure = getAdventureState(state);
      const simulated = core.simulateExpedition({ appState: state, adventure, catalog, zoneId: adventure.selectedZoneId, seed: `${Date.now()}:${adventure.encounters}` });
      if (!simulated.error) saveAdventure(simulated.adventure);
      render();
    });
    document.getElementById('z7AutoEquip')?.addEventListener('click', () => {
      const state = readState();
      saveAdventure(core.autoEquipBest(getAdventureState(state), catalog));
      render();
    });
    document.getElementById('z7AutoToggle')?.addEventListener('change', event => {
      const state = readState();
      saveAdventure(core.setAutoAdventure(getAdventureState(state), event.target.checked, Date.now(), catalog));
      render();
    });
  }

  async function init() {
    try {
      ensureStyles();
      [core, catalog] = await Promise.all([
        import('./adventure-core.mjs'),
        fetch('./data/adventure_catalog.json', { cache: 'no-store' }).then(response => {
          if (!response.ok) throw new Error(`Adventure catalog failed: ${response.status}`);
          return response.json();
        })
      ]);
      if (!ensureUi()) return;
      render();
      window.addEventListener('focus', render);
    } catch (error) {
      console.warn('Zero2Fit Build 007 adventure failed', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
