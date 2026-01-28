/**
 * BaseAbilityHandler - Base class for ability handlers.
 *
 * Provides common utilities for:
 * - Damage calculation with scaling
 * - Heal calculation with scaling
 * - Effect application
 * - Entity targeting
 * - Stats access
 */

import {
  Vector,
  calculateAbilityValue,
  canAbilityAffectEntityType,
  DamageType,
  type AbilityDefinition,
} from '@siege/shared';
import type {
  IAbilityHandler,
  AbilityHandlerParams,
  AbilityValidationResult,
  AbilityExecutionResult,
} from './IAbilityHandler';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

/**
 * Scaling context for ability calculations.
 */
interface ScalingContext {
  attackDamage: number;
  abilityPower: number;
  bonusHealth: number;
  maxHealth: number;
}

/**
 * Base class for ability handlers.
 *
 * Extend this class and implement execute() to create an ability handler.
 * Use the provided utility methods for common operations.
 */
export abstract class BaseAbilityHandler implements IAbilityHandler {
  abstract readonly abilityId: string;

  abstract execute(params: AbilityHandlerParams): AbilityExecutionResult;

  // =============================================================================
  // Validation (override if needed)
  // =============================================================================

  validate?(params: AbilityHandlerParams): AbilityValidationResult;

  // =============================================================================
  // Utility: Stats & Scaling
  // =============================================================================

  /**
   * Get the scaling context for ability calculations.
   */
  protected getScalingContext(champion: ServerChampion): ScalingContext {
    const stats = champion.getStats();
    return {
      attackDamage: stats.attackDamage,
      abilityPower: stats.abilityPower,
      bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
      maxHealth: stats.maxHealth,
    };
  }

  /**
   * Calculate damage for an ability.
   */
  protected calculateDamage(
    definition: AbilityDefinition,
    rank: number,
    champion: ServerChampion,
    damageMultiplier: number = 1.0
  ): number {
    if (!definition.damage) return 0;

    const ctx = this.getScalingContext(champion);
    return calculateAbilityValue(definition.damage.scaling, rank, ctx) * damageMultiplier;
  }

  /**
   * Calculate heal for an ability.
   */
  protected calculateHeal(
    definition: AbilityDefinition,
    rank: number,
    champion: ServerChampion
  ): number {
    if (!definition.heal) return 0;

    const ctx = this.getScalingContext(champion);
    return calculateAbilityValue(definition.heal.scaling, rank, ctx);
  }

  /**
   * Calculate shield amount for an ability.
   */
  protected calculateShield(
    definition: AbilityDefinition,
    rank: number,
    champion: ServerChampion
  ): number {
    if (!definition.shield) return 0;

    const ctx = this.getScalingContext(champion);
    return calculateAbilityValue(definition.shield.scaling, rank, ctx);
  }

  // =============================================================================
  // Utility: Targeting
  // =============================================================================

  /**
   * Get enemies in radius that can be affected by the ability.
   */
  protected getAffectedEnemies(
    position: Vector,
    radius: number,
    champion: ServerChampion,
    definition: AbilityDefinition,
    context: ServerGameContext
  ): ServerEntity[] {
    const entities = context.getEntitiesInRadius(position, radius);
    return entities.filter(entity => {
      if (entity.side === champion.side) return false;
      if (entity.isDead) return false;
      if (!canAbilityAffectEntityType(definition, entity.entityType)) return false;
      return true;
    });
  }

  /**
   * Get allies in radius (including self if includeSelf is true).
   */
  protected getAlliesInRadius(
    position: Vector,
    radius: number,
    champion: ServerChampion,
    context: ServerGameContext,
    includeSelf: boolean = true
  ): ServerEntity[] {
    const entities = context.getEntitiesInRadius(position, radius);
    return entities.filter(entity => {
      if (entity.side !== champion.side) return false;
      if (entity.isDead) return false;
      if (!includeSelf && entity.id === champion.id) return false;
      return true;
    });
  }

  /**
   * Get all champions in radius.
   */
  protected getChampionsInRadius(
    position: Vector,
    radius: number,
    context: ServerGameContext
  ): ServerChampion[] {
    const entities = context.getEntitiesInRadius(position, radius);
    return entities.filter(entity =>
      !entity.isDead && 'abilityStates' in entity
    ) as ServerChampion[];
  }

  // =============================================================================
  // Utility: Effects
  // =============================================================================

