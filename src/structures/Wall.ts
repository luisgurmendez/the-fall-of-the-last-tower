/**
 * Wall - Impassable terrain that blocks unit movement.
 *
 * Walls:
 * - Block all unit pathfinding
 * - Cannot be passed through
 * - Rendered as gray rectangles
 */

import Vector from '@/physics/vector';
import { WorldEntity } from '@/core/GameObject';
import GameContext from '@/core/gameContext';
import RenderElement from '@/render/renderElement';

/**
 * Configuration for a wall.
 */
export interface WallConfig {
  /** Center position of the wall */
  position: Vector;
  /** Width of the wall */
  width: number;
  /** Height of the wall */
  height: number;
  /** Optional color (default: gray) */
  color?: string;
}

/**
 * Wall - Impassable terrain.
 */
export class Wall extends WorldEntity {
  readonly width: number;
  readonly height: number;
  private color: string;

  constructor(config: WallConfig) {
    super(config.position.clone());
    this.width = config.width;
    this.height = config.height;
    this.color = config.color ?? '#555555';
  }

  /**
   * Get the wall's center position.
   */
  getPosition(): Vector {
    return this.position.clone();
  }

  /**
   * Get wall bounds.
   */
  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.position.x - this.width / 2,
      y: this.position.y - this.height / 2,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Check if a point is inside this wall.
   */
  containsPoint(point: Vector): boolean {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    return (
      point.x >= this.position.x - halfW &&
      point.x <= this.position.x + halfW &&
      point.y >= this.position.y - halfH &&
      point.y <= this.position.y + halfH
    );
  }

  override step(_gctx: GameContext): void {
    // Walls don't update
  }

  override render(): RenderElement {
    // Walls are now rendered by the background tilemap with cliff tiles
    // This render method is kept empty for collision/logic purposes
    return new RenderElement(() => {}, true);
  }
}

export default Wall;
