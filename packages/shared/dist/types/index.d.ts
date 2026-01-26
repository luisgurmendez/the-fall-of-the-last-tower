/**
 * Type definitions shared between client and server.
 */
export type { Side, UnitType, DamageType, Targetable, Damageable, Sided, AttackTarget, Point, Dimensions, BoundingBox, } from './units';
export { TEAM_BLUE, TEAM_RED, isSided, isTargetable, isDamageable, oppositeSide, } from './units';
export type { ChampionClass, AttackType, ResourceType, ChampionBaseStats, ChampionGrowthStats, ChampionStats, StatModifier, ChampionDefinition, ChampionState, } from './champions';
export { LEVEL_EXPERIENCE, calculateStat, calculateAttackSpeed, calculateStatsAtLevel, } from './champions';
export type { EffectCategory, CrowdControlType, StatModificationType, OverTimeType, StackBehavior, EffectDefinition, CrowdControlEffectDef, StatModificationEffectDef, OverTimeEffectDef, ShieldEffectDef, ActiveEffectState, CrowdControlStatus, } from './effects';
export { computeCCStatus, defaultCCStatus, } from './effects';
export type { AbilitySlot, AbilityType, AbilityTargetType, AbilityShape, PassiveTrigger, AbilityScaling, AbilityDefinition, AbilityState, AbilityCastResult, AbilityAIConditions, PassiveStatModifier, PassiveAbilityDefinition, PassiveState, } from './abilities';
export { calculateAbilityValue, getPassiveLevelValue, canAbilityAffectEntityType, AbilityEntityType, } from './abilities';
export type { ItemSlot, ItemCategory, ItemPassiveTrigger, ItemPassiveDef, ItemDefinition, EquippedItemState, InventoryState, ItemPurchaseResult, ItemSellResult, } from './items';
export { calculateItemStats, findEmptySlot, hasItem, } from './items';
export type { InputMessage, MoveInput, TargetUnitInput, StopInput, AbilityInput, LevelUpInput, BuyItemInput, SellItemInput, RecallInput, PingInput, PlaceWardInput, WardType, ClientInput, PassiveStateSnapshot, ShieldType, ShieldSnapshot, ChampionSnapshot, MinionSnapshot, TowerSnapshot, ProjectileSnapshot, NexusSnapshot, JungleCreatureSnapshot, WardSnapshot, ZoneSnapshot, EntitySnapshot, EntityDelta, GameEvent, StateUpdate, FullStateSnapshot, } from './network';
export { InputType, EntityType, EntityChangeMask, GameEventType, ServerMessageType, ClientMessageType, } from './network';
export type { MinionType, LaneId, MinionStats, WaveComposition, MinionConfig, } from './minions';
export { DEFAULT_MINION_STATS, DEFAULT_MINION_WAVE_CONFIG, } from './minions';
export type { TowerTier, TowerLane, TowerStats, TowerReward, InhibitorStats, NexusStats, } from './structures';
export { DEFAULT_TOWER_STATS, DEFAULT_TOWER_REWARDS, DEFAULT_INHIBITOR_STATS, DEFAULT_NEXUS_STATS, TowerTargetPriority, } from './structures';
export type { Vector2D, CollisionBounds, BaseCollisionShape, CircleCollision, RectangleCollision, CapsuleCollision, EntityCollision, } from './collision';
export { isCircleCollision, isRectangleCollision, isCapsuleCollision, getCollisionBounds, getEffectiveRadius, getCollisionCenter, collisionShapesOverlap, calculateCollisionSeparation, DEFAULT_CHAMPION_COLLISION, DEFAULT_MINION_COLLISION, DEFAULT_TOWER_COLLISION, } from './collision';
export type { DamageTrigger, ProjectileTrigger, EffectTrigger, SoundTrigger, VfxTrigger, KeyframeTrigger, AnimationKeyframe, AnimationData, EntityAnimations, ChampionAnimations, AnimationPlayback, } from './animation';
export { isDamageTrigger, isProjectileTrigger, isEffectTrigger, isSoundTrigger, isVfxTrigger, calculateAnimationPlayback, getTriggerTime, getKeyframeAtTime, getKeyframesInRange, scaleAnimationSpeed, getFrameAtTime, isAnimationComplete, getAttackAnimationSpeed, getAttackAnimationDuration, createDefaultAttackAnimation, createDefaultIdleAnimation, createDefaultWalkAnimation, } from './animation';
//# sourceMappingURL=index.d.ts.map