/**
 * BushManager - Manages all bushes and bush visibility.
 *
 * Handles:
 * - Tracking which units are in which bushes/groups
 * - Determining if a unit is visible (not hidden in bush)
 * - Ward visibility inside bushes
 * - Bush groups that share visibility
 */

import Vector from '@/physics/vector';
import { Bush } from './Bush';
import type { BushConfig } from './Bush';
import { BushGroup } from './BushGroup';
import type { IGameUnit } from './index';
import { TeamId } from '@/core/Team';
import { Ward } from '@/objects/ward';
import GameContext from '@/core/gameContext';

/**
 * Result of a visibility check.
 */
export interface BushVisibilityResult {
  /** Is the target visible to the viewer? */
  isVisible: boolean;
  /** If hidden, which bush group is hiding them? */
  hidingGroup?: BushGroup;
  /** Reason for visibility/invisibility */
  reason: 'not_in_bush' | 'same_group' | 'ward_reveals' | 'hidden_in_bush';
}

/**
 * Manages all bushes in the game.
 */
export class BushManager {
  /** All bushes in the game */
  private bushes: Bush[] = [];

  /** All bush groups */
  private groups: BushGroup[] = [];

  /** Quick lookup: unit -> bush group they're in */
  private unitToGroup: Map<IGameUnit, BushGroup> = new Map();

  /** All wards for vision checks */
  private wards: Ward[] = [];

  /** For online mode: which bush group the local player is in */
  private onlinePlayerBushGroup: BushGroup | null = null;

  constructor() {}

  /**
   * Create a new bush group.
   */
  createGroup(id: string, center: Vector): BushGroup {
    const group = new BushGroup(id, center);
    this.groups.push(group);
    return group;
  }

  /**
   * Create and add a bush to a group.
   */
  addBushToGroup(config: BushConfig, group: BushGroup): Bush {
    const bush = new Bush(config);
    this.bushes.push(bush);
    group.addBush(bush);
    return bush;
  }

  /**
   * Create and add a standalone bush (not in a group).
   */
  addBush(config: BushConfig): Bush {
    const bush = new Bush(config);
    this.bushes.push(bush);
    return bush;
  }

  /**
   * Get all bushes.
   */
  getBushes(): Bush[] {
    return this.bushes;
  }

  /**
   * Get all bush groups.
   */
  getGroups(): BushGroup[] {
    return this.groups;
  }

  /**
   * Get the bush group a unit is in, if any.
   */
  getGroupForUnit(unit: IGameUnit): BushGroup | undefined {
    return this.unitToGroup.get(unit);
  }

  /**
   * Check if a unit is in any bush.
   */
  isUnitInBush(unit: IGameUnit): boolean {
    return this.unitToGroup.has(unit);
  }

  /**
   * Check if two units are in the same bush group.
   */
  areUnitsInSameGroup(unit1: IGameUnit, unit2: IGameUnit): boolean {
    const group1 = this.unitToGroup.get(unit1);
    const group2 = this.unitToGroup.get(unit2);
    return group1 !== undefined && group1 === group2;
  }

  /**
   * Find which bush group contains a point, if any.
   */
  getGroupAtPoint(point: Vector): BushGroup | undefined {
    return this.groups.find(group => group.containsPoint(point));
  }

  /**
   * For online mode: set which bush group the local player is in.
   * This is used for rendering transparency without full update().
   */
  setOnlinePlayerBushGroup(group: BushGroup | null): void {
    this.onlinePlayerBushGroup = group;
  }

  // Debug counter for logging
  private onlineDebugCounter = 0;

  /**
   * For online mode: update player-in-bush state based on a position.
   * Returns the bush group if player is in one, null otherwise.
   */
  updateOnlinePlayerPosition(position: Vector): BushGroup | null {
    const group = this.getGroupAtPoint(position);
    this.onlinePlayerBushGroup = group ?? null;

    // Debug log every 120 calls (~2 seconds)
    this.onlineDebugCounter++;

    // Log on first call to confirm this function is being invoked
    if (this.onlineDebugCounter === 1) {
      console.log(`[BushManager] updateOnlinePlayerPosition FIRST CALL - position: (${position.x.toFixed(0)}, ${position.y.toFixed(0)}), groups: ${this.groups.length}`);
    }
    if (this.onlineDebugCounter % 120 === 0) {
      // Check distance to nearest bush group center for debugging
      let nearestDist = Infinity;
      let nearestGroup = '';
      let nearestGroupBounds = '';
      for (const g of this.groups) {
        const dist = Math.sqrt(
          Math.pow(position.x - g.center.x, 2) +
          Math.pow(position.y - g.center.y, 2)
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestGroup = g.id;
          // Get bounds of first bush in group for reference
          const bushes = g.getBushes();
          if (bushes.length > 0) {
            const b = bushes[0].getBounds();
            nearestGroupBounds = `bush0:(${b.x.toFixed(0)},${b.y.toFixed(0)},${b.width}x${b.height})`;
          }
        }
      }
      console.log(`[BushManager] updateOnlinePlayerPosition called`);
      console.log(`[BushManager] Player at (${position.x.toFixed(0)}, ${position.y.toFixed(0)}), nearest bush: ${nearestGroup} (${nearestDist.toFixed(0)} units), ${nearestGroupBounds}, inBush: ${!!group}`);
      console.log(`[BushManager] Total groups: ${this.groups.length}, onlinePlayerBushGroup: ${this.onlinePlayerBushGroup?.id ?? 'null'}`);
    }

    return this.onlinePlayerBushGroup;
  }

