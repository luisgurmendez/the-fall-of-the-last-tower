/**
 * EntityPrioritizer - Prioritizes entity updates based on relevance to players.
 *
 * Implements priority-based state synchronization:
 * - Nearby entities update frequently (every tick)
 * - Medium-distance entities update less frequently
 * - Far entities update rarely but still get eventual updates
 * - Important entities (champions, towers) always high priority
 */

import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerChampion } from '../simulation/ServerChampion';
import { EntityType } from '@siege/shared';

/**
 * Priority levels for entity updates.
 */
export enum UpdatePriority {
  /** Update every tick (champions, nearby entities) */
  CRITICAL = 0,
  /** Update every 2-3 ticks (medium distance, projectiles) */
  HIGH = 1,
  /** Update every 5-10 ticks (far entities, minions) */
  MEDIUM = 2,
  /** Update every 15-30 ticks (very far, cosmetic) */
  LOW = 3,
}

/**
 * Configuration for entity prioritization.
 */
export interface EntityPrioritizerConfig {
  /** Distance for critical priority (always update) */
  criticalDistance?: number;
  /** Distance for high priority */
  highDistance?: number;
  /** Distance for medium priority */
  mediumDistance?: number;
  /** Max ticks before forcing an update (ensures eventual consistency) */
  maxTicksWithoutUpdate?: number;
  /** Movement threshold to force an update (prevents stale positions) */
  movementThreshold?: number;
}

const DEFAULT_CONFIG: Required<EntityPrioritizerConfig> = {
  // FIXED: Increased distances to match sight range (~800 units)
  // This prevents entities from being de-prioritized while still visible
  criticalDistance: 800,   // Always update (matches typical sight range)
  highDistance: 1200,      // Every 2 ticks
  mediumDistance: 1600,    // Every 5 ticks
  maxTicksWithoutUpdate: 60, // ~0.5 second (was 125, reduced for faster updates)
  movementThreshold: 50,   // Force update if entity moved more than 50 units
};

/**
 * Track when entities were last sent to each player.
 */
interface EntityUpdateTracker {
  lastTick: number;
  priority: UpdatePriority;
  /** Last known position for movement detection */
  lastPosition: { x: number; y: number };
}

/**
 * Prioritizes entity updates for bandwidth optimization.
 */
export class EntityPrioritizer {
  private config: Required<EntityPrioritizerConfig>;

  // Track last update tick per player per entity
  private lastUpdates: Map<string, Map<string, EntityUpdateTracker>> = new Map();

