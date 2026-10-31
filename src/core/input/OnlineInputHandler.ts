/**
 * OnlineInputHandler - Captures player input and sends to server.
 *
 * Handles:
 * - Right-click: Move to position
 * - Q/W/E/R: Ability cast
 * - S: Stop
 * - Click on enemy: Target unit
 * - Cursor icons: Attack cursor when hovering enemies
 * - Visual feedback: Enemy hover ellipse, move markers
 */

import type { GameObject } from "@/core/GameObject";
import type GameContext from "@/core/gameContext";
import { InputManager, MouseButton } from "@/core/input/InputManager";
import Vector from "@/physics/vector";
import type { NetworkClient } from "@siege/client";
import type { AbilitySlot } from "@siege/shared";
import { GameConfig, getAbilityDefinition, getChampionDefinition, hasChargeBehavior, type WardType } from "@siege/shared";
import type {
  OnlineStateManager,
  InterpolatedEntity,
} from "@/core/OnlineStateManager";
import { getCursorManager } from "@/core/CursorManager";
import { pickScore } from "@/core/input/picking";
import RenderElement from "@/render/renderElement";
import { renderWardPreview } from "@/render/entities/ward";

/** Summoner spell keys and their slots */
const SUMMONER_KEYS: [string, 0 | 1][] = [["d", 0], ["f", 1]];

/** Ward keys: 4 places a stealth ward (the trinket), 5 a control ward */
const WARD_KEYS: [string, WardType][] = [["4", "stealth"], ["5", "control"]];

/** Entity types that can be attacked (for cursor hover) */
const ATTACKABLE_ENTITY_TYPES: Set<number> = new Set([
  0, // EntityType.CHAMPION
  1, // EntityType.MINION
  2, // EntityType.TOWER
  5, // EntityType.JUNGLE_CAMP
]);

/** Entity types that can be targeted as allies */
const ALLY_TARGETABLE_ENTITY_TYPES: Set<number> = new Set([
  0, // EntityType.CHAMPION
  1, // EntityType.MINION
]);

/** Move marker: a ring on the ground closing in on the point, with arrows converging on it */
const MOVE_MARKER_CONFIG = {
  ANIMATION_DURATION: 0.45, // seconds
  /** Ring radius at the start and at the end (world units) */
  START_RADIUS: 20,
  END_RADIUS: 6,
  /** The ground is seen at an angle: rings are this much flatter than wide */
  FLATTEN: 0.55,
  MOVE_COLOR: "#7CFC8A",
  ATTACK_MOVE_COLOR: "#FF5A4E",
};

/** Active move marker instance */
interface MoveMarker {
  position: Vector;
  startTime: number;
  /** Attack-move markers are tinted red */
  attackMove?: boolean;
}

/** Hovered entity info for rendering */
interface HoveredEntityInfo {
  position: Vector;
  pulseTime: number;
  isAlly: boolean;
  collisionRadius: number;
}

/** Get collision radius based on entity type */
function getEntityCollisionRadius(entity: InterpolatedEntity): number {
  const snapshot = entity.snapshot as any;
  const entityType = snapshot.entityType;

  // EntityType.CHAMPION = 0
  if (entityType === 0) {
    return 25; // Default champion radius
  }

  // EntityType.MINION = 1
  if (entityType === 1) {
    const minionType = snapshot.minionType || "melee";
    switch (minionType) {
      case "melee":
        return 12;
      case "caster":
        return 10;
      case "siege":
        return 18;
      case "super":
        return 22;
      default:
        return 12;
    }
  }

  // EntityType.TOWER = 2
  if (entityType === 2) {
    return 50;
  }

  // EntityType.JUNGLE_CAMP = 5
  if (entityType === 5) {
    return 15; // Default jungle creature radius
  }

  // Default
  return 25;
}

/**
 * OnlineInputHandler captures input and sends commands to server.
 */
