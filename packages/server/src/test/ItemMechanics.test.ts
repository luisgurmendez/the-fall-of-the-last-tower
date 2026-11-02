/**
 * The item mechanics added with the big catalog (config/items.ts): crits,
 * penetration, Wounds, omnivamp, burns, armor shred, executes, spell
 * shields, tenacity, heal and shield power, stacking items, assists, and
 * actives and consumables (ChampionItemActives).
 */

import { describe, test, expect, afterEach } from 'bun:test';
import {
  CHAMPION_DEFINITIONS,
  GameEventType,
  InputType,
  TEAM_BLUE,
  Vector,
  calculateMagicDamage,
  calculatePhysicalDamage,
  type ItemSlot,
} from '@siege/shared';
import { createTestArena, TestChampion } from './ServerTestUtils';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from '../game/ServerGameContext';

function give(champion: ServerChampion, itemId: string, slot = 0, extra: { charges?: number; stacks?: number } = {}): void {
  champion.items[slot] = {
    definitionId: itemId,
    slot: slot as ItemSlot,
    passiveCooldowns: {},
    nextIntervalTick: {},
    ...extra,
  };
  champion.invalidateStats();
  // Refreshes its max health, as every tick does
  champion.getStats();
}

function meleeArena() {
  return createTestArena({ learnAbilities: true, bluePosition: new Vector(0, 0), redPosition: new Vector(60, 0) });
}

/** An ally for blue, added to the arena */
function addAlly(context: ServerGameContext, id: string, position: Vector): TestChampion {
  const ally = new TestChampion({ id, position, side: TEAM_BLUE, playerId: `player-${id}`, definition: CHAMPION_DEFINITIONS['warrior'] });
  context.addChampion(ally, `player-${id}`);
  return ally;
}

const random = Math.random;
afterEach(() => { Math.random = random; });

/** Damage blue's first real basic attack deals red, and whether it was a crit */
function firstBasicAttack(arena: ReturnType<typeof meleeArena>): { dealt: number; crit: boolean } {
  const { blue, red, context } = arena;
  red.health = red.maxHealth;
  let dealt = 0;
  blue.setAttackTarget(red.id);
  // Its health regenerates a little meanwhile: wait for a real hit
  for (let i = 0; i < 120 && dealt <= 1; i++) {
    const before = red.health;
    arena.tick(1 / 60);
    dealt = before - red.health;
  }
  const event = context.flushEvents().find(e => e.type === GameEventType.DAMAGE && e.data.entityId === red.id);
  return { dealt, crit: event?.data.crit === true };
}

describe('Crits', () => {
  test('a critical strike deals crit damage, and shows as one', () => {
    const noCrit = meleeArena();
    give(noCrit.blue, 'kingsglass_bow');
    Math.random = () => 0.99;
    const normal = firstBasicAttack(noCrit);

    const crit = meleeArena();
    give(crit.blue, 'kingsglass_bow');
    Math.random = () => 0;
    const critical = firstBasicAttack(crit);

    expect(normal.crit).toBe(false);
    expect(critical.crit).toBe(true);
    // Base crit damage 2.0, Kingsglass adds 0.35
    expect(critical.dealt / normal.dealt).toBeCloseTo(2.35, 1);
  });

  test('Chill Shell takes a quarter off critical strikes', () => {
    const noCrit = meleeArena();
    give(noCrit.blue, 'kingsglass_bow');
    give(noCrit.red, 'frostguard_plate');
    Math.random = () => 0.99;
    const normal = firstBasicAttack(noCrit);

    const crit = meleeArena();
    give(crit.blue, 'kingsglass_bow');
    give(crit.red, 'frostguard_plate');
    Math.random = () => 0;
    const critical = firstBasicAttack(crit);

    expect(critical.dealt / normal.dealt).toBeCloseTo(2.35 * 0.75, 1);
  });
});

describe('Penetration', () => {
  test('lethality ignores flat armor, Voidpierce a share of magic resist', () => {
    const { blue, red, context } = meleeArena();
    const armor = red.getStats().armor;
    const magicResist = red.getStats().magicResist;

    give(blue, 'nightglass_edge');
    red.health = red.maxHealth;
    red.takeDamage(100, 'physical', blue.id, context);
    expect(red.maxHealth - red.health).toBeCloseTo(calculatePhysicalDamage(100, armor, 18), 5);

    give(blue, 'voidpierce_staff');
    red.health = red.maxHealth;
    red.takeDamage(100, 'magic', blue.id, context);
    expect(red.maxHealth - red.health).toBeCloseTo(calculateMagicDamage(100, magicResist, 0, 0.35), 5);
  });
});

