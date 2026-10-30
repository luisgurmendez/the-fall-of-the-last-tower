/**
 * Stealthed wards and traps must not be sent to the enemy team, even when
 * they are inside an enemy's sight range (otherwise a modified client can
 * see them).
 */

import { describe, test, expect } from 'bun:test';
import { Vector, TEAM_BLUE, TEAM_RED } from '@siege/shared';
import { ServerWard } from '../simulation/ServerWard';
import { ServerTrap } from '../simulation/ServerTrap';
import { createTestArena } from './ServerTestUtils';

function createTrap(position: Vector, isStealthed: boolean): ServerTrap {
  return new ServerTrap({
    id: `trap-${isStealthed ? 'stealth' : 'visible'}`,
    position,
    side: TEAM_RED,
    ownerId: 'test-red',
    triggerRadius: 50,
    duration: 60,
    isStealthed,
    rootDuration: 1,
    soulStacksOnTrigger: 0,
    explosionDamage: 0,
    explosionRadius: 300,
    explosionRootDuration: 1,
  });
}

describe('Stealthed entity visibility', () => {
  test('enemy stealth ward in sight range is not visible', () => {
    const arena = createTestArena({ redPosition: new Vector(3000, 3000), learnAbilities: false });
    const ward = new ServerWard({
      id: 'red-ward',
      position: new Vector(150, 0),
      side: TEAM_RED,
      wardType: 'stealth',
      ownerId: 'test-red',
    });
    arena.context.addEntity(ward);

    const fog = arena.context.getFogOfWar();
    fog.updateVision(arena.context, 1);

    expect(fog.isVisibleTo(ward, TEAM_BLUE)).toBe(false);
    expect(fog.isVisibleTo(ward, TEAM_RED)).toBe(true);
  });

  test('enemy stealth ward revealed by a control ward is visible', () => {
    const arena = createTestArena({ redPosition: new Vector(3000, 3000), learnAbilities: false });
    const ward = arena.context.placeWard('player-red', 'stealth', new Vector(150, 0))!;
    arena.context.placeWard('player-blue', 'control', new Vector(100, 0));
    ward.update(1 / 30, arena.context);

    const fog = arena.context.getFogOfWar();
    fog.updateVision(arena.context, 1);

    expect(fog.isVisibleTo(ward, TEAM_BLUE)).toBe(true);
  });

  test('enemy stealthed trap in sight range is not visible', () => {
    const arena = createTestArena({ redPosition: new Vector(3000, 3000), learnAbilities: false });
    const trap = createTrap(new Vector(150, 0), true);
    arena.context.addEntity(trap);

    const fog = arena.context.getFogOfWar();
    fog.updateVision(arena.context, 1);

    expect(fog.isVisibleTo(trap, TEAM_BLUE)).toBe(false);
    expect(fog.isVisibleTo(trap, TEAM_RED)).toBe(true);
  });

  test('enemy non-stealthed trap in sight range is visible', () => {
    const arena = createTestArena({ redPosition: new Vector(3000, 3000), learnAbilities: false });
    const trap = createTrap(new Vector(150, 0), false);
    arena.context.addEntity(trap);

    const fog = arena.context.getFogOfWar();
    fog.updateVision(arena.context, 1);

    expect(fog.isVisibleTo(trap, TEAM_BLUE)).toBe(true);
  });
});
