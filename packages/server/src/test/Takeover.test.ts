/**
 * A bot plays for a player who lost their connection: TAKEOVER_DELAY
 * seconds after they leave (a page reload is quicker, and nothing
 * happens), a LaneBot takes their champion to the lane it was nearest (mid
 * from the base), and everyone hears it (PLAYER_CONNECTION "bot"). When
 * they come back the bot lets go at once, they play again, and everyone
 * hears that too ("back").
 */

import './ServerTestUtils';
import { describe, test, expect, afterEach } from 'bun:test';
import { CHAMPION_DEFINITIONS, GameEventType, InputType, MAPS, Vector, type ChampionDefinition, type GameEvent, type StateUpdate } from '@siege/shared';
import { GameRoom } from '../game/GameRoom';
import type { ServerGameContext } from '../game/ServerGameContext';
import { TAKEOVER_DELAY, takeoverLane } from '../bots/takeover';

const TICK = 1 / 30;

interface RoomInternals {
  context: ServerGameContext;
  onTick(tick: number, dt: number): void;
  broadcastState(tick: number): void;
  game: { stop(): void };
  botDriver: { bots: { controller: { playerId: string } }[] };
}

const rooms: GameRoom[] = [];
afterEach(() => {
  for (const room of rooms.splice(0)) room.stop();
});

/** A 1v1 of two people, its loop stopped so the test moves time */
function setup() {
  const updates: { playerId: string; update: StateUpdate }[] = [];
  const room = new GameRoom({
    gameId: 'takeover',
    players: [
      { playerId: 'a', side: 0, championId: 'vex', connected: true },
      { playerId: 'b', side: 1, championId: 'vile', connected: true },
    ],
    championDefinitions: new Map<string, ChampionDefinition>(Object.entries(CHAMPION_DEFINITIONS)),
    onStateUpdate: (playerId, update) => updates.push({ playerId, update }),
  });
  room.start();
  rooms.push(room);
  const internals = room as unknown as RoomInternals;
  internals.game.stop();
  let tick = 0;
  /** Run the match for some seconds, sending state as it goes */
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / TICK); i++) {
      internals.onTick(++tick, TICK);
      internals.broadcastState(tick);
    }
  };
  const champion = (playerId: string) => internals.context.getChampionByPlayerId(playerId)!;
  /** The PLAYER_CONNECTION events a player got */
  const news = (playerId: string): GameEvent[] => updates
    .filter(entry => entry.playerId === playerId)
    .flatMap(entry => entry.update.events)
    .filter(event => event.type === GameEventType.PLAYER_CONNECTION);
  const botsFor = (playerId: string) => internals.botDriver.bots.filter(bot => bot.controller.playerId === playerId).length;
  return { room, run, champion, news, botsFor };
}

