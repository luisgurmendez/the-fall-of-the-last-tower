/**
 * What an ability's preview shows, in world space, from its definition: the
 * shapes it will hit as the server sees them (rangePreview draws them while
 * an ability box is hovered).
 * - `range`: its cast range around the caster (not for cones, nor areas
 *   around the caster)
 * - `area`: a circle around the caster (a no_target or self area), at the
 *   cursor brought within range (a ground circle), or at Lume's orb
 * - `band`: a projectile's path (twice its radius wide), a line area (twice
 *   its aoeRadius), a dash with a hitbox (to the cursor, up to its
 *   distance), Lume's beam from her orb
 * - `cone`: a cone toward the cursor
 * - `landing`: where a dash with no hitbox lands (the cursor, up to its distance)
 *
 * A charging ability (Vile's arrows) reaches as far as its charge so far.
 */

import Vector from '@/physics/vector';
import type { AbilityDefinition } from '@siege/shared';

export type PreviewShape =
  | { kind: 'range'; center: Vector; radius: number }
  | { kind: 'area'; center: Vector; radius: number }
  | { kind: 'band'; from: Vector; direction: Vector; length: number; width: number; dash: boolean }
  | { kind: 'cone'; center: Vector; direction: Vector; radius: number; angle: number }
  | { kind: 'landing'; from: Vector; at: Vector };

/** Lume's abilities that go off at her Light Orb, not at her */
const FROM_ORB = new Set(['lume_w', 'lume_e', 'lume_r']);

type PreviewDefinition = Pick<AbilityDefinition,
  'id' | 'targetType' | 'shape' | 'range' | 'aoeRadius' | 'coneAngle' | 'projectileRadius' | 'dash' | 'charge'>;

/**
 * The shapes to preview for an ability cast from `from` toward `cursor`.
 * @param orb Lume's Light Orb, for her abilities that start there (none without it)
 * @param charge How charged it is (0 to 1, as the server counts it), while charging
 */
export function abilityPreview(
  definition: PreviewDefinition,
  from: Vector,
  cursor: Vector,
  orb: Vector | null = null,
  charge?: number,
): PreviewShape[] {
  const shapes: PreviewShape[] = [];
  const range = (definition.range ?? 0) + (charge !== undefined ? (definition.charge?.maxChargeRangeBonus ?? 0) * charge : 0);
  const aoe = definition.aoeRadius ?? 0;
  const toward = (origin: Vector) => {
    const offset = cursor.clone().sub(origin);
    return offset.length() > 0.001 ? offset.normalize() : new Vector(1, 0);
  };
  const within = (limit: number) => {
    const offset = cursor.clone().sub(from);
    const distance = offset.length();
    return distance > limit ? from.clone().add(offset.scalar(limit / distance)) : cursor.clone();
  };
  const aroundCaster = definition.targetType === 'no_target' || definition.targetType === 'self';

  if (range > 0 && definition.shape !== 'cone') shapes.push({ kind: 'range', center: from.clone(), radius: range });

  if (FROM_ORB.has(definition.id)) {
    if (!orb) return shapes;
    if (definition.shape === 'line') {
      shapes.push({ kind: 'band', from: orb.clone(), direction: toward(orb), length: range, width: aoe * 2, dash: false });
    } else if (aoe > 0) {
      shapes.push({ kind: 'area', center: orb.clone(), radius: aoe });
    }
    return shapes;
  }

  if (definition.shape === 'cone') {
    shapes.push({ kind: 'cone', center: from.clone(), direction: toward(from), radius: aoe || range, angle: definition.coneAngle ?? 0 });
  } else if (definition.dash && definition.targetType !== 'target_enemy') {
    const at = within(definition.dash.distance);
    if (aoe > 0) {
      shapes.push({ kind: 'band', from: from.clone(), direction: toward(from), length: at.distanceTo(from), width: aoe * 2, dash: true });
    } else {
      shapes.push({ kind: 'landing', from: from.clone(), at });
    }
  } else if (definition.targetType === 'skillshot' && definition.projectileRadius) {
    shapes.push({ kind: 'band', from: from.clone(), direction: toward(from), length: range, width: definition.projectileRadius * 2, dash: false });
  } else if (definition.shape === 'line' && aoe > 0) {
    shapes.push({ kind: 'band', from: from.clone(), direction: toward(from), length: range, width: aoe * 2, dash: false });
  } else if (aoe > 0 && aroundCaster) {
    shapes.push({ kind: 'area', center: from.clone(), radius: aoe });
  } else if (aoe > 0 && definition.targetType === 'ground_target') {
    shapes.push({ kind: 'area', center: range > 0 ? within(range) : cursor.clone(), radius: aoe });
  }

  // An area around the caster needs no range circle
  return aroundCaster ? shapes.filter(shape => shape.kind !== 'range') : shapes;
}
