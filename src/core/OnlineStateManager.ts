/**
 * OnlineStateManager - Manages game state received from server.
 *
 * Tracks:
 * - All entity snapshots from server
 * - Local player's entity
 * - Game time and tick
 * - Interpolation for smooth rendering
 */

import Vector from '@/physics/vector';
import type { MatchData } from '@/ui/matchmaking/MatchmakingUI';
import {
  EntityType,
  GameEventType,
  type StateUpdate,
  type FullStateSnapshot,
  type EntitySnapshot,
  type EntityDelta,
  type GameEvent,
} from '@siege/shared';
import { getVFXManager } from '@/vfx';
import { WORLD_VFX } from '@/vfx/world';
import { shakeScreen } from '@/core/screenShake';
import {
  createDefaultAnimationState,
  getAbilityAnimationProgress,
  getAbilityCastState,
  getAttackAnimationProgress,
  interpolatePosition,
  isAttackAnimationPlaying,
  type InterpolatedEntity,
} from './state/entities';

import { AbilityEffects, type AbilityEffect } from './state/abilityEffects';

export type { EntityAnimationState, InterpolatedEntity } from './state/entities';
export type { AbilityEffect } from './state/abilityEffects';

/**
 * Floating damage number for visual feedback.
 */
export interface DamageNumber {
  /** Entity that received damage */
  entityId: string;
  /** World position where damage occurred */
  x: number;
  y: number;
  /** Amount of damage dealt to health */
  amount: number;
  /** Amount absorbed by shield */
  shieldAbsorbed: number;
  /** Type of damage */
  damageType: 'physical' | 'magic' | 'true' | 'pure';
  /** When the damage occurred (ms) */
  startTime: number;
  /** Duration to display (ms) */
  duration: number;
}

/**
 * Floating gold number for visual feedback.
 */
export interface GoldNumber {
  /** Entity that earned gold */
  entityId: string;
  /** World position where gold was earned */
  x: number;
  y: number;
  /** Amount of gold earned */
  amount: number;
  /** When the gold was earned (ms) */
  startTime: number;
  /** Duration to display (ms) */
  duration: number;
}

/**
 * A cleared jungle camp and when it comes back.
 */
export interface CampTimer {
  campId: string;
  creatureType: string;
  x: number;
  y: number;
  /** Game time (seconds) when the camp respawns */
  respawnAt: number;
}

/**
 * A message shown in the middle of the screen for a few seconds.
 */
export interface Announcement {
  text: string;
  detail?: string;
  color: string;
  startTime: number;
  /** ms */
  duration: number;
}

/**
 * Floating XP number for visual feedback.
 */
export interface XpNumber {
  /** Entity that earned XP */
  entityId: string;
  /** World position where XP was earned */
  x: number;
  y: number;
  /** Amount of XP earned */
  amount: number;
  /** When the XP was earned (ms) */
  startTime: number;
  /** Duration to display (ms) */
  duration: number;
}

/**
 * OnlineStateManager tracks and interpolates server state.
 */
export class OnlineStateManager {
  // Current entity states
  private entities: Map<string, InterpolatedEntity> = new Map();

  // Match data
  private matchData: MatchData;
  private localPlayerId: string;
  private localEntityId: string;
  private localSide: number;

  // Game timing
  private currentTick = 0;
  private gameTime = 0;
  private lastUpdateTimestamp = 0;

  // Interpolation settings
  private interpolationDelay = 100; // ms

  // Floating damage numbers
  private damageNumbers: DamageNumber[] = [];
  private static readonly DAMAGE_NUMBER_DURATION = 1000; // ms

  // Floating gold numbers
  private goldNumbers: GoldNumber[] = [];
  private static readonly GOLD_NUMBER_DURATION = 1200; // ms (slightly longer than damage)

  // Floating XP numbers
  private xpNumbers: XpNumber[] = [];
  private static readonly XP_NUMBER_DURATION = 1200; // ms

  // Cleared jungle camps waiting to respawn (campId -> timer)
  private campTimers: Map<string, CampTimer> = new Map();

  // Big moments to announce on screen (dragon slain, ...)
  private announcements: Announcement[] = [];

  // Champions removed from state when they died, to spot their respawn
  private deadChampionIds: Set<string> = new Set();

  // Game time when the local champion respawns, while it's dead
  private localRespawnAt: number | null = null;

  // Ability visual effects (legacy system)
  private abilityEffects = new AbilityEffects();
  private static readonly ANNOUNCEMENT_DURATION = 4000; // ms

  constructor(matchData: MatchData) {
    this.matchData = matchData;
    this.localSide = matchData.yourSide;

    // Find local player from match data (player on our side)
    const localPlayer = matchData.players.find(p => p.side === matchData.yourSide);
    this.localPlayerId = localPlayer?.playerId || '';
    this.localEntityId = localPlayer?.entityId || '';
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
      this.addOrUpdateEntity(entity);
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
      this.processDelta(delta);
    }