/** Charge state for ability being charged */
interface ChargeState {
  slot: AbilitySlot;
  startTime: number;
  minChargeTime: number;
  maxChargeTime: number;
}

export class OnlineInputHandler implements GameObject {
  readonly id = "online-input-handler";
  shouldInitialize = true;
  shouldDispose = false;
  position = new Vector(0, 0);

  private networkClient: NetworkClient;
  private stateManager: OnlineStateManager;
  private localSide: number;
  private inputManager: InputManager;

  /** Currently hovered enemy entity ID */
  private hoveredEnemyId: string | null = null;

  /** Currently hovered ally entity ID */
  private hoveredAllyId: string | null = null;

  /** Currently hovered entity info for rendering */
  private hoveredEntityInfo: HoveredEntityInfo | null = null;

  /** Active move markers */
  private moveMarkers: MoveMarker[] = [];

  /** Animation time tracking */
  private lastUpdateTime = 0;

  /** Current ability being charged (null if none) */
  private chargeState: ChargeState | null = null;

  /** Champion ID for ability lookups */
  private championId: string = "warrior";

  /** Converts minimap clicks to world positions */
  private minimapLocator: ((screenX: number, screenY: number) => Vector | null) | null = null;

  /** Callback for charge state updates (for HUD) */
  private onChargeStateChange: ((state: { slot: AbilitySlot; progress: number } | null) => void) | null = null;

  /** Callback for hover state updates (for EntityRenderer sprite outlines) */
  private onHoverStateChange: ((enemyId: string | null, allyId: string | null) => void) | null = null;

  /** Currently selected entity ID (for target info HUD) */
  private selectedEntityId: string | null = null;

  /** Callback for selection state updates (for TargetInfoHUD) */
  private onSelectionChange: ((entityId: string | null) => void) | null = null;

  constructor(
    networkClient: NetworkClient,
    stateManager: OnlineStateManager,
    localSide: number,
    championId: string = "warrior",
  ) {
    this.networkClient = networkClient;
    this.stateManager = stateManager;
    this.localSide = localSide;
    this.championId = championId;
    this.inputManager = InputManager.getInstance();
  }

  /**
   * Set the champion ID for ability lookups.
   */
  setChampionId(championId: string): void {
    this.championId = championId;
  }

  /**
   * Set how to turn a screen position over the minimap into a world position
   * (returns null when the position isn't over the minimap).
   */
  setMinimapLocator(locator: (screenX: number, screenY: number) => Vector | null): void {
    this.minimapLocator = locator;
  }

  /**
   * Set callback for charge state updates (for HUD).
   */
  setChargeStateCallback(callback: (state: { slot: AbilitySlot; progress: number } | null) => void): void {
    this.onChargeStateChange = callback;
  }

  /**
   * Set callback for hover state updates (for EntityRenderer sprite outlines).
   */
  setHoverStateCallback(callback: (enemyId: string | null, allyId: string | null) => void): void {
    this.onHoverStateChange = callback;
  }

  /**
   * Set callback for selection state updates (for TargetInfoHUD).
   */
  setSelectionCallback(callback: (entityId: string | null) => void): void {
    this.onSelectionChange = callback;
  }

  /**
   * Get the currently selected entity ID.
   */
  getSelectedEntityId(): string | null {
    return this.selectedEntityId;
  }

  /**
   * Get current charge progress (0-1) for UI display.
   * Returns null if not charging.
   */
  getChargeProgress(): { slot: AbilitySlot; progress: number } | null {
    if (!this.chargeState) return null;
    const elapsed = (performance.now() / 1000) - this.chargeState.startTime;
    const progress = Math.min(1, Math.max(0,
      (elapsed - this.chargeState.minChargeTime) /
      (this.chargeState.maxChargeTime - this.chargeState.minChargeTime)
    ));
    return { slot: this.chargeState.slot, progress };
  }

  /**
   * Check if currently charging an ability.
   */
  isCharging(): boolean {
    return this.chargeState !== null;
  }

