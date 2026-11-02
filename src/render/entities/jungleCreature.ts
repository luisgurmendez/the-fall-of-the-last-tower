/**
 * Jungle creature renderer (EntityType.JUNGLE_CAMP).
 *
 * Each creature type has idle, run and attack sprite strips: square frames
 * side by side, facing right (mirrored when the creature faces left). The
 * monsters' strips are made by scripts/generate-sprites.ts; until a
 * machine has them, a creature falls back to the older recolored look.
 */

import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import {
  TEAM_COLORS,
  drawSpriteFrame,
  imageCache,
  getSpriteBounds,
} from "@/render/entities/shared";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
} from "@/render/overlays/healthBars";
import { getTrailHealth } from "@/render/overlays/damageTrail";
import { renderAggroIndicator } from "@/render/overlays/statusIndicators";
import { hitFlashFilter } from "@/render/hitFlash";
import { BitmapFont } from "@/render/BitmapFont";

/**
 * A creature's sprite strips. A strip's frames are as wide as it is tall,
 * so the frame count is its width over its height.
 */
interface SpriteSet {
  idle: string;
  run: string;
  attack: string;
}

/** Strips made by scripts/generate-sprites.ts */
function monsterSprites(creatureType: string): SpriteSet {
  const dir = `/assets/sprites/monsters/${creatureType}`;
  return { idle: `${dir}/idle.png`, run: `${dir}/run.png`, attack: `${dir}/attack.png` };
}

/** The older shared strips, recolored per creature */
const SPIDER: SpriteSet = {
  idle: "/assets/sprites/Spider/Spider_Idle.png",
  run: "/assets/sprites/Spider/Spider_Run.png",
  attack: "/assets/sprites/Spider/Spider_Attack.png",
};
const BEAR: SpriteSet = {
  idle: "/assets/sprites/Bear/Bear_Idle.png",
  run: "/assets/sprites/Bear/Bear_Run.png",
  attack: "/assets/sprites/Bear/Bear_Attack.png",
};

/**
 * How each creature type looks: its strips, drawn size (world units per
 * sprite pixel), a color filter, and for epic monsters a glowing aura and a
 * name plate.
 */
interface CreatureLook {
  sprites: SpriteSet;
  scale: number;
  filter?: string;
  aura?: string;
  name?: string;
  /** Drawn while `sprites` isn't available (not generated on this machine) */
  fallback?: CreatureLook;
}

const OLD_LOOKS: Record<string, CreatureLook> = {
  spider: { sprites: SPIDER, scale: 0.4 },
  wolf: { sprites: BEAR, scale: 0.3, filter: "grayscale(0.7) brightness(0.85)" },
  thornspitter: { sprites: BEAR, scale: 0.38, filter: "hue-rotate(70deg) saturate(1.3)" },
  blue_buff: { sprites: BEAR, scale: 0.55, filter: "hue-rotate(185deg) saturate(1.5)" },
  red_buff: { sprites: BEAR, scale: 0.55, filter: "hue-rotate(-25deg) saturate(2) brightness(0.95)" },
  dragon: { sprites: BEAR, scale: 0.85, filter: "hue-rotate(250deg) saturate(1.7)" },
  rootwyrm: { sprites: BEAR, scale: 0.85, filter: "hue-rotate(60deg) saturate(1.2) brightness(0.8)" },
};

