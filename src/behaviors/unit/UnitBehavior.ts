/**
 * UnitBehavior - Interface for deterministic AI behaviors that control unit actions.
 *
 * Behaviors are responsible for:
 * - Deciding where the unit should move
 * - Selecting targets
 * - Deciding when to attack
 *
 * Behaviors are swappable at runtime, allowing units to change their AI strategy.
 */

import type Vector from '@/physics/vector';
import type GameContext from '@/core/gameContext';
import type { Target } from '@/objects/army/types';
import type { TeamId } from '@/core/Team';

/**
 * Context passed to behaviors each frame.
 * Contains all information needed for decision-making.
 */
export interface BehaviorContext {
  /** The game context for accessing world state */
  gameContext: GameContext;

  /** Delta time for this frame */
  dt: number;

  /** Unit's current position */
  position: Vector;

  /** Unit's current direction */
  direction: Vector;

  /** Unit's team */
  teamId: TeamId;

  /** Current target (if any) */
  currentTarget: Target | null;

  /** Current target position (if manually set) */
  currentTargetPosition: Vector | null;

  /** Unit's attack range */
  attackRange: number;

  /** Unit's sight range */
  sightRange: number;

  /** Whether the unit can currently attack (not on cooldown) */
  canAttack: boolean;

  /** Whether the unit is currently attacking (in attack animation) */
  isAttacking: boolean;

  /** Whether the target was set by player command */
  targetSetByPlayer: boolean;
}

/**
 * Result of behavior update - tells the unit what to do.
 */
export interface BehaviorDecision {
  /**
   * Movement decision.
   * - 'move_to_target': Move towards the current target
   * - 'move_to_position': Move towards a specific position
   * - 'flee_from_target': Move away from the current target
   * - 'hold': Stop and hold position
   * - 'patrol': Follow patrol path (if set)
   */
  movement: 'move_to_target' | 'move_to_position' | 'flee_from_target' | 'hold' | 'patrol';

  /** Target position for 'move_to_position' movement */
  moveToPosition?: Vector;

  /**
   * Target selection decision.
   * - 'keep': Keep current target
   * - 'clear': Clear current target
   * - 'acquire': Try to acquire a new target from nearby enemies
   * - 'set': Set a specific target
   */
  targeting: 'keep' | 'clear' | 'acquire' | 'set';

  /** Specific target to set when targeting is 'set' */
  newTarget?: Target;

  /**
   * Attack decision.
   * - true: Attack if in range and able
   * - false: Do not attack
   */
  shouldAttack: boolean;

  /**
   * Direction to face (optional).
   * If not provided, unit will face movement direction.
   */
  faceDirection?: Vector;
}

/**
 * Interface for unit AI behaviors.
 * Implementations define how a unit behaves each frame.
 */
export interface UnitBehavior {
  /** Unique identifier for this behavior type */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /**
   * Update the behavior and return a decision.
   * Called every frame for each unit with this behavior.
   *
   * @param context - Current state of the unit and game
   * @returns Decision on what the unit should do this frame
   */
  update(context: BehaviorContext): BehaviorDecision;

  /**
   * Called when this behavior is attached to a unit.
   * Use for initialization.
   */
  onAttach?(): void;

  /**
   * Called when this behavior is detached from a unit.
   * Use for cleanup.
   */
  onDetach?(): void;

  /**
   * Reset behavior state.
   * Called when the unit needs to reset (e.g., respawn).
   */
  reset?(): void;
}

/**
 * Factory function type for creating behaviors.
 */
export type BehaviorFactory = () => UnitBehavior;

/**
 * Registry of available behaviors by ID.
 */
const behaviorRegistry: Map<string, BehaviorFactory> = new Map();

/**
 * Register a behavior factory.
 */
export function registerBehavior(id: string, factory: BehaviorFactory): void {
  behaviorRegistry.set(id, factory);
}

/**
 * Create a behavior by ID.
 */
export function createBehavior(id: string): UnitBehavior | null {
  const factory = behaviorRegistry.get(id);
  return factory ? factory() : null;
}

/**
 * Get all registered behavior IDs.
 */
export function getRegisteredBehaviors(): string[] {
  return Array.from(behaviorRegistry.keys());
}

export default UnitBehavior;