  init(_ctx: GameContext): void {
    // Nothing to initialize
  }

  step(ctx: GameContext): void {
    if (ctx.isPaused) return;

    const { camera } = ctx;

    // Update move markers (remove expired ones)
    this.updateMoveMarkers();

    // Update cursor based on hover state
    this.updateHoveredEnemy(camera);

    // Update charge state callback for HUD
    if (this.onChargeStateChange) {
      this.onChargeStateChange(this.getChargeProgress());
    }

    // Clicks on the minimap are about map positions, not what's under the cursor in the world
    const mousePosition = this.inputManager.getMousePosition();
    const minimapTarget = this.minimapLocator?.(mousePosition.x, mousePosition.y) ?? null;

    // Handle right-click movement or attack
    if (this.inputManager.isMouseButtonJustPressed(MouseButton.RIGHT)) {
      const worldPos = minimapTarget ?? this.screenToWorld(mousePosition, camera);

      // If hovering an enemy, send target attack instead of move
      if (this.hoveredEnemyId && !minimapTarget) {
        this.networkClient.sendTargetUnitInput(this.hoveredEnemyId);
      } else {
        this.networkClient.sendMoveInput(worldPos.x, worldPos.y);
        // Spawn move marker at click position
        this.spawnMoveMarker(worldPos);
      }
    }

    // Handle entity selection (left-click when NOT holding A)
    if (
      !minimapTarget &&
      !this.inputManager.isKeyDown("a") &&
      this.inputManager.isMouseButtonJustPressed(MouseButton.LEFT)
    ) {
      this.handleEntitySelection(camera);
    }

    // Handle attack-move (A + left-click, on the map or the minimap)
    if (
      this.inputManager.isKeyDown("a") &&
      this.inputManager.isMouseButtonJustPressed(MouseButton.LEFT)
    ) {
      const worldPos = minimapTarget ?? this.screenToWorld(mousePosition, camera);
      this.networkClient.sendAttackMoveInput(worldPos.x, worldPos.y);
      this.spawnMoveMarker(worldPos, true);
    }

    // Handle stop (S key)
    if (this.inputManager.isKeyJustPressed("s")) {
      this.networkClient.sendStopInput();
    }

    // Handle abilities (Q, W, E, R) or level-up with Ctrl held
    // Note: e.key returns 'Control' (capital C) for the control key
    if (this.inputManager.isKeyDown("Control")) {
      // Ctrl + QWER = Level up ability
      if (this.inputManager.isKeyJustPressed("q")) {
        this.networkClient.sendLevelUpInput("Q");
      }
      if (this.inputManager.isKeyJustPressed("w")) {
        this.networkClient.sendLevelUpInput("W");
      }
      if (this.inputManager.isKeyJustPressed("e")) {
        this.networkClient.sendLevelUpInput("E");
      }
      if (this.inputManager.isKeyJustPressed("r")) {
        this.networkClient.sendLevelUpInput("R");
      }
    } else {
      // Normal ability cast
      this.handleAbilityInput("q", "Q", camera);
      this.handleAbilityInput("w", "W", camera);
      this.handleAbilityInput("e", "E", camera);
      this.handleAbilityInput("r", "R", camera);
    }

    // Handle recall (B key)
    if (this.inputManager.isKeyJustPressed("b")) {
      this.networkClient.sendRecallInput();
    }

    // Summoner spells: D and F, cast at the cursor (on the unit under it, if any)
    for (const [key, slot] of SUMMONER_KEYS) {
      if (!this.inputManager.isKeyJustPressed(key)) continue;
      const at = this.screenToWorld(this.inputManager.getMousePosition(), camera);
      this.networkClient.sendSummonerSpellInput(slot, at.x, at.y, this.hoveredEnemyId ?? undefined);
    }

    // Wards: hold 4 (5 for a control ward) to see where it goes and what it
    // will see (render), release to place it there
    for (const [key, wardType] of WARD_KEYS) {
      if (!this.inputManager.isKeyJustReleased(key)) continue;
      const at = this.wardPlacement(camera);
      if (at) this.networkClient.sendPlaceWardInput(wardType, at.x, at.y);
    }
  }

