/**
 * PathFollower - Walks champions along paths around walls.
 *
 * A move command computes a path with Terrain.findPath() and gives the
 * champion its first waypoint as a normal move target. Each tick, before
 * entities update, champions that reached their waypoint get the next one.
 * Anything else that changes a champion's move target (a new command, an
 * attack, a dash, a stop) ends the path.
 */

import type { Vector } from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from '../game/ServerGameContext';

interface ActivePath {
  waypoints: Vector[];
  index: number;
}

export class PathFollower {
  private paths: Map<string, ActivePath> = new Map();

  /**
   * Start walking a champion along waypoints (the champion's position is the start).
   */
  follow(champion: ServerChampion, waypoints: Vector[]): void {
    if (waypoints.length === 0) return;
    champion.setMoveTarget(waypoints[0]);
    if (waypoints.length > 1) {
      this.paths.set(champion.id, { waypoints, index: 0 });
    } else {
      this.paths.delete(champion.id);
    }
  }

  clear(championId: string): void {
    this.paths.delete(championId);
  }

  isFollowing(championId: string): boolean {
    return this.paths.has(championId);
  }

  /**
   * Advance champions that reached (or are about to reach) their waypoint.
   * Call before entities move.
   */
  update(context: ServerGameContext, dt: number): void {
    for (const [championId, path] of this.paths) {
      const champion = context.getChampion(championId);
      if (!champion || champion.isDead) {
        this.paths.delete(championId);
        continue;
      }

      const waypoint = path.waypoints[path.index];
      const target = champion.targetPosition;

      // Something else took over the champion's movement
      if (champion.targetEntityId || (target && !target.equals(waypoint, 0.5))) {
        this.paths.delete(championId);
        continue;
      }

      const distance = champion.position.distanceTo(waypoint);
      const arrived = !target && distance < 1;
      const arrivingThisTick = target && distance <= champion.movementSpeed * dt + 5;

      if (!target && !arrived) {
        // Stopped short of the waypoint (stop command, CC, ability)
        this.paths.delete(championId);
        continue;
      }

      if (arrived || arrivingThisTick) {
        path.index++;
        if (path.index >= path.waypoints.length) {
          this.paths.delete(championId);
        } else {
          champion.setMoveTarget(path.waypoints[path.index]);
        }
      }
    }
  }
}
