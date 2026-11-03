/**
 * ChampionForcedMovement - Dashes and knockbacks.
 *
 * Abilities start one by setting champion.forcedMovement (and, for dashes
 * that should animate, champion.dashAbilityId). While it runs it replaces
 * normal movement: the champion moves a fixed distance over a fixed
 * duration, and a dash with a hitbox damages and applies effects to each
 * enemy it touches once: only what its ability affects (units; never
 * towers or wards unless the ability says so).
 *
 * A dash or knockback stops at a wall (it never comes out on the far side),
 * unless it passes walls (Zhak'rul's burrow, a targeted leap). A leap that
 * follows its target (`follow`) flies at it wherever it goes and lands
 * next to it.
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
  /**
   * A leap at a unit (Movement.leapToTarget): it flies at the target
   * wherever it moves, at `speed`, and calls `land` when within `reach` of
   * it. It gives up, landing nothing, if the target dies or it has flown
   * `maxDistance` without getting there.
   */
  follow?: {
    targetId: string;
    reach: number;
    speed: number;
    maxDistance: number;
    flown: number;
    /** How far from reaching the target it still is */
    gap: number;
    land: () => void;
  };
}

/** Closer than this to its reach, a leap has arrived */
const LEAP_ARRIVED = 1;
/** A dash checks for walls every this many units of its way */
const WALL_STEP = 4;

/**
 * Update forced movement (dash/knockback).
 */
export function updateForcedMovement(champion: ServerChampion, dt: number, context: ServerGameContext): void {
  if (!champion.forcedMovement) return;

  const fm = champion.forcedMovement;
  if (fm.follow) {
    updateLeap(champion, fm, dt, context);
    return;
  }
  fm.elapsed += dt;

  const progress = Math.min(fm.elapsed / fm.duration, 1);
  const moveDistance = fm.distance * (progress - (fm.elapsed - dt) / fm.duration);

  const movement = fm.direction.clone().scalar(moveDistance);
  if (fm.passesWalls) {
    champion.position.add(movement);
  } else if (!advanceUntilWall(champion.position, movement, context)) {
    // Against a wall: it ends here
    fm.elapsed = fm.duration;
  }

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
 * A leap's tick: fly at the target; land next to it, or give up.
 */
function updateLeap(champion: ServerChampion, fm: ForcedMovement, dt: number, context: ServerGameContext): void {
  const follow = fm.follow!;
  const end = () => {
    champion.forcedMovement = null;
    champion.dashAbilityId = null;
  };
  const target = context.getEntity(follow.targetId);
  if (!target || target.isDead) return end();

  const gapTo = () => target.position.distanceTo(champion.position) - follow.reach;
  if (gapTo() > LEAP_ARRIVED) {
    const offset = target.position.subtracted(champion.position);
    const direction = offset.normalized();
    const step = Math.min(gapTo(), follow.speed * dt);
    if (follow.flown + step > follow.maxDistance + 1e-6) return end();
    champion.position.add(direction.scaled(step));
    follow.flown += step;
    fm.direction = direction;
    champion.direction = direction.clone();
  }
  follow.gap = Math.max(0, gapTo());
  if (follow.gap <= LEAP_ARRIVED) {
    end();
    follow.land();
  }
}

/**
 * Move a position by `movement`, stopping where it would go into a wall
 * (from open ground; a unit already in one may move out of it).
 * @returns false if a wall stopped it
 */
function advanceUntilWall(position: Vector, movement: Vector, context: ServerGameContext): boolean {
  const terrain = context.terrain;
  if (!terrain) {
    position.add(movement);
    return true;
  }
  const steps = Math.max(1, Math.ceil(movement.length() / WALL_STEP));
  let clearance = terrain.clearanceAt(position.x, position.y);
  for (let i = 0; i < steps; i++) {
    const x = position.x + movement.x / steps;
    const y = position.y + movement.y / steps;
    const next = terrain.clearanceAt(x, y);
    if (next < 0 && next < clearance) return false;
    position.x = x;
    position.y = y;
    clearance = next;
  }
  return true;
}

/**
 * Distance the forced movement still has to cover.
 */
export function remainingForcedMovementDistance(fm: ForcedMovement): number {
  if (fm.follow) return fm.follow.gap;
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
