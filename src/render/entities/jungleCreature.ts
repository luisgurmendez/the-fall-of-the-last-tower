/**
 * Jungle creature renderer (EntityType.JUNGLE_CAMP).
 */

import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import {
  TEAM_COLORS,
  drawSpriteFrame,
  imageCache,
} from "@/render/entities/shared";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
} from "@/render/overlays/healthBars";
import { renderAggroIndicator } from "@/render/overlays/statusIndicators";

/**
 * Sprite configuration.
 */
const SPRITES = {
  SPIDER: {
    IDLE: "/assets/sprites/Spider/Spider_Idle.png",
    RUN: "/assets/sprites/Spider/Spider_Run.png",
    ATTACK: "/assets/sprites/Spider/Spider_Attack.png",
    FRAME_WIDTH: 192,
    FRAME_HEIGHT: 192,
    IDLE_FRAMES: 8,
    RUN_FRAMES: 5,
    ATTACK_FRAMES: 8,
    SCALE: 0.4,
  },
  BEAR: {
    IDLE: "/assets/sprites/Bear/Bear_Idle.png",
    RUN: "/assets/sprites/Bear/Bear_Run.png",
    ATTACK: "/assets/sprites/Bear/Bear_Attack.png",
    FRAME_WIDTH: 256,
    FRAME_HEIGHT: 256,
    IDLE_FRAMES: 8,
    RUN_FRAMES: 5,
    ATTACK_FRAMES: 9,
    SCALE: 0.4,
  },
};

/**
 * Jungle creature sprite sheets to preload.
 */
export const JUNGLE_CREATURE_IMAGES = [
  // Creatures
  SPRITES.SPIDER.IDLE,
  SPRITES.SPIDER.RUN,
  SPRITES.SPIDER.ATTACK,
  SPRITES.BEAR.IDLE,
  SPRITES.BEAR.RUN,
  SPRITES.BEAR.ATTACK,
];

/**
 * Render a jungle camp creature.
 */
export function renderJungleCamp(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  state: EntityRenderState,
  rc: EntityRenderContext,
): void {
  const creatureType = (snapshot as any).creatureType || "gromp";

  // Use spider sprite for small creatures, bear for larger ones
  const isSpider = creatureType === "spider";
  const spriteConfig = isSpider ? SPRITES.SPIDER : SPRITES.BEAR;

  // Determine animation state
  const isAttacking = state.isAttacking;
  const isMoving =
    snapshot.targetX !== undefined &&
    snapshot.targetY !== undefined &&
    !isAttacking;

  let spriteSrc: string;
  let frameCount: number;

  if (isAttacking) {
    spriteSrc = isSpider ? SPRITES.SPIDER.ATTACK : SPRITES.BEAR.ATTACK;
    frameCount = spriteConfig.ATTACK_FRAMES;
  } else if (isMoving) {
    spriteSrc = isSpider ? SPRITES.SPIDER.RUN : SPRITES.BEAR.RUN;
    frameCount = spriteConfig.RUN_FRAMES;
  } else {
    spriteSrc = isSpider ? SPRITES.SPIDER.IDLE : SPRITES.BEAR.IDLE;
    frameCount = spriteConfig.IDLE_FRAMES;
  }

  const image = imageCache.get(spriteSrc);

  if (image && image.complete && image.naturalWidth > 0) {
    const animTime = isAttacking ? state.attackAnimTime : rc.animationTime;
    // Use appropriate animation speed: faster for attack, moderate for movement/idle
    const animSpeed = isAttacking ? 12 : isMoving ? 10 : 8;
    const frameIndex = Math.floor(animTime * animSpeed) % frameCount;
    const srcX = frameIndex * spriteConfig.FRAME_WIDTH;

    // Check if entity is hovered for outline highlighting
    const outlineColor = rc.getOutlineColor(snapshot.entityId);

    // Apply horizontal flip if facing left
    ctx.save();
    if (!state.facingRight) {
      ctx.scale(-1, 1);
    }

    drawSpriteFrame(
      ctx,
      image,
      srcX,
      spriteConfig.FRAME_WIDTH,
      spriteConfig.FRAME_HEIGHT,
      spriteConfig.SCALE,
      outlineColor,
    );

    ctx.restore();
  } else {
    // Fallback: gray circle
    ctx.fillStyle = TEAM_COLORS.NEUTRAL;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw health bar - red because jungle camps are hostile to all players
  if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
    renderHealthBar(
      ctx,
      snapshot.health,
      snapshot.maxHealth,
      40,
      -30,
      HEALTH_BAR_COLORS.ENEMY,
    );
  }

  // Draw aggro indicator (red "!") when creature has a target
  if (snapshot.targetEntityId) {
    renderAggroIndicator(ctx, -45, rc.animationTime);
  }
}
