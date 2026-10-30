/**
 * Lane minion renderer (melee warriors and caster archers).
 */

import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import { TEAM_COLORS, imageCache } from "@/render/entities/shared";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
} from "@/render/overlays/healthBars";
import {
  getOutlinedSprite,
  getOutlinePadding,
} from "@/render/OutlinedSpriteCache";

/**
 * Sprite configuration.
 */
const SPRITES = {
  WARRIOR: {
    IDLE_BLUE: "/assets/sprites/units/Warrior_Blue/Warrior_Idle.png",
    IDLE_RED: "/assets/sprites/units/Warrior_Red/Warrior_Idle.png",
    RUN_BLUE: "/assets/sprites/units/Warrior_Blue/Warrior_Run.png",
    RUN_RED: "/assets/sprites/units/Warrior_Red/Warrior_Run.png",
    ATTACK_BLUE: "/assets/sprites/units/Warrior_Blue/Warrior_Attack1.png",
    ATTACK_RED: "/assets/sprites/units/Warrior_Red/Warrior_Attack1.png",
    FRAME_WIDTH: 192,
    FRAME_HEIGHT: 192,
    IDLE_FRAMES: 8,
    RUN_FRAMES: 6,
    ATTACK_FRAMES: 4,
    SCALE: 0.35,
  },
  ARCHER: {
    IDLE_BLUE: "/assets/sprites/units/Archer_Blue/Archer_Idle.png",
    IDLE_RED: "/assets/sprites/units/Archer_Red/Archer_Idle.png",
    RUN_BLUE: "/assets/sprites/units/Archer_Blue/Archer_Run.png",
    RUN_RED: "/assets/sprites/units/Archer_Red/Archer_Run.png",
    ATTACK_BLUE: "/assets/sprites/units/Archer_Blue/Archer_Shoot.png",
    ATTACK_RED: "/assets/sprites/units/Archer_Red/Archer_Shoot.png",
    FRAME_WIDTH: 192,
    FRAME_HEIGHT: 192,
    IDLE_FRAMES: 6,
    RUN_FRAMES: 4,
    ATTACK_FRAMES: 8,
    SCALE: 0.35,
  },
};

/**
 * Minion sprite sheets to preload.
 */
export const MINION_IMAGES = [
  // Warriors
  SPRITES.WARRIOR.IDLE_BLUE,
  SPRITES.WARRIOR.IDLE_RED,
  SPRITES.WARRIOR.RUN_BLUE,
  SPRITES.WARRIOR.RUN_RED,
  SPRITES.WARRIOR.ATTACK_BLUE,
  SPRITES.WARRIOR.ATTACK_RED,
  // Archers
  SPRITES.ARCHER.IDLE_BLUE,
  SPRITES.ARCHER.IDLE_RED,
  SPRITES.ARCHER.RUN_BLUE,
  SPRITES.ARCHER.RUN_RED,
  SPRITES.ARCHER.ATTACK_BLUE,
  SPRITES.ARCHER.ATTACK_RED,
];

/**
 * Render a minion using sprites with proper animations and direction.
 */
