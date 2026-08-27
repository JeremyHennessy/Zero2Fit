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
  if (!Array.isArray(list) || !list.length) return null;
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
    version: 2,
    selectedZoneId: catalog?.zones?.[0]?.id || 'foundation_trail',
    autoEnabled: true,
    autoLastProcessedAt: null,
    energySpent: 0,
    coins: 0,
    victories: 0,
    defeats: 0,
    encounters: 0,
    zoneProgress: {},
    inventory: [],
    equipped: { weapon: null, armor: null, charm: null },
    materials: {},
    bestiary: {},
    runs: [],
    lastResult: null,
    progressionWall: null
  };
}

export function normalizeAdventureState(value = {}, catalog = {}) {
  const defaults = defaultAdventureState(catalog);
  const merged = {
    ...defaults,
    ...(value || {}),
    version: 2,
    zoneProgress: { ...defaults.zoneProgress, ...(value?.zoneProgress || {}) },
    equipped: { ...defaults.equipped, ...(value?.equipped || {}) },
    materials: { ...defaults.materials, ...(value?.materials || {}) },
    bestiary: { ...defaults.bestiary, ...(value?.bestiary || {}) },
    inventory: Array.isArray(value?.inventory) ? value.inventory : [],
    runs: Array.isArray(value?.runs) ? value.runs : [],
    progressionWall: value?.progressionWall || null
  };
  if (Object.prototype.hasOwnProperty.call(value || {}, 'autoEnabled')) merged.autoEnabled = !!value.autoEnabled;
  if (!catalog?.zones?.some(zone => zone.id === merged.selectedZoneId)) merged.selectedZoneId = defaults.selectedZoneId;
  return merged;
}

export function availableEnergy(appState = {}, adventure = {}, catalog = {}) {
  const perCharge = Math.max(1, num(catalog.energyXpPerCharge) || 25);
  const earned = Math.floor(num(appState.totalXp) / perCharge);
  return Math.max(0, earned - num(adventure.energySpent));
}

export function unmetZoneRequirements(appState = {}, adventure = {}, zone = {}) {
  const missing = [];
  const level = fitnessLevel(appState);
  const requiredLevel = Math.max(1, num(zone.minFitnessLevel || 1));
  if (level < requiredLevel) missing.push({ type:'fitness_level', current:level, required:requiredLevel });
  if (zone.requires) {
    const prior = adventure?.zoneProgress?.[zone.requires.zoneId] || {};
    const current = num(prior.victories);
    const required = num(zone.requires.victories);
    if (current < required) missing.push({ type:'prior_victories', zoneId:zone.requires.zoneId, current, required });
  }
  return missing;
}

export function zoneUnlocked(appState = {}, adventure = {}, zone = {}) {
  return unmetZoneRequirements(appState, adventure, zone).length === 0;
}

