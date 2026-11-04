/**
 * ServerSummon - A unit a champion raises that fights for it (Nocthar's
 * Hollows and colossus).
 *
 * It's a minion with an owner (EntityType.MINION, minionType its
 * SummonType): towers, lane minions, abilities and vision treat it like a
 * lane minion, and killing it gives nothing. What it does:
 * - Rising out of the ground (riseTime) it does nothing
 * - Without orders it follows its owner (each summon in its own spot
 *   around it, walking around walls, at least as fast as the owner), fights
 *   what the owner attacks and hits back at enemy units right next to it.
 *   It doesn't go for structures or jungle monsters on its own
 * - Orders (command): walk to a point and fight what comes near there,
 *   attack a unit until it dies or hides, come back
 * - Farther than its leash from the owner, it drops its order and comes back
 * - Its owner dying, it crumbles (a death with no killer)
 * - Crowd control holds it as it does a minion: stun, root, slow, fear
 * - A dash (startDash, the colossus charging) carries it along a line
 *   whatever its orders and crowd control, touching each enemy unit once
 *   and, if it carries, pushing them ahead of it; walls stop it
 */

import {
  Vector,
  EntityType,
  GameEventType,
  type ActiveEffectState,
  type CrowdControlStatus,
  type DamageType,
  type DebugUnit,
  type MinionSnapshot,
  type Side,
  type SummonType,
} from '@siege/shared';
import { ServerEntity } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import { getServerEffectById, isStatEffect } from '../data/effects';
import { calculateCCStatus } from './champion/ChampionEffects';
import { findFear, fleeDirection } from './fear';
import { RewardSystem } from '../systems/RewardSystem';

/** A summon's numbers (its owner's kit decides them) */
export interface SummonStats {
  maxHealth: number;
  armor: number;
  magicResist: number;
  attackDamage: number;
  damageType: DamageType;
  /** Edge to edge, like every attack range */
  attackRange: number;
  /** Seconds between attacks */
  attackCooldown: number;
  /** Seconds from an attack's start until it lands */
  attackWindup: number;
  movementSpeed: number;
  sightRange: number;
  /** How far from itself it notices enemies to hit back at (and, sent somewhere, to fight) */
  acquisitionRange: number;
  /** Body radius at scale 1 */
  radius: number;
  mass: number;
}

/** What it's been told to do */
export type SummonOrder =
  | { kind: 'follow' }
  | { kind: 'move'; point: Vector }
  | { kind: 'attack'; targetId: string };

/** A dash: along `direction`, `distance` units over `duration` seconds */
export interface SummonDash {
  direction: Vector;
  distance: number;
  duration: number;
  /** Enemy units within this of its edge are touched (once each) */
  touchRadius?: number;
  /** Touched enemies are pushed ahead of it to where it stops */
  carries?: boolean;
  onTouch?: (entity: ServerEntity) => void;
  onEnd?: () => void;
}

export interface ServerSummonConfig {
  id: string;
  position: Vector;
  side: Side;
  ownerId: string;
  summonType: SummonType;
  stats: SummonStats;
  /** Farther than this from its owner it drops its order and comes back */
  leash: number;
  /** Seconds climbing out of the ground before it acts (default 0) */
  riseTime?: number;
  /** How big it is (1: its usual size); the body grows with it */
  scale?: number;
}

/** How far ahead of a moving unit a dash looks for walls */
const WALL_STEP = 4;
/** A summon following its owner walks to a spot this far from it */
const FOLLOW_DISTANCE = 45;
/** Closer than this to where it's going, it's there */
const ARRIVED = 6;
/** How often it looks for a new path to where it's going */
const REPATH_EVERY = 0.4;
/** Following, it fights its owner's target only within this of its owner (past it, it would run off) */
const ASSIST_REACH = 0.9;

export class ServerSummon extends ServerEntity {
  readonly ownerId: string;
  readonly minionType: SummonType;
  readonly stats: SummonStats;
  readonly leash: number;
  scale: number;
  order: SummonOrder = { kind: 'follow' };

  activeEffects: ActiveEffectState[] = [];
  ccStatus: CrowdControlStatus = calculateCCStatus([]);

  private rising: number;
  private attackTarget: string | null = null;
  private attackCooldown = 0;
  private pendingAttack: { targetId: string; delay: number } | null = null;
  private fleeing: Vector | null = null;
  private dash: (SummonDash & { elapsed: number; touched: Set<string>; carried: Set<string> }) | null = null;

