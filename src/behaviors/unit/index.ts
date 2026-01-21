/**
 * Unit Behavior System
 *
 * Exports all behavior types and utilities for controlling unit AI.
 */

// Core interface and types
export type {
  UnitBehavior,
  BehaviorContext,
  BehaviorDecision,
  BehaviorFactory,
} from './UnitBehavior';

export {
  registerBehavior,
  createBehavior,
  getRegisteredBehaviors,
} from './UnitBehavior';

// Behavior implementations
export { DummyBehavior, DUMMY_BEHAVIOR_ID } from './DummyBehavior';
export { AggressiveBehavior, AGGRESSIVE_BEHAVIOR_ID } from './AggressiveBehavior';
