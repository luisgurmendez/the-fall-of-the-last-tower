/**
 * Passive ability - always active effects that don't require casting.
 */

import type { Champion } from '@/champions/Champion';
import type GameContext from '@/core/gameContext';
import { EffectDescriptor, EffectApplicationContext, PermanentEffect } from '@/effects/EffectDescriptor';

/**
 * Configuration for a passive ability.
 */
export interface PassiveAbilityConfig {
  /** Name of the passive */
  name?: string;
  /** Description of the passive */
  description?: string;
}

/**
 * A passive ability that applies permanent effects.
 */
class PassiveAbility {
  readonly effects: EffectDescriptor[];
  readonly name: string;
  readonly description: string;

  private owner: Champion | null = null;
  private isActive = false;

  constructor(effects: EffectDescriptor[], config: PassiveAbilityConfig = {}) {
    this.effects = effects;
    this.name = config.name ?? 'Passive';
    this.description = config.description ?? '';
  }

  /**
   * Set the owner champion.
   */
  setOwner(owner: Champion): void {
    this.owner = owner;
  }

  /**
   * Activate the passive (when champion spawns/ability is learned).
   */
  activate(gameContext: GameContext): void {
    if (this.isActive || !this.owner) return;

    const context: EffectApplicationContext = {
      caster: this.owner,
      affectedTargets: [this.owner],
      gameContext,
    };

    for (const effect of this.effects) {
      effect.apply(context);
    }

    this.isActive = true;
  }

  /**
   * Deactivate the passive (when champion dies).
   */
  deactivate(gameContext: GameContext): void {
    if (!this.isActive || !this.owner) return;

    const context: EffectApplicationContext = {
      caster: this.owner,
      affectedTargets: [this.owner],
      gameContext,
    };

    for (const effect of this.effects) {
      if (effect instanceof PermanentEffect) {
        effect.remove(context);
      }
    }

    this.isActive = false;
  }

  /**
   * Update the passive each frame.
   */
  update(gameContext: GameContext, dt: number): void {
    if (!this.isActive || !this.owner) return;

    const context: EffectApplicationContext = {
      caster: this.owner,
      affectedTargets: [this.owner],
      gameContext,
    };

    for (const effect of this.effects) {
      if (effect instanceof PermanentEffect) {
        effect.update(context, dt);
      }
    }
  }
}

export default PassiveAbility;
