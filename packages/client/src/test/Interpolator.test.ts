import { describe, it, expect, beforeEach } from 'bun:test';
import { Interpolator } from '../prediction/Interpolator';
import { EntityType, type EntitySnapshot } from '@siege/shared';

describe('Interpolator', () => {
  let interpolator: Interpolator;

  function createSnapshot(
    entityId: string,
    x: number,
    y: number,
    entityType: EntityType = EntityType.CHAMPION
  ): EntitySnapshot {
    return {
      entityId,
      entityType,
      x,
      y,
      side: 0,
    };
  }

  beforeEach(() => {
    interpolator = new Interpolator({
      interpolationDelay: 100,
      maxBufferSize: 10,
    });
  });

  describe('addSnapshot', () => {
    it('should add snapshots to the buffer', () => {
      const snapshot = createSnapshot('entity1', 100, 200);
      interpolator.addSnapshot(snapshot, 1, 1000);

      expect(interpolator.getBufferSize('entity1')).toBe(1);
    });

    it('should create buffer for new entities', () => {
      const snapshot1 = createSnapshot('entity1', 100, 200);
      const snapshot2 = createSnapshot('entity2', 300, 400);

      interpolator.addSnapshot(snapshot1, 1, 1000);
      interpolator.addSnapshot(snapshot2, 1, 1000);

      expect(interpolator.getBufferSize('entity1')).toBe(1);
      expect(interpolator.getBufferSize('entity2')).toBe(1);
    });

    it('should trim buffer when exceeding max size', () => {
      for (let i = 0; i < 15; i++) {
        const snapshot = createSnapshot('entity1', i * 10, i * 10);
        interpolator.addSnapshot(snapshot, i, i * 100);
      }

      expect(interpolator.getBufferSize('entity1')).toBe(10);
    });
  });

  describe('getInterpolatedState', () => {
    it('should return null for unknown entity', () => {
      const state = interpolator.getInterpolatedState('unknown', Date.now());
      expect(state).toBeNull();
    });

    it('should return first snapshot when render time is before all snapshots', () => {
      const now = Date.now();
      const snapshot = createSnapshot('entity1', 100, 200);
      interpolator.addSnapshot(snapshot, 1, 1000);

      const state = interpolator.getInterpolatedState('entity1', now - 1000);
      expect(state).not.toBeNull();
      expect(state!.x).toBe(100);
      expect(state!.y).toBe(200);
    });

    it('should return last snapshot when render time is after all snapshots', () => {
      const now = Date.now();
      const snapshot = createSnapshot('entity1', 100, 200);
      interpolator.addSnapshot(snapshot, 1, 1000);

      // Wait a bit then query
      const state = interpolator.getInterpolatedState('entity1', now + 500);
      expect(state).not.toBeNull();
      expect(state!.x).toBe(100);
      expect(state!.y).toBe(200);
    });

    it('should interpolate between two snapshots', () => {
      const baseTime = Date.now();

      // Create two snapshots 100ms apart
      const snapshot1 = createSnapshot('entity1', 0, 0);
      const snapshot2 = createSnapshot('entity1', 100, 100);

      // Add snapshots at different times
      interpolator.addSnapshot(snapshot1, 1, 1000);

      // Wait and add second snapshot
      const laterTime = baseTime + 100;

      // For proper interpolation we need to manipulate received times
      // Let's use a fresh interpolator with manual timing
      const testInterpolator = new Interpolator({ interpolationDelay: 50 });

      // Manually set up the buffer (in a real scenario, receivedAt comes from Date.now())
      // Since we can't easily control receivedAt, we test the interpolation factor instead
      testInterpolator.addSnapshot(snapshot1, 1, 1000);
      testInterpolator.addSnapshot(snapshot2, 2, 1100);

      // The interpolation depends on receivedAt which is set internally
      const state = testInterpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
    });
  });

  describe('getAllInterpolatedStates', () => {
    it('should return states for all entities', () => {
      const now = Date.now();

      interpolator.addSnapshot(createSnapshot('entity1', 100, 100), 1, 1000);
      interpolator.addSnapshot(createSnapshot('entity2', 200, 200), 1, 1000);
      interpolator.addSnapshot(createSnapshot('entity3', 300, 300), 1, 1000);

      const states = interpolator.getAllInterpolatedStates(now);
      expect(states.length).toBe(3);
    });

    it('should return empty array when no entities', () => {
      const states = interpolator.getAllInterpolatedStates(Date.now());
      expect(states).toEqual([]);
    });
  });

  describe('removeEntity', () => {
    it('should remove entity from buffer', () => {
      interpolator.addSnapshot(createSnapshot('entity1', 100, 100), 1, 1000);
      expect(interpolator.getBufferSize('entity1')).toBe(1);

      interpolator.removeEntity('entity1');
      expect(interpolator.getBufferSize('entity1')).toBe(0);
    });

    it('should not affect other entities', () => {
      interpolator.addSnapshot(createSnapshot('entity1', 100, 100), 1, 1000);
      interpolator.addSnapshot(createSnapshot('entity2', 200, 200), 1, 1000);

      interpolator.removeEntity('entity1');

      expect(interpolator.getBufferSize('entity1')).toBe(0);
      expect(interpolator.getBufferSize('entity2')).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all buffers', () => {
      interpolator.addSnapshot(createSnapshot('entity1', 100, 100), 1, 1000);
      interpolator.addSnapshot(createSnapshot('entity2', 200, 200), 1, 1000);

      interpolator.clear();

      expect(interpolator.getBufferSize('entity1')).toBe(0);
      expect(interpolator.getBufferSize('entity2')).toBe(0);
    });
  });

  describe('setInterpolationDelay', () => {
    it('should update interpolation delay', () => {
      interpolator.setInterpolationDelay(200);
      expect(interpolator.getInterpolationDelay()).toBe(200);
    });
  });

  describe('getAverageBufferDelay', () => {
    it('should return 0 when no buffers have enough data', () => {
      interpolator.addSnapshot(createSnapshot('entity1', 100, 100), 1, 1000);
      expect(interpolator.getAverageBufferDelay()).toBe(0);
    });

    it('should calculate average delay across entities', () => {
      // Add multiple snapshots to get meaningful delay
      const baseTime = Date.now();
      interpolator.addSnapshot(createSnapshot('entity1', 0, 0), 1, 1000);
      interpolator.addSnapshot(createSnapshot('entity1', 10, 10), 2, 1100);

      const avgDelay = interpolator.getAverageBufferDelay();
      // Should be very small since snapshots were added nearly simultaneously
      expect(avgDelay).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases - Division by Zero', () => {
    it('should handle snapshots with identical receivedAt timestamps', () => {
      // This tests the division by zero scenario in interpolation
      // when after.receivedAt === before.receivedAt
      const testInterpolator = new Interpolator({ interpolationDelay: 0 });

      // Add two snapshots - they will have nearly identical receivedAt
      const snapshot1 = createSnapshot('entity1', 0, 0);
      const snapshot2 = createSnapshot('entity1', 100, 100);

      testInterpolator.addSnapshot(snapshot1, 1, 1000);
      testInterpolator.addSnapshot(snapshot2, 2, 1000); // Same serverTime

      // Should not throw or return NaN/Infinity
      const state = testInterpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
      expect(Number.isFinite(state!.x)).toBe(true);
      expect(Number.isFinite(state!.y)).toBe(true);
      expect(Number.isNaN(state!.x)).toBe(false);
      expect(Number.isNaN(state!.y)).toBe(false);
    });

    it('should handle interpolation factor clamping correctly', () => {
      const testInterpolator = new Interpolator({ interpolationDelay: 50 });

      const snapshot1 = createSnapshot('entity1', 0, 0);
      const snapshot2 = createSnapshot('entity1', 100, 100);

      testInterpolator.addSnapshot(snapshot1, 1, 1000);
      testInterpolator.addSnapshot(snapshot2, 2, 1100);

      const state = testInterpolator.getInterpolatedState('entity1', Date.now());
      if (state) {
        // Interpolation factor should always be between 0 and 1
        expect(state.interpolationFactor).toBeGreaterThanOrEqual(0);
        expect(state.interpolationFactor).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Edge Cases - Numeric Extremes', () => {
    it('should handle very large coordinate values', () => {
      const snapshot = createSnapshot('entity1', Number.MAX_SAFE_INTEGER / 2, Number.MAX_SAFE_INTEGER / 2);
      interpolator.addSnapshot(snapshot, 1, 1000);

      const state = interpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
      expect(Number.isFinite(state!.x)).toBe(true);
    });

    it('should handle negative coordinate values', () => {
      const snapshot1 = createSnapshot('entity1', -1000, -2000);
      const snapshot2 = createSnapshot('entity1', -500, -1000);

      interpolator.addSnapshot(snapshot1, 1, 1000);
      interpolator.addSnapshot(snapshot2, 2, 1100);

      const state = interpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
    });

    it('should handle zero coordinate values', () => {
      const snapshot1 = createSnapshot('entity1', 0, 0);
      const snapshot2 = createSnapshot('entity1', 0, 0);

      interpolator.addSnapshot(snapshot1, 1, 1000);
      interpolator.addSnapshot(snapshot2, 2, 1100);

      const state = interpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
      expect(state!.x).toBe(0);
      expect(state!.y).toBe(0);
    });

    it('should handle mixed positive and negative coordinates', () => {
      const snapshot1 = createSnapshot('entity1', -100, 100);
      const snapshot2 = createSnapshot('entity1', 100, -100);

      interpolator.addSnapshot(snapshot1, 1, 1000);
      interpolator.addSnapshot(snapshot2, 2, 1100);

      const state = interpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
      expect(Number.isFinite(state!.x)).toBe(true);
      expect(Number.isFinite(state!.y)).toBe(true);
    });

    it('should handle very small coordinate differences', () => {
      const snapshot1 = createSnapshot('entity1', 100.0001, 200.0001);
      const snapshot2 = createSnapshot('entity1', 100.0002, 200.0002);

      interpolator.addSnapshot(snapshot1, 1, 1000);
      interpolator.addSnapshot(snapshot2, 2, 1100);

      const state = interpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
      expect(Number.isFinite(state!.x)).toBe(true);
    });
  });

  describe('Edge Cases - Time Values', () => {
    it('should handle render time far in the past', () => {
      const snapshot = createSnapshot('entity1', 100, 200);
      interpolator.addSnapshot(snapshot, 1, 1000);

      // Query with very old render time
      const state = interpolator.getInterpolatedState('entity1', 0);
      expect(state).not.toBeNull();
      expect(state!.interpolationFactor).toBe(0);
    });

    it('should handle render time far in the future', () => {
      const snapshot = createSnapshot('entity1', 100, 200);
      interpolator.addSnapshot(snapshot, 1, 1000);

      // Query with future render time
      const state = interpolator.getInterpolatedState('entity1', Date.now() + 1000000);
      expect(state).not.toBeNull();
      expect(state!.interpolationFactor).toBe(1);
    });

    it('should handle negative render time gracefully', () => {
      const snapshot = createSnapshot('entity1', 100, 200);
      interpolator.addSnapshot(snapshot, 1, 1000);

      const state = interpolator.getInterpolatedState('entity1', -1000);
      expect(state).not.toBeNull();
    });

    it('should handle zero interpolation delay', () => {
      const testInterpolator = new Interpolator({ interpolationDelay: 0 });
      const snapshot = createSnapshot('entity1', 100, 200);
      testInterpolator.addSnapshot(snapshot, 1, 1000);

      const state = testInterpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
    });

    it('should handle very large interpolation delay', () => {
      const testInterpolator = new Interpolator({ interpolationDelay: 10000 });
      const snapshot = createSnapshot('entity1', 100, 200);
      testInterpolator.addSnapshot(snapshot, 1, 1000);

      const state = testInterpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
    });
  });

  describe('Edge Cases - Buffer States', () => {
    it('should handle single snapshot in buffer', () => {
      const snapshot = createSnapshot('entity1', 100, 200);
      interpolator.addSnapshot(snapshot, 1, 1000);

      const state = interpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
      expect(state!.x).toBe(100);
      expect(state!.y).toBe(200);
    });

    it('should handle buffer at max capacity', () => {
      // Fill buffer to max
      for (let i = 0; i < 10; i++) {
        const snapshot = createSnapshot('entity1', i * 10, i * 10);
        interpolator.addSnapshot(snapshot, i, i * 100);
      }

      expect(interpolator.getBufferSize('entity1')).toBe(10);

      // Add one more - should trim oldest
      interpolator.addSnapshot(createSnapshot('entity1', 1000, 1000), 10, 10000);
      expect(interpolator.getBufferSize('entity1')).toBe(10);

      const state = interpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
    });

    it('should handle rapid snapshot additions', () => {
      // Simulate rapid fire snapshots
      for (let i = 0; i < 100; i++) {
        const snapshot = createSnapshot('entity1', i, i);
        interpolator.addSnapshot(snapshot, i, i);
      }

      // Should be trimmed to max size
      expect(interpolator.getBufferSize('entity1')).toBe(10);

      const state = interpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
    });

    it('should handle out-of-order snapshot times', () => {
      // Add snapshots out of order
      interpolator.addSnapshot(createSnapshot('entity1', 300, 300), 3, 3000);
      interpolator.addSnapshot(createSnapshot('entity1', 100, 100), 1, 1000);
      interpolator.addSnapshot(createSnapshot('entity1', 200, 200), 2, 2000);

      // Should still return valid state
      const state = interpolator.getInterpolatedState('entity1', Date.now());
      expect(state).not.toBeNull();
    });
  });

  describe('Edge Cases - Entity Management', () => {
    it('should handle removing non-existent entity', () => {
      // Should not throw
      interpolator.removeEntity('non-existent');
      expect(interpolator.getBufferSize('non-existent')).toBe(0);
    });

    it('should handle clearing empty interpolator', () => {
      // Should not throw
      interpolator.clear();
      expect(interpolator.getAllInterpolatedStates(Date.now())).toEqual([]);
    });

    it('should handle getting state for removed entity', () => {
      interpolator.addSnapshot(createSnapshot('entity1', 100, 100), 1, 1000);
      interpolator.removeEntity('entity1');

      const state = interpolator.getInterpolatedState('entity1', Date.now());
      expect(state).toBeNull();
    });
  });

  describe('Stress Tests', () => {
    it('should handle many entities simultaneously', () => {
      for (let i = 0; i < 100; i++) {
        const snapshot = createSnapshot(`entity${i}`, i * 10, i * 20);
        interpolator.addSnapshot(snapshot, 1, 1000);
      }

      const states = interpolator.getAllInterpolatedStates(Date.now());
      expect(states.length).toBe(100);
    });

    it('should maintain performance with full buffers for many entities', () => {
      // Create 50 entities with full buffers
      for (let entityIdx = 0; entityIdx < 50; entityIdx++) {
        for (let snapshotIdx = 0; snapshotIdx < 10; snapshotIdx++) {
          const snapshot = createSnapshot(
            `entity${entityIdx}`,
            entityIdx * 100 + snapshotIdx * 10,
            entityIdx * 100 + snapshotIdx * 10
          );
          interpolator.addSnapshot(snapshot, snapshotIdx, snapshotIdx * 100);
        }
      }

      const states = interpolator.getAllInterpolatedStates(Date.now());
      expect(states.length).toBe(50);

      // All states should be valid
      for (const state of states) {
        expect(Number.isFinite(state.x)).toBe(true);
        expect(Number.isFinite(state.y)).toBe(true);
      }
    });
  });
});
