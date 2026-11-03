/**
 * OnlineStateManager - Manages game state received from server.
 *
 * Tracks:
 * - All entity snapshots from server
 * - Local player's entity
 * - Game time and tick
 * - Interpolation for smooth rendering
 *
 * It owns the entity map and coordinates the modules in ./state/:
 * - deltas.ts: merges full snapshots and entity deltas into the entity map
 * - gameEvents.ts: turns game events into animations, VFX, numbers and announcements
 * - entityVFX.ts: death, respawn, level up and recall VFX
 * - entities.ts: the entity record, interpolation and animation queries
 * - abilityEffects.ts, floatingNumbers.ts, campTimers.ts, announcements.ts:
 *   the effects, numbers, timers and messages the renderers and HUD read
 */

import type Vector from '@/physics/vector';
import type { MatchData } from '@/ui/matchmaking/MatchmakingUI';
import { findLocalPlayer } from '@/ui/matchmaking/types';
import type { StateUpdate, FullStateSnapshot, FinalPlayerStats } from '@siege/shared';
import { EntityType } from '@siege/shared';
import { WORLD_VFX } from '@/vfx/world';
import {
  getAbilityAnimationProgress,
  getAbilityCastState,
  getAttackAnimationProgress,
  getHitFlash,
  getHitRecoil,
  advanceEntity,
  isAttackAnimationPlaying,
  type AbilityCastState,
  type InterpolatedEntity,
} from './state/entities';
import { AbilityEffects, type AbilityEffect } from './state/abilityEffects';
import { Corpses, type Corpse } from './state/corpses';
import { KillFeed, type KillRecord } from './state/killFeed';
import {
  FloatingNumbers,
  type DamageNumber,
  type GoldNumber,
  type XpNumber,
} from './state/floatingNumbers';
import { CampTimers, type CampTimer } from './state/campTimers';
import { DamageTaken, type DeathRecap } from './state/damageTaken';
import { Announcements, type Announcement } from './state/announcements';
import { EntityVFX, spawnWorldVFX } from './state/entityVFX';
import { addOrUpdateEntity, applyEntityDelta, type EntityLifecycleHooks } from './state/deltas';
import { processGameEvent, type GameEventContext } from './state/gameEvents';
import { playChangeSound, playDeathSound, playWardPlacedSound } from '@/audio/gameSounds';

export type { EntityAnimationState, InterpolatedEntity } from './state/entities';
export type { AbilityEffect } from './state/abilityEffects';
export type { DamageNumber, GoldNumber, XpNumber } from './state/floatingNumbers';
export type { CampTimer } from './state/campTimers';
export type { Announcement } from './state/announcements';
export type { DeathRecap } from './state/damageTaken';

/** How the match ended, for the final scoreboard */
export interface MatchResult {
  won: boolean;
  /** Match length, seconds */
  duration: number;
  players: FinalPlayerStats[];
}

/**
 * OnlineStateManager tracks and interpolates server state.
 */
export class OnlineStateManager {
  // Current entity states
  private readonly entities: Map<string, InterpolatedEntity> = new Map();

  // Match data
  private matchData: MatchData;
  private localPlayerId: string;
  private readonly localEntityId: string;
  private readonly localSide: number;

  // Game timing
  private currentTick = 0;
  private gameTime = 0;
  private lastUpdateTimestamp = 0;

  // Floating damage, gold and XP numbers
  private readonly floatingNumbers = new FloatingNumbers();
  private readonly damageTaken = new DamageTaken();

  // Cleared jungle camps waiting to respawn
  private readonly campTimers = new CampTimers();

  // Big moments to announce on screen (dragon slain, ...)
  private readonly announcements = new Announcements();
  private readonly killFeed = new KillFeed();

  // Death, respawn, level up and recall effects
  private readonly entityVFX = new EntityVFX();

  // Game time when the local champion respawns, while it's dead
  private localRespawnAt: number | null = null;
  /** Set when the match ends */
  private matchResult: MatchResult | null = null;

  // Ability visual effects (legacy system)
  private readonly abilityEffects = new AbilityEffects();

  // Units that just died, falling and fading out
  private readonly corpses = new Corpses();

