/**
 * Screen shake: a short, decaying camera jitter for big moments (a tower
 * falling, the local champion taking a heavy hit). Applied by the render
 * controller on top of the camera transform, so it never moves the camera.
 */

interface Shake {
  intensity: number;
  duration: number;
  start: number;
}

let current: Shake | null = null;

/**
 * Start a shake. A stronger shake replaces a weaker one in progress.
 * @param intensity Max offset in world units
 * @param duration Seconds
 */
export function shakeScreen(intensity: number, duration: number): void {
  const now = performance.now() / 1000;
  const remaining = current ? currentIntensity(now) : 0;
  if (intensity >= remaining) {
    current = { intensity, duration, start: now };
  }
}

function currentIntensity(now: number): number {
  if (!current) return 0;
  const progress = (now - current.start) / current.duration;
  if (progress >= 1) {
    current = null;
    return 0;
  }
  return current.intensity * (1 - progress);
}

/**
 * Offset to add to the camera this frame.
 */
export function getShakeOffset(): { x: number; y: number } {
  const now = performance.now() / 1000;
  const intensity = currentIntensity(now);
  if (intensity <= 0) return { x: 0, y: 0 };
  return {
    x: Math.sin(now * 73) * intensity,
    y: Math.cos(now * 61) * intensity,
  };
}
