/**
 * World VFX (src/vfx/world.ts) for entity state changes seen in deltas:
 * deaths, respawns, level ups and recall arrivals. Also the helper that
 * spawns a world VFX, used by the game event handlers for hit sparks.
 */

import type Vector from '@/physics/vector';
import { EntityType } from '@siege/shared';
import { getVFXManager } from '@/vfx';
import { WORLD_VFX } from '@/vfx/world';
import { shakeScreen } from '@/core/screenShake';
import type { InterpolatedEntity } from './entities';

/**
 * Spawn a VFX by key at a world position (skipped if the VFX manager isn't up yet).
 */
export function spawnWorldVFX(key: string, x: number, y: number): void {
  try {
    getVFXManager().spawnAbilityVFX(key, x, y);
  } catch {
    // VFX manager not initialized yet, skip
  }
}

/**
 * Spawns the death, respawn, level up and recall arrival effects.
 */
export class EntityVFX {
  // Champions removed from state when they died, to spot their respawn
  private deadChampionIds: Set<string> = new Set();

  /**
   * Effects for an entity that just died (it's removed from client state right after).
   */
  spawnDeathVFX(entity: InterpolatedEntity): void {
    const { x, y } = entity.position;
    switch (entity.snapshot.entityType) {
      case EntityType.MINION:
        try {
          getVFXManager().spawnDeathParticles(x, y, '#8B0000');
        } catch {
          // VFX manager not initialized yet, skip
        }
        break;
      case EntityType.JUNGLE_CAMP:
        spawnWorldVFX(WORLD_VFX.CREATURE_DEATH, x, y);
        break;
      case EntityType.CHAMPION:
        this.deadChampionIds.add(entity.snapshot.entityId);
        spawnWorldVFX(WORLD_VFX.CHAMPION_DEATH, x, y);
        break;
      case EntityType.TOWER:
      case EntityType.NEXUS:
        spawnWorldVFX(WORLD_VFX.TOWER_DESTROYED, x, y);
        shakeScreen(entity.snapshot.entityType === EntityType.NEXUS ? 14 : 8, 0.5);
        break;
    }
  }

  /**
   * Effects for an entity being added to client state: a champion we saw die
   * is back, so play the respawn effect.
   */
  spawnRespawnVFX(entityId: string, position: Vector): void {
    if (this.deadChampionIds.delete(entityId)) {
      spawnWorldVFX(WORLD_VFX.RESPAWN, position.x, position.y);
    }
  }

  /**
   * Effects for state changes of a living entity (level ups, recall arrivals).
   */
  spawnChangeVFX(entity: InterpolatedEntity, data: any): void {
    if (!data || entity.snapshot.entityType !== EntityType.CHAMPION) return;
    const previous = entity.snapshot as any;

    if (typeof data.level === 'number' && data.level > previous.level) {
      spawnWorldVFX(WORLD_VFX.LEVEL_UP, entity.position.x, entity.position.y);
    }

    // Recall finished: the champion jumped to base
    if (previous.isRecalling && data.isRecalling === false && typeof data.x === 'number') {
      const jump = Math.hypot(data.x - entity.position.x, data.y - entity.position.y);
      if (jump > 400) spawnWorldVFX(WORLD_VFX.RECALL_ARRIVE, data.x, data.y);
    }
  }
}
