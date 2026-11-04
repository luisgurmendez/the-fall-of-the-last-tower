/**
 * The server's state updates are played out at the pace it sent them, a
 * little behind: on the internet they arrive unevenly (late, then several
 * together), and applied as they arrive the units stall and then jump. The
 * playout waits as long as the connection needs (StatePlayout: a few ms on a
 * steady one, up to INTERPOLATION_DELAY on a jittery one) and applies them
 * evenly. Times below are in ms, frames at 60 Hz.
 */

import { describe, it, expect } from 'bun:test';
import { GameConfig, EntityType, type ChampionSnapshot, type StateUpdate } from '@siege/shared';
import { StatePlayout, PLAYOUT_MIN_DELAY_MS, PLAYOUT_MAX_DELAY_MS, PLAYOUT_MAX_WAITING } from '@/core/state/playout';
import { OnlineStateManager } from '@/core/OnlineStateManager';

const TICK = 1000 / GameConfig.TICK.SERVER_TICK_RATE;
const FRAME = 1000 / 60;

interface Arrival {
  tick: number;
  at: number;
}

interface Played {
  /** When each tick's update was applied */
  appliedAt: Map<number, number>;
  /** Ticks in the order they were applied */
  order: number[];
  /** The most updates waiting at once */
  mostWaiting: number;
}

/** A small deterministic random generator (the same trace every run) */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Updates sent every tick (or every `spacing` ms) and arriving `latency` ms
 * later, plus `extra(tick)`; in order, as over a WebSocket: one held back
 * holds back the ones after it, which then come together.
 */
function trace(ticks: number, extra: (tick: number) => number = () => 0, { start = 1000, latency = 30, spacing = TICK } = {}): Arrival[] {
  const arrivals: Arrival[] = [];
  let last = -Infinity;
  for (let tick = 0; tick < ticks; tick++) {
    const at = Math.max(last, start + tick * spacing + latency + extra(tick));
    arrivals.push({ tick, at });
    last = at;
  }
  return arrivals;
}

/** Internet-like jitter: most on time, one in five 20 to 90 ms late */
function jittery(seed = 7): (tick: number) => number {
  const next = random(seed);
  return () => {
    const roll = next();
    return roll < 0.8 ? next() * 5 : 20 + next() * 70;
  };
}

/** Run the arrivals through a playout, a frame at a time (or not at all while `hidden`) */
function play(arrivals: Arrival[], playout = new StatePlayout<{ tick: number }>(), hidden: (now: number) => boolean = () => false): Played {
  const played: Played = { appliedAt: new Map(), order: [], mostWaiting: 0 };
  const apply = (updates: { tick: number }[], now: number) => {
    for (const { tick } of updates) {
      expect(played.appliedAt.has(tick)).toBe(false);
      played.appliedAt.set(tick, now);
      played.order.push(tick);
    }
  };
  const end = arrivals[arrivals.length - 1].at + 500;
  let next = 0;
  for (let now = arrivals[0].at; now <= end; now += FRAME) {
    while (next < arrivals.length && arrivals[next].at <= now) {
      const arrival = arrivals[next++];
      apply(playout.receive({ tick: arrival.tick }, arrival.at), arrival.at);
      played.mostWaiting = Math.max(played.mostWaiting, playout.waiting());
    }
    if (!hidden(now)) apply(playout.due(now), now);
  }
  return played;
}

/** Applied as they arrive, at the next frame: what the client did before */
function onArrival(arrivals: Arrival[]): Played {
  const played: Played = { appliedAt: new Map(), order: [], mostWaiting: 0 };
  const first = arrivals[0].at;
  for (const { tick, at } of arrivals) {
    const frame = first + Math.ceil((at - first) / FRAME) * FRAME;
    played.appliedAt.set(tick, frame);
    played.order.push(tick);
  }
  return played;
}

/** The longest wait between two updates applied, from `fromTick` on */
function longestGap(played: Played, fromTick = 0): number {
  let longest = 0;
  for (let tick = fromTick + 1; played.appliedAt.has(tick); tick++) {
    longest = Math.max(longest, played.appliedAt.get(tick)! - played.appliedAt.get(tick - 1)!);
  }
  return longest;
}

/**
 * The longest an update waited between arriving and being applied (the most
 * delay, a frame, and a few ms the earliest-arrival estimate drifts meanwhile)
 */