export function unlockedZones(appState = {}, adventure = {}, catalog = {}) {
  return (catalog.zones || []).map(zone => ({ ...zone, unlocked: zoneUnlocked(appState, adventure, zone) }));
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

export function capabilityProfile(appState = {}, adventure = {}, catalog = {}) {
  const level = fitnessLevel(appState);
  const strength = statLevel(appState, 'strength');
  const endurance = statLevel(appState, 'endurance');
  const consistency = statLevel(appState, 'consistency');
  const recovery = statLevel(appState, 'recovery');
  const nutrition = statLevel(appState, 'nutrition');
  const rawGear = equippedBonuses(adventure);
  const gearCaps = {
    weapon: 3 + level + strength * 3,
    armor: 3 + level + recovery * 3,
    charm: 2 + level + consistency + nutrition * 2
  };
  const gear = {
    weapon: Math.min(rawGear.weapon, gearCaps.weapon),
    armor: Math.min(rawGear.armor, gearCaps.armor),
    charm: Math.min(rawGear.charm, gearCaps.charm)
  };
  gear.total = gear.weapon + gear.armor + gear.charm;
  const lockedGearPower = Math.max(0, rawGear.total - gear.total);
  return {
    level,
    strength: { level:strength, attackBonus:strength * 3, weaponPowerCap:gearCaps.weapon },
    endurance: { level:endurance, hpBonus:endurance * 8, encounterCapacity:clamp(3 + Math.floor((endurance - 1) / 2), 3, 5) },
    consistency: { level:consistency, defenseBonus:consistency, rarityInfluence:consistency, charmCapContribution:consistency },
    recovery: {
      level:recovery,
      defenseBonus:recovery * 2,
      armorPowerCap:gearCaps.armor,
      betweenBattleHealFraction:clamp(0.035 + recovery * 0.014 + nutrition * 0.006, 0.05, 0.26)
    },
    nutrition: {
      level:nutrition,
      critContribution:nutrition * 0.003,
      materialFindBonus:clamp((nutrition - 1) * 0.035 + (consistency - 1) * 0.015, 0, 0.3),
      charmPowerCap:gearCaps.charm
    },
    gear,
    rawGear,
    gearCaps,
    lockedGearPower
  };
}

export function fitnessProfile(appState = {}, adventure = {}, catalog = {}) {
  const capabilities = capabilityProfile(appState, adventure, catalog);
  const { level } = capabilities;
  const strength = capabilities.strength.level;
  const endurance = capabilities.endurance.level;
  const consistency = capabilities.consistency.level;
  const recovery = capabilities.recovery.level;
  const nutrition = capabilities.nutrition.level;
  const gear = capabilities.gear;
  return {
    level,
    strength,
    endurance,
    consistency,
    recovery,
    nutrition,
    maxHp: 68 + level * 7 + capabilities.endurance.hpBonus + recovery * 5 + gear.charm * 2,
    attack: 7 + level * 2 + capabilities.strength.attackBonus + gear.weapon,
    defense: 3 + level + capabilities.recovery.defenseBonus + capabilities.consistency.defenseBonus + gear.armor,
    critChance: clamp(0.04 + endurance * 0.006 + capabilities.nutrition.critContribution, 0.04, 0.18),
    evadeChance: clamp(0.02 + endurance * 0.004 + consistency * 0.002, 0.02, 0.13),
    encounterCapacity: capabilities.endurance.encounterCapacity,
    betweenBattleHealFraction: capabilities.recovery.betweenBattleHealFraction,
    materialFindBonus: capabilities.nutrition.materialFindBonus,
    gear,
    rawGear: capabilities.rawGear,
    gearCaps: capabilities.gearCaps,
    lockedGearPower: capabilities.lockedGearPower,
    capabilities
  };
}

export function capabilitySignature(appState = {}, adventure = {}, catalog = {}) {
  const profile = fitnessProfile(appState, adventure, catalog);
  return JSON.stringify({
    totalXp:num(appState.totalXp),
    attributes:{
      strength:num(appState?.attributes?.strength),
      endurance:num(appState?.attributes?.endurance),
      consistency:num(appState?.attributes?.consistency),
      recovery:num(appState?.attributes?.recovery),
      nutrition:num(appState?.attributes?.nutrition)
    },
    equipped:{ ...(adventure?.equipped || {}) },
    effectiveGear:profile.gear
  });
}

export function zoneStageStatus(zone = {}, adventure = {}, catalog = {}) {
  const progress = adventure?.zoneProgress?.[zone.id] || {};
  const victories = num(progress.victories);
  const bosses = num(progress.bosses);
  const stageCount = Math.max(1, num(zone.stageCount || catalog.stageCount) || 4);
  const stageVictories = Math.max(1, num(zone.stageVictories || catalog.stageVictories) || 2);
  const bossEvery = Math.max(1, num(zone.bossEveryVictories) || stageCount * stageVictories);
  const clearVictories = Math.max(bossEvery, num(zone.clearVictories) || bossEvery);
  const cleared = bosses > 0 && victories >= clearVictories;
  const preBossVictories = victories % bossEvery;
  const stage = cleared ? stageCount : Math.min(stageCount, Math.floor(preBossVictories / stageVictories) + 1);
  const stageStart = (stage - 1) * stageVictories;
  const stageProgress = cleared ? stageVictories : Math.max(0, preBossVictories - stageStart);
  const bossDue = !cleared && victories > 0 && victories % bossEvery === bossEvery - 1;
  return { zoneId:zone.id, victories, bosses, stage, stageCount, stageVictories, stageProgress, bossDue, clearVictories, cleared };
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
  const status = zoneStageStatus(zone, adventure, catalog);
  const id = status.bossDue && zone.bossId ? zone.bossId : pick(zone.enemyIds || [], rng);
  const definition = (catalog.enemies || []).find(enemy => enemy.id === id) || null;
  if (!definition) return null;
  const stageScale = 1 + Math.max(0, status.stage - 1) * 0.08;
  const bossScale = definition.boss ? 1.05 : 1;
  return {
    ...definition,
    hp: Math.round(num(definition.hp) * stageScale * bossScale),
    attack: Math.round(num(definition.attack) * (1 + Math.max(0, status.stage - 1) * 0.055) * bossScale),
    defense: Math.round(num(definition.defense) * (1 + Math.max(0, status.stage - 1) * 0.05)),
    stage: status.stage
  };
}

function fight(profile, enemy, rng, startingHp = profile.maxHp) {
  let playerHp = clamp(num(startingHp), 1, profile.maxHp);
  const initialPlayerHp = playerHp;
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
    startingPlayerHp:initialPlayerHp,
    playerHp,
    playerMaxHp:profile.maxHp,
    enemyHp,
    enemyMaxHp:num(enemy.hp),
    playerDamage,
    enemyDamage,
    crits,
    evades,
    log
  };
}

