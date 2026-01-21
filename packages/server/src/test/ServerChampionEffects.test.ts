/**
 * Tests for ServerChampion effect and item systems.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { ServerChampion, type ServerChampionConfig } from '../simulation/ServerChampion';
import { Vector, TEAM_BLUE, type ChampionDefinition, type Side } from '@siege/shared';

// Mock champion definition for testing
const mockChampionDef: ChampionDefinition = {
  id: 'test_champion',
  name: 'Test Champion',
  title: 'The Tester',
  class: 'warrior',
  attackType: 'melee',
  resourceType: 'mana',
  baseStats: {
    health: 600,
    healthRegen: 5,
    resource: 300,
    resourceRegen: 6,
    attackDamage: 60,
    abilityPower: 0,
    attackSpeed: 0.65,
    attackRange: 125,
    armor: 30,
    magicResist: 30,
    movementSpeed: 340,
    critChance: 0,
    critDamage: 2.0,
  },
  growthStats: {
    health: 90,
    healthRegen: 0.5,
    resource: 40,
    resourceRegen: 0.8,
    attackDamage: 3,
    attackSpeed: 2.5,
    armor: 4,
    magicResist: 1.25,
  },
  abilities: {
    Q: 'test_q',
    W: 'test_w',
    E: 'test_e',
    R: 'test_r',
  },
};

function createTestChampion(overrides?: Partial<ServerChampionConfig>): ServerChampion {
  return new ServerChampion({
    id: 'test-champ-1',
    definition: mockChampionDef,
    playerId: 'test-player-1',
    position: new Vector(0, 0),
    side: TEAM_BLUE,
    ...overrides,
  });
}

describe('ServerChampion Item Stats', () => {
  let champion: ServerChampion;

  beforeEach(() => {
    champion = createTestChampion();
  });

  test('base stats without items', () => {
    const stats = champion.getStats();
    expect(stats.attackDamage).toBe(60);
    expect(stats.armor).toBe(30);
    expect(stats.maxHealth).toBe(600);
    expect(stats.movementSpeed).toBe(340);
  });

  test('single item applies stats', () => {
    // Equip Long Sword (+10 AD)
    champion.items[0] = {
      definitionId: 'long_sword',
      slot: 0,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    const stats = champion.getStats();
    expect(stats.attackDamage).toBe(70); // 60 + 10
  });

  test('multiple items stack stats', () => {
    // Equip two Long Swords
    champion.items[0] = {
      definitionId: 'long_sword',
      slot: 0,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };
    champion.items[1] = {
      definitionId: 'long_sword',
      slot: 1,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    const stats = champion.getStats();
    expect(stats.attackDamage).toBe(80); // 60 + 10 + 10
  });

  test('health items increase max health', () => {
    // Equip Giant's Belt (+350 health)
    champion.items[0] = {
      definitionId: 'giants_belt',
      slot: 0,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    const stats = champion.getStats();
    expect(stats.maxHealth).toBe(950); // 600 + 350
  });

  test('armor items increase armor', () => {
    // Equip Chain Vest (+40 armor)
    champion.items[0] = {
      definitionId: 'chain_vest',
      slot: 0,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    const stats = champion.getStats();
    expect(stats.armor).toBe(70); // 30 + 40
  });

  test('movement speed items work', () => {
    // Equip Boots of Speed (+25 MS)
    champion.items[0] = {
      definitionId: 'boots_of_speed',
      slot: 0,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    const stats = champion.getStats();
    expect(stats.movementSpeed).toBe(365); // 340 + 25
  });

  test('mixed stat items work correctly', () => {
    // Equip Thornmail (+70 armor, +350 health)
    champion.items[0] = {
      definitionId: 'thornmail',
      slot: 0,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    const stats = champion.getStats();
    expect(stats.armor).toBe(100); // 30 + 70
    expect(stats.maxHealth).toBe(950); // 600 + 350
  });

  test('attack speed items apply multiplicatively', () => {
    // Equip Dagger (+12% attack speed)
    champion.items[0] = {
      definitionId: 'dagger',
      slot: 0,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    const stats = champion.getStats();
    expect(stats.attackSpeed).toBeCloseTo(0.65 * 1.12, 2);
  });

  test('unknown item IDs are ignored', () => {
    champion.items[0] = {
      definitionId: 'unknown_item',
      slot: 0,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    const stats = champion.getStats();
    expect(stats.attackDamage).toBe(60); // Unchanged
  });
});

describe('ServerChampion CC Status', () => {
  let champion: ServerChampion;

  beforeEach(() => {
    champion = createTestChampion();
  });

  test('default CC status allows all actions', () => {
    expect(champion.ccStatus.canMove).toBe(true);
    expect(champion.ccStatus.canAttack).toBe(true);
    expect(champion.ccStatus.canCast).toBe(true);
    expect(champion.ccStatus.canUseMobilityAbilities).toBe(true);
    expect(champion.ccStatus.isStunned).toBe(false);
  });

  test('stun prevents all actions', () => {
    champion.applyEffect('stun', 2.0);

    expect(champion.ccStatus.isStunned).toBe(true);
    expect(champion.ccStatus.canMove).toBe(false);
    expect(champion.ccStatus.canAttack).toBe(false);
    expect(champion.ccStatus.canCast).toBe(false);
  });

  test('silence only prevents casting', () => {
    champion.applyEffect('silence', 2.0);

    expect(champion.ccStatus.isSilenced).toBe(true);
    expect(champion.ccStatus.canMove).toBe(true);
    expect(champion.ccStatus.canAttack).toBe(true);
    expect(champion.ccStatus.canCast).toBe(false);
  });

  test('root prevents movement but allows attacks', () => {
    champion.applyEffect('root', 2.0);

    expect(champion.ccStatus.isRooted).toBe(true);
    expect(champion.ccStatus.canMove).toBe(false);
    expect(champion.ccStatus.canAttack).toBe(true);
    expect(champion.ccStatus.canCast).toBe(true);
  });

  test('disarm prevents attacks but allows movement', () => {
    champion.applyEffect('disarm', 2.0);

    expect(champion.ccStatus.isDisarmed).toBe(true);
    expect(champion.ccStatus.canMove).toBe(true);
    expect(champion.ccStatus.canAttack).toBe(false);
    expect(champion.ccStatus.canCast).toBe(true);
  });

  test('grounded prevents mobility abilities', () => {
    champion.applyEffect('grounded', 2.0);

    expect(champion.ccStatus.isGrounded).toBe(true);
    expect(champion.ccStatus.canMove).toBe(true);
    expect(champion.ccStatus.canUseMobilityAbilities).toBe(false);
  });

  test('multiple CC effects stack', () => {
    champion.applyEffect('root', 2.0);
    champion.applyEffect('silence', 2.0);

    expect(champion.ccStatus.isRooted).toBe(true);
    expect(champion.ccStatus.isSilenced).toBe(true);
    expect(champion.ccStatus.canMove).toBe(false);
    expect(champion.ccStatus.canCast).toBe(false);
    expect(champion.ccStatus.canAttack).toBe(true);
  });
});

describe('ServerChampion Effect Application', () => {
  let champion: ServerChampion;

  beforeEach(() => {
    champion = createTestChampion();
  });

  test('applyEffect adds new effect', () => {
    champion.applyEffect('stun', 2.0);

    expect(champion.activeEffects.length).toBe(1);
    expect(champion.activeEffects[0].definitionId).toBe('stun');
    expect(champion.activeEffects[0].timeRemaining).toBe(2.0);
  });

  test('applyEffect with source ID', () => {
    champion.applyEffect('stun', 2.0, 'enemy-1');

    expect(champion.activeEffects[0].sourceId).toBe('enemy-1');
  });

  test('refresh behavior refreshes duration', () => {
    champion.applyEffect('stun', 2.0);
    champion.applyEffect('stun', 3.0);

    expect(champion.activeEffects.length).toBe(1);
    expect(champion.activeEffects[0].timeRemaining).toBe(3.0);
  });

  test('stack behavior increases stacks', () => {
    champion.applyEffect('poison', 3.0);
    champion.applyEffect('poison', 3.0);
    champion.applyEffect('poison', 3.0);

    expect(champion.activeEffects.length).toBe(1);
    expect(champion.activeEffects[0].stacks).toBe(3);
  });

  test('stack behavior respects maxStacks', () => {
    // Poison has maxStacks of 5
    for (let i = 0; i < 10; i++) {
      champion.applyEffect('poison', 3.0);
    }

    expect(champion.activeEffects[0].stacks).toBe(5);
  });

  test('removeEffect removes effect', () => {
    champion.applyEffect('stun', 2.0);
    expect(champion.activeEffects.length).toBe(1);

    const removed = champion.removeEffect('stun');
    expect(removed).toBe(true);
    expect(champion.activeEffects.length).toBe(0);
  });

  test('removeEffect returns false for missing effect', () => {
    const removed = champion.removeEffect('stun');
    expect(removed).toBe(false);
  });

  test('hasEffect returns correct value', () => {
    expect(champion.hasEffect('stun')).toBe(false);
    champion.applyEffect('stun', 2.0);
    expect(champion.hasEffect('stun')).toBe(true);
  });

  test('getEffect returns effect state', () => {
    champion.applyEffect('stun', 2.0);
    const effect = champion.getEffect('stun');
    expect(effect).toBeDefined();
    expect(effect?.definitionId).toBe('stun');
  });

  test('cleanse removes cleansable debuffs', () => {
    champion.applyEffect('stun', 2.0);
    champion.applyEffect('silence', 2.0);
    champion.applyEffect('attack_speed_buff', 5.0);

    const removed = champion.cleanse();
    expect(removed).toBe(2);
    expect(champion.activeEffects.length).toBe(1);
    expect(champion.activeEffects[0].definitionId).toBe('attack_speed_buff');
  });

  test('cleanse does not remove uncleansable effects', () => {
    champion.applyEffect('knockup', 1.0);
    champion.applyEffect('stun', 2.0);

    const removed = champion.cleanse();
    expect(removed).toBe(1); // Only stun removed
    expect(champion.hasEffect('knockup')).toBe(true);
  });

  test('removeEffectsByCategory removes category', () => {
    champion.applyEffect('stun', 2.0);
    champion.applyEffect('attack_speed_buff', 5.0);
    champion.applyEffect('armor_buff', 5.0);

    const removed = champion.removeEffectsByCategory('buff');
    expect(removed).toBe(2);
    expect(champion.activeEffects.length).toBe(1);
    expect(champion.activeEffects[0].definitionId).toBe('stun');
  });
});

describe('ServerChampion Stat Effects', () => {
  let champion: ServerChampion;

  beforeEach(() => {
    champion = createTestChampion();
  });

  test('armor buff increases armor', () => {
    const baseStat = champion.getStats().armor;
    champion.applyEffect('armor_buff', 5.0);

    const newStats = champion.getStats();
    expect(newStats.armor).toBe(baseStat + 10); // +10 per stack
  });

  test('armor buff stacks', () => {
    const baseStat = champion.getStats().armor;
    champion.applyEffect('armor_buff', 5.0);
    champion.applyEffect('armor_buff', 5.0);
    champion.applyEffect('armor_buff', 5.0);

    const newStats = champion.getStats();
    expect(newStats.armor).toBe(baseStat + 30); // +10 per stack, 3 stacks
  });

  test('armor reduction decreases armor', () => {
    const baseStat = champion.getStats().armor;
    champion.applyEffect('armor_reduction', 5.0);

    const newStats = champion.getStats();
    expect(newStats.armor).toBe(baseStat - 10); // -10 per stack
  });

  test('movement speed buff works', () => {
    const baseStat = champion.getStats().movementSpeed;
    champion.applyEffect('movement_speed_buff', 5.0);

    const newStats = champion.getStats();
    expect(newStats.movementSpeed).toBe(baseStat + 20); // +20 per stack
  });

  test('movement speed slow reduces speed', () => {
    const baseStat = champion.getStats().movementSpeed;
    champion.applyEffect('movement_speed_slow', 5.0);

    const newStats = champion.getStats();
    expect(newStats.movementSpeed).toBeCloseTo(baseStat * 0.9, 1); // -10%
  });

  test('attack speed buff multiplies', () => {
    const baseStat = champion.getStats().attackSpeed;
    champion.applyEffect('attack_speed_buff', 5.0);

    const newStats = champion.getStats();
    expect(newStats.attackSpeed).toBeCloseTo(baseStat * 1.1, 2); // +10%
  });

  test('multiple effect types combine', () => {
    const baseArmor = champion.getStats().armor;
    const baseSpeed = champion.getStats().movementSpeed;

    champion.applyEffect('armor_buff', 5.0);
    champion.applyEffect('movement_speed_buff', 5.0);

    const newStats = champion.getStats();
    expect(newStats.armor).toBe(baseArmor + 10);
    expect(newStats.movementSpeed).toBe(baseSpeed + 20);
  });
});

describe('ServerChampion Over-Time Effects', () => {
  let champion: ServerChampion;

  beforeEach(() => {
    champion = createTestChampion();
    champion.health = 500; // Set health below max for testing
  });

  test('healing over time heals', () => {
    const initialHealth = champion.health;
    champion.applyEffect('healing_over_time', 3.0);

    // Simulate time passing (0.5 seconds = 1 tick)
    // @ts-ignore - accessing private method for testing
    champion['updateEffects'](0.5);

    expect(champion.health).toBeGreaterThan(initialHealth);
  });

  test('damage over time deals damage', () => {
    const initialHealth = champion.health;
    champion.applyEffect('burn', 3.0);

    // Simulate time passing (0.5 seconds = 1 tick)
    // @ts-ignore - accessing private method for testing
    champion['updateEffects'](0.5);

    expect(champion.health).toBeLessThan(initialHealth);
  });

  test('poison stacking increases damage', () => {
    champion.applyEffect('poison', 3.0);
    champion.applyEffect('poison', 3.0);
    champion.applyEffect('poison', 3.0);

    expect(champion.activeEffects[0].stacks).toBe(3);
  });

  test('effect duration decreases over time', () => {
    champion.applyEffect('stun', 2.0);
    expect(champion.activeEffects[0].timeRemaining).toBe(2.0);

    // @ts-ignore - accessing private method for testing
    champion['updateEffects'](0.5);

    expect(champion.activeEffects[0].timeRemaining).toBe(1.5);
  });

  test('effect is removed when duration expires', () => {
    champion.applyEffect('stun', 0.5);
    expect(champion.activeEffects.length).toBe(1);

    // @ts-ignore - accessing private method for testing
    champion['updateEffects'](0.6);

    expect(champion.activeEffects.length).toBe(0);
  });
});

describe('ServerChampion Combined Item and Effect Stats', () => {
  let champion: ServerChampion;

  beforeEach(() => {
    champion = createTestChampion();
  });

  test('items and effects combine', () => {
    // Base armor: 30
    // Chain Vest: +40
    // Armor Buff: +10
    champion.items[0] = {
      definitionId: 'chain_vest',
      slot: 0,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };
    champion.applyEffect('armor_buff', 5.0);

    const stats = champion.getStats();
    expect(stats.armor).toBe(80); // 30 + 40 + 10
  });

  test('debuffs reduce item bonuses', () => {
    // Base armor: 30
    // Chain Vest: +40
    // Armor Reduction: -10
    champion.items[0] = {
      definitionId: 'chain_vest',
      slot: 0,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };
    champion.applyEffect('armor_reduction', 5.0);

    const stats = champion.getStats();
    expect(stats.armor).toBe(60); // 30 + 40 - 10
  });
});