describe('A bot plays for a player who left', () => {
  test('nothing happens before the delay; then a bot plays the champion', () => {
    const { room, run, champion } = setup();
    expect(TAKEOVER_DELAY).toBe(5);
    const start = champion('a').position.clone();
    room.handleDisconnect('a');

    run(TAKEOVER_DELAY - 0.5);
    expect(room.isBotPlaying('a')).toBe(false);
    expect(champion('a').position.distanceTo(start)).toBeLessThan(1);

    run(1);
    expect(room.isBotPlaying('a')).toBe(true);
    run(6);
    expect(champion('a').position.distanceTo(start)).toBeGreaterThan(150);
  });

  test('the bot spends the skill point the champion had', () => {
    const { room, run, champion } = setup();
    // A point not spent yet when they left (champions learn their first ability when they spawn)
    champion('a').skillPoints = 1;
    room.handleDisconnect('a');
    run(TAKEOVER_DELAY + 2);
    expect(champion('a').skillPoints).toBe(0);
  });

  test('everyone hears that a bot plays it', () => {
    const { room, run, news } = setup();
    room.handleDisconnect('a');
    run(TAKEOVER_DELAY + 0.5);
    const [event] = news('b');
    expect(news('b')).toHaveLength(1);
    expect(event.data).toMatchObject({ status: 'bot', championId: 'vex', side: 0 });
  });

  test('back before the delay: no bot, no news', () => {
    const { room, run, champion, news } = setup();
    const start = champion('a').position.clone();
    room.handleDisconnect('a');
    run(TAKEOVER_DELAY - 2);
    room.handleReconnect('a');
    run(TAKEOVER_DELAY + 3);
    expect(room.isBotPlaying('a')).toBe(false);
    expect(champion('a').position.distanceTo(start)).toBeLessThan(1);
    expect(news('b')).toHaveLength(0);
  });

  test('back after: the bot lets go, the player plays again, and everyone hears it', () => {
    const { room, run, champion, news } = setup();
    room.handleDisconnect('a');
    run(TAKEOVER_DELAY + 3);
    room.handleReconnect('a');
    expect(room.isBotPlaying('a')).toBe(false);

    // A reloaded page numbers its inputs from 1 again
    const here = champion('a').position.clone();
    const target = here.clone().add(new Vector(120, 0));
    room.handleInput('a', { type: InputType.MOVE, targetX: target.x, targetY: target.y, seq: 1, clientTime: 0 });
    run(4);
    expect(champion('a').position.distanceTo(target)).toBeLessThan(10);

    run(1);
    expect(news('b').map(event => event.data.status)).toEqual(['bot', 'back']);
    expect(news('a').map(event => event.data.status)).toContain('back');
  });

  test("back: the champion stands where the bot left it, not walking on to the bot's spot", () => {
    const { room, run, champion } = setup();
    room.handleDisconnect('a');
    run(TAKEOVER_DELAY + 4);
    // The bot has it walking to its lane
    const before = champion('a').position.clone();
    run(0.5);
    expect(champion('a').position.distanceTo(before)).toBeGreaterThan(10);

    room.handleReconnect('a');
    const back = champion('a').position.clone();
    run(2);
    expect(champion('a').position.distanceTo(back)).toBeLessThan(5);
  });

  test('a second time away, one bot plays again', () => {
    const { room, run, botsFor } = setup();
    room.handleDisconnect('a');
    run(TAKEOVER_DELAY + 1);
    room.handleReconnect('a');
    run(1);
    room.handleDisconnect('a');
    run(TAKEOVER_DELAY - 1);
    expect(room.isBotPlaying('a')).toBe(false);
    run(2);
    expect(room.isBotPlaying('a')).toBe(true);
    expect(botsFor('a')).toBe(1);
  });

  test('leaving twice without coming back: still one bot', () => {
    const { room, run, botsFor } = setup();
    room.handleDisconnect('a');
    run(TAKEOVER_DELAY + 1);
    room.handleDisconnect('a');
    run(TAKEOVER_DELAY + 1);
    expect(botsFor('a')).toBe(1);
  });

  test('coming back when no bot took over sends no news, even twice', () => {
    const { room, run, news } = setup();
    room.handleReconnect('a');
    room.handleDisconnect('a');
    room.handleReconnect('a');
    run(TAKEOVER_DELAY + 1);
    expect(news('b')).toHaveLength(0);
    expect(room.isBotPlaying('a')).toBe(false);
  });

  test("a player who isn't in the match: nothing", () => {
    const { room, run } = setup();
    room.handleDisconnect('nobody');
    run(TAKEOVER_DELAY + 1);
    expect(room.isBotPlaying('nobody')).toBe(false);
  });

  test('both players away: a bot for each', () => {
    const { room, run } = setup();
    room.handleDisconnect('a');
    room.handleDisconnect('b');
    run(TAKEOVER_DELAY + 1);
    expect(room.isBotPlaying('a')).toBe(true);
    expect(room.isBotPlaying('b')).toBe(true);
  });
});

describe('The lane the bot takes', () => {
  const vale = MAPS.vale;

  test('the lane the champion is in', () => {
    expect(takeoverLane(new Vector(-2420, 0), vale)).toBe('top');
    expect(takeoverLane(new Vector(0, -2420), vale)).toBe('top');
    expect(takeoverLane(new Vector(0, 2420), vale)).toBe('bot');
    expect(takeoverLane(new Vector(2420, 0), vale)).toBe('bot');
    expect(takeoverLane(new Vector(300, -300), vale)).toBe('mid');
    expect(takeoverLane(new Vector(-900, 900), vale)).toBe('mid');
  });

  test('walking out along a lane near the base, that lane', () => {
    expect(takeoverLane(new Vector(-2420, 1600), vale)).toBe('top');
    expect(takeoverLane(new Vector(-1600, 2420), vale)).toBe('bot');
  });

  test('in either base or fountain: mid', () => {
    expect(takeoverLane(vale.CHAMPION_SPAWN.BLUE, vale)).toBe('mid');
    expect(takeoverLane(vale.CHAMPION_SPAWN.RED, vale)).toBe('mid');
    expect(takeoverLane(new Vector(-2200, 2200), vale)).toBe('mid');
  });

  test('on a one-lane map, its lane', () => {
    const narrows = MAPS.narrows;
    expect(takeoverLane(new Vector(500, -500), narrows)).toBe('mid');
    expect(takeoverLane(new Vector(-1500, -1500), narrows)).toBe('mid');
    expect(takeoverLane(narrows.CHAMPION_SPAWN.BLUE, narrows)).toBe('mid');
  });
});
