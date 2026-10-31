/**
 * Effects drawn straight from VFXManager's scheduled effect list, from each
 * effect's config and progress: ground circles, drawn first under
 * everything else, and expanding rings, cone slashes, shockwaves and beams.
 *
 * On the GPU (emitGroundEffects, emitShapeEffects) ground circles are magic
 * circles, rings and shockwaves are broken rings of light with a wake and a
 * light pool (shockwaves crack the ground), cone slashes are crescents
 * swept across the arc, and beams flow; the GPU also draws ground lights,
 * decals, lightning and swirls, which the 2D fallback skips.
 */

import type {
  ExpandingRingConfig,
  ConeSlashConfig,
  GroundCircleConfig,
  ShockwaveConfig,
  BeamConfig,
  GroundLightConfig,
  DecalConfig,
  LightningConfig,
  SwirlConfig,
} from '../VFXTypes';
import { fxColor, type FXBatch } from '@/gpu/fx/FXBatch';
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

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** A number 0-1 that stays the same for an effect, so its shapes differ from others' */
const effectSeed = (effect: ActiveEffect) => (effect.startTime * 0.137) % 1;

function fadeInOut(progress: number, fadeIn = 0.15, fadeOut = 0.3): number {
  return Math.min(1, progress / fadeIn, (1 - progress) / fadeOut);
}

/**
 * Add the ground-level parts of the effects to a GPU batch: magic circles,
 * light pools under rings and shockwaves, cracks and scorch marks.
 */
export function emitGroundEffects(batch: FXBatch, effects: ActiveEffect[], now: number): void {
  for (const effect of effects) {
    if (now < effect.startTime || !effect.started) continue;
    const { x, y, progress } = effect;
    const seed = effectSeed(effect);

    switch (effect.config.type) {
      case 'ground_circle': {
        const config = effect.config as GroundCircleConfig;
        const alpha = Math.min(config.fadeIn ? Math.min(1, progress / 0.15) : 1, config.fadeOut ? Math.min(1, (1 - progress) / 0.2) : 1);
        const pulse = config.pulseSpeed ? 1 + Math.sin(progress * config.pulseSpeed * Math.PI * 2) * 0.04 : 1;
        if (config.style === 'telegraph') {
          batch.telegraph(x, y, config.radius, fxColor(config.color), 1.1 * Math.min(1, (1 - progress) / 0.05 + 0.3), progress);
          break;
        }
        const runes = Math.max(16, Math.round(config.radius * 0.45));
        batch.sigil(x, y, config.radius * pulse, fxColor(config.color), 1.1 * alpha, progress, 0.35, runes, 5, alpha, seed);
        if (config.fillColor) batch.glow(x, y, config.radius * 1.1, fxColor(config.fillColor), 0.25 * alpha, 0, 0);
        break;
      }
      case 'expanding_ring': {
        const config = effect.config as ExpandingRingConfig;
        const radius = config.startRadius + (config.endRadius - config.startRadius) * easeOut(progress);
        batch.glow(x, y, radius * 1.3, fxColor(config.color), 0.25 * (1 - progress), 0, 0);
        break;
      }
      case 'shockwave': {
        const config = effect.config as ShockwaveConfig;
        const radius = config.startRadius + (config.endRadius - config.startRadius) * easeOut(progress);
        batch.glow(x, y, radius * 1.2, fxColor(config.color), 0.3 * (1 - progress), 0, 0);
        batch.decal(x, y, config.endRadius * 0.6, fxColor(config.color), progress, 0.9, 0.7, seed);
        break;
      }
      case 'cone_slash': {
        const config = effect.config as ConeSlashConfig;
        if (config.style !== 'telegraph') break;
        const direction = effect.targetX !== undefined && effect.targetY !== undefined ? Math.atan2(effect.targetY - y, effect.targetX - x) : 0;
        batch.telegraph(x, y, config.radius, fxColor(config.color), 1.1, progress, config.arcAngle / 2, direction);
        break;
      }
      case 'ground_light': {
        const config = effect.config as GroundLightConfig;
        batch.glow(x, y, config.radius, fxColor(config.color), config.intensity * fadeInOut(progress), 0, 0, config.flicker ?? 0, seed);
        break;
      }
      case 'decal': {
        const config = effect.config as DecalConfig;
        batch.decal(x, y, config.radius, fxColor(config.color), progress, config.opacity ?? 1, config.embers ?? 0, seed);
        break;
      }
    }
  }
}

