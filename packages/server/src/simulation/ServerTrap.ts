/**
 * ServerTrap - Server-side trap entity.
 *
 * Traps are placeable entities that:
 * - Are invisible to enemies (stealthed)
 * - Trigger when enemy champions enter the trigger radius
 * - Apply effects (root) and grant owner stacks
 * - Can be exploded by owner's ultimate
 */

import {
  Vector,
  Side,
  EntityType,
  DamageType,
  GameEventType,
} from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import type { ServerChampion } from './ServerChampion';
import { Logger } from '../utils/Logger';

/**
 * Trap snapshot for network sync.
 * Traps don't use EntityType.WARD - they're not visible like wards.
 * We'll use a custom snapshot type that the client can render differently.
 */
export interface TrapSnapshot {
  entityId: string;
  entityType: EntityType;
  side: Side;
  ownerId: string;

  x: number;
  y: number;

  // Trap state
  isDead: boolean;
  isStealthed: boolean;
  triggerRadius: number;
  remainingDuration: number;
}

/**
 * Configuration for creating a trap.
 */
export interface ServerTrapConfig extends Omit<ServerEntityConfig, 'entityType'> {
  ownerId: string;
  triggerRadius: number;
  duration: number;
  isStealthed: boolean;
  rootDuration: number;
  soulStacksOnTrigger: number;
  // Explosion properties (when owner casts R)
  explosionDamage: number;
  explosionRadius: number;
  explosionRootDuration: number;
}

/**
 * Server-side trap entity.
 */
export class ServerTrap extends ServerEntity {
  readonly ownerId: string;
  readonly triggerRadius: number;
  readonly duration: number;
  readonly isStealthed: boolean;
  readonly rootDuration: number;
  readonly soulStacksOnTrigger: number;
  readonly explosionDamage: number;
  readonly explosionRadius: number;
  readonly explosionRootDuration: number;

  private remainingDuration: number;
  private placedAt: number;
  private hasTriggered: boolean = false;

  constructor(config: ServerTrapConfig) {
    super({
      ...config,
      entityType: EntityType.WARD, // Use WARD entity type for network sync
    });

    this.ownerId = config.ownerId;
    this.triggerRadius = config.triggerRadius;
    this.duration = config.duration;
    this.isStealthed = config.isStealthed;
    this.rootDuration = config.rootDuration;
    this.soulStacksOnTrigger = config.soulStacksOnTrigger;
    this.explosionDamage = config.explosionDamage;
    this.explosionRadius = config.explosionRadius;
    this.explosionRootDuration = config.explosionRootDuration;

    this.remainingDuration = config.duration;
    this.placedAt = Date.now();

    // Traps don't have health - they're instant effects
    this.health = 1;
    this.maxHealth = 1;
  }

  /**
   * Traps don't participate in collision.
   */
  override isCollidable(): boolean {
    return false;
  }

  /**
   * Get trap radius (for targeting/visuals).
   */
  override getRadius(): number {
    return 20;
  }

  /**
   * Update trap each tick.
   */
  update(dt: number, context: ServerGameContext): void {
    if (this.isDead || this.hasTriggered) return;

    // Update duration
    if (this.duration > 0) {
      this.remainingDuration -= dt;
      if (this.remainingDuration <= 0) {
        this.expire();
        return;
      }
    }

    // Check for enemy champions in trigger radius
    this.checkTrigger(context);
  }

  /**
   * Check if any enemy champion is in trigger radius.
   */
  private checkTrigger(context: ServerGameContext): void {
    const entities = context.getEntitiesInRadius(this.position, this.triggerRadius);

    for (const entity of entities) {
      // Only trigger on enemy champions
      if (entity.side === this.side) continue;
      if (entity.entityType !== EntityType.CHAMPION) continue;
      if (entity.isDead) continue;

      // Trigger on this champion
      this.trigger(entity as ServerChampion, context);
      break; // Only trigger once
    }
  }

  /**
   * Trigger the trap on an enemy champion.
   */
  private trigger(target: ServerChampion, context: ServerGameContext): void {
    if (this.hasTriggered) return;
    this.hasTriggered = true;

    Logger.debug('Trap', `Trap triggered by ${target.playerId}`);

    // Apply root effect
    target.applyEffect('vile_root', this.rootDuration, this.ownerId);

    // Grant owner soul stacks
    const owner = context.getEntity(this.ownerId) as ServerChampion | undefined;
    if (owner && !owner.isDead) {
      owner.passiveState.stacks += this.soulStacksOnTrigger;
      Logger.debug('Trap', `Granted ${this.soulStacksOnTrigger} soul stacks to ${owner.playerId}`);
    }

    // Emit trap trigger event
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: this.id,
      abilityId: 'vile_trap_trigger',
      targetEntityId: target.id,
    });

    // Mark for removal
    this.isDead = true;
    this.markForRemoval();
  }

  /**
   * Explode the trap (called when owner casts R).
   * Deals magic damage in a radius and roots all enemies.
   */
  explode(context: ServerGameContext): void {
    if (this.isDead || this.hasTriggered) return;
    this.hasTriggered = true;

    Logger.debug('Trap', `Trap exploded at (${this.position.x}, ${this.position.y})`);

    // Get all enemies in explosion radius
    const entities = context.getEntitiesInRadius(this.position, this.explosionRadius);

    for (const entity of entities) {
      // Only affect enemies
      if (entity.side === this.side) continue;
      if (entity.isDead) continue;

      // Deal magic damage
      if (this.explosionDamage > 0) {
        entity.takeDamage(this.explosionDamage, 'magic', this.ownerId, context);
      }

      // Apply root to champions
      if (entity.entityType === EntityType.CHAMPION) {
        (entity as ServerChampion).applyEffect('vile_root', this.explosionRootDuration, this.ownerId);
      }
    }

    // Emit explosion event
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: this.id,
      abilityId: 'vile_trap_explosion',
      x: this.position.x,
      y: this.position.y,
      radius: this.explosionRadius,
    });

    // Mark for removal
    this.isDead = true;
    this.markForRemoval();
  }

  /**
   * Trap expires after duration.
   */
  private expire(): void {
    Logger.debug('Trap', `Trap expired at (${this.position.x}, ${this.position.y})`);
    this.isDead = true;
    this.markForRemoval();
  }

  /**
   * Check if this trap is visible to a specific side.
   */
  isVisibleTo(viewingSide: Side): boolean {
    // Own team always sees their traps
    if (viewingSide === this.side) return true;

    // Stealthed traps are invisible to enemies
    if (this.isStealthed) return false;

    return true;
  }

  /**
   * Create snapshot for network sync.
   */
  toSnapshot(): TrapSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.WARD, // Use WARD for network compatibility
      side: this.side,
      ownerId: this.ownerId,
      x: this.position.x,
      y: this.position.y,
      isDead: this.isDead,
      isStealthed: this.isStealthed,
      triggerRadius: this.triggerRadius,
      remainingDuration: this.remainingDuration,
    };
  }
}

/**
 * Get all traps owned by a specific player from the context.
 */
export function getPlayerTraps(ownerId: string, context: ServerGameContext): ServerTrap[] {
  // We need to iterate through entities and filter for traps
  // This requires ServerGameContext to expose entity iteration
  const traps: ServerTrap[] = [];

  // Get all entities and filter for traps owned by this player
  const allEntities = context.getAllEntities();
  for (const entity of allEntities) {
    if (entity instanceof ServerTrap && entity.ownerId === ownerId && !entity.isDead) {
      traps.push(entity);
    }
  }

  return traps;
}
