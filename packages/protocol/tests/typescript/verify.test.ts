/**
 * Cross-Language Verification Tests
 *
 * These tests validate that the TypeScript implementation produces
 * identical results to the expected values in the fixture files.
 *
 * Any implementation in Rust, Go, or other languages should produce
 * the same results for these test cases.
 */

import { describe, it, expect } from 'bun:test';
import damageFixtures from '../fixtures/damage_calculations.json';
import statFixtures from '../fixtures/stat_scaling.json';
import xpFixtures from '../fixtures/experience_levels.json';
import respawnFixtures from '../fixtures/respawn_times.json';
import cooldownFixtures from '../fixtures/cooldown_reduction.json';
import goldFixtures from '../fixtures/gold_calculations.json';
import ccFixtures from '../fixtures/crowd_control.json';
import movementFixtures from '../fixtures/movement.json';

// Helper to check if values are within tolerance
function expectWithinTolerance(actual: number, expected: number, tolerance: number = 0.01): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

// ============================================================================
// DAMAGE CALCULATIONS
// ============================================================================

describe('Damage Calculations', () => {
  describe('Damage Reduction from Resistance', () => {
    function calculateDamageReduction(resist: number): number {
      if (resist >= 0) {
        return resist / (100 + resist);
      } else {
        return resist / (100 - resist);
      }
    }

    function calculateDamageMultiplier(resist: number): number {
      const reduction = calculateDamageReduction(resist);
      const multiplier = 1 - reduction;
      // Clamp between 0.1 (90% reduction cap) and 2.0 (100% amplification cap)
      return Math.max(0.1, Math.min(2.0, multiplier));
    }

    const tolerance = damageFixtures.tolerance;

    for (const testCase of damageFixtures.damage_reduction_from_resist.cases) {
      it(`should calculate reduction correctly for resist=${testCase.resist}`, () => {
        expectWithinTolerance(
          calculateDamageReduction(testCase.resist),
          testCase.expected_reduction,
          tolerance
        );
        expectWithinTolerance(
          calculateDamageMultiplier(testCase.resist),
          testCase.expected_multiplier,
          tolerance
        );
      });
    }

    for (const testCase of damageFixtures.damage_multiplier_clamping.cases) {
      it(`should clamp multiplier for resist=${testCase.resist}`, () => {
        expectWithinTolerance(
          calculateDamageMultiplier(testCase.resist),
          testCase.expected_multiplier,
          tolerance
        );
      });
    }
  });

  describe('Physical Damage Calculation', () => {
    function calculatePhysicalDamage(
      rawDamage: number,
      armor: number,
      armorPenPercent: number,
      armorPenFlat: number
    ): number {
      const effectiveArmor = Math.max(0, armor * (1 - armorPenPercent) - armorPenFlat);
      const multiplier = 1 - effectiveArmor / (100 + effectiveArmor);
      return rawDamage * multiplier;
    }

    const tolerance = damageFixtures.tolerance;

    for (const testCase of damageFixtures.physical_damage_calculation.cases) {
      it(`should calculate damage: ${testCase.raw_damage} vs ${testCase.armor} armor`, () => {
        expectWithinTolerance(
          calculatePhysicalDamage(
            testCase.raw_damage,
            testCase.armor,
            testCase.armor_pen_percent,
            testCase.armor_pen_flat
          ),
          testCase.expected_damage,
          tolerance
        );
      });
    }
  });
});

// ============================================================================
// STAT SCALING
// ============================================================================

