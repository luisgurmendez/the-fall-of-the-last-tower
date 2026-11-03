/**
 * ServerTrap - Server-side trap entity.
 *
 * Traps are placeable entities that:
 * - Are invisible to enemies (stealthed)
 * - Trigger when enemy champions enter the trigger radius, once armed (a
 *   moment after being placed: one dropped on an enemy doesn't snap shut at
 *   once), on a champion not caught by another trap in the last 3 seconds
 *   (traps can't be chained into one long root)
 * - Apply effects (root) and grant owner stacks
 * - Can be exploded by owner's ultimate: magic damage for its rank (the
 *   ability's trap.explosionDamage) to the units the ability affects
 *   (not towers or wards), and a root on champions
 */

import {
  Vector,
  Side,
  EntityType,
  DamageType,
  GameEventType,
  canAbilityAffectEntityType,
  getAbilityDefinition,
  type TrapSnapshot,
} from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import type { ServerChampion } from './ServerChampion';
import { Logger } from '../utils/Logger';

/**
 * Configuration for creating a trap.
 */
export interface ServerTrapConfig extends Omit<ServerEntityConfig, 'entityType'> {
  ownerId: string;
  /** The ability that placed it (its trap config and what it affects) */
  abilityId: string;
  triggerRadius: number;
  duration: number;
  isStealthed: boolean;
  rootDuration: number;
  soulStacksOnTrigger: number;
  // Explosion properties (when owner casts R)
  explosionRadius: number;
  explosionRootDuration: number;
}

/**
 * Server-side trap entity.
 */
export class ServerTrap extends ServerEntity {
  readonly ownerId: string;
  readonly abilityId: string;
  readonly triggerRadius: number;
  readonly duration: number;
  readonly isStealthed: boolean;
  readonly rootDuration: number;
  readonly soulStacksOnTrigger: number;
  readonly explosionRadius: number;
  readonly explosionRootDuration: number;

  private remainingDuration: number;
  private hasTriggered: boolean = false;
  /** Seconds until it can trigger */
  private armingTime = ServerTrap.ARM_DELAY;

  /** A trap arms this long after it's placed */
  static readonly ARM_DELAY = 1;
  /** A champion caught by a trap can't be caught by another for this long */
  static readonly CAUGHT_IMMUNITY = 3;

  constructor(config: ServerTrapConfig) {
    super({
      ...config,
      entityType: EntityType.WARD, // Use WARD entity type for network sync
    });

    this.ownerId = config.ownerId;
    this.abilityId = config.abilityId;
    this.triggerRadius = config.triggerRadius;
    this.duration = config.duration;
    this.isStealthed = config.isStealthed;
    this.rootDuration = config.rootDuration;
    this.soulStacksOnTrigger = config.soulStacksOnTrigger;
    this.explosionRadius = config.explosionRadius;
    this.explosionRootDuration = config.explosionRootDuration;

    this.remainingDuration = config.duration;

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

    // Check for enemy champions in trigger radius, once armed
    if (this.armingTime > 0) {
      this.armingTime -= dt;
      return;
    }
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
      if ((entity as ServerChampion).hasEffect('vile_trap_caught')) continue;

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

    // Apply root effect, and no other trap for a while
    target.applyEffect('vile_root', this.rootDuration, this.ownerId);
    target.applyEffect('vile_trap_caught', ServerTrap.CAUGHT_IMMUNITY, this.ownerId);

    // Grant owner soul stacks
    const owner = context.getEntity(this.ownerId) as ServerChampion | undefined;
    if (owner && !owner.isDead) {
      owner.passiveState.stacks += this.soulStacksOnTrigger;
      Logger.debug('Trap', `Granted ${this.soulStacksOnTrigger} soul stacks to ${owner.playerId}`);
    }

    // Emit trap trigger event (with where it was: the enemy never had the trap itself)
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: this.id,
      abilityId: 'vile_trap_trigger',
      targetEntityId: target.id,
      x: this.position.x,
      y: this.position.y,
    });

    // Mark for removal
    this.isDead = true;
    this.markForRemoval();
  }

  /**
   * Explode the trap (called when owner casts R, at that ultimate's rank).
   * Deals magic damage in a radius to the units its ability affects and
   * roots the champions.
   */
  explode(context: ServerGameContext, ultimateRank: number): void {
    if (this.isDead || this.hasTriggered) return;
    this.hasTriggered = true;

    Logger.debug('Trap', `Trap exploded at (${this.position.x}, ${this.position.y})`);

    const ability = getAbilityDefinition(this.abilityId);
    const damages = ability?.trap?.explosionDamage ?? [];
    const damage = damages[Math.min(Math.max(ultimateRank, 1), damages.length) - 1] ?? 0;

    // Get all enemies in explosion radius
    const entities = context.getEntitiesInRadius(this.position, this.explosionRadius);

    for (const entity of entities) {
      // Only affect enemy units the ability affects (not towers or wards)
      if (entity.side === this.side) continue;
      if (entity.isDead) continue;
      if (!canAbilityAffectEntityType(ability, entity.entityType)) continue;

      // Deal magic damage
      if (damage > 0) {
        entity.takeDamage(damage, 'magic', this.ownerId, context);
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
      entityType: EntityType.WARD,
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
