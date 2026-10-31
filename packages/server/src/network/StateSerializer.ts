/**
 * StateSerializer - Handles serialization and delta compression for network sync.
 *
 * Responsibilities:
 * - Serialize entity state to compact format
 * - Track entity changes for delta compression
 * - Create minimal updates by only sending changed fields
 */

import {
  EntityType,
  EntityChangeMask,
  type EntitySnapshot,
  type EntityDelta,
  type ChampionSnapshot,
  type MinionSnapshot,
  type TowerSnapshot,
  type NexusSnapshot,
  type JungleCreatureSnapshot,
  type StateUpdate,
} from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerMinion } from '../simulation/ServerMinion';
import type { ServerTower } from '../simulation/ServerTower';

/**
 * Track previous state for delta calculation.
 */
interface EntityState {
  snapshot: EntitySnapshot;
  tick: number;
}

/**
 * How far a minion's move target can drift from the one its client has before
 * it is sent again. Following the lane moves the target every tick; the client
 * only needs it to tell walking from standing and to face the right way.
 */
const MINION_TARGET_RESEND_DISTANCE = 48;

/** Champion stats sent together under EntityChangeMask.STATS */
const CHAMPION_STATS = [
  'attackDamage',
  'abilityPower',
  'armor',
  'magicResist',
  'attackSpeed',
  'movementSpeed',
  'attackRange',
] as const satisfies readonly (keyof ChampionSnapshot)[];

/**
 * Entity types with change tracking of their own (below). The rest
 * (projectiles, zones, wards, Lume's orb, inhibitors) are small and few: any
 * of their fields that changed is sent, under STATE, so states like a
 * destroyed orb, a zone's remaining time or an inhibitor's rebuild time
 * (respawnAt, null once it stands again) reach clients.
 */
const TRACKED_TYPES = new Set<EntityType>([
  EntityType.CHAMPION,
  EntityType.MINION,
  EntityType.TOWER,
  EntityType.NEXUS,
  EntityType.JUNGLE_CAMP,
]);

/** Fields of an untracked entity's snapshot that changed (besides its position) */
function changedFields(previous: EntitySnapshot, current: EntitySnapshot): string[] {
  const before = previous as unknown as Record<string, unknown>;
  const after = current as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter(key => {
    if (key === 'x' || key === 'y') return false;
    const a = before[key];
    const b = after[key];
    if (a === b) return false;
    return typeof a !== 'object' || typeof b !== 'object' || JSON.stringify(a) !== JSON.stringify(b);
  });
}

/**
 * Serializes game state for network transmission with delta compression.
 */
export class StateSerializer {
  // Previous entity states for delta calculation
  private previousStates: Map<string, Map<string, EntityState>> = new Map(); // playerId -> entityId -> state

  /**
   * Create a full state snapshot for initial sync.
   */
  createFullSnapshot(
    entities: ServerEntity[],
    tick: number,
    gameTime: number
  ): EntitySnapshot[] {
    return entities.map(entity => entity.toSnapshot());
  }

