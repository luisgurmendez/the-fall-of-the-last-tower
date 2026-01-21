/**
 * Champions module exports.
 */

export { Champion, default } from './Champion';

export type {
  ChampionClass,
  AttackType,
  ResourceType,
  ChampionBaseStats,
  ChampionGrowthStats,
  ChampionStats,
  StatModifier,
  ChampionDefinition,
  ChampionState,
} from './types';

export {
  LEVEL_EXPERIENCE,
  calculateStat,
  calculateAttackSpeed,
} from './types';
