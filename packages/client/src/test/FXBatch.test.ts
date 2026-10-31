/**
 * The GPU effects batch (src/gpu/fx/FXBatch.ts): color parsing, the
 * instance layout the shader reads, and ribbons.
 */
import { describe, it, expect } from 'bun:test';
import { FXBatch, FX_INSTANCE_FLOATS, fxColor, mixColor } from '@/gpu/fx/FXBatch';
import { FXKind } from '@/gpu/fx/fxShader';

describe('fxColor', () => {
  it('reads hex and rgb colors', () => {
    expect(fxColor('#ff0000')).toEqual([1, 0, 0]);
    expect(fxColor('#0f0')).toEqual([0, 1, 0]);
    expect(fxColor('rgba(0, 0, 255, 0.5)')).toEqual([0, 0, 1]);
  });

  it('falls back to white', () => {
    expect(fxColor('tomato')).toEqual([1, 1, 1]);
  });

  it('mixes colors', () => {
    expect(mixColor([0, 0, 0], [1, 1, 1], 0.25)).toEqual([0.25, 0.25, 0.25]);
  });
});

describe('FXBatch', () => {
  it('lays out an instance as the shader reads it', () => {
    const batch = new FXBatch();
    batch.glow(10, 20, 30, [1, 0.5, 0], 2, 0.3, 0.6, 0, 0.25);
    expect(batch.count).toBe(1);
    const d = Array.from(batch.data.subarray(0, FX_INSTANCE_FLOATS));
    expect(d.slice(0, 4)).toEqual([10, 20, 30, 30]); // center, half size
    expect(d[5]).toBe(FXKind.GLOW);
    expect(d[6]).toBe(0.25); // seed
    expect(d.slice(8, 12)).toEqual([1, 0.5, 0, 2]); // color, intensity
    expect(d[12]).toBeCloseTo(0.3); // core
  });

  it('puts a spark behind its head', () => {
    const batch = new FXBatch();
    batch.spark(100, 0, 0, 40, 4, [1, 1, 1]);
    expect(batch.data[0]).toBe(80);
    expect(batch.data[2]).toBe(20);
  });

  it('grows past its first size and empties on clear', () => {
    const batch = new FXBatch();
    for (let i = 0; i < 3000; i++) batch.glow(i, 0, 5, [1, 1, 1]);
    expect(batch.count).toBe(3000);
    expect(batch.data[2999 * FX_INSTANCE_FLOATS]).toBe(2999);
    batch.clear();
    expect(batch.count).toBe(0);
  });

  it('draws a ribbon as one segment per pair of points, brightest at the head', () => {
    const batch = new FXBatch();
    batch.ribbon([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], 6, [1, 1, 1], 1);
    expect(batch.count).toBe(2);
    const light = (i: number, end: number) => batch.data[i * FX_INSTANCE_FLOATS + 14 + end];
    expect(light(0, 0)).toBe(0); // tail
    expect(light(1, 1)).toBe(1); // head
  });
});
