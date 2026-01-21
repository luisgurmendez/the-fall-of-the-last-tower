/**
 * DebugInspector - Main debug system for inspecting entities.
 *
 * Coordinates:
 * - Entity click detection
 * - Debug panel rendering
 * - Keyboard shortcuts for toggling debug mode
 *
 * Usage:
 * - Press F3 to toggle debug mode
 * - Click on an entity to inspect it
 * - Press ESC or click close button to clear selection
 * - Scroll to navigate long property lists
 */

import type { GameObject } from '@/core/GameObject';
import type GameContext from '@/core/gameContext';
import type { OnlineStateManager, InterpolatedEntity } from '@/core/OnlineStateManager';
import { InputManager, MouseButton } from '@/core/input/InputManager';
import Vector from '@/physics/vector';
import RenderElement from '@/render/renderElement';
import { EntityClickDetector } from './EntityClickDetector';
import { DebugPanel } from './DebugPanel';
import { DEFAULT_DEBUG_CONFIG, type DebugInspectorConfig, type InspectedEntity } from './types';
import { EntityType, MOBAConfig, calculateIndividualBushPositions } from '@siege/shared';
import type { BushManager } from '@/vision';

/**
 * DebugInspector coordinates the debug system.
 */
export class DebugInspector implements GameObject {
  readonly id = 'debug-inspector';
  shouldInitialize = true;
  shouldDispose = false;
  position = new Vector(0, 0);

  private stateManager: OnlineStateManager;
  private config: DebugInspectorConfig;
  private clickDetector: EntityClickDetector;
  private panel: DebugPanel;
  private inputManager: InputManager;

  // Event listeners
  private keyListener: ((e: KeyboardEvent) => void) | null = null;
  private wheelListener: ((e: WheelEvent) => void) | null = null;
  private mouseMoveListener: ((e: MouseEvent) => void) | null = null;

  // Highlight for selected entity
  private highlightPulse = 0;

  // Bush manager for rendering bush collision masks
  private bushManager: BushManager | null = null;

  constructor(stateManager: OnlineStateManager, config: Partial<DebugInspectorConfig> = {}) {
    this.stateManager = stateManager;
    this.config = { ...DEFAULT_DEBUG_CONFIG, ...config };
    this.clickDetector = new EntityClickDetector(stateManager);
    this.panel = new DebugPanel(this.config);
    this.inputManager = InputManager.getInstance();
  }

  /**
   * Set the bush manager for rendering bush collision masks.
   */
  setBushManager(bushManager: BushManager): void {
    this.bushManager = bushManager;
  }

  init(ctx: GameContext): void {
    // Set up keyboard listener for toggle and escape
    this.keyListener = (e: KeyboardEvent) => {
      // F3 toggles debug mode
      if (e.key === 'F3') {
        e.preventDefault();
        this.config.enabled = !this.config.enabled;
        console.log(`[DebugInspector] Debug mode ${this.config.enabled ? 'ENABLED' : 'DISABLED'} (F3 to toggle)`);

        if (!this.config.enabled) {
          this.panel.clearInspection();
        }
      }

      // Escape clears selection
      if (e.key === 'Escape' && this.config.enabled && this.panel.getInspectedEntity()) {
        this.panel.clearInspection();
      }
    };
    window.addEventListener('keydown', this.keyListener);

    // Set up wheel listener for scrolling the panel
    this.wheelListener = (e: WheelEvent) => {
      if (!this.config.enabled) return;

      // Check if mouse is over panel
      const mousePos = new Vector(e.clientX, e.clientY);
      if (this.panel.isPointInPanel(mousePos.x, mousePos.y)) {
        e.preventDefault();
        this.panel.handleScroll(e.deltaY);
      }
    };
    window.addEventListener('wheel', this.wheelListener, { passive: false });

    // Set up mouse move listener for hover states
    this.mouseMoveListener = (e: MouseEvent) => {
      if (!this.config.enabled) return;
      this.panel.updateHoverState(e.clientX, e.clientY);
    };
    window.addEventListener('mousemove', this.mouseMoveListener);
  }

