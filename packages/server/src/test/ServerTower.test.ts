/**
 * ServerTower tests.
 * Tests tower targeting, damage, and warmup mechanics.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ServerTower } from '../simulation/ServerTower';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerWard } from '../simulation/ServerWard';
import { ServerBlossom } from '../simulation/ServerBlossom';
import { ServerGameContext } from '../game/ServerGameContext';
import { Vector, EntityType, Side, CHAMPION_DEFINITIONS, TEAM_RED, TEAM_BLUE, MAPS } from '@siege/shared';
import { DEFAULT_TOWER_STATS } from '@siege/shared';
import { TestChampion } from './ServerTestUtils';

describe('ServerTower', () => {
  let context: ServerGameContext;

  beforeEach(() => {
    context = new ServerGameContext({ gameId: 'test-game' });
  });

  describe('Construction', () => {
    it('should create a tier 1 tower with correct stats', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      expect(tower.id).toBe('tower-1');
      expect(tower.entityType).toBe(EntityType.TOWER);
      expect(tower.side).toBe(0);
      expect(tower.lane).toBe('mid');
      expect(tower.tier).toBe(1);
      expect(tower.health).toBe(DEFAULT_TOWER_STATS[1].health);
      expect(tower.maxHealth).toBe(DEFAULT_TOWER_STATS[1].maxHealth);
    });

    it('should create towers with tier-specific stats', () => {
      const tower1 = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const tower2 = new ServerTower({
        id: 'tower-2',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 2,
      });

      const tower3 = new ServerTower({
        id: 'tower-3',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 3,
      });

      expect(tower1.health).toBe(DEFAULT_TOWER_STATS[1].health);
      expect(tower2.health).toBe(DEFAULT_TOWER_STATS[2].health);
      expect(tower3.health).toBe(DEFAULT_TOWER_STATS[3].health);
    });
  });

  describe('Combat', () => {
    it('should take damage', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const initialHealth = tower.health;
      tower.takeDamage(500, 'physical');

      expect(tower.health).toBeLessThan(initialHealth);
    });

    it('should reduce physical damage with armor', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const initialHealth = tower.health;
      const armor = DEFAULT_TOWER_STATS[1].armor;
      tower.takeDamage(100, 'physical');

      const expectedDamage = 100 * (1 - armor / (100 + armor));
      expect(tower.health).toBeCloseTo(initialHealth - expectedDamage, 1);
    });

    it('should be destroyed when health reaches 0', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      tower.takeDamage(100000, 'true');

      expect(tower.isDead).toBe(true);
      expect(tower.isDestroyed).toBe(true);
      expect(tower.health).toBe(0);
    });
  });

  describe('Shots', () => {
    /** The damage of each shot the tower fires at the target over `seconds` */
    function shotsAt(target: TestChampion | ServerMinion, seconds: number, startMinute = 0): number[] {
      const tower = new ServerTower({ id: 'tower-1', position: new Vector(0, 0), side: 0, lane: 'mid', tier: 1 });
      context.addEntity(tower);
      context.addEntity(target);
      context.advanceTime(startMinute * 60);
      const damages: number[] = [];
      const addEntity = context.addEntity.bind(context);
      context.addEntity = ((entity: any) => {
        if (entity.sourceId === tower.id && typeof entity.damage === 'number') damages.push(Math.round(entity.damage));
        return addEntity(entity);
      }) as typeof context.addEntity;
      for (let t = 0; t < seconds; t += 0.05) {
        tower.update(0.05, context);
        target.health = target.maxHealth; // keep it alive
      }
      return damages;
    }

    const champion = () => new TestChampion({
      id: 'champion-1', position: new Vector(100, 0), side: TEAM_RED, playerId: 'player-1', definition: CHAMPION_DEFINITIONS['warrior'],
    });

    it('shoots every 1.2 seconds, +30% for each shot in a row up to +120%', () => {
      const shots = shotsAt(champion(), 7);
      expect(shots.length).toBe(6); // at 0, 1.2, 2.4, 3.6, 4.8 and 6.0
      const base = DEFAULT_TOWER_STATS[1].attackDamage;
      expect(shots.slice(0, 6)).toEqual([1, 1.3, 1.6, 1.9, 2.2, 2.2].map(m => Math.round(base * m)));
    });

    it('hits champions harder as the game goes on, up to its cap; minions always take the starting damage', () => {
      const stats = DEFAULT_TOWER_STATS[1];
      expect(shotsAt(champion(), 0.1, 10)[0]).toBe(Math.round(stats.attackDamage + stats.championDamagePerMinute * 10));
      context = new ServerGameContext({ gameId: 'test-game' });
      expect(shotsAt(champion(), 0.1, 60)[0]).toBe(stats.maxChampionDamage);
      context = new ServerGameContext({ gameId: 'test-game' });
      const minion = new ServerMinion({ id: 'minion-1', position: new Vector(100, 0), side: 1, minionType: 'melee', lane: 'mid', waypoints: [] });
      expect(shotsAt(minion, 0.1, 30)[0]).toBe(stats.attackDamage);
    });
  });

  describe('Targeting', () => {
    it('should not attack allies', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const allyMinion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(100, 0),
        side: 0, // Same side as tower
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(tower);
      context.addEntity(allyMinion);

      // Update tower
      tower.update(0.1, context);

      // Tower should not target ally
      const snapshot = tower.toSnapshot();
      expect(snapshot.targetEntityId).toBeNull();
    });

    it('should attack enemy in range', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const enemyMinion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(100, 0), // Within attack range
        side: 1, // Different side
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(tower);
      context.addEntity(enemyMinion);

      // Need to update context first to register fog of war
      context.update(0.1);

      // Tower should find and target enemy
      tower.update(0.1, context);

      const snapshot = tower.toSnapshot();
      expect(snapshot.targetEntityId).toBe('minion-1');
    });

    it('should prioritize minions over champions', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const enemyMinion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(200, 0), // Farther but still in range
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      const enemyChampion = new TestChampion({
        id: 'champion-1',
        position: new Vector(100, 0), // Closer than minion
        side: TEAM_RED,
        playerId: 'player-1',
        definition: CHAMPION_DEFINITIONS['warrior'],
      });

      context.addEntity(tower);
      context.addEntity(enemyMinion);
      context.addEntity(enemyChampion);
      context.update(0.1);

      tower.update(0.1, context);

      // Tower should target minion even though champion is closer
      const snapshot = tower.toSnapshot();
      expect(snapshot.targetEntityId).toBe('minion-1');
    });

    it('should keep shooting its minion when another walks closer', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });
      const first = new ServerMinion({
        id: 'minion-1',
        position: new Vector(300, 0),
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });
      context.addEntity(tower);
      context.addEntity(first);
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('minion-1');

      // A second minion now stands closer than the first
      const second = new ServerMinion({
        id: 'minion-2',
        position: new Vector(100, 0),
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });
      context.addEntity(second);
      tower.update(0.1, context);

      expect(tower.toSnapshot().targetEntityId).toBe('minion-1');
    });

    it('should target champion if no minions in range', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const enemyChampion = new TestChampion({
        id: 'champion-1',
        position: new Vector(100, 0),
        side: TEAM_RED,
        playerId: 'player-1',
        definition: CHAMPION_DEFINITIONS['warrior'],
      });

      context.addEntity(tower);
      context.addEntity(enemyChampion);
      context.update(0.1);

      tower.update(0.1, context);

      // Tower should target champion when no minions present
      const snapshot = tower.toSnapshot();
      expect(snapshot.targetEntityId).toBe('champion-1');
    });

    it('should not shoot wards or blossoms', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });
      context.addEntity(tower);
      context.addEntity(new ServerWard({
        id: 'red-ward',
        position: new Vector(100, 0),
        side: TEAM_RED,
        wardType: 'stealth',
        ownerId: 'player-1',
      }));
      context.addEntity(new ServerBlossom({ id: 'blossom', position: new Vector(150, 0) }, MAPS.narrows.BLOSSOMS));
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBeNull();

      // A champion walking in is shot
      context.addEntity(new TestChampion({
        id: 'champion-1',
        position: new Vector(250, 0),
        side: TEAM_RED,
        playerId: 'player-1',
        definition: CHAMPION_DEFINITIONS['warrior'],
      }));
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('champion-1');
    });

    it('should target champion with aggro over minions', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const enemyMinion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(100, 0),
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      const enemyChampion = new TestChampion({
        id: 'champion-1',
        position: new Vector(200, 0),
        side: TEAM_RED,
        playerId: 'player-1',
        definition: CHAMPION_DEFINITIONS['warrior'],
      });

      context.addEntity(tower);
      context.addEntity(enemyMinion);
      context.addEntity(enemyChampion);
      context.update(0.1);

      // Trigger aggro on the champion (simulating champion damaging allied champion)
      tower.triggerAggro('champion-1');

      tower.update(0.1, context);

      // Tower should now target champion with aggro despite minion being closer
      const snapshot = tower.toSnapshot();
      expect(snapshot.targetEntityId).toBe('champion-1');
    });

    it('should keep shooting the champion after aggro expires', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const enemyMinion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(100, 0),
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      const enemyChampion = new TestChampion({
        id: 'champion-1',
        position: new Vector(200, 0),
        side: TEAM_RED,
        playerId: 'player-1',
        definition: CHAMPION_DEFINITIONS['warrior'],
      });

      context.addEntity(tower);
      context.addEntity(enemyMinion);
      context.addEntity(enemyChampion);
      context.update(0.1);

      // Trigger aggro
      tower.triggerAggro('champion-1');
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('champion-1');

      // Wait for aggro to expire (3 seconds + buffer)
      for (let i = 0; i < 35; i++) {
        tower.update(0.1, context);
      }

      // Aggro is gone, but the champion is still in range: it stays the target
      expect(tower.hasAggro('champion-1')).toBe(false);
      expect(tower.toSnapshot().targetEntityId).toBe('champion-1');

      // Out of range, the tower goes back to the minion
      enemyChampion.position = new Vector(2000, 0);
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('minion-1');
    });

    it('should keep shooting a champion when a minion walks in', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });
      context.addEntity(tower);
      context.addEntity(new TestChampion({
        id: 'champion-1',
        position: new Vector(200, 0),
        side: TEAM_RED,
        playerId: 'player-1',
        definition: CHAMPION_DEFINITIONS['warrior'],
      }));
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('champion-1');

      context.addEntity(new ServerMinion({
        id: 'minion-1',
        position: new Vector(100, 0),
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      }));
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('champion-1');
    });

    it('should switch from a minion to a champion that hit an ally', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });
      context.addEntity(tower);
      context.addEntity(new ServerMinion({
        id: 'minion-1',
        position: new Vector(100, 0),
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      }));
      context.addEntity(new TestChampion({
        id: 'champion-1',
        position: new Vector(200, 0),
        side: TEAM_RED,
        playerId: 'player-1',
        definition: CHAMPION_DEFINITIONS['warrior'],
      }));
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('minion-1');

      tower.triggerAggro('champion-1');
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('champion-1');
    });
  });

  describe('Aggro', () => {
    it('should shoot a champion that hit an ally under it from outside its range, once it walks in', () => {
      const tower = new ServerTower({ id: 'tower-1', position: new Vector(0, 0), side: 0, lane: 'mid', tier: 1 });
      const ally = new TestChampion({
        id: 'ally', position: new Vector(200, 0), side: TEAM_BLUE, playerId: 'player-ally',
        definition: CHAMPION_DEFINITIONS['warrior'],
      });
      const enemy = new TestChampion({
        id: 'enemy', position: new Vector(420, 0), side: TEAM_RED, playerId: 'player-enemy',
        definition: CHAMPION_DEFINITIONS['warrior'],
      });
      const minion = new ServerMinion({
        id: 'minion-1', position: new Vector(150, 100), side: 1, minionType: 'melee', lane: 'mid', waypoints: [],
      });
      for (const entity of [tower, ally, enemy, minion]) context.addEntity(entity);
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('minion-1');

      // Hit from out of the tower's range: the ally is in it
      expect(tower.isInRange(enemy)).toBe(false);
      ally.takeDamage(30, 'physical', 'enemy', context);
      expect(tower.hasAggro('enemy')).toBe(true);
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('minion-1');

      // It walks in to chase
      enemy.position = new Vector(320, 0);
      tower.update(0.1, context);
      expect(tower.toSnapshot().targetEntityId).toBe('enemy');
    });

    it('should not aggro on a fight away from it', () => {
      const tower = new ServerTower({ id: 'tower-1', position: new Vector(0, 0), side: 0, lane: 'mid', tier: 1 });
      const ally = new TestChampion({
        id: 'ally', position: new Vector(900, 0), side: TEAM_BLUE, playerId: 'player-ally',
        definition: CHAMPION_DEFINITIONS['warrior'],
      });
      const enemy = new TestChampion({
        id: 'enemy', position: new Vector(1000, 0), side: TEAM_RED, playerId: 'player-enemy',
        definition: CHAMPION_DEFINITIONS['warrior'],
      });
      for (const entity of [tower, ally, enemy]) context.addEntity(entity);
      ally.takeDamage(30, 'physical', 'enemy', context);
      expect(tower.hasAggro('enemy')).toBe(false);
    });
  });

  describe('Snapshot', () => {
    it('should create correct snapshot', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(500, -600),
        side: 1,
        lane: 'bot',
        tier: 2,
      });

      const snapshot = tower.toSnapshot();

      expect(snapshot.entityId).toBe('tower-1');
      expect(snapshot.entityType).toBe(EntityType.TOWER);
      expect(snapshot.side).toBe(1);
      expect(snapshot.lane).toBe('bot');
      expect(snapshot.tier).toBe(2);
      expect(snapshot.x).toBe(500);
      expect(snapshot.y).toBe(-600);
      expect(snapshot.health).toBe(DEFAULT_TOWER_STATS[2].health);
      expect(snapshot.isDestroyed).toBe(false);
    });
  });
});
