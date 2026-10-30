/**
 * Types shared by EntityRenderer and the per-type entity renderers.
 */

import type { OnlineStateManager } from "@/core/OnlineStateManager";

/**
 * Track entity state for animations and direction.
 */
export interface EntityRenderState {
  lastX: number;
  lastY: number;
  facingRight: boolean; // true = facing right, false = facing left
  attackAnimTime: number; // Time into attack animation
  isAttacking: boolean;
  // Animation state tracking for smooth transitions
  isWalking: boolean; // Current animation state
  smoothedVelocity: number; // Smoothed velocity magnitude
  idleFrameCount: number; // Frames since velocity dropped below threshold
}

/**
 * Context EntityRenderer hands to the entity renderers. EntityRenderer owns it
 * and advances animationTime once per frame, before drawing any entity.
 */
export interface EntityRenderContext {
  /** Server state, for animation queries such as ability casts. */
  readonly stateManager: OnlineStateManager;
  /** Side of the local player (0 = blue, 1 = red), for ally/enemy colors. */
  readonly localSide: number;
  /** Client-side animation clock in seconds (independent of server tick rate). */
  animationTime: number;
  /** Hover outline color for an entity, or null when it isn't hovered. */
  getOutlineColor(entityId: string): string | null;
}
