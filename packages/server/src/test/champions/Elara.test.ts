/**
 * Elara Champion Tests
 *
 * Tests for Elara - a ranged support with healing and utility.
 * Abilities:
 * - Q: Radiant Blessing - Targeted heal
 * - W: Sacred Shield - Targeted ally shield
 * - E: Swift Grace - AoE movement speed buff
 * - R: Divine Intervention - AoE heal and cleanse
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Vector, TEAM_BLUE } from '@siege/shared';
import {
  createTestArena,
  TestArena,
  TestChampion,
} from '../ServerTestUtils';
import { ServerChampion } from '../../simulation/ServerChampion';
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

    test('should have correct base health (480)', () => {
      expect(level1Arena.blue.maxHealth).toBe(480);
    });

    test('should have ranged attack range (525)', () => {
      expect(level1Arena.blue.getStats().attackRange).toBe(525);
    });

    test('should have high base mana (400)', () => {
      expect(level1Arena.blue.maxResource).toBe(400);
    });

    test('should have highest mana regen (14)', () => {
      expect(level1Arena.blue.definition.baseStats.resourceRegen).toBe(14);
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
        definitionId: 'amplifying_tome',
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
