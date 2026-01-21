/**
 * Abilities module exports.
 */

export { default as Ability } from './Ability';
export { default as PassiveAbility } from './PassiveAbility';
export { default as ActiveAbility } from './ActiveAbility';

export type {
  AbilitySlot,
  AbilityType,
  AbilityTargetType,
  AbilityShape,
  DamageType,
  PassiveTrigger,
  AbilityCastContext,
  AbilityCastResult,
  AbilityScaling,
  AbilityDefinition,
  AbilityState,
  AbilityAIConditions,
} from './types';
