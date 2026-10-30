/**
 * JungleSpecialAttacks - Telegraphed area attacks of the big jungle monsters.
 *
 * Every few seconds in a fight, a buff monster slams the ground around it
 * and the dragon breathes fire in a cone at its target. The attack winds up
 * first: the monster stands still and clients draw the area (the
 * ABILITY_CAST event, VFX id `abilityId`), so a champion can step out
 * before it lands. Only champions are hit.
 *
 * The attacks are configured in MOBAConfig.JUNGLE.SPECIAL_ATTACKS.
 */

import { MOBAConfig, type DamageType } from '@siege/shared';
import type { ServerEntity } from './ServerEntity';

export interface JungleSpecialAttack {
  /** Ability id sent with ABILITY_CAST; the client draws the VFX of this id */
  abilityId: string;
  shape: 'circle' | 'cone';
  /** Circle radius, or cone length */
  radius: number;
  /** Full cone width in radians (cones only) */
  coneAngle?: number;
  /** Seconds between the warning and the hit */
  windup: number;
  /** Seconds between uses */
  cooldown: number;
  /** Seconds into a fight before the first use */
  firstUseAfter: number;
  damage: number;
  damageType: DamageType;
  /** Effects applied to every champion hit */
  effects: readonly { id: string; duration: number }[];
}

export const JUNGLE_SPECIAL_ATTACKS: Partial<Record<string, JungleSpecialAttack>> = MOBAConfig.JUNGLE.SPECIAL_ATTACKS;

/**
 * Whether `target` is inside the attack's area, cast from `origin` toward
 * `aim` (cones only).
 */
export function isInSpecialArea(
  attack: JungleSpecialAttack,
  origin: { x: number; y: number },
  aim: { x: number; y: number },
  target: ServerEntity
): boolean {
  const dx = target.position.x - origin.x;
  const dy = target.position.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const radius = target.getRadius();
  if (distance > attack.radius + radius) return false;
  if (attack.shape === 'circle' || distance <= radius) return true;

  // Angle to the target, widened by the target's size
  const aimAngle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  let difference = Math.abs(Math.atan2(dy, dx) - aimAngle);
  if (difference > Math.PI) difference = Math.PI * 2 - difference;
  return difference <= (attack.coneAngle ?? 0) / 2 + Math.asin(Math.min(1, radius / distance));
}
