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
import type {
  OnlineStateManager,
  InterpolatedEntity,
} from "@/core/OnlineStateManager";
import { getCursorManager } from "@/core/CursorManager";
import RenderElement from "@/render/renderElement";
import PixelArtDrawUtils from "@/utils/pixelartDrawUtils";

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

/** Move marker sprite configuration */
const MOVE_MARKER_CONFIG = {
  SPRITE_PATH: "/assets/sprites/Move_To.png",
  FRAME_COUNT: 6,
  FRAME_WIDTH: 64,
  FRAME_HEIGHT: 64,
  ANIMATION_DURATION: 0.5, // seconds
  SCALE: 0.75,
};

/** Cached move marker sprite */
let moveMarkerSprite: HTMLImageElement | null = null;
let moveMarkerLoaded = false;

/** Load move marker sprite */
function loadMoveMarkerSprite(): void {
  if (moveMarkerLoaded) return;
  moveMarkerSprite = new Image();
  moveMarkerSprite.src = MOVE_MARKER_CONFIG.SPRITE_PATH;
  moveMarkerLoaded = true;
}

/** Active move marker instance */
interface MoveMarker {
  position: Vector;
  startTime: number;
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

  constructor(
    networkClient: NetworkClient,
    stateManager: OnlineStateManager,
    localSide: number,
  ) {
    this.networkClient = networkClient;
    this.stateManager = stateManager;
    this.localSide = localSide;
    this.inputManager = InputManager.getInstance();
    loadMoveMarkerSprite();
  }

  init(ctx: GameContext): void {
    // Nothing to initialize
  }

