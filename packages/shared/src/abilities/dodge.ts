/**
 * How dodgeable an ability is: the warning it gives (its cast time, and an
 * area's delay before it lands) against the time it takes to walk out of it.
 * A ratio of 1 means a champion standing at the middle of an area can just
 * walk out before it lands.
 *
 * The rule (DODGE_RULES) comes from League, scaled to this game's speeds:
 * League's ground-target mage areas give about 1.1 to 2 (Brand W about 1.1,
 * Syndra Q about 1.4, Veigar W about 2), so ours give at least 1
 * (Nocthar's Q, 1.16, reads well). Areas around the caster are melee: the
 * enemy is next to it and only needs to step back from the edge, so they give
 * less. A skillshot is dodged sideways: the time it takes to arrive at its
 * range against stepping out of its width.
 */

import type { AbilityDefinition } from '../types/abilities';
import { getCastTime } from '../types/abilities';

/** A champion's walking speed the rule assumes (most walk 100) */
export const DODGE_MOVE_SPEED = 100;
/** A champion's body, edge to middle */
export const DODGE_BODY_RADIUS = 20;

export type DodgeKind = 'ground_area' | 'self_area' | 'skillshot';

/** The least ratio each kind gives (an ultimate may give less where noted) */
export const DODGE_RULES: Record<DodgeKind, { basic: number; ultimate: number }> = {
  // Walk out of the middle (League: Brand W 1.1, Syndra Q 1.4, Veigar W 2)
  ground_area: { basic: 1.0, ultimate: 0.9 },
  // Step back out of the outer part: a melee champion's slam is close to its target
  self_area: { basic: 0.35, ultimate: 0.35 },
  // Step sideways out of its path, at its full range
  skillshot: { basic: 2.0, ultimate: 2.0 },
};

export interface Dodge {
  kind: DodgeKind;
  /** Seconds of warning: cast time and delay (and flight for a skillshot) */
  warning: number;
  /** Seconds it takes to walk out */
  escape: number;
  /** warning / escape */
  ratio: number;
}

/** Effects that help (on allies or the caster): an ability with only these isn't dodged */
const HELPFUL = /^(speed|haste|shield|heal|regen|.*_buff$|.*_speed$|.*_stealth$|.*_empowered$|.*_invulnerable$)/;

/**
 * How dodgeable an ability that hits an area or flies is (null for the rest:
 * targets, buffs and heals, dashes, and abilities whose definition says why
 * they're exempt: dodgeExempt)
 */
export function dodgeOf(ability: AbilityDefinition): Dodge | null {
  if (ability.dodgeExempt) return null;
  const cast = getCastTime(ability);
  if (ability.targetType === 'skillshot' && ability.projectileSpeed && ability.range) {
    const warning = cast + ability.range / ability.projectileSpeed;
    const escape = ((ability.projectileRadius ?? ability.width ?? 20) + DODGE_BODY_RADIUS) / DODGE_MOVE_SPEED;
    return { kind: 'skillshot', warning, escape, ratio: warning / escape };
  }
  if (!ability.aoeRadius || ability.dash || ability.movesCaster || ability.teleport) return null;
  const harmful = ability.damage || ability.appliesEffects?.some(effect => !HELPFUL.test(effect));
  if (!harmful) return null;
  const warning = cast + (ability.aoeDelay ?? 0);
  // A cone or a line starts at the caster: a melee swing, stepped back from like an area around it
  const fromCaster = ability.shape === 'cone' || ability.shape === 'line' || ability.shape === 'rectangle';
  const ground = !fromCaster && (ability.targetType === 'ground_target' || ability.targetType === 'skillshot');
  const escape = (ability.aoeRadius + DODGE_BODY_RADIUS) / DODGE_MOVE_SPEED;
  return { kind: ground ? 'ground_area' : 'self_area', warning, escape, ratio: warning / escape };
}
