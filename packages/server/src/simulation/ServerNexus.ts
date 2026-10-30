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
  getEffectiveRadius,
  type DamageType,
  type EntityCollision,
  type NexusSnapshot,
} from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import { isStructureVulnerable } from '../systems/StructureRules';
import type { ServerGameContext } from '../game/ServerGameContext';
import { Logger } from '../utils/Logger';

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

  /** Can't be damaged yet (see StructureRules); refreshed every tick */
  isProtected = false;

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
   * The nexus is a solid building: units can't walk through it.
   */
  override isCollidable(): boolean {
    return !this.isDead && !this._isDestroyed;
  }

  /**
   * Bounding radius of the building's footprint.
   * @deprecated Use getCollisionShape() for proper shape-based collision.
   */
  getRadius(): number {
    return getEffectiveRadius(MOBAConfig.NEXUS.collision);
  }

  /**
   * The building's footprint (a rectangle).
   */
  override getCollisionShape(): EntityCollision {
    return MOBAConfig.NEXUS.collision;
  }

  /**
   * Immovable: units are pushed away from it.
   */
  override getMass(): number {
    return Infinity;
  }

  /**
   * Update nexus each tick.
   * Nexus is passive - it doesn't attack, just takes damage.
   */
  update(dt: number, context: ServerGameContext): void {
    // Nexus is passive - it only tracks whether it can be damaged yet
    this.isProtected = !isStructureVulnerable(this, context);
  }

  /**
   * Called when the nexus is destroyed.
   */
  protected onDeath(killerId?: string): void {
    super.onDeath(killerId);
    this._isDestroyed = true;
    Logger.game.info(`[ServerNexus] ${this.side === 0 ? 'Blue' : 'Red'} nexus destroyed!`);
  }

  /**
   * Structures fall in lane order: damage is ignored while this one is protected
   * (see StructureRules).
   */
  override takeDamage(amount: number, type: DamageType, sourceId?: string, context?: ServerGameContext): number {
    if (context && !isStructureVulnerable(this, context)) return 0;
    return super.takeDamage(amount, type, sourceId, context);
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
      isProtected: this.isProtected,
    };
  }
}
