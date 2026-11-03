/**
 * ChampionTransform - Timed transforms (e.g., Vile's R).
 *
 * A transform can override the champion's attack range and run an aura
 * that damages nearby enemies on a fixed tick rate: each tick its damage
 * for the rank and the champion's stats then (ability power), on the units
 * its ability affects (not towers or wards). Timing uses the champion's
 * accumulated game time instead of Date.now() for testability.
 */

import {
  calculateAbilityValue,
  canAbilityAffectEntityType,
  getAbilityDefinition,
  type AbilityScaling,
  type DamageType,
} from '@siege/shared';
import type { ServerChampion } from '../ServerChampion';
import type { ServerGameContext } from '../../game/ServerGameContext';

/** Aura definition as given by the ability (damage scales by rank) */
export interface TransformAuraConfig {
  radius: number;
  damage: { type: DamageType; scaling: AbilityScaling };
  tickRate: number;
}

interface ActiveTransformAura {
  abilityId: string;
  radius: number;
  scaling: AbilityScaling;
  rank: number;
  damageType: DamageType;
  tickRate: number;
  lastTickTime: number; // Game time of last tick
  expiry: number; // Game time when aura expires
}

export class ChampionTransform {
  /** Total elapsed game time in seconds */
  private gameTimeElapsed = 0;
  private attackRange: number | null = null;
  private attackRangeExpiry = 0; // Game time when transform expires
  private aura: ActiveTransformAura | null = null;

  constructor(private readonly champion: ServerChampion) {}

  /**
   * Advance the transform clock (called at the start of every champion tick, alive or dead).
   */
  advanceTime(dt: number): void {
    this.gameTimeElapsed += dt;
  }

  /**
   * Set temporary attack range override during transform.
   */
  setAttackRange(range: number, duration: number): void {
    this.attackRange = range;
    this.attackRangeExpiry = this.gameTimeElapsed + duration;
  }

  /**
   * Start transform aura that deals damage to nearby enemies.
   */
  startAura(abilityId: string, aura: TransformAuraConfig, rank: number, duration: number): void {
    this.aura = {
      abilityId,
      radius: aura.radius,
      scaling: aura.damage.scaling,
      rank,
      damageType: aura.damage.type,
      tickRate: aura.tickRate,
      lastTickTime: this.gameTimeElapsed,
      expiry: this.gameTimeElapsed + duration,
    };
  }

  /**
   * Get current attack range (accounting for transform).
   */
  getAttackRange(): number {
    // Check if transform attack range is still active
    if (this.attackRange !== null && this.gameTimeElapsed < this.attackRangeExpiry) {
      return this.attackRange;
    }
    // Clear expired transform
    if (this.attackRange !== null && this.gameTimeElapsed >= this.attackRangeExpiry) {
      this.attackRange = null;
    }
    return this.champion.getStats().attackRange;
  }

  /**
   * Check if the attack range override is active.
   */
  isTransformed(): boolean {
    return this.attackRange !== null && this.gameTimeElapsed < this.attackRangeExpiry;
  }

  /**
   * Update transform aura (called each tick).
   */
  updateAura(context: ServerGameContext): void {
    if (!this.aura) return;

    // Check if aura has expired
    if (this.gameTimeElapsed >= this.aura.expiry) {
      this.aura = null;
      return;
    }

    // Check if it's time for a tick
    const timeSinceLastTick = this.gameTimeElapsed - this.aura.lastTickTime;
    if (timeSinceLastTick < this.aura.tickRate) return;

    this.aura.lastTickTime = this.gameTimeElapsed;

    // Deal damage to nearby enemy units, for its rank and his stats now
    const champion = this.champion;
    const stats = champion.getStats();
    const damage = calculateAbilityValue(this.aura.scaling, this.aura.rank, {
      attackDamage: stats.attackDamage,
      abilityPower: stats.abilityPower,
      bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
      maxHealth: stats.maxHealth,
    });
    const ability = getAbilityDefinition(this.aura.abilityId);
    const entities = context.getEntitiesInRadius(champion.position, this.aura.radius);
    for (const entity of entities) {
      if (entity.side === champion.side) continue;
      if (entity.isDead) continue;
      if (entity.id === champion.id) continue;
      if (!canAbilityAffectEntityType(ability, entity.entityType)) continue;

      entity.takeDamage(damage, this.aura.damageType, champion.id, context);
    }
  }
}