  /**
   * Handle entity selection on left-click.
   * Selects the closest entity to the click position, or clears selection if clicking empty space.
   */
  private handleEntitySelection(camera: any): void {
    const mouseWorldPos = this.screenToWorld(
      this.inputManager.getMousePosition(),
      camera,
    );

    let closestEntity: InterpolatedEntity | null = null;
    let bestScore = Infinity;

    // Check all entities from state manager
    const entities = this.stateManager.getEntities();
    for (const entity of entities) {
      const snapshot = entity.snapshot;

      // Skip projectiles and zones (not selectable)
      if (snapshot.entityType === 6 || snapshot.entityType === 8) continue;

      // Skip dead entities
      if ("isDead" in snapshot && (snapshot as any).isDead) continue;
      if ("isDestroyed" in snapshot && (snapshot as any).isDestroyed) continue;

      const score = pickScore(mouseWorldPos, entity.position, snapshot as any);
      if (score !== null && score < bestScore) {
        closestEntity = entity;
        bestScore = score;
      }
    }

    const previousSelection = this.selectedEntityId;

    if (closestEntity) {
      // Toggle off if clicking the same entity, otherwise select the new one
      if (this.selectedEntityId === closestEntity.snapshot.entityId) {
        this.selectedEntityId = null;
      } else {
        this.selectedEntityId = closestEntity.snapshot.entityId;
      }
    } else {
      // Clicking empty space clears selection
      this.selectedEntityId = null;
    }

    // Fire callback if selection changed
    if (this.onSelectionChange && this.selectedEntityId !== previousSelection) {
      this.onSelectionChange(this.selectedEntityId);
    }
  }

  /**
   * Update hover detection for enemies and allies, set cursor accordingly.
   */
  private updateHoveredEnemy(camera: any): void {
    const mouseWorldPos = this.screenToWorld(
      this.inputManager.getMousePosition(),
      camera,
    );

    // Each unit can be pointed at anywhere on its drawn body (see picking.ts)
    let closestEnemy: InterpolatedEntity | null = null;
    let closestAlly: InterpolatedEntity | null = null;
    let closestEnemyScore = Infinity;
    let closestAllyScore = Infinity;

    // Check all entities from state manager
    const entities = this.stateManager.getEntities();
    for (const entity of entities) {
      const snapshot = entity.snapshot;

      // Skip entities without side property
      if (!("side" in snapshot)) continue;

      // Skip dead entities
      if ("isDead" in snapshot && (snapshot as any).isDead) continue;
      if ("isDestroyed" in snapshot && (snapshot as any).isDestroyed) continue;

      // Neutral entities (side 2) are always enemies to everyone
      const entitySide = (snapshot as any).side;
      const isNeutral = entitySide === 2;
      const isAlly = !isNeutral && entitySide === this.localSide;
      const score = pickScore(mouseWorldPos, entity.position, snapshot as any);
      if (score === null) continue;

      if (isAlly) {
        // Check ally targetable types (including self for self-cast abilities like Elara heal)
        if (!ALLY_TARGETABLE_ENTITY_TYPES.has(snapshot.entityType)) continue;

        if (score < closestAllyScore) {
          closestAlly = entity;
          closestAllyScore = score;
        }
      } else {
        // Check attackable enemy types
        if (!ATTACKABLE_ENTITY_TYPES.has(snapshot.entityType)) continue;

        if (score < closestEnemyScore) {
          closestEnemy = entity;
          closestEnemyScore = score;
        }
      }
    }

    // Priority: Enemy > Ally (for targeting purposes)
    const cursorManager = getCursorManager();
    const prevEnemyId = this.hoveredEnemyId;
    const prevAllyId = this.hoveredAllyId;

    if (closestEnemy) {
      this.hoveredEnemyId = closestEnemy.snapshot.entityId;
      this.hoveredAllyId = null;
      this.hoveredEntityInfo = {
        position: new Vector(closestEnemy.position.x, closestEnemy.position.y),
        pulseTime: performance.now() / 1000,
        isAlly: false,
        collisionRadius: getEntityCollisionRadius(closestEnemy),
      };
      cursorManager.setCursor("attack");
    } else if (closestAlly) {
      this.hoveredEnemyId = null;
      this.hoveredAllyId = closestAlly.snapshot.entityId;
      this.hoveredEntityInfo = {
        position: new Vector(closestAlly.position.x, closestAlly.position.y),
        pulseTime: performance.now() / 1000,
        isAlly: true,
        collisionRadius: getEntityCollisionRadius(closestAlly),
      };
      // No special cursor for allies, unless A arms an attack-move
      cursorManager.setCursor(this.inputManager.isKeyDown("a") ? "attack" : "default");
    } else {
      this.hoveredEnemyId = null;
      this.hoveredAllyId = null;
      this.hoveredEntityInfo = null;
      // Holding A arms an attack-move
      cursorManager.setCursor(this.inputManager.isKeyDown("a") ? "attack" : "default");
    }

    // Notify EntityRenderer of hover state change for sprite outlines
    if (this.onHoverStateChange &&
        (this.hoveredEnemyId !== prevEnemyId || this.hoveredAllyId !== prevAllyId)) {
      this.onHoverStateChange(this.hoveredEnemyId, this.hoveredAllyId);
    }
  }

