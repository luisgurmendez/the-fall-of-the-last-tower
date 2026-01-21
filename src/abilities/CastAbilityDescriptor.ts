/**
 * Cast ability descriptor - an active ability that can be cast.
 */

import type { Champion } from '@/champions/Champion';
import type GameContext from '@/core/gameContext';
import type Vector from '@/physics/vector';
import AbilityCost from './AbilityCost';
import { EffectDescriptor, EffectApplicationContext, DurationEffect } from '@/effects/EffectDescriptor';
import { IAbilityTargetDescription, NoTargetAbilityTargetDescription } from './AbilityTargetDescription';

/**
 * Configuration for a cast ability.
 */
export interface CastAbilityConfig {
  /** Name of the ability */
  name?: string;
  /** Description of the ability */
  description?: string;
  /** Cost to cast */
  cost: AbilityCost;
  /** Effects applied when cast */
  effects: EffectDescriptor[];
  /** Target selection rules */
  target?: IAbilityTargetDescription;
  /** Cast time in seconds (0 = instant) */
  castTime?: number;
  /** Cooldown in seconds */
  cooldown?: number;
  /** Maximum rank (default 5) */
  maxRank?: number;
  /** Cooldown at each rank (overrides cooldown if provided) */
  cooldownPerRank?: number[];
  /** Cost at each rank (energy cost, overrides cost.energy if provided) */
  costPerRank?: number[];
}

/**
 * Result of a cast attempt.
 */
export interface CastResult {
  success: boolean;
  reason?: 'on_cooldown' | 'not_enough_resource' | 'invalid_target' | 'out_of_range' | 'silenced' | 'stunned';
}

/**
 * An active ability that can be cast by a champion.
 */
export class CastAbilityDescriptor {
  readonly name: string;
  readonly description: string;
  readonly cost: AbilityCost;
  readonly effects: EffectDescriptor[];
  readonly target: IAbilityTargetDescription;
  readonly castTime: number;
  readonly baseCooldown: number;
  readonly maxRank: number;
  readonly cooldownPerRank: number[] | null;
  readonly costPerRank: number[] | null;

  private owner: Champion | null = null;
  private cooldownRemaining: number = 0;
  private isCasting: boolean = false;
  private castTimeRemaining: number = 0;
  private pendingCastContext: {
    target?: Champion;
    position?: Vector;
    gameContext: GameContext;
  } | null = null;

  // Ability rank (1-5, 0 = not learned)
  private _rank: number = 0;

  // For tracking duration effects
  private activeDurationEffects: DurationEffect[] = [];

  constructor(config: CastAbilityConfig) {
    this.name = config.name ?? 'Ability';
    this.description = config.description ?? '';
    this.cost = config.cost;
    this.effects = config.effects;
    this.target = config.target ?? new NoTargetAbilityTargetDescription();
    this.castTime = config.castTime ?? 0;
    this.baseCooldown = config.cooldown ?? config.cost.cooldown ?? 0;
    this.maxRank = config.maxRank ?? 5;
    this.cooldownPerRank = config.cooldownPerRank ?? null;
    this.costPerRank = config.costPerRank ?? null;
  }

  /**
   * Get current ability rank.
   */
  get rank(): number {
    return this._rank;
  }

  /**
   * Check if ability is learned.
   */
  isLearned(): boolean {
    return this._rank > 0;
  }

  /**
   * Check if ability can be ranked up.
   */
  canRankUp(): boolean {
    return this._rank < this.maxRank;
  }

  /**
   * Rank up the ability.
   */
  rankUp(): boolean {
    if (!this.canRankUp()) return false;
    this._rank++;
    return true;
  }

  /**
   * Get the current cooldown based on rank.
   */
  get cooldown(): number {
    if (this.cooldownPerRank && this._rank > 0) {
      const idx = Math.min(this._rank - 1, this.cooldownPerRank.length - 1);
      return this.cooldownPerRank[idx];
    }
    return this.baseCooldown;
  }

  /**
   * Get the current energy cost based on rank.
   */
  getCurrentCost(): number {
    if (this.costPerRank && this._rank > 0) {
      const idx = Math.min(this._rank - 1, this.costPerRank.length - 1);
      return this.costPerRank[idx];
    }
    return this.cost.energy;
  }

  /**
   * Set the owner champion.
   */
  setOwner(owner: Champion): void {
    this.owner = owner;
  }

  /**
   * Check if the ability is ready to cast.
   */
  isReady(): boolean {
    return this.cooldownRemaining <= 0 && !this.isCasting;
  }

  /**
   * Get cooldown remaining.
   */
  getCooldownRemaining(): number {
    return this.cooldownRemaining;
  }

  /**
   * Get cooldown progress (0 = just started, 1 = ready).
   */
  getCooldownProgress(): number {
    if (this.cooldown <= 0) return 1;
    return 1 - this.cooldownRemaining / this.cooldown;
  }

