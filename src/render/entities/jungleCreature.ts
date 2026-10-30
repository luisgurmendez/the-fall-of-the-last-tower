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
 * How each creature type looks: which sprite, its size, a color filter, and
 * for epic monsters a glowing aura and a name plate.
 */
interface CreatureLook {
  sprite: "SPIDER" | "BEAR";
  scale: number;
  filter?: string;
  aura?: string;
  name?: string;
}

const CREATURE_LOOKS: Record<string, CreatureLook> = {
  spider: { sprite: "SPIDER", scale: 0.4 },
  wolf: { sprite: "BEAR", scale: 0.3, filter: "grayscale(0.7) brightness(0.85)" },
  gromp: { sprite: "BEAR", scale: 0.38, filter: "hue-rotate(70deg) saturate(1.3)" },
  blue_buff: {
    sprite: "BEAR",
    scale: 0.55,
    filter: "hue-rotate(185deg) saturate(1.5)",
    aura: "74, 163, 255",
    name: "Azure Warden",
  },
  red_buff: {
    sprite: "BEAR",
    scale: 0.55,
    filter: "hue-rotate(-25deg) saturate(2) brightness(0.95)",
    aura: "255, 85, 51",
    name: "Ember Brute",
  },
  dragon: {
    sprite: "BEAR",
    scale: 0.85,
    filter: "hue-rotate(250deg) saturate(1.7)",
    aura: "255, 140, 26",
    name: "Dragon",
  },
};

const DEFAULT_LOOK: CreatureLook = { sprite: "BEAR", scale: 0.4 };

/**
 * Pulsing glow under epic monsters.
 */
function renderAura(ctx: CanvasRenderingContext2D, rgb: string, radius: number, time: number): void {
  const pulse = 0.75 + Math.sin(time * 3) * 0.25;
  const glow = ctx.createRadialGradient(0, 8, radius * 0.2, 0, 8, radius);
  glow.addColorStop(0, `rgba(${rgb}, ${0.45 * pulse})`);
  glow.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, 8, radius, radius * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Motes drifting up around the monster
  for (let i = 0; i < 5; i++) {
    const phase = (time * 0.6 + i / 5) % 1;
    const angle = (i / 5) * Math.PI * 2 + time * 0.5;
    ctx.fillStyle = `rgba(${rgb}, ${0.8 * (1 - phase)})`;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * radius * 0.6, 8 - phase * radius * 0.9, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

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
  const look = CREATURE_LOOKS[creatureType] ?? DEFAULT_LOOK;
  const spriteConfig = SPRITES[look.sprite];
  // Bars and markers sit above the sprite, which grows with its scale
  const sizeFactor = look.scale / spriteConfig.SCALE;

  if (look.aura) {
    renderAura(ctx, look.aura, 45 * sizeFactor, rc.animationTime);
  }

  // Winding up a special attack (JungleSpecialAttacks): from 0 to 1 when it lands
  const windup = rc.stateManager.isEntityCastingAbility(snapshot.entityId).casting
    ? rc.stateManager.getAbilityAnimationProgress(snapshot.entityId)
    : 0;

  // Determine animation state
  const isAttacking = state.isAttacking || windup > 0;
  const isMoving =
    snapshot.targetX !== undefined &&
    snapshot.targetY !== undefined &&
    !isAttacking;

  let spriteSrc: string;
  let frameCount: number;

  if (isAttacking) {
    spriteSrc = spriteConfig.ATTACK;
    frameCount = spriteConfig.ATTACK_FRAMES;
  } else if (isMoving) {
    spriteSrc = spriteConfig.RUN;
    frameCount = spriteConfig.RUN_FRAMES;
  } else {
    spriteSrc = spriteConfig.IDLE;
    frameCount = spriteConfig.IDLE_FRAMES;
  }

  const image = imageCache.get(spriteSrc);

  if (image && image.complete && image.naturalWidth > 0) {
    const animTime = isAttacking ? state.attackAnimTime : rc.animationTime;
    // Use appropriate animation speed: faster for attack, moderate for movement/idle
    const animSpeed = isAttacking ? 12 : isMoving ? 10 : 8;
    // A wind-up holds the first attack frame (rearing up) until the hit
    const frameIndex = windup > 0 ? 0 : Math.floor(animTime * animSpeed) % frameCount;
    const srcX = frameIndex * spriteConfig.FRAME_WIDTH;

    // Check if entity is hovered for outline highlighting
    const outlineColor = rc.getOutlineColor(snapshot.entityId);

    // Apply horizontal flip if facing left
    ctx.save();
    if (windup > 0) {
      // Tremble harder, swell and glow brighter as the attack is about to land
      ctx.translate(Math.sin(rc.animationTime * 70) * windup * 3, 0);
      ctx.scale(1 + windup * 0.12, 1 + windup * 0.12);
    }
    if (!state.facingRight) {
      ctx.scale(-1, 1);
    }
    const filters = [look.filter, windup > 0 ? `brightness(${1 + windup * 0.7})` : undefined].filter(Boolean);
    if (filters.length > 0) {
      ctx.filter = filters.join(" ");
    }

    drawSpriteFrame(
      ctx,
      image,
      srcX,
      spriteConfig.FRAME_WIDTH,
      spriteConfig.FRAME_HEIGHT,
      look.scale,
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
      look.name ? 56 : 40,
      -30 * sizeFactor,
      HEALTH_BAR_COLORS.ENEMY,
    );
  }

  if (look.name) {
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillText(look.name, 1, -36 * sizeFactor + 1);
    ctx.fillStyle = `rgb(${look.aura})`;
    ctx.fillText(look.name, 0, -36 * sizeFactor);
  }

  // Draw aggro indicator (red "!") when creature has a target
  if (snapshot.targetEntityId) {
    renderAggroIndicator(ctx, (look.name ? -50 : -45) * sizeFactor, rc.animationTime);
  }
}
