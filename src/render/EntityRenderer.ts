/**
 * EntityRenderer - Renders entities based on server state for online play.
 *
 * Renders:
 * - Champions (with health bars, level indicators)
 * - Minions (with sprites and health bars)
 * - Towers (with sprite images)
 * - Nexus (with sprite images)
 * - Projectiles
 *
 * Uses the sprite system for consistent visuals across all entities.
 */

import type { GameObject } from '@/core/GameObject';
import type GameContext from '@/core/gameContext';
import RenderElement from '@/render/renderElement';
import Vector from '@/physics/vector';
import type { OnlineStateManager, InterpolatedEntity, DamageNumber, GoldNumber, AbilityEffect } from '@/core/OnlineStateManager';
import { EntityType, getChampionDefinition } from '@siege/shared';

/**
 * Colors for different teams.
 */
const TEAM_COLORS = {
  BLUE: '#3498db',
  RED: '#e74c3c',
  NEUTRAL: '#95a5a6',
};

/**
 * Health bar colors based on relationship to local player.
 * - SELF: Green for the local player's champion
 * - ALLY: Blue for allied units (champions, minions, towers)
 * - ENEMY: Red for enemy units
 */
const HEALTH_BAR_COLORS = {
  SELF: '#2ecc71',    // Green - local player
  ALLY: '#3498db',    // Blue - allied units
  ENEMY: '#e74c3c',   // Red - enemy units
  NEUTRAL: '#95a5a6', // Gray - neutral units (jungle camps)
};

/**
 * Shield visual configuration by type.
 * Extensible: add new shield types here with their colors and stripe patterns.
 */
const SHIELD_STYLES: Record<string, { baseColor: string; stripeColor: string; stripeWidth: number }> = {
  normal: {
    baseColor: '#e5e5e5',    // Light gray
    stripeColor: '#9ca3af',   // Darker gray
    stripeWidth: 3,
  },
  magic: {
    baseColor: '#c4b5fd',    // Light purple
    stripeColor: '#8b5cf6',   // Purple
    stripeWidth: 3,
  },
  physical: {
    baseColor: '#fcd34d',    // Light yellow/gold
    stripeColor: '#f59e0b',   // Amber
    stripeWidth: 3,
  },
  passive: {
    baseColor: '#fef08a',    // Pale gold
    stripeColor: '#ca8a04',   // Dark gold
    stripeWidth: 3,
  },
};

/**
 * Mark indicator visual configuration.
 * Used for showing debuff marks, stacks, and other indicators above champions.
 */
interface MarkVisualConfig {
  icon: string;          // Icon character or emoji
  bgColor: string;       // Background color
  borderColor: string;   // Border color
  iconColor: string;     // Icon text color
  showTimer?: boolean;   // Whether to show countdown timer
  showStacks?: boolean;  // Whether to show stack count
  isDebuff?: boolean;    // True for debuffs (shown on enemies)
  isBuff?: boolean;      // True for buffs (shown on self/allies)
}

/**
 * Visual configurations for different mark types.
 * These show as small icons above health bars.
 */
const MARK_VISUALS: Record<string, MarkVisualConfig> = {
  // Vex marks
  vex_mark: {
    icon: 'X',
    bgColor: 'rgba(155, 89, 182, 0.8)',  // Purple
    borderColor: '#9b59b6',
    iconColor: '#ffffff',
    showTimer: true,
    isDebuff: true,
  },
  vex_death_mark: {
    icon: '!',
    bgColor: 'rgba(44, 62, 80, 0.9)',    // Dark
    borderColor: '#e74c3c',               // Red border (danger)
    iconColor: '#e74c3c',
    showTimer: true,
    isDebuff: true,
  },
  vex_stealth: {
    icon: '?',
    bgColor: 'rgba(44, 62, 80, 0.8)',
    borderColor: '#2c3e50',
    iconColor: '#ffffff',
    showTimer: true,
    isBuff: true,
  },
  // CC marks
  stun: {
    icon: '!',
    bgColor: 'rgba(231, 76, 60, 0.8)',
    borderColor: '#e74c3c',
    iconColor: '#ffffff',
    showTimer: true,
    isDebuff: true,
  },
  taunt: {
    icon: 'T',
    bgColor: 'rgba(233, 30, 99, 0.8)',
    borderColor: '#e91e63',
    iconColor: '#ffffff',
    showTimer: true,
    isDebuff: true,
  },
  slow_30: {
    icon: 'v',
    bgColor: 'rgba(52, 152, 219, 0.8)',
    borderColor: '#3498db',
    iconColor: '#ffffff',
    showTimer: true,
    isDebuff: true,
  },
  slow_40: {
    icon: 'v',
    bgColor: 'rgba(41, 128, 185, 0.8)',
    borderColor: '#2980b9',
    iconColor: '#ffffff',
    showTimer: true,
    isDebuff: true,
  },
  // Gorath buffs
  gorath_fortify_buff: {
    icon: 'S',
    bgColor: 'rgba(139, 115, 85, 0.8)',
    borderColor: '#8b7355',
    iconColor: '#ffffff',
    showTimer: true,
    isBuff: true,
  },
  gorath_fortify_mr_buff: {
    icon: 'S',
    bgColor: 'rgba(139, 92, 246, 0.8)',
    borderColor: '#8b5cf6',
    iconColor: '#ffffff',
    showTimer: true,
    isBuff: true,
  },
  // Speed buffs
  speed_20: {
    icon: '>',
    bgColor: 'rgba(46, 204, 113, 0.8)',
    borderColor: '#2ecc71',
    iconColor: '#ffffff',
    showTimer: true,
    isBuff: true,
  },
  speed_30: {
    icon: '>',
    bgColor: 'rgba(39, 174, 96, 0.8)',
    borderColor: '#27ae60',
    iconColor: '#ffffff',
    showTimer: true,
    isBuff: true,
  },
};

/** Default visual for unknown marks */
const DEFAULT_MARK_VISUAL: MarkVisualConfig = {
  icon: '?',
  bgColor: 'rgba(149, 165, 166, 0.8)',
  borderColor: '#95a5a6',
  iconColor: '#ffffff',
  showTimer: true,
};

/**
 * Colors for damage number types.
 */
const DAMAGE_COLORS = {
  physical: '#ffffff',   // White for physical
  magic: '#7B68EE',      // Purple-blue for magic
  true: '#FFD700',       // Gold for true damage
  pure: '#FFD700',       // Gold for pure damage
  shield: '#808080',     // Gray for shield absorbed
};

/**
 * Damage number display settings.
 */
const DAMAGE_NUMBER_CONFIG = {
  FONT: '16px m5x7',
  FLOAT_DISTANCE: 30,   // How far up the number floats
  FONT_SIZE: 16,
};

/**
 * Gold number display settings.
 */
const GOLD_NUMBER_CONFIG = {
  FONT: '14px m5x7',
  FLOAT_DISTANCE: 25,
  COLOR: '#FFD700',      // Gold color
  FONT_SIZE: 14,
};

/**
 * Sprite configuration.
 */
