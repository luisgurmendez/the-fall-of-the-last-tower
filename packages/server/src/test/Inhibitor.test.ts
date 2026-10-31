/**
 * Inhibitors: one per lane per side. They fall after their lane's towers,
 * open the nexus, bring super minions to the enemy's waves in their lane
 * while down, and rebuild.
 */
import './ServerTestUtils';
import { describe, test, expect, afterEach } from 'bun:test';
import { EntityType, GameEventType, InputType, MOBAConfig, Vector, type LaneId, type Side } from '@siege/shared';
import { Simulation } from '../sim';
import { ServerGameContext } from '../game/ServerGameContext';
import { StateSerializer } from '../network/StateSerializer';
import { ServerInhibitor } from '../simulation/ServerInhibitor';
import { ServerTower } from '../simulation/ServerTower';
import type { ServerMinion } from '../simulation/ServerMinion';
import type { ServerEntity } from '../simulation/ServerEntity';

const STATS = MOBAConfig.INHIBITORS.STATS;

let sim: Simulation;

afterEach(() => sim?.dispose());

function newSim(): Simulation {
  sim = new Simulation({ seed: 1, minionWaves: false, jungle: false });
  return sim;
}

function inhibitor(side: Side, lane: LaneId): ServerInhibitor {
  return sim.context.getAllEntities().find(e =>
    e.entityType === EntityType.INHIBITOR && e.side === side && (e as ServerInhibitor).lane === lane
  ) as ServerInhibitor;
}

function nexus(side: Side): ServerEntity & { isProtected: boolean } {
  return sim.context.getAllEntities().find(e => e.entityType === EntityType.NEXUS && e.side === side) as ServerEntity & { isProtected: boolean };
}

function destroy(entity: ServerEntity, sourceId?: string): void {
  entity.takeDamage(entity.health + 1, 'true', sourceId, sim.context);
}

/** Destroy a lane's towers, outer first */
function openLane(side: Side, lane: LaneId): void {
  const towers = sim.context.getAllEntities()
    .filter(e => e.entityType === EntityType.TOWER && e.side === side && (e as ServerTower).lane === lane)
    .sort((a, b) => (a as ServerTower).tier - (b as ServerTower).tier);
  for (const tower of towers) destroy(tower);
}

function minions(side: Side, lane: LaneId): ServerMinion[] {
  return sim.context.getAllEntities().filter(e =>
    e.entityType === EntityType.MINION && e.side === side && (e as ServerMinion).lane === lane
  ) as ServerMinion[];
}

function events(type: GameEventType) {
  return sim.recorder.events.filter(event => event.type === type);
}