describe('Healing and Wounds', () => {
  test('Bramblehook: physical damage inflicts Wounds, and wounded champions heal 40% less', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'bramblehook');
    red.takeDamage(10, 'magic', blue.id, context);
    expect(red.hasEffect('wounds')).toBe(false);
    red.takeDamage(10, 'physical', blue.id, context);
    expect(red.hasEffect('wounds')).toBe(true);

    red.health = 100;
    expect(red.heal(100, context, red.id)).toBeCloseTo(60, 5);
  });

  test('omnivamp heals for damage dealt, doubled by Bloodlust at low health', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'wolfsbane_fang');
    red.health = red.maxHealth;
    blue.health = blue.maxHealth * 0.8;
    let before = blue.health;
    red.takeDamage(200, 'true', blue.id, context);
    expect(blue.health - before).toBeCloseTo(20, 5);

    blue.health = blue.maxHealth * 0.3;
    before = blue.health;
    red.takeDamage(200, 'true', blue.id, context);
    expect(blue.health - before).toBeCloseTo(40, 5);
  });

  test('Overfed: lifesteal past max health becomes a shield, up to its cap', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'crimson_fang');
    blue.health = blue.maxHealth;
    blue.itemPassives.onBasicAttackHit(red, 1000, context);
    const shield = blue.shields.find(s => s.sourceId === 'item_overfed');
    expect(shield?.amount).toBe(60 + 8 * blue.level);
  });

  test('heal and shield power, Hymn and Renewal: healing an ally', () => {
    const { blue, context } = meleeArena();
    give(blue, 'dawnsong_censer', 0);
    give(blue, 'tidemother_chalice', 1);
    const ally = addAlly(context, 'ally', new Vector(0, 100));
    const other = addAlly(context, 'other', new Vector(0, -100));
    ally.health = 100;
    other.health = 200;

    // Dawnsong 12% + Tidemother 15%
    const healed = ally.heal(100, context, blue.id);
    expect(healed).toBeCloseTo(127, 5);
    expect(ally.hasEffect('item_hymn')).toBe(true);
    expect(blue.hasEffect('item_hymn')).toBe(true);
    // Renewal: 30% of the heal, itself raised by heal power, to the other ally
    expect(other.health).toBeCloseTo(200 + healed * 0.3 * 1.27, 3);
  });

  test('Verdant: heals and shields received are 25% stronger', () => {
    const { red, context } = meleeArena();
    give(red, 'grovekeepers_bark');
    red.health = 100;
    expect(red.heal(100, context, red.id)).toBeCloseTo(125, 5);
    expect(red.grantShield(100, 2, 'test')).toBeCloseTo(125, 5);
  });
});

describe('Ability damage', () => {
  test('Emberheart Codex burns champions hurt by abilities, not by basic attacks', () => {
    const arena = meleeArena();
    const { blue, red, context } = arena;
    give(blue, 'emberheart_codex');
    blue.withDamageKind('basic', () => red.takeDamage(10, 'physical', blue.id, context));
    expect(red.hasEffect('item_burn')).toBe(false);

    red.takeDamage(10, 'magic', blue.id, context);
    expect(red.hasEffect('item_burn')).toBe(true);
    const before = red.health;
    for (let i = 0; i < 4; i++) blue.itemPassives.update(1, context);
    expect(red.health).toBeLessThan(before);
  });

  test('Rime slows, and Sunder strips armor up to 6 stacks', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'frostwyrm_scepter', 0);
    give(blue, 'sundering_axe', 1);
    const armor = red.getStats().armor;
    red.takeDamage(10, 'magic', blue.id, context);
    expect(red.hasEffect('slow_25')).toBe(true);
    for (let i = 0; i < 8; i++) red.takeDamage(10, 'physical', blue.id, context);
    expect(red.getEffect('item_sunder')?.stacks).toBe(6);
    expect(red.getStats().armor).toBeCloseTo(armor * Math.pow(0.95, 6), 5);
  });
});

