/**
 * Ward renderer (EntityType.WARD). Vile's traps are synced as wards too
 * (with no wardType), so they draw here as stealth wards.
 */

import type { EntityRenderContext } from "@/render/entities/types";
import { lightenColor } from "@/render/entities/shared";

/**
 * Render a ward.
 */
export function renderWard(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  rc: EntityRenderContext,
): void {
  const wardType = snapshot.wardType || "stealth";
  const isOwn = side === rc.localSide;
  const isStealthed = snapshot.isStealthed && !isOwn;

  // Ward colors by type
  const wardColors: Record<string, string> = {
    stealth: "#44FF44", // Green
    control: "#FF44FF", // Pink/Magenta
    farsight: "#4444FF", // Blue
  };

  const baseColor = wardColors[wardType] || "#44FF44";
  const size = 12;

  // Make enemy stealth wards semi-transparent (should be invisible but shown for debugging)
  // In production, enemy stealth wards shouldn't be rendered at all unless revealed
  const alpha = isStealthed ? 0.3 : 1.0;
  ctx.globalAlpha = alpha;

  // Draw ward body (diamond shape)
  ctx.save();
  ctx.rotate(Math.PI / 4); // 45-degree rotation for diamond

  // Outer glow effect
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
  gradient.addColorStop(0, baseColor);
  gradient.addColorStop(0.5, lightenColor(baseColor, -30));
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(-size * 1.5, -size * 1.5, size * 3, size * 3);

  // Main body (square that looks like diamond after rotation)
  ctx.fillStyle = baseColor;
  ctx.fillRect(-size / 2, -size / 2, size, size);

  // Inner highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillRect(-size / 4, -size / 2, size / 2, size / 4);

  // Border
  ctx.strokeStyle = lightenColor(baseColor, -40);
  ctx.lineWidth = 1;
  ctx.strokeRect(-size / 2, -size / 2, size, size);

  ctx.restore();

  // Reset alpha
  ctx.globalAlpha = 1.0;

  // Draw remaining duration indicator (pie chart style)
  if (snapshot.remainingDuration > 0 && isOwn) {
    const maxDuration =
      wardType === "stealth" ? 90 : wardType === "farsight" ? 60 : 0;
    if (maxDuration > 0) {
      const progress = snapshot.remainingDuration / maxDuration;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(
        0,
        0,
        size * 0.8,
        -Math.PI / 2,
        -Math.PI / 2 + (1 - progress) * Math.PI * 2,
        false,
      );
      ctx.closePath();
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fill();
    }
  }

  // Draw ward type indicator icon
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 8px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (wardType === "control") {
    // Control ward: eye icon (simplified as "👁" or "C")
    ctx.fillText("C", 0, 0);
  } else if (wardType === "farsight") {
    // Farsight ward: targeting icon (simplified as "F")
    ctx.fillText("F", 0, 0);
  }
  // Stealth ward has no icon (most common, keep clean)

  // Draw health pips for control wards (visible, destroyable)
  if (
    !snapshot.isStealthed &&
    snapshot.health !== undefined &&
    snapshot.maxHealth !== undefined
  ) {
    const pipCount = snapshot.maxHealth;
    const pipWidth = 4;
    const pipSpacing = 2;
    const totalWidth = pipCount * pipWidth + (pipCount - 1) * pipSpacing;
    const startX = -totalWidth / 2;

    for (let i = 0; i < pipCount; i++) {
      const isFilled = i < snapshot.health;
      ctx.fillStyle = isFilled ? baseColor : "#333333";
      ctx.fillRect(
        startX + i * (pipWidth + pipSpacing),
        size + 4,
        pipWidth,
        3,
      );
    }
  }
}
