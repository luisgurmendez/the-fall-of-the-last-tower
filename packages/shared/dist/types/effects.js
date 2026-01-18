/**
 * Type definitions for the effects/status system.
 * Shared between client and server.
 */
/**
 * Compute crowd control status from active effects.
 */
export function computeCCStatus(effects, getDefinition) {
    const status = {
        isStunned: false,
        isSilenced: false,
        isGrounded: false,
        isRooted: false,
        isDisarmed: false,
        canMove: true,
        canAttack: true,
        canCast: true,
        canUseMobilityAbilities: true,
    };
    for (const effect of effects) {
        const def = getDefinition(effect.definitionId);
        if (!def || !('ccType' in def))
            continue;
        switch (def.ccType) {
            case 'stun':
            case 'knockup':
            case 'knockback':
            case 'suppress':
                status.isStunned = true;
                break;
            case 'silence':
                status.isSilenced = true;
                break;
            case 'grounded':
                status.isGrounded = true;
                break;
            case 'root':
                status.isRooted = true;
                break;
            case 'disarm':
            case 'blind':
                status.isDisarmed = true;
                break;
        }
    }
    // Compute ability to act
    status.canMove = !status.isStunned && !status.isRooted;
    status.canAttack = !status.isStunned && !status.isDisarmed;
    status.canCast = !status.isStunned && !status.isSilenced;
    status.canUseMobilityAbilities = status.canMove && status.canCast && !status.isGrounded;
    return status;
}
/**
 * Create default CC status (no effects).
 */
export function defaultCCStatus() {
    return {
        isStunned: false,
        isSilenced: false,
        isGrounded: false,
        isRooted: false,
        isDisarmed: false,
        canMove: true,
        canAttack: true,
        canCast: true,
        canUseMobilityAbilities: true,
    };
}
//# sourceMappingURL=effects.js.map