function longestWait(played: Played, arrivals: Arrival[], fromTick = 0): number {
  return Math.max(...arrivals.filter(a => a.tick >= fromTick).map(a => played.appliedAt.get(a.tick)! - a.at));
}

describe('StatePlayout', () => {
  it('on a steady connection, applies each update a moment after it arrives', () => {
    const arrivals = trace(300);
    const played = play(arrivals);

    expect(played.order).toEqual(arrivals.map(a => a.tick));
    expect(longestWait(played, arrivals)).toBeLessThanOrEqual(PLAYOUT_MIN_DELAY_MS + FRAME + 1);
    expect(longestGap(played)).toBeLessThanOrEqual(TICK + FRAME + 1);
  });

  it('on a jittery connection, applies them evenly where arriving ones stall', () => {
    const arrivals = trace(900, jittery());
    const before = onArrival(arrivals);
    const played = play(arrivals);
    const settled = 90; // after the first 3 s

    // Applied as they arrive, units stall for 3-4 ticks at a time
    expect(longestGap(before, settled)).toBeGreaterThan(3 * TICK);
    // Played out: never more than a tick and two frames between updates
    expect(longestGap(played, settled)).toBeLessThanOrEqual(TICK + 2 * FRAME + 1);
    expect(played.order).toEqual(arrivals.map(a => a.tick));
  });

  it('never holds an update longer than the most delay', () => {
    // Very jittery: up to 400 ms late
    const next = random(3);
    const arrivals = trace(900, () => (next() < 0.7 ? 0 : next() * 400));
    const playout = new StatePlayout<{ tick: number }>();
    const played = play(arrivals, playout);

    expect(longestWait(played, arrivals)).toBeLessThanOrEqual(PLAYOUT_MAX_DELAY_MS + FRAME + 5);
    expect(playout.delay()).toBeLessThanOrEqual(PLAYOUT_MAX_DELAY_MS);
  });

  it('waits only as long as the connection needs: less again once it steadies', () => {
    const noisy = jittery(11);
    // 10 s jittery, then 15 s steady
    const arrivals = trace(750, tick => (tick < 300 ? noisy(tick) : 0));
    const playout = new StatePlayout<{ tick: number }>();
    const played = play(arrivals.slice(0, 300), playout);
    const jitteryDelay = playout.delay();
    play(arrivals.slice(300), playout);

    expect(jitteryDelay).toBeGreaterThan(50);
    expect(playout.delay()).toBeLessThanOrEqual(PLAYOUT_MIN_DELAY_MS + 5);
    expect(played.order.length).toBe(300);
  });

  it('applies updates that come in after a long stall at once, then plays on evenly', () => {
    // Held back half a second: it and the ones sent meanwhile come together
    const arrivals = trace(300, tick => (tick === 150 ? 500 : 0));
    const played = play(arrivals);
    const burst = arrivals.find(a => a.tick === 150)!.at;

    // Late already: applied in the frame they arrive in, not held back
    for (let tick = 150; tick < 160; tick++) {
      expect(played.appliedAt.get(tick)!).toBeLessThanOrEqual(burst + FRAME + 1);
    }
    expect(longestGap(played, 200)).toBeLessThanOrEqual(TICK + FRAME + 1);
    expect(played.order).toEqual(arrivals.map(a => a.tick));
  });

  it('applies updates in tick order, whatever order they come in', () => {
    const playout = new StatePlayout<{ tick: number }>();
    playout.receive({ tick: 0 }, 1000);
    playout.receive({ tick: 2 }, 1066);
    playout.receive({ tick: 1 }, 1070);
    expect(playout.due(5000).map(u => u.tick)).toEqual([0, 1, 2]);
  });

  it('applies nothing before its time, and nothing twice', () => {
    const playout = new StatePlayout<{ tick: number }>();
    expect(playout.due(1000)).toEqual([]);
    playout.receive({ tick: 0 }, 1000);
    expect(playout.due(1000)).toEqual([]);
    expect(playout.due(1000 + PLAYOUT_MIN_DELAY_MS + 1).map(u => u.tick)).toEqual([0]);
    expect(playout.due(5000)).toEqual([]);
  });

  it('while no frames run (a hidden tab), keeps at most a second waiting and loses none', () => {
    const arrivals = trace(600);
    // Hidden from 5 s to 15 s in
    const played = play(arrivals, undefined, now => now > 6000 && now < 16000);

    expect(played.mostWaiting).toBeLessThanOrEqual(PLAYOUT_MAX_WAITING);
    expect(played.order).toEqual(arrivals.map(a => a.tick));
  });

  it('drops the waiting updates a full state covers', () => {
    const playout = new StatePlayout<{ tick: number }>();
    for (let tick = 10; tick < 15; tick++) playout.receive({ tick }, 1000 + tick * TICK);
    playout.dropThrough(12);

    expect(playout.waiting()).toBe(2);
    expect(playout.due(10_000).map(u => u.tick)).toEqual([13, 14]);
  });

  it('keeps up with a server whose ticks run slow (35 ms): the wait doesn\'t creep up', () => {
    const arrivals = trace(1800, jittery(5), { spacing: 35 });
    const played = play(arrivals);

    expect(longestWait(played, arrivals, 1500)).toBeLessThanOrEqual(PLAYOUT_MAX_DELAY_MS + FRAME + 5);
    expect(longestGap(played, 1500)).toBeLessThanOrEqual(35 + 2 * FRAME + 1);
  });

  it('keeps up with a server whose ticks run fast (32 ms): nothing piles up', () => {
    const arrivals = trace(1800, jittery(9), { spacing: 32 });
    const played = play(arrivals);

    expect(longestWait(played, arrivals, 1500)).toBeLessThanOrEqual(PLAYOUT_MAX_DELAY_MS + FRAME + 5);
    expect(played.mostWaiting).toBeLessThanOrEqual(6);
  });

  it('works whatever the clocks read', () => {
    const arrivals = trace(300, jittery(2), { start: 1.7e12 });
    const played = play(arrivals);
    expect(played.order).toEqual(arrivals.map(a => a.tick));
    expect(longestGap(played, 90)).toBeLessThanOrEqual(TICK + 2 * FRAME + 1);
  });
});

