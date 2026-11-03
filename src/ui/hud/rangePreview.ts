/**
 * Range preview shown while an ability box is hovered, or while an ability
 * charges (Vile's arrows, as far as they reach so far): the shapes
 * abilityPreview gives (its cast range, the area, band, cone or landing spot
 * it will hit), drawn in screen space, before the HUD panels.
 */

import { Dimensions } from '@/core/canvas';
import type GameContext from '@/core/gameContext';
import type { InputManager } from '@/core/input/InputManager';
import RenderUtils from '@/render/utils';
import type { AbilitySlot } from '@siege/shared';
import type { HUDChampionData } from '@/ui/hud/types';
import { abilityPreview, type PreviewShape } from '@/ui/hud/abilityPreview';
import Vector from '@/physics/vector';

const COLORS = {
  range: 'rgba(0, 206, 209, 0.6)',
  rangeLabel: '#00CED1',
  areaFill: 'rgba(255, 165, 0, 0.2)',
  area: 'rgba(255, 165, 0, 0.8)',
  areaLabel: '#FFA500',
  /** Dashes, then projectiles and lines */
  dash: 'rgba(255, 200, 50',
  band: 'rgba(255, 100, 100',
};

/** Draw ability range circles around champion (in screen space) */
export function drawAbilityRangeCircles(
  ctx: CanvasRenderingContext2D,
  gctx: GameContext,
  champion: HUDChampionData,
  slot: AbilitySlot,
  inputManager: InputManager,
  charge?: number
): void {
  const targetDesc = champion.getAbility(slot)?.getTargetDescription?.();
  if (!targetDesc) return;

  const camera = gctx.camera;
  const toScreen = (point: Vector) => new Vector(
    (point.x - camera.position.x) * camera.zoom + Dimensions.w / 2,
    (point.y - camera.position.y) * camera.zoom + Dimensions.h / 2,
  );
  const cursor = inputManager.getMouseWorldPosition(camera.position, camera.zoom);
  const shapes = abilityPreview(targetDesc, champion.getPosition(), cursor, champion.getOrbPosition?.() ?? null, charge);

  ctx.save();
  ctx.lineWidth = 2;
  for (const shape of shapes) drawShape(ctx, shape, toScreen, camera.zoom);
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: PreviewShape, toScreen: (point: Vector) => Vector, zoom: number): void {
  switch (shape.kind) {
    case 'range': {
      const center = toScreen(shape.center);
      const radius = shape.radius * zoom;
      ctx.strokeStyle = COLORS.range;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      RenderUtils.renderBitmapText(ctx, `Range: ${shape.radius}`, center.x, center.y - radius - 20, { color: COLORS.rangeLabel, size: 20, centered: true });
      return;
    }
    case 'area': {
      const center = toScreen(shape.center);
      const radius = shape.radius * zoom;
      ctx.fillStyle = COLORS.areaFill;
      ctx.strokeStyle = COLORS.area;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      RenderUtils.renderBitmapText(ctx, `AoE: ${shape.radius}`, center.x, center.y - radius - 15, { color: COLORS.areaLabel, size: 20, centered: true });
      return;
    }
    case 'cone': {
      const center = toScreen(shape.center);
      const angle = Math.atan2(shape.direction.y, shape.direction.x);
      ctx.fillStyle = 'rgba(255, 165, 0, 0.25)';
      ctx.strokeStyle = COLORS.area;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.arc(center.x, center.y, shape.radius * zoom, angle - shape.angle / 2, angle + shape.angle / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    case 'band': {
      const from = toScreen(shape.from);
      const width = shape.width * zoom;
      const color = shape.dash ? COLORS.dash : COLORS.band;
      ctx.save();
      ctx.translate(from.x, from.y);
      ctx.rotate(Math.atan2(shape.direction.y, shape.direction.x));
      ctx.fillStyle = color + ', 0.2)';
      ctx.strokeStyle = color + ', 0.8)';
      ctx.fillRect(0, -width / 2, shape.length * zoom, width);
      ctx.strokeRect(0, -width / 2, shape.length * zoom, width);
      ctx.restore();
      return;
    }
    case 'landing': {
      const from = toScreen(shape.from);
      const at = toScreen(shape.at);
      ctx.strokeStyle = COLORS.dash + ', 0.8)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(at.x, at.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.dash + ', 0.25)';
      ctx.beginPath();
      ctx.arc(at.x, at.y, 22 * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    }
  }
}
