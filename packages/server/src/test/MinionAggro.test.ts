/**
 * Minion aggro as in League (scaled to this map): minions fight minions, and
 * only turn on a champion that harms an allied champion with a basic attack
 * or an ability aimed at that champion ("call for help"). An area ability, a
 * burn or an item doesn't call them. They notice enemies within about 220
 * (League's 500), and deal 60% of their damage to champions.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { GameEventType, InputType } from '@siege/shared';
import { Simulation } from '../sim';
import { ServerTargetedProjectile } from '../simulation/ServerTargetedProjectile';

/** A blue minion fighting a red one, a blue champion by them, a red one coming */
function setup(enemyAt = { x: 60, y: 200 }) {
  const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
  const minion = sim.addMinion({ side: 'blue', lane: 'mid', at: { x: 0, y: 100 } });
  const redMinion = sim.addMinion({ side: 'red', lane: 'mid', at: { x: 40, y: 70 } });
  // Too tough to die while the test looks
  redMinion.health = redMinion.maxHealth = 1e6;
  const ally = sim.addChampion({ playerId: 'ally', championId: 'warrior', side: 'blue', at: { x: -100, y: 200 } });
  const enemy = sim.addChampion({ playerId: 'enemy', championId: 'fenris', side: 'red', at: enemyAt });
  sim.run(0.6);
  return { sim, minion, redMinion, ally, enemy };
}

describe('Minion aggro', () => {
  test('a minion fights the enemy minion, not the champions standing by', () => {
    const { sim, minion, redMinion } = setup();
    expect(minion.getAttackTargetId()).toBe(redMinion.id);
    sim.dispose();
  });

  test("a champion's basic attack on an allied champion calls the minions on it", () => {
    const { sim, minion, ally, enemy } = setup();
    enemy.withDamageKind('basic', () => ally.takeDamage(30, 'physical', enemy.id, sim.context));
    sim.run(0.6);
    expect(minion.getAttackTargetId()).toBe(enemy.id);
    sim.dispose();
  });

  test('an ability aimed at the allied champion calls them too', () => {
    const { sim, minion, ally, enemy } = setup({ x: -40, y: 200 });
    enemy.skillPoints = 1;
    expect(enemy.levelUpAbility('Q')).toBe(true);
    expect(sim.cast('enemy', 'Q', ally.id)).toBe(true);
    sim.run(0.6);
    expect(sim.recorder.events.some(e => e.type === GameEventType.ABILITY_CAST && e.data.entityId === enemy.id)).toBe(true);
    expect(minion.getAttackTargetId()).toBe(enemy.id);
    sim.dispose();
  });

  test('an area ability, a burn or an item hitting the allied champion does not', () => {
    const { sim, minion, redMinion, ally, enemy } = setup();
    ally.takeDamage(30, 'magic', enemy.id, sim.context);
    enemy.withDamageKind('item', () => ally.takeDamage(30, 'magic', enemy.id, sim.context));
    sim.run(0.6);
    expect(minion.getAttackTargetId()).toBe(redMinion.id);
    sim.dispose();
  });

  test('the call for help fades: a while after the last hit the minions go back to minions', () => {
    const { sim, minion, redMinion, ally, enemy } = setup();
    enemy.withDamageKind('basic', () => ally.takeDamage(30, 'physical', enemy.id, sim.context));
    sim.run(0.6);
    expect(minion.getAttackTargetId()).toBe(enemy.id);
    // The red champion walks off a little and stops hitting
    sim.input('enemy', { type: InputType.MOVE, targetX: 60, targetY: 320 });
    sim.run(4);
    expect(minion.getAttackTargetId()).toBe(redMinion.id);
    sim.dispose();
  });

  test('a minion notices a lone champion near it, not one across the lane', () => {
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    const minion = sim.addMinion({ side: 'blue', lane: 'mid', at: { x: 0, y: 100 } });
    // 330 away, beside its lane: out of notice
    const enemy = sim.addChampion({ playerId: 'enemy', championId: 'warrior', side: 'red', at: { x: -233, y: -133 } });
    sim.run(0.5);
    expect(minion.getAttackTargetId()).toBeNull();
    enemy.position.set(minion.position.x - 120, minion.position.y - 40);
    sim.run(0.5);
    expect(minion.getAttackTargetId()).toBe(enemy.id);
    sim.dispose();
  });

  test('minions deal 60% of their damage to champions', () => {
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    const minion = sim.addMinion({ side: 'blue', lane: 'mid', at: { x: 0, y: 100 } });
    const enemy = sim.addChampion({ playerId: 'enemy', championId: 'warrior', side: 'red', at: { x: 30, y: 100 } });
    const armor = enemy.getStats().armor;
    sim.run(3);
    const hit = sim.recorder.events.find(e => e.type === GameEventType.DAMAGE && e.data.sourceId === minion.id && e.data.entityId === enemy.id);
    expect(hit).toBeDefined();
    const attackDamage = (minion as unknown as { stats: { attackDamage: number } }).stats.attackDamage;
    expect(hit!.data.amount as number).toBeCloseTo(0.6 * attackDamage * (100 / (100 + armor)), 1);
    sim.dispose();
  });

  test("casters' bolts and cannonballs fly slower than champions' attacks (330 and 450)", () => {
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    sim.addMinion({ side: 'blue', lane: 'mid', at: { x: 0, y: 100 }, type: 'caster' });
    sim.addMinion({ side: 'blue', lane: 'mid', at: { x: -20, y: 120 }, type: 'siege' });
    const target = sim.addMinion({ side: 'red', lane: 'mid', at: { x: 120, y: -20 } });
    target.health = target.maxHealth = 1e6;
    const speeds = new Map<string, number>();
    for (let i = 0; i < 60 && speeds.size < 2; i++) {
      sim.run(0.1);
      for (const entity of sim.context.getAllEntities()) {
        if (entity instanceof ServerTargetedProjectile) speeds.set(entity.toSnapshot().abilityId as string, entity.speed);
      }
    }
    expect(speeds.get('minion_caster')).toBe(330);
    expect(speeds.get('minion_siege')).toBe(450);
    sim.dispose();
  });
});
