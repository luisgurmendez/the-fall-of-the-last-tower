/**
 * ChampionController - Handles player control of a champion.
 *
 * Integrates:
 * - AbilityInputManager for Q/W/E/R casting
 * - AbilityTargetingUI for visual feedback
 * - Movement commands (right-click to move)
 * - Basic attack targeting
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { Champion } from '@/champions/Champion';
import { AbilityInputManager, AbilityTargetingState } from '@/core/input/AbilityInputManager';
import { AbilityTargetingUI } from '@/render/AbilityTargetingUI';
import { InputManager } from '@/core/input/InputManager';
import { WorldEntity } from '@/core/GameObject';
import RenderElement from '@/render/renderElement';
import { Ward } from '@/objects/ward';
import actionLogger from '@/utils/ActionLogger';
import { getShopUI } from '@/ui/shop/ShopUI';
import { ManualTargetingPolicy, DEFAULT_PLAYER_POLICY } from '@/champions/targeting';
import PixelArtDrawUtils from '@/utils/pixelartDrawUtils';
import { IGameUnit, isGameUnit } from '@/units/types';
import { getCursorManager } from '@/core/CursorManager';

/** Move marker sprite configuration */
const MOVE_MARKER_SPRITE = {
  src: '/assets/sprites/Move_To.png',
  frameWidth: 32,
  frameHeight: 32,
  frameCount: 6,
  frameDuration: 0.08, // seconds per frame
};

/**
 * Controller for player-controlled champions.
 * Extends WorldEntity so it can be added to the game's object list.
 * (Uses WorldEntity because it needs to render targeting UI in world space)
 */
export class ChampionController extends WorldEntity {
  private champion: Champion | null = null;
  private abilityInputManager: AbilityInputManager;
  private targetingUI: AbilityTargetingUI;
  private inputManager: InputManager;

  /** Camera info for coordinate conversion */
  private cameraPosition: Vector = new Vector(0, 0);
  private cameraZoom: number = 1;

  /** Movement marker position */
  private moveMarker: Vector | null = null;
  private moveMarkerTime: number = 0;

  /** Ward targeting mode */
  private isWardTargeting: boolean = false;
  private wardPlacementMarker: Vector | null = null;

  /** Enemy hover targeting - can be any game unit (champion, minion, jungle creature) */
  private hoveredEnemy: IGameUnit | null = null;

  /** Move marker sprite */
  private moveMarkerSprite: HTMLImageElement | null = null;
  private moveMarkerSpriteLoaded = false;
  private moveMarkerFrame = 0;
  private moveMarkerFrameTime = 0;

  constructor() {
    super();

    this.abilityInputManager = new AbilityInputManager();
    this.targetingUI = new AbilityTargetingUI();
    this.inputManager = InputManager.getInstance();

    // Connect targeting UI to ability input manager
    this.abilityInputManager.setOnTargetingChange((state) => {
      this.targetingUI.setTargetingState(state);
    });

    // Load move marker sprite
    this.loadMoveMarkerSprite();
  }

  /**
   * Load the move marker sprite image.
   */
  private loadMoveMarkerSprite(): void {
    const img = new Image();
    img.src = MOVE_MARKER_SPRITE.src;
    img.onload = () => {
      this.moveMarkerSprite = img;
      this.moveMarkerSpriteLoaded = true;
    };
  }

  /**
   * Set the champion to control.
   * Automatically sets manual targeting policy for player-controlled champions.
   */
  setChampion(champion: Champion | null): void {
    this.champion = champion;
    this.abilityInputManager.setChampion(champion);
    this.targetingUI.setChampion(champion);

    // Set manual targeting policy for player-controlled champion
    if (champion) {
      champion.setTargetingPolicy(DEFAULT_PLAYER_POLICY);
      getShopUI().setChampion(champion);
    }
  }

  /**
   * Get the controlled champion.
   */
  getChampion(): Champion | null {
    return this.champion;
  }

  /**
   * Update camera position for coordinate conversion.
   */
  updateCamera(position: Vector, zoom: number): void {
    this.cameraPosition = position;
    this.cameraZoom = zoom;
    this.abilityInputManager.updateCamera(position, zoom);
  }

