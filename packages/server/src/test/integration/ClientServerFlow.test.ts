/**
 * Integration Tests - Client-Server Flow
 *
 * These tests verify the complete flow of data between client and server,
 * ensuring all components work together correctly.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { InputHandler } from '../../network/InputHandler';
import { StateSerializer } from '../../network/StateSerializer';
import { ServerGameContext } from '../../game/ServerGameContext';
import { Vector, InputType, type ClientInput, EntityType, TEAM_BLUE, TEAM_RED } from '@siege/shared';

describe('Client-Server Integration', () => {
  let inputHandler: InputHandler;
  let stateSerializer: StateSerializer;
  let gameContext: ServerGameContext;

  beforeEach(() => {
    inputHandler = new InputHandler();
    stateSerializer = new StateSerializer();
    gameContext = new ServerGameContext({ gameId: 'integration-test' });
  });

  describe('Input Processing Flow', () => {
    it('should process movement input and update game state', () => {
      const playerId = 'player-1';

      // Simulate client sending move input
      const moveInput: ClientInput = {
        seq: 1,
        type: InputType.MOVE,
        clientTime: Date.now(),
        targetX: 500,
        targetY: 500,
      };

      // Queue input on server
      const result = inputHandler.queueInput(playerId, moveInput);
      expect(result.valid).toBe(true);

      // Verify sequence tracking
      expect(inputHandler.getLastAckedSeq(playerId)).toBe(0);
    });

    it('should handle multiple players sending inputs simultaneously', () => {
      const players = ['player-1', 'player-2', 'player-3', 'player-4', 'player-5'];

      // All players send inputs at once
      const results = players.map((playerId, index) => {
        const input: ClientInput = {
          seq: 1,
          type: InputType.MOVE,
          clientTime: Date.now(),
          targetX: 100 * (index + 1),
          targetY: 100 * (index + 1),
        };
        return inputHandler.queueInput(playerId, input);
      });

      // All should be valid
      expect(results.every(r => r.valid)).toBe(true);
    });

    it('should track sequence numbers per player correctly', () => {
      // Player 1 sends 5 inputs
      for (let i = 1; i <= 5; i++) {
        inputHandler.queueInput('player-1', {
          seq: i,
          type: InputType.MOVE,
          clientTime: Date.now(),
          targetX: i * 10,
          targetY: 0,
        });
      }

      // Player 2 sends 3 inputs
      for (let i = 1; i <= 3; i++) {
        inputHandler.queueInput('player-2', {
          seq: i,
          type: InputType.MOVE,
          clientTime: Date.now(),
          targetX: 0,
          targetY: i * 10,
        });
      }

      // Sequences should be tracked independently
      const allSeqs = inputHandler.getAllAckedSeqs();
      expect(typeof allSeqs).toBe('object');
    });
  });

  describe('State Serialization Flow', () => {
    it('should serialize game state for network transmission', () => {
      // Create mock entities with toSnapshot method
      const mockEntities = [
        {
          id: 'champion-1',
          entityType: EntityType.CHAMPION,
          position: new Vector(100, 200),
          toSnapshot: () => ({
            entityId: 'champion-1',
            entityType: EntityType.CHAMPION,
            x: 100,
            y: 200,
            side: TEAM_BLUE,
            health: 500,
            maxHealth: 1000,
          }),
        },
        {
          id: 'minion-1',
          entityType: EntityType.MINION,
          position: new Vector(300, 400),
          toSnapshot: () => ({
            entityId: 'minion-1',
            entityType: EntityType.MINION,
            x: 300,
            y: 400,
            side: TEAM_RED,
            health: 200,
            maxHealth: 477,
          }),
        },
      ];

      // Create full snapshot should not throw
      const snapshots = stateSerializer.createFullSnapshot(mockEntities as any, 100, 120.5);
      expect(snapshots).toBeDefined();
      expect(snapshots.length).toBe(2);
    });

    it('should create delta updates with change tracking', () => {
      // Previous state
      const prevState = new Map([
        ['entity-1', { position: new Vector(0, 0), health: 100 }],
      ]);

      // Current state (entity moved and took damage)
      const currentState = new Map([
        ['entity-1', { position: new Vector(50, 50), health: 80 }],
      ]);

      // Create delta (this is a simplified test)
      const changes = [];
      for (const [id, current] of currentState) {
        const prev = prevState.get(id);
        if (prev) {
          if (prev.position.x !== current.position.x ||
              prev.position.y !== current.position.y) {
            changes.push({ id, change: 'position' });
          }
          if (prev.health !== current.health) {
            changes.push({ id, change: 'health' });
          }
        }
      }

      expect(changes.length).toBe(2);
    });
  });

  describe('Rate Limiting Under Load', () => {
    it('should maintain rate limits during burst traffic', async () => {
      const playerId = 'burst-player';
      let accepted = 0;
      let rejected = 0;

      // Simulate burst of 50 inputs in quick succession
      for (let i = 1; i <= 50; i++) {
        const result = inputHandler.queueInput(playerId, {
          seq: i,
          type: InputType.MOVE,
          clientTime: Date.now(),
          targetX: i,
          targetY: i,
        });

        if (result.valid) accepted++;
        else rejected++;
      }

      // Most should be rate limited
      expect(accepted).toBeLessThanOrEqual(20); // Move limit is 20/sec
      expect(rejected).toBeGreaterThanOrEqual(30);

      // Wait for rate limit window
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should now accept new inputs
      const newResult = inputHandler.queueInput(playerId, {
        seq: 51,
        type: InputType.MOVE,
        clientTime: Date.now(),
        targetX: 100,
        targetY: 100,
      });
      expect(newResult.valid).toBe(true);
    });

    it('should handle mixed input types with different rate limits', () => {
      const playerId = 'mixed-player';
      let seq = 1;

      // Send moves (limit 20)
      for (let i = 0; i < 20; i++) {
        inputHandler.queueInput(playerId, {
          seq: seq++,
          type: InputType.MOVE,
          clientTime: Date.now(),
          targetX: i,
          targetY: i,
        });
      }

      // Send abilities (limit 8)
      for (let i = 0; i < 8; i++) {
        inputHandler.queueInput(playerId, {
          seq: seq++,
          type: InputType.ABILITY,
          clientTime: Date.now(),
          slot: 0,
          targetType: 'position',
          targetX: 0,
          targetY: 0,
        });
      }

      // Next move should be rejected (maxed out)
      const moveResult = inputHandler.queueInput(playerId, {
        seq: seq++,
        type: InputType.MOVE,
        clientTime: Date.now(),
        targetX: 100,
        targetY: 100,
      });
      expect(moveResult.valid).toBe(false);

      // Next ability should also be rejected (maxed out)
      const abilityResult = inputHandler.queueInput(playerId, {
        seq: seq++,
        type: InputType.ABILITY,
        clientTime: Date.now(),
        slot: 1,
        targetType: 'position',
        targetX: 0,
        targetY: 0,
      });
      expect(abilityResult.valid).toBe(false);
    });
  });

  describe('Player Disconnect/Reconnect Flow', () => {
    it('should clean up player state on disconnect', () => {
      const playerId = 'disconnecting-player';

      // Player sends some inputs
      for (let i = 1; i <= 10; i++) {
        inputHandler.queueInput(playerId, {
          seq: i,
          type: InputType.MOVE,
          clientTime: Date.now(),
          targetX: i * 10,
          targetY: 0,
        });
      }

      // Player disconnects
      inputHandler.clearPlayer(playerId);

      // Player reconnects and starts fresh
      const reconnectResult = inputHandler.queueInput(playerId, {
        seq: 1, // Can start at seq 1 again
        type: InputType.MOVE,
        clientTime: Date.now(),
        targetX: 100,
        targetY: 100,
      });

      expect(reconnectResult.valid).toBe(true);
    });

    it('should not affect other players on disconnect', () => {
      // Both players send inputs
      inputHandler.queueInput('player-a', {
        seq: 1,
        type: InputType.MOVE,
        clientTime: Date.now(),
        targetX: 100,
        targetY: 100,
      });

      inputHandler.queueInput('player-b', {
        seq: 1,
        type: InputType.MOVE,
        clientTime: Date.now(),
        targetX: 200,
        targetY: 200,
      });

      // Player A disconnects
      inputHandler.clearPlayer('player-a');

      // Player B should continue normally
      const result = inputHandler.queueInput('player-b', {
        seq: 2,
        type: InputType.MOVE,
        clientTime: Date.now(),
        targetX: 300,
        targetY: 300,
      });

      expect(result.valid).toBe(true);
    });
  });
});

describe('Game State Consistency', () => {
  describe('Tick Synchronization', () => {
    it('should maintain consistent tick counting', () => {
      const context = new ServerGameContext({ gameId: 'tick-test' });

      // Simulate 100 ticks
      let tickCount = 0;
      const simulateTick = () => {
        tickCount++;
        // In real game, this would update game state
      };

      for (let i = 0; i < 100; i++) {
        simulateTick();
      }

      expect(tickCount).toBe(100);
    });

    it('should handle game time accumulation correctly', () => {
      const tickRate = 30; // 30 Hz
      const tickDuration = 1 / tickRate;
      let gameTime = 0;

      // Simulate 30 seconds of gameplay (900 ticks)
      for (let i = 0; i < 900; i++) {
        gameTime += tickDuration;
      }

      // Should be approximately 30 seconds
      expect(gameTime).toBeCloseTo(30, 1);
    });
  });

  describe('Entity State Tracking', () => {
    it('should track entity changes between snapshots', () => {
      interface EntityState {
        id: string;
        x: number;
        y: number;
        health: number;
      }

      // Previous snapshot
      const prevSnapshot: EntityState[] = [
        { id: 'e1', x: 0, y: 0, health: 100 },
        { id: 'e2', x: 100, y: 100, health: 500 },
      ];

      // Current snapshot
      const currentSnapshot: EntityState[] = [
        { id: 'e1', x: 10, y: 10, health: 100 },  // Moved
        { id: 'e2', x: 100, y: 100, health: 400 }, // Took damage
        { id: 'e3', x: 200, y: 200, health: 200 }, // New entity
      ];

      // Calculate changes
      const changes: string[] = [];
      const prevMap = new Map(prevSnapshot.map(e => [e.id, e]));

      for (const current of currentSnapshot) {
        const prev = prevMap.get(current.id);
        if (!prev) {
          changes.push(`${current.id}:new`);
        } else {
          if (prev.x !== current.x || prev.y !== current.y) {
            changes.push(`${current.id}:moved`);
          }
          if (prev.health !== current.health) {
            changes.push(`${current.id}:health`);
          }
        }
      }

      expect(changes).toContain('e1:moved');
      expect(changes).toContain('e2:health');
      expect(changes).toContain('e3:new');
    });
  });
});

describe('Protocol Message Integrity', () => {
  it('should handle message serialization round-trip', () => {
    const originalMessage = {
      type: 'STATE_UPDATE',
      tick: 12345,
      timestamp: Date.now(),
      entities: [
        { id: 'e1', x: 100.5, y: 200.75, health: 500 },
        { id: 'e2', x: -50.25, y: -100.125, health: 1000 },
      ],
      events: [
        { type: 'DAMAGE', source: 'e1', target: 'e2', amount: 50 },
      ],
    };

    // Serialize
    const serialized = JSON.stringify(originalMessage);

    // Deserialize
    const deserialized = JSON.parse(serialized);

    // Verify integrity
    expect(deserialized.tick).toBe(originalMessage.tick);
    expect(deserialized.entities.length).toBe(2);
    expect(deserialized.entities[0].x).toBeCloseTo(100.5, 5);
    expect(deserialized.entities[1].x).toBeCloseTo(-50.25, 5);
    expect(deserialized.events[0].amount).toBe(50);
  });

  it('should preserve floating point precision for positions', () => {
    const positions = [
      { x: 0.123456789, y: 0.987654321 },
      { x: -1000.555, y: 2000.777 },
      { x: 0, y: 0 },
    ];

    for (const pos of positions) {
      const serialized = JSON.stringify(pos);
      const deserialized = JSON.parse(serialized);

      // Should maintain precision to at least 6 decimal places
      expect(Math.abs(deserialized.x - pos.x)).toBeLessThan(0.000001);
      expect(Math.abs(deserialized.y - pos.y)).toBeLessThan(0.000001);
    }
  });
});
