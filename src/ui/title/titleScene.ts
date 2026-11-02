/**
 * The title screen's backdrop: a valley at dusk in pixel art, drawn at a low
 * resolution and scaled up with crisp pixels, the view panning slowly so its
 * layers slide past each other (parallax).
 *
 * Back to front: a dithered dusk sky with twinkling stars, a haloed moon,
 * light rays and now and then a shooting star; drifting clouds; snowy far
 * mountains; nearer ridges with a castle whose crystal shines a beam into
 * the sky; a pink mist; a pine forest; the grassy ground where the
 * champions march (titleParade.ts, drawn by TitleScreen between the layers);
 * fireflies; and swaying grass and bushes in front of it all.
 *
 * Everything static is drawn once per size into layer canvases; a frame
 * only places them and draws the few moving pixels.
 */

/** About this many scene pixels from top to bottom; each is several screen pixels */
const SCENE_ROWS = 280;
/** How fast the view pans, in scene pixels a second at the ground */
export const CAMERA_SPEED = 4;
/** Where the ground starts, as a share of the height */
export const GROUND_LINE = 0.875;

type Rgb = readonly [number, number, number];

/** The sky from top to the horizon, and where each color is (share of the height) */
const SKY: { at: number; color: Rgb }[] = [
  { at: 0, color: [10, 9, 34] },
  { at: 0.22, color: [22, 19, 60] },
  { at: 0.4, color: [43, 30, 86] },
  { at: 0.54, color: [86, 40, 106] },
  { at: 0.64, color: [150, 60, 106] },
  { at: 0.72, color: [214, 100, 94] },
  { at: 0.8, color: [242, 152, 92] },
];
/** How many flat bands each step of the sky has, dithered into each other */
const SKY_BANDS = 4;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER4[(y & 3) * 4 + (x & 3)];

const MOON_LIGHT: Rgb = [255, 241, 207];
const MOON_SHADE: Rgb = [236, 212, 160];
const MOON_CRATER: Rgb = [222, 192, 140];
const MOON_GLOW: Rgb = [250, 214, 170];

interface Ridge {
  canvas: HTMLCanvasElement;
  /** How fast it slides compared with the ground */
  factor: number;
  heights: Int16Array;
}

interface Star {
  x: number;
  y: number;
  phase: number;
  speed: number;
  bright: boolean;
  color: string;
}

interface Cloud {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  speed: number;
}

interface Firefly {
  x: number;
  y: number;
  phase: number;
  front: boolean;
}

interface ShootingStar {
  x: number;
  y: number;
  born: number;
}

