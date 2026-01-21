/**
 * ServerBushManager - Server-side bush visibility system.
 *
 * Tracks:
 * - Bush group positions (from shared MOBAConfig)
 * - Which entities are inside which bush groups
 * - Visibility rules for entities in bushes
 *
 * Bush visibility rules:
 * 1. If target is not in a bush → visible (standard fog rules apply)
 * 2. If target and viewer are in the same bush group → visible
 * 3. If a ward is inside any bush of the target's group → visible
 * 4. If any ally of the viewer is in the target's bush group → visible
 * 5. Otherwise → hidden (even if within sight range)
 */

import { Vector, Side, MOBAConfig, EntityType, isPointInBushGroup } from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

/**
 * Configuration for a bush group on the server.
 */
interface ServerBushGroup {
  id: string;
  index: number;  // Index in BUSH_GROUPS array for individual bush lookup
  center: Vector;
}

/**
 * Result of a bush visibility check.
 */
export interface BushVisibilityResult {
  /** Is the target visible? */
  isVisible: boolean;
  /** Reason for the result */
  reason: 'not_in_bush' | 'same_group' | 'ward_reveals' | 'ally_reveals' | 'hidden_in_bush';
  /** Which bush group is the target in (if any) */
  bushGroupId?: string;
}

/**
 * Server-side bush manager.
 */
export class ServerBushManager {
  /** All bush groups on the map */
  private bushGroups: ServerBushGroup[] = [];

  /** Entity ID to bush group ID mapping (cached per tick) */
  private entityToBushGroup: Map<string, string> = new Map();

  /** Bush group ID to entities inside mapping (cached per tick) */
  private bushGroupToEntities: Map<string, Set<string>> = new Map();

  /** Current tick for cache invalidation */
  private currentTick = -1;

  constructor() {
    this.initializeBushGroups();
  }

  /**
   * Initialize bush groups from shared MOBAConfig.
   * Stores index for individual bush position lookup via shared function.
   */
  private initializeBushGroups(): void {
    const { BUSH_GROUPS } = MOBAConfig;

    for (let i = 0; i < BUSH_GROUPS.length; i++) {
      const groupConfig = BUSH_GROUPS[i];
      const center = new Vector(groupConfig.center.x, groupConfig.center.y);

      this.bushGroups.push({
        id: `bush_group_${i}`,
        index: i,
        center,
      });
    }
  }

  /**
   * Update entity-to-bush mappings.
   * Call this once per tick.
   */
  update(context: ServerGameContext, tick: number): void {
    // Clear cache if new tick
    if (tick !== this.currentTick) {
      this.currentTick = tick;
      this.entityToBushGroup.clear();
      this.bushGroupToEntities.clear();

      // Initialize empty sets for each group
      for (const group of this.bushGroups) {
        this.bushGroupToEntities.set(group.id, new Set());
      }
    }

    // Check all entities against bush groups
    const entities = context.getAllEntities();
    let entitiesInBushes = 0;

    for (const entity of entities) {
      if (entity.isDead) continue;

      const bushGroup = this.getBushGroupAtPosition(entity.position);
      if (bushGroup) {
        this.entityToBushGroup.set(entity.id, bushGroup.id);
        this.bushGroupToEntities.get(bushGroup.id)?.add(entity.id);
        entitiesInBushes++;
      }
    }

  }

  /**
   * Find which bush group contains a position.
   * Uses shared isPointInBushGroup to check against individual bush hitboxes.
   */
  getBushGroupAtPosition(position: Vector): ServerBushGroup | undefined {
    for (const group of this.bushGroups) {
      // Check if position is inside any individual bush in this group
      if (isPointInBushGroup(position, group.index)) {
        return group;
      }
    }
    return undefined;
  }

  /**
   * Get the bush group an entity is in.
   */
  getBushGroupForEntity(entityId: string): string | undefined {
    return this.entityToBushGroup.get(entityId);
  }

  /**
   * Check if an entity is in any bush.
   */
  isEntityInBush(entityId: string): boolean {
    return this.entityToBushGroup.has(entityId);
  }

  /**
   * Check if two entities are in the same bush group.
   */
  areEntitiesInSameBushGroup(entityId1: string, entityId2: string): boolean {
    const group1 = this.entityToBushGroup.get(entityId1);
    const group2 = this.entityToBushGroup.get(entityId2);
    return group1 !== undefined && group1 === group2;
  }

  /**
   * Check if a team has any entity in a bush group.
   */
  teamHasEntityInBushGroup(
    bushGroupId: string,
    side: Side,
    context: ServerGameContext
  ): boolean {
    const entitiesInGroup = this.bushGroupToEntities.get(bushGroupId);
    if (!entitiesInGroup) return false;

    for (const entityId of entitiesInGroup) {
      const entity = context.getEntity(entityId);
      if (entity && entity.side === side && !entity.isDead) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a ward reveals a bush group.
   */
  wardRevealsBushGroup(bushGroupId: string, context: ServerGameContext): boolean {
    const entitiesInGroup = this.bushGroupToEntities.get(bushGroupId);
    if (!entitiesInGroup) return false;

    for (const entityId of entitiesInGroup) {
      const entity = context.getEntity(entityId);
      // Ward entities have entityType === EntityType.WARD
      if (entity && (entity as any).entityType === 'WARD' && !entity.isDead) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check bush visibility for a target from a viewer's perspective.
   *
   * @param target The entity being observed
   * @param viewingSide The team checking visibility
   * @param context Game context for looking up entities
   * @returns Visibility result with reason
   */
  checkBushVisibility(
    target: ServerEntity,
    viewingSide: Side,
    context: ServerGameContext
  ): BushVisibilityResult {
    // Jungle camps are neutral entities that don't hide in bushes
    // They should always be visible when in range (standard fog rules apply)
    if (target.entityType === EntityType.JUNGLE_CAMP) {
      return { isVisible: true, reason: 'not_in_bush' };
    }

    const targetBushGroupId = this.entityToBushGroup.get(target.id);

    // 1. Not in a bush - visible (let standard fog handle it)
    if (!targetBushGroupId) {
      return { isVisible: true, reason: 'not_in_bush' };
    }

    // 2. Same team - always visible
    if (target.side === viewingSide) {
      return { isVisible: true, reason: 'same_group', bushGroupId: targetBushGroupId };
    }

    // 3. Check if viewing team has an entity in the same bush group
    if (this.teamHasEntityInBushGroup(targetBushGroupId, viewingSide, context)) {
      return { isVisible: true, reason: 'ally_reveals', bushGroupId: targetBushGroupId };
    }

    // 4. Check if a ward reveals the bush
    if (this.wardRevealsBushGroup(targetBushGroupId, context)) {
      return { isVisible: true, reason: 'ward_reveals', bushGroupId: targetBushGroupId };
    }

    // 5. Hidden in bush
    return { isVisible: false, reason: 'hidden_in_bush', bushGroupId: targetBushGroupId };
  }

  /**
   * Get all bush groups (for debugging/visualization).
   */
  getBushGroups(): ServerBushGroup[] {
    return this.bushGroups;
  }
}

export default ServerBushManager;
