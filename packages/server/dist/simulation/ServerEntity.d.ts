/**
 * ServerEntity - Base class for all server-side game entities.
 *
 * Unlike client entities, these have no rendering logic.
 * They are purely simulation objects.
 */
import { Vector, EntityType, EntitySnapshot, Side, DamageType } from '@siege/shared';
import type { ServerGameContext } from '../game/ServerGameContext';
export interface ServerEntityConfig {
    id: string;
    entityType: EntityType;
    position: Vector;
    side: Side;
}
export declare abstract class ServerEntity {
    readonly id: string;
    readonly entityType: EntityType;
    readonly side: Side;
    position: Vector;
    targetPosition: Vector | null;
    targetEntityId: string | null;
    velocity: Vector;
    movementSpeed: number;
    health: number;
    maxHealth: number;
    isDead: boolean;
    private markedForRemoval;
    private lastChangeTick;
    constructor(config: ServerEntityConfig);
    /**
     * Update entity for one tick.
     */
    abstract update(dt: number, context: ServerGameContext): void;
    /**
     * Convert entity state to a network snapshot.
     */
    abstract toSnapshot(): EntitySnapshot;
    /**
     * Take damage from a source.
     */
    takeDamage(amount: number, type: DamageType, sourceId?: string): number;
    /**
     * Calculate damage after resistances.
     */
    protected calculateDamage(amount: number, type: DamageType): number;
    /**
     * Called when entity dies.
     */
    protected onDeath(killerId?: string): void;
    /**
     * Heal the entity.
     */
    heal(amount: number): number;
    /**
     * Move toward target position.
     */
    protected moveToward(target: Vector, dt: number): void;
    /**
     * Check if entity can see target (basic vision check).
     */
    canSee(target: ServerEntity, sightRange: number): boolean;
    /**
     * Mark entity for removal at end of tick.
     */
    markForRemoval(): void;
    /**
     * Check if entity should be removed.
     */
    shouldRemove(): boolean;
    /**
     * Mark entity as changed (for delta updates).
     */
    markChanged(tick: number): void;
    /**
     * Check if entity changed since a given tick.
     */
    hasChangedSince(tick: number): boolean;
    /**
     * Get distance to another entity.
     */
    distanceTo(other: ServerEntity): number;
    /**
     * Check if entity is in range of another.
     */
    isInRange(other: ServerEntity, range: number): boolean;
    /**
     * Check if entity is an enemy.
     */
    isEnemy(other: ServerEntity): boolean;
    /**
     * Check if entity is an ally.
     */
    isAlly(other: ServerEntity): boolean;
    /**
     * Whether this entity participates in collision detection.
     * Override in subclasses to enable collision.
     */
    isCollidable(): boolean;
    /**
     * Get collision radius. Override in subclasses.
     */
    getRadius(): number;
    /**
     * Get collision mass. Heavier units push lighter units more.
     * Override in subclasses.
     */
    getMass(): number;
}
//# sourceMappingURL=ServerEntity.d.ts.map