const CREATURE_LOOKS: Record<string, CreatureLook> = {
  // Cinder Hound
  wolf: { sprites: monsterSprites("wolf"), scale: 1.1, fallback: OLD_LOOKS.wolf },
  // Gloom Crawler
  spider: { sprites: monsterSprites("spider"), scale: 1.25, fallback: OLD_LOOKS.spider },
  thornspitter: { sprites: monsterSprites("thornspitter"), scale: 1.4, fallback: OLD_LOOKS.thornspitter },
  blue_buff: {
    sprites: monsterSprites("blue_buff"),
    scale: 1.5,
    aura: "74, 163, 255",
    name: "Azure Warden",
    fallback: OLD_LOOKS.blue_buff,
  },
  red_buff: {
    sprites: monsterSprites("red_buff"),
    scale: 1.4,
    aura: "255, 85, 51",
    name: "Ember Brute",
    fallback: OLD_LOOKS.red_buff,
  },
  dragon: {
    sprites: monsterSprites("dragon"),
    scale: 1.7,
    aura: "255, 140, 26",
    name: "Dragon",
    fallback: OLD_LOOKS.dragon,
  },
  rootwyrm: {
    sprites: monsterSprites("rootwyrm"),
    scale: 1.7,
    aura: "156, 204, 101",
    name: "Rootwyrm",
    fallback: OLD_LOOKS.rootwyrm,
  },
};

const DEFAULT_LOOK: CreatureLook = { sprites: BEAR, scale: 0.4 };

/**
 * Jungle creature sprite strips to preload.
 */
export const JUNGLE_CREATURE_IMAGES = [
  ...new Set(
    [...Object.values(CREATURE_LOOKS), ...Object.values(OLD_LOOKS), DEFAULT_LOOK]
      .flatMap(look => [look.sprites.idle, look.sprites.run, look.sprites.attack]),
  ),
];

function isLoaded(image: HTMLImageElement | undefined): image is HTMLImageElement {
  return !!image && image.complete && image.naturalWidth > 0;
}

/**
 * The look to draw: the creature's own, or its fallback while its strips
 * aren't available.
 */
function resolveLook(creatureType: string): CreatureLook {
  const look = CREATURE_LOOKS[creatureType] ?? DEFAULT_LOOK;
  const idle = imageCache.get(look.sprites.idle);
  const failed = !!idle && idle.complete && idle.naturalWidth === 0;
  return failed && look.fallback ? { ...look.fallback, aura: look.aura, name: look.name } : look;
}

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
 * Render a jungle camp creature.
 */