  /**
   * Spawn a move marker at the given world position.
   */
  private spawnMoveMarker(position: Vector, attackMove = false): void {
    // Remove any existing markers (only show one at a time)
    this.moveMarkers = [];
    this.moveMarkers.push({
      position: new Vector(position.x, position.y),
      startTime: performance.now() / 1000,
      attackMove,
    });
  }

  /**
   * Update move markers, removing expired ones.
   */
  private updateMoveMarkers(): void {
    const currentTime = performance.now() / 1000;
    this.moveMarkers = this.moveMarkers.filter((marker) => {
      const elapsed = currentTime - marker.startTime;
      return elapsed < MOVE_MARKER_CONFIG.ANIMATION_DURATION;
    });
  }

  /**
   * Handle ability input for a specific slot.
   * Supports both instant-cast and charge abilities.
   */
  private handleAbilityInput(
    key: string,
    slot: AbilitySlot,
    camera: any,
  ): void {
    // Check if this ability has charge behavior
    const abilityDef = this.getAbilityDefinition(slot);
    const isChargeAbility = abilityDef && hasChargeBehavior(abilityDef);

    // Handle charge ability key press (start charging)
    if (isChargeAbility && this.inputManager.isKeyJustPressed(key)) {
      // Start charging
      this.chargeState = {
        slot,
        startTime: performance.now() / 1000,
        minChargeTime: abilityDef.charge!.minChargeTime,
        maxChargeTime: abilityDef.charge!.maxChargeTime,
      };
      return;
    }

    // Handle charge ability key release (fire with charge time)
    if (isChargeAbility && this.chargeState?.slot === slot && this.inputManager.isKeyJustReleased(key)) {
      const worldPos = this.screenToWorld(
        this.inputManager.getMousePosition(),
        camera,
      );

      // Calculate charge time
      const chargeTime = Math.min(
        this.chargeState.maxChargeTime,
        Math.max(
          this.chargeState.minChargeTime,
          (performance.now() / 1000) - this.chargeState.startTime
        )
      );

      // Clear charge state
      this.chargeState = null;

      // Send ability with charge time
      this.sendAbilityWithTarget(slot, worldPos, chargeTime);
      return;
    }

    // Handle instant-cast ability (no charge behavior)
    if (!isChargeAbility && this.inputManager.isKeyJustPressed(key)) {
      const worldPos = this.screenToWorld(
        this.inputManager.getMousePosition(),
        camera,
      );
      this.sendAbilityWithTarget(slot, worldPos);
    }
  }

