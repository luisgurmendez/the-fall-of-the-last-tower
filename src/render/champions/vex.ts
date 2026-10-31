/**
 * Vex: sprite-sheet body with ability animations, dash afterimages, the
 * Ninja Mode aura and stealth transparency; the shuriken projectile; and
 * the icons for Vex's marks.
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
  VEX: {
    IDLE: "/assets/champs/vex/Vex-Idle.png",
    WALK: "/assets/champs/vex/Vex-Walk-Sheet.png",
    ATTACK: "/assets/champs/vex/Vex-BasicAttack-Sheet.png",
    DASH: "/assets/champs/vex/Vex-Dash-Sheet.png",
    SHURIKEN: "/assets/champs/vex/Vex-Shuriken-Sheet.png",
    DISAPPEAR: "/assets/champs/vex/Vex-Disappear-Sheet.png",
    IDLE_FRAMES: 1,
    WALK_FRAMES: 5,
    ATTACK_FRAMES: 7,
    ATTACK_TRIGGER_FRAME: 3, // Frame 4 (0-indexed)
    DASH_FRAMES: 13,
    DASH_HOLD_FRAME: 4, // Frame 5 (0-indexed) - hold during dash
    SHURIKEN_FRAMES: 6,
    SHURIKEN_TRIGGER_FRAME: 3, // Frame 4 (0-indexed)
    DISAPPEAR_FRAMES: 15,
    SCALE: 0.8,
  },
};

/**
 * Draws Vex from sprite sheets. Keeps dash afterimages between frames.
 */
class VexBodyRenderer implements ChampionBodyRenderer {
  getFeet(): { y: number; halfWidth: number } | null {
    return getSpriteFeet(SPRITES.VEX.IDLE, SPRITES.VEX.SCALE);
  }

  private rc: EntityRenderContext;

  // Dash afterimages for sprite-based afterimage effects
  private dashAfterimages: Map<
    string,
    Array<{ x: number; y: number; alpha: number; facingRight: boolean }>
  > = new Map();
  private lastAfterimageTime: Map<string, number> = new Map();

  constructor(rc: EntityRenderContext) {
    this.rc = rc;
  }

