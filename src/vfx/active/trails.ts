/**
 * Effects that follow a moving entity: trails, which add a point as the
 * entity moves, and dash afterimages, which leave fading images while it
 * dashes.
 */

import type { OnlineStateManager } from '@/core/OnlineStateManager';
import type { TrailConfig, DashAfterimageConfig } from '../VFXTypes';
import { drawTrail } from '../effects/VFXPrimitives';
import type { ActiveTrail, ActiveDashAfterimage } from './types';
import { fxColor, type FXBatch } from '@/gpu/fx/FXBatch';

/**
 * Create a trail effect attached to an entity.
 */
export function createTrail(
  id: string,
  config: TrailConfig,
  entityId: string,
  x: number,
  y: number,
  startTime: number
): ActiveTrail {
  return {
    id,
    entityId,
    color: config.color,
    thickness: config.thickness,
    fadeLength: config.fadeLength,
    points: [{ x, y, time: startTime }],
    duration: config.duration * 1000,
    startTime,
  };
}

/**
 * Update trails - follow entity positions. Returns the trails still running.
 */
export function updateTrails(
  trails: ActiveTrail[],
  stateManager: OnlineStateManager,
  now: number
): ActiveTrail[] {
  return trails.filter((trail) => {
    const elapsed = now - trail.startTime;
    if (elapsed >= trail.duration) {
      return false;
    }

    // Get entity position
    const entity = stateManager.getEntity(trail.entityId);
    if (entity) {
      const lastPoint = trail.points[0];
      const dx = entity.position.x - lastPoint.x;
      const dy = entity.position.y - lastPoint.y;

      // Only add point if entity moved
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        trail.points.unshift({
          x: entity.position.x,
          y: entity.position.y,
          time: now,
        });
      }

      // Limit trail length
      while (trail.points.length > trail.fadeLength) {
        trail.points.pop();
      }
    }

    return true;
  });
}

/**
 * Render trails.
 */
export function renderTrails(
  ctx: CanvasRenderingContext2D,
  trails: ActiveTrail[],
  cameraX: number,
  cameraY: number
): void {
  for (const trail of trails) {
    if (trail.points.length >= 2) {
      const screenPoints = trail.points.map((p) => ({
        x: p.x - cameraX,
        y: p.y - cameraY,
      }));
      drawTrail(ctx, screenPoints, trail.thickness, trail.color, true);
    }
  }
}

/**
 * Create dash afterimage effect attached to an entity.
 */
export function createDashAfterimage(
  id: string,
  config: DashAfterimageConfig,
  entityId: string,
  x: number,
  y: number,
  startTime: number
): ActiveDashAfterimage {
  return {
    id,
    entityId,
    color: config.color,
    images: [],
    fadeSpeed: config.fadeSpeed,
    duration: config.duration * 1000,
    startTime,
    lastImageTime: startTime,
    imageInterval: (config.duration * 1000) / config.imageCount,
  };
}

/**
 * Update dash afterimages: add an image while the entity dashes and fade
 * the existing ones. Returns the afterimages that still have images.
 */
export function updateDashAfterimages(
  afterimages: ActiveDashAfterimage[],
  stateManager: OnlineStateManager,
  dt: number,
  now: number
): ActiveDashAfterimage[] {
  for (const afterimage of afterimages) {
    const elapsed = now - afterimage.startTime;
    const entity = stateManager.getEntity(afterimage.entityId);

    // Only add new images while within duration AND entity is dashing
    const isDashing = entity && (entity as any).isDashing;
    if (isDashing && elapsed < afterimage.duration && now - afterimage.lastImageTime >= afterimage.imageInterval) {
      afterimage.images.unshift({
        x: entity.position.x,
        y: entity.position.y,
        alpha: 0.8,
        color: afterimage.color,
      });
      afterimage.lastImageTime = now;
    }

    // Fade existing images
    for (const image of afterimage.images) {
      image.alpha -= afterimage.fadeSpeed * dt;
    }
    afterimage.images = afterimage.images.filter((img) => img.alpha > 0);
  }
  return afterimages.filter((ai) => {
    return ai.images.length > 0;
  });
}

/**
 * Render dash afterimages.
 */
export function renderDashAfterimages(
  ctx: CanvasRenderingContext2D,
  afterimages: ActiveDashAfterimage[],
  cameraX: number,
  cameraY: number
): void {
  for (const afterimage of afterimages) {
    for (const image of afterimage.images) {
      ctx.save();
      ctx.globalAlpha = image.alpha * 0.5;
      ctx.fillStyle = image.color;
      ctx.beginPath();
      ctx.arc(image.x - cameraX, image.y - cameraY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/**
 * Add trails to a GPU batch as ribbons of light, fading out at their end.
 */
export function emitTrails(batch: FXBatch, trails: ActiveTrail[], now: number): void {
  for (const trail of trails) {
    if (trail.points.length < 2) continue;
    const progress = (now - trail.startTime) / trail.duration;
    const fade = Math.min(1, (1 - progress) / 0.3);
    const color = fxColor(trail.color);
    // Points are newest first; ribbons go oldest first
    batch.ribbon([...trail.points].reverse(), trail.thickness * 0.9, color, 1.5 * fade);
    batch.glow(trail.points[0].x, trail.points[0].y, trail.thickness * 2.5, color, 0.8 * fade, 0.3, 0.6);
  }
}

/**
 * Add dash afterimages to a GPU batch: a fading glow where each image was
 * left, joined by a streak.
 */
export function emitDashAfterimages(batch: FXBatch, afterimages: ActiveDashAfterimage[]): void {
  for (const afterimage of afterimages) {
    const color = fxColor(afterimage.color);
    const images = afterimage.images;
    for (let i = 0; i < images.length; i++) {
      batch.glow(images[i].x, images[i].y, 26, color, images[i].alpha * 0.9, 0.25, 0.4);
      if (i > 0) {
        batch.segment(images[i].x, images[i].y, images[i - 1].x, images[i - 1].y, 10 * images[i].alpha, 10 * images[i - 1].alpha, color, images[i].alpha, images[i - 1].alpha);
      }
    }
  }
}
