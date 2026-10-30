/**
 * Types shared by EntityRenderer and the per-type entity renderers.
 */

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
