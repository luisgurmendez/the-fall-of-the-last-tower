/**
 * TargetingPolicy - Strategy pattern for champion basic attack targeting behavior.
 *
 * This allows flexible configuration of how champions acquire and maintain
 * basic attack targets. Different policies can be used for:
 * - Player-controlled champions (manual targeting)
 * - AI-controlled champions (auto-targeting)
 * - Special game modes or abilities
 *
 * @example
 * // Player champion with manual targeting
 * champion.setTargetingPolicy(new ManualTargetingPolicy());
 *
 * // AI champion with auto-targeting
 * champion.setTargetingPolicy(new AutoTargetingPolicy());
 */

import type { Champion } from '@/champions/Champion';
import type GameContext from '@/core/gameContext';

/**
 * Interface for targeting behavior strategies.
 */
export interface TargetingPolicy {
  /**
   * Unique identifier for this policy type.
   */
  readonly id: string;

  /**
   * Whether this policy automatically finds targets.
   */
  readonly autoTargets: boolean;

  /**
   * Called when the champion receives a move command.
   * Policies can decide whether to clear the attack target.
   *
   * @param champion - The champion receiving the move command
   * @returns Whether the attack target should be cleared
   */
  onMoveCommand(champion: Champion): boolean;

  /**
   * Called when the champion receives an explicit attack command on a target.
   *
   * @param champion - The champion receiving the attack command
   * @param target - The target to attack
   */
  onAttackCommand(champion: Champion, target: Champion): void;

  /**
   * Called each frame to update targeting state.
   * Auto-targeting policies use this to find new targets.
   *
   * @param champion - The champion to update
   * @param gctx - The game context
   */
  update(champion: Champion, gctx: GameContext): void;

  /**
   * Called when the current target becomes invalid (dead, untargetable, etc.)
   *
   * @param champion - The champion whose target became invalid
   * @param gctx - The game context
   */
  onTargetInvalid(champion: Champion, gctx: GameContext): void;
}

/**
 * Manual targeting policy - attack target is only set by explicit player commands.
 *
 * Behavior:
 * - Move commands clear the attack target
 * - Attack target is only set when player right-clicks on an enemy
 * - No automatic target acquisition
 * - When target dies, attack stops (no auto-retarget)
 */
export class ManualTargetingPolicy implements TargetingPolicy {
  readonly id = 'manual';
  readonly autoTargets = false;

  /**
   * Whether to clear attack target on move command.
   * Can be configured for different behaviors.
   */
  private clearOnMove: boolean;

  constructor(options: { clearOnMove?: boolean } = {}) {
    this.clearOnMove = options.clearOnMove ?? true;
  }

  onMoveCommand(_champion: Champion): boolean {
    // Return whether to clear the attack target
    return this.clearOnMove;
  }

  onAttackCommand(champion: Champion, target: Champion): void {
    // Set the target when explicitly commanded
    champion.setBasicAttackTarget(target);
    // Clear move target to focus on attacking
    champion.setTargetPosition(null);
  }

  update(_champion: Champion, _gctx: GameContext): void {
    // Manual targeting doesn't auto-update targets
  }

  onTargetInvalid(champion: Champion, _gctx: GameContext): void {
    // When target becomes invalid, just clear it (no auto-retarget)
    champion.setBasicAttackTarget(null);
  }
}

/**
 * Auto targeting policy - automatically finds and attacks nearby enemies.
 *
 * Behavior:
 * - Automatically finds nearest enemy within range
 * - Re-targets when current target dies
 * - Move commands temporarily clear target (optional)
 * - Used for AI-controlled champions
 */
export class AutoTargetingPolicy implements TargetingPolicy {
  readonly id: string = 'auto';
  readonly autoTargets = true;

  /**
   * Multiplier for search range (relative to attack range).
   */
  private searchRangeMultiplier: number;

  /**
   * Whether to clear attack target on move command.
   */
  private clearOnMove: boolean;