/** A seeded random generator (mulberry32), so the valley is the same every time */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const css = ([r, g, b]: Rgb, alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function layer(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d")!];
}

export class TitleScene {
  /** The scene's size in its own pixels */
  width = 0;
  height = 0;
  /** Screen pixels per scene pixel */
  pixel = 1;
  /** The back layers (sky to ground) and the front ones (grass, near fireflies), composed each frame */
  readonly back: HTMLCanvasElement;
  readonly front: HTMLCanvasElement;
  private readonly backCtx: CanvasRenderingContext2D;
  private readonly frontCtx: CanvasRenderingContext2D;
  /** The width the sliding layers repeat over */
  private period = 0;
  private sky!: HTMLCanvasElement;
  private ridges: Ridge[] = [];
  private ground!: Ridge;
  private bushes!: HTMLCanvasElement;
  private stars: Star[] = [];
  private clouds: Cloud[] = [];
  private fireflies: Firefly[] = [];
  private moon = { x: 0, y: 0, radius: 0 };
  /** The castle's crystal, on the second ridge's canvas */
  private beacon = { x: 0, y: 0 };
  private shootingStar: ShootingStar | null = null;
  private nextShootingStar = 4;

  constructor() {
    [this.back, this.backCtx] = layer(1, 1);
    [this.front, this.frontCtx] = layer(1, 1);
  }

  /** Where the ground is, in scene pixels from the top */
  get groundY(): number {
    return Math.round(this.height * GROUND_LINE);
  }

  /** Fit the scene to a screen this many device pixels across */
  resize(screenWidth: number, screenHeight: number): void {
    this.pixel = Math.max(2, Math.round(screenHeight / SCENE_ROWS));
    this.width = Math.ceil(screenWidth / this.pixel);
    this.height = Math.ceil(screenHeight / this.pixel);
    this.period = Math.ceil(Math.max(this.width, 320) / 8) * 8;
    this.back.width = this.front.width = this.width;
    this.back.height = this.front.height = this.height;
    const random = seeded(7);
    this.drawSky();
    this.makeStars(random);
    this.makeClouds(random);
    this.makeRidges(random);
    this.makeFireflies(random);
    this.bushes = this.drawBushes(random);
  }

  /** Draw the back and front layers `time` seconds in */
  render(time: number): void {
    const camera = time * CAMERA_SPEED;
    this.renderBack(time, camera);
    this.renderFront(time, camera);
  }

  // ===========================================================================
  // Drawn once per size
  // ===========================================================================

  /** The sky's dithered bands, the moon and its halo */
  private drawSky(): void {
    const { width, height } = this;
    const [canvas, ctx] = layer(width, height);
    const image = ctx.createImageData(width, height);
    this.moon = { x: Math.round(width * 0.2), y: Math.round(height * 0.2), radius: Math.max(8, Math.round(height * 0.055)) };
    const { x: mx, y: my, radius } = this.moon;
    const craters = [
      { x: -0.35, y: -0.2, r: 0.22 },
      { x: 0.25, y: 0.3, r: 0.16 },
      { x: 0.05, y: -0.45, r: 0.12 },
      { x: -0.1, y: 0.15, r: 0.1 },
    ];
    for (let y = 0; y < height; y++) {
      const share = y / height;
      let step = SKY.findIndex(stop => stop.at > share) - 1;
      if (step < 0) step = SKY.length - 2;
      const from = SKY[step];
      const to = SKY[Math.min(step + 1, SKY.length - 1)];
      const t = to.at === from.at ? 1 : Math.min(1, (share - from.at) / (to.at - from.at));
      for (let x = 0; x < width; x++) {
        // Flat bands dithered into each other
        const level = t * SKY_BANDS;
        const band = Math.floor(level) + (level - Math.floor(level) > bayer(x, y) ? 1 : 0);
        let color = mix(from.color, to.color, Math.min(1, band / SKY_BANDS));
        // The moon's halo, dithered too
        const d = Math.hypot(x - mx, y - my) / radius;
        if (d > 1 && d < 3.2) {
          const glow = ((3.2 - d) / 2.2) ** 2 * 0.8;
          if (glow > bayer(x + 1, y + 2)) color = mix(color, MOON_GLOW, 0.22);
          if (d < 1.6 && glow * 0.8 > bayer(x, y)) color = mix(color, MOON_GLOW, 0.3);
        }
        // The moon: shaded toward its lower right, a few craters
        if (d <= 1) {
          const dx = (x - mx) / radius;
          const dy = (y - my) / radius;
          color = dx * 0.7 + dy * 0.5 > 0.32 ? MOON_SHADE : MOON_LIGHT;
          if (craters.some(c => Math.hypot(dx - c.x, dy - c.y) < c.r)) color = MOON_CRATER;
        }
        image.data.set([color[0], color[1], color[2], 255], (y * width + x) * 4);
      }
    }
    ctx.putImageData(image, 0, 0);
    this.sky = canvas;
  }

  private makeStars(random: () => number): void {
    const count = Math.round((this.width * this.height) / 550);
    const colors = ["#ffffff", "#ffeab8", "#bcd4ff"];
    this.stars = Array.from({ length: count }, () => ({
      x: Math.floor(random() * this.width),
      y: Math.floor(random() ** 1.4 * this.height * 0.58),
      phase: random() * Math.PI * 2,
      speed: 0.6 + random() * 2.2,
      bright: random() < 0.06,
      color: colors[Math.floor(random() * colors.length)],
    })).filter(star => Math.hypot(star.x - this.moon.x, star.y - this.moon.y) > this.moon.radius * 2.2);
  }

  /** Puffy dusk clouds, lit from above, dark underneath */
  private makeClouds(random: () => number): void {
    this.clouds = Array.from({ length: 6 }, (_, i) => {
      const width = 28 + Math.floor(random() * 40);
      const height = 9 + Math.floor(random() * 8);
      const [canvas, ctx] = layer(width, height + 2);
      const puffs = Array.from({ length: 4 + Math.floor(random() * 4) }, () => ({
        x: width * (0.15 + random() * 0.7),
        y: height * (0.45 + random() * 0.4),
        r: height * (0.3 + random() * 0.35),
      }));
      const inside = (x: number, y: number) => y < height && puffs.some(p => Math.hypot((x - p.x) * 0.75, y - p.y) < p.r);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!inside(x, y)) continue;
          ctx.fillStyle = !inside(x, y - 1) ? "#6a4c8f" : !inside(x, y + 2) ? "#2a1d4c" : y < height * 0.55 ? "#4a3672" : "#382858";
          ctx.fillRect(x, y, 1, 1);
        }
      }
      return {
        canvas,
        x: random() * this.period,
        y: Math.round(this.height * (0.12 + i * 0.065 + random() * 0.04)),
        speed: 1.2 + random() * 2.5,
      };
    });
  }

  /** Heights along a ridge that repeat over the period, so it slides forever */
  private ridgeHeights(random: () => number, base: number, amplitude: number, roughness: number): Int16Array {
    const waves = [1, 2, 3, 5, 8, 13, 21].map(k => ({ k, a: 1 / k ** roughness, phase: random() * Math.PI * 2 }));
    const total = waves.reduce((sum, wave) => sum + wave.a, 0);
    return Int16Array.from({ length: this.period }, (_, x) => {
      const wave = waves.reduce((sum, w) => sum + w.a * Math.sin((2 * Math.PI * w.k * x) / this.period + w.phase), 0) / total;
      return Math.round(base - amplitude * wave);
    });
  }

  /** A ridge: its body, a moonlit rim on the slopes facing the moon (left), snow on the peaks */
  private drawRidge(heights: Int16Array, body: string, rim: string, lit: string, snowLine: number | null): HTMLCanvasElement {
    const [canvas, ctx] = layer(this.period, this.height);
    for (let x = 0; x < this.period; x++) {
      const top = heights[x];
      const rising = top < heights[(x - 1 + this.period) % this.period];
      ctx.fillStyle = body;
      ctx.fillRect(x, top, 1, this.height - top);
      ctx.fillStyle = rising ? lit : rim;
      ctx.fillRect(x, top, 1, rising ? 3 : 1);
      if (snowLine !== null && top < snowLine) {
        ctx.fillStyle = rising ? "#e9e0ff" : "#a99ad6";
        ctx.fillRect(x, top, 1, Math.min(4, snowLine - top));
      }
    }
    return canvas;
  }

  private makeRidges(random: () => number): void {
    const h = this.height;
    const far = this.ridgeHeights(random, h * 0.6, h * 0.17, 0.75);
    const mid = this.ridgeHeights(random, h * 0.7, h * 0.08, 0.9);
    const forest = this.ridgeHeights(random, h * 0.79, h * 0.03, 1.2);
    const ground = this.ridgeHeights(random, this.groundY, 1.2, 1.5);

    const farCanvas = this.drawRidge(far, "#2a2154", "#3c3070", "#55479a", Math.round(h * 0.5));
    const midCanvas = this.drawRidge(mid, "#1c1641", "#2a2160", "#3d3184", null);
    this.drawCastle(midCanvas, mid);
    const forestCanvas = this.drawRidge(forest, "#120d29", "#1e1744", "#2a2158", null);
    this.drawPines(forestCanvas, forest, random);
    const groundCanvas = this.drawGround(ground, random);

    this.ridges = [
      { canvas: farCanvas, factor: 0.06, heights: far },
      { canvas: midCanvas, factor: 0.14, heights: mid },
      { canvas: forestCanvas, factor: 0.35, heights: forest },
    ];
    this.ground = { canvas: groundCanvas, factor: 1, heights: ground };
  }

  /** A castle on the second ridge: a keep between two towers and a spire with the crystal on top */
  private drawCastle(canvas: HTMLCanvasElement, heights: Int16Array): void {
    const ctx = canvas.getContext("2d")!;
    // Off to the right, away from the logo and the menu (it drifts very slowly)
    const cx = Math.round(this.period * 0.8);
    // On the lowest ground under it, so it doesn't float
    let base = 0;
    for (let x = cx - 16; x <= cx + 16; x++) base = Math.max(base, heights[(x + this.period) % this.period]);
    const body = "#1c1641";
    const lit = "#3d3184";
    const rect = (x: number, y: number, w: number, hgt: number, color = body) => {
      ctx.fillStyle = color;
      ctx.fillRect(cx + x, base + y, w, hgt);
    };
    const roof = (x: number, w: number, top: number, tall: number) => {
      for (let r = 0; r < tall; r++) {
        const half = Math.round(((r + 1) / tall) * (w / 2));
        rect(x + Math.floor(w / 2) - half, top + r, half * 2 + (w % 2), 1);
      }
      rect(x + Math.floor(w / 2), top - 3, 1, 3, "#3d3184");
    };
    // Keep with battlements
    rect(-9, -24, 19, 24);
    for (let x = -9; x < 10; x += 3) rect(x, -27, 2, 3);
    rect(-9, -24, 1, 24, lit);
    // Side towers with pointed roofs
    rect(-16, -32, 7, 32);
    rect(10, -32, 7, 32);
    rect(-16, -32, 1, 32, lit);
    roof(-17, 9, -41, 9);
    roof(9, 9, -41, 9);
    // The spire the crystal crowns
    rect(-2, -40, 5, 16);
    rect(-2, -40, 1, 16, lit);
    roof(-3, 7, -48, 8);
    // Lit windows and a gate
    ctx.fillStyle = "#ffcf5a";
    for (const [x, y] of [[-13, -26], [13, -26], [-13, -18], [13, -18], [-5, -18], [5, -18], [0, -34], [-5, -11], [5, -11]]) {
      ctx.fillRect(cx + x, base + y, 1, 2);
    }
    ctx.fillStyle = "#0c0820";
    ctx.fillRect(cx - 2, base - 6, 5, 6);
    this.beacon = { x: cx, y: base - 55 };
  }

  /** Pines along the forest ridge: tiered cones, lit on the moon's side */
  private drawPines(canvas: HTMLCanvasElement, heights: Int16Array, random: () => number): void {
    const ctx = canvas.getContext("2d")!;
    for (let x = 0; x < this.period; x += 3 + Math.floor(random() * 6)) {
      const tall = 9 + Math.floor(random() * 18);
      const top = heights[x] - tall + 2;
      for (let r = 0; r < tall; r++) {
        // Wider toward the bottom, in tiers
        const half = Math.floor(r * 0.28 + (r % 5) * 0.45);
        for (let dx = -half; dx <= half; dx++) {
          const px = (x + dx + this.period) % this.period;
          ctx.fillStyle = dx === -half && r > 1 ? "#2a2158" : "#0e0a22";
          ctx.fillRect(px, top + r, 1, 1);
        }
      }
    }
  }

  /** The ground the champions walk on: a grassy top with tiny flowers, dark earth below */
  private drawGround(heights: Int16Array, random: () => number): HTMLCanvasElement {
    const [canvas, ctx] = layer(this.period, this.height);
    const flowers = ["#ff8ab4", "#9fd0ff", "#ffe27a", "#ffffff"];
    for (let x = 0; x < this.period; x++) {
      const top = heights[x];
      ctx.fillStyle = "#1a1226";
      ctx.fillRect(x, top, 1, this.height - top);
      ctx.fillStyle = "#3a6b45";
      ctx.fillRect(x, top, 1, 1);
      ctx.fillStyle = "#28503a";
      ctx.fillRect(x, top + 1, 1, 2);
      ctx.fillStyle = "#1e3a2e";
      ctx.fillRect(x, top + 3, 1, 1 + (x % 3 === 0 ? 1 : 0));
      // Blades poking up, flowers, pebbles in the earth
      if (random() < 0.25) {
        ctx.fillStyle = "#3a6b45";
        ctx.fillRect(x, top - 1, 1, 1);
      }
      if (random() < 0.035) {
        ctx.fillStyle = flowers[Math.floor(random() * flowers.length)];
        ctx.fillRect(x, top - 1, 1, 1);
      }
      if (random() < 0.05) {
        ctx.fillStyle = "#2b2140";
        ctx.fillRect(x, top + 6 + Math.floor(random() * (this.height - top - 6)), 2, 1);
      }
    }
    return canvas;
  }

  /** Two dark leafy bushes for the front corners */
  private drawBushes(random: () => number): HTMLCanvasElement {
    const width = Math.round(this.height * 0.32);
    const height = Math.round(this.height * 0.16);
    const [canvas, ctx] = layer(width, height);
    const blobs = Array.from({ length: 9 }, () => ({
      x: width * (0.1 + random() * 0.8),
      y: height * (0.45 + random() * 0.6),
      r: height * (0.25 + random() * 0.3),
    }));
    const inside = (x: number, y: number) => blobs.some(b => Math.hypot(x - b.x, (y - b.y) * 1.2) < b.r);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x, y - 1);
        ctx.fillStyle = edge ? "#1d1838" : (x * 7 + y * 3) % 11 === 0 ? "#120e26" : "#09061a";
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }

  private makeFireflies(random: () => number): void {
    this.fireflies = Array.from({ length: 34 }, () => ({
      x: random() * this.width,
      y: this.height * (0.6 + random() * 0.36),
      phase: random() * 100,
      front: random() < 0.35,
    }));
  }

  // ===========================================================================
  // Every frame
  // ===========================================================================

  /** A layer that repeats over the period, slid `offset` pixels left */
  private slide(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, offset: number, y = 0): void {
    const start = -Math.round(((offset % this.period) + this.period) % this.period);
    for (let x = start; x < this.width; x += this.period) ctx.drawImage(canvas, x, y);
  }

  private renderBack(time: number, camera: number): void {
    const ctx = this.backCtx;
    const { width, height } = this;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(this.sky, 0, 0);

    // Stars twinkle; a few bright ones have points
    for (const star of this.stars) {
      const glow = 0.5 + 0.5 * Math.sin(time * star.speed + star.phase);
      ctx.globalAlpha = 0.25 + glow * 0.75;
      ctx.fillStyle = star.color;
      ctx.fillRect(star.x, star.y, 1, 1);
      if (star.bright && glow > 0.6) {
        ctx.globalAlpha = (glow - 0.6) * 1.5;
        ctx.fillRect(star.x - 1, star.y, 3, 1);
        ctx.fillRect(star.x, star.y - 1, 1, 3);
      }
    }
    ctx.globalAlpha = 1;
    this.drawShootingStar(ctx, time);

    // Light rays from the moon, breathing slowly
    ctx.globalCompositeOperation = "lighter";
    const { x: mx, y: my } = this.moon;
    for (let i = 0; i < 4; i++) {
      const angle = 0.55 + i * 0.16 + Math.sin(time * 0.15 + i) * 0.03;
      const spread = 0.035 + (i % 2) * 0.02;
      const reach = height * 1.2;
      ctx.fillStyle = `rgba(255, 214, 170, ${0.03 + 0.02 * Math.sin(time * 0.4 + i * 1.7)})`;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(angle - spread) * reach, my + Math.sin(angle - spread) * reach);
      ctx.lineTo(mx + Math.cos(angle + spread) * reach, my + Math.sin(angle + spread) * reach);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // Clouds drift on their own wind, slowly, across the view
    for (const cloud of this.clouds) {
      const span = width + cloud.canvas.width;
      const x = Math.round((((cloud.x + time * cloud.speed - camera * 0.03) % span) + span) % span) - cloud.canvas.width;
      ctx.drawImage(cloud.canvas, x, cloud.y);
    }

    // Ridges, the castle's beacon on the second
    this.slide(ctx, this.ridges[0].canvas, camera * this.ridges[0].factor);
    this.slide(ctx, this.ridges[1].canvas, camera * this.ridges[1].factor);
    this.drawBeacon(ctx, time, camera * this.ridges[1].factor);
    // A pink mist over the valley floor
    const mist = ctx.createLinearGradient(0, height * 0.64, 0, height * 0.84);
    mist.addColorStop(0, "rgba(255, 150, 190, 0)");
    mist.addColorStop(0.55, `rgba(255, 150, 190, ${0.1 + 0.03 * Math.sin(time * 0.5)})`);
    mist.addColorStop(1, "rgba(255, 150, 190, 0)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, height * 0.64, width, height * 0.2);
    this.slide(ctx, this.ridges[2].canvas, camera * this.ridges[2].factor);
    this.slide(ctx, this.ground.canvas, camera);
    this.drawFireflies(ctx, time, camera, false);
  }

  /** The castle's crystal: a pulsing glow and a beam of light up into the sky */
  private drawBeacon(ctx: CanvasRenderingContext2D, time: number, offset: number): void {
    const pulse = 0.6 + 0.4 * Math.sin(time * 2.2);
    const start = -Math.round(((offset % this.period) + this.period) % this.period);
    for (let shift = start; shift < this.width + this.period; shift += this.period) {
      const x = this.beacon.x + shift;
      if (x < -20 || x > this.width + 20) continue;
      const y = this.beacon.y;
      ctx.globalCompositeOperation = "lighter";
      const beam = ctx.createLinearGradient(0, 0, 0, y);
      beam.addColorStop(0, "rgba(120, 240, 255, 0)");
      beam.addColorStop(1, `rgba(120, 240, 255, ${0.28 * pulse})`);
      ctx.fillStyle = beam;
      ctx.fillRect(x - 1, 0, 3, y);
      ctx.fillStyle = `rgba(200, 255, 255, ${0.35 * pulse})`;
      ctx.fillRect(x, 0, 1, y);
      for (let r = 6; r >= 2; r -= 2) {
        ctx.fillStyle = `rgba(110, 230, 255, ${0.09 * pulse})`;
        ctx.beginPath();
        ctx.arc(x + 0.5, y + 2.5, r + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // The crystal itself
      ctx.fillStyle = "#3fd6ee";
      ctx.fillRect(x - 1, y + 1, 3, 3);
      ctx.fillRect(x, y, 1, 5);
      ctx.fillStyle = "#e6ffff";
      ctx.fillRect(x, y + 1, 1, 2);
    }
  }

  private drawShootingStar(ctx: CanvasRenderingContext2D, time: number): void {
    if (!this.shootingStar && time > this.nextShootingStar) {
      this.shootingStar = { x: this.width * (0.35 + Math.random() * 0.6), y: this.height * (0.03 + Math.random() * 0.15), born: time };
      this.nextShootingStar = time + 6 + Math.random() * 6;
    }
    const star = this.shootingStar;
    if (!star) return;
    const age = time - star.born;
    if (age > 0.9) {
      this.shootingStar = null;
      return;
    }
    // Down and to the left, a fading tail behind its head
    const travelled = age * 110;
    for (let i = 0; i < 14; i++) {
      const along = travelled - i;
      if (along < 0) continue;
      ctx.globalAlpha = (1 - i / 14) * (1 - age / 0.9);
      ctx.fillStyle = i === 0 ? "#ffffff" : "#ffe6b8";
      ctx.fillRect(Math.round(star.x - along), Math.round(star.y + along * 0.45), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** Fireflies wander and blink; the front ones are nearer, bigger and slide faster */
  private drawFireflies(ctx: CanvasRenderingContext2D, time: number, camera: number, front: boolean): void {
    for (const fly of this.fireflies) {
      if (fly.front !== front) continue;
      const t = time + fly.phase;
      const blink = Math.max(0, Math.sin(t * 1.3)) ** 2;
      if (blink < 0.05) continue;
      const span = this.width + 20;
      const x = Math.round((((fly.x + Math.sin(t * 0.35) * 14 - camera * (front ? 1.2 : 0.6)) % span) + span) % span) - 10;
      const y = Math.round(fly.y + Math.sin(t * 0.6) * 6);
      ctx.globalAlpha = blink * 0.45;
      ctx.fillStyle = "#d8ff80";
      ctx.fillRect(x - 1, y, front ? 4 : 3, 1);
      ctx.fillRect(x, y - 1, 1, front ? 4 : 3);
      ctx.globalAlpha = blink;
      ctx.fillStyle = "#fffbb0";
      ctx.fillRect(x, y, front ? 2 : 1, front ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }

  private renderFront(time: number, camera: number): void {
    const ctx = this.frontCtx;
    const { width, height } = this;
    ctx.clearRect(0, 0, width, height);
    // Grass along the bottom edge, swaying in the wind
    const slide = camera * 1.3;
    for (let sx = -2; sx < width + 2; sx++) {
      const wx = Math.floor(sx + slide);
      const seed = Math.sin(wx * 12.9898) * 43758.5453;
      const r = seed - Math.floor(seed);
      if (r < 0.45) continue;
      const tall = 2 + Math.floor(r * 7);
      const sway = Math.sin(time * 1.6 + wx * 0.21) * (tall / 4);
      ctx.fillStyle = r > 0.85 ? "#1a1436" : "#0b0818";
      for (let k = 0; k < tall; k++) {
        ctx.fillRect(Math.round(sx + sway * (k / tall)), height - 1 - k, 1, 1);
      }
    }
    // Bushes in the corners, sliding past a little faster than the ground
    const bushes = this.bushes;
    const span = width + bushes.width * 2;
    for (const start of [0.08, 0.72]) {
      const x = Math.round((((start * span - slide) % span) + span) % span) - bushes.width;
      ctx.drawImage(bushes, x, height - bushes.height + 2);
    }
    this.drawFireflies(ctx, time, camera, true);
  }
}
