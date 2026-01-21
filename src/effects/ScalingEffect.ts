/**
 * Scaling effects that use AbilityScaling for rank-based + stat scaling.
 */

import type { Champion } from '@/champions/Champion';
import type { AbilityScaling } from '@/abilities/types';
import { IEffect, EffectApplicationContext } from './EffectDescriptor';

/**
 * Calculate the scaled value from an AbilityScaling configuration.
 */
export function calculateScaledValue(
  scaling: AbilityScaling,
  caster: Champion,
  rank: number
): number {
  const stats = caster.getStats();
  const baseStats = caster.getDefinitionBaseStats();

  // Base value for current rank (array is 0-indexed, rank is 1-5)
  const rankIndex = Math.max(0, Math.min(rank - 1, scaling.base.length - 1));
  let value = scaling.base[rankIndex] ?? scaling.base[0] ?? 0;

  // Add stat ratios
  if (scaling.adRatio) {
    value += stats.attackDamage * scaling.adRatio;
  }
  if (scaling.apRatio) {
    value += stats.abilityPower * scaling.apRatio;
  }
  if (scaling.bonusHealthRatio) {
    const bonusHealth = stats.maxHealth - baseStats.health;
    value += bonusHealth * scaling.bonusHealthRatio;
  }
  if (scaling.maxHealthRatio) {
    value += stats.maxHealth * scaling.maxHealthRatio;
  }
  if (scaling.missingHealthRatio) {
    const missingHealth = stats.maxHealth - stats.health;
    value += missingHealth * scaling.missingHealthRatio;
  }
  if (scaling.armorRatio) {
    value += stats.armor * scaling.armorRatio;
  }
  if (scaling.magicResistRatio) {
    value += stats.magicResist * scaling.magicResistRatio;
  }

  return value;
}

/**
 * Damage effect that scales with ability rank and stats.
 *
 * @example
 * ```typescript
 * new ScalingDamageEffect({
 *   base: [70, 100, 130, 160, 190],  // 70/100/130/160/190 base damage
 *   adRatio: 0.6,                     // +60% AD
 * }, 'physical', 'Spear Poke')
 * ```
 */
export class ScalingDamageEffect implements IEffect {
  readonly scaling: AbilityScaling;
  readonly damageType: 'physical' | 'magic' | 'true';
  readonly name: string;

  constructor(scaling: AbilityScaling, damageType: 'physical' | 'magic' | 'true' = 'physical', name: string = 'Ability') {
    this.scaling = scaling;
    this.damageType = damageType;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { target, caster, abilityRank } = context;
    if (!target) return;

    // Get rank from context, default to 1
    const rank = abilityRank ?? 1;

    // Calculate scaled damage
    const damage = calculateScaledValue(this.scaling, caster, rank);

    // Apply damage (resistance is handled in takeDamage)
    target.takeDamage(damage, this.damageType, caster, this.name);
  }

  clone(): IEffect {
    return new ScalingDamageEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.damageType,
      this.name
    );
  }
}

/**
 * Healing effect that scales with ability rank and stats.
 *
 * @example
 * ```typescript
 * new ScalingHealEffect({
 *   base: [50, 80, 110, 140, 170],
 *   apRatio: 0.4,
 * })
 * ```
 */
export class ScalingHealEffect implements IEffect {
  readonly scaling: AbilityScaling;

  constructor(scaling: AbilityScaling) {
    this.scaling = scaling;
  }

  apply(context: EffectApplicationContext): void {
    const { target, caster, abilityRank } = context;
    const healTarget = target ?? caster;
    if (!healTarget) return;

    const rank = abilityRank ?? 1;
    const healAmount = calculateScaledValue(this.scaling, caster, rank);

    healTarget.heal(healAmount);
  }

  clone(): IEffect {
    return new ScalingHealEffect({ ...this.scaling, base: [...this.scaling.base] });
  }
}

/**
 * Shield effect that scales with ability rank and stats.
 *
 * @example
 * ```typescript
 * new ScalingShieldEffect({
 *   base: [60, 90, 120, 150, 180],
 *   apRatio: 0.3,
 * }, 3)  // 3 second duration
 * ```
 */
export class ScalingShieldEffect implements IEffect {
  readonly scaling: AbilityScaling;
  readonly duration: number;

  constructor(scaling: AbilityScaling, duration: number) {
    this.scaling = scaling;
    this.duration = duration;
  }

  apply(context: EffectApplicationContext): void {
    const { target, caster, abilityRank } = context;
    const shieldTarget = target ?? caster;
    if (!shieldTarget) return;

    const rank = abilityRank ?? 1;
    const shieldAmount = calculateScaledValue(this.scaling, caster, rank);

    shieldTarget.addShield(shieldAmount, this.duration);
  }

  clone(): IEffect {
    return new ScalingShieldEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.duration
    );
  }
}

/**
 * Stat buff effect that scales with ability rank.
 * Useful for abilities that give more stats at higher ranks.
 *
 * @example
 * ```typescript
 * new ScalingStatBuffEffect(
 *   'attackSpeed',
 *   { base: [0.2, 0.3, 0.4, 0.5, 0.6] },  // 20%/30%/40%/50%/60%
 *   5  // 5 second duration
 * )
 * ```
 */
export class ScalingStatBuffEffect implements IEffect {
  readonly stat: 'attackDamage' | 'armor' | 'magicResist' | 'attackSpeed' | 'movementSpeed';
  readonly scaling: AbilityScaling;
  readonly duration: number;
  readonly isPercent: boolean;

  constructor(
    stat: 'attackDamage' | 'armor' | 'magicResist' | 'attackSpeed' | 'movementSpeed',
    scaling: AbilityScaling,
    duration: number,
    isPercent: boolean = false
  ) {
    this.stat = stat;
    this.scaling = scaling;
    this.duration = duration;
    this.isPercent = isPercent;
  }

  apply(context: EffectApplicationContext): void {
    const { target, caster, abilityRank } = context;
    const buffTarget = target ?? caster;
    if (!buffTarget) return;

    const rank = abilityRank ?? 1;
    const value = calculateScaledValue(this.scaling, caster, rank);

    if (this.isPercent) {
      buffTarget.addStatModifier(this.stat, 0, value);
    } else {
      buffTarget.addStatModifier(this.stat, value, 0);
    }

    // Note: Duration-based removal would need to be handled by DurationEffect wrapper
  }

  remove(context: EffectApplicationContext): void {
    const { target, caster, abilityRank } = context;
    const buffTarget = target ?? caster;
    if (!buffTarget) return;

    const rank = abilityRank ?? 1;
    const value = calculateScaledValue(this.scaling, caster, rank);

    if (this.isPercent) {
      buffTarget.removeStatModifier(this.stat, 0, value);
    } else {
      buffTarget.removeStatModifier(this.stat, value, 0);
    }
  }

  clone(): IEffect {
    return new ScalingStatBuffEffect(
      this.stat,
      { ...this.scaling, base: [...this.scaling.base] },
      this.duration,
      this.isPercent
    );
  }
}
