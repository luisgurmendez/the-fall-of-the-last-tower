/**
 * Effects that enhance the next basic attack.
 */

import { IEffect, EffectApplicationContext } from './EffectDescriptor';

/**
 * Base interface for basic attack modifiers.
 */
export interface BasicAttackModifier {
  /** Bonus damage to add */
  bonusDamage?: number;
  /** Damage multiplier */
  damageMultiplier?: number;
  /** Whether the attack pierces armor */
  piercing?: boolean;
  /** Whether the attack applies on-hit effects twice */
  doubleOnHit?: boolean;
  /** Range bonus */
  bonusRange?: number;
  /** Applies a status effect on hit */
  onHitEffect?: string;
  /** Number of attacks this modifier applies to */
  charges?: number;
  /** Name of the modifier (for identification/debugging) */
  name?: string;
  /** Duration in seconds (for time-limited modifiers) */
  duration?: number;
}

/**
 * Makes the next basic attack pierce armor (deals true damage).
 */
export class NextBasicAttackPiercingEnhancementEffect implements IEffect {
  apply(context: EffectApplicationContext): void {
    const { caster } = context;

    caster.addBasicAttackModifier({
      piercing: true,
      charges: 1,
    });
  }

  clone(): IEffect {
    return new NextBasicAttackPiercingEnhancementEffect();
  }
}

/**
 * Empowers the next basic attack with bonus damage.
 */
export class NextBasicAttackBonusDamageEffect implements IEffect {
  readonly bonusDamage: number;
  readonly damageType: 'physical' | 'magic' | 'true';

  constructor(bonusDamage: number, damageType: 'physical' | 'magic' | 'true' = 'physical') {
    this.bonusDamage = bonusDamage;
    this.damageType = damageType;
  }

  apply(context: EffectApplicationContext): void {
    const { caster } = context;

    caster.addBasicAttackModifier({
      bonusDamage: this.bonusDamage,
      charges: 1,
    });
  }

  clone(): IEffect {
    return new NextBasicAttackBonusDamageEffect(this.bonusDamage, this.damageType);
  }
}

/**
 * Empowers the next N basic attacks with a damage multiplier.
 */
export class EmpoweredAttacksEffect implements IEffect {
  readonly damageMultiplier: number;
  readonly charges: number;

  constructor(damageMultiplier: number, charges: number = 1) {
    this.damageMultiplier = damageMultiplier;
    this.charges = charges;
  }

  apply(context: EffectApplicationContext): void {
    const { caster } = context;

    caster.addBasicAttackModifier({
      damageMultiplier: this.damageMultiplier,
      charges: this.charges,
    });
  }

  clone(): IEffect {
    return new EmpoweredAttacksEffect(this.damageMultiplier, this.charges);
  }
}

/**
 * Extends attack range for the next attack.
 */
export class ExtendedRangeAttackEffect implements IEffect {
  readonly bonusRange: number;

  constructor(bonusRange: number) {
    this.bonusRange = bonusRange;
  }

  apply(context: EffectApplicationContext): void {
    const { caster } = context;

    caster.addBasicAttackModifier({
      bonusRange: this.bonusRange,
      charges: 1,
    });
  }

  clone(): IEffect {
    return new ExtendedRangeAttackEffect(this.bonusRange);
  }
}
