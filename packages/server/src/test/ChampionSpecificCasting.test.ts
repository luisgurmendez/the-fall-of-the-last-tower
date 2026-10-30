/**
 * Champion-specific cast rules.
 *
 * Pins the cast-time behavior that belongs to a single champion rather than to
 * the generic ability executor:
 * - Magnus: Arcane Surge amplifies the next ability by 30% and is consumed
 * - Vex: Shadow Shroud does not break stealth, other abilities do
 * - Lume: Q recast and R run through the Lume ability handlers
 */

import { describe, test, expect, beforeEach, afterEach, spyOn, type Mock } from 'bun:test';
import { Vector, getAbilityDefinition, type AbilitySlot } from '@siege/shared';
import { createTestArena, type TestArena } from './ServerTestUtils';
import { ServerZone } from '../simulation/ServerZone';
import { ServerLightOrb } from '../simulation/ServerLightOrb';
import { passiveTriggerSystem } from '../systems/PassiveTriggerSystem';

/** Put a champion's stack passive in its activated state (as at 4 Arcane Surge stacks). */
function activatePassive(arena: TestArena): void {
  arena.blue.passiveState.stacks = 4;
  arena.blue.passiveState.stackTimeRemaining = 10;
  arena.blue.passiveState.isActive = true;
}

describe('Magnus - Arcane Surge', () => {
  let arena: TestArena;
  let dispatchTrigger: Mock<typeof passiveTriggerSystem.dispatchTrigger>;

  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'magnus',
      redChampion: 'warrior',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(400, 0),
    });
    // Stack gain is the passive system's job (and every constructed champion
    // registers its passive again), so keep it out of these executor-level tests
    dispatchTrigger = spyOn(passiveTriggerSystem, 'dispatchTrigger').mockImplementation(() => {});
  });

  afterEach(() => {
    dispatchTrigger.mockRestore();
  });

  /** Cast with full mana and no cooldown so casts can be chained. */
  function cast(slot: AbilitySlot) {
    arena.blue.resetCooldowns();
    arena.blue.setResource(arena.blue.maxResource);
    return arena.castAbility(arena.blue, slot, { targetPosition: new Vector(300, 0) });
  }

  /** Damage per tick of the most recently created Inferno Zone. */
  function latestMeteorDamage(): number {
    const zones = arena.context
      .getAllEntities()
      .filter((e): e is ServerZone => e instanceof ServerZone && e.abilityId === 'magnus_meteor');
    return zones[zones.length - 1].damage;
  }

  test('active Arcane Surge adds 30% damage to the next ability and is consumed', () => {
    expect(cast('R').success).toBe(true);
    const baseDamage = latestMeteorDamage();
    expect(baseDamage).toBeGreaterThan(0);

    activatePassive(arena);
    expect(cast('R').success).toBe(true);

    expect(latestMeteorDamage()).toBeCloseTo(baseDamage * 1.3, 5);
    expect(arena.blue.passiveState).toMatchObject({ isActive: false, stacks: 0, stackTimeRemaining: 0 });

    // The bonus applies once
    expect(cast('R').success).toBe(true);
    expect(latestMeteorDamage()).toBeCloseTo(baseDamage, 5);
  });

  test('empowered ability consumes Arcane Surge even when it deals no damage', () => {
    activatePassive(arena);

    expect(cast('W').success).toBe(true);

    expect(arena.blue.passiveState).toMatchObject({ isActive: false, stacks: 0, stackTimeRemaining: 0 });
  });

  test('other active stack passives do not amplify abilities', () => {
    const gorathArena = createTestArena({
      blueChampion: 'gorath',
      redChampion: 'warrior',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(100, 0),
    });
    const slamDamage = () => {
      gorathArena.blue.resetCooldowns();
      gorathArena.blue.setResource(gorathArena.blue.maxResource);
      gorathArena.red.setHealth(gorathArena.red.maxHealth);
      // Measure the change: maxHealth can be refreshed by the cast's stat update
      const before = gorathArena.red.health;
      gorathArena.castAbility(gorathArena.blue, 'Q');
      return before - gorathArena.red.health;
    };

    const baseDamage = slamDamage();
    expect(baseDamage).toBeGreaterThan(0);

    activatePassive(gorathArena);
    expect(slamDamage()).toBeCloseTo(baseDamage, 5);
    expect(gorathArena.blue.passiveState).toMatchObject({ isActive: true, stacks: 4 });
  });
});

