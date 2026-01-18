/**
 * Common type definitions for game units.
 * Shared between client and server.
 */
/**
 * Team identifiers for clarity.
 */
export const TEAM_BLUE = 0;
export const TEAM_RED = 1;
/**
 * Type guard to check if an object has a side property.
 */
export function isSided(obj) {
    return typeof obj === 'object' && obj !== null && 'side' in obj;
}
/**
 * Type guard to check if an object is targetable.
 */
export function isTargetable(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        'id' in obj &&
        'position' in obj &&
        'collisionMask' in obj);
}
/**
 * Type guard to check if an object is damageable.
 */
export function isDamageable(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        'health' in obj &&
        'takeDamage' in obj &&
        typeof obj.takeDamage === 'function');
}
/**
 * Get the opposite side.
 */
export function oppositeSide(side) {
    return side === 0 ? 1 : 0;
}
//# sourceMappingURL=units.js.map