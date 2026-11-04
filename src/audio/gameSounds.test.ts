import { describe, expect, it } from 'vitest';
import { EntityType } from '@siege/shared';
import type { InterpolatedEntity } from '@/core/state/entities';
import { attackVolume } from './gameSounds';

const unit = (entityType: EntityType) => ({ snapshot: { entityType } }) as unknown as InterpolatedEntity;
const champion = unit(EntityType.CHAMPION);
const minion = unit(EntityType.MINION);
const tower = unit(EntityType.TOWER);

describe('attackVolume', () => {
  it("a champion's attacks are in front", () => {
    expect(attackVolume(champion, minion)).toBe(1);
    expect(attackVolume(champion, champion)).toBe(1);
  });

  it('a tower shooting a champion is in front too', () => {
    expect(attackVolume(tower, champion)).toBe(1);
  });

  it('a minion hitting a champion is heard, under what champions do', () => {
    expect(attackVolume(minion, champion)).toBeCloseTo(0.6, 5);
  });

  it('minions fighting minions (and towers) are the quiet background', () => {
    expect(attackVolume(minion, minion)).toBeCloseTo(0.2, 5);
    expect(attackVolume(tower, minion)).toBeCloseTo(0.2, 5);
    expect(attackVolume(minion, undefined)).toBeCloseTo(0.2, 5);
  });
});
