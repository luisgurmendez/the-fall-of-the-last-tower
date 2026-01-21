/**
 * Trinket - Manages ward placement for a champion.
 *
 * Trinkets:
 * - Have charges that regenerate over time
 * - Have a cooldown between uses
 * - Create wards at specified positions
 */

import Vector from '@/physics/vector';
import { TeamId } from '@/core/Team';
import { TrinketDefinition, TRINKET_DEFINITIONS, WardType } from './types';
import { Ward } from './Ward';
import GameContext from '@/core/gameContext';

/**
 * Trinket state.
 */
export interface TrinketState {
  /** Current number of charges */
  charges: number;
  /** Time until next charge (seconds) */
  rechargeTimer: number;
  /** Cooldown remaining after use (seconds) */
  cooldown: number;
}

/**
 * Trinket manager for ward placement.
 */
export class Trinket {
  private definition: TrinketDefinition;
  private state: TrinketState;
  private teamId: TeamId;

  constructor(trinketId: string, teamId: TeamId) {
    const def = TRINKET_DEFINITIONS[trinketId];
    if (!def) {
      throw new Error(`Unknown trinket: ${trinketId}`);
    }

    this.definition = def;
    this.teamId = teamId;
    this.state = {
      charges: def.maxCharges,
      rechargeTimer: 0,
      cooldown: 0,
    };
  }

  // ===================
  // Update
  // ===================

  /**
   * Update trinket state (call each frame).
   */
  update(dt: number): void {
    // Update cooldown
    if (this.state.cooldown > 0) {
      this.state.cooldown = Math.max(0, this.state.cooldown - dt);
    }

    // Recharge if not at max charges
    if (this.state.charges < this.definition.maxCharges) {
      this.state.rechargeTimer += dt;

      if (this.state.rechargeTimer >= this.definition.rechargeTime) {
        this.state.charges++;
        this.state.rechargeTimer = 0;
      }
    }
  }

  // ===================
  // Ward Placement
  // ===================

  /**
   * Check if can place a ward.
   */
  canPlace(): boolean {
    return this.state.charges > 0 && this.state.cooldown <= 0;
  }

  /**
   * Check if a position is within placement range.
   */
  isInRange(championPosition: Vector, targetPosition: Vector): boolean {
    if (this.definition.placementRange === 0) return true;
    return championPosition.distanceTo(targetPosition) <= this.definition.placementRange;
  }

  /**
   * Place a ward at the specified position.
   * Returns the ward if successful, null otherwise.
   */
  placeWard(position: Vector, gctx: GameContext): Ward | null {
    if (!this.canPlace()) {
      return null;
    }

    // Create the ward
    const ward = new Ward(position, this.teamId, this.definition.wardType);

    // Consume charge and start cooldown
    this.state.charges--;
    this.state.cooldown = this.definition.cooldown;

    // Add to game
    gctx.objects.push(ward);

    return ward;
  }

  /**
   * Try to place a ward, checking range from champion.
   */
  tryPlaceWard(championPosition: Vector, targetPosition: Vector, gctx: GameContext): Ward | null {
    if (!this.canPlace()) {
      return null;
    }

    // Check range
    if (!this.isInRange(championPosition, targetPosition)) {
      // Place at max range in direction of target
      const direction = targetPosition.clone().sub(championPosition).normalize();
      const clampedPosition = championPosition.clone().add(
        direction.scalar(this.definition.placementRange)
      );
      return this.placeWard(clampedPosition, gctx);
    }

    return this.placeWard(targetPosition, gctx);
  }

  // ===================
  // Getters
  // ===================

  /**
   * Get the trinket definition.
   */
  getDefinition(): TrinketDefinition {
    return this.definition;
  }

  /**
   * Get current state.
   */
  getState(): Readonly<TrinketState> {
    return this.state;
  }

  /**
   * Get current charges.
   */
  getCharges(): number {
    return this.state.charges;
  }

  /**
   * Get max charges.
   */
  getMaxCharges(): number {
    return this.definition.maxCharges;
  }

  /**
   * Get recharge progress (0-1).
   */
  getRechargeProgress(): number {
    if (this.state.charges >= this.definition.maxCharges) return 1;
    return this.state.rechargeTimer / this.definition.rechargeTime;
  }

  /**
   * Get cooldown remaining.
   */
  getCooldownRemaining(): number {
    return this.state.cooldown;
  }

  /**
   * Check if on cooldown.
   */
  isOnCooldown(): boolean {
    return this.state.cooldown > 0;
  }

  /**
   * Get the ward type this trinket places.
   */
  getWardType(): WardType {
    return this.definition.wardType;
  }

  /**
   * Get placement range.
   */
  getPlacementRange(): number {
    return this.definition.placementRange;
  }

  // ===================
  // Trinket Swapping
  // ===================

  /**
   * Swap to a different trinket type.
   * Resets charges to 0 when swapping.
   */
  swapTrinket(newTrinketId: string): void {
    const def = TRINKET_DEFINITIONS[newTrinketId];
    if (!def) {
      throw new Error(`Unknown trinket: ${newTrinketId}`);
    }

    this.definition = def;
    this.state = {
      charges: 0, // Start with 0 charges when swapping
      rechargeTimer: 0,
      cooldown: 0,
    };
  }
}

export default Trinket;