describe('Vex - stealth on cast', () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'vex',
      redChampion: 'warrior',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(400, 0),
    });
  });

  test('Shadow Shroud does not break stealth', () => {
    const breakStealth = spyOn(arena.blue, 'breakStealth');

    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);

    expect(breakStealth).not.toHaveBeenCalled();
    expect(arena.blue.hasEffect('vex_stealth')).toBe(true);
  });

  test('other abilities break stealth', () => {
    arena.castAbility(arena.blue, 'W');
    const breakStealth = spyOn(arena.blue, 'breakStealth');

    expect(arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(700, 0) }).success).toBe(true);

    expect(breakStealth).toHaveBeenCalledTimes(1);
    expect(arena.blue.hasEffect('vex_stealth')).toBe(false);
  });
});

describe('Lume - orb abilities', () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'lume',
      redChampion: 'magnus',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(400, 0),
    });
  });

  function getOrb(): ServerLightOrb {
    const orb = arena.context
      .getAllEntities()
      .find((e): e is ServerLightOrb => e instanceof ServerLightOrb && e.ownerId === arena.blue.id);
    if (!orb) throw new Error('Lume has no Light Orb');
    return orb;
  }

  test('Q recast while the orb is away recalls it without mana or cooldown', () => {
    expect(arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) }).success).toBe(true);
    const orb = getOrb();
    expect(orb.state).toBe('traveling');
    expect(arena.blue.hasRecastAvailable('Q')).toBe(true);

    const mana = arena.blue.resource;
    const cooldown = arena.blue.getAbilityCooldown('Q');

    const recast = arena.castAbility(arena.blue, 'Q');

    expect(recast).toEqual({ success: true, manaCost: 0, cooldown: 0 });
    expect(arena.blue.hasRecastAvailable('Q')).toBe(false);
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(cooldown);

    // A recalled orb is back within a second; an unrecalled one would still be stationed
    arena.tickAllFrames(60);
    expect(orb.state).toBe('orbiting');
  });

  test('Q recast after the orb has returned fails instead of casting Q again', () => {
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) });
    const orb = getOrb();

    // Travel out, stay stationed for 4s, travel back - all inside the 10s recast window
    for (let frame = 0; frame < 9 * 60 && !orb.isOrbiting; frame++) {
      arena.tickAll();
    }
    expect(orb.isOrbiting).toBe(true);
    expect(arena.blue.hasRecastAvailable('Q')).toBe(true);

    arena.blue.resetCooldowns();
    const mana = arena.blue.resource;

    const result = arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) });

    expect(result).toEqual({ success: false, failReason: 'invalid_target' });
    expect(orb.isOrbiting).toBe(true);
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
  });

  test('R destroys the orb and disables the orb abilities', () => {
    // Q creates the orb
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) });
    const orb = getOrb();

    expect(arena.castAbility(arena.blue, 'R').success).toBe(true);

    expect(orb.isDestroyed).toBe(true);
    expect(arena.blue.abilityStates.Q.isDisabled).toBe(true);
    expect(arena.blue.abilityStates.W.isDisabled).toBe(true);
    expect(arena.blue.abilityStates.E.isDisabled).toBe(true);
  });
});

describe('Leveling abilities', () => {
  test('R stops at rank 3 and basic abilities stop at their max rank', () => {
    const arena = createTestArena({ blueChampion: 'vex', redChampion: 'warrior' });
    const champion = arena.blue;
    champion.level = 18;

    for (let i = 0; i < 10; i++) {
      champion.skillPoints = 1;
      champion.levelUpAbility('R');
    }
    expect(champion.abilityRanks.R).toBe(3);

    const qMaxRank = getAbilityDefinition(champion.definition.abilities.Q)!.maxRank;
    for (let i = 0; i < 10; i++) {
      champion.skillPoints = 1;
      champion.levelUpAbility('Q');
    }
    expect(champion.abilityRanks.Q).toBe(qMaxRank);
  });
});