  /**
   * Create delta updates by comparing to previous state.
   * @param entities - Prioritized entities to send updates for
   * @param playerId - The player receiving this update
   * @param tick - Current game tick
   * @param allVisibleEntities - Optional: full list of visible entities (for removal detection)
   * @param isInGame - Optional: whether an entity still exists. An entity that left the
   *                   visible set but still exists left sight; otherwise it's gone (died,
   *                   destroyed, expired). Without it, every removal counts as gone.
   */
  createDeltaUpdates(
    entities: ServerEntity[],
    playerId: string,
    tick: number,
    allVisibleEntities?: ServerEntity[],
    isInGame?: (entityId: string) => boolean
  ): EntityDelta[] {
    const deltas: EntityDelta[] = [];
    const playerStates = this.getPreviousStates(playerId);

    for (const entity of entities) {
      const currentSnapshot = entity.toSnapshot();
      const previousState = playerStates.get(entity.id);
      const wasDead = (previousState?.snapshot as { isDead?: boolean } | undefined)?.isDead === true;
      const isDead = (currentSnapshot as { isDead?: boolean }).isDead === true;

      if (wasDead && isDead) {
        // The client removes an entity when told it died (an allied champion
        // stays visible while dead), so there is nothing to update until it
        // comes back. Keep the state fresh so it isn't dropped as stale.
        playerStates.set(entity.id, { snapshot: currentSnapshot, tick });
        continue;
      }

      if (!previousState || (wasDead && !isDead)) {
        // New entity, or a champion respawning (the client rebuilds it) - send full snapshot as delta
        deltas.push({
          entityId: entity.id,
          changeMask: 0xFFFF, // All fields changed
          data: currentSnapshot,
        });
      } else {
        // Calculate what changed
        const changeMask = this.calculateChangeMask(previousState.snapshot, currentSnapshot);

        if (changeMask !== 0) {
          deltas.push({
            entityId: entity.id,
            changeMask,
            data: this.getChangedFields(previousState.snapshot, currentSnapshot, changeMask),
          });
        }

        if (currentSnapshot.entityType === EntityType.MINION && !(changeMask & EntityChangeMask.TARGET)) {
          // Compare later move targets with the one the client has, not this tick's
          const sent = previousState.snapshot as MinionSnapshot;
          playerStates.set(entity.id, {
            snapshot: { ...currentSnapshot, targetX: sent.targetX, targetY: sent.targetY },
            tick,
          });
          continue;
        }
      }

      // Update previous state
      playerStates.set(entity.id, { snapshot: currentSnapshot, tick });
    }

    // Send removal deltas for entities that are truly gone from the game
    // (not just de-prioritized this tick)
    if (allVisibleEntities) {
      // Create a set of all visible entity IDs for fast lookup
      const visibleEntityIds = new Set(allVisibleEntities.map(e => e.id));

      for (const [entityId, state] of playerStates) {
        // If entity was in our previous state but is NOT in the full visible list,
        // it either left this player's sight or was removed from the game (died,
        // destroyed, etc.). The client plays death effects only for the latter.
        if (!visibleEntityIds.has(entityId)) {
          const leftSight = isInGame?.(entityId) === true;
          deltas.push({
            entityId,
            changeMask: EntityChangeMask.STATE,
            data: (leftSight
              ? { entityId, entityType: state.snapshot.entityType, outOfSight: true }
              : { entityId, entityType: state.snapshot.entityType, isDead: true, isDestroyed: true }
            ) as Partial<EntitySnapshot>,
          });
          playerStates.delete(entityId);
        }
      }
    }

    // Clean up stale entries from playerStates (entities that haven't been seen in a while)
    // This prevents memory leaks for edge cases
    const STALE_TICK_THRESHOLD = 300; // ~2.4 seconds at 125Hz
    for (const [entityId, state] of playerStates) {
      if (tick - state.tick > STALE_TICK_THRESHOLD) {
        playerStates.delete(entityId);
      }
    }

    return deltas;
  }

  /**
   * Create a state update message.
   * @param entities - Prioritized entities to send updates for
   * @param playerId - The player receiving this update
   * @param tick - Current game tick
   * @param gameTime - Current game time
   * @param inputAcks - Input acknowledgments
   * @param events - Game events
   * @param allVisibleEntities - Optional: full list of visible entities (for removal detection)
   *                             If provided, removal deltas are sent for entities not in this list.
   *                             If not provided, no removal deltas are sent.
   * @param isInGame - Optional: whether an entity still exists (see createDeltaUpdates)
   */
  createStateUpdate(
    entities: ServerEntity[],
    playerId: string,
    tick: number,
    gameTime: number,
    inputAcks: Record<string, number>,
    events: { type: number; timestamp: number; data: Record<string, unknown> }[],
    allVisibleEntities?: ServerEntity[],
    isInGame?: (entityId: string) => boolean
  ): StateUpdate {
    const deltas = this.createDeltaUpdates(entities, playerId, tick, allVisibleEntities, isInGame);

    return {
      tick,
      timestamp: Date.now(),
      gameTime,
      inputAcks,
      deltas,
      events,
    };
  }

