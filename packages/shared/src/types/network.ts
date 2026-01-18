/**
 * Network message type definitions.
 * Shared between client and server.
 */

import type { Vector } from '../math/Vector';
import type { Side } from './units';
import type { AbilitySlot, AbilityState } from './abilities';
import type { ActiveEffectState } from './effects';
import type { EquippedItemState } from './items';

/**
 * Input message types from client to server.
 */
export enum InputType {
  /** Move to position */
  MOVE = 0,
  /** Attack-move to position */
  ATTACK_MOVE = 1,
  /** Target a specific unit (attack/follow) */
  TARGET_UNIT = 2,
  /** Stop current action */
  STOP = 3,
  /** Cast ability */
  ABILITY = 4,
  /** Level up ability */
  LEVEL_UP = 5,
  /** Buy item */
  BUY_ITEM = 6,
  /** Sell item */
  SELL_ITEM = 7,
  /** Recall to base */
  RECALL = 8,
  /** Ping map */
  PING = 9,
  /** Chat message */
  CHAT = 10,
}

/**
 * Base input message from client.
 */
export interface InputMessage {
  /** Sequence number for acknowledgment */
  seq: number;
  /** Client timestamp when input was created */
  clientTime: number;
  /** Type of input */
  type: InputType;
}

/**
 * Movement input.
 */
export interface MoveInput extends InputMessage {
  type: InputType.MOVE | InputType.ATTACK_MOVE;
  targetX: number;
  targetY: number;
}

/**
 * Target unit input.
 */
export interface TargetUnitInput extends InputMessage {
  type: InputType.TARGET_UNIT;
  targetEntityId: string;
}

/**
 * Stop input.
 */
export interface StopInput extends InputMessage {
  type: InputType.STOP;
}

/**
 * Ability cast input.
 */
export interface AbilityInput extends InputMessage {
  type: InputType.ABILITY;
  slot: AbilitySlot;
  /** Target type for the ability */
  targetType: 'none' | 'position' | 'unit';
  /** Target position (for skillshot/ground target) */
  targetX?: number;
  targetY?: number;
  /** Target entity (for targeted abilities) */
  targetEntityId?: string;
}

/**
 * Level up ability input.
 */
export interface LevelUpInput extends InputMessage {
  type: InputType.LEVEL_UP;
  slot: AbilitySlot;
}

/**
 * Buy item input.
 */
export interface BuyItemInput extends InputMessage {
  type: InputType.BUY_ITEM;
  itemId: string;
}

/**
 * Sell item input.
 */
export interface SellItemInput extends InputMessage {
  type: InputType.SELL_ITEM;
  slot: number;
}

/**
 * Recall input.
 */
export interface RecallInput extends InputMessage {
  type: InputType.RECALL;
}

/**
 * Ping input.
 */
export interface PingInput extends InputMessage {
  type: InputType.PING;
  pingType: 'missing' | 'danger' | 'assist' | 'on_my_way' | 'enemy_vision' | 'retreat';
  x: number;
  y: number;
}

/**
 * Union type for all input messages.
 */
export type ClientInput =
  | MoveInput
  | TargetUnitInput
  | StopInput
  | AbilityInput
  | LevelUpInput
  | BuyItemInput
  | SellItemInput
  | RecallInput
  | PingInput;

/**
 * Entity types in the game.
 */
export enum EntityType {
  CHAMPION = 0,
  MINION = 1,
  TOWER = 2,
  INHIBITOR = 3,
  NEXUS = 4,
  JUNGLE_CAMP = 5,
  PROJECTILE = 6,
  WARD = 7,
}

/**
 * Bitmask for which entity fields have changed.
 */
export enum EntityChangeMask {
  POSITION = 1 << 0,
  HEALTH = 1 << 1,
  RESOURCE = 1 << 2,
  LEVEL = 1 << 3,
  EFFECTS = 1 << 4,
  ABILITIES = 1 << 5,
  ITEMS = 1 << 6,
  TARGET = 1 << 7,
  STATE = 1 << 8,
}

/**
 * Snapshot of a champion's state for network sync.
 */
export interface ChampionSnapshot {
  entityId: string;
  entityType: EntityType.CHAMPION;
  side: Side;
  championId: string;
  playerId: string;

