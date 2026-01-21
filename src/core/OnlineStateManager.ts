/**
 * OnlineStateManager - Manages game state received from server.
 *
 * Tracks:
 * - All entity snapshots from server
 * - Local player's entity
 * - Game time and tick
 * - Interpolation for smooth rendering
 */

import Vector from '@/physics/vector';
import type { MatchData } from '@/ui/matchmaking/MatchmakingUI';
import {
  EntityType,
  type StateUpdate,
  type FullStateSnapshot,
  type EntitySnapshot,
  type EntityDelta,
} from '@siege/shared';

/**
 * Interpolated entity state for rendering.
 */
export interface InterpolatedEntity {
  snapshot: EntitySnapshot;
  position: Vector;
  previousPosition: Vector;
  lastUpdateTime: number;
}

/**
 * OnlineStateManager tracks and interpolates server state.
 */
export class OnlineStateManager {
  // Current entity states
  private entities: Map<string, InterpolatedEntity> = new Map();

  // Match data
  private matchData: MatchData;
  private localPlayerId: string;
  private localEntityId: string;
  private localSide: number;

  // Game timing
  private currentTick = 0;
  private gameTime = 0;
  private lastUpdateTimestamp = 0;

  // Interpolation settings
  private interpolationDelay = 100; // ms

  constructor(matchData: MatchData) {
    this.matchData = matchData;
    this.localSide = matchData.yourSide;

    // Find local player from match data (player on our side)
    const localPlayer = matchData.players.find(p => p.side === matchData.yourSide);
    this.localPlayerId = localPlayer?.playerId || '';
    this.localEntityId = localPlayer?.entityId || '';

    console.log('[OnlineStateManager] Initialized:', {
      localPlayerId: this.localPlayerId,
      localEntityId: this.localEntityId,
      localSide: this.localSide,
    });
  }

  /**
   * Process a full state snapshot (on connect/reconnect).
   */
  processFullState(snapshot: FullStateSnapshot): void {
    console.log('[StateManager] Processing full state:', snapshot.entities.length, 'entities');

    // DEBUG: Log entity types in full state
    const typeCounts: Record<number, number> = {};
    for (const e of snapshot.entities) {
      typeCounts[e.entityType] = (typeCounts[e.entityType] || 0) + 1;
    }
    console.log('[StateManager] Entity types in full state:', JSON.stringify(typeCounts));

    // Log towers specifically
    const towers = snapshot.entities.filter(e => e.entityType === 2);
    console.log(`[StateManager] Towers in full state: ${towers.length}`);
    for (const t of towers) {
      console.log(`  - Tower: id=${t.entityId}, side=${(t as any).side}, x=${t.x}, y=${t.y}`);
    }

    // Log nexuses specifically
    const nexuses = snapshot.entities.filter(e => e.entityType === 4);
    console.log(`[StateManager] Nexuses in full state: ${nexuses.length}`);
    for (const n of nexuses) {
      console.log(`  - Nexus: id=${n.entityId}, side=${(n as any).side}, x=${n.x}, y=${n.y}`);
    }

    this.currentTick = snapshot.tick;
    this.gameTime = snapshot.gameTime;
    this.lastUpdateTimestamp = Date.now();

    // Clear existing entities and add all from snapshot
    this.entities.clear();

    for (const entity of snapshot.entities) {
      this.addOrUpdateEntity(entity);
    }
  }

  /**
   * Process a delta state update.
   */
  processStateUpdate(update: StateUpdate): void {
    this.currentTick = update.tick;
    this.gameTime = update.gameTime;
    this.lastUpdateTimestamp = Date.now();

    // DEBUG: Log incoming updates
    if (update.tick % 30 === 0) {
      console.log(`[OnlineStateManager] Tick ${update.tick}: received ${update.deltas.length} deltas, current entities: ${this.entities.size}`);
    }

    // Process entity deltas
    for (const delta of update.deltas) {
      this.processDelta(delta);
    }

    // DEBUG: Log after processing
    if (update.tick % 30 === 0) {
      console.log(`[OnlineStateManager] After processing: ${this.entities.size} entities stored`);
    }
  }

