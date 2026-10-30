/**
 * Entity delta merging (src/core/state/deltas.ts): an entity that leaves the
 * player's sight is dropped quietly; one that dies goes through onRemoved,
 * which plays its death effects.
 */
import { describe, it, expect } from 'bun:test';
import { applyEntityDelta, addOrUpdateEntity, type EntityLifecycleHooks } from '@/core/state/deltas';
import type { InterpolatedEntity } from '@/core/state/entities';
import { EntityChangeMask, EntityType, type EntitySnapshot } from '@siege/shared';

function setup() {
  const entities = new Map<string, InterpolatedEntity>();
  const removed: string[] = [];
  const hooks: EntityLifecycleHooks = {
    onRemoved: (entityId) => removed.push(entityId),
    onChanged: () => {},
    onAdded: () => {},
  };
  const wolf = {
    entityId: 'wolf-1', entityType: EntityType.JUNGLE_CAMP, side: 2, campId: 'wolves',
    creatureType: 'wolf', x: 100, y: 100, health: 400, maxHealth: 400, isDead: false,
  } as EntitySnapshot;
  addOrUpdateEntity(entities, wolf, hooks);
  return { entities, removed, hooks };
}

describe('applyEntityDelta removals', () => {
  it('drops an entity that left sight without treating it as a death', () => {
    const { entities, removed, hooks } = setup();
    applyEntityDelta(entities, {
      entityId: 'wolf-1',
      changeMask: EntityChangeMask.STATE,
      data: { entityId: 'wolf-1', entityType: EntityType.JUNGLE_CAMP, outOfSight: true } as any,
    }, hooks);
    expect(entities.has('wolf-1')).toBe(false);
    expect(removed).toEqual([]);
  });

  it('reports an entity that died', () => {
    const { entities, removed, hooks } = setup();
    applyEntityDelta(entities, {
      entityId: 'wolf-1',
      changeMask: EntityChangeMask.STATE,
      data: { entityId: 'wolf-1', entityType: EntityType.JUNGLE_CAMP, isDead: true, isDestroyed: true } as any,
    }, hooks);
    expect(entities.has('wolf-1')).toBe(false);
    expect(removed).toEqual(['wolf-1']);
  });
});