  /**
   * Update the controller each frame.
   */
  override step(gctx: GameContext): void {
    if (!this.champion) return;

    const dt = gctx.dt;

    // Update camera from game context
    this.updateCamera(gctx.camera.position, gctx.camera.zoom);

    // Get nearby champions for targeting
    const nearbyObjects = gctx.spatialHashing.queryInRange(
      this.champion.getPosition(),
      1000
    );
    const nearbyChampions = nearbyObjects.filter(
      (obj): obj is Champion => obj instanceof Champion
    );

    // Update ability input
    this.abilityInputManager.update(nearbyChampions);

    // Handle ward targeting (key '4')
    this.handleWardInput(gctx);

    // Update enemy hover detection
    this.updateHoveredEnemy(gctx, nearbyChampions);

    // Handle space bar to center camera on champion
    this.handleCameraFocus(gctx);

    // Handle 'S' to stop movement
    this.handleStopCommand();

    // Handle 'P' to toggle shop
    this.handleShopInput(gctx);

    // Don't process movement/targeting if shop is open
    const shopUI = getShopUI();
    if (shopUI.isOpen()) {
      return;
    }

    // Handle right-click movement (only when not targeting)
    if (!this.abilityInputManager.isTargeting() && !this.isWardTargeting) {
      this.handleMovementInput(gctx);
    }

    // Update move marker animation
    if (this.moveMarker && this.moveMarkerTime > 0) {
      this.moveMarkerTime -= dt;

      // Update animation frame
      this.moveMarkerFrameTime += dt;
      if (this.moveMarkerFrameTime >= MOVE_MARKER_SPRITE.frameDuration) {
        this.moveMarkerFrameTime = 0;
        this.moveMarkerFrame++;
        // Stop at last frame (don't loop)
        if (this.moveMarkerFrame >= MOVE_MARKER_SPRITE.frameCount) {
          this.moveMarker = null;
          this.moveMarkerFrame = 0;
        }
      }

      if (this.moveMarkerTime <= 0) {
        this.moveMarker = null;
        this.moveMarkerFrame = 0;
      }
    }
  }

  /**
   * Handle right-click movement commands.
   * Uses the champion's targeting policy to determine behavior.
   */
  private handleMovementInput(gctx: GameContext): void {
    if (!this.champion) return;

    if (this.inputManager.isRightMouseJustPressed()) {
      const worldPos = this.inputManager.getMouseWorldPosition(
        this.cameraPosition,
        this.cameraZoom
      );

      // Check if clicking on an enemy (for basic attack targeting)
      const nearbyObjects = gctx.spatialHashing.queryInRange(worldPos, 50);
      let targetEnemy: Champion | null = null;

      for (const obj of nearbyObjects) {
        if (
          obj instanceof Champion &&
          obj.getSide() !== this.champion.getSide() &&
          !obj.isDead()
        ) {
          const distance = worldPos.distanceTo(obj.getPosition());
          if (distance < 30) {
            targetEnemy = obj;
            break;
          }
        }
      }

      if (targetEnemy) {
        // Attack command - use the targeting policy
        this.champion.onAttackCommand(targetEnemy);
        actionLogger.attackCommand(this.champion.id, targetEnemy.id);
      } else {
        // Move command - use the targeting policy
        this.champion.onMoveCommand(worldPos);
        actionLogger.movementCommand(this.champion.id, worldPos.x, worldPos.y);

        // Show move marker
        this.moveMarker = worldPos.clone();
        this.moveMarkerTime = 0.5;
        this.moveMarkerFrame = 0;
        this.moveMarkerFrameTime = 0;
      }
    }
  }

  /**
   * Handle 'S' key to stop all movement and actions.
   */
  private handleStopCommand(): void {
    if (!this.champion) return;

    if (this.inputManager.isKeyJustPressed('s') || this.inputManager.isKeyJustPressed('S')) {
      // Cancel movement and attack target directly (stop always clears everything)
      this.champion.setTargetPosition(null);
      this.champion.setBasicAttackTarget(null);
      // Clear move marker
      this.moveMarker = null;
      this.moveMarkerTime = 0;

      actionLogger.debug('input', 'Stop command issued');
    }
  }

  /**
   * Handle space bar to center camera on champion.
   */
  private handleCameraFocus(gctx: GameContext): void {
    if (!this.champion) return;

    if (this.inputManager.isKeyJustPressed(' ') || this.inputManager.isKeyJustPressed('Space')) {
      // Center camera on champion
      const championPos = this.champion.getPosition();
      gctx.camera.position.x = championPos.x;
      gctx.camera.position.y = championPos.y;
    }
  }

