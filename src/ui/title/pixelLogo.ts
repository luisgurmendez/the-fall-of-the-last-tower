/**
 * The title screen's logo: an emblem (a shield split blue and red, the two
 * sides, over two crossed swords) beside the game's name, drawn on a small
 * canvas the page scales up with crisp pixels. A two-word name takes two
 * lines: the first word small in striped steel, the last big in gold. The
 * letters are the 5x7 font (pixelFont.ts) scaled up and made bold, banded
 * from light to dark with a lit top edge; everything is ringed in two dark
 * outlines over a drop shadow. The still logo is drawn once; every frame it
 * bobs a pixel, a shine sweeps across it now and then, and sparkles twinkle
 * on its edges. The emblem alone is the page's icon (iconURL).
 */

import { dilate, embolden, pad, textMask, type Mask } from "./pixelFont";

type Rgba = readonly [number, number, number, number];

/**
 * The emblem: B/b blue and R/r red halves, a gold rim (Y/y/d) with a white
 * diamond (W) on the seam, the swords' gold guards, grips (w) and pommels
 * above and their blades' tips (s/S) below
 */
const EMBLEM = [
  "Y.................Y",
  ".w...d.......d...w.",
  "..w.y.........y.w..",
  "...Y...........Y...",
  "..yYYYYYYYYYYYYyy..",
  ".d.YBBBBByRRRRRy.d.",
  "...YBBBBBYRRRRRy...",
  "...YBBBBYWYRRRRy...",
  "...YBBBYWWWYRRRy...",
  "...YBBBBYWYRRRRy...",
  "...YBBBBBYRRRRRy...",
  "...YbBBBByRRRRry...",
  "....YbBBByRRRry....",
  "....YbbBByRRrry....",
  "...SsYbbbyrrrysS...",
  "..Ss..Ybbyrry..sS..",
  ".Ss....Ybyry....sS.",
  ".s.......d.......s.",
  "...................",
];

const EMBLEM_COLORS: Record<string, Rgba> = {
  B: [74, 144, 255, 255],
  b: [36, 78, 178, 255],
  R: [240, 72, 84, 255],
  r: [156, 28, 48, 255],
  Y: [255, 216, 74, 255],
  y: [232, 163, 23, 255],
  d: [168, 98, 12, 255],
  W: [255, 252, 236, 255],
  s: [236, 244, 255, 255],
  S: [140, 158, 190, 255],
  w: [122, 68, 36, 255],
};

/** How a line of the name is painted: bands top to bottom, its lit top and dark bottom edges */
interface Paint {
  bands: Rgba[];
  light: Rgba;
  dark: Rgba;
  /** Dark stripes across the lower half, every this many rows (0: none) */
  stripes: number;
}

/** The last word: gold */
const GOLD: Paint = {
  bands: [
    [255, 243, 192, 255],
    [255, 224, 112, 255],
    [255, 204, 51, 255],
    [245, 170, 34, 255],
    [224, 132, 26, 255],
    [192, 98, 15, 255],
  ],
  light: [255, 251, 232, 255],
  dark: [138, 63, 8, 255],
  stripes: 0,
};

/** The words before it: striped steel, like an old arcade cabinet's */
const STEEL: Paint = {
  bands: [
    [240, 246, 255, 255],
    [206, 222, 244, 255],
    [168, 190, 224, 255],
    [130, 152, 196, 255],
    [98, 116, 164, 255],
  ],
  light: [255, 255, 255, 255],
  dark: [56, 64, 108, 255],
  stripes: 4,
};

const OUTLINE_INNER: Rgba = [58, 18, 32, 255];
const OUTLINE_OUTER: Rgba = [14, 4, 18, 255];
const SHADOW: Rgba = [8, 2, 20, 140];

