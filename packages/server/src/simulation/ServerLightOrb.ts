/**
 * ServerLightOrb - Lume's Light Orb entity.
 *
 * A persistent entity that orbits Lume and serves as the anchor point
 * for his abilities. The orb has four states:
 *
 * - ORBITING: Circles around Lume at a fixed radius
 * - TRAVELING: Moving to a target position or back to Lume
 * - STATIONED: Fixed at a location for a duration
 * - DESTROYED: Gone, respawning after a timer
 */

import {
  Vector,
  EntityType,
  Side,
  type LightOrbSnapshot,
  type LightOrbState,
} from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import type { ServerChampion } from './ServerChampion';

// =============================================================================
// Configuration (duplicated from shared to avoid circular imports)
// =============================================================================

export const LUME_ORB_CONFIG = {
  orbitRadius: 60,            // Distance from Lume when orbiting
  orbitSpeed: 2.0,            // Radians per second
  travelSpeed: 1200,          // Units per second when traveling
  stationedDuration: 4.0,     // Seconds before auto-returning
  passiveAuraRadius: 300,     // Radius for passive effects
  allySpeedBonus: 0.15,       // 15% movement speed
  enemyDamageAmp: 0.08,       // 8% increased magic damage from Lume
  respawnTime: 60.0,          // Seconds to respawn after R
  qImpactRadius: 150,         // Damage radius on Q arrival
  wPulseRadius: 300,          // W heal/damage radius
  eBlindRadius: 200,          // E blind radius on arrival
  rExplosionRadius: 400,      // R explosion radius
} as const;

// =============================================================================
// Configuration
// =============================================================================

export interface ServerLightOrbConfig extends Omit<ServerEntityConfig, 'entityType'> {
  ownerId: string;
}

// =============================================================================
// ServerLightOrb Class
// =============================================================================

export class ServerLightOrb extends ServerEntity {
  readonly ownerId: string;

  // State machine
  private _state: LightOrbState = 'orbiting';
  private orbitAngle: number = 0;

  // Movement
  private targetPosition: Vector | null = null;
  private isReturningToOwner: boolean = false;

  // Timers
  private stationedTimeRemaining: number = 0;
  private respawnTimeRemaining: number = 0;

  // Callbacks (for ability effects on arrival)
  private onArrivalCallback: (() => void) | null = null;

  constructor(config: ServerLightOrbConfig) {
    super({
      ...config,
      entityType: EntityType.LIGHT_ORB,
    });
    this.ownerId = config.ownerId;
  }

  // =============================================================================
  // State Accessors
  // =============================================================================

  get state(): LightOrbState {
    return this._state;
  }

  get isDestroyed(): boolean {
    return this._state === 'destroyed';
  }

  get isOrbiting(): boolean {
    return this._state === 'orbiting';
  }

  get isStationed(): boolean {
    return this._state === 'stationed';
  }

  get isTraveling(): boolean {
    return this._state === 'traveling';
  }

  // =============================================================================
  // State Transitions
  // =============================================================================

  /**
   * Send the orb to a target position.
   * Transitions from orbiting/stationed to traveling.
   */
  sendTo(position: Vector, onArrival?: () => void): boolean {
    if (this._state === 'destroyed') return false;

    this._state = 'traveling';
    this.targetPosition = position.clone();
    this.isReturningToOwner = false;
    this.stationedTimeRemaining = 0;
    this.onArrivalCallback = onArrival ?? null;

    return true;
  }

  /**
   * Recall the orb back to the owner.
   * Can be called from stationed or traveling states.
   */
  recall(): boolean {
    if (this._state === 'destroyed' || this._state === 'orbiting') return false;

    this._state = 'traveling';
    this.isReturningToOwner = true;
    this.stationedTimeRemaining = 0;
    this.onArrivalCallback = null;

    return true;
  }

  /**
   * Destroy the orb (called by R ability).
   * Starts the respawn timer.
   */
  destroy(): void {
    if (this._state === 'destroyed') return;

    this._state = 'destroyed';
    this.respawnTimeRemaining = LUME_ORB_CONFIG.respawnTime;
    this.stationedTimeRemaining = 0;
    this.targetPosition = null;
    this.onArrivalCallback = null;
  }

  /**
   * Force respawn the orb (e.g., when Lume respawns).
   */
  forceRespawn(): void {
    this._state = 'orbiting';
    this.respawnTimeRemaining = 0;
    this.stationedTimeRemaining = 0;
    this.orbitAngle = 0;
    this.targetPosition = null;
    this.onArrivalCallback = null;
  }

  // =============================================================================
  // Update Loop
  // =============================================================================

  update(dt: number, context: ServerGameContext): void {
    const owner = context.getChampion(this.ownerId);
    if (!owner) {
      // Owner doesn't exist, mark for removal
      this.markForRemoval();
      return;
    }

    // If owner is dead, destroy the orb (it respawns when owner respawns)
    if (owner.isDead && this._state !== 'destroyed') {
      this.destroy();
    }

    switch (this._state) {
      case 'orbiting':
        this.updateOrbiting(dt, owner);
        break;
      case 'traveling':
        this.updateTraveling(dt, owner, context);
        break;
      case 'stationed':
        this.updateStationed(dt, owner);
        break;
      case 'destroyed':
        this.updateDestroyed(dt, owner);
        break;
    }

    // Update passive aura effects (only if not destroyed)
    if (this._state !== 'destroyed') {
      this.updatePassiveEffects(context, owner);
    }
  }