  /**
   * Process a single entity delta.
   */
  private processDelta(delta: EntityDelta): void {
    const existing = this.entities.get(delta.entityId);

    // Check if entity is being marked as dead/destroyed - remove it
    const data = delta.data as any;
    if (data && (data.isDead === true || data.isDestroyed === true)) {
      // Remove dead/destroyed entities from client state
      this.entities.delete(delta.entityId);
      return;
    }

    if (existing) {
      // Update existing entity - merge delta into existing snapshot
      const snapshot = { ...existing.snapshot, ...delta.data } as EntitySnapshot;

      // Only update position if x/y are explicitly provided in delta
      // This prevents position from being reset to (0,0) when delta doesn't include position
      if (data && typeof data.x === 'number' && typeof data.y === 'number') {
        existing.previousPosition = existing.position.clone();
        existing.position = new Vector(data.x, data.y);
      }

      existing.snapshot = snapshot;
      existing.lastUpdateTime = Date.now();
    } else if (delta.data) {
      // New entity - must have position data
      const newData = delta.data as any;
      if (typeof newData.x !== 'number' || typeof newData.y !== 'number') {
        console.warn(`[OnlineStateManager] New entity ${delta.entityId} missing position data:`, delta.data);
        return;
      }
      this.addOrUpdateEntity(delta.data as EntitySnapshot);
    }
  }

  /**
   * Add or update an entity.
   */
  private addOrUpdateEntity(snapshot: EntitySnapshot): void {
    const pos = new Vector(snapshot.x, snapshot.y);

    // DEBUG: Log tower and nexus entities
    if (snapshot.entityType === EntityType.TOWER) {
      console.log(`[OnlineStateManager] Tower: id=${snapshot.entityId}, side=${(snapshot as any).side}, x=${snapshot.x}, y=${snapshot.y}`);
    }
    if (snapshot.entityType === EntityType.NEXUS) {
      console.log(`[OnlineStateManager] Nexus: id=${snapshot.entityId}, side=${(snapshot as any).side}, x=${snapshot.x}, y=${snapshot.y}`);
    }

    this.entities.set(snapshot.entityId, {
      snapshot,
      position: pos,
      previousPosition: pos.clone(),
      lastUpdateTime: Date.now(),
    });
  }

  /**
   * Get all entities for rendering.
   */
  getEntities(): InterpolatedEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get a specific entity by ID.
   */
  getEntity(entityId: string): InterpolatedEntity | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Get the local player's entity.
   */
  getLocalPlayerEntity(): InterpolatedEntity | undefined {
    if (!this.localEntityId) return undefined;
    return this.entities.get(this.localEntityId);
  }

  /**
   * Get the local player's position.
   */
  getLocalPlayerPosition(): Vector | null {
    const localEntity = this.getLocalPlayerEntity();
    return localEntity?.position || null;
  }

  /**
   * Get interpolated position for an entity.
   */
  getInterpolatedPosition(entityId: string): Vector | null {
    const entity = this.entities.get(entityId);
    if (!entity) return null;

    // Simple linear interpolation based on time since last update
    const timeSinceUpdate = Date.now() - entity.lastUpdateTime;
    const t = Math.min(1, timeSinceUpdate / this.interpolationDelay);

    return Vector.lerp(entity.previousPosition, entity.position, t);
  }

  /**
   * Get current game tick.
   */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Get current game time.
   */
  getGameTime(): number {
    return this.gameTime;
  }

  /**
   * Get local player's side.
   */
  getLocalSide(): number {
    return this.localSide;
  }

  /**
   * Get local entity ID.
   */
  getLocalEntityId(): string {
    return this.localEntityId;
  }

  /**
   * Check if we have received any state from server.
   */
  hasState(): boolean {
    return this.entities.size > 0;
  }

  /**
   * Get entity count.
   */
  getEntityCount(): number {
    return this.entities.size;
  }
}

export default OnlineStateManager;
