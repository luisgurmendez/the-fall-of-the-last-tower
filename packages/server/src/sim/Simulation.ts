/**
 * Simulation - A headless match you can set up, drive and fast-forward.
 *
 * Runs the real server simulation (ServerGameContext, InputHandler, bots)
 * without a network or a real-time loop, and records what happens. Used by
 * scenario files, the `sim` CLI, the HTTP sandbox and tests.
 *
 *   const sim = new Simulation({ minionWaves: false });
 *   sim.addChampion({ playerId: 'p1', championId: 'vex', side: 0, at: { x: 0, y: 0 } });
 *   sim.spawnWave('mid');
 *   sim.run(20);
 *   console.log(sim.report().markdown);
 */

import {
  Vector,
  MOBAConfig,
  GameConfig,
  InputType,
  getChampionDefinition,
  type AbilitySlot,
  type LaneId,
  type MinionType,
  type Side,
} from '@siege/shared';
import { ServerGameContext } from '../game/ServerGameContext';
import { spawnStructures, spawnChampion } from '../game/MatchSetup';
import { InputHandler } from '../network/InputHandler';
import { BotDriver } from '../bots/BotDriver';
import { BotInputStamper, type BotController, type BotInput } from '../bots/BotController';
import { LaneBot } from '../bots/LaneBot';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerEntity } from '../simulation/ServerEntity';
import { ServerMinion } from '../simulation/ServerMinion';
import { LanePath } from '../navigation/LanePath';
import { initializeAbilityHandlers } from '../abilities';
import { abilityHandlerRegistry } from '../abilities/AbilityHandlerRegistry';
import { Recorder, toSimEntity, type SimEntity, type SimFrame } from './Recorder';
import { buildReport, type SimReport } from './Report';

export type SideInput = Side | 'blue' | 'red';

export interface SimulationOptions {
  /** Map config (default MOBAConfig) */
  map?: typeof MOBAConfig;
  /** Spawn towers and nexuses (default true) */
  structures?: boolean;
  /** Spawn jungle camps (default true) */
  jungle?: boolean;
  /** Spawn minion waves on the normal timer (default true) */
  minionWaves?: boolean;
  /** Seed Math.random for reproducible runs (restored by dispose()) */
  seed?: number;
  /** Seconds between recorded frames (default 0.1) */
  sampleInterval?: number;
}

export interface AddChampionOptions {
  playerId: string;
  championId: string;
  side: SideInput;
  /** Spawn position (default: the side's spawn point) */
  at?: { x: number; y: number };
  /** Level to start at (default 1) */
  level?: number;
  /** Ability ranks to learn, e.g. { Q: 2, W: 1 }. Default: learn as the level allows, Q first. */
  ranks?: Partial<Record<AbilitySlot, number>>;
  /** Let a bot play this champion: 'lane' for a LaneBot in mid, or any controller */
  bot?: 'lane' | BotController;
}

export class Simulation {
  readonly context: ServerGameContext;
  readonly recorder: Recorder;
  readonly tickRate = GameConfig.TICK.SERVER_TICK_RATE;
  readonly dt = 1 / GameConfig.TICK.SERVER_TICK_RATE;

  private readonly inputHandler: InputHandler;
  private readonly stampers: Map<string, BotInputStamper> = new Map();
  private readonly botDriver = new BotDriver(this.stampers);
  private readonly originalRandom: (() => number) | null = null;
  private tickListeners: ((sim: Simulation) => void)[] = [];

  constructor(options: SimulationOptions = {}) {
    if (abilityHandlerRegistry.getRegisteredAbilities().length === 0) {
      initializeAbilityHandlers();
    }

    if (options.seed !== undefined) {
      this.originalRandom = Math.random;
      Math.random = mulberry32(options.seed);
    }

    this.context = new ServerGameContext({
      gameId: 'sim',
      mapConfig: options.map,
      minionWaves: options.minionWaves ?? true,
    });
    this.inputHandler = new InputHandler({ now: () => this.time * 1000 });
    this.recorder = new Recorder({ sampleInterval: options.sampleInterval });

    if (options.structures ?? true) spawnStructures(this.context);
    if (options.jungle ?? true) this.context.spawnJungleCamps();
  }