  /**
   * Check if the ability can be cast.
   */
  canCast(targetChampion?: Champion, targetPosition?: Vector): CastResult {
    if (!this.owner) {
      return { success: false, reason: 'invalid_target' };
    }

    // Check if ability is learned
    if (!this.isLearned()) {
      return { success: false, reason: 'invalid_target' };
    }

    // Check cooldown
    if (!this.isReady()) {
      return { success: false, reason: 'on_cooldown' };
    }

    // Check cost (use rank-based cost if available)
    const energyCost = this.getCurrentCost();
    if (energyCost > 0 && this.owner.getCurrentResource() < energyCost) {
      return { success: false, reason: 'not_enough_resource' };
    }

    // Check crowd control
    const ccStatus = this.owner.getCrowdControlStatus();
    if (!ccStatus.canCast) {
      return { success: false, reason: 'silenced' };
    }
    if (!ccStatus.canMove && !ccStatus.canAttack) {
      return { success: false, reason: 'stunned' };
    }

    // Check target validity
    if (!this.target.isValidTarget(this.owner, targetChampion ?? null, targetPosition ?? null)) {
      return { success: false, reason: 'invalid_target' };
    }

    return { success: true };
  }

  /**
   * Cast the ability.
   */
  cast(gameContext: GameContext, targetChampion?: Champion, targetPosition?: Vector): CastResult {
    const canCastResult = this.canCast(targetChampion, targetPosition);
    if (!canCastResult.success) {
      return canCastResult;
    }

    if (!this.owner) {
      return { success: false, reason: 'invalid_target' };
    }

    // Pay the cost (use rank-based cost)
    const energyCost = this.getCurrentCost();
    if (energyCost > 0) {
      this.owner.consumeResource(energyCost);
    }
    // Pay health cost if any (not rank-based for now)
    const healthCost = this.cost.getHealthCost(this.owner);
    if (healthCost > 0) {
      this.owner.takeDamage(healthCost, 'true', this.owner);
    }

    // Start cooldown (rank-based)
    this.cooldownRemaining = this.cooldown;

    // Handle cast time
    if (this.castTime > 0) {
      this.isCasting = true;
      this.castTimeRemaining = this.castTime;
      this.pendingCastContext = {
        target: targetChampion,
        position: targetPosition,
        gameContext,
      };
    } else {
      // Instant cast
      this.execute(gameContext, targetChampion, targetPosition);
    }

    return { success: true };
  }

  /**
   * Execute the ability effects.
   */
  private execute(gameContext: GameContext, targetChampion?: Champion, targetPosition?: Vector): void {
    if (!this.owner) return;

    // If we have a target champion but no explicit position, use the target's position.
    // This ensures effects like ToTargetMoveEffect can access the target location
    // even when EffectTargetType.self overwrites the target field.
    const effectiveTargetPosition = targetPosition ?? targetChampion?.getPosition();

    // Calculate direction for skillshots
    let direction: Vector | undefined;
    if (effectiveTargetPosition) {
      direction = effectiveTargetPosition.clone().sub(this.owner.getPosition()).normalize();
    } else {
      direction = this.owner.getDirection();
    }

    const context: EffectApplicationContext = {
      caster: this.owner,
      target: targetChampion,
      affectedTargets: targetChampion ? [targetChampion] : [],
      gameContext,
      abilityRank: this._rank,  // Pass rank for scaling effects
      targetPosition: effectiveTargetPosition,
      direction,
    };

    for (const effect of this.effects) {
      effect.apply(context);

      // Track duration effects for updates
      if (effect instanceof DurationEffect) {
        this.activeDurationEffects.push(effect);
      }
    }
  }

  /**
   * Update the ability state.
   */
  update(gameContext: GameContext, dt: number): void {
    // Update cooldown
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    }

    // Update cast time
    if (this.isCasting) {
      this.castTimeRemaining -= dt;
      if (this.castTimeRemaining <= 0) {
        this.isCasting = false;
        if (this.pendingCastContext) {
          this.execute(
            this.pendingCastContext.gameContext,
            this.pendingCastContext.target,
            this.pendingCastContext.position
          );
          this.pendingCastContext = null;
        }
      }
    }

    // Update active duration effects
    if (this.owner) {
      const context: EffectApplicationContext = {
        caster: this.owner,
        affectedTargets: [],
        gameContext,
        abilityRank: this._rank,  // Pass rank so remove() calculates the correct value
      };

      for (const effect of this.activeDurationEffects) {
        effect.update(context, dt);
      }

      // Clean up expired effects
      this.activeDurationEffects = this.activeDurationEffects.filter(e => {
        // Duration effects handle their own cleanup
        return true;
      });
    }
  }

  /**
   * Reset the ability state (e.g., on death).
   */
  reset(): void {
    this.cooldownRemaining = 0;
    this.isCasting = false;
    this.castTimeRemaining = 0;
    this.pendingCastContext = null;
    this.activeDurationEffects = [];
  }
}

export default CastAbilityDescriptor;
