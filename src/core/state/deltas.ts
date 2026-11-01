/**
 * Snapshot merging: applies full snapshots and entity deltas from the server
 * to the client's entity map.
 *
 * Clearable fields (targetX, targetY, targetEntityId) arrive as `null` when
 * cleared; a field absent from a delta means "no change" (see CLAUDE.md).
 */

import Vector from '@/physics/vector';
import { EntityType, type EntityDelta, type EntitySnapshot } from '@siege/shared';
import { createDefaultAnimationState, setServerPosition, type InterpolatedEntity } from './entities';

/**
 * Called while merging, so the state manager can spawn effects and track the
 * local player as entities die, change and appear.
 */
export interface EntityLifecycleHooks {
  /**
   * A delta marks the entity dead or destroyed; it's removed from the map
   * right after (an inhibitor stays). `existing` is undefined if the client
   * never had it.
   */
  onRemoved(entityId: string, existing: InterpolatedEntity | undefined, data: any): void;
  /** A delta is about to be merged into a living entity. */
  onChanged(existing: InterpolatedEntity, data: any): void;
  /** A snapshot is about to be added (or replace an entity) at this rounded position. */
  onAdded(snapshot: EntitySnapshot, position: Vector): void;
}

/**
 * Process a single entity delta.
 */
export function applyEntityDelta(
  entities: Map<string, InterpolatedEntity>,
  delta: EntityDelta,
  hooks: EntityLifecycleHooks
): void {
  const existing = entities.get(delta.entityId);

  const data = delta.data as any;

  // Left this player's sight (fog, a bush): still alive, so no death effects
  if (data && data.outOfSight === true) {
    entities.delete(delta.entityId);
    return;
  }

  // Check if entity is being marked as dead/destroyed - remove it, except
  // an inhibitor: it stays as rubble until it rebuilds
  if (data && (data.isDead === true || data.isDestroyed === true)) {
    hooks.onRemoved(delta.entityId, existing, data);
    if (existing?.snapshot.entityType !== EntityType.INHIBITOR) {
      // Remove dead/destroyed entities from client state
      entities.delete(delta.entityId);
      return;
    }
  }

  if (existing) {
    hooks.onChanged(existing, data);

    // Update existing entity - merge delta into existing snapshot
    const snapshot = { ...existing.snapshot, ...delta.data } as EntitySnapshot;

    // Clearable values use `null` to indicate "cleared" vs absent meaning "no change"
    // We must explicitly copy these since spread operator handles null correctly but
    // we want to be explicit about the pattern for clarity
    // Round target positions to integers to avoid floating point precision issues
    if (data && 'targetX' in data) {
      (snapshot as any).targetX = data.targetX != null ? Math.round(data.targetX) : null;
    }
    if (data && 'targetY' in data) {
      (snapshot as any).targetY = data.targetY != null ? Math.round(data.targetY) : null;
    }
    if (data && 'targetEntityId' in data) {
      (snapshot as any).targetEntityId = data.targetEntityId;
    }

    // Only update position if x/y are explicitly provided in delta
    // This prevents position from being reset to (0,0) when delta doesn't include position
    // Round positions to integers to avoid floating point precision issues
    if (data && typeof data.x === 'number' && typeof data.y === 'number') {
      setServerPosition(existing, Math.round(data.x), Math.round(data.y), Date.now());
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
    addOrUpdateEntity(entities, delta.data as EntitySnapshot, hooks);
  }
}

/** How far into its flight a projectile can be when first seen (a tick at the fastest speeds, ~35) */
const PROJECTILE_FIRST_SEEN_WITHIN = 60;

/**
 * Add or update an entity.
 */
export function addOrUpdateEntity(
  entities: Map<string, InterpolatedEntity>,
  snapshot: EntitySnapshot,
  hooks: EntityLifecycleHooks
): void {
  // Round positions to integers to avoid floating point precision issues
  const pos = new Vector(Math.round(snapshot.x), Math.round(snapshot.y));

  hooks.onAdded(snapshot, pos);

  // Preserve existing animation state if entity exists
  const existing = entities.get(snapshot.entityId);
  const animation = existing?.animation ?? createDefaultAnimationState();

  // A new projectile is first seen a tick into its flight: it eases out
  // from whoever fired it instead of popping up ahead of them (unless it
  // started somewhere else, like Lume's orb)
  const source = !existing && snapshot.entityType === EntityType.PROJECTILE
    ? entities.get((snapshot as { sourceId?: string }).sourceId ?? '')
    : undefined;
  const fromSource = !!source && source.position.distanceTo(pos) < PROJECTILE_FIRST_SEEN_WITHIN;
  const drawnFrom = fromSource ? source!.position.clone() : pos.clone();

  entities.set(snapshot.entityId, {
    snapshot,
    position: drawnFrom,
    previousPosition: drawnFrom.clone(),
    serverPosition: pos.clone(),
    positionTime: Date.now(),
    drawnAt: Date.now(),
    lastUpdateTime: Date.now(),
    animation,
  });
}
