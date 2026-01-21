/**
 * Abstract base class for Creatures (jungle monsters).
 *
 * Creatures are wild monsters that:
 * - Give gold and experience when killed
 * - Have a home position they patrol around
 * - Can aggro and attack nearby enemies
 * - Respawn after a certain time
 *
 * Examples: Wolf, Golem, Dragon, etc.
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { Shape, Circle } from '@/objects/shapes';
import RenderElement from '@/render/renderElement';
import Disposable from '@/behaviors/disposable';
import Renderable from '@/behaviors/renderable';
import Stepable from '@/behaviors/stepable';
import { GameUnit, ForcedMovement } from './GameUnit';
import { UnitType, UnitSide, UnitBaseStats, UnitReward, IGameUnit, isGameUnit } from './types';

/**
 * Configuration for a creature type.
 */
export interface CreatureDefinition {
  id: string;
  name: string;
  /** Base stats */
  stats: {
    health: number;
    armor: number;
    magicResist: number;
    attackDamage: number;
    attackSpeed: number;
    attackRange: number;
    movementSpeed: number;
  };
  /** Reward when killed */
  reward: UnitReward;
  /** Time to respawn (seconds) */
  respawnTime: number;
  /** Range at which creature will aggro */
  aggroRange: number;
  /** Range creature will chase before returning */
  leashRange: number;
  /** Collision radius */
  collisionRadius: number;
}

/**
 * Abstract base class for jungle creatures.
 */
export abstract class Creature extends GameUnit implements Disposable, Renderable, Stepable {
  readonly unitType: UnitType = 'creature';

  // ===================
  // Disposable
  // ===================

  shouldDispose: boolean = false;
  dispose?: () => void;

  // ===================
  // Creature Properties
  // ===================

  /** Definition for this creature type */
  protected abstract readonly definition: CreatureDefinition;

  /** Home position (where creature spawns and returns to) */
  protected homePosition: Vector;

  /** Current target to attack */
  protected target: IGameUnit | null = null;

  /** Collision shape */
  collisionMask: Shape;

  /** Attack cooldown */
  protected attackCooldown: number = 0;

  /** Is currently in combat */
  protected inCombat: boolean = false;

  /** Time since last combat action */
  protected timeSinceCombat: number = 0;

  // ===================
  // Constructor
  // ===================

  constructor(position: Vector, side: UnitSide = 1) {
    super(position, side);
    this.homePosition = position.clone();
    this.collisionMask = new Circle(20); // Default, override in subclass
  }

  // ===================
  // Abstract Methods
  // ===================

  /** Initialize the creature */
  abstract init(gctx: GameContext): void;

  /** Render the creature */
  protected abstract renderCreature(gctx: GameContext): void;

  // ===================
  // GameUnit Implementation
  // ===================

  getBaseStats(): UnitBaseStats {
    const def = this.definition;
    return {
      health: this.health,
      maxHealth: def.stats.health,
      armor: def.stats.armor,
      magicResist: def.stats.magicResist,
      movementSpeed: def.stats.movementSpeed,
    };
  }

  getReward(): UnitReward {
    return this.definition.reward;
  }

  protected onDeath(killer?: IGameUnit): void {
    this.shouldDispose = true;
    // Killer gains rewards
    // This would be handled by the game controller
  }

  protected onTakeDamage(damage: number, type: string, source?: IGameUnit): void {
    // Enter combat
    this.inCombat = true;
    this.timeSinceCombat = 0;

    // Aggro the attacker
    if (source && !this.target) {
      this.target = source;
    }
  }

  // ===================
  // Combat
  // ===================

  /**
   * Check if can attack current target.
   */
  protected canAttack(): boolean {
    if (this.attackCooldown > 0) return false;
    if (!this.target || this.target.isDead()) return false;

    const distance = this.position.distanceTo(this.target.getPosition());
    return distance <= this.definition.stats.attackRange;
  }

  /**
   * Perform an attack on target.
   */
  protected performAttack(): void {
    if (!this.target) return;

    const damage = this.definition.stats.attackDamage;
    this.target.takeDamage(damage, 'physical', this);

    // Start cooldown
    this.attackCooldown = 1 / this.definition.stats.attackSpeed;
  }

  // ===================
  // AI
  // ===================

  /**
   * Update target selection.
   */
  protected updateTarget(gctx: GameContext): void {
    // Clear dead targets
    if (this.target && this.target.isDead()) {
      this.target = null;
    }

    // If no target, look for enemies in aggro range
    if (!this.target) {
      const nearbyObjects = gctx.spatialHashing.queryInRange(
        this.position,
        this.definition.aggroRange
      );

      for (const obj of nearbyObjects) {
        // Check if it's a game unit on the other side
        if (isGameUnit(obj)) {
          if (obj.getTeamId() !== this.side && !obj.isDead()) {
            this.target = obj;
            break;
          }
        }
      }
    }

    // Check leash - if too far from home, reset
    const distanceFromHome = this.position.distanceTo(this.homePosition);
    if (distanceFromHome > this.definition.leashRange) {
      this.target = null;
      this.inCombat = false;
    }
  }

  /**
   * Move toward target or return home.
   */
  protected updateMovement(dt: number): void {
    // Handle forced movement first
    if (this.forcedMovement) {
      this.updateForcedMovement(dt);
      return;
    }

    const stats = this.definition.stats;

    if (this.target && !this.target.isDead()) {
      // Move toward target
      const targetPos = this.target.getPosition();
      const distance = this.position.distanceTo(targetPos);

      if (distance > stats.attackRange * 0.8) {
        const direction = targetPos.clone().sub(this.position).normalize();
        this.direction = direction.clone();
        this.velocity = direction.scalar(stats.movementSpeed);
        this.position.add(this.velocity.clone().scalar(dt));
      } else {
        this.velocity = new Vector(0, 0);
      }
    } else if (!this.inCombat) {
      // Return home if out of combat
      const distanceFromHome = this.position.distanceTo(this.homePosition);
      if (distanceFromHome > 20) {
        const direction = this.homePosition.clone().sub(this.position).normalize();
        this.direction = direction.clone();
        this.velocity = direction.scalar(stats.movementSpeed);
        this.position.add(this.velocity.clone().scalar(dt));

        // Regenerate health while returning
        this.heal(this.definition.stats.health * 0.01 * dt);
      } else {
        this.velocity = new Vector(0, 0);
      }
    } else {
      this.velocity = new Vector(0, 0);
    }
  }

  // ===================
  // Update Loop
  // ===================

  step(gctx: GameContext): void {
    if (this._isDead) return;

    const dt = gctx.dt;

    // Update cooldowns
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    // Update combat timer
    if (this.inCombat) {
      this.timeSinceCombat += dt;
      if (this.timeSinceCombat > 5) {
        this.inCombat = false;
        this.target = null;
      }
    }

    // Update shields and effects
    this.updateShields(dt);
    this.updateEffects(dt);

    // AI
    this.updateTarget(gctx);

    // Attack if possible
    if (this.canAttack()) {
      this.performAttack();
    }

    // Movement
    this.updateMovement(dt);
  }

  // ===================
  // Rendering
  // ===================

  render(): RenderElement {
    return new RenderElement((gctx) => {
      this.renderCreature(gctx);
    }, true);
  }
}

export default Creature;
