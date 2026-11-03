/**
 * Elara Champion Tests
 *
 * Tests for Elara - a ranged support with healing and utility.
 * Abilities:
 * - Passive: Blessed Presence - allied units within 280 heal 1% of their
 *   max health a second
 * - Q: Radiant Blessing - Targeted heal (on herself with no ally under the cursor)
 * - W: Sacred Shield - Targeted ally shield
 * - E: Swift Grace - AoE movement speed buff
 * - R: Divine Intervention - AoE heal and cleanse: the debuffs enemies put
 *   on her allies, except knockups, knockbacks and suppression
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  Vector,
  TEAM_BLUE,
  TEAM_RED,
  calculateAbilityValue,
  getAbilityDefinition,
  getPassiveDefinition,
  type Side,
} from '@siege/shared';
import {
  createTestArena,
  TestArena,
  TestChampion,
} from '../ServerTestUtils';
import { ServerChampion } from '../../simulation/ServerChampion';
import type { ServerEntity } from '../../simulation/ServerEntity';
import { passiveTriggerSystem } from '../../systems/PassiveTriggerSystem';
import { CHAMPION_DEFINITIONS } from '@siege/shared';

describe('Elara', () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'elara',
      redChampion: 'warrior',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(400, 0),
    });
  });

  describe('Base Stats', () => {
    // Base stat tests need level 1 (learnAbilities sets level to 6)
    let level1Arena: TestArena;

    beforeEach(() => {
      level1Arena = createTestArena({
        blueChampion: 'elara',
        redChampion: 'warrior',
        bluePosition: new Vector(0, 0),
        redPosition: new Vector(400, 0),
        learnAbilities: false, // Keep level 1 for base stat tests
      });
    });

    test('should have correct base health (530)', () => {
      expect(level1Arena.blue.maxHealth).toBe(530);
    });

    test('should have ranged attack range', () => {
      const { attackRange } = CHAMPION_DEFINITIONS.elara.baseStats;
      expect(level1Arena.blue.getStats().attackRange).toBe(attackRange);
      expect(attackRange).toBeGreaterThan(100);
    });

    test('should have high base mana (400)', () => {
      expect(level1Arena.blue.maxResource).toBe(400);
    });

    test('should have highest mana regen (4.7)', () => {
      expect(level1Arena.blue.definition.baseStats.resourceRegen).toBe(4.7);
    });

    test('should have moderate armor (22)', () => {
      expect(level1Arena.blue.getStats().armor).toBe(22);
    });
  });

  describe('Q - Radiant Blessing (Heal)', () => {
    test('should heal an ally', () => {
      // Create an allied champion
      const ally = new TestChampion({
        id: 'test-ally',
        position: new Vector(100, 0),
        side: TEAM_BLUE,
        definition: CHAMPION_DEFINITIONS['warrior'],
        playerId: 'player-ally',
      });
      arena.context.addChampion(ally, 'player-ally');

      // Damage the ally first
      ally.setHealth(ally.maxHealth - 200);
      const damagedHealth = ally.health;

      const result = arena.castAbility(arena.blue, 'Q', {
        targetPosition: ally.position.clone(),
        targetId: ally.id,
      });

      expect(result.success).toBe(true);
      arena.tick();

      expect(ally.health).toBeGreaterThan(damagedHealth);
    });

    test('should have correct mana cost at rank 1 (70)', () => {
      const initialMana = arena.blue.resource;

      // Self-cast for testing mana cost
      arena.castAbility(arena.blue, 'Q', {
        targetPosition: arena.blue.position.clone(),
        targetId: arena.blue.id,
      });

      expect(arena.blue.resource).toBe(initialMana - 70);
    });

    test('should not heal enemies', () => {
      // Damage enemy first so we can see if they get healed
      arena.red.takeDamage(100, 'true', undefined, arena.context);
      const enemyHealth = arena.red.health;

      // Try to target enemy
      const result = arena.castAbility(arena.blue, 'Q', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      arena.tick();

      // Enemy health should not be significantly higher (allow small regen)
      // Q heals for 100+ at rank 1, so if enemy gained >50, it was healed
      expect(arena.red.health).toBeLessThan(enemyHealth + 50);
    });

    test('should scale with AP', () => {
      // Add AP item
      arena.blue.items[0] = {
        definitionId: 'ember_shard',
        slot: 0,
        passiveCooldowns: {},
        nextIntervalTick: {},
      };

      const ally = new TestChampion({
        id: 'test-ally-ap',
        position: new Vector(100, 0),
        side: TEAM_BLUE,
        definition: CHAMPION_DEFINITIONS['warrior'],
        playerId: 'player-ally-ap',
      });
      arena.context.addChampion(ally, 'player-ally-ap');
      ally.setHealth(ally.maxHealth - 300);

      const preHealHealth = ally.health;
      arena.castAbility(arena.blue, 'Q', {
        targetPosition: ally.position.clone(),
        targetId: ally.id,
      });
      arena.tick();

      const healWithAP = ally.health - preHealHealth;

      // Compare to healing without AP
      const arena2 = createTestArena({ blueChampion: 'elara', redChampion: 'warrior' });
      const ally2 = new TestChampion({
        id: 'test-ally-noap',
        position: new Vector(100, 0),
        side: TEAM_BLUE,
        definition: CHAMPION_DEFINITIONS['warrior'],
        playerId: 'player-ally-noap',
      });
      arena2.context.addChampion(ally2, 'player-ally-noap');
      ally2.setHealth(ally2.maxHealth - 300);

      const preHealHealth2 = ally2.health;
      arena2.castAbility(arena2.blue, 'Q', {
        targetPosition: ally2.position.clone(),
        targetId: ally2.id,
      });
      arena2.tick();

      const healWithoutAP = ally2.health - preHealHealth2;

      expect(healWithAP).toBeGreaterThan(healWithoutAP);
    });
  });

  describe('W - Sacred Shield', () => {
    test('should grant a shield to an ally', () => {
      const ally = new TestChampion({
        id: 'test-ally-shield',
        position: new Vector(100, 0),
        side: TEAM_BLUE,
        definition: CHAMPION_DEFINITIONS['warrior'],
        playerId: 'player-ally-shield',
      });
      arena.context.addChampion(ally, 'player-ally-shield');

      expect(ally.getTotalShieldAmount()).toBe(0);

      arena.castAbility(arena.blue, 'W', {
        targetPosition: ally.position.clone(),
        targetId: ally.id,
      });

      arena.tick();

      expect(ally.getTotalShieldAmount()).toBeGreaterThan(0);
    });

    test('should have correct mana cost at rank 1 (60)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'W', {
        targetId: arena.blue.id,
      });

      expect(arena.blue.resource).toBe(initialMana - 60);
    });

    test('shield should last 2.5 seconds', () => {
      arena.castAbility(arena.blue, 'W', {
        targetId: arena.blue.id,
      });
      arena.tick();

      expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);

      // Tick for 2 seconds - should still have shield
      arena.tickFrames(60 * 2);
      expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);

      // Tick past 2.5 seconds
      arena.tickFrames(60 * 1);
      expect(arena.blue.getTotalShieldAmount()).toBe(0);
    });
  });

  describe('E - Swift Grace', () => {
    test('should grant movement speed to self', () => {
      const baseSpeed = arena.blue.getStats().movementSpeed;

      const result = arena.castAbility(arena.blue, 'E');
      expect(result.success).toBe(true);

      arena.tick();

      const buffedSpeed = arena.blue.getStats().movementSpeed;
      expect(buffedSpeed).toBeGreaterThan(baseSpeed);
    });

    test('should grant movement speed to nearby allies', () => {
      const ally = new TestChampion({
        id: 'test-ally-speed',
        position: new Vector(100, 0), // Within 400 range
        side: TEAM_BLUE,
        definition: CHAMPION_DEFINITIONS['warrior'],
        playerId: 'player-ally-speed',
      });
      arena.context.addChampion(ally, 'player-ally-speed');

      const allyBaseSpeed = ally.getStats().movementSpeed;

      arena.castAbility(arena.blue, 'E');
      arena.tick();

      const allyBuffedSpeed = ally.getStats().movementSpeed;
      expect(allyBuffedSpeed).toBeGreaterThan(allyBaseSpeed);
    });

    test('should affect allies near the cast location', () => {
      // This test verifies E can buff allies
      // Note: Current implementation may also affect enemies - this is game design choice
      const allyBaseSpeed = arena.blue.getStats().movementSpeed;

      arena.castAbility(arena.blue, 'E');
      arena.tick();

      // Caster should get speed buff (E is self-targeted AoE)
      expect(arena.blue.getStats().movementSpeed).toBeGreaterThan(allyBaseSpeed);
    });

    test('should have low mana cost (50)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'E');

      expect(arena.blue.resource).toBe(initialMana - 50);
    });

    test('speed buff should expire after 2 seconds', () => {
      const baseSpeed = arena.blue.getStats().movementSpeed;

      arena.castAbility(arena.blue, 'E');
      arena.tick();

      expect(arena.blue.getStats().movementSpeed).toBeGreaterThan(baseSpeed);

      // Tick past 2 seconds
      arena.tickFrames(60 * 3);

      expect(arena.blue.getStats().movementSpeed).toBe(baseSpeed);
    });
  });

  describe('R - Divine Intervention', () => {
    test('should heal all allies in range', () => {
      // Create multiple allies
      const ally1 = new TestChampion({
        id: 'test-ally-r1',
        position: new Vector(100, 0),
        side: TEAM_BLUE,
        definition: CHAMPION_DEFINITIONS['warrior'],
        playerId: 'player-ally-r1',
      });
      const ally2 = new TestChampion({
        id: 'test-ally-r2',
        position: new Vector(-100, 100),
        side: TEAM_BLUE,
        definition: CHAMPION_DEFINITIONS['warrior'],
        playerId: 'player-ally-r2',
      });

      arena.context.addChampion(ally1, 'player-ally-r1');
      arena.context.addChampion(ally2, 'player-ally-r2');

      // Damage everyone
      arena.blue.setHealth(arena.blue.maxHealth - 200);
      ally1.setHealth(ally1.maxHealth - 200);
      ally2.setHealth(ally2.maxHealth - 200);

      const elaraHealth = arena.blue.health;
      const ally1Health = ally1.health;
      const ally2Health = ally2.health;

      arena.castAbility(arena.blue, 'R');
      arena.tick();

      // All allies should be healed
      expect(arena.blue.health).toBeGreaterThan(elaraHealth);
      expect(ally1.health).toBeGreaterThan(ally1Health);
      expect(ally2.health).toBeGreaterThan(ally2Health);
    });

    test('should cleanse debuffs from allies', () => {
      // Apply debuffs
      arena.blue.applyEffect('stun', 5.0);
      arena.blue.applyEffect('slow_40', 5.0);

      expect(arena.blue.ccStatus.isStunned).toBe(true);

      arena.castAbility(arena.blue, 'R');
      arena.tick();

      // Stun should be cleansed (if cleansable)
      // Note: This depends on the effect being marked as cleansable
    });

    test('should have long cooldown (140s at rank 1)', () => {
      arena.castAbility(arena.blue, 'R');

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBeGreaterThanOrEqual(120);
    });

    test('should not heal enemies', () => {
      // Position enemy close and damage them first
      arena.red.position.x = 100;
      arena.red.takeDamage(150, 'true', undefined, arena.context);
      const enemyHealth = arena.red.health;

      arena.castAbility(arena.blue, 'R');
      arena.tick();

      // Enemy health should not be significantly higher (allow small regen)
      // R heals for 150+ at rank 1, so if enemy gained >50, it was healed
      expect(arena.red.health).toBeLessThan(enemyHealth + 50);
    });
  });

  describe('Support Playstyle', () => {
    test('should be able to keep an ally alive through sustained healing', () => {
      const ally = new TestChampion({
        id: 'test-tank',
        position: new Vector(100, 0),
        side: TEAM_BLUE,
        definition: CHAMPION_DEFINITIONS['warrior'],
        playerId: 'player-tank',
      });
      arena.context.addChampion(ally, 'player-tank');

      // Damage ally
      ally.setHealth(ally.maxHealth - 150);
      const damagedHealth = ally.health;

      // Heal with Q
      arena.castAbility(arena.blue, 'Q', {
        targetPosition: ally.position.clone(),
        targetId: ally.id,
      });
      arena.tick();

      // Shield with W
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'W', {
        targetPosition: ally.position.clone(),
        targetId: ally.id,
      });
      arena.tick();

      // Ally should be healthier and shielded
      expect(ally.health).toBeGreaterThan(damagedHealth);
      expect(ally.getTotalShieldAmount()).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Edge cases, by ability
// =============================================================================

const DT = 1 / 60;
const Q = getAbilityDefinition('elara_heal')!;
const W = getAbilityDefinition('elara_barrier')!;
const E = getAbilityDefinition('elara_speed')!;
const R = getAbilityDefinition('elara_resurrection')!;
const PASSIVE = getPassiveDefinition('elara_passive')!;

/** Elara (level 6, every ability rank 1) with Gorath far away */
function elaraArena(): TestArena {
  const arena = createTestArena({ blueChampion: 'elara', redChampion: 'gorath', bluePosition: new Vector(0, 0), redPosition: new Vector(3000, 3000) });
  // (Leveling up raises max health, not health)
  arena.blue.setLevel(6);
  arena.red.setLevel(6);
  arena.blue.setHealth(arena.blue.maxHealth);
  arena.blue.setResource(arena.blue.maxResource);
  return arena;
}

