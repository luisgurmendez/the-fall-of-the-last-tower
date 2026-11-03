/**
 * ChampionForcedMovement - Dashes and knockbacks.
 *
 * Abilities start one by setting champion.forcedMovement (and, for dashes
 * that should animate, champion.dashAbilityId). While it runs it replaces
 * normal movement: the champion moves a fixed distance over a fixed
 * duration, and a dash with a hitbox damages and applies effects to each
 * enemy it touches once: only what its ability affects (units; never
 * towers or wards unless the ability says so).
 */

import { canAbilityAffectEntityType, getAbilityDefinition, isUnitEntityType, type Vector, type DamageType } from '@siege/shared';
import type { ServerChampion } from '../ServerChampion';
import type { ServerEntity } from '../ServerEntity';
import type { ServerGameContext } from '../../game/ServerGameContext';

export interface ForcedMovement {
  direction: Vector;
  distance: number;
  duration: number;
  elapsed: number;
  type: 'dash' | 'knockback';
  // Dash collision data (for abilities that damage/apply effects during dash)
  hitbox?: number;           // Collision radius
  damage?: number;           // Damage to apply on hit
  damageType?: DamageType;   // Type of damage
  appliesEffects?: string[]; // Effect IDs to apply
  effectDuration?: number;   // Duration of applied effects
  hitEntities?: Set<string>; // Track already-hit entities
  /**
   * Units it runs into on the way, each touched once (e.g., the champions
   * Hop-To-Eat's kick sends a champion flying into): the callback decides
   * which ones matter.
   */
  touches?: { radius: number; touched: Set<string>; touch: (entity: ServerEntity) => void };
  /**
   * It goes under walls (e.g., Zhak'rul burrowed): walls don't push the
   * champion out until it ends, so it should end on open ground
   * (Terrain.landingSpot).
   */
  passesWalls?: boolean;
}

/**
 * Update forced movement (dash/knockback).
 */
export function updateForcedMovement(champion: ServerChampion, dt: number, context: ServerGameContext): void {
  if (!champion.forcedMovement) return;

  const fm = champion.forcedMovement;
  fm.elapsed += dt;

  const progress = Math.min(fm.elapsed / fm.duration, 1);
  const moveDistance = fm.distance * (progress - (fm.elapsed - dt) / fm.duration);

  const movement = fm.direction.clone().scalar(moveDistance);
  champion.position.add(movement);

  // Check for collisions during dash (not knockback)
  if (fm.type === 'dash' && fm.hitbox && fm.hitbox > 0) {
    checkDashCollisions(champion, context, fm);
  }
  if (fm.touches) {
    for (const entity of context.getEntitiesInRadius(champion.position, fm.touches.radius)) {
      if (entity.id === champion.id || entity.isDead || fm.touches.touched.has(entity.id)) continue;
      fm.touches.touched.add(entity.id);
      fm.touches.touch(entity);
    }
  }

  if (fm.elapsed >= fm.duration) {
    champion.forcedMovement = null;
    champion.dashAbilityId = null;
  }
}

/**
 * Distance the forced movement still has to cover.
 */
export function remainingForcedMovementDistance(fm: ForcedMovement): number {
  return fm.distance - fm.elapsed * (fm.distance / fm.duration);
}

/**
 * Check for collisions during dash and apply damage/effects.
 */
function checkDashCollisions(champion: ServerChampion, context: ServerGameContext, fm: ForcedMovement): void {
  if (!fm.hitEntities) {
    fm.hitEntities = new Set();
  }

  const entities = context.getEntitiesInRadius(champion.position, fm.hitbox!);
  const ability = champion.dashAbilityId ? getAbilityDefinition(champion.dashAbilityId) : undefined;

  for (const entity of entities) {
    if (entity.side === champion.side) continue;
    if (entity.isDead) continue;
    if (entity.id === champion.id) continue;
    if (fm.hitEntities.has(entity.id)) continue; // Already hit
    if (ability ? !canAbilityAffectEntityType(ability, entity.entityType) : !isUnitEntityType(entity.entityType)) continue;

    // Mark as hit
    fm.hitEntities.add(entity.id);

    // Apply damage
    if (fm.damage && fm.damage > 0 && fm.damageType) {
      entity.takeDamage(fm.damage, fm.damageType, champion.id, context);
    }

    // Apply effects
    if (fm.appliesEffects && fm.effectDuration && 'applyEffect' in entity) {
      const applyEffect = (entity as { applyEffect: (id: string, duration: number, sourceId?: string) => void }).applyEffect;
      for (const effectId of fm.appliesEffects) {
        applyEffect.call(entity, effectId, fm.effectDuration, champion.id);
      }
    }
  }
}
