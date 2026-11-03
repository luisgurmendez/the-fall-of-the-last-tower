/**
 * Warrior (Kael) Champion Tests
 *
 * Tests for the Warrior class - a melee bruiser with engage and durability.
 * - Passive: Undying Resolve - under 30% health, a shield (by level, plus 10%
 *   bonus health) and 20% armor for 5 s; 60 s cooldown
 * - Q: Cleaving Strike - Cone damage (no slow)
 * - W: Iron Will - Self shield
 * - E: Valiant Charge - Dash with damage and a slow on what it runs into
 * - R: Heroic Strike - Targeted leap with stun (its leap: Dashes.test.ts)
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  getAbilityDefinition,
  getPassiveDefinition,
  getPassiveLevelValue,
  TEAM_BLUE,
  TEAM_RED,
} from '@siege/shared';
import {
  createTestArena,
  TestArena,
  calculatePhysicalDamage,
} from '../ServerTestUtils';

const BASE_STATS = CHAMPION_DEFINITIONS.warrior.baseStats;
const SLASH = getAbilityDefinition('warrior_slash')!;
const IRON_WILL = getAbilityDefinition('warrior_shield')!;
const CHARGE = getAbilityDefinition('warrior_charge')!;
const HEROIC_STRIKE = getAbilityDefinition('warrior_ultimate')!;
const PASSIVE = getPassiveDefinition('warrior_passive')!;
/** Heroic Strike's cast range */
const R_RANGE = HEROIC_STRIKE.range!;
const FPS = 60;

/** Kael's bonus health, as his scaling reads it */
function bonusHealth(arena: TestArena): number {
  return arena.blue.getStats().maxHealth - BASE_STATS.health;
}

/** An AD-scaling ability's damage on red at a rank (physical, after red's armor) */
function physicalDamage(arena: TestArena, abilityId: string, rank: number): number {
  const scaling = getAbilityDefinition(abilityId)!.damage!.scaling;
  const raw = scaling.base[rank - 1] + arena.blue.getStats().attackDamage * (scaling.adRatio ?? 0);
  return calculatePhysicalDamage(raw, arena.red.getStats().armor);
}

/** Damage Kael deals to `target` (after resistances) while `run` runs */
function damageDealt(arena: TestArena, target: TestArena['red'], run: () => void): number {
  let dealt = 0;
  const takeDamage = target.takeDamage.bind(target);
  target.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
    const damage = takeDamage(...args);
    if (args[2] === arena.blue.id) dealt += damage;
    return damage;
  }) as typeof takeDamage;
  run();
  target.takeDamage = takeDamage;
  return dealt;
}

/** Tick until Kael's dash or leap ends */
function untilLanded(arena: TestArena): void {
  for (let i = 0; i < 2 * FPS && (i === 0 || arena.blue.forcedMovement); i++) arena.tick();
}