describe('Inhibitors', () => {
  test('one per lane per side, where the map config puts them', () => {
    newSim();
    sim.tick();
    const all = sim.context.getAllEntities().filter(e => e.entityType === EntityType.INHIBITOR) as ServerInhibitor[];
    expect(all).toHaveLength(6);
    for (const config of MOBAConfig.INHIBITORS.POSITIONS) {
      const found = inhibitor(config.side, config.lane);
      expect(found.position.x).toBe(config.position.x);
      expect(found.position.y).toBe(config.position.y);
      expect(found.health).toBe(STATS.health);
      expect(found.maxHealth).toBe(STATS.health);
      expect(found.isCollidable()).toBe(true);
      expect(found.isProtected).toBe(true);
      expect(sim.context.getStructures()).toContain(found);
    }
  });

  test('can only be damaged once every tower of its lane is down', () => {
    newSim();
    const mid = inhibitor(1, 'mid');
    const towers = sim.context.getAllEntities()
      .filter(e => e.entityType === EntityType.TOWER && e.side === 1 && (e as ServerTower).lane === 'mid')
      .sort((a, b) => (a as ServerTower).tier - (b as ServerTower).tier);

    expect(mid.takeDamage(500, 'true', undefined, sim.context)).toBe(0);
    destroy(towers[0]);
    expect(mid.takeDamage(500, 'true', undefined, sim.context)).toBe(0);
    destroy(towers[1]);
    expect(mid.takeDamage(500, 'true', undefined, sim.context)).toBe(500);
    // Another lane's inhibitor is still protected by its towers
    expect(inhibitor(1, 'top').takeDamage(500, 'true', undefined, sim.context)).toBe(0);

    sim.tick();
    expect(mid.isProtected).toBe(false);
    expect(inhibitor(1, 'top').isProtected).toBe(true);
  });

  test('the nexus can only be damaged once one of its inhibitors is down', () => {
    newSim();
    // A lane without towers no longer opens the nexus
    openLane(1, 'mid');
    sim.tick();
    expect(nexus(1).takeDamage(500, 'true', undefined, sim.context)).toBe(0);
    expect(nexus(1).isProtected).toBe(true);

    destroy(inhibitor(1, 'mid'));
    expect(nexus(1).takeDamage(500, 'true', undefined, sim.context)).toBeGreaterThan(0);
    sim.tick();
    expect(nexus(1).isProtected).toBe(false);
    // The other nexus is still protected
    expect(nexus(0).isProtected).toBe(true);
  });

  test('a destroyed inhibitor stays in the game, not solid, and its killer gets 50 gold and no experience', () => {
    newSim();
    const killer = sim.addChampion({ playerId: 'blue', championId: 'warrior', side: 'blue', at: { x: 1500, y: -1500 } });
    openLane(1, 'mid');
    const mid = inhibitor(1, 'mid');

    const gold = killer.gold;
    const experience = killer.experience;
    destroy(mid, killer.id);
    expect(killer.gold - gold).toBe(STATS.goldReward);
    expect(killer.experience).toBe(experience);

    expect(sim.context.getEntity(mid.id)).toBe(mid);
    expect(mid.isDead).toBe(true);
    expect(mid.isDestroyed).toBe(true);
    expect(mid.isCollidable()).toBe(false);
    expect(mid.health).toBe(0);
    const destroyedAt = sim.time;
    expect(mid.respawnAt).toBe(destroyedAt + STATS.respawnTime);

    // Hitting it again doesn't destroy it twice
    mid.takeDamage(1000, 'true', killer.id, sim.context);
    sim.tick();
    const destroyed = events(GameEventType.INHIBITOR_DESTROYED);
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0].data).toEqual({ inhibitorId: mid.id, side: 1, lane: 'mid', respawnAt: destroyedAt + STATS.respawnTime });
    expect(mid.toSnapshot()).toMatchObject({ isDestroyed: true, respawnAt: destroyedAt + STATS.respawnTime, health: 0 });
  });

  test('rebuilds at full health after its respawn time, and the nexus is protected again', () => {
    newSim();
    openLane(1, 'mid');
    const mid = inhibitor(1, 'mid');
    destroy(mid);
    const respawnAt = mid.respawnAt!;

    sim.run(STATS.respawnTime - 1);
    expect(mid.isDead).toBe(true);
    expect(sim.runUntil(() => !mid.isDead, 2)).toBe(true);
    expect(sim.time).toBeGreaterThanOrEqual(respawnAt - 1e-6);
    expect(sim.time).toBeLessThan(respawnAt + 0.1);

    expect(mid.health).toBe(STATS.health);
    expect(mid.isCollidable()).toBe(true);
    expect(mid.respawnAt).toBeNull();
    expect(mid.toSnapshot()).toMatchObject({ isDestroyed: false, respawnAt: null, health: STATS.health });
    expect(sim.context.getStructures()).toContain(mid);

    sim.tick();
    const respawned = events(GameEventType.INHIBITOR_RESPAWNED);
    expect(respawned).toHaveLength(1);
    expect(respawned[0].data).toEqual({ inhibitorId: mid.id, side: 1, lane: 'mid' });

    expect(nexus(1).isProtected).toBe(true);
    expect(nexus(1).takeDamage(500, 'true', undefined, sim.context)).toBe(0);
    expect(sim.context.getSuperMinionCount(0, 'mid')).toBe(0);
    // Its towers are still down, so it can be destroyed again right away
    expect(mid.isProtected).toBe(false);
    expect(mid.takeDamage(500, 'true', undefined, sim.context)).toBe(500);
  });
});

describe('Super minions', () => {
  test('while an inhibitor is down, the enemy\'s waves in its lane bring a super minion in front instead of the siege minion', () => {
    newSim();
    openLane(0, 'mid');
    destroy(inhibitor(0, 'mid'));

    sim.context.spawnLaneWave(1, 'mid', { siege: true });
    const wave = minions(1, 'mid');
    const types = wave.map(minion => minion.minionType);
    expect(types.filter(type => type === 'super')).toHaveLength(1);
    expect(types).not.toContain('siege');
    expect(types.filter(type => type === 'melee')).toHaveLength(MOBAConfig.MINION_WAVES.WAVE_COMPOSITION.swordsmen);
    expect(types.filter(type => type === 'caster')).toHaveLength(MOBAConfig.MINION_WAVES.WAVE_COMPOSITION.archers);

    // In front: the furthest from red's nexus
    const fromNexus = (minion: ServerMinion) => minion.position.distanceTo(new Vector(MOBAConfig.NEXUS.RED.x, MOBAConfig.NEXUS.RED.y));
    const front = wave.reduce((a, b) => (fromNexus(a) >= fromNexus(b) ? a : b));
    expect(front.minionType).toBe('super');

    // Other lanes, and the side whose inhibitors stand, are unchanged
    sim.context.spawnLaneWave(1, 'top', { siege: true });
    expect(minions(1, 'top').map(minion => minion.minionType)).toContain('siege');
    expect(minions(1, 'top').map(minion => minion.minionType)).not.toContain('super');
    sim.context.spawnLaneWave(0, 'mid', { siege: true });
    expect(minions(0, 'mid').map(minion => minion.minionType)).not.toContain('super');
  });

  test('two super minions per wave in every lane once all three of the enemy\'s inhibitors are down', () => {
    newSim();
    for (const lane of ['top', 'mid', 'bot'] as LaneId[]) {
      openLane(0, lane);
      destroy(inhibitor(0, lane));
    }
    for (const lane of ['top', 'mid', 'bot'] as LaneId[]) {
      expect(sim.context.getSuperMinionCount(1, lane)).toBe(2);
      expect(sim.context.getSuperMinionCount(0, lane)).toBe(0);
    }

    sim.context.spawnLaneWave(1, 'bot', { siege: true });
    const supers = minions(1, 'bot').filter(minion => minion.minionType === 'super');
    expect(supers).toHaveLength(2);
    expect(minions(1, 'bot').map(minion => minion.minionType)).not.toContain('siege');
    // Side by side, not on top of each other
    expect(supers[0].position.distanceTo(supers[1].position)).toBeGreaterThanOrEqual(supers[0].getRadius() * 2);
  });

  test('the wave timer brings them too', () => {
    sim = new Simulation({ seed: 1, minionWaves: true, jungle: false });
    openLane(0, 'top');
    destroy(inhibitor(0, 'top'));
    sim.run(MOBAConfig.MINION_WAVES.FIRST_WAVE_DELAY + 1);
    expect(minions(1, 'top').map(minion => minion.minionType)).toContain('super');
    expect(minions(1, 'mid').map(minion => minion.minionType)).not.toContain('super');
  });
});

