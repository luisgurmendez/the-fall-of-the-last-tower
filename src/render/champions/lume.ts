/**
 * Lume: sprite-sheet body with Q/E/R ability animations, and the light
 * photon auto-attack projectile. Lume's Light Orbs are their own entity
 * type (src/render/entities/lightOrb.ts).
 */

import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import { drawSpriteFrame, getSpriteFeet, imageCache } from "@/render/entities/shared";
import type { ChampionBodyRenderer, ChampionRendererEntry } from "./types";

/**
 * Sprite configuration.
 */
const SPRITES = {
  LUME: {
    IDLE: "/assets/champs/lume/Lume-IDLE.png",
    WALK: "/assets/champs/lume/Lume-Walk-Sheet.png",
    ATTACK: "/assets/champs/lume/Lume-BasicAttack-Sheet.png",
    Q: "/assets/champs/lume/Lume-Q-Sheet.png",
    E: "/assets/champs/lume/Lume-E-Sheet.png",
    R: "/assets/champs/lume/Lume-R-Sheet.png",
    FRAME_WIDTH: 152,
    FRAME_HEIGHT: 152,
    IDLE_FRAMES: 1,
    WALK_FRAMES: 6,
    ATTACK_FRAMES: 10,
    Q_FRAMES: 8,
    E_FRAMES: 11,
    R_FRAMES: 12,
    SCALE: 1.0,
  },
};

/**
 * Draws Lume from sprite sheets.
 */
class LumeBodyRenderer implements ChampionBodyRenderer {
  getFeet(): { y: number; halfWidth: number } | null {
    return getSpriteFeet(SPRITES.LUME.IDLE, SPRITES.LUME.SCALE);
  }

  private rc: EntityRenderContext;

  constructor(rc: EntityRenderContext) {
    this.rc = rc;
  }

