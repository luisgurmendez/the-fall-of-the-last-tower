/**
 * Damage calculation utilities.
 * Shared between client and server.
 */
/**
 * Calculate damage reduction from armor/magic resist.
 * Formula: reduction = resist / (100 + |resist|)
 *
 * @param resist - Armor or magic resist value (can be negative)
 * @returns Damage multiplier (1.0 = no reduction, 0.5 = 50% reduction)
 */
export declare function calculateDamageReduction(resist: number): number;
/**
 * Calculate final damage after resistances.
 *
 * @param rawDamage - Raw damage amount
 * @param resist - Armor or magic resist
 * @param penetrationFlat - Flat armor/magic penetration
 * @param penetrationPercent - Percentage armor/magic penetration (0-1)
 * @returns Final damage after reduction
 */
export declare function calculateDamage(rawDamage: number, resist: number, penetrationFlat?: number, penetrationPercent?: number): number;
/**
 * Calculate physical damage.
 */
export declare function calculatePhysicalDamage(rawDamage: number, armor: number, armorPenFlat?: number, armorPenPercent?: number): number;
/**
 * Calculate magic damage.
 */
export declare function calculateMagicDamage(rawDamage: number, magicResist: number, magicPenFlat?: number, magicPenPercent?: number): number;
/**
 * Calculate critical strike damage.
 */
export declare function calculateCritDamage(baseDamage: number, critDamageMultiplier?: 2): number;
/**
 * Roll for critical strike.
 */
export declare function rollCrit(critChance: number, random?: () => number): boolean;
/**
 * Calculate lifesteal healing.
 */
export declare function calculateLifesteal(damageDealt: number, lifestealPercent: number): number;
//# sourceMappingURL=damage.d.ts.map