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
import { EntityType, GameConfig } from '@siege/shared';
import { Bush } from '@/vision/Bush';
import type { BushManager, BushGroup } from '@/vision';

/**
 * Sight ranges for different entity types.
 * IMPORTANT: These must match the server values in FogOfWarServer.ts
 * Entities with 0 sight range don't provide vision.
 */
const SIGHT_RANGES: Record<number, number> = {
  [EntityType.CHAMPION]: GameConfig.VISION.CHAMPION_SIGHT_RANGE, // 800
  [EntityType.MINION]: 500, // Matches DEFAULT_MINION_STATS.melee.sightRange
  [EntityType.TOWER]: 750, // Matches server tower sight range
  [EntityType.NEXUS]: 1000,
  [EntityType.JUNGLE_CAMP]: 400,
  [EntityType.WARD]: GameConfig.VISION.WARD_SIGHT_RANGE, // 600
  [EntityType.PROJECTILE]: 0, // Projectiles don't provide vision
};

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
  private lastBushGroup: BushGroup | null = null;

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
    const groups = bushManager.getGroups();
    console.log(`[OnlineFogProvider] Bush manager connected with ${groups.length} groups`);

    // Log first few groups for debugging
    for (let i = 0; i < Math.min(3, groups.length); i++) {
      const g = groups[i];
      console.log(`  - Group ${g.id} at (${g.center.x.toFixed(0)}, ${g.center.y.toFixed(0)}) with ${g.getBushes().length} bushes`);
    }

    // Set up the online player check callback on Bush class
    console.log(`[OnlineFogProvider] Setting up Bush.onlinePlayerCheckFn callback`);
    Bush.setOnlinePlayerCheckFn((group: BushGroup) => {
      const result = this.bushManager?.isOnlinePlayerInGroup(group) ?? false;
      return result;
    });
    console.log(`[OnlineFogProvider] Bush.onlinePlayerCheckFn is now: ${!!Bush.onlinePlayerCheckFn}`);
  }

  // Debug counter
  private debugCounter = 0;

  /**
   * Update revealers from server state each frame.
   */
  step(ctx: GameContext): void {
    this.revealers = [];
    this.debugCounter++;

    const entities = this.stateManager.getEntities();
    const localEntityId = this.stateManager.getLocalEntityId();

    // Debug log every 120 frames (~2 seconds at 60fps)
    if (this.debugCounter % 120 === 0) {
      console.log(`[OnlineFogProvider] Step: ${entities.length} entities, localEntityId=${localEntityId}, bushManager=${!!this.bushManager}`);
      // Debug: Log entity IDs to see if local entity is in the list
      const entityIds = entities.map(e => `${e.snapshot.entityId}(side${(e.snapshot as any).side})`).slice(0, 5);
      console.log(`[OnlineFogProvider] First 5 entity IDs: ${entityIds.join(', ')}`);
    }

    // First, find the local player entity and update bush state (regardless of side filter)
    if (localEntityId) {
      const localEntity = entities.find(e => e.snapshot.entityId === localEntityId);
      if (localEntity) {
        this.localPlayerPos.x = localEntity.position.x;
        this.localPlayerPos.y = localEntity.position.y;
        this.localPlayerSightRange = SIGHT_RANGES[(localEntity.snapshot as any).entityType] ?? GameConfig.VISION.CHAMPION_SIGHT_RANGE;

        // Update bush manager with local player position for transparency effect
        if (this.bushManager) {
          const newBushGroup = this.bushManager.updateOnlinePlayerPosition(this.localPlayerPos);
          if (newBushGroup !== this.lastBushGroup) {
            if (newBushGroup) {
              console.log(`[OnlineFogProvider] Player entered bush group: ${newBushGroup.id}`);
            } else if (this.lastBushGroup) {
              console.log(`[OnlineFogProvider] Player exited bush`);
            }
            this.lastBushGroup = newBushGroup;
          }
        } else if (this.debugCounter % 120 === 0) {
          console.log(`[OnlineFogProvider] WARNING: bushManager is null when trying to update player position`);
        }
      } else if (this.debugCounter % 120 === 0) {
        console.log(`[OnlineFogProvider] WARNING: Could not find local entity with ID: ${localEntityId}`);
        // Log all entity IDs for comparison
        const allIds = entities.map(e => e.snapshot.entityId).slice(0, 10);
        console.log(`[OnlineFogProvider] Available entity IDs: ${allIds.join(', ')}`);
      }
    } else if (this.debugCounter % 120 === 0) {
      console.log(`[OnlineFogProvider] WARNING: No local entity ID set`);
    }

    // Now process entities for fog revealers
    // Debug counters
    let championRevealers = 0;
    let minionRevealers = 0;
    let towerRevealers = 0;
    let wardRevealers = 0;
    let skippedWrongSide = 0;
    let skippedDead = 0;

    for (const entity of entities) {
      const snapshot = entity.snapshot as any;

      // Only reveal for our team's entities
      if (snapshot.side !== this.localSide) {
        skippedWrongSide++;
        continue;
      }

      // Skip dead entities
      if (snapshot.isDead || snapshot.isDestroyed) {
        skippedDead++;
        continue;
      }

      // Get sight range for this entity type
      // For wards, use the sightRange from the snapshot if available
      let sightRange: number;
      if (snapshot.entityType === EntityType.WARD && snapshot.sightRange) {
        sightRange = snapshot.sightRange;
      } else {
        // Use 0 as fallback - unknown entity types don't provide vision
        sightRange = SIGHT_RANGES[snapshot.entityType] ?? 0;
      }

      // Skip entities that don't provide vision (e.g., projectiles)
      if (sightRange <= 0) {
        continue;
      }

      // Count by type
      if (snapshot.entityType === EntityType.CHAMPION) {
        championRevealers++;
      } else if (snapshot.entityType === EntityType.MINION) {
        minionRevealers++;
      } else if (snapshot.entityType === EntityType.TOWER) {
        towerRevealers++;
      } else if (snapshot.entityType === EntityType.WARD) {
        wardRevealers++;
      }

      this.revealers.push(new ServerEntityRevealer(
        entity.position.x,
        entity.position.y,
        this.localSide,
        sightRange
      ));
    }

    // Debug log every 120 frames (~2 seconds at 60fps)
    if (this.debugCounter % 120 === 0) {
      console.log(`[OnlineFogProvider] Revealers: ${championRevealers} champions, ${minionRevealers} minions, ${towerRevealers} towers, ${wardRevealers} wards. Total: ${this.revealers.length}`);
      console.log(`[OnlineFogProvider] Skipped: ${skippedWrongSide} wrong side, ${skippedDead} dead. Local side: ${this.localSide}`);
      // Log first few entities to verify types
      const sampleEntities = entities.slice(0, 5).map(e => ({
        id: e.snapshot.entityId,
        type: (e.snapshot as any).entityType,
        side: (e.snapshot as any).side,
        pos: `(${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})`
      }));
      console.log(`[OnlineFogProvider] Sample entities:`, sampleEntities);
    }

    // Update the fog of war system with our revealers
    if (ctx.fogOfWar) {
      ctx.fogOfWar.update(this.revealers);

      // Debug: verify fog update was called
      if (this.debugCounter % 120 === 0) {
        console.log(`[OnlineFogProvider] Called fogOfWar.update() with ${this.revealers.length} revealers. Fog enabled: ${ctx.fogOfWar.isEnabled()}`);
      }
    } else if (this.debugCounter % 120 === 0) {
      console.log(`[OnlineFogProvider] WARNING: ctx.fogOfWar is undefined!`);
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
