/**
 * CustomMOBAMap - Manages all objects for a custom-built map.
 *
 * Similar to MOBAMap but uses loaded map data instead of config.
 */

import GameContext from "../core/gameContext";
import { LogicEntity } from "../core/GameObject";
import { Initializable } from "../behaviors/initializable";
import { LoadedMap } from "../mapBuilder/MapLoader";
import { LaneMinionController } from "../lanes/LaneMinionController";
import { BushManager } from "../vision/BushManager";
import Vector from "../physics/vector";

export class CustomMOBAMap extends LogicEntity implements Initializable {
  shouldInitialize: boolean = true;

  private loadedMap: LoadedMap;
  private initialized = false;
  private minionControllers: LaneMinionController[] = [];
  private bushManager: BushManager;

  constructor(loadedMap: LoadedMap) {
    super('custom-moba-map');
    this.loadedMap = loadedMap;
    this.bushManager = new BushManager();

    // Register bushes with the bush manager
    for (const bushGroup of loadedMap.bushGroups) {
      // Create a group in the manager
      const group = this.bushManager.createGroup(bushGroup.id, bushGroup.center);

      // Add each bush from the loaded group to the manager's group
      for (const bush of bushGroup.getBushes()) {
        this.bushManager.getBushes().push(bush);
        bush.setGroup(group);
      }
    }
  }

  init(gctx: GameContext): void {
    if (this.initialized) return;
    this.shouldInitialize = false;

    // Add walls
    for (const wall of this.loadedMap.walls) {
      gctx.objects.push(wall);
    }

    // Add towers
    for (const tower of this.loadedMap.towers) {
      gctx.objects.push(tower);
    }

    // Add nexuses
    for (const nexus of this.loadedMap.nexuses) {
      gctx.objects.push(nexus);
    }

    // Add jungle camps
    for (const camp of this.loadedMap.jungleCamps) {
      camp.initialize(gctx);
      gctx.objects.push(camp);
    }

    // Add bush groups and their individual bushes
    for (const bushGroup of this.loadedMap.bushGroups) {
      // Add each bush in the group (bushes are the renderable objects)
      for (const bush of bushGroup.getBushes()) {
        gctx.objects.push(bush);
      }
    }

    // Add lanes and create minion controllers
    for (const lane of this.loadedMap.lanes) {
      gctx.objects.push(lane);

      // Create minion controller for this lane
      const controller = new LaneMinionController(lane);
      this.minionControllers.push(controller);
      gctx.objects.push(controller);
    }

    this.initialized = true;
  }

  override step(gctx: GameContext): void {
    // Update bush manager (tracks which units are in bushes)
    this.bushManager.update(gctx);

    // Check for game over conditions
    for (const nexus of this.loadedMap.nexuses) {
      if (nexus.isDestroyed()) {
        const winner = nexus.getSide() === 0 ? 'Red' : 'Blue';
        console.log(`[GAME] ${winner} team wins!`);
      }
    }
  }

  /**
   * Get the navigation grid for pathfinding.
   */
  getNavigationGrid() {
    return this.loadedMap.navigationGrid;
  }

  /**
   * Get champion spawn position for a side.
   */
  getChampionSpawnPosition(side: 0 | 1): Vector {
    return side === 0
      ? this.loadedMap.spawnPoints.blue.clone()
      : this.loadedMap.spawnPoints.red.clone();
  }

  /**
   * Get nexus for a side.
   */
  getNexus(side: 0 | 1) {
    return this.loadedMap.nexuses.find((n) => n.getSide() === side) || null;
  }

  /**
   * Get all lanes.
   */
  getLanes() {
    return this.loadedMap.lanes;
  }

  /**
   * Get the bush manager for visibility checks.
   */
  getBushManager(): BushManager {
    return this.bushManager;
  }
}
