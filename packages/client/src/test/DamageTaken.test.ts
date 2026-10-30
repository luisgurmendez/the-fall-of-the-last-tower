/**
 * The death recap's damage log (src/core/state/damageTaken.ts): damage over
 * the last 10 seconds by source, biggest first, with the last hitter.
 */
import { describe, it, expect } from 'bun:test';
import { DamageTaken } from '@/core/state/damageTaken';

describe('DamageTaken', () => {
  it('sums damage by source and type, biggest first, last hitter as killer', () => {
    const log = new DamageTaken();
    log.record('Tower', 150, 'physical', 1000);
    log.record('Vile', 120, 'physical', 2000);
    log.record('Vile', 90, 'magic', 3000);
    log.record('Minions', 20, 'physical', 4000);

    const recap = log.recap(4000);
    expect(recap.killer).toBe('Minions');
    expect(recap.lines.map(line => [line.source, line.total])).toEqual([['Vile', 210], ['Tower', 150], ['Minions', 20]]);
    expect(recap.lines[0].byType).toEqual({ physical: 120, magic: 90 });
  });

  it('forgets damage older than 10 seconds', () => {
    const log = new DamageTaken();
    log.record('Tower', 150, 'physical', 0);
    log.record('Vile', 50, 'magic', 9000);
    expect(log.recap(12_000).lines.map(line => line.source)).toEqual(['Vile']);
    expect(log.recap(30_000)).toEqual({ killer: null, lines: [] });
  });
});
