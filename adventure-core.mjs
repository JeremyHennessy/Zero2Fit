const rarityOrder = ['common', 'uncommon', 'rare', 'epic'];
const rarityBonus = { common: 0, uncommon: 2, rare: 5, epic: 9 };

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function hashSeed(value) {
  const text = String(value ?? 'zero2fit');
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let a = hashSeed(seed) || 1;
  return () => {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pick(list, rng) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

function fitnessLevel(appState = {}) {
  return Math.floor(num(appState.totalXp) / 100) + 1;
}

function statLevel(appState = {}, key) {
  return Math.floor(num(appState?.attributes?.[key]) / 50) + 1;
}

export function defaultAdventureState(catalog = {}) {
  return {
    version: 1,
    selectedZoneId: catalog?.zones?.[0]?.id || 'foundation_trail',
    autoEnabled: false,
    autoLastProcessedAt: null,
    energySpent: 0,
    coins: 0,
    victories: 0,
    defeats: 0,
    encounters: 0,
    zoneProgress: {},
    inventory: [],
    equipped: { weapon: null, armor: null, charm: null },
    bestiary: {},
    runs: [],
    lastResult: null
  };
}

export function normalizeAdventureState(value = {}, catalog = {}) {
  const defaults = defaultAdventureState(catalog);
  const merged = {
    ...defaults,
    ...(value || {}),
    zoneProgress: { ...defaults.zoneProgress, ...(value?.zoneProgress || {}) },
    equipped: { ...defaults.equipped, ...(value?.equipped || {}) },
    bestiary: { ...defaults.bestiary, ...(value?.bestiary || {}) },
    inventory: Array.isArray(value?.inventory) ? value.inventory : [],
    runs: Array.isArray(value?.runs) ? value.runs : []
  };
  if (!catalog?.zones?.some(zone => zone.id === merged.selectedZoneId)) merged.selectedZoneId = defaults.selectedZoneId;
  return merged;
}

export function availableEnergy(appState = {}, adventure = {}, catalog = {}) {
  const perCharge = Math.max(1, num(catalog.energyXpPerCharge) || 25);
  const earned = Math.floor(num(appState.totalXp) / perCharge);
  return Math.max(0, earned - num(adventure.energySpent));
}

export function zoneUnlocked(appState = {}, adventure = {}, zone = {}, catalog = {}) {
  if (fitnessLevel(appState) < num(zone.minFitnessLevel || 1)) return false;
  if (!zone.requires) return true;
  const prior = adventure?.zoneProgress?.[zone.requires.zoneId] || {};
  return num(prior.victories) >= num(zone.requires.victories);
}

export function unlockedZones(appState = {}, adventure = {}, catalog = {}) {
  return (catalog.zones || []).map(zone => ({ ...zone, unlocked: zoneUnlocked(appState, adventure, zone, catalog) }));
}

export function equippedBonuses(adventure = {}) {
  const bonuses = { weapon: 0, armor: 0, charm: 0, total: 0 };
  for (const slot of ['weapon', 'armor', 'charm']) {
    const instanceId = adventure?.equipped?.[slot];
    const instance = (adventure.inventory || []).find(item => item.instanceId === instanceId);
    if (!instance) continue;
    bonuses[slot] = num(instance.power);
    bonuses.total += num(instance.power);
  }
  return bonuses;
}

export function fitnessProfile(appState = {}, adventure = {}, catalog = {}) {
  const level = fitnessLevel(appState);
  const strength = statLevel(appState, 'strength');
  const endurance = statLevel(appState, 'endurance');
  const consistency = statLevel(appState, 'consistency');
  const recovery = statLevel(appState, 'recovery');
  const nutrition = statLevel(appState, 'nutrition');
  const gear = equippedBonuses(adventure);
  return {
    level,
    strength,
    endurance,
    consistency,
    recovery,
    nutrition,
    maxHp: 68 + level * 7 + endurance * 8 + recovery * 5 + gear.charm * 2,
    attack: 7 + level * 2 + strength * 3 + gear.weapon,
    defense: 3 + level + recovery * 2 + consistency + gear.armor,
    critChance: clamp(0.04 + endurance * 0.006 + nutrition * 0.003, 0.04, 0.16),
    evadeChance: clamp(0.02 + endurance * 0.004 + consistency * 0.002, 0.02, 0.12),
    gear
  };
}

function rarityRoll(rng, zoneTier, consistencyLevel) {
  const epic = clamp(0.008 + zoneTier * 0.004 + consistencyLevel * 0.001, 0.01, 0.05);
  const rare = clamp(0.055 + zoneTier * 0.012 + consistencyLevel * 0.002, 0.06, 0.18);
  const uncommon = clamp(0.22 + zoneTier * 0.02, 0.22, 0.34);
  const roll = rng();
  if (roll < epic) return 'epic';
  if (roll < epic + rare) return 'rare';
  if (roll < epic + rare + uncommon) return 'uncommon';
  return 'common';
}

function enemyForEncounter(zone, adventure, catalog, rng) {
  const progress = adventure?.zoneProgress?.[zone.id] || { victories: 0 };
  const bossEvery = Math.max(1, num(zone.bossEveryVictories) || 8);
  const bossDue = num(progress.victories) > 0 && num(progress.victories) % bossEvery === bossEvery - 1;
  const id = bossDue && zone.bossId ? zone.bossId : pick(zone.enemyIds || [], rng);
  return (catalog.enemies || []).find(enemy => enemy.id === id) || null;
}

function fight(profile, enemy, rng) {
  let playerHp = profile.maxHp;
  let enemyHp = num(enemy.hp);
  let turns = 0;
  let playerDamage = 0;
  let enemyDamage = 0;
  let crits = 0;
  let evades = 0;
  const log = [];

  while (playerHp > 0 && enemyHp > 0 && turns < 60) {
    turns += 1;
    const crit = rng() < profile.critChance;
    let damage = Math.max(1, profile.attack * (0.86 + rng() * 0.28) - num(enemy.defense) * 0.38);
    if (crit) { damage *= 1.65; crits += 1; }
    damage = Math.round(damage);
    enemyHp = Math.max(0, enemyHp - damage);
    playerDamage += damage;
    if (log.length < 4) log.push(crit ? `Critical hit for ${damage}` : `Hit for ${damage}`);
    if (enemyHp <= 0) break;

    if (rng() < profile.evadeChance) {
      evades += 1;
      if (log.length < 4) log.push('Evaded the counterattack');
      continue;
    }
    let incoming = Math.max(1, num(enemy.attack) * (0.86 + rng() * 0.28) - profile.defense * 0.34);
    incoming = Math.round(incoming);
    playerHp = Math.max(0, playerHp - incoming);
    enemyDamage += incoming;
  }

  return {
    victory: enemyHp <= 0 && playerHp > 0,
    turns,
    playerHp,
    playerMaxHp: profile.maxHp,
    enemyHp,
    enemyMaxHp: num(enemy.hp),
    playerDamage,
    enemyDamage,
    crits,
    evades,
    log
  };
}

function itemDef(catalog, itemId) {
  return (catalog.items || []).find(item => item.id === itemId) || null;
}

function createLoot(zone, enemy, profile, adventure, catalog, rng, seed, encounterIndex) {
  const coins = Math.round(num(enemy.coinMin) + rng() * Math.max(0, num(enemy.coinMax) - num(enemy.coinMin)));
  let item = null;
  if ((zone.lootItemIds || []).length && rng() <= num(enemy.lootChance)) {
    const definition = itemDef(catalog, pick(zone.lootItemIds, rng));
    if (definition) {
      const rarity = rarityRoll(rng, num(zone.tier), profile.consistency);
      const variance = Math.floor(rng() * 3);
      const power = num(definition.basePower) + num(zone.tier) + rarityBonus[rarity] + variance;
      item = {
        instanceId: `loot:${hashSeed(`${seed}:${encounterIndex}:${adventure.encounters}`)}`,
        itemId: definition.id,
        name: definition.name,
        slot: definition.slot,
        icon: definition.icon,
        rarity,
        power,
        obtainedAt: new Date().toISOString(),
        zoneId: zone.id
      };
    }
  }
  return { coins, item };
}

export function simulateExpedition({ appState = {}, adventure: rawAdventure = {}, catalog = {}, zoneId, seed = Date.now(), encounters } = {}) {
  let adventure = normalizeAdventureState(rawAdventure, catalog);
  const zone = (catalog.zones || []).find(item => item.id === (zoneId || adventure.selectedZoneId));
  if (!zone) return { adventure, error: 'unknown-zone', result: null };
  if (!zoneUnlocked(appState, adventure, zone, catalog)) return { adventure, error: 'zone-locked', result: null };
  if (availableEnergy(appState, adventure, catalog) <= 0) return { adventure, error: 'no-adventure-energy', result: null };

  const rng = seededRandom(seed);
  const profile = fitnessProfile(appState, adventure, catalog);
  const maxEncounters = Math.max(1, Math.min(5, num(encounters) || num(catalog.expeditionEncounters) || 3));
  const battles = [];
  const loot = [];
  let coinsEarned = 0;
  let wins = 0;
  let defeated = false;
  adventure.energySpent += 1;
  adventure.selectedZoneId = zone.id;
  adventure.zoneProgress[zone.id] = adventure.zoneProgress[zone.id] || { victories: 0, defeats: 0, bosses: 0 };

  for (let i = 0; i < maxEncounters; i += 1) {
    const enemy = enemyForEncounter(zone, adventure, catalog, rng);
    if (!enemy) break;
    const battle = fight(profile, enemy, rng);
    adventure.encounters += 1;
    adventure.bestiary[enemy.id] = num(adventure.bestiary[enemy.id]) + 1;
    battles.push({ enemyId: enemy.id, enemyName: enemy.name, boss: !!enemy.boss, ...battle });

    if (!battle.victory) {
      adventure.defeats += 1;
      adventure.zoneProgress[zone.id].defeats = num(adventure.zoneProgress[zone.id].defeats) + 1;
      defeated = true;
      break;
    }

    wins += 1;
    adventure.victories += 1;
    adventure.zoneProgress[zone.id].victories = num(adventure.zoneProgress[zone.id].victories) + 1;
    if (enemy.boss) adventure.zoneProgress[zone.id].bosses = num(adventure.zoneProgress[zone.id].bosses) + 1;
    const drop = createLoot(zone, enemy, profile, adventure, catalog, rng, seed, i);
    coinsEarned += drop.coins;
    if (drop.item) loot.push(drop.item);
  }

  adventure.coins += coinsEarned;
  adventure.inventory = [...loot, ...adventure.inventory].slice(0, 80);
  const result = {
    runId: `run:${hashSeed(`${seed}:${adventure.energySpent}`)}`,
    at: new Date().toISOString(),
    zoneId: zone.id,
    zoneName: zone.name,
    fitnessLevel: profile.level,
    wins,
    defeated,
    coinsEarned,
    loot,
    battles
  };
  adventure.lastResult = result;
  adventure.runs = [result, ...adventure.runs].slice(0, 30);
  return { adventure, result, error: null };
}

export function equipItem(rawAdventure = {}, instanceId, catalog = {}) {
  const adventure = normalizeAdventureState(rawAdventure, catalog);
  const item = adventure.inventory.find(candidate => candidate.instanceId === instanceId);
  if (!item || !['weapon', 'armor', 'charm'].includes(item.slot)) return adventure;
  adventure.equipped[item.slot] = item.instanceId;
  return adventure;
}

export function autoEquipBest(rawAdventure = {}, catalog = {}) {
  const adventure = normalizeAdventureState(rawAdventure, catalog);
  for (const slot of ['weapon', 'armor', 'charm']) {
    const best = adventure.inventory
      .filter(item => item.slot === slot)
      .sort((a, b) => num(b.power) - num(a.power) || rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity))[0];
    if (best) adventure.equipped[slot] = best.instanceId;
  }
  return adventure;
}

export function setAutoAdventure(rawAdventure = {}, enabled, now = Date.now(), catalog = {}) {
  const adventure = normalizeAdventureState(rawAdventure, catalog);
  adventure.autoEnabled = !!enabled;
  adventure.autoLastProcessedAt = new Date(now).toISOString();
  return adventure;
}

export function processAutoAdventure({ appState = {}, adventure: rawAdventure = {}, catalog = {}, now = Date.now() } = {}) {
  let adventure = normalizeAdventureState(rawAdventure, catalog);
  if (!adventure.autoEnabled) return { adventure, runs: [] };
  const previous = new Date(adventure.autoLastProcessedAt || now).getTime();
  const intervalMs = Math.max(15, num(catalog.autoIntervalMinutes) || 120) * 60000;
  const elapsed = Math.max(0, now - (Number.isFinite(previous) ? previous : now));
  const due = Math.floor(elapsed / intervalMs);
  const maxRuns = Math.max(0, num(catalog.maxOfflineRuns) || 6);
  const count = Math.min(due, maxRuns, availableEnergy(appState, adventure, catalog));
  const runs = [];
  for (let i = 0; i < count; i += 1) {
    const seed = `auto:${previous}:${i}:${adventure.energySpent}`;
    const simulated = simulateExpedition({ appState, adventure, catalog, zoneId: adventure.selectedZoneId, seed });
    adventure = simulated.adventure;
    if (simulated.result) runs.push(simulated.result);
    if (simulated.error) break;
  }
  adventure.autoLastProcessedAt = new Date(now).toISOString();
  return { adventure, runs };
}