const SPRITES = {
  TOWER: {
    BLUE: '/assets/sprites/Buildings/Tower_Blue.png',
    RED: '/assets/sprites/Buildings/Tower_Red.png',
    WIDTH: 128,
    HEIGHT: 256,
    SCALE: 0.8,
  },
  NEXUS: {
    BLUE: '/assets/sprites/Buildings/Barracks_Blue.png',
    RED: '/assets/sprites/Buildings/Barracks_Red.png',
    WIDTH: 192,
    HEIGHT: 256,
    SCALE: 1.0,
  },
  WARRIOR: {
    IDLE_BLUE: '/assets/sprites/units/Warrior_Blue/Warrior_Idle.png',
    IDLE_RED: '/assets/sprites/units/Warrior_Red/Warrior_Idle.png',
    RUN_BLUE: '/assets/sprites/units/Warrior_Blue/Warrior_Run.png',
    RUN_RED: '/assets/sprites/units/Warrior_Red/Warrior_Run.png',
    ATTACK_BLUE: '/assets/sprites/units/Warrior_Blue/Warrior_Attack1.png',
    ATTACK_RED: '/assets/sprites/units/Warrior_Red/Warrior_Attack1.png',
    FRAME_WIDTH: 192,
    FRAME_HEIGHT: 192,
    IDLE_FRAMES: 8,
    RUN_FRAMES: 6,
    ATTACK_FRAMES: 4,
    SCALE: 0.35,
  },
  ARCHER: {
    IDLE_BLUE: '/assets/sprites/units/Archer_Blue/Archer_Idle.png',
    IDLE_RED: '/assets/sprites/units/Archer_Red/Archer_Idle.png',
    RUN_BLUE: '/assets/sprites/units/Archer_Blue/Archer_Run.png',
    RUN_RED: '/assets/sprites/units/Archer_Red/Archer_Run.png',
    ATTACK_BLUE: '/assets/sprites/units/Archer_Blue/Archer_Shoot.png',
    ATTACK_RED: '/assets/sprites/units/Archer_Red/Archer_Shoot.png',
    FRAME_WIDTH: 192,
    FRAME_HEIGHT: 192,
    IDLE_FRAMES: 6,
    RUN_FRAMES: 4,
    ATTACK_FRAMES: 8,
    SCALE: 0.35,
  },
  SPIDER: {
    IDLE: '/assets/sprites/Spider/Spider_Idle.png',
    RUN: '/assets/sprites/Spider/Spider_Run.png',
    ATTACK: '/assets/sprites/Spider/Spider_Attack.png',
    FRAME_WIDTH: 192,
    FRAME_HEIGHT: 192,
    IDLE_FRAMES: 8,
    RUN_FRAMES: 5,
    ATTACK_FRAMES: 8,
    SCALE: 0.4,
  },
  BEAR: {
    IDLE: '/assets/sprites/Bear/Bear_Idle.png',
    RUN: '/assets/sprites/Bear/Bear_Run.png',
    ATTACK: '/assets/sprites/Bear/Bear_Attack.png',
    FRAME_WIDTH: 256,
    FRAME_HEIGHT: 256,
    IDLE_FRAMES: 8,
    RUN_FRAMES: 5,
    ATTACK_FRAMES: 9,
    SCALE: 0.4,
  },
  ARROW: {
    BLUE: '/assets/sprites/units/Archer_Blue/Arrow.png',
    RED: '/assets/sprites/units/Archer_Red/Arrow.png',
    SCALE: 0.3,
  },
};

/**
 * Image cache for loaded sprites.
 */
const imageCache: Map<string, HTMLImageElement> = new Map();
let imagesLoaded = false;

/**
 * Load all sprite images.
 */
function loadImages(): void {
  if (imagesLoaded) return;

  const imagesToLoad = [
    // Buildings
    SPRITES.TOWER.BLUE,
    SPRITES.TOWER.RED,
    SPRITES.NEXUS.BLUE,
    SPRITES.NEXUS.RED,
    // Warriors
    SPRITES.WARRIOR.IDLE_BLUE,
    SPRITES.WARRIOR.IDLE_RED,
    SPRITES.WARRIOR.RUN_BLUE,
    SPRITES.WARRIOR.RUN_RED,
    SPRITES.WARRIOR.ATTACK_BLUE,
    SPRITES.WARRIOR.ATTACK_RED,
    // Archers
    SPRITES.ARCHER.IDLE_BLUE,
    SPRITES.ARCHER.IDLE_RED,
    SPRITES.ARCHER.RUN_BLUE,
    SPRITES.ARCHER.RUN_RED,
    SPRITES.ARCHER.ATTACK_BLUE,
    SPRITES.ARCHER.ATTACK_RED,
    // Creatures
    SPRITES.SPIDER.IDLE,
    SPRITES.SPIDER.RUN,
    SPRITES.SPIDER.ATTACK,
    SPRITES.BEAR.IDLE,
    SPRITES.BEAR.RUN,
    SPRITES.BEAR.ATTACK,
    // Projectiles
    SPRITES.ARROW.BLUE,
    SPRITES.ARROW.RED,
  ];

  for (const src of imagesToLoad) {
    const img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }

  imagesLoaded = true;
}

/**
 * Track entity state for animations and direction.
 */
interface EntityRenderState {
  lastX: number;
  lastY: number;
  facingRight: boolean;  // true = facing right, false = facing left
  attackAnimTime: number; // Time into attack animation
  isAttacking: boolean;
}

/**
 * EntityRenderer renders all entities from server state.
 */
export class EntityRenderer implements GameObject {
  readonly id = 'entity-renderer';
  shouldInitialize = false;
  shouldDispose = false;
  position = new Vector(0, 0);

  private stateManager: OnlineStateManager;
  private localSide: number;
  private frameCount = 0;
  private animationTime = 0;

  // Client-side animation timing (independent of server tick rate)
  private lastRenderTime = 0;

  // Track entity state for animations
  private entityStates: Map<string, EntityRenderState> = new Map();

  // For selected champion indicator animation
  private selectionAnimTime = 0;

  constructor(stateManager: OnlineStateManager, localSide: number) {
    this.stateManager = stateManager;
    this.localSide = localSide;
    loadImages();
  }

  /**
   * Get or create render state for an entity.
   */
  private getEntityState(entityId: string, x: number, y: number, side: number): EntityRenderState {
    let state = this.entityStates.get(entityId);
    if (!state) {
      // Default facing direction based on team side
      // Blue (0) faces right, Red (1) faces left
      state = {
        lastX: x,
        lastY: y,
        facingRight: side === 0,
        attackAnimTime: 0,
        isAttacking: false,
      };
      this.entityStates.set(entityId, state);
    }
    return state;
  }

