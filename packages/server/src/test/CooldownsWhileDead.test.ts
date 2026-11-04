/**
 * Cooldowns keep counting while a champion is dead: its abilities (and
 * their charges), summoner spells, trinket, item passives and passive.
 * A recast window doesn't outlive the death.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { InputType, getAbilityDefinition } from '@siege/shared';
import { Simulation } from '../sim';

function setup(championId = 'warrior'): Simulation {
  const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
  sim.addChampion({ playerId: 'p1', championId, side: 'blue', at: { x: 0, y: 0 }, summoners: ['blink', 'haste'] });
  sim.run(0.1);
  return sim;
}

function kill(sim: Simulation): void {
  const champion = sim.champion('p1');
  champion.takeDamage(champion.health + 10_000, 'true', undefined, sim.context);
  expect(champion.isDead).toBe(true);
}

describe('Cooldowns while dead', () => {
  test('ability cooldowns count down while dead', () => {
    const sim = setup();
    const champion = sim.champion('p1');
    champion.abilityStates.Q.cooldownRemaining = 8;
    champion.abilityStates.R.cooldownRemaining = 60;
    kill(sim);
    const respawnIn = champion.respawnTimer;
    sim.run(5);
    expect(champion.isDead).toBe(respawnIn > 5);
    expect(champion.abilityStates.Q.cooldownRemaining).toBeCloseTo(3, 0);
    expect(champion.abilityStates.R.cooldownRemaining).toBeCloseTo(55, 0);
    sim.dispose();
  });

  test('a cooldown shorter than the death is ready on respawn', () => {
    const sim = setup();
    const champion = sim.champion('p1');
    champion.abilityStates.W.cooldownRemaining = 2;
    kill(sim);
    sim.run(3);
    expect(champion.abilityStates.W.cooldownRemaining).toBe(0);
    sim.dispose();
  });

  test('summoner spells count down while dead', () => {
    const sim = setup();
    const champion = sim.champion('p1');
    sim.input('p1', { type: InputType.SUMMONER_SPELL, slot: 0, targetX: 300, targetY: 0 });
    sim.run(0.05);
    const before = champion.summoners.getState()[0].cooldownRemaining;
    expect(before).toBeGreaterThan(100);
    kill(sim);
    sim.run(10);
    expect(champion.summoners.getState()[0].cooldownRemaining).toBeCloseTo(before - 10, 0);
    sim.dispose();
  });

  test('the trinket recharges while dead', () => {
    const sim = setup();
    const champion = sim.champion('p1');
    champion.trinketCharges = 0;
    champion.trinketRechargeTimer = champion.trinketRechargeTime - 3;
    kill(sim);
    sim.run(4);
    expect(champion.trinketCharges).toBe(1);
    sim.dispose();
  });

  test("the passive's cooldown counts down while dead", () => {
    const sim = setup();
    const champion = sim.champion('p1');
    champion.passiveState.cooldownRemaining = 20;
    kill(sim);
    sim.run(5);
    expect(champion.passiveState.cooldownRemaining).toBeCloseTo(15, 0);
    sim.dispose();
  });

  test("item passives' cooldowns count down while dead", () => {
    const sim = setup();
    const champion = sim.champion('p1');
    // (Kept by passive id: no item needed to see it count)
    const cooldowns = (champion.itemPassives as unknown as { cooldowns: Map<string, number> }).cooldowns;
    cooldowns.set('test_passive', 6);
    kill(sim);
    sim.run(4);
    expect(cooldowns.get('test_passive')!).toBeCloseTo(2, 0);
    sim.run(3);
    expect(cooldowns.has('test_passive')).toBe(false);
    sim.dispose();
  });

  test('ability charges come back while dead', () => {
    const sim = setup('vile');
    const champion = sim.champion('p1');
    // Vile's traps (charges): learned
    const slot = (['Q', 'W', 'E', 'R'] as const).find(s => getAbilityDefinition(champion.definition.abilities[s])?.ammo)!;
    expect(slot).toBeDefined();
    champion.skillPoints = 1;
    expect(champion.levelUpAbility(slot)).toBe(true);
    const state = champion.abilityStates[slot];
    expect(state.charges).toBeDefined();
    const full = state.charges!;
    state.charges = 0;
    kill(sim);
    sim.run(60);
    expect(state.charges!).toBeGreaterThan(0);
    expect(state.charges!).toBeLessThanOrEqual(full);
    sim.dispose();
  });

  test('a recast window ends with the death', () => {
    const sim = setup();
    const champion = sim.champion('p1');
    champion.abilityStates.Q.recastWindowRemaining = 3;
    champion.abilityStates.Q.recastCount = 1;
    kill(sim);
    expect(champion.abilityStates.Q.recastWindowRemaining).toBeUndefined();
    expect(champion.abilityStates.Q.recastCount).toBeUndefined();
    sim.dispose();
  });

  test('the respawn timer still brings the champion back', () => {
    const sim = setup();
    const champion = sim.champion('p1');
    kill(sim);
    sim.run(champion.respawnTimer + 0.2);
    expect(champion.isDead).toBe(false);
    sim.dispose();
  });
});
