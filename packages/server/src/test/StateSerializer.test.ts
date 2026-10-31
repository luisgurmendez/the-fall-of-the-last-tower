/**
 * StateSerializer Unit Tests
 *
 * Tests delta compression, change tracking, and serialization accuracy.
 * Critical for network efficiency and state consistency.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { StateSerializer } from '../network/StateSerializer';
import { EntityType, EntityChangeMask, Vector, type EntitySnapshot, type ChampionSnapshot, type MinionSnapshot, type JungleCreatureSnapshot } from '@siege/shared';
import { ServerJungleCreature } from '../simulation/ServerJungleCreature';

// Mock entity that implements toSnapshot
function createMockEntity(id: string, type: EntityType, overrides: Partial<EntitySnapshot> = {}) {
  const baseSnapshot = {
    entityId: id,
    entityType: type,
    x: 0,
    y: 0,
    ...overrides,
  } as EntitySnapshot;

  return {
    id,
    entityType: type,
    toSnapshot: () => ({ ...baseSnapshot }),
  };
}

function createMockChampion(id: string, overrides: Partial<ChampionSnapshot> = {}) {
  const snapshot = {
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
    abilities: {} as ChampionSnapshot['abilities'],
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
  } as ChampionSnapshot;

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

    it('should send nothing for a dead champion and its full snapshot when it respawns', () => {
      const playerId = 'player-1';
      serializer.createDeltaUpdates([createMockChampion('champ-1', { x: 100, y: 100 })] as any, playerId, 1);

      // Dies: the client is told, then removes the champion
      const death = serializer.createDeltaUpdates(
        [createMockChampion('champ-1', { x: 100, y: 100, health: 0, isDead: true, respawnTimer: 10 })] as any, playerId, 2);
      expect((death[0].data as any).isDead).toBe(true);

      // While dead its respawn timer counts down, but the client has no champion to update
      const whileDead = serializer.createDeltaUpdates(
        [createMockChampion('champ-1', { x: 100, y: 100, health: 0, isDead: true, respawnTimer: 9 })] as any, playerId, 3);
      expect(whileDead).toEqual([]);

      // Respawns at the fountain: the client rebuilds it, so it needs every field
      const respawn = serializer.createDeltaUpdates(
        [createMockChampion('champ-1', { x: -1440, y: 1440, isDead: false })] as any, playerId, 4);
      expect(respawn[0].changeMask).toBe(0xFFFF);
      expect((respawn[0].data as ChampionSnapshot).championId).toBe('warrior');
      expect((respawn[0].data as ChampionSnapshot).level).toBe(1);
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

    it('should send champion stats when they change', () => {
      const playerId = 'player-1';
      serializer.createDeltaUpdates([createMockChampion('champ-1', { movementSpeed: 58 })] as any, playerId, 1);

      // Bought boots
      const [delta] = serializer.createDeltaUpdates([createMockChampion('champ-1', { movementSpeed: 83 })] as any, playerId, 2);
      expect(delta.changeMask & EntityChangeMask.STATS).toBeTruthy();
      expect((delta.data as ChampionSnapshot).movementSpeed).toBe(83);
      expect((delta.data as ChampionSnapshot).attackDamage).toBe(60);
    });

    it('should send kills, deaths, assists and creep score when they change', () => {
      const playerId = 'player-1';
      serializer.createDeltaUpdates([createMockChampion('champ-1')] as any, playerId, 1);

      // A last hit, then a kill
      let [delta] = serializer.createDeltaUpdates([createMockChampion('champ-1', { cs: 1 })] as any, playerId, 2);
      expect(delta.changeMask & EntityChangeMask.SCORE).toBeTruthy();
      expect((delta.data as ChampionSnapshot).cs).toBe(1);

      [delta] = serializer.createDeltaUpdates([createMockChampion('champ-1', { cs: 1, kills: 1 })] as any, playerId, 3);
      expect((delta.data as ChampionSnapshot).kills).toBe(1);
      expect((delta.data as ChampionSnapshot).cs).toBe(1);
    });

    it('should send the dash state when a dash starts and ends', () => {
      const playerId = 'player-1';
      serializer.createDeltaUpdates([createMockChampion('champ-1', { isDashing: false, dashAbilityId: null })] as any, playerId, 1);

      let [delta] = serializer.createDeltaUpdates([createMockChampion('champ-1', { isDashing: true, dashAbilityId: 'vex_dash', dashTargetX: 100, dashTargetY: 0 })] as any, playerId, 2);
      expect(delta.changeMask & EntityChangeMask.DASH).toBeTruthy();
      expect((delta.data as ChampionSnapshot).isDashing).toBe(true);
      expect((delta.data as ChampionSnapshot).dashAbilityId).toBe('vex_dash');

      [delta] = serializer.createDeltaUpdates([createMockChampion('champ-1', { isDashing: false, dashAbilityId: null, dashTargetX: null, dashTargetY: null })] as any, playerId, 3);
      expect((delta.data as ChampionSnapshot).isDashing).toBe(false);
      expect((delta.data as ChampionSnapshot).dashTargetX).toBeNull();
    });

    it("should send any changed field of a projectile, zone, ward or Lume's orb", () => {
      const playerId = 'player-1';
      const orb = (overrides: Record<string, unknown>) =>
        createMockEntity('orb-1', EntityType.LIGHT_ORB, { state: 'orbiting', isDead: false, targetX: 50, ...overrides } as any);
      serializer.createDeltaUpdates([orb({})] as any, playerId, 1);

      // Lume's R destroys the orb: it stays in the game, dead, until it comes back
      const [delta] = serializer.createDeltaUpdates([orb({ state: 'destroyed', isDead: true, targetX: undefined })] as any, playerId, 2);
      expect(delta.changeMask & EntityChangeMask.STATE).toBeTruthy();
      expect((delta.data as any).state).toBe('destroyed');
      expect((delta.data as any).isDead).toBe(true);
      expect((delta.data as any).targetX).toBeNull();

      const zone = (remainingDuration: number) => createMockEntity('zone-1', EntityType.ZONE, { remainingDuration } as any);
      serializer.createDeltaUpdates([zone(3)] as any, playerId, 3);
      const [zoneDelta] = serializer.createDeltaUpdates([zone(2.9)] as any, playerId, 4);
      expect((zoneDelta.data as any).remainingDuration).toBe(2.9);
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

    it("should send a minion's move target when it stops, starts or drifts far, not every tick", () => {
      const playerId = 'player-1';
      const targetOf = (deltas: ReturnType<StateSerializer['createDeltaUpdates']>) =>
        deltas[0] && deltas[0].changeMask & EntityChangeMask.TARGET ? (deltas[0].data as MinionSnapshot) : null;
      serializer.createDeltaUpdates([createMockMinion('m-1', { targetX: 120, targetY: 0 })] as any, playerId, 1);

      // Following the lane: the target slides ahead a little every tick
      for (let tick = 2; tick <= 4; tick++) {
        const deltas = serializer.createDeltaUpdates(
          [createMockMinion('m-1', { x: tick * 10, targetX: 120 + tick * 10, targetY: 0 })] as any, playerId, tick);
        expect(targetOf(deltas)).toBeNull();
      }
      // Far enough from the target the client has (120): sent again
      const drifted = targetOf(serializer.createDeltaUpdates(
        [createMockMinion('m-1', { x: 50, targetX: 180, targetY: 0 })] as any, playerId, 5));
      expect(drifted?.targetX).toBe(180);

      // Reached attack range: stopped, even though its attack target didn't change
      const stopped = targetOf(serializer.createDeltaUpdates(
        [createMockMinion('m-1', { x: 60, targetX: null, targetY: null })] as any, playerId, 7));
      expect(stopped).not.toBeNull();
      expect(stopped!.targetX).toBeNull();

      const started = targetOf(serializer.createDeltaUpdates(
        [createMockMinion('m-1', { x: 60, targetX: 200, targetY: 0 })] as any, playerId, 8));
      expect(started?.targetX).toBe(200);
    });

    it('should tell clients a jungle creature is neutral', () => {
      const creature = new ServerJungleCreature({
        id: 'thornspitter-1',
        position: new Vector(0, 0),
        campId: 'camp',
        creatureType: 'thornspitter',
        homePosition: new Vector(0, 0),
      });
      const [delta] = serializer.createDeltaUpdates([creature], 'player-1', 1);
      expect((delta.data as JungleCreatureSnapshot).side).toBe(2);
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

    it('should tell an entity that left sight apart from one that is gone', () => {
      const playerId = 'player-1';
      const inGame = new Set(['champ-1', 'minion-1']);
      const isInGame = (id: string) => inGame.has(id);
      const all = [createMockChampion('champ-1'), createMockMinion('minion-1')];
      serializer.createDeltaUpdates(all as any, playerId, 1, all as any, isInGame);

      // The champion walks into fog: still in the game, just not visible
      const visible = [createMockMinion('minion-1')];
      const [hidden] = serializer.createDeltaUpdates(visible as any, playerId, 2, visible as any, isInGame);
      expect(hidden.entityId).toBe('champ-1');
      expect((hidden.data as any).outOfSight).toBe(true);
      expect((hidden.data as any).isDead).toBeUndefined();

      // The minion dies and is removed from the game
      inGame.delete('minion-1');
      const [gone] = serializer.createDeltaUpdates([], playerId, 3, [], isInGame);
      expect(gone.entityId).toBe('minion-1');
      expect((gone.data as any).isDead).toBe(true);
      expect((gone.data as any).outOfSight).toBeUndefined();
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
      let entities: unknown[] = [createMockChampion('entity-1')];
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
