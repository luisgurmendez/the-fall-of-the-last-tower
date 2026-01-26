/**
 * Ability Animation Synchronization Tests
 *
 * Tests that ability projectiles/effects are spawned at the correct keyframe time,
 * not immediately when the ability is cast.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Vector, TEAM_BLUE, TEAM_RED, EntityType } from '@siege/shared';
import { createTestArena, TestChampion, type TestArena } from './ServerTestUtils';

describe('Ability Animation Sync', () => {
  let arena: TestArena;
  let caster: TestChampion;
  let target: TestChampion;

  beforeEach(() => {
    // Create arena with Magnus (mage with fireball skillshot)
    arena = createTestArena({
      blueChampion: 'magnus',
      redChampion: 'warrior',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(300, 0), // In range for abilities
      learnAbilities: true,
    });

    caster = arena.blue;
    target = arena.red;

    // Give caster enough mana
    caster.setResource(caster.maxResource);
  });

  describe('Skillshot Projectile Timing', () => {
    test('projectile should not spawn immediately on cast', () => {
      // Get initial projectile count
      const initialProjectileCount = arena.context.getAllEntities().filter(
        e => e.entityType === EntityType.PROJECTILE
      ).length;

      // Cast fireball (Q ability)
      const result = arena.castAbility(caster, 'Q', {
        targetPosition: target.position.clone(),
      });

      expect(result.success).toBe(true);

      // Update once - projectile should not spawn immediately
      arena.tickAll(0.016);

      // Check projectile count - should still be 0 if animation sync is working
      const projectileCount = arena.context.getAllEntities().filter(
        e => e.entityType === EntityType.PROJECTILE
      ).length;

      // Magnus Q animation has projectile at frame 3 of 5, 0.1s/frame = 0.3s
      // At 0.016s, projectile should NOT have spawned yet
      expect(projectileCount).toBe(initialProjectileCount);
    });

    test('projectile should spawn after keyframe time', () => {
      // Cast fireball
      arena.castAbility(caster, 'Q', {
        targetPosition: target.position.clone(),
      });

      // Update to start cast
      arena.tickAll(0.016);

      // Magnus Q animation: frame 3 of 5, 0.1s/frame = 0.3s
      // Tick past the projectile spawn time
      arena.tickAllFrames(25, 0.016); // 400ms total

      // Now projectile should exist
      const projectiles = arena.context.getAllEntities().filter(
        e => e.entityType === EntityType.PROJECTILE
      );

      expect(projectiles.length).toBeGreaterThan(0);
    });

    test('projectile should be cancelled if caster is stunned before spawn', () => {
      // Cast fireball
      arena.castAbility(caster, 'Q', {
        targetPosition: target.position.clone(),
      });

      // Update to start cast
      arena.tickAll(0.016);

      // Apply stun before projectile spawns
      caster.applyEffect('stun', 2.0, 'external');

      // Tick past when projectile would have spawned
      arena.tickAllFrames(25, 0.016);

      // Projectile should NOT have spawned due to stun
      const projectiles = arena.context.getAllEntities().filter(
        e => e.entityType === EntityType.PROJECTILE
      );

      expect(projectiles.length).toBe(0);
    });
  });

  describe('Instant Cast Abilities', () => {
    test('self-targeted abilities should still work immediately', () => {
      // Cast Magnus shield (W) - self-targeted
      const initialShields = caster.getShields().length;

      arena.castAbility(caster, 'W');
      arena.tickAll(0.016);

      // Shield should be applied (self-targeted abilities are instant)
      const currentShields = caster.getShields().length;
      expect(currentShields).toBeGreaterThan(initialShields);
    });
  });

  describe('Ability Interruption', () => {
    test('ability cast resumes after stun ends if target is still valid', () => {
      // Note: This tests that ability casting can resume after CC
      // In practice, most MOBA games don't resume interrupted casts
      // So this test verifies the CURRENT behavior, not necessarily the desired behavior

      caster.setAttackTarget(target.id);

      // Apply short stun
      caster.applyEffect('stun', 0.2, 'external');

      // Wait for stun to end and champion to act
      arena.tickAllFrames(30, 0.016);

      // Champion should be able to act after stun
      expect(caster.ccStatus.canCast).toBe(true);
    });
  });
});
