/**
 * Abstract base class for all effects (buffs, debuffs, status effects).
 */

import type { Champion } from '@/champions/Champion';
import {
  EffectDefinition,
  ActiveEffect,
  EffectCategory,
  StackBehavior,
} from './types';

let effectInstanceCounter = 0;

/**
 * Factory for creating active effect instances.
 */
export function createActiveEffect(
  definition: EffectDefinition,
  source: Champion,
  overrides?: Partial<ActiveEffect>
): ActiveEffect {
  return {
    definition,
    source,
    timeRemaining: definition.duration ?? Infinity,
    stacks: 1,
    instanceId: `effect_${effectInstanceCounter++}`,
    ...overrides,
  };
}

/**
 * Abstract base class for effect definitions.
 * Subclasses implement specific effect types.
 */
abstract class Effect implements EffectDefinition {
  /** Unique identifier */
  abstract readonly id: string;

  /** Display name */
  abstract readonly name: string;

  /** Icon identifier */
  readonly icon?: string;

  /** Buff, debuff, or neutral */
  abstract readonly category: EffectCategory;

  /** Duration in seconds */
  abstract readonly duration?: number;

  /** Stack behavior */
  abstract readonly stackBehavior: StackBehavior;

  /** Max stacks */
  readonly maxStacks?: number;

  /** Whether cleansable */
  readonly cleansable: boolean = true;

  /** Persists through death */
  readonly persistsThroughDeath: boolean = false;

  /**
   * Create an active instance of this effect.
   */
  createInstance(source: Champion): ActiveEffect {
    return createActiveEffect(this, source);
  }

  /**
   * Called when the effect is first applied.
   */
  onApply(target: Champion, effect: ActiveEffect): void {
    // Override in subclasses
  }

  /**
   * Called when the effect is removed (expires or cleansed).
   */
  onRemove(target: Champion, effect: ActiveEffect): void {
    // Override in subclasses
  }

  /**
   * Called each frame while the effect is active.
   */
  onUpdate(target: Champion, effect: ActiveEffect, dt: number): void {
    // Override in subclasses
  }

  /**
   * Called when the effect ticks (for over-time effects).
   */
  onTick(target: Champion, effect: ActiveEffect): void {
    // Override in subclasses
  }

  /**
   * Get a description of the effect.
   */
  getDescription(): string {
    return `${this.name}`;
  }
}

export default Effect;