/** The emblem is drawn this many logo pixels per pixel */
const EMBLEM_SCALE = 2;
/** The first words' letters and the last word's, in logo pixels per font pixel */
const SMALL_SCALE = 2;
const BIG_SCALE = 3;
/** Font pixels between the first words' letters (wider than the last word's) */
const SMALL_SPACING = 2;
/** Room around the logo for its outlines and sparkles */
const MARGIN = 5;
/** Between the emblem and the name, and between the name's lines */
const EMBLEM_GAP = 6;
const LINE_GAP = 3;
const SHADOW_DROP = 3;
/** The page's icon is this many pixels square */
const ICON_SIZE = 48;
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
  /** Where the emblem is on it (its top left; it's square) */
  private readonly emblemAt: { x: number; y: number; size: number };
  /** The emblem's and letters' pixels (x, y pairs), for the shine */
  private readonly body: Int16Array;
  /** Their edge pixels, where sparkles appear */
  private readonly edges: Int16Array;
  private sparkles: Sparkle[] = [];
  private lastSparkle = 0;

  constructor(name: string) {
    const words = name.split(" ");
    const last = words.pop() ?? "";
    // Bold letters spill a pixel right and down: one pixel of room for it
    const big = embolden(pad(textMask(last, BIG_SCALE), 1));
    const small = words.length ? embolden(pad(textMask(words.join(" "), SMALL_SCALE, SMALL_SPACING), 1)) : null;
    const nameWidth = Math.max(big.width, small?.width ?? 0);
    const nameHeight = big.height + (small ? small.height + LINE_GAP : 0);
    const emblemSize = EMBLEM.length * EMBLEM_SCALE;
    const content = Math.max(emblemSize, nameHeight);

    const width = MARGIN + emblemSize + EMBLEM_GAP + nameWidth + MARGIN;
    // Room below for the shadow, and one spare row for the bob
    const height = MARGIN + content + MARGIN + SHADOW_DROP + 1;
    this.width = width;
    this.height = height;
    const colors: (Rgba | null)[] = new Array(width * height).fill(null);

    // The emblem on the left, centered on the name
    const emblemX = MARGIN;
    const emblemY = MARGIN + Math.floor((content - emblemSize) / 2);
    this.emblemAt = { x: emblemX, y: emblemY, size: emblemSize };
    for (let ey = 0; ey < emblemSize; ey++) {
      for (let ex = 0; ex < emblemSize; ex++) {
        const char = EMBLEM[Math.floor(ey / EMBLEM_SCALE)][Math.floor(ex / EMBLEM_SCALE)];
        if (char !== ".") colors[(emblemY + ey) * width + emblemX + ex] = EMBLEM_COLORS[char];
      }
    }

    // The name on the right: the first words centered over the last
    const nameX = emblemX + emblemSize + EMBLEM_GAP;
    let lineY = MARGIN + Math.floor((content - nameHeight) / 2);
    if (small) {
      paintLine(colors, width, small, nameX + Math.floor((nameWidth - small.width) / 2), lineY, STEEL);
      lineY += small.height + LINE_GAP;
    }
    paintLine(colors, width, big, nameX + Math.floor((nameWidth - big.width) / 2), lineY, GOLD);

    // Two outline rings around it all, over a drop shadow
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

  /** The emblem with its outlines, as an image URL for the page's icon */
  iconURL(): string {
    const icon = document.createElement("canvas");
    icon.width = ICON_SIZE;
    icon.height = ICON_SIZE;
    const ctx = icon.getContext("2d")!;
    // The outlines reach two pixels past the emblem
    const { x, y, size } = this.emblemAt;
    const from = size + 4;
    const scale = Math.max(1, Math.floor(ICON_SIZE / from));
    const at = Math.floor((ICON_SIZE - from * scale) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.still, x - 2, y - 2, from, from, at, at, from * scale, from * scale);
    return icon.toDataURL("image/png");
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

/** Paint a line of letters (a mask) at (left, top) of the logo, banded, edged and maybe striped */
function paintLine(colors: (Rgba | null)[], width: number, mask: Mask, left: number, top: number, paint: Paint): void {
  const isOn = (x: number, y: number) => x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.on[y * mask.width + x] === 1;
  // The letters span the mask but its one-pixel room above
  const letterHeight = mask.height - 1;
  const half = Math.floor(letterHeight / 2);
  for (let y = 0; y < mask.height; y++) {
    const row = y - 1;
    if (paint.stripes && row > half && (row - half) % paint.stripes === 0) continue;
    for (let x = 0; x < mask.width; x++) {
      if (!isOn(x, y)) continue;
      const band = Math.min(paint.bands.length - 1, Math.max(0, Math.floor((row / letterHeight) * paint.bands.length)));
      const color = !isOn(x, y - 1) ? paint.light : !isOn(x, y + 1) ? paint.dark : paint.bands[band];
      colors[(top + y) * width + left + x] = color;
    }
  }
}