/**
 * Add the effects that stand over the units to a GPU batch: rings,
 * shockwaves, slashes, beams, lightning and swirls.
 */
export function emitShapeEffects(batch: FXBatch, effects: ActiveEffect[], now: number): void {
  for (const effect of effects) {
    if (now < effect.startTime || !effect.started) continue;
    const { x, y, progress } = effect;
    const seed = effectSeed(effect);
    const hasTarget = effect.targetX !== undefined && effect.targetY !== undefined;
    const direction = hasTarget ? Math.atan2(effect.targetY! - y, effect.targetX! - x) : 0;

    switch (effect.config.type) {
      case 'expanding_ring': {
        const config = effect.config as ExpandingRingConfig;
        const radius = config.startRadius + (config.endRadius - config.startRadius) * easeOut(progress);
        const fade = config.fadeOut !== false ? Math.pow(1 - progress, 1.2) : 1;
        batch.ring(x, y, radius, Math.max(2, config.thickness * 0.6), fxColor(config.color), 1.2 * fade, 0.5, 0.3, seed);
        break;
      }
      case 'shockwave': {
        const config = effect.config as ShockwaveConfig;
        const radius = config.startRadius + (config.endRadius - config.startRadius) * easeOut(progress);
        batch.ring(x, y, radius, Math.max(3, config.thickness * (0.8 - progress * 0.4)), fxColor(config.color), 1.0 * Math.pow(1 - progress, 1.2), 0.8, 0.35, seed);
        break;
      }
      case 'cone_slash': {
        const config = effect.config as ConeSlashConfig;
        if (config.style === 'telegraph') break;
        const thickness = config.innerRadius !== undefined ? config.radius - config.innerRadius : config.radius * 0.45;
        batch.slash(x, y, direction, config.radius, config.arcAngle / 2, thickness, progress, fxColor(config.color), 1.6, 1.8, seed);
        break;
      }
      case 'beam': {
        const config = effect.config as BeamConfig;
        const fade = fadeInOut(progress, 0.1, 0.4);
        if (config.fromSky) {
          // A pillar of light falling onto the anchor
          const width = config.thickness * (1 - progress * 0.6);
          batch.beam(x, y - config.fromSky, x, y, width * 1.6, fxColor(config.color), 0.9 * fade, 0.15, 6, 0.08, seed);
          if (config.colorSecondary) batch.beam(x, y - config.fromSky, x, y, width * 0.6, fxColor(config.colorSecondary), 0.8 * fade, 0.35, 9, 0.04, seed + 0.5);
          batch.glow(x, y, config.thickness * 3, fxColor(config.color), 0.6 * fade, 0.25, 0.4);
          break;
        }
        if (!hasTarget) break;
        batch.beam(x, y, effect.targetX!, effect.targetY!, config.thickness * 2.5, fxColor(config.color), 1.6 * fade, 0.18, 5, 0.2, seed);
        if (config.colorSecondary) batch.beam(x, y, effect.targetX!, effect.targetY!, config.thickness, fxColor(config.colorSecondary), 1.2 * fade, 0.3, 8, 0.1, seed + 0.5);
        break;
      }
      case 'lightning': {
        if (!hasTarget) break;
        const config = effect.config as LightningConfig;
        const fade = fadeInOut(progress, 0.05, 0.5);
        const color = fxColor(config.color);
        // New bolts every few frames
        const flash = Math.floor(now / 70);
        for (let i = 0; i < config.count; i++) {
          batch.lightning(x, y, effect.targetX!, effect.targetY!, config.spread, config.thickness, color, 1.8 * fade, seed * 10 + i * 3.1 + flash * 0.37);
        }
        batch.glow(effect.targetX!, effect.targetY!, config.spread * 1.5, color, 1.2 * fade, 0.25, 0.8, 0.6, seed);
        break;
      }
      case 'swirl': {
        const config = effect.config as SwirlConfig;
        const radius = config.radius * (0.6 + 0.4 * easeOut(Math.min(1, progress * 3)));
        batch.swirl(x, y, radius, fxColor(config.color), 1.4 * fadeInOut(progress), config.spin ?? 1, config.arms ?? 3, seed);
        break;
      }
    }
  }
}
