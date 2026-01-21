import { describe, it, expect, beforeEach } from 'bun:test';
import { Reconciler, defaultApplyMovementInput } from '../prediction/Reconciler';
import { Vector, InputType, type ClientInput, type ChampionSnapshot, EntityType } from '@siege/shared';

describe('Reconciler', () => {
  let reconciler: Reconciler;

  function createInput(seq: number, targetX: number, targetY: number): ClientInput {
    return {
      seq,
      clientTime: Date.now(),
      type: InputType.MOVE,
      targetX,
      targetY,
    };
  }

  function createChampionSnapshot(x: number, y: number): ChampionSnapshot {
    return {
      entityId: 'player1',
      entityType: EntityType.CHAMPION,
      x,
      y,
      side: 0,
      championId: 'warrior',
      playerId: 'player1',
      health: 1000,
      maxHealth: 1000,
      resource: 100,
      maxResource: 100,
      level: 1,
      experience: 0,
      gold: 0,
      movementSpeed: 325,
      attackDamage: 60,
      abilityPower: 0,
      armor: 30,
      magicResist: 30,
      attackSpeed: 1.0,
      abilities: {} as any,
      items: [],
      activeEffects: [],
      isDead: false,
      respawnTimer: 0,
      isRecalling: false,
      recallProgress: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      cs: 0,
    };
  }

  // Simple apply function that moves toward target
  function applyInput(input: ClientInput, position: Vector, speed: number): Vector {
    if (input.targetX === undefined || input.targetY === undefined) {
      return position;
    }
    const target = new Vector(input.targetX, input.targetY);
    const dir = target.subtracted(position).normalized();
    // Move a fixed amount per input
    return position.added(dir.scaled(10));
  }

  beforeEach(() => {
    reconciler = new Reconciler({
      snapThreshold: 100,
      correctionThreshold: 5,
      smoothingFactor: 0.3,
    });
    reconciler.setPosition(new Vector(0, 0));
    reconciler.setMovementSpeed(325);
  });

  describe('setPosition and getPosition', () => {
    it('should set and get position', () => {
      reconciler.setPosition(new Vector(100, 200));
      const pos = reconciler.getPosition();
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
    });

    it('should return a copy of position', () => {
      reconciler.setPosition(new Vector(100, 200));
      const pos = reconciler.getPosition();
      pos.x = 999;
      expect(reconciler.getPosition().x).toBe(100);
    });
  });

  describe('recordInput', () => {
    it('should record inputs for reconciliation', () => {
      reconciler.recordInput(createInput(1, 100, 100), new Vector(10, 10));
      reconciler.recordInput(createInput(2, 200, 200), new Vector(20, 20));

      expect(reconciler.getPendingInputCount()).toBe(2);
    });

    it('should trim old inputs when exceeding max', () => {
      for (let i = 0; i < 100; i++) {
        reconciler.recordInput(createInput(i, i * 10, i * 10), new Vector(i, i));
      }

      expect(reconciler.getPendingInputCount()).toBeLessThanOrEqual(60);
    });
  });

  describe('reconcile', () => {
    it('should remove acknowledged inputs', () => {
      reconciler.recordInput(createInput(1, 100, 100), new Vector(10, 10));
      reconciler.recordInput(createInput(2, 200, 200), new Vector(20, 20));
      reconciler.recordInput(createInput(3, 300, 300), new Vector(30, 30));

      const snapshot = createChampionSnapshot(15, 15);
      reconciler.reconcile(snapshot, 2, applyInput);

      // Only input 3 should remain
      expect(reconciler.getPendingInputCount()).toBe(1);
    });

    it('should hard snap when error exceeds threshold', () => {
      reconciler.setPosition(new Vector(0, 0));

      // Server says we're at 200, 200 (error > 100)
      const snapshot = createChampionSnapshot(200, 200);
      const result = reconciler.reconcile(snapshot, 0, applyInput);

      expect(result.snapped).toBe(true);
      expect(result.position.x).toBe(200);
      expect(result.position.y).toBe(200);
    });

    it('should smooth correct when error is moderate', () => {
      reconciler.setPosition(new Vector(0, 0));

      // Server says we're at 20, 20 (5 < error < 100)
      const snapshot = createChampionSnapshot(20, 20);
      const result = reconciler.reconcile(snapshot, 0, applyInput);

      expect(result.snapped).toBe(false);
      // Position should be partially corrected
      expect(result.position.x).toBeGreaterThan(0);
      expect(result.position.x).toBeLessThan(20);
    });

    it('should keep prediction when error is small', () => {
      reconciler.setPosition(new Vector(100, 100));

      // Server says we're at 102, 102 (error < 5)
      const snapshot = createChampionSnapshot(102, 102);
      const result = reconciler.reconcile(snapshot, 0, applyInput);

      expect(result.snapped).toBe(false);
      // Position should remain at our prediction
      expect(result.position.x).toBe(100);
      expect(result.position.y).toBe(100);
    });

    it('should re-apply unacknowledged inputs', () => {
      reconciler.setPosition(new Vector(0, 0));

      // Record 3 inputs
      reconciler.recordInput(createInput(1, 100, 0), new Vector(10, 0));
      reconciler.recordInput(createInput(2, 100, 0), new Vector(20, 0));
      reconciler.recordInput(createInput(3, 100, 0), new Vector(30, 0));

      // Server only acked input 1, position at 10, 0
      const snapshot = createChampionSnapshot(10, 0);
      const result = reconciler.reconcile(snapshot, 1, applyInput);

      // Should have re-applied inputs 2 and 3
      expect(result.inputsReapplied).toBe(2);
    });
  });

  describe('predict', () => {
    it('should apply input and record for reconciliation', () => {
      reconciler.setPosition(new Vector(0, 0));

      const input = createInput(1, 100, 0);
      const newPos = reconciler.predict(input, applyInput);

      expect(newPos.x).toBeGreaterThan(0);
      expect(reconciler.getPendingInputCount()).toBe(1);
    });

    it('should chain multiple predictions', () => {
      reconciler.setPosition(new Vector(0, 0));

      reconciler.predict(createInput(1, 100, 0), applyInput);
      reconciler.predict(createInput(2, 100, 0), applyInput);
      const finalPos = reconciler.predict(createInput(3, 100, 0), applyInput);

      expect(finalPos.x).toBe(30); // 3 inputs * 10 units each
      expect(reconciler.getPendingInputCount()).toBe(3);
    });
  });

  describe('clear', () => {
    it('should clear all pending inputs', () => {
      reconciler.recordInput(createInput(1, 100, 100), new Vector(10, 10));
      reconciler.recordInput(createInput(2, 200, 200), new Vector(20, 20));

      reconciler.clear();

      expect(reconciler.getPendingInputCount()).toBe(0);
    });
  });

  describe('getPendingInputs', () => {
    it('should return list of pending inputs', () => {
      const input1 = createInput(1, 100, 100);
      const input2 = createInput(2, 200, 200);

      reconciler.recordInput(input1, new Vector(10, 10));
      reconciler.recordInput(input2, new Vector(20, 20));

      const inputs = reconciler.getPendingInputs();
      expect(inputs.length).toBe(2);
      expect(inputs[0].seq).toBe(1);
      expect(inputs[1].seq).toBe(2);
    });
  });
});

