/**
 * Screen shake: a short, decaying camera jitter for big moments (a tower
 * falling, the local champion taking a heavy hit), and a camera punch: a
 * quick zoom in and back out for a kill. Applied by the render controller on
 * top of the camera transform, so they never move the camera.
 *
 * A shake somewhere in the world fades with its distance from the middle of
 * the view: full within NEAR of the view's width, none past FAR, so a fight
 * across the map doesn't shake the screen (`nearView` gives that falloff to
 * the VFX's screen flashes too).
 */

interface Shake {
  intensity: number;
  duration: number;
  start: number;
}

/** Full shake within this share of the view's width from its middle */
const NEAR = 0.5;
/** No shake past this share of the view's width */
const FAR = 1;
/** Share of a punch spent zooming in (the rest eases back out) */
const PUNCH_ATTACK = 0.15;

let current: Shake | null = null;
let punch: Shake | null = null;
const view = { x: 0, y: 0, width: 900 };

/** Where the camera looks and how much of the world it shows across (Camera.step) */
export function setShakeView(x: number, y: number, width: number): void {
  view.x = x;
  view.y = y;
  view.width = width;
}

/** How much of a screen-wide effect at `at` is felt: 1 near the middle of the view, 0 well off screen */
export function nearView(at: { x: number; y: number }): number {
  const distance = Math.hypot(at.x - view.x, at.y - view.y);
  const near = view.width * NEAR;
  const far = view.width * FAR;
  return distance <= near ? 1 : distance >= far ? 0 : 1 - (distance - near) / (far - near);
}

/**
 * Start a shake. A stronger shake replaces a weaker one in progress.
 * @param intensity Max offset in world units
 * @param duration Seconds
 * @param at Where it happens in the world (it fades with distance); omit for the local champion
 */
export function shakeScreen(intensity: number, duration: number, at?: { x: number; y: number }): void {
  if (at) {
    intensity *= nearView(at);
    if (intensity <= 0) return;
  }
  const now = performance.now() / 1000;
  const remaining = current ? currentIntensity(now) : 0;
  if (intensity >= remaining) {
    current = { intensity, duration, start: now };
  }
}

/**
 * Punch the camera: zoom in by `strength` (0.04 = 4%) at once and ease back
 * out over `duration` seconds.
 */
export function punchCamera(strength: number, duration: number): void {
  punch = { intensity: strength, duration, start: performance.now() / 1000 };
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

/** What to multiply the camera's zoom by this frame (1 without a punch) */
export function getPunchZoom(): number {
  if (!punch) return 1;
  const progress = (performance.now() / 1000 - punch.start) / punch.duration;
  if (progress >= 1) {
    punch = null;
    return 1;
  }
  const amount = progress < PUNCH_ATTACK
    ? progress / PUNCH_ATTACK
    : 1 - Math.pow((progress - PUNCH_ATTACK) / (1 - PUNCH_ATTACK), 0.6);
  return 1 + punch.intensity * amount;
}
