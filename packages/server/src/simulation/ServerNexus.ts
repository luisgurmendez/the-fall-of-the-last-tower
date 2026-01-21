/**
 * ServerNexus - Server-side nexus entity.
 *
 * The main base structure for each team.
 * When destroyed, that team loses the game.
 */

import {
  Vector,
  Side,
  EntityType,
  MOBAConfig,
  type DamageType,
  type NexusSnapshot,
} from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

/**
 * Configuration for creating a nexus.
 */
export interface ServerNexusConfig extends Omit<ServerEntityConfig, 'entityType'> {
  // No additional config needed - uses MOBAConfig defaults
}

/**
 * Server-side nexus entity.
 */
export class ServerNexus extends ServerEntity {
  readonly radius: number;
  private _isDestroyed: boolean = false;

  constructor(config: ServerNexusConfig) {
    super({
      ...config,
      entityType: EntityType.NEXUS,
    });

    // Initialize from MOBAConfig
    this.health = MOBAConfig.NEXUS.HEALTH;
    this.maxHealth = MOBAConfig.NEXUS.HEALTH;
    this.radius = MOBAConfig.NEXUS.RADIUS;
  }

  /**
   * Check if nexus is destroyed.
   */
  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Get nexus radius for collision.
   */
  getRadius(): number {
    return this.radius;
  }

  /**
   * Update nexus each tick.
   * Nexus is passive - it doesn't attack, just takes damage.
   */
  update(dt: number, context: ServerGameContext): void {
    // Nexus is passive - nothing to update
  }

  /**
   * Called when the nexus is destroyed.
   */
  protected onDeath(killerId?: string): void {
    super.onDeath(killerId);
    this._isDestroyed = true;
    console.log(`[ServerNexus] ${this.side === 0 ? 'Blue' : 'Red'} nexus destroyed!`);
  }

  /**
   * Override damage calculation for armor/magic resist.
   */
  protected calculateDamage(amount: number, type: DamageType): number {
    if (type === 'true' || type === 'pure') {
      return amount;
    }

    // Nexus has moderate resistances
    const armor = 50;
    const magicResist = 50;

    let reduction = 0;
    if (type === 'physical') {
      reduction = armor / (100 + armor);
    } else if (type === 'magic') {
      reduction = magicResist / (100 + magicResist);
    }

    return amount * (1 - reduction);
  }

  /**
   * Create snapshot for network sync.
   */
  toSnapshot(): NexusSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.NEXUS,
      side: this.side,
      x: this.position.x,
      y: this.position.y,
      health: this.health,
      maxHealth: this.maxHealth,
      isDestroyed: this._isDestroyed,
    };
  }
}