describe('Damage dealt and taken', () => {
  test('Execution: 12% more to champions below 35% health', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'nightglass_edge');
    red.health = red.maxHealth * 0.5;
    let before = red.health;
    red.takeDamage(100, 'true', blue.id, context);
    expect(before - red.health).toBeCloseTo(100, 5);
    red.health = red.maxHealth * 0.3;
    before = red.health;
    red.takeDamage(100, 'true', blue.id, context);
    expect(before - red.health).toBeCloseTo(112, 5);
  });

  test('Giantslayer: more damage to champions with more max health', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'wyrmslayer_arbalest');
    give(red, 'mountainheart');
    const difference = red.maxHealth - blue.maxHealth;
    red.health = red.maxHealth;
    red.takeDamage(100, 'true', blue.id, context);
    expect(red.maxHealth - red.health).toBeCloseTo(100 * (1 + Math.min(0.15, difference / 100 * 0.01)), 5);
  });

  test('Veil blocks an enemy champion\'s ability, then recharges', () => {
    const { blue, red, context } = meleeArena();
    give(red, 'stormward_veil');
    red.health = red.maxHealth;
    expect(red.takeDamage(100, 'magic', blue.id, context)).toBe(0);
    expect(red.takeDamage(100, 'magic', blue.id, context)).toBeGreaterThan(0);
    // Basic attacks aren't blocked; after 40 seconds it's ready again
    red.itemPassives.update(41, context);
    expect(blue.withDamageKind('basic', () => red.takeDamage(100, 'physical', blue.id, context))).toBeGreaterThan(0);
    expect(red.takeDamage(100, 'magic', blue.id, context)).toBe(0);
  });

  test('Bark and Hobnails lower basic attacks', () => {
    const { blue, red, context } = meleeArena();
    give(red, 'oakbark_buckler', 0);
    give(red, 'ironshod_boots', 1);
    red.health = red.maxHealth;
    blue.withDamageKind('basic', () => red.takeDamage(100, 'true', blue.id, context));
    expect(red.maxHealth - red.health).toBeCloseTo((100 - 6) * 0.9, 5);
  });

  test('Triple Volley: every third basic attack deals bonus damage', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'thunder_repeater');
    red.health = red.maxHealth;
    blue.itemPassives.onBasicAttackHit(red, 0, context);
    blue.itemPassives.onBasicAttackHit(red, 0, context);
    expect(red.health).toBe(red.maxHealth);
    blue.itemPassives.onBasicAttackHit(red, 0, context);
    expect(red.health).toBeLessThan(red.maxHealth);
  });

  test('Static: attacks charge it; full, the next attack also hits enemies near the target', () => {
    const arena = meleeArena();
    const { blue, red, context } = arena;
    give(blue, 'stormstring');
    const minion = arena.addMinion(1, new Vector(100, 0), 'melee');
    for (let i = 0; i < 9; i++) blue.itemPassives.onBasicAttackHit(red, 0, context);
    expect(blue.hasEffect('item_static')).toBe(true);
    const before = minion.health;
    blue.itemPassives.onBasicAttackHit(red, 0, context);
    expect(minion.health).toBeLessThan(before);
    expect(blue.hasEffect('item_static')).toBe(false);
  });

  test('Tithe: gold for hitting champions, three charges', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'pilgrim_lantern');
    blue.itemPassives.update(0.01, context);
    const gold = blue.gold;
    for (let i = 0; i < 4; i++) red.takeDamage(5, 'magic', blue.id, context);
    expect(blue.gold - gold).toBe(45);
  });
});

describe('Tenacity', () => {
  test('Mystic Treads shorten crowd control from enemies, not displacements', () => {
    const { blue, red } = meleeArena();
    give(red, 'mystic_treads');
    red.applyEffect('stun', 2, blue.id);
    expect(red.getEffect('stun')?.timeRemaining).toBeCloseTo(1.4, 5);
    red.applyEffect('knockup', 1, blue.id);
    expect(red.getEffect('knockup')?.timeRemaining).toBeCloseTo(1, 5);
  });
});

describe('Stacking items and assists', () => {
  test('Soulbinder Tome: takedowns add ability power; dying loses a third', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'soulbinder_tome');
    const ap = blue.getStats().abilityPower;
    for (let i = 0; i < 3; i++) blue.itemPassives.onTakedown(red, context);
    expect(blue.items[0]?.stacks).toBe(3);
    expect(blue.getStats().abilityPower).toBeCloseTo(ap + 15, 5);
    blue.itemPassives.onDeath();
    expect(blue.items[0]?.stacks).toBe(1);
  });

  test('an ally that hurt the victim in the last 10 seconds gets an assist and gold', () => {
    const { blue, red, context } = meleeArena();
    const ally = addAlly(context, 'ally', new Vector(0, 50));
    give(ally, 'soulbinder_tome');
    const gold = ally.gold;
    red.takeDamage(10, 'true', ally.id, context);
    red.takeDamage(red.health + 10, 'true', blue.id, context);
    expect(red.isDead).toBe(true);
    expect(blue.kills).toBe(1);
    expect(ally.assists).toBe(1);
    expect(ally.gold - gold).toBe(150);
    expect(ally.items[0]?.stacks).toBe(1);
  });
});