export function renderMinion(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  state: EntityRenderState,
  rc: EntityRenderContext,
): void {
  const minionType = snapshot.minionType || "melee";
  const isWarrior = minionType === "melee";
  const spriteConfig = isWarrior ? SPRITES.WARRIOR : SPRITES.ARCHER;

  // Determine animation state: attacking, moving, or idle
  const isAttacking = state.isAttacking;
  const isMoving =
    snapshot.targetX !== undefined &&
    snapshot.targetY !== undefined &&
    !isAttacking;

  // Select the correct sprite based on state and side
  let spriteSrc: string;
  let frameCount: number;
  let animSpeed: number;

  if (isAttacking) {
    // Attack animation
    spriteSrc =
      side === 0
        ? isWarrior
          ? SPRITES.WARRIOR.ATTACK_BLUE
          : SPRITES.ARCHER.ATTACK_BLUE
        : isWarrior
          ? SPRITES.WARRIOR.ATTACK_RED
          : SPRITES.ARCHER.ATTACK_RED;
    frameCount = isWarrior
      ? SPRITES.WARRIOR.ATTACK_FRAMES
      : SPRITES.ARCHER.ATTACK_FRAMES;
    animSpeed = 12; // Fast attack animation
  } else if (isMoving) {
    // Run animation
    spriteSrc =
      side === 0
        ? isWarrior
          ? SPRITES.WARRIOR.RUN_BLUE
          : SPRITES.ARCHER.RUN_BLUE
        : isWarrior
          ? SPRITES.WARRIOR.RUN_RED
          : SPRITES.ARCHER.RUN_RED;
    frameCount = isWarrior
      ? SPRITES.WARRIOR.RUN_FRAMES
      : SPRITES.ARCHER.RUN_FRAMES;
    animSpeed = 10; // Smooth run animation
  } else {
    // Idle animation
    spriteSrc =
      side === 0
        ? isWarrior
          ? SPRITES.WARRIOR.IDLE_BLUE
          : SPRITES.ARCHER.IDLE_BLUE
        : isWarrior
          ? SPRITES.WARRIOR.IDLE_RED
          : SPRITES.ARCHER.IDLE_RED;
    frameCount = isWarrior
      ? SPRITES.WARRIOR.IDLE_FRAMES
      : SPRITES.ARCHER.IDLE_FRAMES;
    animSpeed = 8; // Relaxed idle animation
  }

  const image = imageCache.get(spriteSrc);

  if (image && image.complete && image.naturalWidth > 0) {
    // Calculate animation frame
    const animTime = isAttacking ? state.attackAnimTime : rc.animationTime;
    const frameIndex = Math.floor(animTime * animSpeed) % frameCount;
    const srcX = frameIndex * spriteConfig.FRAME_WIDTH;

    const scaledWidth = spriteConfig.FRAME_WIDTH * spriteConfig.SCALE;
    const scaledHeight = spriteConfig.FRAME_HEIGHT * spriteConfig.SCALE;

    // Check if entity is hovered for outline highlighting
    const outlineColor = rc.getOutlineColor(snapshot.entityId);

    // Apply horizontal flip if facing left
    ctx.save();
    if (!state.facingRight) {
      ctx.scale(-1, 1);
    }

    if (outlineColor) {
      // Draw outlined sprite when hovered
      const outlinedSprite = getOutlinedSprite(
        image,
        srcX,
        0,
        spriteConfig.FRAME_WIDTH,
        spriteConfig.FRAME_HEIGHT,
        outlineColor
      );

      if (outlinedSprite) {
        // Outlined sprite has padding, so adjust dimensions
        const padding = getOutlinePadding();
        const outlinedWidth = (spriteConfig.FRAME_WIDTH + padding * 2) * spriteConfig.SCALE;
        const outlinedHeight = (spriteConfig.FRAME_HEIGHT + padding * 2) * spriteConfig.SCALE;

        ctx.drawImage(
          outlinedSprite,
          0,
          0,
          outlinedSprite.width,
          outlinedSprite.height,
          -outlinedWidth / 2,
          -outlinedHeight / 2,
          outlinedWidth,
          outlinedHeight,
        );
      } else {
        // Fallback to normal sprite if outline generation failed
        ctx.drawImage(
          image,
          srcX,
          0,
          spriteConfig.FRAME_WIDTH,
          spriteConfig.FRAME_HEIGHT,
          -scaledWidth / 2,
          -scaledHeight / 2,
          scaledWidth,
          scaledHeight,
        );
      }
    } else {
      // Draw normal sprite when not hovered
      ctx.drawImage(
        image,
        srcX,
        0,
        spriteConfig.FRAME_WIDTH,
        spriteConfig.FRAME_HEIGHT,
        -scaledWidth / 2,
        -scaledHeight / 2,
        scaledWidth,
        scaledHeight,
      );
    }

    ctx.restore();
  } else {
    // Fallback: draw colored circle
    const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw health bar - blue for ally minions, red for enemy minions
  if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
    const healthBarColor =
      side === rc.localSide
        ? HEALTH_BAR_COLORS.ALLY // Blue for allied minions
        : HEALTH_BAR_COLORS.ENEMY; // Red for enemy minions
    renderHealthBar(
      ctx,
      snapshot.health,
      snapshot.maxHealth,
      30,
      -25,
      healthBarColor,
    );
  }
}
