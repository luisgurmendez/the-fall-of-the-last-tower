/**
 * Big moments shown in the middle of the screen (kills, towers, dragon, the
 * match result). Drawn by AnnouncementBanner.
 */

/**
 * A message shown in the middle of the screen for a few seconds.
 */
export interface Announcement {
  text: string;
  detail?: string;
  color: string;
  startTime: number;
  /** ms */
  duration: number;
}

/** How long game event announcements stay on screen */
export const ANNOUNCEMENT_DURATION = 4000; // ms

/**
 * Announcements to show, oldest first.
 */
export class Announcements {
  private announcements: Announcement[] = [];

  add(announcement: Announcement): void {
    this.announcements.push(announcement);
  }

  /**
   * Announcements still on screen (expired ones are dropped).
   */
  getActive(now: number): Announcement[] {
    this.announcements = this.announcements.filter(a => now - a.startTime < a.duration);
    return this.announcements;
  }
}
