/**
 * EntityClickDetector - Detects clicks on entities for debug inspection.
 *
 * When debug mode is enabled, left-clicking on an entity will select it
 * for inspection in the debug panel.
 */

import Vector from '@/physics/vector';
import type { OnlineStateManager, InterpolatedEntity } from '@/core/OnlineStateManager';
import type Camera from '@/core/camera';
import type { InspectedEntity } from './types';
import { getEntityTypeName } from './types';

/**
 * Configuration for click detection.
 */
export interface ClickDetectorConfig {
  /** Radius around click to search for entities */
  hitRadius: number;
  /** Entity types to include (empty = all) */
  includeEntityTypes?: number[];
  /** Entity types to exclude */
  excludeEntityTypes?: number[];
}

const DEFAULT_CONFIG: ClickDetectorConfig = {
  hitRadius: 50,
  excludeEntityTypes: [], // Include all entity types
};

/**
 * EntityClickDetector detects which entity was clicked.
 */
export class EntityClickDetector {
  private stateManager: OnlineStateManager;
  private config: ClickDetectorConfig;

  constructor(stateManager: OnlineStateManager, config: Partial<ClickDetectorConfig> = {}) {
    this.stateManager = stateManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Find the entity at the given screen position.
   * Returns null if no entity is found.
   */
  detectEntityAtScreenPosition(
    screenPos: Vector,
    camera: Camera
  ): InspectedEntity | null {
    const worldPos = this.screenToWorld(screenPos, camera);
    return this.detectEntityAtWorldPosition(worldPos);
  }

  /**
   * Find the entity at the given world position.
   * Returns null if no entity is found.
   */
  detectEntityAtWorldPosition(worldPos: Vector): InspectedEntity | null {
    const entities = this.stateManager.getEntities();

    let closestEntity: InterpolatedEntity | null = null;
    let closestDistance = this.config.hitRadius;

    for (const entity of entities) {
      const snapshot = entity.snapshot;

      // Check entity type filters
      if (this.config.includeEntityTypes && this.config.includeEntityTypes.length > 0) {
        if (!this.config.includeEntityTypes.includes(snapshot.entityType)) {
          continue;
        }
      }

      if (this.config.excludeEntityTypes && this.config.excludeEntityTypes.length > 0) {
        if (this.config.excludeEntityTypes.includes(snapshot.entityType)) {
          continue;
        }
      }

      // Calculate distance
      const distance = worldPos.distanceTo(entity.position);

      if (distance < closestDistance) {
        closestEntity = entity;
        closestDistance = distance;
      }
    }

    if (!closestEntity) {
      return null;
    }

    return {
      entityId: closestEntity.snapshot.entityId,
      entityType: closestEntity.snapshot.entityType,
      entityTypeName: getEntityTypeName(closestEntity.snapshot.entityType),
      position: closestEntity.position.clone(),
      snapshot: closestEntity.snapshot,
      inspectedAt: Date.now(),
    };
  }

  /**
   * Convert screen coordinates to world coordinates.
   */
  private screenToWorld(screenPos: Vector, camera: Camera): Vector {
    const canvas = document.querySelector('canvas');
    if (!canvas) return screenPos;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const worldX = (screenPos.x - centerX) / camera.zoom + camera.position.x;
    const worldY = (screenPos.y - centerY) / camera.zoom + camera.position.y;

    return new Vector(worldX, worldY);
  }

  /**
   * Get the current hit radius.
   */
  getHitRadius(): number {
    return this.config.hitRadius;
  }

  /**
   * Set the hit radius for detection.
   */
  setHitRadius(radius: number): void {
    this.config.hitRadius = radius;
  }
}

export default EntityClickDetector;