  /**
   * Whether a minion started or stopped moving, or its move target moved far
   * from the one the client has.
   */
  private moveTargetDrifted(sent: MinionSnapshot, current: MinionSnapshot): boolean {
    if (sent.targetX == null || sent.targetY == null || current.targetX == null || current.targetY == null) {
      return (sent.targetX == null) !== (current.targetX == null);
    }
    return Math.hypot(current.targetX - sent.targetX, current.targetY - sent.targetY) > MINION_TARGET_RESEND_DISTANCE;
  }

  /**
   * Calculate the change mask between two snapshots.
   */
  private calculateChangeMask(previous: EntitySnapshot, current: EntitySnapshot): number {
    let mask = 0;

    // Position changed
    if (previous.x !== current.x || previous.y !== current.y) {
      mask |= EntityChangeMask.POSITION;
    }

    // Health changed
    if ('health' in previous && 'health' in current) {
      if ((previous as any).health !== (current as any).health) {
        mask |= EntityChangeMask.HEALTH;
      }
    }

    // For champions, check more fields
    if (current.entityType === EntityType.CHAMPION) {
      const prevChamp = previous as ChampionSnapshot;
      const currChamp = current as ChampionSnapshot;

      if (prevChamp.resource !== currChamp.resource) {
        mask |= EntityChangeMask.RESOURCE;
      }

      if (prevChamp.level !== currChamp.level ||
          prevChamp.skillPoints !== currChamp.skillPoints) {
        mask |= EntityChangeMask.LEVEL;
      }

      // Items, levels, buffs and slows change these
      if (CHAMPION_STATS.some(stat => prevChamp[stat] !== currChamp[stat])) {
        mask |= EntityChangeMask.STATS;
      }

      // Check abilities and summoner spells (simplified - in production use deep comparison)
      if (JSON.stringify(prevChamp.abilities) !== JSON.stringify(currChamp.abilities) ||
          JSON.stringify(prevChamp.summoners) !== JSON.stringify(currChamp.summoners)) {
        mask |= EntityChangeMask.ABILITIES;
      }

      // Check effects
      if (JSON.stringify(prevChamp.activeEffects) !== JSON.stringify(currChamp.activeEffects)) {
        mask |= EntityChangeMask.EFFECTS;
      }

      // Check shields
      if (JSON.stringify(prevChamp.shields) !== JSON.stringify(currChamp.shields)) {
        mask |= EntityChangeMask.SHIELDS;
      }

      // Check passive state
      if (JSON.stringify(prevChamp.passive) !== JSON.stringify(currChamp.passive)) {
        mask |= EntityChangeMask.PASSIVE;
      }

      // Check items
      if (JSON.stringify(prevChamp.items) !== JSON.stringify(currChamp.items)) {
        mask |= EntityChangeMask.ITEMS;
      }

      // Check target
      if (prevChamp.targetEntityId !== currChamp.targetEntityId ||
          prevChamp.targetX !== currChamp.targetX ||
          prevChamp.targetY !== currChamp.targetY) {
        mask |= EntityChangeMask.TARGET;
      }

      // Check state (dead, recalling, etc.)
      if (prevChamp.isDead !== currChamp.isDead ||
          prevChamp.isRecalling !== currChamp.isRecalling) {
        mask |= EntityChangeMask.STATE;
      }

      // Check trinket (ward charges, cooldown)
      if (prevChamp.trinketCharges !== currChamp.trinketCharges ||
          prevChamp.trinketCooldown !== currChamp.trinketCooldown ||
          prevChamp.trinketRechargeProgress !== currChamp.trinketRechargeProgress) {
        mask |= EntityChangeMask.TRINKET;
      }

      // Check gold
      if (prevChamp.gold !== currChamp.gold) {
        mask |= EntityChangeMask.GOLD;
      }

      // Kills, deaths, assists and creep score
      if (prevChamp.kills !== currChamp.kills || prevChamp.deaths !== currChamp.deaths ||
          prevChamp.assists !== currChamp.assists || prevChamp.cs !== currChamp.cs) {
        mask |= EntityChangeMask.SCORE;
      }

      // Dash state
      if (prevChamp.isDashing !== currChamp.isDashing || prevChamp.dashAbilityId !== currChamp.dashAbilityId ||
          prevChamp.dashTargetX !== currChamp.dashTargetX || prevChamp.dashTargetY !== currChamp.dashTargetY) {
        mask |= EntityChangeMask.DASH;
      }
    }

    // For minions/towers
    if (current.entityType === EntityType.MINION || current.entityType === EntityType.TOWER) {
      const prev = previous as MinionSnapshot | TowerSnapshot;
      const curr = current as MinionSnapshot | TowerSnapshot;

      if (prev.targetEntityId !== curr.targetEntityId ||
          (current.entityType === EntityType.MINION &&
            this.moveTargetDrifted(prev as MinionSnapshot, curr as MinionSnapshot))) {
        mask |= EntityChangeMask.TARGET;
      }

      if ((prev as any).isDead !== (curr as any).isDead ||
          (prev as any).isDestroyed !== (curr as any).isDestroyed ||
          (prev as any).isProtected !== (curr as any).isProtected) {
        mask |= EntityChangeMask.STATE;
      }
    }

    // For the nexus
    if (current.entityType === EntityType.NEXUS) {
      const prev = previous as NexusSnapshot;
      const curr = current as NexusSnapshot;
      if (prev.isDestroyed !== curr.isDestroyed || prev.isProtected !== curr.isProtected) {
        mask |= EntityChangeMask.STATE;
      }
    }

    if (!TRACKED_TYPES.has(current.entityType) && changedFields(previous, current).length > 0) {
      mask |= EntityChangeMask.STATE;
    }

    // For jungle creatures
    if (current.entityType === EntityType.JUNGLE_CAMP) {
      const prev = previous as JungleCreatureSnapshot;
      const curr = current as JungleCreatureSnapshot;

      if (prev.targetEntityId !== curr.targetEntityId ||
          prev.targetX !== curr.targetX ||
          prev.targetY !== curr.targetY) {
        mask |= EntityChangeMask.TARGET;
      }

      if (prev.isDead !== curr.isDead) {
        mask |= EntityChangeMask.STATE;
      }
    }

    return mask;
  }