    // Process game events (for animations)
    if (update.events && update.events.length > 0) {
      for (const event of update.events) {
        this.processEvent(event);
      }
    }
  }

  /**
   * Process a game event.
   */
  private processEvent(event: GameEvent): void {
    const now = Date.now();

    switch (event.type) {
      case GameEventType.BASIC_ATTACK: {
        const entityId = event.data.entityId as string;
        const duration = (event.data.animationDuration as number) * 1000; // Convert to ms
        const entity = this.entities.get(entityId);
        if (entity) {
          entity.animation.isAttacking = true;
          entity.animation.attackStartTime = now;
          entity.animation.attackDuration = duration;
        }
        break;
      }
      case GameEventType.ABILITY_CAST: {
        const entityId = event.data.entityId as string;
        const abilityId = event.data.abilityId as string;
        const targetX = event.data.targetX as number | undefined;
        const targetY = event.data.targetY as number | undefined;
        const duration = ((event.data.animationDuration as number) ?? 0.5) * 1000;
        const entity = this.entities.get(entityId);

        if (entity) {
          entity.animation.isCastingAbility = true;
          entity.animation.abilityId = abilityId;
          entity.animation.abilityStartTime = now;
          entity.animation.abilityDuration = duration;

          // Create visual effect for the ability (legacy system)
          this.abilityEffects.create(entity, abilityId, targetX, targetY, now);

          // Spawn VFX for the ability (new VFX system)
          try {
            const vfxManager = getVFXManager();
            vfxManager.spawnAbilityVFX(
              abilityId,
              entity.position.x,
              entity.position.y,
              targetX,
              targetY,
              entityId
            );
          } catch {
            // VFXManager not initialized yet, skip
          }
        }
        break;
      }
      case GameEventType.DAMAGE: {
        const entityId = event.data.entityId as string;
        const amount = event.data.amount as number;
        const shieldAbsorbed = (event.data.shieldAbsorbed as number) || 0;
        const damageType = event.data.damageType as 'physical' | 'magic' | 'true' | 'pure';
        const entity = this.entities.get(entityId);

        // A heavy hit on the local champion (over 15% of its health) shakes the screen
        if (entity && entityId === this.localEntityId && amount > ((entity.snapshot as any).maxHealth ?? Infinity) * 0.15) {
          shakeScreen(4, 0.25);
        }

        if (entity && amount > 0) {
          const spark = damageType === 'magic' ? WORLD_VFX.HIT_MAGIC
            : damageType === 'physical' ? WORLD_VFX.HIT_PHYSICAL
            : WORLD_VFX.HIT_TRUE;
          this.spawnWorldVFX(spark, entity.position.x, entity.position.y - 10);
        }

        if (entity && (amount > 0 || shieldAbsorbed > 0)) {
          this.damageNumbers.push({
            entityId,
            x: entity.position.x,
            y: entity.position.y,
            amount,
            shieldAbsorbed,
            damageType,
            startTime: now,
            duration: OnlineStateManager.DAMAGE_NUMBER_DURATION,
          });
        }
        break;
      }
      case GameEventType.GOLD_EARNED: {
        const entityId = event.data.entityId as string;
        const amount = event.data.amount as number;
        const entity = this.entities.get(entityId);

        if (entity && amount > 0) {
          this.goldNumbers.push({
            entityId,
            x: entity.position.x,
            y: entity.position.y,
            amount,
            startTime: now,
            duration: OnlineStateManager.GOLD_NUMBER_DURATION,
          });
        }
        break;
      }
      case GameEventType.CAMP_CLEARED: {
        this.campTimers.set(event.data.campId as string, {
          campId: event.data.campId as string,
          creatureType: event.data.creatureType as string,
          x: event.data.x as number,
          y: event.data.y as number,
          respawnAt: event.data.respawnAt as number,
        });
        break;
      }
      case GameEventType.CHAMPION_KILL: {
        this.announceChampionKill(event.data, now);
        break;
      }
      case GameEventType.TOWER_DESTROYED: {
        const ours = event.data.side === this.localSide;
        this.announcements.push({
          text: ours ? 'Your tower has been destroyed' : 'Your team destroyed a tower!',
          color: ours ? '#ec7063' : '#5dade2',
          startTime: now,
          duration: OnlineStateManager.ANNOUNCEMENT_DURATION,
        });
        break;
      }
      case GameEventType.DRAGON_KILLED: {
        const allied = event.data.side === this.localSide;
        this.announcements.push({
          text: allied ? 'Your team slew the Dragon!' : 'The enemy team slew the Dragon!',
          detail: "Dragon's Might: +8% attack damage and ability power",
          color: allied ? '#5dade2' : '#ec7063',
          startTime: now,
          duration: OnlineStateManager.ANNOUNCEMENT_DURATION,
        });
        break;
      }
      case GameEventType.XP_EARNED: {
        const entityId = event.data.entityId as string;
        const amount = event.data.amount as number;
        const entity = this.entities.get(entityId);

        if (entity && amount > 0) {
          this.xpNumbers.push({
            entityId,
            x: entity.position.x,
            y: entity.position.y,
            amount,
            startTime: now,
            duration: OnlineStateManager.XP_NUMBER_DURATION,
          });
        }
        break;
      }
    }
  }

  /**
   * Process a single entity delta.
   */
  private processDelta(delta: EntityDelta): void {
    const existing = this.entities.get(delta.entityId);

    // Check if entity is being marked as dead/destroyed - remove it
    const data = delta.data as any;
    if (data && (data.isDead === true || data.isDestroyed === true)) {
      if (existing) this.spawnDeathVFX(existing);
      if (delta.entityId === this.localEntityId && typeof data.respawnTimer === 'number') {
        this.localRespawnAt = this.gameTime + data.respawnTimer;
      }
      // Remove dead/destroyed entities from client state
      this.entities.delete(delta.entityId);
      return;
    }

    if (existing) {
      this.spawnChangeVFX(existing, data);

      // Update existing entity - merge delta into existing snapshot
      const snapshot = { ...existing.snapshot, ...delta.data } as EntitySnapshot;

      // Clearable values use `null` to indicate "cleared" vs absent meaning "no change"
      // We must explicitly copy these since spread operator handles null correctly but
      // we want to be explicit about the pattern for clarity
      // Round target positions to integers to avoid floating point precision issues
      if (data && 'targetX' in data) {
        (snapshot as any).targetX = data.targetX != null ? Math.round(data.targetX) : null;
      }
      if (data && 'targetY' in data) {
        (snapshot as any).targetY = data.targetY != null ? Math.round(data.targetY) : null;
      }
      if (data && 'targetEntityId' in data) {
        (snapshot as any).targetEntityId = data.targetEntityId;
      }

      // Only update position if x/y are explicitly provided in delta
      // This prevents position from being reset to (0,0) when delta doesn't include position
      // Round positions to integers to avoid floating point precision issues
      if (data && typeof data.x === 'number' && typeof data.y === 'number') {
        existing.previousPosition = existing.position.clone();
        existing.position = new Vector(Math.round(data.x), Math.round(data.y));
      }

      existing.snapshot = snapshot;
      existing.lastUpdateTime = Date.now();
    } else if (delta.data) {
      // New entity - must have position data
      const newData = delta.data as any;
      if (typeof newData.x !== 'number' || typeof newData.y !== 'number') {
        console.warn(`[OnlineStateManager] New entity ${delta.entityId} missing position data:`, delta.data);
        return;
      }
      this.addOrUpdateEntity(delta.data as EntitySnapshot);
    }
  }

  /**
   * Add or update an entity.
   */
  private addOrUpdateEntity(snapshot: EntitySnapshot): void {
    // Round positions to integers to avoid floating point precision issues
    const pos = new Vector(Math.round(snapshot.x), Math.round(snapshot.y));

    // A champion we saw die is back: respawn effect
    if (this.deadChampionIds.delete(snapshot.entityId)) {
      this.spawnWorldVFX(WORLD_VFX.RESPAWN, pos.x, pos.y);
    }
    if (snapshot.entityId === this.localEntityId) {
      this.localRespawnAt = null;
    }

    // Preserve existing animation state if entity exists
    const existing = this.entities.get(snapshot.entityId);
    const animation = existing?.animation ?? createDefaultAnimationState();

    this.entities.set(snapshot.entityId, {
      snapshot,
      position: pos,
      previousPosition: pos.clone(),
      lastUpdateTime: Date.now(),
      animation,
    });
  }

  /**
   * Effects for an entity that just died (it's removed from client state right after).
   */
  private spawnDeathVFX(entity: InterpolatedEntity): void {
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
        this.spawnWorldVFX(WORLD_VFX.CREATURE_DEATH, x, y);
        break;
      case EntityType.CHAMPION:
        this.deadChampionIds.add(entity.snapshot.entityId);
        this.spawnWorldVFX(WORLD_VFX.CHAMPION_DEATH, x, y);
        break;
      case EntityType.TOWER:
      case EntityType.NEXUS:
        this.spawnWorldVFX(WORLD_VFX.TOWER_DESTROYED, x, y);
        shakeScreen(entity.snapshot.entityType === EntityType.NEXUS ? 14 : 8, 0.5);
        break;
    }
  }

  /**
   * Effects for state changes of a living entity (level ups, recall arrivals).
   */
  private spawnChangeVFX(entity: InterpolatedEntity, data: any): void {
    if (!data || entity.snapshot.entityType !== EntityType.CHAMPION) return;
    const previous = entity.snapshot as any;

    if (typeof data.level === 'number' && data.level > previous.level) {
      this.spawnWorldVFX(WORLD_VFX.LEVEL_UP, entity.position.x, entity.position.y);
    }

    // Recall finished: the champion jumped to base
    if (previous.isRecalling && data.isRecalling === false && typeof data.x === 'number') {
      const jump = Math.hypot(data.x - entity.position.x, data.y - entity.position.y);
      if (jump > 400) this.spawnWorldVFX(WORLD_VFX.RECALL_ARRIVE, data.x, data.y);
    }
  }

  private spawnWorldVFX(key: string, x: number, y: number): void {
    try {
      getVFXManager().spawnAbilityVFX(key, x, y);
    } catch {
      // VFX manager not initialized yet, skip
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
   * Get interpolated position for an entity.
   */
  getInterpolatedPosition(entityId: string): Vector | null {
    const entity = this.entities.get(entityId);
    if (!entity) return null;
    return interpolatePosition(entity, this.interpolationDelay);
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
    for (const [campId, timer] of this.campTimers) {
      if (timer.respawnAt <= this.gameTime) this.campTimers.delete(campId);
    }
    return Array.from(this.campTimers.values());
  }

  /**
   * "You have slain an enemy!" and friends, from the local player's point of view.
   */
  private announceChampionKill(data: Record<string, unknown>, now: number): void {
    const victimIsLocal = data.victimId === this.localEntityId;
    const killerIsLocal = data.killerId === this.localEntityId;
    const allyDied = data.victimSide === this.localSide;

    let text: string;
    if (victimIsLocal) text = 'You have been slain!';
    else if (killerIsLocal) text = 'You have slain an enemy!';
    else text = allyDied ? 'An ally has been slain' : 'An enemy has been slain';

    this.announcements.push({
      text: data.firstBlood ? 'First Blood!' : text,
      detail: data.firstBlood ? text : undefined,
      color: allyDied ? '#ec7063' : '#f5b041',
      startTime: now,
      duration: OnlineStateManager.ANNOUNCEMENT_DURATION,
    });
  }

  /**
   * Show a message in the middle of the screen (e.g. the match result).
   */
  announce(announcement: Omit<Announcement, 'startTime'>): void {
    this.announcements.push({ ...announcement, startTime: Date.now() });
  }

  /**
   * Announcements still on screen (expired ones are dropped).
   */
  getAnnouncements(now = Date.now()): Announcement[] {
    this.announcements = this.announcements.filter(a => now - a.startTime < a.duration);
    return this.announcements;
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
  isEntityCastingAbility(entityId: string): { casting: boolean; abilityId?: string } {
    return getAbilityCastState(this.entities.get(entityId));
  }

  /**
   * Get animation progress (0-1) for attack animation.
   */
  getAttackAnimationProgress(entityId: string): number {
    return getAttackAnimationProgress(this.entities.get(entityId));
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
    const now = Date.now();

    // Remove expired damage numbers
    this.damageNumbers = this.damageNumbers.filter(
      (dn) => now - dn.startTime < dn.duration
    );

    return this.damageNumbers;
  }

  /**
   * Get progress (0-1) for a damage number animation.
   */
  getDamageNumberProgress(damageNumber: DamageNumber): number {
    const elapsed = Date.now() - damageNumber.startTime;
    return Math.min(1, elapsed / damageNumber.duration);
  }

  /**
   * Get all active gold numbers and remove expired ones.
   */
  getGoldNumbers(): GoldNumber[] {
    const now = Date.now();

    // Remove expired gold numbers
    this.goldNumbers = this.goldNumbers.filter(
      (gn) => now - gn.startTime < gn.duration
    );

    return this.goldNumbers;
  }

  /**
   * Get progress (0-1) for a gold number animation.
   */
  getGoldNumberProgress(goldNumber: GoldNumber): number {
    const elapsed = Date.now() - goldNumber.startTime;
    return Math.min(1, elapsed / goldNumber.duration);
  }

  /**
   * Get all active XP numbers and remove expired ones.
   */
  getXpNumbers(): XpNumber[] {
    const now = Date.now();

    // Remove expired XP numbers
    this.xpNumbers = this.xpNumbers.filter(
      (xn) => now - xn.startTime < xn.duration
    );

    return this.xpNumbers;
  }

  /**
   * Get progress (0-1) for an XP number animation.
   */
  getXpNumberProgress(xpNumber: XpNumber): number {
    const elapsed = Date.now() - xpNumber.startTime;
    return Math.min(1, elapsed / xpNumber.duration);
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
