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
  SummonerSpellInput,
  UseItemInput,
  PingInput,
  EmoteInput,
  ChatInput,
  AbilitySlot,
  GameConfig,
  GameEventType,
  PING_TYPES,
  EMOTES,
  CHAT_SCOPES,
} from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from '../game/ServerGameContext';
import { abilityExecutor } from '../simulation/ServerAbilityExecutor';
import { Logger } from '../utils/Logger';
import { cleanChatText } from './chat';

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
  [InputType.SUMMONER_SPELL]: 4,
  [InputType.USE_ITEM]: 8,
  [InputType.EMOTE]: 2,
  [InputType.SURRENDER]: 1,       // Handled by GameRoom before queueing
};

/** Pings: at most this many in this many seconds, so a team can't be spammed */
const PING_BURST = { count: 5, seconds: 6 };
/** Seconds between a player's emotes */
const EMOTE_COOLDOWN = 2;
/** Chat: at most this many messages in this many seconds */
const CHAT_BURST = { count: 5, seconds: 5 };

const ABILITY_SLOTS: ReadonlySet<unknown> = new Set<AbilitySlot>(['Q', 'W', 'E', 'R']);
const WARD_TYPES: ReadonlySet<unknown> = new Set(['stealth', 'control', 'farsight']);
const PING_TYPE_SET: ReadonlySet<unknown> = new Set(PING_TYPES);
const EMOTE_SET: ReadonlySet<unknown> = new Set(EMOTES);
const CHAT_SCOPE_SET: ReadonlySet<unknown> = new Set(CHAT_SCOPES);

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

    case InputType.SUMMONER_SPELL:
      return (data.slot === 0 || data.slot === 1) &&
        isOptionalFiniteNumber(data.targetX) &&
        isOptionalFiniteNumber(data.targetY) &&
        isOptionalString(data.targetEntityId);

    case InputType.USE_ITEM:
      return Number.isInteger(data.slot) && (data.slot as number) >= 0 && (data.slot as number) < 6 &&
        isOptionalFiniteNumber(data.targetX) &&
        isOptionalFiniteNumber(data.targetY);

    case InputType.PING:
      return PING_TYPE_SET.has(data.pingType) && isFiniteNumber(data.x) && isFiniteNumber(data.y);

    case InputType.EMOTE:
      return EMOTE_SET.has(data.emote);

    case InputType.CHAT:
      return typeof data.text === 'string' && CHAT_SCOPE_SET.has(data.scope);

    default:
      return true;
  }
}

export interface InputHandlerOptions {
  /** Clock for rate limiting (ms). Headless simulations pass game time so fast-forwarding isn't rate limited. */
  now?: () => number;
}

/** The inputs a dead champion still sends: the shop, pings and chat */
const DEAD_CHAMPION_INPUTS: ReadonlySet<InputType> = new Set([InputType.BUY_ITEM, InputType.SELL_ITEM, InputType.PING, InputType.CHAT]);

/**
 * What a taunted or feared champion can't be ordered to do: it attacks its
 * taunter, or runs from whoever scared it, nothing else
 */
const HELD_IGNORED_INPUTS: ReadonlySet<InputType> = new Set([
  InputType.MOVE,
  InputType.ATTACK_MOVE,
  InputType.TARGET_UNIT,
  InputType.STOP,
  InputType.RECALL,
  InputType.ABILITY,
  InputType.SUMMONER_SPELL,
]);

/**
 * Whether a champion may use the shop: at its fountain, or anywhere while
 * it's dead (unless the rule is off).
 */
export function canShop(champion: ServerChampion, context: ServerGameContext): boolean {
  if (!GameConfig.ECONOMY.SHOP_ONLY_AT_BASE || champion.isDead) return true;
  const fountain = champion.side === 0 ? context.mapConfig.CHAMPION_SPAWN.BLUE : context.mapConfig.CHAMPION_SPAWN.RED;
  return champion.position.distanceTo(fountain) <= context.mapConfig.FOUNTAIN.RADIUS;
}

export class InputHandler {
  private readonly now: () => number;

  // Input queue per player
  private inputQueues: Map<string, PendingInput[]> = new Map();

  // Rate limiting: playerId -> inputType -> timestamps
  private rateLimitTracking: Map<string, Map<InputType, number[]>> = new Map();

  // Last acknowledged sequence per player
  private lastAckedSeq: Map<string, number> = new Map();

  // Each player's recent pings and chat messages, and last emote (game time), for their limits
  private recentPings: Map<string, number[]> = new Map();
  private recentChats: Map<string, number[]> = new Map();
  private lastEmoteAt: Map<string, number> = new Map();

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
      if (!champion) {
        queue.length = 0;
        continue;
      }