describe('Stat Scaling', () => {
  describe('Base Stat at Level', () => {
    function calculateStatAtLevel(baseStat: number, growthStat: number, level: number): number {
      return baseStat + growthStat * (level - 1);
    }

    const tolerance = statFixtures.tolerance;

    for (const testCase of statFixtures.base_stat_at_level.cases) {
      it(`should calculate ${testCase.stat_name} at level ${testCase.level}`, () => {
        expectWithinTolerance(
          calculateStatAtLevel(testCase.base_stat, testCase.growth_stat, testCase.level),
          testCase.expected,
          tolerance
        );
      });
    }
  });

  describe('Attack Speed at Level', () => {
    function calculateAttackSpeed(
      baseAttackSpeed: number,
      attackSpeedGrowthPercent: number,
      bonusAttackSpeedPercent: number,
      level: number
    ): number {
      const growthBonus = (attackSpeedGrowthPercent * (level - 1)) / 100;
      const totalBonus = growthBonus + bonusAttackSpeedPercent;
      return baseAttackSpeed * (1 + totalBonus);
    }

    const tolerance = statFixtures.tolerance;

    for (const testCase of statFixtures.attack_speed_at_level.cases) {
      it(`should calculate attack speed at level ${testCase.level}`, () => {
        expectWithinTolerance(
          calculateAttackSpeed(
            testCase.base_attack_speed,
            testCase.attack_speed_growth_percent,
            testCase.bonus_attack_speed_percent,
            testCase.level
          ),
          testCase.expected,
          tolerance
        );
      });
    }
  });

  describe('Final Stat Calculation', () => {
    function calculateFinalStat(
      baseStatAtLevel: number,
      flatBonus: number,
      percentBonus: number
    ): number {
      return (baseStatAtLevel + flatBonus) * (1 + percentBonus);
    }

    const tolerance = statFixtures.tolerance;

    for (const testCase of statFixtures.final_stat_calculation.cases) {
      it(`should calculate final stat with flat=${testCase.flat_bonus}, percent=${testCase.percent_bonus}`, () => {
        expectWithinTolerance(
          calculateFinalStat(testCase.base_stat_at_level, testCase.flat_bonus, testCase.percent_bonus),
          testCase.expected,
          tolerance
        );
      });
    }
  });
});

// ============================================================================
// EXPERIENCE AND LEVELS
// ============================================================================

describe('Experience and Levels', () => {
  const LEVEL_THRESHOLDS = xpFixtures.level_thresholds.thresholds.map(t => t.xp_required);

  describe('Level from Experience', () => {
    function calculateLevel(experience: number): number {
      for (let level = LEVEL_THRESHOLDS.length; level >= 1; level--) {
        if (experience >= LEVEL_THRESHOLDS[level - 1]) {
          return level;
        }
      }
      return 1;
    }

    for (const testCase of xpFixtures.level_from_experience.cases) {
      it(`should return level ${testCase.expected_level} for XP ${testCase.experience}`, () => {
        expect(calculateLevel(testCase.experience)).toBe(testCase.expected_level);
      });
    }
  });

  describe('Experience Sharing', () => {
    function calculateSharedXP(baseXP: number, championsInRange: number): number {
      return baseXP / championsInRange;
    }

    for (const testCase of xpFixtures.experience_sharing.cases) {
      it(`should split ${testCase.base_xp} XP among ${testCase.champions_in_range} champions`, () => {
        expect(calculateSharedXP(testCase.base_xp, testCase.champions_in_range))
          .toBe(testCase.expected_xp_each);
      });
    }
  });
});

// ============================================================================
// RESPAWN TIMES
// ============================================================================

describe('Respawn Times', () => {
  const { base_respawn_time_seconds, respawn_time_per_level_seconds, max_respawn_time_seconds } =
    respawnFixtures.constants;

  function calculateRespawnTime(level: number): number {
    const time = base_respawn_time_seconds + respawn_time_per_level_seconds * (level - 1);
    return Math.min(time, max_respawn_time_seconds);
  }

  for (const testCase of respawnFixtures.respawn_timer_calculation.cases) {
    it(`should calculate ${testCase.expected_seconds}s respawn for level ${testCase.level}`, () => {
      expect(calculateRespawnTime(testCase.level)).toBe(testCase.expected_seconds);
    });
  }
});

// ============================================================================
// COOLDOWN REDUCTION
// ============================================================================

describe('Cooldown Reduction (Ability Haste)', () => {
  const tolerance = cooldownFixtures.tolerance;

  describe('Ability Haste to CDR', () => {
    function calculateCDR(abilityHaste: number): number {
      return abilityHaste / (100 + abilityHaste);
    }

    for (const testCase of cooldownFixtures.ability_haste_to_cdr.cases) {
      it(`should convert ${testCase.ability_haste} AH to ${testCase.expected_cdr} CDR`, () => {
        expectWithinTolerance(
          calculateCDR(testCase.ability_haste),
          testCase.expected_cdr,
          tolerance
        );
      });
    }
  });

  describe('Actual Cooldown', () => {
    function calculateActualCooldown(baseCooldown: number, abilityHaste: number): number {
      return baseCooldown * (100 / (100 + abilityHaste));
    }

    for (const testCase of cooldownFixtures.actual_cooldown_calculation.cases) {
      it(`should reduce ${testCase.base_cooldown}s CD with ${testCase.ability_haste} AH`, () => {
        expectWithinTolerance(
          calculateActualCooldown(testCase.base_cooldown, testCase.ability_haste),
          testCase.expected_cooldown,
          tolerance
        );
      });
    }
  });
});

