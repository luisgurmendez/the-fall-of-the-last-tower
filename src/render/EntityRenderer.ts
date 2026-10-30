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

import type { GameObject } from "@/core/GameObject";
import type GameContext from "@/core/gameContext";
import RenderElement from "@/render/renderElement";
import Vector from "@/physics/vector";

import type {
  OnlineStateManager,
  InterpolatedEntity,
} from "@/core/OnlineStateManager";

import {
  EntityType,
  getChampionDefinition,
  isRectangleCollision,
  isCircleCollision,
} from "@siege/shared";
import { VFXManager, getVFXManager } from "@/vfx";
import {
  getOutlinedSprite,
  getOutlinePadding,
  OUTLINE_COLORS,
} from "@/render/OutlinedSpriteCache";
import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import {
  TEAM_COLORS,
  imageCache,
  lightenColor,
  loadImages,
} from "@/render/entities/shared";
import { renderMinion, MINION_IMAGES } from "@/render/entities/minion";
import { renderTower, TOWER_IMAGES } from "@/render/entities/tower";
import { renderNexus, NEXUS_IMAGES } from "@/render/entities/nexus";
import {
  renderJungleCamp,
  JUNGLE_CREATURE_IMAGES,
} from "@/render/entities/jungleCreature";
import {
  renderProjectile,
  PROJECTILE_IMAGES,
} from "@/render/entities/projectile";
import { renderWard } from "@/render/entities/ward";
import { renderZone } from "@/render/entities/zone";
import { LightOrbRenderer } from "@/render/entities/lightOrb";
import { renderGeneric } from "@/render/entities/generic";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
  renderResourceBar,
} from "@/render/overlays/healthBars";
import { renderMarkIndicators } from "@/render/overlays/statusIndicators";
import { renderAbilityEffects } from "@/render/overlays/abilityEffects";
import {
  renderDamageNumbers,
  renderGoldNumbers,
  renderXpNumbers,
} from "@/render/overlays/floatingNumbers";

/**
 * Sprite configuration.
 */
const SPRITES = {
  // Champion sprites
  LUME: {
    IDLE: "/assets/champs/lume/Lume-IDLE.png",
    WALK: "/assets/champs/lume/Lume-Walk-Sheet.png",
    ATTACK: "/assets/champs/lume/Lume-BasicAttack-Sheet.png",
    Q: "/assets/champs/lume/Lume-Q-Sheet.png",
    E: "/assets/champs/lume/Lume-E-Sheet.png",
    R: "/assets/champs/lume/Lume-R-Sheet.png",
    FRAME_WIDTH: 152,
    FRAME_HEIGHT: 152,
    IDLE_FRAMES: 1,
    WALK_FRAMES: 6,
    ATTACK_FRAMES: 10,
    Q_FRAMES: 8,
    E_FRAMES: 11,
    R_FRAMES: 12,
    SCALE: 0.8,
  },
  VEX: {
    IDLE: "/assets/champs/vex/Vex-Idle.png",
    WALK: "/assets/champs/vex/Vex-Walk-Sheet.png",
    ATTACK: "/assets/champs/vex/Vex-BasicAttack-Sheet.png",
    DASH: "/assets/champs/vex/Vex-Dash-Sheet.png",
    SHURIKEN: "/assets/champs/vex/Vex-Shuriken-Sheet.png",
    DISAPPEAR: "/assets/champs/vex/Vex-Disappear-Sheet.png",
    IDLE_FRAMES: 1,
    WALK_FRAMES: 5,
    ATTACK_FRAMES: 7,
    ATTACK_TRIGGER_FRAME: 3, // Frame 4 (0-indexed)
    DASH_FRAMES: 13,
    DASH_HOLD_FRAME: 4, // Frame 5 (0-indexed) - hold during dash
    SHURIKEN_FRAMES: 6,
    SHURIKEN_TRIGGER_FRAME: 3, // Frame 4 (0-indexed)
    DISAPPEAR_FRAMES: 15,
    SCALE: 0.8,
  },
};

/**
 * EntityRenderer renders all entities from server state.
 */
export class EntityRenderer implements GameObject {
  readonly id = "entity-renderer";
  shouldInitialize = false;
  shouldDispose = false;
  position = new Vector(0, 0);

  private stateManager: OnlineStateManager;
  private localSide: number;
  // Shared with the entity renderers; owns the client-side animation clock
  private renderContext: EntityRenderContext;

  // Client-side animation timing (independent of server tick rate)
  private lastRenderTime = 0;

  // Track entity state for animations
  private entityStates: Map<string, EntityRenderState> = new Map();

  // Dash afterimages for sprite-based afterimage effects
  private dashAfterimages: Map<
    string,
    Array<{ x: number; y: number; alpha: number; facingRight: boolean }>
  > = new Map();
  private lastAfterimageTime: Map<string, number> = new Map();

