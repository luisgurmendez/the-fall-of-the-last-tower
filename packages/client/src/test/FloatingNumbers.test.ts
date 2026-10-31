/**
 * Floating combat text from game events (src/core/state/gameEvents.ts):
 * only the local champion's, as in the classic MOBA. The damage it deals or
 * takes, flying off to alternate sides, and its own gold; nothing for units
 * trading hits elsewhere.
 */
import { describe, it, expect } from 'bun:test';
import { GameEventType, type GameEvent } from '@siege/shared';
import { processGameEvent, type GameEventContext } from '@/core/state/gameEvents';
import { FloatingNumbers } from '@/core/state/floatingNumbers';
import { AbilityEffects } from '@/core/state/abilityEffects';
import { CampTimers } from '@/core/state/campTimers';
import { Announcements } from '@/core/state/announcements';
import { DamageTaken } from '@/core/state/damageTaken';
import type { InterpolatedEntity } from '@/core/state/entities';

function entity(entityId: string): InterpolatedEntity {
  return {
    snapshot: { entityId, maxHealth: 1000 },
    position: { x: 0, y: 0 },
    animation: {},
  } as unknown as InterpolatedEntity;
}

function context(): GameEventContext {
  return {
    entities: new Map(['me', 'enemy', 'minion-a', 'minion-b'].map(id => [id, entity(id)])),
    localEntityId: 'me',
    localSide: 0,
    floatingNumbers: new FloatingNumbers(),
    abilityEffects: new AbilityEffects(),
    campTimers: new CampTimers(),
    announcements: new Announcements(),
    damageTaken: new DamageTaken(),
  };
}

function damage(entityId: string, sourceId: string, amount = 30): GameEvent {
  return { type: GameEventType.DAMAGE, timestamp: 0, data: { entityId, sourceId, amount, damageType: 'physical', shieldAbsorbed: 0 } };
}

describe('floating numbers from game events', () => {
  it('shows the damage the local champion deals and takes, not other units trading hits', () => {
    const ctx = context();
    processGameEvent(damage('minion-a', 'minion-b'), ctx);
    processGameEvent(damage('enemy', 'minion-a'), ctx);
    processGameEvent(damage('minion-a', 'me', 40), ctx);
    processGameEvent(damage('me', 'enemy', 50), ctx);

    const numbers = ctx.floatingNumbers.getDamageNumbers();
    expect(numbers.map(n => [n.entityId, n.amount])).toEqual([['minion-a', 40], ['me', 50]]);
  });

  it('sends hits off to alternate sides', () => {
    const ctx = context();
    for (let i = 0; i < 3; i++) processGameEvent(damage('minion-a', 'me'), ctx);
    expect(ctx.floatingNumbers.getDamageNumbers().map(n => n.side)).toEqual([1, -1, 1]);
  });

  it("shows only the local champion's gold", () => {
    const ctx = context();
    processGameEvent({ type: GameEventType.GOLD_EARNED, timestamp: 0, data: { entityId: 'enemy', amount: 20 } }, ctx);
    processGameEvent({ type: GameEventType.GOLD_EARNED, timestamp: 0, data: { entityId: 'me', amount: 21 } }, ctx);
    expect(ctx.floatingNumbers.getGoldNumbers().map(n => n.amount)).toEqual([21]);
  });
});
