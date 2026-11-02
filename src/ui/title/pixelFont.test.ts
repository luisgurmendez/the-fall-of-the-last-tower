import { describe, expect, it } from 'vitest';
import { GAME_NAME, GAME_TAGLINE } from '@/config/brand';
import { embolden, hasGlyph, textMask } from './pixelFont';

describe('title logo font', () => {
  it('draws every character of the game name', () => {
    // A rename to a name with a character the font lacks would leave a gap in the logo
    expect([...GAME_NAME].filter(char => !hasGlyph(char))).toEqual([]);
    expect([...GAME_TAGLINE].filter(char => !hasGlyph(char))).toEqual([]);
  });

  it('lays glyphs side by side, the wide ones wider', () => {
    // I is 5 wide, W 7, a pixel apart
    expect(textMask('I').width).toBe(5);
    expect(textMask('IW').width).toBe(13);
    expect(textMask('IW', 2, 2).width).toBe((5 + 2 + 7) * 2);
    expect(textMask('IW', 2).height).toBe(14);
  });

  it('keeps one-pixel gaps open in bold', () => {
    // Two strokes two pixels apart stay apart
    const mask = { width: 6, height: 1, on: Uint8Array.from([1, 0, 0, 1, 0, 0]) };
    expect([...embolden(mask).on]).toEqual([1, 1, 0, 1, 1, 0]);
  });
});
