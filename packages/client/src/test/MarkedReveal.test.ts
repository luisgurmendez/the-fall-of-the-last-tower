/**
 * An enemy champion holding Kip's mark is sent by the server to his team
 * even in the fog or a bush; the client's own fog overlay must not cover it,
 * so its fog of war gets a small window around it (src/online/markReveal.ts,
 * used by OnlineFogProvider), and only around a marked enemy that's alive.
 */
import { describe, it, expect } from 'bun:test';
import { EntityType, KIP_KIT, GameConfig } from '@siege/shared';
import { markRevealRange, MARK_REVEAL_RANGE } from '@/online/markReveal';

const champion = (side: number, effects: string[] = [], isDead = false) => ({
  entityType: EntityType.CHAMPION,
  side,
  isDead,
  activeEffects: effects.map(definitionId => ({ definitionId, timeRemaining: 2, stacks: 1 })),
});

describe('the client fog around a marked enemy', () => {
  it('opens a small window of sight around an enemy champion holding the mark', () => {
    expect(markRevealRange(champion(1, [KIP_KIT.markEffect]), 0)).toBe(MARK_REVEAL_RANGE);
    expect(MARK_REVEAL_RANGE).toBeGreaterThan(0);
    expect(MARK_REVEAL_RANGE).toBeLessThan(GameConfig.VISION.CHAMPION_SIGHT_RANGE / 4);
  });

  it('opens none around an unmarked enemy', () => {
    expect(markRevealRange(champion(1, ['slow_40']), 0)).toBe(0);
    expect(markRevealRange(champion(1), 0)).toBe(0);
  });

  it('opens none around a dead marked enemy', () => {
    expect(markRevealRange(champion(1, [KIP_KIT.markEffect], true), 0)).toBe(0);
  });

  it('opens none around an ally the enemy Kip marked (its own sight is enough)', () => {
    expect(markRevealRange(champion(0, [KIP_KIT.markEffect]), 0)).toBe(0);
  });

  it('opens none around a marked unit that is not a champion', () => {
    expect(markRevealRange({ ...champion(1, [KIP_KIT.markEffect]), entityType: EntityType.MINION }, 0)).toBe(0);
  });
});
