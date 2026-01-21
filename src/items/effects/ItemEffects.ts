/**
 * Specialized effects for item passives.
 */

import type { Champion } from '@/champions/Champion';
import { IEffect, EffectApplicationContext } from '@/effects/EffectDescriptor';

/**
 * Extended context for item effects that may include damage dealt.
 */
export interface ItemEffectContext extends EffectApplicationContext {
  /** Damage dealt (for on_hit effects like lifesteal) */
  damageDealt?: number;
}

/**
 * Lifesteal effect - heals based on damage dealt.
 * Used by items like Bloodthirster.
 *
 * @example
 * ```typescript
 * new LifestealEffect(0.15)  // 15% lifesteal
 * ```
 */
export class LifestealEffect implements IEffect {
  readonly lifestealPercent: number;

  constructor(lifestealPercent: number) {
    this.lifestealPercent = lifestealPercent;
  }

  apply(context: EffectApplicationContext): void {
    const { caster } = context;
    const damageDealt = (context as ItemEffectContext).damageDealt;

    if (!damageDealt || damageDealt <= 0) return;

    const healAmount = damageDealt * this.lifestealPercent;
    caster.heal(healAmount);
  }

  clone(): IEffect {
    return new LifestealEffect(this.lifestealPercent);
  }
}

/**
 * Thorns effect - deals damage back to attackers.
 * Used by items like Thornmail.
 *
 * @example
 * ```typescript
 * new ThornsEffect(25, 'magic')  // Reflect 25 magic damage
 * ```
 */
export class ThornsEffect implements IEffect {
  readonly damage: number;
  readonly damageType: 'physical' | 'magic' | 'true';

  constructor(damage: number, damageType: 'physical' | 'magic' | 'true' = 'magic') {
    this.damage = damage;
    this.damageType = damageType;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target } = context;
    // In on_take_damage context, target is the attacker
    if (!target) return;

    target.takeDamage(this.damage, this.damageType, caster);
  }

  clone(): IEffect {
    return new ThornsEffect(this.damage, this.damageType);
  }
}

/**
 * Percent thorns effect - reflects a percentage of damage taken.
 *
 * @example
 * ```typescript
 * new PercentThornsEffect(0.1, 'magic')  // Reflect 10% of damage as magic
 * ```
 */
export class PercentThornsEffect implements IEffect {
  readonly percent: number;
  readonly damageType: 'physical' | 'magic' | 'true';

  constructor(percent: number, damageType: 'physical' | 'magic' | 'true' = 'magic') {
    this.percent = percent;
    this.damageType = damageType;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target } = context;
    const damageDealt = (context as ItemEffectContext).damageDealt;

    if (!target || !damageDealt) return;

    const reflectDamage = damageDealt * this.percent;
    target.takeDamage(reflectDamage, this.damageType, caster);
  }

  clone(): IEffect {
    return new PercentThornsEffect(this.percent, this.damageType);
  }
}

/**
 * On-hit bonus damage effect.
 * Used for items like Wit's End.
 *
 * @example
 * ```typescript
 * new OnHitDamageEffect(40, 'magic')  // Deal 40 bonus magic damage on hit
 * ```
 */
export class OnHitDamageEffect implements IEffect {
  readonly damage: number;
  readonly damageType: 'physical' | 'magic' | 'true';

  constructor(damage: number, damageType: 'physical' | 'magic' | 'true' = 'magic') {
    this.damage = damage;
    this.damageType = damageType;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target } = context;
    if (!target) return;

    target.takeDamage(this.damage, this.damageType, caster);
  }

  clone(): IEffect {
    return new OnHitDamageEffect(this.damage, this.damageType);
  }
}

/**
 * Shield on low health effect (like Sterak's Gage).
 *
 * @example
 * ```typescript
 * new LowHealthShieldEffect(0.3, 5)  // Shield for 30% max HP for 5 seconds
 * ```
 */
export class LowHealthShieldEffect implements IEffect {
  readonly shieldPercent: number;
  readonly duration: number;

  constructor(shieldPercent: number, duration: number) {
    this.shieldPercent = shieldPercent;
    this.duration = duration;
  }

  apply(context: EffectApplicationContext): void {
    const { caster } = context;
    const stats = caster.getStats();
    const shieldAmount = stats.maxHealth * this.shieldPercent;

    caster.addShield(shieldAmount, this.duration, 'low_health_shield');
  }

  clone(): IEffect {
    return new LowHealthShieldEffect(this.shieldPercent, this.duration);
  }
}

/**
 * Spellblade effect - empowers next basic attack after casting ability.
 * Used for items like Sheen/Trinity Force.
 *
 * @example
 * ```typescript
 * new SpellbladeEffect(1.0)  // Bonus damage equal to 100% base AD
 * ```
 */
export class SpellbladeEffect implements IEffect {
  readonly baseDamageMultiplier: number;

  constructor(baseDamageMultiplier: number = 1.0) {
    this.baseDamageMultiplier = baseDamageMultiplier;
  }

  apply(context: EffectApplicationContext): void {
    const { caster } = context;

    // Add a basic attack modifier for the next attack
    // Use getStats() to get current attack damage with all modifiers
    caster.addBasicAttackModifier({
      bonusDamage: caster.getStats().attackDamage * this.baseDamageMultiplier,
      charges: 1,
    });
  }

  clone(): IEffect {
    return new SpellbladeEffect(this.baseDamageMultiplier);
  }
}

/**
 * Execute damage effect - bonus damage to low health targets.
 *
 * @example
 * ```typescript
 * new ExecuteDamageEffect(0.05, 0.5)  // +5% damage per 1% missing HP, up to 50%
 * ```
 */
export class ExecuteDamageEffect implements IEffect {
  readonly damagePerMissingPercent: number;
  readonly maxBonus: number;

  constructor(damagePerMissingPercent: number, maxBonus: number = 1.0) {
    this.damagePerMissingPercent = damagePerMissingPercent;
    this.maxBonus = maxBonus;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target } = context;
    if (!target) return;

    const targetStats = target.getStats();
    const missingHealthPercent = 1 - (targetStats.health / targetStats.maxHealth);
    const bonusMultiplier = Math.min(
      this.maxBonus,
      missingHealthPercent * this.damagePerMissingPercent * 100
    );

    // This would typically modify the damage, but since we're applying
    // as a passive, we'll add bonus damage based on caster's AD
    const casterStats = caster.getStats();
    const bonusDamage = casterStats.attackDamage * bonusMultiplier;

    if (bonusDamage > 0) {
      target.takeDamage(bonusDamage, 'physical', caster);
    }
  }

  clone(): IEffect {
    return new ExecuteDamageEffect(this.damagePerMissingPercent, this.maxBonus);
  }
}

/**
 * Healing reduction effect - applies grievous wounds.
 *
 * @example
 * ```typescript
 * new GrievousWoundsEffect(0.4, 3)  // 40% healing reduction for 3 seconds
 * ```
 */
export class GrievousWoundsEffect implements IEffect {
  readonly healingReduction: number;
  readonly duration: number;

  constructor(healingReduction: number, duration: number) {
    this.healingReduction = healingReduction;
    this.duration = duration;
  }

  apply(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    // Add a debuff that reduces healing
    // This would need a healing modifier system to fully work
    target.addImmunity(`grievous_wounds_${this.healingReduction}`);
  }

  clone(): IEffect {
    return new GrievousWoundsEffect(this.healingReduction, this.duration);
  }
}