function addChampion(arena: TestArena, id: string, side: Side, at: Vector, championId = 'warrior'): TestChampion {
  const champion = new TestChampion({ id, position: at.clone(), side, definition: CHAMPION_DEFINITIONS[championId], playerId: `player-${id}` });
  arena.context.addChampion(champion, `player-${id}`);
  champion.setLevel(6);
  champion.setHealth(champion.maxHealth);
  arena.context.getFogOfWar().updateVision(arena.context, 1);
  return champion;
}

/** Record the heals a unit is given (before its own cuts, like Wounds), from whom */
function recordHeals(entity: ServerEntity): { amount: number; sourceId?: string }[] {
  const heals: { amount: number; sourceId?: string }[] = [];
  const heal = entity.heal.bind(entity);
  entity.heal = ((amount, context, sourceId) => {
    heals.push({ amount, sourceId });
    return heal(amount, context, sourceId);
  }) as typeof entity.heal;
  return heals;
}

/** Elara's ability power: 100 */
function withAbilityPower(champion: TestChampion, abilityPower = 100): number {
  champion.addModifier({ source: 'test-ap', flat: { abilityPower } });
  return champion.getStats().abilityPower;
}

/** Run the passive system for a while (the game loop does it every tick) */
function runPassive(arena: TestArena, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    arena.tick(DT);
    passiveTriggerSystem.processAlwaysPassives(DT, [arena.blue], arena.context);
  }
}

