/**
 * InputHandler - Processes and validates player inputs.
 *
 * All inputs are validated on the server to prevent cheating:
 * - Movement speed limits
 * - Ability range validation
 * - Cooldown enforcement
 * - Resource checks
 */

import {
  Vector,
  InputType,
  ClientInput,
  MoveInput,
  TargetUnitInput,
  AbilityInput,
  LevelUpInput,
  BuyItemInput,
  SellItemInput,
  RecallInput,
  PlaceWardInput,
  AbilitySlot,
} from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from '../game/ServerGameContext';
import { abilityExecutor } from '../simulation/ServerAbilityExecutor';
import { Logger } from '../utils/Logger';

export interface InputValidationResult {
  valid: boolean;
  reason?: string;
}

export interface PendingInput {
  playerId: string;
  input: ClientInput;
  receivedAt: number;
}

/**
 * Rate limiting configuration per input type.
 */
const RATE_LIMITS: Record<InputType, number> = {
  [InputType.MOVE]: 20,           // 20 per second
  [InputType.ATTACK_MOVE]: 20,
  [InputType.TARGET_UNIT]: 20,
  [InputType.STOP]: 20,
  [InputType.ABILITY]: 8,         // 8 per second
  [InputType.LEVEL_UP]: 5,
  [InputType.BUY_ITEM]: 5,
  [InputType.SELL_ITEM]: 5,
  [InputType.RECALL]: 2,
  [InputType.PING]: 5,
  [InputType.CHAT]: 3,
  [InputType.PLACE_WARD]: 3,      // 3 per second
};