function itemDef(catalog, itemId) { return (catalog.items || []).find(item => item.id === itemId) || null; }
function materialDef(catalog, materialId) { return (catalog.materials || []).find(item => item.id === materialId) || null; }

function createRewards(zone, enemy, profile, adventure, catalog, rng, seed, encounterIndex) {
  const coins = Math.round(num(enemy.coinMin) + rng() * Math.max(0, num(enemy.coinMax) - num(enemy.coinMin)));
  let item = null;
  if ((zone.lootItemIds || []).length && rng() <= num(enemy.lootChance)) {
    const definition = itemDef(catalog, pick(zone.lootItemIds, rng));
    if (definition) {
      const rarity = rarityRoll(rng, num(zone.tier), profile.consistency);
      const variance = Math.floor(rng() * 3);
      const power = num(definition.basePower) + num(zone.tier) + rarityBonus[rarity] + variance;
      item = {
        instanceId:`loot:${hashSeed(`${seed}:${encounterIndex}:${adventure.encounters}`)}`,
        itemId:definition.id,
        name:definition.name,
        slot:definition.slot,
        icon:definition.icon,
        rarity,
        power,
        obtainedAt:new Date().toISOString(),
        zoneId:zone.id
      };
    }
  }
  const materials = {};
  if ((zone.materialIds || []).length) {
    const materialId = pick(zone.materialIds, rng);
    const definition = materialDef(catalog, materialId);
    if (definition) {
      let quantity = enemy.boss ? 3 : 1;
      if (rng() < profile.materialFindBonus) quantity += 1;
      materials[materialId] = quantity;
    }
  }
  return { coins, item, materials };
}

function addMaterials(adventure, rewards = {}) {
  adventure.materials ||= {};
  for (const [materialId, quantity] of Object.entries(rewards)) {
    adventure.materials[materialId] = num(adventure.materials[materialId]) + num(quantity);
  }
}

function makeProgressionWall(type, details, appState, adventure, catalog) {
  return { type, ...details, capabilitySignature:capabilitySignature(appState, adventure, catalog), at:new Date().toISOString() };
}

function wallStillApplies(wall, appState, adventure, catalog) {
  if (!wall) return false;
  if (wall.type === 'content_complete') return true;
  return wall.capabilitySignature === capabilitySignature(appState, adventure, catalog);
}

function advanceAfterClear(appState, adventure, catalog, zone) {
  const status = zoneStageStatus(zone, adventure, catalog);
  if (!status.cleared) return { adventure, advancedTo:null, wall:null };
  const zones = catalog.zones || [];
  const index = zones.findIndex(item => item.id === zone.id);
  const next = index >= 0 ? zones[index + 1] : null;
  if (!next) {
    const wall = makeProgressionWall('content_complete', { zoneId:zone.id, stage:status.stage, message:'Current frontier arc cleared.' }, appState, adventure, catalog);
    adventure.progressionWall = wall;
    return { adventure, advancedTo:null, wall };
  }
  const missing = unmetZoneRequirements(appState, adventure, next);
  if (missing.length) {
    const wall = makeProgressionWall('capability_gate', { zoneId:zone.id, nextZoneId:next.id, requirements:missing }, appState, adventure, catalog);
    adventure.progressionWall = wall;
    return { adventure, advancedTo:null, wall };
  }
  adventure.selectedZoneId = next.id;
  adventure.progressionWall = null;
  return { adventure, advancedTo:next.id, wall:null };
}

