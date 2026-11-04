/**
 * Every ability that hits an area or flies gives a warning players can react
 * to (abilities/dodge.ts, scaled from League): ground areas let a champion
 * walk out of the middle, areas around the caster let one step back out of
 * the edge, skillshots let one step out of their path at full range.
 */

import { describe, it, expect } from 'bun:test';
import { DODGE_RULES, dodgeOf } from '../abilities/dodge';
import { getAllChampionDefinitions } from '../champions/ChampionRegistry';
import { getAbilityDefinition } from '../abilities/AbilityRegistry';
import type { AbilityDefinition } from '../types/abilities';

function kitAbilities(): { champion: string; slot: string; ability: AbilityDefinition }[] {
  return getAllChampionDefinitions().flatMap(champion => {
    const slots = (['Q', 'W', 'E', 'R'] as const).map(slot => [slot, champion.abilities[slot]] as const);
    const swapped = Object.entries(champion.swapAbilities ?? {}).map(([slot, id]) => [`${slot}*`, id as string] as const);
    return [...slots, ...swapped].flatMap(([slot, id]) => {
      const ability = getAbilityDefinition(id);
      return ability ? [{ champion: champion.name, slot, ability }] : [];
    });
  });
}

describe('dodgeOf', () => {
  it('a ground area: its cast and delay against walking out of its middle', () => {
    const dodge = dodgeOf({ id: 'x', name: 'x', description: '', type: 'active', targetType: 'ground_target', maxRank: 1, aoeRadius: 80, aoeDelay: 0.75, damage: { type: 'magic', scaling: { base: [1] } } } as AbilityDefinition)!;
    expect(dodge.kind).toBe('ground_area');
    expect(dodge.warning).toBeCloseTo(1.0, 5);
    expect(dodge.escape).toBeCloseTo(1.0, 5);
    expect(dodge.ratio).toBeCloseTo(1.0, 5);
  });

  it('a skillshot: its flight at full range against stepping out of its width', () => {
    const dodge = dodgeOf({ id: 'x', name: 'x', description: '', type: 'active', targetType: 'skillshot', maxRank: 1, range: 400, projectileSpeed: 400, projectileRadius: 20, damage: { type: 'magic', scaling: { base: [1] } } } as AbilityDefinition)!;
    expect(dodge.kind).toBe('skillshot');
    expect(dodge.warning).toBeCloseTo(1.25, 5);
    expect(dodge.ratio).toBeCloseTo(1.25 / 0.4, 5);
  });

  it('an ability that says why it is exempt has no rule', () => {
    expect(dodgeOf({ id: 'x', name: 'x', description: '', type: 'active', targetType: 'ground_target', maxRank: 1, aoeRadius: 80, damage: { type: 'magic', scaling: { base: [1] } }, dodgeExempt: 'its handler winds up 1 s' } as AbilityDefinition)).toBeNull();
  });

  it('a cone from the caster is a melee swing: stepped back from, like an area around it', () => {
    const dodge = dodgeOf({ id: 'x', name: 'x', description: '', type: 'active', targetType: 'ground_target', shape: 'cone', maxRank: 1, aoeRadius: 130, damage: { type: 'physical', scaling: { base: [1] } } } as AbilityDefinition)!;
    expect(dodge.kind).toBe('self_area');
  });

  it('only helping (speed, shields) is not dodged', () => {
    expect(dodgeOf({ id: 'x', name: 'x', description: '', type: 'active', targetType: 'self', maxRank: 1, aoeRadius: 200, appliesEffects: ['speed_30'] } as AbilityDefinition)).toBeNull();
  });

  it('buffs, targets and dashes are not dodged: no rule', () => {
    expect(dodgeOf({ id: 'x', name: 'x', description: '', type: 'active', targetType: 'self', maxRank: 1 } as AbilityDefinition)).toBeNull();
    expect(dodgeOf({ id: 'x', name: 'x', description: '', type: 'active', targetType: 'target_enemy', maxRank: 1, range: 100 } as AbilityDefinition)).toBeNull();
  });
});

describe('every kit gives a warning players can react to', () => {
  for (const { champion, slot, ability } of kitAbilities()) {
    const dodge = dodgeOf(ability);
    if (!dodge) continue;
    const rule = DODGE_RULES[dodge.kind][slot.startsWith('R') ? 'ultimate' : 'basic'];
    it(`${champion} ${slot} ${ability.name}: ${dodge.kind} ratio ${dodge.ratio.toFixed(2)} >= ${rule}`, () => {
      expect(dodge.ratio).toBeGreaterThanOrEqual(rule - 1e-9);
    });
  }
});
