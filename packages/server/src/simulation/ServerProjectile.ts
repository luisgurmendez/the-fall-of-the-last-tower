/**
 * ServerProjectile - Server-side projectile for skillshot abilities.
 *
 * Projectiles travel in a direction and can collide with enemies.
 * Used for abilities like fireballs, shurikens, etc.
 */

import {
  Vector,
  EntityType,
  Side,
  DamageType,
  ProjectileSnapshot,
  getAbilityDefinition,
  canAbilityAffectEntityType,
  hasRecastBehavior,
  getRecastAbility,
  AbilitySlot,
} from '@siege/shared';
import { ServerEntity, ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import type { ServerChampion } from './ServerChampion';

export interface ServerProjectileConfig extends Omit<ServerEntityConfig, 'entityType'> {
  /** Direction the projectile travels (normalized) */
  direction: Vector;
  /** Speed in units per second */
  speed: number;
  /** Collision radius */
  radius: number;
  /** Maximum distance before despawning */
  maxDistance: number;
  /** ID of the caster (for ownership) */
  sourceId: string;
  /** Ability ID that created this projectile */
  abilityId: string;
  /** Damage to deal on hit */
  damage: number;
  /** Damage type */
  damageType: DamageType;
  /** Whether projectile passes through targets */
  piercing?: boolean;
  /** Effect IDs to apply on hit */
  appliesEffects?: string[];
  /** Duration for applied effects */
  effectDuration?: number;
}

export class ServerProjectile extends ServerEntity {
  readonly direction: Vector;
  readonly speed: number;
  readonly radius: number;
  readonly maxDistance: number;
  readonly sourceId: string;
  readonly abilityId: string;
  readonly damage: number;
  readonly damageType: DamageType;
  readonly piercing: boolean;
  readonly appliesEffects: string[];
  readonly effectDuration: number;

  private distanceTraveled = 0;
  private hitEntityIds: Set<string> = new Set();

  constructor(config: ServerProjectileConfig) {
    super({
      id: config.id,
      entityType: EntityType.PROJECTILE,
      position: config.position.clone(),
      side: config.side,
    });

    this.direction = config.direction.normalized();
    this.speed = config.speed;
    this.radius = config.radius;
    this.maxDistance = config.maxDistance;
    this.sourceId = config.sourceId;
    this.abilityId = config.abilityId;
    this.damage = config.damage;
    this.damageType = config.damageType;
    this.piercing = config.piercing ?? false;
    this.appliesEffects = config.appliesEffects ?? [];
    this.effectDuration = config.effectDuration ?? 0;

    // Set movement speed for visual interpolation
    this.movementSpeed = config.speed;
  }

  /**
   * Update projectile for one tick.
   */
  update(dt: number, context: ServerGameContext): void {
    if (this.isDead) return;

    // Move projectile
    const movement = this.direction.clone().scalar(this.speed * dt);
    this.position.add(movement);
    this.distanceTraveled += movement.length();

    // Check max distance
    if (this.distanceTraveled >= this.maxDistance) {
      this.isDead = true;
      this.markForRemoval();
      return;
    }

    // Check collisions with enemies
    this.checkCollisions(context);
  }

  /**
   * Check for collisions with enemy entities.
   */
  private checkCollisions(context: ServerGameContext): void {
    const entities = context.getEntitiesInRadius(this.position, this.radius + 50);

    // Get ability definition for entity type filtering
    const abilityDef = getAbilityDefinition(this.abilityId);

    for (const entity of entities) {
      // Skip self (by ID), allies, and already-hit entities
      // IMPORTANT: Also skip the projectile itself by ID (not just side)
      if (
        entity.id === this.id ||  // Skip self by ID
        entity.id === this.sourceId ||
        entity.side === this.side ||
        this.hitEntityIds.has(entity.id)
      ) {
        continue;
      }

      // Skip dead or untargetable entities
      if (entity.isDead) continue;

      // Check if ability can affect this entity type
      if (!canAbilityAffectEntityType(abilityDef, entity.entityType)) {
        continue;
      }

      // Check collision
      const distance = this.position.distanceTo(entity.position);
      const hitRadius = this.radius + (entity.getRadius?.() ?? 25);

      if (distance <= hitRadius) {
        this.onHitEntity(entity, context);

        if (!this.piercing) {
          this.isDead = true;
          this.markForRemoval();
          return;
        }
      }
    }
  }

  /**
   * Handle hitting an entity.
   */
  private onHitEntity(entity: ServerEntity, context: ServerGameContext): void {
    this.hitEntityIds.add(entity.id);

    // Deal damage
    entity.takeDamage(this.damage, this.damageType, this.sourceId, context);

    // Apply effects
    if (this.appliesEffects.length > 0 && 'applyEffect' in entity) {
      const applyEffect = (entity as { applyEffect: (id: string, duration: number, sourceId?: string) => void }).applyEffect;
      for (const effectId of this.appliesEffects) {
        applyEffect.call(entity, effectId, this.effectDuration, this.sourceId);
      }
    }

    // Check for recast behavior and notify source champion
    this.notifyRecastOnHit(context);
  }

  /**
   * Notify source champion of hit for abilities with recast behavior.
   */
  private notifyRecastOnHit(context: ServerGameContext): void {
    const abilityDef = getAbilityDefinition(this.abilityId);
    if (!abilityDef || !hasRecastBehavior(abilityDef)) return;

    // Only trigger recast if condition is 'on_hit' or 'always'
    if (abilityDef.recastCondition !== 'on_hit' && abilityDef.recastCondition !== 'always') {
      return;
    }

    // Get the source champion
    const sourceChampion = context.getEntity(this.sourceId) as ServerChampion | undefined;
    if (!sourceChampion || !('enableRecast' in sourceChampion)) return;

    // Find the ability slot from the ability ID
    const slot = this.findAbilitySlot(sourceChampion, this.abilityId);
    if (!slot) return;

    // Get recast configuration
    const recastConfig = getRecastAbility(abilityDef);
    if (!recastConfig) return;

    const recastWindow = abilityDef.recastWindow ?? 3.0;
    const maxRecasts = recastConfig.maxRecasts;

    // Enable recast on the champion
    sourceChampion.enableRecast(slot, this.position.clone(), maxRecasts, recastWindow);
  }

  /**
   * Find which ability slot maps to this ability ID.
   */
  private findAbilitySlot(champion: ServerChampion, abilityId: string): AbilitySlot | null {
    const abilities = champion.definition.abilities;
    for (const slot of ['Q', 'W', 'E', 'R'] as AbilitySlot[]) {
      if (abilities[slot] === abilityId) {
        return slot;
      }
    }
    return null;
  }

  /**
   * Projectiles don't participate in unit collision.
   */
  override isCollidable(): boolean {
    return false;
  }

  /**
   * Get projectile radius.
   */
  override getRadius(): number {
    return this.radius;
  }

  /**
   * Convert to network snapshot.
   */
  toSnapshot(): ProjectileSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.PROJECTILE,
      side: this.side,
      x: this.position.x,
      y: this.position.y,
      directionX: this.direction.x,
      directionY: this.direction.y,
      speed: this.speed,
      radius: this.radius,
      sourceId: this.sourceId,
      abilityId: this.abilityId,
      isDead: this.isDead,
    };
  }
}
