import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  defaultAdventureState,
  normalizeAdventureState,
  availableEnergy,
  unlockedZones,
  capabilityProfile,
  fitnessProfile,
  zoneStageStatus,
  progressionStatus,
  simulateExpedition,
  equipItem,
  autoEquipBest,
  processAutoAdventure,
  setAutoAdventure
} from '../adventure-core.mjs';

const productionCatalog = JSON.parse(fs.readFileSync(new URL('../data/adventure_catalog.json', import.meta.url), 'utf8'));
assert.equal(productionCatalog.version, 2);
assert.equal(productionCatalog.stageCount, 4);
assert.equal(productionCatalog.stageVictories, 2);
assert.equal(productionCatalog.expeditionEncounters, 5);
assert.equal(productionCatalog.materials.length, 8);
for (const zone of productionCatalog.zones) {
  assert.equal(zone.clearVictories, 8);
  assert.equal(zone.stageCount, 4);
  assert.equal(zone.stageVictories, 2);
  assert(zone.materialIds.length >= 1);
}
for (const zone of productionCatalog.zones.slice(1)) {
  assert.equal(zone.requires.victories, 8, `${zone.id} must require the prior boss-clear victory total.`);
}

const app = {
  totalXp: 600,
  attributes: { strength: 150, endurance: 100, consistency: 120, recovery: 80, nutrition: 60 }
};
let adventure = defaultAdventureState(productionCatalog);
assert.equal(adventure.version, 2);
assert.equal(adventure.autoEnabled, true, 'New Adventure states should auto-advance by default.');
assert.deepEqual(adventure.materials, {});
assert.equal(availableEnergy(app, adventure, productionCatalog), 24);
assert.equal(unlockedZones(app, adventure, productionCatalog)[0].unlocked, true);
assert.equal(unlockedZones(app, adventure, productionCatalog)[1].unlocked, false);

const legacy = normalizeAdventureState({ version:1, autoEnabled:false, inventory:[] }, productionCatalog);
assert.equal(legacy.version, 2);
assert.equal(legacy.autoEnabled, false, 'An existing explicit auto-adventure preference must be preserved.');

const beforeXp = app.totalXp;
const first = simulateExpedition({ appState:app, adventure, catalog:productionCatalog, zoneId:'foundation_trail', seed:'fixed-seed', encounters:1 });
const firstAgain = simulateExpedition({ appState:app, adventure, catalog:productionCatalog, zoneId:'foundation_trail', seed:'fixed-seed', encounters:1 });
assert.equal(first.error, null);
assert.deepEqual(first.result.battles, firstAgain.result.battles, 'Seeded combat must remain deterministic.');
assert.equal(app.totalXp, beforeXp, 'Adventure must never change Fitness XP.');
assert.equal(first.adventure.energySpent, 1);
assert.ok(first.result.battles.length >= 1);
adventure = first.adventure;

if (adventure.inventory.length) {
  const item = adventure.inventory[0];
  adventure = equipItem(adventure, item.instanceId, productionCatalog);
  assert.equal(adventure.equipped[item.slot], item.instanceId);
  adventure = autoEquipBest(adventure, productionCatalog);
}
assert.ok(fitnessProfile(app, adventure, productionCatalog).maxHp > 0);

const testCatalog = {
  version:2,
  energyXpPerCharge:25,
  autoIntervalMinutes:60,
  maxOfflineRuns:6,
  expeditionEncounters:5,
  stageCount:2,
  stageVictories:1,
  zones:[
    {
      id:'z1', name:'Zone 1', tier:1, minFitnessLevel:1,
      stageCount:2, stageVictories:1, clearVictories:2, bossEveryVictories:2,
      enemyIds:['rat'], bossId:'boss', lootItemIds:['blade'], materialIds:['fiber']
    },
    {
      id:'z2', name:'Zone 2', tier:2, minFitnessLevel:3,
      requires:{zoneId:'z1',victories:2},
      stageCount:2, stageVictories:1, clearVictories:2, bossEveryVictories:2,
      enemyIds:['wolf'], bossId:'wolfboss', lootItemIds:['plate'], materialIds:['ore']
    }
  ],
  enemies:[
    {id:'rat',name:'Rat',hp:8,attack:1,defense:0,coinMin:1,coinMax:1,lootChance:1},
    {id:'boss',name:'Boss',boss:true,hp:12,attack:2,defense:0,coinMin:2,coinMax:2,lootChance:1},
    {id:'wolf',name:'Wolf',hp:10,attack:2,defense:0,coinMin:1,coinMax:1,lootChance:1},
    {id:'wolfboss',name:'Wolf Boss',boss:true,hp:14,attack:3,defense:0,coinMin:2,coinMax:2,lootChance:1}
  ],
  items:[
    {id:'blade',name:'Blade',slot:'weapon',basePower:30,icon:'W'},
    {id:'plate',name:'Plate',slot:'armor',basePower:30,icon:'A'}
  ],
  materials:[
    {id:'fiber',name:'Fiber',icon:'F'},
    {id:'ore',name:'Ore',icon:'O'}
  ]
};

