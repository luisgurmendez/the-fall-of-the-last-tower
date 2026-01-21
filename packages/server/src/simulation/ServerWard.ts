/**
 * ServerWard - Server-side ward entity.
 *
 * Wards are placeable vision objects that:
 * - Reveal fog of war in an area
 * - Can be stealth (invisible to enemies unless revealed)
 * - Have limited duration or are permanent (control wards)
 * - Can reveal enemy wards (control wards)
 */

import {
  Vector,
  Side,
  EntityType,
  type WardSnapshot,
  type WardType,
} from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

/**
 * Ward definitions with stats.
 */
export const WARD_DEFINITIONS: Record<WardType, {
  duration: number;
  sightRange: number;
  health: number;
  isStealthed: boolean;
  revealsWards: boolean;
}> = {
  stealth: {
    duration: 90, // 90 seconds
    sightRange: 600, // Vision radius
    health: 3,
    isStealthed: true,
    revealsWards: false,
  },
  control: {
    duration: 0, // Permanent until destroyed
    sightRange: 600,
    health: 4,
    isStealthed: false,
    revealsWards: true,
  },
  farsight: {
    duration: 60, // 60 seconds
    sightRange: 350,
    health: 1,
    isStealthed: false,
    revealsWards: false,
  },
};

/**
 * Configuration for creating a ward.
 */
export interface ServerWardConfig extends Omit<ServerEntityConfig, 'entityType'> {
  wardType: WardType;
  ownerId: string;
}

/**
 * Server-side ward entity.
 */
export class ServerWard extends ServerEntity {
  readonly wardType: WardType;
  readonly ownerId: string;

  // Ward properties
  readonly sightRange: number;
  readonly isStealthed: boolean;
  readonly revealsWards: boolean;
  readonly duration: number; // 0 = permanent

  // State
  private placedAt: number = 0;
  private remainingDuration: number = 0;
  private isRevealed: boolean = false; // Set to true when revealed by enemy control ward

  constructor(config: ServerWardConfig) {
    super({
      ...config,
      entityType: EntityType.WARD,
    });

    this.wardType = config.wardType;
    this.ownerId = config.ownerId;

    // Load stats from definition
    const def = WARD_DEFINITIONS[config.wardType];
    this.sightRange = def.sightRange;
    this.isStealthed = def.isStealthed;
    this.revealsWards = def.revealsWards;
    this.duration = def.duration;

    this.health = def.health;
    this.maxHealth = def.health;
    this.remainingDuration = def.duration;
    this.placedAt = Date.now();
  }

  /**
   * Wards don't participate in collision (can walk through them).
   */
  override isCollidable(): boolean {
    return false;
  }

  /**
   * Get ward radius (for targeting).
   */
  override getRadius(): number {
    return 25;
  }

  /**
   * Update ward each tick.
   */
  update(dt: number, context: ServerGameContext): void {
    if (this.isDead) return;

    // Update duration for non-permanent wards
    if (this.duration > 0) {
      this.remainingDuration -= dt;
      if (this.remainingDuration <= 0) {
        this.expire();
        return;
      }
    }

    // Check if revealed by enemy control ward
    this.updateRevealedStatus(context);
  }

  /**
   * Check if this ward is revealed by an enemy control ward.
   */
  private updateRevealedStatus(context: ServerGameContext): void {
    if (!this.isStealthed) {
      this.isRevealed = true;
      return;
    }

    // Check for enemy control wards nearby
    const wards = context.getWards();
    this.isRevealed = false;

    for (const ward of wards) {
      // Skip allied wards and non-control wards
      if (ward.side === this.side) continue;
      if (!ward.revealsWards) continue;
      if (ward.isDead) continue;

      // Check if within reveal range
      const distance = this.position.distanceTo(ward.position);
      if (distance <= ward.sightRange) {
        this.isRevealed = true;
        break;
      }
    }
  }

  /**
   * Check if this ward is visible to a specific side.
   */
  isVisibleTo(viewingSide: Side): boolean {
    // Own team always sees their wards
    if (viewingSide === this.side) return true;

    // Non-stealthed wards are always visible
    if (!this.isStealthed) return true;

    // Stealthed wards only visible if revealed
    return this.isRevealed;
  }

  /**
   * Ward expires after duration.
   */
  private expire(): void {
    this.isDead = true;
    this.health = 0;
    this.markForRemoval();
  }

  /**
   * Called when ward is destroyed by damage.
   */
  protected override onDeath(killerId?: string): void {
    super.onDeath(killerId);
    this.markForRemoval();
  }

  /**
   * Create snapshot for network sync.
   */
  toSnapshot(): WardSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.WARD,
      side: this.side,
      wardType: this.wardType,
      ownerId: this.ownerId,
      x: this.position.x,
      y: this.position.y,
      health: this.health,
      maxHealth: this.maxHealth,
      isDead: this.isDead,
      isStealthed: this.isStealthed,
      revealsWards: this.revealsWards,
      sightRange: this.sightRange,
      remainingDuration: this.remainingDuration,
      placedAt: this.placedAt,
    };
  }
}
