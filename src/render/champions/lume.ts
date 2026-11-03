/**
 * Lume: sprite-sheet body with Q/E/R ability animations, the Prismatic Beam
 * (E) between her and her orb while it lasts, and the light photon
 * auto-attack projectile. Lume's Light Orbs are their own entity type
 * (src/render/entities/lightOrb.ts).
 */

import { EntityType } from "@siege/shared";
import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import { drawSpriteFrame, getSpriteFeet, getSpriteTop, imageCache } from "@/render/entities/shared";
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
    SCALE: 1.12,
  },
};

/**
 * Draws Lume from sprite sheets.
 */
class LumeBodyRenderer implements ChampionBodyRenderer {
  getFeet(): { y: number; halfWidth: number } | null {
    return getSpriteFeet(SPRITES.LUME.IDLE, SPRITES.LUME.SCALE);
  }

  getTop(): number | null {
    return getSpriteTop(SPRITES.LUME.IDLE, SPRITES.LUME.SCALE);
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

    // The Prismatic Beam to the orb, under her
    if (snapshot.activeEffects?.some((effect: { definitionId: string }) => effect.definitionId === "lume_prism")) {
      this.renderPrismaticBeam(ctx, entityId);
    }

    // Check if casting an ability
    const castingState = this.rc.stateManager.isEntityCastingAbility(entityId);
    const abilityProgress = castingState.casting
      ? this.rc.stateManager.getAbilityAnimationProgress(entityId)
      : 0;

    // Select sprite based on animation state (priority: ability > walk > idle)
    let spriteSrc: string;
    let frameCount: number;
    let useAbilityProgress = false;
    let fixedFrameIndex: number | null = null;

    if (castingState.casting && castingState.abilityId) {
      // Ability animation - check which ability
      const abilityId = castingState.abilityId;
      if (abilityId === "lume_q") {
        spriteSrc = SPRITES.LUME.Q;
        frameCount = SPRITES.LUME.Q_FRAMES;
        useAbilityProgress = true;
      } else if (abilityId === "lume_e") {
        spriteSrc = SPRITES.LUME.E;
        frameCount = SPRITES.LUME.E_FRAMES;
        useAbilityProgress = true;
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
        // Fixed frame (the attack's)
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

  /**
   * The Prismatic Beam from Lume to her orb, wherever both are: a soft glow,
   * a band of light whose prism colors drift along it, a white core and
   * sparkles running out to the orb. Drawn in her space (her position is
   * the origin).
   */
  private renderPrismaticBeam(ctx: CanvasRenderingContext2D, entityId: string): void {
    const lume = this.rc.stateManager.getEntity(entityId);
    const orb = [...this.rc.stateManager.getEntities()].find((entity) =>
      entity.snapshot.entityType === EntityType.LIGHT_ORB && (entity.snapshot as { ownerId?: string }).ownerId === entityId);
    if (!lume || !orb) return;

    const dx = orb.position.x - lume.position.x;
    const dy = orb.position.y - lume.position.y;
    const length = Math.hypot(dx, dy);
    if (length < 4) return;
    const time = this.rc.animationTime;
    const from = { x: 0, y: BEAM_HEIGHT };
    const to = { x: dx, y: dy + BEAM_HEIGHT };

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    // The colors drift toward the orb
    const prism = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    for (let i = 0; i <= 4; i++) {
      const hue = (time * 90 + i * 70) % 360;
      prism.addColorStop(i / 4, `hsla(${hue}, 100%, 72%, 0.75)`);
    }
    const stroke = (style: string | CanvasGradient, width: number, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    };
    const pulse = 0.85 + 0.15 * Math.sin(time * 9);
    stroke("rgba(255, 243, 176, 1)", 22, 0.18 * pulse);
    stroke(prism, 10, 0.8 * pulse);
    stroke("#ffffff", 3, 0.95);

    // Sparkles running out to the orb
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    const sparkles = Math.max(3, Math.floor(length / 40));
    for (let i = 0; i < sparkles; i++) {
      const along = (i / sparkles + time * 0.8) % 1;
      const wobble = Math.sin(time * 12 + i * 2.3) * 4;
      ctx.fillRect(from.x + dx * along - dy / length * wobble - 1.5, from.y + dy * along + dx / length * wobble - 1.5, 3, 3);
    }
    ctx.restore();
  }
}

/** How high above Lume's feet the beam runs (her hands, the orb's float) */
const BEAM_HEIGHT = -22;

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
  markVisuals: {
    // The beam itself shows it
    lume_prism: { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true },
  },
};