  /**
   * Update entity render state based on movement and actions.
   * @param serverIsAttacking - Server-provided attack state (only true during attack animation)
   */
  private updateEntityState(
    state: EntityRenderState,
    x: number,
    y: number,
    targetEntityId: string | undefined,
    targetX: number | undefined,
    targetY: number | undefined,
    dt: number,
    serverIsAttacking?: boolean
  ): void {
    // Determine facing direction from movement or target
    const dx = x - state.lastX;

    // If moving horizontally, update facing direction based on movement
    if (Math.abs(dx) > 0.5) {
      state.facingRight = dx > 0;
    } else if (targetX !== undefined && targetY !== undefined) {
      // If has a target position (either move target or resolved attack target position),
      // face toward that position
      const targetDx = targetX - x;
      if (Math.abs(targetDx) > 5) {
        state.facingRight = targetDx > 0;
      }
    }

    // Track attacking state - only use server's isAttacking flag
    // The server sets isAttacking=true only during the brief attack animation (0.4s)
    // Don't fall back to targetEntityId - that just means "has a target", not "currently attacking"
    const wasAttacking = state.isAttacking;
    state.isAttacking = serverIsAttacking === true;

    // Reset or continue attack animation
    if (state.isAttacking) {
      if (!wasAttacking) {
        // Just started attacking - reset animation
        state.attackAnimTime = 0;
      } else {
        // Continue attack animation
        state.attackAnimTime += dt;
      }
    } else {
      state.attackAnimTime = 0;
    }

    // Update last position
    state.lastX = x;
    state.lastY = y;
  }

  /**
   * Render method returns a RenderElement that draws all entities.
   */
  render(): RenderElement {
    const element = new RenderElement((ctx: GameContext) => {
      const { canvasRenderingContext } = ctx;

      // Use client-side timing for smooth animations (independent of server tick rate)
      const currentTime = performance.now();
      const clientDt = this.lastRenderTime === 0
        ? 1/60
        : Math.min((currentTime - this.lastRenderTime) / 1000, 0.1);
      this.lastRenderTime = currentTime;

      this.frameCount++;
      this.animationTime += clientDt;
      this.selectionAnimTime += clientDt;

      if (!this.stateManager.hasState()) {
        if (this.frameCount % 60 === 0) {
          console.log('[EntityRenderer] Waiting for state...');
        }
        this.renderWaitingMessage(canvasRenderingContext);
        return;
      }

      // Get all entities and sort by Y position for proper depth
      const entities = this.stateManager.getEntities();
      const localEntityId = this.stateManager.getLocalEntityId();

      // DEBUG: Log entity types being rendered
      if (this.frameCount % 120 === 1) {
        const typeCounts: Record<number, number> = {};
        for (const e of entities) {
          typeCounts[e.snapshot.entityType] = (typeCounts[e.snapshot.entityType] || 0) + 1;
        }
        const towers = entities.filter(e => e.snapshot.entityType === EntityType.TOWER);
        const nexuses = entities.filter(e => e.snapshot.entityType === EntityType.NEXUS);
        console.log(`[EntityRenderer] Entities: ${entities.length} total, types: ${JSON.stringify(typeCounts)}`);
        if (towers.length > 0) {
          console.log(`[EntityRenderer] Towers: ${towers.map(t => `${t.snapshot.entityId}@(${t.position.x.toFixed(0)},${t.position.y.toFixed(0)})`).join(', ')}`);
        }
        if (nexuses.length > 0) {
          console.log(`[EntityRenderer] Nexuses: ${nexuses.map(n => `${n.snapshot.entityId}@(${n.position.x.toFixed(0)},${n.position.y.toFixed(0)})`).join(', ')}`);
        }
      }

      // Sort entities by Y position (lower Y = rendered first = behind)
      // Also sort by entity type to ensure structures render before units
      const sortedEntities = [...entities].sort((a, b) => {
        // Nexus renders first (behind everything)
        if (a.snapshot.entityType === EntityType.NEXUS && b.snapshot.entityType !== EntityType.NEXUS) return -1;
        if (b.snapshot.entityType === EntityType.NEXUS && a.snapshot.entityType !== EntityType.NEXUS) return 1;
        // Then towers
        if (a.snapshot.entityType === EntityType.TOWER && b.snapshot.entityType !== EntityType.TOWER) return -1;
        if (b.snapshot.entityType === EntityType.TOWER && a.snapshot.entityType !== EntityType.TOWER) return 1;
        // Then by Y position
        return a.position.y - b.position.y;
      });

      for (const entity of sortedEntities) {
        // Skip dead entities
        const snapshot = entity.snapshot as any;
        if (snapshot.isDead || snapshot.isDestroyed) {
          continue;
        }

        const isLocalPlayer = entity.snapshot.entityId === localEntityId;
        // Calculate interpolated position for smooth rendering
        const interpolatedPos = this.getInterpolatedPosition(entity);
        // Update entity render state for animation tracking
        const side = snapshot.side ?? 0;
        const state = this.getEntityState(entity.snapshot.entityId, interpolatedPos.x, interpolatedPos.y, side);

        // Resolve target entity position for facing direction
        let resolvedTargetX = snapshot.targetX;
        let resolvedTargetY = snapshot.targetY;
        if (snapshot.targetEntityId && resolvedTargetX === undefined) {
          // Has attack target but no move target - look up target position for facing
          const targetEntity = this.stateManager.getEntity(snapshot.targetEntityId);
          if (targetEntity) {
            resolvedTargetX = targetEntity.position.x;
            resolvedTargetY = targetEntity.position.y;
          }
        }

        // Get attack state from event-based animation system
        // Fall back to snapshot's isAttacking for reconnections (when events might be missed)
        const isAttacking = this.stateManager.isEntityAttacking(snapshot.entityId)
          || (snapshot as any).isAttacking === true;

        this.updateEntityState(
          state,
          interpolatedPos.x,
          interpolatedPos.y,
          snapshot.targetEntityId,
          resolvedTargetX,
          resolvedTargetY,
          clientDt,
          isAttacking
        );
        this.renderEntity(canvasRenderingContext, entity, isLocalPlayer, state);
      }

      // Render ability visual effects
      this.renderAbilityEffects(canvasRenderingContext);

      // Render floating damage numbers on top of all entities
      this.renderDamageNumbers(canvasRenderingContext);

      // Render floating gold numbers
      this.renderGoldNumbers(canvasRenderingContext);
    }, true);

    element.positionType = 'normal';
    return element;
  }

  /**
   * Calculate interpolated position for smooth rendering.
   * Lerps between previousPosition and position based on time since last update.
   * Server runs at 125 Hz (8ms per tick), but network updates may batch.
   */
  private getInterpolatedPosition(entity: InterpolatedEntity): Vector {
    const timeSinceUpdate = Date.now() - entity.lastUpdateTime;
    // Server sends at 125 Hz (8ms), but account for network jitter with slight buffer
    const interpolationDelay = 16; // ms - roughly 2 server ticks / 1 client frame
    const t = Math.min(1, timeSinceUpdate / interpolationDelay);

    return Vector.lerp(entity.previousPosition, entity.position, t);
  }

