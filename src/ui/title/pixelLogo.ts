/**
 * The title screen's logo: the game's name in chunky gold pixel letters
 * under a jeweled crown, drawn on a small canvas the page scales up with
 * crisp pixels. The letters are the 5x7 font (pixelFont.ts) doubled and
 * made bold, the crown doubled too, banded from pale to deep gold with a lit top edge, ringed in
 * two dark outlines over a drop shadow. The still logo is drawn once; every
 * frame it bobs a pixel, a shine sweeps across it now and then, and
 * sparkles twinkle on its edges.
 */

import { dilate, embolden, pad, textMask, type Mask } from "./pixelFont";

type Rgba = readonly [number, number, number, number];

/** The crown over the name: g/G emerald, r/R ruby, Y/y gold, d dark gold */
const CROWN = [
  "..g.......r.......g..",
  ".gGg.....rRr.....gGg.",
  "..G.......R.......G..",
  "..Y.......Y.......Y..",
  "..YY.....YYY.....YY..",
  "..YyY...YyyyY...YyY..",
  "..YyyY.YyyyyyY.YyyY..",
  "..YyyyyyyyyyyyyyyyY..",
  "..ddddddddddddddddd..",
  "..YyRyYyGyYyGyYyRyY..",
  "..ddddddddddddddddd..",
];

const CROWN_COLORS: Record<string, Rgba> = {
  g: [157, 255, 200, 255],
  G: [31, 191, 106, 255],
  r: [255, 163, 181, 255],
  R: [224, 40, 72, 255],
  Y: [255, 216, 74, 255],
  y: [232, 163, 23, 255],
  d: [168, 98, 12, 255],
};

/** The letters' gold, top to bottom */
const GOLD_BANDS: Rgba[] = [
  [255, 243, 192, 255],
  [255, 224, 112, 255],
  [255, 204, 51, 255],
  [245, 170, 34, 255],
  [224, 132, 26, 255],
  [192, 98, 15, 255],
];
const GOLD_LIGHT: Rgba = [255, 251, 232, 255];
const GOLD_DARK: Rgba = [138, 63, 8, 255];
const OUTLINE_INNER: Rgba = [58, 18, 32, 255];
const OUTLINE_OUTER: Rgba = [14, 4, 18, 255];
const SHADOW: Rgba = [8, 2, 20, 140];

/** The letters and the crown are drawn this many logo pixels per pixel */
const SCALE = 2;
/** Room around the logo for its outlines and sparkles */
const MARGIN = 5;
/** Rows between the crown and the name: the outlines join them */
const CROWN_GAP = 2;
const SHADOW_DROP = 3;
/** The shine crosses in this long, every this long */
const SHINE_SECONDS = 1.1;
const SHINE_EVERY = 4.5;
/** How much the shine leans */
const SHINE_SLANT = 0.7;
/** A sparkle every this long, lasting this long */
const SPARKLE_EVERY = 0.55;
const SPARKLE_LIFE = 0.5;

interface Sparkle {
  x: number;
  y: number;
  born: number;
}

export class PixelLogo {
  /** The logo at its own pixel size: scale it up with CSS */
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  private readonly ctx: CanvasRenderingContext2D;
  /** The still logo */
  private readonly still: HTMLCanvasElement;
  /** The letters' and crown's pixels (x, y pairs), for the shine */
  private readonly body: Int16Array;
  /** Their edge pixels, where sparkles appear */
  private readonly edges: Int16Array;
  private sparkles: Sparkle[] = [];
  private lastSparkle = 0;