export function simulateExpedition({ appState = {}, adventure: rawAdventure = {}, catalog = {}, zoneId, seed = Date.now(), encounters } = {}) {
  let adventure = normalizeAdventureState(rawAdventure, catalog);
  if (adventure.progressionWall && wallStillApplies(adventure.progressionWall, appState, adventure, catalog)) {
    return { adventure, error:'progression-wall', result:null };
  }
  if (adventure.progressionWall) adventure.progressionWall = null;

  let requestedZoneId = zoneId || adventure.selectedZoneId;
  const requestedZone = (catalog.zones || []).find(item => item.id === requestedZoneId);
  if (requestedZone && zoneStageStatus(requestedZone, adventure, catalog).cleared) {
    const advanced = advanceAfterClear(appState, adventure, catalog, requestedZone);
    adventure = advanced.adventure;
    if (advanced.wall) return { adventure, error:'progression-wall', result:null };
    if (advanced.advancedTo) requestedZoneId = advanced.advancedTo;
  }

  const zone = (catalog.zones || []).find(item => item.id === requestedZoneId);
  if (!zone) return { adventure, error:'unknown-zone', result:null };
  if (!zoneUnlocked(appState, adventure, zone)) return { adventure, error:'zone-locked', result:null };
  if (availableEnergy(appState, adventure, catalog) <= 0) return { adventure, error:'no-adventure-energy', result:null };

  const rng = seededRandom(seed);
  let profile = fitnessProfile(appState, adventure, catalog);
  const requested = Math.max(1, Math.min(5, num(encounters) || num(catalog.expeditionEncounters) || 3));
  const maxEncounters = Math.min(requested, profile.encounterCapacity);
  const battles = [];
  const loot = [];
  const materialsEarned = {};
  let coinsEarned = 0;
  let wins = 0;
  let defeated = false;
  let currentHp = profile.maxHp;
  adventure.energySpent += 1;
  adventure.selectedZoneId = zone.id;
  adventure.zoneProgress[zone.id] = adventure.zoneProgress[zone.id] || { victories:0, defeats:0, bosses:0 };

  for (let i = 0; i < maxEncounters; i += 1) {
    profile = fitnessProfile(appState, adventure, catalog);
    currentHp = Math.min(currentHp, profile.maxHp);
    const enemy = enemyForEncounter(zone, adventure, catalog, rng);
    if (!enemy) break;
    const battle = fight(profile, enemy, rng, currentHp);
    battle.stage = enemy.stage;
    adventure.encounters += 1;
    adventure.bestiary[enemy.id] = num(adventure.bestiary[enemy.id]) + 1;

    if (!battle.victory) {
      adventure.defeats += 1;
      adventure.zoneProgress[zone.id].defeats = num(adventure.zoneProgress[zone.id].defeats) + 1;
      defeated = true;
      adventure.progressionWall = makeProgressionWall('combat_defeat', {
        zoneId:zone.id,
        stage:enemy.stage,
        enemyId:enemy.id,
        enemyName:enemy.name,
        playerRating:Math.round(profile.attack + profile.defense + profile.maxHp / 10),
        enemyRating:Math.round(num(enemy.attack) + num(enemy.defense) + num(enemy.hp) / 10)
      }, appState, adventure, catalog);
      battles.push(battle);
      break;
    }

    wins += 1;
    adventure.victories += 1;
    adventure.zoneProgress[zone.id].victories = num(adventure.zoneProgress[zone.id].victories) + 1;
    if (enemy.boss) adventure.zoneProgress[zone.id].bosses = num(adventure.zoneProgress[zone.id].bosses) + 1;
    const rewards = createRewards(zone, enemy, profile, adventure, catalog, rng, seed, i);
    coinsEarned += rewards.coins;
    if (rewards.item) {
      loot.push(rewards.item);
      adventure.inventory = [rewards.item, ...adventure.inventory].slice(0, 80);
      adventure = autoEquipBest(adventure, catalog);
    }
    addMaterials(adventure, rewards.materials);
    for (const [materialId, quantity] of Object.entries(rewards.materials)) {
      materialsEarned[materialId] = num(materialsEarned[materialId]) + num(quantity);
    }

    profile = fitnessProfile(appState, adventure, catalog);
    const heal = i < maxEncounters - 1 ? Math.round(profile.maxHp * profile.betweenBattleHealFraction) : 0;
    battle.recoveryHeal = heal;
    currentHp = Math.min(profile.maxHp, battle.playerHp + heal);
    battle.postRecoveryHp = currentHp;
    battles.push(battle);
  }

  adventure.coins += coinsEarned;
  const result = {
    runId:`run:${hashSeed(`${seed}:${adventure.energySpent}`)}`,
    at:new Date().toISOString(),
    zoneId:zone.id,
    zoneName:zone.name,
    stage:zoneStageStatus(zone, adventure, catalog).stage,
    fitnessLevel:profile.level,
    wins,
    defeated,
    coinsEarned,
    loot,
    materialsEarned,
    battles,
    advancedToZoneId:null,
    progressionWall:adventure.progressionWall
  };

  if (!defeated) {
    const advanced = advanceAfterClear(appState, adventure, catalog, zone);
    adventure = advanced.adventure;
    result.advancedToZoneId = advanced.advancedTo;
    result.progressionWall = advanced.wall;
  }

  adventure.lastResult = result;
  adventure.runs = [result, ...adventure.runs].slice(0, 50);
  return { adventure, result, error:null };
}

