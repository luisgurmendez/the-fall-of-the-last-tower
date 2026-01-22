/**
 * Tests for PassiveTriggerSystem.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  PassiveTriggerSystem,
  type PassiveTriggerData,
  type PassiveHandler,
} from '../../systems/PassiveTriggerSystem';
import {
  type PassiveAbilityDefinition,
  type PassiveState,
  createDefaultPassiveState,
} from '@siege/shared';

// Mock ServerChampion
const createMockChampion = (championId: string, passiveState?: PassiveState) => ({
  id: `champion_${championId}`,
  playerId: `player_${championId}`,
  definition: {
    id: championId,
    name: championId,
    baseStats: {
      health: 600,
      mana: 300,
      attackDamage: 60,
      abilityPower: 0,
      armor: 30,
      magicResist: 30,
      attackSpeed: 0.625,
      movementSpeed: 325,
      healthRegen: 5,
      manaRegen: 8,
    },
  },
  passiveState: passiveState ?? createDefaultPassiveState(),
  health: 500,
  maxHealth: 1000,
  level: 1,
  isDead: false,
  shields: [] as any[],
  getStats: () => ({
    maxHealth: 1000,
    attackDamage: 100,
    abilityPower: 50,
    armor: 30,
    magicResist: 30,
    movementSpeed: 325,
  }),
  addModifier: mock(() => {}),
  removeModifier: mock(() => {}),
});

// Mock ServerGameContext
const createMockContext = () => ({
  getEntitiesInRadius: mock(() => []),
  dealDamage: mock(() => {}),
  heal: mock(() => {}),
});

describe('PassiveTriggerSystem', () => {
  let system: PassiveTriggerSystem;

  beforeEach(() => {
    system = new PassiveTriggerSystem();
  });

  describe('registerPassive', () => {
    test('registers a passive with primary trigger', () => {
      const definition: PassiveAbilityDefinition = {
        id: 'test_passive',
        name: 'Test Passive',
        description: 'A test passive',
        trigger: 'on_hit',
      };

      // Should not throw
      expect(() => system.registerPassive('warrior', definition)).not.toThrow();
    });

    test('registers a passive with additional triggers', () => {
      const definition: PassiveAbilityDefinition = {
        id: 'test_passive_multi',
        name: 'Multi-Trigger Passive',
        description: 'A passive with multiple triggers',
        trigger: 'on_hit',
        additionalTriggers: ['on_attack', 'on_ability_cast'],
      };

      expect(() => system.registerPassive('warrior', definition)).not.toThrow();
    });

    test('registers with custom handler', () => {
      const customHandler: PassiveHandler = mock(() => {});
      const definition: PassiveAbilityDefinition = {
        id: 'custom_passive',
        name: 'Custom Passive',
        description: 'A passive with custom handler',
        trigger: 'on_hit',
      };

      system.registerPassive('warrior', definition, customHandler);

      // Dispatch trigger to verify handler is called
      const champion = createMockChampion('warrior');
      const context = createMockContext();
      system.dispatchTrigger('on_hit', champion as any, context as any);

      expect(customHandler).toHaveBeenCalled();
    });
  });

  describe('dispatchTrigger', () => {
    test('dispatches trigger to matching champion', () => {
      const handler = mock(() => {});
      const definition: PassiveAbilityDefinition = {
        id: 'warrior_passive',
        name: 'Warrior Passive',
        description: 'Test',
        trigger: 'on_hit',
      };

      system.registerPassive('warrior', definition, handler);

      const champion = createMockChampion('warrior');
      const context = createMockContext();

      system.dispatchTrigger('on_hit', champion as any, context as any);

      expect(handler).toHaveBeenCalled();
    });

    test('does not dispatch to non-matching champion', () => {
      const handler = mock(() => {});
      const definition: PassiveAbilityDefinition = {
        id: 'warrior_passive',
        name: 'Warrior Passive',
        description: 'Test',
        trigger: 'on_hit',
      };

      system.registerPassive('warrior', definition, handler);

      // Use different champion ID
      const champion = createMockChampion('magnus');
      const context = createMockContext();

      system.dispatchTrigger('on_hit', champion as any, context as any);

      expect(handler).not.toHaveBeenCalled();
    });

    test('respects internal cooldown', () => {
      const handler = mock(() => {});
      const definition: PassiveAbilityDefinition = {
        id: 'cooldown_passive',
        name: 'Cooldown Passive',
        description: 'Test',
        trigger: 'on_hit',
        internalCooldown: 5,
      };

      system.registerPassive('warrior', definition, handler);

      // Create champion with cooldown remaining
      const passiveState = createDefaultPassiveState();
      passiveState.cooldownRemaining = 3; // 3 seconds remaining

      const champion = createMockChampion('warrior', passiveState);
      const context = createMockContext();

      system.dispatchTrigger('on_hit', champion as any, context as any);

      // Handler should not be called due to cooldown
      expect(handler).not.toHaveBeenCalled();
    });

    test('passes trigger data to handler', () => {
      const handler = mock(() => {});
      const definition: PassiveAbilityDefinition = {
        id: 'data_passive',
        name: 'Data Passive',
        description: 'Test',
        trigger: 'on_hit',
      };

      system.registerPassive('warrior', definition, handler);

      const champion = createMockChampion('warrior');
      const context = createMockContext();
      const triggerData: PassiveTriggerData = {
        target: { id: 'target_1' } as any,
        damageAmount: 100,
        damageType: 'physical',
      };

      system.dispatchTrigger('on_hit', champion as any, context as any, triggerData);

      expect(handler).toHaveBeenCalledWith(
        champion,
        champion.passiveState,
        definition,
        context,
        triggerData
      );
    });
  });

  describe('updatePassiveState', () => {
    test('decrements cooldown over time', () => {
      const passiveState = createDefaultPassiveState();
      passiveState.cooldownRemaining = 5;

      const champion = createMockChampion('warrior', passiveState);
      const context = createMockContext();

      system.updatePassiveState(1, champion as any, context as any);

      expect(champion.passiveState.cooldownRemaining).toBe(4);
    });

    test('cooldown does not go below zero', () => {
      const passiveState = createDefaultPassiveState();
      passiveState.cooldownRemaining = 0.5;

      const champion = createMockChampion('warrior', passiveState);
      const context = createMockContext();

      system.updatePassiveState(1, champion as any, context as any);

      expect(champion.passiveState.cooldownRemaining).toBe(0);
    });

    test('decrements stack time and clears stacks when expired', () => {
      const passiveState = createDefaultPassiveState();
      passiveState.stacks = 3;
      passiveState.stackTimeRemaining = 0.5;
      passiveState.isActive = true;

      const champion = createMockChampion('warrior', passiveState);
      const context = createMockContext();

      system.updatePassiveState(1, champion as any, context as any);

      expect(champion.passiveState.stacks).toBe(0);
      expect(champion.passiveState.isActive).toBe(false);
    });
  });

  describe('processIntervalPassives', () => {
    test('triggers interval passive when timer reaches zero', () => {
      const handler = mock(() => {});
      const definition: PassiveAbilityDefinition = {
        id: 'interval_passive',
        name: 'Interval Passive',
        description: 'Test',
        trigger: 'on_interval',
        intervalSeconds: 2,
      };

      system.registerPassive('warrior', definition, handler);

      const passiveState = createDefaultPassiveState();
      passiveState.nextIntervalIn = 0.5; // 0.5 seconds until trigger

      const champion = createMockChampion('warrior', passiveState);
      const context = createMockContext();

      system.processIntervalPassives(1, [champion as any], context as any);

      expect(handler).toHaveBeenCalled();
      expect(champion.passiveState.nextIntervalIn).toBe(2); // Reset to interval
    });

    test('skips dead champions', () => {
      const handler = mock(() => {});
      const definition: PassiveAbilityDefinition = {
        id: 'interval_passive',
        name: 'Interval Passive',
        description: 'Test',
        trigger: 'on_interval',
        intervalSeconds: 2,
      };

      system.registerPassive('warrior', definition, handler);

      const passiveState = createDefaultPassiveState();
      passiveState.nextIntervalIn = 0;

      const champion = createMockChampion('warrior', passiveState);
      champion.isDead = true;
      const context = createMockContext();

      system.processIntervalPassives(1, [champion as any], context as any);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('processAlwaysPassives', () => {
    test('processes always-active passives with interval', () => {
      const handler = mock(() => {});
      const definition: PassiveAbilityDefinition = {
        id: 'aura_passive',
        name: 'Aura Passive',
        description: 'Test',
        trigger: 'always',
        intervalSeconds: 1,
        auraRadius: 600,
      };

      system.registerPassive('warrior', definition, handler);

      const passiveState = createDefaultPassiveState();
      passiveState.nextIntervalIn = 0.5;

      const champion = createMockChampion('warrior', passiveState);
      const context = createMockContext();

      system.processAlwaysPassives(1, [champion as any], context as any);

      expect(handler).toHaveBeenCalled();
    });

    test('marks continuous passives as active', () => {
      const definition: PassiveAbilityDefinition = {
        id: 'continuous_passive',
        name: 'Continuous Passive',
        description: 'Test',
        trigger: 'always',
        // No intervalSeconds = continuous effect
      };

      system.registerPassive('warrior', definition);

      const passiveState = createDefaultPassiveState();
      const champion = createMockChampion('warrior', passiveState);
      const context = createMockContext();

      system.processAlwaysPassives(1, [champion as any], context as any);

      expect(champion.passiveState.isActive).toBe(true);
    });
  });

  describe('clear', () => {
    test('clears all registered passives', () => {
      const handler = mock(() => {});
      const definition: PassiveAbilityDefinition = {
        id: 'test_passive',
        name: 'Test Passive',
        description: 'Test',
        trigger: 'on_hit',
      };

      system.registerPassive('warrior', definition, handler);
      system.clear();

      const champion = createMockChampion('warrior');
      const context = createMockContext();

      system.dispatchTrigger('on_hit', champion as any, context as any);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('Default Handlers', () => {
  let system: PassiveTriggerSystem;

  beforeEach(() => {
    system = new PassiveTriggerSystem();
  });

  describe('on_low_health_shield handler', () => {
    test('triggers shield when health is below threshold', () => {
      const definition: PassiveAbilityDefinition = {
        id: 'low_health_shield',
        name: 'Low Health Shield',
        description: 'Test',
        trigger: 'on_low_health',
        healthThreshold: 0.3,
        internalCooldown: 60,
        shield: {
          scaling: { base: [100] },
          duration: 5,
        },
      };

      system.registerPassive('warrior', definition);

      const champion = createMockChampion('warrior');
      champion.health = 250; // 25% of 1000 max health
      champion.maxHealth = 1000;
      const context = createMockContext();

      system.dispatchTrigger('on_low_health', champion as any, context as any);

      // Should have added a shield
      expect(champion.shields.length).toBe(1);
      expect(champion.passiveState.isActive).toBe(true);
      expect(champion.passiveState.cooldownRemaining).toBe(60);
    });

    test('does not trigger when health is above threshold', () => {
      const definition: PassiveAbilityDefinition = {
        id: 'low_health_shield',
        name: 'Low Health Shield',
        description: 'Test',
        trigger: 'on_low_health',
        healthThreshold: 0.3,
        shield: {
          scaling: { base: [100] },
          duration: 5,
        },
      };

      system.registerPassive('warrior', definition);

      const champion = createMockChampion('warrior');
      champion.health = 500; // 50% of 1000 max health
      champion.maxHealth = 1000;
      const context = createMockContext();

      system.dispatchTrigger('on_low_health', champion as any, context as any);

      expect(champion.shields.length).toBe(0);
    });
  });

  describe('stack_accumulation handler', () => {
    test('accumulates stacks on trigger', () => {
      const definition: PassiveAbilityDefinition = {
        id: 'stack_passive',
        name: 'Stack Passive',
        description: 'Test',
        trigger: 'on_ability_cast',
        usesStacks: true,
        maxStacks: 4,
        stacksPerTrigger: 1,
        stackDuration: 10,
      };

      system.registerPassive('warrior', definition);

      const champion = createMockChampion('warrior');
      const context = createMockContext();

      system.dispatchTrigger('on_ability_cast', champion as any, context as any);

      expect(champion.passiveState.stacks).toBe(1);
      expect(champion.passiveState.stackTimeRemaining).toBe(10);
    });

    test('caps at max stacks', () => {
      const definition: PassiveAbilityDefinition = {
        id: 'stack_passive',
        name: 'Stack Passive',
        description: 'Test',
        trigger: 'on_ability_cast',
        usesStacks: true,
        maxStacks: 4,
        stacksPerTrigger: 1,
      };

      system.registerPassive('warrior', definition);

      const passiveState = createDefaultPassiveState();
      passiveState.stacks = 4; // Already at max

      const champion = createMockChampion('warrior', passiveState);
      const context = createMockContext();

      system.dispatchTrigger('on_ability_cast', champion as any, context as any);

      expect(champion.passiveState.stacks).toBe(4); // Still 4
    });

    test('activates when required stacks reached', () => {
      const definition: PassiveAbilityDefinition = {
        id: 'stack_passive',
        name: 'Stack Passive',
        description: 'Test',
        trigger: 'on_ability_cast',
        usesStacks: true,
        maxStacks: 4,
        stacksPerTrigger: 1,
        requiredStacks: 4,
      };

      system.registerPassive('warrior', definition);

      const passiveState = createDefaultPassiveState();
      passiveState.stacks = 3; // One away from activation

      const champion = createMockChampion('warrior', passiveState);
      const context = createMockContext();

      system.dispatchTrigger('on_ability_cast', champion as any, context as any);

      expect(champion.passiveState.stacks).toBe(4);
      expect(champion.passiveState.isActive).toBe(true);
    });
  });

  describe('on_take_damage_stack handler', () => {
    test('gains stacks on damage taken', () => {
      const definition: PassiveAbilityDefinition = {
        id: 'damage_stack_passive',
        name: 'Damage Stack Passive',
        description: 'Test',
        trigger: 'on_take_damage',
        usesStacks: true,
        maxStacks: 10,
        stacksPerTrigger: 1,
        stackDuration: 4,
        internalCooldown: 0.5,
      };

      system.registerPassive('warrior', definition);

      const champion = createMockChampion('warrior');
      const context = createMockContext();

      system.dispatchTrigger('on_take_damage', champion as any, context as any);

      expect(champion.passiveState.stacks).toBe(1);
      expect(champion.passiveState.cooldownRemaining).toBe(0.5);
    });

    test('applies stat modifiers based on stacks', () => {
      const definition: PassiveAbilityDefinition = {
        id: 'damage_stack_passive',
        name: 'Damage Stack Passive',
        description: 'Test',
        trigger: 'on_take_damage',
        usesStacks: true,
        maxStacks: 10,
        stacksPerTrigger: 1,
        statModifiers: [{ stat: 'armor', flatValue: 5 }],
      };

      system.registerPassive('warrior', definition);

      const champion = createMockChampion('warrior');
      const context = createMockContext();

      system.dispatchTrigger('on_take_damage', champion as any, context as any);

      expect(champion.addModifier).toHaveBeenCalled();
    });
  });
});

describe('PassiveState', () => {
  test('createDefaultPassiveState returns correct defaults', () => {
    const state = createDefaultPassiveState();

    expect(state.isActive).toBe(false);
    expect(state.cooldownRemaining).toBe(0);
    expect(state.stacks).toBe(0);
    expect(state.stackTimeRemaining).toBe(0);
    expect(state.nextIntervalIn).toBe(0);
  });
});
