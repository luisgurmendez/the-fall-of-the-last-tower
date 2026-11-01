/**
 * The kill feed: the latest champion kills (who took down whom), drawn in the
 * top right by KillFeed, and multi-kills: a killer's kills each within
 * MULTI_KILL_WINDOW of the last count up (a double kill, a triple...).
 */

import { EntityType } from '@siege/shared';

export interface KillRecord {
  /** The killer's champion, if a champion got it */
  killerChampionId: string | null;
  /** What got it otherwise (a tower, minions, a monster) */
  killerType: EntityType | null;
  killerSide: number | null;
  victimChampionId: string;
  victimSide: number;
  /** When (Date.now, ms) */
  time: number;
  /** The killer's kills in a row (2 = a double kill), 1 for a single */
  streak: number;
}

/** How long a kill stays in the feed (ms) */
export const KILL_FEED_DURATION = 8000;
/** Most kills shown at once */
const KILL_FEED_SIZE = 5;
/** A killer's next kill within this long counts toward a multi-kill (ms) */
const MULTI_KILL_WINDOW = 10000;

export class KillFeed {
  private kills: KillRecord[] = [];
  private streaks = new Map<string, { count: number; last: number }>();

  /** A champion died; returns its record (with the killer's streak) */
  add(record: Omit<KillRecord, 'streak'>, killerId: string | null): KillRecord {
    let streak = 1;
    if (killerId && record.killerChampionId) {
      const previous = this.streaks.get(killerId);
      streak = previous && record.time - previous.last <= MULTI_KILL_WINDOW ? previous.count + 1 : 1;
      this.streaks.set(killerId, { count: streak, last: record.time });
    }
    const kill = { ...record, streak };
    this.kills = [...this.kills, kill].slice(-KILL_FEED_SIZE);
    return kill;
  }

  /** Kills still in the feed, oldest first */
  getActive(now: number): readonly KillRecord[] {
    this.kills = this.kills.filter(kill => now - kill.time < KILL_FEED_DURATION);
    return this.kills;
  }
}

/** What a streak is called (from two kills up) */
export function multiKillName(streak: number): string | null {
  return ['', '', 'Double Kill!', 'Triple Kill!', 'Quadra Kill!', 'Penta Kill!'][Math.min(streak, 5)] || null;
}
