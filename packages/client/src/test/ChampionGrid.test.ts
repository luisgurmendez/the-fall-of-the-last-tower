/**
 * Champion select's grid (src/ui/matchmaking/championGrid.ts): the cards
 * wrap into rows of at most CHAMPIONS_PER_ROW, as even as they can be
 * (17 champions are rows of 9 and 8, not 10 and 7, and never 16 and 1).
 */
import { describe, it, expect } from 'bun:test';
import { CHAMPIONS_PER_ROW, championGridColumns } from '@/ui/matchmaking/championGrid';

describe('championGridColumns', () => {
  it('one row while they fit', () => {
    expect(CHAMPIONS_PER_ROW).toBe(10);
    for (let count = 1; count <= CHAMPIONS_PER_ROW; count++) expect(championGridColumns(count)).toBe(count);
  });

  it('even rows past that', () => {
    expect(championGridColumns(11)).toBe(6);
    expect(championGridColumns(16)).toBe(8);
    expect(championGridColumns(17)).toBe(9);
    expect(championGridColumns(20)).toBe(10);
    expect(championGridColumns(21)).toBe(7);
    expect(championGridColumns(30)).toBe(10);
    expect(championGridColumns(31)).toBe(8);
  });

  it('no champions: one column, not zero', () => {
    expect(championGridColumns(0)).toBe(1);
  });

  it('for any count: no row too long, no extra row, the last row not much shorter', () => {
    for (let count = 1; count <= 200; count++) {
      const columns = championGridColumns(count);
      const rows = Math.ceil(count / columns);
      expect(columns).toBeLessThanOrEqual(CHAMPIONS_PER_ROW);
      expect(rows).toBe(Math.ceil(count / CHAMPIONS_PER_ROW));
      const lastRow = count - (rows - 1) * columns;
      expect(lastRow).toBeGreaterThan(0);
      expect(columns - lastRow).toBeLessThan(rows);
    }
  });
});
