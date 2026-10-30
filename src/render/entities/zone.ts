/**
 * Zone renderer: persistent ground effects (damage, slow, heal, buff).
 */

import type { EntityRenderContext } from "@/render/entities/types";

/**
 * Render a zone (persistent ground effect).
 */
export function renderZone(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  rc: EntityRenderContext,
): void {
  const radius = snapshot.radius || 200;
  const zoneType = snapshot.zoneType || "slow";
  const remainingDuration = snapshot.remainingDuration || 0;
  const totalDuration = snapshot.totalDuration || 1;

  // Color based on zone type
  const zoneColors: Record<
    string,
    { fill: string; stroke: string; pulse: string }
  > = {
    damage: {
      fill: "rgba(231, 76, 60, 0.25)", // Red/orange for fire
      stroke: "rgba(231, 76, 60, 0.6)",
      pulse: "rgba(255, 165, 0, 0.4)",
    },
    slow: {
      fill: "rgba(139, 90, 43, 0.25)", // Brown for mud
      stroke: "rgba(139, 90, 43, 0.6)",
      pulse: "rgba(101, 67, 33, 0.4)",
    },
    heal: {
      fill: "rgba(46, 204, 113, 0.25)", // Green for healing
      stroke: "rgba(46, 204, 113, 0.6)",
      pulse: "rgba(39, 174, 96, 0.4)",
    },
    buff: {
      fill: "rgba(52, 152, 219, 0.25)", // Blue for buffs
      stroke: "rgba(52, 152, 219, 0.6)",
      pulse: "rgba(41, 128, 185, 0.4)",
    },
  };

  const colors = zoneColors[zoneType] || zoneColors.slow;

  // Calculate fade based on remaining duration (fade out in last 20%)
  const durationPercent = remainingDuration / totalDuration;
  const fadeAlpha = durationPercent < 0.2 ? durationPercent / 0.2 : 1;

  ctx.save();
  ctx.globalAlpha = fadeAlpha;

  // Draw main zone fill
  ctx.fillStyle = colors.fill;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // Draw pulsing inner ring (animate based on time)
  const pulseProgress = rc.animationTime % 1;
  const pulseRadius = radius * (0.3 + pulseProgress * 0.7);
  const pulseAlpha = 1 - pulseProgress;

  ctx.globalAlpha = fadeAlpha * pulseAlpha * 0.5;
  ctx.fillStyle = colors.pulse;
  ctx.beginPath();
  ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
  ctx.fill();

  // Reset alpha for border
  ctx.globalAlpha = fadeAlpha;

  // Draw zone border
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw duration indicator arc at edge
  if (totalDuration > 0 && remainingDuration > 0) {
    const arcProgress = remainingDuration / totalDuration;
    ctx.strokeStyle = colors.stroke.replace(/[\d.]+\)$/, "1)"); // Full opacity
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      radius + 4,
      -Math.PI / 2,
      -Math.PI / 2 + arcProgress * Math.PI * 2,
    );
    ctx.stroke();
  }

  ctx.restore();
}
