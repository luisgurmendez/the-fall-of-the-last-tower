/**
 * Predictor - High-level client-side prediction system.
 *
 * Coordinates between:
 * - Interpolator (for remote entities)
 * - Reconciler (for local player)
 * - Network state updates
 */

import {
  Vector,
  InputType,
  type ClientInput,
  type StateUpdate,
  type ChampionSnapshot,
  type EntitySnapshot,
} from '@siege/shared';
import { Interpolator, type InterpolatedState } from './Interpolator';
import { Reconciler, type ReconciliationResult, defaultApplyMovementInput } from './Reconciler';

/**
 * Configuration for the prediction system.
 */
export interface PredictorConfig {
  /** Local player's entity ID */
  localPlayerId: string;
  /** Interpolation delay in ms (default: 100) */
  interpolationDelay?: number;
  /** Snap threshold for reconciliation (default: 100) */
  snapThreshold?: number;
  /** Correction threshold (default: 5) */
  correctionThreshold?: number;
}

/**
 * Entity state from the prediction system.
 */
export interface PredictedEntityState {
  entityId: string;
  x: number;
  y: number;
  snapshot: EntitySnapshot;
  isLocalPlayer: boolean;
  interpolationFactor?: number;
}

/**
 * Statistics about the prediction system.
 */
export interface PredictionStats {
  pendingInputs: number;
  interpolationDelay: number;
  averageBufferDelay: number;
  lastReconciliationError: number;
  snapsThisSecond: number;
}

/**
 * High-level prediction system for the client.
 */
export class Predictor {
  private config: Required<PredictorConfig>;
  private interpolator: Interpolator;
  private reconciler: Reconciler;

  // Local player state
  private localPlayerSnapshot: ChampionSnapshot | null = null;
  private localPlayerPosition: Vector = new Vector(0, 0);

  // Statistics
  private lastReconciliationError = 0;
  private snapsThisSecond = 0;
  private snapResetTime = 0;

  constructor(config: PredictorConfig) {
    this.config = {
      localPlayerId: config.localPlayerId,
      interpolationDelay: config.interpolationDelay ?? 100,
      snapThreshold: config.snapThreshold ?? 100,
      correctionThreshold: config.correctionThreshold ?? 5,
    };

    this.interpolator = new Interpolator({
      interpolationDelay: this.config.interpolationDelay,
    });

    this.reconciler = new Reconciler({
      snapThreshold: this.config.snapThreshold,
      correctionThreshold: this.config.correctionThreshold,
    });
  }

  /**
   * Process a state update from the server.
   */
  processStateUpdate(update: StateUpdate): void {
    const renderTime = Date.now();

    // Process all entity deltas
    for (const delta of update.deltas) {
      const snapshot = delta.data as EntitySnapshot;

      if (delta.entityId === this.config.localPlayerId) {
        // Local player - use reconciliation
        this.processLocalPlayerUpdate(snapshot as ChampionSnapshot, update);
      } else {
        // Remote entity - add to interpolation buffer
        this.interpolator.addSnapshot(snapshot, update.tick, update.gameTime);
      }
    }
  }

  /**
   * Process local player update with reconciliation.
   */
  private processLocalPlayerUpdate(snapshot: ChampionSnapshot, update: StateUpdate): void {
    this.localPlayerSnapshot = snapshot;

    // Get the last acknowledged input sequence
    const lastAckedSeq = update.inputAcks[this.config.localPlayerId] ?? 0;

    // Reconcile prediction with server state
    const result = this.reconciler.reconcile(
      snapshot,
      lastAckedSeq,
      this.applyInputToPosition.bind(this)
    );

    this.localPlayerPosition = result.position;
    this.lastReconciliationError = result.errorDistance;

    if (result.snapped) {
      this.snapsThisSecond++;
    }

    // Update movement speed from server snapshot
    if (snapshot.movementSpeed !== undefined) {
      this.reconciler.setMovementSpeed(snapshot.movementSpeed);
    }
  }

  /**
   * Apply a movement input locally (for prediction).
   */
  applyInput(input: ClientInput): Vector {
    return this.reconciler.predict(input, this.applyInputToPosition.bind(this));
  }

  /**
   * Apply input to a position (used by reconciler).
   */
  private applyInputToPosition(input: ClientInput, position: Vector, speed: number): Vector {
    // Only predict movement inputs
    if (input.type !== InputType.MOVE && input.type !== InputType.ATTACK_MOVE) {
      return position;
    }

    return defaultApplyMovementInput(input, position, speed);
  }

  /**
   * Get all entity states for rendering.
   */
  getEntityStates(renderTime: number): PredictedEntityState[] {
    const states: PredictedEntityState[] = [];

    // Add local player state
    if (this.localPlayerSnapshot) {
      states.push({
        entityId: this.config.localPlayerId,
        x: this.localPlayerPosition.x,
        y: this.localPlayerPosition.y,
        snapshot: this.localPlayerSnapshot,
        isLocalPlayer: true,
      });
    }

    // Add interpolated remote entities
    const interpolatedStates = this.interpolator.getAllInterpolatedStates(renderTime);
    for (const state of interpolatedStates) {
      states.push({
        entityId: state.entityId,
        x: state.x,
        y: state.y,
        snapshot: state.snapshot,
        isLocalPlayer: false,
        interpolationFactor: state.interpolationFactor,
      });
    }

    return states;
  }

  /**
   * Get local player's predicted position.
   */
  getLocalPlayerPosition(): Vector | null {
    if (!this.localPlayerSnapshot) return null;
    return this.localPlayerPosition.clone();
  }

  /**
   * Get local player's snapshot.
   */
  getLocalPlayerSnapshot(): ChampionSnapshot | null {
    return this.localPlayerSnapshot;
  }

  /**
   * Set local player's position directly (for initialization).
   */
  setLocalPlayerPosition(position: Vector): void {
    this.localPlayerPosition = position.clone();
    this.reconciler.setPosition(position);
  }

  /**
   * Remove an entity (on death/removal).
   */
  removeEntity(entityId: string): void {
    if (entityId === this.config.localPlayerId) {
      this.localPlayerSnapshot = null;
    } else {
      this.interpolator.removeEntity(entityId);
    }
  }

  /**
   * Clear all state (on disconnect/game end).
   */
  clear(): void {
    this.interpolator.clear();
    this.reconciler.clear();
    this.localPlayerSnapshot = null;
    this.localPlayerPosition = new Vector(0, 0);
  }

  /**
   * Get prediction statistics.
   */
  getStats(): PredictionStats {
    const now = Date.now();

    // Reset snap counter every second
    if (now - this.snapResetTime > 1000) {
      this.snapsThisSecond = 0;
      this.snapResetTime = now;
    }

    return {
      pendingInputs: this.reconciler.getPendingInputCount(),
      interpolationDelay: this.config.interpolationDelay,
      averageBufferDelay: this.interpolator.getAverageBufferDelay(),
      lastReconciliationError: this.lastReconciliationError,
      snapsThisSecond: this.snapsThisSecond,
    };
  }

  /**
   * Set interpolation delay.
   */
  setInterpolationDelay(delay: number): void {
    this.config.interpolationDelay = delay;
    this.interpolator.setInterpolationDelay(delay);
  }

  /**
   * Get the current interpolation delay.
   */
  getInterpolationDelay(): number {
    return this.config.interpolationDelay;
  }
}
