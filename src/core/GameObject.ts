/**
 * GameObject - Base interface and classes for all game entities.
 *
 * The game object system uses composition over inheritance:
 * - Objects implement behaviors they need (Stepable, Renderable, etc.)
 * - Level checks for behaviors with type guards
 * - Different base classes for different types of objects
 *
 * Hierarchy:
 * - GameObject (interface) - What Level expects from any object
 * - WorldEntity (class) - Objects with world position (units, projectiles)
 * - ScreenEntity (class) - UI objects without position (HUD elements)
 * - LogicEntity (class) - Controllers with no rendering
 */

import Vector from "@/physics/vector";
import type GameContext from "@/core/gameContext";
import RenderElement, { NoRender } from "@/render/renderElement";
import RandomUtils from "@/utils/random";

// ===================
// Core Interface
// ===================

/**
 * Base interface for all game objects.
 * Level uses duck typing - objects only need the methods they use.
 */
export interface GameObject {
  /** Unique identifier */
  id: string;
}

// ===================
// Behavior Interfaces (re-exported for convenience)
// ===================

export type { Stepable } from "@/behaviors/stepable";
export { isStepable } from "@/behaviors/stepable";
export type { Renderable } from "@/behaviors/renderable";
export { isRenderable } from "@/behaviors/renderable";
export type { Disposable } from "@/behaviors/disposable";
export { isDisposable } from "@/behaviors/disposable";
export type { Initializable } from "@/behaviors/initializable";
export { isInitializable } from "@/behaviors/initializable";

// ===================
// World Entity
// ===================

/**
 * A game object that exists in world space.
 * Has a position, can be rendered with camera transform.
 *
 * Use for: Units, projectiles, particles, areas of effect
 */
export class WorldEntity implements GameObject {
  readonly id: string;

  /** Position in world coordinates */
  position: Vector;

  constructor(position: Vector = new Vector(), id?: string) {
    this.id = id ?? RandomUtils.generateId();
    this.position = position.clone();
  }

  /**
   * Update each frame. Override in subclasses.
   */
  step(gctx: GameContext): void {
    // Override in subclass
  }

  /**
   * Render the entity. Override in subclasses.
   * Return RenderElement with isWorldSpace = true for camera transform.
   */
  render(): RenderElement {
    return new NoRender();
  }
}

// ===================
// Screen Entity
// ===================

/**
 * A game object that renders in screen space (UI overlay).
 * No world position - renders directly to screen coordinates.
 *
 * Use for: HUD, ability bars, health bars, notifications
 */
export class ScreenEntity implements GameObject {
  readonly id: string;

  constructor(id?: string) {
    this.id = id ?? RandomUtils.generateId();
  }

  /**
   * Update each frame. Override in subclasses.
   */
  step(gctx: GameContext): void {
    // Override in subclass
  }

  /**
   * Render the UI element. Override in subclasses.
   * Return RenderElement with positionType = "overlay".
   */
  render(): RenderElement {
    return new NoRender();
  }

  /**
   * Helper to create an overlay render element.
   */
  protected createOverlayRender(
    renderFn: (gctx: GameContext) => void
  ): RenderElement {
    const el = new RenderElement(renderFn);
    el.positionType = "overlay";
    return el;
  }
}

// ===================
// Logic Entity
// ===================

/**
 * A game object that only contains logic, no rendering.
 *
 * Use for: Controllers, managers, timers, game rules
 */
export class LogicEntity implements GameObject {
  readonly id: string;

  constructor(id?: string) {
    this.id = id ?? RandomUtils.generateId();
  }

  /**
   * Update each frame. Override in subclasses.
   */
  step(gctx: GameContext): void {
    // Override in subclass
  }

  /**
   * Logic entities don't render by default.
   */
  render(): RenderElement {
    return new NoRender();
  }
}

// ===================
// Type Guards
// ===================

/**
 * Check if an object is a WorldEntity (has position).
 */
export function isWorldEntity(obj: unknown): obj is WorldEntity {
  return obj instanceof WorldEntity;
}

/**
 * Check if an object has a position property.
 */
export function hasPosition(obj: unknown): obj is { position: Vector } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "position" in obj &&
    (obj as any).position instanceof Vector
  );
}

// ===================
// Legacy Compatibility
// ===================

/**
 * @deprecated Use WorldEntity instead.
 * Alias for backwards compatibility during migration.
 */
export const BaseObject = WorldEntity;
export default WorldEntity;