  // For selected champion indicator animation
  private selectionAnimTime = 0;

  // Light Orb renderer (keeps per-orb particle state between frames)
  private lightOrbRenderer: LightOrbRenderer;

  // VFX Manager for ability visual effects
  private vfxManager: VFXManager;

  // Hovered entity tracking for outline highlighting
  private hoveredEnemyId: string | null = null;
  private hoveredAllyId: string | null = null;

  constructor(stateManager: OnlineStateManager, localSide: number) {
    this.stateManager = stateManager;
    this.localSide = localSide;
    this.renderContext = {
      stateManager,
      localSide,
      animationTime: 0,
      getOutlineColor: (entityId) => this.getEntityOutlineColor(entityId),
    };
    this.lightOrbRenderer = new LightOrbRenderer(this.renderContext);
    this.vfxManager = getVFXManager(stateManager);
    loadImages([
      ...TOWER_IMAGES,
      ...NEXUS_IMAGES,
      ...MINION_IMAGES,
      ...JUNGLE_CREATURE_IMAGES,
      ...PROJECTILE_IMAGES,
      // Champions
      SPRITES.LUME.IDLE,
      SPRITES.LUME.WALK,
      SPRITES.LUME.ATTACK,
      SPRITES.LUME.Q,
      SPRITES.LUME.E,
      SPRITES.LUME.R,
      // Vex
      SPRITES.VEX.IDLE,
      SPRITES.VEX.WALK,
      SPRITES.VEX.ATTACK,
      SPRITES.VEX.DASH,
      SPRITES.VEX.SHURIKEN,
      SPRITES.VEX.DISAPPEAR,
    ]);
  }

