/**
 * VFXPrimitives - Reusable VFX building blocks for Canvas 2D.
 *
 * Provides common visual effects:
 * - Expanding rings
 * - Particle bursts
 * - Trails and afterimages
 * - Cone slashes
 * - Glows and auras
 *
 * All primitives use pixel-art friendly rendering (no anti-aliasing where possible).
 */

import type { VFXParticle } from '../VFXParticlePool';

/**
 * Draw a pixelated expanding ring.
 */
export function drawExpandingRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  thickness: number,
  color: string,
  alpha: number = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;

  // Pixelated look - use integer coordinates
  ctx.beginPath();
  ctx.arc(Math.round(x), Math.round(y), Math.round(radius), 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a filled circle with optional glow.
 */
export function drawGlowCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  glowColor: string,
  glowRadius: number,
  alpha: number = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Outer glow
  if (glowRadius > 0) {
    const gradient = ctx.createRadialGradient(x, y, radius, x, y, glowRadius);
    gradient.addColorStop(0, glowColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Core
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(Math.round(x), Math.round(y), Math.round(radius), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a pixelated square particle.
 */
export function drawPixelSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;

  const halfSize = Math.floor(size / 2);
  ctx.fillRect(
    Math.round(x) - halfSize,
    Math.round(y) - halfSize,
    Math.ceil(size),
    Math.ceil(size)
  );

  ctx.restore();
}

/**
 * Draw a star/sparkle shape.
 */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
  points: number,
  color: string,
  rotation: number = 0,
  alpha: number = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    if (i === 0) {
      ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    } else {
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a cone/arc shape (for slash effects).
 */
export function drawConeSlash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number, // Direction in radians
  arcAngle: number, // Width of arc in radians
  radius: number,
  color: string,
  alpha: number = 1,
  innerRadius: number = 0
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;

  const startAngle = angle - arcAngle / 2;
  const endAngle = angle + arcAngle / 2;

  ctx.beginPath();
  if (innerRadius > 0) {
    // Draw arc with inner cutout
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.arc(x, y, innerRadius, endAngle, startAngle, true);
  } else {
    // Draw from center
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, startAngle, endAngle);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a line with thickness (for beams/trails).
 */
export function drawThickLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  color: string,
  alpha: number = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a trail from a series of points with fading.
 */
export function drawTrail(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  thickness: number,
  color: string,
  fadeFromStart: boolean = true
): void {
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < points.length - 1; i++) {
    const progress = fadeFromStart
      ? i / (points.length - 1)
      : 1 - i / (points.length - 1);
    const alpha = progress;
    const width = thickness * (0.3 + progress * 0.7);

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[i + 1].x, points[i + 1].y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw a shockwave ring (thick ring that expands and fades).
 */
export function drawShockwave(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  thickness: number,
  color: string,
  alpha: number = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Create gradient for shockwave edge
  const gradient = ctx.createRadialGradient(
    x,
    y,
    Math.max(0, radius - thickness / 2),
    x,
    y,
    radius + thickness / 2
  );
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(0.3, color);
  gradient.addColorStop(0.7, color);
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius + thickness / 2, 0, Math.PI * 2);
  ctx.arc(x, y, Math.max(0, radius - thickness / 2), 0, Math.PI * 2, true);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a ground circle indicator.
 */
export function drawGroundCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number = 1,
  dashed: boolean = false
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  if (dashed) {
    ctx.setLineDash([8, 4]);
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a filled ground circle (for zones).
 */
export function drawFilledGroundCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fillColor: string,
  borderColor: string,
  fillAlpha: number = 0.3,
  borderAlpha: number = 0.8
): void {
  ctx.save();

  // Fill
  ctx.globalAlpha = fillAlpha;
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.globalAlpha = borderAlpha;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw screen flash effect (full canvas overlay).
 */
export function drawScreenFlash(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha: number
): void {
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/**
 * Draw a particle from pool data.
 */
export function drawParticle(
  ctx: CanvasRenderingContext2D,
  particle: VFXParticle
): void {
  const alpha = (particle.alpha ?? 1) * (particle.life / particle.maxLife);
  const size = particle.size * (particle.scale ?? 1);

  switch (particle.effectType) {
    case 'square':
      drawPixelSquare(ctx, particle.x, particle.y, size, particle.color, alpha);
      break;

    case 'star':
      drawStar(
        ctx,
        particle.x,
        particle.y,
        size,
        size * 0.4,
        4,
        particle.color,
        particle.rotation ?? 0,
        alpha
      );
      break;

    case 'spark':
      // Elongated spark in direction of velocity
      const vLen = Math.sqrt(particle.vx ** 2 + particle.vy ** 2);
      if (vLen > 0.1) {
        const sparkLen = size * 2;
        const nx = particle.vx / vLen;
        const ny = particle.vy / vLen;
        drawThickLine(
          ctx,
          particle.x - nx * sparkLen,
          particle.y - ny * sparkLen,
          particle.x,
          particle.y,
          size * 0.5,
          particle.color,
          alpha
        );
      } else {
        drawPixelSquare(
          ctx,
          particle.x,
          particle.y,
          size,
          particle.color,
          alpha
        );
      }
      break;

    case 'ring':
      drawExpandingRing(
        ctx,
        particle.x,
        particle.y,
        size,
        2,
        particle.color,
        alpha
      );
      break;

    case 'trail':
      if (particle.trailPositions && particle.trailPositions.length > 0) {
        const positions = [
          { x: particle.x, y: particle.y },
          ...particle.trailPositions,
        ];
        drawTrail(ctx, positions, size, particle.color, true);
      } else {
        drawGlowCircle(
          ctx,
          particle.x,
          particle.y,
          size * 0.5,
          particle.color,
          particle.colorSecondary ?? particle.color,
          size,
          alpha
        );
      }
      break;

    case 'circle':
    default:
      if (particle.glowIntensity && particle.glowIntensity > 0) {
        drawGlowCircle(
          ctx,
          particle.x,
          particle.y,
          size * 0.5,
          particle.color,
          particle.colorSecondary ?? particle.color,
          size * particle.glowIntensity,
          alpha
        );
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(
          Math.round(particle.x),
          Math.round(particle.y),
          Math.max(1, Math.round(size / 2)),
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }
      break;
  }
}

/**
 * Helper: parse color string to RGB components.
 */
export function parseColor(
  color: string
): { r: number; g: number; b: number } | null {
  // Hex color
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  // rgba/rgb color
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
    };
  }

  return null;
}

/**
 * Helper: create rgba string.
 */
export function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

/**
 * Helper: interpolate between two colors.
 */
export function lerpColor(
  color1: string,
  color2: string,
  t: number
): string | null {
  const c1 = parseColor(color1);
  const c2 = parseColor(color2);
  if (!c1 || !c2) return null;

  return rgba(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t,
    1
  );
}
