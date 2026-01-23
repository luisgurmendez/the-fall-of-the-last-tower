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
 * Entity types for ability targeting checks.
 * Must match EntityType enum from network.ts
 */
export const AbilityEntityType = {
    CHAMPION: 0,
    MINION: 1,
    TOWER: 2,
    INHIBITOR: 3,
    NEXUS: 4,
    JUNGLE_CAMP: 5,
    WARD: 7,
};
/**
 * Check if an ability can affect a specific entity type.
 * Returns true if the ability can damage/affect the given entity type.
 *
 * Default behavior:
 * - Champions: true
 * - Minions: true
 * - Towers/Structures: false (most abilities don't damage towers)
 * - Jungle camps: true
 * - Wards: false
 */
export function canAbilityAffectEntityType(ability, entityType) {
    if (!ability)
        return false;
    switch (entityType) {
        case AbilityEntityType.CHAMPION:
            return ability.affectsChampions !== false; // Default true
        case AbilityEntityType.MINION:
            return ability.affectsMinions !== false; // Default true
        case AbilityEntityType.TOWER:
        case AbilityEntityType.INHIBITOR:
        case AbilityEntityType.NEXUS:
            return ability.affectsTowers === true; // Default false
        case AbilityEntityType.JUNGLE_CAMP:
            return ability.affectsJungleCamps !== false; // Default true
        case AbilityEntityType.WARD:
            return ability.affectsWards === true; // Default false
        default:
            return true; // Unknown types: allow by default
    }
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