const lowApp = { totalXp:50, attributes:{ strength:0, endurance:0, consistency:0, recovery:0, nutrition:0 } };
let geared = defaultAdventureState(testCatalog);
geared.inventory = [{ instanceId:'x', itemId:'blade', name:'Huge Blade', slot:'weapon', power:50, rarity:'epic' }];
geared.equipped.weapon = 'x';
const lowCapabilities = capabilityProfile(lowApp, geared, testCatalog);
assert.equal(lowCapabilities.rawGear.weapon, 50);
assert(lowCapabilities.gear.weapon < 50, 'Real fitness must cap effective gear power.');
assert(lowCapabilities.lockedGearPower > 0, 'Gear beyond the real-world ceiling must remain banked rather than silently applied.');

const strengthApp = { ...lowApp, attributes:{ ...lowApp.attributes, strength:250 } };
const enduranceApp = { ...lowApp, attributes:{ ...lowApp.attributes, endurance:250 } };
const consistencyApp = { ...lowApp, attributes:{ ...lowApp.attributes, consistency:250 } };
const recoveryApp = { ...lowApp, attributes:{ ...lowApp.attributes, recovery:250 } };
const nutritionApp = { ...lowApp, attributes:{ ...lowApp.attributes, nutrition:250 } };
assert(capabilityProfile(strengthApp, geared, testCatalog).gear.weapon > lowCapabilities.gear.weapon, 'Strength must raise the effective weapon ceiling.');
assert(fitnessProfile(enduranceApp, geared, testCatalog).encounterCapacity > fitnessProfile(lowApp, geared, testCatalog).encounterCapacity, 'Endurance must raise expedition capacity.');
assert(capabilityProfile(consistencyApp, geared, testCatalog).consistency.rarityInfluence > lowCapabilities.consistency.rarityInfluence, 'Consistency must influence the loot capability path.');
assert(fitnessProfile(recoveryApp, geared, testCatalog).betweenBattleHealFraction > fitnessProfile(lowApp, geared, testCatalog).betweenBattleHealFraction, 'Recovery must increase bounded between-battle healing.');
assert(fitnessProfile(nutritionApp, geared, testCatalog).materialFindBonus > fitnessProfile(lowApp, geared, testCatalog).materialFindBonus, 'Nutrition must increase material-find capability.');

const strongTestApp = { totalXp:500, attributes:{ strength:200, endurance:200, consistency:200, recovery:200, nutrition:200 } };
adventure = defaultAdventureState(testCatalog);
let run = simulateExpedition({ appState:strongTestApp, adventure, catalog:testCatalog, zoneId:'z1', seed:'carry', encounters:2 });
assert.equal(run.error, null);
assert(run.result.battles.length >= 1);
assert(Object.keys(run.result.materialsEarned).length >= 1, 'Victories must supply persistent materials.');
if (run.result.battles.length > 1) {
  assert.equal(run.result.battles[1].startingPlayerHp, run.result.battles[0].postRecoveryHp, 'HP must carry across encounters after bounded Recovery healing.');
  assert(run.result.battles[0].postRecoveryHp <= run.result.battles[0].playerMaxHp, 'Between-battle healing must not exceed max HP.');
}