  /**
   * Apply effects to an entity.
   */
  protected applyEffects(
    entity: ServerEntity,
    effectIds: string[] | undefined,
    duration: number,
    sourceId: string
  ): void {
    if (!effectIds || effectIds.length === 0) return;
    if (!('applyEffect' in entity)) return;

    const applyEffect = (entity as any).applyEffect.bind(entity);
    for (const effectId of effectIds) {
      applyEffect(effectId, duration, sourceId);
    }
  }

  /**
   * Apply debuff effects to enemies (filters out buff effects).
   */
  protected applyDebuffsToEnemy(
    entity: ServerEntity,
    effectIds: string[] | undefined,
    duration: number,
    sourceId: string
  ): void {
    if (!effectIds || effectIds.length === 0) return;

    // Filter out self-buff effects
    const debuffEffects = effectIds.filter(id =>
      !id.includes('_empowered') &&
      !id.includes('_buff') &&
      !id.includes('speed_')
    );

    this.applyEffects(entity, debuffEffects, duration, sourceId);
  }

  /**
   * Apply buff effects to self/allies (filters out debuff effects).
   */
  protected applyBuffsToAlly(
    entity: ServerEntity,
    effectIds: string[] | undefined,
    duration: number,
    sourceId: string
  ): void {
    if (!effectIds || effectIds.length === 0) return;

    // Filter for buff effects only
    const buffEffects = effectIds.filter(id =>
      id.includes('_empowered') ||
      id.includes('_buff') ||
      id.includes('speed_')
    );

    this.applyEffects(entity, buffEffects, duration, sourceId);
  }

  // =============================================================================
  // Utility: Damage & Healing
  // =============================================================================

  /**
   * Deal damage to an entity.
   */
  protected dealDamage(
    entity: ServerEntity,
    amount: number,
    type: DamageType,
    sourceId: string,
    context: ServerGameContext
  ): number {
    if (entity.isDead || amount <= 0) return 0;
    return entity.takeDamage(amount, type, sourceId, context);
  }

  /**
   * Heal an entity.
   */
  protected healEntity(entity: ServerEntity, amount: number): void {
    if (entity.isDead || amount <= 0) return;
    if ('heal' in entity && typeof entity.heal === 'function') {
      (entity as { heal: (amount: number) => void }).heal(amount);
    }
  }

  /**
   * Apply shield to a champion.
   */
  protected applyShield(
    champion: ServerChampion,
    amount: number,
    duration: number,
    sourceId: string,
    shieldType: 'normal' | 'magic' | 'physical' = 'normal'
  ): void {
    if (amount <= 0) return;
    champion.shields.push({
      amount,
      remainingDuration: duration,
      sourceId,
      shieldType,
    });
  }

  // =============================================================================
  // Utility: Direction & Position
  // =============================================================================

  /**
   * Update champion facing direction toward a position.
   */
  protected faceToward(champion: ServerChampion, targetPosition: Vector): void {
    const dir = targetPosition.subtracted(champion.position);
    if (dir.length() > 0.1) {
      champion.direction = dir.normalized();
    }
  }

  /**
   * Get direction from champion to target position.
   */
  protected getDirection(champion: ServerChampion, targetPosition: Vector): Vector {
    const dir = targetPosition.subtracted(champion.position);
    if (dir.length() < 0.1) {
      return champion.direction.clone();
    }
    return dir.normalized();
  }

  /**
   * Get distance from champion to position.
   */
  protected getDistance(champion: ServerChampion, position: Vector): number {
    return champion.position.distanceTo(position);
  }

  // =============================================================================
  // Utility: Cone Abilities
  // =============================================================================

  /**
   * Check if a position is within a cone.
   * @param origin Cone origin point
   * @param direction Cone direction (normalized)
   * @param coneAngle Full cone angle in radians
   * @param maxRange Maximum cone range
   * @param targetPosition Position to check
   */
  protected isInCone(
    origin: Vector,
    direction: Vector,
    coneAngle: number,
    maxRange: number,
    targetPosition: Vector
  ): boolean {
    const toTarget = targetPosition.subtracted(origin);
    const distance = toTarget.length();

    if (distance > maxRange) return false;

    const dirAngle = Math.atan2(direction.y, direction.x);
    const targetAngle = Math.atan2(toTarget.y, toTarget.x);
    const angleDiff = Math.abs(this.normalizeAngle(targetAngle - dirAngle));

    return angleDiff <= coneAngle / 2;
  }

  /**
   * Normalize angle to -PI to PI range.
   */
  protected normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
}
