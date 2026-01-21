/**
 * Effect descriptors that wrap effects with timing and targeting information.
 * Used for composing abilities declaratively.
 */

import type { Champion } from '@/champions/Champion';
import type GameContext from '@/core/gameContext';
import type Vector from '@/physics/vector';

/**
 * Who the effect targets.
 */
export enum EffectTargetType {
  /** Affects only the caster */
  self = 'self',
  /** Affects the ability's target enemy */
  enemy = 'enemy',
  /** Affects all enemies in range */
  enemies = 'enemies',
  /** Affects a single ally */
  ally = 'ally',
  /** Affects all allies in range */
  allies = 'allies',
  /** Affects all units in range */
  all = 'all',
  /** Ground-targeted (no unit target, uses position) */
  ground = 'ground',
}

/**
 * Context for applying an effect.
 */
export interface EffectApplicationContext {
  /** The champion casting/owning the ability */
  caster: Champion;
  /** The target of the ability (if applicable) */
  target?: Champion;
  /** All affected targets */
  affectedTargets: Champion[];
  /** Game context */
  gameContext: GameContext;
  /** Current ability rank (1-5) for scaling effects */
  abilityRank?: number;
  /** Target position for ground-targeted/skillshot abilities */
  targetPosition?: Vector;
  /** Direction for skillshots */
  direction?: Vector;
}

/**
 * Base interface for all effect instances.
 */
export interface IEffect {
  /** Apply the effect */
  apply(context: EffectApplicationContext): void;
  /** Update the effect (for ongoing effects) */
  update?(context: EffectApplicationContext, dt: number): void;
  /** Remove the effect */
  remove?(context: EffectApplicationContext): void;
  /** Clone the effect for a new instance */
  clone(): IEffect;
}

/**
 * Base class for effect descriptors.
 * Wraps an effect with timing and target information.
 */
export abstract class EffectDescriptor {
  readonly effect: IEffect;
  readonly targetType: EffectTargetType;

  constructor(effect: IEffect, targetType: EffectTargetType) {
    this.effect = effect;
    this.targetType = targetType;
  }

  /**
   * Resolve targets based on target type.
   */
  resolveTargets(context: EffectApplicationContext): Champion[] {
    const { caster, target, affectedTargets } = context;

    switch (this.targetType) {
      case EffectTargetType.self:
        return [caster];
      case EffectTargetType.enemy:
        return target ? [target] : [];
      case EffectTargetType.enemies:
        return affectedTargets.filter(c => c.getSide() !== caster.getSide());
      case EffectTargetType.ally:
        return target && target.getSide() === caster.getSide() ? [target] : [];
      case EffectTargetType.allies:
        return affectedTargets.filter(c => c.getSide() === caster.getSide());
      case EffectTargetType.all:
        return affectedTargets;
      default:
        return [];
    }
  }

  /**
   * Apply the effect to resolved targets.
   */
  abstract apply(context: EffectApplicationContext): void;
}

/**
 * An effect that applies once immediately when the ability is cast.
 */
export class SemiImmediateEffect extends EffectDescriptor {
  constructor(effect: IEffect, targetType: EffectTargetType) {
    super(effect, targetType);
  }

  apply(context: EffectApplicationContext): void {
    const targets = this.resolveTargets(context);
    for (const target of targets) {
      const clonedEffect = this.effect.clone();
      clonedEffect.apply({
        ...context,
        target,
        affectedTargets: [target],
      });
    }
  }
}

/**
 * An effect that is always active (for passive abilities).
 * Applied when the ability is learned, removed when champion dies/ability is lost.
 */
export class PermanentEffect extends EffectDescriptor {
  private activeEffects: Map<Champion, IEffect> = new Map();

  constructor(effect: IEffect, targetType: EffectTargetType) {
    super(effect, targetType);
  }

  apply(context: EffectApplicationContext): void {
    const targets = this.resolveTargets(context);
    for (const target of targets) {
      if (!this.activeEffects.has(target)) {
        const clonedEffect = this.effect.clone();
        clonedEffect.apply({
          ...context,
          target,
          affectedTargets: [target],
        });
        this.activeEffects.set(target, clonedEffect);
      }
    }
  }

  /**
   * Update all active permanent effects.
   */
  update(context: EffectApplicationContext, dt: number): void {
    for (const [target, effect] of this.activeEffects) {
      if (effect.update) {
        effect.update({
          ...context,
          target,
          affectedTargets: [target],
        }, dt);
      }
    }
  }

  /**
   * Remove the effect from a target.
   */
  remove(context: EffectApplicationContext): void {
    for (const [target, effect] of this.activeEffects) {
      if (effect.remove) {
        effect.remove({
          ...context,
          target,
          affectedTargets: [target],
        });
      }
    }
    this.activeEffects.clear();
  }
}

/**
 * An effect that lasts for a duration.
 */
export class DurationEffect extends EffectDescriptor {
  readonly duration: number;
  private activeEffects: Map<Champion, { effect: IEffect; remaining: number }> = new Map();

  constructor(effect: IEffect, targetType: EffectTargetType, duration: number) {
    super(effect, targetType);
    this.duration = duration;
  }

  apply(context: EffectApplicationContext): void {
    const targets = this.resolveTargets(context);
    for (const target of targets) {
      const clonedEffect = this.effect.clone();
      clonedEffect.apply({
        ...context,
        target,
        affectedTargets: [target],
      });
      this.activeEffects.set(target, { effect: clonedEffect, remaining: this.duration });
    }
  }

  /**
   * Update duration effects, removing expired ones.
   */
  update(context: EffectApplicationContext, dt: number): void {
    for (const [target, data] of this.activeEffects) {
      data.remaining -= dt;

      if (data.effect.update) {
        data.effect.update({
          ...context,
          target,
          affectedTargets: [target],
        }, dt);
      }

      if (data.remaining <= 0) {
        if (data.effect.remove) {
          data.effect.remove({
            ...context,
            target,
            affectedTargets: [target],
          });
        }
        this.activeEffects.delete(target);
      }
    }
  }
}
