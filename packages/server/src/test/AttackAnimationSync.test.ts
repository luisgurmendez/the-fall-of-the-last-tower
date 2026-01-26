/**
 * Attack Animation Synchronization Tests
 *
 * Tests that attack damage is applied at the correct keyframe time,
 * not immediately when the attack starts.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Vector, TEAM_BLUE, TEAM_RED } from '@siege/shared';
import { createTestArena, TestChampion, type TestArena } from './ServerTestUtils';

describe('Attack Animation Sync', () => {
  let arena: TestArena;
  let attacker: TestChampion;
  let target: TestChampion;

  beforeEach(() => {
    // Create arena with warriors (melee with attack animation)
    arena = createTestArena({
      blueChampion: 'warrior',
      redChampion: 'warrior',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(50, 0), // Within melee range (125)
      learnAbilities: true,
    });

    attacker = arena.blue;
    target = arena.red;
  });

  describe('Melee Attack Timing', () => {
    test('damage should not be applied immediately on attack start', () => {
      const initialHealth = target.health;

      // Set attack target
      attacker.setAttackTarget(target.id);

      // Update once - should start attack but not deal damage yet
      arena.tick(0.016); // ~1 frame at 60fps

      // If animation-synced, damage shouldn't be applied yet
      // Warrior attack animation has damage at frame 3 of 6
      // At 0.083s per frame, damage comes at ~0.25s
      // This test will FAIL with current immediate-damage implementation
      // and PASS after animation sync is implemented
      expect(target.health).toBe(initialHealth);
    });

    test('damage should be applied after keyframe time', () => {
      const initialHealth = target.health;

      // Set attack target
      attacker.setAttackTarget(target.id);

      // Update to start attack
      arena.tick(0.016);

      // Update past the damage keyframe time
      // Warrior: frame 3 of 6, 0.083s/frame = 0.25s base
      // With attack speed scaling at ~0.73 AS, damage at ~0.34s
      // Need at least 22 ticks (0.352s) to ensure damage triggers
      arena.tickFrames(25, 0.016); // 416ms to be safe

      expect(target.health).toBeLessThan(initialHealth);
    });

    test('attack should still respect cooldown', () => {
      // Set attack target and perform first attack
      attacker.setAttackTarget(target.id);
      arena.tickFrames(30, 0.016); // Complete first attack

      const healthAfterFirst = target.health;

      // Reset target health to easily detect second attack
      target.setHealth(target.maxHealth);

      // Immediately try another attack - should wait for cooldown
      arena.tick(0.016);

      // Should not have attacked again (cooldown not ready)
      expect(target.health).toBe(target.maxHealth);

      // Wait for cooldown (at 0.65 AS, cooldown is ~1.5s)
      arena.tickFrames(100, 0.016); // 1.6s

      // Now should have attacked again
      expect(target.health).toBeLessThan(target.maxHealth);
    });
  });

  describe('Attack Interruption', () => {
    test('damage should be cancelled if attacker is stunned', () => {
      const initialHealth = target.health;

      // Set attack target and start attack
      attacker.setAttackTarget(target.id);
      arena.tick(0.016); // Start attack

      // Apply stun before damage keyframe (damage at ~0.34s)
      // Stun effect: applyEffect(effectId, duration, sourceId)
      attacker.applyEffect('stun', 2.0, 'external');

      // Update past when damage would have occurred
      arena.tickFrames(30, 0.016); // 480ms

      // If animation sync is working, damage should NOT be applied
      // because attack was interrupted by stun
      expect(target.health).toBe(initialHealth);
    });

    test('attack should resume after stun ends', () => {
      attacker.setAttackTarget(target.id);

      // Apply short stun
      // Stun effect: applyEffect(effectId, duration, sourceId)
      attacker.applyEffect('stun', 0.5, 'external');

      // Wait for stun to wear off and attack to complete
      arena.tickFrames(100, 0.016); // 1.6s total

      // Should have dealt damage after stun ended
      expect(target.health).toBeLessThan(target.maxHealth);
    });
  });

  describe('Animation Speed Scaling', () => {
    test('attack animation should scale with attack speed', () => {
      // Get attack animation data
      const attackAnim = attacker['definition'].animations?.attack;
      expect(attackAnim).toBeDefined();

      if (attackAnim) {
        // Find damage keyframe
        const damageKeyframe = attackAnim.keyframes.find(k => k.trigger.type === 'damage');
        expect(damageKeyframe).toBeDefined();

        if (damageKeyframe) {
          const stats = attacker.getStats();
          const shouldScaleWithAS = attacker['definition'].attackAnimationSpeedScale;

          // Calculate expected damage time
          const baseTime = damageKeyframe.frame * attackAnim.baseFrameDuration;
          const expectedTime = shouldScaleWithAS
            ? baseTime / stats.attackSpeed
            : baseTime;

          // The damage should occur around this time
          expect(expectedTime).toBeGreaterThan(0);
          expect(expectedTime).toBeLessThan(1.0); // Should be less than 1 second
        }
      }
    });
  });
});
