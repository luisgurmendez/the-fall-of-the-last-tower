/**
 * InputHandler - Processes and validates player inputs.
 *
 * All inputs are validated on the server to prevent cheating:
 * - Movement speed limits
 * - Ability range validation
 * - Cooldown enforcement
 * - Resource checks
 */
import { Vector, InputType, } from '@siege/shared';
/**
 * Rate limiting configuration per input type.
 */
const RATE_LIMITS = {
    [InputType.MOVE]: 20,
    [InputType.ATTACK_MOVE]: 20,
    [InputType.TARGET_UNIT]: 20,
    [InputType.STOP]: 20,
    [InputType.ABILITY]: 8,
    [InputType.LEVEL_UP]: 5,
    [InputType.BUY_ITEM]: 5,
    [InputType.SELL_ITEM]: 5,
    [InputType.RECALL]: 2,
    [InputType.PING]: 5,
    [InputType.CHAT]: 3,
};
export class InputHandler {
    constructor() {
        // Input queue per player
        this.inputQueues = new Map();
        // Rate limiting: playerId -> inputType -> timestamps
        this.rateLimitTracking = new Map();
        // Last acknowledged sequence per player
        this.lastAckedSeq = new Map();
    }
    /**
     * Queue an input for processing.
     */
    queueInput(playerId, input) {
        // Basic validation
        const validation = this.validateInput(playerId, input);
        if (!validation.valid) {
            return validation;
        }
        // Rate limiting
        if (!this.checkRateLimit(playerId, input.type)) {
            return { valid: false, reason: 'rate_limited' };
        }
        // Add to queue
        let queue = this.inputQueues.get(playerId);
        if (!queue) {
            queue = [];
            this.inputQueues.set(playerId, queue);
        }
        queue.push({
            playerId,
            input,
            receivedAt: Date.now(),
        });
        return { valid: true };
    }
    /**
     * Process all pending inputs for a tick.
     */
    processInputs(context) {
        for (const [playerId, queue] of this.inputQueues) {
            const champion = context.getChampionByPlayerId(playerId);
            if (!champion || champion.isDead) {
                queue.length = 0; // Clear queue for dead champions
                continue;
            }
            // Process inputs in order
            for (const pending of queue) {
                this.processInput(champion, pending.input, context);
                this.lastAckedSeq.set(playerId, pending.input.seq);
            }
            // Clear processed inputs
            queue.length = 0;
        }
    }
    /**
     * Process a single input.
     */
    processInput(champion, input, context) {
        switch (input.type) {
            case InputType.MOVE:
            case InputType.ATTACK_MOVE:
                this.handleMoveInput(champion, input, context);
                break;
            case InputType.TARGET_UNIT:
                this.handleTargetUnitInput(champion, input, context);
                break;
            case InputType.STOP:
                this.handleStopInput(champion);
                break;
            case InputType.ABILITY:
                this.handleAbilityInput(champion, input, context);
                break;
            case InputType.LEVEL_UP:
                this.handleLevelUpInput(champion, input);
                break;
            case InputType.BUY_ITEM:
                this.handleBuyItemInput(champion, input, context);
                break;
            case InputType.SELL_ITEM:
                this.handleSellItemInput(champion, input);
                break;
            case InputType.RECALL:
                this.handleRecallInput(champion);
                break;
        }
    }
    /**
     * Handle move input.
     */
    handleMoveInput(champion, input, context) {
        if (!champion.ccStatus.canMove)
            return;
        const targetPos = new Vector(input.targetX, input.targetY);
        // Validate position is within map bounds
        const mapSize = context.mapConfig.MAP_SIZE;
        const halfWidth = mapSize.width / 2;
        const halfHeight = mapSize.height / 2;
        if (Math.abs(targetPos.x) > halfWidth || Math.abs(targetPos.y) > halfHeight) {
            return; // Invalid position
        }
        champion.setMoveTarget(targetPos);
        // For attack move, also set attack stance
        // TODO: Implement attack-move behavior
    }
    /**
     * Handle target unit input.
     */
    handleTargetUnitInput(champion, input, context) {
        const target = context.getEntity(input.targetEntityId);
        if (!target || target.isDead) {
            return;
        }
        // Validate target is visible (fog of war)
        // TODO: Check visibility
        // Can't target allies for attack
        if (target.side === champion.side) {
            // For now, just follow ally
            champion.setMoveTarget(target.position);
        }
        else {
            champion.setAttackTarget(input.targetEntityId);
        }
    }
    /**
     * Handle stop input.
     */
    handleStopInput(champion) {
        champion.stop();
    }
    /**
     * Handle ability input.
     */
    handleAbilityInput(champion, input, context) {
        // Validate champion can cast
        if (!champion.ccStatus.canCast) {
            return;
        }
        const slot = input.slot;
        const state = champion.abilityStates[slot];
        // Check if ability is learned
        if (state.rank <= 0) {
            return;
        }
        // Check cooldown
        if (state.cooldownRemaining > 0) {
            return;
        }
        // Check mana cost
        // TODO: Get ability mana cost from definition
        const manaCost = 0; // placeholder
        if (champion.resource < manaCost) {
            return;
        }
        // Validate target if needed
        if (input.targetType === 'unit' && input.targetEntityId) {
            const target = context.getEntity(input.targetEntityId);
            if (!target || target.isDead) {
                return;
            }
            // Check range
            // TODO: Get ability range from definition
            const range = 500; // placeholder
            if (!champion.isInRange(target, range)) {
                return;
            }
        }
        // Cast the ability
        // TODO: Implement actual ability casting
        console.log(`[InputHandler] ${champion.playerId} casting ${slot}`);
        // Deduct mana and start cooldown
        champion.resource -= manaCost;
        state.cooldownRemaining = 10; // placeholder cooldown
        state.cooldownTotal = 10;
    }
    /**
     * Handle level up ability input.
     */
    handleLevelUpInput(champion, input) {
        champion.levelUpAbility(input.slot);
    }
    /**
     * Handle buy item input.
     */
    handleBuyItemInput(champion, input, context) {
        // TODO: Implement item purchasing
        console.log(`[InputHandler] ${champion.playerId} buying item ${input.itemId}`);
    }
    /**
     * Handle sell item input.
     */
    handleSellItemInput(champion, input) {
        // TODO: Implement item selling
        console.log(`[InputHandler] ${champion.playerId} selling item in slot ${input.slot}`);
    }
    /**
     * Handle recall input.
     */
    handleRecallInput(champion) {
        champion.startRecall();
    }
    /**
     * Basic input validation.
     */
    validateInput(playerId, input) {
        // Check sequence number
        const lastSeq = this.lastAckedSeq.get(playerId) ?? -1;
        if (input.seq <= lastSeq) {
            return { valid: false, reason: 'old_sequence' };
        }
        // Validate input type
        if (!(input.type in InputType)) {
            return { valid: false, reason: 'invalid_type' };
        }
        return { valid: true };
    }
    /**
     * Check rate limiting.
     */
    checkRateLimit(playerId, inputType) {
        const now = Date.now();
        const windowMs = 1000; // 1 second window
        let playerTracking = this.rateLimitTracking.get(playerId);
        if (!playerTracking) {
            playerTracking = new Map();
            this.rateLimitTracking.set(playerId, playerTracking);
        }
        let timestamps = playerTracking.get(inputType);
        if (!timestamps) {
            timestamps = [];
            playerTracking.set(inputType, timestamps);
        }
        // Remove old timestamps
        const cutoff = now - windowMs;
        while (timestamps.length > 0 && timestamps[0] < cutoff) {
            timestamps.shift();
        }
        // Check rate limit
        const limit = RATE_LIMITS[inputType] ?? 10;
        if (timestamps.length >= limit) {
            return false;
        }
        // Record this input
        timestamps.push(now);
        return true;
    }
    /**
     * Get last acknowledged sequence for a player.
     */
    getLastAckedSeq(playerId) {
        return this.lastAckedSeq.get(playerId) ?? 0;
    }
    /**
     * Get all last acknowledged sequences.
     */
    getAllAckedSeqs() {
        const result = {};
        for (const [playerId, seq] of this.lastAckedSeq) {
            result[playerId] = seq;
        }
        return result;
    }
    /**
     * Clear state for a player (on disconnect).
     */
    clearPlayer(playerId) {
        this.inputQueues.delete(playerId);
        this.rateLimitTracking.delete(playerId);
        this.lastAckedSeq.delete(playerId);
    }
}
//# sourceMappingURL=InputHandler.js.map