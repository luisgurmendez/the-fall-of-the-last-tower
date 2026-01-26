/**
 * AnimationScheduler - Server-side animation timing system.
 *
 * Schedules actions (damage, projectiles, effects, sounds) to trigger
 * at specific times based on animation keyframes. This ensures that
 * damage is applied at the correct point in an attack animation, not
 * at the start of the animation.
 *
 * Usage:
 * 1. When starting an animation, call scheduleFromAnimation() with the animation data
 * 2. Each tick, call update() with dt and a callback to handle triggered actions
 * 3. When an animation is interrupted, call cancelForEntity() to clear pending actions
 */

import type { AnimationData, KeyframeTrigger } from '@siege/shared';
import { isProjectileTrigger, isDamageTrigger, isEffectTrigger, isSoundTrigger, isVfxTrigger } from '@siege/shared';

/**
 * Types of actions that can be scheduled.
 */
export type ActionType = 'damage' | 'projectile' | 'effect' | 'sound' | 'vfx';

/**
 * A scheduled action waiting to be triggered.
 */
export interface ScheduledAction {
  /** ID of the entity performing the action */
  entityId: string;
  /** Type of action to perform */
  actionType: ActionType;
  /** Time (in seconds from schedule) when action should trigger */
  triggerTime: number;
  /** Additional data for the action handler */
  data: Record<string, unknown>;
  /** Original keyframe trigger (if from animation) */
  trigger?: KeyframeTrigger;
}

/**
 * Internal representation of a pending action.
 */
interface PendingAction extends ScheduledAction {
  /** Absolute time when this action was scheduled */
  scheduledAt: number;
}

/**
 * Callback for handling triggered actions.
 */
export type ActionCallback = (action: ScheduledAction) => void;

/**
 * Animation scheduling system.
 *
 * Maintains a queue of pending actions and triggers them
 * when their scheduled time arrives.
 */
export class AnimationScheduler {
  /** Current accumulated time */
  private currentTime: number = 0;

  /** Pending actions sorted by trigger time */
  private pendingActions: PendingAction[] = [];

  /**
   * Schedule an action to trigger at a specific time from now.
   */
  schedule(action: ScheduledAction): void {
    const pending: PendingAction = {
      ...action,
      scheduledAt: this.currentTime,
    };

    // Insert in sorted order by absolute trigger time
    const absoluteTime = this.currentTime + action.triggerTime;
    let insertIndex = this.pendingActions.length;

    for (let i = 0; i < this.pendingActions.length; i++) {
      const existingAbsoluteTime = this.pendingActions[i].scheduledAt + this.pendingActions[i].triggerTime;
      if (absoluteTime < existingAbsoluteTime) {
        insertIndex = i;
        break;
      }
    }

    this.pendingActions.splice(insertIndex, 0, pending);
  }

  /**
   * Schedule actions from animation keyframes.
   *
   * @param entityId - Entity performing the animation
   * @param animation - Animation data with keyframes
   * @param speed - Animation playback speed (1.0 = normal, 2.0 = twice as fast)
   * @param additionalData - Extra data to include with each action
   */
  scheduleFromAnimation(
    entityId: string,
    animation: AnimationData,
    speed: number = 1.0,
    additionalData: Record<string, unknown> = {}
  ): void {
    for (const keyframe of animation.keyframes) {
      // Calculate trigger time: frame * baseFrameDuration / speed
      const triggerTime = (keyframe.frame * animation.baseFrameDuration) / speed;

      // Determine action type from trigger
      let actionType: ActionType;
      let data: Record<string, unknown> = { ...additionalData };

      if (isDamageTrigger(keyframe.trigger)) {
        actionType = 'damage';
      } else if (isProjectileTrigger(keyframe.trigger)) {
        actionType = 'projectile';
      } else if (isEffectTrigger(keyframe.trigger)) {
        actionType = 'effect';
        data.effectId = keyframe.trigger.effectId;
      } else if (isSoundTrigger(keyframe.trigger)) {
        actionType = 'sound';
        data.soundId = keyframe.trigger.soundId;
      } else if (isVfxTrigger(keyframe.trigger)) {
        actionType = 'vfx';
        data.vfxId = keyframe.trigger.vfxId;
      } else {
        // Unknown trigger type, skip
        continue;
      }

      this.schedule({
        entityId,
        actionType,
        triggerTime,
        data,
        trigger: keyframe.trigger,
      });
    }
  }

  /**
   * Update the scheduler and trigger any due actions.
   *
   * @param dt - Time delta in seconds
   * @param callback - Called for each triggered action
   */
  update(dt: number, callback: ActionCallback): void {
    this.currentTime += dt;

    // Process actions in order
    while (this.pendingActions.length > 0) {
      const action = this.pendingActions[0];
      const absoluteTriggerTime = action.scheduledAt + action.triggerTime;

      if (this.currentTime >= absoluteTriggerTime) {
        // Remove and trigger
        this.pendingActions.shift();
        callback(action);
      } else {
        // No more actions ready
        break;
      }
    }
  }

  /**
   * Cancel all pending actions for an entity.
   *
   * @param entityId - Entity whose actions to cancel
   * @param actionType - Optional: only cancel specific action type
   */
  cancelForEntity(entityId: string, actionType?: ActionType): void {
    this.pendingActions = this.pendingActions.filter(action => {
      if (action.entityId !== entityId) return true;
      if (actionType && action.actionType !== actionType) return true;
      return false;
    });
  }

  /**
   * Get count of pending actions.
   */
  getPendingCount(): number {
    return this.pendingActions.length;
  }

  /**
   * Get pending actions for an entity.
   */
  getPendingForEntity(entityId: string): ScheduledAction[] {
    return this.pendingActions.filter(a => a.entityId === entityId);
  }

  /**
   * Clear all pending actions.
   */
  clear(): void {
    this.pendingActions = [];
  }

  /**
   * Reset scheduler state (clears time and actions).
   */
  reset(): void {
    this.currentTime = 0;
    this.pendingActions = [];
  }
}

/**
 * Create a new animation scheduler instance.
 */
export function createAnimationScheduler(): AnimationScheduler {
  return new AnimationScheduler();
}
