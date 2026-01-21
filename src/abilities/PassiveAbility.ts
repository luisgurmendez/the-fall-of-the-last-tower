/**
 * Base class for passive abilities.
 *
 * Passive abilities trigger automatically based on conditions,
 * rather than being manually cast by the player.
 */

import type { Champion } from '@/champions/Champion';
import type GameContext from '@/core/gameContext';
import Ability from './Ability';
import {
  AbilityDefinition,
  AbilityCastContext,
  AbilityCastResult,
  AbilitySlot,
  PassiveTrigger,
} from './types';

/**
 * Abstract base class for passive abilities.
 */
abstract class PassiveAbility extends Ability {
  /** What triggers this passive */
  readonly trigger: PassiveTrigger;

  /** Internal cooldown between triggers (seconds) */
  readonly internalCooldown: number;

  constructor(
    definition: AbilityDefinition,
    slot: AbilitySlot,
    trigger: PassiveTrigger,
    internalCooldown: number = 0
  ) {
    super(definition, slot);
    this.trigger = trigger;
    this.internalCooldown = internalCooldown;
  }

  /**
   * Check if the passive can trigger (not on internal cooldown).
   */
  canTrigger(): boolean {
    return this.isLearned && this.state.passiveCooldownRemaining <= 0;
  }

  /**
   * Attempt to trigger the passive.
   * Called by the champion when the trigger condition is met.
   */
  tryTrigger(context: AbilityCastContext): boolean {
    if (!this.canTrigger()) {
      return false;
    }

    // Start internal cooldown
    if (this.internalCooldown > 0) {
      this.state.passiveCooldownRemaining = this.internalCooldown;
    }

    // Execute the passive effect
    this.execute(context);
    return true;
  }

  /**
   * Passives cannot be manually cast.
   */
  override canCast(_context: AbilityCastContext): AbilityCastResult {
    return {
      success: false,
      failReason: 'invalid_target',
    };
  }

  /**
   * Passives cannot be manually cast.
   */
  override cast(_context: AbilityCastContext): AbilityCastResult {
    return {
      success: false,
      failReason: 'invalid_target',
    };
  }

  /**
   * Called each frame - passives may have continuous effects.
   */
  protected override onUpdate(gctx: GameContext): void {
    // For 'always' triggers, apply effect every frame
    if (this.trigger === 'always' && this.isLearned && this.owner) {
      this.applyAlwaysEffect(gctx);
    }

    // For 'on_interval' triggers, check interval
    if (this.trigger === 'on_interval' && this.isLearned && this.canTrigger()) {
      this.tryTrigger({
        caster: this.owner!,
        rank: this.rank,
        dt: gctx.dt,
      });
    }
  }

  /**
   * Override in subclasses for 'always' trigger type.
   * Called every frame while the passive is learned.
   */
  protected applyAlwaysEffect(gctx: GameContext): void {
    // Default: do nothing
  }

  /**
   * Abstract: implement the passive's effect.
   */
  protected abstract execute(context: AbilityCastContext): void;
}

export default PassiveAbility;
