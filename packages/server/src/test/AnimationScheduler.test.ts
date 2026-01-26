/**
 * AnimationScheduler Tests
 *
 * Tests for the animation scheduling system that triggers actions
 * (damage, projectiles, effects) at keyframe times.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { AnimationScheduler, ScheduledAction, ActionType } from '../systems/AnimationScheduler';
import type { AnimationData, KeyframeTrigger } from '@siege/shared';

describe('AnimationScheduler', () => {
  let scheduler: AnimationScheduler;

  beforeEach(() => {
    scheduler = new AnimationScheduler();
  });

  describe('Scheduling Actions', () => {
    test('should schedule a single action', () => {
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.5,
        data: { targetId: 'enemy_1', amount: 100 },
      });

      expect(scheduler.getPendingCount()).toBe(1);
    });

    test('should schedule multiple actions for same entity', () => {
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.3,
        data: { targetId: 'enemy_1', amount: 100 },
      });
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'sound',
        triggerTime: 0.5,
        data: { soundId: 'sword_hit' },
      });

      expect(scheduler.getPendingCount()).toBe(2);
    });

    test('should schedule actions for different entities', () => {
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.3,
        data: { targetId: 'enemy_1', amount: 100 },
      });
      scheduler.schedule({
        entityId: 'player_2',
        actionType: 'projectile',
        triggerTime: 0.4,
        data: { targetId: 'enemy_2' },
      });

      expect(scheduler.getPendingCount()).toBe(2);
    });
  });

  describe('Processing Actions', () => {
    test('should trigger action when time passes', () => {
      const triggeredActions: ScheduledAction[] = [];

      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.5,
        data: { targetId: 'enemy_1', amount: 100 },
      });

      // Not enough time passed
      scheduler.update(0.3, (action) => triggeredActions.push(action));
      expect(triggeredActions.length).toBe(0);

      // Time passes trigger point
      scheduler.update(0.3, (action) => triggeredActions.push(action));
      expect(triggeredActions.length).toBe(1);
      expect(triggeredActions[0].entityId).toBe('player_1');
      expect(triggeredActions[0].actionType).toBe('damage');
    });

    test('should trigger multiple actions in order', () => {
      const triggeredActions: ScheduledAction[] = [];

      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.5,
        data: { first: true },
      });
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'sound',
        triggerTime: 0.3,
        data: { second: true },
      });

      // Process all
      scheduler.update(1.0, (action) => triggeredActions.push(action));

      expect(triggeredActions.length).toBe(2);
      // Sound at 0.3 should trigger before damage at 0.5
      expect(triggeredActions[0].triggerTime).toBe(0.3);
      expect(triggeredActions[1].triggerTime).toBe(0.5);
    });

    test('should remove triggered actions from pending', () => {
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.5,
        data: {},
      });

      expect(scheduler.getPendingCount()).toBe(1);

      scheduler.update(1.0, () => {});

      expect(scheduler.getPendingCount()).toBe(0);
    });

    test('should not trigger same action twice', () => {
      let triggerCount = 0;

      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.5,
        data: {},
      });

      scheduler.update(1.0, () => triggerCount++);
      scheduler.update(1.0, () => triggerCount++);

      expect(triggerCount).toBe(1);
    });
  });

  describe('Cancelling Actions', () => {
    test('should cancel all actions for an entity', () => {
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.5,
        data: {},
      });
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'sound',
        triggerTime: 0.3,
        data: {},
      });
      scheduler.schedule({
        entityId: 'player_2',
        actionType: 'damage',
        triggerTime: 0.4,
        data: {},
      });

      scheduler.cancelForEntity('player_1');

      expect(scheduler.getPendingCount()).toBe(1);
    });

    test('cancelled actions should not trigger', () => {
      const triggeredActions: ScheduledAction[] = [];

      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.5,
        data: {},
      });

      scheduler.cancelForEntity('player_1');
      scheduler.update(1.0, (action) => triggeredActions.push(action));

      expect(triggeredActions.length).toBe(0);
    });

    test('should cancel specific action types', () => {
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.5,
        data: {},
      });
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'sound',
        triggerTime: 0.3,
        data: {},
      });

      scheduler.cancelForEntity('player_1', 'damage');

      expect(scheduler.getPendingCount()).toBe(1);
    });
  });

  describe('Animation-based Scheduling', () => {
    const testAnimation: AnimationData = {
      id: 'test_attack',
      totalFrames: 6,
      baseFrameDuration: 0.1, // 600ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'swing' } },
        { frame: 3, trigger: { type: 'damage' } },
        { frame: 3, trigger: { type: 'sound', soundId: 'hit' } },
      ],
    };

    test('should schedule actions from animation keyframes', () => {
      scheduler.scheduleFromAnimation('player_1', testAnimation, 1.0);

      expect(scheduler.getPendingCount()).toBe(3);
    });

    test('should calculate correct trigger times from animation', () => {
      const triggeredActions: ScheduledAction[] = [];

      scheduler.scheduleFromAnimation('player_1', testAnimation, 1.0);

      // Frame 0 at time 0.0
      scheduler.update(0.05, (action) => triggeredActions.push(action));
      expect(triggeredActions.length).toBe(1);
      expect(triggeredActions[0].actionType).toBe('sound');

      // Frame 3 at time 0.3 (3 * 0.1)
      scheduler.update(0.3, (action) => triggeredActions.push(action));
      expect(triggeredActions.length).toBe(3); // damage + sound at frame 3
    });

    test('should scale trigger times with animation speed', () => {
      const triggeredActions: ScheduledAction[] = [];

      // Speed 2.0 = animation plays twice as fast
      scheduler.scheduleFromAnimation('player_1', testAnimation, 2.0);

      // Frame 3 should now be at time 0.15 (3 * 0.1 / 2.0)
      scheduler.update(0.2, (action) => triggeredActions.push(action));
      expect(triggeredActions.length).toBe(3); // All triggered by 0.2s at 2x speed
    });

    test('should handle zero-frame keyframes', () => {
      const animation: AnimationData = {
        id: 'instant',
        totalFrames: 1,
        baseFrameDuration: 0.1,
        loop: false,
        keyframes: [
          { frame: 0, trigger: { type: 'effect', effectId: 'buff' } },
        ],
      };

      const triggeredActions: ScheduledAction[] = [];

      scheduler.scheduleFromAnimation('player_1', animation, 1.0);
      scheduler.update(0.01, (action) => triggeredActions.push(action));

      expect(triggeredActions.length).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle no pending actions gracefully', () => {
      const triggeredActions: ScheduledAction[] = [];
      scheduler.update(1.0, (action) => triggeredActions.push(action));
      expect(triggeredActions.length).toBe(0);
    });

    test('should handle very small time deltas', () => {
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.001,
        data: {},
      });

      const triggeredActions: ScheduledAction[] = [];

      // Many small updates
      for (let i = 0; i < 10; i++) {
        scheduler.update(0.0005, (action) => triggeredActions.push(action));
      }

      expect(triggeredActions.length).toBe(1);
    });

    test('should clear all pending actions', () => {
      scheduler.schedule({
        entityId: 'player_1',
        actionType: 'damage',
        triggerTime: 0.5,
        data: {},
      });
      scheduler.schedule({
        entityId: 'player_2',
        actionType: 'projectile',
        triggerTime: 0.6,
        data: {},
      });

      scheduler.clear();

      expect(scheduler.getPendingCount()).toBe(0);
    });
  });
});
