import { describe, expect, it } from 'vitest';
import { verticalFacing } from './facing';

describe('four-direction facing', () => {
  it('faces up or down the screen toward what is clearly above or below', () => {
    expect(verticalFacing(0, -100, null)).toBe('north');
    expect(verticalFacing(20, 100, null)).toBe('south');
  });

  it('keeps the side view on diagonals', () => {
    expect(verticalFacing(100, 100, null)).toBeNull();
    expect(verticalFacing(-100, -110, null)).toBeNull();
  });

  it("doesn't flip back and forth near the diagonal", () => {
    // Turned down, it stays turned a little past the diagonal...
    expect(verticalFacing(100, 100, 'south')).toBe('south');
    // ...and turns back sideways once the target is clearly beside it
    expect(verticalFacing(100, 80, 'south')).toBeNull();
    // Turning around from up to down doesn't pass through sideways
    expect(verticalFacing(0, 100, 'north')).toBe('south');
  });
});
