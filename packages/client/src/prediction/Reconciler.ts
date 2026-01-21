/**
 * Reconciler - Handles server reconciliation for client-side prediction.
 *
 * When server state arrives, reconciles predicted position with authoritative
 * server position by re-applying unacknowledged inputs.
 */

import { Vector, type ClientInput, type MoveInput, type ChampionSnapshot, InputType } from '@siege/shared';

/**
 * Configuration for reconciliation behavior.
 */
export interface ReconcilerConfig {
  /** Distance threshold to snap position (default: 100 units) */
  snapThreshold?: number;
  /** Distance threshold to start smooth correction (default: 5 units) */
  correctionThreshold?: number;
  /** Smoothing factor for position correction (default: 0.3) */
  smoothingFactor?: number;
  /** Maximum inputs to keep for reconciliation */
  maxPendingInputs?: number;
}

/**
 * Represents a predicted movement input.
 */
interface PredictedInput {
  seq: number;
  input: ClientInput;
  predictedPosition: Vector;
  timestamp: number;
}

/**
 * Result of reconciliation.
 */
export interface ReconciliationResult {
  /** New position after reconciliation */
  position: Vector;
  /** Whether a hard snap occurred */
  snapped: boolean;
  /** Error distance before correction */
  errorDistance: number;
  /** Number of inputs re-applied */
  inputsReapplied: number;
}

/**
 * Handles reconciliation between client prediction and server authority.
 */
export class Reconciler {
  private config: Required<ReconcilerConfig>;
  private pendingInputs: PredictedInput[] = [];
  private currentPosition: Vector = new Vector(0, 0);
  private movementSpeed: number = 325; // Default champion speed

  constructor(config: ReconcilerConfig = {}) {
    this.config = {
      snapThreshold: config.snapThreshold ?? 100,
      correctionThreshold: config.correctionThreshold ?? 5,
      smoothingFactor: config.smoothingFactor ?? 0.3,
      maxPendingInputs: config.maxPendingInputs ?? 60,
    };
  }

  /**
   * Set current predicted position.
   */
  setPosition(position: Vector): void {
    this.currentPosition = position.clone();
  }

  /**
   * Get current predicted position.
   */
  getPosition(): Vector {
    return this.currentPosition.clone();
  }

  /**
   * Set movement speed for prediction calculations.
   */
  setMovementSpeed(speed: number): void {
    this.movementSpeed = speed;
  }

  /**
   * Record a predicted input for later reconciliation.
   */
  recordInput(input: ClientInput, predictedPosition: Vector): void {
    this.pendingInputs.push({
      seq: input.seq,
      input,
      predictedPosition: predictedPosition.clone(),
      timestamp: Date.now(),
    });

    // Trim old inputs
    while (this.pendingInputs.length > this.config.maxPendingInputs) {
      this.pendingInputs.shift();
    }
  }

  /**
   * Reconcile with server state.
   * Returns the corrected position after reconciliation.
   */
  reconcile(
    serverSnapshot: ChampionSnapshot,
    lastAckedSeq: number,
    applyInput: (input: ClientInput, position: Vector, speed: number) => Vector
  ): ReconciliationResult {
    // Remove acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter(p => p.seq > lastAckedSeq);

    // Start from server authoritative position
    let reconciledPosition = new Vector(serverSnapshot.x, serverSnapshot.y);

    // Re-apply unacknowledged inputs
    for (const pending of this.pendingInputs) {
      reconciledPosition = applyInput(pending.input, reconciledPosition, this.movementSpeed);
    }

    // Calculate error between current prediction and reconciled position
    const errorDistance = this.currentPosition.distanceTo(reconciledPosition);

    let snapped = false;

    if (errorDistance > this.config.snapThreshold) {
      // Large error - hard snap to reconciled position
      this.currentPosition = reconciledPosition;
      snapped = true;
    } else if (errorDistance > this.config.correctionThreshold) {
      // Small error - smooth correction
      this.currentPosition = Vector.lerp(
        this.currentPosition,
        reconciledPosition,
        this.config.smoothingFactor
      );
    }
    // If error is below correction threshold, keep current prediction

    return {
      position: this.currentPosition.clone(),
      snapped,
      errorDistance,
      inputsReapplied: this.pendingInputs.length,
    };
  }

  /**
   * Apply local prediction for an input.
   * Call this immediately when sending input to server.
   */
  predict(
    input: ClientInput,
    applyInput: (input: ClientInput, position: Vector, speed: number) => Vector
  ): Vector {
    // Apply input to current position
    this.currentPosition = applyInput(input, this.currentPosition, this.movementSpeed);

    // Record for reconciliation
    this.recordInput(input, this.currentPosition);

    return this.currentPosition.clone();
  }

  /**
   * Get the number of pending (unacknowledged) inputs.
   */
  getPendingInputCount(): number {
    return this.pendingInputs.length;
  }

  /**
   * Get pending inputs for debugging.
   */
  getPendingInputs(): ClientInput[] {
    return this.pendingInputs.map(p => p.input);
  }

  /**
   * Clear all pending inputs (on disconnect/reconnect).
   */
  clear(): void {
    this.pendingInputs = [];
  }

  /**
   * Get average round-trip time based on input acknowledgments.
   */
  getAverageRTT(currentTime: number): number {
    if (this.pendingInputs.length === 0) return 0;

    const oldest = this.pendingInputs[0];
    return currentTime - oldest.timestamp;
  }
}

/**
 * Default input application function for movement.
 * Moves position toward target at given speed.
 */
export function defaultApplyMovementInput(
  input: ClientInput,
  position: Vector,
  speed: number,
  dt: number = 1 / 60 // Assume 60 Hz input rate
): Vector {
  // Only process movement inputs
  if (input.type !== InputType.MOVE && input.type !== InputType.ATTACK_MOVE) {
    return position;
  }

  const moveInput = input as MoveInput;
  const target = new Vector(moveInput.targetX, moveInput.targetY);
  const direction = target.subtracted(position);
  const distance = direction.length();

  if (distance < 1) {
    return position;
  }

  const moveDistance = Math.min(speed * dt, distance);
  const normalized = direction.normalized();

  return position.added(normalized.scaled(moveDistance));
}