const ABILITY_SLOTS: ReadonlySet<unknown> = new Set<AbilitySlot>(['Q', 'W', 'E', 'R']);
const WARD_TYPES: ReadonlySet<unknown> = new Set(['stealth', 'control', 'farsight']);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalFiniteNumber(value: unknown): boolean {
  return value === undefined || isFiniteNumber(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

/**
 * Check that an input carries well-typed fields for its type.
 * Inputs arrive as untrusted JSON, so e.g. a string coordinate would
 * otherwise turn the champion's position into NaN.
 */
function hasValidPayload(input: ClientInput): boolean {
  const data = input as unknown as Record<string, unknown>;

  switch (input.type) {
    case InputType.MOVE:
    case InputType.ATTACK_MOVE:
      return isFiniteNumber(data.targetX) && isFiniteNumber(data.targetY);

    case InputType.TARGET_UNIT:
      return typeof data.targetEntityId === 'string';

    case InputType.ABILITY:
      return ABILITY_SLOTS.has(data.slot) &&
        isOptionalFiniteNumber(data.targetX) &&
        isOptionalFiniteNumber(data.targetY) &&
        isOptionalString(data.targetEntityId) &&
        isOptionalFiniteNumber(data.chargeTime);

    case InputType.LEVEL_UP:
      return ABILITY_SLOTS.has(data.slot);

    case InputType.BUY_ITEM:
      return typeof data.itemId === 'string';

    case InputType.SELL_ITEM:
      return Number.isInteger(data.slot);

    case InputType.PLACE_WARD:
      return WARD_TYPES.has(data.wardType) && isFiniteNumber(data.x) && isFiniteNumber(data.y);

    case InputType.PING:
      return isFiniteNumber(data.x) && isFiniteNumber(data.y);

    default:
      return true;
  }
}

export interface InputHandlerOptions {
  /** Clock for rate limiting (ms). Headless simulations pass game time so fast-forwarding isn't rate limited. */
  now?: () => number;
}

export class InputHandler {
  private readonly now: () => number;

  // Input queue per player
  private inputQueues: Map<string, PendingInput[]> = new Map();

  // Rate limiting: playerId -> inputType -> timestamps
  private rateLimitTracking: Map<string, Map<InputType, number[]>> = new Map();

  // Last acknowledged sequence per player
  private lastAckedSeq: Map<string, number> = new Map();

  constructor(options: InputHandlerOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  /**
   * Queue an input for processing.
   */
  queueInput(playerId: string, input: ClientInput): InputValidationResult {
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
      receivedAt: this.now(),
    });

    return { valid: true };
  }

  /**
   * Process all pending inputs for a tick.
   */
  processInputs(context: ServerGameContext): void {
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
  private processInput(
    champion: ServerChampion,
    input: ClientInput,
    context: ServerGameContext
  ): void {
    switch (input.type) {
      case InputType.MOVE:
      case InputType.ATTACK_MOVE:
        this.handleMoveInput(champion, input as MoveInput, context);
        break;

      case InputType.TARGET_UNIT:
        this.handleTargetUnitInput(champion, input as TargetUnitInput, context);
        break;

      case InputType.STOP:
        this.handleStopInput(champion);
        break;

      case InputType.ABILITY:
        this.handleAbilityInput(champion, input as AbilityInput, context);
        break;

      case InputType.LEVEL_UP:
        this.handleLevelUpInput(champion, input as LevelUpInput);
        break;

      case InputType.BUY_ITEM:
        this.handleBuyItemInput(champion, input as BuyItemInput, context);
        break;

      case InputType.SELL_ITEM:
        this.handleSellItemInput(champion, input as SellItemInput);
        break;

      case InputType.RECALL:
        this.handleRecallInput(champion);
        break;

      case InputType.PLACE_WARD:
        this.handlePlaceWardInput(champion, input as PlaceWardInput, context);
        break;
    }
  }

  /**
   * Handle move input.
   */
  private handleMoveInput(
    champion: ServerChampion,
    input: MoveInput,
    context: ServerGameContext
  ): void {
    if (!champion.ccStatus.canMove) return;

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
  private handleTargetUnitInput(
    champion: ServerChampion,
    input: TargetUnitInput,
    context: ServerGameContext
  ): void {
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
    } else {
      champion.setAttackTarget(input.targetEntityId);
    }
  }

  /**
   * Handle stop input.
   */
  private handleStopInput(champion: ServerChampion): void {
    champion.stop();
  }

  /**
   * Handle ability input.
   */
  private handleAbilityInput(
    champion: ServerChampion,
    input: AbilityInput,
    context: ServerGameContext
  ): void {
    // Prepare target position if provided
    let targetPosition: Vector | undefined;
    if (input.targetX !== undefined && input.targetY !== undefined) {
      targetPosition = new Vector(input.targetX, input.targetY);
    }

    // Use the ability executor to cast the ability
    const result = abilityExecutor.castAbility({
      champion,
      slot: input.slot,
      targetPosition,
      targetEntityId: input.targetEntityId,
      context,
      chargeTime: input.chargeTime,
    });

    if (!result.success) {
      Logger.input.debug(`${champion.playerId} failed to cast ${input.slot}: ${result.failReason}`);
    }
  }

  /**
   * Handle level up ability input.
   */
  private handleLevelUpInput(champion: ServerChampion, input: LevelUpInput): void {
    champion.levelUpAbility(input.slot);
  }

  /**
   * Handle buy item input.
   */
  private handleBuyItemInput(
    champion: ServerChampion,
    input: BuyItemInput,
    context: ServerGameContext
  ): void {
    champion.buyItem(input.itemId);
  }

  /**
   * Handle sell item input.
   */
  private handleSellItemInput(champion: ServerChampion, input: SellItemInput): void {
    champion.sellItem(input.slot);
  }

  /**
   * Handle recall input.
   */
  private handleRecallInput(champion: ServerChampion): void {
    champion.startRecall();
  }

  /**
   * Handle place ward input.
   */
  private handlePlaceWardInput(
    champion: ServerChampion,
    input: PlaceWardInput,
    context: ServerGameContext
  ): void {
    // Check if champion has trinket charges available
    if (!champion.canPlaceWard()) {
      return;
    }

    const targetPos = new Vector(input.x, input.y);

    // Validate position is within map bounds
    const mapSize = context.mapConfig.MAP_SIZE;
    const halfWidth = mapSize.width / 2;
    const halfHeight = mapSize.height / 2;

    if (Math.abs(targetPos.x) > halfWidth || Math.abs(targetPos.y) > halfHeight) {
      return;
    }

    // Check if position is within placement range (depends on ward type)
    // Stealth wards need to be placed near champion
    // Farsight wards can be placed from far away
    const maxPlacementRange = input.wardType === 'farsight' ? 4000 : 600;
    const distance = champion.position.distanceTo(targetPos);

    if (distance > maxPlacementRange) {
      return;
    }

    // Consume trinket charge
    if (!champion.consumeTrinketCharge()) {
      return;
    }

    // Place the ward
    context.placeWard(champion.playerId, input.wardType, targetPos);
    Logger.input.info(`${champion.playerId} placed ${input.wardType} ward at (${input.x.toFixed(0)}, ${input.y.toFixed(0)})`);
  }

  /**
   * Basic input validation.
   */
  private validateInput(playerId: string, input: ClientInput): InputValidationResult {
    if (typeof input !== 'object' || input === null || !isFiniteNumber(input.seq)) {
      return { valid: false, reason: 'invalid_payload' };
    }

    // Check sequence number
    const lastSeq = this.lastAckedSeq.get(playerId) ?? -1;
    if (input.seq <= lastSeq) {
      return { valid: false, reason: 'old_sequence' };
    }

    // Validate input type (numeric enum value, not a reverse-mapped name)
    if (typeof input.type !== 'number' || InputType[input.type] === undefined) {
      return { valid: false, reason: 'invalid_type' };
    }

    if (!hasValidPayload(input)) {
      return { valid: false, reason: 'invalid_payload' };
    }

    return { valid: true };
  }

  /**
   * Check rate limiting.
   */
  private checkRateLimit(playerId: string, inputType: InputType): boolean {
    const now = this.now();
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
  getLastAckedSeq(playerId: string): number {
    return this.lastAckedSeq.get(playerId) ?? 0;
  }

  /**
   * Get all last acknowledged sequences.
   */
  getAllAckedSeqs(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [playerId, seq] of this.lastAckedSeq) {
      result[playerId] = seq;
    }
    return result;
  }

  /**
   * Clear state for a player (on disconnect).
   */
  clearPlayer(playerId: string): void {
    this.inputQueues.delete(playerId);
    this.rateLimitTracking.delete(playerId);
    this.lastAckedSeq.delete(playerId);
  }
}
