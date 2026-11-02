/**
 * A 5x7 pixel font for the title screen's logo (M and W are 7 wide):
 * capitals, digits and a few marks, drawn as masks (true where a pixel is
 * on) rather than with a web font, so the logo is the same pixels
 * everywhere and needs nothing loaded.
 */

/** A one-bit image: on[y * width + x] */
export interface Mask {
  width: number;
  height: number;
  on: Uint8Array;
}

export const GLYPH_HEIGHT = 7;

const GLYPHS: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#.....#", "##...##", "#.#.#.#", "#..#..#", "#.....#", "#.....#", "#.....#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#.....#", "#.....#", "#.....#", "#..#..#", "#.#.#.#", "##...##", "#.....#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

/** Whether the font draws this character (letters in either case) */
export function hasGlyph(char: string): boolean {
  return char.toUpperCase() in GLYPHS;
}

/**
 * A line of text as a mask, each font pixel `scale` pixels wide, `spacing`
 * font pixels between letters. Characters the font lacks are left blank.
 */
export function textMask(text: string, scale = 1, spacing = 1): Mask {
  const glyphs = [...text.toUpperCase()].map(char => GLYPHS[char] ?? GLYPHS[" "]);
  const fontWidth = Math.max(0, glyphs.reduce((sum, rows) => sum + rows[0].length + spacing, 0) - spacing);
  const width = fontWidth * scale;
  const height = GLYPH_HEIGHT * scale;
  const on = new Uint8Array(width * height);
  let left = 0;
  for (const rows of glyphs) {
    for (let gy = 0; gy < GLYPH_HEIGHT; gy++) {
      for (let gx = 0; gx < rows[gy].length; gx++) {
        if (rows[gy][gx] !== "#") continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            on[(gy * scale + sy) * width + (left + gx) * scale + sx] = 1;
          }
        }
      }
    }
    left += rows[0].length + spacing;
  }
  return { width, height, on };
}

/** A mask in bold: each pixel also on to its right and below, so thin gaps stay open */
export function embolden(mask: Mask): Mask {
  const { width, height, on } = mask;
  const bold = new Uint8Array(on.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!on[y * width + x]) continue;
      bold[y * width + x] = 1;
      if (x + 1 < width) bold[y * width + x + 1] = 1;
      if (y + 1 < height) bold[(y + 1) * width + x] = 1;
      if (x + 1 < width && y + 1 < height) bold[(y + 1) * width + x + 1] = 1;
    }
  }
  return { width, height, on: bold };
}

/** A mask grown by one pixel in every direction (diagonals too), on the same canvas */
export function dilate(mask: Mask): Mask {
  const { width, height, on } = mask;
  const grown = new Uint8Array(on.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!on[y * width + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) grown[ny * width + nx] = 1;
        }
      }
    }
  }
  return { width, height, on: grown };
}

/** A mask on a bigger canvas, `margin` pixels of space on every side */
export function pad(mask: Mask, margin: number): Mask {
  const width = mask.width + margin * 2;
  const height = mask.height + margin * 2;
  const on = new Uint8Array(width * height);
  for (let y = 0; y < mask.height; y++) {
    on.set(mask.on.subarray(y * mask.width, (y + 1) * mask.width), (y + margin) * width + margin);
  }
  return { width, height, on };
}