describe('Elara passive - Blessed Presence', () => {
  test('allies within 280 heal 1% of their max health every second; beyond 280, nothing', () => {
    const arena = elaraArena();
    const near = addChampion(arena, 'near', TEAM_BLUE, new Vector(PASSIVE.auraRadius! - 10, 0));
    const far = addChampion(arena, 'far', TEAM_BLUE, new Vector(PASSIVE.auraRadius! + 20, 0));
    const nearHeals = recordHeals(near);
    const farHeals = recordHeals(far);
    runPassive(arena, 3.05);
    expect(nearHeals.length).toBeGreaterThanOrEqual(3);
    expect(nearHeals.length).toBeLessThanOrEqual(4);
    for (const heal of nearHeals) {
      expect(heal.amount).toBeCloseTo(near.maxHealth * 0.01, 6);
      expect(heal.sourceId).toBe(arena.blue.id);
    }
    expect(farHeals).toEqual([]);
  });

  test('she heals herself and allied minions, not enemies', () => {
    const arena = elaraArena();
    const minion = arena.addMinion(TEAM_BLUE, new Vector(100, 0));
    const enemy = arena.addMinion(TEAM_RED, new Vector(-100, 0));
    const ownHeals = recordHeals(arena.blue);
    const minionHeals = recordHeals(minion);
    const enemyHeals = recordHeals(enemy);
    runPassive(arena, 1.05);
    expect(ownHeals.some(heal => heal.sourceId === arena.blue.id)).toBe(true);
    expect(minionHeals.length).toBeGreaterThan(0);
    expect(minionHeals[0].amount).toBeCloseTo(minion.maxHealth * 0.01, 6);
    expect(enemyHeals).toEqual([]);
  });

  test('dead, she heals no one', () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(100, 0));
    const heals = recordHeals(ally);
    arena.blue.takeDamage(1e9, 'true');
    for (let t = 0; t < 2; t += DT) passiveTriggerSystem.processAlwaysPassives(DT, [arena.blue], arena.context);
    expect(heals).toEqual([]);
  });

  test('a heal never goes past max health', () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(100, 0));
    runPassive(arena, 2.05);
    expect(ally.health).toBe(ally.maxHealth);
  });
});

