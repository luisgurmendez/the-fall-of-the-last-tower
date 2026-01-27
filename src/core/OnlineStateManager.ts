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
  getAbilityDefinition,
  type StateUpdate,
  type FullStateSnapshot,
  type EntitySnapshot,
  type EntityDelta,
  type GameEvent,
  type AbilityDefinition,
} from '@siege/shared';

/**
 * Animation state for an entity.
 */
export interface EntityAnimationState {
  /** True if currently playing attack animation */
  isAttacking: boolean;
  /** When the attack animation started (ms) */
  attackStartTime: number;
  /** Duration of attack animation (ms) */
  attackDuration: number;
  /** True if currently playing ability animation */
  isCastingAbility: boolean;
  /** ID of ability being cast */
  abilityId?: string;
  /** When the ability cast started (ms) */
  abilityStartTime: number;
  /** Duration of ability animation (ms) */
  abilityDuration: number;
}

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
 * Ability visual effect for rendering.
 */
export interface AbilityEffect {
  /** Entity that cast the ability */
  entityId: string;
  /** Ability ID for determining visual style */
  abilityId: string;
  /** World position where ability was cast from */
  originX: number;
  originY: number;
  /** Target position (for direction) */
  targetX: number;
  targetY: number;
  /** When the effect started (ms) */
  startTime: number;
  /** Duration to display (ms) */
  duration: number;
  /** Shape of the ability (cone, circle, line) */
  shape: 'cone' | 'circle' | 'line' | 'point';
  /** Range/radius of the effect */
  range: number;
  /** Cone angle (for cone shapes) */
  coneAngle?: number;
  /** AoE radius (for circle shapes) */
  aoeRadius?: number;
  /** Width (for line shapes) */
  width?: number;
  /** Color of the effect */
  color: string;
}

/**
 * Interpolated entity state for rendering.
 */
export interface InterpolatedEntity {
  snapshot: EntitySnapshot;
  position: Vector;
  previousPosition: Vector;
  lastUpdateTime: number;
  /** Animation state from events */
  animation: EntityAnimationState;
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

  // Ability visual effects
  private abilityEffects: AbilityEffect[] = [];
  private static readonly ABILITY_EFFECT_DURATION = 300; // ms (quick flash)

  constructor(matchData: MatchData) {
    this.matchData = matchData;
    this.localSide = matchData.yourSide;

    // Find local player from match data (player on our side)
    const localPlayer = matchData.players.find(p => p.side === matchData.yourSide);
    this.localPlayerId = localPlayer?.playerId || '';
    this.localEntityId = localPlayer?.entityId || '';

    console.log('[OnlineStateManager] Initialized:', {
      localPlayerId: this.localPlayerId,
      localEntityId: this.localEntityId,
      localSide: this.localSide,
    });
  }

  /**
   * Process a full state snapshot (on connect/reconnect).
   */
  processFullState(snapshot: FullStateSnapshot): void {
    console.log('[StateManager] Processing full state:', snapshot.entities.length, 'entities');

    // DEBUG: Log entity types in full state
    const typeCounts: Record<number, number> = {};
    for (const e of snapshot.entities) {
      typeCounts[e.entityType] = (typeCounts[e.entityType] || 0) + 1;
    }
    console.log('[StateManager] Entity types in full state:', JSON.stringify(typeCounts));

    // Log towers specifically
    const towers = snapshot.entities.filter(e => e.entityType === 2);
    console.log(`[StateManager] Towers in full state: ${towers.length}`);
    for (const t of towers) {
      console.log(`  - Tower: id=${t.entityId}, side=${(t as any).side}, x=${t.x}, y=${t.y}`);
    }

    // Log nexuses specifically
    const nexuses = snapshot.entities.filter(e => e.entityType === 4);
    console.log(`[StateManager] Nexuses in full state: ${nexuses.length}`);
    for (const n of nexuses) {
      console.log(`  - Nexus: id=${n.entityId}, side=${(n as any).side}, x=${n.x}, y=${n.y}`);
    }

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

    // DEBUG: Log incoming updates
    if (update.tick % 30 === 0) {
      console.log(`[OnlineStateManager] Tick ${update.tick}: received ${update.deltas.length} deltas, current entities: ${this.entities.size}`);
    }

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

    // DEBUG: Log after processing
    if (update.tick % 30 === 0) {
      console.log(`[OnlineStateManager] After processing: ${this.entities.size} entities stored`);
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

          // Create visual effect for the ability
          this.createAbilityEffect(entity, abilityId, targetX, targetY, now);
        }
        break;
      }
      case GameEventType.DAMAGE: {
        const entityId = event.data.entityId as string;
        const amount = event.data.amount as number;
        const shieldAbsorbed = (event.data.shieldAbsorbed as number) || 0;
        const damageType = event.data.damageType as 'physical' | 'magic' | 'true' | 'pure';
        const entity = this.entities.get(entityId);

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
      // Remove dead/destroyed entities from client state
      this.entities.delete(delta.entityId);
      return;
    }