export function equipItem(rawAdventure = {}, instanceId, catalog = {}) {
  const adventure = normalizeAdventureState(rawAdventure, catalog);
  const item = adventure.inventory.find(candidate => candidate.instanceId === instanceId);
  if (!item || !['weapon', 'armor', 'charm'].includes(item.slot)) return adventure;
  adventure.equipped[item.slot] = item.instanceId;
  adventure.progressionWall = null;
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

export function progressionStatus(appState = {}, rawAdventure = {}, catalog = {}) {
  const adventure = normalizeAdventureState(rawAdventure, catalog);
  const zone = (catalog.zones || []).find(item => item.id === adventure.selectedZoneId) || catalog.zones?.[0] || null;
  const stage = zone ? zoneStageStatus(zone, adventure, catalog) : null;
  const wall = adventure.progressionWall;
  return {
    zone,
    stage,
    wall,
    wallActive:wallStillApplies(wall, appState, adventure, catalog),
    capabilities:capabilityProfile(appState, adventure, catalog),
    availableEnergy:availableEnergy(appState, adventure, catalog)
  };
}

export function processAutoAdventure({ appState = {}, adventure: rawAdventure = {}, catalog = {}, now = Date.now() } = {}) {
  let adventure = normalizeAdventureState(rawAdventure, catalog);
  if (!adventure.autoEnabled) return { adventure, runs:[], wall:adventure.progressionWall };
  if (adventure.progressionWall && wallStillApplies(adventure.progressionWall, appState, adventure, catalog)) {
    return { adventure, runs:[], wall:adventure.progressionWall };
  }
  if (adventure.progressionWall && adventure.progressionWall.type !== 'content_complete') adventure.progressionWall = null;

  const previous = new Date(adventure.autoLastProcessedAt || now).getTime();
  const intervalMs = Math.max(15, num(catalog.autoIntervalMinutes) || 120) * 60000;
  const elapsed = Math.max(0, now - (Number.isFinite(previous) ? previous : now));
  const due = Math.floor(elapsed / intervalMs);
  const maxRuns = Math.max(0, num(catalog.maxOfflineRuns) || 6);
  const count = Math.min(due, maxRuns, availableEnergy(appState, adventure, catalog));
  const runs = [];
  for (let i = 0; i < count; i += 1) {
    const seed = `auto:${previous}:${i}:${adventure.energySpent}`;
    const simulated = simulateExpedition({ appState, adventure, catalog, zoneId:adventure.selectedZoneId, seed });
    adventure = simulated.adventure;
    if (simulated.result) runs.push(simulated.result);
    if (simulated.error || simulated.result?.defeated || adventure.progressionWall) break;
  }
  if (runs.length > 0) adventure.autoLastProcessedAt = new Date(previous + runs.length * intervalMs).toISOString();
  return { adventure, runs, wall:adventure.progressionWall };
}
