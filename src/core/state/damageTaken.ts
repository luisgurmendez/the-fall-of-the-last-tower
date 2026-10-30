/**
 * Damage the local champion took in the last few seconds, by source, for
 * the death recap (src/ui/DeathOverlay.ts). gameEvents.ts records DAMAGE
 * events aimed at the local champion.
 */

export type DamageKind = 'physical' | 'magic' | 'true' | 'pure';

/** How far back the recap looks */
const WINDOW_MS = 10_000;

interface DamageTakenEntry {
  time: number;
  source: string;
  amount: number;
  damageType: DamageKind;
}

/** One source's damage in a death recap */
export interface RecapLine {
  source: string;
  total: number;
  byType: Partial<Record<DamageKind, number>>;
}

export interface DeathRecap {
  /** What dealt the last hit, if anything did recently */
  killer: string | null;
  /** Damage by source, biggest first */
  lines: RecapLine[];
}

export class DamageTaken {
  private entries: DamageTakenEntry[] = [];

  record(source: string, amount: number, damageType: DamageKind, now = Date.now()): void {
    this.entries.push({ time: now, source, amount, damageType });
    this.prune(now);
  }

  /**
   * The damage taken over the last 10 seconds.
   */
  recap(now = Date.now()): DeathRecap {
    this.prune(now);
    const bySource = new Map<string, RecapLine>();
    for (const entry of this.entries) {
      let line = bySource.get(entry.source);
      if (!line) {
        line = { source: entry.source, total: 0, byType: {} };
        bySource.set(entry.source, line);
      }
      line.total += entry.amount;
      line.byType[entry.damageType] = (line.byType[entry.damageType] ?? 0) + entry.amount;
    }
    return {
      killer: this.entries.length > 0 ? this.entries[this.entries.length - 1].source : null,
      lines: [...bySource.values()].sort((a, b) => b.total - a.total),
    };
  }

  private prune(now: number): void {
    const cutoff = now - WINDOW_MS;
    if (this.entries.length > 0 && this.entries[0].time < cutoff) {
      this.entries = this.entries.filter(entry => entry.time >= cutoff);
    }
  }
}
