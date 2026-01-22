/**
 * Type definitions for the ability system.
 * Shared between client and server.
 */
/**
 * Get the passive value at a specific champion level.
 */
export function getPassiveLevelValue(passive, level) {
    if (!passive.levelScaling) {
        return passive.damage?.scaling.base[0] ??
            passive.heal?.scaling.base[0] ??
            passive.shield?.scaling.base[0] ??
            0;
    }
    const { levels, values } = passive.levelScaling;
    // Find the appropriate level bracket
    for (let i = levels.length - 1; i >= 0; i--) {
        if (level >= levels[i]) {
            return values[i];
        }
    }
    return values[0];
}
/**
 * Calculate scaled ability value.
 */
export function calculateAbilityValue(scaling, rank, stats) {
    if (rank < 1 || rank > scaling.base.length) {
        return 0;
    }
    let value = scaling.base[rank - 1];
    if (scaling.adRatio && stats.attackDamage) {
        value += stats.attackDamage * scaling.adRatio;
    }
    if (scaling.apRatio && stats.abilityPower) {
        value += stats.abilityPower * scaling.apRatio;
    }
    if (scaling.bonusHealthRatio && stats.bonusHealth) {
        value += stats.bonusHealth * scaling.bonusHealthRatio;
    }
    if (scaling.maxHealthRatio && stats.maxHealth) {
        value += stats.maxHealth * scaling.maxHealthRatio;
    }
    if (scaling.missingHealthRatio && stats.missingHealth) {
        value += stats.missingHealth * scaling.missingHealthRatio;
    }
    if (scaling.armorRatio && stats.armor) {
        value += stats.armor * scaling.armorRatio;
    }
    if (scaling.magicResistRatio && stats.magicResist) {
        value += stats.magicResist * scaling.magicResistRatio;
    }
    return value;
}
//# sourceMappingURL=abilities.js.map