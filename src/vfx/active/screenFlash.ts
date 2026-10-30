/**
 * Full-screen flash, drawn in screen space after the world-space effects.
 */

import type { ScreenFlashConfig } from '../VFXTypes';
import { drawScreenFlash } from '../effects/VFXPrimitives';
import type { ScreenFlashState } from './types';

/**
 * Trigger a screen flash.
 */
export function createScreenFlash(
  config: ScreenFlashConfig,
  startTime: number
): ScreenFlashState {
  return {
    color: config.color,
    duration: config.duration * 1000,
    maxAlpha: config.maxAlpha,
    startTime,
  };
}

/**
 * Update screen flash. Returns null once it has finished.
 */
export function updateScreenFlash(
  flash: ScreenFlashState | null,
  now: number
): ScreenFlashState | null {
  if (flash) {
    const elapsed = now - flash.startTime;
    if (elapsed >= flash.duration) {
      return null;
    }
  }
  return flash;
}

/**
 * Render screen flash (in screen space, not world space).
 */
export function renderScreenFlash(
  ctx: CanvasRenderingContext2D,
  flash: ScreenFlashState | null,
  now: number
): void {
  if (flash) {
    const elapsed = now - flash.startTime;
    const progress = elapsed / flash.duration;
    // Fade in then fade out
    const alpha =
      progress < 0.3
        ? progress / 0.3
        : 1 - (progress - 0.3) / 0.7;
    drawScreenFlash(
      ctx,
      flash.color,
      alpha * flash.maxAlpha
    );
  }
}