// ============================================================================
// GOLD CALCULATIONS
// ============================================================================

describe('Gold Calculations', () => {
  const tolerance = goldFixtures.tolerance;
  const { base_kill_gold, bounty_per_kill_above_2, assist_percent } = goldFixtures.constants;

  describe('Champion Kill Gold', () => {
    function calculateKillGold(killerKillStreak: number): number {
      if (killerKillStreak >= 3) {
        return base_kill_gold + bounty_per_kill_above_2 * (killerKillStreak - 2);
      }
      return base_kill_gold;
    }

    for (const testCase of goldFixtures.champion_kill_gold.cases) {
      it(`should calculate ${testCase.expected_gold}g for ${testCase.killer_kill_streak} kill streak`, () => {
        expect(calculateKillGold(testCase.killer_kill_streak)).toBe(testCase.expected_gold);
      });
    }
  });

  describe('Assist Gold', () => {
    function calculateAssistGold(killGold: number, numAssists: number): number {
      return (killGold * assist_percent) / numAssists;
    }

    for (const testCase of goldFixtures.assist_gold.cases) {
      it(`should split ${testCase.kill_gold}g among ${testCase.num_assists} assists`, () => {
        expectWithinTolerance(
          calculateAssistGold(testCase.kill_gold, testCase.num_assists),
          testCase.expected_gold_each,
          tolerance
        );
      });
    }
  });
});

// ============================================================================
// CROWD CONTROL
// ============================================================================

describe('Crowd Control', () => {
  const tolerance = ccFixtures.tolerance;
  const { minimum_cc_duration_seconds } = ccFixtures.constants;

  describe('Tenacity Calculation', () => {
    function calculateCCDuration(baseDuration: number, tenacity: number): number {
      const reducedDuration = baseDuration * (1 - tenacity);
      return Math.max(reducedDuration, minimum_cc_duration_seconds);
    }

    for (const testCase of ccFixtures.tenacity_calculation.cases) {
      it(`should reduce ${testCase.base_duration}s CC with ${testCase.tenacity * 100}% tenacity`, () => {
        expectWithinTolerance(
          calculateCCDuration(testCase.base_duration, testCase.tenacity),
          testCase.expected_duration,
          tolerance
        );
      });
    }
  });
});

// ============================================================================
// MOVEMENT
// ============================================================================

describe('Movement', () => {
  const tolerance = movementFixtures.tolerance;
  const { minimum_movement_speed } = movementFixtures.constants;

  describe('Slow Calculation', () => {
    function calculateEffectiveSpeed(baseSpeed: number, slows: number[]): number {
      const strongestSlow = Math.max(...slows);
      const effectiveSpeed = baseSpeed * (1 - strongestSlow);
      return Math.max(effectiveSpeed, minimum_movement_speed);
    }

    for (const testCase of movementFixtures.slow_calculation.cases) {
      it(`should apply strongest slow from [${testCase.slows}]`, () => {
        expectWithinTolerance(
          calculateEffectiveSpeed(testCase.base_speed, testCase.slows),
          testCase.expected_speed,
          tolerance
        );
      });
    }
  });

  describe('Movement Per Tick', () => {
    function calculateDistance(movementSpeed: number, deltaTime: number): number {
      return movementSpeed * deltaTime;
    }

    for (const testCase of movementFixtures.movement_per_tick.cases) {
      it(`should move ${testCase.expected_distance} units at ${testCase.movement_speed} speed`, () => {
        expectWithinTolerance(
          calculateDistance(testCase.movement_speed, testCase.delta_time_seconds),
          testCase.expected_distance,
          tolerance
        );
      });
    }
  });

  describe('Attack Cooldown', () => {
    function calculateAttackCooldown(attackSpeed: number): number {
      return 1 / attackSpeed;
    }

    for (const testCase of movementFixtures.attack_cooldown.cases) {
      it(`should calculate ${testCase.expected_cooldown}s cooldown for ${testCase.attack_speed} AS`, () => {
        expectWithinTolerance(
          calculateAttackCooldown(testCase.attack_speed),
          testCase.expected_cooldown,
          tolerance
        );
      });
    }
  });
});