  // Called by the delta merge: entity effects and the local respawn timer
  private readonly lifecycleHooks: EntityLifecycleHooks = {
    onRemoved: (entityId, existing, data) => {
      if (existing) {
        this.entityVFX.spawnDeathVFX(existing);
        playDeathSound(existing, this.localEntityId);
        this.corpses.add(existing);
      }
      if (entityId === this.localEntityId && typeof data.respawnTimer === 'number') {
        this.localRespawnAt = this.gameTime + data.respawnTimer;
      }
    },
    onChanged: (existing, data) => {
      this.entityVFX.spawnChangeVFX(existing, data);
      playChangeSound(existing, data, this.localEntityId);
    },
    onAdded: (snapshot, position) => {
      // A champion we saw die is back: respawn effect
      this.entityVFX.spawnRespawnVFX(snapshot.entityId, position);
      // A ward just placed (not one coming into sight)
      const ward = snapshot as { entityType: EntityType; wardType?: string; age?: number };
      if (ward.entityType === EntityType.WARD && ward.wardType && (ward.age ?? Infinity) < 0.6) {
        spawnWorldVFX(ward.wardType === 'control' ? WORLD_VFX.CONTROL_WARD_PLACED : WORLD_VFX.WARD_PLACED, position.x, position.y);
        playWardPlacedSound(position.x, position.y);
      }
      if (snapshot.entityId === this.localEntityId) {
        this.localRespawnAt = null;
      }
    },
  };

  // What game events read and write
  private readonly eventContext: GameEventContext;

  constructor(matchData: MatchData) {
    this.matchData = matchData;
    this.localSide = matchData.yourSide;

    // Find local player from match data (player on our side)
    const localPlayer = findLocalPlayer(matchData);
    this.localPlayerId = localPlayer?.playerId || '';
    this.localEntityId = localPlayer?.entityId || '';

    this.eventContext = {
      entities: this.entities,
      localEntityId: this.localEntityId,
      localSide: this.localSide,
      floatingNumbers: this.floatingNumbers,
      abilityEffects: this.abilityEffects,
      campTimers: this.campTimers,
      announcements: this.announcements,
      killFeed: this.killFeed,
      damageTaken: this.damageTaken,
    };
  }

  /**
   * Process a full state snapshot (on connect/reconnect).
   */
  processFullState(snapshot: FullStateSnapshot): void {
    console.log('[StateManager] Processing full state:', snapshot.entities.length, 'entities');

    this.currentTick = snapshot.tick;
    this.gameTime = snapshot.gameTime;
    this.lastUpdateTimestamp = Date.now();

    // Clear existing entities and add all from snapshot
    this.entities.clear();

    for (const entity of snapshot.entities) {
      addOrUpdateEntity(this.entities, entity, this.lifecycleHooks);
    }
  }

  /**
   * Process a delta state update.
   */
  processStateUpdate(update: StateUpdate): void {
    this.currentTick = update.tick;
    this.gameTime = update.gameTime;
    this.lastUpdateTimestamp = Date.now();

    // Process entity deltas
    for (const delta of update.deltas) {
      applyEntityDelta(this.entities, delta, this.lifecycleHooks);
    }

    // Process game events (for animations)
    if (update.events && update.events.length > 0) {
      for (const event of update.events) {
        processGameEvent(event, this.eventContext);
      }
    }
  }

  /**
   * Get all entities for rendering.
   */
  getEntities(): InterpolatedEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get a specific entity by ID.
   */
  getEntity(entityId: string): InterpolatedEntity | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Get the local player's entity.
   */
  getLocalPlayerEntity(): InterpolatedEntity | undefined {
    if (!this.localEntityId) return undefined;
    return this.entities.get(this.localEntityId);
  }

  /**
   * Get the local player's position.
   */
  getLocalPlayerPosition(): Vector | null {
    const localEntity = this.getLocalPlayerEntity();
    return localEntity?.position || null;
  }

  /**
   * Ease every entity toward the server's latest position (once a frame,
   * before drawing).
   */
  advance(): void {
    const now = Date.now();
    for (const entity of this.entities.values()) advanceEntity(entity, now);
  }

  /**
   * Get current game tick.
   */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Get current game time.
   */
  getGameTime(): number {
    return this.gameTime;
  }

  /**
   * Seconds until the local champion respawns, or null while it's alive.
   */
  getLocalRespawnIn(): number | null {
    if (this.localRespawnAt === null) return null;
    return Math.max(0, this.localRespawnAt - this.gameTime);
  }

  /**
   * Jungle camps waiting to respawn (expired timers are dropped).
   */
  getCampTimers(): CampTimer[] {
    return this.campTimers.getActive(this.gameTime);
  }

  /**
   * The match is over: whether the local player's team won, and everyone's
   * final stats.
   */
  setMatchResult(result: MatchResult): void {
    this.matchResult = result;
  }

