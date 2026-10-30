/**
 * ServerJungleCreature - Server-side jungle creature entity.
 *
 * Behavior (neutral monsters):
 * - Passive until attacked; hitting one creature aggros its whole camp
 * - Sticks to whoever attacked first; when that target dies or leaves,
 *   switches to the closest other recent attacker
 * - Resets when pulled past its leash or kited (no damage taken for a few
 *   seconds while its target is out of reach): walks home invulnerable,
 *   regenerating quickly, then heals to full
 * - Ranged creatures (gromp, dragon) attack with projectiles
 * - Gold/XP rewards on death; buff camps and the dragon grant buffs
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
import { grantJungleBuffs } from '../systems/JungleBuffs';
import { ServerTargetedProjectile } from './ServerTargetedProjectile';

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
  private returnPath: Vector[] = [];
  /** Champions that damaged this creature, with the game time they last did */
  private aggressors: Map<string, number> = new Map();
  private lastDamagedAt = 0;

  /** Reset if not damaged for this long while the target is out of reach (seconds) */
  private static readonly KITE_RESET_TIME = 5;
  /** Health regained per second while walking home, as a fraction of max health */
  private static readonly RETURN_REGEN = 0.3;
  /** Creatures that attack with projectiles, and how their projectiles look */
  private static readonly RANGED: Partial<Record<string, { projectileType: string; damageType: DamageType; speed: number }>> = {
    gromp: { projectileType: 'jungle_spit', damageType: 'magic', speed: 600 },
    dragon: { projectileType: 'dragon_fire', damageType: 'magic', speed: 700 },
  };

  constructor(config: ServerJungleCreatureConfig) {
    // Jungle creatures are neutral - hostile to all players
    super({
      ...config,
      entityType: EntityType.JUNGLE_CAMP,
      side: 2, // Neutral - attacks anyone who aggros
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
    // Use collision shape from creature stats
    const stats = MOBAConfig.JUNGLE.CREATURE_STATS[this.creatureType];
    if (stats.collision && stats.collision.type === 'circle') {
      return stats.collision.radius;
    }
    // Fallback based on creature type
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

    // State machine (idle creatures wait to be attacked)
    switch (this.aiState) {
      case 'aggro':
        this.updateAggro(context);
        break;
      case 'returning':
        this.updateReturning(dt);
        break;
    }

    // Movement
    this.updateMovement(dt);
  }

  /**
   * Whether this creature is walking home after a reset (it can't be damaged).
   */
  isReturning(): boolean {
    return this.aiState === 'returning';
  }

  /**
   * Start fighting a champion (called for every creature in the camp when one is hit).
   */
  aggroOn(attackerId: string, context: ServerGameContext): void {
    if (this.isDead || this.aiState === 'returning') return;
    this.aggressors.set(attackerId, context.getGameTime());
    if (this.aiState === 'idle') {
      this.aiState = 'aggro';
      this.attackTarget = attackerId;
      this.lastDamagedAt = context.getGameTime();
    }
  }

  /**
   * Aggro state - chase and attack the target; reset when leashed or kited.
   */
  private updateAggro(context: ServerGameContext): void {
    if (this.position.distanceTo(this.homePosition) > this.leashRange) {
      this.startReturning(context);
      return;
    }

    let target = this.attackTarget ? context.getEntity(this.attackTarget) : undefined;
    if (!target || target.isDead || !this.isWithinLeash(target)) {
      target = this.findNextTarget(context);
      if (!target) {
        this.startReturning(context);
        return;
      }
      this.attackTarget = target.id;
    }

    const inRange = this.position.distanceTo(target.position) <= this.attackRange + this.getRadius() + target.getRadius();

    // Kited: nobody has hit us for a while and we can't hit back
    if (!inRange && context.getGameTime() - this.lastDamagedAt > ServerJungleCreature.KITE_RESET_TIME) {
      this.startReturning(context);
      return;
    }

    if (inRange) {
      this.moveTarget = null;
      if (this.attackCooldownTimer <= 0) {
        this.attack(target, context);
        this.attackCooldownTimer = this.attackCooldown;
      }
    } else {
      this.moveTarget = target.position.clone();
    }
  }

  /**
   * Whether a target is still close enough to the camp to fight.
   */
  private isWithinLeash(target: ServerEntity): boolean {
    return target.position.distanceTo(this.homePosition) <= this.leashRange + this.attackRange;
  }

  /**
   * The closest champion that recently damaged this creature and is still within the leash.
   */
  private findNextTarget(context: ServerGameContext): ServerEntity | undefined {
    const now = context.getGameTime();
    let best: ServerEntity | undefined;
    let bestDistance = Infinity;
    for (const [attackerId, time] of this.aggressors) {
      const attacker = context.getEntity(attackerId);
      if (!attacker || attacker.isDead || now - time > ServerJungleCreature.KITE_RESET_TIME) {
        this.aggressors.delete(attackerId);
        continue;
      }
      if (!this.isWithinLeash(attacker)) continue;
      const distance = this.position.distanceTo(attacker.position);
      if (distance < bestDistance) {
        best = attacker;
        bestDistance = distance;
      }
    }
    return best;
  }

  private attack(target: ServerEntity, context: ServerGameContext): void {
    context.addEvent(GameEventType.BASIC_ATTACK, {
      entityId: this.id,
      targetId: target.id,
      animationDuration: 0.4,
    });

    const ranged = ServerJungleCreature.RANGED[this.creatureType];
    if (ranged) {
      context.addEntity(new ServerTargetedProjectile({
        id: context.generateEntityId(),
        position: this.position.clone(),
        side: this.side,
        targetId: target.id,
        speed: ranged.speed,
        radius: 8,
        sourceId: this.id,
        projectileType: ranged.projectileType,
        damage: this.damage,
        damageType: ranged.damageType,
      }));
    } else {
      target.takeDamage(this.damage, 'physical', this.id, context);
    }
  }

  /**
   * Give up the fight and walk home around walls.
   */
  private startReturning(context: ServerGameContext): void {
    this.aiState = 'returning';
    this.attackTarget = null;
    this.aggressors.clear();
    this.returnPath = context.terrain.findPath(this.position, this.homePosition) ?? [this.homePosition.clone()];
    this.moveTarget = this.returnPath.shift() ?? null;
  }

  /**
   * Returning state - walk home regenerating; full health on arrival.
   */
  private updateReturning(dt: number): void {
    this.health = Math.min(this.maxHealth, this.health + this.maxHealth * ServerJungleCreature.RETURN_REGEN * dt);

    if (!this.moveTarget) {
      if (this.returnPath.length > 0) {
        this.moveTarget = this.returnPath.shift()!;
      } else if (this.position.distanceTo(this.homePosition) < 10) {
        this.position.setFrom(this.homePosition);
        this.aiState = 'idle';
        this.health = this.maxHealth;
      } else {
        // Pushed off the path (by units or walls): head straight home
        this.moveTarget = this.homePosition.clone();
      }
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
   * Override takeDamage: creatures walking home can't be hurt, and getting
   * hit aggros the whole camp.
   */
  override takeDamage(amount: number, type: DamageType, sourceId?: string, context?: ServerGameContext): number {
    if (this.aiState === 'returning') return 0;

    const actualDamage = super.takeDamage(amount, type, sourceId, context);

    if (actualDamage > 0 && sourceId && context && !this.isDead) {
      this.lastDamagedAt = context.getGameTime();
      if (this.aiState === 'idle') {
        this.alertCamp(sourceId, context);
      } else {
        this.aggressors.set(sourceId, context.getGameTime());
      }
    }

    return actualDamage;
  }

  /**
   * Every creature in this camp starts fighting the attacker.
   */
  private alertCamp(attackerId: string, context: ServerGameContext): void {
    for (const entity of context.getAllEntities()) {
      if (entity.entityType !== EntityType.JUNGLE_CAMP || entity.isDead) continue;
      const creature = entity as ServerJungleCreature;
      if (creature.campId === this.campId) creature.aggroOn(attackerId, context);
    }
  }

  /**
   * Called when creature dies.
   */
  protected onDeath(killerId?: string, context?: ServerGameContext): void {
    super.onDeath(killerId, context);

    // Award XP/gold to killer and nearby allies, and buffs for buff camps and the dragon
    if (context) {
      RewardSystem.awardKillRewards(this, killerId, context);
      grantJungleBuffs(this, killerId, context);
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
      // Use null for cleared values (not undefined) for proper delta updates
      targetX: this.moveTarget?.x ?? null,
      targetY: this.moveTarget?.y ?? null,
      targetEntityId: this.attackTarget,
      health: this.health,
      maxHealth: this.maxHealth,
      isDead: this.isDead,
    };
  }
}