  // Walking: where to, and the path there
  private destination: Vector | null = null;
  private path: Vector[] = [];
  private repathIn = 0;

  constructor(config: ServerSummonConfig) {
    super({ id: config.id, position: config.position, side: config.side, entityType: EntityType.MINION });
    this.ownerId = config.ownerId;
    this.minionType = config.summonType;
    this.stats = { ...config.stats };
    this.leash = config.leash;
    this.scale = config.scale ?? 1;
    this.rising = config.riseTime ?? 0;
    this.maxHealth = this.stats.maxHealth;
    this.health = this.maxHealth;
    this.movementSpeed = this.stats.movementSpeed;
  }

  // =====================
  // State
  // =====================

  isRising(): boolean {
    return this.rising > 0;
  }

  isDashing(): boolean {
    return this.dash !== null;
  }

  /** The unit it's attacking, or null */
  getAttackTargetId(): string | null {
    return this.attackTarget;
  }

  override isCollidable(): boolean {
    return !this.isDead && !this.isRising();
  }

  override getRadius(): number {
    return this.stats.radius * this.scale;
  }

  override getMass(): number {
    return this.stats.mass * this.scale;
  }

  override getMovementTarget(): Vector | null {
    return this.destination;
  }

  protected override getResists(): { armor: number; magicResist: number } {
    return { armor: this.stats.armor, magicResist: this.stats.magicResist };
  }

  // =====================
  // Orders
  // =====================

  /**
   * Tell it what to do. An attack order at something it can't attack (an
   * ally, a structure... dead or unseen) is a walk to where that is.
   */
  command(order: SummonOrder, context: ServerGameContext): void {
    if (order.kind === 'attack') {
      const target = context.getEntity(order.targetId);
      if (!target || target.isDead) return;
      if (!this.canFight(target, context)) {
        this.command({ kind: 'move', point: target.position.clone() }, context);
        return;
      }
      this.attackTarget = target.id;
    } else {
      this.attackTarget = null;
    }
    this.order = order.kind === 'move' ? { kind: 'move', point: order.point.clone() } : order;
    this.pendingAttack = null;
    this.path = [];
    this.repathIn = 0;
  }

  /** Start a dash; it runs to its end whatever happens (only death stops it) */
  startDash(dash: SummonDash): void {
    this.dash = { ...dash, direction: dash.direction.normalized(), elapsed: 0, touched: new Set(), carried: new Set() };
    this.pendingAttack = null;
    this.destination = null;
    this.path = [];
  }

  /** It falls apart: a death without a killer (its owner died, it was absorbed) */
  crumble(context: ServerGameContext): void {
    if (this.isDead) return;
    this.health = 0;
    this.onDeath(undefined, context);
  }

  // =====================
  // Effects (crowd control)
  // =====================

  /** Apply an effect (abilities call it on what they hit); reapplying keeps the longer one */
  applyEffect(effectId: string, duration: number, sourceId?: string, stacks = 1): void {
    const def = getServerEffectById(effectId);
    if (!def || this.isDead) return;
    const existing = this.activeEffects.find(effect => effect.definitionId === effectId);
    if (existing) {
      existing.timeRemaining = Math.max(existing.timeRemaining, duration);
      existing.totalDuration = Math.max(existing.totalDuration ?? 0, duration);
      if (def.stackBehavior === 'stack') existing.stacks = Math.min(existing.stacks + stacks, def.maxStacks ?? Infinity);
    } else {
      this.activeEffects.push({
        instanceId: `${this.id}_${effectId}_${this.activeEffects.length}`,
        definitionId: effectId,
        sourceId,
        timeRemaining: duration,
        totalDuration: duration,
        stacks,
      });
    }
    this.ccStatus = calculateCCStatus(this.activeEffects);
  }

  private updateEffects(dt: number): void {
    if (this.activeEffects.length === 0) return;
    this.activeEffects = this.activeEffects.filter(effect => {
      effect.timeRemaining -= dt;
      return effect.timeRemaining > 0;
    });
    this.ccStatus = calculateCCStatus(this.activeEffects);
  }