      // Process inputs in order
      for (const pending of queue) {
        // A dead champion can still shop and ping, nothing else
        if (champion.isDead && !DEAD_CHAMPION_INPUTS.has(pending.input.type)) continue;
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
    // Taunted or feared: players' and bots' orders to move, attack something else, cast or recall are ignored
    if ((champion.ccStatus.isTaunted || champion.ccStatus.isFeared) && HELD_IGNORED_INPUTS.has(input.type)) return;

    // Any other order ends an attack-move
    if (input.type === InputType.MOVE || input.type === InputType.TARGET_UNIT ||
        input.type === InputType.STOP || input.type === InputType.RECALL) {
      champion.endAttackMove();
    }

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
        this.handleSellItemInput(champion, input as SellItemInput, context);
        break;

      case InputType.RECALL:
        this.handleRecallInput(champion, context);
        break;

      case InputType.PLACE_WARD:
        this.handlePlaceWardInput(champion, input as PlaceWardInput, context);
        break;

      case InputType.SUMMONER_SPELL: {
        const { slot, targetX, targetY, targetEntityId } = input as SummonerSpellInput;
        champion.summoners.cast(slot, { x: targetX, y: targetY, entityId: targetEntityId }, context);
        break;
      }

      case InputType.USE_ITEM: {
        const { slot, targetX, targetY } = input as UseItemInput;
        const target = targetX !== undefined && targetY !== undefined ? { x: targetX, y: targetY } : undefined;
        champion.itemActives.use(slot, target, context);
        break;
      }

      case InputType.PING:
        this.handlePingInput(champion, input as PingInput, context);
        break;

      case InputType.EMOTE:
        this.handleEmoteInput(champion, input as EmoteInput, context);
        break;

      case InputType.CHAT:
        this.handleChatInput(champion, input as ChatInput, context);
        break;
    }
  }

  /**
   * A chat message, cleaned (chat.ts), for the team or for everyone
   * (GameRoom sends CHAT events by scope), unless it's empty or the player
   * sent too many lately.
   */
  private handleChatInput(champion: ServerChampion, input: ChatInput, context: ServerGameContext): void {
    const text = cleanChatText(input.text);
    if (text === '') return;
    const now = context.getGameTime();
    const recent = (this.recentChats.get(champion.playerId) ?? []).filter(time => now - time < CHAT_BURST.seconds);
    this.recentChats.set(champion.playerId, recent);
    if (recent.length >= CHAT_BURST.count) return;
    recent.push(now);

    context.addEvent(GameEventType.CHAT, {
      entityId: champion.id,
      side: champion.side,
      championId: champion.definition.id,
      scope: input.scope,
      text,
    });
  }

  /**
   * A ping, for the champion's team (GameRoom sends PING events to its side
   * only), unless it pinged too much lately.
   */
  private handlePingInput(champion: ServerChampion, input: PingInput, context: ServerGameContext): void {
    const now = context.getGameTime();
    const recent = (this.recentPings.get(champion.playerId) ?? []).filter(time => now - time < PING_BURST.seconds);
    this.recentPings.set(champion.playerId, recent);
    if (recent.length >= PING_BURST.count) return;
    recent.push(now);

    const half = context.mapConfig.MAP_SIZE.width / 2;
    context.addEvent(GameEventType.PING, {
      entityId: champion.id,
      side: champion.side,
      championId: champion.definition.id,
      pingType: input.pingType,
      x: Math.max(-half, Math.min(half, input.x)),
      y: Math.max(-half, Math.min(half, input.y)),
    });
  }

  /**
   * An emote over the champion (GameRoom sends EMOTE events to its team and
   * to whoever sees it), at most one every EMOTE_COOLDOWN seconds.
   */
  private handleEmoteInput(champion: ServerChampion, input: EmoteInput, context: ServerGameContext): void {
    const now = context.getGameTime();
    const last = this.lastEmoteAt.get(champion.playerId);
    if (last !== undefined && now - last < EMOTE_COOLDOWN) return;
    this.lastEmoteAt.set(champion.playerId, now);
    context.addEvent(GameEventType.EMOTE, { entityId: champion.id, side: champion.side, emote: input.emote });
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

    context.moveChampion(champion, targetPos);

    // Attack-move: the champion attacks enemies that come in range on the way
    if (input.type === InputType.ATTACK_MOVE) {
      champion.startAttackMove(targetPos);
    }
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
    if (!canShop(champion, context)) return;
    champion.buyItem(input.itemId);
  }

  /**
   * Handle sell item input.
   */
  private handleSellItemInput(champion: ServerChampion, input: SellItemInput, context: ServerGameContext): void {
    if (!canShop(champion, context)) return;
    champion.sellItem(input.slot);
  }

  /**
   * Handle recall input.
   */
  private handleRecallInput(champion: ServerChampion, context: ServerGameContext): void {
    // Recalling means standing still: the champion stops (and drops any path) right away
    champion.stop();
    context.pathFollower.clear(champion.id);
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
    // A control ward uses one bought in the shop; the rest use trinket charges
    const isControl = input.wardType === 'control';
    if (isControl ? champion.controlWards <= 0 || champion.isDead : !champion.canPlaceWard()) {
      return;
    }

    // A click past the placement range places the ward at the edge of the
    // range toward it, and one in a wall at the wall's edge toward the champion
    const target = new Vector(input.x, input.y);
    const range = input.wardType === 'farsight' ? GameConfig.VISION.FARSIGHT_PLACE_RANGE : GameConfig.VISION.WARD_PLACE_RANGE;
    const offset = target.subtracted(champion.position);
    const distance = offset.length();
    const reach = Math.min(distance, range);
    const direction = distance > 0 ? offset.scaled(1 / distance) : new Vector(0, 0);
    let along = reach;
    while (along > 0 && context.terrain.isBlocked(champion.position.x + direction.x * along, champion.position.y + direction.y * along)) {
      along -= 8;
    }
    const targetPos = champion.position.added(direction.scaled(Math.max(0, along)));

    if (isControl) {
      champion.controlWards--;
    } else if (!champion.consumeTrinketCharge()) {
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
    this.recentPings.delete(playerId);
    this.recentChats.delete(playerId);
    this.lastEmoteAt.delete(playerId);
  }
}
