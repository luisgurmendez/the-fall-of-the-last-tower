/**
 * Champion select's ability tooltips (src/ui/matchmaking/abilityDialog.ts):
 * a tooltip shown above its icon moves down to stay inside what shows it (the
 * screen, or the box that clips it), and one taller than that fits it and
 * scrolls; a slot whose ability is
 * swapped for a while (Nocthar's colossus) names what it becomes.
 */
import { describe, it, expect } from 'bun:test';
import { fitDialog, swapFor } from '@/ui/matchmaking/abilityDialog';

/** A tooltip measured at `top`, `height` tall, 540 wide from x 100 */
const box = (top: number, height: number) => ({ top, height, left: 100, width: 540 });
const screen = (height: number) => ({ top: 0, bottom: height, left: 0, right: 1400 });

describe('fitDialog', () => {
  it('fits above its icon: stays where it is', () => {
    expect(fitDialog(box(120, 300), screen(900), 8)).toEqual({ shift: 0, shiftX: 0, maxHeight: null });
  });

  it('goes over the top: moves down to the margin', () => {
    expect(fitDialog(box(-150, 500), screen(900), 8)).toEqual({ shift: 158, shiftX: 0, maxHeight: null });
  });

  it('exactly at the margin: no move', () => {
    expect(fitDialog(box(8, 500), screen(900), 8)).toEqual({ shift: 0, shiftX: 0, maxHeight: null });
  });

  it('taller than the screen: as tall as fits, its top at the margin', () => {
    // Its bottom stays over the icon (at 600): capped to 684 its top is at -84
    expect(fitDialog(box(-600, 1200), screen(700), 8)).toEqual({ shift: 92, shiftX: 0, maxHeight: 684 });
  });
});

describe('fitDialog inside a box that clips it', () => {
  it("goes over the box's top: moves down to it", () => {
    // The box shows y 59 to 803
    expect(fitDialog(box(5, 600), { top: 59, bottom: 803, left: 0, right: 1400 }, 8)).toEqual({ shift: 62, shiftX: 0, maxHeight: null });
  });

  it('taller than the box: as tall as the box allows, inside it', () => {
    // Capped to 628 it hangs from 638, its top at 10: down to 67 (the box's top and the margin)
    expect(fitDialog(box(-100, 738), { top: 59, bottom: 703, left: 0, right: 1400 }, 8)).toEqual({ shift: 57, shiftX: 0, maxHeight: 628 });
  });
});

describe('fitDialog sideways', () => {
  it("past the box's right edge: moves left to fit", () => {
    // 540 wide from 680 ends at 1220; the box ends at 1180
    expect(fitDialog({ top: 100, height: 300, left: 680, width: 540 }, { top: 0, bottom: 900, left: 300, right: 1180 }, 8).shiftX).toBe(-48);
  });

  it("wider than the box: its left edge at the box's", () => {
    expect(fitDialog({ top: 100, height: 300, left: 400, width: 900 }, { top: 0, bottom: 900, left: 300, right: 1000 }, 8).shiftX).toBe(-92);
  });

  it('inside: no move', () => {
    expect(fitDialog({ top: 100, height: 300, left: 400, width: 500 }, { top: 0, bottom: 900, left: 300, right: 1000 }, 8).shiftX).toBe(0);
  });
});

describe('swapFor', () => {
  const champion = { swapAbilities: { W: 'nocthar_colossus_w', R: 'nocthar_colossus_r' }, swapLabel: 'With the colossus' };

  it('a swapped slot: what it becomes, and when', () => {
    expect(swapFor(champion, 'W')).toEqual({ label: 'With the colossus', abilityId: 'nocthar_colossus_w' });
    expect(swapFor(champion, 'R')?.abilityId).toBe('nocthar_colossus_r');
  });

  it('a slot that is never swapped: nothing', () => {
    expect(swapFor(champion, 'Q')).toBeNull();
    expect(swapFor(champion, 'E')).toBeNull();
  });

  it('a champion without swaps: nothing', () => {
    expect(swapFor({}, 'W')).toBeNull();
  });

  it('without a label: a plain one', () => {
    expect(swapFor({ swapAbilities: { E: 'x' } }, 'E')).toEqual({ label: 'Swapped in', abilityId: 'x' });
  });
});
