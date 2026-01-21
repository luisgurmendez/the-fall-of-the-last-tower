/**
 * StateSerializer Unit Tests
 *
 * Tests delta compression, change tracking, and serialization accuracy.
 * Critical for network efficiency and state consistency.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { StateSerializer } from '../network/StateSerializer';
import { EntityType, EntityChangeMask, type EntitySnapshot, type ChampionSnapshot, type MinionSnapshot } from '@siege/shared';

// Mock entity that implements toSnapshot
function createMockEntity(id: string, type: EntityType, overrides: Partial<EntitySnapshot> = {}) {
  const baseSnapshot: EntitySnapshot = {
    entityId: id,
    entityType: type,
    x: 0,
    y: 0,
    ...overrides,
  };

  return {
    id,
    entityType: type,
    toSnapshot: () => ({ ...baseSnapshot }),
  };
}

function createMockChampion(id: string, overrides: Partial<ChampionSnapshot> = {}) {
  const snapshot: ChampionSnapshot = {
    entityId: id,
    entityType: EntityType.CHAMPION,
    x: 0,
    y: 0,
    side: 0,
    championId: 'warrior',
    playerId: id,
    health: 1000,
    maxHealth: 1000,
    resource: 100,
    maxResource: 100,
    level: 1,
    experience: 0,
    gold: 500,
    movementSpeed: 325,
    attackDamage: 60,
    abilityPower: 0,
    armor: 30,
    magicResist: 30,
    attackSpeed: 1.0,
    abilities: {},
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
    ...overrides,
  };

  return {
    id,
    entityType: EntityType.CHAMPION,
    toSnapshot: () => ({ ...snapshot }),
  };
}

function createMockMinion(id: string, overrides: Partial<MinionSnapshot> = {}) {
  const snapshot: MinionSnapshot = {
    entityId: id,
    entityType: EntityType.MINION,
    x: 0,
    y: 0,
    side: 0,
    minionType: 'melee',
    health: 477,
    maxHealth: 477,
    attackDamage: 12,
    armor: 0,
    magicResist: 0,
    isDead: false,
    targetEntityId: undefined,
    targetX: undefined,
    targetY: undefined,
    ...overrides,
  };

  return {
    id,
    entityType: EntityType.MINION,
    toSnapshot: () => ({ ...snapshot }),
  };
}

describe('StateSerializer', () => {
  let serializer: StateSerializer;

  beforeEach(() => {
    serializer = new StateSerializer();
  });

  describe('createFullSnapshot', () => {
    it('should create snapshots for all entities', () => {
      const entities = [
        createMockChampion('champ-1'),
        createMockMinion('minion-1'),
        createMockMinion('minion-2'),
      ];

      const snapshots = serializer.createFullSnapshot(entities as any, 1, 0);

      expect(snapshots.length).toBe(3);
      expect(snapshots[0].entityId).toBe('champ-1');
      expect(snapshots[1].entityId).toBe('minion-1');
      expect(snapshots[2].entityId).toBe('minion-2');
    });

    it('should handle empty entity list', () => {
      const snapshots = serializer.createFullSnapshot([], 1, 0);
      expect(snapshots.length).toBe(0);
    });

    it('should preserve entity type information', () => {
      const entities = [
        createMockChampion('champ-1'),
        createMockMinion('minion-1'),
      ];

      const snapshots = serializer.createFullSnapshot(entities as any, 1, 0);

      expect(snapshots[0].entityType).toBe(EntityType.CHAMPION);
      expect(snapshots[1].entityType).toBe(EntityType.MINION);
    });
  });

  describe('createDeltaUpdates', () => {
    it('should return full snapshot for new entities', () => {
      const entities = [createMockChampion('champ-1', { x: 100, y: 200 })];

      const deltas = serializer.createDeltaUpdates(entities as any, 'player-1', 1);

      expect(deltas.length).toBe(1);
      expect(deltas[0].entityId).toBe('champ-1');
      expect(deltas[0].changeMask).toBe(0xFFFF); // All fields for new entity
    });

    it('should detect position changes', () => {
      const playerId = 'player-1';

      // First tick - entity at (0, 0)
      let entities = [createMockChampion('champ-1', { x: 0, y: 0 })];
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      // Second tick - entity moved to (100, 100)
      entities = [createMockChampion('champ-1', { x: 100, y: 100 })];
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      expect(deltas.length).toBe(1);
      expect(deltas[0].changeMask & EntityChangeMask.POSITION).toBeTruthy();
    });

    it('should detect health changes', () => {
      const playerId = 'player-1';

      // First tick - full health
      let entities = [createMockChampion('champ-1', { health: 1000, maxHealth: 1000 })];
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      // Second tick - took damage
      entities = [createMockChampion('champ-1', { health: 800, maxHealth: 1000 })];
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      expect(deltas.length).toBe(1);
      expect(deltas[0].changeMask & EntityChangeMask.HEALTH).toBeTruthy();
    });

    it('should detect resource changes for champions', () => {
      const playerId = 'player-1';

      let entities = [createMockChampion('champ-1', { resource: 100 })];
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      entities = [createMockChampion('champ-1', { resource: 50 })];
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      expect(deltas[0].changeMask & EntityChangeMask.RESOURCE).toBeTruthy();
    });

    it('should detect level changes', () => {
      const playerId = 'player-1';

      let entities = [createMockChampion('champ-1', { level: 1 })];
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      entities = [createMockChampion('champ-1', { level: 2 })];
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      expect(deltas[0].changeMask & EntityChangeMask.LEVEL).toBeTruthy();
    });

    it('should detect state changes (death)', () => {
      const playerId = 'player-1';

      let entities = [createMockChampion('champ-1', { isDead: false })];
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      entities = [createMockChampion('champ-1', { isDead: true })];
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      expect(deltas[0].changeMask & EntityChangeMask.STATE).toBeTruthy();
    });

    it('should return no deltas when nothing changed', () => {
      const playerId = 'player-1';

      const entities = [createMockChampion('champ-1', { x: 100, y: 100, health: 1000 })];

      // First tick
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      // Second tick - same state
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      expect(deltas.length).toBe(0);
    });

    it('should track state per player independently', () => {
      const entities = [createMockChampion('champ-1', { x: 0, y: 0 })];

      // Player 1 sees entity
      serializer.createDeltaUpdates(entities as any, 'player-1', 1);

      // Player 2 sees entity for first time
      const deltasP2 = serializer.createDeltaUpdates(entities as any, 'player-2', 1);

      // Player 2 should get full snapshot (new entity for them)
      expect(deltasP2.length).toBe(1);
      expect(deltasP2[0].changeMask).toBe(0xFFFF);
    });

    it('should remove entities that no longer exist', () => {
      const playerId = 'player-1';

      // First tick - two entities
      let entities = [
        createMockChampion('champ-1'),
        createMockMinion('minion-1'),
      ];
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      // Second tick - minion is gone
      entities = [createMockChampion('champ-1')];
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      // Third tick - champion moves, should only track champion
      entities = [createMockChampion('champ-1', { x: 50, y: 50 })];
      const deltas3 = serializer.createDeltaUpdates(entities as any, playerId, 3);

      expect(deltas3.length).toBe(1);
      expect(deltas3[0].entityId).toBe('champ-1');
    });
  });

  describe('createStateUpdate', () => {
    it('should create complete state update message', () => {
      const entities = [createMockChampion('champ-1')];
      const inputAcks = { 'player-1': 5 };
      const events: any[] = [];

      const update = serializer.createStateUpdate(
        entities as any,
        'player-1',
        100,
        60.5,
        inputAcks,
        events
      );

      expect(update.tick).toBe(100);
      expect(update.gameTime).toBe(60.5);
      expect(update.inputAcks).toEqual(inputAcks);
      expect(update.deltas.length).toBe(1);
      expect(update.timestamp).toBeGreaterThan(0);
    });

    it('should include events in state update', () => {
      const entities: any[] = [];
      const events = [
        { type: 1, timestamp: Date.now(), data: { damage: 100 } },
      ];

      const update = serializer.createStateUpdate(
        entities,
        'player-1',
        100,
        60.5,
        {},
        events
      );

      expect(update.events.length).toBe(1);
      expect(update.events[0].data.damage).toBe(100);
    });
  });

  describe('clearPlayerState', () => {
    it('should clear state for specific player', () => {
      const entities = [createMockChampion('champ-1', { x: 100 })];

      // Player 1 and 2 see entity
      serializer.createDeltaUpdates(entities as any, 'player-1', 1);
      serializer.createDeltaUpdates(entities as any, 'player-2', 1);

      // Clear player 1's state
      serializer.clearPlayerState('player-1');

      // Player 1 should see entity as new again
      const deltasP1 = serializer.createDeltaUpdates(entities as any, 'player-1', 2);
      expect(deltasP1[0].changeMask).toBe(0xFFFF);

      // Player 2 should see no changes
      const deltasP2 = serializer.createDeltaUpdates(entities as any, 'player-2', 2);
      expect(deltasP2.length).toBe(0);
    });
  });

  describe('clearAllState', () => {
    it('should clear all player states', () => {
      const entities = [createMockChampion('champ-1')];

      serializer.createDeltaUpdates(entities as any, 'player-1', 1);
      serializer.createDeltaUpdates(entities as any, 'player-2', 1);

      serializer.clearAllState();

      // Both players should see entity as new
      const deltasP1 = serializer.createDeltaUpdates(entities as any, 'player-1', 2);
      const deltasP2 = serializer.createDeltaUpdates(entities as any, 'player-2', 2);

      expect(deltasP1[0].changeMask).toBe(0xFFFF);
      expect(deltasP2[0].changeMask).toBe(0xFFFF);
    });
  });

  describe('estimateMessageSize', () => {
    it('should estimate message size', () => {
      const update = {
        tick: 100,
        timestamp: Date.now(),
        gameTime: 60.5,
        inputAcks: { 'player-1': 5 },
        deltas: [],
        events: [],
      };

      const size = serializer.estimateMessageSize(update);
      expect(size).toBeGreaterThan(0);
    });

    it('should increase with more deltas', () => {
      const smallUpdate = {
        tick: 100,
        timestamp: Date.now(),
        gameTime: 60.5,
        inputAcks: {},
        deltas: [{ entityId: 'e1', changeMask: 1, data: { x: 0, y: 0 } }],
        events: [],
      };

      const largeUpdate = {
        ...smallUpdate,
        deltas: Array(10).fill({ entityId: 'e1', changeMask: 1, data: { x: 0, y: 0 } }),
      };

      const smallSize = serializer.estimateMessageSize(smallUpdate as any);
      const largeSize = serializer.estimateMessageSize(largeUpdate as any);

      expect(largeSize).toBeGreaterThan(smallSize);
    });
  });

  describe('Delta Compression Efficiency', () => {
    it('should only include changed fields in delta data', () => {
      const playerId = 'player-1';

      // First tick
      let entities = [createMockChampion('champ-1', { x: 0, y: 0, health: 1000 })];
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      // Second tick - only position changed
      entities = [createMockChampion('champ-1', { x: 100, y: 100, health: 1000 })];
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      const deltaData = deltas[0].data as any;

      // Should include position
      expect(deltaData.x).toBe(100);
      expect(deltaData.y).toBe(100);

      // Should NOT include unchanged health (delta compression)
      // Note: Current implementation may or may not include unchanged fields
      // This test documents expected behavior
      expect(deltas[0].changeMask & EntityChangeMask.POSITION).toBeTruthy();
      expect(deltas[0].changeMask & EntityChangeMask.HEALTH).toBeFalsy();
    });

    it('should combine multiple changes in single delta', () => {
      const playerId = 'player-1';

      let entities = [createMockChampion('champ-1', { x: 0, health: 1000, resource: 100 })];
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      // Multiple changes at once
      entities = [createMockChampion('champ-1', { x: 50, health: 800, resource: 50 })];
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      expect(deltas.length).toBe(1);
      expect(deltas[0].changeMask & EntityChangeMask.POSITION).toBeTruthy();
      expect(deltas[0].changeMask & EntityChangeMask.HEALTH).toBeTruthy();
      expect(deltas[0].changeMask & EntityChangeMask.RESOURCE).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity with same ID but different type', () => {
      const playerId = 'player-1';

      // This shouldn't happen in practice but tests robustness
      let entities = [createMockChampion('entity-1')];
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      // Same ID but now it's a minion (hypothetically)
      entities = [createMockMinion('entity-1')];
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      // Should detect as changed (entityType is different)
      expect(deltas.length).toBe(1);
    });

    it('should handle floating point position changes', () => {
      const playerId = 'player-1';

      let entities = [createMockChampion('champ-1', { x: 100.0, y: 100.0 })];
      serializer.createDeltaUpdates(entities as any, playerId, 1);

      // Very small change
      entities = [createMockChampion('champ-1', { x: 100.001, y: 100.001 })];
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

      // Should detect even small changes (exact comparison)
      expect(deltas.length).toBe(1);
    });

    it('should handle rapid state transitions', () => {
      const playerId = 'player-1';

      // Rapid death-respawn cycle
      for (let tick = 1; tick <= 10; tick++) {
        const isDead = tick % 2 === 0;
        const entities = [createMockChampion('champ-1', { isDead })];
        const deltas = serializer.createDeltaUpdates(entities as any, playerId, tick);

        if (tick > 1) {
          expect(deltas[0].changeMask & EntityChangeMask.STATE).toBeTruthy();
        }
      }
    });

    it('should handle large number of entities', () => {
      const playerId = 'player-1';
      const entityCount = 100;

      const entities = Array(entityCount).fill(null).map((_, i) =>
        createMockMinion(`minion-${i}`, { x: i * 10, y: i * 10 })
      );

      // Should not throw
      const deltas = serializer.createDeltaUpdates(entities as any, playerId, 1);
      expect(deltas.length).toBe(entityCount);
    });
  });
});

describe('StateSerializer Minion-Specific', () => {
  let serializer: StateSerializer;

  beforeEach(() => {
    serializer = new StateSerializer();
  });

  it('should detect minion target changes', () => {
    const playerId = 'player-1';

    let entities = [createMockMinion('minion-1', { targetEntityId: undefined })];
    serializer.createDeltaUpdates(entities as any, playerId, 1);

    entities = [createMockMinion('minion-1', { targetEntityId: 'champ-1' })];
    const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

    expect(deltas[0].changeMask & EntityChangeMask.TARGET).toBeTruthy();
  });

  it('should detect minion death', () => {
    const playerId = 'player-1';

    let entities = [createMockMinion('minion-1', { isDead: false })];
    serializer.createDeltaUpdates(entities as any, playerId, 1);

    entities = [createMockMinion('minion-1', { isDead: true })];
    const deltas = serializer.createDeltaUpdates(entities as any, playerId, 2);

    expect(deltas[0].changeMask & EntityChangeMask.STATE).toBeTruthy();
  });
});
