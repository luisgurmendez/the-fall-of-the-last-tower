/**
 * Stat-based effects like damage, healing, stat modifications.
 */

import type { Champion } from '@/champions/Champion';
import { IEffect, EffectApplicationContext } from './EffectDescriptor';

/**
 * Base damage effect.
 */
export class DamageEffect implements IEffect {
  readonly baseDamage: number;
  readonly damageType: 'physical' | 'magic' | 'true';
  readonly name: string;

  constructor(baseDamage: number, damageType: 'physical' | 'magic' | 'true' = 'physical', name: string = 'Damage') {
    this.baseDamage = baseDamage;
    this.damageType = damageType;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { target, caster } = context;
    if (!target) return;

    // Pass raw damage - takeDamage handles resistance calculation
    target.takeDamage(this.baseDamage, this.damageType, caster, this.name);
  }

  clone(): IEffect {
    return new DamageEffect(this.baseDamage, this.damageType, this.name);
  }
}

/**
 * Damage that scales with caster's strength stat.
 */
export class StrengthBasedDamageEffect implements IEffect {
  readonly multiplier: number;
  readonly damageType: 'physical' | 'magic' | 'true';
  readonly name: string;

  constructor(multiplier: number, damageType: 'physical' | 'magic' | 'true' = 'physical', name: string = 'Strength Damage') {
    this.multiplier = multiplier;
    this.damageType = damageType;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { target, caster } = context;
    if (!target) return;

    const strength = caster.getStats().attackDamage; // Using AD as "strength"
    const damage = strength * this.multiplier;

    // Pass raw damage - takeDamage handles resistance calculation
    target.takeDamage(damage, this.damageType, caster, this.name);
  }

  clone(): IEffect {
    return new StrengthBasedDamageEffect(this.multiplier, this.damageType, this.name);
  }
}

/**
 * Healing effect.
 */
export class HealEffect implements IEffect {
  readonly amount: number;

  constructor(amount: number) {
    this.amount = amount;
  }

  apply(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.heal(this.amount);
  }

  clone(): IEffect {
    return new HealEffect(this.amount);
  }
}

/**
 * Shield effect - temporary extra health.
 */
export class ShieldEffect implements IEffect {
  readonly amount: number;
  readonly duration: number;

  constructor(amount: number, duration: number) {
    this.amount = amount;
    this.duration = duration;
  }

  apply(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.addShield(this.amount, this.duration);
  }

  clone(): IEffect {
    return new ShieldEffect(this.amount, this.duration);
  }
}

/**
 * Stat modification effect (buff/debuff).
 */
export class StatModificationEffect implements IEffect {
  readonly stat: 'attackDamage' | 'armor' | 'magicResist' | 'attackSpeed' | 'movementSpeed';
  readonly flatBonus: number;
  readonly percentBonus: number;

  constructor(
    stat: 'attackDamage' | 'armor' | 'magicResist' | 'attackSpeed' | 'movementSpeed',
    flatBonus: number = 0,
    percentBonus: number = 0
  ) {
    this.stat = stat;
    this.flatBonus = flatBonus;
    this.percentBonus = percentBonus;
  }

  apply(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.addStatModifier(this.stat, this.flatBonus, this.percentBonus);
  }

  remove(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.removeStatModifier(this.stat, this.flatBonus, this.percentBonus);
  }

  clone(): IEffect {
    return new StatModificationEffect(this.stat, this.flatBonus, this.percentBonus);
  }
}