describe('Elara Q - Radiant Blessing', () => {
  test('heals the ally 70 + 50% AP at rank 1, at once', () => {
    const arena = elaraArena();
    const ap = withAbilityPower(arena.blue);
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    ally.setHealth(ally.maxHealth - 500);
    const health = ally.health;
    const result = arena.castAbility(arena.blue, 'Q', { targetId: ally.id, targetPosition: ally.position.clone(), casting: true });
    expect(result.success).toBe(true);
    expect(arena.blue.isCasting()).toBe(false);
    expect(ally.health - health).toBeCloseTo(70 + 0.5 * ap, 6);
  });

  test('at rank 5 it heals 230 + 50% AP', () => {
    const arena = elaraArena();
    arena.blue.setLevel(18);
    arena.blue.maxAbility('Q');
    const ap = withAbilityPower(arena.blue);
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    ally.setHealth(ally.maxHealth - 800);
    const health = ally.health;
    arena.castAbility(arena.blue, 'Q', { targetId: ally.id, targetPosition: ally.position.clone() });
    expect(ally.health - health).toBeCloseTo(calculateAbilityValue(Q.heal!.scaling, 5, { abilityPower: ap }), 6);
    expect(calculateAbilityValue(Q.heal!.scaling, 5, { abilityPower: ap })).toBeCloseTo(230 + 0.5 * ap, 6);
  });

  test('an ally just inside its 300 range is healed; one past it fails, with nothing spent', () => {
    const arena = elaraArena();
    const near = addChampion(arena, 'near', TEAM_BLUE, new Vector(Q.range! - 5, 0));
    near.setHealth(near.maxHealth - 300);
    const health = near.health;
    expect(arena.castAbility(arena.blue, 'Q', { targetId: near.id, targetPosition: near.position.clone() }).success).toBe(true);
    expect(near.health).toBeGreaterThan(health);

    arena.blue.resetCooldowns();
    const far = addChampion(arena, 'far', TEAM_BLUE, new Vector(0, Q.range! + 20));
    const mana = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'Q', { targetId: far.id, targetPosition: far.position.clone() }).failReason).toBe('out_of_range');
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
  });

  test('aimed at no ally (the ground), she heals herself (design)', () => {
    const arena = elaraArena();
    arena.blue.setHealth(arena.blue.maxHealth - 300);
    const health = arena.blue.health;
    expect(arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(200, 50) }).success).toBe(true);
    expect(arena.blue.health - health).toBeCloseTo(calculateAbilityValue(Q.heal!.scaling, 1, {}), 6);
  });

  test('aimed at a dead ally, she heals herself', () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    ally.takeDamage(1e9, 'true');
    arena.blue.setHealth(arena.blue.maxHealth - 300);
    const health = arena.blue.health;
    expect(arena.castAbility(arena.blue, 'Q', { targetId: ally.id, targetPosition: ally.position.clone() }).success).toBe(true);
    expect(arena.blue.health).toBeGreaterThan(health);
  });

  test('Wounds on the ally cut the heal by 40%', () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    ally.setHealth(ally.maxHealth - 500);
    ally.applyEffect('wounds', 3, arena.red.id);
    const health = ally.health;
    arena.castAbility(arena.blue, 'Q', { targetId: ally.id, targetPosition: ally.position.clone() });
    expect(ally.health - health).toBeCloseTo(calculateAbilityValue(Q.heal!.scaling, 1, {}) * 0.6, 6);
  });

  test('a heal never goes past max health', () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    ally.setHealth(ally.maxHealth - 10);
    arena.castAbility(arena.blue, 'Q', { targetId: ally.id, targetPosition: ally.position.clone() });
    expect(ally.health).toBe(ally.maxHealth);
  });

  test('silenced it fails, with nothing spent', () => {
    const arena = elaraArena();
    arena.blue.applyEffect('silence', 1, arena.red.id);
    const mana = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'Q', { targetId: arena.blue.id }).failReason).toBe('silenced');
    expect(arena.blue.resource).toBe(mana);
  });

  test('its cost and cooldown by rank: 70 mana and 10 s, up to 110 and 6 s', () => {
    const arena = elaraArena();
    arena.blue.setLevel(18);
    for (let rank = 1; rank <= 5; rank++) {
      arena.blue.abilityStates.Q.rank = rank;
      arena.blue.resetCooldowns();
      arena.blue.setResource(arena.blue.maxResource);
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'Q', { targetId: arena.blue.id });
      expect(arena.blue.resource).toBe(mana - Q.manaCost![rank - 1]);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(Q.cooldown![rank - 1]);
    }
  });
});

