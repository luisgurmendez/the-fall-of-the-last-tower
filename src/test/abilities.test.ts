/**
 * Ability system tests.
 * Tests ability casting, scaling, and effects.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Vector from '@/physics/vector';
import { createTestArena, TestDummy, calculateExpectedPhysicalDamage } from './ChampionTestUtils';
import { createTestGameContext } from './TestGameContext';

// Import effect system
import { CastAbilityDescriptor } from '@/abilities/CastAbilityDescriptor';
import AbilityCost from '@/abilities/AbilityCost';
import { SelfTargetAbilityTargetDescription, SingleTargetInRangeAbilityTargetDescription } from '@/abilities/AbilityTargetDescription';
import { SemiImmediateEffect, DurationEffect, EffectTargetType } from '@/effects/EffectDescriptor';
import { ScalingDamageEffect, ScalingHealEffect, ScalingStatBuffEffect } from '@/effects/ScalingEffect';
import { DamageEffect, HealEffect } from '@/effects/StatEffect';

describe('Ability System', () => {
  describe('CastAbilityDescriptor', () => {
    it('should track ability rank', () => {
      const ability = new CastAbilityDescriptor({
        name: 'Test Ability',
        description: 'A test ability',
        cost: new AbilityCost({ energy: 50 }),
        target: new SelfTargetAbilityTargetDescription(),
        effects: [],
        castTime: 0,
        cooldown: 5,
      });

      expect(ability.rank).toBe(0);
      expect(ability.isLearned()).toBe(false);

      ability.rankUp();

      expect(ability.rank).toBe(1);
      expect(ability.isLearned()).toBe(true);
    });

    it('should respect max rank', () => {
      const ability = new CastAbilityDescriptor({
        name: 'Test Ability',
        description: 'A test ability',
        cost: new AbilityCost({ energy: 50 }),
        target: new SelfTargetAbilityTargetDescription(),
        effects: [],
        castTime: 0,
        cooldown: 5,
        maxRank: 3,
      });

      expect(ability.canRankUp()).toBe(true);
      ability.rankUp();
      ability.rankUp();
      ability.rankUp();

      expect(ability.rank).toBe(3);
      expect(ability.canRankUp()).toBe(false);
      expect(ability.rankUp()).toBe(false); // Can't rank up beyond max
    });

    it('should scale cooldown with rank', () => {
      const ability = new CastAbilityDescriptor({
        name: 'Test Ability',
        description: 'A test ability',
        cost: new AbilityCost({ energy: 50 }),
        target: new SelfTargetAbilityTargetDescription(),
        effects: [],
        castTime: 0,
        cooldown: 10,
        cooldownPerRank: [10, 9, 8, 7, 6],
      });

      expect(ability.cooldown).toBe(10); // Base cooldown when rank 0

      ability.rankUp(); // Rank 1
      expect(ability.cooldown).toBe(10);

      ability.rankUp(); // Rank 2
      expect(ability.cooldown).toBe(9);

      ability.rankUp(); // Rank 3
      expect(ability.cooldown).toBe(8);
    });
  });

  describe('Scaling Effects', () => {
    it('should calculate scaled damage based on rank', () => {
      const { ally, enemy, context } = createTestArena();

      const damageAbility = new CastAbilityDescriptor({
        name: 'Damage Test',
        description: 'Deals scaling damage',
        cost: new AbilityCost({ energy: 50 }),
        target: new SingleTargetInRangeAbilityTargetDescription(500),
        effects: [
          new SemiImmediateEffect(
            new ScalingDamageEffect({
              base: [50, 100, 150, 200, 250],
              adRatio: 0.5,
            }, 'physical'),
            EffectTargetType.enemy
          ),
        ],
        castTime: 0,
        cooldown: 5,
      });

      damageAbility.setOwner(ally);
      damageAbility.rankUp(); // Rank 1

      const initialHealth = enemy.getCurrentHealth();
      const result = damageAbility.cast(context, enemy);

      expect(result.success).toBe(true);

      // Calculate expected damage:
      // base[0] = 50, adRatio = 0.5, ally AD = 50
      // Raw damage = 50 + (50 * 0.5) = 75
      // After armor (30): 75 * (100 / 130) ≈ 57.69
      const expectedRaw = 50 + (ally.getStats().attackDamage * 0.5);
      const expectedDamage = calculateExpectedPhysicalDamage(expectedRaw, enemy.getStats().armor);

      expect(enemy.getCurrentHealth()).toBeCloseTo(initialHealth - expectedDamage, 0);
    });

    it('should scale damage with higher ranks', () => {
      const { ally, enemy, context } = createTestArena();

      const damageAbility = new CastAbilityDescriptor({
        name: 'Damage Test',
        description: 'Deals scaling damage',
        cost: new AbilityCost({ energy: 50 }),
        target: new SingleTargetInRangeAbilityTargetDescription(500),
        effects: [
          new SemiImmediateEffect(
            new ScalingDamageEffect({
              base: [50, 100, 150, 200, 250],
            }, 'true'), // True damage for easier calculation
            EffectTargetType.enemy
          ),
        ],
        castTime: 0,
        cooldown: 5,
      });

      damageAbility.setOwner(ally);
      damageAbility.rankUp(); // Rank 1

      // Rank 1 damage
      const initialHealth1 = enemy.getCurrentHealth();
      damageAbility.cast(context, enemy);
      const damage1 = initialHealth1 - enemy.getCurrentHealth();
      expect(damage1).toBe(50);

      // Reset cooldown and heal enemy
      enemy.setHealth(1000);

      // Rank up
      damageAbility.rankUp(); // Rank 2
      damageAbility.reset(); // Use reset() method

      // Rank 2 damage
      const initialHealth2 = enemy.getCurrentHealth();
      damageAbility.cast(context, enemy);
      const damage2 = initialHealth2 - enemy.getCurrentHealth();
      expect(damage2).toBe(100);
    });

    it('should apply scaling stat buffs', () => {
      const { ally, context } = createTestArena();

      const buffAbility = new CastAbilityDescriptor({
        name: 'Buff Test',
        description: 'Increases attack speed',
        cost: new AbilityCost({ energy: 50 }),
        target: new SelfTargetAbilityTargetDescription(),
        effects: [
          new DurationEffect(
            new ScalingStatBuffEffect(
              'attackSpeed',
              { base: [0.2, 0.3, 0.4, 0.5, 0.6] },
              5,
              true // isPercent
            ),
            EffectTargetType.self,
            5
          ),
        ],
        castTime: 0,
        cooldown: 10,
      });

      buffAbility.setOwner(ally);
      buffAbility.rankUp(); // Rank 1

      const baseAS = ally.getStats().attackSpeed;
      buffAbility.cast(context);

      // Should have +20% attack speed
      const expectedAS = baseAS * 1.2;
      expect(ally.getStats().attackSpeed).toBeCloseTo(expectedAS, 2);
    });
  });

  describe('Ability Casting', () => {
    it('should require learning ability before casting', () => {
      const { ally, context } = createTestArena();

      const ability = new CastAbilityDescriptor({
        name: 'Test Ability',
        description: 'A test ability',
        cost: new AbilityCost({ energy: 50 }),
        target: new SelfTargetAbilityTargetDescription(),
        effects: [],
        castTime: 0,
        cooldown: 5,
      });

      ability.setOwner(ally);

      // Should fail - not learned (implementation returns 'invalid_target')
      const result = ability.cast(context as any);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_target'); // Implementation detail
    });

    it('should fail if on cooldown', () => {
      const { ally, context } = createTestArena();

      const ability = new CastAbilityDescriptor({
        name: 'Test Ability',
        description: 'A test ability',
        cost: new AbilityCost({ energy: 50 }),
        target: new SelfTargetAbilityTargetDescription(),
        effects: [],
        castTime: 0,
        cooldown: 5,
      });

      ability.setOwner(ally);
      ability.rankUp();

      // First cast should succeed
      const result1 = ability.cast(context);
      expect(result1.success).toBe(true);

      // Second cast should fail - on cooldown
      const result2 = ability.cast(context);
      expect(result2.success).toBe(false);
      expect(result2.reason).toBe('on_cooldown');
    });

    it('should fail if insufficient resources', () => {
      const { ally, context } = createTestArena();

      const ability = new CastAbilityDescriptor({
        name: 'Expensive Ability',
        description: 'Costs a lot of energy',
        cost: new AbilityCost({ energy: 9999 }), // Use energy, not mana
        target: new SelfTargetAbilityTargetDescription(),
        effects: [],
        castTime: 0,
        cooldown: 5,
      });

      ability.setOwner(ally);
      ability.rankUp();

      const result = ability.cast(context as any);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_enough_resource');
    });

    it('should fail if target out of range', () => {
      const { ally, enemy, context } = createTestArena({
        enemyPosition: new Vector(1000, 0), // Far away
      });

      const ability = new CastAbilityDescriptor({
        name: 'Short Range',
        description: 'Short range ability',
        cost: new AbilityCost({ energy: 50 }),
        target: new SingleTargetInRangeAbilityTargetDescription(200),
        effects: [
          new SemiImmediateEffect(new DamageEffect(50, 'physical'), EffectTargetType.enemy),
        ],
        castTime: 0,
        cooldown: 5,
      });

      ability.setOwner(ally);
      ability.rankUp();

      const result = ability.cast(context as any, enemy);
      expect(result.success).toBe(false);
      // Implementation returns 'invalid_target' for out-of-range (target validation failed)
      expect(result.reason).toBe('invalid_target');
    });
  });
});