  // Position and movement
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  targetEntityId?: string;

  // Stats
  health: number;
  maxHealth: number;
  resource: number;
  maxResource: number;
  level: number;
  experience: number;

  // Combat
  attackDamage: number;
  abilityPower: number;
  armor: number;
  magicResist: number;
  attackSpeed: number;
  movementSpeed: number;

  // State
  isDead: boolean;
  respawnTimer: number;
  isRecalling: boolean;
  recallProgress: number;

  // Abilities
  abilities: Record<AbilitySlot, AbilityState>;

  // Effects
  activeEffects: ActiveEffectState[];

  // Items
  items: (EquippedItemState | null)[];
  gold: number;

  // Score
  kills: number;
  deaths: number;
  assists: number;
  cs: number;  // Creep score
}

/**
 * Snapshot of a minion's state for network sync.
 */
export interface MinionSnapshot {
  entityId: string;
  entityType: EntityType.MINION;
  side: Side;
  minionType: 'melee' | 'caster' | 'siege' | 'super';

  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  targetEntityId?: string;

  health: number;
  maxHealth: number;
  isDead: boolean;
}

/**
 * Snapshot of a tower's state for network sync.
 */
export interface TowerSnapshot {
  entityId: string;
  entityType: EntityType.TOWER;
  side: Side;
  lane: 'top' | 'mid' | 'bot';
  tier: 1 | 2 | 3;  // Outer, inner, inhibitor

  x: number;
  y: number;
  targetEntityId?: string;

  health: number;
  maxHealth: number;
  isDestroyed: boolean;
}

/**
 * Snapshot of a projectile for network sync.
 */
export interface ProjectileSnapshot {
  entityId: string;
  entityType: EntityType.PROJECTILE;
  sourceId: string;
  projectileType: string;

  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

/**
 * Union type for all entity snapshots.
 */
export type EntitySnapshot =
  | ChampionSnapshot
  | MinionSnapshot
  | TowerSnapshot
  | ProjectileSnapshot;

/**
 * Delta update for an entity (only changed fields).
 */
export interface EntityDelta {
  entityId: string;
  changeMask: number;  // Bitmask of changed fields
  data: Partial<EntitySnapshot>;
}

/**
 * Game event types.
 */
export enum GameEventType {
  CHAMPION_KILL = 0,
  TOWER_DESTROYED = 1,
  DRAGON_KILLED = 2,
  BARON_KILLED = 3,
  INHIBITOR_DESTROYED = 4,
  INHIBITOR_RESPAWNED = 5,
  NEXUS_DESTROYED = 6,
  FIRST_BLOOD = 7,
  ACE = 8,
  MULTI_KILL = 9,
  ABILITY_CAST = 10,
  ITEM_PURCHASED = 11,
  LEVEL_UP = 12,
}

/**
 * Game event for important occurrences.
 */
export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Full state update from server.
 */
export interface StateUpdate {
  /** Server tick number */
  tick: number;
  /** Server timestamp */
  timestamp: number;
  /** Game time in seconds */
  gameTime: number;
  /** Acknowledged input sequences per player */
  inputAcks: Record<string, number>;
  /** Entity deltas (only changed entities) */
  deltas: EntityDelta[];
  /** Game events that occurred */
  events: GameEvent[];
}

/**
 * Full game state snapshot (sent on connect/reconnect).
 */
export interface FullStateSnapshot {
  tick: number;
  timestamp: number;
  gameTime: number;
  entities: EntitySnapshot[];
  events: GameEvent[];  // Recent events
}

/**
 * Server message types.
 */
export enum ServerMessageType {
  /** Full state snapshot */
  FULL_STATE = 0,
  /** Delta state update */
  STATE_UPDATE = 1,
  /** Game event */
  EVENT = 2,
  /** Error message */
  ERROR = 3,
  /** Ping response */
  PONG = 4,
  /** Game start */
  GAME_START = 5,
  /** Game end */
  GAME_END = 6,
}

/**
 * Client message types.
 */
export enum ClientMessageType {
  /** Player input */
  INPUT = 0,
  /** Ping request */
  PING = 1,
  /** Ready to start */
  READY = 2,
}
