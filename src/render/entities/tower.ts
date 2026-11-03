/**
 * Tower renderer.
 */

import type { EntityRenderContext } from "@/render/entities/types";
import {
  TEAM_COLORS,
  drawBuildingSprite,
  imageCache,
  renderProtectionDome,
} from "@/render/entities/shared";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
} from "@/render/overlays/healthBars";
import { getTrailHealth } from "@/render/overlays/damageTrail";

/**
 * Sprite configuration.
 */
const SPRITES = {
  TOWER: {
    BLUE: "/assets/sprites/Buildings/Tower_Blue.png",
    RED: "/assets/sprites/Buildings/Tower_Red.png",
    WIDTH: 128,
    HEIGHT: 256,
    /** Where the art starts, in sprite pixels from the top */
    ART_TOP: 46,
    /**
     * How far below the position the image's bottom edge is: the middle of
     * the tower's footprint (sprite row ~199, where its base meets the
     * ground) sits on the position, so its range (measured from the
     * position, edge to edge) is centered on the tower as drawn
     */
    BASE_OFFSET: 60,
    /** Close to three champions tall, like the classic MOBA's towers */
    SCALE: 1.05,
  },
};

/**
 * Tower sprites to preload.
 */
export const TOWER_IMAGES = [SPRITES.TOWER.BLUE, SPRITES.TOWER.RED];

/**
 * Render a tower using sprite images.
 */
export function renderTower(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  rc: EntityRenderContext,
): void {
  const spriteSrc = side === 0 ? SPRITES.TOWER.BLUE : SPRITES.TOWER.RED;
  const image = imageCache.get(spriteSrc);

  if (image && image.complete && image.naturalWidth > 0) {
    // Check if tower is hovered for outline highlighting
    const outlineColor = rc.getOutlineColor(snapshot.entityId);

    drawBuildingSprite(
      ctx,
      image,
      SPRITES.TOWER.WIDTH,
      SPRITES.TOWER.HEIGHT,
      SPRITES.TOWER.SCALE,
      SPRITES.TOWER.BASE_OFFSET,
      outlineColor,
    );
  } else {
    // Fallback: draw colored rectangle
    const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;
    ctx.fillStyle = color;
    ctx.fillRect(-25, -60, 50, 80);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(-25, -60, 50, 80);
  }

  if (snapshot.isProtected) {
    renderProtectionDome(ctx, 80, -25, rc.animationTime);
  }

  renderTargetLockOnLocalPlayer(ctx, snapshot, side, rc);

  // Draw health bar - blue for ally towers, red for enemy towers
  if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
    const barY = towerArtTop() - 14;
    const healthBarColor =
      side === rc.localSide
        ? HEALTH_BAR_COLORS.ALLY // Blue for allied towers
        : HEALTH_BAR_COLORS.ENEMY; // Red for enemy towers
    renderHealthBar(
      ctx,
      snapshot.health,
      snapshot.maxHealth,
      60,
      barY,
      healthBarColor,
      undefined,
      { trailHealth: getTrailHealth(snapshot.entityId, snapshot.health) },
    );
  }
}

/** Height of the top of the tower's art, above its position (negative) */
function towerArtTop(): number {
  const { HEIGHT, ART_TOP, SCALE, BASE_OFFSET } = SPRITES.TOWER;
  return BASE_OFFSET - (HEIGHT - ART_TOP) * SCALE;
}

/**
 * Danger cue: a pulsing line from an enemy tower to the local champion while
 * the tower is shooting at them.
 */
function renderTargetLockOnLocalPlayer(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  rc: EntityRenderContext,
): void {
  if (side === rc.localSide || !snapshot.targetEntityId) return;
  if (snapshot.targetEntityId !== rc.stateManager.getLocalEntityId()) return;

  const tower = rc.stateManager.getEntity(snapshot.entityId);
  const target = rc.stateManager.getLocalPlayerEntity();
  if (!tower || !target) return;

  // The tower is drawn at its own position; the line ends at the champion
  const dx = target.position.x - tower.position.x;
  const dy = target.position.y - tower.position.y;
  const startY = towerArtTop() + 30;
  const pulse = 0.55 + Math.sin(rc.animationTime * 10) * 0.25;

  ctx.save();
  ctx.strokeStyle = `rgba(255, 60, 40, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.lineDashOffset = -rc.animationTime * 40;
  ctx.beginPath();
  ctx.moveTo(0, startY);
  ctx.lineTo(dx, dy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Reticle on the champion
  ctx.strokeStyle = `rgba(255, 60, 40, ${pulse + 0.2})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dx, dy, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
