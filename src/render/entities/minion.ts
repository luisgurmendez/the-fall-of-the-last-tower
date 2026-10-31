/**
 * Lane minion renderer: the generated footman, acolyte and gunner
 * (scripts/generate-sprites.ts; drawn in blue, recolored for the red team),
 * or the original warriors, archers and siege cart while those aren't there.
 */

import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import {
  TEAM_COLORS,
  drawGroundShadow,
  drawSpriteFrame,
  getSpriteFeet,
  imageCache,
} from "@/render/entities/shared";
import { getRedVariant } from "@/render/entities/teamColors";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
} from "@/render/overlays/healthBars";
import { getTrailHealth } from "@/render/overlays/damageTrail";

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

/** Generated minion strips: square frames side by side, facing right, in blue */
interface MinionStrips {
  idle: string;
  walk: string;
  attack: string;
  /** World units per sprite pixel */
  scale: number;
}

function minionStrips(minionType: string, scale: number): MinionStrips {
  const dir = `/assets/sprites/minions/${minionType}`;
  return { idle: `${dir}/idle.png`, walk: `${dir}/walk.png`, attack: `${dir}/attack.png`, scale };
}

/**
 * Minions stand a little over half a champion's height (champions are
 * drawn about 68 tall), so they read as small units next to them, like the
 * classic MOBA's. The siege minion and its cart are a bit bigger.
 */
const MINION_STRIPS: Record<string, MinionStrips> = {
  melee: minionStrips("melee", 0.69),
  caster: minionStrips("caster", 0.69),
  siege: minionStrips("siege", 0.78),
  // While an inhibitor is down: the melee minion's art, much bigger
  super: minionStrips("melee", 0.97),
};

/** Walk cycle speed, matched to their pace (88 units a second) so their feet don't slide */
const MINION_WALK_FPS = 8;

/** Minions' health bars: a thin line just over the head, much slimmer than a champion's */
const MINION_BAR = {
  width: 24,
  siegeWidth: 30,
  height: 3,
  y: -24,
  siegeY: -28,
};

/**
 * Minion sprite sheets to preload.
 */
export const MINION_IMAGES = [
  ...Object.values(MINION_STRIPS).flatMap((strips) => [strips.idle, strips.walk, strips.attack]),
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
  // Siege and super minions are bigger: a wider bar, a bit higher
  const isSiege = minionType === "siege" || minionType === "super";

  // Generated art when it's there, else the original sprites
  const strips = MINION_STRIPS[minionType];
  if (!strips || !drawMinionStrips(ctx, snapshot, side, state, rc, strips)) {
    drawLegacyMinion(ctx, snapshot, side, state, rc, minionType);
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
      isSiege ? MINION_BAR.siegeWidth : MINION_BAR.width,
      isSiege ? MINION_BAR.siegeY : MINION_BAR.y,
      healthBarColor,
      undefined,
      { trailHealth: getTrailHealth(snapshot.entityId, snapshot.health), height: MINION_BAR.height },
    );
  }
}

/**
 * A small wooden cart with a cannon, drawn under a siege minion.
 */
function renderSiegeCart(ctx: CanvasRenderingContext2D, side: number, facingRight: boolean): void {
  ctx.save();
  ctx.translate(0, 10);
  if (!facingRight) ctx.scale(-1, 1);

  // Barrel
  ctx.fillStyle = "#2f2f2f";
  ctx.fillRect(2, -9, 16, 6);
  ctx.fillStyle = "#4a4a4a";
  ctx.fillRect(16, -10, 4, 8);

  // Cart body in team color trim
  ctx.fillStyle = "#6d4c2f";
  ctx.fillRect(-14, -4, 26, 8);
  ctx.fillStyle = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;
  ctx.fillRect(-14, -4, 26, 2);

  // Wheels
  ctx.fillStyle = "#3e2a17";
  for (const wx of [-8, 7]) {
    ctx.beginPath();
    ctx.arc(wx, 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw a minion from its generated strips (the red team's recolored), with
 * a shadow under its feet. False if the art isn't loaded.
 */
function drawMinionStrips(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  state: EntityRenderState,
  rc: EntityRenderContext,
  strips: MinionStrips,
): boolean {
  const isMoving = snapshot.targetX != null && snapshot.targetY != null && !state.isAttacking;
  const src = state.isAttacking ? strips.attack : isMoving ? strips.walk : strips.idle;
  const blue = imageCache.get(src);
  if (!blue || !blue.complete || blue.naturalWidth === 0) return false;
  const image = side === 0 ? blue : getRedVariant(blue);
  if (!image) return false;

  const feet = getSpriteFeet(strips.idle, strips.scale);
  if (feet) drawGroundShadow(ctx, feet.y, feet.halfWidth);

  const frameSize = image.naturalHeight;
  const frameCount = Math.max(1, Math.round(image.naturalWidth / frameSize));
  const frameIndex = state.isAttacking
    ? Math.min(frameCount - 1, Math.floor(rc.stateManager.getAttackAnimationProgress(snapshot.entityId) * frameCount))
    : Math.floor(rc.animationTime * (isMoving ? MINION_WALK_FPS : 6)) % frameCount;

  ctx.save();
  if (!state.facingRight) ctx.scale(-1, 1);
  drawSpriteFrame(ctx, image, frameIndex * frameSize, frameSize, frameSize, strips.scale, rc.getOutlineColor(snapshot.entityId));
  ctx.restore();
  return true;
}

/**
 * The original minion sprites (warriors and archers, siege archers on a cart).
 */
function drawLegacyMinion(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  state: EntityRenderState,
  rc: EntityRenderContext,
  minionType: string,
): void {
  const isWarrior = minionType === "melee";
  const isSiege = minionType === "siege";
  const spriteConfig = isWarrior ? SPRITES.WARRIOR : SPRITES.ARCHER;
  // Siege minions are archers manning a cannon: bigger, with a cart under them
  const spriteScale = isSiege ? spriteConfig.SCALE * 1.35 : spriteConfig.SCALE;

  if (isSiege) {
    renderSiegeCart(ctx, side, state.facingRight);
  }

  // Determine animation state: attacking, moving, or idle
  const isAttacking = state.isAttacking;
  const isMoving =
    snapshot.targetX != null &&
    snapshot.targetY != null &&
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
      spriteScale,
      outlineColor,
    );

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
}
