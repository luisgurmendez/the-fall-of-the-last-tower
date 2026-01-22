/**
 * ServerZone - Server-side persistent ground effect zone.
 *
 * Zones are created by abilities and persist for a duration.
 * They can apply effects (damage, slow, heal) to entities inside.
 */

import {
  Vector,
  EntityType,
  Side,
  DamageType,
  ZoneSnapshot,
} from '@siege/shared';
import { ServerEntity, ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

export type ZoneEffectType = 'damage' | 'slow' | 'heal' | 'buff';

export interface ServerZoneConfig extends Omit<ServerEntityConfig, 'entityType'> {
  /** Radius of the zone effect */
  radius: number;
  /** Total duration in seconds */
  duration: number;
  /** ID of the champion who created the zone */
  sourceId: string;
  /** Ability ID that created this zone */
  abilityId: string;
  /** Type of zone effect for visuals */
  zoneType: ZoneEffectType;
  /** Optional color override for rendering */
  color?: string;
  /** Damage per tick (if damage zone) */
  damage?: number;
  /** Damage type (if damage zone) */
  damageType?: DamageType;
  /** Effect IDs to apply to entities inside */
  appliesEffects?: string[];
  /** Duration for applied effects */
  effectDuration?: number;
  /** Interval between ticks in seconds (default: continuous) */
  tickRate?: number;
}

export class ServerZone extends ServerEntity {
  readonly radius: number;
  readonly totalDuration: number;
  readonly sourceId: string;
  readonly abilityId: string;
  readonly zoneType: ZoneEffectType;
  readonly color?: string;
  readonly damage: number;
  readonly damageType: DamageType;
  readonly appliesEffects: string[];
  readonly effectDuration: number;
  readonly tickRate: number;

  private remainingDuration: number;
  private timeSinceLastTick: number;
  /** Track which entities have been affected in the current tick */
  private tickedEntityIds: Set<string> = new Set();

  constructor(config: ServerZoneConfig) {
    super({
      id: config.id,
      entityType: EntityType.ZONE,
      position: config.position.clone(),
      side: config.side,
    });

    this.radius = config.radius;
    this.totalDuration = config.duration;
    this.remainingDuration = config.duration;
    this.sourceId = config.sourceId;
    this.abilityId = config.abilityId;
    this.zoneType = config.zoneType;
    this.color = config.color;
    this.damage = config.damage ?? 0;
    this.damageType = config.damageType ?? 'magic';
    this.appliesEffects = config.appliesEffects ?? [];
    this.effectDuration = config.effectDuration ?? 0;
    this.tickRate = config.tickRate ?? 0; // 0 = continuous effect application
    // Start at tickRate so first tick happens immediately
    this.timeSinceLastTick = this.tickRate;
  }

  /**
   * Update zone for one tick.
   */
  update(dt: number, context: ServerGameContext): void {
    if (this.isDead) return;

    // Update duration
    this.remainingDuration -= dt;
    if (this.remainingDuration <= 0) {
      this.isDead = true;
      this.markForRemoval();
      return;
    }

    // Handle tick-based zones (like Inferno Zone with damage every second)
    if (this.tickRate > 0) {
      this.timeSinceLastTick += dt;
      if (this.timeSinceLastTick >= this.tickRate) {
        this.timeSinceLastTick -= this.tickRate;
        this.tickedEntityIds.clear(); // Reset for new tick
        this.applyEffectsToEntitiesInside(context, true);
      }
    } else {
      // Continuous zones (like Quagmire slow) - apply effects every frame
      // Clear ticked entities each frame so effects can refresh
      this.tickedEntityIds.clear();
      this.applyEffectsToEntitiesInside(context, false);
    }
  }

  /**
   * Apply effects to all entities inside the zone.
   */
  private applyEffectsToEntitiesInside(context: ServerGameContext, dealDamage: boolean): void {
    const entities = context.getEntitiesInRadius(this.position, this.radius);

    for (const entity of entities) {
      // Skip allies (zones affect enemies)
      // Skip dead entities
      // For tick-based zones, skip already-ticked entities this tick
      if (
        entity.side === this.side ||
        entity.isDead ||
        this.tickedEntityIds.has(entity.id)
      ) {
        continue;
      }

      // Check if actually inside the zone radius
      const distance = this.position.distanceTo(entity.position);
      if (distance > this.radius) {
        continue;
      }

      // Mark as affected this tick
      this.tickedEntityIds.add(entity.id);

      // Deal damage if applicable
      if (dealDamage && this.damage > 0) {
        entity.takeDamage(this.damage, this.damageType, this.sourceId, context);
      }

      // Apply effects
      if (this.appliesEffects.length > 0 && 'applyEffect' in entity) {
        const applyEffect = (entity as { applyEffect: (id: string, duration: number, sourceId?: string) => void }).applyEffect;
        for (const effectId of this.appliesEffects) {
          applyEffect.call(entity, effectId, this.effectDuration, this.sourceId);
        }
      }
    }
  }

  /**
   * Zones don't participate in unit collision.
   */
  override isCollidable(): boolean {
    return false;
  }

  /**
   * Get zone radius.
   */
  override getRadius(): number {
    return this.radius;
  }

  /**
   * Convert to network snapshot.
   */
  toSnapshot(): ZoneSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.ZONE,
      side: this.side,
      sourceId: this.sourceId,
      abilityId: this.abilityId,
      x: this.position.x,
      y: this.position.y,
      radius: this.radius,
      remainingDuration: this.remainingDuration,
      totalDuration: this.totalDuration,
      isDead: this.isDead,
      zoneType: this.zoneType,
      color: this.color,
    };
  }
}