const gateApp = { totalXp:50, attributes:{ strength:200, endurance:200, consistency:200, recovery:200, nutrition:200 } };
adventure = defaultAdventureState(testCatalog);
adventure.zoneProgress.z1 = { victories:1, defeats:0, bosses:0 };
run = simulateExpedition({ appState:gateApp, adventure, catalog:testCatalog, zoneId:'z1', seed:'boss-clear', encounters:5 });
assert.equal(run.error, null);
assert.equal(run.result.battles.length, 1, 'Clearing the boss must stop the current expedition instead of farming the cleared zone.');
assert.equal(run.adventure.zoneProgress.z1.victories, 2);
assert.equal(run.adventure.zoneProgress.z1.bosses, 1);
assert.equal(zoneStageStatus(testCatalog.zones[0], run.adventure, testCatalog).cleared, true);
assert.equal(run.adventure.progressionWall?.type, 'capability_gate');
assert.equal(run.adventure.progressionWall?.nextZoneId, 'z2');
assert.equal(progressionStatus(gateApp, run.adventure, testCatalog).wallActive, true);

const spentAtWall = run.adventure.energySpent;
const blocked = simulateExpedition({ appState:gateApp, adventure:run.adventure, catalog:testCatalog, seed:'retry' });
assert.equal(blocked.error, 'progression-wall');
assert.equal(blocked.adventure.energySpent, spentAtWall, 'An unchanged progression wall must consume zero additional Adventure Energy.');
assert.equal(gateApp.totalXp, 50, 'A progression wall must not mutate real Fitness XP.');

const upgradedApp = { ...gateApp, totalXp:250 };
const resumed = simulateExpedition({ appState:upgradedApp, adventure:run.adventure, catalog:testCatalog, seed:'resume', encounters:1 });
assert.equal(resumed.error, null, 'A real-world capability increase must allow the gate to be retried.');
assert.equal(resumed.result.zoneId, 'z2', 'A cleared zone should automatically advance into the next unlocked zone.');
assert.equal(resumed.adventure.selectedZoneId, 'z2');

let gatedAuto = setAutoAdventure(run.adventure, true, Date.parse('2026-08-27T08:00:00Z'), testCatalog);
const stopped = processAutoAdventure({ appState:gateApp, adventure:gatedAuto, catalog:testCatalog, now:Date.parse('2026-08-27T14:00:00Z') });
assert.equal(stopped.runs.length, 0, 'Auto-adventure must stop at an unchanged legitimate progression wall.');
assert.equal(stopped.adventure.energySpent, gatedAuto.energySpent, 'Auto-adventure must not burn energy against an unchanged wall.');

const cadenceCatalog = JSON.parse(JSON.stringify(testCatalog));
cadenceCatalog.expeditionEncounters = 1;
cadenceCatalog.zones[0].clearVictories = 100;
cadenceCatalog.zones[0].bossEveryVictories = 100;
cadenceCatalog.zones[1].requires.victories = 100;
const cadenceApp = { totalXp:1000, attributes:{ strength:300, endurance:300, consistency:300, recovery:300, nutrition:300 } };
const frequentOpen = setAutoAdventure(defaultAdventureState(cadenceCatalog), true, Date.parse('2026-08-27T08:00:00Z'), cadenceCatalog);
const thirtyMinutes = processAutoAdventure({ appState:cadenceApp, adventure:frequentOpen, catalog:cadenceCatalog, now:Date.parse('2026-08-27T08:30:00Z') });
assert.equal(thirtyMinutes.runs.length, 0);
assert.equal(thirtyMinutes.adventure.autoLastProcessedAt, frequentOpen.autoLastProcessedAt, 'Opening before the interval must not reset the auto clock.');
const oneHour = processAutoAdventure({ appState:cadenceApp, adventure:thirtyMinutes.adventure, catalog:cadenceCatalog, now:Date.parse('2026-08-27T09:00:00Z') });
assert.equal(oneHour.runs.length, 1, 'Elapsed time must accumulate across frequent app opens.');
const threeHours = processAutoAdventure({ appState:cadenceApp, adventure:oneHour.adventure, catalog:cadenceCatalog, now:Date.parse('2026-08-27T11:00:00Z') });
assert.equal(threeHours.runs.length, 2, 'Auto cadence must process each due interval without exceeding catch-up limits.');

console.log('Build 011 Adventure engine tests passed.');
