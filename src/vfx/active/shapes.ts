/**
 * Effects drawn straight from VFXManager's scheduled effect list, from each
 * effect's config and progress: ground circles, drawn first under
 * everything else, and expanding rings, cone slashes, shockwaves and beams.
 */

import type {
  ExpandingRingConfig,
  ConeSlashConfig,
  GroundCircleConfig,
  ShockwaveConfig,
} from '../VFXTypes';
import {
  drawExpandingRing,
  drawConeSlash,
  drawGroundCircle,
  drawFilledGroundCircle,
  drawShockwave,
} from '../effects/VFXPrimitives';
import type { ActiveEffect } from './types';

/**
 * Render ground-level effects (circles, zones).
 */
export function renderGroundEffects(
  ctx: CanvasRenderingContext2D,
  effects: ActiveEffect[],
  cameraX: number,
  cameraY: number,
  now: number
): void {
  for (const effect of effects) {
    if (effect.config.type !== 'ground_circle') continue;
    if (now < effect.startTime) continue;

    const config = effect.config as GroundCircleConfig;
    const screenX = effect.x - cameraX;
    const screenY = effect.y - cameraY;
    const progress = effect.progress;

    let alpha = 1;
    if (config.fadeIn && progress < 0.2) {
      alpha = progress / 0.2;
    }
    if (config.fadeOut && progress > 0.8) {
      alpha = 1 - (progress - 0.8) / 0.2;
    }

    // Pulse effect
    let radius = config.radius;
    if (config.pulseSpeed) {
      const pulse = Math.sin(progress * config.pulseSpeed * Math.PI * 2) * 0.1;
      radius *= 1 + pulse;
    }

    if (config.fillColor) {
      drawFilledGroundCircle(
        ctx,
        screenX,
        screenY,
        radius,
        config.fillColor,
        config.color,
        alpha * 0.3,
        alpha * 0.8
      );
    } else {
      drawGroundCircle(
        ctx,
        screenX,
        screenY,
        radius,
        config.color,
        alpha,
        config.dashed
      );
    }
  }
}

/**
 * Render expanding rings, cone slashes, shockwaves and beams.
 */
export function renderShapeEffects(
  ctx: CanvasRenderingContext2D,
  effects: ActiveEffect[],
  cameraX: number,
  cameraY: number,
  now: number
): void {
  for (const effect of effects) {
    if (now < effect.startTime) continue;

    const screenX = effect.x - cameraX;
    const screenY = effect.y - cameraY;
    const progress = effect.progress;

    switch (effect.config.type) {
      case 'expanding_ring': {
        const config = effect.config as ExpandingRingConfig;
        const radius =
          config.startRadius +
          (config.endRadius - config.startRadius) * progress;
        const alpha = config.fadeOut !== false ? 1 - progress : 1;
        drawExpandingRing(
          ctx,
          screenX,
          screenY,
          radius,
          config.thickness,
          config.color,
          alpha
        );
        break;
      }

      case 'cone_slash': {
        const config = effect.config as ConeSlashConfig;
        // Calculate direction to target
        let direction = 0;
        if (effect.targetX !== undefined && effect.targetY !== undefined) {
          direction = Math.atan2(
            effect.targetY - effect.y,
            effect.targetX - effect.x
          );
        }

        const alpha = config.fadeOut !== false ? 1 - progress * 0.5 : 1;
        drawConeSlash(
          ctx,
          screenX,
          screenY,
          direction,
          config.arcAngle,
          config.radius * (0.8 + progress * 0.2),
          config.color,
          alpha,
          config.innerRadius
        );
        break;
      }

      case 'shockwave': {
        const config = effect.config as ShockwaveConfig;
        const radius =
          config.startRadius +
          (config.endRadius - config.startRadius) * progress;
        const alpha = 1 - progress;
        drawShockwave(
          ctx,
          screenX,
          screenY,
          radius,
          config.thickness * (1 - progress * 0.5),
          config.color,
          alpha
        );
        break;
      }

      case 'beam': {
        // Beam from origin to target
        if (effect.targetX === undefined || effect.targetY === undefined)
          break;

        const targetScreenX = effect.targetX - cameraX;
        const targetScreenY = effect.targetY - cameraY;
        const alpha = 1 - progress;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = effect.config.color;
        ctx.lineWidth = (effect.config as any).thickness ?? 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(targetScreenX, targetScreenY);
        ctx.stroke();
        ctx.restore();
        break;
      }
    }
  }
}