  /**
   * Render Vex champion using sprite sheets.
   * Returns true if sprite was rendered, false if fallback needed.
   */
  render(
    ctx: CanvasRenderingContext2D,
    snapshot: any,
    state: EntityRenderState,
  ): boolean {
    const entityId = snapshot.entityId;

    // Check if dashing with Vex E (special case: hold frame 5 during dash)
    const isDashingWithE =
      snapshot.isDashing && snapshot.dashAbilityId === "vex_dash";

    // Check if casting an ability
    const castingState = this.rc.stateManager.isEntityCastingAbility(entityId);
    const abilityProgress = castingState.casting
      ? this.rc.stateManager.getAbilityAnimationProgress(entityId)
      : 0;

    // Check if Vex has ninja mode active (for violet particle aura)
    const activeEffects = snapshot.activeEffects as
      | Array<{ definitionId: string }>
      | undefined;
    const hasNinjaMode = activeEffects?.some(
      (e) => e.definitionId === "vex_ninja_mode"
    );

    // Check if Vex is stealthed (for semi-transparent rendering to local player)
    const isStealthed = activeEffects?.some(
      (e) => e.definitionId === "vex_stealth"
    );

    // Select sprite based on animation state (priority: E dash > ability > walk > idle)
    let spriteSrc: string;
    let frameCount: number;
    let useAbilityProgress = false;
    let fixedFrameIndex: number | null = null;

    if (isDashingWithE) {
      // Vex E dash: use DASH sprite, hold on frame 5 (index 4)
      spriteSrc = SPRITES.VEX.DASH;
      frameCount = SPRITES.VEX.DASH_FRAMES;
      fixedFrameIndex = SPRITES.VEX.DASH_HOLD_FRAME;

      // Override facing direction to look toward dash target
      if (snapshot.dashTargetX != null) {
        const dx = snapshot.dashTargetX - snapshot.x;
        state.facingRight = dx >= 0;
      }

      // Create afterimages during dash
      const now = performance.now();
      const lastTime = this.lastAfterimageTime.get(entityId) || 0;
      if (now - lastTime > 50) {
        // Create afterimage every 50ms
        let afterimages = this.dashAfterimages.get(entityId);
        if (!afterimages) {
          afterimages = [];
          this.dashAfterimages.set(entityId, afterimages);
        }
        afterimages.push({
          x: snapshot.x,
          y: snapshot.y,
          alpha: 0.7,
          facingRight: state.facingRight,
        });
        this.lastAfterimageTime.set(entityId, now);
      }
    } else if (castingState.casting && castingState.abilityId) {
      // Ability animation - check which ability
      const abilityId = castingState.abilityId;
      if (abilityId === "vex_shuriken") {
        // Q - Shuriken throw, trigger at frame 4 (index 3)
        spriteSrc = SPRITES.VEX.SHURIKEN;
        frameCount = SPRITES.VEX.SHURIKEN_FRAMES;
        useAbilityProgress = true;
      } else if (abilityId === "vex_shroud") {
        // W - Disappear, effect on last frame
        spriteSrc = SPRITES.VEX.DISAPPEAR;
        frameCount = SPRITES.VEX.DISAPPEAR_FRAMES;
        useAbilityProgress = true;
      } else if (abilityId === "vex_dash") {
        // E - Dash animation after dash completes
        spriteSrc = SPRITES.VEX.DASH;
        frameCount = SPRITES.VEX.DASH_FRAMES;
        // Play ending frames after the dash hold frame
        const endingFrameCount = frameCount - SPRITES.VEX.DASH_HOLD_FRAME - 1;
        const endingFrameIndex = Math.min(
          Math.floor(abilityProgress * endingFrameCount),
          endingFrameCount - 1
        );
        fixedFrameIndex = SPRITES.VEX.DASH_HOLD_FRAME + 1 + endingFrameIndex;
      } else if (abilityId === "vex_ninja_mode") {
        // R - Ninja Mode activation, use walk as base (VFX handles the particles)
        spriteSrc = SPRITES.VEX.WALK;
        frameCount = SPRITES.VEX.WALK_FRAMES;
      } else {
        // Unknown ability, fall back to walk idle
        spriteSrc = SPRITES.VEX.WALK;
        frameCount = SPRITES.VEX.WALK_FRAMES;
        fixedFrameIndex = 0; // Idle frame
      }
    } else if (state.isAttacking) {
      // Basic attack animation - trigger at frame 4 (index 3)
      spriteSrc = SPRITES.VEX.ATTACK;
      frameCount = SPRITES.VEX.ATTACK_FRAMES;
      // Use attack animation time for frame selection
      const animSpeed = 14; // Fast melee attack animation
      fixedFrameIndex =
        Math.floor(state.attackAnimTime * animSpeed) % frameCount;
    } else if (state.isWalking) {
      // Walk animation
      spriteSrc = SPRITES.VEX.WALK;
      frameCount = SPRITES.VEX.WALK_FRAMES;
    } else {
      // Idle animation
      spriteSrc = SPRITES.VEX.IDLE;
      frameCount = SPRITES.VEX.IDLE_FRAMES;
      fixedFrameIndex = 0;
    }

    const image = imageCache.get(spriteSrc);

    if (image && image.complete && image.naturalWidth > 0) {
      // Calculate frame dimensions from actual image
      const frameWidth = image.naturalWidth / frameCount;
      const frameHeight = image.naturalHeight;

      // Calculate animation frame
      let frameIndex: number;
      if (fixedFrameIndex !== null) {
        // Fixed frame (e.g., Vex E dash holds on frame 5)
        frameIndex = Math.min(fixedFrameIndex, frameCount - 1);
      } else if (useAbilityProgress) {
        // Use ability progress (0-1) to determine frame
        frameIndex = Math.min(
          Math.floor(abilityProgress * frameCount),
          frameCount - 1
        );
      } else {
        // Use continuous animation time for walk
        const animSpeed = 10;
        frameIndex = Math.floor(this.rc.animationTime * animSpeed) % frameCount;
      }
      const srcX = frameIndex * frameWidth;

      const scaledWidth = frameWidth * SPRITES.VEX.SCALE;
      const scaledHeight = frameHeight * SPRITES.VEX.SCALE;

      // Render and update dash afterimages
      const afterimages = this.dashAfterimages.get(entityId);
      if (afterimages && afterimages.length > 0) {
        const dashImage = imageCache.get(SPRITES.VEX.DASH);
        if (dashImage && dashImage.complete && dashImage.naturalWidth > 0) {
          const dashFrameWidth = dashImage.naturalWidth / SPRITES.VEX.DASH_FRAMES;
          const dashFrameHeight = dashImage.naturalHeight;
          const dashSrcX = SPRITES.VEX.DASH_HOLD_FRAME * dashFrameWidth;
          const dashScaledWidth = dashFrameWidth * SPRITES.VEX.SCALE;
          const dashScaledHeight = dashFrameHeight * SPRITES.VEX.SCALE;

          // Draw afterimages (oldest first, so newest is on top)
          for (const ai of afterimages) {
            ctx.save();
            // Translate to afterimage position relative to current entity position
            const relX = ai.x - snapshot.x;
            const relY = ai.y - snapshot.y;
            ctx.translate(relX, relY);
            ctx.globalAlpha = ai.alpha;

            // Apply horizontal flip based on afterimage facing
            if (!ai.facingRight) {
              ctx.scale(-1, 1);
            }

            // Add violet tint to afterimages
            ctx.drawImage(
              dashImage,
              dashSrcX,
              0,
              dashFrameWidth,
              dashFrameHeight,
              -dashScaledWidth / 2,
              -dashScaledHeight / 2,
              dashScaledWidth,
              dashScaledHeight
            );
            ctx.restore();

            // Fade afterimage
            ai.alpha -= 0.03;
          }

          // Remove faded afterimages
          this.dashAfterimages.set(
            entityId,
            afterimages.filter((ai) => ai.alpha > 0)
          );
        }
      }

      // Check if entity is hovered for outline highlighting
      const outlineColor = this.rc.getOutlineColor(snapshot.entityId);

      // Apply horizontal flip if facing left
      ctx.save();
      if (!state.facingRight) {
        ctx.scale(-1, 1);
      }

      // Apply stealth opacity (local player sees semi-transparent, others don't see at all)
      // Only apply after the disappear animation has finished
      const isCastingShroud = castingState.casting && castingState.abilityId === "vex_shroud";
      if (isStealthed && !isCastingShroud) {
        ctx.globalAlpha = 0.4;
      }

      // Draw violet aura particles when Ninja Mode is active
      if (hasNinjaMode) {
        this.drawNinjaModeAura(ctx, scaledWidth, scaledHeight);
      }

      drawSpriteFrame(
        ctx,
        image,
        srcX,
        frameWidth,
        frameHeight,
        SPRITES.VEX.SCALE,
        outlineColor,
      );

      ctx.restore();
      return true;
    }

    return false;
  }

