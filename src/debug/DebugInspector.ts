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
import type { OnlineStateManager } from '@/core/OnlineStateManager';
import { InputManager, MouseButton } from '@/core/input/InputManager';
import Vector from '@/physics/vector';
import RenderElement from '@/render/renderElement';
import { EntityClickDetector } from './EntityClickDetector';
import { DebugPanel } from './DebugPanel';
import { DEFAULT_DEBUG_CONFIG, type DebugInspectorConfig, type InspectedEntity } from './types';

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

  constructor(stateManager: OnlineStateManager, config: Partial<DebugInspectorConfig> = {}) {
    this.stateManager = stateManager;
    this.config = { ...DEFAULT_DEBUG_CONFIG, ...config };
    this.clickDetector = new EntityClickDetector(stateManager);
    this.panel = new DebugPanel(this.config);
    this.inputManager = InputManager.getInstance();
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
   */
  render(): RenderElement[] {
    const elements: RenderElement[] = [];

    if (!this.config.enabled) return elements;

    // Render entity highlight (in world space)
    const inspected = this.panel.getInspectedEntity();
    if (inspected) {
      const highlightElement = new RenderElement((ctx: GameContext) => {
        this.renderEntityHighlight(ctx.canvasRenderingContext, inspected);
      }, true);
      highlightElement.positionType = 'normal';
      highlightElement.zIndex = 0; // Render below entities
      elements.push(highlightElement);
    }

    // Render debug panel (in screen space)
    const panelElement = new RenderElement((ctx: GameContext) => {
      this.panel.render(ctx.canvasRenderingContext);
    }, true);
    panelElement.positionType = 'overlay';
    elements.push(panelElement);

    // Render debug mode indicator
    const indicatorElement = new RenderElement((ctx: GameContext) => {
      this.renderDebugIndicator(ctx.canvasRenderingContext, ctx.canvasRenderingContext.canvas);
    }, true);
    indicatorElement.positionType = 'overlay';
    elements.push(indicatorElement);

    return elements;
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
    const x = canvas.width - metrics.width - padding * 2 - 10;
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
