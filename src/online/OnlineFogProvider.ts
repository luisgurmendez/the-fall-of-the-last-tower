/**
 * OnlineFogProvider - Provides fog of war revealers from server state.
 *
 * In online mode, we need to reveal fog based on where our team's entities are.
 * This object extracts positions from the server state and implements FogRevealer
 * for the local player's team.
 */

import type { GameObject } from '@/core/GameObject';
import type GameContext from '@/core/gameContext';
import Vector from '@/physics/vector';
import type { OnlineStateManager } from '@/core/OnlineStateManager';
import type { FogRevealer } from '@/core/FogOfWar';
import { EntityType, GameConfig, DEFAULT_MINION_STATS, type MinionType } from '@siege/shared';
import { Bush } from '@/vision/Bush';
import type { BushManager, BushGroup } from '@/vision';

/**
 * Sight ranges for different entity types.
 * IMPORTANT: These must match the server values in FogOfWarServer.ts
 * Entities with 0 sight range don't provide vision.
 *
 * Note: Minions have type-specific sight ranges looked up from DEFAULT_MINION_STATS.
 */
const SIGHT_RANGES: Record<number, number> = {
  [EntityType.CHAMPION]: GameConfig.VISION.CHAMPION_SIGHT_RANGE, // 800
  [EntityType.MINION]: DEFAULT_MINION_STATS.melee.sightRange, // Fallback - actual lookup by minionType below
  [EntityType.TOWER]: 750, // Matches server tower sight range
  [EntityType.NEXUS]: 1000,
  [EntityType.JUNGLE_CAMP]: 400,
  [EntityType.WARD]: GameConfig.VISION.WARD_SIGHT_RANGE, // 900
  [EntityType.PROJECTILE]: 0, // Projectiles don't provide vision
};

/**
 * Get sight range for a minion based on its type.
 * Uses DEFAULT_MINION_STATS to match server-side values.
 */
function getMinionSightRange(minionType: MinionType | undefined): number {
  if (minionType && DEFAULT_MINION_STATS[minionType]) {
    return DEFAULT_MINION_STATS[minionType].sightRange;
  }
  // Default to melee sight range if type unknown
  return DEFAULT_MINION_STATS.melee.sightRange;
}

/**
 * A single fog revealer from server state.
 */
class ServerEntityRevealer implements FogRevealer {
  private pos: Vector;
  private team: number;
  private range: number;

  constructor(x: number, y: number, teamId: number, sightRange: number) {
    this.pos = new Vector(x, y);
    this.team = teamId;
    this.range = sightRange;
  }

  getPosition(): Vector {
    return this.pos;
  }

  getTeamId(): number {
    return this.team;
  }

  getSightRange(): number {
    return this.range;
  }
}

/**
 * OnlineFogProvider creates FogRevealers from server entities.
 * It implements FogRevealer itself to work with the Level's fog system.
 */
export class OnlineFogProvider implements GameObject, FogRevealer {
  readonly id = 'online-fog-provider';
  shouldInitialize = false;
  shouldDispose = false;
  position = new Vector(0, 0);

  private stateManager: OnlineStateManager;
  private localSide: number;
  private revealers: ServerEntityRevealer[] = [];

  // For implementing FogRevealer on this object (reveals at local player position)
  private localPlayerPos: Vector = new Vector(0, 0);
  private localPlayerSightRange: number = GameConfig.VISION.CHAMPION_SIGHT_RANGE;

  // Bush manager reference for updating bush transparency
  private bushManager: BushManager | null = null;

  constructor(stateManager: OnlineStateManager, localSide: number) {
    this.stateManager = stateManager;
    this.localSide = localSide;
  }

  /**
   * Set the bush manager reference for updating bush transparency.
   * Called from onlineLevel after MOBAMap is created.
   */
  setBushManager(bushManager: BushManager): void {
    this.bushManager = bushManager;

    // Set up the online player check callback on Bush class
    Bush.setOnlinePlayerCheckFn((group: BushGroup) => {
      const result = this.bushManager?.isOnlinePlayerInGroup(group) ?? false;
      return result;
    });
  }

  // Ensures the missing local entity ID warning is only logged once
  private warnedNoLocalEntityId = false;

  /**
   * Update revealers from server state each frame.
   */
  step(ctx: GameContext): void {
    this.revealers = [];

    const entities = this.stateManager.getEntities();
    const localEntityId = this.stateManager.getLocalEntityId();

    // First, find the local player entity and update bush state (regardless of side filter)
    if (localEntityId) {
      const localEntity = entities.find(e => e.snapshot.entityId === localEntityId);
      if (localEntity) {
        this.localPlayerPos.x = localEntity.position.x;
        this.localPlayerPos.y = localEntity.position.y;
        this.localPlayerSightRange = SIGHT_RANGES[(localEntity.snapshot as any).entityType] ?? GameConfig.VISION.CHAMPION_SIGHT_RANGE;

        // Update bush manager with local player position for transparency effect
        if (this.bushManager) {
          this.bushManager.updateOnlinePlayerPosition(this.localPlayerPos);
        }
      }
    } else if (!this.warnedNoLocalEntityId) {
      console.warn(`[OnlineFogProvider] No local entity ID set`);
      this.warnedNoLocalEntityId = true;
    }

    // Now process entities for fog revealers
    for (const entity of entities) {
      const snapshot = entity.snapshot as any;

      // Only reveal for our team's entities
      if (snapshot.side !== this.localSide) {
        continue;
      }

      // Skip dead entities
      if (snapshot.isDead || snapshot.isDestroyed) {
        continue;
      }

      // Get sight range for this entity type
      // For wards, use the sightRange from the snapshot if available
      // For minions, look up by minionType to match server-side values
      let sightRange: number;
      if (snapshot.entityType === EntityType.WARD && snapshot.sightRange) {
        sightRange = snapshot.sightRange;
      } else if (snapshot.entityType === EntityType.MINION) {
        // Use minion-type-specific sight range to match server values
        sightRange = getMinionSightRange(snapshot.minionType);
      } else {
        // Use 0 as fallback - unknown entity types don't provide vision
        sightRange = SIGHT_RANGES[snapshot.entityType] ?? 0;
      }

      // Skip entities that don't provide vision (e.g., projectiles)
      if (sightRange <= 0) {
        continue;
      }

      this.revealers.push(new ServerEntityRevealer(
        entity.position.x,
        entity.position.y,
        this.localSide,
        sightRange
      ));
    }

    // Update the fog of war system with our revealers
    if (ctx.fogOfWar) {
      ctx.fogOfWar.update(this.revealers);
    }
  }

  // Implement FogRevealer interface (for the local player)
  getPosition(): Vector {
    return this.localPlayerPos;
  }

  getTeamId(): number {
    return this.localSide;
  }

  getSightRange(): number {
    return this.localPlayerSightRange;
  }

  /**
   * Get all revealers for this frame.
   */
  getRevealers(): FogRevealer[] {
    return this.revealers;
  }

  render() {
    return null as any;
  }
}

export default OnlineFogProvider;