  // Debug counter for isOnlinePlayerInGroup logging
  private isOnlinePlayerInGroupDebugCounter = 0;

  /**
   * For online mode: check if the local player is in a specific bush group.
   */
  isOnlinePlayerInGroup(group: BushGroup): boolean {
    this.isOnlinePlayerInGroupDebugCounter++;
    const result = this.onlinePlayerBushGroup === group;

    // Log every 300 calls (about every 5 seconds)
    if (this.isOnlinePlayerInGroupDebugCounter % 300 === 0) {
      console.log(`[BushManager] isOnlinePlayerInGroup - checking group: ${group.id}, playerGroup: ${this.onlinePlayerBushGroup?.id ?? 'null'}, result: ${result}`);
    }

    return result;
  }

  /**
   * Check if a ward reveals a bush group.
   */
  doesWardRevealGroup(group: BushGroup): boolean {
    for (const ward of this.wards) {
      if (ward.shouldDispose) continue;
      // Ward reveals group if it's in any bush of the group
      if (group.containsPoint(ward.getPosition())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a target is visible to a viewer.
   *
   * Visibility rules:
   * 1. If target is not in a bush, they are visible
   * 2. If target and viewer are in the same bush GROUP, target is visible
   * 3. If a ward is inside any bush of the target's group, target is visible
   * 4. Otherwise, target is hidden
   */
  checkVisibility(viewer: IGameUnit, target: IGameUnit): BushVisibilityResult {
    const targetGroup = this.unitToGroup.get(target);

    // Not in a bush - always visible
    if (!targetGroup) {
      return { isVisible: true, reason: 'not_in_bush' };
    }

    // In the same bush group - visible
    const viewerGroup = this.unitToGroup.get(viewer);
    if (viewerGroup === targetGroup) {
      return { isVisible: true, reason: 'same_group' };
    }

    // Check if a ward reveals the bush group
    if (this.doesWardRevealGroup(targetGroup)) {
      return { isVisible: true, reason: 'ward_reveals' };
    }

    // Hidden in bush
    return { isVisible: false, hidingGroup: targetGroup, reason: 'hidden_in_bush' };
  }

  /**
   * Check if a position is visible to a team.
   * Used for abilities that target positions.
   */
  isPositionVisibleToTeam(position: Vector, teamId: TeamId): boolean {
    const group = this.getGroupAtPoint(position);
    if (!group) return true;

    // Check if team has a unit in the group
    if (group.hasTeamInside(teamId)) return true;

    // Check if a ward reveals it
    if (this.doesWardRevealGroup(group)) return true;

    return false;
  }

  /**
   * Update all bush visibility states.
   * Call this once per frame.
   */
  update(gctx: GameContext): void {
    // Get all units from spatial hashing
    const allUnits: IGameUnit[] = [];
    const allObjects = gctx.spatialHashing.queryInRange(new Vector(0, 0), 10000);

    for (const obj of allObjects) {
      if (this.isGameUnit(obj)) {
        allUnits.push(obj);
      }
    }

    // Get wards
    this.wards = allObjects.filter((obj): obj is Ward => obj instanceof Ward);

    // Clear unit-to-group mapping
    this.unitToGroup.clear();

    // Update each bush with units inside
    for (const bush of this.bushes) {
      bush.updateUnitsInside(allUnits);

      // Update unit-to-group mapping
      const group = bush.getGroup();
      if (group) {
        for (const unit of bush.getUnitsInside()) {
          this.unitToGroup.set(unit, group);
        }
      }
    }
  }

  /**
   * Type guard for IGameUnit.
   */
  private isGameUnit(obj: unknown): obj is IGameUnit {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      typeof (obj as any).getPosition === 'function' &&
      typeof (obj as any).getTeamId === 'function' &&
      typeof (obj as any).isDead === 'function'
    );
  }

  /**
   * Get all units hidden in bushes from a viewer's perspective.
   */
  getHiddenUnits(viewer: IGameUnit): IGameUnit[] {
    const hidden: IGameUnit[] = [];

    for (const [unit, _group] of this.unitToGroup) {
      if (unit === viewer) continue;
      const result = this.checkVisibility(viewer, unit);
      if (!result.isVisible) {
        hidden.push(unit);
      }
    }

    return hidden;
  }

  /**
   * Get all bush groups that have player units inside.
   */
  getGroupsWithPlayerInside(): BushGroup[] {
    return this.groups.filter(group => group.hasPlayerInside());
  }
}

export default BushManager;
