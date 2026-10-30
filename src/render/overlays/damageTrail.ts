/**
 * Health bar damage trails: after a hit, the health just lost stays on the
 * bar for a moment as a light segment, then drains down to the new health,
 * so it's clear how big each hit was. Healing moves the trail up at once.
 */

/** How long the trail holds after the latest hit */
const HOLD_MS = 350;
/** Then it closes the gap with this time constant */
const DRAIN_MS = 120;
/** Trails not asked for in this long belong to units that are gone */
const STALE_MS = 2000;
/** Prune stale trails once there are this many */
const PRUNE_AT = 300;

interface Trail {
  /** The health the trail shows */
  shown: number;
  /** The health at the last update, to spot new hits */
  health: number;
  holdUntil: number;
  updatedAt: number;
}

const trails = new Map<string, Trail>();

/**
 * The health a unit's trail reaches, given its current health. Call once
 * per frame per unit; it's never below `health`.
 */
export function getTrailHealth(entityId: string, health: number, now = performance.now()): number {
  let trail = trails.get(entityId);
  if (!trail) {
    if (trails.size >= PRUNE_AT) pruneStale(now);
    trail = { shown: health, health, holdUntil: 0, updatedAt: now };
    trails.set(entityId, trail);
    return health;
  }

  if (health < trail.health) {
    // A new hit: hold the trail where it is for a moment
    trail.holdUntil = now + HOLD_MS;
  }
  if (health >= trail.shown) {
    trail.shown = health;
  } else if (now >= trail.holdUntil) {
    const dt = Math.max(0, now - Math.max(trail.updatedAt, trail.holdUntil));
    trail.shown = health + (trail.shown - health) * Math.exp(-dt / DRAIN_MS);
    if (trail.shown - health < 0.5) trail.shown = health;
  }
  trail.health = health;
  trail.updatedAt = now;
  return trail.shown;
}

function pruneStale(now: number): void {
  for (const [entityId, trail] of trails) {
    if (now - trail.updatedAt > STALE_MS) trails.delete(entityId);
  }
}
