/**
 * Ability tooltips (src/ui/hud/tooltipText.ts) fill every placeholder,
 * including for an ability not learned yet; bonus health is over the
 * champion's base health, as on the server; passives fill theirs too; and
 * champion select's descriptions (src/ui/matchmaking/abilityText.ts) leave
 * no raw braces.
 */
import { describe, it, expect } from 'bun:test';
import { CHAMPION_DEFINITIONS, getAbilityDefinition, getPassiveDefinition, getPassiveLevelValue, type ChampionStats } from '@siege/shared';
import { interpolateAbilityDescription, interpolatePassiveDescription } from '@/ui/hud/tooltipText';
import { interpolateAbilityDescription as selectAbilityText, interpolatePassiveDescription as selectPassiveText } from '@/ui/matchmaking/abilityText';

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

describe('bonus health in HUD tooltips', () => {
  // What the server calls bonus health: max health over the champion's base (packages/server AbilityHelpers)
  const gorath = CHAMPION_DEFINITIONS.gorath;
  const slam = getAbilityDefinition(gorath.abilities.Q)!;

  it("is none for a champion at its base health, however high that base is (Gorath's 700)", () => {
    const base = gorath.baseStats.health;
    const at = { ...stats, maxHealth: base, health: base } as ChampionStats;
    expect(interpolateAbilityDescription('{damage}', slam, 1, at, base)).toBe(String(slam.damage!.scaling.base[0]));
  });

  it('is what the max health has over that base', () => {
    const base = gorath.baseStats.health;
    const at = { ...stats, maxHealth: base + 500, health: base + 500 } as ChampionStats;
    const expected = Math.round(slam.damage!.scaling.base[0] + 500 * slam.damage!.scaling.bonusHealthRatio!);
    expect(interpolateAbilityDescription('{damage}', slam, 1, at, base)).toBe(`${expected} (+4% Bonus HP)`);
  });
});

describe('passive tooltips', () => {
  const kael = CHAMPION_DEFINITIONS.warrior;
  const passive = getPassiveDefinition(kael.passive)!;

  it("fill Kael's {shield}: its value at the champion's level, with bonus health", () => {
    const base = kael.baseStats.health;
    const at = { ...stats, maxHealth: base + 300, health: base + 300 } as ChampionStats;
    const text = interpolatePassiveDescription(passive.description, passive, 6, at, base);
    expect(text).not.toContain('{');
    const expected = Math.round(getPassiveLevelValue(passive, 6) + 300 * passive.shield!.scaling.bonusHealthRatio!);
    expect(text).toContain(`absorbing ${expected} (+10% Bonus HP) damage`);
  });

  it('use the level bracket: level 1 and level 16 differ', () => {
    const base = kael.baseStats.health;
    const at = { ...stats, maxHealth: base, health: base } as ChampionStats;
    const low = interpolatePassiveDescription('{shield}', passive, 1, at, base);
    const high = interpolatePassiveDescription('{shield}', passive, 16, at, base);
    expect(Number(low)).toBe(getPassiveLevelValue(passive, 1));
    expect(Number(high)).toBe(getPassiveLevelValue(passive, 16));
    expect(Number(high)).toBeGreaterThan(Number(low));
  });

  it("leave a passive with no placeholders as it is, and never leave raw braces", () => {
    const plain = getPassiveDefinition(CHAMPION_DEFINITIONS.vex.passive)!;
    expect(interpolatePassiveDescription(plain.description, plain, 1, stats, 600)).toBe(plain.description);
    expect(interpolatePassiveDescription('Heals {heal}.', plain, 1, stats, 600)).toBe('Heals ?.');
  });
});

describe('champion select descriptions', () => {
  it("fill every placeholder of every ability and passive (no raw braces), at rank 1", () => {
    for (const champion of Object.values(CHAMPION_DEFINITIONS)) {
      for (const slot of ['Q', 'W', 'E', 'R'] as const) {
        const ability = getAbilityDefinition(champion.abilities[slot])!;
        expect({ id: ability.id, text: selectAbilityText(ability, 1, champion.baseStats) })
          .toEqual({ id: ability.id, text: expect.not.stringContaining('{') });
      }
      const passive = getPassiveDefinition(champion.passive)!;
      expect({ id: passive.id, text: selectPassiveText(passive) })
        .toEqual({ id: passive.id, text: expect.not.stringContaining('{') });
    }
  });

  it("show Vex's Ninja Mode attack speed bonus", () => {
    const ninja = getAbilityDefinition(CHAMPION_DEFINITIONS.vex.abilities.R)!;
    const bonus = ninja.statTransform!.statModifiers!.attackSpeed![0];
    expect(selectAbilityText(ninja, 1, CHAMPION_DEFINITIONS.vex.baseStats)).toContain(`${Math.round(bonus * 100)}%`);
  });

  it("show Kael's passive shield at level 1", () => {
    const passive = getPassiveDefinition(CHAMPION_DEFINITIONS.warrior.passive)!;
    expect(selectPassiveText(passive)).toContain(`absorbing ${getPassiveLevelValue(passive, 1)}`);
  });
});
