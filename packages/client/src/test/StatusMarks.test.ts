/**
 * Status marks drawn on champions (src/render/overlays/statusMarks.ts): a
 * slow shows chevrons at the feet, burning shows flames, poison bubbles,
 * bleeding drops, a haste speed lines. Every effect of the server's
 * (packages/server/src/data/effects.ts) that slows, burns, poisons, bleeds or
 * hastes has its mark, so none is invisible.
 */
import { describe, it, expect } from 'bun:test';
import { ALL_SERVER_EFFECTS } from '../../../server/src/data/effects';
import { getStatusMarks, statusMarkOf } from '@/render/overlays/statusMarks';

type Effect = (typeof ALL_SERVER_EFFECTS)[number] & {
  ccType?: string; otType?: string; damageType?: string; stat?: string; percentValue?: number; flatValue?: number;
};
const effects = ALL_SERVER_EFFECTS as Effect[];
const slows = effects.filter(e => e.ccType === 'slow' || (e.stat === 'movement_speed' && (e.percentValue ?? e.flatValue ?? 0) < 0));
const hastes = effects.filter(e => e.stat === 'movement_speed' && (e.percentValue ?? e.flatValue ?? 0) > 0);
const damageOverTime = effects.filter(e => e.otType === 'damage');

describe('every slowing, hastening or damage-over-time effect has a mark', () => {
  it('slows', () => {
    expect(slows.length).toBeGreaterThan(5);
    for (const effect of slows) expect(statusMarkOf(effect.id), effect.id).toBe('slow');
  });

  it('hastes', () => {
    for (const effect of hastes) expect(statusMarkOf(effect.id), effect.id).toBe('haste');
  });

  it('damage over time burns, poisons or bleeds', () => {
    for (const effect of damageOverTime) expect(['burn', 'poison', 'bleed'], effect.id).toContain(statusMarkOf(effect.id)!);
    expect(statusMarkOf('burn')).toBe('burn');
    expect(statusMarkOf('summoner_scorch')).toBe('burn');
    expect(statusMarkOf('poison')).toBe('poison');
    expect(statusMarkOf('bleed')).toBe('bleed');
  });

  it("champions' venoms and burns are poison and burning", () => {
    for (const id of ['elora_poison_arrow', 'elora_venom', 'zhakrul_venom', 'zhakrul_ancient_venom']) expect(statusMarkOf(id), id).toBe('poison');
    expect(statusMarkOf('item_burn')).toBe('burn');
  });

  it('anything else has no mark (crowd control has its own: stars, roots...)', () => {
    expect(statusMarkOf('stun')).toBeNull();
    expect(statusMarkOf('armor_buff')).toBeNull();
    expect(statusMarkOf('made_up')).toBeNull();
  });
});

describe('getStatusMarks', () => {
  it('the marks on a unit, each once, from its live effects', () => {
    const marks = getStatusMarks([
      { definitionId: 'slow_30', timeRemaining: 1 },
      { definitionId: 'slow_20', timeRemaining: 2 },
      { definitionId: 'burn', timeRemaining: 0.5 },
      { definitionId: 'stun', timeRemaining: 1 },
      { definitionId: 'poison', timeRemaining: 0 },
    ]);
    expect(marks.sort()).toEqual(['burn', 'slow']);
  });

  it('nothing on it: no marks', () => {
    expect(getStatusMarks(undefined)).toEqual([]);
    expect(getStatusMarks([])).toEqual([]);
  });
});
