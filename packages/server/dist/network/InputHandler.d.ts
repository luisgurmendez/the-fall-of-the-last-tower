/**
 * InputHandler - Processes and validates player inputs.
 *
 * All inputs are validated on the server to prevent cheating:
 * - Movement speed limits
 * - Ability range validation
 * - Cooldown enforcement
 * - Resource checks
 */
import { ClientInput } from '@siege/shared';
import type { ServerGameContext } from '../game/ServerGameContext';
export interface InputValidationResult {
    valid: boolean;
    reason?: string;
}
export interface PendingInput {
    playerId: string;
    input: ClientInput;
    receivedAt: number;
}
export declare class InputHandler {
    private inputQueues;
    private rateLimitTracking;
    private lastAckedSeq;
    /**
     * Queue an input for processing.
     */
    queueInput(playerId: string, input: ClientInput): InputValidationResult;
    /**
     * Process all pending inputs for a tick.
     */
    processInputs(context: ServerGameContext): void;
    /**
     * Process a single input.
     */
    private processInput;
    /**
     * Handle move input.
     */
    private handleMoveInput;
    /**
     * Handle target unit input.
     */
    private handleTargetUnitInput;
    /**
     * Handle stop input.
     */
    private handleStopInput;
    /**
     * Handle ability input.
     */
    private handleAbilityInput;
    /**
     * Handle level up ability input.
     */
    private handleLevelUpInput;
    /**
     * Handle buy item input.
     */
    private handleBuyItemInput;
    /**
     * Handle sell item input.
     */
    private handleSellItemInput;
    /**
     * Handle recall input.
     */
    private handleRecallInput;
    /**
     * Basic input validation.
     */
    private validateInput;
    /**
     * Check rate limiting.
     */
    private checkRateLimit;
    /**
     * Get last acknowledged sequence for a player.
     */
    getLastAckedSeq(playerId: string): number;
    /**
     * Get all last acknowledged sequences.
     */
    getAllAckedSeqs(): Record<string, number>;
    /**
     * Clear state for a player (on disconnect).
     */
    clearPlayer(playerId: string): void;
}
//# sourceMappingURL=InputHandler.d.ts.map