/**
 * LaneManager - Manages all lanes and minion wave spawning.
 *
 * Handles:
 * - Creation of lanes from config
 * - Spawning minion waves on each lane
 * - Coordinating minion controllers
 */

import GameContext from '@/core/gameContext';
import { LogicEntity } from '@/core/GameObject';
import { MOBAConfig, LaneId, MapSide } from '@/map/MOBAConfig';
import { Lane } from './Lane';
import { LaneMinionController } from './LaneMinionController';

/**
 * Manages all lanes in the MOBA map.
 */
export class LaneManager extends LogicEntity {
  /** All lanes */
  private lanes: Map<LaneId, Lane> = new Map();

  /** Minion controllers for each lane */
  private minionControllers: Map<LaneId, LaneMinionController> = new Map();

  constructor() {
    super('lane-manager');
    this.createLanes();
  }

  /**
   * Create lanes from configuration.
   */
  private createLanes(): void {
    const { LANES } = MOBAConfig;

    // Create top lane (spread to convert readonly array)
    this.lanes.set('top', new Lane(
      LANES.TOP.id,
      [...LANES.TOP.waypoints],
      LANES.TOP.width
    ));

    // Create mid lane
    this.lanes.set('mid', new Lane(
      LANES.MID.id,
      [...LANES.MID.waypoints],
      LANES.MID.width
    ));

    // Create bot lane
    this.lanes.set('bot', new Lane(
      LANES.BOT.id,
      [...LANES.BOT.waypoints],
      LANES.BOT.width
    ));

    // Create minion controllers for each lane
    for (const [laneId, lane] of this.lanes) {
      this.minionControllers.set(laneId, new LaneMinionController(lane));
    }
  }

  /**
   * Initialize the lane manager.
   */
  initialize(gctx: GameContext): void {
    // Add minion controllers to game
    for (const controller of this.minionControllers.values()) {
      gctx.objects.push(controller);
    }
  }

  /**
   * Get a specific lane.
   */
  getLane(id: LaneId): Lane | undefined {
    return this.lanes.get(id);
  }

  /**
   * Get all lanes.
   */
  getAllLanes(): Lane[] {
    return Array.from(this.lanes.values());
  }

  /**
   * Get the minion controller for a lane.
   */
  getMinionController(id: LaneId): LaneMinionController | undefined {
    return this.minionControllers.get(id);
  }

  /**
   * Get waypoints for a specific lane and side.
   */
  getLaneWaypoints(laneId: LaneId, side: MapSide): Vector[] | null {
    const lane = this.lanes.get(laneId);
    if (!lane) return null;
    return lane.getWaypointsForSide(side);
  }

  /**
   * Get the closest lane to a position.
   */
  getClosestLane(position: Vector): { lane: Lane; distance: number } | null {
    let closestLane: Lane | null = null;
    let closestDistance = Infinity;

    for (const lane of this.lanes.values()) {
      const { distance } = lane.getClosestPoint(position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestLane = lane;
      }
    }

    if (!closestLane) return null;

    return {
      lane: closestLane,
      distance: closestDistance,
    };
  }

  /**
   * Force spawn a wave on all lanes (for testing).
   */
  forceSpawnWaves(): void {
    for (const controller of this.minionControllers.values()) {
      controller.forceSpawnWave();
    }
  }

  override step(gctx: GameContext): void {
    // Minion controllers update themselves through the game loop
    // This method can be used for lane-level logic if needed
  }
}

// Import Vector at top level to avoid issues
import Vector from '@/physics/vector';

export default LaneManager;