describe('Actives and consumables', () => {
  test('Healing Draught: buying stacks it, drinking heals and spends one', () => {
    const arena = meleeArena();
    const { blue, context } = arena;
    blue.gold = 1000;
    expect(blue.buyItem('healing_draught')).toBe(true);
    expect(blue.buyItem('healing_draught')).toBe(true);
    expect(blue.items.filter(Boolean)).toHaveLength(1);
    expect(blue.items[0]?.charges).toBe(2);

    blue.health = 100;
    expect(blue.itemActives.use(0, undefined, context)).toBe(true);
    expect(blue.items[0]?.charges).toBe(1);
    expect(blue.hasEffect('item_draught')).toBe(true);
    // Fast enough: twelve seconds of healing (its regeneration aside)
    const before = blue.health;
    for (let i = 0; i < 12 * 30; i++) {
      context.advanceTime(1 / 30);
      blue.update(1 / 30, context);
    }
    expect(blue.health - before).toBeGreaterThanOrEqual(120);

    context.advanceTime(1);
    expect(blue.itemActives.use(0, undefined, context)).toBe(true);
    expect(blue.items[0]).toBeNull();
  });

  test('Stillness: invulnerable and frozen, then on cooldown', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'hourglass_of_stillness');
    expect(blue.itemActives.use(0, undefined, context)).toBe(true);
    expect(blue.ccStatus.isStunned).toBe(true);
    expect(blue.takeDamage(500, 'true', red.id, context)).toBe(0);
    expect(blue.items[0]?.readyAt).toBeCloseTo(context.getGameTime() + 120, 5);
    expect(blue.itemActives.use(0, undefined, context)).toBe(false);
  });

  test('Unchain removes crowd control, and works while stunned', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'unchained_sash');
    blue.applyEffect('stun', 2, red.id);
    blue.applyEffect('slow_30', 2, red.id);
    expect(blue.itemActives.use(0, undefined, context)).toBe(true);
    expect(blue.hasEffect('stun')).toBe(false);
    expect(blue.hasEffect('slow_30')).toBe(false);
  });

  test('Shadowstep blinks toward the cursor, up to its range; not while stunned', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'shadowstep_cloak');
    blue.applyEffect('stun', 1, red.id);
    expect(blue.itemActives.use(0, { x: 0, y: 1000 }, context)).toBe(false);
    blue.removeEffect('stun');
    expect(blue.itemActives.use(0, { x: 0, y: 1000 }, context)).toBe(true);
    expect(blue.position.distanceTo(new Vector(0, 200))).toBeLessThan(30);
  });

  test('Shelter shields allies around', () => {
    const { blue, context } = meleeArena();
    give(blue, 'wardens_standard');
    const ally = addAlly(context, 'ally', new Vector(0, 200));
    expect(blue.itemActives.use(0, undefined, context)).toBe(true);
    expect(ally.shields.length).toBe(1);
    expect(blue.shields.length).toBe(1);
  });

  test('Wayfarer\'s Flask refills at the fountain', () => {
    const arena = meleeArena();
    const { blue, context } = arena;
    blue.gold = 1000;
    expect(blue.buyItem('wayfarer_flask')).toBe(true);
    expect(blue.buyItem('wayfarer_flask')).toBe(false);
    expect(blue.itemActives.use(0, undefined, context)).toBe(true);
    context.advanceTime(1);
    expect(blue.itemActives.use(0, undefined, context)).toBe(true);
    expect(blue.items[0]?.charges).toBe(0);
    context.advanceTime(1);
    expect(blue.itemActives.use(0, undefined, context)).toBe(false);

    blue.position.setFrom(context.mapConfig.CHAMPION_SPAWN.BLUE);
    blue.itemActives.update(0.1, context);
    expect(blue.items[0]?.charges).toBe(2);
  });

  test('a USE_ITEM input uses the item', () => {
    const arena = meleeArena();
    const { blue, context } = arena;
    give(blue, 'unchained_sash', 2);
    context.flushEvents();
    blue.itemActives.use(2, undefined, context);
    const cast = context.flushEvents().find(e => e.type === GameEventType.ABILITY_CAST);
    expect(cast?.data).toMatchObject({ entityId: blue.id, abilityId: 'item_unchain' });
    expect(InputType.USE_ITEM).toBe(14);
  });
});

describe('Groups', () => {
  test('one pair of boots, upgraded in place', () => {
    const { blue } = meleeArena();
    blue.gold = 5000;
    expect(blue.buyItem('wanderers_boots')).toBe(true);
    expect(blue.buyItem('mystic_treads')).toBe(true);
    expect(blue.items.filter(Boolean).map(item => item!.definitionId)).toEqual(['mystic_treads']);
    expect(blue.buyItem('fleetfoot_spurs')).toBe(false);
  });
});
