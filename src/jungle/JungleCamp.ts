/**
 * JungleCamp - Manages a jungle camp with spawning and respawning.
 *
 * Camps:
 * - Spawn creatures at game start
 * - Track when all creatures are killed
 * - Respawn after a delay
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { LogicEntity } from '@/core/GameObject';
import { JungleCreature } from './JungleCreature';
import { JungleCreatureType, MOBAConfig } from '@/map/MOBAConfig';
import { Gromp } from './creatures/Gromp';
import { Spider } from './creatures/Spider';

/**
 * Configuration for a jungle camp.
 */
export interface JungleCampConfig {
  id: string;
  position: Vector;
  creatureType: JungleCreatureType;
  count: number;
  respawnTime: number;
}

/**
 * Manages a jungle camp with creature spawning.
 */
export class JungleCamp extends LogicEntity {
  /** Camp configuration */
  private config: JungleCampConfig;

  /** Creatures currently alive in this camp */
  private creatures: JungleCreature[] = [];

  /** Whether the camp has been cleared */
  private isCleared: boolean = false;

  /** Time until respawn */
  private respawnTimer: number = 0;

  /** Reference to game context for spawning */
  private gctx: GameContext | null = null;

  constructor(config: JungleCampConfig) {
    super(`jungle-camp-${config.id}`);
    this.config = config;
  }

  /**
   * Initialize the camp and spawn initial creatures.
   */
  initialize(gctx: GameContext): void {
    this.gctx = gctx;
    this.spawnCreatures();
  }

  /**
   * Spawn creatures for this camp.
   */
  private spawnCreatures(): void {
    if (!this.gctx) return;

    this.creatures = [];
    this.isCleared = false;

    for (let i = 0; i < this.config.count; i++) {
      // Add small offset for multiple creatures
      const offset = new Vector(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
      );
      const spawnPos = this.config.position.clone().add(offset);

      const creature = this.createCreature(spawnPos);
      creature.setCamp(this);

      this.creatures.push(creature);
      this.gctx.objects.push(creature);
    }
  }

  /**
   * Create a creature of the configured type.
   */
  private createCreature(position: Vector): JungleCreature {
    const stats = MOBAConfig.JUNGLE.CREATURE_STATS[this.config.creatureType];

    switch (this.config.creatureType) {
      case 'gromp':
        return new Gromp(position, stats);
      case 'spider':
        return new Spider(position, stats);
      default:
        // Default to Gromp
        return new Gromp(position, stats);
    }
  }

  /**
   * Called when a creature from this camp is killed.
   */
  onCreatureKilled(creature: JungleCreature): void {
    // Remove from list
    this.creatures = this.creatures.filter(c => c !== creature);

    // Check if camp is cleared
    if (this.creatures.length === 0) {
      this.isCleared = true;
      this.respawnTimer = this.config.respawnTime;
    }
  }

  override step(gctx: GameContext): void {
    if (!this.gctx) {
      this.gctx = gctx;
    }

    // Handle respawn timer
    if (this.isCleared) {
      this.respawnTimer -= gctx.dt;

      if (this.respawnTimer <= 0) {
        this.spawnCreatures();
      }
    }
  }

  /**
   * Get the camp position.
   */
  getPosition(): Vector {
    return this.config.position.clone();
  }

  /**
   * Get the camp ID.
   */
  getCampId(): string {
    return this.config.id;
  }

  /**
   * Check if the camp is cleared.
   */
  isCampCleared(): boolean {
    return this.isCleared;
  }

  /**
   * Get time until respawn (if cleared).
   */
  getRespawnTime(): number {
    return this.isCleared ? this.respawnTimer : 0;
  }

  /**
   * Get number of creatures alive.
   */
  getCreatureCount(): number {
    return this.creatures.length;
  }
}

export default JungleCamp;
