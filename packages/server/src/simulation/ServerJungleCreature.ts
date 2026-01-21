/**
 * ServerJungleCreature - Server-side jungle creature entity.
 *
 * Handles:
 * - Aggro behavior when champions enter sight range
 * - Leash behavior (returning home if pulled too far)
 * - Combat with attacking champions
 * - Gold/XP rewards on death
 */

import {
  Vector,
  EntityType,
  MOBAConfig,
  GameEventType,
  type JungleCreatureSnapshot,
  type DamageType,
} from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import { RewardSystem } from '../systems/RewardSystem';

type JungleCreatureType = keyof typeof MOBAConfig.JUNGLE.CREATURE_STATS;

/**
 * Configuration for creating a jungle creature.
 */
export interface ServerJungleCreatureConfig extends Omit<ServerEntityConfig, 'entityType' | 'side'> {
  campId: string;
  creatureType: JungleCreatureType;
  homePosition: Vector;
}

/**
 * AI state for jungle creature behavior.
 */
type JungleCreatureState = 'idle' | 'aggro' | 'returning';

/**
 * Server-side jungle creature entity.
 */
export class ServerJungleCreature extends ServerEntity {
  readonly campId: string;
  readonly creatureType: JungleCreatureType;
  readonly homePosition: Vector;

  // Stats from config
  readonly damage: number;
  readonly attackRange: number;
  readonly attackCooldown: number;
  readonly sightRange: number;
  readonly leashRange: number;
  readonly goldReward: number;
  readonly expReward: number;

  // AI state
  private aiState: JungleCreatureState = 'idle';
  private attackTarget: string | null = null;
  private attackCooldownTimer: number = 0;
  private moveTarget: Vector | null = null;

  constructor(config: ServerJungleCreatureConfig) {
    // Jungle creatures are neutral (we'll use side 1 but they attack anyone)
    super({
      ...config,
      entityType: EntityType.JUNGLE_CAMP,
      side: 1, // Neutral - will attack anyone who aggros
    });

    this.campId = config.campId;
    this.creatureType = config.creatureType;
    this.homePosition = config.homePosition.clone();

    // Load stats from config
    const stats = MOBAConfig.JUNGLE.CREATURE_STATS[config.creatureType];
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.damage = stats.damage;
    this.attackRange = stats.attackRange;
    this.attackCooldown = stats.attackCooldown;
    this.movementSpeed = stats.movementSpeed;
    this.sightRange = stats.sightRange;
    this.leashRange = stats.leashRange;
    this.goldReward = stats.goldReward;
    this.expReward = stats.expReward;
  }

  // =====================
  // Collision Interface
  // =====================

  override isCollidable(): boolean {
    return !this.isDead;
  }

  override getRadius(): number {
    // Different sizes based on creature type
    if (this.creatureType === 'gromp' || this.creatureType === 'krug') {
      return 30;
    } else if (this.creatureType === 'dragon' || this.creatureType === 'baron') {
      return 50;
    }
    return 20;
  }

  override getMass(): number {
    // Jungle creatures are heavier than minions
    if (this.creatureType === 'dragon' || this.creatureType === 'baron') {
      return 200;
    }
    return 80;
  }

  /**
   * Update creature each tick.
   */
  update(dt: number, context: ServerGameContext): void {
    if (this.isDead) return;

    // Update cooldowns
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }

    // State machine
    switch (this.aiState) {
      case 'idle':
        this.updateIdle(dt, context);
        break;
      case 'aggro':
        this.updateAggro(dt, context);
        break;
      case 'returning':
        this.updateReturning(dt, context);
        break;
    }

