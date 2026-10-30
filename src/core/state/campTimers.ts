/**
 * Cleared jungle camps and when they come back, from CAMP_CLEARED events.
 */

/**
 * A cleared jungle camp and when it comes back.
 */
export interface CampTimer {
  campId: string;
  creatureType: string;
  x: number;
  y: number;
  /** Game time (seconds) when the camp respawns */
  respawnAt: number;
}

/**
 * Cleared jungle camps waiting to respawn (campId -> timer).
 */
export class CampTimers {
  private campTimers: Map<string, CampTimer> = new Map();

  /**
   * Record a cleared camp, replacing any earlier timer for it.
   */
  set(timer: CampTimer): void {
    this.campTimers.set(timer.campId, timer);
  }

  /**
   * Jungle camps waiting to respawn (expired timers are dropped).
   */
  getActive(gameTime: number): CampTimer[] {
    for (const [campId, timer] of this.campTimers) {
      if (timer.respawnAt <= gameTime) this.campTimers.delete(campId);
    }
    return Array.from(this.campTimers.values());
  }
}