  /** Game time in seconds */
  get time(): number {
    return this.context.getGameTime();
  }

  /**
   * Restore anything the simulation changed globally (seeded Math.random).
   */
  dispose(): void {
    if (this.originalRandom) Math.random = this.originalRandom;
  }

  // ===========================================================================
  // Setup
  // ===========================================================================

  addChampion(options: AddChampionOptions): ServerChampion {
    const definition = getChampionDefinition(options.championId);
    if (!definition) throw new Error(`Unknown champion: ${options.championId}`);

    const champion = spawnChampion(this.context, {
      playerId: options.playerId,
      side: toSide(options.side),
      definition,
      position: options.at ? new Vector(options.at.x, options.at.y) : undefined,
    });

    const level = options.level ?? 1;
    while (champion.level < level) {
      champion.gainExperience(champion.experienceToNextLevel - champion.experience);
    }
    this.learnAbilities(champion, options.ranks);

    if (options.bot === 'lane') {
      this.addBot(new LaneBot({ playerId: options.playerId }));
    } else if (options.bot) {
      this.addBot(options.bot);
    }

    this.recorder.record(this.context, []);
    return champion;
  }

  addBot(controller: BotController): void {
    this.botDriver.add(controller);
  }

  /**
   * Spawn a single minion at a spot. It walks its lane from the closest
   * point onward, like a minion that got there on its own.
   */
  addMinion(options: { side: SideInput; lane: LaneId; at: { x: number; y: number }; type?: MinionType; laneOffset?: number }): ServerMinion {
    const side = toSide(options.side);
    const laneKey = options.lane.toUpperCase() as 'TOP' | 'MID' | 'BOT';
    const waypoints = this.context.mapConfig.LANES[laneKey].waypoints.map(w => w.clone());
    if (side === 1) waypoints.reverse();

    const position = new Vector(options.at.x, options.at.y);
    const path = new LanePath(waypoints);
    const ahead = waypoints.slice(path.nextWaypointIndex(path.project(position).distance));

    const minion = new ServerMinion({
      id: this.context.generateEntityId(),
      position,
      side,
      minionType: options.type ?? 'melee',
      lane: options.lane,
      waypoints: ahead.length > 0 ? ahead : [waypoints[waypoints.length - 1]],
      laneOffset: options.laneOffset,
    });
    this.context.addEntity(minion);
    return minion;
  }

  /**
   * Spawn a minion wave in a lane (both sides unless one is given).
   */
  spawnWave(lane: LaneId, side?: SideInput): void {
    const sides: Side[] = side === undefined ? [0, 1] : [toSide(side)];
    for (const s of sides) this.context.spawnLaneWave(s, lane);
  }

  /**
   * Call a function every tick (after the world updates).
   */
  onTick(listener: (sim: Simulation) => void): void {
    this.tickListeners.push(listener);
  }

  // ===========================================================================
  // Commands (go through the InputHandler like a real client)
  // ===========================================================================

  input(playerId: string, input: BotInput): boolean {
    let stamper = this.stampers.get(playerId);
    if (!stamper) {
      stamper = new BotInputStamper();
      this.stampers.set(playerId, stamper);
    }
    return this.inputHandler.queueInput(playerId, stamper.stamp(input, this.time * 1000)).valid;
  }

  move(playerId: string, x: number, y: number): boolean {
    return this.input(playerId, { type: InputType.MOVE, targetX: x, targetY: y });
  }

  attack(playerId: string, targetId: string): boolean {
    return this.input(playerId, { type: InputType.TARGET_UNIT, targetEntityId: targetId });
  }

  stop(playerId: string): boolean {
    return this.input(playerId, { type: InputType.STOP });
  }

