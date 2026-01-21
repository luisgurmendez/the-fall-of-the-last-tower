/**
 * BushGroup - A collection of bushes that share visibility.
 *
 * Units inside any bush of a group can see all other units
 * in any bush of the same group.
 */

import Vector from '@/physics/vector';
import { Bush, BushType } from './Bush';
import { IGameUnit } from '@/units/types';
import { TeamId } from '@/core/Team';

/**
 * Configuration for a bush group.
 */
export interface BushGroupConfig {
  id: string;
  center: Vector;
  bushCount: number;
  spread: 'horizontal' | 'vertical' | 'diagonal' | 'cluster';
  spacing?: number;
  variance?: number;
}

/**
 * A group of bushes that share visibility.
 */
export class BushGroup {
  readonly id: string;
  readonly center: Vector;
  private bushes: Bush[] = [];

  constructor(id: string, center: Vector) {
    this.id = id;
    this.center = center.clone();
  }

  /**
   * Add a bush to this group.
   */
  addBush(bush: Bush): void {
    this.bushes.push(bush);
    bush.setGroup(this);
  }

  /**
   * Get all bushes in this group.
   */
  getBushes(): Bush[] {
    return this.bushes;
  }

  // Debug counter for containsPoint logging
  private static containsPointDebugCounter = 0;

  /**
   * Check if a point is inside any bush in this group.
   */
  containsPoint(point: Vector): boolean {
    const result = this.bushes.some(bush => bush.containsPoint(point));

    // Debug log every 600 checks (about every 10 seconds)
    BushGroup.containsPointDebugCounter++;
    if (BushGroup.containsPointDebugCounter % 600 === 0 && this.bushes.length > 0) {
      // Check distance to first bush for debugging
      const firstBush = this.bushes[0];
      const bounds = firstBush.getBounds();
      const distX = Math.abs(point.x - (bounds.x + bounds.width / 2));
      const distY = Math.abs(point.y - (bounds.y + bounds.height / 2));
      console.log(`[BushGroup] containsPoint for ${this.id}: point(${point.x.toFixed(0)}, ${point.y.toFixed(0)}), bushCenter(${(bounds.x + bounds.width/2).toFixed(0)}, ${(bounds.y + bounds.height/2).toFixed(0)}), dist(${distX.toFixed(0)}, ${distY.toFixed(0)}), result: ${result}`);
    }

    return result;
  }

  /**
   * Check if a unit is inside any bush in this group.
   */
  containsUnit(unit: IGameUnit): boolean {
    return this.bushes.some(bush => bush.containsUnit(unit));
  }

  /**
   * Get all units inside any bush in this group.
   */
  getUnitsInside(): IGameUnit[] {
    const units = new Set<IGameUnit>();
    for (const bush of this.bushes) {
      for (const unit of bush.getUnitsInside()) {
        units.add(unit);
      }
    }
    return Array.from(units);
  }

  /**
   * Check if a specific team has units inside any bush.
   */
  hasTeamInside(teamId: TeamId): boolean {
    return this.bushes.some(bush => bush.hasTeamInside(teamId));
  }

  /**
   * Check if player team has units inside any bush.
   */
  hasPlayerInside(): boolean {
    return this.bushes.some(bush => bush.hasPlayerInside());
  }

  /**
   * Get the combined bounds of all bushes in this group.
   */
  getBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    if (this.bushes.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const bush of this.bushes) {
      const bounds = bush.getBounds();
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    return { minX, minY, maxX, maxY };
  }
}

export default BushGroup;
