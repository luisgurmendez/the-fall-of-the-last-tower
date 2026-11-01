/**
 * Units that just died, kept for a moment so the renderer can show them
 * falling and fading instead of vanishing (EntityRenderer.renderCorpses):
 * champions, minions and small jungle monsters (the big ones go out with
 * their own death VFX). The unit itself is gone from state.
 */

import { EntityType, type EntitySnapshot } from '@siege/shared';
import type { InterpolatedEntity } from './entities';

export interface Corpse {
  snapshot: EntitySnapshot;
  x: number;
  y: number;
  /** When it died (performance.now, ms) */
  diedAt: number;
  /** How long it takes to fade out (ms) */
  lifetime: number;
}

/** How long each kind of unit lies there, fading (ms) */
const LIFETIMES: Partial<Record<EntityType, number>> = {
  [EntityType.CHAMPION]: 1600,
  [EntityType.MINION]: 900,
  [EntityType.JUNGLE_CAMP]: 1100,
};

/** Monsters with their own big death VFX (and a name plate) don't leave one */
const NO_CORPSE_CREATURES = new Set(['blue_buff', 'red_buff', 'dragon', 'rootwyrm']);

export class Corpses {
  private corpses: Corpse[] = [];

  /** A unit died: keep it for a moment if it's one that falls */
  add(entity: InterpolatedEntity): void {
    const lifetime = LIFETIMES[entity.snapshot.entityType];
    const creatureType = (entity.snapshot as { creatureType?: string }).creatureType;
    if (!lifetime || (creatureType && NO_CORPSE_CREATURES.has(creatureType))) return;
    this.corpses.push({
      snapshot: { ...entity.snapshot },
      x: entity.position.x,
      y: entity.position.y,
      diedAt: performance.now(),
      lifetime,
    });
  }

  /** The ones still fading */
  get(now: number): readonly Corpse[] {
    this.corpses = this.corpses.filter(corpse => now - corpse.diedAt < corpse.lifetime);
    return this.corpses;
  }

  clear(): void {
    this.corpses = [];
  }
}
