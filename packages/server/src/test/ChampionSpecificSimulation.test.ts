/**
 * Champion-specific simulation rules.
 *
 * Pins the per-tick and basic attack behavior that belongs to a single
 * champion rather than to the generic ServerChampion simulation:
 * - Lume: the passive and Q/W/E follow the Light Orb's state
 * - Vex: Shadow Step's empowered attack deals bonus damage and is consumed
 */

import { describe, test, expect, beforeEach, afterEach, spyOn, type Mock } from 'bun:test';
import { Vector, calculateAbilityValue, getAbilityDefinition } from '@siege/shared';
import { createTestArena, calculatePhysicalDamage, type TestArena } from './ServerTestUtils';
import { ServerLightOrb, LUME_ORB_CONFIG } from '../simulation/ServerLightOrb';
import { passiveTriggerSystem } from '../systems/PassiveTriggerSystem';

describe('Lume - Light Orb passive state', () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'lume',
      redChampion: 'magnus',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(400, 0),
    });
  });

  test('passive and Q/W/E follow whether the orb is alive', () => {
    // Q creates the orb
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) });
    const orb = arena.context
      .getAllEntities()
      .find((e): e is ServerLightOrb => e instanceof ServerLightOrb && e.ownerId === arena.blue.id)!;
    const { abilityStates, passiveState } = arena.blue;

    arena.tick();
    expect(passiveState).toMatchObject({ isActive: true, cooldownRemaining: 0 });
    expect([abilityStates.Q.isDisabled, abilityStates.W.isDisabled, abilityStates.E.isDisabled])
      .toEqual([false, false, false]);

    orb.destroy();
    arena.tick();

    // Passive shows the orb respawn timer while Q/W/E are unusable
    expect(passiveState).toMatchObject({ isActive: false, cooldownRemaining: LUME_ORB_CONFIG.respawnTime });
    expect([abilityStates.Q.isDisabled, abilityStates.W.isDisabled, abilityStates.E.isDisabled])
      .toEqual([true, true, true]);
  });
});

describe('Vex - empowered attack', () => {
  let dispatchTrigger: Mock<typeof passiveTriggerSystem.dispatchTrigger>;

  beforeEach(() => {
    // Keep Assassin's Mark procs out of the measured damage
    dispatchTrigger = spyOn(passiveTriggerSystem, 'dispatchTrigger').mockImplementation(() => {});
  });

  afterEach(() => {
    dispatchTrigger.mockRestore();
  });

  /** Health the target loses to Vex's first basic attack. */
  function firstAttackDamage(empowered: boolean): { damage: number; arena: TestArena } {
    const arena = createTestArena({
      blueChampion: 'vex',
      redChampion: 'warrior',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(50, 0),
    });
    if (empowered) arena.blue.applyEffect('vex_empowered', 4, arena.blue.id);

    const startHealth = arena.red.health;
    arena.blue.setAttackTarget(arena.red.id);
    for (let frame = 0; frame < 120 && arena.red.health >= startHealth; frame++) {
      arena.tick();
    }
    return { damage: startHealth - arena.red.health, arena };
  }

  test('empowered attack deals Shadow Step bonus damage and consumes the buff', () => {
    const normal = firstAttackDamage(false);
    const empowered = firstAttackDamage(true);
    expect(normal.damage).toBeGreaterThan(0);

    const { blue, red } = empowered.arena;
    const dash = getAbilityDefinition('vex_dash')!;
    const stats = blue.getStats();
    const bonus = calculateAbilityValue(dash.damage!.scaling, blue.abilityStates.E.rank, {
      attackDamage: stats.attackDamage,
      abilityPower: stats.abilityPower,
    });

    expect(empowered.damage - normal.damage).toBeCloseTo(calculatePhysicalDamage(bonus, red.getStats().armor), 0);
    expect(blue.hasEffect('vex_empowered')).toBe(false);
  });
});
