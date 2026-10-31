/**
 * Effects drawn straight from VFXManager's scheduled effect list, from each
 * effect's config and progress: ground circles, drawn first under
 * everything else, and expanding rings, cone slashes, shockwaves and beams.
 *
 * On the GPU (emitGroundEffects, emitShapeEffects) ground circles are magic
 * circles, rings and shockwaves are broken rings of light with a wake and a
 * light pool (shockwaves crack the ground), cone slashes are crescents
 * swept across the arc, and beams flow; the GPU also draws ground lights,
 * decals, lightning, swirls, spikes, rays, meteors and cuts, which the 2D
 * fallback skips.
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
  SpikesConfig,
  RaysConfig,
  MeteorConfig,
  CutConfig,
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

/** A repeatable number 0-1 for the nth thing of an effect */
function random(seed: number, n: number): number {
  const v = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const ROCK_GLOW = fxColor('#ff8a2a');
const SHADOW = fxColor('#120e0c');

/** Where a meteor is at `t` 0-1 of its fall: from up and to the left, speeding up */
function meteorAt(config: MeteorConfig, x: number, y: number, t: number): { x: number; y: number } {
  const drop = t * t;
  const across = config.style === 'fire' ? config.height * 0.5 : 0;
  return { x: x - across * (1 - drop), y: y - config.height * (1 - drop) };
}

/** The direction of a fissure of the 'lines' pattern */
const fissureAngle = (line: number, lines: number, seed: number) => (line / lines) * Math.PI * 2 + random(seed, line) * 0.8;

/** Where the ith spike stands, and how far out (0-1) it is */
function spikeAt(config: SpikesConfig, i: number, x: number, y: number, seed: number): { px: number; py: number; reach: number } {
  let angle: number;
  let reach: number;
  if (config.pattern === 'ring') {
    angle = (i / config.count) * Math.PI * 2 + random(seed, i) * 0.4;
    reach = 1;
  } else if (config.pattern === 'lines') {
    // Spread over the lines, each a little crooked, from near the center out
    const lines = config.lines ?? 5;
    const line = i % lines;
    const perLine = Math.ceil(config.count / lines);
    reach = (Math.floor(i / lines) + 0.6 + random(seed, i * 17) * 0.3) / perLine;
    angle = fissureAngle(line, lines, seed) + (random(seed, i * 19) - 0.5) * 0.1;
  } else {
    angle = random(seed, i * 3) * Math.PI * 2;
    reach = Math.sqrt(random(seed, i * 3 + 1));
  }
  return { px: x + Math.cos(angle) * config.radius * reach, py: y + Math.sin(angle) * config.radius * reach * 0.8, reach };
}

/**
 * Spikes bursting out of the ground: each rises fast a little after the
 * last (outward from the center; along fissures, one after another),
 * stands, and sinks back at the end. Geysers are tongues of lava shooting
 * up and burning out.
 */
function emitSpikes(batch: FXBatch, config: SpikesConfig, x: number, y: number, progress: number, seed: number): void {
  const color = fxColor(config.color);
  const glow = config.glowColor ? fxColor(config.glowColor) : ROCK_GLOW;
  if (config.pattern === 'lines') {
    // The fissures: cracks of glowing rock running out ahead of the spikes
    const lines = config.lines ?? 5;
    for (let line = 0; line < lines; line++) {
      const angle = fissureAngle(line, lines, seed);
      const ex = x + Math.cos(angle) * config.radius;
      const ey = y + Math.sin(angle) * config.radius * 0.8;
      batch.cut(x, y, ex, ey, 3.5, progress, glow, 1.1, 3.3);
    }
  }
  for (let i = 0; i < config.count; i++) {
    const { px, py, reach } = spikeAt(config, i, x, y, seed);
    const spread = config.pattern === 'lines' ? 0.3 : 0.07;
    const start = reach * spread + random(seed, i * 7) * (config.style === 'geyser' ? 0.35 : 0.04);
    if (config.style === 'geyser') {
      const age = (progress - start) / 0.45;
      if (age <= 0 || age >= 1) continue;
      const height = config.length.min + (config.length.max - config.length.min) * random(seed, i * 5);
      const size = height * 0.4 * (0.6 + 0.4 * Math.sin(Math.min(1, age * 3) * Math.PI / 2));
      // A column: a wide tongue at the base and a thinner one shooting above it
      batch.glow(px, py, height * 0.7, color, 0.45 * (1 - age), 0, 0, 0.6, random(seed, i));
      batch.flame(px, py - size * 0.6, size, color, 1.7, age, 0.7, 4, random(seed, i * 23), 1);
      batch.flame(px, py - size * 1.7, size * 0.7, color, 1.5, Math.min(1, age + 0.15), 0.5, 5, random(seed, i * 29), 1);
      continue;
    }
    const t = (progress - start) / 0.1;
    if (t <= 0) continue;
    // Overshoot a little as it bursts out, then sink over the last quarter
    const rise = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.15;
    const sink = progress > 0.75 ? Math.max(0, 1 - (progress - 0.75) / 0.25) : 1;
    const grow = rise * sink;
    if (grow <= 0.02) continue;
    const length = (config.length.min + (config.length.max - config.length.min) * random(seed, i * 5)) * grow;
    // Up on screen, leaning away from the center
    const lean = config.radius > 0 ? ((px - x) / config.radius) * 0.5 : 0;
    const angle = -Math.PI / 2 + lean + (random(seed, i * 11) - 0.5) * 0.3;
    const width = length * (config.style === 'thorn' ? 0.3 : 0.32);
    if (config.style === 'crystal') {
      batch.glow(px, py, length * 0.8, color, 0.5 * sink, 0, 0);
      batch.shard(px, py, angle, length, width, color, true, 1.3, sink);
    } else if (config.style === 'thorn') {
      batch.thorn(px, py, angle, length, width, color, (random(seed, i * 13) - 0.5) * 2, sink, glow, 1.2, random(seed, i));
    } else {
      batch.dust(px, py + 2, width * 1.4, SHADOW, 0.35 * sink);
      batch.shard(px, py, angle, length, width, color, false, 1, 1, glow, 0.9 * sink);
    }
  }
}

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
          batch.telegraph(x, y, config.radius, fxColor(config.color), 0.8 * Math.min(1, (1 - progress) / 0.05 + 0.3), progress);
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
        batch.telegraph(x, y, config.radius, fxColor(config.color), 0.8, progress, config.arcAngle / 2, direction);
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
      case 'meteor': {
        // Its shadow and its light on the ground grow as it comes down
        const config = effect.config as MeteorConfig;
        batch.dust(x, y, config.size * (1 + progress * 2), SHADOW, 0.45 * progress, seed);
        batch.glow(x, y, config.size * 5, fxColor(config.color), 0.6 * progress * progress, 0, 0, 0.5, seed);
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
        batch.ring(x, y, radius, Math.max(2, config.thickness * 0.6), fxColor(config.color), 0.95 * fade, 0.5, 0.3, seed);
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
      case 'spikes':
        emitSpikes(batch, effect.config as SpikesConfig, x, y, progress, seed);
        break;
      case 'rays': {
        const config = effect.config as RaysConfig;
        const reach = config.converge ? 1 - easeOut(progress) * 0.9 : easeOut(Math.min(1, progress * 2.5));
        const light = config.converge ? 0.3 + progress * 0.8 : Math.pow(1 - progress, 1.5) * 1.0;
        batch.rays(x, y, config.radius, fxColor(config.color), light, config.count ?? 14, reach, config.spin ?? 0.3, 0.3, seed);
        break;
      }
      case 'meteor': {
        const config = effect.config as MeteorConfig;
        const color = fxColor(config.color);
        const core = config.colorSecondary ? fxColor(config.colorSecondary) : color;
        const head = meteorAt(config, x, y, progress);
        const trail = [0.3, 0.2, 0.12, 0.06, 0].map((back) => meteorAt(config, x, y, Math.max(0, progress - back)));
        if (config.style === 'fire') {
          for (let i = 0; i < trail.length - 1; i++) {
            batch.flame(trail[i].x, trail[i].y, config.size * (0.6 + i * 0.25), color, 1.4, 0.7 - i * 0.15, 0.6, 3, seed + i * 0.2);
          }
          batch.ribbon(trail, config.size * 1.2, color, 1.2);
          batch.glow(head.x, head.y, config.size * 3, color, 0.8, 0.2, 0.5, 0.4, seed);
          batch.orb(head.x, head.y, config.size, core, 1.2, seed);
        } else {
          const angle = Math.atan2(y - trail[0].y, x - trail[0].x || 0.0001);
          batch.ribbon(trail, config.size * 0.6, color, 1.4);
          batch.glow(head.x, head.y, config.size * 2.5, color, 0.9, 0.25, 0.6);
          batch.shard(head.x - Math.cos(angle) * config.size * 3, head.y - Math.sin(angle) * config.size * 3, angle, config.size * 3.6, config.size * 0.7, core, true, 1.8);
        }
        break;
      }
      case 'cut': {
        const config = effect.config as CutConfig;
        const color = fxColor(config.color);
        if (config.path) {
          if (hasTarget) batch.cut(x, y, effect.targetX!, effect.targetY!, config.width, progress, color, 1.6, 5);
          break;
        }
        for (const offset of config.angles ?? [0]) {
          const angle = direction + offset;
          const dx = (Math.cos(angle) * config.length) / 2;
          const dy = (Math.sin(angle) * config.length) / 2;
          batch.cut(x - dx, y - dy, x + dx, y + dy, config.width, progress, color, 1.6, 5);
        }
        break;
      }
    }
  }
}
