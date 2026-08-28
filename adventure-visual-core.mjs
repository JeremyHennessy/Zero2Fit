const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

const ENEMY_KIND = {
  moss_rat:'beast', bramble_sprite:'wisp', stonebeak:'beast', gatewarden_boar:'boss_beast',
  thorn_hound:'beast', hollow_wisp:'wisp', rootguard:'guardian', briar_stag:'boss_beast',
  ironback:'guardian', pass_raider:'humanoid', frost_moth:'moth', ironwood_colossus:'boss_guardian',
  cinder_fox:'beast', ash_knight:'humanoid', ridge_drake:'drake', ember_crowned_warden:'boss_humanoid'
};

const ENEMY_SIGIL = {
  beast:'◆', boss_beast:'♜', wisp:'✦', guardian:'⬢', boss_guardian:'⬣', humanoid:'⚔', boss_humanoid:'♛', moth:'✧', drake:'▲'
};

export function enemyVisualKind(enemy = {}) {
  const kind = ENEMY_KIND[enemy.id] || (enemy.boss ? 'boss_guardian' : 'guardian');
  return { kind, sigil:ENEMY_SIGIL[kind] || '◆' };
}

export function stagePathModel(status = {}) {
  const stage = status.stage || {};
  const stageCount = Math.max(1, num(stage.stageCount) || 4);
  const winsPerStage = Math.max(1, num(stage.winsPerStage) || 2);
  const victories = Math.max(0, num(stage.victories));
  const cleared = Boolean(stage.cleared);
  const currentStage = clamp(num(stage.stage) || 1, 1, stageCount);
  const nodes = Array.from({ length:stageCount }, (_, index) => {
    const stageNumber = index + 1;
    const threshold = Math.min(num(stage.clearVictories) || stageCount * winsPerStage, stageNumber * winsPerStage);
    const completed = cleared || victories >= threshold;
    return {
      type:'stage',
      stage:stageNumber,
      label:`Stage ${stageNumber}`,
      completed,
      current:!cleared && stageNumber === currentStage,
      locked:!completed && stageNumber > currentStage,
      threshold
    };
  });
  nodes.push({
    type:'boss',
    label:'Boss',
    completed:cleared,
    current:!cleared && Boolean(stage.bossDue),
    locked:!cleared && !stage.bossDue,
    threshold:num(stage.clearVictories) || stageCount * winsPerStage
  });
  return nodes;
}

function enemyById(catalog, id) {
  return (catalog?.enemies || []).find(enemy => enemy.id === id) || null;
}

function expectedEnemy(status, catalog) {
  const zone = status?.zone;
  const stage = status?.stage;
  if (!zone || !stage) return null;
  if (stage.bossDue && zone.bossId) return enemyById(catalog, zone.bossId);
  const stageNumber = num(stage.stage) || 1;
  const candidates = (zone.enemyIds || [])
    .map(id => enemyById(catalog, id))
    .filter(Boolean)
    .filter(enemy => !enemy.stage || num(enemy.stage) === stageNumber);
  const fallback = (zone.enemyIds || []).map(id => enemyById(catalog, id)).filter(Boolean);
  return candidates[0] || fallback[(stageNumber - 1) % Math.max(1, fallback.length)] || null;
}

export function encounterVisualModel({ status = {}, adventure = {}, catalog = {} } = {}) {
  const last = adventure?.lastResult;
  const lastBattle = last?.zoneId === status?.zone?.id && Array.isArray(last?.battles) ? last.battles.at(-1) : null;
  if (lastBattle) {
    const definition = enemyById(catalog, lastBattle.enemyId) || { id:lastBattle.enemyId, name:lastBattle.enemyName, boss:lastBattle.boss };
    const visual = enemyVisualKind(definition);
    const maxHp = Math.max(1, num(lastBattle.enemyMaxHp));
    const playerMaxHp = Math.max(1, num(lastBattle.playerMaxHp));
    return {
      source:'last_battle',
      id:definition.id,
      name:lastBattle.enemyName || definition.name || 'Unknown enemy',
      boss:Boolean(lastBattle.boss || definition.boss),
      stage:num(lastBattle.stage || last.stage || status?.stage?.stage),
      outcome:lastBattle.victory ? 'Victory' : 'Defeat',
      enemyHp:num(lastBattle.enemyHp),
      enemyMaxHp:maxHp,
      enemyHpPercent:clamp(Math.round(num(lastBattle.enemyHp) / maxHp * 100), 0, 100),
      playerHp:num(lastBattle.playerHp),
      playerMaxHp,
      playerHpPercent:clamp(Math.round(num(lastBattle.playerHp) / playerMaxHp * 100), 0, 100),
      turns:num(lastBattle.turns),
      ...visual
    };
  }
  const definition = expectedEnemy(status, catalog);
  if (!definition) return null;
  return {
    source:'encounter_pool',
    id:definition.id,
    name:definition.name,
    boss:Boolean(definition.boss),
    stage:num(definition.stage || status?.stage?.stage),
    outcome:status?.stage?.bossDue ? 'Boss ahead' : 'Threat ahead',
    enemyHp:num(definition.hp),
    enemyMaxHp:num(definition.hp),
    enemyHpPercent:100,
    playerHp:num(status?.capabilities?.maxHp),
    playerMaxHp:num(status?.capabilities?.maxHp),
    playerHpPercent:100,
    turns:0,
    ...enemyVisualKind(definition)
  };
}

