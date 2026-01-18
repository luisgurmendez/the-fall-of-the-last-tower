/**
 * Damage calculation utilities.
 * Shared between client and server.
 */

import { GameConfig } from '../config/GameConfig';

/**
 * Calculate damage reduction from armor/magic resist.
 * Formula: reduction = resist / (100 + |resist|)
 *
 * @param resist - Armor or magic resist value (can be negative)
 * @returns Damage multiplier (1.0 = no reduction, 0.5 = 50% reduction)
 */
export function calculateDamageReduction(resist: number): number {
  if (resist >= 0) {
    // Positive resist reduces damage
    const reduction = resist / (100 + resist);
    return Math.max(1 - GameConfig.COMBAT.RESIST_CAP, 1 - reduction);
  } else {
    // Negative resist amplifies damage
    return 2 - (100 / (100 - resist));
  }
}

/**
 * Calculate final damage after resistances.
 *
 * @param rawDamage - Raw damage amount
 * @param resist - Armor or magic resist
 * @param penetrationFlat - Flat armor/magic penetration
 * @param penetrationPercent - Percentage armor/magic penetration (0-1)
 * @returns Final damage after reduction
 */
export function calculateDamage(
  rawDamage: number,
  resist: number,
  penetrationFlat = 0,
  penetrationPercent = 0
): number {
  // Apply percentage penetration first
  let effectiveResist = resist * (1 - penetrationPercent);

  // Then flat penetration (can't reduce below 0)
  effectiveResist = Math.max(0, effectiveResist - penetrationFlat);

  // Calculate damage multiplier
  const multiplier = calculateDamageReduction(effectiveResist);

  return rawDamage * multiplier;
}

/**
 * Calculate physical damage.
 */
export function calculatePhysicalDamage(
  rawDamage: number,
  armor: number,
  armorPenFlat = 0,
  armorPenPercent = 0
): number {
  return calculateDamage(rawDamage, armor, armorPenFlat, armorPenPercent);
}

/**
 * Calculate magic damage.
 */
export function calculateMagicDamage(
  rawDamage: number,
  magicResist: number,
  magicPenFlat = 0,
  magicPenPercent = 0
): number {
  return calculateDamage(rawDamage, magicResist, magicPenFlat, magicPenPercent);
}

/**
 * Calculate critical strike damage.
 */
export function calculateCritDamage(
  baseDamage: number,
  critDamageMultiplier = GameConfig.COMBAT.CRIT_DAMAGE_MULTIPLIER
): number {
  return baseDamage * critDamageMultiplier;
}

/**
 * Roll for critical strike.
 */
export function rollCrit(critChance: number, random: () => number = Math.random): boolean {
  return random() < Math.min(1, Math.max(0, critChance));
}

/**
 * Calculate lifesteal healing.
 */
export function calculateLifesteal(
  damageDealt: number,
  lifestealPercent: number
): number {
  return damageDealt * lifestealPercent;
}
