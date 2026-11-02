/**
 * FrameRenderer - Draws simulation frames as PNG images, so an agent can
 * look at what happened (and a human can skim a contact sheet).
 *
 * Legend: blue/red = sides, amber = jungle, squares = towers/nexus,
 * small dots = minions (darker = melee, lighter = caster, big = siege),
 * ringed circles = champions, thin lines = attack targets, faint rings =
 * tower range, dotted tails = movement over the last few seconds.
 */

import {
  MOBAConfig,
  calculateIndividualBushPositions,
} from '@siege/shared';
import { Raster, hexColor, type Color } from './Raster';
import type { SimEntity, SimFrame } from '../Recorder';

export interface FrameView {
  /** World point at the center of the image (default: map center) */
  center?: { x: number; y: number };
  /** World units across the image (default: whole map) */
  size?: number;
  /** Image size in pixels (default 720) */
  px?: number;
}

export interface RenderOptions extends FrameView {
  map?: typeof MOBAConfig;
  /** Earlier frames, for movement trails */
  history?: SimFrame[];
  /** Seconds of trail to draw (default 4, 0 to disable) */
  trailSeconds?: number;
  /** Text drawn in the top-left corner after the time */
  title?: string;
  /** Draw tower attack ranges (default true) */
  towerRanges?: boolean;
  /** Label minions and creatures with their HP (default: when zoomed in) */
  detailed?: boolean;
}

const COLORS = {
  water: hexColor('#1f4e66'),
  grass: hexColor('#3f6b35'),
  lane: hexColor('#8a7a52', 0.55),
  river: hexColor('#3d7a9a', 0.75),
  bush: hexColor('#1f4020', 0.85),
  wall: hexColor('#5b5348'),
  wallEdge: hexColor('#2e2a25'),
  blue: hexColor('#4f8cff'),
  blueDark: hexColor('#2a55b0'),
  blueLight: hexColor('#9cc0ff'),
  red: hexColor('#ff5a52'),
  redDark: hexColor('#b0302a'),
  redLight: hexColor('#ffaaa5'),
  neutral: hexColor('#f0a830'),
  white: hexColor('#ffffff'),
  black: hexColor('#000000'),
  dead: hexColor('#9a9a9a'),
  hpBack: hexColor('#000000', 0.7),
  hpGreen: hexColor('#4ade80'),
  hpRed: hexColor('#f87171'),
  hpAmber: hexColor('#fbbf24'),
  text: hexColor('#ffffff'),
  muted: hexColor('#d0d0d0'),
};

function sideColor(side: number, variant: 'base' | 'dark' | 'light' = 'base'): Color {
  if (side === 0) return variant === 'dark' ? COLORS.blueDark : variant === 'light' ? COLORS.blueLight : COLORS.blue;
  if (side === 1) return variant === 'dark' ? COLORS.redDark : variant === 'light' ? COLORS.redLight : COLORS.red;
  return COLORS.neutral;
}

function withAlpha(color: Color, alpha: number): Color {
  return [color[0], color[1], color[2], alpha];
}

export class FrameRenderer {
  private readonly map: typeof MOBAConfig;
  private readonly px: number;
  private readonly size: number;
  private readonly center: { x: number; y: number };
  private readonly scale: number;

  constructor(view: FrameView & { map?: typeof MOBAConfig } = {}) {
    this.map = view.map ?? MOBAConfig;
    this.px = view.px ?? 720;
    this.size = view.size ?? this.map.MAP_SIZE.width;
    this.center = view.center ?? { x: 0, y: 0 };
    this.scale = this.px / this.size;
  }

  /** World -> image coordinates */
  toPx(x: number, y: number): [number, number] {
    return [
      (x - this.center.x) * this.scale + this.px / 2,
      (y - this.center.y) * this.scale + this.px / 2,
    ];
  }

  render(frame: SimFrame, options: RenderOptions = {}): Raster {
    const raster = new Raster(this.px, this.px, COLORS.water);
    const detailed = options.detailed ?? this.scale >= 0.45;

    this.drawTerrain(raster);
    if (options.towerRanges ?? true) this.drawTowerRanges(raster, frame);
    this.drawTrails(raster, frame, options.history ?? [], options.trailSeconds ?? 4);
    this.drawZones(raster, frame);
    this.drawTargetLines(raster, frame);
    this.drawEntities(raster, frame, detailed);
    this.drawHeader(raster, frame, options.title);
    return raster;
  }

  // ===========================================================================
  // Layers
  // ===========================================================================

  private drawTerrain(raster: Raster): void {
    const half = this.map.MAP_SIZE.width / 2;
    const border = this.map.WATER_BORDER_SIZE;
    const [gx0, gy0] = this.toPx(-half + border, -half + border);
    const [gx1, gy1] = this.toPx(half - border, half - border);
    raster.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0, COLORS.grass);

    const river = (this.map as { RIVER?: { points: readonly { x: number; y: number }[]; width: number } }).RIVER;
    if (river) {
      for (let i = 0; i < river.points.length - 1; i++) {
        const [x0, y0] = this.toPx(river.points[i].x, river.points[i].y);
        const [x1, y1] = this.toPx(river.points[i + 1].x, river.points[i + 1].y);
        raster.line(x0, y0, x1, y1, COLORS.river, Math.max(2, river.width * this.scale));
      }
    }

