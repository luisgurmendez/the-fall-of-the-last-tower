/**
 * Type definitions for the ability system.
 * Shared between client and server.
 */
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