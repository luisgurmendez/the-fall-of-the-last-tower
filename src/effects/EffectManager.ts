/**
 * Manages effects on champions globally.
 * Provides utility functions for applying and tracking effects.
 */

import type { Champion } from '@/champions/Champion';
import Effect, { createActiveEffect } from './Effect';
import { ActiveEffect, EffectDefinition } from './types';

/**
 * Singleton manager for tracking and applying effects.
 */
class EffectManager {
  private static instance: EffectManager | null = null;

  /** Registry of effect definitions by ID */
  private effectRegistry: Map<string, Effect> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance.
   */
  static getInstance(): EffectManager {
    if (!EffectManager.instance) {
      EffectManager.instance = new EffectManager();
    }
    return EffectManager.instance;
  }

  /**
   * Register an effect definition.
   */
  registerEffect(effect: Effect): void {
    this.effectRegistry.set(effect.id, effect);
  }

  /**
   * Get a registered effect by ID.
   */
  getEffect(id: string): Effect | undefined {
    return this.effectRegistry.get(id);
  }

  /**
   * Apply an effect to a target champion.
   */
  applyEffect(
    effectId: string,
    source: Champion,
    target: Champion
  ): ActiveEffect | null {
    const effect = this.effectRegistry.get(effectId);
    if (!effect) {
      console.warn(`EffectManager: Effect '${effectId}' not found`);
      return null;
    }

    const activeEffect = effect.createInstance(source);
    target.applyEffect(activeEffect);

    // Call onApply hook
    effect.onApply(target, activeEffect);

    return activeEffect;
  }

  /**
   * Apply an effect directly from a definition (without registry).
   */
  applyEffectDirect(
    definition: EffectDefinition,
    source: Champion,
    target: Champion
  ): ActiveEffect {
    const activeEffect = createActiveEffect(definition, source);
    target.applyEffect(activeEffect);
    return activeEffect;
  }

  /**
   * Remove an effect from a target by effect ID.
   */
  removeEffect(effectId: string, target: Champion): void {
    target.removeEffect(effectId);
  }

  /**
   * Cleanse all cleansable debuffs from a target.
   */
  cleanse(target: Champion): void {
    target.cleanse();
  }

  /**
   * Clear all registered effects.
   */
  clearRegistry(): void {
    this.effectRegistry.clear();
  }

  /**
   * Reset the singleton instance.
   */
  static reset(): void {
    if (EffectManager.instance) {
      EffectManager.instance.clearRegistry();
      EffectManager.instance = null;
    }
  }
}

// Convenience export
export const getEffectManager = EffectManager.getInstance;

export default EffectManager;