    if (existing) {
      // Update existing entity - merge delta into existing snapshot
      const snapshot = { ...existing.snapshot, ...delta.data } as EntitySnapshot;

      // Only update position if x/y are explicitly provided in delta
      // This prevents position from being reset to (0,0) when delta doesn't include position
      if (data && typeof data.x === 'number' && typeof data.y === 'number') {
        existing.previousPosition = existing.position.clone();
        existing.position = new Vector(data.x, data.y);
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
   * Create default animation state.
   */
  private createDefaultAnimationState(): EntityAnimationState {
    return {
      isAttacking: false,
      attackStartTime: 0,
      attackDuration: 0,
      isCastingAbility: false,
      abilityId: undefined,
      abilityStartTime: 0,
      abilityDuration: 0,
    };
  }

  /**
   * Add or update an entity.
   */
  private addOrUpdateEntity(snapshot: EntitySnapshot): void {
    const pos = new Vector(snapshot.x, snapshot.y);

    // DEBUG: Log tower and nexus entities
    if (snapshot.entityType === EntityType.TOWER) {
      console.log(`[OnlineStateManager] Tower: id=${snapshot.entityId}, side=${(snapshot as any).side}, x=${snapshot.x}, y=${snapshot.y}`);
    }
    if (snapshot.entityType === EntityType.NEXUS) {
      console.log(`[OnlineStateManager] Nexus: id=${snapshot.entityId}, side=${(snapshot as any).side}, x=${snapshot.x}, y=${snapshot.y}`);
    }

    // Preserve existing animation state if entity exists
    const existing = this.entities.get(snapshot.entityId);
    const animation = existing?.animation ?? this.createDefaultAnimationState();

    this.entities.set(snapshot.entityId, {
      snapshot,
      position: pos,
      previousPosition: pos.clone(),
      lastUpdateTime: Date.now(),
      animation,
    });
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

    // Simple linear interpolation based on time since last update
    const timeSinceUpdate = Date.now() - entity.lastUpdateTime;
    const t = Math.min(1, timeSinceUpdate / this.interpolationDelay);

    return Vector.lerp(entity.previousPosition, entity.position, t);
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
    const entity = this.entities.get(entityId);
    if (!entity || !entity.animation.isAttacking) return false;

    const elapsed = Date.now() - entity.animation.attackStartTime;
    if (elapsed >= entity.animation.attackDuration) {
      // Animation finished, clear the flag
      entity.animation.isAttacking = false;
      return false;
    }
    return true;
  }

  /**
   * Check if an entity is currently casting an ability.
   */
  isEntityCastingAbility(entityId: string): { casting: boolean; abilityId?: string } {
    const entity = this.entities.get(entityId);
    if (!entity || !entity.animation.isCastingAbility) {
      return { casting: false };
    }

    const elapsed = Date.now() - entity.animation.abilityStartTime;
    if (elapsed >= entity.animation.abilityDuration) {
      // Animation finished, clear the flag
      entity.animation.isCastingAbility = false;
      entity.animation.abilityId = undefined;
      return { casting: false };
    }
    return { casting: true, abilityId: entity.animation.abilityId };
  }

  /**
   * Get animation progress (0-1) for attack animation.
   */
  getAttackAnimationProgress(entityId: string): number {
    const entity = this.entities.get(entityId);
    if (!entity || !entity.animation.isAttacking) return 0;

    const elapsed = Date.now() - entity.animation.attackStartTime;
    return Math.min(1, elapsed / entity.animation.attackDuration);
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
   * Create a visual effect for an ability cast.
   */
  private createAbilityEffect(
    entity: InterpolatedEntity,
    abilityId: string,
    targetX: number | undefined,
    targetY: number | undefined,
    now: number
  ): void {
    // Skip if no target position
    if (targetX === undefined || targetY === undefined) {
      console.log('[AbilityEffect] Skipping - no target position');
      return;
    }

    // Determine effect properties based on ability ID
    const effectConfig = this.getAbilityEffectConfig(abilityId);
    console.log('[AbilityEffect] Config for', abilityId, ':', effectConfig);
    if (!effectConfig) {
      console.log('[AbilityEffect] No config found for ability:', abilityId);
      return;
    }

    console.log('[AbilityEffect] Creating effect:', { abilityId, originX: entity.position.x, originY: entity.position.y, targetX, targetY });
    this.abilityEffects.push({
      entityId: entity.snapshot.entityId,
      abilityId,
      originX: entity.position.x,
      originY: entity.position.y,
      targetX,
      targetY,
      startTime: now,
      duration: effectConfig.duration,
      shape: effectConfig.shape,
      range: effectConfig.range,
      coneAngle: effectConfig.coneAngle,
      aoeRadius: effectConfig.aoeRadius,
      width: effectConfig.width,
      color: effectConfig.color,
    });
  }

  /**
   * Get visual configuration for an ability.
   * Reads shape/range/angle from shared ability definitions.
   * Returns null if the ability shouldn't have a visual effect.
   */
  private getAbilityEffectConfig(abilityId: string): {
    shape: 'cone' | 'circle' | 'line' | 'point';
    range: number;
    duration: number;
    color: string;
    coneAngle?: number;
    aoeRadius?: number;
    width?: number;
  } | null {
    // Get the ability definition from shared registry
    const abilityDef = getAbilityDefinition(abilityId);
    if (!abilityDef) {
      console.log('[AbilityEffect] No ability definition found for:', abilityId);
      return null;
    }

    // Skip abilities without a visual shape (self-buffs, toggles, etc.)
    if (!abilityDef.shape && abilityDef.targetType === 'self') {
      return null;
    }

    // Visual-only properties: color and duration by damage type or ability
    const visualConfig = this.getAbilityVisualStyle(abilityId, abilityDef);

    // Check if this is a dash ability
    const hasDash = !!abilityDef.dash;

    // Determine shape - map ability shape to visual shape
    let shape: 'cone' | 'circle' | 'line' | 'point';
    if (abilityDef.shape === 'cone') {
      shape = 'cone';
    } else if (abilityDef.shape === 'line' || abilityDef.targetType === 'skillshot' || hasDash) {
      // Dash abilities and skillshots use line shape
      shape = 'line';
    } else if (abilityDef.shape === 'circle' || abilityDef.aoeRadius) {
      shape = 'circle';
    } else if (abilityDef.targetType === 'target_enemy' || abilityDef.targetType === 'target_ally') {
      shape = 'point';
    } else {
      // Default to circle for ground_target, point for others
      shape = abilityDef.targetType === 'ground_target' ? 'circle' : 'point';
    }

    // Determine effect range
    let effectRange = abilityDef.range ?? 0;
    if (shape === 'cone' && abilityDef.aoeRadius) {
      // For cones, use aoeRadius as the actual damage range
      effectRange = abilityDef.aoeRadius;
    } else if (hasDash && abilityDef.dash) {
      // For dash abilities, use dash distance as the range
      effectRange = abilityDef.dash.distance;
    }

    // Determine width for line effects
    // For dash abilities, aoeRadius is the hitbox width
    const effectWidth = hasDash ? (abilityDef.aoeRadius ?? 60) : (abilityDef.width ?? 60);

    return {
      shape,
      range: effectRange,
      duration: visualConfig.duration,
      color: visualConfig.color,
      coneAngle: abilityDef.coneAngle,
      aoeRadius: abilityDef.aoeRadius,
      width: effectWidth,
    };
  }

  /**
   * Get visual style (color, duration) for an ability.
   * This is the only place where visual-only properties are defined.
   */
  private getAbilityVisualStyle(abilityId: string, abilityDef: AbilityDefinition): {
    color: string;
    duration: number;
  } {
    // Color based on damage type
    const damageType = abilityDef.damage?.type;
    let baseColor: string;

    if (damageType === 'physical') {
      baseColor = 'rgba(255, 165, 0, 0.5)'; // Orange for physical
    } else if (damageType === 'magic') {
      baseColor = 'rgba(147, 112, 219, 0.5)'; // Purple for magic
    } else if (damageType === 'true') {
      baseColor = 'rgba(255, 255, 255, 0.5)'; // White for true damage
    } else if (abilityDef.heal) {
      baseColor = 'rgba(144, 238, 144, 0.5)'; // Green for heals
    } else if (abilityDef.shield) {
      baseColor = 'rgba(100, 149, 237, 0.5)'; // Blue for shields
    } else {
      baseColor = 'rgba(200, 200, 200, 0.4)'; // Gray default
    }

    // Override colors for specific abilities if needed
    const colorOverrides: Record<string, string> = {
      // Warrior - warm oranges/golds
      warrior_slash: 'rgba(255, 165, 0, 0.5)',
      warrior_charge: 'rgba(255, 200, 50, 0.4)',
      warrior_ultimate: 'rgba(255, 100, 0, 0.6)',
      // Magnus - fire/arcane
      magnus_fireball: 'rgba(255, 100, 50, 0.5)',
      magnus_meteor: 'rgba(255, 50, 0, 0.5)',
      // Elara - holy gold/green
      elara_heal: 'rgba(255, 215, 0, 0.5)',
      elara_barrier: 'rgba(144, 238, 144, 0.4)',
      // Vex - dark purple/indigo
      vex_shuriken: 'rgba(75, 0, 130, 0.5)',
      vex_dash: 'rgba(50, 0, 80, 0.4)',
      vex_execute: 'rgba(100, 0, 0, 0.6)',
      // Gorath - earthy browns
      gorath_slam: 'rgba(139, 69, 19, 0.5)',
      gorath_taunt: 'rgba(139, 69, 19, 0.4)',
      gorath_earthquake: 'rgba(139, 90, 43, 0.5)',
    };

    // Duration based on ability type
    let duration = 250; // Default
    if (abilityDef.shape === 'cone') {
      duration = 250;
    } else if (abilityDef.targetType === 'skillshot' || abilityDef.shape === 'line') {
      duration = 200;
    } else if (abilityDef.aoeRadius && abilityDef.aoeRadius > 200) {
      duration = 400; // Larger AoE = longer visual
    } else if (abilityDef.targetType === 'target_enemy') {
      duration = 300;
    }

    return {
      color: colorOverrides[abilityId] || baseColor,
      duration,
    };
  }

  /**
   * Get all active ability effects and remove expired ones.
   */
  getAbilityEffects(): AbilityEffect[] {
    const now = Date.now();

    // Remove expired ability effects
    this.abilityEffects = this.abilityEffects.filter(
      (ae) => now - ae.startTime < ae.duration
    );

    return this.abilityEffects;
  }

  /**
   * Get progress (0-1) for an ability effect animation.
   */
  getAbilityEffectProgress(effect: AbilityEffect): number {
    const elapsed = Date.now() - effect.startTime;
    return Math.min(1, elapsed / effect.duration);
  }
}

export default OnlineStateManager;
