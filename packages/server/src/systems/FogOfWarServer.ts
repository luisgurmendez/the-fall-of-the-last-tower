/**
 * FogOfWarServer - Server-side fog of war visibility system.
 *
 * Determines which entities are visible to each team based on:
 * - Champion sight range
 * - Tower vision
 * - Minion vision
 * - Ward vision
 * - Bush visibility (entities in bushes are hidden unless revealed)
 *
 * Used for:
 * - Filtering state updates (don't send hidden enemy positions)
 * - Validating targeting (can't target invisible enemies)
 */

import { Vector, Side, EntityType, GameConfig } from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import { ServerBushManager, type BushVisibilityResult } from './ServerBushManager';

/**
 * Vision source information.
 */
export interface VisionSource {
  entityId: string;
  position: Vector;
  side: Side;
  sightRange: number;
}

/**
 * Visibility result for an entity.
 */
export interface VisibilityResult {
  isVisible: boolean;
  revealedBy?: string[];  // IDs of entities providing vision
}

/**
 * Server-side fog of war system.
 */
export class FogOfWarServer {
  // Vision sources per team (cached per tick)
  private visionSources: Map<Side, VisionSource[]> = new Map();

  // Cached visibility results per tick
  private visibilityCache: Map<string, Map<Side, VisibilityResult>> = new Map();

  // Current tick for cache invalidation
  private currentTick = -1;

  // Bush manager for bush visibility
  private bushManager: ServerBushManager;

  // Current game context (stored for bush visibility checks)
  private currentContext: ServerGameContext | null = null;

  constructor() {
    this.visionSources.set(0, []);
    this.visionSources.set(1, []);
    this.bushManager = new ServerBushManager();
  }

  /**
   * Get the bush manager (for external access if needed).
   */
  getBushManager(): ServerBushManager {
    return this.bushManager;
  }

  /**
   * Update vision sources from game context.
   * Call this once per tick before checking visibility.
   */
  updateVision(context: ServerGameContext, tick: number): void {
    // Clear cache if new tick
    if (tick !== this.currentTick) {
      this.currentTick = tick;
      this.visibilityCache.clear();
      this.visionSources.set(0, []);
      this.visionSources.set(1, []);
    }

    // Store context for bush visibility checks
    this.currentContext = context;

    // Update bush manager entity-to-bush mappings
    this.bushManager.update(context, tick);

    // Collect vision sources from all entities
    const entities = context.getAllEntities();

    // Debug counters
    let championCount = 0;
    let minionCount = 0;
    let towerCount = 0;

    for (const entity of entities) {
      if (entity.isDead) continue;

      let sightRange = 0;

      // Get sight range based on entity type
      // IMPORTANT: These values must match the client's OnlineFogProvider.ts
      if (entity.entityType === EntityType.CHAMPION) {
        // Champions have their own sight range (default from GAME_CONFIG)
        sightRange = (entity as any).sightRange ?? GameConfig.VISION.CHAMPION_SIGHT_RANGE;
        championCount++;
      } else if (entity.entityType === EntityType.MINION) {
        // Minions have sight range from stats
        sightRange = (entity as any).stats?.sightRange ?? 500;
        minionCount++;
      } else if (entity.entityType === EntityType.TOWER) {
        // Towers have fixed sight range
        sightRange = (entity as any).stats?.attackRange ?? 750;
        towerCount++;
      } else if (entity.entityType === EntityType.WARD) {
        // Wards provide vision (check stats.sightRange for consistency with other entities)
        sightRange = (entity as any).stats?.sightRange ?? (entity as any).sightRange ?? GameConfig.VISION.WARD_SIGHT_RANGE;
      }

      if (sightRange > 0) {
        const sources = this.visionSources.get(entity.side);
        if (sources) {
          sources.push({
            entityId: entity.id,
            position: entity.position.clone(),
            side: entity.side,
            sightRange,
          });
        }
      }
    }

  }

  /**
   * Check if an entity is visible to a specific team.
   */
  isVisibleTo(entity: ServerEntity, side: Side): boolean {
    return this.getVisibility(entity, side).isVisible;
  }