  /**
   * Handle shop input.
   * Note: 'P' key toggle is handled in Game.ts for pause-independent access.
   * Shop update is handled in Level.ts for consistent frame updates.
   */
  private handleShopInput(gctx: GameContext): void {
    // Shop toggle is now handled in Game.ts
    // Shop update is now handled in Level.updateShopUI
    // This method is kept for potential future shop input handling
  }

  /**
   * Handle ward placement input (key '4').
   */
  private handleWardInput(gctx: GameContext): void {
    if (!this.champion) return;

    const trinket = this.champion.getTrinket();
    if (!trinket) return;

    // Press '4' to enter/exit ward targeting mode
    if (this.inputManager.isKeyJustPressed('4')) {
      actionLogger.keyPress('4');
      if (this.isWardTargeting) {
        // Cancel ward targeting
        this.isWardTargeting = false;
        this.wardPlacementMarker = null;
        actionLogger.debug('ward', 'Ward targeting cancelled');
      } else if (trinket.canPlace()) {
        // Enter ward targeting mode
        this.isWardTargeting = true;
        // Cancel any ability targeting
        this.abilityInputManager.cancelTargeting();
        actionLogger.debug('ward', 'Ward targeting started');
      } else {
        actionLogger.debug('ward', 'Cannot place ward - no charges or on cooldown');
      }
    }

    // Cancel with right-click or Escape
    if (this.isWardTargeting) {
      if (this.inputManager.isRightMouseJustPressed() || this.inputManager.isKeyJustPressed('Escape')) {
        this.isWardTargeting = false;
        this.wardPlacementMarker = null;
        return;
      }

      // Update ward placement marker to follow mouse
      this.wardPlacementMarker = this.inputManager.getMouseWorldPosition(
        this.cameraPosition,
        this.cameraZoom
      );

      // Left-click to place ward
      if (this.inputManager.isLeftMouseJustPressed()) {
        const worldPos = this.inputManager.getMouseWorldPosition(
          this.cameraPosition,
          this.cameraZoom
        );

        const ward = this.champion.placeWard(worldPos, gctx);
        if (ward) {
          // Success - exit targeting mode
          this.isWardTargeting = false;
          this.wardPlacementMarker = null;
          actionLogger.wardPlaced(ward.wardType, worldPos.x, worldPos.y);
        } else {
          actionLogger.warn('ward', 'Failed to place ward');
        }
      }
    }
  }

  /**
   * Update hover detection for enemies.
   * Shows a targeting indicator when the mouse is over an attackable enemy.
   * Works with all game units: champions, minions, and jungle creatures.
   */
  private updateHoveredEnemy(gctx: GameContext, nearbyChampions: Champion[]): void {
    if (!this.champion) {
      this.hoveredEnemy = null;
      return;
    }

    // Get mouse position in world coordinates
    const mouseWorldPos = this.inputManager.getMouseWorldPosition(
      this.cameraPosition,
      this.cameraZoom
    );

    // Find enemy under mouse cursor
    this.hoveredEnemy = null;
    const hitRadius = 30; // How close mouse needs to be to target

    // Query all objects near the mouse position
    const nearbyObjects = gctx.spatialHashing.queryInRange(mouseWorldPos, hitRadius);

    for (const obj of nearbyObjects) {
      // Check if it's a targetable game unit
      if (!isGameUnit(obj)) continue;

      // Skip self
      if (obj === this.champion) continue;

      // Skip dead units
      if (obj.isDead()) continue;

      // Skip allies (same team)
      if (obj.getTeamId() === this.champion.getTeamId()) continue;

      // Check distance to mouse
      const distance = mouseWorldPos.distanceTo(obj.getPosition());
      if (distance < hitRadius) {
        this.hoveredEnemy = obj;
        break;
      }
    }

    // Update cursor based on hover state
    const cursorManager = getCursorManager();
    if (this.hoveredEnemy) {
      cursorManager.setCursor('attack');
    } else {
      cursorManager.setCursor('default');
    }
  }

