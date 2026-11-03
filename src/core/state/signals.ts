/**
 * Pings and emotes (PING and EMOTE events): the pings on the map and the
 * emote over each champion while they last. Pings are drawn in the world
 * and on the minimap, emotes over their champion (render/overlays/signals.ts).
 */

import type { EmoteId, PingType } from '@siege/shared';

export interface Ping {
  pingType: PingType;
  x: number;
  y: number;
  /** Who pinged */
  entityId: string;
  championId: string;
  /** When (Date.now, ms) */
  time: number;
}

export interface Emote {
  emote: EmoteId;
  /** When (Date.now, ms) */
  time: number;
}

/** How long a ping stays (ms) */
export const PING_DURATION = 3500;
/** How long an emote stays over its champion (ms) */
export const EMOTE_DURATION = 2500;

export class Signals {
  private pings: Ping[] = [];
  private emotes = new Map<string, Emote>();

  addPing(ping: Ping): void {
    this.pings.push(ping);
  }

  /** A champion's emote replaces the one it had up */
  addEmote(entityId: string, emote: EmoteId, time: number): void {
    this.emotes.set(entityId, { emote, time });
  }

  /** The pings still up */
  getPings(now = Date.now()): readonly Ping[] {
    this.pings = this.pings.filter(ping => now - ping.time < PING_DURATION);
    return this.pings;
  }

  /** The emote up over a champion, if any */
  getEmote(entityId: string, now = Date.now()): Emote | undefined {
    const emote = this.emotes.get(entityId);
    if (emote && now - emote.time >= EMOTE_DURATION) {
      this.emotes.delete(entityId);
      return undefined;
    }
    return emote;
  }
}