    for (const lane of Object.values(this.map.LANES)) {
      const points = lane.waypoints;
      for (let i = 0; i < points.length - 1; i++) {
        const [x0, y0] = this.toPx(points[i].x, points[i].y);
        const [x1, y1] = this.toPx(points[i + 1].x, points[i + 1].y);
        raster.line(x0, y0, x1, y1, COLORS.lane, Math.max(2, lane.width * this.scale));
      }
    }

    for (let i = 0; i < this.map.BUSH_GROUPS.length; i++) {
      for (const bush of calculateIndividualBushPositions(i)) {
        const [x, y] = this.toPx(bush.x - bush.width / 2, bush.y - bush.height / 2);
        raster.fillRect(x, y, bush.width * this.scale, bush.height * this.scale, COLORS.bush);
      }
    }

    // Walls from the distance field, a pixel at a time, with a dark rim
    const field = this.map.WALL_FIELD;
    const rim = 1.5 / this.scale;
    for (let py = 0; py < this.px; py++) {
      for (let px = 0; px < this.px; px++) {
        const distance = field.distance(
          this.center.x + (px + 0.5 - this.px / 2) / this.scale,
          this.center.y + (py + 0.5 - this.px / 2) / this.scale,
        );
        if (distance < 0) raster.plot(px, py, distance > -rim ? COLORS.wallEdge : COLORS.wall);
      }
    }
  }

  private drawTowerRanges(raster: Raster, frame: SimFrame): void {
    for (const entity of frame.entities) {
      if (entity.kind !== 'tower' || entity.dead || !entity.range) continue;
      const [x, y] = this.toPx(entity.x, entity.y);
      raster.strokeCircle(x, y, entity.range * this.scale, withAlpha(sideColor(entity.side), 0.35), 1);
    }
  }

  private drawTrails(raster: Raster, frame: SimFrame, history: SimFrame[], seconds: number): void {
    if (seconds <= 0 || history.length === 0) return;
    const since = frame.time - seconds;
    const relevant = history.filter(h => h.time >= since && h.time <= frame.time);
    const tracked = new Set(frame.entities
      .filter(e => e.kind === 'champion' || e.kind === 'minion' || e.kind === 'jungle')
      .map(e => e.id));

    for (const past of relevant) {
      const age = (frame.time - past.time) / seconds;
      for (const entity of past.entities) {
        if (!tracked.has(entity.id) || entity.dead) continue;
        const [x, y] = this.toPx(entity.x, entity.y);
        const size = entity.kind === 'champion' ? 1.5 : 1;
        raster.fillCircle(x, y, size, withAlpha(sideColor(entity.side, 'light'), 0.5 * (1 - age)));
      }
    }
  }

  private drawZones(raster: Raster, frame: SimFrame): void {
    for (const entity of frame.entities) {
      if (entity.kind !== 'zone' || entity.dead) continue;
      const [x, y] = this.toPx(entity.x, entity.y);
      raster.fillCircle(x, y, entity.radius * this.scale, withAlpha(sideColor(entity.side), 0.2));
      raster.strokeCircle(x, y, entity.radius * this.scale, withAlpha(sideColor(entity.side), 0.6));
    }
  }

  private drawTargetLines(raster: Raster, frame: SimFrame): void {
    const byId = new Map(frame.entities.map(e => [e.id, e]));
    for (const entity of frame.entities) {
      if (!entity.targetId || entity.dead || entity.kind === 'projectile') continue;
      const target = byId.get(entity.targetId);
      if (!target || target.dead) continue;
      const [x0, y0] = this.toPx(entity.x, entity.y);
      const [x1, y1] = this.toPx(target.x, target.y);
      const alpha = entity.kind === 'minion' ? 0.35 : 0.8;
      raster.line(x0, y0, x1, y1, withAlpha(sideColor(entity.side, 'light'), alpha), entity.kind === 'tower' ? 2 : 1);
    }
  }

  private drawEntities(raster: Raster, frame: SimFrame, detailed: boolean): void {
    const order: Record<SimEntity['kind'], number> = {
      nexus: 0, tower: 1, inhibitor: 1, ward: 2, jungle: 3, minion: 4, orb: 5, champion: 6, projectile: 7, zone: 8,
    };
    const entities = [...frame.entities].sort((a, b) => order[a.kind] - order[b.kind]);

    for (const entity of entities) {
      const [x, y] = this.toPx(entity.x, entity.y);
      const r = Math.max(1.5, entity.radius * this.scale);

      if (entity.dead && entity.kind !== 'champion' && entity.kind !== 'tower' && entity.kind !== 'inhibitor' && entity.kind !== 'nexus') continue;
      if (entity.dead) {
        const s = Math.max(3, r);
        raster.line(x - s, y - s, x + s, y + s, COLORS.dead, 2);
        raster.line(x - s, y + s, x + s, y - s, COLORS.dead, 2);
        if (entity.kind === 'champion') raster.text(x - s, y - s - 10, `${entity.label} dead`, COLORS.dead);
        continue;
      }

      switch (entity.kind) {
        case 'nexus': {
          const s = Math.max(6, r);
          raster.fillRect(x - s, y - s, s * 2, s * 2, sideColor(entity.side, 'dark'));
          raster.strokeRect(x - s, y - s, s * 2, s * 2, COLORS.white, 2);
          this.drawHealthBar(raster, x, y - s - 6, Math.max(24, s * 2), entity);
          break;
        }
        case 'tower':
        case 'inhibitor': {
          const s = Math.max(4, r * 0.8);
          raster.fillRect(x - s, y - s, s * 2, s * 2, sideColor(entity.side));
          raster.strokeRect(x - s, y - s, s * 2, s * 2, COLORS.black);
          this.drawHealthBar(raster, x, y - s - 5, Math.max(16, s * 2.5), entity);
          break;
        }
        case 'minion': {
          const variant = entity.label === 'melee' ? 'dark' : 'light';
          const size = entity.label === 'siege' || entity.label === 'super' ? Math.max(3.5, r * 1.2) : Math.max(2, r);
          raster.fillCircle(x, y, size, sideColor(entity.side, variant));
          if (detailed) this.drawHealthBar(raster, x, y - size - 4, Math.max(10, size * 3), entity);
          break;
        }
        case 'jungle': {
          const size = Math.max(2.5, r);
          raster.fillCircle(x, y, size, COLORS.neutral);
          raster.strokeCircle(x, y, size, COLORS.black);
          this.drawHealthBar(raster, x, y - size - 4, Math.max(12, size * 3), entity);
          if (detailed) raster.text(x + size + 2, y - 3, entity.label, COLORS.muted);
          break;
        }
        case 'champion': {
          const size = Math.max(5, r);
          raster.fillCircle(x, y, size, sideColor(entity.side));
          raster.strokeCircle(x, y, size, entity.recalling ? COLORS.hpAmber : COLORS.white, 2);
          this.drawHealthBar(raster, x, y - size - 6, 26, entity);
          const label = `${entity.label}${entity.level ? ` ${entity.level}` : ''}${entity.recalling ? ' recall' : ''}`;
          raster.text(x - (label.length * 6) / 2, y + size + 3, label, COLORS.text);
          break;
        }
        case 'projectile':
          raster.fillCircle(x, y, 1.5, withAlpha(sideColor(entity.side, 'light'), 0.9));
          break;
        case 'ward':
          raster.fillPolygon([[x, y - 4], [x + 4, y], [x, y + 4], [x - 4, y]], sideColor(entity.side, 'light'));
          break;
        case 'orb':
          raster.fillCircle(x, y, 2.5, hexColor('#fff3a0'));
          break;
        case 'zone':
          break;
      }
    }
  }

  private drawHealthBar(raster: Raster, cx: number, y: number, width: number, entity: SimEntity): void {
    if (entity.maxHp <= 0) return;
    const ratio = Math.max(0, Math.min(1, entity.hp / entity.maxHp));
    const x = cx - width / 2;
    raster.fillRect(x, y, width, 3, COLORS.hpBack);
    const color = entity.side === 2 ? COLORS.hpAmber : ratio > 0.5 ? COLORS.hpGreen : COLORS.hpRed;
    raster.fillRect(x, y, Math.max(1, width * ratio), 3, color);
  }

  private drawHeader(raster: Raster, frame: SimFrame, title?: string): void {
    const text = `T ${frame.time.toFixed(1)}S${title ? `  ${title}` : ''}`;
    raster.fillRect(0, 0, Raster.textWidth(text, 2) + 8, 20, hexColor('#000000', 0.55));
    raster.text(4, 3, text, COLORS.text, 2);
  }
}

