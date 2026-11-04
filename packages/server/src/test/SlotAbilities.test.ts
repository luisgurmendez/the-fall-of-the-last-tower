/**
 * A slot holding another ability for a while (Nocthar's colossus swaps his
 * W, E and R): ServerChampion.swapSlotAbility.
 * - Casting the slot casts the ability it holds now, at the slot's rank
 * - Snapshots name it (abilities[slot].abilityId; null back to its own)
 * - Each ability keeps its own cooldown, and it keeps running while the
 *   ability is out of its slot
 * - Leveling the slot meanwhile levels it (the rank is the slot's)
 */

import { describe, test, expect } from 'bun:test';
import { Vector, getAbilityDefinition } from '@siege/shared';
import { createTestArena, type TestArena } from './ServerTestUtils';

const FRAMES_PER_SECOND = 60;

/** Magnus (blue) at (0, 0) next to Kael (red); every ability rank 1, full mana */
function magnusArena(): TestArena {
  const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(80, 0) });
  arena.blue.setLevel(6);
  arena.blue.setResource(arena.blue.maxResource);
  return arena;
}

describe('A slot holding another ability', () => {
  test('casting the slot casts the ability it holds', () => {
    const arena = magnusArena();
    // Gorath's roar in Magnus's W: it taunts
    arena.blue.swapSlotAbility('W', 'gorath_taunt', arena.context);
    expect(arena.blue.abilityInSlot('W')).toBe('gorath_taunt');
    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);
    expect(arena.red.hasEffect('taunt')).toBe(true);
  });

  test('swapped back, the slot casts its own again', () => {
    const arena = magnusArena();
    arena.blue.swapSlotAbility('W', 'gorath_taunt', arena.context);
    arena.blue.swapSlotAbility('W', null, arena.context);
    expect(arena.blue.abilityInSlot('W')).toBe('magnus_shield');
    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);
    expect(arena.red.hasEffect('taunt')).toBe(false);
    expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
  });

  test('snapshots name the ability a slot holds, and null once back to its own', () => {
    const arena = magnusArena();
    arena.blue.swapSlotAbility('W', 'gorath_taunt', arena.context);
    expect(arena.blue.toSnapshot().abilities.W.abilityId).toBe('gorath_taunt');
    expect(arena.blue.toSnapshot().abilities.Q.abilityId).toBeUndefined();
    arena.blue.swapSlotAbility('W', null, arena.context);
    expect(arena.blue.toSnapshot().abilities.W.abilityId).toBeNull();
  });

  test('each ability keeps its own cooldown', () => {
    const arena = magnusArena();
    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);
    const shieldCooldown = arena.blue.getAbilityCooldown('W');
    expect(shieldCooldown).toBeGreaterThan(0);

    // The roar wasn't cast: it's ready
    const putAway = arena.context.getGameTime();
    arena.blue.swapSlotAbility('W', 'gorath_taunt', arena.context);
    expect(arena.blue.getAbilityCooldown('W')).toBe(0);
    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);
    const roarCooldown = arena.blue.getAbilityCooldown('W');
    expect(roarCooldown).toBeCloseTo(getAbilityDefinition('gorath_taunt')!.cooldown![0], 0);

    // Back to the shield: its cooldown, less the time since
    arena.tickFrames(FRAMES_PER_SECOND);
    arena.blue.swapSlotAbility('W', null, arena.context);
    const away = arena.context.getGameTime() - putAway;
    expect(away).toBeGreaterThan(0.9);
    expect(arena.blue.getAbilityCooldown('W')).toBeCloseTo(shieldCooldown - away, 1);
    expect(arena.blue.abilityStates.W.cooldownTotal).toBeGreaterThan(0);
  });

  test('a cooldown runs out while its ability is out of the slot', () => {
    const arena = magnusArena();
    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);
    const shieldCooldown = arena.blue.getAbilityCooldown('W');
    arena.blue.swapSlotAbility('W', 'gorath_taunt', arena.context);
    arena.tickFrames(Math.ceil((shieldCooldown + 0.5) * FRAMES_PER_SECOND));
    arena.blue.swapSlotAbility('W', null, arena.context);
    expect(arena.blue.getAbilityCooldown('W')).toBe(0);
  });

  test("the ability it holds is cast at the slot's rank", () => {
    const arena = magnusArena();
    arena.blue.maxAbility('W');
    arena.blue.swapSlotAbility('W', 'gorath_taunt', arena.context);
    expect(arena.blue.abilityStates.W.rank).toBe(5);
    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);
    // Gorath's roar at rank 5 has its rank 5 cooldown
    const cooldowns = getAbilityDefinition('gorath_taunt')!.cooldown!;
    expect(arena.blue.getAbilityCooldown('W')).toBeCloseTo(cooldowns[4], 0);
  });

  test('leveling the slot while it holds another levels the slot', () => {
    const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(80, 0), learnAbilities: false });
    arena.blue.setLevel(6);
    arena.blue.skillPoints = 2;
    arena.blue.swapSlotAbility('W', 'gorath_taunt', arena.context);
    expect(arena.blue.levelUpAbility('W')).toBe(true);
    arena.blue.swapSlotAbility('W', null, arena.context);
    expect(arena.blue.abilityStates.W.rank).toBe(1);
  });

  test('swapping a slot to what it already holds changes nothing', () => {
    const arena = magnusArena();
    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);
    const cooldown = arena.blue.getAbilityCooldown('W');
    arena.blue.swapSlotAbility('W', null, arena.context);
    expect(arena.blue.getAbilityCooldown('W')).toBe(cooldown);
    expect(arena.blue.toSnapshot().abilities.W.abilityId).toBeUndefined();
  });
});
