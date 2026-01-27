/**
 * Network message type definitions.
 * Shared between client and server.
 */
import type { Side } from './units';
import type { AbilitySlot, AbilityState } from './abilities';
import type { ActiveEffectState } from './effects';
import type { EquippedItemState } from './items';
/**
 * Snapshot of a passive ability's state for network sync.
 */
export interface PassiveStateSnapshot {
    /** Whether the passive effect is currently active */
    isActive: boolean;
    /** Time remaining on internal cooldown (0 = ready) */
    cooldownRemaining: number;
    /** Current number of stacks */
    stacks: number;
    /** Time remaining before stacks expire */
    stackTimeRemaining: number;
}
/**
 * Shield type for visual differentiation.
 * Extensible for future shield types (magic shields, etc.)
 */
export type ShieldType = 'normal' | 'magic' | 'physical' | 'passive';
/**
 * Snapshot of an active shield for network sync.
 */
export interface ShieldSnapshot {
    /** Current shield amount */
    amount: number;
    /** Remaining duration in seconds (0 = permanent until depleted) */
    remainingDuration: number;
    /** Source identifier (ability ID, item ID, or passive ID) */
    sourceId: string;
    /** Shield type for visual styling */
    shieldType: ShieldType;
}
/**
 * Input message types from client to server.
 */
export declare enum InputType {
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
    /** Place a ward */
    PLACE_WARD = 11
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
 * Ward type for network messages.
 */
export type WardType = 'stealth' | 'control' | 'farsight';
/**
 * Place ward input.
 */
export interface PlaceWardInput extends InputMessage {
    type: InputType.PLACE_WARD;
    wardType: WardType;
    x: number;
    y: number;
}
/**
 * Union type for all input messages.
 */
export type ClientInput = MoveInput | TargetUnitInput | StopInput | AbilityInput | LevelUpInput | BuyItemInput | SellItemInput | RecallInput | PingInput | PlaceWardInput;
/**
 * Entity types in the game.
 */
export declare enum EntityType {
    CHAMPION = 0,
    MINION = 1,
    TOWER = 2,
    INHIBITOR = 3,
    NEXUS = 4,
    JUNGLE_CAMP = 5,
    PROJECTILE = 6,
    WARD = 7,
    ZONE = 8
}
/**
 * Bitmask for which entity fields have changed.
 */
export declare enum EntityChangeMask {
    POSITION = 1,
    HEALTH = 2,
    RESOURCE = 4,
    LEVEL = 8,
    EFFECTS = 16,
    ABILITIES = 32,
    ITEMS = 64,
    TARGET = 128,
    STATE = 256,
    TRINKET = 512,
    GOLD = 1024,
    SHIELDS = 2048,
    PASSIVE = 4096
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
    x: number;
    y: number;
    targetX?: number;
    targetY?: number;
    targetEntityId?: string;
    health: number;
    maxHealth: number;
    resource: number;
    maxResource: number;
    level: number;
    experience: number;
    experienceToNextLevel: number;
    skillPoints: number;
    attackDamage: number;
    abilityPower: number;
    armor: number;
    magicResist: number;
    attackSpeed: number;
    movementSpeed: number;
    isDead: boolean;
    respawnTimer: number;
    isRecalling: boolean;
    recallProgress: number;
    abilities: Record<AbilitySlot, AbilityState>;
    passive: PassiveStateSnapshot;
    activeEffects: ActiveEffectState[];
    shields: ShieldSnapshot[];
    items: (EquippedItemState | null)[];
    gold: number;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    trinketCharges: number;
    trinketMaxCharges: number;
    trinketCooldown: number;
    trinketRechargeProgress: number;
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
    isAttacking?: boolean;
    isStunned?: boolean;
    isRooted?: boolean;
    slowPercent?: number;
}
/**
 * Snapshot of a tower's state for network sync.
 */
export interface TowerSnapshot {
    entityId: string;
    entityType: EntityType.TOWER;
    side: Side;
    lane: 'top' | 'mid' | 'bot';
    tier: 1 | 2 | 3;
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
    side: Side;
    sourceId: string;
    abilityId: string;
    x: number;
    y: number;
    directionX: number;
    directionY: number;
    speed: number;
    radius: number;
    isDead: boolean;
}
/**
 * Snapshot of a nexus for network sync.
 */
export interface NexusSnapshot {
    entityId: string;
    entityType: EntityType.NEXUS;
    side: Side;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    isDestroyed: boolean;
}
/**
 * Snapshot of a jungle creature for network sync.
 */
export interface JungleCreatureSnapshot {
    entityId: string;
    entityType: EntityType.JUNGLE_CAMP;
    campId: string;
    creatureType: string;
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
 * Snapshot of a ward for network sync.
 */
export interface WardSnapshot {
    entityId: string;
    entityType: EntityType.WARD;
    side: Side;
    wardType: WardType;
    ownerId: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    isDead: boolean;
    isStealthed: boolean;
    revealsWards: boolean;
    sightRange: number;
    remainingDuration: number;
    placedAt: number;
}
/**
 * Snapshot of a zone effect (persistent ground AoE) for network sync.
 */
export interface ZoneSnapshot {
    entityId: string;
    entityType: EntityType.ZONE;
    side: Side;
    sourceId: string;
    abilityId: string;
    x: number;
    y: number;
    radius: number;
    remainingDuration: number;
    totalDuration: number;
    isDead: boolean;
    zoneType: 'damage' | 'slow' | 'heal' | 'buff';
    color?: string;
}
/**
 * Union type for all entity snapshots.
 */
export type EntitySnapshot = ChampionSnapshot | MinionSnapshot | TowerSnapshot | ProjectileSnapshot | NexusSnapshot | JungleCreatureSnapshot | WardSnapshot | ZoneSnapshot;
/**
 * Delta update for an entity (only changed fields).
 */
export interface EntityDelta {
    entityId: string;
    changeMask: number;
    data: Partial<EntitySnapshot>;
}
/**
 * Game event types.
 */
export declare enum GameEventType {
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
    /** Basic attack animation event */
    BASIC_ATTACK = 13,
    /** Damage dealt to an entity */
    DAMAGE = 14,
    /** Gold earned by a champion (non-passive) */
    GOLD_EARNED = 15,
    /** XP earned by a champion */
    XP_EARNED = 16
}
/**
 * Game event for important occurrences.
 */
export interface GameEvent {
    /** Event type */
    type: GameEventType;
    /** When the event occurred */
    timestamp: number;
    /** Event-specific data */
    data: Record<string, unknown>;
    /** Unique event ID for reliable delivery (optional) */
    eventId?: number;
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
    /** Last event ID for acknowledging reliable events (optional) */
    lastEventId?: number;
}
/**
 * Full game state snapshot (sent on connect/reconnect).
 */
export interface FullStateSnapshot {
    tick: number;
    timestamp: number;
    gameTime: number;
    entities: EntitySnapshot[];
    events: GameEvent[];
}
/**
 * Server message types.
 */
export declare enum ServerMessageType {
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
    GAME_END = 6
}
/**
 * Client message types.
 */
export declare enum ClientMessageType {
    /** Player input */
    INPUT = 0,
    /** Ping request */
    PING = 1,
    /** Ready to start */
    READY = 2,
    /** Event acknowledgment for reliable delivery */
    EVENT_ACK = 3
}
/**
 * Event acknowledgment message from client.
 */
export interface EventAckMessage {
    /** Last received event ID */
    lastEventId: number;
}
//# sourceMappingURL=network.d.ts.map