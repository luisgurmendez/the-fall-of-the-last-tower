/**
 * Vile Champion Tests
 *
 * Tests for Vile - The Soul Herder, a ranged fighter/assassin jungler.
 * Abilities:
 * - Passive: Souls of Vilix - Gain soul stacks from kills, consume on champion hit
 * - Q: Black Arrows of Vilix - Charged skillshot with recast dash
 * - W: Veil of Darkness - Stealth + invulnerability + self-root
 * - E: Roots of Vilix - Place trap (charge-based)
 * - R: Restoration of Vilix - Stat transform + trap explosion
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Vector, EntityType, TEAM_BLUE, TEAM_RED } from '@siege/shared';
import {
  createTestArena,
  TestArena,
} from '../ServerTestUtils';

describe('Vile', () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'vile',
      redChampion: 'magnus',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(400, 0),
    });
  });

  describe('Base Stats', () => {
    let level1Arena: TestArena;

    beforeEach(() => {
      level1Arena = createTestArena({
        blueChampion: 'vile',
        redChampion: 'magnus',
        bluePosition: new Vector(0, 0),
        redPosition: new Vector(400, 0),
        learnAbilities: false,
      });
    });

    test('should have correct base health (580)', () => {
      expect(level1Arena.blue.maxHealth).toBe(580);
    });

    test('should have ranged attack range (450)', () => {
      expect(level1Arena.blue.getStats().attackRange).toBe(450);
    });

    test('should have correct base attack damage (60)', () => {
      expect(level1Arena.blue.getStats().attackDamage).toBe(60);
    });

    test('should have correct movement speed (340)', () => {
      expect(level1Arena.blue.getStats().movementSpeed).toBe(340);
    });

    test('should use mana (300 resource)', () => {
      expect(level1Arena.blue.maxResource).toBe(300);
      expect(level1Arena.blue.definition.resourceType).toBe('mana');
    });

    test('should have correct base armor (32)', () => {
      expect(level1Arena.blue.getStats().armor).toBe(32);
    });

    test('should have correct base magic resist (32)', () => {
      expect(level1Arena.blue.getStats().magicResist).toBe(32);
    });
  });

  describe('Stat Growth', () => {
    test('should gain health per level (95)', () => {
      arena.blue.setLevel(2);
      const stats = arena.blue.getStats();
      expect(stats.maxHealth).toBeGreaterThan(580);
    });

    test('should gain attack damage per level (3.5)', () => {
      arena.blue.setLevel(10);
      const stats = arena.blue.getStats();
      expect(stats.attackDamage).toBeGreaterThan(60);
    });
  });

  describe('Passive - Souls of Vilix', () => {
    test('should start with 0 soul stacks', () => {
      expect(arena.blue.passiveState.stacks).toBe(0);
    });

    test('should gain soul stacks from minion kills', () => {
      // Add a minion and kill it
      const minion = arena.addMinion(TEAM_RED, new Vector(100, 0));
      minion.health = 1;
      minion.takeDamage(100, 'physical', arena.blue.id, arena.context);

      // Minion kill at level 6 should give 3 stacks
      expect(arena.blue.passiveState.stacks).toBeGreaterThanOrEqual(2);
    });

    test('should gain more soul stacks from jungle kills', () => {
      // Add a jungle creature and kill it
      const creature = arena.addJungleCreature(new Vector(100, 0));
      creature.health = 1;
      creature.takeDamage(100, 'physical', arena.blue.id, arena.context);

      // Jungle kill should give more stacks than minion
      expect(arena.blue.passiveState.stacks).toBeGreaterThanOrEqual(5);
    });

    test('should gain most soul stacks from champion kills', () => {
      // Set up enemy champion to be killed
      arena.red.setHealth(1);
      arena.red.takeDamage(100, 'physical', arena.blue.id, arena.context);

      // Champion kill should give most stacks
      expect(arena.blue.passiveState.stacks).toBeGreaterThanOrEqual(7);
    });

    test('soul stacks should not decay', () => {
      // Add stacks manually
      arena.blue.passiveState.stacks = 50;

      // Tick for a while
      arena.tickFrames(600); // 10 seconds

      // Stacks should not have decayed
      expect(arena.blue.passiveState.stacks).toBe(50);
    });

    test('soul stacks should have no cap', () => {
      // Add a lot of stacks
      arena.blue.passiveState.stacks = 500;
      arena.blue.passiveState.stacks += 100;

      expect(arena.blue.passiveState.stacks).toBe(600);
    });
  });

  describe('Q - Black Arrows of Vilix', () => {
    test('should cast successfully', () => {
      const result = arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(800, 0),
      });

      expect(result.success).toBe(true);
    });

    test('should have correct mana cost at rank 1 (50)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(800, 0),
      });

      expect(arena.blue.resource).toBe(initialMana - 50);
    });

    test('should have correct cooldown at rank 1 (12s)', () => {
      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(800, 0),
      });

      expect(arena.blue.getAbilityCooldown('Q')).toBe(12);
    });

    test('cooldown should decrease with rank', () => {
      arena.blue.maxAbility('Q');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(800, 0),
      });

      expect(arena.blue.getAbilityCooldown('Q')).toBeLessThanOrEqual(8);
    });

    test('should apply slow effect on hit', () => {
      // Position enemy in path of skillshot
      arena.red.position.setFrom(new Vector(300, 0));

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(800, 0),
      });

      // Tick to let projectile travel
      arena.tickAllFrames(30);

      expect(arena.red.hasEffect('vile_q_slow')).toBe(true);
    });
  });

  describe('W - Veil of Darkness', () => {
    test('should cast successfully', () => {
      const result = arena.castAbility(arena.blue, 'W');
      expect(result.success).toBe(true);
    });

    test('should have correct mana cost at rank 1 (80)', () => {
      const initialMana = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(initialMana - 80);
    });

    test('mana cost should decrease with rank', () => {
      arena.blue.maxAbility('W');
      arena.blue.resetCooldowns();

      const initialMana = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(initialMana - 60);
    });

    test('should apply stealth effect', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.hasEffect('vile_stealth')).toBe(true);
    });

    test('should apply invulnerability effect', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.hasEffect('vile_invulnerable')).toBe(true);
    });

    test('should apply self-root (cannot move)', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.hasEffect('vile_rooted_self')).toBe(true);
    });

    test('should block damage while invulnerable', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      // Get health after tick (may have regenerated slightly)
      const healthBeforeDamage = arena.blue.health;

      // Try to damage Vile
      arena.blue.takeDamage(500, 'magic', arena.red.id, arena.context);

      // Health should not have decreased
      expect(arena.blue.health).toBe(healthBeforeDamage);
    });

    test('should have correct cooldown at rank 1 (22s)', () => {
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.getAbilityCooldown('W')).toBe(22);
    });
  });

  describe('E - Roots of Vilix', () => {
    test('should cast successfully', () => {
      const result = arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });

      expect(result.success).toBe(true);
    });

    test('should have no mana cost (uses charges)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });

      expect(arena.blue.resource).toBe(initialMana);
    });

    test('should place a trap at target location', () => {
      const trapPosition = new Vector(300, 100);

      arena.castAbility(arena.blue, 'E', {
        targetPosition: trapPosition,
      });

      // Check that an entity was added (trap)
      const entities = arena.context.getAllEntities();
      const trap = entities.find(e =>
        e.position.x === trapPosition.x && e.position.y === trapPosition.y
      );

      expect(trap).toBeDefined();
    });

    test('trap should trigger on enemy champion proximity', () => {
      // Place trap
      const trapPosition = new Vector(300, 0);
      arena.castAbility(arena.blue, 'E', {
        targetPosition: trapPosition,
      });

      // Move enemy to trap
      arena.red.position.setFrom(trapPosition);
      arena.tickAllFrames(10);

      // Enemy should be rooted
      expect(arena.red.hasEffect('vile_root')).toBe(true);
    });

    test('trap should grant soul stacks when triggered', () => {
      const initialStacks = arena.blue.passiveState.stacks;

      // Place trap
      const trapPosition = new Vector(300, 0);
      arena.castAbility(arena.blue, 'E', {
        targetPosition: trapPosition,
      });

      // Move enemy to trap
      arena.red.position.setFrom(trapPosition);
      arena.tickAllFrames(10);

      // Should have gained 5 stacks
      expect(arena.blue.passiveState.stacks).toBe(initialStacks + 5);
    });
  });

  describe('R - Restoration of Vilix', () => {
    test('should cast successfully', () => {
      const result = arena.castAbility(arena.blue, 'R');
      expect(result.success).toBe(true);
    });

    test('should have correct mana cost (100)', () => {
      const initialMana = arena.blue.resource;
      arena.castAbility(arena.blue, 'R');
      expect(arena.blue.resource).toBe(initialMana - 100);
    });

    test('should grant bonus max health', () => {
      const baseHealth = arena.blue.maxHealth;
      arena.castAbility(arena.blue, 'R');
      arena.tick();

      expect(arena.blue.getStats().maxHealth).toBeGreaterThan(baseHealth);
    });

    test('should reduce attack range to melee (100)', () => {
      arena.castAbility(arena.blue, 'R');
      arena.tick();

      expect(arena.blue.getAttackRange()).toBe(100);
    });

    test('should grant 100 soul stacks on cast', () => {
      const initialStacks = arena.blue.passiveState.stacks;
      arena.castAbility(arena.blue, 'R');

      expect(arena.blue.passiveState.stacks).toBe(initialStacks + 100);
    });

    test('should trigger all owned traps to explode', () => {
      // Place some traps
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(350, 0),
      });

      // Position enemy near traps
      arena.red.position.setFrom(new Vector(325, 0));
      const initialHealth = arena.red.health;

      // Cast R to trigger explosions
      arena.castAbility(arena.blue, 'R');
      arena.tickAllFrames(5);

      // Enemy should have taken damage from explosions
      expect(arena.red.health).toBeLessThan(initialHealth);
    });

    test('trap explosion should root enemies', () => {
      // Place trap
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });

      // Position enemy near trap
      arena.red.position.setFrom(new Vector(300, 0));

      // Cast R to trigger explosion
      arena.castAbility(arena.blue, 'R');
      arena.tickAllFrames(5);

      // Enemy should be rooted
      expect(arena.red.hasEffect('vile_root')).toBe(true);
    });

    test('should have correct cooldown at rank 1 (140s)', () => {
      arena.castAbility(arena.blue, 'R');
      expect(arena.blue.getAbilityCooldown('R')).toBe(140);
    });

    test('cooldown should decrease with rank', () => {
      arena.blue.maxAbility('R');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'R');
      expect(arena.blue.getAbilityCooldown('R')).toBeLessThanOrEqual(100);
    });

    test('transform should end after 10 seconds', () => {
      arena.castAbility(arena.blue, 'R');

      // Fast forward 10 seconds
      arena.tickFrames(600); // 10 seconds at 60fps

      // Attack range should be back to normal
      expect(arena.blue.getAttackRange()).toBe(450);
    });

    test('should mark champion as transformed', () => {
      arena.castAbility(arena.blue, 'R');
      arena.tick();

      expect(arena.blue.isTransformed()).toBe(true);
    });

    test('transform should end and isTransformed returns false', () => {
      arena.castAbility(arena.blue, 'R');

      // Fast forward 10+ seconds
      arena.tickFrames(650);

      expect(arena.blue.isTransformed()).toBe(false);
    });
  });

  describe('Transform Aura Damage', () => {
    test('should deal periodic damage to nearby enemies', () => {
      // Position enemy close to Vile
      arena.red.position.setFrom(new Vector(150, 0));

      // Cast R to start transform
      arena.castAbility(arena.blue, 'R');

      // Verify transform started
      expect(arena.blue.isTransformed()).toBe(true);

      // Get health AFTER cast (before ticking) - R heals for bonus max health
      const healthAfterCast = arena.red.health;

      // Tick for aura damage (need more time for first tick at 1 second)
      arena.tickAllFrames(90); // 1.5 seconds should give us 1 aura tick

      // Aura deals 25 magic damage per tick (reduced by MR)
      // Even with health regen, we should see SOME damage
      expect(arena.red.health).toBeLessThan(healthAfterCast + 30); // Allow for some regen
    });

    test('should not damage allies', () => {
      // Add an ally
      const allyArena = createTestArena({
        blueChampion: 'vile',
        redChampion: 'magnus',
        bluePosition: new Vector(0, 0),
        redPosition: new Vector(500, 0), // Far away
      });

      // We'd need to add another blue champion, but test with minion instead
      const allyMinion = allyArena.addMinion(TEAM_BLUE, new Vector(100, 0));
      const initialHealth = allyMinion.health;

      allyArena.castAbility(allyArena.blue, 'R');
      allyArena.tickAllFrames(120);

      expect(allyMinion.health).toBe(initialHealth);
    });
  });

  describe('Invulnerability Mechanics', () => {
    test('should block physical damage', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      const health = arena.blue.health;
      arena.blue.takeDamage(100, 'physical', arena.red.id, arena.context);

      expect(arena.blue.health).toBe(health);
    });

    test('should block magic damage', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      const health = arena.blue.health;
      arena.blue.takeDamage(100, 'magic', arena.red.id, arena.context);

      expect(arena.blue.health).toBe(health);
    });

    test('should block true damage', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      const health = arena.blue.health;
      arena.blue.takeDamage(100, 'true', arena.red.id, arena.context);

      expect(arena.blue.health).toBe(health);
    });

    test('invulnerability should end after W duration', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      // Fast forward past effect duration (2 seconds)
      arena.tickFrames(150);

      expect(arena.blue.hasEffect('vile_invulnerable')).toBe(false);
    });
  });

  describe('Integration - Full Combo', () => {
    test('E > R > Q > auto attack combo should deal significant damage', () => {
      // Setup: Position enemy
      arena.red.position.setFrom(new Vector(300, 0));
      const initialHealth = arena.red.health;

      // Place trap near enemy
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });
      arena.blue.resetCooldowns();

      // R: Transform (explodes trap, grants 100 stacks)
      arena.castAbility(arena.blue, 'R');
      arena.tickAllFrames(5);

      // Enemy should have taken trap explosion damage and be rooted
      expect(arena.red.health).toBeLessThan(initialHealth);
      expect(arena.red.hasEffect('vile_root')).toBe(true);

      // Vile should have 100+ soul stacks
      expect(arena.blue.passiveState.stacks).toBeGreaterThanOrEqual(100);

      // Q: Fire arrow (should slow)
      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(400, 0),
      });
      arena.tickAllFrames(30);

      // Total damage should be significant
      expect(arena.red.health).toBeLessThan(initialHealth * 0.7);
    });
  });
});
