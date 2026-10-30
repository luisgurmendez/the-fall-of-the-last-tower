/**
 * Fallback renderer for entity types without a dedicated renderer
 * (for example EntityType.INHIBITOR).
 */

/**
 * Render a generic entity (fallback).
 */
export function renderGeneric(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.strokeRect(-size / 2, -size / 2, size, size);
}