  /** The strongest slow on it (0.4 = 40% slower); slows don't add up */
  private slowPercent(): number {
    let slow = 0;
    for (const effect of this.activeEffects) {
      const def = getServerEffectById(effect.definitionId);
      if (def && isStatEffect(def) && def.stat === 'movement_speed' && (def.percentValue ?? 0) < 0) {
        slow = Math.max(slow, -def.percentValue!);
      }
    }
    return Math.min(1, slow);
  }

  // =====================
  // Tick
  // =====================

  update(dt: number, context: ServerGameContext): void {
    if (this.isDead) return;

    const owner = context.getChampion(this.ownerId);
    if (!owner || owner.isDead) {
      this.crumble(context);
      return;
    }

    this.updateEffects(dt);
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    if (this.rising > 0) {
      this.rising = Math.max(0, this.rising - dt);
      return;
    }

    if (this.dash) {
      this.updateDash(dt, context);
      return;
    }

    // An attack winding up lands at its end; crowd control cancels it
    if (this.pendingAttack) {
      if (!this.ccStatus.canAttack) {
        this.pendingAttack = null;
      } else {
        this.pendingAttack.delay -= dt;
        if (this.pendingAttack.delay <= 0) {
          const target = context.getEntity(this.pendingAttack.targetId);
          this.pendingAttack = null;
          if (target && !target.isDead) this.landAttack(target, context);
        }
      }
    }

    // Feared: it runs from whoever scared it, and does nothing else
    const fear = this.ccStatus.isFeared ? findFear(this.activeEffects) : undefined;
    if (fear) {
      this.attackTarget = null;
      if (this.ccStatus.canMove) {
        this.fleeing = fleeDirection(this, fear, context, this.fleeing);
        this.position.add(this.fleeing.scaled(this.speed(owner) * dt));
      }
      return;
    }
    this.fleeing = null;

    if (this.ccStatus.isStunned) return;

    // Too far from its owner: whatever it was doing, it comes back
    if (this.order.kind !== 'follow' && this.position.distanceTo(owner.position) > this.leash) {
      this.command({ kind: 'follow' }, context);
    }

    this.chooseTarget(owner, context);
    this.act(dt, owner, context);
  }

  /** What it fights now: its order's target, its owner's, or an enemy right next to it */
  private chooseTarget(owner: ServerEntity & { targetEntityId: string | null }, context: ServerGameContext): void {
    if (this.order.kind === 'attack') {
      const target = context.getEntity(this.order.targetId);
      if (!target || !this.canFight(target, context) || target.position.distanceTo(owner.position) > this.leash) {
        this.command({ kind: 'follow' }, context);
      } else {
        this.attackTarget = target.id;
        return;
      }
    }

    // Keep a target it's fighting while it can
    if (this.attackTarget) {
      const current = context.getEntity(this.attackTarget);
      if (!current || !this.canFight(current, context) || !this.withinReach(current, owner)) this.attackTarget = null;
    }

    // Following: what its owner attacks (units and structures, as long as it doesn't run off)
    if (this.order.kind === 'follow' && owner.targetEntityId) {
      const ownerTarget = context.getEntity(owner.targetEntityId);
      if (ownerTarget && ownerTarget.side !== this.side && !ownerTarget.isDead &&
          context.isVisibleTo(ownerTarget, this.side) &&
          ownerTarget.position.distanceTo(owner.position) <= this.leash * ASSIST_REACH) {
        this.attackTarget = ownerTarget.id;
        return;
      }
    }

    if (this.attackTarget) return;

    // An enemy lane unit right next to it (where it was sent, or by its owner)
    let best: ServerEntity | null = null;
    let bestDistance = Infinity;
    for (const entity of context.getEntitiesInRadius(this.position, this.stats.acquisitionRange + this.getRadius() + 40)) {
      if (entity.side === this.side || entity.isDead) continue;
      if (entity.entityType !== EntityType.CHAMPION && entity.entityType !== EntityType.MINION) continue;
      if (!context.isVisibleTo(entity, this.side)) continue;
      const gap = this.distanceTo(entity) - this.getRadius() - entity.getRadius();
      if (gap > this.stats.acquisitionRange || gap >= bestDistance) continue;
      best = entity;
      bestDistance = gap;
    }
    this.attackTarget = best?.id ?? null;
  }