describe('OnlineStateManager playout', () => {
  const LOCAL = 'champ-local';

  function manager(): OnlineStateManager {
    return new OnlineStateManager({
      gameId: 'game',
      yourSide: 0,
      yourPlayerId: 'player-local',
      players: [{ playerId: 'player-local', championId: 'warrior', side: 0, entityId: LOCAL }],
    });
  }

  function update(tick: number, x: number): StateUpdate {
    const champion = {
      entityId: LOCAL, entityType: EntityType.CHAMPION, championId: 'warrior', side: 0,
      x, y: 100, health: 600, maxHealth: 600, isDead: false,
    } as unknown as ChampionSnapshot;
    return { tick, timestamp: 0, gameTime: tick / 30, deltas: [{ entityId: LOCAL, changeMask: 0xFFFF, data: champion }], events: [], inputAcks: {} } as unknown as StateUpdate;
  }

  it('a received update is applied on a later frame, not as it arrives', () => {
    const state = manager();
    state.receiveStateUpdate(update(1, 100), 1000);
    expect(state.getLocalPlayerEntity()).toBeUndefined();

    state.advance(1000 + PLAYOUT_MIN_DELAY_MS + 1);
    expect(state.getLocalPlayerEntity()?.snapshot.x).toBe(100);
    expect(state.getCurrentTick()).toBe(1);
  });

  it('advance says how many updates it applied', () => {
    const state = manager();
    state.receiveStateUpdate(update(1, 100), 1000);
    state.receiveStateUpdate(update(2, 104), 1000 + TICK);
    expect(state.advance(1000)).toBe(0);
    expect(state.advance(5000)).toBe(2);
  });

  it('a full state drops the updates it covers, and later ones still play', () => {
    const state = manager();
    state.receiveStateUpdate(update(1, 100), 1000);
    state.receiveStateUpdate(update(2, 104), 1000 + TICK);
    state.receiveStateUpdate(update(3, 108), 1000 + 2 * TICK);
    state.processFullState({ tick: 2, timestamp: 0, gameTime: 2 / 30, entities: [update(2, 300).deltas[0].data as ChampionSnapshot], events: [] });
    expect(state.getLocalPlayerEntity()?.snapshot.x).toBe(300);

    state.advance(5000);
    expect(state.getLocalPlayerEntity()?.snapshot.x).toBe(108);
    expect(state.getCurrentTick()).toBe(3);
  });

  it('processStateUpdate still applies at once (the updates from the loading screen)', () => {
    const state = manager();
    state.processStateUpdate(update(1, 100));
    expect(state.getLocalPlayerEntity()?.snapshot.x).toBe(100);
  });
});
