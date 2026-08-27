import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  defaultAdventureState, availableEnergy, unlockedZones, simulateExpedition,
  equipItem, autoEquipBest, processAutoAdventure, setAutoAdventure, fitnessProfile
} from '../adventure-core.mjs';

const catalog = JSON.parse(fs.readFileSync(new URL('../data/adventure_catalog.json', import.meta.url), 'utf8'));
const app = {
  totalXp: 600,
  attributes: { strength: 150, endurance: 100, consistency: 120, recovery: 80, nutrition: 60 }
};
let adventure = defaultAdventureState(catalog);
assert.equal(availableEnergy(app, adventure, catalog), 24);
assert.equal(unlockedZones(app, adventure, catalog)[0].unlocked, true);
assert.equal(unlockedZones(app, adventure, catalog)[1].unlocked, false);

const beforeXp = app.totalXp;
const first = simulateExpedition({ appState: app, adventure, catalog, zoneId: 'foundation_trail', seed: 'fixed-seed' });
const firstAgain = simulateExpedition({ appState: app, adventure, catalog, zoneId: 'foundation_trail', seed: 'fixed-seed' });
assert.equal(first.error, null);
assert.deepEqual(first.result.battles, firstAgain.result.battles);
assert.equal(app.totalXp, beforeXp, 'Adventure must not change Fitness XP.');
assert.equal(first.adventure.energySpent, 1);
assert.ok(first.result.battles.length >= 1);
adventure = first.adventure;

if (adventure.inventory.length) {
  const item = adventure.inventory[0];
  adventure = equipItem(adventure, item.instanceId, catalog);
  assert.equal(adventure.equipped[item.slot], item.instanceId);
  adventure = autoEquipBest(adventure, catalog);
}
assert.ok(fitnessProfile(app, adventure, catalog).maxHp > 0);

adventure = setAutoAdventure(adventure, true, Date.parse('2026-08-27T08:00:00Z'), catalog);
const auto = processAutoAdventure({ appState: app, adventure, catalog, now: Date.parse('2026-08-27T14:30:00Z') });
assert.equal(auto.runs.length, 3);
assert.equal(auto.adventure.energySpent, adventure.energySpent + 3);

const frequentOpen = setAutoAdventure(defaultAdventureState(catalog), true, Date.parse('2026-08-27T08:00:00Z'), catalog);
const oneHour = processAutoAdventure({ appState: app, adventure: frequentOpen, catalog, now: Date.parse('2026-08-27T09:00:00Z') });
assert.equal(oneHour.runs.length, 0);
assert.equal(oneHour.adventure.autoLastProcessedAt, frequentOpen.autoLastProcessedAt, 'Opening before the interval must not reset the auto-adventure clock.');
const twoHours = processAutoAdventure({ appState: app, adventure: oneHour.adventure, catalog, now: Date.parse('2026-08-27T10:00:00Z') });
assert.equal(twoHours.runs.length, 1, 'Elapsed time must accumulate across frequent app opens.');

console.log('Build 007 adventure tests passed.');
