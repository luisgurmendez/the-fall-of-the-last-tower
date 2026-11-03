/**
 * Looks drawn from a champion's effects (src/gpu/fx/championAuras.ts): they
 * follow it and last exactly as long as the effect. Vile transformed: a
 * sigil as wide as his aura reaches.
 */
import { describe, it, expect } from 'bun:test';
import { getAbilityDefinition } from '@siege/shared';
import { emitChampionAuras } from '@/gpu/fx/championAuras';
import type { FXBatch } from '@/gpu/fx/FXBatch';

/** A batch that records its sigils */
function recorder() {
  const sigils: { x: number; y: number; radius: number }[] = [];
  const batch = new Proxy({}, {
    get: (_target, key) => key === 'sigil'
      ? (x: number, y: number, radius: number) => { sigils.push({ x, y, radius }); }
      : () => {},
  }) as unknown as FXBatch;
  return { batch, sigils };
}

describe('champion auras', () => {
  it('Vile transformed: a sigil under him as wide as his aura reaches, wherever he is', () => {
    const { batch, sigils } = recorder();
    emitChampionAuras(batch, batch, { activeEffects: [{ definitionId: 'vile_transformed' }] }, 300, -200, 1);
    expect(sigils).toHaveLength(1);
    expect(sigils[0].radius).toBe(getAbilityDefinition('vile_restoration_of_vilix')!.aura!.radius);
    expect(sigils[0].x).toBe(300);
  });

  it('nothing once the effect is gone', () => {
    const { batch, sigils } = recorder();
    emitChampionAuras(batch, batch, { activeEffects: [] }, 0, 0, 1);
    expect(sigils).toHaveLength(0);
  });
});
