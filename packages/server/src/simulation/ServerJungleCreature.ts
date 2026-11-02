/**
 * ServerJungleCreature - Server-side jungle creature entity.
 *
 * Behavior (neutral monsters):
 * - Passive until attacked; hitting one creature aggros its whole camp
 * - Sticks to whoever attacked first; when that target dies or leaves,
 *   switches to the closest other recent attacker
 * - Resets when pulled past its leash or kited (its patience runs out: a few
 *   seconds without hitting or being hit while its target is out of reach):
 *   walks home invulnerable, regenerating quickly, then heals to full.
 *   Its snapshot tells clients how far it's pulled and how much patience
 *   it has left, so they can warn before it resets
 * - Ranged creatures (thornspitter, dragon) attack with projectiles
 * - Buff monsters and the dragon have a telegraphed area attack
 *   (JungleSpecialAttacks)
 * - Gold/XP rewards on death; buff camps and the dragon grant buffs
 */

import {
  Vector,
  EntityType,
  MOBAConfig,
  GameEventType,
  type JungleCreatureSnapshot,
  type DamageType,
  type DebugUnit,
} from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import { RewardSystem } from '../systems/RewardSystem';
import { grantJungleBuffs } from '../systems/JungleBuffs';
import { ServerTargetedProjectile } from './ServerTargetedProjectile';
import { JUNGLE_SPECIAL_ATTACKS, isInSpecialArea, type JungleSpecialAttack } from './JungleSpecialAttacks';

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
  /** When it last hit or was hit: its patience runs out KITE_RESET_TIME after */
  private lastEngagedAt = 0;
  /** Game time, for the patience in snapshots */
  private now = 0;
  /** Seconds until the special attack can be used (counts down while fighting) */
  private specialCooldownTimer = 0;
  /** The special attack being wound up: when it lands and where it's aimed */
  private windup: { landsAt: number; aim: Vector } | null = null;

  /** Reset if it hasn't hit or been hit for this long while the target is out of reach (seconds) */
  private static readonly KITE_RESET_TIME = 5;
  /** Health regained per second while walking home, as a fraction of max health */
  private static readonly RETURN_REGEN = 0.3;

  /** Creatures that attack with projectiles, and how their projectiles look */
  /** Longest basic attack animation the client plays (seconds) */
  private static readonly MAX_ATTACK_ANIMATION = 0.6;

  private static readonly RANGED: Partial<Record<string, { projectileType: string; damageType: DamageType; speed: number }>> = {
    thornspitter: { projectileType: 'jungle_spit', damageType: 'magic', speed: 450 },
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
    if (this.creatureType === 'thornspitter') {
      return 30;
    } else if (this.creatureType === 'dragon') {
      return 50;
    }
    return 20;
  }

  override getMass(): number {
    // Jungle creatures are heavier than minions, the epic ones much more
    if (this.creatureType === 'dragon' || this.creatureType === 'rootwyrm') {
      return 200;
    }
    return 80;
  }

  override getMovementTarget(): Vector | null {
    return this.moveTarget;
  }

  /**
   * Update creature each tick.
   */
  update(dt: number, context: ServerGameContext): void {
    if (this.isDead) return;
    this.now = context.getGameTime();

    // Update cooldowns
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }
    if (this.aiState === 'aggro' && this.specialCooldownTimer > 0) {
      this.specialCooldownTimer -= dt;
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
      this.lastEngagedAt = context.getGameTime();
      this.specialCooldownTimer = this.getSpecialAttack()?.firstUseAfter ?? 0;
    }
  }

  /**
   * Whether this creature is winding up its special attack.
   */
  isWindingUp(): boolean {
    return this.windup !== null;
  }

  private getSpecialAttack(): JungleSpecialAttack | undefined {
    return JUNGLE_SPECIAL_ATTACKS[this.creatureType];
  }

  /**
   * Aggro state - chase and attack the target; reset when leashed or kited.
   */
  private updateAggro(context: ServerGameContext): void {
    // Winding up: stand still until the special attack lands
    if (this.windup) {
      this.moveTarget = null;
      if (context.getGameTime() >= this.windup.landsAt - 1e-9) this.landSpecialAttack(context);
      return;
    }

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

    const inRange = this.isInAttackRange(target, this.attackRange);

    // Kited: out of patience (no blows either way for a while) and we can't hit back
    if (!inRange && context.getGameTime() - this.lastEngagedAt > ServerJungleCreature.KITE_RESET_TIME) {
      this.startReturning(context);
      return;
    }

    const special = this.getSpecialAttack();
    if (special && this.specialCooldownTimer <= 0 && isInSpecialArea(special, this.position, target.position, target)) {
      this.startSpecialAttack(special, target, context);
      return;
    }

    if (inRange) {
      this.moveTarget = null;
      if (this.attackCooldownTimer <= 0) {
        this.attack(target, context);
        this.attackCooldownTimer = this.attackCooldown;
        this.lastEngagedAt = context.getGameTime();
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
      // Long enough to see the bite or slam, done before the next attack
      animationDuration: Math.min(ServerJungleCreature.MAX_ATTACK_ANIMATION, this.attackCooldown * 0.6),
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
      target.onBasicAttackTaken(this, context);
    }
  }

  /**
   * Stop and warn: clients draw the area for the wind-up.
   */
  private startSpecialAttack(special: JungleSpecialAttack, target: ServerEntity, context: ServerGameContext): void {
    const aim = special.shape === 'cone' ? target.position.clone() : this.position.clone();
    this.windup = { landsAt: context.getGameTime() + special.windup, aim };
    this.moveTarget = null;
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: this.id,
      abilityId: special.abilityId,
      targetX: aim.x,
      targetY: aim.y,
      animationDuration: special.windup,
    });
  }

  /**
   * The special attack lands: hit every champion still in the area.
   */
  private landSpecialAttack(context: ServerGameContext): void {
    const special = this.getSpecialAttack();
    const aim = this.windup?.aim ?? this.position;
    this.windup = null;
    if (!special) return;

    this.specialCooldownTimer = special.cooldown;
    for (const champion of context.getAllChampions()) {
      if (champion.isDead || !isInSpecialArea(special, this.position, aim, champion)) continue;
      champion.takeDamage(special.damage, special.damageType, this.id, context);
      for (const effect of special.effects) champion.applyEffect(effect.id, effect.duration, this.id);
    }
  }

  /**
   * Give up the fight and walk home around walls.
   */
  private startReturning(context: ServerGameContext): void {
    this.aiState = 'returning';
    this.attackTarget = null;
    this.windup = null;
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
      this.lastEngagedAt = context.getGameTime();
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
    this.windup = null;
    this.markForRemoval();
  }

  /** For the debug overlay: its state, leash, patience and who hit it */
  override debugInfo(_context: ServerGameContext): DebugUnit {
    const notes: string[] = [];
    if (this.aiState === 'aggro') {
      const leash = this.position.distanceTo(this.homePosition) / this.leashRange;
      const patience = Math.max(0, 1 - (this.now - this.lastEngagedAt) / ServerJungleCreature.KITE_RESET_TIME);
      notes.push(`leash ${Math.round(leash * 100)}%`, `patience ${Math.round(patience * 100)}%`);
      if (this.getSpecialAttack()) {
        notes.push(this.specialCooldownTimer > 0 ? `special in ${this.specialCooldownTimer.toFixed(1)}s` : 'special ready');
      }
    }
    for (const [championId, at] of this.aggressors) {
      notes.push(`hit by ${championId} ${(this.now - at).toFixed(1)}s ago`);
    }
    const path = [...(this.moveTarget ? [this.moveTarget] : []), ...(this.aiState === 'returning' ? this.returnPath : [])];
    return {
      entityId: this.id,
      radius: this.getRadius(),
      attackRange: this.attackRange,
      sight: this.sightRange,
      targetId: this.attackTarget,
      path: path.map(point => ({ x: point.x, y: point.y })),
      state: this.windup ? 'winding up its special' : this.aiState,
      notes,
      leash: { x: this.homePosition.x, y: this.homePosition.y, radius: this.leashRange },
    };
  }

  /**
   * Create snapshot for network sync.
   */
  toSnapshot(): JungleCreatureSnapshot {
    const fighting = this.aiState === 'aggro';
    // Two decimals: enough for a bar, and fewer changes to send
    const round = (value: number) => Math.round(value * 100) / 100;
    return {
      entityId: this.id,
      entityType: EntityType.JUNGLE_CAMP,
      side: this.side,
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
      homeX: this.homePosition.x,
      homeY: this.homePosition.y,
      leash: fighting ? round(this.position.distanceTo(this.homePosition) / this.leashRange) : null,
      patience: fighting ? round(Math.max(0, 1 - (this.now - this.lastEngagedAt) / ServerJungleCreature.KITE_RESET_TIME)) : null,
      isReturning: this.aiState === 'returning',
    };
  }
}
