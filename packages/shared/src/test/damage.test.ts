/**
 * Comprehensive Damage Calculation Tests
 *
 * These tests verify the correctness of damage calculations which are
 * critical for game balance and must be identical across all implementations.
 */

import { describe, it, expect } from 'bun:test';
import {
  calculateDamageReduction,
  calculateDamage,
  calculatePhysicalDamage,
  calculateMagicDamage,
  calculateCritDamage,
  rollCrit,
  calculateLifesteal,
} from '../utils/damage';

// Helper for floating point comparisons
function expectClose(actual: number, expected: number, tolerance = 0.01): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('Damage Calculations', () => {
  describe('calculateDamageReduction', () => {
    describe('positive resistances', () => {
      it('should return 1.0 for 0 resist (no reduction)', () => {
        expectClose(calculateDamageReduction(0), 1.0);
      });

      it('should return ~0.667 for 50 resist (33% reduction)', () => {
        expectClose(calculateDamageReduction(50), 0.667, 0.01);
      });

      it('should return 0.5 for 100 resist (50% reduction)', () => {
        expectClose(calculateDamageReduction(100), 0.5);
      });

      it('should return ~0.333 for 200 resist (67% reduction)', () => {
        expectClose(calculateDamageReduction(200), 0.333, 0.01);
      });

      it('should return ~0.25 for 300 resist (75% reduction)', () => {
        expectClose(calculateDamageReduction(300), 0.25);
      });

      it('should cap at 90% reduction for very high resist', () => {
        // With 900 resist, uncapped would be 0.09 (91% reduction)
        // Should cap at 0.1 (90% reduction)
        const result = calculateDamageReduction(900);
        // Use tolerance for floating point comparison
        expectClose(result, 0.1, 0.001);
      });

      it('should handle edge case of 1 resist', () => {
        const result = calculateDamageReduction(1);
        expect(result).toBeLessThan(1.0);
        expect(result).toBeGreaterThan(0.98);
      });
    });

    describe('negative resistances (damage amplification)', () => {
      it('should amplify damage for negative resist', () => {
        const result = calculateDamageReduction(-25);
        expect(result).toBeGreaterThan(1.0);
      });

      it('should return ~1.2 for -25 resist', () => {
        expectClose(calculateDamageReduction(-25), 1.2, 0.01);
      });

      it('should return ~1.333 for -50 resist', () => {
        expectClose(calculateDamageReduction(-50), 1.333, 0.01);
      });

      it('should return ~1.5 for -100 resist', () => {
        expectClose(calculateDamageReduction(-100), 1.5, 0.01);
      });

      it('should approach 2.0 for very negative resist', () => {
        const result = calculateDamageReduction(-500);
        expect(result).toBeGreaterThan(1.8);
        expect(result).toBeLessThanOrEqual(2.0);
      });
    });

    describe('boundary cases', () => {
      it('should handle very small positive resist', () => {
        const result = calculateDamageReduction(0.001);
        expect(result).toBeLessThan(1.0);
        expect(result).toBeGreaterThan(0.99);
      });

      it('should handle very small negative resist', () => {
        const result = calculateDamageReduction(-0.001);
        expect(result).toBeGreaterThan(1.0);
        expect(result).toBeLessThan(1.01);
      });
    });
  });

  describe('calculateDamage', () => {
    describe('basic damage calculation', () => {
      it('should deal full damage with 0 resist', () => {
        expectClose(calculateDamage(100, 0), 100);
      });

      it('should deal half damage with 100 resist', () => {
        expectClose(calculateDamage(100, 100), 50);
      });

      it('should clamp negative resist to 0 (no amplification in calculateDamage)', () => {
        // Note: calculateDamage clamps effectiveResist to 0
        // Negative resist amplification is only in calculateDamageReduction
        const result = calculateDamage(100, -100);
        // Effective resist becomes 0, so full damage
        expectClose(result, 100);
      });

      it('should scale linearly with raw damage', () => {
        const damage100 = calculateDamage(100, 50);
        const damage200 = calculateDamage(200, 50);
        expectClose(damage200, damage100 * 2);
      });
    });

    describe('penetration mechanics', () => {
      describe('flat penetration', () => {
        it('should reduce effective resist by flat amount', () => {
          // 100 armor - 20 flat pen = 80 effective armor
          const withPen = calculateDamage(100, 100, 20, 0);
          const withoutPen = calculateDamage(100, 80, 0, 0);
          expectClose(withPen, withoutPen);
        });

        it('should not reduce resist below 0', () => {
          // 50 armor - 100 flat pen should act like 0 armor
          const result = calculateDamage(100, 50, 100, 0);
          expectClose(result, 100);
        });

        it('should be additive', () => {
          const result1 = calculateDamage(100, 100, 10, 0);
          const result2 = calculateDamage(100, 90, 0, 0);
          expectClose(result1, result2);
        });
      });

      describe('percent penetration', () => {
        it('should reduce effective resist by percentage', () => {
          // 100 armor * (1 - 0.35) = 65 effective armor
          const withPen = calculateDamage(100, 100, 0, 0.35);
          const withoutPen = calculateDamage(100, 65, 0, 0);
          expectClose(withPen, withoutPen);
        });

        it('should handle 100% penetration', () => {
          const result = calculateDamage(100, 200, 0, 1.0);
          expectClose(result, 100);
        });

        it('should handle 0% penetration', () => {
          const result = calculateDamage(100, 100, 0, 0);
          expectClose(result, 50);
        });
      });

      describe('combined penetration (order matters)', () => {
        it('should apply percent pen before flat pen', () => {
          // 100 armor * (1 - 0.35) - 20 = 45 effective armor
          const result = calculateDamage(100, 100, 20, 0.35);
          const expected = calculateDamage(100, 45, 0, 0);
          expectClose(result, expected);
        });

        it('should maximize damage with both pen types', () => {
          const noPen = calculateDamage(100, 100, 0, 0);
          const flatOnly = calculateDamage(100, 100, 20, 0);
          const percentOnly = calculateDamage(100, 100, 0, 0.35);
          const both = calculateDamage(100, 100, 20, 0.35);

          expect(flatOnly).toBeGreaterThan(noPen);
          expect(percentOnly).toBeGreaterThan(noPen);
          expect(both).toBeGreaterThan(flatOnly);
          expect(both).toBeGreaterThan(percentOnly);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle 0 raw damage', () => {
        expectClose(calculateDamage(0, 100), 0);
      });

      it('should handle very large damage numbers', () => {
        const result = calculateDamage(999999, 100);
        expectClose(result, 499999.5);
      });

      it('should handle very large resist numbers', () => {
        const result = calculateDamage(100, 10000);
        // At least ~10% due to cap (use tolerance for floating point)
        expectClose(result, 10, 0.01);
      });
    });
  });

  describe('calculatePhysicalDamage', () => {
    it('should be identical to calculateDamage for physical', () => {
      const generic = calculateDamage(100, 50, 10, 0.2);
      const physical = calculatePhysicalDamage(100, 50, 10, 0.2);
      expectClose(physical, generic);
    });
  });

  describe('calculateMagicDamage', () => {
    it('should be identical to calculateDamage for magic', () => {
      const generic = calculateDamage(100, 50, 10, 0.2);
      const magic = calculateMagicDamage(100, 50, 10, 0.2);
      expectClose(magic, generic);
    });
  });

  describe('calculateCritDamage', () => {
    it('should double damage with default 2.0 multiplier', () => {
      expectClose(calculateCritDamage(100), 200);
    });

    it('should apply custom multiplier', () => {
      expectClose(calculateCritDamage(100, 2.25), 225);
    });

    it('should handle 0 base damage', () => {
      expectClose(calculateCritDamage(0), 0);
    });

    it('should work with large damage values', () => {
      expectClose(calculateCritDamage(1000, 2.0), 2000);
    });
  });

  describe('rollCrit', () => {
    it('should always return true at 100% crit chance', () => {
      expect(rollCrit(1.0, () => 0.99)).toBe(true);
    });

    it('should always return false at 0% crit chance', () => {
      expect(rollCrit(0, () => 0.01)).toBe(false);
    });

    it('should crit when roll is below chance', () => {
      expect(rollCrit(0.5, () => 0.3)).toBe(true);
    });

    it('should not crit when roll is above chance', () => {
      expect(rollCrit(0.5, () => 0.7)).toBe(false);
    });

    it('should clamp crit chance above 1', () => {
      expect(rollCrit(1.5, () => 0.99)).toBe(true);
    });

    it('should clamp crit chance below 0', () => {
      expect(rollCrit(-0.5, () => 0.01)).toBe(false);
    });

    it('should handle boundary at exact crit chance', () => {
      // At exactly 0.5 roll, 0.5 chance should NOT crit (< not <=)
      expect(rollCrit(0.5, () => 0.5)).toBe(false);
    });
  });

  describe('calculateLifesteal', () => {
    it('should return correct healing amount', () => {
      expectClose(calculateLifesteal(100, 0.15), 15);
    });

    it('should handle 0% lifesteal', () => {
      expectClose(calculateLifesteal(100, 0), 0);
    });

    it('should handle 100% lifesteal', () => {
      expectClose(calculateLifesteal(100, 1.0), 100);
    });

    it('should handle 0 damage', () => {
      expectClose(calculateLifesteal(0, 0.15), 0);
    });

    it('should scale linearly with damage', () => {
      const heal50 = calculateLifesteal(50, 0.2);
      const heal100 = calculateLifesteal(100, 0.2);
      expectClose(heal100, heal50 * 2);
    });
  });
});

describe('Damage Calculation Integration', () => {
  it('should calculate full combat scenario correctly', () => {
    // Scenario: 200 AD, target has 100 armor, attacker has 20 flat + 35% armor pen
    // Crit happens, 15% lifesteal

    const rawDamage = 200;
    const armor = 100;
    const flatPen = 20;
    const percentPen = 0.35;
    const critMultiplier = 2.0;
    const lifestealPercent = 0.15;

    // Calculate damage
    const preCritDamage = calculatePhysicalDamage(rawDamage, armor, flatPen, percentPen);
    const postCritDamage = calculateCritDamage(preCritDamage, critMultiplier);
    const healing = calculateLifesteal(postCritDamage, lifestealPercent);

    // Verify
    // Effective armor: 100 * (1 - 0.35) - 20 = 45
    // Damage multiplier: 1 - 45/(100+45) = 1 - 0.31 = 0.69
    // Pre-crit damage: 200 * 0.69 ≈ 138
    // Post-crit damage: 138 * 2 = 276
    // Healing: 276 * 0.15 ≈ 41.4

    expect(preCritDamage).toBeGreaterThan(130);
    expect(preCritDamage).toBeLessThan(145);
    expect(postCritDamage).toBeGreaterThan(260);
    expect(postCritDamage).toBeLessThan(290);
    expect(healing).toBeGreaterThan(39);
    expect(healing).toBeLessThan(44);
  });

  it('should handle tank vs tank scenario', () => {
    // Low damage, high armor
    const damage = calculatePhysicalDamage(50, 300, 0, 0);
    // Should deal very little damage
    expect(damage).toBeGreaterThan(10);
    expect(damage).toBeLessThan(20);
  });

  it('should handle assassin vs squishy scenario', () => {
    // High damage, low armor, high pen
    const damage = calculatePhysicalDamage(300, 30, 18, 0);
    // Should deal nearly full damage
    expect(damage).toBeGreaterThan(250);
    expect(damage).toBeLessThan(300);
  });
});
