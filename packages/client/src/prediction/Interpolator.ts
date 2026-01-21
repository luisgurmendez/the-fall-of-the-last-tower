/**
 * Interpolator - Smoothly interpolates entity positions between server snapshots.
 *
 * Uses buffered snapshots to render entities at a fixed delay behind
 * the server, allowing for smooth movement despite network jitter.
 */

import { Vector, GameConfig, type EntitySnapshot } from '@siege/shared';

/**
 * Buffered snapshot with timestamp.
 */
interface BufferedSnapshot {
  snapshot: EntitySnapshot;
  serverTick: number;
  serverTime: number;
  receivedAt: number;
}

/**
 * Interpolated entity state.
 */
export interface InterpolatedState {
  entityId: string;
  x: number;
  y: number;
  snapshot: EntitySnapshot;
  interpolationFactor: number;
}

/**
 * Configuration for interpolation.
 */
export interface InterpolatorConfig {
  /** Delay in milliseconds to render behind server (default: 100ms) */
  interpolationDelay?: number;
  /** Maximum snapshots to buffer per entity */
  maxBufferSize?: number;
}

/**
 * Entity interpolation system.
 */
export class Interpolator {
  private buffers: Map<string, BufferedSnapshot[]> = new Map();
  private config: Required<InterpolatorConfig>;

  constructor(config: InterpolatorConfig = {}) {
    this.config = {
      interpolationDelay: config.interpolationDelay ?? GameConfig.NETWORK.INTERPOLATION_DELAY,
      maxBufferSize: config.maxBufferSize ?? 10,
    };
  }

  /**
   * Add a snapshot to the buffer.
   */
  addSnapshot(snapshot: EntitySnapshot, serverTick: number, serverTime: number): void {
    let buffer = this.buffers.get(snapshot.entityId);
    if (!buffer) {
      buffer = [];
      this.buffers.set(snapshot.entityId, buffer);
    }

    // Add snapshot to buffer
    buffer.push({
      snapshot,
      serverTick,
      serverTime,
      receivedAt: Date.now(),
    });

    // Sort by server time (should already be sorted, but ensure)
    buffer.sort((a, b) => a.serverTime - b.serverTime);

    // Trim buffer if too large
    while (buffer.length > this.config.maxBufferSize) {
      buffer.shift();
    }
  }

  /**
   * Get interpolated state for an entity.
   */
  getInterpolatedState(entityId: string, renderTime: number): InterpolatedState | null {
    const buffer = this.buffers.get(entityId);
    if (!buffer || buffer.length === 0) {
      return null;
    }

    // Calculate target time (with interpolation delay)
    const targetTime = renderTime - this.config.interpolationDelay;

    // Find surrounding snapshots
    let before: BufferedSnapshot | null = null;
    let after: BufferedSnapshot | null = null;

    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i].receivedAt <= targetTime) {
        before = buffer[i];
      } else {
        after = buffer[i];
        break;
      }
    }

    // If no snapshots before target time, use first snapshot
    if (!before) {
      const first = buffer[0];
      return {
        entityId,
        x: first.snapshot.x,
        y: first.snapshot.y,
        snapshot: first.snapshot,
        interpolationFactor: 0,
      };
    }

    // If no snapshot after target time, use last snapshot
    if (!after) {
      return {
        entityId,
        x: before.snapshot.x,
        y: before.snapshot.y,
        snapshot: before.snapshot,
        interpolationFactor: 1,
      };
    }

    // Interpolate between snapshots
    const t = (targetTime - before.receivedAt) / (after.receivedAt - before.receivedAt);
    const clampedT = Math.max(0, Math.min(1, t));

    const x = before.snapshot.x + (after.snapshot.x - before.snapshot.x) * clampedT;
    const y = before.snapshot.y + (after.snapshot.y - before.snapshot.y) * clampedT;

    return {
      entityId,
      x,
      y,
      snapshot: clampedT < 0.5 ? before.snapshot : after.snapshot,
      interpolationFactor: clampedT,
    };
  }

  /**
   * Get all interpolated states.
   */
  getAllInterpolatedStates(renderTime: number): InterpolatedState[] {
    const states: InterpolatedState[] = [];

    for (const entityId of this.buffers.keys()) {
      const state = this.getInterpolatedState(entityId, renderTime);
      if (state) {
        states.push(state);
      }
    }

    return states;
  }

  /**
   * Remove entity from buffer (on death/removal).
   */
  removeEntity(entityId: string): void {
    this.buffers.delete(entityId);
  }

  /**
   * Clear all buffers.
   */
  clear(): void {
    this.buffers.clear();
  }

  /**
   * Get buffer size for an entity.
   */
  getBufferSize(entityId: string): number {
    return this.buffers.get(entityId)?.length ?? 0;
  }

  /**
   * Get average buffer delay.
   */
  getAverageBufferDelay(): number {
    let totalDelay = 0;
    let count = 0;

    for (const buffer of this.buffers.values()) {
      if (buffer.length >= 2) {
        const oldest = buffer[0].receivedAt;
        const newest = buffer[buffer.length - 1].receivedAt;
        totalDelay += newest - oldest;
        count++;
      }
    }

    return count > 0 ? totalDelay / count : 0;
  }

  /**
   * Set interpolation delay.
   */
  setInterpolationDelay(delay: number): void {
    this.config.interpolationDelay = delay;
  }

  /**
   * Get current interpolation delay.
   */
  getInterpolationDelay(): number {
    return this.config.interpolationDelay;
  }
}