export interface SheetOptions extends RenderOptions {
  /** Frames per row (default 4) */
  columns?: number;
  /** Size of each cell in pixels (default 360) */
  cellPx?: number;
}

/**
 * Lay several frames out in a grid (a contact sheet) with movement trails.
 */
export function renderSheet(frames: SimFrame[], allFrames: SimFrame[], options: SheetOptions = {}): Raster {
  const columns = Math.max(1, Math.min(options.columns ?? 4, frames.length));
  const cell = options.cellPx ?? 360;
  const rows = Math.ceil(frames.length / columns);
  const sheet = new Raster(columns * cell + (columns - 1) * 4, rows * cell + (rows - 1) * 4, hexColor('#111111'));
  const renderer = new FrameRenderer({ ...options, px: cell });

  frames.forEach((frame, i) => {
    const image = renderer.render(frame, { ...options, history: allFrames });
    sheet.blit(image, (i % columns) * (cell + 4), Math.floor(i / columns) * (cell + 4));
  });
  return sheet;
}

/**
 * Pick evenly spaced frames from a recording.
 */
export function pickFrames(frames: SimFrame[], count: number): SimFrame[] {
  if (frames.length <= count) return frames;
  const picked: SimFrame[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(frames[Math.round(i * (frames.length - 1) / (count - 1))]);
  }
  return picked;
}