export function renderJungleCamp(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  state: EntityRenderState,
  rc: EntityRenderContext,
): void {
  const creatureType = (snapshot as any).creatureType || "thornspitter";
  const look = resolveLook(creatureType);

  // Winding up a special attack (JungleSpecialAttacks): from 0 to 1 when it lands
  const windup = rc.stateManager.isEntityCastingAbility(snapshot.entityId).casting
    ? rc.stateManager.getAbilityAnimationProgress(snapshot.entityId)
    : 0;

  // Determine animation state
  const isAttacking = state.isAttacking || windup > 0;
  const isMoving =
    snapshot.targetX != null &&
    snapshot.targetY != null &&
    !isAttacking;

  const spriteSrc = isAttacking ? look.sprites.attack : isMoving ? look.sprites.run : look.sprites.idle;
  const image = imageCache.get(spriteSrc);
  const idleImage = imageCache.get(look.sprites.idle);

  // Where the art's top and sides are, for the aura, bars and name plate
  const bounds = isLoaded(idleImage)
    ? getSpriteBounds(idleImage)
    : { top: -40 / look.scale, halfWidth: 20 / look.scale };
  const artTop = bounds.top * look.scale;
  const artHalfWidth = bounds.halfWidth * look.scale;

  if (look.aura) {
    renderAura(ctx, look.aura, artHalfWidth * 1.3, rc.animationTime);
  }

  if (isLoaded(image)) {
    const frameSize = image.naturalHeight;
    const frameCount = Math.max(1, Math.round(image.naturalWidth / frameSize));
    let frameIndex: number;
    if (windup > 0) {
      // A wind-up holds the attack's gathering pose until the hit
      frameIndex = Math.floor(frameCount * 0.3);
    } else if (isAttacking) {
      // The attack plays once over the server's attack animation
      const progress = rc.stateManager.getAttackAnimationProgress(snapshot.entityId);
      frameIndex = Math.min(frameCount - 1, Math.floor(progress * frameCount));
    } else {
      frameIndex = Math.floor(rc.animationTime * (isMoving ? 10 : 6)) % frameCount;
    }

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
    const hitFlash = rc.stateManager.getHitFlash(snapshot.entityId);
    const filters = [
      look.filter,
      windup > 0 ? `brightness(${1 + windup * 0.7})` : undefined,
      hitFlash > 0 ? hitFlashFilter(hitFlash) : undefined,
      // Walking home after a reset: pale and see-through (it can't be hurt)
      snapshot.isReturning ? "saturate(0.35) brightness(1.3)" : undefined,
    ].filter(Boolean);
    if (snapshot.isReturning) ctx.globalAlpha *= 0.55;
    if (filters.length > 0) {
      ctx.filter = filters.join(" ");
    }

    drawSpriteFrame(ctx, image, frameIndex * frameSize, frameSize, frameSize, look.scale, outlineColor);

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
  const barY = artTop - 8;
  if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
    renderHealthBar(
      ctx,
      snapshot.health,
      snapshot.maxHealth,
      look.name ? 56 : 40,
      barY,
      HEALTH_BAR_COLORS.ENEMY,
      undefined,
      { trailHealth: getTrailHealth(snapshot.entityId, snapshot.health) },
    );
  }

  if (look.name) {
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillText(look.name, 1, barY - 6 + 1);
    ctx.fillStyle = `rgb(${look.aura})`;
    ctx.fillText(look.name, 0, barY - 6);
  }

  // Patience left (JungleCreatureSnapshot.patience): drains while nobody
  // lands a blow, blinking when it's about to give up
  const patience = snapshot.patience as number | null | undefined;
  if (patience != null && patience < 0.99) {
    renderPatienceBar(ctx, patience, look.name ? 56 : 40, barY + 5, rc.animationTime);
  }

  const iconY = barY - (look.name ? 20 : 15);
  if (snapshot.isReturning) {
    renderReturningIcon(ctx, iconY, rc.animationTime);
  } else if (snapshot.targetEntityId) {
    // Fighting: a red "!", or an amber "?" when it's about to give up (near
    // the end of its leash or out of patience)
    const givingUp = (snapshot.leash ?? 0) > 0.8 || (patience ?? 1) < 0.35;
    if (givingUp) renderGivingUpIndicator(ctx, iconY, rc.animationTime);
    else renderAggroIndicator(ctx, iconY, rc.animationTime);
  }
}

/** A thin amber bar under the health bar; red and blinking below a third */
function renderPatienceBar(ctx: CanvasRenderingContext2D, patience: number, width: number, y: number, time: number): void {
  const low = patience < 0.35;
  if (low && Math.sin(time * 16) < -0.3) return;
  ctx.save();
  ctx.filter = "none";
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(-width / 2 - 1, y - 1, width + 2, 4);
  ctx.fillStyle = low ? "#ff5a3c" : "#ffc440";
  ctx.fillRect(-width / 2, y, Math.round(width * patience), 2);
  ctx.restore();
}

/** An amber "?" bobbing over a monster about to give up */
function renderGivingUpIndicator(ctx: CanvasRenderingContext2D, y: number, time: number): void {
  ctx.save();
  ctx.filter = "none";
  ctx.translate(Math.sin(time * 20) * 1.5, y);
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#ffb020";
  ctx.fill();
  ctx.strokeStyle = "#8a4b00";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = BitmapFont.getFont(18);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", 0, -2);
  ctx.restore();
}

/** A pale arrow curling back over a monster walking home */
function renderReturningIcon(ctx: CanvasRenderingContext2D, y: number, time: number): void {
  ctx.save();
  ctx.filter = "none";
  ctx.translate(0, y + Math.sin(time * 4) * 2);
  ctx.strokeStyle = "rgba(220, 240, 255, 0.95)";
  ctx.fillStyle = "rgba(220, 240, 255, 0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 7, Math.PI * 1.15, Math.PI * 2.4);
  ctx.stroke();
  // The arrowhead, at the arc's start
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-3, -1);
  ctx.lineTo(-8, -7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