  /**
   * Get ability definition for a slot.
   */
  private getAbilityDefinition(slot: AbilitySlot) {
    const champDef = getChampionDefinition(this.championId);
    if (!champDef) return null;
    const abilityId = champDef.abilities[slot];
    return getAbilityDefinition(abilityId);
  }

  /**
   * Send ability input with appropriate targeting.
   */
  private sendAbilityWithTarget(
    slot: AbilitySlot,
    worldPos: Vector,
    chargeTime?: number
  ): void {
    // If hovering over an enemy, send as unit-targeted ability
    if (this.hoveredEnemyId) {
      this.networkClient.sendAbilityInput(
        slot,
        "unit",
        worldPos.x,
        worldPos.y,
        this.hoveredEnemyId,
        chargeTime,
      );
    } else if (this.hoveredAllyId) {
      // If hovering over an ally, send as unit-targeted ability
      this.networkClient.sendAbilityInput(
        slot,
        "unit",
        worldPos.x,
        worldPos.y,
        this.hoveredAllyId,
        chargeTime,
      );
    } else {
      // Otherwise send as position-targeted ability
      this.networkClient.sendAbilityInput(
        slot,
        "position",
        worldPos.x,
        worldPos.y,
        undefined,
        chargeTime,
      );
    }
  }

  /**
   * Convert screen coordinates to world coordinates.
   */
  private screenToWorld(screenPos: Vector, camera: any): Vector {
    // Get canvas dimensions
    const canvas = document.querySelector("canvas");
    if (!canvas) return screenPos;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Convert from screen to world coordinates
    const worldX = (screenPos.x - centerX) / camera.zoom + camera.position.x;
    const worldY = (screenPos.y - centerY) / camera.zoom + camera.position.y;

    return new Vector(worldX, worldY);
  }

  /**
   * Render visual feedback: move markers, and the attack range while A is
   * held (entity highlighting is done via sprite outlines).
   */
  render(): RenderElement {
    const element = new RenderElement((ctx: GameContext) => {
      const { canvasRenderingContext } = ctx;

      if (this.inputManager.isKeyDown("a")) {
        this.renderAttackRange(canvasRenderingContext);
      }
      for (const [key, wardType] of WARD_KEYS) {
        if (this.inputManager.isKeyDown(key)) this.renderWardPlacement(canvasRenderingContext, wardType, ctx.camera);
      }

      // Render move markers
      for (const marker of this.moveMarkers) {
        this.renderMoveMarker(canvasRenderingContext, marker);
      }
    }, true);

    element.positionType = "normal";
    element.zIndex = -100; // Render behind entities
    return element;
  }

  /**
   * Where a ward placed now would go: at the cursor, or as far as the
   * placement range reaches toward it (the server does the same, and also
   * keeps it out of walls). Null while the local champion is dead.
   */
  private wardPlacement(camera: any): Vector | null {
    const local = this.stateManager.getLocalPlayerEntity();
    if (!local || (local.snapshot as { isDead?: boolean }).isDead) return null;
    const cursor = this.screenToWorld(this.inputManager.getMousePosition(), camera);
    const offset = cursor.clone().sub(local.position);
    const distance = offset.length();
    const range = GameConfig.VISION.WARD_PLACE_RANGE;
    if (distance <= range) return cursor;
    return local.position.clone().add(offset.scalar(range / distance));
  }

