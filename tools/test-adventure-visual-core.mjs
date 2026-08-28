import assert from 'node:assert/strict';
import {
  enemyVisualKind, stagePathModel, encounterVisualModel, gearVisualModel, oddsLevers, rewardRevealModel
} from '../adventure-visual-core.mjs';

const catalog = {
  enemies:[
    {id:'moss_rat',name:'Moss Rat',stage:1,hp:44,attack:8,defense:2},
    {id:'stonebeak',name:'Stonebeak',stage:2,hp:52,attack:7,defense:4},
    {id:'gatewarden_boar',name:'Gatewarden Boar',stage:4,boss:true,hp:88,attack:12,defense:5}
  ],
  materials:[{id:'trail_fiber',name:'Trail Fiber',icon:'⌁'}]
};
const status = {
  zone:{id:'foundation_trail',name:'Foundation Trail',enemyIds:['moss_rat','stonebeak'],bossId:'gatewarden_boar'},
  stage:{stage:2,stageCount:4,winsPerStage:2,victories:3,clearVictories:8,bossDue:false,cleared:false},
  capabilities:{
    maxHp:100,
    lockedGearPower:3,
    gear:{weapon:5,armor:3,charm:2,total:10},
    strength:{level:3}, endurance:{level:2}, recovery:{level:2}
  },
  wall:null
};

assert.deepEqual(enemyVisualKind({id:'gatewarden_boar',boss:true}), {kind:'boss_beast',sigil:'♜'});
const path = stagePathModel(status);
assert.equal(path.length, 5);
assert.equal(path[0].completed, true);
assert.equal(path[1].current, true);
assert.equal(path.at(-1).type, 'boss');
assert.equal(path.at(-1).locked, true);

const expected = encounterVisualModel({status,adventure:{},catalog});
assert.equal(expected.source,'encounter_pool');
assert.equal(expected.name,'Stonebeak');
assert.equal(expected.outcome,'Threat ahead');
assert.equal(expected.enemyHpPercent,100);

const bossStatus = {...status,stage:{...status.stage,stage:4,victories:7,bossDue:true}};
assert.equal(encounterVisualModel({status:bossStatus,adventure:{},catalog}).name,'Gatewarden Boar');
assert.equal(encounterVisualModel({status:bossStatus,adventure:{},catalog}).outcome,'Boss ahead');

const adventure = {
  equipped:{weapon:'w1',armor:'a1',charm:null},
  inventory:[
    {instanceId:'w1',name:'Briar Blade',slot:'weapon',icon:'⚔',rarity:'rare',power:8},
    {instanceId:'a1',name:'Rootmail',slot:'armor',icon:'⬟',rarity:'uncommon',power:3}
  ],
  lastResult:{
    zoneId:'foundation_trail',coinsEarned:12,materialsEarned:{trail_fiber:2},loot:[{name:'Moss Charm',icon:'◆',rarity:'common',power:2,slot:'charm'}],
    battles:[{enemyId:'moss_rat',enemyName:'Moss Rat',stage:1,boss:false,victory:true,enemyHp:0,enemyMaxHp:44,playerHp:73,playerMaxHp:100,turns:5}]
  }
};
const battle = encounterVisualModel({status,adventure,catalog});
assert.equal(battle.source,'last_battle');
assert.equal(battle.outcome,'Victory');
assert.equal(battle.enemyHpPercent,0);
assert.equal(battle.playerHpPercent,73);

const gear = gearVisualModel(adventure,status,catalog);
assert.equal(gear[0].name,'Briar Blade');
assert.equal(gear[0].rawPower,8);
assert.equal(gear[0].effectivePower,5);
assert.equal(gear[0].lockedPower,3);
assert.equal(gear[2].equipped,false);

const odds = oddsLevers(status);
assert.equal(odds[0].key,'gear_ceiling');
assert.ok(odds[0].detail.includes('3 equipped gear power'));
const combatOdds = oddsLevers({...status,capabilities:{...status.capabilities,lockedGearPower:0},wall:{type:'combat_defeat'}});
assert.deepEqual(combatOdds.map(x=>x.key),['strength','recovery','endurance']);

const rewards = rewardRevealModel(adventure,catalog);
assert.equal(rewards.hasResult,true);
assert.equal(rewards.coins,12);
assert.equal(rewards.loot[0].name,'Moss Charm');
assert.equal(rewards.materials[0].name,'Trail Fiber');
assert.equal(rewards.materials[0].quantity,2);

console.log('Build 015 Adventure visual-core tests passed.');
