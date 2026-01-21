/**
 * Crowd Control effect implementations.
 * Provides standard CC effects: Stun, Slow, Root, Silence.
 *
 * These effects modify champion state to restrict actions.
 */

import { Champion } from '@/champions/Champion';
import { CrowdControlType, EffectDefinition, StackBehavior } from './types';

/**
 * Base interface for applying CC effects to champions.
 */
export interface ICCEffect {
  readonly id: string;
  readonly name: string;
  readonly duration: number;
  readonly ccType: CrowdControlType | 'slow' | 'root';
  readonly category: 'debuff';
  readonly cleansable: boolean;

  /** Apply this effect to a champion */
  apply(target: Champion): void;

  /** Remove this effect from a champion */
  remove(target: Champion): void;
}

/**
 * Configuration for creating CC effects.
 */
export interface CCEffectConfig {
  /** Unique source ID (e.g., "bran_e_stun") */
  source: string;
  /** Duration in seconds */
  duration: number;
  /** Whether effect can be cleansed (default: true) */
  cleansable?: boolean;
}

/**
 * Stun effect - prevents movement, attacking, and casting.
 */
export class StunEffect implements ICCEffect {
  readonly id: string;
  readonly name = 'Stunned';
  readonly duration: number;
  readonly ccType: CrowdControlType = 'stun';
  readonly category = 'debuff' as const;
  readonly cleansable: boolean;

  private appliedTo: WeakMap<Champion, string> = new WeakMap();

  constructor(config: CCEffectConfig) {
    this.id = config.source;
    this.duration = config.duration;
    this.cleansable = config.cleansable ?? true;
  }

  apply(target: Champion): void {
    const effectId = `stun_${this.id}_${Date.now()}`;
    this.appliedTo.set(target, effectId);

    // Apply as an active effect with CC type in definition
    target.applyEffect({
      definition: {
        id: effectId,
        name: this.name,
        category: 'debuff',
        stackBehavior: 'refresh',
        cleansable: this.cleansable,
        persistsThroughDeath: false,
        duration: this.duration,
        ccType: 'stun',
      } as EffectDefinition & { ccType: CrowdControlType },
      timeRemaining: this.duration,
      stacks: 1,
    });
  }

  remove(target: Champion): void {
    const effectId = this.appliedTo.get(target);
    if (effectId) {
      target.removeEffect(effectId);
      this.appliedTo.delete(target);
    }
  }
}

/**
 * Silence effect - prevents ability casting.
 */
export class SilenceEffect implements ICCEffect {
  readonly id: string;
  readonly name = 'Silenced';
  readonly duration: number;
  readonly ccType: CrowdControlType = 'silence';
  readonly category = 'debuff' as const;
  readonly cleansable: boolean;

  private appliedTo: WeakMap<Champion, string> = new WeakMap();

  constructor(config: CCEffectConfig) {
    this.id = config.source;
    this.duration = config.duration;
    this.cleansable = config.cleansable ?? true;
  }

  apply(target: Champion): void {
    const effectId = `silence_${this.id}_${Date.now()}`;
    this.appliedTo.set(target, effectId);

    target.applyEffect({
      definition: {
        id: effectId,
        name: this.name,
        category: 'debuff',
        stackBehavior: 'refresh',
        cleansable: this.cleansable,
        persistsThroughDeath: false,
        duration: this.duration,
        ccType: 'silence',
      } as EffectDefinition & { ccType: CrowdControlType },
      timeRemaining: this.duration,
      stacks: 1,
    });
  }

  remove(target: Champion): void {
    const effectId = this.appliedTo.get(target);
    if (effectId) {
      target.removeEffect(effectId);
      this.appliedTo.delete(target);
    }
  }
}

/**
 * Root/Grounded effect - prevents movement abilities but allows basic movement.
 */
export class RootEffect implements ICCEffect {
  readonly id: string;
  readonly name = 'Rooted';
  readonly duration: number;
  readonly ccType = 'root' as const;
  readonly category = 'debuff' as const;
  readonly cleansable: boolean;

  private appliedTo: WeakMap<Champion, string> = new WeakMap();

  constructor(config: CCEffectConfig) {
    this.id = config.source;
    this.duration = config.duration;
    this.cleansable = config.cleansable ?? true;
  }

  apply(target: Champion): void {
    const effectId = `root_${this.id}_${Date.now()}`;
    this.appliedTo.set(target, effectId);

    target.applyEffect({
      definition: {
        id: effectId,
        name: this.name,
        category: 'debuff',
        stackBehavior: 'refresh',
        cleansable: this.cleansable,
        persistsThroughDeath: false,
        duration: this.duration,
        ccType: 'grounded',
      } as EffectDefinition & { ccType: CrowdControlType },
      timeRemaining: this.duration,
      stacks: 1,
    });

    // Also apply movement speed reduction to 0
    target.applyBuff(
      `root_slow_${effectId}`,
      undefined,
      { movementSpeed: -1 }, // -100% movement speed
      this.duration
    );
  }

  remove(target: Champion): void {
    const effectId = this.appliedTo.get(target);
    if (effectId) {
      target.removeEffect(effectId);
      target.removeBuff(`root_slow_${effectId}`);
      this.appliedTo.delete(target);
    }
  }
}

/**
 * Slow effect - reduces movement speed by a percentage.
 */
export interface SlowEffectConfig extends CCEffectConfig {
  /** Slow percentage (0.3 = 30% slow) */
  slowPercent: number;
}

export class SlowEffect implements ICCEffect {
  readonly id: string;
  readonly name: string;
  readonly duration: number;
  readonly ccType = 'slow' as const;
  readonly category = 'debuff' as const;
  readonly cleansable: boolean;
  readonly slowPercent: number;

  private appliedTo: WeakMap<Champion, string> = new WeakMap();

  constructor(config: SlowEffectConfig) {
    this.id = config.source;
    this.duration = config.duration;
    this.cleansable = config.cleansable ?? true;
    this.slowPercent = config.slowPercent;
    this.name = `Slowed (${Math.round(this.slowPercent * 100)}%)`;
  }

  apply(target: Champion): void {
    const effectId = `slow_${this.id}_${Date.now()}`;
    this.appliedTo.set(target, effectId);

    // Apply movement speed debuff
    target.applyBuff(
      effectId,
      undefined,
      { movementSpeed: -this.slowPercent },
      this.duration
    );
  }

  remove(target: Champion): void {
    const effectId = this.appliedTo.get(target);
    if (effectId) {
      target.removeBuff(effectId);
      this.appliedTo.delete(target);
    }
  }
}

/**
 * Factory functions for creating common CC effects.
 */
export const CC = {
  /**
   * Create a stun effect.
   */
  stun(source: string, duration: number, cleansable = true): StunEffect {
    return new StunEffect({ source, duration, cleansable });
  },

  /**
   * Create a silence effect.
   */
  silence(source: string, duration: number, cleansable = true): SilenceEffect {
    return new SilenceEffect({ source, duration, cleansable });
  },

  /**
   * Create a root effect (cannot move at all).
   */
  root(source: string, duration: number, cleansable = true): RootEffect {
    return new RootEffect({ source, duration, cleansable });
  },

  /**
   * Create a slow effect.
   */
  slow(source: string, duration: number, slowPercent: number, cleansable = true): SlowEffect {
    return new SlowEffect({ source, duration, slowPercent, cleansable });
  },
};

export default CC;
