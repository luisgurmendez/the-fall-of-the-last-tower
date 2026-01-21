/**
 * StateBuffer - Stores server state snapshots for interpolation.
 *
 * Maintains a ring buffer of recent state snapshots from the server.
 * Used by the Interpolator to smoothly render entity positions between
 * snapshot times.
 */

import type { StateUpdate, EntitySnapshot, FullStateSnapshot } from '@siege/shared';

/**
 * A timestamped state snapshot.
 */
export interface TimestampedSnapshot {
  /** Server tick number */
  tick: number;

  /** Server timestamp (ms) */
  serverTime: number;

  /** Local time when received (ms) */
  receivedTime: number;

  /** Entity states keyed by entity ID */
  entities: Map<string, EntitySnapshot>;

  /** Game events */
  events: any[];
}

/**
 * Configuration for StateBuffer.
 */
export interface StateBufferConfig {
  /** Maximum number of snapshots to store */
  maxSnapshots?: number;

  /** How far back in time to buffer (ms) */
  bufferDuration?: number;
}

const DEFAULT_CONFIG: Required<StateBufferConfig> = {
  maxSnapshots: 250, // 2 seconds at 125 Hz
  bufferDuration: 2000,
};

/**
 * Ring buffer for storing server state snapshots.
 */
export class StateBuffer {
  private config: Required<StateBufferConfig>;
  private snapshots: TimestampedSnapshot[] = [];
  private latestTick = -1;

  // Full entity state (built from deltas)
  private entityStates: Map<string, EntitySnapshot> = new Map();

  // Time synchronization
  private serverTimeOffset = 0; // localTime - serverTime
  private lastServerTime = 0;

  constructor(config: StateBufferConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the latest tick number.
   */
  getLatestTick(): number {
    return this.latestTick;
  }

  /**
   * Get the number of buffered snapshots.
   */
  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  /**
   * Get server time offset.
   */
  getServerTimeOffset(): number {
    return this.serverTimeOffset;
  }

  /**
   * Convert local time to server time.
   */
  localToServerTime(localTime: number): number {
    return localTime - this.serverTimeOffset;
  }

  /**
   * Convert server time to local time.
   */
  serverToLocalTime(serverTime: number): number {
    return serverTime + this.serverTimeOffset;
  }

  /**
   * Process a full state snapshot (initial state or reconnection).
   */
  processFullState(fullState: FullStateSnapshot): void {
    const now = Date.now();

    // Update time synchronization
    this.serverTimeOffset = now - fullState.timestamp;
    this.lastServerTime = fullState.timestamp;

    // Clear existing state
    this.snapshots = [];
    this.entityStates.clear();

    // Build initial entity state from full snapshot
    for (const entity of fullState.entities) {
      this.entityStates.set(entity.entityId, entity);
    }

    // Create initial snapshot
    const snapshot: TimestampedSnapshot = {
      tick: fullState.tick,
      serverTime: fullState.timestamp,
      receivedTime: now,
      entities: new Map(this.entityStates),
      events: fullState.events || [],
    };

    this.snapshots.push(snapshot);
    this.latestTick = fullState.tick;

    console.log(`[StateBuffer] Processed full state: tick=${fullState.tick}, entities=${fullState.entities.length}`);
  }

  /**
   * Process a delta state update.
   */
  processStateUpdate(update: StateUpdate): void {
    const now = Date.now();

    // Update time synchronization (exponential moving average)
    const measuredOffset = now - update.timestamp;
    this.serverTimeOffset = this.serverTimeOffset * 0.9 + measuredOffset * 0.1;
    this.lastServerTime = update.timestamp;

    // Apply deltas to entity states
    if (update.deltas) {
      for (const delta of update.deltas) {
        // Delta contains the full entity state for now (simplified)
        // In production, this would be actual deltas with change masks
        this.entityStates.set(delta.entityId, delta as unknown as EntitySnapshot);
      }
    }

    // Create snapshot
    const snapshot: TimestampedSnapshot = {
      tick: update.tick,
      serverTime: update.timestamp,
      receivedTime: now,
      entities: new Map(this.entityStates),
      events: update.events || [],
    };

    // Add to buffer
    this.snapshots.push(snapshot);
    this.latestTick = update.tick;

    // Trim old snapshots
    this.trimOldSnapshots(now);
  }

  /**
   * Get the current entity states (latest snapshot).
   */
  getCurrentEntities(): Map<string, EntitySnapshot> {
    return this.entityStates;
  }

  /**
   * Get a specific entity's current state.
   */
  getEntity(entityId: string): EntitySnapshot | undefined {
    return this.entityStates.get(entityId);
  }

  /**
   * Find snapshots surrounding a given server time.
   * Returns [before, after] or null if not enough data.
   */
  findSurroundingSnapshots(serverTime: number): [TimestampedSnapshot, TimestampedSnapshot] | null {
    if (this.snapshots.length < 2) {
      return null;
    }

    // Find the two snapshots surrounding the target time
    for (let i = this.snapshots.length - 1; i > 0; i--) {
      const after = this.snapshots[i];
      const before = this.snapshots[i - 1];

      if (before.serverTime <= serverTime && after.serverTime >= serverTime) {
        return [before, after];
      }
    }

    // If target time is before all snapshots, return oldest two
    if (serverTime < this.snapshots[0].serverTime) {
      return [this.snapshots[0], this.snapshots[1]];
    }

    // If target time is after all snapshots, return newest two
    const len = this.snapshots.length;
    return [this.snapshots[len - 2], this.snapshots[len - 1]];
  }

  /**
   * Get the oldest snapshot.
   */
  getOldestSnapshot(): TimestampedSnapshot | null {
    return this.snapshots[0] || null;
  }

  /**
   * Get the newest snapshot.
   */
  getNewestSnapshot(): TimestampedSnapshot | null {
    return this.snapshots[this.snapshots.length - 1] || null;
  }

  /**
   * Get entity state at a specific tick.
   */
  getEntityAtTick(entityId: string, tick: number): EntitySnapshot | undefined {
    for (const snapshot of this.snapshots) {
      if (snapshot.tick === tick) {
        return snapshot.entities.get(entityId);
      }
    }
    return undefined;
  }

  /**
   * Clear all buffered state.
   */
  clear(): void {
    this.snapshots = [];
    this.entityStates.clear();
    this.latestTick = -1;
  }

  /**
   * Trim snapshots older than buffer duration.
   */
  private trimOldSnapshots(now: number): void {
    const cutoffTime = now - this.config.bufferDuration;

    // Keep at least 2 snapshots for interpolation
    while (
      this.snapshots.length > 2 &&
      (this.snapshots.length > this.config.maxSnapshots ||
        this.snapshots[0].receivedTime < cutoffTime)
    ) {
      this.snapshots.shift();
    }
  }
}
