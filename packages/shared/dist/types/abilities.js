/**
 * Type definitions for the ability system.
 * Shared between client and server.
 *
 * Abilities use COMPOSITION over inheritance - abilities can combine
 * multiple behaviors (charge, ammo, channel, recast, toggle, transform, empowered).
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
// =============================================================================
// TYPE GUARDS FOR ABILITY BEHAVIORS
// =============================================================================
/**
 * Check if ability has charge behavior.
 */
export function hasChargeBehavior(ability) {
    return ability.charge !== undefined;
}
/**
 * Check if ability has ammo/charges behavior.
 */
export function hasAmmoBehavior(ability) {
    return ability.ammo !== undefined;
}
/**
 * Get normalized ammo behavior (handles number | AmmoBehavior).
 */
export function getAmmoBehavior(ability) {
    if (ability.ammo === undefined)
        return undefined;
    if (typeof ability.ammo === 'number') {
        // Simple number: max charges with default recharge = cooldown
        return {
            maxCharges: ability.ammo,
            rechargeTime: ability.cooldown ?? [10],
            startingCharges: ability.ammo,
        };
    }
    return ability.ammo;
}
/**
 * Check if ability has channel behavior.
 */
export function hasChannelBehavior(ability) {
    return ability.channel !== undefined;
}
/**
 * Check if ability has recast behavior.
 */
export function hasRecastBehavior(ability) {
    return ability.recast !== undefined;
}
/**
 * Get recast ability definition.
 * Returns the same ability if recast is a number, or the specified ability if it's a definition.
 */
export function getRecastAbility(ability) {
    if (ability.recast === undefined)
        return undefined;
    if (typeof ability.recast === 'number') {
        // Number: recast same ability N times
        return { ability, maxRecasts: ability.recast };
    }
    // AbilityDefinition: different ability on recast
    return { ability: ability.recast, maxRecasts: 1 };
}
/**
 * Check if ability has toggle behavior.
 */
export function hasToggleBehavior(ability) {
    return ability.toggle !== undefined || ability.targetType === 'toggle';
}
/**
 * Get normalized toggle behavior (handles boolean | ToggleBehavior).
 */
export function getToggleBehavior(ability) {
    if (ability.toggle === undefined && ability.targetType !== 'toggle')
        return undefined;
    if (ability.toggle === true || ability.toggle === undefined) {
        // Simple toggle: no mana drain
        return {};
    }
    if (ability.toggle === false)
        return undefined;
    return ability.toggle;
}
/**
 * Check if ability has transform behavior.
 */
export function hasTransformBehavior(ability) {
    return ability.transform !== undefined;
}
/**
 * Check if ability has empowered behavior.
 */
export function hasEmpoweredBehavior(ability) {
    return ability.empowered !== undefined;
}
/**
 * Check if ability has any complex behavior that requires special handling.
 */
export function hasComplexBehavior(ability) {
    return (hasChargeBehavior(ability) ||
        hasAmmoBehavior(ability) ||
        hasChannelBehavior(ability) ||
        hasRecastBehavior(ability) ||
        hasToggleBehavior(ability) ||
        hasTransformBehavior(ability) ||
        hasEmpoweredBehavior(ability));
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