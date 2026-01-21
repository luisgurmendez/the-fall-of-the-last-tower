/**
 * ServerJungleCamp - Manages a jungle camp's creatures and respawning.
 *
 * Handles:
 * - Initial spawn of creatures
 * - Tracking creature deaths
 * - Respawning after camp is cleared
 */

import { Vector, MOBAConfig } from '@siege/shared';
import { ServerJungleCreature } from './ServerJungleCreature';
import type { ServerGameContext } from '../game/ServerGameContext';

type JungleCreatureType = keyof typeof MOBAConfig.JUNGLE.CREATURE_STATS;

export interface JungleCampConfig {
  id: string;
  position: Vector;
  creatureType: JungleCreatureType;
  count: number;
  respawnTime: number;
}

/**
 * Server-side jungle camp manager.
 */
export class ServerJungleCamp {
  readonly id: string;
  readonly position: Vector;
  readonly creatureType: JungleCreatureType;
  readonly count: number;
  readonly respawnTime: number;

  // Tracking
  private creatureIds: Set<string> = new Set();
  private respawnTimer: number = 0;
  private isCleared: boolean = false;

  constructor(config: JungleCampConfig) {
    this.id = config.id;
    this.position = config.position.clone();
    this.creatureType = config.creatureType;
    this.count = config.count;
    this.respawnTime = config.respawnTime;
  }

  /**
   * Spawn initial creatures for this camp.
   */
  spawnCreatures(context: ServerGameContext): void {
    for (let i = 0; i < this.count; i++) {
      // Spread creatures around camp position
      const offset = this.getSpawnOffset(i, this.count);
      const spawnPos = this.position.clone().add(offset);

      const creature = new ServerJungleCreature({
        id: context.generateEntityId(),
        position: spawnPos,
        campId: this.id,
        creatureType: this.creatureType,
        homePosition: spawnPos,
      });

      context.addEntity(creature);
      this.creatureIds.add(creature.id);
    }

    this.isCleared = false;
    console.log(`[ServerJungleCamp] Spawned ${this.count} ${this.creatureType}(s) at camp ${this.id}`);
  }

  /**
   * Get spawn offset for creature index.
   */
  private getSpawnOffset(index: number, total: number): Vector {
    if (total === 1) {
      return new Vector(0, 0);
    }

    // Spread in a circle around the camp center
    const angle = (index / total) * Math.PI * 2;
    const radius = 30 + total * 5;
    return new Vector(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    );
  }

  /**
   * Update camp state - check for respawn.
   */
  update(dt: number, context: ServerGameContext): void {
    // Check if creatures are still alive
    if (!this.isCleared) {
      let allDead = true;
      for (const creatureId of this.creatureIds) {
        const creature = context.getEntity(creatureId);
        if (creature && !creature.isDead) {
          allDead = false;
          break;
        }
      }

      if (allDead && this.creatureIds.size > 0) {
        this.isCleared = true;
        this.respawnTimer = this.respawnTime;
        this.creatureIds.clear();
        console.log(`[ServerJungleCamp] Camp ${this.id} cleared, respawning in ${this.respawnTime}s`);
      }
    }

    // Handle respawn timer
    if (this.isCleared) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.spawnCreatures(context);
      }
    }
  }

  /**
   * Check if camp is currently cleared (waiting for respawn).
   */
  isCampCleared(): boolean {
    return this.isCleared;
  }

  /**
   * Get time until respawn.
   */
  getRespawnTimer(): number {
    return Math.max(0, this.respawnTimer);
  }
}