  /**
   * Get or create render state for an entity.
   */
  private getEntityState(
    entityId: string,
    x: number,
    y: number,
    side: number,
  ): EntityRenderState {
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
        isWalking: false,
        smoothedVelocity: 0,
        idleFrameCount: 0,
      };
      this.entityStates.set(entityId, state);
    }
    return state;
  }

  /**
   * Update entity render state based on movement and actions.
   * @param moveTargetX/Y - The actual move target from server (for walking detection)
   * @param facingTargetX/Y - Resolved target including attack targets (for facing direction)
   * @param serverIsAttacking - Server-provided attack state (only true during attack animation)
   */
  private updateEntityState(
    state: EntityRenderState,
    x: number,
    y: number,
    targetEntityId: string | null | undefined,
    moveTargetX: number | null | undefined,
    moveTargetY: number | null | undefined,
    facingTargetX: number | null | undefined,
    facingTargetY: number | null | undefined,
    dt: number,
    serverIsAttacking?: boolean,
  ): void {
    // Walking detection uses ONLY the move target (not attack target)
    // This prevents showing walk animation when standing still with an attack target
    // Use != null to check for both null and undefined
    const hasMoveTarget = moveTargetX != null && moveTargetY != null;
    let distanceToMoveTarget = 0;

    if (hasMoveTarget) {
      const dx = moveTargetX! - x;
      const dy = moveTargetY! - y;
      distanceToMoveTarget = Math.sqrt(dx * dx + dy * dy);
    }

    // Walking if we have a MOVE target that's more than 10 units away
    const shouldBeWalking = hasMoveTarget && distanceToMoveTarget > 10;

    // Apply minimal hysteresis to prevent flicker at the boundary
    if (shouldBeWalking && !state.isWalking) {
      // Start walking immediately when we have a distant target
      state.isWalking = true;
      state.idleFrameCount = 0;
    } else if (!shouldBeWalking && state.isWalking) {
      // Require a few frames before stopping to prevent flicker
      state.idleFrameCount++;
      if (state.idleFrameCount >= 3) {
        state.isWalking = false;
      }
    } else if (shouldBeWalking) {
      state.idleFrameCount = 0;
    }

    // Determine facing direction based on FACING target (includes attack targets)
    const hasFacingTarget = facingTargetX != null && facingTargetY != null;
    if (hasFacingTarget) {
      const targetDx = facingTargetX - x;
      if (Math.abs(targetDx) > 10) {
        state.facingRight = targetDx > 0;
      }
    }

    // Track attacking state - only use server's isAttacking flag
    const wasAttacking = state.isAttacking;
    state.isAttacking = serverIsAttacking === true;

    // Reset or continue attack animation
    if (state.isAttacking) {
      if (!wasAttacking) {
        state.attackAnimTime = 0;
      } else {
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
      const clientDt =
        this.lastRenderTime === 0
          ? 1 / 60
          : Math.min((currentTime - this.lastRenderTime) / 1000, 0.1);
      this.lastRenderTime = currentTime;

      this.renderContext.animationTime += clientDt;
      this.selectionAnimTime += clientDt;

      if (!this.stateManager.hasState()) {
        this.renderWaitingMessage(canvasRenderingContext);
        return;
      }

      // Get all entities and sort by Y position for proper depth
      const entities = this.stateManager.getEntities();
      const localEntityId = this.stateManager.getLocalEntityId();

      // Sort entities by Y position (lower Y = rendered first = behind)
      // Also sort by entity type to ensure structures render before units
      const sortedEntities = [...entities].sort((a, b) => {
        // Zones render first (ground effects, behind everything)
        if (
          a.snapshot.entityType === EntityType.ZONE &&
          b.snapshot.entityType !== EntityType.ZONE
        )
          return -1;
        if (
          b.snapshot.entityType === EntityType.ZONE &&
          a.snapshot.entityType !== EntityType.ZONE
        )
          return 1;
        // Nexus renders next (behind most things)
        if (
          a.snapshot.entityType === EntityType.NEXUS &&
          b.snapshot.entityType !== EntityType.NEXUS
        )
          return -1;
        if (
          b.snapshot.entityType === EntityType.NEXUS &&
          a.snapshot.entityType !== EntityType.NEXUS
        )
          return 1;
        // Then towers
        if (
          a.snapshot.entityType === EntityType.TOWER &&
          b.snapshot.entityType !== EntityType.TOWER
        )
          return -1;
        if (
          b.snapshot.entityType === EntityType.TOWER &&
          a.snapshot.entityType !== EntityType.TOWER
        )
          return 1;
        // Then by Y position
        return a.position.y - b.position.y;
      });

      for (const entity of sortedEntities) {
        // Skip dead entities (except light orbs which show a ghost when destroyed)
        const snapshot = entity.snapshot as any;
        if ((snapshot.isDead || snapshot.isDestroyed) && snapshot.entityType !== EntityType.LIGHT_ORB) {
          continue;
        }

        const isLocalPlayer = entity.snapshot.entityId === localEntityId;
        // Calculate interpolated position for smooth rendering
        const interpolatedPos = this.getInterpolatedPosition(entity);
        // Round positions to integers for consistent state tracking
        const posX = Math.round(interpolatedPos.x);
        const posY = Math.round(interpolatedPos.y);
        // Update entity render state for animation tracking
        const side = snapshot.side ?? 0;
        const state = this.getEntityState(
          entity.snapshot.entityId,
          posX,
          posY,
          side,
        );

        // Resolve target entity position for facing direction
        let resolvedTargetX = snapshot.targetX;
        let resolvedTargetY = snapshot.targetY;
        if (snapshot.targetEntityId && resolvedTargetX == null) {
          // Has attack target but no move target - look up target position for facing
          const targetEntity = this.stateManager.getEntity(
            snapshot.targetEntityId,
          );
          if (targetEntity) {
            resolvedTargetX = Math.round(targetEntity.position.x);
            resolvedTargetY = Math.round(targetEntity.position.y);
          }
        }

        // Get attack state from event-based animation system
        // Fall back to snapshot's isAttacking for reconnections (when events might be missed)
        const isAttacking =
          this.stateManager.isEntityAttacking(snapshot.entityId) ||
          (snapshot as any).isAttacking === true;

        this.updateEntityState(
          state,
          posX,
          posY,
          snapshot.targetEntityId,
          snapshot.targetX, // Move target (for walking detection) - already rounded in state manager
          snapshot.targetY,
          resolvedTargetX, // Facing target (includes attack targets)
          resolvedTargetY,
          clientDt,
          isAttacking,
        );
        this.renderEntity(canvasRenderingContext, entity, isLocalPlayer, state);
      }

      // Update and render VFX system
      this.vfxManager.update(clientDt);
      // Render VFX in world space (camera transform already applied)
      this.vfxManager.render(canvasRenderingContext, 0, 0);

      // Render ability visual effects (legacy system)
      renderAbilityEffects(canvasRenderingContext, this.stateManager);

      // Render floating damage numbers on top of all entities
      renderDamageNumbers(canvasRenderingContext, this.stateManager);

      // Render floating gold numbers
      renderGoldNumbers(canvasRenderingContext, this.stateManager);

      // Render floating XP numbers
      renderXpNumbers(canvasRenderingContext, this.stateManager);
    }, true);

    element.positionType = "normal";
    return element;
  }

  // Set to false to disable interpolation for debugging
  private static readonly ENABLE_INTERPOLATION = false;

  /**
   * Calculate interpolated position for smooth rendering.
   * Lerps between previousPosition and position based on time since last update.
   * Server runs at 125 Hz (8ms per tick), but network updates may batch.
   */
  private getInterpolatedPosition(entity: InterpolatedEntity): Vector {
    // Skip interpolation if disabled - useful for debugging vibration issues
    if (!EntityRenderer.ENABLE_INTERPOLATION) {
      return entity.position;
    }

    const timeSinceUpdate = Date.now() - entity.lastUpdateTime;
    // Server sends at 125 Hz (8ms), but account for network jitter with slight buffer
    const interpolationDelay = 16; // ms - roughly 2 server ticks / 1 client frame
    const t = Math.min(1, timeSinceUpdate / interpolationDelay);

    return Vector.lerp(entity.previousPosition, entity.position, t);
  }

  /**
   * Render a single entity.
   */
  private renderEntity(
    ctx: CanvasRenderingContext2D,
    entity: InterpolatedEntity,
    isLocalPlayer: boolean,
    state: EntityRenderState,
  ): void {
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
        renderMinion(ctx, snapshot, side, state, this.renderContext);
        break;
      case EntityType.TOWER:
        renderTower(ctx, snapshot, side, this.renderContext);
        break;
      case EntityType.NEXUS:
        renderNexus(ctx, snapshot, side, this.renderContext);
        break;
      case EntityType.PROJECTILE:
        renderProjectile(ctx, snapshot, this.renderContext);
        break;
      case EntityType.JUNGLE_CAMP:
        renderJungleCamp(ctx, snapshot, state, this.renderContext);
        break;
      case EntityType.WARD:
        renderWard(ctx, snapshot, side, this.renderContext);
        break;
      case EntityType.ZONE:
        renderZone(ctx, snapshot, this.renderContext);
        break;
      case EntityType.LIGHT_ORB:
        this.lightOrbRenderer.render(ctx, snapshot, side);
        break;
      default:
        renderGeneric(
          ctx,
          30,
          side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED,
        );
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
    state: EntityRenderState,
  ): void {
    const size = 40;
    const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;

    // Calculate health bar position based on visual height or collision shape
    const HEALTH_BAR_PADDING = 8; // Padding above visual bounds
    let healthBarYOffset = -size * 0.7; // Default fallback

    const championId = snapshot.championId;
    if (championId) {
      const definition = getChampionDefinition(championId);
      if (definition) {
        // Use visualHeight if defined, otherwise derive from collision
        if (definition.visualHeight !== undefined) {
          // Visual height is centered, so top is at -visualHeight/2
          healthBarYOffset = -definition.visualHeight / 2 - HEALTH_BAR_PADDING;
        } else if (definition.collision) {
          const collision = definition.collision;
          const offsetY = collision.offset?.y ?? 0;
          if (isRectangleCollision(collision)) {
            healthBarYOffset =
              offsetY - collision.height / 2 - HEALTH_BAR_PADDING;
          } else if (isCircleCollision(collision)) {
            healthBarYOffset = offsetY - collision.radius - HEALTH_BAR_PADDING;
          }
        }
      }
    }

    // Check if this champion has sprite support
    let renderedWithSprite = false;

    if (championId === "lume") {
      renderedWithSprite = this.renderLumeSprite(ctx, snapshot, state, size);
    } else if (championId === "vex") {
      renderedWithSprite = this.renderVexSprite(ctx, snapshot, state, size);
    }

    // Fallback: Draw body as circle with gradient if no sprite
    if (!renderedWithSprite) {
      const gradient = ctx.createRadialGradient(
        0,
        -size * 0.2,
        0,
        0,
        0,
        size * 0.5,
      );
      gradient.addColorStop(0, lightenColor(color, 30));
      gradient.addColorStop(1, color);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = isLocalPlayer ? "#ffffff" : "#333333";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw health bar with shields (positioned based on collision shape)
    const healthBarY = healthBarYOffset;
    if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
      // Determine health bar color based on relationship to local player
      // Green for self, blue for ally, red for enemy
      let healthBarColor: string;
      if (isLocalPlayer) {
        healthBarColor = HEALTH_BAR_COLORS.SELF; // Green
      } else if (side === this.localSide) {
        healthBarColor = HEALTH_BAR_COLORS.ALLY; // Blue
      } else {
        healthBarColor = HEALTH_BAR_COLORS.ENEMY; // Red
      }

      // Extract shields from snapshot (if available)
      const shields = snapshot.shields as
        | Array<{ amount: number; shieldType: string }>
        | undefined;
      renderHealthBar(
        ctx,
        snapshot.health,
        snapshot.maxHealth,
        size,
        healthBarY,
        healthBarColor,
        shields,
      );
    }

    // Draw mark indicators above health bar (debuffs on enemies, buffs on self)
    const isEnemy = side !== this.localSide;
    const activeEffects = snapshot.activeEffects as
      | Array<{
          definitionId: string;
          timeRemaining: number;
          totalDuration?: number;
          stacks: number;
        }>
      | undefined;
    renderMarkIndicators(
      ctx,
      activeEffects,
      size,
      healthBarY,
      isLocalPlayer,
      isEnemy,
    );

    // Draw mana bar for local player (below health bar)
    if (
      isLocalPlayer &&
      snapshot.resource !== undefined &&
      snapshot.maxResource !== undefined
    ) {
      renderResourceBar(
        ctx,
        snapshot.resource,
        snapshot.maxResource,
        size,
        healthBarY + 8, // Position below health bar
      );
    }

    // Draw level indicator to the left of health bar (only for local player)
    if (isLocalPlayer && snapshot.level !== undefined) {
      const levelX = -size / 2 - 8; // Left of health bar
      const levelY = healthBarY + 3; // Aligned with health bar center
      const levelText = snapshot.level.toString();

      // Draw level number with black outline (like damage numbers)
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Black outline
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(levelText, levelX, levelY);

      // White fill
      ctx.fillStyle = "#ffffff";
      ctx.fillText(levelText, levelX, levelY);
    }
  }

  /**
   * Render Lume champion using sprite sheets.
   * Returns true if sprite was rendered, false if fallback needed.
   */
  private renderLumeSprite(
    ctx: CanvasRenderingContext2D,
    snapshot: any,
    state: EntityRenderState,
    size: number,
  ): boolean {
    const entityId = snapshot.entityId;

    // Check if dashing with Lume E (special case: hold frame 6 during dash)
    const isDashingWithE =
      snapshot.isDashing && snapshot.dashAbilityId === "lume_e";

    // Check if casting an ability
    const castingState = this.stateManager.isEntityCastingAbility(entityId);
    const abilityProgress = castingState.casting
      ? this.stateManager.getAbilityAnimationProgress(entityId)
      : 0;

    // Select sprite based on animation state (priority: E dash > ability > walk > idle)
    let spriteSrc: string;
    let frameCount: number;
    let useAbilityProgress = false;
    let fixedFrameIndex: number | null = null;

    if (isDashingWithE) {
      // Lume E dash: use E sprite, hold on frame 6 (index 5)
      spriteSrc = SPRITES.LUME.E;
      frameCount = SPRITES.LUME.E_FRAMES;
      fixedFrameIndex = 5; // Frame 6 (0-indexed)

      // Override facing direction to look toward dash target (orb)
      if (snapshot.dashTargetX != null) {
        const dx = snapshot.dashTargetX - snapshot.x;
        state.facingRight = dx >= 0;
      }
    } else if (castingState.casting && castingState.abilityId) {
      // Ability animation - check which ability
      const abilityId = castingState.abilityId;
      if (abilityId === "lume_q") {
        spriteSrc = SPRITES.LUME.Q;
        frameCount = SPRITES.LUME.Q_FRAMES;
        useAbilityProgress = true;
      } else if (abilityId === "lume_e") {
        // Lume E after dash: play ending frames (indices 6-10)
        // abilityProgress goes from ~0.5 to 1.0 during the ending phase
        // Map this to frames 6-10 (5 frames)
        spriteSrc = SPRITES.LUME.E;
        frameCount = SPRITES.LUME.E_FRAMES;
        const endingFrameCount = 5;
        const endingFrameIndex = Math.min(
          Math.floor(abilityProgress * endingFrameCount),
          endingFrameCount - 1,
        );
        fixedFrameIndex = 6 + endingFrameIndex; // Start from index 6 (frame 7)
      } else if (abilityId === "lume_r") {
        spriteSrc = SPRITES.LUME.R;
        frameCount = SPRITES.LUME.R_FRAMES;
        useAbilityProgress = true;
      } else {
        // Unknown ability, fall back to idle
        spriteSrc = SPRITES.LUME.IDLE;
        frameCount = SPRITES.LUME.IDLE_FRAMES;
      }
    } else if (state.isAttacking) {
      // Attack animation
      spriteSrc = SPRITES.LUME.ATTACK;
      frameCount = SPRITES.LUME.ATTACK_FRAMES;
      // Use attack animation time for frame selection
      const animSpeed = 12; // Fast attack animation
      fixedFrameIndex = Math.floor(state.attackAnimTime * animSpeed) % frameCount;
    } else if (state.isWalking) {
      // Walk animation
      spriteSrc = SPRITES.LUME.WALK;
      frameCount = SPRITES.LUME.WALK_FRAMES;
    } else {
      // Idle animation
      spriteSrc = SPRITES.LUME.IDLE;
      frameCount = SPRITES.LUME.IDLE_FRAMES;
    }

    const image = imageCache.get(spriteSrc);

    if (image && image.complete && image.naturalWidth > 0) {
      // Calculate frame dimensions from actual image
      const frameWidth = image.naturalWidth / frameCount;
      const frameHeight = image.naturalHeight;

      // Calculate animation frame
      let frameIndex: number;
      if (fixedFrameIndex !== null) {
        // Fixed frame (e.g., Lume E dash holds on frame 6)
        frameIndex = Math.min(fixedFrameIndex, frameCount - 1);
      } else if (useAbilityProgress) {
        // Use ability progress (0-1) to determine frame
        frameIndex = Math.min(
          Math.floor(abilityProgress * frameCount),
          frameCount - 1,
        );
      } else {
        // Use continuous animation time for walk/idle
        const animSpeed = state.isWalking ? 10 : 8;
        frameIndex = Math.floor(this.renderContext.animationTime * animSpeed) % frameCount;
      }
      const srcX = frameIndex * frameWidth;

      const scaledWidth = frameWidth * SPRITES.LUME.SCALE;
      const scaledHeight = frameHeight * SPRITES.LUME.SCALE;

      // Check if entity is hovered for outline highlighting
      const outlineColor = this.getEntityOutlineColor(snapshot.entityId);

      // Apply horizontal flip if facing left
      ctx.save();
      if (!state.facingRight) {
        ctx.scale(-1, 1);
      }

      if (outlineColor) {
        // Draw outlined sprite when hovered
        const outlinedSprite = getOutlinedSprite(
          image,
          srcX,
          0,
          frameWidth,
          frameHeight,
          outlineColor
        );

        if (outlinedSprite) {
          // Outlined sprite has padding, so adjust dimensions
          const padding = getOutlinePadding();
          const outlinedWidth = (frameWidth + padding * 2) * SPRITES.LUME.SCALE;
          const outlinedHeight = (frameHeight + padding * 2) * SPRITES.LUME.SCALE;

          ctx.drawImage(
            outlinedSprite,
            0,
            0,
            outlinedSprite.width,
            outlinedSprite.height,
            -outlinedWidth / 2,
            -outlinedHeight / 2,
            outlinedWidth,
            outlinedHeight,
          );
        } else {
          // Fallback to normal sprite if outline generation failed
          ctx.drawImage(
            image,
            srcX,
            0,
            frameWidth,
            frameHeight,
            -scaledWidth / 2,
            -scaledHeight / 2,
            scaledWidth,
            scaledHeight,
          );
        }
      } else {
        // Draw normal sprite when not hovered
        ctx.drawImage(
          image,
          srcX,
          0,
          frameWidth,
          frameHeight,
          -scaledWidth / 2,
          -scaledHeight / 2,
          scaledWidth,
          scaledHeight,
        );
      }

      ctx.restore();
      return true;
    }

    return false;
  }

  /**
   * Render Vex champion using sprite sheets.
   * Returns true if sprite was rendered, false if fallback needed.
   */
  private renderVexSprite(
    ctx: CanvasRenderingContext2D,
    snapshot: any,
    state: EntityRenderState,
    size: number,
  ): boolean {
    const entityId = snapshot.entityId;

    // Check if dashing with Vex E (special case: hold frame 5 during dash)
    const isDashingWithE =
      snapshot.isDashing && snapshot.dashAbilityId === "vex_dash";

    // Check if casting an ability
    const castingState = this.stateManager.isEntityCastingAbility(entityId);
    const abilityProgress = castingState.casting
      ? this.stateManager.getAbilityAnimationProgress(entityId)
      : 0;

    // Check if Vex has ninja mode active (for violet particle aura)
    const activeEffects = snapshot.activeEffects as
      | Array<{ definitionId: string }>
      | undefined;
    const hasNinjaMode = activeEffects?.some(
      (e) => e.definitionId === "vex_ninja_mode"
    );

    // Check if Vex is stealthed (for semi-transparent rendering to local player)
    const isStealthed = activeEffects?.some(
      (e) => e.definitionId === "vex_stealth"
    );

    // Select sprite based on animation state (priority: E dash > ability > walk > idle)
    let spriteSrc: string;
    let frameCount: number;
    let useAbilityProgress = false;
    let fixedFrameIndex: number | null = null;

    if (isDashingWithE) {
      // Vex E dash: use DASH sprite, hold on frame 5 (index 4)
      spriteSrc = SPRITES.VEX.DASH;
      frameCount = SPRITES.VEX.DASH_FRAMES;
      fixedFrameIndex = SPRITES.VEX.DASH_HOLD_FRAME;

      // Override facing direction to look toward dash target
      if (snapshot.dashTargetX != null) {
        const dx = snapshot.dashTargetX - snapshot.x;
        state.facingRight = dx >= 0;
      }

      // Create afterimages during dash
      const now = performance.now();
      const lastTime = this.lastAfterimageTime.get(entityId) || 0;
      if (now - lastTime > 50) {
        // Create afterimage every 50ms
        let afterimages = this.dashAfterimages.get(entityId);
        if (!afterimages) {
          afterimages = [];
          this.dashAfterimages.set(entityId, afterimages);
        }
        afterimages.push({
          x: snapshot.x,
          y: snapshot.y,
          alpha: 0.7,
          facingRight: state.facingRight,
        });
        this.lastAfterimageTime.set(entityId, now);
      }
    } else if (castingState.casting && castingState.abilityId) {
      // Ability animation - check which ability
      const abilityId = castingState.abilityId;
      if (abilityId === "vex_shuriken") {
        // Q - Shuriken throw, trigger at frame 4 (index 3)
        spriteSrc = SPRITES.VEX.SHURIKEN;
        frameCount = SPRITES.VEX.SHURIKEN_FRAMES;
        useAbilityProgress = true;
      } else if (abilityId === "vex_shroud") {
        // W - Disappear, effect on last frame
        spriteSrc = SPRITES.VEX.DISAPPEAR;
        frameCount = SPRITES.VEX.DISAPPEAR_FRAMES;
        useAbilityProgress = true;
      } else if (abilityId === "vex_dash") {
        // E - Dash animation after dash completes
        spriteSrc = SPRITES.VEX.DASH;
        frameCount = SPRITES.VEX.DASH_FRAMES;
        // Play ending frames after the dash hold frame
        const endingFrameCount = frameCount - SPRITES.VEX.DASH_HOLD_FRAME - 1;
        const endingFrameIndex = Math.min(
          Math.floor(abilityProgress * endingFrameCount),
          endingFrameCount - 1
        );
        fixedFrameIndex = SPRITES.VEX.DASH_HOLD_FRAME + 1 + endingFrameIndex;
      } else if (abilityId === "vex_ninja_mode") {
        // R - Ninja Mode activation, use walk as base (VFX handles the particles)
        spriteSrc = SPRITES.VEX.WALK;
        frameCount = SPRITES.VEX.WALK_FRAMES;
      } else {
        // Unknown ability, fall back to walk idle
        spriteSrc = SPRITES.VEX.WALK;
        frameCount = SPRITES.VEX.WALK_FRAMES;
        fixedFrameIndex = 0; // Idle frame
      }
    } else if (state.isAttacking) {
      // Basic attack animation - trigger at frame 4 (index 3)
      spriteSrc = SPRITES.VEX.ATTACK;
      frameCount = SPRITES.VEX.ATTACK_FRAMES;
      // Use attack animation time for frame selection
      const animSpeed = 14; // Fast melee attack animation
      fixedFrameIndex =
        Math.floor(state.attackAnimTime * animSpeed) % frameCount;
    } else if (state.isWalking) {
      // Walk animation
      spriteSrc = SPRITES.VEX.WALK;
      frameCount = SPRITES.VEX.WALK_FRAMES;
    } else {
      // Idle animation
      spriteSrc = SPRITES.VEX.IDLE;
      frameCount = SPRITES.VEX.IDLE_FRAMES;
      fixedFrameIndex = 0;
    }

    const image = imageCache.get(spriteSrc);

    if (image && image.complete && image.naturalWidth > 0) {
      // Calculate frame dimensions from actual image
      const frameWidth = image.naturalWidth / frameCount;
      const frameHeight = image.naturalHeight;

      // Calculate animation frame
      let frameIndex: number;
      if (fixedFrameIndex !== null) {
        // Fixed frame (e.g., Vex E dash holds on frame 5)
        frameIndex = Math.min(fixedFrameIndex, frameCount - 1);
      } else if (useAbilityProgress) {
        // Use ability progress (0-1) to determine frame
        frameIndex = Math.min(
          Math.floor(abilityProgress * frameCount),
          frameCount - 1
        );
      } else {
        // Use continuous animation time for walk
        const animSpeed = 10;
        frameIndex = Math.floor(this.renderContext.animationTime * animSpeed) % frameCount;
      }
      const srcX = frameIndex * frameWidth;

      const scaledWidth = frameWidth * SPRITES.VEX.SCALE;
      const scaledHeight = frameHeight * SPRITES.VEX.SCALE;

      // Render and update dash afterimages
      const afterimages = this.dashAfterimages.get(entityId);
      if (afterimages && afterimages.length > 0) {
        const dashImage = imageCache.get(SPRITES.VEX.DASH);
        if (dashImage && dashImage.complete && dashImage.naturalWidth > 0) {
          const dashFrameWidth = dashImage.naturalWidth / SPRITES.VEX.DASH_FRAMES;
          const dashFrameHeight = dashImage.naturalHeight;
          const dashSrcX = SPRITES.VEX.DASH_HOLD_FRAME * dashFrameWidth;
          const dashScaledWidth = dashFrameWidth * SPRITES.VEX.SCALE;
          const dashScaledHeight = dashFrameHeight * SPRITES.VEX.SCALE;

          // Draw afterimages (oldest first, so newest is on top)
          for (const ai of afterimages) {
            ctx.save();
            // Translate to afterimage position relative to current entity position
            const relX = ai.x - snapshot.x;
            const relY = ai.y - snapshot.y;
            ctx.translate(relX, relY);
            ctx.globalAlpha = ai.alpha;

            // Apply horizontal flip based on afterimage facing
            if (!ai.facingRight) {
              ctx.scale(-1, 1);
            }

            // Add violet tint to afterimages
            ctx.drawImage(
              dashImage,
              dashSrcX,
              0,
              dashFrameWidth,
              dashFrameHeight,
              -dashScaledWidth / 2,
              -dashScaledHeight / 2,
              dashScaledWidth,
              dashScaledHeight
            );
            ctx.restore();

            // Fade afterimage
            ai.alpha -= 0.03;
          }

          // Remove faded afterimages
          this.dashAfterimages.set(
            entityId,
            afterimages.filter((ai) => ai.alpha > 0)
          );
        }
      }

      // Check if entity is hovered for outline highlighting
      const outlineColor = this.getEntityOutlineColor(snapshot.entityId);

      // Apply horizontal flip if facing left
      ctx.save();
      if (!state.facingRight) {
        ctx.scale(-1, 1);
      }

      // Apply stealth opacity (local player sees semi-transparent, others don't see at all)
      // Only apply after the disappear animation has finished
      const isCastingShroud = castingState.casting && castingState.abilityId === "vex_shroud";
      if (isStealthed && !isCastingShroud) {
        ctx.globalAlpha = 0.4;
      }

      // Draw violet aura particles when Ninja Mode is active
      if (hasNinjaMode) {
        this.drawNinjaModeAura(ctx, scaledWidth, scaledHeight);
      }

      if (outlineColor) {
        // Draw outlined sprite when hovered
        const outlinedSprite = getOutlinedSprite(
          image,
          srcX,
          0,
          frameWidth,
          frameHeight,
          outlineColor
        );

        if (outlinedSprite) {
          // Outlined sprite has padding, so adjust dimensions
          const padding = getOutlinePadding();
          const outlinedWidth = (frameWidth + padding * 2) * SPRITES.VEX.SCALE;
          const outlinedHeight =
            (frameHeight + padding * 2) * SPRITES.VEX.SCALE;

          ctx.drawImage(
            outlinedSprite,
            0,
            0,
            outlinedSprite.width,
            outlinedSprite.height,
            -outlinedWidth / 2,
            -outlinedHeight / 2,
            outlinedWidth,
            outlinedHeight
          );
        } else {
          // Fallback to normal sprite if outline generation failed
          ctx.drawImage(
            image,
            srcX,
            0,
            frameWidth,
            frameHeight,
            -scaledWidth / 2,
            -scaledHeight / 2,
            scaledWidth,
            scaledHeight
          );
        }
      } else {
        // Draw normal sprite when not hovered
        ctx.drawImage(
          image,
          srcX,
          0,
          frameWidth,
          frameHeight,
          -scaledWidth / 2,
          -scaledHeight / 2,
          scaledWidth,
          scaledHeight
        );
      }

      ctx.restore();
      return true;
    }

    return false;
  }

  /**
   * Draw violet particle aura for Vex's Ninja Mode.
   */
  private drawNinjaModeAura(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const time = this.renderContext.animationTime;
    const particleCount = 6;
    const orbitRadius = Math.max(width, height) * 0.5;

    ctx.save();

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time * 3;
      const x = Math.cos(angle) * orbitRadius;
      const y = Math.sin(angle) * orbitRadius * 0.5; // Elliptical orbit

      // Violet gradient particle
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 4);
      gradient.addColorStop(0, "rgba(153, 51, 255, 0.9)"); // Bright violet center
      gradient.addColorStop(0.5, "rgba(136, 68, 204, 0.6)"); // Purple
      gradient.addColorStop(1, "rgba(68, 34, 102, 0)"); // Fade out

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add subtle glow around character
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, orbitRadius);
    glowGradient.addColorStop(0, "rgba(153, 51, 255, 0.15)");
    glowGradient.addColorStop(0.7, "rgba(136, 68, 204, 0.05)");
    glowGradient.addColorStop(1, "rgba(68, 34, 102, 0)");

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, orbitRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Render waiting message when no state received yet.
   */
  private renderWaitingMessage(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 4;
    ctx.fillText("Waiting for game state...", 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * Get team ID for fog of war filtering.
   */
  getTeamId(): number {
    return this.localSide === 0 ? 0 : 1;
  }

  // ============================================================================
  // Hover highlighting for outlined sprites
  // ============================================================================

  /**
   * Set the currently hovered entity IDs (called by OnlineInputHandler).
   */
  setHoveredEntities(enemyId: string | null, allyId: string | null): void {
    this.hoveredEnemyId = enemyId;
    this.hoveredAllyId = allyId;
  }

  /**
   * Get the outline color for an entity if it's hovered.
   * Returns null if the entity is not hovered.
   */
  private getEntityOutlineColor(entityId: string): string | null {
    if (this.hoveredEnemyId === entityId) {
      return OUTLINE_COLORS.ENEMY;
    }
    if (this.hoveredAllyId === entityId) {
      return OUTLINE_COLORS.ALLY;
    }
    return null;
  }

  /**
   * Check if an entity is currently hovered.
   */
  private isEntityHovered(entityId: string): boolean {
    return this.hoveredEnemyId === entityId || this.hoveredAllyId === entityId;
  }
}

export default EntityRenderer;
