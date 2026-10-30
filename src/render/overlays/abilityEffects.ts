/**
 * Ability effect overlay (legacy system): cone, circle, line and point
 * shapes drawn for ability casts. Newer ability visuals go through the VFX
 * system in src/vfx/.
 */

import type {
  OnlineStateManager,
  AbilityEffect,
} from "@/core/OnlineStateManager";

/**
 * Render ability visual effects (cone sweeps, circles, etc.)
 */
export function renderAbilityEffects(
  ctx: CanvasRenderingContext2D,
  stateManager: OnlineStateManager,
): void {
  const effects = stateManager.getAbilityEffects();

  for (const effect of effects) {
    const progress = stateManager.getAbilityEffectProgress(effect);

    // Fade out effect as it progresses
    const alpha = 1 - progress * 0.7; // Keep some visibility until end

    ctx.save();
    ctx.globalAlpha = alpha;

    // Calculate direction from origin to target
    const dx = effect.targetX - effect.originX;
    const dy = effect.targetY - effect.originY;
    const angle = Math.atan2(dy, dx);

    switch (effect.shape) {
      case "cone":
        renderConeEffect(ctx, effect, angle, progress);
        break;
      case "circle":
        renderCircleEffect(ctx, effect, progress);
        break;
      case "line":
        renderLineEffect(ctx, effect, angle, progress);
        break;
      case "point":
        renderPointEffect(ctx, effect, progress);
        break;
    }

    ctx.restore();
  }
}

/**
 * Render a cone-shaped ability effect.
 */
function renderConeEffect(
  ctx: CanvasRenderingContext2D,
  effect: AbilityEffect,
  angle: number,
  progress: number,
): void {
  const halfAngle = (effect.coneAngle || Math.PI / 2) / 2;

  // Animate the cone expanding outward
  const currentRange = effect.range * Math.min(1, progress * 2 + 0.3);

  // Draw filled cone
  ctx.fillStyle = effect.color;
  ctx.beginPath();
  ctx.moveTo(effect.originX, effect.originY);
  ctx.arc(
    effect.originX,
    effect.originY,
    currentRange,
    angle - halfAngle,
    angle + halfAngle,
  );
  ctx.closePath();
  ctx.fill();

  // Draw edge highlight
  ctx.strokeStyle = effect.color.replace(/[\d.]+\)$/, "0.9)");
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Render a circle-shaped ability effect (AoE).
 */
function renderCircleEffect(
  ctx: CanvasRenderingContext2D,
  effect: AbilityEffect,
  progress: number,
): void {
  const radius = effect.aoeRadius || effect.range;

  // Animate expanding ring
  const innerRadius = radius * progress * 0.8;
  const outerRadius = radius * Math.min(1, progress * 1.2);

  // Draw outer circle
  ctx.fillStyle = effect.color;
  ctx.beginPath();
  ctx.arc(effect.targetX, effect.targetY, outerRadius, 0, Math.PI * 2);
  ctx.fill();

  // Draw inner highlight ring
  ctx.strokeStyle = effect.color.replace(/[\d.]+\)$/, "0.8)");
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(effect.targetX, effect.targetY, innerRadius, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Render a line-shaped ability effect (skillshot).
 */
function renderLineEffect(
  ctx: CanvasRenderingContext2D,
  effect: AbilityEffect,
  angle: number,
  progress: number,
): void {
  const width = effect.width || 60;
  const halfWidth = width / 2;

  // Animate the line extending
  const currentRange = effect.range * Math.min(1, progress * 2 + 0.3);

  // Calculate perpendicular direction for width
  const perpX = -Math.sin(angle) * halfWidth;
  const perpY = Math.cos(angle) * halfWidth;

  // Calculate end point
  const endX = effect.originX + Math.cos(angle) * currentRange;
  const endY = effect.originY + Math.sin(angle) * currentRange;

  // Draw filled rectangle
  ctx.fillStyle = effect.color;
  ctx.beginPath();
  ctx.moveTo(effect.originX + perpX, effect.originY + perpY);
  ctx.lineTo(endX + perpX, endY + perpY);
  ctx.lineTo(endX - perpX, endY - perpY);
  ctx.lineTo(effect.originX - perpX, effect.originY - perpY);
  ctx.closePath();
  ctx.fill();

  // Draw edge highlight
  ctx.strokeStyle = effect.color.replace(/[\d.]+\)$/, "0.8)");
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Render a point-based ability effect (impact).
 */
function renderPointEffect(
  ctx: CanvasRenderingContext2D,
  effect: AbilityEffect,
  progress: number,
): void {
  // Expanding ring effect
  const maxRadius = 50;
  const currentRadius = maxRadius * progress;

  ctx.strokeStyle = effect.color;
  ctx.lineWidth = 4 * (1 - progress);
  ctx.beginPath();
  ctx.arc(effect.targetX, effect.targetY, currentRadius, 0, Math.PI * 2);
  ctx.stroke();
}
