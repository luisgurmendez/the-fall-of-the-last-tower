/**
 * The practice tools (InputType.PRACTICE_TOOL, game/practiceTools.ts): in
 * a practice match the player can level up, get gold, reset cooldowns,
 * refill health and mana, teleport, and turn on no cooldowns, invulnerable
 * and frozen bots. Any other match ignores them. Each use tells the player
 * which toggles are on (a PRACTICE_TOOLS event), and so does a reconnect.
 */

import './ServerTestUtils';
import { describe, test, expect, afterEach } from 'bun:test';
import {
  CHAMPION_DEFINITIONS,
  GameConfig,
  GameEventType,
  InputType,
  SUMMONER_SPELLS,
  Vector,
  type ChampionDefinition,
  type GameEvent,
  type ItemSlot,
  type StateUpdate,
} from '@siege/shared';
import { GameRoom } from '../game/GameRoom';
import type { ServerGameContext } from '../game/ServerGameContext';
import { LaneBot } from '../bots/LaneBot';

const TICK = 1 / 30;

interface RoomInternals {
  context: ServerGameContext;
  onTick(tick: number, dt: number): void;
  broadcastState(tick: number): void;
  game: { stop(): void };
}

const rooms: GameRoom[] = [];
afterEach(() => {
  for (const room of rooms.splice(0)) room.stop();
});

/** Vile (the player, blue) against a Vex bot in mid; its loop stopped so the test moves time */
function setup(options: { practice?: boolean } = {}) {
  const updates: { playerId: string; update: StateUpdate }[] = [];
  const room = new GameRoom({
    gameId: 'practice-tools',
    players: [
      { playerId: 'a', side: 0, championId: 'vile', connected: true },
      { playerId: 'bot', side: 1, championId: 'vex', connected: true, isBot: true },
    ],
    bots: [new LaneBot({ playerId: 'bot', lane: 'mid' })],
    championDefinitions: new Map<string, ChampionDefinition>(Object.entries(CHAMPION_DEFINITIONS)),
    practice: options.practice ?? true,
    allowDebug: options.practice ?? true,
    onStateUpdate: (playerId, update) => updates.push({ playerId, update }),
  });
  room.start();
  rooms.push(room);
  const internals = room as unknown as RoomInternals;
  internals.game.stop();
  let tick = 0;
  let seq = 0;
  /** Run the match for some seconds, sending state as it goes */
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / TICK); i++) {
      internals.onTick(++tick, TICK);
      internals.broadcastState(tick);
    }
  };
  const context = internals.context;
  const champion = (playerId: string) => context.getChampionByPlayerId(playerId)!;
  /** The player uses a tool (as their client would send it) */
  const use = (tool: string, at?: { x: unknown; y: unknown }, playerId = 'a') => {
    room.handleInput(playerId, {
      seq: ++seq,
      clientTime: Date.now(),
      type: InputType.PRACTICE_TOOL,
      tool,
      ...(at && { x: at.x, y: at.y }),
    } as never);
  };
  /** Any input, numbered like the client's */
  const send = (input: Record<string, unknown>, playerId = 'a') => {
    room.handleInput(playerId, { seq: ++seq, clientTime: Date.now(), ...input } as never);
  };
  /** The events of a type a player got */
  const events = (type: GameEventType, playerId = 'a'): GameEvent[] => updates
    .filter(entry => entry.playerId === playerId)
    .flatMap(entry => entry.update.events)
    .filter(event => event.type === type);
  /** The PRACTICE_TOOLS events a player got */
  const news = (playerId = 'a') => events(GameEventType.PRACTICE_TOOLS, playerId);
  return { room, run, context, champion, use, send, news, events };
}

describe('Practice tools: only in practice', () => {
  test('a match that is not practice ignores them', () => {
    const { run, champion, use, news } = setup({ practice: false });
    const vile = champion('a');
    const level = vile.level;
    const gold = vile.gold;
    use('level_up');
    use('max_level');
    use('gold');
    use('teleport', { x: 500, y: 500 });
    use('toggle_invulnerable');
    run(TICK);
    expect(vile.level).toBe(level);
    expect(vile.gold).toBeCloseTo(gold, 0);
    expect(vile.position.distanceTo(new Vector(500, 500))).toBeGreaterThan(100);
    expect(vile.takeDamage(100, 'true')).toBeGreaterThan(0);
    expect(news()).toHaveLength(0);
  });

  test('an unknown tool, or one sent by a bot, does nothing', () => {
    const { run, champion, use, news } = setup();
    const vile = champion('a');
    const level = vile.level;
    use('summon_dragon');
    use(42 as never);
    use('level_up', undefined, 'bot');
    run(TICK);
    expect(vile.level).toBe(level);
    expect(champion('bot').level).toBe(1);
    expect(news()).toHaveLength(0);
  });
});