export function gearVisualModel(adventure = {}, status = {}, catalog = {}) {
  const items = new Map((adventure.inventory || []).map(item => [item.instanceId, item]));
  const effective = status?.capabilities?.gear || {};
  const slots = ['weapon','armor','charm'];
  return slots.map(slot => {
    const item = items.get(adventure?.equipped?.[slot]);
    const rawPower = num(item?.power);
    const effectivePower = num(effective?.[slot]);
    return {
      slot,
      name:item?.name || 'Empty',
      icon:item?.icon || (slot === 'weapon' ? '⚔' : slot === 'armor' ? '⬟' : '◆'),
      rarity:item?.rarity || 'none',
      rawPower,
      effectivePower,
      lockedPower:Math.max(0, rawPower - effectivePower),
      equipped:Boolean(item)
    };
  });
}

export function oddsLevers(status = {}) {
  const wall = status.wall;
  const caps = status.capabilities || {};
  const rows = [];
  if (num(caps.lockedGearPower) > 0) {
    rows.push({
      key:'gear_ceiling',
      title:'Unlock equipped gear power',
      detail:`${num(caps.lockedGearPower)} equipped gear power is banked behind real-world capability ceilings.`,
      priority:100
    });
  }
  if (wall?.type === 'capability_gate') {
    for (const requirement of wall.requirements || []) {
      rows.push({
        key:`gate:${requirement.type}:${requirement.zoneId || ''}`,
        title:requirement.type === 'fitness_level' ? 'Raise Fitness level' : 'Clear the prior frontier',
        detail:requirement.type === 'fitness_level'
          ? `Current ${requirement.current}; next zone requires ${requirement.required}.`
          : `Current ${requirement.current} wins; ${requirement.required} are required.`,
        priority:110
      });
    }
  }
  if (wall?.type === 'combat_defeat') {
    rows.push(
      { key:'strength', title:'Strength → Attack', detail:`Strength Lv ${num(caps?.strength?.level)} directly raises attack and usable weapon power.`, priority:90 },
      { key:'endurance', title:'Endurance → HP', detail:`Endurance Lv ${num(caps?.endurance?.level)} raises maximum HP and expedition capacity.`, priority:80 },
      { key:'recovery', title:'Recovery → Defense + healing', detail:`Recovery Lv ${num(caps?.recovery?.level)} raises defense, between-battle healing and usable armor power.`, priority:85 }
    );
  }
  if (!rows.length) {
    rows.push(
      { key:'strength', title:'Strength', detail:`Lv ${num(caps?.strength?.level)} · improves attack and weapon ceiling.`, priority:50 },
      { key:'endurance', title:'Endurance', detail:`Lv ${num(caps?.endurance?.level)} · improves HP and encounter capacity.`, priority:45 },
      { key:'recovery', title:'Recovery', detail:`Lv ${num(caps?.recovery?.level)} · improves defense, healing and armor ceiling.`, priority:40 }
    );
  }
  return rows.sort((a,b) => b.priority - a.priority).slice(0, 3);
}

export function rewardRevealModel(adventure = {}, catalog = {}) {
  const result = adventure?.lastResult;
  if (!result) return { hasResult:false, coins:0, loot:[], materials:[] };
  const materialDefs = new Map((catalog.materials || []).map(item => [item.id, item]));
  return {
    hasResult:true,
    coins:num(result.coinsEarned),
    loot:(result.loot || []).map(item => ({
      name:item.name,
      icon:item.icon || '◆',
      rarity:item.rarity || 'common',
      power:num(item.power),
      slot:item.slot
    })),
    materials:Object.entries(result.materialsEarned || {}).filter(([, qty]) => num(qty) > 0).map(([id, qty]) => ({
      id,
      quantity:num(qty),
      name:materialDefs.get(id)?.name || id.replaceAll('_',' '),
      icon:materialDefs.get(id)?.icon || '◆'
    }))
  };
}