describe('Warrior (Kael)', () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'warrior',
      redChampion: 'warrior',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(200, 0),
    });
  });

  describe('Base Stats', () => {
    test('should have correct base health (630)', () => {
      // Create fresh champion without learnAllAbilities to test base stats
      const freshArena = createTestArena({
        blueChampion: 'warrior',
        redChampion: 'warrior',
        learnAbilities: false,
      });
      expect(freshArena.blue.maxHealth).toBe(630);
    });

    test('should have melee attack range', () => {
      expect(arena.blue.getStats().attackRange).toBe(BASE_STATS.attackRange);
      expect(BASE_STATS.attackRange).toBeLessThan(100);
    });

    test('should have correct base armor (32)', () => {
      // Create fresh champion without learnAllAbilities to test base stats
      const freshArena = createTestArena({
        blueChampion: 'warrior',
        redChampion: 'warrior',
        learnAbilities: false,
      });
      expect(freshArena.blue.getStats().armor).toBe(32);
    });

    test('should have correct base movement speed', () => {
      expect(arena.blue.getStats().movementSpeed).toBe(BASE_STATS.movementSpeed);
    });

    test('should have correct base attack damage (60)', () => {
      // Create fresh champion without learnAllAbilities to test base stats
      const freshArena = createTestArena({
        blueChampion: 'warrior',
        redChampion: 'warrior',
        learnAbilities: false,
      });
      expect(freshArena.blue.getStats().attackDamage).toBe(60);
    });
  });

  // ===========================================================================
  // Passive - Undying Resolve
  // ===========================================================================

  describe('Passive - Undying Resolve', () => {
    const THRESHOLD = PASSIVE.healthThreshold!;
    const SHIELD_RATIO = PASSIVE.shield!.scaling.bonusHealthRatio!;

    /** Kael at a level, its health at a share of the maximum, and a tick for the passive to see it */
    function lowHealth(level: number, share = THRESHOLD - 0.05): TestArena {
      const low = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior', redPosition: new Vector(3000, 3000), learnAbilities: false });
      low.blue.setLevel(level);
      low.blue.setHealth(low.blue.maxHealth * share);
      low.tick();
      return low;
    }

    function passiveShield(low: TestArena): number {
      return low.blue.getShields().filter(shield => shield.sourceId === `passive_${PASSIVE.id}`).reduce((sum, shield) => sum + shield.amount, 0);
    }

    for (const [level, base] of [[1, 80], [5, 80], [6, 120], [10, 120], [11, 160], [15, 160], [16, 200], [18, 200]]) {
      test(`level ${level}: a shield of ${base} plus ${SHIELD_RATIO * 100}% bonus health`, () => {
        const low = lowHealth(level);
        expect(getPassiveLevelValue(PASSIVE, level)).toBe(base);
        expect(passiveShield(low)).toBeCloseTo(base + SHIELD_RATIO * bonusHealth(low), 5);
      });
    }

    test('bonus health from items adds to the shield', () => {
      const low = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior', redPosition: new Vector(3000, 3000), learnAbilities: false });
      low.blue.items[0] = { definitionId: 'bulwark_belt', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
      low.blue.invalidateStats();
      low.blue.setHealth(low.blue.maxHealth * 0.2);
      low.tick();
      expect(passiveShield(low)).toBeCloseTo(getPassiveLevelValue(PASSIVE, 1) + SHIELD_RATIO * bonusHealth(low), 5);
    });

    test('and 20% more armor, both for 5 seconds', () => {
      const healthy = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior', learnAbilities: false });
      const armor = healthy.blue.getStats().armor;
      const low = lowHealth(1);
      expect(low.blue.hasEffect('warrior_undying_resolve')).toBe(true);
      expect(low.blue.getStats().armor).toBeCloseTo(armor * 1.2, 5);

      low.tickFrames((PASSIVE.shield!.duration - 0.2) * FPS);
      expect(passiveShield(low)).toBeGreaterThan(0);
      expect(low.blue.hasEffect('warrior_undying_resolve')).toBe(true);
      low.tickFrames(0.4 * FPS);
      expect(passiveShield(low)).toBe(0);
      expect(low.blue.hasEffect('warrior_undying_resolve')).toBe(false);
      expect(low.blue.getStats().armor).toBeCloseTo(armor, 5);
    });

    test('just under 30% it goes off; above it, not', () => {
      expect(passiveShield(lowHealth(1, THRESHOLD - 0.001))).toBeGreaterThan(0);
      const above = lowHealth(1, THRESHOLD + 0.02);
      expect(passiveShield(above)).toBe(0);
      expect(above.blue.hasEffect('warrior_undying_resolve')).toBe(false);
    });

    test(`then it waits ${PASSIVE.internalCooldown} seconds`, () => {
      const low = lowHealth(1);
      expect(low.blue.passiveState.cooldownRemaining).toBeCloseTo(PASSIVE.internalCooldown!, 1);
      low.tickFrames((PASSIVE.shield!.duration + 1) * FPS);
      low.blue.setHealth(low.blue.maxHealth * 0.1);
      low.tick();
      expect(passiveShield(low)).toBe(0);

      low.blue.passiveState.cooldownRemaining = 0;
      low.tick();
      expect(passiveShield(low)).toBeGreaterThan(0);
    });

    test('the shield absorbs damage before health', () => {
      const low = lowHealth(1);
      const health = low.blue.health;
      low.blue.takeDamage(30, 'true', low.red.id, low.context);
      expect(low.blue.health).toBeCloseTo(health, 5);
      expect(passiveShield(low)).toBeCloseTo(getPassiveLevelValue(PASSIVE, 1) - 30, 5);
    });
  });

  // ===========================================================================
  // Q - Cleaving Strike
  // ===========================================================================

  describe('Q - Cleaving Strike', () => {
    test('should deal physical damage in a cone', () => {
      const initialHealth = arena.red.health;

      // Position red champion in front of blue (within the cone's 130)
      arena.red.position.x = 100;
      arena.red.position.y = 0;

      const result = arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(100, 0),
      });

      expect(result.success).toBe(true);

      // Tick to apply damage
      arena.tick();

      // Should have taken damage
      expect(arena.red.health).toBeLessThan(initialHealth);
    });

    test('rank 1 and max rank: its base plus 80% AD, after armor', () => {
      arena.red.position.x = 100;
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(100, 0) });
      expect(health - arena.red.health).toBeCloseTo(physicalDamage(arena, 'warrior_slash', 1), 5);

      arena.blue.resetCooldowns();
      arena.blue.maxAbility('Q');
      arena.blue.setLevel(18);
      const before = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(100, 0) });
      expect(before - arena.red.health).toBeCloseTo(physicalDamage(arena, 'warrior_slash', SLASH.maxRank), 5);
    });

    test('AD from items adds 80% of it', () => {
      arena.red.position.x = 100;
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(100, 0) });
      const without = health - arena.red.health;

      const withItem = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior', redPosition: new Vector(100, 0) });
      withItem.blue.items[0] = { definitionId: 'notched_blade', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
      withItem.blue.invalidateStats();
      const before = withItem.red.health;
      withItem.castAbility(withItem.blue, 'Q', { targetPosition: new Vector(100, 0) });
      expect(before - withItem.red.health - without).toBeCloseTo(calculatePhysicalDamage(10 * SLASH.damage!.scaling.adRatio!, withItem.red.getStats().armor), 5);
    });

    test("it doesn't slow", () => {
      arena.red.position.x = 100;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(100, 0) });
      expect(arena.red.getActiveEffects().length).toBe(0);
    });

    test('should have correct mana cost at rank 1 (40)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(150, 0),
      });

      expect(arena.blue.resource).toBe(initialMana - 40);
    });

    test('mana and cooldown at max rank', () => {
      arena.blue.maxAbility('Q');
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(150, 0) });
      expect(arena.blue.resource).toBe(mana - SLASH.manaCost![SLASH.maxRank - 1]);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(SLASH.cooldown![SLASH.maxRank - 1]);
    });

    test('should go on cooldown after cast', () => {
      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(150, 0),
      });

      expect(arena.blue.getAbilityCooldown('Q')).toBeGreaterThan(0);
    });

    test('should not hit enemies behind caster', () => {
      const initialHealth = arena.red.health;

      // Position blue at origin, red behind blue
      arena.blue.position.x = 0;
      arena.blue.position.y = 0;
      arena.red.position.x = -150;
      arena.red.position.y = 0;

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(150, 0), // Cast forward (right)
      });

      arena.tick();

      // Should NOT have taken damage (behind caster)
      // Health may have regenerated slightly, so check >= initial
      expect(arena.red.health).toBeGreaterThanOrEqual(initialHealth);
    });

    test('its 90° cone: hit at 40° off the aim, missed at 50°', () => {
      const at = (degrees: number) => new Vector(Math.cos(degrees * Math.PI / 180) * 100, Math.sin(degrees * Math.PI / 180) * 100);
      arena.red.position.setFrom(at(40));
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(150, 0) });
      expect(arena.red.health).toBeLessThan(health);

      const wide = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior', redPosition: at(50) });
      const wideHealth = wide.red.health;
      wide.castAbility(wide.blue, 'Q', { targetPosition: new Vector(150, 0) });
      expect(wide.red.health).toBe(wideHealth);
    });

    test(`its reach: hit at ${SLASH.aoeRadius! - 1}, missed at ${SLASH.aoeRadius! + 1}`, () => {
      arena.red.position.x = SLASH.aoeRadius! - 1;
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(150, 0) });
      expect(arena.red.health).toBeLessThan(health);

      const far = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior', redPosition: new Vector(SLASH.aoeRadius! + 1, 0) });
      const farHealth = far.red.health;
      far.castAbility(far.blue, 'Q', { targetPosition: new Vector(150, 0) });
      expect(far.red.health).toBe(farHealth);
    });

    test('nothing in its cast time or its swing; it lands after both', () => {
      arena.red.position.x = 100;
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(100, 0), casting: true });
      expect(arena.blue.isCasting()).toBe(true);
      arena.blue.advanceCast(10, arena.context);
      expect(arena.red.health).toBe(health);
      arena.context.advanceTime(SLASH.aoeDelay! - 0.05);
      expect(arena.red.health).toBe(health);
      arena.context.advanceTime(0.05 + 1e-6);
      expect(arena.red.health).toBeLessThan(health);
    });

    test('the swing comes from where Kael is when it lands, aimed where he cast it', () => {
      arena.red.position.setFrom(new Vector(100, 300));
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(100, 0), windup: true });
      arena.blue.position.setFrom(new Vector(0, 300));
      arena.context.advanceTime(SLASH.aoeDelay! + 1e-6);
      expect(arena.red.health).toBeLessThan(health);
    });

    test('stunned in its cast time: cancelled, nothing spent', () => {
      arena.red.position.x = 100;
      const mana = arena.blue.resource;
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(100, 0), casting: true });
      arena.blue.applyEffect('stun', 1, arena.red.id);
      arena.tick();
      expect(arena.blue.isCasting()).toBe(false);
      arena.context.advanceTime(1);
      expect(arena.red.health).toBeGreaterThanOrEqual(health);
      expect(arena.blue.resource).toBeGreaterThanOrEqual(mana);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
    });

    test("hits minions and jungle monsters in the cone, not towers or allies' minions", () => {
      const minion = arena.addMinion(TEAM_RED, new Vector(80, 20));
      const ally = arena.addMinion(TEAM_BLUE, new Vector(80, -20));
      const creature = arena.addJungleCreature(new Vector(90, 40), 'wolf');
      const tower = arena.addTower(TEAM_RED, new Vector(110, 0));
      const healths = [minion.health, ally.health, creature.health, tower.health];
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(150, 0) });
      expect(minion.health).toBeLessThan(healths[0]);
      expect(ally.health).toBe(healths[1]);
      expect(creature.health).toBeLessThan(healths[2]);
      expect(tower.health).toBe(healths[3]);
    });

    test('Kael dying in the swing: it never lands', () => {
      arena.red.position.x = 100;
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(100, 0), windup: true });
      arena.blue.takeDamage(1e9, 'true');
      arena.context.advanceTime(SLASH.aoeDelay! + 1e-6);
      expect(arena.red.health).toBe(health);
    });
  });

  // ===========================================================================
  // W - Iron Will
  // ===========================================================================

  describe('W - Iron Will', () => {
    test('should grant a shield', () => {
      expect(arena.blue.getTotalShieldAmount()).toBe(0);

      const result = arena.castAbility(arena.blue, 'W');

      expect(result.success).toBe(true);

      arena.tick();

      // Should have a shield
      expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
    });

    test('rank 1 and max rank: its base plus 8% bonus health', () => {
      const ratio = IRON_WILL.shield!.scaling.bonusHealthRatio!;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(IRON_WILL.shield!.scaling.base[0] + ratio * bonusHealth(arena), 5);

      const max = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior' });
      max.blue.maxAbility('W');
      max.blue.setLevel(18);
      max.castAbility(max.blue, 'W');
      expect(max.blue.getTotalShieldAmount()).toBeCloseTo(IRON_WILL.shield!.scaling.base[IRON_WILL.maxRank - 1] + ratio * bonusHealth(max), 5);
    });

    test('instant: no cast time', () => {
      arena.castAbility(arena.blue, 'W', { casting: true });
      expect(arena.blue.isCasting()).toBe(false);
      expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
    });

    test('should have correct mana cost at rank 1 (60)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'W');

      expect(arena.blue.resource).toBe(initialMana - 60);
    });

    test('mana and cooldown at max rank', () => {
      arena.blue.maxAbility('W');
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(mana - IRON_WILL.manaCost![IRON_WILL.maxRank - 1]);
      expect(arena.blue.getAbilityCooldown('W')).toBe(IRON_WILL.cooldown![IRON_WILL.maxRank - 1]);
    });

    test('shield should absorb damage', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      const shieldAmount = arena.blue.getTotalShieldAmount();
      const initialHealth = arena.blue.health;

      // Apply damage less than shield (use takeDamage, not applyDamage)
      arena.blue.takeDamage(50, 'physical', arena.red.id, arena.context);

      // Health should be unchanged (shield absorbed damage)
      expect(arena.blue.health).toBe(initialHealth);
      expect(arena.blue.getTotalShieldAmount()).toBeLessThan(shieldAmount);
    });

    test('damage past the shield goes to health', () => {
      arena.castAbility(arena.blue, 'W');
      const shield = arena.blue.getTotalShieldAmount();
      const health = arena.blue.health;
      arena.blue.takeDamage(shield + 40, 'true', arena.red.id, arena.context);
      expect(arena.blue.getTotalShieldAmount()).toBe(0);
      expect(health - arena.blue.health).toBeCloseTo(40, 5);
    });

    test('shield should expire after duration', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);

      // Tick for 3+ seconds (shield duration)
      arena.tickFrames(60 * 4); // 4 seconds at 60fps

      expect(arena.blue.getTotalShieldAmount()).toBe(0);
    });

    test(`it lasts ${IRON_WILL.shield!.duration} seconds`, () => {
      arena.castAbility(arena.blue, 'W');
      arena.tickFrames((IRON_WILL.shield!.duration - 0.1) * FPS);
      expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
      arena.tickFrames(0.2 * FPS);
      expect(arena.blue.getTotalShieldAmount()).toBe(0);
    });

    test('silenced or stunned: fails, nothing spent', () => {
      for (const cc of ['silence', 'stun']) {
        const ccArena = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior' });
        ccArena.blue.applyEffect(cc, 1, ccArena.red.id);
        const mana = ccArena.blue.resource;
        expect(ccArena.castAbility(ccArena.blue, 'W').success).toBe(false);
        expect(ccArena.blue.resource).toBe(mana);
        expect(ccArena.blue.getTotalShieldAmount()).toBe(0);
      }
    });
  });

  // ===========================================================================
  // E - Valiant Charge
  // ===========================================================================

  describe('E - Valiant Charge', () => {
    test('should dash forward', () => {
      const initialX = arena.blue.position.x;

      const result = arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(500, 0),
      });

      expect(result.success).toBe(true);

      // Tick to complete dash
      arena.tickFrames(30);

      // Should have moved forward
      expect(arena.blue.position.x).toBeGreaterThan(initialX);
    });

    test(`it goes ${CHARGE.dash!.distance} toward a farther cursor, and only to a nearer one`, () => {
      arena.red.position.setFrom(new Vector(3000, 3000));
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(900, 0) });
      untilLanded(arena);
      expect(arena.blue.position.x).toBeCloseTo(CHARGE.dash!.distance, 0);

      const near = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior', redPosition: new Vector(3000, 3000) });
      near.castAbility(near.blue, 'E', { targetPosition: new Vector(100, 0) });
      untilLanded(near);
      expect(near.blue.position.x).toBeCloseTo(100, 0);
    });

    test('at its speed: the full charge takes distance / speed', () => {
      arena.red.position.setFrom(new Vector(3000, 3000));
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(900, 0) });
      const seconds = CHARGE.dash!.distance / CHARGE.dash!.speed;
      arena.tickFrames(Math.floor(seconds * FPS) - 2);
      expect(arena.blue.forcedMovement).not.toBeNull();
      arena.tickFrames(4);
      expect(arena.blue.forcedMovement).toBeNull();
    });

    test('instant: no cast time', () => {
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(500, 0), casting: true });
      expect(arena.blue.isCasting()).toBe(false);
      expect(arena.blue.forcedMovement).not.toBeNull();
    });

    test('should apply slow to enemies hit', () => {
      // Position red in the dash path
      arena.red.position.x = getAbilityDefinition('warrior_charge')!.dash!.distance * 0.6;
      arena.red.position.y = 0;
      const baseSpeed = arena.red.getStats().movementSpeed;

      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(500, 0),
      });

      // Tick to complete dash
      arena.tickFrames(30);

      // Red should be slowed
      const currentSpeed = arena.red.getStats().movementSpeed;
      expect(currentSpeed).toBeLessThan(baseSpeed);
    });

    test('what it runs into takes its base plus 60% AD and a 30% slow for 1.5 s, once', () => {
      arena.red.position.x = 150;
      const speed = arena.red.getStats().movementSpeed;
      const dealt = damageDealt(arena, arena.red, () => {
        arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(500, 0) });
        untilLanded(arena);
      });
      expect(dealt).toBeCloseTo(physicalDamage(arena, 'warrior_charge', 1), 5);
      expect(arena.red.getStats().movementSpeed).toBeCloseTo(speed * 0.7, 5);
      const slow = arena.red.getEffect('slow_30')!;
      expect(slow.timeRemaining).toBeGreaterThan(CHARGE.effectDuration! - 0.4);
      expect(slow.timeRemaining).toBeLessThanOrEqual(CHARGE.effectDuration!);
    });

    test('max rank deals its top base', () => {
      arena.blue.maxAbility('E');
      arena.blue.setLevel(18);
      arena.red.position.x = 150;
      const dealt = damageDealt(arena, arena.red, () => {
        arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(500, 0) });
        untilLanded(arena);
      });
      expect(dealt).toBeCloseTo(physicalDamage(arena, 'warrior_charge', CHARGE.maxRank), 5);
    });

    test('several enemies on its way are each hit; one beside its way is not', () => {
      arena.red.position.setFrom(new Vector(3000, 3000));
      const first = arena.addMinion(TEAM_RED, new Vector(80, 10));
      const second = arena.addMinion(TEAM_RED, new Vector(180, -10));
      const beside = arena.addMinion(TEAM_RED, new Vector(120, CHARGE.aoeRadius! + 30));
      const healths = [first.health, second.health, beside.health];
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(500, 0) });
      untilLanded(arena);
      expect(first.health).toBeLessThan(healths[0]);
      expect(second.health).toBeLessThan(healths[1]);
      expect(beside.health).toBe(healths[2]);
    });

    test("allies on its way aren't hit", () => {
      const ally = arena.addMinion(TEAM_BLUE, new Vector(100, 0));
      const health = ally.health;
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(500, 0) });
      untilLanded(arena);
      expect(ally.health).toBe(health);
      expect(ally.activeEffects.length).toBe(0);
    });

    test('rooted: fails, nothing spent, no dash', () => {
      arena.blue.applyEffect('root', 1, arena.red.id);
      const mana = arena.blue.resource;
      const result = arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(500, 0) });
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('rooted');
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.forcedMovement).toBeNull();
    });

    test('should have fixed mana cost (50)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(500, 0),
      });

      expect(arena.blue.resource).toBe(initialMana - 50);
    });

    test('cooldown at rank 1 and max rank', () => {
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(500, 0) });
      expect(arena.blue.getAbilityCooldown('E')).toBe(CHARGE.cooldown![0]);
      arena.blue.resetCooldowns();
      arena.blue.maxAbility('E');
      untilLanded(arena);
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(-500, 0) });
      expect(arena.blue.getAbilityCooldown('E')).toBe(CHARGE.cooldown![CHARGE.maxRank - 1]);
    });
  });

  // ===========================================================================
  // R - Heroic Strike
  // ===========================================================================

  describe('R - Heroic Strike', () => {
    test('should require a target', () => {
      const result = arena.castAbility(arena.blue, 'R', {
        targetPosition: new Vector(500, 0),
        // No targetId provided
      });

      // Should fail without a target for target_enemy ability
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('invalid_target');
    });

    test('should stun the target', () => {
      // Position red in range
      arena.red.position.x = R_RANGE * 0.8;

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      // A leap: the stun lands when it reaches the target
      arena.tickFrames(30);

      // Red should be stunned
      expect(arena.red.ccStatus.isStunned).toBe(true);
    });

    test('should deal significant damage', () => {
      const initialHealth = arena.red.health;

      arena.red.position.x = R_RANGE * 0.8;

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      // A leap: the damage lands when it reaches the target
      arena.tickFrames(30);

      // Should deal substantial damage (base 150 + AD scaling)
      const damageTaken = initialHealth - arena.red.health;
      expect(damageTaken).toBeGreaterThan(100);
    });

    test('rank 1 and max rank: its base plus 80% AD, after armor', () => {
      const dealt = damageDealt(arena, arena.red, () => {
        arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
        untilLanded(arena);
      });
      expect(dealt).toBeCloseTo(physicalDamage(arena, 'warrior_ultimate', 1), 5);

      const max = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior', redPosition: new Vector(200, 0) });
      max.blue.maxAbility('R');
      max.blue.setLevel(18);
      const dealtMax = damageDealt(max, max.red, () => {
        max.castAbility(max.blue, 'R', { targetId: max.red.id });
        untilLanded(max);
      });
      expect(dealtMax).toBeCloseTo(physicalDamage(max, 'warrior_ultimate', HEROIC_STRIKE.maxRank), 5);
    });

    test(`the stun holds ${HEROIC_STRIKE.effectDuration} s: the target can't move, attack or cast, then can`, () => {
      arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
      untilLanded(arena);
      expect(arena.red.ccStatus.canMove).toBe(false);
      expect(arena.red.ccStatus.canAttack).toBe(false);
      expect(arena.castAbility(arena.red, 'W').failReason).toBe('stunned');
      arena.tickFrames((HEROIC_STRIKE.effectDuration! + 0.1) * FPS);
      expect(arena.red.ccStatus.isStunned).toBe(false);
      expect(arena.castAbility(arena.red, 'W').success).toBe(true);
    });

    test(`its range: ${R_RANGE - 1} away goes, ${R_RANGE + 1} away is refused`, () => {
      arena.red.position.x = R_RANGE - 1;
      expect(arena.castAbility(arena.blue, 'R', { targetId: arena.red.id }).success).toBe(true);

      const far = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior', redPosition: new Vector(R_RANGE + 1, 0) });
      const result = far.castAbility(far.blue, 'R', { targetId: far.red.id });
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('out_of_range');
    });

    test('a minion can be leapt at and stunned', () => {
      arena.red.position.setFrom(new Vector(3000, 3000));
      const minion = arena.addMinion(TEAM_RED, new Vector(150, 0));
      const health = minion.health;
      expect(arena.castAbility(arena.blue, 'R', { targetId: minion.id }).success).toBe(true);
      untilLanded(arena);
      expect(minion.health).toBeLessThan(health);
      expect(minion.activeEffects.some(effect => effect.definitionId === 'stun')).toBe(true);
    });

    test('an ally, a tower, a dead enemy or himself: refused, nothing spent', () => {
      const ally = arena.addMinion(TEAM_BLUE, new Vector(100, 0));
      const tower = arena.addTower(TEAM_RED, new Vector(150, 50));
      const mana = arena.blue.resource;
      for (const targetId of [ally.id, tower.id, arena.blue.id]) {
        const result = arena.castAbility(arena.blue, 'R', { targetId });
        expect(result.success).toBe(false);
        expect(result.failReason).toBe('invalid_target');
      }
      arena.red.takeDamage(1e9, 'true');
      expect(arena.castAbility(arena.blue, 'R', { targetId: arena.red.id }).failReason).toBe('invalid_target');
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.getAbilityCooldown('R')).toBe(0);
    });

    test('rooted or stunned: refused, nothing spent', () => {
      for (const [cc, reason] of [['root', 'rooted'], ['stun', 'stunned']] as const) {
        const ccArena = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior' });
        ccArena.blue.applyEffect(cc, 1, ccArena.red.id);
        const mana = ccArena.blue.resource;
        const result = ccArena.castAbility(ccArena.blue, 'R', { targetId: ccArena.red.id });
        expect(result.success).toBe(false);
        expect(result.failReason).toBe(reason);
        expect(ccArena.blue.resource).toBe(mana);
      }
    });

    test('should have long cooldown (120s at rank 1)', () => {
      arena.red.position.x = R_RANGE * 0.8;

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBeGreaterThanOrEqual(100); // ~120s
    });

    test('mana and cooldown at rank 1 and max rank; not learned before level 6', () => {
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
      expect(arena.blue.resource).toBe(mana - HEROIC_STRIKE.manaCost![0]);
      expect(arena.blue.getAbilityCooldown('R')).toBe(HEROIC_STRIKE.cooldown![0]);

      const max = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior' });
      max.blue.maxAbility('R');
      max.castAbility(max.blue, 'R', { targetId: max.red.id });
      expect(max.blue.getAbilityCooldown('R')).toBe(HEROIC_STRIKE.cooldown![HEROIC_STRIKE.maxRank - 1]);

      const level1 = createTestArena({ blueChampion: 'warrior', redChampion: 'warrior', learnAbilities: false });
      expect(level1.castAbility(level1.blue, 'R', { targetId: level1.red.id }).failReason).toBe('not_learned');
    });
  });

  describe('Level Scaling', () => {
    test('stats should increase with level', () => {
      // Use fresh arena without abilities to test pure level scaling
      const freshArena = createTestArena({
        blueChampion: 'warrior',
        redChampion: 'warrior',
        learnAbilities: false,
      });

      const level1Health = freshArena.blue.maxHealth;
      const level1AD = freshArena.blue.getStats().attackDamage;

      freshArena.blue.setLevel(10);

      expect(freshArena.blue.maxHealth).toBeGreaterThan(level1Health);
      expect(freshArena.blue.getStats().attackDamage).toBeGreaterThan(level1AD);
    });

    test('ability damage should scale with items', () => {
      // Arena with abilities learned has level 6 (to learn R)
      // Level 6 warrior has: 60 + 3.5 * 5 = 77.5 AD (rounded)
      const baseAD = arena.blue.getStats().attackDamage;

      // Give blue champion more AD via items
      arena.blue.items[0] = {
        definitionId: 'notched_blade', // +10 AD
        slot: 0,
        passiveCooldowns: {},
        nextIntervalTick: {},
      };
      arena.blue.items[1] = {
        definitionId: 'notched_blade',
        slot: 1,
        passiveCooldowns: {},
        nextIntervalTick: {},
      };

      // Clear stat cache to pick up item changes
      // @ts-ignore - accessing private property for testing
      arena.blue['cachedStats'] = null;

      const adWithItems = arena.blue.getStats().attackDamage;
      expect(adWithItems).toBe(baseAD + 20); // base + 20 from items
    });
  });
});
