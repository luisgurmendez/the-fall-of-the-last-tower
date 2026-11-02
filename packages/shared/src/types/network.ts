/**
 * Network message type definitions.
 * Shared between client and server.
 */

import type { Vector } from '../math/Vector';
import type { Side } from './units';
import type { AbilitySlot, AbilityState, PassiveState } from './abilities';
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
  /** Place a ward */
  PLACE_WARD = 11,
  /** Concede the match */
  SURRENDER = 12,
  /** Cast a summoner spell (D or F) */
  SUMMONER_SPELL = 13,
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
  /** Charge time in seconds (for charge abilities like Vile Q) */
  chargeTime?: number;
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
 * Cast one of the champion's two summoner spells. Aimed spells carry the
 * cursor's position and, for ones cast on a unit, the unit under it.
 */
export interface SummonerSpellInput extends InputMessage {
  type: InputType.SUMMONER_SPELL;
  /** 0 = D, 1 = F */
  slot: 0 | 1;
  targetX?: number;
  targetY?: number;
  targetEntityId?: string;
}

/**
 * Union type for all input messages.
 */
/**
 * Concede the match. The other side wins once every human on the
 * player's side has surrendered.
 */
export interface SurrenderInput extends InputMessage {
  type: InputType.SURRENDER;
}

export type ClientInput =
  | MoveInput
  | TargetUnitInput
  | StopInput
  | AbilityInput
  | LevelUpInput
  | BuyItemInput
  | SellItemInput
  | RecallInput
  | PingInput
  | PlaceWardInput
  | SummonerSpellInput
  | SurrenderInput;

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
  ZONE = 8,
  LIGHT_ORB = 9,
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
  TRINKET = 1 << 9,
  GOLD = 1 << 10,
  SHIELDS = 1 << 11,
  PASSIVE = 1 << 12,
  /** Champion combat stats: attack damage, ability power, armor, magic resist, attack and movement speed */
  STATS = 1 << 13,
  /** Kills, deaths, assists and creep score */
  SCORE = 1 << 14,
  /** Dash state: isDashing, its ability and where it ends (the client draws dashes from it) */
  DASH = 1 << 15,
}

/**
 * A champion's summoner spell, as clients see it.
 */
export interface SummonerSpellState {
  id: string;
  /** Seconds until it can be cast again (0 when ready) */
  cooldownRemaining: number;
  /** Its full cooldown, for the HUD's sweep */
  cooldown: number;
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
  // Clearable values use `| null` instead of `?:` for proper delta updates
  // null = explicitly cleared, absent = no change (in deltas)
  targetX?: number | null;
  targetY?: number | null;
  targetEntityId?: string | null;

  // Stats
  health: number;
  maxHealth: number;
  resource: number;
  maxResource: number;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  skillPoints: number;

  // Combat
  attackDamage: number;
  abilityPower: number;
  armor: number;
  magicResist: number;
  attackSpeed: number;
  movementSpeed: number;
  /** Basic attack range, edge to edge (transforms like Vile's R change it) */
  attackRange: number;

  // State
  isDead: boolean;
  respawnTimer: number;
  isRecalling: boolean;
  recallProgress: number;

  // Dash state (for ability animations like Lume E)
  isDashing?: boolean;
  dashTargetX?: number | null;
  dashTargetY?: number | null;
  dashAbilityId?: string | null;

  // Abilities
  abilities: Record<AbilitySlot, AbilityState>;

  /** The two summoner spells (D, F) and their cooldowns */
  summoners?: SummonerSpellState[];

  // Passive
  passive: PassiveStateSnapshot;

  // Effects
  activeEffects: ActiveEffectState[];

  // Shields
  shields: ShieldSnapshot[];

  // Items
  items: (EquippedItemState | null)[];
  gold: number;

  // Score
  kills: number;
  deaths: number;
  assists: number;
  cs: number;  // Creep score

  // Trinket (ward placement)
  trinketCharges: number;
  trinketMaxCharges: number;
  trinketCooldown: number;
  trinketRechargeProgress: number;
  /** Control wards carried (bought in the shop; key 5 places one) */
  controlWards?: number;
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
  // Clearable values use `| null` for proper delta updates
  targetX?: number | null;
  targetY?: number | null;
  targetEntityId?: string | null;

  health: number;
  maxHealth: number;
  isDead: boolean;

  // Attack animation state - true when minion is actively in attack animation
  isAttacking?: boolean;

  // CC status for visual feedback
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
  tier: 1 | 2 | 3;  // Outer, inner, inhibitor

  x: number;
  y: number;
  // Clearable value uses `| null` for proper delta updates
  targetEntityId?: string | null;

  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  /** Can't be damaged yet (the lane's outer tower still stands) */
  isProtected?: boolean;
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
/**
 * Snapshot of an inhibitor: one per lane at the base's entrance. While
 * destroyed, the enemy's waves in its lane bring super minions; it rebuilds
 * at respawnAt (game time, seconds).
 */
export interface InhibitorSnapshot {
  entityId: string;
  entityType: EntityType.INHIBITOR;
  side: Side;
  lane: 'top' | 'mid' | 'bot';

  x: number;
  y: number;

  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  /** Game time (seconds) it rebuilds at while destroyed, else null */
  respawnAt: number | null;
  /** Can't be damaged yet (its lane still has a tower standing) */
  isProtected?: boolean;
}

export interface NexusSnapshot {
  entityId: string;
  entityType: EntityType.NEXUS;
  side: Side;