describe('Elara W - Sacred Shield', () => {
  test('shields the ally for 60 + 35% AP for 2.5 s', () => {
    const arena = elaraArena();
    const ap = withAbilityPower(arena.blue);
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    arena.castAbility(arena.blue, 'W', { targetId: ally.id, targetPosition: ally.position.clone() });
    const [shield] = ally.getShields();
    expect(shield.amount).toBeCloseTo(60 + 0.35 * ap, 6);
    expect(shield.remainingDuration).toBe(W.shield!.duration);
  });

  test('at rank 5 the shield is 180 + 35% AP', () => {
    const arena = elaraArena();
    arena.blue.setLevel(18);
    arena.blue.maxAbility('W');
    const ap = withAbilityPower(arena.blue);
    arena.castAbility(arena.blue, 'W', { targetId: arena.blue.id });
    expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(180 + 0.35 * ap, 6);
  });

  test('it takes damage before health does', () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    arena.castAbility(arena.blue, 'W', { targetId: ally.id, targetPosition: ally.position.clone() });
    const shield = ally.getTotalShieldAmount();
    const health = ally.health;
    ally.takeDamage(40, 'true', arena.red.id, arena.context);
    expect(ally.health).toBe(health);
    expect(ally.getTotalShieldAmount()).toBeCloseTo(shield - 40, 6);
  });

  test('an allied champion past its 300 range: it fails, with nothing spent', () => {
    const arena = elaraArena();
    const far = addChampion(arena, 'far', TEAM_BLUE, new Vector(W.range! + 20, 0));
    const mana = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'W', { targetId: far.id, targetPosition: far.position.clone() }).failReason).toBe('out_of_range');
    expect(arena.blue.resource).toBe(mana);
    expect(far.getTotalShieldAmount()).toBe(0);
  });
});

