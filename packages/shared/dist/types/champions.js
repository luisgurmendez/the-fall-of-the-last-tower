/**
 * Type definitions for the champion system.
 * Shared between client and server.
 */
/**
 * Experience thresholds for each level.
 */
export const LEVEL_EXPERIENCE = [
    0,
    280,
    660,
    1140,
    1720,
    2400,
    3180,
    4060,
    5040,
    6120,
    7300,
    8580,
    9960,
    11440,
    13020,
    14700,
    16480,
    18360, // Level 18
];
/**
 * Calculate stat at a given level.
 */
export function calculateStat(baseStat, growthStat, level) {
    // Linear growth: base + growth * (level - 1)
    return baseStat + growthStat * (level - 1);
}
/**
 * Calculate attack speed at a given level.
 */
export function calculateAttackSpeed(baseAttackSpeed, attackSpeedGrowth, level, bonusAttackSpeed = 0) {
    const growthBonus = attackSpeedGrowth * (level - 1) / 100;
    return baseAttackSpeed * (1 + growthBonus + bonusAttackSpeed);
}
/**
 * Calculate all stats for a champion at a given level.
 */
export function calculateStatsAtLevel(baseStats, growthStats, level) {
    return {
        health: calculateStat(baseStats.health, growthStats.health, level),
        maxHealth: calculateStat(baseStats.health, growthStats.health, level),
        healthRegen: calculateStat(baseStats.healthRegen, growthStats.healthRegen, level),
        resource: calculateStat(baseStats.resource, growthStats.resource, level),
        maxResource: calculateStat(baseStats.resource, growthStats.resource, level),
        resourceRegen: calculateStat(baseStats.resourceRegen, growthStats.resourceRegen, level),
        attackDamage: calculateStat(baseStats.attackDamage, growthStats.attackDamage, level),
        abilityPower: baseStats.abilityPower,
        attackSpeed: calculateAttackSpeed(baseStats.attackSpeed, growthStats.attackSpeed, level),
        attackRange: baseStats.attackRange,
        armor: calculateStat(baseStats.armor, growthStats.armor, level),
        magicResist: calculateStat(baseStats.magicResist, growthStats.magicResist, level),
        movementSpeed: baseStats.movementSpeed,
        critChance: baseStats.critChance,
        critDamage: baseStats.critDamage,
        level,
    };
}
//# sourceMappingURL=champions.js.map