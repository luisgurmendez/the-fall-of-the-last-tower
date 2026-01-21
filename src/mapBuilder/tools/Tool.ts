/**
 * Tool - Base interface for map builder tools.
 */

import Vector from '@/physics/vector';
import { MapData } from '../MapData';

/**
 * Mouse event data passed to tools.
 */
export interface ToolMouseEvent {
  /** World position of the mouse */
  worldPos: Vector;
  /** Screen position of the mouse */
  screenPos: Vector;
  /** Whether left mouse button is pressed */
  leftButton: boolean;
  /** Whether right mouse button is pressed */
  rightButton: boolean;
  /** Whether this is the first frame the button was pressed */
  justPressed: boolean;
  /** Whether this is the first frame the button was released */
  justReleased: boolean;
  /** Shift key held */
  shiftKey: boolean;
  /** Ctrl key held */
  ctrlKey: boolean;
}

/**
 * Render context for tools.
 */
export interface ToolRenderContext {
  ctx: CanvasRenderingContext2D;
  worldToScreen: (world: Vector) => Vector;
  screenToWorld: (screen: Vector) => Vector;
  zoom: number;
}

/**
 * Tool types.
 */
export type ToolType =
  | 'select'
  | 'terrain'
  | 'wall'
  | 'bush'
  | 'tower'
  | 'nexus'
  | 'lane'
  | 'jungle'
  | 'decoration'
  | 'spawn'
  | 'erase';

/**
 * Base tool interface.
 */
export interface Tool {
  /** Tool identifier */
  readonly type: ToolType;

  /** Display name */
  readonly name: string;

  /** Tool icon (emoji or character) */
  readonly icon: string;

  /** Tool description */
  readonly description: string;

  /**
   * Called when the tool is activated.
   */
  onActivate?(): void;

  /**
   * Called when the tool is deactivated.
   */
  onDeactivate?(): void;

  /**
   * Handle mouse down event.
   */
  onMouseDown?(event: ToolMouseEvent, mapData: MapData): void;

  /**
   * Handle mouse move event.
   */
  onMouseMove?(event: ToolMouseEvent, mapData: MapData): void;

  /**
   * Handle mouse up event.
   */
  onMouseUp?(event: ToolMouseEvent, mapData: MapData): void;

  /**
   * Handle key down event.
   */
  onKeyDown?(key: string, mapData: MapData): void;

  /**
   * Render tool-specific overlay (guides, preview, etc).
   */
  render?(ctx: ToolRenderContext, mapData: MapData): void;

  /**
   * Get the currently selected object (if any).
   */
  getSelectedObject?(): unknown | null;

  /**
   * Clear selection.
   */
  clearSelection?(): void;
}

/**
 * Base class for tools with common functionality.
 */
export abstract class BaseTool implements Tool {
  abstract readonly type: ToolType;
  abstract readonly name: string;
  abstract readonly icon: string;
  abstract readonly description: string;

  /** Grid snap size */
  protected gridSize = 25;

  /** Snap position to grid */
  protected snapToGrid(pos: Vector): Vector {
    return new Vector(
      Math.round(pos.x / this.gridSize) * this.gridSize,
      Math.round(pos.y / this.gridSize) * this.gridSize
    );
  }

  onActivate(): void {}
  onDeactivate(): void {}
}