  /** Attack its target if it's in range, otherwise walk: to it, to where it was sent, or after its owner */
  private act(dt: number, owner: ServerEntity, context: ServerGameContext): void {
    const target = this.attackTarget ? context.getEntity(this.attackTarget) : undefined;
    if (target) {
      if (this.isInAttackRange(target, this.stats.attackRange)) {
        this.destination = null;
        this.path = [];
        if (this.attackCooldown <= 0 && !this.pendingAttack && this.ccStatus.canAttack) this.attack(target, context);
        return;
      }
      if (!this.pendingAttack) this.walkTo(target.position, dt, owner, context);
      return;
    }
    if (this.pendingAttack) return;

    if (this.order.kind === 'move') {
      this.walkTo(this.order.point, dt, owner, context);
    } else {
      const spot = this.followSpot(owner, context);
      if (this.position.distanceTo(spot) > ARRIVED) this.walkTo(spot, dt, owner, context);
      else this.destination = null;
    }
  }

  /**
   * Its spot by its owner: a little behind, spread around it by summon so
   * they don't pile up
   */
  private followSpot(owner: ServerEntity, context: ServerGameContext): Vector {
    const siblings = context.getAllEntities()
      .filter((entity): entity is ServerSummon => entity instanceof ServerSummon && entity.ownerId === this.ownerId && !entity.isDead)
      .map(entity => entity.id)
      .sort();
    const index = Math.max(0, siblings.indexOf(this.id));
    const angle = Math.PI / 2 + (index * 2 * Math.PI) / Math.max(siblings.length, 1);
    const distance = FOLLOW_DISTANCE + owner.getRadius() + this.getRadius();
    return owner.position.added(new Vector(Math.cos(angle) * distance, Math.sin(angle) * distance));
  }

  /** As fast as its owner, if that's faster than itself, less its slows */
  private speed(owner: ServerEntity): number {
    const ownerSpeed = (owner as ServerEntity & { getStats?: () => { movementSpeed: number } }).getStats?.().movementSpeed ?? 0;
    return Math.max(this.stats.movementSpeed, ownerSpeed) * (1 - this.slowPercent());
  }

  /** Walk toward `goal`, around walls (past its leash, update() calls it back) */
  private walkTo(goal: Vector, dt: number, owner: ServerEntity, context: ServerGameContext): void {
    if (!this.ccStatus.canMove) return;

    if (!this.destination || this.destination.distanceTo(goal) > 20 || this.repathIn <= 0) {
      this.destination = goal.clone();
      this.path = context.terrain.findPath(this.position, goal, this.getRadius()) ?? [goal.clone()];
      this.repathIn = REPATH_EVERY;
    }
    this.repathIn -= dt;

    let budget = this.speed(owner) * dt;
    while (budget > 0 && this.path.length > 0) {
      const waypoint = this.path[0];
      const gap = this.position.distanceTo(waypoint);
      if (gap <= budget) {
        this.position.setFrom(waypoint);
        this.path.shift();
        budget -= gap;
      } else {
        this.position.add(Vector.direction(this.position, waypoint).scaled(budget));
        budget = 0;
      }
    }

    if (this.path.length === 0) this.destination = null;
  }

  // =====================
  // Combat
  // =====================

  /** Whether it may fight `target`: an enemy unit or structure it sees */
  private canFight(target: ServerEntity, context: ServerGameContext): boolean {
    if (target.isDead || target.side === this.side) return false;
    switch (target.entityType) {
      case EntityType.CHAMPION:
      case EntityType.MINION:
      case EntityType.JUNGLE_CAMP:
      case EntityType.TOWER:
      case EntityType.INHIBITOR:
      case EntityType.NEXUS:
        break;
      default:
        return false;
    }
    return context.isVisibleTo(target, this.side);
  }

  /** Whether a target it's fighting is still worth chasing (not dragging it off its owner) */
  private withinReach(target: ServerEntity, owner: ServerEntity): boolean {
    if (this.isInAttackRange(target, this.stats.attackRange)) return true;
    return target.position.distanceTo(owner.position) <= this.leash;
  }

  private attack(target: ServerEntity, context: ServerGameContext): void {
    this.attackCooldown = this.stats.attackCooldown;
    this.pendingAttack = { targetId: target.id, delay: this.stats.attackWindup };
    this.destination = null;
    context.addEvent(GameEventType.BASIC_ATTACK, {
      entityId: this.id,
      targetId: target.id,
      animationDuration: Math.max(this.stats.attackWindup * 2, 0.3),
    });
  }

