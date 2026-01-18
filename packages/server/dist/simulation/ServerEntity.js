/**
 * ServerEntity - Base class for all server-side game entities.
 *
 * Unlike client entities, these have no rendering logic.
 * They are purely simulation objects.
 */
import { Vector, } from '@siege/shared';
export class ServerEntity {
    constructor(config) {
        this.targetPosition = null;
        this.targetEntityId = null;
        this.velocity = new Vector(0, 0);
        this.movementSpeed = 0;
        // State
        this.health = 0;
        this.maxHealth = 0;
        this.isDead = false;
        // Tracking
        this.markedForRemoval = false;
        this.lastChangeTick = 0;
        this.id = config.id;
        this.entityType = config.entityType;
        this.position = config.position.clone();
        this.side = config.side;
    }
    /**
     * Take damage from a source.
     */
    takeDamage(amount, type, sourceId) {
        if (this.isDead)
            return 0;
        // Calculate actual damage based on resistances
        const actualDamage = this.calculateDamage(amount, type);
        this.health = Math.max(0, this.health - actualDamage);
        if (this.health <= 0) {
            this.onDeath(sourceId);
        }
        return actualDamage;
    }
    /**
     * Calculate damage after resistances.
     */
    calculateDamage(amount, type) {
        if (type === 'true' || type === 'pure') {
            return amount;
        }
        // Override in subclasses for armor/magic resist
        return amount;
    }
    /**
     * Called when entity dies.
     */
    onDeath(killerId) {
        this.isDead = true;
        this.health = 0;
    }
    /**
     * Heal the entity.
     */
    heal(amount) {
        if (this.isDead)
            return 0;
        const previousHealth = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        return this.health - previousHealth;
    }
    /**
     * Move toward target position.
     */
    moveToward(target, dt) {
        if (this.movementSpeed <= 0)
            return;
        const direction = target.subtracted(this.position);
        const distance = direction.length();
        if (distance < 1) {
            this.position.setFrom(target);
            this.targetPosition = null;
            return;
        }
        const moveDistance = this.movementSpeed * dt;
        if (moveDistance >= distance) {
            this.position.setFrom(target);
            this.targetPosition = null;
        }
        else {
            direction.normalize().scalar(moveDistance);
            this.position.add(direction);
        }
    }
    /**
     * Check if entity can see target (basic vision check).
     */
    canSee(target, sightRange) {
        return this.position.distanceTo(target.position) <= sightRange;
    }
    /**
     * Mark entity for removal at end of tick.
     */
    markForRemoval() {
        this.markedForRemoval = true;
    }
    /**
     * Check if entity should be removed.
     */
    shouldRemove() {
        return this.markedForRemoval;
    }
    /**
     * Mark entity as changed (for delta updates).
     */
    markChanged(tick) {
        this.lastChangeTick = tick;
    }
    /**
     * Check if entity changed since a given tick.
     */
    hasChangedSince(tick) {
        return this.lastChangeTick > tick;
    }
    /**
     * Get distance to another entity.
     */
    distanceTo(other) {
        return this.position.distanceTo(other.position);
    }
    /**
     * Check if entity is in range of another.
     */
    isInRange(other, range) {
        return this.distanceTo(other) <= range;
    }
    /**
     * Check if entity is an enemy.
     */
    isEnemy(other) {
        return this.side !== other.side;
    }
    /**
     * Check if entity is an ally.
     */
    isAlly(other) {
        return this.side === other.side;
    }
}
//# sourceMappingURL=ServerEntity.js.map