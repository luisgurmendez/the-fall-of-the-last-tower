/**
 * Effects module exports.
 */

export { default as Effect, createActiveEffect } from './Effect';
export { default as EffectManager, getEffectManager } from './EffectManager';

export type {
  EffectCategory,
  CrowdControlType,
  StatModificationType,
  OverTimeType,
  StackBehavior,
  EffectDefinition,
  CrowdControlEffect,
  StatModificationEffect,
  OverTimeEffect,
  ShieldEffect,
  ActiveEffect,
  CrowdControlStatus,
} from './types';

export { computeCCStatus } from './types';

// Effect display registry for HUD
export {
  getEffectDisplayInfo,
  getAllEffectDisplayInfo,
  isKnownEffect,
} from './EffectDisplayRegistry';
export type { EffectDisplayInfo } from './EffectDisplayRegistry';