  /**
   * Render Lume champion using sprite sheets.
   * Returns true if sprite was rendered, false if fallback needed.
   */
  render(
    ctx: CanvasRenderingContext2D,
    snapshot: any,
    state: EntityRenderState,
  ): boolean {
    const entityId = snapshot.entityId;

    // Check if dashing with Lume E (special case: hold frame 6 during dash)
    const isDashingWithE =
      snapshot.isDashing && snapshot.dashAbilityId === "lume_e";

    // Check if casting an ability
    const castingState = this.rc.stateManager.isEntityCastingAbility(entityId);
    const abilityProgress = castingState.casting
      ? this.rc.stateManager.getAbilityAnimationProgress(entityId)
      : 0;

    // Select sprite based on animation state (priority: E dash > ability > walk > idle)
    let spriteSrc: string;
    let frameCount: number;
    let useAbilityProgress = false;
    let fixedFrameIndex: number | null = null;

    if (isDashingWithE) {
      // Lume E dash: use E sprite, hold on frame 6 (index 5)
      spriteSrc = SPRITES.LUME.E;
      frameCount = SPRITES.LUME.E_FRAMES;
      fixedFrameIndex = 5; // Frame 6 (0-indexed)

      // Override facing direction to look toward dash target (orb)
      if (snapshot.dashTargetX != null) {
        const dx = snapshot.dashTargetX - snapshot.x;
        state.facingRight = dx >= 0;
      }
    } else if (castingState.casting && castingState.abilityId) {
      // Ability animation - check which ability
      const abilityId = castingState.abilityId;
      if (abilityId === "lume_q") {
        spriteSrc = SPRITES.LUME.Q;
        frameCount = SPRITES.LUME.Q_FRAMES;
        useAbilityProgress = true;
      } else if (abilityId === "lume_e") {
        // Lume E after dash: play ending frames (indices 6-10)
        // abilityProgress goes from ~0.5 to 1.0 during the ending phase
        // Map this to frames 6-10 (5 frames)
        spriteSrc = SPRITES.LUME.E;
        frameCount = SPRITES.LUME.E_FRAMES;
        const endingFrameCount = 5;
        const endingFrameIndex = Math.min(
          Math.floor(abilityProgress * endingFrameCount),
          endingFrameCount - 1,
        );
        fixedFrameIndex = 6 + endingFrameIndex; // Start from index 6 (frame 7)
      } else if (abilityId === "lume_r") {
        spriteSrc = SPRITES.LUME.R;
        frameCount = SPRITES.LUME.R_FRAMES;
        useAbilityProgress = true;
      } else {
        // Unknown ability, fall back to idle
        spriteSrc = SPRITES.LUME.IDLE;
        frameCount = SPRITES.LUME.IDLE_FRAMES;
      }
    } else if (state.isAttacking) {
      // Attack animation
      spriteSrc = SPRITES.LUME.ATTACK;
      frameCount = SPRITES.LUME.ATTACK_FRAMES;
      // Use attack animation time for frame selection
      const animSpeed = 12; // Fast attack animation
      fixedFrameIndex = Math.floor(state.attackAnimTime * animSpeed) % frameCount;
    } else if (state.isWalking) {
      // Walk animation
      spriteSrc = SPRITES.LUME.WALK;
      frameCount = SPRITES.LUME.WALK_FRAMES;
    } else {
      // Idle animation
      spriteSrc = SPRITES.LUME.IDLE;
      frameCount = SPRITES.LUME.IDLE_FRAMES;
    }

    const image = imageCache.get(spriteSrc);

    if (image && image.complete && image.naturalWidth > 0) {
      // Calculate frame dimensions from actual image
      const frameWidth = image.naturalWidth / frameCount;
      const frameHeight = image.naturalHeight;

      // Calculate animation frame
      let frameIndex: number;
      if (fixedFrameIndex !== null) {
        // Fixed frame (e.g., Lume E dash holds on frame 6)
        frameIndex = Math.min(fixedFrameIndex, frameCount - 1);
      } else if (useAbilityProgress) {
        // Use ability progress (0-1) to determine frame
        frameIndex = Math.min(
          Math.floor(abilityProgress * frameCount),
          frameCount - 1,
        );
      } else {
        // Use continuous animation time for walk/idle
        const animSpeed = state.isWalking ? 10 : 8;
        frameIndex = Math.floor(this.rc.animationTime * animSpeed) % frameCount;
      }
      const srcX = frameIndex * frameWidth;

      // Check if entity is hovered for outline highlighting
      const outlineColor = this.rc.getOutlineColor(snapshot.entityId);

      // Apply horizontal flip if facing left
      ctx.save();
      if (!state.facingRight) {
        ctx.scale(-1, 1);
      }

      drawSpriteFrame(
        ctx,
        image,
        srcX,
        frameWidth,
        frameHeight,
        SPRITES.LUME.SCALE,
        outlineColor,
      );

      ctx.restore();
      return true;
    }

    return false;
  }
}

/**
 * Lume's light photon auto-attack - small glowing light pulse.
 */
function renderLumeAutoProjectile(ctx: CanvasRenderingContext2D): void {
  const radius = 4; // Small, compact light pulse

  // Outer soft glow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#ffffcc";
  ctx.beginPath();
  ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
  ctx.fill();

  // Middle glow ring
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = "#ffee88";
  ctx.beginPath();
  ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
  ctx.fill();

  // Main body - bright gold/yellow
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // Hot white center
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Lume renderer entry.
 */
export const lumeRenderer: ChampionRendererEntry = {
  images: [
    SPRITES.LUME.IDLE,
    SPRITES.LUME.WALK,
    SPRITES.LUME.ATTACK,
    SPRITES.LUME.Q,
    SPRITES.LUME.E,
    SPRITES.LUME.R,
  ],
  createBodyRenderer: (rc) => new LumeBodyRenderer(rc),
  projectiles: {
    lume_auto: renderLumeAutoProjectile,
  },
  markVisuals: {},
};
