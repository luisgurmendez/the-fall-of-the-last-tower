/**
 * Pings and emotes: a ping becomes a PING event for its team only, at most
 * five in six seconds (a dead champion pings too); an emote becomes an EMOTE
 * event for its team and whoever sees the champion, one every two seconds.
 */

import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { GameEventType, InputType, type GameEvent, type PingType } from '@siege/shared';
import { Simulation } from '../sim';
import { reachesSide } from '../network/eventAudience';

function setup(): Simulation {
  const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
  sim.addChampion({ playerId: 'p1', championId: 'warrior', side: 'blue', at: { x: 0, y: 0 } });
  return sim;
}

function eventsOf(sim: Simulation, type: GameEventType): GameEvent[] {
  return sim.recorder.events.filter(event => event.type === type);
}

function ping(sim: Simulation, pingType: PingType, x: number, y: number): void {
  sim.input('p1', { type: InputType.PING, pingType, x, y });
  sim.run(0.25);
}

describe('Pings', () => {
  test('a ping is an event at its point, and a sixth one in six seconds is dropped', () => {
    const sim = setup();
    ping(sim, 'danger', 500, -300);
    const [first] = eventsOf(sim, GameEventType.PING);
    expect(first.data).toMatchObject({ pingType: 'danger', x: 500, y: -300, side: 0, championId: 'warrior' });

    for (let i = 0; i < 5; i++) ping(sim, 'look', 0, 0);
    expect(eventsOf(sim, GameEventType.PING)).toHaveLength(5);

    sim.run(6);
    ping(sim, 'missing', 0, 0);
    expect(eventsOf(sim, GameEventType.PING)).toHaveLength(6);
    sim.dispose();
  });

  test('a dead champion pings', () => {
    const sim = setup();
    const champion = sim.champion('p1');
    champion.takeDamage(100000, 'true', undefined, sim.context);
    expect(champion.isDead).toBe(true);
    ping(sim, 'on_my_way', 100, 100);
    expect(eventsOf(sim, GameEventType.PING)).toHaveLength(1);
    sim.dispose();
  });

  test('a ping only reaches its team; an emote its team and whoever sees the champion', () => {
    const at = (type: GameEventType, side: number): GameEvent => ({ type, timestamp: 0, data: { entityId: 'c1', side } });
    const seen = () => true;
    const unseen = () => false;
    expect(reachesSide(at(GameEventType.PING, 0), 0, seen)).toBe(true);
    expect(reachesSide(at(GameEventType.PING, 0), 1, seen)).toBe(false);
    expect(reachesSide(at(GameEventType.EMOTE, 0), 1, seen)).toBe(true);
    expect(reachesSide(at(GameEventType.EMOTE, 0), 1, unseen)).toBe(false);
    expect(reachesSide(at(GameEventType.EMOTE, 0), 0, unseen)).toBe(true);
  });
});

describe('Emotes', () => {
  test('an emote is an event, and another within two seconds is dropped', () => {
    const sim = setup();
    const emote = () => {
      sim.input('p1', { type: InputType.EMOTE, emote: 'gg' });
      sim.run(0.5);
    };
    emote();
    emote();
    expect(eventsOf(sim, GameEventType.EMOTE)).toHaveLength(1);
    expect(eventsOf(sim, GameEventType.EMOTE)[0].data).toMatchObject({ emote: 'gg', side: 0 });

    sim.run(2);
    emote();
    expect(eventsOf(sim, GameEventType.EMOTE)).toHaveLength(2);
    sim.dispose();
  });
});
