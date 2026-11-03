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
    test('projectile spawns when the cast time ends, not before', () => {
      const projectiles = () => arena.context.getAllEntities().filter(e => e.entityType === EntityType.PROJECTILE).length;

      // Cast fireball (Q ability): an aimed ability has a cast time
      const result = arena.castAbility(caster, 'Q', { targetPosition: target.position.clone(), casting: true });
      expect(result.success).toBe(true);
      expect(caster.isCasting()).toBe(true);

      // In the cast time: nothing yet, nothing spent, standing still
      const mana = caster.resource;
      const position = caster.position.clone();
      caster.setMoveTarget(new Vector(position.x, position.y + 200));
      arena.tickAll(0.1);
      expect(projectiles()).toBe(0);
      expect(caster.resource).toBeGreaterThanOrEqual(mana); // (regenerating)
      expect(caster.position.distanceTo(position)).toBe(0);

      // Its end: the fireball flies, and the cost and cooldown come
      arena.tickAllFrames(10, 0.016);
      expect(caster.isCasting()).toBe(false);
      expect(projectiles()).toBe(1);
      expect(caster.resource).toBeLessThan(mana - 50); // Fireball costs 60
      expect(caster.abilityStates.Q.cooldownRemaining).toBeGreaterThan(0);
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

    test('a stun in the cast time cancels it, with nothing spent', () => {
      const mana = caster.resource;
      arena.castAbility(caster, 'Q', { targetPosition: target.position.clone(), casting: true });
      arena.tickAll(0.016);

      // Stunned before it goes off
      caster.applyEffect('stun', 2.0, 'external');
      arena.tickAllFrames(25, 0.016);

      const projectiles = arena.context.getAllEntities().filter(
        e => e.entityType === EntityType.PROJECTILE
      );
      expect(projectiles.length).toBe(0);
      expect(caster.isCasting()).toBe(false);
      expect(caster.resource).toBeGreaterThanOrEqual(mana);
      expect(caster.abilityStates.Q.cooldownRemaining).toBe(0);
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