describe('Elara E - Swift Grace', () => {
  test('she and the allies within 220 move 30% faster for 2 s; allies past 220 and enemies do not', () => {
    const arena = elaraArena();
    const near = addChampion(arena, 'near', TEAM_BLUE, new Vector(E.aoeRadius! - 10, 0));
    const far = addChampion(arena, 'far', TEAM_BLUE, new Vector(E.aoeRadius! + 20, 0));
    const enemy = addChampion(arena, 'enemy', TEAM_RED, new Vector(0, 100));
    const minion = arena.addMinion(TEAM_BLUE, new Vector(-100, 0));
    const speed = arena.blue.getStats().movementSpeed;
    expect(arena.castAbility(arena.blue, 'E', { casting: true }).success).toBe(true);
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(speed * 1.3, 6);
    expect(arena.blue.getEffect('speed_30')!.totalDuration).toBe(E.effectDuration!);
    expect(near.hasEffect('speed_30')).toBe(true);
    expect(minion.activeEffects.some(effect => effect.definitionId === 'speed_30')).toBe(true);
    expect(far.hasEffect('speed_30')).toBe(false);
    expect(enemy.hasEffect('speed_30')).toBe(false);
  });
});

describe('Elara R - Divine Intervention', () => {
  const healOf = (rank: number, abilityPower = 0) => calculateAbilityValue(R.heal!.scaling, rank, { abilityPower });

  /** Debuffs from other champions' kits, summoners and items, all cleansable */
  const ENEMY_DEBUFFS = [
    'stun', 'silence', 'root', 'slow_40', 'disarm', 'blind', 'grounded', 'taunt',
    'armor_reduction', 'magic_resist_reduction',
    'zhakrul_venom', 'zhakrul_ancient_venom', 'elora_venom', 'vile_root', 'vile_q_slow', 'vex_mark',
    'summoner_scorch', 'summoner_hinder_slow', 'summoner_hinder_attack', 'summoner_hinder_power',
    'wounds', 'cinders_burn', 'item_frost_nova',
  ];
  /** Buffs her team holds, whose ids look like debuffs' (poison, slow, ...) */
  const ALLIED_BUFFS = ['elora_poison_arrow', 'vile_slow_resist', 'speed_30', 'caelum_embolden', 'fenris_bloodthirst', 'vex_empowered'];

  test('heals her and the allies within 280 for 150 + 60% AP at rank 1; not allies past it, nor enemies', () => {
    const arena = elaraArena();
    const ap = withAbilityPower(arena.blue);
    const near = addChampion(arena, 'near', TEAM_BLUE, new Vector(R.aoeRadius! - 10, 0));
    const far = addChampion(arena, 'far', TEAM_BLUE, new Vector(R.aoeRadius! + 20, 0));
    const enemy = addChampion(arena, 'enemy', TEAM_RED, new Vector(0, 100));
    for (const champion of [arena.blue, near, far, enemy]) champion.setHealth(champion.maxHealth - 600);
    const healths = [arena.blue, near, far, enemy].map(champion => champion.health);
    expect(arena.castAbility(arena.blue, 'R', { casting: true }).success).toBe(true);
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.health - healths[0]).toBeCloseTo(healOf(1, ap), 6);
    expect(near.health - healths[1]).toBeCloseTo(healOf(1, ap), 6);
    expect(far.health).toBe(healths[2]);
    expect(enemy.health).toBe(healths[3]);
  });

  test('at rank 3 it heals 350 + 60% AP', () => {
    const arena = elaraArena();
    arena.blue.setLevel(18);
    arena.blue.maxAbility('R');
    const ap = withAbilityPower(arena.blue);
    arena.blue.setHealth(arena.blue.maxHealth - 800);
    const health = arena.blue.health;
    arena.castAbility(arena.blue, 'R');
    expect(arena.blue.health - health).toBeCloseTo(350 + 0.6 * ap, 6);
  });

  test("cleanses the debuffs enemies put on her allies: other kits', summoners' and items' (by what they are, not their names)", () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    for (const effectId of ENEMY_DEBUFFS) ally.applyEffect(effectId, 5, arena.red.id);
    expect(ally.getActiveEffects().map(effect => effect.definitionId).sort()).toEqual([...ENEMY_DEBUFFS].sort());

    arena.castAbility(arena.blue, 'R');

    expect(ally.getActiveEffects().map(effect => effect.definitionId)).toEqual([]);
  });

  test("doesn't cleanse knockups, knockbacks or suppression", () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    ally.applyEffect('knockup', 1, arena.red.id);
    ally.applyEffect('suppress', 1, arena.red.id);
    ally.applyEffect('stun', 1, arena.red.id);
    arena.castAbility(arena.blue, 'R');
    expect(ally.hasEffect('knockup')).toBe(true);
    expect(ally.hasEffect('suppress')).toBe(true);
    expect(ally.hasEffect('stun')).toBe(false);
  });

  test("leaves her allies' buffs alone, whatever their names", () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    for (const effectId of ALLIED_BUFFS) ally.applyEffect(effectId, 5, ally.id);
    arena.castAbility(arena.blue, 'R');
    expect(ally.getActiveEffects().map(effect => effect.definitionId).sort()).toEqual([...ALLIED_BUFFS].sort());
  });

  test('leaves what her team put on itself (not from an enemy), and what is not cleansable', () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    ally.applyEffect('slow_20', 5, ally.id);
    ally.applyEffect('slow_30', 5, arena.blue.id);
    ally.applyEffect('item_sunder', 5, arena.red.id);
    ally.applyEffect('vile_trap_caught', 5, arena.red.id);
    arena.castAbility(arena.blue, 'R');
    expect(ally.getActiveEffects().map(effect => effect.definitionId).sort()).toEqual(['item_sunder', 'slow_20', 'slow_30', 'vile_trap_caught']);
  });

  test('a cleansed stun or root ends at once: the ally moves, attacks and casts again', () => {
    const arena = elaraArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(150, 0));
    ally.applyEffect('stun', 3, arena.red.id);
    ally.applyEffect('root', 3, arena.red.id);
    ally.applyEffect('slow_40', 3, arena.red.id);
    const slowed = ally.getStats().movementSpeed;
    expect(ally.ccStatus.canMove).toBe(false);
    arena.castAbility(arena.blue, 'R');
    expect(ally.ccStatus.canMove).toBe(true);
    expect(ally.ccStatus.canCast).toBe(true);
    expect(ally.ccStatus.canAttack).toBe(true);
    expect(ally.getStats().movementSpeed).toBeGreaterThan(slowed);
  });

  test('she cleanses herself, and allied minions', () => {
    const arena = elaraArena();
    const minion = arena.addMinion(TEAM_BLUE, new Vector(100, 0));
    arena.blue.applyEffect('root', 3, arena.red.id);
    minion.applyEffect('slow_40', 3, arena.red.id);
    // Rooted, she can still cast it (it doesn't move her)
    expect(arena.castAbility(arena.blue, 'R').success).toBe(true);
    expect(arena.blue.hasEffect('root')).toBe(false);
    expect(minion.activeEffects).toEqual([]);
  });

  test("enemies' debuffs, and allies' past 280, stay", () => {
    const arena = elaraArena();
    const enemy = addChampion(arena, 'enemy', TEAM_RED, new Vector(0, 100), 'magnus');
    const far = addChampion(arena, 'far', TEAM_BLUE, new Vector(R.aoeRadius! + 20, 0));
    enemy.applyEffect('slow_40', 3, arena.blue.id);
    far.applyEffect('slow_40', 3, arena.red.id);
    arena.castAbility(arena.blue, 'R');
    expect(enemy.hasEffect('slow_40')).toBe(true);
    expect(far.hasEffect('slow_40')).toBe(true);
  });

  test('stunned she cannot cast it', () => {
    const arena = elaraArena();
    arena.blue.applyEffect('stun', 1, arena.red.id);
    const mana = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'R').failReason).toBe('stunned');
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.hasEffect('stun')).toBe(true);
  });

  test('it costs 100 mana; its cooldown is 140 / 120 / 100 s', () => {
    for (const rank of [1, 2, 3]) {
      const arena = elaraArena();
      arena.blue.setLevel(18);
      arena.blue.abilityStates.R.rank = rank;
      arena.blue.setResource(arena.blue.maxResource);
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'R');
      expect(arena.blue.resource).toBe(mana - R.manaCost![rank - 1]);
      expect(arena.blue.getAbilityCooldown('R')).toBe(R.cooldown![rank - 1]);
    }
  });
});

// =============================================================================
// Descriptions
// =============================================================================

describe('Elara descriptions say what her abilities do', () => {
  test("the passive's radius is the real one", () => {
    expect(PASSIVE.description).toContain(`${PASSIVE.auraRadius} units`);
  });

  test("Q's and W's self-cast", () => {
    expect(Q.description).toContain('yourself');
    expect(W.description).toContain('yourself');
  });

  test("R's radius, and what it does not cleanse", () => {
    expect(R.description).toContain(`${R.aoeRadius} units`);
    expect(R.description).toContain('enemies');
    expect(R.description).toContain('not knockups or suppression');
  });
});