  /**
   * While a ward key is held: the placement range around the local
   * champion, and the ward and what it will see where it would go (dimmed
   * when no ward charge is left).
   */
  private renderWardPlacement(ctx: CanvasRenderingContext2D, wardType: WardType, camera: any): void {
    const local = this.stateManager.getLocalPlayerEntity();
    const at = this.wardPlacement(camera);
    if (!local || !at) return;
    const charges = (local.snapshot as { trinketCharges?: number }).trinketCharges ?? 1;

    ctx.save();
    ctx.beginPath();
    ctx.arc(local.position.x, local.position.y, GameConfig.VISION.WARD_PLACE_RANGE, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(241, 196, 15, 0.05)";
    ctx.fill();
    ctx.strokeStyle = "rgba(241, 196, 15, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    renderWardPreview(ctx, wardType, at.x, at.y, GameConfig.VISION.WARD_SIGHT_RANGE, charges > 0);
  }

  /**
   * Circle around the local champion showing how far its basic attacks
   * reach (attack range is edge to edge, so it's drawn from its edge).
   */
  private renderAttackRange(ctx: CanvasRenderingContext2D): void {
    const local = this.stateManager.getLocalPlayerEntity();
    if (!local) return;
    const snapshot = local.snapshot as { attackRange?: number; isDead?: boolean; championId?: string };
    if (snapshot.isDead) return;
    const attackRange = snapshot.attackRange ??
      (snapshot.championId ? getChampionDefinition(snapshot.championId)?.baseStats.attackRange : undefined) ?? 0;
    const radius = attackRange + getEntityCollisionRadius(local);

    ctx.save();
    ctx.beginPath();
    ctx.arc(local.position.x, local.position.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(231, 76, 60, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(231, 76, 60, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render a move marker: a ring on the ground that closes in on the point,
   * with four arrows converging on it, fading out (red for attack-move).
   */
  private renderMoveMarker(
    ctx: CanvasRenderingContext2D,
    marker: MoveMarker,
  ): void {
    const elapsed = performance.now() / 1000 - marker.startTime;
    const progress = elapsed / MOVE_MARKER_CONFIG.ANIMATION_DURATION;
    if (progress >= 1) return;

    const { START_RADIUS, END_RADIUS, FLATTEN } = MOVE_MARKER_CONFIG;
    const ease = 1 - Math.pow(1 - progress, 2);
    const radius = START_RADIUS + (END_RADIUS - START_RADIUS) * ease;
    const color = marker.attackMove ? MOVE_MARKER_CONFIG.ATTACK_MOVE_COLOR : MOVE_MARKER_CONFIG.MOVE_COLOR;
    const { x, y } = marker.position;

    ctx.save();
    ctx.globalAlpha = 1 - progress * progress;
    ctx.lineWidth = 2;

    // Dark outline under the colored ring so it reads on grass and paths alike
    for (const [stroke, width] of [["rgba(0, 0, 0, 0.55)", 4], [color, 2]] as const) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * FLATTEN, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Four arrowheads pointing in, riding just outside the ring
    const arrowDistance = radius + 6;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const ax = x + Math.cos(angle) * arrowDistance;
      const ay = y + Math.sin(angle) * arrowDistance * FLATTEN;
      const inward = Math.atan2(y - ay, (x - ax) * FLATTEN);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(inward);
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-3, -4);
      ctx.lineTo(-3, 4);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    // A dot on the spot itself
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.5, 2.5 * FLATTEN, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ============================================================================
  // Public getters for hovered entity state (used by EntityRenderer for outlines)
  // ============================================================================

  /**
   * Get the currently hovered enemy entity ID.
   */
  getHoveredEnemyId(): string | null {
    return this.hoveredEnemyId;
  }

  /**
   * Get the currently hovered ally entity ID.
   */
  getHoveredAllyId(): string | null {
    return this.hoveredAllyId;
  }

  /**
   * Check if an entity is currently hovered (enemy or ally).
   */
  isEntityHovered(entityId: string): boolean {
    return this.hoveredEnemyId === entityId || this.hoveredAllyId === entityId;
  }

  /**
   * Get the hover type for an entity (null if not hovered).
   */
  getEntityHoverType(entityId: string): 'enemy' | 'ally' | null {
    if (this.hoveredEnemyId === entityId) return 'enemy';
    if (this.hoveredAllyId === entityId) return 'ally';
    return null;
  }
}

export default OnlineInputHandler;