  /**
   * Get only the changed fields based on mask.
   */
  private getChangedFields(
    previous: EntitySnapshot,
    current: EntitySnapshot,
    mask: number
  ): Partial<EntitySnapshot> {
    const result: Partial<EntitySnapshot> = {
      entityId: current.entityId,
      entityType: current.entityType,
      // IMPORTANT: Always include 'side' - client needs this for fog of war filtering
      // Without it, entities reappearing after being out of view won't have a side
      side: (current as any).side,
    };

    if (mask & EntityChangeMask.POSITION) {
      (result as any).x = current.x;
      (result as any).y = current.y;
    }

    if (mask & EntityChangeMask.HEALTH) {
      (result as any).health = (current as any).health;
      (result as any).maxHealth = (current as any).maxHealth;
    }

    if (current.entityType === EntityType.CHAMPION) {
      const currChamp = current as ChampionSnapshot;

      if (mask & EntityChangeMask.RESOURCE) {
        (result as any).resource = currChamp.resource;
        (result as any).maxResource = currChamp.maxResource;
      }

      if (mask & EntityChangeMask.LEVEL) {
        (result as any).level = currChamp.level;
        (result as any).experience = currChamp.experience;
        (result as any).experienceToNextLevel = currChamp.experienceToNextLevel;
        (result as any).skillPoints = currChamp.skillPoints;
      }

      if (mask & EntityChangeMask.STATS) {
        for (const stat of CHAMPION_STATS) {
          (result as any)[stat] = currChamp[stat];
        }
      }

      if (mask & EntityChangeMask.ABILITIES) {
        (result as any).abilities = currChamp.abilities;
        (result as any).summoners = currChamp.summoners;
      }

      if (mask & EntityChangeMask.EFFECTS) {
        (result as any).activeEffects = currChamp.activeEffects;
      }

      if (mask & EntityChangeMask.SHIELDS) {
        (result as any).shields = currChamp.shields;
      }

      if (mask & EntityChangeMask.PASSIVE) {
        (result as any).passive = currChamp.passive;
      }

      if (mask & EntityChangeMask.ITEMS) {
        (result as any).items = currChamp.items;
        (result as any).gold = currChamp.gold;
      }

      if (mask & EntityChangeMask.TARGET) {
        (result as any).targetX = currChamp.targetX;
        (result as any).targetY = currChamp.targetY;
        (result as any).targetEntityId = currChamp.targetEntityId;
      }

      if (mask & EntityChangeMask.STATE) {
        (result as any).isDead = currChamp.isDead;
        (result as any).respawnTimer = currChamp.respawnTimer;
        (result as any).isRecalling = currChamp.isRecalling;
        (result as any).recallProgress = currChamp.recallProgress;
      }

      if (mask & EntityChangeMask.TRINKET) {
        (result as any).trinketCharges = currChamp.trinketCharges;
        (result as any).trinketMaxCharges = currChamp.trinketMaxCharges;
        (result as any).trinketCooldown = currChamp.trinketCooldown;
        (result as any).trinketRechargeProgress = currChamp.trinketRechargeProgress;
      }

      if (mask & EntityChangeMask.GOLD) {
        (result as any).gold = currChamp.gold;
      }

      if (mask & EntityChangeMask.SCORE) {
        (result as any).kills = currChamp.kills;
        (result as any).deaths = currChamp.deaths;
        (result as any).assists = currChamp.assists;
        (result as any).cs = currChamp.cs;
      }

      if (mask & EntityChangeMask.DASH) {
        (result as any).isDashing = currChamp.isDashing;
        (result as any).dashAbilityId = currChamp.dashAbilityId;
        (result as any).dashTargetX = currChamp.dashTargetX;
        (result as any).dashTargetY = currChamp.dashTargetY;
      }
    }

    if (current.entityType === EntityType.MINION) {
      const currMinion = current as MinionSnapshot;

      if (mask & EntityChangeMask.TARGET) {
        (result as any).targetX = currMinion.targetX;
        (result as any).targetY = currMinion.targetY;
        (result as any).targetEntityId = currMinion.targetEntityId;
      }

      if (mask & EntityChangeMask.STATE) {
        (result as any).isDead = currMinion.isDead;
      }
    }

    if (current.entityType === EntityType.TOWER) {
      const currTower = current as TowerSnapshot;

      if (mask & EntityChangeMask.TARGET) {
        (result as any).targetEntityId = currTower.targetEntityId;
      }

      if (mask & EntityChangeMask.STATE) {
        (result as any).isDestroyed = currTower.isDestroyed;
        (result as any).isProtected = currTower.isProtected;
      }
    }

    if (current.entityType === EntityType.NEXUS) {
      const currNexus = current as NexusSnapshot;

      if (mask & EntityChangeMask.STATE) {
        (result as any).isDestroyed = currNexus.isDestroyed;
        (result as any).isProtected = currNexus.isProtected;
      }
    }

    if (current.entityType === EntityType.JUNGLE_CAMP) {
      const currCreature = current as JungleCreatureSnapshot;

      if (mask & EntityChangeMask.TARGET) {
        (result as any).targetX = currCreature.targetX;
        (result as any).targetY = currCreature.targetY;
        (result as any).targetEntityId = currCreature.targetEntityId;
      }

      if (mask & EntityChangeMask.STATE) {
        (result as any).isDead = currCreature.isDead;
      }
    }

    // Untracked types: every field that changed (a cleared one as null)
    if (!TRACKED_TYPES.has(current.entityType) && (mask & EntityChangeMask.STATE)) {
      const after = current as unknown as Record<string, unknown>;
      for (const key of changedFields(previous, current)) {
        (result as any)[key] = after[key] ?? null;
      }
    }

    return result;
  }

  /**
   * Get previous states for a player, creating if needed.
   */
  private getPreviousStates(playerId: string): Map<string, EntityState> {
    let states = this.previousStates.get(playerId);
    if (!states) {
      states = new Map();
      this.previousStates.set(playerId, states);
    }
    return states;
  }

  /**
   * Clear state for a player (on disconnect/reconnect).
   */
  clearPlayerState(playerId: string): void {
    this.previousStates.delete(playerId);
  }

  /**
   * Clear all state.
   */
  clearAllState(): void {
    this.previousStates.clear();
  }

  /**
   * Get estimated message size in bytes (approximate).
   */
  estimateMessageSize(update: StateUpdate): number {
    // Rough estimation based on JSON
    return JSON.stringify(update).length;
  }
}
