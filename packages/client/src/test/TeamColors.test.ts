/**
 * The red team's recolor (src/render/entities/teamColors.ts): color
 * conversions round-trip, and a team blue lands on a red.
 */
import { describe, it, expect } from 'bun:test';
import { hsvToRgb, rgbToHsv } from '@/render/entities/teamColors';

describe('team color conversions', () => {
  it('round-trips colors', () => {
    for (const color of [[30, 90, 220], [200, 40, 40], [120, 120, 120], [250, 220, 10]] as const) {
      const [h, s, v] = rgbToHsv(...color);
      expect(hsvToRgb(h, s, v)).toEqual([...color]);
    }
  });

  it('turns a royal blue red', () => {
    const [h, s, v] = rgbToHsv(40, 80, 210);
    const [r, g, b] = hsvToRgb((h + 140) % 360, s, v);
    expect(r).toBeGreaterThan(150);
    expect(Math.max(g, b)).toBeLessThan(110);
  });
});