  /**
   * The match result once it's over, or null while it's being played.
   */
  getMatchResult(): MatchResult | null {
    return this.matchResult;
  }

  /**
   * Show a message in the middle of the screen (e.g. the match result).
   */
  announce(announcement: Omit<Announcement, 'startTime'>): void {
    this.announcements.add({ ...announcement, startTime: Date.now() });
  }

  /**
   * Announcements still on screen (expired ones are dropped).
   */
  getAnnouncements(now = Date.now()): Announcement[] {
    return this.announcements.getActive(now);
  }

  /** The latest champion kills, for the kill feed */
  getKillFeed(now = Date.now()): readonly KillRecord[] {
    return this.killFeed.getActive(now);
  }

  /**
   * Get local player's side.
   */
  getLocalSide(): number {
    return this.localSide;
  }

  /**
   * Get local entity ID.
   */
  getLocalEntityId(): string {
    return this.localEntityId;
  }

  /**
   * Check if we have received any state from server.
   */
  hasState(): boolean {
    return this.entities.size > 0;
  }

  /**
   * Get entity count.
   */
  getEntityCount(): number {
    return this.entities.size;
  }

  /**
   * Check if an entity is currently in attack animation.
   */
  isEntityAttacking(entityId: string): boolean {
    return isAttackAnimationPlaying(this.entities.get(entityId));
  }

  /**
   * Check if an entity is currently casting an ability.
   */
  /** Whether the entity is casting, what, how long its cast animation lasts (seconds) and where it's aimed */
  isEntityCastingAbility(entityId: string): AbilityCastState {
    return getAbilityCastState(this.entities.get(entityId));
  }

  /**
   * Get animation progress (0-1) for attack animation.
   */
  getAttackAnimationProgress(entityId: string): number {
    return getAttackAnimationProgress(this.entities.get(entityId));
  }

  /**
   * How strongly an entity flashes from its last hit (1 just hit, 0 not flashing).
   */
  /** Units that just died, still fading out */
  getCorpses(): readonly Corpse[] {
    return this.corpses.get(performance.now());
  }

  getHitFlash(entityId: string): number {
    return getHitFlash(this.entities.get(entityId));
  }

  /** Where a hit has knocked an entity's body to (world units) */
  getHitRecoil(entityId: string): { x: number; y: number } {
    return getHitRecoil(this.entities.get(entityId));
  }

  /**
   * Get animation progress (0-1) for ability animation.
   */
  getAbilityAnimationProgress(entityId: string): number {
    return getAbilityAnimationProgress(this.entities.get(entityId));
  }

  /**
   * Get all active damage numbers and remove expired ones.
   */
  getDamageNumbers(): DamageNumber[] {
    return this.floatingNumbers.getDamageNumbers();
  }

  /**
   * Get progress (0-1) for a damage number animation.
   */
  getDamageNumberProgress(damageNumber: DamageNumber): number {
    return this.floatingNumbers.getDamageNumberProgress(damageNumber);
  }

  /**
   * Get all active gold numbers and remove expired ones.
   */
  getGoldNumbers(): GoldNumber[] {
    return this.floatingNumbers.getGoldNumbers();
  }

  /**
   * Get progress (0-1) for a gold number animation.
   */
  getGoldNumberProgress(goldNumber: GoldNumber): number {
    return this.floatingNumbers.getGoldNumberProgress(goldNumber);
  }

  /**
   * Get all active XP numbers and remove expired ones.
   */
  getXpNumbers(): XpNumber[] {
    return this.floatingNumbers.getXpNumbers();
  }

  /**
   * Get progress (0-1) for an XP number animation.
   */
  getXpNumberProgress(xpNumber: XpNumber): number {
    return this.floatingNumbers.getXpNumberProgress(xpNumber);
  }

  /**
   * Who hurt the local champion over the last 10 seconds (shown on death).
   */
  getDeathRecap(): DeathRecap {
    return this.damageTaken.recap();
  }

  /**
   * Active heal numbers, each with its progress (0-1).
   */
  getHealNumbers(): ReturnType<FloatingNumbers['getHealNumbers']> {
    return this.floatingNumbers.getHealNumbers();
  }

  /**
   * Get all active ability effects and remove expired ones.
   */
  getAbilityEffects(): AbilityEffect[] {
    return this.abilityEffects.getActive();
  }

  /**
   * Get progress (0-1) for an ability effect animation.
   */
  getAbilityEffectProgress(effect: AbilityEffect): number {
    return this.abilityEffects.getProgress(effect);
  }
}

export default OnlineStateManager;
