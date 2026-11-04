/**
 * Plays the server's state updates out at the pace it sent them, a little
 * behind. Over the internet they don't arrive every 33 ms: one comes late and
 * the next ones right after it (a WebSocket keeps them in order), so applied
 * as they arrive, units stall and then jump. Each update is applied at its
 * tick's time plus a delay instead: as long as the connection needs, measured
 * from how late recent updates came (a few ms on a steady connection, up to
 * INTERPOLATION_DELAY on a jittery one). An update later than that is applied
 * as soon as it arrives.
 *
 * Whole updates are delayed, not just positions: what an update brings (a hit,
 * its damage number, a death) stays in step with where the units are drawn.
 */

import { GameConfig } from '@siege/shared';

const TICK_MS = 1000 / GameConfig.TICK.SERVER_TICK_RATE;
/** The least delay: the few ms a steady connection varies, and frame timing */
export const PLAYOUT_MIN_DELAY_MS = 20;
/** The most: an update later than this is applied as it arrives */
export const PLAYOUT_MAX_DELAY_MS = GameConfig.NETWORK.INTERPOLATION_DELAY;
/** The most updates kept waiting (a second): past that the oldest are applied at once (a hidden tab runs no frames) */
export const PLAYOUT_MAX_WAITING = GameConfig.TICK.SERVER_TICK_RATE;
/** Recent arrivals the delay is measured over (3 s) */
const LATENESS_WINDOW = 90;
/** The delay covers all of them but the latest 5% */
const LATENESS_PERCENTILE = 0.95;
/** Added to how late they came */
const DELAY_MARGIN_MS = 5;
/**
 * How fast the earliest arrival time drifts up without arrivals that early
 * (ms per ms), so it follows a server whose ticks run slower than 33 ms
 */
const FLOOR_RISE = 0.05;
/** While the delay changes, the playout runs this much faster or slower than real time */
const SLEW = 0.1;

export class StatePlayout<T extends { tick: number }> {
  /** Updates waiting for their time, in tick order */
  private readonly queue: T[] = [];
  /**
   * The earliest an update arrives after its tick (arrival - tick time, ms):
   * the network's own delay and the clocks' offset, without the jitter
   */
  private floor: number | null = null;
  private floorAt = 0;
  /** How late each recent update arrived past the floor (ms) */
  private readonly lateness: number[] = [];
  /** Tick t is applied at t * TICK_MS + offset (local ms); null until the first update */
  private offset: number | null = null;
  private lastDue: number | null = null;

  /**
   * An update arrived at `now`. Returns the ones to apply right away: the
   * oldest, when more than PLAYOUT_MAX_WAITING are waiting.
   */
  receive(update: T, now: number): T[] {
    const arrival = now - update.tick * TICK_MS;
    this.floor = this.floor === null ? arrival : Math.min(this.floor + FLOOR_RISE * (now - this.floorAt), arrival);
    this.floorAt = now;
    this.lateness.push(arrival - this.floor);
    if (this.lateness.length > LATENESS_WINDOW) this.lateness.shift();
    if (this.offset === null) this.offset = this.targetOffset();

    let at = this.queue.length;
    while (at > 0 && this.queue[at - 1].tick > update.tick) at--;
    this.queue.splice(at, 0, update);

    return this.queue.length > PLAYOUT_MAX_WAITING ? this.queue.splice(0, this.queue.length - PLAYOUT_MAX_WAITING) : [];
  }

  /** The updates whose time has come by `now`, oldest first (once a frame) */
  due(now: number): T[] {
    if (this.offset === null) return [];
    // Toward the delay the connection needs, a little at a time: no jumps
    const step = this.lastDue === null ? 0 : SLEW * Math.max(0, now - this.lastDue);
    this.lastDue = now;
    const change = this.targetOffset() - this.offset;
    this.offset += Math.max(-step, Math.min(step, change));
    // Never more than the most delay, even if the floor just dropped (an
    // early arrival after a run of late ones): it catches up at once
    this.offset = Math.min(this.offset, (this.floor ?? 0) + PLAYOUT_MAX_DELAY_MS);

    const playing = (now - this.offset) / TICK_MS;
    let count = 0;
    while (count < this.queue.length && this.queue[count].tick <= playing) count++;
    return this.queue.splice(0, count);
  }

  /** Drop the waiting updates up to this tick (a full state covers them) */
  dropThrough(tick: number): void {
    let count = 0;
    while (count < this.queue.length && this.queue[count].tick <= tick) count++;
    this.queue.splice(0, count);
  }

  /** How many updates are waiting */
  waiting(): number {
    return this.queue.length;
  }

  /** How far behind the earliest arrivals updates are applied now (ms) */
  delay(): number {
    return this.offset === null || this.floor === null ? 0 : this.offset - this.floor;
  }

  /** Where the offset should be: the floor plus the delay the recent arrivals need */
  private targetOffset(): number {
    const sorted = [...this.lateness].sort((a, b) => a - b);
    const late = sorted[Math.floor(LATENESS_PERCENTILE * (sorted.length - 1))] ?? 0;
    const delay = Math.max(PLAYOUT_MIN_DELAY_MS, Math.min(PLAYOUT_MAX_DELAY_MS, late + DELAY_MARGIN_MS));
    return (this.floor ?? 0) + delay;
  }
}
