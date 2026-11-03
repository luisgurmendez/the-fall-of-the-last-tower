/**
 * Type definitions shared between client and server.
 */

// Unit types
export type {
  Side,
  UnitType,
  DamageType,
  Targetable,
  Damageable,
  Sided,
  AttackTarget,
  Point,
  Dimensions,
  BoundingBox,
} from './units';
export {
  TEAM_BLUE,
  TEAM_RED,
  isSided,
  isTargetable,
  isDamageable,
  oppositeSide,
} from './units';

// Champion types
export type {
  ChampionClass,
  AttackType,
  ResourceType,
  ChampionBaseStats,
  ChampionGrowthStats,
  ChampionStats,
  ItemCombatStats,
  FullChampionStats,
  StatModifier,
  ChampionDefinition,
  ChampionState,
} from './champions';
export {
  LEVEL_EXPERIENCE,
  getExperienceToNextLevel,
  getBasicAttackDuration,
  getBasicAttackDamageDelay,
  calculateStat,
  calculateAttackSpeed,
  calculateStatsAtLevel,
  calculateCDR,
  calculateEffectiveCooldown,
} from './champions';

// Effect types
export type {
  EffectCategory,
  CrowdControlType,
  StatModificationType,
  OverTimeType,
  StackBehavior,
  EffectDefinition,
  CrowdControlEffectDef,
  StatModificationEffectDef,
  OverTimeEffectDef,
  ShieldEffectDef,
  ActiveEffectState,
  CrowdControlStatus,
} from './effects';
export {
  computeCCStatus,
  defaultCCStatus,
} from './effects';

// Ability types
export type {
  AbilitySlot,
  AbilityType,
  AbilityTargetType,
  AbilityShape,
  PassiveTrigger,
  AbilityScaling,
  AbilityDefinition,
  AbilityState,
  AbilityCastResult,
  AbilityAIConditions,
  PassiveStatModifier,
  PassiveAbilityDefinition,
  PassiveState,
} from './abilities';
export {
  calculateAbilityValue,
  getPassiveLevelValue,
  canAbilityAffectEntityType,
  AbilityEntityType,
  hasRecastBehavior,
  getCastTime,
  DEFAULT_CAST_TIME,
  getRecastAbility,
  hasChargeBehavior,
} from './abilities';

// Item types
export type {
  ItemSlot,
  ItemCategory,
  ItemTier,
  ItemGroup,
  ItemStats,
  ItemPassiveTrigger,
  ItemPassiveDef,
  ItemDefinition,
  EquippedItemState,
  InventoryState,
  ItemPurchaseResult,
  ItemSellResult,
} from './items';
export {
  calculateItemStats,
  findEmptySlot,
  hasItem,
} from './items';

// Network types
export type {
  InputMessage,
  MoveInput,
  TargetUnitInput,
  StopInput,
  AbilityInput,
  LevelUpInput,
  BuyItemInput,
  SellItemInput,
  RecallInput,
  PingInput,
  PingType,
  EmoteInput,
  EmoteId,
  PlaceWardInput,
  SummonerSpellInput,
  UseItemInput,
  SummonerSpellState,
  SurrenderInput,
  WardType,
  ClientInput,
  PassiveStateSnapshot,
  ShieldType,
  ShieldSnapshot,
  ChampionSnapshot,
  MinionSnapshot,
  TowerSnapshot,
  ProjectileSnapshot,
  NexusSnapshot,
  InhibitorSnapshot,
  JungleCreatureSnapshot,
  WardSnapshot,
  TrapSnapshot,
  ZoneSnapshot,
  LightOrbState,
  LightOrbSnapshot,
  BlossomSnapshot,
  EntitySnapshot,
  EntityDelta,
  GameEvent,
  StateUpdate,
  FullStateSnapshot,
  FinalPlayerStats,
  ChampionMatchTotals,
  GameEndData,
  DebugUnit,
  DebugStateData,
  LobbyMember,
  LobbyState,
  LobbyRequest,
} from './network';
export {
  InputType,
  EntityType,
  EntityChangeMask,
  GameEventType,
  ServerMessageType,
  ClientMessageType,
  LOBBY_MAX_TEAM_SIZE,
  PING_TYPES,
  EMOTES,
} from './network';

// Minion types
export type {
  MinionType,
  LaneId,
  MinionStats,
  WaveComposition,
  MinionConfig,
} from './minions';
export {
  DEFAULT_MINION_STATS,
  DEFAULT_MINION_WAVE_CONFIG,
} from './minions';

// Structure types
export type {
  TowerTier,
  TowerLane,
  TowerStats,
  TowerReward,
  InhibitorStats,
  NexusStats,
} from './structures';
export {
  DEFAULT_TOWER_STATS,
  DEFAULT_TOWER_REWARDS,
  DEFAULT_INHIBITOR_STATS,
  DEFAULT_NEXUS_STATS,
  TowerTargetPriority,
} from './structures';

// Collision types
export type {
  Vector2D,
  CollisionBounds,
  BaseCollisionShape,
  CircleCollision,
  RectangleCollision,
  CapsuleCollision,
  EntityCollision,
} from './collision';
export {
  isCircleCollision,
  isRectangleCollision,
  isCapsuleCollision,
  getCollisionBounds,
  getEffectiveRadius,
  getCollisionCenter,
  collisionShapesOverlap,
  calculateCollisionSeparation,
  DEFAULT_CHAMPION_COLLISION,
  DEFAULT_MINION_COLLISION,
  DEFAULT_TOWER_COLLISION,
} from './collision';

// Animation types
export type {
  DamageTrigger,
  ProjectileTrigger,
  EffectTrigger,
  SoundTrigger,
  VfxTrigger,
  KeyframeTrigger,
  AnimationKeyframe,
  AnimationData,
  EntityAnimations,
  ChampionAnimations,
  AnimationPlayback,
} from './animation';
export {
  isDamageTrigger,
  isProjectileTrigger,
  isEffectTrigger,
  isSoundTrigger,
  isVfxTrigger,
  calculateAnimationPlayback,
  getTriggerTime,
  getKeyframeAtTime,
  getKeyframesInRange,
  scaleAnimationSpeed,
  getFrameAtTime,
  isAnimationComplete,
  getAttackAnimationSpeed,
  getAttackAnimationDuration,
  createDefaultAttackAnimation,
  createDefaultIdleAnimation,
  createDefaultWalkAnimation,
} from './animation';