  constructor(options: { searchRangeMultiplier?: number; clearOnMove?: boolean } = {}) {
    this.searchRangeMultiplier = options.searchRangeMultiplier ?? 2;
    this.clearOnMove = options.clearOnMove ?? false;
  }

  onMoveCommand(_champion: Champion): boolean {
    return this.clearOnMove;
  }

  onAttackCommand(champion: Champion, target: Champion): void {
    champion.setBasicAttackTarget(target);
    champion.setTargetPosition(null);
  }

  update(champion: Champion, gctx: GameContext): void {
    // If no target or current target is invalid, find a new one
    const currentTarget = champion.getBasicAttackTarget();
    if (!currentTarget || currentTarget.isDead()) {
      this.findNewTarget(champion, gctx);
    }
  }

  onTargetInvalid(champion: Champion, gctx: GameContext): void {
    // Auto-retarget when target becomes invalid
    this.findNewTarget(champion, gctx);
  }

  /**
   * Find a new target within range.
   */
  private findNewTarget(champion: Champion, gctx: GameContext): void {
    const spatialHashing = gctx.spatialHashing;
    if (!spatialHashing) return;

    const stats = champion.getStats();
    const searchRange = stats.attackRange * this.searchRangeMultiplier;
    const position = champion.getPosition();
    const side = champion.getSide();

    const nearbyObjects = spatialHashing.queryInRange(position, searchRange);

    let nearestEnemy: Champion | null = null;
    let nearestDistance = Infinity;

    for (const obj of nearbyObjects) {
      // Check if it's a valid enemy champion
      if (this.isValidTarget(obj, side)) {
        const distance = position.distanceTo(obj.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestEnemy = obj as Champion;
        }
      }
    }

    champion.setBasicAttackTarget(nearestEnemy);
  }

  /**
   * Check if an object is a valid target.
   */
  private isValidTarget(obj: unknown, side: number): boolean {
    // Import Champion dynamically to avoid circular dependency
    const isChampion = obj && typeof obj === 'object' && 'getSide' in obj && 'isDead' in obj;
    if (!isChampion) return false;

    const target = obj as Champion;
    return target.getSide() !== side && !target.isDead();
  }
}

/**
 * Aggressive auto-targeting policy - always attacks nearest enemy.
 *
 * Similar to AutoTargetingPolicy but:
 * - Larger search range
 * - Move commands don't clear target
 * - More aggressive re-targeting
 */
export class AggressiveTargetingPolicy extends AutoTargetingPolicy {
  override readonly id: string = 'aggressive';

  constructor() {
    super({ searchRangeMultiplier: 3, clearOnMove: false });
  }
}

/**
 * Passive targeting policy - only attacks when attacked.
 *
 * Behavior:
 * - No auto-targeting
 * - Can still be given explicit attack commands
 * - Useful for defensive/support champions
 */
export class PassiveTargetingPolicy implements TargetingPolicy {
  readonly id = 'passive';
  readonly autoTargets = false;

  onMoveCommand(_champion: Champion): boolean {
    return true;
  }

  onAttackCommand(champion: Champion, target: Champion): void {
    champion.setBasicAttackTarget(target);
    champion.setTargetPosition(null);
  }

  update(_champion: Champion, _gctx: GameContext): void {
    // Passive targeting doesn't auto-update
  }

  onTargetInvalid(champion: Champion, _gctx: GameContext): void {
    champion.setBasicAttackTarget(null);
  }

  /**
   * Called when this champion is attacked.
   * Can be used to implement retaliation behavior.
   */
  onAttacked(champion: Champion, attacker: Champion): void {
    // Optionally set attacker as target (retaliation)
    if (!champion.getBasicAttackTarget()) {
      champion.setBasicAttackTarget(attacker);
    }
  }
}

// Default policies for easy access
export const DEFAULT_PLAYER_POLICY = new ManualTargetingPolicy();
export const DEFAULT_AI_POLICY = new AutoTargetingPolicy();