  x: number;
  y: number;

  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  /** Can't be damaged yet (no lane has lost all its towers) */
  isProtected?: boolean;
}

/**
 * Snapshot of a jungle creature for network sync.
 */
export interface JungleCreatureSnapshot {
  entityId: string;
  entityType: EntityType.JUNGLE_CAMP;
  /** Always 2 (neutral): every champion can attack it */
  side: Side;
  campId: string;
  creatureType: string;

  x: number;
  y: number;
  // Clearable values use `| null` for proper delta updates
  targetX?: number | null;
  targetY?: number | null;
  targetEntityId?: string | null;

  health: number;
  maxHealth: number;
  isDead: boolean;

  /** Where it stands while its camp is quiet, and walks back to when it resets */
  homeX: number;
  homeY: number;
  /** While fighting: how far it's pulled from home, as a share of its leash range (it resets past 1); null otherwise */
  leash?: number | null;
  /** While fighting: patience left, 1 to 0 over the seconds since it last hit or was hit (out of reach at 0, it resets); null otherwise */
  patience?: number | null;
  /** Walking home after a reset (it can't be damaged) */
  isReturning?: boolean;
}

/**
 * Snapshot of a ward for network sync.
 */
export interface WardSnapshot {
  entityId: string;
  entityType: EntityType.WARD;
  side: Side;
  wardType: WardType;
  ownerId: string; // Player who placed the ward

  x: number;
  y: number;

  // Ward state
  health: number;
  maxHealth: number;
  isDead: boolean;
  isStealthed: boolean;
  revealsWards: boolean;
  sightRange: number;

  // Remaining time (0 for permanent wards like control)
  remainingDuration: number;
  /** How long it lasts in all (0 for permanent wards) */
  duration?: number;
  /** Seconds since it was placed */
  age?: number;

  // Timestamp when placed (for expiration tracking)
  placedAt: number;
}

/**
 * Snapshot of a trap (e.g. Vile's E) for network sync.
 * Sent as EntityType.WARD for network compatibility; the client tells traps
 * apart from wards by the presence of `triggerRadius`.
 */
export interface TrapSnapshot {
  entityId: string;
  entityType: EntityType.WARD;
  side: Side;
  ownerId: string;

  x: number;
  y: number;

  // Trap state
  isDead: boolean;
  isStealthed: boolean;
  triggerRadius: number;
  remainingDuration: number;
}

/**
 * Snapshot of a zone effect (persistent ground AoE) for network sync.
 */
export interface ZoneSnapshot {
  entityId: string;
  entityType: EntityType.ZONE;
  side: Side;
  sourceId: string;  // Champion who created the zone
  abilityId: string; // Ability that created the zone

  x: number;
  y: number;
  radius: number;

  // Zone state
  remainingDuration: number;
  totalDuration: number;
  isDead: boolean;

  // Visual info
  zoneType: 'damage' | 'slow' | 'heal' | 'buff';
  color?: string;  // Optional color override
}

/**
 * Light Orb state for Lume's passive mechanic.
 */
export type LightOrbState = 'orbiting' | 'traveling' | 'stationed' | 'destroyed';

/**
 * Snapshot of Lume's Light Orb for network sync.
 */
export interface LightOrbSnapshot {
  entityId: string;
  entityType: EntityType.LIGHT_ORB;
  side: Side;
  ownerId: string;  // Lume's champion ID

  // Position
  x: number;
  y: number;

  // State machine
  state: LightOrbState;
  orbitAngle: number;  // Current orbit angle in radians (for smooth client rendering)

  // Timers
  stationedTimeRemaining: number;  // Time left when stationed (0 if not stationed)
  respawnTimeRemaining: number;    // Time until respawn when destroyed (0 if not destroyed)

  // Passive aura info
  auraRadius: number;

  isDead: boolean;
}

/**
 * Union type for all entity snapshots.
 */
export type EntitySnapshot =
  | ChampionSnapshot
  | MinionSnapshot
  | TowerSnapshot
  | ProjectileSnapshot
  | NexusSnapshot
  | InhibitorSnapshot
  | JungleCreatureSnapshot
  | WardSnapshot
  | TrapSnapshot
  | ZoneSnapshot
  | LightOrbSnapshot;

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
  // 3 was BARON_KILLED (there is no baron)
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
  XP_EARNED = 16,
  /** A jungle camp was cleared ({ campId, x, y, respawnAt }) */
  CAMP_CLEARED = 17,
  /** An entity was healed ({ entityId, amount, sourceId }) */
  HEAL = 18,
  /** A summoner spell was cast ({ entityId, spellId, x, y, toX?, toY?, targetId? }; Blink's to is where it landed) */
  SUMMONER_CAST = 19,
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
 * A champion's line on the final scoreboard.
 */
export interface FinalPlayerStats {
  playerId: string;
  championId: string;
  side: number;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  /** Item ids by inventory slot (null for an empty slot) */
  items: (string | null)[];
}

/**
 * GAME_END data: who won, how long it took, and every champion's final stats.
 */
export interface GameEndData {
  winningSide: number;
  /** Seconds */
  duration: number;
  players: FinalPlayerStats[];
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
  /** Event acknowledgment for reliable delivery */
  EVENT_ACK = 3,
}

/**
 * Event acknowledgment message from client.
 */
export interface EventAckMessage {
  /** Last received event ID */
  lastEventId: number;
}