describe('Fighting inhibitors', () => {
  test('a champion can basic-attack one once its lane is open, and attack-move picks it up', () => {
    newSim();
    openLane(0, 'mid');
    const mid = inhibitor(0, 'mid');
    sim.addChampion({ playerId: 'red', championId: 'warrior', side: 'red', at: { x: mid.position.x + 150, y: mid.position.y - 150 } });

    expect(sim.attack('red', mid.id)).toBe(true);
    sim.run(4);
    expect(sim.champion('red').targetEntityId).toBe(mid.id);
    expect(mid.health).toBeLessThan(STATS.health);

    // Attack-move stops at it too
    sim.stop('red');
    sim.run(0.2);
    const health = mid.health;
    sim.input('red', { type: InputType.ATTACK_MOVE, targetX: -2400, targetY: 2400 });
    sim.run(4);
    expect(mid.health).toBeLessThan(health);
  });

  test('enemy minions attack it once their path reaches it', () => {
    newSim();
    openLane(0, 'mid');
    const mid = inhibitor(0, 'mid');
    sim.addMinion({ side: 'red', lane: 'mid', at: { x: mid.position.x + 100, y: mid.position.y - 100 }, type: 'melee' });
    sim.run(4);
    expect(mid.health).toBeLessThan(STATS.health);
  });

  test('towers don\'t shoot inhibitors', () => {
    const context = new ServerGameContext({ gameId: 'inhibitor-tower', minionWaves: false });
    const tower = new ServerTower({ id: 'tower', position: new Vector(0, 0), side: 1, lane: 'mid', tier: 1 });
    const target = new ServerInhibitor({ id: 'inhibitor', position: new Vector(150, 0), side: 0, lane: 'mid' });
    context.addEntity(tower);
    context.addEntity(target);
    for (let i = 0; i < 90; i++) context.update(1 / 30);
    expect(tower.getAttackTargetId()).toBeNull();
    expect(target.health).toBe(STATS.health);
  });

  test('both sides always see every inhibitor', () => {
    newSim();
    sim.tick();
    for (const config of MOBAConfig.INHIBITORS.POSITIONS) {
      expect(sim.context.isVisibleTo(inhibitor(config.side, config.lane), (1 - config.side) as Side)).toBe(true);
    }
  });
});

describe('Inhibitor deltas', () => {
  test('clients are told when it falls (health, isDestroyed, respawnAt) and when it rebuilds (respawnAt cleared with null)', () => {
    newSim();
    const serializer = new StateSerializer();
    const mid = inhibitor(1, 'mid');
    const send = () => serializer.createDeltaUpdates([mid], 'player', sim.context.getTick())
      .find(delta => delta.entityId === mid.id)?.data as Record<string, unknown> | undefined;

    sim.tick();
    expect(send()).toMatchObject({ entityType: EntityType.INHIBITOR, lane: 'mid', isDestroyed: false, respawnAt: null, isProtected: true });
    sim.tick();
    expect(send()).toBeUndefined(); // Nothing changed

    openLane(1, 'mid');
    sim.tick();
    expect(send()).toMatchObject({ isProtected: false });

    destroy(mid);
    sim.tick();
    const fell = send()!;
    expect(fell).toMatchObject({ health: 0, isDestroyed: true, respawnAt: mid.respawnAt });
    expect('isDead' in fell).toBe(false);

    sim.runUntil(() => !mid.isDead, STATS.respawnTime + 1);
    const rebuilt = send()!;
    expect(rebuilt).toMatchObject({ health: STATS.health, isDestroyed: false });
    expect('respawnAt' in rebuilt && rebuilt.respawnAt === null).toBe(true);
  });
});