  /**
   * Cast an ability. Target is a position, an entity ID, or nothing.
   */
  cast(playerId: string, slot: AbilitySlot, target?: { x: number; y: number } | string): boolean {
    if (typeof target === 'string') {
      return this.input(playerId, { type: InputType.ABILITY, slot, targetType: 'unit', targetEntityId: target });
    }
    if (target) {
      return this.input(playerId, { type: InputType.ABILITY, slot, targetType: 'position', targetX: target.x, targetY: target.y });
    }
    return this.input(playerId, { type: InputType.ABILITY, slot, targetType: 'none' });
  }

  levelUp(playerId: string, slot: AbilitySlot): boolean {
    return this.input(playerId, { type: InputType.LEVEL_UP, slot });
  }

  recall(playerId: string): boolean {
    return this.input(playerId, { type: InputType.RECALL });
  }

  buy(playerId: string, itemId: string): boolean {
    return this.input(playerId, { type: InputType.BUY_ITEM, itemId });
  }

  // ===========================================================================
  // Running
  // ===========================================================================

  /**
   * Advance one server tick.
   */
  tick(): void {
    this.botDriver.update(this.context, this.inputHandler, this.dt, this.time * 1000);
    this.inputHandler.processInputs(this.context);
    this.context.update(this.dt);
    this.recorder.record(this.context, this.context.flushEvents());
    for (const listener of this.tickListeners) listener(this);
  }

  /**
   * Advance by a number of seconds.
   */
  run(seconds: number): void {
    const ticks = Math.max(1, Math.round(seconds * this.tickRate));
    for (let i = 0; i < ticks; i++) this.tick();
  }

  /**
   * Advance until the predicate is true or maxSeconds pass.
   * @returns Whether the predicate became true
   */
  runUntil(predicate: (sim: Simulation) => boolean, maxSeconds: number): boolean {
    const end = this.time + maxSeconds;
    while (this.time < end) {
      this.tick();
      if (predicate(this)) return true;
    }
    return false;
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  champion(playerId: string): ServerChampion {
    const champion = this.context.getChampionByPlayerId(playerId);
    if (!champion) throw new Error(`No champion for player ${playerId}`);
    return champion;
  }

  entity(id: string): ServerEntity | undefined {
    return this.context.getEntity(id);
  }

  /**
   * Current state of every entity in the compact frame format.
   */
  entities(filter?: (entity: SimEntity) => boolean): SimEntity[] {
    const all = this.context.getAllEntities().map(toSimEntity);
    return filter ? all.filter(filter) : all;
  }

  /**
   * The current state as a frame (for rendering).
   */
  frame(): SimFrame {
    return this.recorder.capture(this.context);
  }

  note(text: string): void {
    this.recorder.note(this.time, text);
  }

  report(): SimReport {
    return buildReport(this);
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private learnAbilities(champion: ServerChampion, ranks?: Partial<Record<AbilitySlot, number>>): void {
    if (ranks) {
      for (const slot of ['Q', 'W', 'E', 'R'] as AbilitySlot[]) {
        for (let i = champion.abilityRanks[slot]; i < (ranks[slot] ?? 0); i++) {
          champion.skillPoints = Math.max(champion.skillPoints, 1);
          champion.levelUpAbility(slot);
        }
      }
      return;
    }

    // Spend whatever points the level gave: R when allowed, then spread Q > W > E
    const order: AbilitySlot[] = ['R', 'Q', 'W', 'E'];
    let guard = 50;
    while (champion.skillPoints > 0 && guard-- > 0) {
      const learned = order.some(slot => {
        if (slot !== 'R' && champion.abilityRanks[slot] >= Math.ceil(champion.level / 2)) return false;
        return champion.levelUpAbility(slot);
      });
      if (!learned) break;
    }
  }
}

function toSide(side: SideInput): Side {
  if (side === 'blue') return 0;
  if (side === 'red') return 1;
  return side;
}

/**
 * Small seeded PRNG (mulberry32).
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
