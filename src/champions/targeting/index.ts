/**
 * Targeting system for champion basic attacks.
 */

export type { TargetingPolicy } from './TargetingPolicy';
export {
  ManualTargetingPolicy,
  AutoTargetingPolicy,
  AggressiveTargetingPolicy,
  PassiveTargetingPolicy,
  DEFAULT_PLAYER_POLICY,
  DEFAULT_AI_POLICY,
} from './TargetingPolicy';
