/**
 * EntityRenderer - Renders entities based on server state for online play.
 *
 * A thin orchestrator: each frame it advances the animation clock, updates
 * per-entity animation state, sorts entities for depth and hands each one to
 * the renderer for its EntityType, then draws the VFX and overlays on top. It
 * also holds the hover state used for sprite outlines.
 *
 * - src/render/entities/   one renderer per entity type, plus shared helpers
 * - src/render/champions/  champion-specific drawing, one file per champion
 * - src/render/overlays/   health bars, status icons, ability effects and
 *                          floating numbers
 */

import type { GameObject } from "@/core/GameObject";
import type GameContext from "@/core/gameContext";
import RenderElement from "@/render/renderElement";
import Vector from "@/physics/vector";

import type {
  OnlineStateManager,
  InterpolatedEntity,
} from "@/core/OnlineStateManager";

import { EntityType, type InhibitorSnapshot } from "@siege/shared";
import { VFXManager, getVFXManager } from "@/vfx";
import { getGPURenderer } from "@/gpu/GPURenderer";
import { emitZone, type ZoneSnapshot } from "@/gpu/fx/zones";
import { emitChampionAuras, type ChampionAuraSnapshot } from "@/gpu/fx/championAuras";
import { OUTLINE_COLORS } from "@/render/OutlinedSpriteCache";
import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import { TEAM_COLORS, loadImages } from "@/render/entities/shared";
import { isInBrush } from "@/vision/brush";
import { ChampionRenderer } from "@/render/entities/champion";
import { renderMinion, MINION_IMAGES } from "@/render/entities/minion";
import { renderTower, TOWER_IMAGES } from "@/render/entities/tower";
import { renderNexus, NEXUS_IMAGES } from "@/render/entities/nexus";
import { renderInhibitor, INHIBITOR_IMAGES } from "@/render/entities/inhibitor";
import {
  renderJungleCamp,
  JUNGLE_CREATURE_IMAGES,
} from "@/render/entities/jungleCreature";
import {
  renderProjectile,
  PROJECTILE_IMAGES,
} from "@/render/entities/projectile";
import { renderWard, WARD_IMAGES } from "@/render/entities/ward";
import { renderZone } from "@/render/entities/zone";
import { LightOrbRenderer } from "@/render/entities/lightOrb";
import { renderGeneric } from "@/render/entities/generic";
import { renderAbilityEffects } from "@/render/overlays/abilityEffects";
import { renderTowerRanges } from "@/render/overlays/towerRange";
import {
  renderDamageNumbers,
  renderGoldNumbers,
  renderXpNumbers,
  renderHealNumbers,
} from "@/render/overlays/floatingNumbers";
import { getChampionImages } from "@/render/champions";

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

  // For selected champion indicator animation
  private selectionAnimTime = 0;

  // Renderers that keep state between frames (champion bodies, orb particles)
  private championRenderer: ChampionRenderer;
  private lightOrbRenderer: LightOrbRenderer;

  // VFX Manager for ability visual effects
  private vfxManager: VFXManager;

  // Hovered entity tracking for outline highlighting
  private hoveredEnemyId: string | null = null;
  private hoveredAllyId: string | null = null;

  // The local champion this frame, to see through buildings in front of it
  private localChampionPosition: Vector | null = null;

  /** Area of a building's sprite above its position: a champion there is behind it */
  private static readonly BUILDING_SPRITE_AREAS: Partial<Record<EntityType, { halfWidth: number; height: number }>> = {
    [EntityType.TOWER]: { halfWidth: 55, height: 195 },
    [EntityType.NEXUS]: { halfWidth: 90, height: 230 },
    [EntityType.INHIBITOR]: { halfWidth: 40, height: 90 },
  };
  private static readonly SEE_THROUGH_ALPHA = 0.5;
  /** How see-through our champions are in a bush */
  private static readonly IN_BRUSH_ALPHA = 0.55;

  constructor(stateManager: OnlineStateManager, localSide: number) {
    this.stateManager = stateManager;
    this.localSide = localSide;
    this.renderContext = {
      stateManager,
      localSide,
      animationTime: 0,
      getOutlineColor: (entityId) => this.getEntityOutlineColor(entityId),
    };
    this.championRenderer = new ChampionRenderer(this.renderContext);
    this.lightOrbRenderer = new LightOrbRenderer(this.renderContext);
    this.vfxManager = getVFXManager(stateManager);
    loadImages([
      ...TOWER_IMAGES,
      ...NEXUS_IMAGES,
      ...INHIBITOR_IMAGES,
      ...MINION_IMAGES,
      ...JUNGLE_CREATURE_IMAGES,
      ...PROJECTILE_IMAGES,
      ...WARD_IMAGES,
      ...getChampionImages(),
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

      // Zones are ground effects, under everything. Everything else, buildings
      // included, goes back (lower Y) to front, so a unit walking behind a
      // tower is hidden by it instead of drawn over it.
      const sortedEntities = [...entities].sort((a, b) => {
        const aIsZone = a.snapshot.entityType === EntityType.ZONE;
        const bIsZone = b.snapshot.entityType === EntityType.ZONE;
        if (aIsZone !== bIsZone) return aIsZone ? -1 : 1;
        return a.position.y - b.position.y;
      });
      const localEntity = localEntityId ? this.stateManager.getEntity(localEntityId) : undefined;
      this.localChampionPosition = localEntity?.position ?? null;

      // On the ground, under every unit: enemy tower ranges near the local champion
      renderTowerRanges(canvasRenderingContext, entities, localEntity, this.localSide);

      // Effects on the GPU: the ground layer now, the rest after the units
      this.vfxManager.update(clientDt);
      const gpu = getGPURenderer();
      if (gpu) {
        this.vfxManager.emitGround(gpu.groundFx);
        for (const entity of entities) {
          const { x, y } = entity.position;
          const time = this.renderContext.animationTime;
          if (entity.snapshot.entityType === EntityType.ZONE) {
            emitZone(gpu.groundFx, gpu.topFx, entity.snapshot as ZoneSnapshot, x, y, time);
          } else if (entity.snapshot.entityType === EntityType.CHAMPION && !(entity.snapshot as { isDead?: boolean }).isDead) {
            emitChampionAuras(gpu.groundFx, gpu.topFx, entity.snapshot as ChampionAuraSnapshot, x, y, time);
          }
        }
        gpu.drawFX(canvasRenderingContext, "ground");
      }

      for (const entity of sortedEntities) {
        // Skip dead entities (except light orbs, which show a ghost when
        // destroyed, and inhibitors, whose rubble shows until they rebuild)
        const snapshot = entity.snapshot as any;
        const showsDestroyed = snapshot.entityType === EntityType.LIGHT_ORB || snapshot.entityType === EntityType.INHIBITOR;
        if ((snapshot.isDead || snapshot.isDestroyed) && !showsDestroyed) {
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

        // Get attack state from the event-based animation system only: the
        // snapshot's isAttacking isn't sent in deltas, so from a full snapshot
        // (a unit coming into sight mid-attack) it would stay true forever
        // and freeze the unit on its first attack frame
        const isAttacking = this.stateManager.isEntityAttacking(snapshot.entityId);

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

      // Effects over the units (world space, camera transform already applied)
      if (gpu) {
        this.vfxManager.emitTop(gpu.topFx);
        gpu.drawFX(canvasRenderingContext, "top");
        this.vfxManager.renderScreenFlash(canvasRenderingContext);
      } else {
        this.vfxManager.render(canvasRenderingContext, 0, 0);
      }

      // Ability shapes (legacy system): on the GPU each ability's own effects show it
      if (!gpu) renderAbilityEffects(canvasRenderingContext, this.stateManager);

      // Render floating damage numbers on top of all entities
      renderDamageNumbers(canvasRenderingContext, this.stateManager);

      // Render floating gold numbers
      renderGoldNumbers(canvasRenderingContext, this.stateManager);

      // Render floating XP numbers
      renderXpNumbers(canvasRenderingContext, this.stateManager);

      // Render floating heal numbers
      renderHealNumbers(canvasRenderingContext, this.stateManager);
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
    if (this.hidesLocalChampion(snapshot.entityType, pos)) {
      ctx.globalAlpha = EntityRenderer.SEE_THROUGH_ALPHA;
    }
    // Our champions in a bush are drawn see-through: hidden from enemies outside it
    if (snapshot.entityType === EntityType.CHAMPION && side === this.renderContext.localSide && isInBrush(pos.x, pos.y)) {
      ctx.globalAlpha *= EntityRenderer.IN_BRUSH_ALPHA;
    }
    // Units flash bright for a moment when hit (jungle creatures add it to their own filters)
    const hitFlash = this.stateManager.getHitFlash(snapshot.entityId);
    if (hitFlash > 0 && (snapshot.entityType === EntityType.CHAMPION || snapshot.entityType === EntityType.MINION)) {
      ctx.filter = `brightness(${1 + hitFlash * 1.2})`;
    }

    // Draw entity based on type
    switch (snapshot.entityType) {
      case EntityType.CHAMPION:
        this.championRenderer.render(ctx, snapshot, side, isLocalPlayer, state);
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
      case EntityType.INHIBITOR:
        renderInhibitor(ctx, snapshot as InhibitorSnapshot, side, this.renderContext);
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
        // On the GPU zones are drawn with the ground effects, under every unit
        if (!getGPURenderer()) renderZone(ctx, snapshot, this.renderContext);
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
   * Whether a tower or the nexus stands in front of the local champion,
   * hiding it. Such a building is drawn see-through.
   */
  private hidesLocalChampion(entityType: EntityType, buildingPos: Vector): boolean {
    const champion = this.localChampionPosition;
    const footprint = EntityRenderer.BUILDING_SPRITE_AREAS[entityType];
    if (!champion || !footprint) return false;
    const dy = champion.y - buildingPos.y;
    return Math.abs(champion.x - buildingPos.x) < footprint.halfWidth && dy < 0 && dy > -footprint.height;
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