  constructor(name: string) {
    const letters = embolden(pad(textMask(name, SCALE, 2), MARGIN));
    const crownWidth = CROWN[0].length * SCALE;
    const crownHeight = CROWN.length * SCALE;
    const width = Math.max(letters.width, crownWidth + MARGIN * 2);
    const top = MARGIN + crownHeight + CROWN_GAP;
    const letterX = Math.floor((width - letters.width) / 2);
    const letterY = top - MARGIN;
    // One spare row at the bottom for the bob
    const height = letterY + letters.height + SHADOW_DROP + 1;
    this.width = width;
    this.height = height;

    const colors: (Rgba | null)[] = new Array(width * height).fill(null);
    const isLetter = (x: number, y: number) => {
      const lx = x - letterX;
      const ly = y - letterY;
      return lx >= 0 && ly >= 0 && lx < letters.width && ly < letters.height && letters.on[ly * letters.width + lx] === 1;
    };
    // The letters (bold, a pixel past the glyphs' bottom), banded
    const letterTop = top;
    const letterHeight = letters.height - MARGIN * 2 + 1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isLetter(x, y)) continue;
        const band = Math.min(GOLD_BANDS.length - 1, Math.max(0, Math.floor(((y - letterTop) / letterHeight) * GOLD_BANDS.length)));
        colors[y * width + x] = !isLetter(x, y - 1) ? GOLD_LIGHT : !isLetter(x, y + 1) ? GOLD_DARK : GOLD_BANDS[band];
      }
    }
    // The crown, centered over them
    const crownX = Math.floor((width - crownWidth) / 2);
    for (let cy = 0; cy < crownHeight; cy++) {
      for (let cx = 0; cx < crownWidth; cx++) {
        const char = CROWN[Math.floor(cy / SCALE)][Math.floor(cx / SCALE)];
        if (char !== ".") colors[(MARGIN + cy) * width + crownX + cx] = CROWN_COLORS[char];
      }
    }

    // Two outline rings around both, over a drop shadow
    const bodyMask: Mask = { width, height, on: Uint8Array.from(colors, color => (color ? 1 : 0)) };
    const ring1 = dilate(bodyMask);
    const ring2 = dilate(ring1);
    this.still = document.createElement("canvas");
    this.still.width = width;
    this.still.height = height;
    const stillCtx = this.still.getContext("2d")!;
    const image = stillCtx.createImageData(width, height);
    const put = (i: number, color: Rgba) => image.data.set(color, i * 4);
    for (let i = 0; i < colors.length; i++) {
      const below = i - SHADOW_DROP * width;
      if (below >= 0 && ring2.on[below]) put(i, SHADOW);
    }
    const body: number[] = [];
    const edges: number[] = [];
    for (let i = 0; i < colors.length; i++) {
      const color = colors[i];
      if (color) {
        put(i, color);
        const x = i % width;
        const y = Math.floor(i / width);
        body.push(x, y);
        const onEdge = !bodyMask.on[i - width] || !bodyMask.on[i + width] || !bodyMask.on[i - 1] || !bodyMask.on[i + 1];
        if (onEdge) edges.push(x, y);
      } else if (ring1.on[i]) {
        put(i, OUTLINE_INNER);
      } else if (ring2.on[i]) {
        put(i, OUTLINE_OUTER);
      }
    }
    stillCtx.putImageData(image, 0, 0);
    this.body = Int16Array.from(body);
    this.edges = Int16Array.from(edges);

    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d")!;
  }

  /** Draw the logo `time` seconds into the title screen */
  draw(time: number): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    // A slow one-pixel bob
    const bob = Math.sin(time * 1.6) > 0.35 ? 1 : 0;
    ctx.drawImage(this.still, 0, bob);

    // The shine: a slanted band crossing left to right
    const cycle = time % SHINE_EVERY;
    if (cycle < SHINE_SECONDS) {
      const at = -20 + (cycle / SHINE_SECONDS) * (this.width + 40);
      for (let k = 0; k < this.body.length; k += 2) {
        const x = this.body[k];
        const y = this.body[k + 1];
        const along = Math.abs(x - y * SHINE_SLANT - at);
        if (along >= 3) continue;
        ctx.fillStyle = along < 1.2 ? "#ffffff" : "rgba(255, 255, 240, 0.5)";
        ctx.fillRect(x, y + bob, 1, 1);
      }
    }
    this.drawSparkles(time, bob);
  }

  /** Four-pointed twinkles that appear on the logo's edge, grow and fade */
  private drawSparkles(time: number, bob: number): void {
    if (time - this.lastSparkle > SPARKLE_EVERY && this.edges.length) {
      this.lastSparkle = time;
      const k = Math.floor(Math.random() * (this.edges.length / 2)) * 2;
      this.sparkles.push({ x: this.edges[k], y: this.edges[k + 1], born: time });
    }
    this.sparkles = this.sparkles.filter(sparkle => time - sparkle.born < SPARKLE_LIFE);
    const { ctx } = this;
    for (const sparkle of this.sparkles) {
      const arm = Math.round(Math.sin(((time - sparkle.born) / SPARKLE_LIFE) * Math.PI) * 2);
      const y = sparkle.y + bob;
      ctx.fillStyle = "rgba(255, 250, 210, 0.9)";
      for (let d = 1; d <= arm; d++) {
        ctx.fillRect(sparkle.x + d, y, 1, 1);
        ctx.fillRect(sparkle.x - d, y, 1, 1);
        ctx.fillRect(sparkle.x, y + d, 1, 1);
        ctx.fillRect(sparkle.x, y - d, 1, 1);
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(sparkle.x, y, 1, 1);
    }
  }
}
