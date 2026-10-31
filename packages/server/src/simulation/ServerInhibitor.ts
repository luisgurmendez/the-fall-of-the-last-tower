/**
 * ServerInhibitor - Server-side inhibitor entity.
 *
 * One per lane per side, at the base's entrance. It doesn't attack. It can
 * only be damaged once its lane's towers are down, and while one is destroyed
 * its nexus can be damaged and the enemy's waves in its lane bring super
 * minions (see StructureRules and ServerGameContext.spawnLaneMinions).
 *
 * A destroyed inhibitor is not removed: it stays in the game, dead and not
 * solid, and rebuilds at full health MOBAConfig.INHIBITORS.STATS.respawnTime
 * seconds later.
 */

import {
  EntityType,
  GameEventType,
  MOBAConfig,
  type DamageType,
  type EntityCollision,
  type InhibitorSnapshot,
  type LaneId,
} from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import { isStructureVulnerable } from '../systems/StructureRules';
import type { ServerGameContext } from '../game/ServerGameContext';
import { RewardSystem } from '../systems/RewardSystem';
import { Logger } from '../utils/Logger';

const STATS = MOBAConfig.INHIBITORS.STATS;

/**
 * Configuration for creating an inhibitor.
 */
export interface ServerInhibitorConfig extends Omit<ServerEntityConfig, 'entityType'> {
  lane: LaneId;
}

/**
 * Server-side inhibitor entity.
 */
export class ServerInhibitor extends ServerEntity {
  readonly lane: LaneId;
  /** Gold for the last hit (RewardSystem); inhibitors give no experience */
  readonly goldReward = STATS.goldReward;

  /** Game time it rebuilds at while destroyed, else null */
  private _respawnAt: number | null = null;

  /** Can't be damaged yet (see StructureRules); refreshed every tick */
  isProtected = false;

  constructor(config: ServerInhibitorConfig) {
    super({
      ...config,
      entityType: EntityType.INHIBITOR,
    });

    this.lane = config.lane;
    this.health = STATS.health;
    this.maxHealth = STATS.health;
  }

  /**
   * Destroyed (and waiting to rebuild).
   */
  get isDestroyed(): boolean {
    return this.isDead;
  }

  /**
   * Game time it rebuilds at while destroyed, else null.
   */
  get respawnAt(): number | null {
    return this._respawnAt;
  }

  /**
   * Solid while standing: units can't walk through it.
   */
  override isCollidable(): boolean {
    return !this.isDead;
  }

  /**
   * Radius of its footprint (a circle).
   */
  override getRadius(): number {
    return STATS.collision.radius;
  }

  override getCollisionShape(): EntityCollision {
    return STATS.collision;
  }

  /**
   * Immovable: units are pushed away from it.
   */
  override getMass(): number {
    return Infinity;
  }

  /**
   * Inhibitors are passive: they track whether they can be damaged yet, and
   * rebuild once their time is up.
   */
  update(dt: number, context: ServerGameContext): void {
    if (this.isDead) {
      // Destroyed without a context (no game time then): count from now
      if (this._respawnAt === null) this._respawnAt = context.getGameTime() + STATS.respawnTime;
      if (context.getGameTime() >= this._respawnAt) this.rebuild(context);
    }
    this.isProtected = !isStructureVulnerable(this, context);
  }

  /**
   * Called when the inhibitor is destroyed.
   */
  protected onDeath(killerId?: string, context?: ServerGameContext): void {
    super.onDeath(killerId, context);
    if (!context) return;

    this._respawnAt = context.getGameTime() + STATS.respawnTime;
    // Gold for the killer, and the INHIBITOR_DESTROYED announcement
    RewardSystem.awardKillRewards(this, killerId, context);
    Logger.game.info(`[ServerInhibitor] ${this.side === 0 ? 'Blue' : 'Red'} ${this.lane} inhibitor destroyed`);
  }

  /**
   * Back at full health, solid and in the way of the enemy again.
   */
  private rebuild(context: ServerGameContext): void {
    this.isDead = false;
    this.health = this.maxHealth;
    this._respawnAt = null;
    context.addEvent(GameEventType.INHIBITOR_RESPAWNED, {
      inhibitorId: this.id,
      side: this.side,
      lane: this.lane,
    });
    Logger.game.info(`[ServerInhibitor] ${this.side === 0 ? 'Blue' : 'Red'} ${this.lane} inhibitor rebuilt`);
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
   * Armor and magic resist reduce damage like a tower's.
   */
  protected calculateDamage(amount: number, type: DamageType): number {
    if (type === 'true' || type === 'pure') {
      return amount;
    }

    let reduction = 0;
    if (type === 'physical') {
      reduction = STATS.armor / (100 + STATS.armor);
    } else if (type === 'magic') {
      reduction = STATS.magicResist / (100 + STATS.magicResist);
    }

    return amount * (1 - reduction);
  }

  /**
   * Create snapshot for network sync.
   */
  toSnapshot(): InhibitorSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.INHIBITOR,
      side: this.side,
      lane: this.lane,
      x: this.position.x,
      y: this.position.y,
      health: this.health,
      maxHealth: this.maxHealth,
      isDestroyed: this.isDead,
      // null (not undefined) once it's standing again, for delta updates
      respawnAt: this._respawnAt,
      isProtected: this.isProtected,
    };
  }
}