describe('defaultApplyMovementInput', () => {
  it('should move position toward target', () => {
    const input: ClientInput = {
      seq: 1,
      clientTime: Date.now(),
      type: InputType.MOVE,
      targetX: 100,
      targetY: 0,
    };

    const result = defaultApplyMovementInput(input, new Vector(0, 0), 300, 1 / 60);

    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBe(0);
  });

  it('should not overshoot target', () => {
    const input: ClientInput = {
      seq: 1,
      clientTime: Date.now(),
      type: InputType.MOVE,
      targetX: 1,
      targetY: 0,
    };

    const result = defaultApplyMovementInput(input, new Vector(0, 0), 1000, 1); // Very fast speed

    // Should stop at target, not overshoot
    expect(result.x).toBeLessThanOrEqual(1);
  });

  it('should return same position if already at target', () => {
    const input: ClientInput = {
      seq: 1,
      clientTime: Date.now(),
      type: InputType.MOVE,
      targetX: 100,
      targetY: 100,
    };

    const result = defaultApplyMovementInput(input, new Vector(100, 100), 300, 1 / 60);

    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it('should return same position if no target specified', () => {
    const input: ClientInput = {
      seq: 1,
      clientTime: Date.now(),
      type: InputType.STOP,
    };

    const result = defaultApplyMovementInput(input, new Vector(50, 50), 300, 1 / 60);

    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
  });
});

/**
 * Additional comprehensive tests for edge cases and stress scenarios
 */
describe('Reconciler Edge Cases', () => {
  let reconciler: Reconciler;

  function createInput(seq: number, targetX: number, targetY: number): ClientInput {
    return {
      seq,
      clientTime: Date.now(),
      type: InputType.MOVE,
      targetX,
      targetY,
    };
  }

  function createChampionSnapshot(x: number, y: number): ChampionSnapshot {
    return {
      entityId: 'player1',
      entityType: EntityType.CHAMPION,
      x,
      y,
      side: 0,
      championId: 'warrior',
      playerId: 'player1',
      health: 1000,
      maxHealth: 1000,
      resource: 100,
      maxResource: 100,
      level: 1,
      experience: 0,
      gold: 0,
      movementSpeed: 325,
      attackDamage: 60,
      abilityPower: 0,
      armor: 30,
      magicResist: 30,
      attackSpeed: 1.0,
      abilities: {} as any,
      items: [],
      activeEffects: [],
      isDead: false,
      respawnTimer: 0,
      isRecalling: false,
      recallProgress: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      cs: 0,
    };
  }

  function applyInput(input: ClientInput, position: Vector, speed: number): Vector {
    if (input.targetX === undefined || input.targetY === undefined) {
      return position;
    }
    const target = new Vector(input.targetX, input.targetY);
    const dir = target.subtracted(position);
    if (dir.length() < 1) return position;
    return position.added(dir.normalized().scaled(10));
  }

  beforeEach(() => {
    reconciler = new Reconciler({
      snapThreshold: 100,
      correctionThreshold: 5,
      smoothingFactor: 0.3,
    });
    reconciler.setPosition(new Vector(0, 0));
    reconciler.setMovementSpeed(325);
  });

  describe('Boundary Conditions', () => {
    it('should handle reconciliation at exact snap threshold', () => {
      reconciler.setPosition(new Vector(0, 0));
      // Error of exactly 100 should snap
      const snapshot = createChampionSnapshot(100, 0);
      const result = reconciler.reconcile(snapshot, 0, applyInput);
      expect(result.errorDistance).toBeCloseTo(100, 0);
    });

    it('should handle reconciliation at exact correction threshold', () => {
      reconciler.setPosition(new Vector(0, 0));
      // Error of exactly 5 should trigger smooth correction
      const snapshot = createChampionSnapshot(5, 0);
      const result = reconciler.reconcile(snapshot, 0, applyInput);
      expect(result.errorDistance).toBeCloseTo(5, 0);
      expect(result.snapped).toBe(false);
    });

    it('should handle reconciliation just below correction threshold', () => {
      reconciler.setPosition(new Vector(0, 0));
      // Error of 4.9 should NOT trigger any correction
      const snapshot = createChampionSnapshot(4.9, 0);
      const result = reconciler.reconcile(snapshot, 0, applyInput);
      expect(result.snapped).toBe(false);
      // Position should remain at prediction
      expect(result.position.x).toBe(0);
    });

    it('should handle zero error distance', () => {
      reconciler.setPosition(new Vector(100, 100));
      const snapshot = createChampionSnapshot(100, 100);
      const result = reconciler.reconcile(snapshot, 0, applyInput);
      expect(result.errorDistance).toBe(0);
      expect(result.snapped).toBe(false);
    });
  });

  describe('Negative Coordinates', () => {
    it('should handle negative positions', () => {
      reconciler.setPosition(new Vector(-100, -200));
      const snapshot = createChampionSnapshot(-90, -190);
      const result = reconciler.reconcile(snapshot, 0, applyInput);
      expect(result.position.x).toBeLessThan(0);
      expect(result.position.y).toBeLessThan(0);
    });

    it('should handle crossing zero', () => {
      reconciler.setPosition(new Vector(-50, -50));
      const snapshot = createChampionSnapshot(50, 50);
      const result = reconciler.reconcile(snapshot, 0, applyInput);
      // Large error should snap
      expect(result.snapped).toBe(true);
      expect(result.position.x).toBe(50);
      expect(result.position.y).toBe(50);
    });
  });

  describe('High Latency Simulation', () => {
    it('should handle many pending inputs (high latency)', () => {
      reconciler.setPosition(new Vector(0, 0));

      // Simulate 30 unacknowledged inputs (1 second at 30 inputs/sec)
      for (let i = 1; i <= 30; i++) {
        reconciler.recordInput(createInput(i, 1000, 0), new Vector(i * 10, 0));
      }

      expect(reconciler.getPendingInputCount()).toBe(30);

      // Server acknowledges first 10
      const snapshot = createChampionSnapshot(100, 0);
      const result = reconciler.reconcile(snapshot, 10, applyInput);

      // Should have 20 remaining inputs
      expect(result.inputsReapplied).toBe(20);
    });

    it('should handle server acknowledging all inputs', () => {
      for (let i = 1; i <= 10; i++) {
        reconciler.recordInput(createInput(i, 100, 0), new Vector(i * 10, 0));
      }

      const snapshot = createChampionSnapshot(100, 0);
      const result = reconciler.reconcile(snapshot, 10, applyInput);

      expect(result.inputsReapplied).toBe(0);
      expect(reconciler.getPendingInputCount()).toBe(0);
    });

    it('should handle server acknowledging future sequence', () => {
      for (let i = 1; i <= 5; i++) {
        reconciler.recordInput(createInput(i, 100, 0), new Vector(i * 10, 0));
      }

      // Server acks seq 100 (more than we sent)
      const snapshot = createChampionSnapshot(100, 0);
      const result = reconciler.reconcile(snapshot, 100, applyInput);

      expect(result.inputsReapplied).toBe(0);
    });
  });

  describe('Input Reapplication Accuracy', () => {
    it('should reapply inputs in correct order', () => {
      reconciler.setPosition(new Vector(0, 0));

      // Record inputs moving right, then up
      reconciler.recordInput(createInput(1, 100, 0), new Vector(10, 0));
      reconciler.recordInput(createInput(2, 100, 0), new Vector(20, 0));
      reconciler.recordInput(createInput(3, 20, 100), new Vector(20, 10)); // Turn up

      // Server only acknowledges input 1
      const snapshot = createChampionSnapshot(10, 0);
      const result = reconciler.reconcile(snapshot, 1, applyInput);

      // Re-applied inputs 2 and 3
      expect(result.inputsReapplied).toBe(2);
    });

    it('should produce consistent results across multiple reconciliations', () => {
      reconciler.setPosition(new Vector(0, 0));

      for (let i = 1; i <= 5; i++) {
        reconciler.recordInput(createInput(i, 100, 0), new Vector(i * 10, 0));
      }

      const snapshot = createChampionSnapshot(30, 0);

      // First reconciliation
      const result1 = reconciler.reconcile(snapshot, 3, applyInput);

      // Reset and do same reconciliation
      reconciler.clear();
      reconciler.setPosition(new Vector(0, 0));
      for (let i = 1; i <= 5; i++) {
        reconciler.recordInput(createInput(i, 100, 0), new Vector(i * 10, 0));
      }

      const result2 = reconciler.reconcile(snapshot, 3, applyInput);

      // Results should be identical (deterministic)
      expect(result1.inputsReapplied).toBe(result2.inputsReapplied);
    });
  });

  describe('Smoothing Factor Edge Cases', () => {
    it('should apply correct smoothing with custom factor', () => {
      const customReconciler = new Reconciler({
        snapThreshold: 100,
        correctionThreshold: 5,
        smoothingFactor: 0.5, // 50% correction
      });
      customReconciler.setPosition(new Vector(0, 0));

      const snapshot = createChampionSnapshot(20, 0); // Error of 20
      const result = customReconciler.reconcile(snapshot, 0, applyInput);

      // With 0.5 smoothing, should move halfway
      expect(result.position.x).toBeCloseTo(10, 1);
    });

    it('should handle smoothing factor of 0 (no correction)', () => {
      const noSmoothReconciler = new Reconciler({
        snapThreshold: 100,
        correctionThreshold: 5,
        smoothingFactor: 0,
      });
      noSmoothReconciler.setPosition(new Vector(0, 0));

      const snapshot = createChampionSnapshot(20, 0);
      const result = noSmoothReconciler.reconcile(snapshot, 0, applyInput);

      // No smoothing should leave position unchanged
      expect(result.position.x).toBe(0);
    });

    it('should handle smoothing factor of 1 (full correction)', () => {
      const fullSmoothReconciler = new Reconciler({
        snapThreshold: 100,
        correctionThreshold: 5,
        smoothingFactor: 1.0,
      });
      fullSmoothReconciler.setPosition(new Vector(0, 0));

      const snapshot = createChampionSnapshot(20, 0);
      const result = fullSmoothReconciler.reconcile(snapshot, 0, applyInput);

      // Full smoothing should snap to server position
      expect(result.position.x).toBe(20);
    });
  });

  describe('RTT Calculation', () => {
    it('should calculate average RTT based on oldest pending input', () => {
      const startTime = Date.now();

      reconciler.recordInput(createInput(1, 100, 0), new Vector(10, 0));

      // Wait a bit
      const rtt = reconciler.getAverageRTT(startTime + 100);
      expect(rtt).toBeGreaterThanOrEqual(0);
      expect(rtt).toBeLessThanOrEqual(150);
    });

    it('should return 0 RTT with no pending inputs', () => {
      expect(reconciler.getAverageRTT(Date.now())).toBe(0);
    });
  });
});

describe('Reconciler Stress Tests', () => {
  it('should handle rapid reconciliation cycles', () => {
    const reconciler = new Reconciler();
    reconciler.setPosition(new Vector(0, 0));

    function applyInput(input: ClientInput, position: Vector, speed: number): Vector {
      if (input.targetX === undefined || input.targetY === undefined) return position;
      return new Vector(
        position.x + (input.targetX - position.x) * 0.1,
        position.y + (input.targetY - position.y) * 0.1
      );
    }

    // Simulate 60 ticks of gameplay
    for (let tick = 0; tick < 60; tick++) {
      // Send input
      const input: ClientInput = {
        seq: tick + 1,
        clientTime: Date.now(),
        type: InputType.MOVE,
        targetX: 100,
        targetY: 100,
      };
      reconciler.predict(input, applyInput);

      // Every 3 ticks, receive server state
      if (tick % 3 === 0) {
        const snapshot = {
          entityId: 'p1',
          entityType: EntityType.CHAMPION,
          x: tick * 1.5,
          y: tick * 1.5,
          // ... minimal snapshot
        } as ChampionSnapshot;

        reconciler.reconcile(snapshot, Math.floor(tick / 3) * 3, applyInput);
      }
    }

    // Should not crash and position should be reasonable
    const finalPos = reconciler.getPosition();
    expect(finalPos.x).toBeGreaterThan(0);
    expect(finalPos.y).toBeGreaterThan(0);
  });
});
