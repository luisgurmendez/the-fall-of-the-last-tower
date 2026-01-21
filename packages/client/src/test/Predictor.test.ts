import { describe, it, expect, beforeEach } from 'bun:test';
import { Predictor } from '../prediction/Predictor';
import {
  Vector,
  InputType,
  EntityType,
  type StateUpdate,
  type EntityDelta,
  type ChampionSnapshot,
  type MinionSnapshot,
} from '@siege/shared';

describe('Predictor', () => {
  let predictor: Predictor;
  const localPlayerId = 'player1';

  function createChampionSnapshot(
    entityId: string,
    x: number,
    y: number,
    movementSpeed: number = 325
  ): ChampionSnapshot {
    return {
      entityId,
      entityType: EntityType.CHAMPION,
      x,
      y,
      side: 0,
      championId: 'warrior',
      playerId: entityId,
      health: 1000,
      maxHealth: 1000,
      resource: 100,
      maxResource: 100,
      level: 1,
      experience: 0,
      gold: 0,
      movementSpeed,
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

  function createMinionSnapshot(entityId: string, x: number, y: number): MinionSnapshot {
    return {
      entityId,
      entityType: EntityType.MINION,
      x,
      y,
      side: 0,
      minionType: 'melee',
      health: 500,
      maxHealth: 500,
      isDead: false,
    };
  }

  function createStateUpdate(
    tick: number,
    deltas: EntityDelta[],
    inputAcks: Record<string, number> = {}
  ): StateUpdate {
    return {
      tick,
      timestamp: Date.now(),
      gameTime: tick * 33.33,
      inputAcks,
      deltas,
      events: [],
    };
  }

  beforeEach(() => {
    predictor = new Predictor({
      localPlayerId,
      interpolationDelay: 100,
      snapThreshold: 100,
      correctionThreshold: 5,
    });
  });

  describe('processStateUpdate', () => {
    it('should process local player update', () => {
      const snapshot = createChampionSnapshot(localPlayerId, 100, 200);
      const update = createStateUpdate(1, [
        { entityId: localPlayerId, changeMask: 0xFFFF, data: snapshot },
      ]);

      predictor.processStateUpdate(update);

      const pos = predictor.getLocalPlayerPosition();
      expect(pos).not.toBeNull();
      expect(pos!.x).toBe(100);
      expect(pos!.y).toBe(200);
    });

    it('should process remote entity updates', () => {
      const remoteSnapshot = createMinionSnapshot('minion1', 300, 400);
      const update = createStateUpdate(1, [
        { entityId: 'minion1', changeMask: 0xFFFF, data: remoteSnapshot },
      ]);

      predictor.processStateUpdate(update);

      const states = predictor.getEntityStates(Date.now());
      const minionState = states.find(s => s.entityId === 'minion1');
      expect(minionState).toBeDefined();
      expect(minionState!.isLocalPlayer).toBe(false);
    });

    it('should distinguish local player from remote entities', () => {
      const localSnapshot = createChampionSnapshot(localPlayerId, 100, 100);
      const remoteSnapshot = createChampionSnapshot('player2', 200, 200);

      const update = createStateUpdate(1, [
        { entityId: localPlayerId, changeMask: 0xFFFF, data: localSnapshot },
        { entityId: 'player2', changeMask: 0xFFFF, data: remoteSnapshot },
      ]);

      predictor.processStateUpdate(update);

      const states = predictor.getEntityStates(Date.now());
      const localState = states.find(s => s.entityId === localPlayerId);
      const remoteState = states.find(s => s.entityId === 'player2');

      expect(localState?.isLocalPlayer).toBe(true);
      expect(remoteState?.isLocalPlayer).toBe(false);
    });
  });

  describe('applyInput', () => {
    it('should predict movement', () => {
      // Initialize position
      predictor.setLocalPlayerPosition(new Vector(0, 0));

      const input = {
        seq: 1,
        clientTime: Date.now(),
        type: InputType.MOVE,
        targetX: 100,
        targetY: 0,
      };

      const newPos = predictor.applyInput(input);

      expect(newPos.x).toBeGreaterThan(0);
      expect(newPos.y).toBe(0);
    });

    it('should not predict non-movement inputs', () => {
      predictor.setLocalPlayerPosition(new Vector(50, 50));

      const input = {
        seq: 1,
        clientTime: Date.now(),
        type: InputType.ABILITY,
        slot: 0,
        targetType: 'none' as const,
      };

      const newPos = predictor.applyInput(input);

      expect(newPos.x).toBe(50);
      expect(newPos.y).toBe(50);
    });
  });

  describe('getEntityStates', () => {
    it('should return local player state', () => {
      const snapshot = createChampionSnapshot(localPlayerId, 100, 100);
      const update = createStateUpdate(1, [
        { entityId: localPlayerId, changeMask: 0xFFFF, data: snapshot },
      ]);

      predictor.processStateUpdate(update);

      const states = predictor.getEntityStates(Date.now());
      expect(states.length).toBeGreaterThan(0);

      const localState = states.find(s => s.isLocalPlayer);
      expect(localState).toBeDefined();
    });

    it('should return empty array when no entities', () => {
      const states = predictor.getEntityStates(Date.now());
      expect(states).toEqual([]);
    });
  });

  describe('getLocalPlayerSnapshot', () => {
    it('should return null before any updates', () => {
      expect(predictor.getLocalPlayerSnapshot()).toBeNull();
    });

    it('should return snapshot after update', () => {
      const snapshot = createChampionSnapshot(localPlayerId, 100, 100);
      const update = createStateUpdate(1, [
        { entityId: localPlayerId, changeMask: 0xFFFF, data: snapshot },
      ]);

      predictor.processStateUpdate(update);

      const returned = predictor.getLocalPlayerSnapshot();
      expect(returned).not.toBeNull();
      expect(returned!.championId).toBe('warrior');
    });
  });

  describe('removeEntity', () => {
    it('should remove local player', () => {
      const snapshot = createChampionSnapshot(localPlayerId, 100, 100);
      const update = createStateUpdate(1, [
        { entityId: localPlayerId, changeMask: 0xFFFF, data: snapshot },
      ]);

      predictor.processStateUpdate(update);
      predictor.removeEntity(localPlayerId);

      expect(predictor.getLocalPlayerSnapshot()).toBeNull();
    });

    it('should remove remote entity', () => {
      const remoteSnapshot = createMinionSnapshot('minion1', 300, 400);
      const update = createStateUpdate(1, [
        { entityId: 'minion1', changeMask: 0xFFFF, data: remoteSnapshot },
      ]);

      predictor.processStateUpdate(update);
      predictor.removeEntity('minion1');

      const states = predictor.getEntityStates(Date.now());
      const minionState = states.find(s => s.entityId === 'minion1');
      expect(minionState).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all state', () => {
      const localSnapshot = createChampionSnapshot(localPlayerId, 100, 100);
      const remoteSnapshot = createMinionSnapshot('minion1', 200, 200);

      const update = createStateUpdate(1, [
        { entityId: localPlayerId, changeMask: 0xFFFF, data: localSnapshot },
        { entityId: 'minion1', changeMask: 0xFFFF, data: remoteSnapshot },
      ]);

      predictor.processStateUpdate(update);
      predictor.clear();

      expect(predictor.getLocalPlayerSnapshot()).toBeNull();
      expect(predictor.getEntityStates(Date.now())).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return prediction statistics', () => {
      const stats = predictor.getStats();

      expect(stats.pendingInputs).toBe(0);
      expect(stats.interpolationDelay).toBe(100);
      expect(stats.lastReconciliationError).toBe(0);
    });
  });

  describe('setInterpolationDelay', () => {
    it('should update interpolation delay', () => {
      predictor.setInterpolationDelay(200);
      expect(predictor.getInterpolationDelay()).toBe(200);
    });
  });
});
