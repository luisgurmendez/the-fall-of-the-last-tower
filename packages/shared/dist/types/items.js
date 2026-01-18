/**
 * Type definitions for the item system.
 * Shared between client and server.
 */
/**
 * Calculate total stats from equipped items.
 */
export function calculateItemStats(items, getDefinition) {
    const totalStats = {};
    for (const item of items) {
        if (!item)
            continue;
        const def = getDefinition(item.definitionId);
        if (!def)
            continue;
        for (const [stat, value] of Object.entries(def.stats)) {
            const key = stat;
            totalStats[key] = (totalStats[key] || 0) + value;
        }
    }
    return totalStats;
}
/**
 * Find first empty item slot.
 */
export function findEmptySlot(items) {
    for (let i = 0; i < 6; i++) {
        if (!items[i]) {
            return i;
        }
    }
    return null;
}
/**
 * Check if inventory contains a specific item.
 */
export function hasItem(items, itemId) {
    return items.some(item => item?.definitionId === itemId);
}
//# sourceMappingURL=items.js.map