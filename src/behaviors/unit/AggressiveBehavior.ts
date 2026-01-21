/**
 * AggressiveBehavior - Active combat behavior that seeks and attacks enemies.
 *
 * The unit will:
 * - Acquire nearby enemy targets automatically
 * - Move towards targets to attack
 * - Attack when in range
 * - Chase targets within sight range
 * - Enemy units (side 1) will target the castle if no enemies nearby
 *
 * This is the default behavior for combat units like Swordsman and Archer.
 */

import {
  UnitBehavior,
  BehaviorContext,
  BehaviorDecision,
  registerBehavior,
} from './UnitBehavior';
import { isDisposable } from '@/behaviors/disposable';
import { isAttackable } from '@/behaviors/attackable';
import { enemyFilter, TEAM } from '@/core/Team';
import RandomUtils from '@/utils/random';
import { CASTLE_ID } from '@/objects/castle/castle';
import { Target } from '@/objects/army/types';

export const AGGRESSIVE_BEHAVIOR_ID = 'aggressive';

export class AggressiveBehavior implements UnitBehavior {
  readonly id = AGGRESSIVE_BEHAVIOR_ID;
  readonly name = 'Aggressive';

  update(context: BehaviorContext): BehaviorDecision {
    const {
      gameContext,
      position,
      teamId,
      currentTarget,
      currentTargetPosition,
      attackRange,
      sightRange,
      canAttack,
      isAttacking,
      targetSetByPlayer,
    } = context;

    const { spatialHashing, castle } = gameContext;

    // Default decision
    let decision: BehaviorDecision = {
      movement: 'hold',
      targeting: 'keep',
      shouldAttack: false,
    };

    // ============================================
    // STEP 1: Validate and fix current target
    // ============================================
    let target = currentTarget;
    let shouldClearTarget = false;

    if (target) {
      // Clear target if it's disposed
      if (isDisposable(target) && target.shouldDispose) {
        shouldClearTarget = true;
      }
      // Clear target if it's the castle (units take priority)
      else if (target.id === CASTLE_ID) {
        shouldClearTarget = true;
      }
      // Clear target if out of sight range (unless player set it)
      else if (!targetSetByPlayer && target.position.distanceTo(position) > sightRange) {
        shouldClearTarget = true;
      }
    }

    // ============================================
    // STEP 2: Handle target position (player command)
    // ============================================
    if (currentTargetPosition) {
      const distToTargetPos = currentTargetPosition.distanceTo(position);

      // If we've reached the target position, signal to clear it
      if (distToTargetPos < 10) {
        // Target position reached - unit should clear it
        // (The unit handles clearing the position)
        decision.movement = 'hold';
        decision.targeting = 'acquire';
      } else {
        // Move to target position
        decision.movement = 'move_to_position';
        decision.moveToPosition = currentTargetPosition;
        decision.targeting = 'clear';
        return decision;
      }
    }

    // ============================================
    // STEP 3: Acquire new target if needed
    // ============================================
    if (shouldClearTarget || !target) {
      // Look for nearby enemies using the Team system's enemy filter
      const nearByObjs = spatialHashing.queryInRange(position, sightRange / 2);
      const nearByEnemies = nearByObjs
        .filter((obj): obj is Target & { getTeamId(): number } => {
          // Filter objects that have getTeamId method and are enemies
          if (typeof (obj as any).getTeamId === 'function') {
            return enemyFilter(teamId)({ getTeamId: () => (obj as any).getTeamId() });
          }
          // Fallback for objects with 'side' property (backwards compat)
          if (typeof (obj as any).side === 'number') {
            return (obj as any).side !== teamId;
          }
          return false;
        })
        .filter(isAttackable);

      if (nearByEnemies.length > 0) {
        // Found enemies - pick one
        const newTarget = RandomUtils.getRandomValueOf(nearByEnemies) as Target;
        decision.targeting = 'set';
        decision.newTarget = newTarget;
        target = newTarget;
      } else if (teamId === TEAM.ENEMY && castle) {
        // Enemy units target castle if no other enemies
        decision.targeting = 'set';
        decision.newTarget = castle as unknown as Target;
        target = castle as unknown as Target;
      } else {
        decision.targeting = 'clear';
        target = null;
      }
    }

    // ============================================
    // STEP 4: Movement decision based on target
    // ============================================
    if (target && !isAttacking) {
      const distanceToTarget = target.position.distanceTo(position);
      const comfortRange = attackRange + 10;

      if (distanceToTarget < attackRange) {
        // Too close - back away slightly (mainly for ranged units)
        decision.movement = 'flee_from_target';
      } else if (distanceToTarget <= comfortRange) {
        // In comfort zone - hold position
        decision.movement = 'hold';
      } else {
        // Too far - move closer
        decision.movement = 'move_to_target';
      }
    } else if (!target) {
      decision.movement = 'hold';
    }

    // ============================================
    // STEP 5: Attack decision
    // ============================================
    if (target && canAttack && !isAttacking) {
      const distanceToTarget = target.position.distanceTo(position);
      // Include target's collision mask in range calculation
      const effectiveRange = attackRange + (target.collisionMask?.maxDistanceToCenter ?? 0);

      if (distanceToTarget < effectiveRange) {
        decision.shouldAttack = true;
      }
    }

    return decision;
  }

  onAttach(): void {
    // Nothing to initialize
  }

  onDetach(): void {
    // Nothing to clean up
  }

  reset(): void {
    // Nothing to reset
  }
}

// Register the behavior
registerBehavior(AGGRESSIVE_BEHAVIOR_ID, () => new AggressiveBehavior());

export default AggressiveBehavior;