  step(ctx: GameContext): void {
    if (!this.config.enabled) return;

    // Update highlight animation
    this.highlightPulse += ctx.dt * 3;

    const { camera } = ctx;

    // Handle left click for entity selection
    if (this.inputManager.isMouseButtonJustPressed(MouseButton.LEFT)) {
      const mousePos = this.inputManager.getMousePosition();

      // Check if clicking on close button
      if (this.panel.isPointOnCloseButton(mousePos.x, mousePos.y)) {
        this.panel.clearInspection();
        return;
      }

      // Check if clicking inside panel (don't detect entities through panel)
      if (this.panel.isPointInPanel(mousePos.x, mousePos.y)) {
        return;
      }

      // Detect entity at click position
      const entity = this.clickDetector.detectEntityAtScreenPosition(mousePos, camera);
      if (entity) {
        this.panel.setInspectedEntity(entity);
        console.log(`[DebugInspector] Inspecting ${entity.entityTypeName} (${entity.entityId})`);
      }
    }

    // Update inspected entity data if it still exists
    const inspected = this.panel.getInspectedEntity();
    if (inspected) {
      this.updateInspectedEntity(inspected);
    }
  }

  /**
   * Update the inspected entity with latest data from state manager.
   */
  private updateInspectedEntity(inspected: InspectedEntity): void {
    const entity = this.stateManager.getEntity(inspected.entityId);

    if (!entity) {
      // Entity no longer exists - keep showing last known state
      return;
    }

    // Update position and snapshot
    inspected.position = entity.position.clone();
    inspected.snapshot = entity.snapshot;

    // Re-build the panel with updated data
    this.panel.setInspectedEntity(inspected);
  }

  /**
   * Check if debug mode is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable debug mode.
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.panel.clearInspection();
    }
  }

  /**
   * Get the currently inspected entity.
   */
  getInspectedEntity(): InspectedEntity | null {
    return this.panel.getInspectedEntity();
  }

  /**
   * Render the debug overlay and panel.
   * Returns a parent element with children for different render layers.
   */
  render(): RenderElement {
    // Create a container element that holds all debug render elements
    const containerElement = new RenderElement((ctx: GameContext) => {
      if (!this.config.enabled) return;

      // Render collision masks in world space
      this.renderCollisionMasks(ctx.canvasRenderingContext);

      // Render entity highlight in world space
      const inspected = this.panel.getInspectedEntity();
      if (inspected) {
        this.renderEntityHighlight(ctx.canvasRenderingContext, inspected);
      }
    }, true);
    containerElement.positionType = 'normal';

    // Add overlay elements as children
    const overlayElement = new RenderElement((ctx: GameContext) => {
      if (!this.config.enabled) return;

      // Render debug panel
      this.panel.render(ctx.canvasRenderingContext);

      // Render debug mode indicator
      this.renderDebugIndicator(ctx.canvasRenderingContext, ctx.canvasRenderingContext.canvas);
    }, true);
    overlayElement.positionType = 'overlay';

    containerElement.children = [overlayElement];

    return containerElement;
  }

