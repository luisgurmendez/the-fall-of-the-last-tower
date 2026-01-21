/**
 * Effects that provide immunity or cancel other effects.
 */

import { IEffect, EffectApplicationContext } from './EffectDescriptor';

/**
 * Provides immunity to poison effects.
 */
export class PoisonCancelingEffect implements IEffect {
  apply(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.addImmunity('poison');
  }

  remove(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.removeImmunity('poison');
  }

  clone(): IEffect {
    return new PoisonCancelingEffect();
  }
}

/**
 * Provides immunity to stun effects.
 */
export class StunImmunityEffect implements IEffect {
  apply(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.addImmunity('stun');
  }

  remove(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.removeImmunity('stun');
  }

  clone(): IEffect {
    return new StunImmunityEffect();
  }
}

/**
 * Provides immunity to silence effects.
 */
export class SilenceImmunityEffect implements IEffect {
  apply(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.addImmunity('silence');
  }

  remove(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.removeImmunity('silence');
  }

  clone(): IEffect {
    return new SilenceImmunityEffect();
  }
}

/**
 * Cleanses all crowd control effects.
 */
export class CleanseEffect implements IEffect {
  apply(context: EffectApplicationContext): void {
    const { target } = context;
    if (!target) return;

    target.cleanseCrowdControl();
  }

  clone(): IEffect {
    return new CleanseEffect();
  }
}
