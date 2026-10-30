/**
 * Range preview shown while an ability box is hovered: the cast range circle
 * around the champion, plus the AoE circle, cone or skillshot/dash rectangle
 * toward the cursor. Drawn in screen space, before the HUD panels.
 */

import { Dimensions } from '@/core/canvas';
import type GameContext from '@/core/gameContext';
import type { InputManager } from '@/core/input/InputManager';
import RenderUtils from '@/render/utils';
import type { AbilitySlot } from '@siege/shared';
import type { HUDChampionData } from '@/ui/hud/types';

/** Draw ability range circles around champion (in screen space) */
export function drawAbilityRangeCircles(
  ctx: CanvasRenderingContext2D,
  gctx: GameContext,
  champion: HUDChampionData,
  slot: AbilitySlot,
  inputManager: InputManager
): void {
  const ability = champion.getAbility(slot);
  if (!ability) return;

  // Get target description for range info
  const targetDesc = ability.getTargetDescription?.();
  if (!targetDesc) return;

  const championPos = champion.getPosition();
  const camera = gctx.camera;

  // Transform world position to screen position
  const screenX = (championPos.x - camera.position.x) * camera.zoom + Dimensions.w / 2;
  const screenY = (championPos.y - camera.position.y) * camera.zoom + Dimensions.h / 2;

  ctx.save();

  // Get shape info early so we can skip range circle for cones
  const aoeRadius = (targetDesc as any).aoeRadius;
  const shape = (targetDesc as any).shape;

  // Draw cast range circle (skip for cone abilities - the cone itself shows the range)
  if (targetDesc.range && targetDesc.range > 0 && shape !== 'cone') {
    const rangeScreenRadius = targetDesc.range * camera.zoom;

    // Cast range (dashed cyan circle)
    ctx.strokeStyle = 'rgba(0, 206, 209, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, rangeScreenRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Range label
    ctx.setLineDash([]);
    RenderUtils.renderBitmapText(
      ctx,
      `Range: ${targetDesc.range}`,
      screenX,
      screenY - rangeScreenRadius - 20,
      { color: '#00CED1', size: 20, centered: true }
    );
  }
  // Check if this is a dash ability (aoeRadius is the dash hitbox, not AoE)
  const hasDash = !!(targetDesc as any).dash;

  // Draw AoE circle for ground target abilities (skip for cone and dash - they have their own indicators)
  if (aoeRadius && aoeRadius > 0 && shape !== 'cone' && !hasDash) {
    const aoeScreenRadius = aoeRadius * camera.zoom;

    // Get mouse position to show AoE preview at cursor
    const mousePos = inputManager.getMousePosition();
    if (mousePos) {
      // AoE preview circle (solid orange)
      ctx.fillStyle = 'rgba(255, 165, 0, 0.2)';
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, aoeScreenRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // AoE label
      RenderUtils.renderBitmapText(
        ctx,
        `AoE: ${aoeRadius}`,
        mousePos.x,
        mousePos.y - aoeScreenRadius - 15,
        { color: '#FFA500', size: 20, centered: true }
      );
    }
  }

  // Draw cone for cone-shaped abilities
  // Note: For cones, aoeRadius is the actual damage range, not the cast range
  const coneAngle = (targetDesc as any).coneAngle;
  const coneRadius = aoeRadius || targetDesc.range;  // Use aoeRadius if available
  if (shape === 'cone' && coneAngle && coneRadius) {
    const rangeScreenRadius = coneRadius * camera.zoom;

    // Get mouse position for direction
    const mousePos = inputManager.getMousePosition();
    if (mousePos) {
      const dx = mousePos.x - screenX;
      const dy = mousePos.y - screenY;
      const baseAngle = Math.atan2(dy, dx);
      const halfAngle = coneAngle / 2;

      // Draw cone indicator
      ctx.fillStyle = 'rgba(255, 165, 0, 0.25)';
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.arc(screenX, screenY, rangeScreenRadius, baseAngle - halfAngle, baseAngle + halfAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // Draw skillshot/dash line indicator
  // For dash abilities, use aoeRadius as the width (it's the dash hitbox)
  // For regular skillshots, use width property
  // Skip rectangle for vex_dash - it's a simple point-and-click dash
  const abilityId = ability.definition?.id;
  const skipDashRectangle = abilityId === 'vex_dash';
  const skillshotWidth = (targetDesc as any).width || (hasDash && !skipDashRectangle ? aoeRadius : 0);
  const dashDistance = hasDash ? (targetDesc as any).dash?.distance : 0;
  const skillshotRange = dashDistance || targetDesc.range;

  if (skillshotWidth && skillshotWidth > 0 && skillshotRange && !skipDashRectangle) {
    const widthScreen = skillshotWidth * camera.zoom;
    const rangeScreen = skillshotRange * camera.zoom;

    // Get mouse position for direction
    const mousePos = inputManager.getMousePosition();
    if (mousePos) {
      const dx = mousePos.x - screenX;
      const dy = mousePos.y - screenY;
      const angle = Math.atan2(dy, dx);

      // Draw skillshot/dash rectangle preview
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(angle);

      // Use different color for dash vs skillshot
      const color = hasDash ? 'rgba(255, 200, 50' : 'rgba(255, 100, 100';
      ctx.fillStyle = color + ', 0.2)';
      ctx.strokeStyle = color + ', 0.8)';
      ctx.lineWidth = 2;
      ctx.fillRect(0, -widthScreen / 2, rangeScreen, widthScreen);
      ctx.strokeRect(0, -widthScreen / 2, rangeScreen, widthScreen);

      ctx.restore();
    }
  }

  ctx.restore();
}