describe('Practice tools: levels and gold', () => {
  test('level up: one level and its skill point, as earned', () => {
    const { champion, use } = setup();
    const vile = champion('a');
    const points = vile.skillPoints;
    const maxHealth = vile.getStats().maxHealth;
    use('level_up');
    expect(vile.level).toBe(2);
    expect(vile.skillPoints).toBe(points + 1);
    expect(vile.experience).toBe(0);
    expect(vile.getStats().maxHealth).toBeGreaterThan(maxHealth);
  });

  test('level up keeps the experience toward the next level it had', () => {
    const { champion, use } = setup();
    const vile = champion('a');
    vile.gainExperience(vile.experienceToNextLevel / 2);
    use('level_up');
    expect(vile.level).toBe(2);
    expect(vile.experience).toBe(0);
  });

  test('level 18: every level and skill point up to it; no further', () => {
    const { champion, use } = setup();
    const vile = champion('a');
    const points = vile.skillPoints;
    const level = vile.level;
    use('max_level');
    expect(vile.level).toBe(GameConfig.LIMITS.MAX_LEVEL);
    expect(vile.skillPoints).toBe(points + GameConfig.LIMITS.MAX_LEVEL - level);
    use('level_up');
    use('max_level');
    expect(vile.level).toBe(GameConfig.LIMITS.MAX_LEVEL);
    expect(vile.skillPoints).toBe(points + GameConfig.LIMITS.MAX_LEVEL - level);
  });

  test('a dead champion levels up too', () => {
    const { champion, use } = setup();
    const vile = champion('a');
    vile.takeDamage(1e9, 'true');
    expect(vile.isDead).toBe(true);
    use('level_up');
    expect(vile.level).toBe(2);
  });

  test('gold: 1000 more, again and again', () => {
    const { champion, use } = setup();
    const vile = champion('a');
    const gold = vile.gold;
    use('gold');
    use('gold');
    expect(vile.gold).toBeCloseTo(gold + 2000, 5);
  });
});

describe('Practice tools: cooldowns', () => {
  test('reset cooldowns: abilities, charges, summoner spells, item actives and the passive', () => {
    const { context, champion, use } = setup();
    const vile = champion('a');
    vile.abilityStates.Q.cooldownRemaining = 7;
    vile.abilityStates.R.cooldownRemaining = 80;
    vile.skillPoints = 5;
    vile.levelUpAbility('E');
    vile.abilityStates.E.charges = 1;
    vile.abilityStates.E.chargeRegenRemaining = 30;
    expect(vile.summoners.cast(0, { x: vile.position.x + 100, y: vile.position.y }, context)).toBe(true);
    vile.items[0] = { definitionId: 'hourglass_of_stillness', slot: 0 as ItemSlot, passiveCooldowns: {}, nextIntervalTick: {} };
    vile.invalidateStats();
    vile.items[0]!.readyAt = context.getGameTime() + 120;
    vile.passiveState.cooldownRemaining = 12;

    use('reset_cooldowns');
    expect(vile.abilityStates.Q.cooldownRemaining).toBe(0);
    expect(vile.abilityStates.R.cooldownRemaining).toBe(0);
    expect(vile.abilityStates.E.charges).toBe(5);
    expect(vile.abilityStates.E.chargeRegenRemaining).toBe(0);
    expect(vile.summoners.getState()[0].cooldownRemaining).toBe(0);
    expect(vile.items[0]!.readyAt ?? 0).toBeLessThanOrEqual(context.getGameTime());
    expect(vile.itemActives.use(0, undefined, context)).toBe(true);
    expect(vile.passiveState.cooldownRemaining).toBe(0);
  });

  test('no cooldowns: every cast is ready again right after; off, cooldowns come back', () => {
    const { run, context, champion, use, send, events } = setup();
    const vile = champion('a');
    vile.skillPoints = 5;
    vile.levelUpAbility('E');
    use('toggle_no_cooldowns');
    const trap = () => send({ type: InputType.ABILITY, slot: 'E', targetX: vile.position.x + 120, targetY: vile.position.y });
    const traps = () => events(GameEventType.ABILITY_CAST).filter(event => event.data.abilityId === 'vile_roots_of_vilix').length;

    // Seven traps in a row (each after the last one's cast time): the charges never run out
    for (let i = 0; i < 7; i++) {
      trap();
      run(0.4);
      expect(vile.abilityStates.E.cooldownRemaining).toBe(0);
      expect(vile.abilityStates.E.charges).toBe(5);
    }
    expect(traps()).toBe(7);
    expect(vile.summoners.cast(0, { x: vile.position.x + 100, y: vile.position.y }, context)).toBe(true);
    run(TICK);
    expect(vile.summoners.getState()[0].cooldownRemaining).toBe(0);
    expect(vile.summoners.cast(0, { x: vile.position.x - 100, y: vile.position.y }, context)).toBe(true);
    run(TICK);
    expect(vile.summoners.getState()[0].cooldownRemaining).toBe(0);

    use('toggle_no_cooldowns');
    trap();
    run(0.4);
    expect(traps()).toBe(8);
    expect(vile.abilityStates.E.cooldownRemaining).toBeGreaterThan(0);
    expect(vile.abilityStates.E.charges).toBe(4);
    expect(vile.summoners.cast(0, { x: vile.position.x + 100, y: vile.position.y }, context)).toBe(true);
    run(TICK);
    expect(vile.summoners.getState()[0].cooldownRemaining).toBeGreaterThan(SUMMONER_SPELLS.blink.cooldown - 1);
  });

  test('no cooldowns keeps a recast it opened', () => {
    const { run, champion, use } = setup();
    const vile = champion('a');
    use('toggle_no_cooldowns');
    vile.abilityStates.Q.recastWindowRemaining = 2;
    vile.abilityStates.Q.recastCount = 1;
    vile.abilityStates.Q.cooldownRemaining = 5;
    run(0.5);
    expect(vile.abilityStates.Q.cooldownRemaining).toBe(0);
    expect(vile.abilityStates.Q.recastWindowRemaining).toBeGreaterThan(1);
    expect(vile.abilityStates.Q.recastCount).toBe(1);
  });
});

