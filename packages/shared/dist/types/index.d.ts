/**
 * Type definitions shared between client and server.
 */
export type { Side, UnitType, DamageType, Targetable, Damageable, Sided, AttackTarget, Point, Dimensions, BoundingBox, } from './units';
export { TEAM_BLUE, TEAM_RED, isSided, isTargetable, isDamageable, oppositeSide, } from './units';
export type { ChampionClass, AttackType, ResourceType, ChampionBaseStats, ChampionGrowthStats, ChampionStats, StatModifier, ChampionDefinition, ChampionState, } from './champions';
export { LEVEL_EXPERIENCE, calculateStat, calculateAttackSpeed, calculateStatsAtLevel, } from './champions';
export type { EffectCategory, CrowdControlType, StatModificationType, OverTimeType, StackBehavior, EffectDefinition, CrowdControlEffectDef, StatModificationEffectDef, OverTimeEffectDef, ShieldEffectDef, ActiveEffectState, CrowdControlStatus, } from './effects';
export { computeCCStatus, defaultCCStatus, } from './effects';
export type { AbilitySlot, AbilityType, AbilityTargetType, AbilityShape, PassiveTrigger, AbilityScaling, AbilityDefinition, AbilityState, AbilityCastResult, AbilityAIConditions, } from './abilities';
export { calculateAbilityValue, } from './abilities';
export type { ItemSlot, ItemCategory, ItemPassiveTrigger, ItemPassiveDef, ItemDefinition, EquippedItemState, InventoryState, ItemPurchaseResult, ItemSellResult, } from './items';
export { calculateItemStats, findEmptySlot, hasItem, } from './items';
export type { InputMessage, MoveInput, TargetUnitInput, StopInput, AbilityInput, LevelUpInput, BuyItemInput, SellItemInput, RecallInput, PingInput, ClientInput, ChampionSnapshot, MinionSnapshot, TowerSnapshot, ProjectileSnapshot, EntitySnapshot, EntityDelta, GameEvent, StateUpdate, FullStateSnapshot, } from './network';
export { InputType, EntityType, EntityChangeMask, GameEventType, ServerMessageType, ClientMessageType, } from './network';
//# sourceMappingURL=index.d.ts.map