  /**
   * Draw violet particle aura for Vex's Ninja Mode.
   */
  private drawNinjaModeAura(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const time = this.rc.animationTime;
    const particleCount = 6;
    const orbitRadius = Math.max(width, height) * 0.5;

    ctx.save();

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time * 3;
      const x = Math.cos(angle) * orbitRadius;
      const y = Math.sin(angle) * orbitRadius * 0.5; // Elliptical orbit

      // Violet gradient particle
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 4);
      gradient.addColorStop(0, "rgba(153, 51, 255, 0.9)"); // Bright violet center
      gradient.addColorStop(0.5, "rgba(136, 68, 204, 0.6)"); // Purple
      gradient.addColorStop(1, "rgba(68, 34, 102, 0)"); // Fade out

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add subtle glow around character
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, orbitRadius);
    glowGradient.addColorStop(0, "rgba(153, 51, 255, 0.15)");
    glowGradient.addColorStop(0.7, "rgba(136, 68, 204, 0.05)");
    glowGradient.addColorStop(1, "rgba(68, 34, 102, 0)");

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, orbitRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/**
 * Vex Shuriken - purple/dark star shape.
 */
function renderShurikenProjectile(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  angle: number,
): void {
  const radius = snapshot.radius || 10;

  ctx.save();
  ctx.rotate(angle);

  // Draw star/shuriken shape
  ctx.fillStyle = "#8844cc";
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const starAngle = (i * Math.PI) / 2;
    const outerX = Math.cos(starAngle) * radius;
    const outerY = Math.sin(starAngle) * radius;
    const innerAngle = starAngle + Math.PI / 4;
    const innerX = Math.cos(innerAngle) * (radius * 0.4);
    const innerY = Math.sin(innerAngle) * (radius * 0.4);
    if (i === 0) {
      ctx.moveTo(outerX, outerY);
    } else {
      ctx.lineTo(outerX, outerY);
    }
    ctx.lineTo(innerX, innerY);
  }
  ctx.closePath();
  ctx.fill();

  // Dark center
  ctx.fillStyle = "#442266";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Vex renderer entry.
 */
export const vexRenderer: ChampionRendererEntry = {
  images: [
    SPRITES.VEX.IDLE,
    SPRITES.VEX.WALK,
    SPRITES.VEX.ATTACK,
    SPRITES.VEX.DASH,
    SPRITES.VEX.SHURIKEN,
    SPRITES.VEX.DISAPPEAR,
  ],
  createBodyRenderer: (rc) => new VexBodyRenderer(rc),
  projectiles: {
    vex_shuriken: renderShurikenProjectile,
  },
  markVisuals: {
    vex_mark: {
      icon: "X",
      bgColor: "rgba(155, 89, 182, 0.8)", // Purple
      borderColor: "#9b59b6",
      iconColor: "#ffffff",
      showTimer: true,
      isDebuff: true,
    },
    vex_death_mark: {
      icon: "!",
      bgColor: "rgba(44, 62, 80, 0.9)", // Dark
      borderColor: "#e74c3c", // Red border (danger)
      iconColor: "#e74c3c",
      showTimer: true,
      isDebuff: true,
    },
    vex_stealth: {
      icon: "?",
      bgColor: "rgba(44, 62, 80, 0.8)",
      borderColor: "#2c3e50",
      iconColor: "#ffffff",
      showTimer: true,
      isBuff: true,
    },
  },
};