    // Movement
    this.updateMovement(dt);
  }

  /**
   * Idle state - look for champions to aggro.
   */
  private updateIdle(dt: number, context: ServerGameContext): void {
    // Look for nearby champions
    const nearbyChampions = context.getAllChampions().filter(champ => {
      if (champ.isDead) return false;
      const distance = this.position.distanceTo(champ.position);
      return distance <= this.sightRange;
    });

    if (nearbyChampions.length > 0) {
      // Aggro on closest champion
      let closest = nearbyChampions[0];
      let closestDist = this.position.distanceTo(closest.position);
      for (const champ of nearbyChampions) {
        const dist = this.position.distanceTo(champ.position);
        if (dist < closestDist) {
          closest = champ;
          closestDist = dist;
        }
      }
      this.attackTarget = closest.id;
      this.aiState = 'aggro';
    }
  }

  /**
   * Aggro state - chase and attack target.
   */
  private updateAggro(dt: number, context: ServerGameContext): void {
    // Check leash distance
    const distanceFromHome = this.position.distanceTo(this.homePosition);
    if (distanceFromHome > this.leashRange) {
      this.aiState = 'returning';
      this.attackTarget = null;
      this.moveTarget = this.homePosition.clone();
      return;
    }

    // Validate target
    if (this.attackTarget) {
      const target = context.getEntity(this.attackTarget);
      if (!target || target.isDead) {
        this.attackTarget = null;
      }
    }

    // Find new target if needed
    if (!this.attackTarget) {
      const nearbyChampions = context.getAllChampions().filter(champ => {
        if (champ.isDead) return false;
        const distance = this.position.distanceTo(champ.position);
        return distance <= this.sightRange;
      });

      if (nearbyChampions.length === 0) {
        // No targets, return home
        this.aiState = 'returning';
        this.moveTarget = this.homePosition.clone();
        return;
      }

      // Target closest
      let closest = nearbyChampions[0];
      let closestDist = this.position.distanceTo(closest.position);
      for (const champ of nearbyChampions) {
        const dist = this.position.distanceTo(champ.position);
        if (dist < closestDist) {
          closest = champ;
          closestDist = dist;
        }
      }
      this.attackTarget = closest.id;
    }

    // Attack or chase
    const target = context.getEntity(this.attackTarget!);
    if (target) {
      const distance = this.position.distanceTo(target.position);
      if (distance <= this.attackRange + this.getRadius()) {
        // In range - attack
        this.moveTarget = null;
        if (this.attackCooldownTimer <= 0) {
          target.takeDamage(this.damage, 'physical', this.id, context);

          // Emit attack event for client-side animation
          context.addEvent(GameEventType.BASIC_ATTACK, {
            entityId: this.id,
            targetId: target.id,
            animationDuration: 0.4,
          });

          this.attackCooldownTimer = this.attackCooldown;
        }
      } else {
        // Chase
        this.moveTarget = target.position.clone();
      }
    }
  }

  /**
   * Returning state - go back home and heal.
   */
  private updateReturning(dt: number, context: ServerGameContext): void {
    const distanceToHome = this.position.distanceTo(this.homePosition);

    if (distanceToHome < 10) {
      // Reached home
      this.position.setFrom(this.homePosition);
      this.moveTarget = null;
      this.aiState = 'idle';
      // Heal to full
      this.health = this.maxHealth;
    } else {
      this.moveTarget = this.homePosition.clone();
    }
  }

  /**
   * Handle movement.
   */
  private updateMovement(dt: number): void {
    if (!this.moveTarget) return;

    const distance = this.position.distanceTo(this.moveTarget);
    const speed = this.movementSpeed * dt;

    if (distance <= speed) {
      this.position.setFrom(this.moveTarget);
      this.moveTarget = null;
    } else {
      const direction = Vector.direction(this.position, this.moveTarget);
      this.position.add(direction.scalar(speed));
    }
  }

  /**
   * Override takeDamage to handle aggro.
   */
  override takeDamage(amount: number, type: DamageType, sourceId?: string, context?: ServerGameContext): number {
    const actualDamage = super.takeDamage(amount, type, sourceId, context);

    // Aggro on attacker if idle
    if (actualDamage > 0 && sourceId && this.aiState === 'idle') {
      this.attackTarget = sourceId;
      this.aiState = 'aggro';
    }

    return actualDamage;
  }

  /**
   * Called when creature dies.
   */
  protected onDeath(killerId?: string, context?: ServerGameContext): void {
    super.onDeath(killerId, context);

    // Award XP/gold to killer and nearby allies
    if (context) {
      RewardSystem.awardKillRewards(this, killerId, context);
    }

    this.attackTarget = null;
    this.moveTarget = null;
    this.markForRemoval();
  }

  /**
   * Create snapshot for network sync.
   */
  toSnapshot(): JungleCreatureSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.JUNGLE_CAMP,
      campId: this.campId,
      creatureType: this.creatureType,
      x: this.position.x,
      y: this.position.y,
      targetX: this.moveTarget?.x,
      targetY: this.moveTarget?.y,
      targetEntityId: this.attackTarget ?? undefined,
      health: this.health,
      maxHealth: this.maxHealth,
      isDead: this.isDead,
    };
  }
}
