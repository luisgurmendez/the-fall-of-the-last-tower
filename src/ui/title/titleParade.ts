/**
 * The champions marching across the title screen's valley, left to right,
 * one after another, from their in-game walk strips
 * (scripts/generate-sprites.ts): each at its size in the game, its pixels a
 * whole number of screen pixels, on one of a few lanes of the ground, with a
 * shadow. They walk on the ground as it slides under the panning view, so
 * their steps keep pace with it.
 */

import { CAMERA_SPEED, type TitleScene } from "./titleScene";

/** Who marches and how big each is drawn in the game (world units per sprite pixel, src/render/champions/<id>.ts) */
const MARCHERS: { id: string; scale: number }[] = [
  { id: "zhakrul", scale: 1.35 },
  { id: "warrior", scale: 0.84 },
  { id: "hop", scale: 1.2 },
  { id: "magnus", scale: 0.84 },
  { id: "calamitus", scale: 1.5 },
  { id: "elora", scale: 1.32 },
  { id: "kip", scale: 1.26 },
  { id: "nocthar", scale: 1.26 },
  { id: "uruk", scale: 1.26 },
  { id: "vile", scale: 0.84 },
  { id: "protobot", scale: 1.6 },
  { id: "elara", scale: 0.84 },
  { id: "fenris", scale: 1.45 },
  { id: "oitboil", scale: 1.26 },
  { id: "gorath", scale: 0.88 },
  { id: "caelum", scale: 1.32 },
  { id: "vex", scale: 0.84 },
];
/** World units per scene pixel: a low-detail champion's pixels are about the valley's */
const WORLD_PER_SCENE_PIXEL = 1.45;
/** How fast they walk over the ground (scene pixels a second), give or take a little each */
const PACE = 38;
/** Their walk cycles' frames a second at that pace: the game's 8 at 100 units a second */
const WALK_FPS = (8 * PACE * WORLD_PER_SCENE_PIXEL) / 100;
const MAX_MARCHING = 5;
/** A new one sets off this often (seconds) */
const SPAWN_EVERY = 3.4;
/** Lanes, scene pixels apart, below the ground's top */
const LANES = 4;
const LANE_GAP = 3;
const FIRST_LANE = 3;

interface Strip {
  image: HTMLImageElement;
  /** Frame size (frames are square) and count */
  frame: number;
  frames: number;
  /** The lowest row any frame draws, and the columns it spans */
  feet: number;
  left: number;
  right: number;
  scale: number;
}

interface Marcher {
  strip: Strip;
  /** Its middle, in scene pixels */
  x: number;
  lane: number;
  pace: number;
  started: number;
}

/** A strip's frames and where its body is in them */
function measure(image: HTMLImageElement, scale: number): Strip {
  const frame = image.naturalHeight;
  const frames = Math.max(1, Math.round(image.naturalWidth / frame));
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = frame;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, frame);
  let feet = 0;
  let left = frame;
  let right = 0;
  for (let y = 0; y < frame; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] < 40) continue;
      const fx = x % frame;
      feet = Math.max(feet, y);
      left = Math.min(left, fx);
      right = Math.max(right, fx);
    }
  }
  return { image, frame, frames, feet, left, right, scale };
}

export class TitleParade {
  private readonly strips: Strip[] = [];
  private marchers: Marcher[] = [];
  private order: number[] = [];
  private nextSpawn = 0;
  private filled = false;

  constructor() {
    for (const { id, scale } of MARCHERS) {
      const image = new Image();
      image.onload = () => this.strips.push(measure(image, scale));
      image.src = `/assets/champs/${id}/walk.png`;
    }
  }

  /** Move everyone `dt` seconds on, send off whoever's next, drop whoever's gone */
  update(scene: TitleScene, time: number, dt: number): void {
    if (!this.strips.length) return;
    // At first, some are already halfway across
    if (!this.filled && this.strips.length >= 3) {
      this.filled = true;
      for (const share of [0.12, 0.4, 0.68, 0.92]) this.spawn(scene, time, scene.width * share);
      this.nextSpawn = time + SPAWN_EVERY;
    }
    for (const marcher of this.marchers) marcher.x += (marcher.pace - CAMERA_SPEED) * dt;
    this.marchers = this.marchers.filter(marcher => marcher.x < scene.width + this.halfWidth(marcher, scene) + 4);
    if (time >= this.nextSpawn && this.marchers.length < MAX_MARCHING) {
      this.spawn(scene, time, null);
      this.nextSpawn = time + SPAWN_EVERY * (0.8 + Math.random() * 0.5);
    }
  }

  /** Draw them on the screen-sized canvas, nearest lane last */
  draw(ctx: CanvasRenderingContext2D, scene: TitleScene, time: number): void {
    const pixel = scene.pixel;
    for (const marcher of [...this.marchers].sort((a, b) => a.lane - b.lane)) {
      const { strip } = marcher;
      const scale = this.screenScale(strip, pixel);
      const feetY = (scene.groundY + FIRST_LANE + marcher.lane * LANE_GAP) * pixel;
      const centerX = Math.round(marcher.x * pixel);
      // A shadow under the feet
      const bodyWidth = (strip.right - strip.left + 1) * scale;
      ctx.fillStyle = "rgba(6, 2, 18, 0.45)";
      ctx.beginPath();
      ctx.ellipse(centerX, feetY, bodyWidth * 0.32, pixel * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // The walk cycle, at the pace it walks
      const frame = Math.floor((time - marcher.started) * WALK_FPS * (marcher.pace / PACE)) % strip.frames;
      ctx.drawImage(
        strip.image,
        frame * strip.frame, 0, strip.frame, strip.frame,
        centerX - Math.round((strip.frame / 2) * scale), Math.round(feetY - (strip.feet + 1) * scale),
        strip.frame * scale, strip.frame * scale,
      );
    }
  }

  /** Screen pixels per sprite pixel: its size in the game, a whole number */
  private screenScale(strip: Strip, pixel: number): number {
    return Math.max(1, Math.round((strip.scale / WORLD_PER_SCENE_PIXEL) * pixel));
  }

  /** Half its body's width, in scene pixels */
  private halfWidth(marcher: Marcher, scene: TitleScene): number {
    const { strip } = marcher;
    return (strip.frame / 2) * (this.screenScale(strip, scene.pixel) / scene.pixel);
  }

  /** Send off the next champion: from just off the left edge, or from `x` */
  private spawn(scene: TitleScene, time: number, x: number | null): void {
    if (!this.order.length) {
      // Everyone once, in a shuffled order, before anyone twice
      this.order = this.strips.map((_, i) => i).sort(() => Math.random() - 0.5);
    }
    const marching = new Set(this.marchers.map(marcher => marcher.strip));
    const index = this.order.findIndex(i => !marching.has(this.strips[i]));
    if (index < 0) return;
    const [next] = this.order.splice(index, 1);
    const used = new Set(this.marchers.map(marcher => marcher.lane));
    const lanes = Array.from({ length: LANES }, (_, i) => i).filter(lane => !used.has(lane));
    const marcher: Marcher = {
      strip: this.strips[next],
      x: 0,
      lane: lanes.length ? lanes[Math.floor(Math.random() * lanes.length)] : Math.floor(Math.random() * LANES),
      pace: PACE * (0.9 + Math.random() * 0.2),
      started: time - Math.random(),
    };
    marcher.x = x ?? -this.halfWidth(marcher, scene);
    this.marchers.push(marcher);
  }
}