  private landAttack(target: ServerEntity, context: ServerGameContext): void {
    target.takeDamage(this.stats.attackDamage, this.stats.damageType, this.id, context);
    target.onBasicAttackTaken(this, context);
  }

  // =====================
  // Dash
  // =====================

  private updateDash(dt: number, context: ServerGameContext): void {
    const dash = this.dash!;
    const step = Math.min(dt, dash.duration - dash.elapsed);
    dash.elapsed += step;
    const travel = (dash.distance / dash.duration) * step;

    // Walls stop it (looked at a few units at a time)
    let moved = 0;
    while (moved < travel) {
      const piece = Math.min(WALL_STEP, travel - moved);
      const next = this.position.added(dash.direction.scaled(piece));
      if (context.terrain.clearanceAt(next.x, next.y) < this.getRadius() * 0.5) {
        dash.elapsed = dash.duration;
        break;
      }
      this.position.setFrom(next);
      moved += piece;
    }

    // What it runs into
    const reach = this.getRadius() + (dash.touchRadius ?? 0);
    if (dash.touchRadius !== undefined || dash.carries) {
      for (const entity of context.getEntitiesInRadius(this.position, reach + 60)) {
        if (entity.side === this.side || entity.isDead || dash.touched.has(entity.id)) continue;
        if (entity.entityType !== EntityType.CHAMPION && entity.entityType !== EntityType.MINION &&
            entity.entityType !== EntityType.JUNGLE_CAMP) continue;
        if (this.distanceTo(entity) > reach + entity.getRadius()) continue;
        dash.touched.add(entity.id);
        if (dash.carries) dash.carried.add(entity.id);
        dash.onTouch?.(entity);
      }
    }

    // What it carries stays just ahead of it
    for (const id of dash.carried) {
      const entity = context.getEntity(id);
      if (!entity || entity.isDead) continue;
      const ahead = this.getRadius() + entity.getRadius() + 4;
      const offset = entity.position.subtracted(this.position);
      const along = offset.dot(dash.direction);
      if (along < ahead) entity.position.add(dash.direction.scaled(ahead - along));
    }

    if (dash.elapsed >= dash.duration - 1e-9) {
      this.dash = null;
      dash.onEnd?.();
    }
  }

  // =====================
  // Death
  // =====================

  protected override onDeath(killerId?: string, context?: ServerGameContext): void {
    super.onDeath(killerId, context);
    this.attackTarget = null;
    this.pendingAttack = null;
    this.dash = null;
    this.destination = null;
    // No gold or XP (it carries none), but whoever cares hears of the death
    if (context) RewardSystem.awardKillRewards(this, killerId, context);
    this.markForRemoval();
  }

  // =====================
  // Network and debug
  // =====================

  toSnapshot(): MinionSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.MINION,
      side: this.side,
      minionType: this.minionType,
      x: this.position.x,
      y: this.position.y,
      targetX: this.destination?.x ?? null,
      targetY: this.destination?.y ?? null,
      targetEntityId: this.attackTarget,
      health: this.health,
      maxHealth: this.maxHealth,
      isDead: this.isDead,
      isAttacking: this.pendingAttack !== null || undefined,
      isStunned: this.ccStatus.isStunned || undefined,
      isRooted: this.ccStatus.isRooted || undefined,
      isFeared: this.ccStatus.isFeared || undefined,
      slowPercent: this.slowPercent() > 0 ? this.slowPercent() : undefined,
      ownerId: this.ownerId,
      scale: this.scale,
      rising: this.rising > 0 ? this.rising : null,
      isCharging: this.dash !== null || undefined,
    };
  }

  override debugInfo(context: ServerGameContext): DebugUnit {
    const notes = [`order: ${this.order.kind}`];
    if (this.isRising()) notes.push('rising');
    return {
      entityId: this.id,
      radius: this.getRadius(),
      attackRange: this.stats.attackRange,
      sight: this.stats.acquisitionRange,
      targetId: this.attackTarget,
      path: this.path.map(point => ({ x: point.x, y: point.y })),
      state: this.dash ? 'charging' : this.attackTarget ? 'fighting' : this.order.kind === 'move' ? 'sent' : 'following',
      notes,
    };
  }
}