  /**
   * Render a single entity.
   */
  private renderEntity(ctx: CanvasRenderingContext2D, entity: InterpolatedEntity, isLocalPlayer: boolean, state: EntityRenderState): void {
    const { snapshot } = entity;
    // Use interpolated position for smooth rendering
    const pos = this.getInterpolatedPosition(entity);

    // Get team color
    const side = (snapshot as any).side;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Draw entity based on type
    switch (snapshot.entityType) {
      case EntityType.CHAMPION:
        this.renderChampion(ctx, snapshot, side, isLocalPlayer, state);
        break;
      case EntityType.MINION:
        this.renderMinion(ctx, snapshot, side, state);
        break;
      case EntityType.TOWER:
        this.renderTower(ctx, snapshot, side);
        break;
      case EntityType.NEXUS:
        this.renderNexus(ctx, snapshot, side);
        break;
      case EntityType.PROJECTILE:
        this.renderProjectile(ctx, snapshot);
        break;
      case EntityType.JUNGLE_CAMP:
        this.renderJungleCamp(ctx, snapshot, state);
        break;
      case EntityType.WARD:
        this.renderWard(ctx, snapshot, side);
        break;
      default:
        this.renderGeneric(ctx, 30, side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED);
    }

    ctx.restore();
  }

  /**
   * Render a champion.
   */
  private renderChampion(
    ctx: CanvasRenderingContext2D,
    snapshot: any,
    side: number,
    isLocalPlayer: boolean,
    state: EntityRenderState
  ): void {
    const size = 40;
    const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;

    // Draw selection ring for local player (rotating dashed circle)
    if (isLocalPlayer) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      // Animated rotating dash offset
      const dashOffset = this.selectionAnimTime * 50;
      ctx.setLineDash([10, 5]);
      ctx.lineDashOffset = -dashOffset;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Draw body (circle with gradient for now - can add champion sprites later)
    const gradient = ctx.createRadialGradient(0, -size * 0.2, 0, 0, 0, size * 0.5);
    gradient.addColorStop(0, this.lightenColor(color, 30));
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = isLocalPlayer ? '#ffffff' : '#333333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw health bar with shields
    const healthBarY = -size * 0.7;
    if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
      // Determine health bar color based on relationship to local player
      // Green for self, blue for ally, red for enemy
      let healthBarColor: string;
      if (isLocalPlayer) {
        healthBarColor = HEALTH_BAR_COLORS.SELF;  // Green
      } else if (side === this.localSide) {
        healthBarColor = HEALTH_BAR_COLORS.ALLY;  // Blue
      } else {
        healthBarColor = HEALTH_BAR_COLORS.ENEMY; // Red
      }

      // Extract shields from snapshot (if available)
      const shields = snapshot.shields as Array<{ amount: number; shieldType: string }> | undefined;
      this.renderHealthBar(ctx, snapshot.health, snapshot.maxHealth, size, healthBarY, healthBarColor, shields);
    }

    // Draw mark indicators above health bar (debuffs on enemies, buffs on self)
    const isEnemy = side !== this.localSide;
    const activeEffects = snapshot.activeEffects as Array<{
      definitionId: string;
      timeRemaining: number;
      totalDuration?: number;
      stacks: number;
    }> | undefined;
    this.renderMarkIndicators(ctx, activeEffects, size, healthBarY, isLocalPlayer, isEnemy);

    // Draw mana bar for local player
    if (isLocalPlayer && snapshot.resource !== undefined && snapshot.maxResource !== undefined) {
      this.renderResourceBar(ctx, snapshot.resource, snapshot.maxResource, size, -size * 0.5);
    }

