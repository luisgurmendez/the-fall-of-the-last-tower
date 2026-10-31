/**
 * Ability tooltips (src/ui/hud/tooltipText.ts) fill every placeholder,
 * including for an ability not learned yet.
 */
import { describe, it, expect } from 'bun:test';
import type { ChampionStats } from '@siege/shared';
import { interpolateAbilityDescription } from '@/ui/hud/tooltipText';

const stats = { attackDamage: 60, abilityPower: 0, maxHealth: 600, health: 600, armor: 30, magicResist: 30 } as ChampionStats;

describe('interpolateAbilityDescription', () => {
  it("shows rank 1's values for an ability not learned yet", () => {
    const text = interpolateAbilityDescription('Deals {damage} damage.', {
      name: 'Slash', description: '', damage: { type: 'physical', scaling: { base: [50, 80] } },
    }, 0, stats);
    expect(text).toBe('Deals 50 damage.');
  });

  it('fills effect durations and attack speed bonuses', () => {
    const text = interpolateAbilityDescription('Gain {attackSpeedBonus}% attack speed for {effectDuration} seconds.', {
      name: 'Rush', description: '', effectDuration: 15, statTransform: { statModifiers: { attackSpeed: [0.3, 0.45, 0.6] } },
    }, 2, stats);
    expect(text).toBe('Gain 45% attack speed for 15 seconds.');
  });

  it('never leaves raw braces', () => {
    const text = interpolateAbilityDescription('Shields for {shield}.', { name: 'Guard', description: '' }, 1, stats);
    expect(text).toBe('Shields for ?.');
  });
});