  /**
   * Render controller UI elements.
   */
  override render(): RenderElement {
    return new RenderElement((gctx) => {
      const ctx = gctx.canvasRenderingContext;

      // Render targeting UI
      this.targetingUI.render(ctx);

      // Render enemy hover indicator (pixelated red circle)
      if (this.hoveredEnemy) {
        this.renderHoveredEnemyIndicator(ctx);
      }

      // Render ward targeting UI
      if (this.isWardTargeting && this.wardPlacementMarker && this.champion) {
        this.renderWardTargeting(ctx);
      }

      // Render move marker
      if (this.moveMarker && this.moveMarkerTime > 0) {
        this.renderMoveMarker(ctx);
      }

      // Render selected champion indicator
      if (this.champion) {
        this.renderSelectedIndicator(ctx);
      }
    }, true);
  }

  /**
   * Render the pixelated red circle around a hovered enemy.
   * Indicates the enemy can be targeted for basic attacks or abilities.
   */
  private renderHoveredEnemyIndicator(ctx: CanvasRenderingContext2D): void {
    if (!this.hoveredEnemy) return;

    const pos = this.hoveredEnemy.getPosition();
    const pixelSize = 2; // Match army unit style

    ctx.save();

    // Subtle pulsing animation
    const time = performance.now() / 400; // Slower animation
    const pulse = 1 + 0.03 * Math.sin(time); // Less intense pulse

    // Size similar to army unit style (width/2, height/4 ratio)
    const radiusX = Math.floor(20 * pulse);
    const radiusY = Math.floor(8 * pulse);

    // Draw at feet position (slightly below center)
    const pixelArt = new PixelArtDrawUtils(ctx, 'red', pixelSize);
    pixelArt.drawPixelatedEllipse(pos.x, pos.y + 15, radiusX, radiusY);

    ctx.restore();
  }

  /**
   * Render ward targeting UI.
   */
  private renderWardTargeting(ctx: CanvasRenderingContext2D): void {
    if (!this.wardPlacementMarker || !this.champion) return;

    const trinket = this.champion.getTrinket();
    if (!trinket) return;

    const pos = this.wardPlacementMarker;
    const championPos = this.champion.getPosition();
    const placementRange = trinket.getPlacementRange();

    ctx.save();

    // Draw placement range circle from champion
    if (placementRange > 0) {
      ctx.strokeStyle = 'rgba(68, 255, 68, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(championPos.x, championPos.y, placementRange, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Check if in range
    const inRange = placementRange === 0 || championPos.distanceTo(pos) <= placementRange;
    const color = inRange ? '#44FF44' : '#FF4444';

    // Draw ward sight range preview
    const sightRange = trinket.getDefinition().wardType === 'stealth' ? 400 :
                       trinket.getDefinition().wardType === 'farsight' ? 500 : 350;

    ctx.fillStyle = `${color}22`;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, sightRange, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${color}88`;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();

    // Draw ward placement indicator
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
    ctx.fill();

    // Draw line to placement if out of range
    if (!inRange) {
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(championPos.x, championPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render the move marker.
   */
  private renderMoveMarker(ctx: CanvasRenderingContext2D): void {
    if (!this.moveMarker) return;

    ctx.save();

    if (this.moveMarkerSpriteLoaded && this.moveMarkerSprite) {
      // Draw animated sprite frame
      const frameX = this.moveMarkerFrame * MOVE_MARKER_SPRITE.frameWidth;
      const { frameWidth, frameHeight } = MOVE_MARKER_SPRITE;

      ctx.drawImage(
        this.moveMarkerSprite,
        frameX, 0, frameWidth, frameHeight,  // Source rectangle
        this.moveMarker.x - frameWidth / 2,  // Center horizontally
        this.moveMarker.y - frameHeight / 2, // Center vertically
        frameWidth, frameHeight              // Destination size
      );
    }

    ctx.restore();
  }

  /**
   * Render the selected champion indicator.
   */
  private renderSelectedIndicator(ctx: CanvasRenderingContext2D): void {
    if (!this.champion) return;

    const pos = this.champion.getPosition();

    ctx.save();

    // Rotating selection circle
    const time = performance.now() / 1000;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.lineDashOffset = -time * 20;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Check if currently targeting an ability.
   */
  isTargeting(): boolean {
    return this.abilityInputManager.isTargeting();
  }

  /**
   * Get current targeting state.
   */
  getTargetingState(): AbilityTargetingState {
    return this.abilityInputManager.getTargetingState();
  }
}

export default ChampionController;