describe('Practice tools: health and mana', () => {
  test('refill: full health and mana', () => {
    const { champion, use } = setup();
    const vile = champion('a');
    vile.takeDamage(300, 'true');
    vile.resource = 0;
    use('refill');
    expect(vile.health).toBe(vile.getStats().maxHealth);
    expect(vile.resource).toBe(vile.getStats().maxResource);
  });

  test('refill while dead: back at the fountain at once', () => {
    const { run, champion, use } = setup();
    const vile = champion('a');
    vile.takeDamage(1e9, 'true');
    expect(vile.isDead).toBe(true);
    use('refill');
    run(TICK);
    expect(vile.isDead).toBe(false);
    expect(vile.health).toBe(vile.getStats().maxHealth);
  });

  test('invulnerable: no damage, not even true damage or a killing blow; off, it hurts again', () => {
    const { champion, use } = setup();
    const vile = champion('a');
    const bot = champion('bot');
    use('toggle_invulnerable');
    const health = vile.health;
    expect(vile.takeDamage(1e9, 'true', bot.id)).toBe(0);
    expect(vile.takeDamage(500, 'physical', bot.id)).toBe(0);
    expect(vile.takeDamage(500, 'magic')).toBe(0);
    expect(vile.health).toBe(health);
    expect(vile.isDead).toBe(false);

    use('toggle_invulnerable');
    expect(vile.takeDamage(100, 'true', bot.id)).toBeGreaterThan(0);
    expect(vile.health).toBeLessThan(health);
  });

  test('invulnerable is the player\'s own: the bot still takes damage', () => {
    const { champion, use } = setup();
    use('toggle_invulnerable');
    expect(champion('bot').takeDamage(100, 'true')).toBeGreaterThan(0);
  });
});