  constructor(config: EntityPrioritizerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Filter and prioritize entities for a player.
   * Returns entities that should be included in this tick's update.
   */
  prioritizeEntities(
    entities: ServerEntity[],
    playerChampion: ServerChampion | null,
    playerId: string,
    currentTick: number
  ): ServerEntity[] {
    if (!playerChampion) {
      // No champion (dead/disconnected) - send all
      return entities;
    }

    const playerStates = this.getPlayerStates(playerId);
    const result: ServerEntity[] = [];

    for (const entity of entities) {
      const priority = this.calculatePriority(entity, playerChampion);
      const lastUpdate = playerStates.get(entity.id);

      // Always send entities that haven't been tracked yet (new to this player)
      const isNewEntity = !lastUpdate;

      // Check if entity moved significantly since last update
      const movedSignificantly = lastUpdate && this.hasMovedSignificantly(
        entity,
        lastUpdate.lastPosition
      );

      const shouldUpdate = isNewEntity || movedSignificantly || this.shouldUpdateEntity(
        priority,
        lastUpdate!.lastTick,
        currentTick
      );

      if (shouldUpdate) {
        result.push(entity);
        playerStates.set(entity.id, {
          lastTick: currentTick,
          priority,
          lastPosition: { x: entity.position.x, y: entity.position.y },
        });
      }
    }

    return result;
  }

  /**
   * Check if entity has moved significantly since last update.
   * This prevents "frozen" entities when they move but are de-prioritized.
   */
  private hasMovedSignificantly(
    entity: ServerEntity,
    lastPosition: { x: number; y: number }
  ): boolean {
    const dx = entity.position.x - lastPosition.x;
    const dy = entity.position.y - lastPosition.y;
    const distanceMoved = Math.sqrt(dx * dx + dy * dy);
    return distanceMoved >= this.config.movementThreshold;
  }

  /**
   * Calculate priority for an entity relative to a player.
   */
  calculatePriority(entity: ServerEntity, playerChampion: ServerChampion): UpdatePriority {
    // Champions are always critical priority
    if (entity.entityType === EntityType.CHAMPION) {
      return UpdatePriority.CRITICAL;
    }

    // Structures (towers and nexus) are critical - must appear immediately
    if (entity.entityType === EntityType.TOWER || entity.entityType === EntityType.NEXUS) {
      return UpdatePriority.CRITICAL;
    }

    // Projectiles near player are critical
    if (entity.entityType === EntityType.PROJECTILE) {
      const dist = this.getDistance(entity, playerChampion);
      if (dist < this.config.criticalDistance) {
        return UpdatePriority.CRITICAL;
      }
      return UpdatePriority.HIGH;
    }

    // Distance-based priority for minions and other entities
    const distance = this.getDistance(entity, playerChampion);

    if (distance < this.config.criticalDistance) {
      return UpdatePriority.CRITICAL;
    }
    if (distance < this.config.highDistance) {
      return UpdatePriority.HIGH;
    }
    if (distance < this.config.mediumDistance) {
      return UpdatePriority.MEDIUM;
    }
    return UpdatePriority.LOW;
  }

  /**
   * Determine if an entity should be updated this tick.
   */
  private shouldUpdateEntity(
    priority: UpdatePriority,
    lastUpdateTick: number,
    currentTick: number
  ): boolean {
    const ticksSinceUpdate = currentTick - lastUpdateTick;

    // Always update critical entities
    if (priority === UpdatePriority.CRITICAL) {
      return true;
    }

    // Force update if too long since last update
    if (ticksSinceUpdate >= this.config.maxTicksWithoutUpdate) {
      return true;
    }

    // Priority-based update intervals
    switch (priority) {
      case UpdatePriority.HIGH:
        return ticksSinceUpdate >= 2; // Every 2 ticks
      case UpdatePriority.MEDIUM:
        return ticksSinceUpdate >= 5; // Every 5 ticks
      case UpdatePriority.LOW:
        return ticksSinceUpdate >= 15; // Every 15 ticks
      default:
        return true;
    }
  }

  /**
   * Get distance between two entities.
   */
  private getDistance(entity: ServerEntity, playerChampion: ServerChampion): number {
    const dx = entity.position.x - playerChampion.position.x;
    const dy = entity.position.y - playerChampion.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get or create player state tracking.
   */
  private getPlayerStates(playerId: string): Map<string, EntityUpdateTracker> {
    let states = this.lastUpdates.get(playerId);
    if (!states) {
      states = new Map();
      this.lastUpdates.set(playerId, states);
    }
    return states;
  }

  /**
   * Clear tracking for a player (on disconnect).
   */
  clearPlayer(playerId: string): void {
    this.lastUpdates.delete(playerId);
  }

  /**
   * Clear all tracking.
   */
  clearAll(): void {
    this.lastUpdates.clear();
  }

  /**
   * Get statistics about update frequencies.
   */
  getStats(playerId: string, currentTick: number): {
    critical: number;
    high: number;
    medium: number;
    low: number;
    stale: number;
  } {
    const states = this.lastUpdates.get(playerId);
    if (!states) {
      return { critical: 0, high: 0, medium: 0, low: 0, stale: 0 };
    }

    const stats = { critical: 0, high: 0, medium: 0, low: 0, stale: 0 };

    for (const tracker of states.values()) {
      switch (tracker.priority) {
        case UpdatePriority.CRITICAL:
          stats.critical++;
          break;
        case UpdatePriority.HIGH:
          stats.high++;
          break;
        case UpdatePriority.MEDIUM:
          stats.medium++;
          break;
        case UpdatePriority.LOW:
          stats.low++;
          break;
      }

      if (currentTick - tracker.lastTick > this.config.maxTicksWithoutUpdate) {
        stats.stale++;
      }
    }

    return stats;
  }
}