  private updateOrbiting(dt: number, owner: ServerChampion): void {
    // Rotate around owner
    this.orbitAngle += LUME_ORB_CONFIG.orbitSpeed * dt;

    // Normalize angle to [0, 2*PI]
    while (this.orbitAngle >= Math.PI * 2) {
      this.orbitAngle -= Math.PI * 2;
    }

    // Calculate position
    this.position.x = owner.position.x + Math.cos(this.orbitAngle) * LUME_ORB_CONFIG.orbitRadius;
    this.position.y = owner.position.y + Math.sin(this.orbitAngle) * LUME_ORB_CONFIG.orbitRadius;
  }

  private updateTraveling(dt: number, owner: ServerChampion, context: ServerGameContext): void {
    // Determine target
    const target = this.isReturningToOwner
      ? owner.position
      : this.targetPosition;

    if (!target) {
      // No target, return to orbiting
      this._state = 'orbiting';
      return;
    }

    // Calculate direction and distance
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if arrived
    const arrivalThreshold = this.isReturningToOwner ? LUME_ORB_CONFIG.orbitRadius : 5;

    if (distance <= arrivalThreshold) {
      if (this.isReturningToOwner) {
        // Returned to owner - start orbiting
        this._state = 'orbiting';
        this.orbitAngle = Math.atan2(
          this.position.y - owner.position.y,
          this.position.x - owner.position.x
        );
      } else {
        // Arrived at target - become stationed
        this._state = 'stationed';
        this.stationedTimeRemaining = LUME_ORB_CONFIG.stationedDuration;
        this.position.x = target.x;
        this.position.y = target.y;

        // Execute arrival callback (e.g., Q damage)
        if (this.onArrivalCallback) {
          this.onArrivalCallback();
          this.onArrivalCallback = null;
        }
      }
      return;
    }

    // Move toward target
    const moveDistance = LUME_ORB_CONFIG.travelSpeed * dt;
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;

    this.position.x += normalizedDx * moveDistance;
    this.position.y += normalizedDy * moveDistance;
  }

  private updateStationed(dt: number, owner: ServerChampion): void {
    // Decrement stationed timer
    this.stationedTimeRemaining -= dt;

    if (this.stationedTimeRemaining <= 0) {
      // Auto-return to owner
      this._state = 'traveling';
      this.isReturningToOwner = true;
      this.stationedTimeRemaining = 0;
    }
  }

  private updateDestroyed(dt: number, owner: ServerChampion): void {
    // Decrement respawn timer
    this.respawnTimeRemaining -= dt;

    if (this.respawnTimeRemaining <= 0) {
      // Respawn in orbiting state
      this._state = 'orbiting';
      this.respawnTimeRemaining = 0;
      this.orbitAngle = 0;

      // Position at orbit location
      this.position.x = owner.position.x + LUME_ORB_CONFIG.orbitRadius;
      this.position.y = owner.position.y;
    }
  }

  // =============================================================================
  // Passive Aura Effects
  // =============================================================================

  private updatePassiveEffects(context: ServerGameContext, owner: ServerChampion): void {
    const entitiesInRange = context.getEntitiesInRadius(
      this.position,
      LUME_ORB_CONFIG.passiveAuraRadius
    );

    for (const entity of entitiesInRange) {
      // Only affect champions (check entityType instead of instanceof to avoid circular imports)
      if (entity.entityType !== EntityType.CHAMPION) continue;
      if (entity.isDead) continue;
      if (!('applyEffect' in entity)) continue;

      const applyEffect = entity.applyEffect as (id: string, duration: number, sourceId: string) => void;

      if (entity.side === owner.side) {
        // Ally: Apply movement speed buff
        // Effect lasts 0.5s, refreshed each tick while in range
        applyEffect.call(entity, 'lume_guiding_glow_speed', 0.5, this.ownerId);
      } else {
        // Enemy: Apply damage amplification debuff
        applyEffect.call(entity, 'lume_guiding_glow_amp', 0.5, this.ownerId);
      }
    }
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Get the current position of the orb for ability targeting.
   */
  getPosition(): Vector {
    return this.position.clone();
  }

  /**
   * Check if a champion is within the orb's passive aura.
   */
  isInAura(entity: ServerEntity): boolean {
    if (this._state === 'destroyed') return false;
    return this.position.distanceTo(entity.position) <= LUME_ORB_CONFIG.passiveAuraRadius;
  }

  // =============================================================================
  // Collision Interface
  // =============================================================================

  /**
   * Light orb doesn't participate in collision.
   */
  override isCollidable(): boolean {
    return false;
  }

  // =============================================================================
  // Network Serialization
  // =============================================================================

  toSnapshot(): LightOrbSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.LIGHT_ORB,
      side: this.side,
      ownerId: this.ownerId,
      x: this.position.x,
      y: this.position.y,
      state: this._state,
      orbitAngle: this.orbitAngle,
      stationedTimeRemaining: this.stationedTimeRemaining,
      respawnTimeRemaining: this.respawnTimeRemaining,
      auraRadius: LUME_ORB_CONFIG.passiveAuraRadius,
      isDead: this._state === 'destroyed',
    };
  }
}