  /**
   * Render a highlight around the selected entity.
   */
  private renderEntityHighlight(ctx: CanvasRenderingContext2D, inspected: InspectedEntity): void {
    const pos = inspected.position;
    const pulse = Math.sin(this.highlightPulse) * 0.3 + 0.7;
    const radius = 50;

    ctx.save();

    // Outer glow
    ctx.strokeStyle = `rgba(100, 200, 255, ${0.3 * pulse})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius + 10, 0, Math.PI * 2);
    ctx.stroke();

    // Main circle
    ctx.strokeStyle = `rgba(100, 200, 255, ${0.8 * pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.lineDashOffset = -this.highlightPulse * 10;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Corner brackets
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * pulse})`;
    ctx.lineWidth = 2;

    const bracketSize = 15;
    const offset = radius - 5;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(pos.x - offset, pos.y - offset + bracketSize);
    ctx.lineTo(pos.x - offset, pos.y - offset);
    ctx.lineTo(pos.x - offset + bracketSize, pos.y - offset);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(pos.x + offset - bracketSize, pos.y - offset);
    ctx.lineTo(pos.x + offset, pos.y - offset);
    ctx.lineTo(pos.x + offset, pos.y - offset + bracketSize);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(pos.x - offset, pos.y + offset - bracketSize);
    ctx.lineTo(pos.x - offset, pos.y + offset);
    ctx.lineTo(pos.x - offset + bracketSize, pos.y + offset);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(pos.x + offset - bracketSize, pos.y + offset);
    ctx.lineTo(pos.x + offset, pos.y + offset);
    ctx.lineTo(pos.x + offset, pos.y + offset - bracketSize);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render a small indicator that debug mode is enabled.
   */
  private renderDebugIndicator(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    ctx.save();

    const text = 'DEBUG MODE (F3)';
    ctx.font = 'bold 12px "Courier New", monospace';
    const metrics = ctx.measureText(text);
    const padding = 6;
    // Position at top-left to avoid overlap with debug panel on top-right
    const x = 10;
    const y = 10;

    // Background
    ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
    ctx.fillRect(x, y, metrics.width + padding * 2, 20);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + padding, y + 10);

    ctx.restore();
  }

  /**
   * Get sight/vision radius for an entity type.
   */
  private getSightRadius(entity: InterpolatedEntity): number {
    const snapshot = entity.snapshot as any;

    switch (snapshot.entityType) {
      case EntityType.CHAMPION:
        return snapshot.sightRange ?? 800; // Default champion sight range
      case EntityType.MINION:
        return 500; // All minions have 500 sight range
      case EntityType.TOWER:
        return 750; // Tower sight range
      case EntityType.NEXUS:
        return 1000; // Nexus has large sight range
      case EntityType.JUNGLE_CAMP:
        // Jungle creatures have varying sight ranges
        return snapshot.sightRange ?? 200;
      case EntityType.WARD:
        return snapshot.sightRange ?? 600; // Ward sight range
      default:
        return 0; // No vision for projectiles, etc.
    }
  }

  /**
   * Get color for sight radius based on entity type.
   */
  private getSightRadiusColor(entity: InterpolatedEntity): string {
    const snapshot = entity.snapshot as any;

    switch (snapshot.entityType) {
      case EntityType.CHAMPION:
        return snapshot.side === 0 ? 'rgba(52, 152, 219, 0.15)' : 'rgba(231, 76, 60, 0.15)';
      case EntityType.MINION:
        return snapshot.side === 0 ? 'rgba(52, 152, 219, 0.08)' : 'rgba(231, 76, 60, 0.08)';
      case EntityType.TOWER:
        return snapshot.side === 0 ? 'rgba(52, 152, 219, 0.12)' : 'rgba(231, 76, 60, 0.12)';
      case EntityType.NEXUS:
        return snapshot.side === 0 ? 'rgba(52, 152, 219, 0.1)' : 'rgba(231, 76, 60, 0.1)';
      case EntityType.JUNGLE_CAMP:
        return 'rgba(149, 165, 166, 0.1)'; // Neutral gray
      case EntityType.WARD:
        return 'rgba(46, 204, 113, 0.2)'; // Green for wards - more visible
      default:
        return 'rgba(255, 255, 255, 0.1)';
    }
  }

  /**
   * Get collision radius for an entity type.
   */
  private getCollisionRadius(entity: InterpolatedEntity): number {
    const snapshot = entity.snapshot as any;

    switch (snapshot.entityType) {
      case EntityType.CHAMPION:
        return 50; // Standard champion collision radius
      case EntityType.MINION:
        // Melee minions are slightly larger than casters
        return snapshot.minionType === 'melee' ? 36 : 24;
      case EntityType.TOWER:
        return 88; // Tower collision radius
      case EntityType.NEXUS:
        return 120; // Nexus collision radius
      case EntityType.JUNGLE_CAMP:
        // Vary by creature type
        return snapshot.creatureType === 'bear' ? 60 : 40;
      case EntityType.PROJECTILE:
        return 10; // Small projectile collision
      case EntityType.WARD:
        return 15; // Ward collision
      default:
        return 30; // Default
    }
  }

  /**
   * Get color for collision mask based on entity type.
   */
  private getCollisionColor(entity: InterpolatedEntity): string {
    const snapshot = entity.snapshot as any;

    switch (snapshot.entityType) {
      case EntityType.CHAMPION:
        return snapshot.side === 0 ? 'rgba(52, 152, 219, 0.4)' : 'rgba(231, 76, 60, 0.4)';
      case EntityType.MINION:
        return snapshot.side === 0 ? 'rgba(52, 152, 219, 0.3)' : 'rgba(231, 76, 60, 0.3)';
      case EntityType.TOWER:
        return snapshot.side === 0 ? 'rgba(52, 152, 219, 0.5)' : 'rgba(231, 76, 60, 0.5)';
      case EntityType.NEXUS:
        return snapshot.side === 0 ? 'rgba(52, 152, 219, 0.5)' : 'rgba(231, 76, 60, 0.5)';
      case EntityType.JUNGLE_CAMP:
        return 'rgba(149, 165, 166, 0.4)'; // Neutral gray
      case EntityType.PROJECTILE:
        return 'rgba(241, 196, 15, 0.5)'; // Yellow for projectiles
      case EntityType.WARD:
        return 'rgba(46, 204, 113, 0.4)'; // Green for wards
      default:
        return 'rgba(255, 255, 255, 0.3)';
    }
  }

  /**
   * Render collision masks and sight radius for all entities.
   */
  private renderCollisionMasks(ctx: CanvasRenderingContext2D): void {
    const entities = this.stateManager.getEntities();

    // Render bush hitboxes first (behind everything)
    this.renderBushMasks(ctx);

    // First pass: render sight radius circles (behind everything)
    for (const entity of entities) {
      const snapshot = entity.snapshot as any;

      // Skip dead/destroyed entities
      if (snapshot.isDead || snapshot.isDestroyed) continue;

      const pos = entity.position;
      const sightRadius = this.getSightRadius(entity);

      // Only render sight radius if entity has vision
      if (sightRadius > 0) {
        const sightColor = this.getSightRadiusColor(entity);

        ctx.save();

        // Draw sight radius fill
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, sightRadius, 0, Math.PI * 2);
        ctx.fillStyle = sightColor;
        ctx.fill();

        // Draw sight radius border (dashed)
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = sightColor.replace('0.08)', '0.4)').replace('0.1)', '0.4)').replace('0.12)', '0.5)').replace('0.15)', '0.5)').replace('0.2)', '0.6)');
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
      }
    }

    // Second pass: render collision circles (on top of sight radius)
    for (const entity of entities) {
      const snapshot = entity.snapshot as any;

      // Skip dead/destroyed entities
      if (snapshot.isDead || snapshot.isDestroyed) continue;

      const pos = entity.position;
      const radius = this.getCollisionRadius(entity);
      const color = this.getCollisionColor(entity);

      ctx.save();

      // Draw collision circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw border
      ctx.strokeStyle = color.replace('0.3)', '0.8)').replace('0.4)', '0.8)').replace('0.5)', '1)');
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw center point
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Draw entity ID label
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(snapshot.entityId.slice(-6), pos.x, pos.y - radius - 5);

      ctx.restore();
    }
  }

  /**
   * Render bush and bush group collision masks.
   * Shows both:
   * - Server visibility bounds (orange) - what server uses for fog of war (individual bush hitboxes)
   * - Client bush hitboxes (green) - actual rendered bush positions (may differ due to random variance)
   */
  private renderBushMasks(ctx: CanvasRenderingContext2D): void {
    if (!this.bushManager) return;

    const clientBushes = this.bushManager.getBushes();

    // First: render SERVER visibility bounds (individual bush hitboxes from shared function)
    // These are the EXACT hitboxes the server uses for visibility checks
    for (let groupIndex = 0; groupIndex < MOBAConfig.BUSH_GROUPS.length; groupIndex++) {
      const serverBushes = calculateIndividualBushPositions(groupIndex);

      for (const bush of serverBushes) {
        const halfW = bush.width / 2;
        const halfH = bush.height / 2;

        ctx.save();

        // Draw server bush hitbox with orange fill
        ctx.fillStyle = 'rgba(255, 140, 0, 0.2)';
        ctx.fillRect(bush.x - halfW, bush.y - halfH, bush.width, bush.height);

        // Draw border (dashed to distinguish from client)
        ctx.setLineDash([4, 2]);
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bush.x - halfW, bush.y - halfH, bush.width, bush.height);
        ctx.setLineDash([]);

        // Draw center point
        ctx.beginPath();
        ctx.arc(bush.x, bush.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 140, 0, 1)';
        ctx.fill();

        ctx.restore();
      }

      // Draw group label at center of first bush
      if (serverBushes.length > 0) {
        const groupConfig = MOBAConfig.BUSH_GROUPS[groupIndex];
        ctx.save();
        ctx.fillStyle = 'rgba(255, 140, 0, 1)';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Server ${groupIndex}`, groupConfig.center.x, groupConfig.center.y - 40);
        ctx.restore();
      }
    }

    // Second: render CLIENT bush hitboxes (actual rendered positions)
    // These may differ from server due to Math.random() in client placement
    for (const bush of clientBushes) {
      const bounds = bush.getBounds();

      ctx.save();

      // Draw client bush hitbox rectangle
      ctx.fillStyle = 'rgba(34, 139, 34, 0.25)';
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

      // Draw border (solid to distinguish from server)
      ctx.strokeStyle = 'rgba(34, 139, 34, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

      // Draw center point
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 139, 34, 1)';
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Clean up event listeners.
   */
  dispose(): void {
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
    if (this.wheelListener) {
      window.removeEventListener('wheel', this.wheelListener);
      this.wheelListener = null;
    }
    if (this.mouseMoveListener) {
      window.removeEventListener('mousemove', this.mouseMoveListener);
      this.mouseMoveListener = null;
    }
  }
}

export default DebugInspector;
