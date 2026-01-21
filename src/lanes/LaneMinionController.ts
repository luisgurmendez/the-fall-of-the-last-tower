/**
 * LaneMinionController - Handles minion wave spawning for a lane.
 *
 * Spawns waves of swordsmen and archers at regular intervals.
 * Minions follow the lane waypoints toward the enemy nexus.
 */

import GameContext from '@/core/gameContext';
import { LogicEntity } from '@/core/GameObject';
import Vector from '@/physics/vector';
import { MOBAConfig, MapSide } from '@/map/MOBAConfig';
import { Lane } from './Lane';
import Swordsman from '@/objects/army/swordsman/swordsman';
import Archer from '@/objects/army/archer/archer';

/**
 * Controls minion wave spawning for a single lane.
 */
export class LaneMinionController extends LogicEntity {
  /** The lane this controller manages */
  private lane: Lane;

  /** Time until next wave spawn */
  private waveTimer: number;

  /** Wave spawn configuration */
  private readonly spawnInterval: number;
  private readonly firstWaveDelay: number;
  private readonly spawnDelayBetween: number;
  private readonly waveComposition: { swordsmen: number; archers: number };
  private readonly spawnOffset: number;

  /** Whether waves have started spawning */
  private wavesStarted: boolean = false;

  /** Pending spawns for current wave (to stagger spawn timing) */
  private pendingSpawns: { side: MapSide; type: 'swordsman' | 'archer'; delay: number }[] = [];

  constructor(lane: Lane) {
    super(`minion-controller-${lane.id}`);
    this.lane = lane;

    // Load config
    const { MINION_WAVES } = MOBAConfig;
    this.spawnInterval = MINION_WAVES.SPAWN_INTERVAL;
    this.firstWaveDelay = MINION_WAVES.FIRST_WAVE_DELAY;
    this.spawnDelayBetween = MINION_WAVES.SPAWN_DELAY_BETWEEN;
    this.waveComposition = MINION_WAVES.WAVE_COMPOSITION;
    this.spawnOffset = MINION_WAVES.SPAWN_OFFSET;

    // Start with first wave delay
    this.waveTimer = this.firstWaveDelay;
  }

  override step(gctx: GameContext): void {
    const dt = gctx.dt;

    // Update wave timer
    this.waveTimer -= dt;

    // Spawn wave when timer reaches zero
    if (this.waveTimer <= 0) {
      this.queueWave(0); // Blue side
      this.queueWave(1); // Red side
      this.waveTimer = this.spawnInterval;
      this.wavesStarted = true;
    }

    // Process pending spawns
    this.processPendingSpawns(gctx, dt);
  }

  /**
   * Queue a wave of minions for a specific side.
   */
  private queueWave(side: MapSide): void {
    let delay = 0;

    // Queue swordsmen first (frontline)
    for (let i = 0; i < this.waveComposition.swordsmen; i++) {
      this.pendingSpawns.push({
        side,
        type: 'swordsman',
        delay,
      });
      delay += this.spawnDelayBetween;
    }

    // Queue archers (backline)
    for (let i = 0; i < this.waveComposition.archers; i++) {
      this.pendingSpawns.push({
        side,
        type: 'archer',
        delay,
      });
      delay += this.spawnDelayBetween;
    }
  }

  /**
   * Process pending spawns with staggered timing.
   */
  private processPendingSpawns(gctx: GameContext, dt: number): void {
    // Update delays and spawn ready minions
    const readySpawns: typeof this.pendingSpawns = [];
    const remainingSpawns: typeof this.pendingSpawns = [];

    for (const spawn of this.pendingSpawns) {
      spawn.delay -= dt;
      if (spawn.delay <= 0) {
        readySpawns.push(spawn);
      } else {
        remainingSpawns.push(spawn);
      }
    }

    this.pendingSpawns = remainingSpawns;

    // Spawn ready minions
    for (const spawn of readySpawns) {
      this.spawnMinion(gctx, spawn.side, spawn.type);
    }
  }

  /**
   * Spawn a single minion.
   */
  private spawnMinion(
    gctx: GameContext,
    side: MapSide,
    type: 'swordsman' | 'archer'
  ): void {
    // Get waypoints for this side
    const waypoints = this.lane.getWaypointsForSide(side);
    if (waypoints.length === 0) return;

    // Calculate spawn position with small offset from nexus
    const spawnPos = waypoints[0].clone();
    const nextWaypoint = waypoints.length > 1 ? waypoints[1] : waypoints[0];
    const direction = nextWaypoint.clone().sub(spawnPos).normalize();

    // Add offset in the direction of movement
    spawnPos.add(direction.scalar(this.spawnOffset));

    // Add small random spread to prevent stacking
    spawnPos.x += (Math.random() - 0.5) * 30;
    spawnPos.y += (Math.random() - 0.5) * 30;

    // Create minion
    const minion = type === 'swordsman'
      ? new Swordsman(spawnPos, side)
      : new Archer(spawnPos, side);

    // Set direct waypoints for lane following
    this.setMinionWaypoints(minion, waypoints);

    // Add to game
    gctx.objects.push(minion);
  }

  /**
   * Set waypoints on a minion for lane following.
   * Uses the minion's lane waypoint system.
   */
  private setMinionWaypoints(
    minion: Swordsman | Archer,
    waypoints: Vector[]
  ): void {
    // Skip the first waypoint (spawn position) and set the rest as the path
    if (waypoints.length > 1) {
      const pathWaypoints = waypoints.slice(1);
      minion.setLaneWaypoints(pathWaypoints);
    }
  }

  /**
   * Force spawn a wave immediately (for testing).
   */
  forceSpawnWave(): void {
    this.queueWave(0);
    this.queueWave(1);
  }

  /**
   * Get the lane this controller manages.
   */
  getLane(): Lane {
    return this.lane;
  }

  /**
   * Check if waves have started spawning.
   */
  hasStartedSpawning(): boolean {
    return this.wavesStarted;
  }
}

export default LaneMinionController;
