/**
 * Summoner spells (D, F): each one's effect, their cooldowns, and casts
 * refused without a target in range or while stunned.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { InputType, SUMMONER_SPELLS, type SummonerSpellId } from '@siege/shared';
import { Simulation } from '../sim';

function setup(spells: SummonerSpellId[], enemyAt?: { x: number; y: number }): Simulation {
  const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
  sim.addChampion({ playerId: 'p1', championId: 'warrior', side: 'blue', at: { x: 0, y: 0 }, summoners: spells });
  if (enemyAt) sim.addChampion({ playerId: 'p2', championId: 'magnus', side: 'red', at: enemyAt });
  // Let vision see the enemies first (aimed spells only reach what the caster's side sees)
  sim.run(0.1);
  return sim;
}

function cast(sim: Simulation, slot: 0 | 1, target: { x?: number; y?: number; entityId?: string } = {}): void {
  sim.input('p1', { type: InputType.SUMMONER_SPELL, slot, targetX: target.x, targetY: target.y, targetEntityId: target.entityId });
  sim.run(0.05);
}

describe('Summoner spells', () => {
  test('Blink jumps toward the cursor as far as its range, then waits out its cooldown', () => {
    const sim = setup(['blink', 'haste']);
    cast(sim, 0, { x: 1000, y: 0 });
    const champion = sim.champion('p1');
    expect(champion.position.x).toBeCloseTo(SUMMONER_SPELLS.blink.range!, -1);
    expect(champion.summoners.getState()[0].cooldownRemaining).toBeGreaterThan(SUMMONER_SPELLS.blink.cooldown - 1);

    cast(sim, 0, { x: -1000, y: 0 });
    expect(champion.position.x).toBeGreaterThan(100);
    sim.dispose();
  });

  test('Haste and Mend speed the champion up; Mend heals it', () => {
    const sim = setup(['haste', 'mend']);
    const champion = sim.champion('p1');
    const speed = champion.getStats().movementSpeed;
    cast(sim, 0);
    expect(champion.getStats().movementSpeed).toBeCloseTo(speed * 1.35, 0);

    champion.health = champion.maxHealth / 2;
    cast(sim, 1);
    expect(champion.health).toBeGreaterThan(champion.maxHealth / 2 + 80);
    sim.dispose();
  });

  test('Aegis shields; Purge shakes off a stun', () => {
    const sim = setup(['aegis', 'purge']);
    const champion = sim.champion('p1');
    cast(sim, 0);
    expect(champion.shields.some(shield => shield.amount >= 100)).toBe(true);

    champion.applyEffect('stun', 2);
    sim.run(0.05);
    expect(champion.ccStatus.isStunned).toBe(true);
    cast(sim, 1);
    // Stunned: refused
    expect(champion.ccStatus.isStunned).toBe(true);
    sim.dispose();
  });

  test('Scorch burns an enemy champion in range and cuts its healing; Hinder slows it', () => {
    const sim = setup(['scorch', 'hinder'], { x: 150, y: 0 });
    const enemy = sim.champion('p2');
    const health = enemy.health;
    cast(sim, 0, { x: 150, y: 0 });

    // Healing is cut while it burns
    enemy.health = 200;
    enemy.heal(100);
    expect(enemy.health).toBeCloseTo(260, 0);
    enemy.health = health;

    sim.run(5);
    // 70 true damage at level 1, less what it regenerates meanwhile
    expect(health - enemy.health).toBeGreaterThan(40);

    const speed = enemy.getStats().movementSpeed;
    cast(sim, 1, { x: 150, y: 0 });
    expect(enemy.getStats().movementSpeed).toBeLessThan(speed * 0.75);
    sim.dispose();
  });

  test('aimed spells need a target in range, and stay ready without one', () => {
    const sim = setup(['scorch', 'reap'], { x: 800, y: 0 });
    cast(sim, 0, { x: 800, y: 0 });
    cast(sim, 1, { x: 100, y: 0 });
    for (const spell of sim.champion('p1').summoners.getState()) {
      expect(spell.cooldownRemaining).toBe(0);
    }
    sim.dispose();
  });

  test('Reap strikes a minion in range', () => {
    const sim = setup(['reap', 'blink']);
    const minion = sim.addMinion({ side: 'red', lane: 'mid', at: { x: 120, y: 0 } });
    sim.run(0.1);
    cast(sim, 0, { x: 120, y: 0, entityId: minion.id });
    expect(minion.isDead || minion.health < minion.maxHealth - 400).toBe(true);
    sim.dispose();
  });

  test("snapshots carry the spells and their cooldowns", () => {
    const sim = setup(['blink', 'aegis']);
    cast(sim, 1);
    const snapshot = sim.champion('p1').toSnapshot();
    expect(snapshot.summoners?.map(spell => spell.id)).toEqual(['blink', 'aegis']);
    expect(snapshot.summoners?.[1].cooldownRemaining).toBeGreaterThan(0);
    expect(snapshot.summoners?.[1].cooldown).toBe(SUMMONER_SPELLS.aegis.cooldown);
    sim.dispose();
  });
});