    // Draw level indicator
    if (snapshot.level !== undefined) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(snapshot.level.toString(), 0, 5);
    }

    // Draw champion name below
    if (snapshot.championId) {
      // DEBUG: Log received championId
      if (this.frameCount % 60 === 0) {
        console.log(`[EntityRenderer] Champion snapshot: championId="${snapshot.championId}", entityId="${snapshot.entityId}"`);
      }

      // Look up champion definition to get the display name
      const championDef = getChampionDefinition(snapshot.championId);
      const displayName = championDef?.name || snapshot.championId;

      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 2;
      ctx.fillText(displayName, 0, size * 0.8);
      ctx.shadowBlur = 0;
    }
  }

  /**
   * Render a minion using sprites with proper animations and direction.
   */
  private renderMinion(ctx: CanvasRenderingContext2D, snapshot: any, side: number, state: EntityRenderState): void {
    const minionType = snapshot.minionType || 'melee';
    const isWarrior = minionType === 'melee';
    const spriteConfig = isWarrior ? SPRITES.WARRIOR : SPRITES.ARCHER;

    // Determine animation state: attacking, moving, or idle
    const isAttacking = state.isAttacking;
    const isMoving = snapshot.targetX !== undefined && snapshot.targetY !== undefined && !isAttacking;

    // Select the correct sprite based on state and side
    let spriteSrc: string;
    let frameCount: number;
    let animSpeed: number;

    if (isAttacking) {
      // Attack animation
      spriteSrc = side === 0
        ? (isWarrior ? SPRITES.WARRIOR.ATTACK_BLUE : SPRITES.ARCHER.ATTACK_BLUE)
        : (isWarrior ? SPRITES.WARRIOR.ATTACK_RED : SPRITES.ARCHER.ATTACK_RED);
      frameCount = isWarrior ? SPRITES.WARRIOR.ATTACK_FRAMES : SPRITES.ARCHER.ATTACK_FRAMES;
      animSpeed = 12; // Fast attack animation
    } else if (isMoving) {
      // Run animation
      spriteSrc = side === 0
        ? (isWarrior ? SPRITES.WARRIOR.RUN_BLUE : SPRITES.ARCHER.RUN_BLUE)
        : (isWarrior ? SPRITES.WARRIOR.RUN_RED : SPRITES.ARCHER.RUN_RED);
      frameCount = isWarrior ? SPRITES.WARRIOR.RUN_FRAMES : SPRITES.ARCHER.RUN_FRAMES;
      animSpeed = 10; // Smooth run animation
    } else {
      // Idle animation
      spriteSrc = side === 0
        ? (isWarrior ? SPRITES.WARRIOR.IDLE_BLUE : SPRITES.ARCHER.IDLE_BLUE)
        : (isWarrior ? SPRITES.WARRIOR.IDLE_RED : SPRITES.ARCHER.IDLE_RED);
      frameCount = isWarrior ? SPRITES.WARRIOR.IDLE_FRAMES : SPRITES.ARCHER.IDLE_FRAMES;
      animSpeed = 8; // Relaxed idle animation
    }

    const image = imageCache.get(spriteSrc);

    if (image && image.complete && image.naturalWidth > 0) {
      // Calculate animation frame
      const animTime = isAttacking ? state.attackAnimTime : this.animationTime;
      const frameIndex = Math.floor(animTime * animSpeed) % frameCount;
      const srcX = frameIndex * spriteConfig.FRAME_WIDTH;

      const scaledWidth = spriteConfig.FRAME_WIDTH * spriteConfig.SCALE;
      const scaledHeight = spriteConfig.FRAME_HEIGHT * spriteConfig.SCALE;

      // Apply horizontal flip if facing left
      ctx.save();
      if (!state.facingRight) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(
        image,
        srcX, 0, spriteConfig.FRAME_WIDTH, spriteConfig.FRAME_HEIGHT,
        -scaledWidth / 2, -scaledHeight / 2,
        scaledWidth, scaledHeight
      );

      ctx.restore();
    } else {
      // Fallback: draw colored circle
      const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw health bar - blue for ally minions, red for enemy minions
    if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
      const healthBarColor = side === this.localSide
        ? HEALTH_BAR_COLORS.ALLY   // Blue for allied minions
        : HEALTH_BAR_COLORS.ENEMY; // Red for enemy minions
      this.renderHealthBar(ctx, snapshot.health, snapshot.maxHealth, 30, -25, healthBarColor);
    }
  }

  /**
   * Render a tower using sprite images.
   */
  private renderTower(ctx: CanvasRenderingContext2D, snapshot: any, side: number): void {
    // DEBUG: Log tower positions
    if (this.frameCount % 120 === 1) {
      console.log(`[EntityRenderer] Tower: id=${snapshot.entityId}, side=${side}, x=${snapshot.x}, y=${snapshot.y}, lane=${snapshot.lane}`);
    }

    const spriteSrc = side === 0 ? SPRITES.TOWER.BLUE : SPRITES.TOWER.RED;
    const image = imageCache.get(spriteSrc);

    if (image && image.complete && image.naturalWidth > 0) {
      const scaledWidth = SPRITES.TOWER.WIDTH * SPRITES.TOWER.SCALE;
      const scaledHeight = SPRITES.TOWER.HEIGHT * SPRITES.TOWER.SCALE;

      ctx.drawImage(
        image,
        -scaledWidth / 2,
        -scaledHeight + 30, // Offset so base is near position
        scaledWidth,
        scaledHeight
      );
    } else {
      // Fallback: draw colored rectangle
      const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;
      ctx.fillStyle = color;
      ctx.fillRect(-25, -60, 50, 80);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(-25, -60, 50, 80);
    }

    // Draw health bar - blue for ally towers, red for enemy towers
    if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
      const barY = -SPRITES.TOWER.HEIGHT * SPRITES.TOWER.SCALE + 10;
      const healthBarColor = side === this.localSide
        ? HEALTH_BAR_COLORS.ALLY   // Blue for allied towers
        : HEALTH_BAR_COLORS.ENEMY; // Red for enemy towers
      this.renderHealthBar(ctx, snapshot.health, snapshot.maxHealth, 60, barY, healthBarColor);
    }
  }

  /**
   * Render a nexus using sprite images.
   */
  private renderNexus(ctx: CanvasRenderingContext2D, snapshot: any, side: number): void {
    const spriteSrc = side === 0 ? SPRITES.NEXUS.BLUE : SPRITES.NEXUS.RED;
    const image = imageCache.get(spriteSrc);

    if (image && image.complete && image.naturalWidth > 0) {
      const scaledWidth = SPRITES.NEXUS.WIDTH * SPRITES.NEXUS.SCALE;
      const scaledHeight = SPRITES.NEXUS.HEIGHT * SPRITES.NEXUS.SCALE;

      ctx.drawImage(
        image,
        -scaledWidth / 2,
        -scaledHeight + 20, // Offset so base is near position
        scaledWidth,
        scaledHeight
      );
    } else {
      // Fallback: draw colored rectangle
      const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;
      ctx.fillStyle = color;
      ctx.fillRect(-50, -80, 100, 100);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(-50, -80, 100, 100);
    }

    // Draw health bar - blue for ally nexus, red for enemy nexus
    if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
      const radius = 75;
      const barY = -radius - 30;
      const healthBarColor = side === this.localSide
        ? HEALTH_BAR_COLORS.ALLY   // Blue for allied nexus
        : HEALTH_BAR_COLORS.ENEMY; // Red for enemy nexus
      this.renderHealthBar(ctx, snapshot.health, snapshot.maxHealth, radius * 2, barY, healthBarColor);

      // Health text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${Math.ceil(snapshot.health)} / ${snapshot.maxHealth}`,
        0,
        barY + 6
      );
    }
  }

  /**
   * Render a projectile.
   */
  private renderProjectile(ctx: CanvasRenderingContext2D, snapshot: any): void {
    const side = snapshot.side;
    const projectileType = snapshot.abilityId || 'default';
    const teamColor = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;

    // Get direction for rotation
    const dirX = snapshot.directionX || 1;
    const dirY = snapshot.directionY || 0;
    const angle = Math.atan2(dirY, dirX);

    // Render based on projectile type
    if (projectileType === 'minion_caster' || projectileType === 'tower') {
      // Use arrow sprite for caster minions and towers
      const arrowSrc = side === 0 ? SPRITES.ARROW.BLUE : SPRITES.ARROW.RED;
      const arrowImg = imageCache.get(arrowSrc);

      if (arrowImg && arrowImg.complete && arrowImg.naturalWidth > 0) {
        ctx.save();
        ctx.rotate(angle);

        // Scale: tower arrows are larger
        const scale = projectileType === 'tower'
          ? SPRITES.ARROW.SCALE * 1.5
          : SPRITES.ARROW.SCALE;

        const width = arrowImg.naturalWidth * scale;
        const height = arrowImg.naturalHeight * scale;

        // Draw centered on the projectile position
        ctx.drawImage(arrowImg, -width / 2, -height / 2, width, height);

        // Tower projectiles get a glow effect
        if (projectileType === 'tower') {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = teamColor;
          ctx.beginPath();
          ctx.ellipse(0, 0, width / 2 + 8, height / 2 + 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      } else {
        // Fallback: draw simple arrow shape if image not loaded
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-4, -3);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else {
      // Default projectile - energy ball
      ctx.fillStyle = teamColor;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Glow effect
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Render a jungle camp creature.
   */
  private renderJungleCamp(ctx: CanvasRenderingContext2D, snapshot: any, state: EntityRenderState): void {
    const creatureType = (snapshot as any).creatureType || 'gromp';

    // Use spider sprite for small creatures, bear for larger ones
    const isSpider = creatureType === 'spider';
    const spriteConfig = isSpider ? SPRITES.SPIDER : SPRITES.BEAR;

    // Determine animation state
    const isAttacking = state.isAttacking;
    const isMoving = snapshot.targetX !== undefined && snapshot.targetY !== undefined && !isAttacking;

    let spriteSrc: string;
    let frameCount: number;

    if (isAttacking) {
      spriteSrc = isSpider ? SPRITES.SPIDER.ATTACK : SPRITES.BEAR.ATTACK;
      frameCount = spriteConfig.ATTACK_FRAMES;
    } else if (isMoving) {
      spriteSrc = isSpider ? SPRITES.SPIDER.RUN : SPRITES.BEAR.RUN;
      frameCount = spriteConfig.RUN_FRAMES;
    } else {
      spriteSrc = isSpider ? SPRITES.SPIDER.IDLE : SPRITES.BEAR.IDLE;
      frameCount = spriteConfig.IDLE_FRAMES;
    }

    const image = imageCache.get(spriteSrc);

    if (image && image.complete && image.naturalWidth > 0) {
      const animTime = isAttacking ? state.attackAnimTime : this.animationTime;
      // Use appropriate animation speed: faster for attack, moderate for movement/idle
      const animSpeed = isAttacking ? 12 : (isMoving ? 10 : 8);
      const frameIndex = Math.floor(animTime * animSpeed) % frameCount;
      const srcX = frameIndex * spriteConfig.FRAME_WIDTH;

      const scaledWidth = spriteConfig.FRAME_WIDTH * spriteConfig.SCALE;
      const scaledHeight = spriteConfig.FRAME_HEIGHT * spriteConfig.SCALE;

      // Apply horizontal flip if facing left
      ctx.save();
      if (!state.facingRight) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(
        image,
        srcX, 0, spriteConfig.FRAME_WIDTH, spriteConfig.FRAME_HEIGHT,
        -scaledWidth / 2, -scaledHeight / 2,
        scaledWidth, scaledHeight
      );

      ctx.restore();
    } else {
      // Fallback: gray circle
      ctx.fillStyle = TEAM_COLORS.NEUTRAL;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw health bar
    if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
      this.renderHealthBar(ctx, snapshot.health, snapshot.maxHealth, 40, -30, HEALTH_BAR_COLORS.NEUTRAL);
    }
  }

  /**
   * Render a ward.
   */
  private renderWard(ctx: CanvasRenderingContext2D, snapshot: any, side: number): void {
    const wardType = snapshot.wardType || 'stealth';
    const isOwn = side === this.localSide;
    const isStealthed = snapshot.isStealthed && !isOwn;

    // Ward colors by type
    const wardColors: Record<string, string> = {
      stealth: '#44FF44',   // Green
      control: '#FF44FF',   // Pink/Magenta
      farsight: '#4444FF',  // Blue
    };

    const baseColor = wardColors[wardType] || '#44FF44';
    const size = 12;

    // Make enemy stealth wards semi-transparent (should be invisible but shown for debugging)
    // In production, enemy stealth wards shouldn't be rendered at all unless revealed
    const alpha = isStealthed ? 0.3 : 1.0;
    ctx.globalAlpha = alpha;

    // Draw ward body (diamond shape)
    ctx.save();
    ctx.rotate(Math.PI / 4); // 45-degree rotation for diamond

    // Outer glow effect
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(0.5, this.lightenColor(baseColor, -30));
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(-size * 1.5, -size * 1.5, size * 3, size * 3);

    // Main body (square that looks like diamond after rotation)
    ctx.fillStyle = baseColor;
    ctx.fillRect(-size / 2, -size / 2, size, size);

    // Inner highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(-size / 4, -size / 2, size / 2, size / 4);

    // Border
    ctx.strokeStyle = this.lightenColor(baseColor, -40);
    ctx.lineWidth = 1;
    ctx.strokeRect(-size / 2, -size / 2, size, size);

    ctx.restore();

    // Reset alpha
    ctx.globalAlpha = 1.0;

    // Draw remaining duration indicator (pie chart style)
    if (snapshot.remainingDuration > 0 && isOwn) {
      const maxDuration = wardType === 'stealth' ? 90 : wardType === 'farsight' ? 60 : 0;
      if (maxDuration > 0) {
        const progress = snapshot.remainingDuration / maxDuration;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, size * 0.8, -Math.PI / 2, -Math.PI / 2 + (1 - progress) * Math.PI * 2, false);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();
      }
    }

    // Draw ward type indicator icon
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (wardType === 'control') {
      // Control ward: eye icon (simplified as "👁" or "C")
      ctx.fillText('C', 0, 0);
    } else if (wardType === 'farsight') {
      // Farsight ward: targeting icon (simplified as "F")
      ctx.fillText('F', 0, 0);
    }
    // Stealth ward has no icon (most common, keep clean)

    // Draw health pips for control wards (visible, destroyable)
    if (!snapshot.isStealthed && snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
      const pipCount = snapshot.maxHealth;
      const pipWidth = 4;
      const pipSpacing = 2;
      const totalWidth = pipCount * pipWidth + (pipCount - 1) * pipSpacing;
      const startX = -totalWidth / 2;

      for (let i = 0; i < pipCount; i++) {
        const isFilled = i < snapshot.health;
        ctx.fillStyle = isFilled ? baseColor : '#333333';
        ctx.fillRect(startX + i * (pipWidth + pipSpacing), size + 4, pipWidth, 3);
      }
    }
  }

  /**
   * Render a generic entity (fallback).
   */
  private renderGeneric(ctx: CanvasRenderingContext2D, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(-size / 2, -size / 2, size, size);
  }

  /**
   * Render a health bar with optional shields.
   * Shields extend beyond the health bar with diagonal stripes.
   *
   * @param healthBarColor - The color for the health fill (green=self, blue=ally, red=enemy)
   */
  private renderHealthBar(
    ctx: CanvasRenderingContext2D,
    health: number,
    maxHealth: number,
    width: number,
    yOffset: number,
    healthBarColor: string,
    shields?: Array<{ amount: number; shieldType: string }>
  ): void {
    const barWidth = width;
    const barHeight = 6;

    // Calculate total shield amount
    const totalShield = shields?.reduce((sum, s) => sum + s.amount, 0) ?? 0;

    // Calculate display percentages
    // When health + shield > maxHealth, scale both down to fit within the bar
    const totalEffectiveHealth = health + totalShield;
    let healthDisplayPercent: number;
    let shieldDisplayPercent: number;

    if (totalEffectiveHealth > maxHealth) {
      // Scale down: both health and shield proportionally fit within bar
      healthDisplayPercent = health / totalEffectiveHealth;
      shieldDisplayPercent = totalShield / totalEffectiveHealth;
    } else {
      // Normal case: use maxHealth as the scale
      healthDisplayPercent = health / maxHealth;
      shieldDisplayPercent = totalShield / maxHealth;
    }

    // Clamp values
    healthDisplayPercent = Math.max(0, Math.min(1, healthDisplayPercent));
    shieldDisplayPercent = Math.max(0, Math.min(1 - healthDisplayPercent, shieldDisplayPercent));

    // Background - always fixed width
    ctx.fillStyle = '#333333';
    ctx.fillRect(-barWidth / 2, yOffset, barWidth, barHeight);

    // Health fill - use provided color
    ctx.fillStyle = healthBarColor;
    ctx.fillRect(-barWidth / 2, yOffset, barWidth * healthDisplayPercent, barHeight);

    // Render shields to the right of health
    if (shields && shields.length > 0 && totalShield > 0 && shieldDisplayPercent > 0) {
      const shieldStartX = -barWidth / 2 + barWidth * healthDisplayPercent;
      let currentShieldX = shieldStartX;

      // Group shields by type for visual consistency
      const shieldsByType = new Map<string, number>();
      for (const shield of shields) {
        const existing = shieldsByType.get(shield.shieldType) ?? 0;
        shieldsByType.set(shield.shieldType, existing + shield.amount);
      }

      // Calculate total shield for proportional rendering
      const totalShieldAmount = Array.from(shieldsByType.values()).reduce((a, b) => a + b, 0);

      // Render each shield type proportionally within the shield display area
      for (const [shieldType, amount] of shieldsByType) {
        // Each shield type gets its proportion of the shield display area
        const shieldProportion = amount / totalShieldAmount;
        const shieldWidth = barWidth * shieldDisplayPercent * shieldProportion;
        if (shieldWidth <= 0) continue;

        // Get style for this shield type
        const style = SHIELD_STYLES[shieldType] || SHIELD_STYLES.normal;

        // Create diagonal stripe pattern
        this.renderShieldSegment(
          ctx,
          currentShieldX,
          yOffset,
          shieldWidth,
          barHeight,
          style.baseColor,
          style.stripeColor,
          style.stripeWidth
        );

        currentShieldX += shieldWidth;
      }

      // Divider line between health and shield
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(shieldStartX, yOffset);
      ctx.lineTo(shieldStartX, yOffset + barHeight);
      ctx.stroke();
    }

    // Border around bar (always fixed width)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(-barWidth / 2, yOffset, barWidth, barHeight);
  }

  /**
   * Render a shield segment with diagonal stripes.
   */
  private renderShieldSegment(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    baseColor: string,
    stripeColor: string,
    stripeWidth: number
  ): void {
    // Save context for clipping
    ctx.save();

    // Create clipping region for this segment
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    // Fill with base color first
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, width, height);

    // Draw diagonal stripes
    ctx.fillStyle = stripeColor;
    const stripeSpacing = stripeWidth * 2;
    const diagonalLength = Math.sqrt(width * width + height * height) * 2;

    // Draw stripes from top-left to bottom-right
    for (let i = -diagonalLength; i < diagonalLength; i += stripeSpacing) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + height, y + height);
      ctx.lineTo(x + i + height + stripeWidth, y + height);
      ctx.lineTo(x + i + stripeWidth, y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Render a resource (mana) bar.
   */
  private renderResourceBar(
    ctx: CanvasRenderingContext2D,
    resource: number,
    maxResource: number,
    width: number,
    yOffset: number
  ): void {
    const barWidth = width;
    const barHeight = 4;
    const resourcePercent = Math.max(0, Math.min(1, resource / maxResource));

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(-barWidth / 2, yOffset, barWidth, barHeight);

    // Resource fill (blue for mana)
    ctx.fillStyle = '#3498db';
    ctx.fillRect(-barWidth / 2, yOffset, barWidth * resourcePercent, barHeight);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(-barWidth / 2, yOffset, barWidth, barHeight);
  }

  /**
   * Render mark indicators above a champion's health bar.
   * Shows active effects like vex_mark, stun, slow, etc. as small icons.
   *
   * @param activeEffects - Array of active effects on the champion
   * @param width - Width of the health bar (for positioning)
   * @param healthBarY - Y offset of the health bar
   * @param isLocalPlayer - Whether this is the local player
   * @param isEnemy - Whether this is an enemy champion
   */
  private renderMarkIndicators(
    ctx: CanvasRenderingContext2D,
    activeEffects: Array<{ definitionId: string; timeRemaining: number; totalDuration?: number; stacks: number }> | undefined,
    width: number,
    healthBarY: number,
    isLocalPlayer: boolean,
    isEnemy: boolean
  ): void {
    if (!activeEffects || activeEffects.length === 0) return;

    // Filter effects to show: debuffs on enemies, buffs on self/allies
    const visibleEffects = activeEffects.filter(effect => {
      const visual = MARK_VISUALS[effect.definitionId] || DEFAULT_MARK_VISUAL;
      if (isEnemy) {
        // On enemies, show debuffs
        return visual.isDebuff;
      } else {
        // On self/allies, show buffs
        return visual.isBuff || isLocalPlayer; // Local player sees all their effects
      }
    });

    if (visibleEffects.length === 0) return;

    const iconSize = 14;
    const iconSpacing = 2;
    const totalWidth = visibleEffects.length * iconSize + (visibleEffects.length - 1) * iconSpacing;
    const startX = -totalWidth / 2;
    const markY = healthBarY - iconSize - 4; // Above health bar

    visibleEffects.forEach((effect, index) => {
      const visual = MARK_VISUALS[effect.definitionId] || DEFAULT_MARK_VISUAL;
      const x = startX + index * (iconSize + iconSpacing);

      // Background
      ctx.fillStyle = visual.bgColor;
      ctx.fillRect(x, markY, iconSize, iconSize);

      // Radial timer overlay (drains clockwise as time expires)
      if (visual.showTimer && effect.timeRemaining > 0 && effect.totalDuration && effect.totalDuration > 0) {
        const progress = effect.timeRemaining / effect.totalDuration;
        const expiredAngle = (1 - progress) * Math.PI * 2;
        const centerX = x + iconSize / 2;
        const centerY = markY + iconSize / 2;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, iconSize / 2, -Math.PI / 2, -Math.PI / 2 + expiredAngle, false);
        ctx.lineTo(centerX, centerY);
        ctx.fill();
        ctx.restore();
      }

      // Border
      ctx.strokeStyle = visual.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, markY, iconSize, iconSize);

      // Icon
      ctx.fillStyle = visual.iconColor;
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(visual.icon, x + iconSize / 2, markY + iconSize / 2);

      // Stack count (small number in corner)
      if (visual.showStacks && effect.stacks > 1) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(effect.stacks.toString(), x + iconSize - 1, markY + iconSize - 2);
      }
    });
  }

  /**
   * Render passive stack indicator below health bar.
   * Shows stacks like Magnus's Arcane Surge (0-4) or Gorath's Immovable (0-10).
   *
   * @param stacks - Current stack count
   * @param maxStacks - Maximum stacks possible
   * @param width - Width of the health bar (for positioning)
   * @param healthBarY - Y offset of the health bar
   * @param color - Color for filled stacks
   */
  private renderStackIndicator(
    ctx: CanvasRenderingContext2D,
    stacks: number,
    maxStacks: number,
    width: number,
    healthBarY: number,
    color: string = '#FFD700'
  ): void {
    if (maxStacks <= 0) return;

    const pipSize = 4;
    const pipSpacing = 2;
    const totalWidth = maxStacks * pipSize + (maxStacks - 1) * pipSpacing;
    const startX = -totalWidth / 2;
    const pipY = healthBarY + 8; // Below health bar

    for (let i = 0; i < maxStacks; i++) {
      const isFilled = i < stacks;
      ctx.fillStyle = isFilled ? color : '#333333';
      ctx.fillRect(startX + i * (pipSize + pipSpacing), pipY, pipSize, pipSize);

      // Border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(startX + i * (pipSize + pipSpacing), pipY, pipSize, pipSize);
    }
  }

  /**
   * Render waiting message when no state received yet.
   */
  private renderWaitingMessage(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText('Waiting for game state...', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * Lighten a color by a percentage.
   */
  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
  }

  /**
   * Get team ID for fog of war filtering.
   */
  getTeamId(): number {
    return this.localSide === 0 ? 0 : 1;
  }

  /**
   * Render ability visual effects (cone sweeps, circles, etc.)
   */
  private renderAbilityEffects(ctx: CanvasRenderingContext2D): void {
    const effects = this.stateManager.getAbilityEffects();

    if (effects.length > 0) {
      console.log('[EntityRenderer] Rendering', effects.length, 'ability effects');
    }

    for (const effect of effects) {
      const progress = this.stateManager.getAbilityEffectProgress(effect);

      // Fade out effect as it progresses
      const alpha = 1 - progress * 0.7; // Keep some visibility until end

      ctx.save();
      ctx.globalAlpha = alpha;

      // Calculate direction from origin to target
      const dx = effect.targetX - effect.originX;
      const dy = effect.targetY - effect.originY;
      const angle = Math.atan2(dy, dx);

      switch (effect.shape) {
        case 'cone':
          this.renderConeEffect(ctx, effect, angle, progress);
          break;
        case 'circle':
          this.renderCircleEffect(ctx, effect, progress);
          break;
        case 'line':
          this.renderLineEffect(ctx, effect, angle, progress);
          break;
        case 'point':
          this.renderPointEffect(ctx, effect, progress);
          break;
      }

      ctx.restore();
    }
  }

  /**
   * Render a cone-shaped ability effect.
   */
  private renderConeEffect(
    ctx: CanvasRenderingContext2D,
    effect: AbilityEffect,
    angle: number,
    progress: number
  ): void {
    const halfAngle = (effect.coneAngle || Math.PI / 2) / 2;

    // Animate the cone expanding outward
    const currentRange = effect.range * Math.min(1, progress * 2 + 0.3);

    // Draw filled cone
    ctx.fillStyle = effect.color;
    ctx.beginPath();
    ctx.moveTo(effect.originX, effect.originY);
    ctx.arc(effect.originX, effect.originY, currentRange, angle - halfAngle, angle + halfAngle);
    ctx.closePath();
    ctx.fill();

    // Draw edge highlight
    ctx.strokeStyle = effect.color.replace(/[\d.]+\)$/, '0.9)');
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Render a circle-shaped ability effect (AoE).
   */
  private renderCircleEffect(
    ctx: CanvasRenderingContext2D,
    effect: AbilityEffect,
    progress: number
  ): void {
    const radius = effect.aoeRadius || effect.range;

    // Animate expanding ring
    const innerRadius = radius * progress * 0.8;
    const outerRadius = radius * Math.min(1, progress * 1.2);

    // Draw outer circle
    ctx.fillStyle = effect.color;
    ctx.beginPath();
    ctx.arc(effect.targetX, effect.targetY, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw inner highlight ring
    ctx.strokeStyle = effect.color.replace(/[\d.]+\)$/, '0.8)');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(effect.targetX, effect.targetY, innerRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * Render a line-shaped ability effect (skillshot).
   */
  private renderLineEffect(
    ctx: CanvasRenderingContext2D,
    effect: AbilityEffect,
    angle: number,
    progress: number
  ): void {
    const width = effect.width || 60;
    const halfWidth = width / 2;

    // Animate the line extending
    const currentRange = effect.range * Math.min(1, progress * 2 + 0.3);

    // Calculate perpendicular direction for width
    const perpX = -Math.sin(angle) * halfWidth;
    const perpY = Math.cos(angle) * halfWidth;

    // Calculate end point
    const endX = effect.originX + Math.cos(angle) * currentRange;
    const endY = effect.originY + Math.sin(angle) * currentRange;

    // Draw filled rectangle
    ctx.fillStyle = effect.color;
    ctx.beginPath();
    ctx.moveTo(effect.originX + perpX, effect.originY + perpY);
    ctx.lineTo(endX + perpX, endY + perpY);
    ctx.lineTo(endX - perpX, endY - perpY);
    ctx.lineTo(effect.originX - perpX, effect.originY - perpY);
    ctx.closePath();
    ctx.fill();

    // Draw edge highlight
    ctx.strokeStyle = effect.color.replace(/[\d.]+\)$/, '0.8)');
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Render a point-based ability effect (impact).
   */
  private renderPointEffect(
    ctx: CanvasRenderingContext2D,
    effect: AbilityEffect,
    progress: number
  ): void {
    // Expanding ring effect
    const maxRadius = 50;
    const currentRadius = maxRadius * progress;

    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 4 * (1 - progress);
    ctx.beginPath();
    ctx.arc(effect.targetX, effect.targetY, currentRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * Render floating damage numbers.
   */
  private renderDamageNumbers(ctx: CanvasRenderingContext2D): void {
    const damageNumbers = this.stateManager.getDamageNumbers();

    for (const dn of damageNumbers) {
      const progress = this.stateManager.getDamageNumberProgress(dn);

      // Ease out for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);

      // Calculate position (float upward)
      const yOffset = -DAMAGE_NUMBER_CONFIG.FLOAT_DISTANCE * easeOut;

      // Calculate alpha (fade out in the last 30%)
      const fadeStart = 0.7;
      const alpha = progress < fadeStart
        ? 1
        : 1 - ((progress - fadeStart) / (1 - fadeStart));

      ctx.save();
      ctx.translate(dn.x, dn.y + yOffset);

      // Set up font
      ctx.font = DAMAGE_NUMBER_CONFIG.FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = alpha;

      // Render shield absorbed amount first (gray, slightly left and up)
      if (dn.shieldAbsorbed > 0) {
        const shieldText = Math.round(dn.shieldAbsorbed).toString();

        // Draw shadow/outline for readability
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(shieldText, -15, -8);

        // Draw shield absorbed text
        ctx.fillStyle = DAMAGE_COLORS.shield;
        ctx.fillText(shieldText, -15, -8);
      }

      // Render damage amount
      if (dn.amount > 0) {
        const damageText = Math.round(dn.amount).toString();
        const xOffset = dn.shieldAbsorbed > 0 ? 15 : 0;

        // Draw shadow/outline for readability
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(damageText, xOffset, 0);

        // Draw damage text with appropriate color
        ctx.fillStyle = DAMAGE_COLORS[dn.damageType] || DAMAGE_COLORS.physical;
        ctx.fillText(damageText, xOffset, 0);
      }

      ctx.restore();
    }
  }

  /**
   * Render floating gold numbers.
   */
  private renderGoldNumbers(ctx: CanvasRenderingContext2D): void {
    const goldNumbers = this.stateManager.getGoldNumbers();

    for (const gn of goldNumbers) {
      const progress = this.stateManager.getGoldNumberProgress(gn);

      // Ease out for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);

      // Calculate position (float upward, offset to the right to not overlap damage)
      const yOffset = -GOLD_NUMBER_CONFIG.FLOAT_DISTANCE * easeOut;
      const xOffset = 25; // Offset to the right of the entity

      // Calculate alpha (fade out in the last 30%)
      const fadeStart = 0.7;
      const alpha = progress < fadeStart
        ? 1
        : 1 - ((progress - fadeStart) / (1 - fadeStart));

      ctx.save();
      ctx.translate(gn.x + xOffset, gn.y + yOffset);

      // Set up font
      ctx.font = GOLD_NUMBER_CONFIG.FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = alpha;

      // Format gold text with + prefix
      const goldText = `+${gn.amount}`;

      // Draw shadow/outline for readability
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeText(goldText, 0, 0);

      // Draw gold text
      ctx.fillStyle = GOLD_NUMBER_CONFIG.COLOR;
      ctx.fillText(goldText, 0, 0);

      ctx.restore();
    }
  }
}

export default EntityRenderer;
