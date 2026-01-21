/**
 * Structure - Base class for all map structures (nexus, towers, etc.)
 *
 * Structures are stationary game objects with health that can be damaged
 * and destroyed. They belong to a specific team/side.
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { WorldEntity } from '@/core/GameObject';
import RenderElement from '@/render/renderElement';
import { IGameUnit, UnitType, UnitSide, DamageType, UnitBaseStats, UnitReward, TeamId } from '@/units/types';
import { ActiveEffect, CrowdControlStatus } from '@/effects/types';

/**
 * Base class for map structures.
 */
export abstract class Structure extends WorldEntity implements IGameUnit {
  // ===================
  // IGameUnit Properties
  // ===================

  abstract readonly unitType: UnitType;

  // ===================
  // Structure Properties
  // ===================

  protected health: number;
  protected maxHealth: number;
  protected armor: number;
  protected magicResist: number;
  protected readonly side: UnitSide;

  /** Whether this structure has been destroyed */
  protected destroyed: boolean = false;

  /**
   * Create a new structure.
   * @param position - World position
   * @param side - Team side (0 = blue, 1 = red)
   * @param maxHealth - Maximum health
   * @param armor - Physical damage reduction
   * @param magicResist - Magic damage reduction
   */
  constructor(
    position: Vector,
    side: UnitSide,
    maxHealth: number,
    armor: number = 0,
    magicResist: number = 0
  ) {
    super(position);
    this.side = side;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.armor = armor;
    this.magicResist = magicResist;
  }

  /**
   * Get the structure's radius for collision/rendering.
   */
  abstract getRadius(): number;

  /**
   * Called when the structure is destroyed.
   */
  protected onDestroyed(gctx: GameContext): void {
    // Override in subclasses for destruction effects
  }

  // ===================
  // IGameUnit Implementation
  // ===================

  getTeamId(): TeamId {
    return this.side;
  }

  getSide(): UnitSide {
    return this.side;
  }

  getSightRange(): number {
    return 1000; // Structures have large sight range
  }

  getPosition(): Vector {
    return this.position.clone();
  }

  setPosition(_pos: Vector): void {
    // Structures don't move
  }

  getDirection(): Vector {
    return new Vector(1, 0); // Structures don't have direction
  }

  isDead(): boolean {
    return this.destroyed;
  }

  getCurrentHealth(): number {
    return this.health;
  }

  getBaseStats(): UnitBaseStats {
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      armor: this.armor,
      magicResist: this.magicResist,
      movementSpeed: 0,
    };
  }

  getReward(): UnitReward {
    return {
      gold: 0,
      experience: 0,
    };
  }

  /**
   * Take damage with resistance calculation.
   */
  takeDamage(rawDamage: number, damageType: DamageType, _source?: IGameUnit): number {
    if (this.destroyed) return 0;

    let finalDamage = rawDamage;

    // Apply resistances
    switch (damageType) {
      case 'physical':
        finalDamage = rawDamage * (100 / (100 + this.armor));
        break;
      case 'magic':
        finalDamage = rawDamage * (100 / (100 + this.magicResist));
        break;
      case 'true':
        // True damage ignores resistances
        break;
    }

    this.health = Math.max(0, this.health - finalDamage);

    return finalDamage;
  }

  heal(amount: number, _source?: IGameUnit): number {
    if (this.destroyed) return 0;

    const oldHealth = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - oldHealth;
  }

  // Structures don't have shields
  addShield(_amount: number, _duration: number, _source?: string): void {}
  getTotalShield(): number { return 0; }

  // Structures don't have immunities
  addImmunity(_type: string): void {}
  removeImmunity(_type: string): void {}
  hasImmunity(_type: string): boolean { return false; }

  // Structures don't have effects
  applyEffect(_effect: ActiveEffect): void {}
  removeEffect(_effectId: string): void {}

  // Structures can't be knocked back
  applyKnockback(_direction: Vector, _distance: number, _duration: number): void {}
  isInForcedMovement(): boolean { return false; }

  getCrowdControlStatus(): CrowdControlStatus {
    return {
      isStunned: false,
      isSilenced: false,
      isGrounded: false,
      canMove: true,
      canAttack: true,
      canCast: true,
      canUseMobilityAbilities: true,
    };
  }

  // ===================
  // WorldEntity Overrides
  // ===================

  override step(gctx: GameContext): void {
    if (this.destroyed) return;

    // Check if destroyed
    if (this.health <= 0) {
      this.destroyed = true;
      this.onDestroyed(gctx);
    }
  }

  abstract override render(): RenderElement;

  /**
   * Check if the structure is destroyed.
   */
  isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Get current health percentage (0-1).
   */
  getHealthPercent(): number {
    return this.health / this.maxHealth;
  }
}

export default Structure;