describe('Practice tools: teleport', () => {
  test('to the point given, standing still there', () => {
    const { run, context, champion, use } = setup();
    const vile = champion('a');
    vile.setMoveTarget(new Vector(vile.position.x + 400, vile.position.y));
    run(0.2);
    // A clear spot in mid lane
    const to = new Vector(0, 0);
    context.terrain.resolveCircle(to, vile.getRadius());
    use('teleport', { x: to.x, y: to.y });
    expect(vile.position.distanceTo(to)).toBeLessThan(1);
    run(0.3);
    expect(vile.position.distanceTo(to)).toBeLessThan(1);
  });

  test('into a wall: the nearest spot where the champion fits', () => {
    const { context, champion, use } = setup();
    const vile = champion('a');
    let wall: Vector | null = null;
    for (let x = -1500; x <= 1500 && !wall; x += 25) {
      for (let y = -1500; y <= 1500 && !wall; y += 25) {
        if (context.terrain.clearanceAt(x, y) < -40) wall = new Vector(x, y);
      }
    }
    expect(wall).not.toBeNull();
    use('teleport', { x: wall!.x, y: wall!.y });
    expect(context.terrain.clearanceAt(vile.position.x, vile.position.y)).toBeGreaterThanOrEqual(vile.getRadius() - 1);
    expect(vile.position.distanceTo(wall!)).toBeLessThan(300);
  });

  test('ends a recall', () => {
    const { run, champion, use, send } = setup();
    const vile = champion('a');
    send({ type: InputType.RECALL });
    run(TICK);
    expect(vile.isRecalling).toBe(true);
    use('teleport', { x: 0, y: 0 });
    expect(vile.isRecalling).toBe(false);
  });

  test('cancels a cast winding up: it never goes off', () => {
    const { run, champion, use, send, events } = setup();
    const vile = champion('a');
    vile.skillPoints = 5;
    vile.levelUpAbility('E');
    send({ type: InputType.ABILITY, slot: 'E', targetX: vile.position.x + 120, targetY: vile.position.y });
    run(TICK);
    expect(vile.abilityStates.E.isCasting || events(GameEventType.ABILITY_WINDUP).length > 0).toBe(true);
    use('teleport', { x: 0, y: 0 });
    run(0.5);
    expect(events(GameEventType.ABILITY_CAST).filter(event => event.data.abilityId === 'vile_roots_of_vilix')).toHaveLength(0);
  });

  test('without a point, with bad numbers, or while dead: nothing', () => {
    const { champion, use } = setup();
    const vile = champion('a');
    const at = vile.position.clone();
    use('teleport');
    use('teleport', { x: 'far', y: 0 });
    use('teleport', { x: Number.NaN, y: 0 });
    use('teleport', { x: Number.POSITIVE_INFINITY, y: 0 });
    expect(vile.position.distanceTo(at)).toBe(0);
    vile.takeDamage(1e9, 'true');
    use('teleport', { x: 0, y: 0 });
    expect(vile.position.distanceTo(at)).toBe(0);
  });
});

describe('Practice tools: frozen bots', () => {
  test('the bots stand still while frozen, and play again after', () => {
    const { run, champion, use } = setup();
    const bot = champion('bot');
    use('toggle_freeze_bots');
    const at = bot.position.clone();
    run(4);
    expect(bot.position.distanceTo(at)).toBeLessThan(1);

    use('toggle_freeze_bots');
    run(4);
    expect(bot.position.distanceTo(at)).toBeGreaterThan(100);
  });

  test('freezing stops a bot that was walking', () => {
    const { run, champion, use } = setup();
    const bot = champion('bot');
    run(3);
    const walked = bot.position.clone();
    use('toggle_freeze_bots');
    run(TICK);
    const at = bot.position.clone();
    run(2);
    expect(walked.distanceTo(at)).toBeLessThan(40);
    expect(bot.position.distanceTo(at)).toBeLessThan(1);
  });

  test('the player still plays while the bots are frozen', () => {
    const { run, champion, use, send } = setup();
    const vile = champion('a');
    use('toggle_freeze_bots');
    const at = vile.position.clone();
    send({ type: InputType.MOVE, targetX: vile.position.x + 300, targetY: vile.position.y });
    run(1);
    expect(vile.position.distanceTo(at)).toBeGreaterThan(50);
  });
});

describe('Practice tools: the player hears which toggles are on', () => {
  test('each use sends the tool and the toggles', () => {
    const { run, champion, use, news } = setup();
    use('toggle_invulnerable');
    use('toggle_freeze_bots');
    use('gold');
    run(TICK);
    const events = news();
    expect(events.map(event => event.data.tool)).toEqual(['toggle_invulnerable', 'toggle_freeze_bots', 'gold']);
    expect(events[2].data).toMatchObject({ entityId: champion('a').id, noCooldowns: false, invulnerable: true, freezeBots: true });
    expect(events[0].data).toMatchObject({ invulnerable: true, freezeBots: false });
  });

  test('a reconnect hears them again', () => {
    const { room, run, use, news } = setup();
    use('toggle_no_cooldowns');
    run(TICK);
    room.handleDisconnect('a');
    room.handleReconnect('a');
    run(TICK);
    const last = news().at(-1)!;
    expect(last.data).toMatchObject({ tool: null, noCooldowns: true, invulnerable: false, freezeBots: false });
  });
});
