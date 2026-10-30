/**
 * Raster - A tiny RGBA software canvas with a PNG encoder.
 *
 * Just enough drawing to render simulation frames without a browser or a
 * native canvas dependency: rectangles, circles, rings, thick lines,
 * polygons and a 5x7 bitmap font.
 */

import { deflateSync } from 'node:zlib';
import { GLYPHS, GLYPH_WIDTH, GLYPH_HEIGHT } from './font';

export type Color = readonly [r: number, g: number, b: number, a?: number];

export function hexColor(hex: string, alpha = 1): Color {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

export class Raster {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;

  constructor(width: number, height: number, background: Color = [0, 0, 0, 1]) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.pixels = new Uint8ClampedArray(this.width * this.height * 4);
    this.fillRect(0, 0, this.width, this.height, background);
  }

  /**
   * Blend one pixel (alpha in 0..1).
   */
  plot(x: number, y: number, color: Color): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;

    const i = (y * this.width + x) * 4;
    const alpha = color[3] ?? 1;
    if (alpha >= 1) {
      this.pixels[i] = color[0];
      this.pixels[i + 1] = color[1];
      this.pixels[i + 2] = color[2];
      this.pixels[i + 3] = 255;
      return;
    }
    this.pixels[i] = this.pixels[i] * (1 - alpha) + color[0] * alpha;
    this.pixels[i + 1] = this.pixels[i + 1] * (1 - alpha) + color[1] * alpha;
    this.pixels[i + 2] = this.pixels[i + 2] * (1 - alpha) + color[2] * alpha;
    this.pixels[i + 3] = 255;
  }

  fillRect(x: number, y: number, width: number, height: number, color: Color): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + width));
    const y1 = Math.min(this.height, Math.ceil(y + height));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) this.plot(px, py, color);
    }
  }

  strokeRect(x: number, y: number, width: number, height: number, color: Color, thickness = 1): void {
    this.fillRect(x, y, width, thickness, color);
    this.fillRect(x, y + height - thickness, width, thickness, color);
    this.fillRect(x, y, thickness, height, color);
    this.fillRect(x + width - thickness, y, thickness, height, color);
  }

  fillCircle(cx: number, cy: number, radius: number, color: Color): void {
    const r = Math.max(0.5, radius);
    const x0 = Math.floor(cx - r);
    const x1 = Math.ceil(cx + r);
    const y0 = Math.floor(cy - r);
    const y1 = Math.ceil(cy + r);
    const rSq = r * r;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= rSq) this.plot(x, y, color);
      }
    }
  }

  strokeCircle(cx: number, cy: number, radius: number, color: Color, thickness = 1): void {
    const outer = radius + thickness / 2;
    const inner = Math.max(0, radius - thickness / 2);
    const x0 = Math.floor(cx - outer);
    const x1 = Math.ceil(cx + outer);
    const y0 = Math.floor(cy - outer);
    const y1 = Math.ceil(cy + outer);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dSq = dx * dx + dy * dy;
        if (dSq <= outer * outer && dSq >= inner * inner) this.plot(x, y, color);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: Color, thickness = 1): void {
    const length = Math.hypot(x1 - x0, y1 - y0);
    if (thickness <= 1.5) {
      const steps = Math.max(1, Math.ceil(length));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        this.plot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, color);
      }
      return;
    }
    // Thick line as a quad, so translucent lines don't double-blend
    const nx = -(y1 - y0) / (length || 1) * thickness / 2;
    const ny = (x1 - x0) / (length || 1) * thickness / 2;
    this.fillPolygon([
      [x0 + nx, y0 + ny],
      [x1 + nx, y1 + ny],
      [x1 - nx, y1 - ny],
      [x0 - nx, y0 - ny],
    ], color);
  }

  /**
   * Fill a polygon with the even-odd rule (scanline).
   */
  fillPolygon(points: readonly (readonly [number, number])[], color: Color): void {
    if (points.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.height - 1, Math.ceil(maxY));

    for (let y = y0; y <= y1; y++) {
      const scanY = y + 0.5;
      const crossings: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= scanY && by > scanY) || (by <= scanY && ay > scanY)) {
          crossings.push(ax + (scanY - ay) / (by - ay) * (bx - ax));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const xStart = Math.max(0, Math.round(crossings[i]));
        const xEnd = Math.min(this.width, Math.round(crossings[i + 1]));
        for (let x = xStart; x < xEnd; x++) this.plot(x, y, color);
      }
    }
  }

  /**
   * Draw text with the built-in 5x7 font. Lowercase is drawn as uppercase.
   * @returns The width drawn in pixels
   */
  text(x: number, y: number, text: string, color: Color, scale = 1, shadow: Color | null = [0, 0, 0, 0.8]): number {
    if (shadow) this.drawText(x + scale, y + scale, text, shadow, scale);
    return this.drawText(x, y, text, color, scale);
  }

  static textWidth(text: string, scale = 1): number {
    return text.length * (GLYPH_WIDTH + 1) * scale;
  }

  private drawText(x: number, y: number, text: string, color: Color, scale: number): number {
    let cursor = x;
    for (const char of text.toUpperCase()) {
      const glyph = GLYPHS[char] ?? GLYPHS['?'];
      for (let row = 0; row < GLYPH_HEIGHT; row++) {
        for (let col = 0; col < GLYPH_WIDTH; col++) {
          if (glyph[row] & (1 << (GLYPH_WIDTH - 1 - col))) {
            this.fillRect(cursor + col * scale, y + row * scale, scale, scale, color);
          }
        }
      }
      cursor += (GLYPH_WIDTH + 1) * scale;
    }
    return cursor - x;
  }

  /**
   * Copy another raster into this one.
   */
  blit(source: Raster, x: number, y: number): void {
    for (let sy = 0; sy < source.height; sy++) {
      const ty = y + sy;
      if (ty < 0 || ty >= this.height) continue;
      for (let sx = 0; sx < source.width; sx++) {
        const tx = x + sx;
        if (tx < 0 || tx >= this.width) continue;
        const si = (sy * source.width + sx) * 4;
        const ti = (ty * this.width + tx) * 4;
        this.pixels[ti] = source.pixels[si];
        this.pixels[ti + 1] = source.pixels[si + 1];
        this.pixels[ti + 2] = source.pixels[si + 2];
        this.pixels[ti + 3] = source.pixels[si + 3];
      }
    }
  }

  toPNG(): Uint8Array {
    // Each scanline is prefixed with filter type 0 (none)
    const raw = new Uint8Array(this.height * (this.width * 4 + 1));
    for (let y = 0; y < this.height; y++) {
      const rowStart = y * (this.width * 4 + 1);
      raw[rowStart] = 0;
      raw.set(this.pixels.subarray(y * this.width * 4, (y + 1) * this.width * 4), rowStart + 1);
    }

    const header = new Uint8Array(13);
    const view = new DataView(header.buffer);
    view.setUint32(0, this.width);
    view.setUint32(4, this.height);
    header[8] = 8; // bit depth
    header[9] = 6; // RGBA
    header[10] = 0; // compression
    header[11] = 0; // filter
    header[12] = 0; // no interlace

    return concat([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', header),
      pngChunk('IDAT', new Uint8Array(deflateSync(raw))),
      pngChunk('IEND', new Uint8Array(0)),
    ]);
  }
}

// =============================================================================
// PNG helpers
// =============================================================================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeAndData = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) typeAndData[i] = type.charCodeAt(i);
  typeAndData.set(data, 4);

  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typeAndData, 4);
  view.setUint32(8 + data.length, crc32(typeAndData));
  return chunk;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