  /**
   * Get detailed visibility information for an entity.
   */
  getVisibility(entity: ServerEntity, viewingSide: Side): VisibilityResult {
    // Own entities are always visible
    if (entity.side === viewingSide) {
      return { isVisible: true };
    }

    // Structures (towers, nexus) are always visible to all players
    // This matches typical MOBA behavior - you can always see enemy structures on the map
    if (entity.entityType === EntityType.TOWER || entity.entityType === EntityType.NEXUS) {
      return { isVisible: true };
    }

    // Check cache first
    let entityCache = this.visibilityCache.get(entity.id);
    if (!entityCache) {
      entityCache = new Map();
      this.visibilityCache.set(entity.id, entityCache);
    }

    const cached = entityCache.get(viewingSide);
    if (cached) {
      return cached;
    }

    // Calculate visibility
    const result = this.calculateVisibility(entity, viewingSide);
    entityCache.set(viewingSide, result);
    return result;
  }

  /**
   * Calculate visibility for an entity.
   * Combines range-based visibility with bush visibility rules and stealth.
   */
  private calculateVisibility(entity: ServerEntity, viewingSide: Side): VisibilityResult {
    // Check for stealth effects (like Vex's Shadow Shroud)
    // Stealthed entities are invisible to enemies
    if (this.isStealthed(entity)) {
      return { isVisible: false };
    }

    // First check bush visibility
    // If entity is hidden in a bush and viewer doesn't have vision in that bush,
    // the entity is not visible regardless of range
    if (this.currentContext) {
      const bushResult = this.bushManager.checkBushVisibility(
        entity,
        viewingSide,
        this.currentContext
      );

      // If hidden in bush, not visible
      if (!bushResult.isVisible) {
        return { isVisible: false };
      }
    }

    // Now check range-based visibility
    const sources = this.visionSources.get(viewingSide) ?? [];
    const revealedBy: string[] = [];

    for (const source of sources) {
      const distance = source.position.distanceTo(entity.position);
      if (distance <= source.sightRange) {
        revealedBy.push(source.entityId);
      }
    }

    return {
      isVisible: revealedBy.length > 0,
      revealedBy: revealedBy.length > 0 ? revealedBy : undefined,
    };
  }

  /**
   * Get all entities visible to a team.
   */
  getVisibleEntities(context: ServerGameContext, viewingSide: Side): ServerEntity[] {
    const entities = context.getAllEntities();
    const visible: ServerEntity[] = [];

    for (const entity of entities) {
      const isVisible = this.isVisibleTo(entity, viewingSide);
      if (isVisible) {
        visible.push(entity);
      }
    }

    return visible;
  }

  /**
   * Check if a position is visible to a team.
   * Also considers bush visibility.
   */
  isPositionVisibleTo(position: Vector, side: Side): boolean {
    // Check if position is in a bush that the team doesn't have vision of
    if (this.currentContext) {
      const bushGroup = this.bushManager.getBushGroupAtPosition(position);
      if (bushGroup) {
        // Position is in a bush - check if team has vision in that bush
        const hasVisionInBush =
          this.bushManager.teamHasEntityInBushGroup(bushGroup.id, side, this.currentContext) ||
          this.bushManager.wardRevealsBushGroup(bushGroup.id, this.currentContext);

        if (!hasVisionInBush) {
          return false;
        }
      }
    }

    // Range-based visibility check
    const sources = this.visionSources.get(side) ?? [];

    for (const source of sources) {
      if (source.position.distanceTo(position) <= source.sightRange) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get vision sources for a team (for debugging/minimap).
   */
  getVisionSourcesForTeam(side: Side): VisionSource[] {
    return this.visionSources.get(side) ?? [];
  }

  /**
   * Check if an entity can target another (must be visible or own team).
   */
  canTarget(source: ServerEntity, target: ServerEntity): boolean {
    // Can always target allies
    if (source.side === target.side) {
      return true;
    }

    // Can only target visible enemies
    return this.isVisibleTo(target, source.side);
  }

  /**
   * Check if an entity is stealthed (has stealth effect active).
   */
  private isStealthed(entity: ServerEntity): boolean {
    // Only champions can have stealth effects
    if (entity.entityType !== EntityType.CHAMPION) {
      return false;
    }

    // Check for stealth effects in activeEffects
    const champion = entity as any;
    if (!champion.activeEffects || !Array.isArray(champion.activeEffects)) {
      return false;
    }

    // Check for any stealth effect
    return champion.activeEffects.some(
      (effect: { definitionId: string }) =>
        effect.definitionId === 'vex_stealth' ||
        effect.definitionId.includes('stealth') ||
        effect.definitionId.includes('invisible')
    );
  }
}