  step(ctx: GameContext): void {
    if (ctx.isPaused) return;

    const { camera } = ctx;

    // Update move markers (remove expired ones)
    this.updateMoveMarkers();

    // Update cursor based on hover state
    this.updateHoveredEnemy(camera);

    // Handle right-click movement or attack
    if (this.inputManager.isMouseButtonJustPressed(MouseButton.RIGHT)) {
      const worldPos = this.screenToWorld(
        this.inputManager.getMousePosition(),
        camera,
      );

      // If hovering an enemy, send target attack instead of move
      if (this.hoveredEnemyId) {
        this.networkClient.sendTargetUnitInput(this.hoveredEnemyId);
      } else {
        this.networkClient.sendMoveInput(worldPos.x, worldPos.y);
        // Spawn move marker at click position
        this.spawnMoveMarker(worldPos);
      }
    }

    // Handle attack-move (A + left-click)
    if (
      this.inputManager.isKeyDown("a") &&
      this.inputManager.isMouseButtonJustPressed(MouseButton.LEFT)
    ) {
      const worldPos = this.screenToWorld(
        this.inputManager.getMousePosition(),
        camera,
      );
      this.networkClient.sendAttackMoveInput(worldPos.x, worldPos.y);
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
        console.log("[OnlineInputHandler] Ctrl+Q pressed - sending level up Q");
        this.networkClient.sendLevelUpInput("Q");
      }
      if (this.inputManager.isKeyJustPressed("w")) {
        console.log("[OnlineInputHandler] Ctrl+W pressed - sending level up W");
        this.networkClient.sendLevelUpInput("W");
      }
      if (this.inputManager.isKeyJustPressed("e")) {
        console.log("[OnlineInputHandler] Ctrl+E pressed - sending level up E");
        this.networkClient.sendLevelUpInput("E");
      }
      if (this.inputManager.isKeyJustPressed("r")) {
        console.log("[OnlineInputHandler] Ctrl+R pressed - sending level up R");
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

    // Handle ward placement (4 key - like League of Legends trinket)
    if (this.inputManager.isKeyJustPressed("4")) {
      const worldPos = this.screenToWorld(
        this.inputManager.getMousePosition(),
        camera,
      );
      // Default to stealth ward for now (yellow trinket equivalent)
      this.networkClient.sendPlaceWardInput("stealth", worldPos.x, worldPos.y);
    }

    // Handle control ward placement (5 key)
    if (this.inputManager.isKeyJustPressed("5")) {
      const worldPos = this.screenToWorld(
        this.inputManager.getMousePosition(),
        camera,
      );
      this.networkClient.sendPlaceWardInput("control", worldPos.x, worldPos.y);
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

    const hitRadius = 30; // How close mouse needs to be to target
    let closestEnemy: InterpolatedEntity | null = null;
    let closestAlly: InterpolatedEntity | null = null;
    let closestEnemyDistance = hitRadius;
    let closestAllyDistance = hitRadius;

    // Get local player entity for self-targeting detection
    const localPlayer = this.stateManager.getLocalPlayerEntity();
    const localPlayerId = localPlayer?.snapshot.entityId;

    // Check all entities from state manager
    const entities = this.stateManager.getEntities();
    for (const entity of entities) {
      const snapshot = entity.snapshot;

      // Skip entities without side property
      if (!("side" in snapshot)) continue;

      // Skip dead entities
      if ("isDead" in snapshot && (snapshot as any).isDead) continue;
      if ("isDestroyed" in snapshot && (snapshot as any).isDestroyed) continue;

      const isAlly = (snapshot as any).side === this.localSide;
      const distance = mouseWorldPos.distanceTo(entity.position);

      if (isAlly) {
        // Check ally targetable types (including self for self-cast abilities like Elara heal)
        if (!ALLY_TARGETABLE_ENTITY_TYPES.has(snapshot.entityType)) continue;

        if (distance < closestAllyDistance) {
          closestAlly = entity;
          closestAllyDistance = distance;
        }
      } else {
        // Check attackable enemy types
        if (!ATTACKABLE_ENTITY_TYPES.has(snapshot.entityType)) continue;

        if (distance < closestEnemyDistance) {
          closestEnemy = entity;
          closestEnemyDistance = distance;
        }
      }
    }

    // Priority: Enemy > Ally (for targeting purposes)
    const cursorManager = getCursorManager();
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
      cursorManager.setCursor("default"); // No special cursor for allies
    } else {
      this.hoveredEnemyId = null;
      this.hoveredAllyId = null;
      this.hoveredEntityInfo = null;
      cursorManager.setCursor("default");
    }
  }

  /**
   * Spawn a move marker at the given world position.
   */
  private spawnMoveMarker(position: Vector): void {
    // Remove any existing markers (only show one at a time)
    this.moveMarkers = [];
    this.moveMarkers.push({
      position: new Vector(position.x, position.y),
      startTime: performance.now() / 1000,
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
   */
  private handleAbilityInput(
    key: string,
    slot: AbilitySlot,
    camera: any,
  ): void {
    if (this.inputManager.isKeyJustPressed(key)) {
      const worldPos = this.screenToWorld(
        this.inputManager.getMousePosition(),
        camera,
      );

      // If hovering over an enemy, send as unit-targeted ability
      // This allows target_enemy abilities (like Warrior R) to work
      if (this.hoveredEnemyId) {
        this.networkClient.sendAbilityInput(
          slot,
          "unit",
          worldPos.x,
          worldPos.y,
          this.hoveredEnemyId,
        );
      } else if (this.hoveredAllyId) {
        // If hovering over an ally, send as unit-targeted ability
        // This allows target_ally abilities (like Elara Q/W) to work
        this.networkClient.sendAbilityInput(
          slot,
          "unit",
          worldPos.x,
          worldPos.y,
          this.hoveredAllyId,
        );
      } else {
        // Otherwise send as position-targeted ability
        this.networkClient.sendAbilityInput(
          slot,
          "position",
          worldPos.x,
          worldPos.y,
        );
      }
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
   * Render visual feedback (entity hover ellipse, move markers).
   */
  render(): RenderElement {
    const element = new RenderElement((ctx: GameContext) => {
      const { canvasRenderingContext } = ctx;

      // Render hovered entity ellipse (enemy=red, ally=green)
      if (this.hoveredEntityInfo) {
        this.renderHoveredEntityEllipse(
          canvasRenderingContext,
          this.hoveredEntityInfo,
        );
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
   * Render a pulsing ellipse under the hovered entity.
   * Red for enemies, green for allies.
   */
  private renderHoveredEntityEllipse(
    ctx: CanvasRenderingContext2D,
    info: HoveredEntityInfo,
  ): void {
    const currentTime = performance.now() / 1000;
    const pulsePhase = (currentTime - info.pulseTime) * 4; // 4 Hz pulse
    const pulseScale = 1 + Math.sin(pulsePhase) * 0.15; // Subtle pulse

    // rx matches the collision radius, ry is fixed at 10
    const rx = info.collisionRadius * pulseScale;
    const ry = 5 * pulseScale;

    // Position just below the collision mask
    const yOffset = info.collisionRadius;

    ctx.save();
    ctx.translate(info.position.x, info.position.y + yOffset);

    // Draw pixelated ellipse - red for enemies, green for allies
    const color = info.isAlly
      ? "rgba(50, 200, 50, 0.6)"
      : "rgba(220, 50, 50, 0.6)";
    const drawUtils = new PixelArtDrawUtils(ctx, color, 3);
    drawUtils.drawPixelatedEllipse(0, 0, rx, ry);

    ctx.restore();
  }

  /**
   * Render a move marker sprite at the given position.
   */
  private renderMoveMarker(
    ctx: CanvasRenderingContext2D,
    marker: MoveMarker,
  ): void {
    if (
      !moveMarkerSprite ||
      !moveMarkerSprite.complete ||
      moveMarkerSprite.naturalWidth === 0
    ) {
      return;
    }

    const currentTime = performance.now() / 1000;
    const elapsed = currentTime - marker.startTime;
    const progress = elapsed / MOVE_MARKER_CONFIG.ANIMATION_DURATION;

    if (progress >= 1) return;

    // Calculate frame index
    const frameIndex = Math.min(
      Math.floor(progress * MOVE_MARKER_CONFIG.FRAME_COUNT),
      MOVE_MARKER_CONFIG.FRAME_COUNT - 1,
    );

    // Fade out as animation progresses
    const alpha = 1 - progress * 0.5;

    const { FRAME_WIDTH, FRAME_HEIGHT, SCALE } = MOVE_MARKER_CONFIG;
    const scaledWidth = FRAME_WIDTH * SCALE;
    const scaledHeight = FRAME_HEIGHT * SCALE;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      moveMarkerSprite,
      frameIndex * FRAME_WIDTH,
      0,
      FRAME_WIDTH,
      FRAME_HEIGHT,
      marker.position.x - scaledWidth / 2,
      marker.position.y - scaledHeight / 2,
      scaledWidth,
      scaledHeight,
    );
    ctx.restore();
  }
}

export default OnlineInputHandler;
