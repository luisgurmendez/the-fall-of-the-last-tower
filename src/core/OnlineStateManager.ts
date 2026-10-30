/**
 * OnlineStateManager - Manages game state received from server.
 *
 * Tracks:
 * - All entity snapshots from server
 * - Local player's entity
 * - Game time and tick
 * - Interpolation for smooth rendering
 */

import type Vector from '@/physics/vector';
import type { MatchData } from '@/ui/matchmaking/MatchmakingUI';
import {
  GameEventType,
  type StateUpdate,
  type FullStateSnapshot,
  type GameEvent,
} from '@siege/shared';
import { getVFXManager } from '@/vfx';
import { WORLD_VFX } from '@/vfx/world';
import { shakeScreen } from '@/core/screenShake';
import {
  getAbilityAnimationProgress,
  getAbilityCastState,
  getAttackAnimationProgress,
  interpolatePosition,
  isAttackAnimationPlaying,
  type InterpolatedEntity,
} from './state/entities';
import { AbilityEffects, type AbilityEffect } from './state/abilityEffects';
import {
  FloatingNumbers,
  type DamageNumber,
  type GoldNumber,
  type XpNumber,
} from './state/floatingNumbers';
import { CampTimers, type CampTimer } from './state/campTimers';
import {
  ANNOUNCEMENT_DURATION,
  Announcements,
  type Announcement,
} from './state/announcements';
import { EntityVFX, spawnWorldVFX } from './state/entityVFX';
import { addOrUpdateEntity, applyEntityDelta, type EntityLifecycleHooks } from './state/deltas';

export type { EntityAnimationState, InterpolatedEntity } from './state/entities';
export type { AbilityEffect } from './state/abilityEffects';
export type { DamageNumber, GoldNumber, XpNumber } from './state/floatingNumbers';
export type { CampTimer } from './state/campTimers';
export type { Announcement } from './state/announcements';

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

  // Floating damage, gold and XP numbers
  private floatingNumbers = new FloatingNumbers();

  // Cleared jungle camps waiting to respawn
  private campTimers = new CampTimers();

  // Big moments to announce on screen (dragon slain, ...)
  private announcements = new Announcements();

  // Death, respawn, level up and recall effects
  private entityVFX = new EntityVFX();

  // Game time when the local champion respawns, while it's dead
  private localRespawnAt: number | null = null;

  // Ability visual effects (legacy system)
  private abilityEffects = new AbilityEffects();

  // Called by the delta merge: entity effects and the local respawn timer
  private readonly lifecycleHooks: EntityLifecycleHooks = {
    onRemoved: (entityId, existing, data) => {
      if (existing) this.entityVFX.spawnDeathVFX(existing);
      if (entityId === this.localEntityId && typeof data.respawnTimer === 'number') {
        this.localRespawnAt = this.gameTime + data.respawnTimer;
      }
    },
    onChanged: (existing, data) => {
      this.entityVFX.spawnChangeVFX(existing, data);
    },
    onAdded: (snapshot, position) => {
      // A champion we saw die is back: respawn effect
      this.entityVFX.spawnRespawnVFX(snapshot.entityId, position);
      if (snapshot.entityId === this.localEntityId) {
        this.localRespawnAt = null;
      }
    },
  };

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
          spawnWorldVFX(spark, entity.position.x, entity.position.y - 10);
        }

        if (entity && (amount > 0 || shieldAbsorbed > 0)) {
          this.floatingNumbers.addDamage({
            entityId,
            x: entity.position.x,
            y: entity.position.y,
            amount,
            shieldAbsorbed,
            damageType,
            startTime: now,
          });
        }
        break;
      }
      case GameEventType.GOLD_EARNED: {
        const entityId = event.data.entityId as string;
        const amount = event.data.amount as number;
        const entity = this.entities.get(entityId);

        if (entity && amount > 0) {
          this.floatingNumbers.addGold({
            entityId,
            x: entity.position.x,
            y: entity.position.y,
            amount,
            startTime: now,
          });
        }
        break;
      }
      case GameEventType.CAMP_CLEARED: {
        this.campTimers.set({
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
        this.announcements.add({
          text: ours ? 'Your tower has been destroyed' : 'Your team destroyed a tower!',
          color: ours ? '#ec7063' : '#5dade2',
          startTime: now,
          duration: ANNOUNCEMENT_DURATION,
        });
        break;
      }
      case GameEventType.DRAGON_KILLED: {
        const allied = event.data.side === this.localSide;
        this.announcements.add({
          text: allied ? 'Your team slew the Dragon!' : 'The enemy team slew the Dragon!',
          detail: "Dragon's Might: +8% attack damage and ability power",
          color: allied ? '#5dade2' : '#ec7063',
          startTime: now,
          duration: ANNOUNCEMENT_DURATION,
        });
        break;
      }
      case GameEventType.XP_EARNED: {
        const entityId = event.data.entityId as string;
        const amount = event.data.amount as number;
        const entity = this.entities.get(entityId);

        if (entity && amount > 0) {
          this.floatingNumbers.addXp({
            entityId,
            x: entity.position.x,
            y: entity.position.y,
            amount,
            startTime: now,
          });
        }
        break;
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
    return this.campTimers.getActive(this.gameTime);
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

    this.announcements.add({
      text: data.firstBlood ? 'First Blood!' : text,
      detail: data.firstBlood ? text : undefined,
      color: allyDied ? '#ec7063' : '#f5b041',
      startTime: now,
      duration: ANNOUNCEMENT_DURATION,
    });
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
