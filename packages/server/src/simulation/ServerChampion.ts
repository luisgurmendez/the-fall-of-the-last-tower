/**
 * ServerChampion - Server-side champion implementation.
 *
 * Holds the authoritative champion state (position, health, resource,
 * progression, abilities, effects, items) and runs the per-tick update.
 * The rules for each concern live in collaborators under ./champion/:
 *
 * - ChampionStats          effective stats (level, modifiers, items, effects)
 * - ChampionEffects        buffs/debuffs, crowd control, shields
 * - ChampionBasicAttacks   attack timer, keyframe damage, ranged projectiles
 * - ChampionAbilities      ranks, cooldowns, recasts, scheduled ability projectiles
 * - ChampionTransform      Vile's R attack range override and aura
 * - ChampionForcedMovement dashes and knockbacks
 * - ChampionRecall         recall channel
 * - ChampionTrinket        ward charges
 * - ChampionInventory      buying and selling items
 * - ChampionSnapshot       network snapshot
 *
 * State that other systems read or write directly (activeEffects, shields,
 * abilityStates, forcedMovement, trinket fields, ...) stays on this class
 * and the collaborators act on it. Public methods delegate to them.
 *
 * NO RENDERING - purely simulation.
 */

import {
  Vector,
  EntityType,
  DamageType,
  ChampionSnapshot,
  AbilitySlot,
  AbilityState,
  ChampionDefinition,
  ChampionStats,
  type FullChampionStats,
  StatModifier,
  ActiveEffectState,
  CrowdControlStatus,
  EquippedItemState,
  PassiveState,
  getExperienceToNextLevel,
  defaultCCStatus,
  calculatePhysicalDamage,
  calculateMagicDamage,
  GameConfig,
  CONTROL_WARD_ITEM_ID,
  GameEventType,
  getPassiveDefinition,
  createDefaultPassiveState,
  DEFAULT_CHAMPION_COLLISION,
  type EntityCollision,
  type DebugUnit,
} from '@siege/shared';
import { ServerEntity, ServerEntityConfig, type Penetration } from './ServerEntity';
import { ServerTower } from './ServerTower';
import type { ServerGameContext } from '../game/ServerGameContext';
import { RewardSystem } from '../systems/RewardSystem';
import { passiveTriggerSystem } from '../systems/PassiveTriggerSystem';
import { championHooksRegistry } from '../abilities/ChampionHooksRegistry';
import { getServerEffectById, isStatEffect } from '../data/effects';
import { Logger } from '../utils/Logger';
import { calculateChampionStats } from './champion/ChampionStats';
import { ChampionEffects, type ActiveShield } from './champion/ChampionEffects';
import { ChampionBasicAttacks } from './champion/ChampionBasicAttacks';
import {
  ChampionAbilities,
  createDefaultAbilityState,
  type ScheduledAbilityProjectile,
} from './champion/ChampionAbilities';
import { ChampionTransform, type TransformAuraConfig } from './champion/ChampionTransform';
import { updateForcedMovement, type ForcedMovement } from './champion/ChampionForcedMovement';
import { ChampionRecall } from './champion/ChampionRecall';
import { ChampionTrinket } from './champion/ChampionTrinket';
import { ChampionSummoners } from './champion/ChampionSummoners';
import { ChampionInventory } from './champion/ChampionInventory';
import { ChampionItemPassives } from './champion/ChampionItemPassives';
import { ChampionItemActives } from './champion/ChampionItemActives';
import { buildChampionSnapshot } from './champion/ChampionSnapshot';
import { describeChampion } from './champion/ChampionDebug';

export interface ServerChampionConfig extends Omit<ServerEntityConfig, 'entityType'> {
  definition: ChampionDefinition;
  playerId: string;
}

export type { ActiveShield, ForcedMovement };

/** What attack-move attacks on the way */
const ATTACK_MOVE_TARGETS = new Set<EntityType>([
  EntityType.CHAMPION,
  EntityType.MINION,
  EntityType.TOWER,
  EntityType.INHIBITOR,
  EntityType.NEXUS,
]);

/** What kind of damage a champion is dealing (ServerChampion.damageKind) */
export type DamageKind = 'basic' | 'ability' | 'item';

export class ServerChampion extends ServerEntity {
  /** How far past its attack range attack-move picks up enemies */
  private static readonly ATTACK_MOVE_LEEWAY = 60;

  readonly playerId: string;
  readonly definition: ChampionDefinition;

  // Champion-specific state
  resource = 0;
  maxResource = 0;
  level = 1;
  experience = 0;
  experienceToNextLevel = getExperienceToNextLevel(1);
  skillPoints = 1;

  // Combat state
  inCombat = false;
  /** Attack-move destination (attack enemies in range on the way), or null */
  private attackMoveDestination: Vector | null = null;
  /** Where the attack-move last walked on from, to notice it can't get closer */
  private attackMoveResumedFrom: Vector | null = null;
  timeSinceCombat = 0;
  respawnTimer = 0;
  isRecalling = false;
  recallProgress = 0;

  // Stats
  private statModifiers: StatModifier[] = [];
  private cachedStats: FullChampionStats | null = null;

  /**
   * What the damage it's dealing right now is, for its items: its basic
   * attacks set 'basic' and its items' passives 'item' while they deal it;
   * anything else (abilities, their damage over time, summoner spells) is
   * 'ability'.
   */
  damageKind: DamageKind = 'ability';
  /** The basic attack it's dealing is a critical strike */
  dealingCrit = false;
  /** Enemy champions that hurt it, with the game time they last did (for assists) */
  private readonly recentAttackers = new Map<string, number>();
  /** How long a hit counts toward an assist (seconds) */
  private static readonly ASSIST_WINDOW = 10;

  // Abilities
  abilityRanks: Record<AbilitySlot, number> = { Q: 0, W: 0, E: 0, R: 0 };
  abilityStates: Record<AbilitySlot, AbilityState> = {
    Q: createDefaultAbilityState(),
    W: createDefaultAbilityState(),
    E: createDefaultAbilityState(),
    R: createDefaultAbilityState(),
  };

  // Effects
  activeEffects: ActiveEffectState[] = [];
  ccStatus: CrowdControlStatus = defaultCCStatus();

  // Items
  items: (EquippedItemState | null)[] = [null, null, null, null, null, null];
  gold: number = GameConfig.ECONOMY.STARTING_GOLD;
  totalGoldSpent = 0;

  // Combat tracking
  kills = 0;
  deaths = 0;
  assists = 0;
  cs = 0;  // Creep score

  // Shields and forced movement
  shields: ActiveShield[] = [];
  forcedMovement: ForcedMovement | null = null;
  dashAbilityId: string | null = null; // Track which ability caused the current dash

  /** An ability in its cast time (startCast): it goes off when the time is up */
  private cast: { slot: AbilitySlot; abilityId: string; remaining: number; finish: () => void } | null = null;

  // Direction facing
  direction: Vector = new Vector(1, 0);

  // Passive ability state
  passiveState: PassiveState = createDefaultPassiveState();

  // Vision - champions provide fog of war vision
  sightRange: number = GameConfig.VISION.CHAMPION_SIGHT_RANGE;

  // Trinket (ward placement) state
  trinketCharges = 2;           // Start with 2 charges
  trinketMaxCharges = 2;
  trinketCooldown = 0;          // Cooldown after placing a ward
  trinketRechargeTimer = 0;     // Time accumulator for next charge
  trinketRechargeTime = 120;    // 120 seconds to recharge one ward
  /** Control wards carried: bought in the shop, not trinket charges */
  controlWards = 0;

  // Collaborators (see ./champion/)
  private readonly effects = new ChampionEffects(this);
  readonly basicAttacks = new ChampionBasicAttacks(this);
  private readonly abilities = new ChampionAbilities(this);
  private readonly transform = new ChampionTransform(this);
  private readonly recall = new ChampionRecall(this);
  private readonly trinket = new ChampionTrinket(this);
  /** Summoner spells (D, F) */
  readonly summoners = new ChampionSummoners(this);
  private readonly inventory = new ChampionInventory(this);
  /** Item passives (lifesteal, thorns, ...); attacks and abilities report to it */
  readonly itemPassives = new ChampionItemPassives(this);
  /** Item actives (keys 1, 2, 3, 6, 7, 8) and consumables */
  readonly itemActives = new ChampionItemActives(this);

  constructor(config: ServerChampionConfig) {
    super({
      id: config.id,
      entityType: EntityType.CHAMPION,
      position: config.position,
      side: config.side,
    });

    this.playerId = config.playerId;
    this.definition = config.definition;

    // Initialize from definition
    const baseStats = this.definition.baseStats;
    this.health = baseStats.health;
    this.maxHealth = baseStats.health;
    this.resource = baseStats.resource;
    this.maxResource = baseStats.resource;
    this.movementSpeed = baseStats.movementSpeed;

    // Set initial direction based on side
    this.direction = new Vector(config.side === 0 ? 1 : -1, 0);

    // Apply debug starting level if configured
    const debugLevel = Number(process.env.SIEGE_STARTING_LEVEL) || GameConfig.DEBUG.STARTING_LEVEL;
    if (debugLevel > 1) {
      this.level = Math.min(debugLevel, GameConfig.LIMITS.MAX_LEVEL);
      this.skillPoints = GameConfig.DEBUG.STARTING_SKILL_POINTS || this.level;
      // Recalculate stats for new level
      const stats = this.getStats();
      this.maxHealth = stats.maxHealth;
      this.health = stats.maxHealth;
      this.maxResource = stats.maxResource;
      this.resource = stats.maxResource;
    }

    // Initialize passive state
    this.initializePassive();

    // Auto-level Q ability at start so players can cast abilities immediately
    this.levelUpAbility('Q');
  }

  /**
   * Initialize passive ability.
   */
  private initializePassive(): void {
    const passiveId = this.definition.passive;
    const passiveDef = getPassiveDefinition(passiveId);

    if (passiveDef) {
      // Register passive with trigger system
      passiveTriggerSystem.registerPassive(this.definition.id, passiveDef);

      // Initialize interval timer if needed
      if (passiveDef.intervalSeconds) {
        this.passiveState.nextIntervalIn = passiveDef.intervalSeconds;
      }

      Logger.champion.debug(`Initialized passive ${passiveDef.name} for ${this.playerId}`);
    }
  }

  // =====================
  // Tick
  // =====================

  /**
   * Update champion for one tick.
   */
  update(dt: number, context: ServerGameContext): void {
    // Track accumulated game time for transform timing
    this.transform.advanceTime(dt);

    if (this.isDead) {
      this.updateDead(dt, context);
      return;
    }

    // An ability in its cast time goes off (a dash it starts moves this tick)
    this.advanceCast(dt, context);

    // Update forced movement first
    if (this.forcedMovement) {
      updateForcedMovement(this, dt, context);
    } else if (this.ccStatus.canMove && !this.cast) {
      // (Standing still while casting; a move order waits for the cast to end)
      // Normal movement
      this.updateAttackMove(context);
      this.updateMovement(dt, context);
    }

    // Update combat state
    this.updateCombat(dt, context);

    // Process scheduled animation actions (attack damage, etc.)
    this.basicAttacks.processScheduledActions(dt, context);

    // Process scheduled ability actions (projectile spawns, etc.)
    this.abilities.processScheduledActions(dt, context);

    // Update abilities
    this.abilities.update(dt);

    // Update effects
    this.updateEffects(dt, context);

    // Update transform aura (Vile's R)
    this.updateTransformAura(context);

    // Update shields
    this.effects.updateShields(dt);

    // Update recall
    if (this.isRecalling) {
      this.recall.update(dt, context);
    }

    // Regeneration (out of combat)
    this.updateRegeneration(dt);

    // Update trinket (ward) charges
    this.trinket.update(dt);
    this.summoners.update(dt);

    // Update passive state
    this.updatePassiveState(dt, context);

    // Passive gold income
    this.gold += GameConfig.ECONOMY.PASSIVE_GOLD_PER_SECOND * dt;

    // Invalidate cached stats
    this.cachedStats = null;
  }

  /**
   * Update while dead (respawn timer).
   */
  private updateDead(dt: number, context: ServerGameContext): void {
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.respawn(context);
    }
  }

  /**
   * Respawn the champion.
   */
  private respawn(context: ServerGameContext): void {
    const spawnPos = this.side === 0
      ? context.mapConfig.CHAMPION_SPAWN.BLUE
      : context.mapConfig.CHAMPION_SPAWN.RED;

    this.position.setFrom(spawnPos);
    this.isDead = false;
    this.respawnTimer = 0;

    // Restore health and mana
    const stats = this.getStats();
    this.health = stats.maxHealth;
    this.resource = stats.maxResource;

    // Clear effects (elixirs last through death)
    this.activeEffects = this.activeEffects.filter(effect => getServerEffectById(effect.definitionId)?.persistsThroughDeath);
    this.shields = [];
    this.ccStatus = defaultCCStatus();
    this.forcedMovement = null;
    this.dashAbilityId = null;
  }

  /**
   * Start an attack-move to `destination` (the walk there is ordered separately).
   */
  startAttackMove(destination: Vector): void {
    this.attackMoveDestination = destination.clone();
    this.attackMoveResumedFrom = null;
  }

  /**
   * End the attack-move, if any (another order replaces it, or it's done).
   */
  endAttackMove(): void {
    this.attackMoveDestination = null;
    this.attackMoveResumedFrom = null;
  }

  /**
   * The attack-move destination, or null when not attack-moving.
   */
  get attackMoveTarget(): Vector | null {
    return this.attackMoveDestination;
  }

  /**
   * Attack-move: attack an enemy that comes within reach, and once there's
   * nothing to fight, walk on to the destination.
   */
  private updateAttackMove(context: ServerGameContext): void {
    const destination = this.attackMoveDestination;
    if (!destination || this.targetEntityId) return;

    const target = this.findAttackMoveTarget(context);
    if (target) {
      this.setAttackTarget(target.id);
      this.attackMoveResumedFrom = null;
      return;
    }

    if (!this.targetPosition && !context.pathFollower.isFollowing(this.id)) {
      // Arrived, or stuck where the last walk toward it started (a point in a wall)
      const stuck = this.attackMoveResumedFrom !== null &&
        this.position.distanceTo(this.attackMoveResumedFrom) < 10;
      if (this.position.distanceTo(destination) < 10 || stuck) {
        this.endAttackMove();
      } else {
        this.attackMoveResumedFrom = this.position.clone();
        context.moveChampion(this, destination);
      }
    }
  }

  /**
   * The closest visible enemy champion, minion or structure within attack
   * range (plus a little), for attack-move. Jungle monsters are left alone.
   */
  private findAttackMoveTarget(context: ServerGameContext): ServerEntity | null {
    const reach = this.getAttackRange() + ServerChampion.ATTACK_MOVE_LEEWAY;
    let closest: ServerEntity | null = null;
    let closestDistance = Infinity;
    for (const entity of context.getEnemiesInRadius(this.position, reach + this.getRadius() + 100, this.side)) {
      if (entity.isDead || !ATTACK_MOVE_TARGETS.has(entity.entityType)) continue;
      if (!context.isVisibleTo(entity, this.side) || !this.isInAttackRange(entity, reach)) continue;
      const distance = this.position.distanceTo(entity.position);
      if (distance < closestDistance) {
        closest = entity;
        closestDistance = distance;
      }
    }
    return closest;
  }

  /**
   * Update movement.
   */
  private updateMovement(dt: number, context: ServerGameContext): void {
    if (!this.targetPosition && !this.targetEntityId) return;

    // If targeting an entity, update target position
    if (this.targetEntityId) {
      const target = context.getEntity(this.targetEntityId);
      if (target && !target.isDead) {
        // Update facing direction toward target
        const dir = target.position.subtracted(this.position);
        if (dir.length() > 0.1) {
          this.direction = dir.normalized();
        }

        // Check if we're in attack range (a transform may change it) - if so, stop moving to attack
        if (this.isInAttackRange(target, this.getAttackRange())) {
          // In range - stop moving, let updateCombat handle attacking
          this.targetPosition = null;
          return;
        }

        // Not in range - continue moving toward target
        this.targetPosition = target.position.clone();
      } else {
        this.targetEntityId = null;
        this.targetPosition = null;
        return;
      }
    }

    const target = this.targetPosition;
    if (target) {
      // Update facing direction first (before moveToward might clear targetPosition)
      const dir = target.subtracted(this.position);
      if (dir.length() > 0.1) {
        this.direction = dir.normalized();
      }

      this.moveToward(target, dt);
    }
  }

  /**
   * Update combat state.
   */
  private updateCombat(dt: number, context: ServerGameContext): void {
    // Update attack cooldown
    this.basicAttacks.updateCooldown(dt);
    this.itemPassives.update(dt, context);
    this.itemActives.update(dt, context);

    // Update combat timer
    if (this.inCombat) {
      this.timeSinceCombat += dt;
      if (this.timeSinceCombat >= GameConfig.COMBAT.COMBAT_TIMEOUT) {
        this.inCombat = false;
      }
    }

    // Validate and clear target if not visible (entered bush/stealth)
    if (this.targetEntityId) {
      const target = context.getEntity(this.targetEntityId);
      if (!target || target.isDead || !context.isVisibleTo(target, this.side)) {
        this.targetEntityId = null;
      }
    }

    // Auto-attack target if in range and can attack (not while casting)
    if (!this.cast) this.basicAttacks.attackTargetIfReady(context);
  }

  // =====================
  // Cast time
  // =====================

  /** Whether the champion is in an ability's cast time */
  isCasting(): boolean {
    return this.cast !== null;
  }

  /**
   * Start an ability's cast time (ServerAbilityExecutor): the champion stands
   * still facing its aim (a move order waits for the end), can't attack or
   * cast anything else, and `finish` casts it when the time is up. Stun,
   * silence or death cancels it first (cancelCast). A basic attack in its
   * windup is dropped, as casting does in LoL.
   */
  startCast(slot: AbilitySlot, abilityId: string, castTime: number, aim: Vector | null, finish: () => void): void {
    this.cast = { slot, abilityId, remaining: castTime, finish };
    if (aim) {
      const direction = aim.subtracted(this.position);
      if (direction.length() > 0.1) this.direction = direction.normalized();
    }
    const state = this.abilityStates[slot];
    state.isCasting = true;
    state.castTimeRemaining = castTime;
    this.basicAttacks.cancelPendingAttack();
  }

  /** Cancel the ability in its cast time, if any: nothing was spent */
  cancelCast(context?: ServerGameContext): void {
    if (!this.cast) return;
    const { slot, abilityId } = this.cast;
    this.endCast();
    context?.addEvent(GameEventType.ABILITY_INTERRUPTED, { entityId: this.id, abilityId, slot });
  }

  /**
   * Count the cast time down (update() does every tick); the ability goes
   * off at its end, unless stun or silence cancels it.
   */
  advanceCast(dt: number, context: ServerGameContext): void {
    if (!this.cast) return;
    if (!this.ccStatus.canCast) {
      this.cancelCast(context);
      return;
    }
    this.cast.remaining -= dt;
    if (this.cast.remaining > 1e-6) return;
    const { finish } = this.cast;
    this.endCast();
    finish();
  }

  private endCast(): void {
    if (!this.cast) return;
    const state = this.abilityStates[this.cast.slot];
    state.isCasting = false;
    state.castTimeRemaining = 0;
    this.cast = null;
  }

  /**
   * Update effects (durations, over-time ticks, CC status).
   * Kept as a method so tests can tick effects directly.
   */
  private updateEffects(dt: number, context: ServerGameContext): void {
    this.effects.update(dt, context);
  }

  /**
   * Health and resource regenerated per second right now: the stats, faster
   * out of combat (GameConfig.COMBAT.OOC_REGEN_MULTIPLIER). The HUD shows them.
   */
  getRegeneration(): { health: number; resource: number } {
    const stats = this.getStats();
    const multiplier = this.inCombat ? 1 : GameConfig.COMBAT.OOC_REGEN_MULTIPLIER;
    return { health: stats.healthRegen * multiplier, resource: stats.resourceRegen * multiplier };
  }

  /**
   * Update regeneration.
   */
  private updateRegeneration(dt: number): void {
    const stats = this.getStats();
    const regen = this.getRegeneration();

    // Health regen
    if (this.health < stats.maxHealth) {
      this.health = Math.min(stats.maxHealth, this.health + regen.health * dt);
    }

    // Resource regen
    if (this.resource < stats.maxResource) {
      this.resource = Math.min(stats.maxResource, this.resource + regen.resource * dt);
    }
  }

  /**
   * Update passive ability state.
   */
  private updatePassiveState(dt: number, context: ServerGameContext): void {
    passiveTriggerSystem.updatePassiveState(dt, this, context);

    // Check for low health trigger
    const healthPercent = this.health / this.maxHealth;
    const passiveDef = getPassiveDefinition(this.definition.passive);

    if (passiveDef?.trigger === 'on_low_health' && passiveDef.healthThreshold) {
      if (healthPercent <= passiveDef.healthThreshold && this.passiveState.cooldownRemaining <= 0) {
        passiveTriggerSystem.dispatchTrigger('on_low_health', this, context);
      }
    }

    // Champion-specific passive state (e.g., Lume's passive follows the Light Orb)
    championHooksRegistry.get(this.definition.id)?.updatePassiveState?.(this, context);
  }

  // =====================
  // Orders
  // =====================

  /**
   * Set movement target.
   */
  setMoveTarget(position: Vector): void {
    this.targetPosition = position.clone();
    this.targetEntityId = null;
    this.cancelRecall();
  }

  /**
   * Set attack target.
   */
  setAttackTarget(entityId: string): void {
    this.targetEntityId = entityId;
    this.cancelRecall();
  }

  /**
   * Stop all actions.
   */
  stop(): void {
    this.targetPosition = null;
    this.targetEntityId = null;
  }

  // =====================
  // Combat, damage and death
  // =====================

  /**
   * Enter combat state.
   */
  enterCombat(): void {
    this.inCombat = true;
    this.timeSinceCombat = 0;
    this.cancelRecall();
  }

  /**
   * Take damage (override for shields and resistances).
   */
  override takeDamage(amount: number, type: DamageType, sourceId?: string, context?: ServerGameContext): number {
    if (this.isDead) return 0;

    // Check for invulnerability (e.g., Vile's W)
    if (this.isInvulnerable()) {
      return 0;
    }

    this.enterCombat();

    const source = sourceId && context ? context.getEntity(sourceId) : undefined;
    if (context && source) {
      // The source's items may raise it; this champion's may block or lower it (Veil, Bark...)
      amount = this.itemPassives.reduceIncomingDamage(source.amplifyDamageTo(this, amount, context), source, context);
      if (amount <= 0) return 0;
      if (source instanceof ServerChampion && source.side !== this.side) {
        this.recentAttackers.set(source.id, context.getGameTime());
      }
    }

    // Dispatch on_take_damage trigger
    if (context) {
      passiveTriggerSystem.dispatchTrigger('on_take_damage', this, context, {
        damageAmount: amount,
        damageType: type,
        sourceId,
      });
    }

    // Calculate damage after resistances (less the attacker's penetration), then let shields absorb what they can
    const { damage, absorbed: shieldAbsorbed } = this.effects.absorbDamage(
      this.calculateDamage(amount, type, source?.getPenetration())
    );

    // Apply remaining damage to health
    if (damage > 0) {
      this.health = Math.max(0, this.health - damage);
    }

    // Emit damage event for client-side floating numbers
    if (context && (damage > 0 || shieldAbsorbed > 0)) {
      // What hit it, so the death recap can name a source the client can't see
      context.addEvent(GameEventType.DAMAGE, {
        entityId: this.id,
        amount: damage,
        damageType: type,
        sourceId,
        shieldAbsorbed,
        sourceType: source?.entityType,
        sourceChampionId: source instanceof ServerChampion ? source.definition.id : undefined,
        sourceCreatureType: (source as { creatureType?: string } | undefined)?.creatureType,
        crit: source instanceof ServerChampion && source.dealingCrit ? true : undefined,
      });
      championHooksRegistry.get(this.definition.id)?.onDamaged?.(this, source, context);
      source?.onDamageDealt(this, damage + shieldAbsorbed, type, context);
    }

    if (this.health <= 0) {
      this.onDeath(sourceId, context);
    } else if (damage > 0) {
      this.itemPassives.onDamaged();
    }

    // Tower aggro: if damaged by enemy champion, trigger aggro on allied towers
    if (context && sourceId && damage > 0) {
      this.alertAlliedTowers(sourceId, context);
    }

    return damage;
  }

  /**
   * An enemy's basic attack hit this champion: item thorns hit back.
   */
  override onBasicAttackTaken(attacker: ServerEntity, context: ServerGameContext): void {
    this.itemPassives.onHitByBasicAttack(attacker, context);
  }

  /**
   * Make allied towers aggro an enemy champion that damaged this champion
   * while either of them was within their range: a tower shoots it once it's
   * in range, within the aggro's few seconds (one that hit from outside the
   * range and walks in to chase gets shot too).
   */
  private alertAlliedTowers(sourceId: string, context: ServerGameContext): void {
    const sourceEntity = context.getEntity(sourceId);
    if (sourceEntity &&
        sourceEntity.entityType === EntityType.CHAMPION &&
        sourceEntity.side !== this.side) {
      // Find all allied towers and trigger aggro if enemy champion is in range
      const allEntities = context.getAllEntities();
      for (const entity of allEntities) {
        if (entity.entityType === EntityType.TOWER &&
            entity.side === this.side &&
            !entity.isDead) {
          const tower = entity as ServerTower;
          if (tower.isInRange(sourceEntity) || tower.isInRange(this)) {
            tower.triggerAggro(sourceId);
          }
        }
      }
    }
  }

  /** Its current armor and magic resist (base, level, items and effects) */
  protected override getResists(): { armor: number; magicResist: number } {
    const stats = this.getStats();
    return { armor: stats.armor, magicResist: stats.magicResist };
  }

  /**
   * What its damage ignores of a target's resists: items' lethality and
   * penetration, effects with an armor_penetration stat (in lethality), plus
   * what its champion's hooks add (Urûk's Spear Charge).
   */
  override getPenetration(): Penetration {
    const stats = this.getStats();
    return {
      armorFlat: stats.lethality + (championHooksRegistry.get(this.definition.id)?.getArmorPenetration?.(this) ?? 0),
      armorPercent: stats.armorPenPercent,
      magicFlat: stats.magicPen,
      magicPercent: stats.magicPenPercent,
    };
  }

  /** Its items raise damage it deals (executes, Giantslayer, structure damage) */
  override amplifyDamageTo(target: ServerEntity, amount: number, context: ServerGameContext): number {
    return this.itemPassives.amplifyDamage(target, amount, context);
  }

  /** Its items react to damage it dealt (omnivamp, Wounds, burns, Tithe...) */
  override onDamageDealt(target: ServerEntity, dealt: number, type: DamageType, context: ServerGameContext): void {
    this.itemPassives.onDamageDealt(target, dealt, type, this.damageKind, context);
  }

  /**
   * Run `deal` with its damage counting as `kind` (a basic attack, an item
   * passive) for its items; a critical strike is marked too.
   */
  withDamageKind<T>(kind: DamageKind, deal: () => T, crit = false): T {
    const previous = this.damageKind;
    const previousCrit = this.dealingCrit;
    this.damageKind = kind;
    this.dealingCrit = crit;
    try {
      return deal();
    } finally {
      this.damageKind = previous;
      this.dealingCrit = previousCrit;
    }
  }

  /**
   * Handle death.
   */
  protected override onDeath(killerId?: string, context?: ServerGameContext): void {
    super.onDeath(killerId, context);
    this.cancelCast(context);
    this.deaths++;

    // Award XP/gold to killer and nearby allies
    if (context) {
      RewardSystem.awardKillRewards(this, killerId, context);
      const killer = killerId ? context.getEntity(killerId) : undefined;
      if (killer instanceof ServerChampion && killer.side !== this.side) {
        championHooksRegistry.get(killer.definition.id)?.onChampionKill?.(killer, this, context);
        killer.itemPassives.onTakedown(this, context);
      }
      this.awardAssists(killer, context);
    }
    this.recentAttackers.clear();
    this.itemPassives.onDeath();

    // Calculate respawn time
    const baseRespawn = GameConfig.RESPAWN.BASE_RESPAWN_TIME;
    const levelBonus = GameConfig.RESPAWN.RESPAWN_TIME_PER_LEVEL * (this.level - 1);
    this.respawnTimer = Math.min(
      baseRespawn + levelBonus,
      GameConfig.RESPAWN.MAX_RESPAWN_TIME
    );

    // Clear state
    this.targetPosition = null;
    this.targetEntityId = null;
    this.forcedMovement = null;
    this.dashAbilityId = null;
    this.isRecalling = false;
    this.recallProgress = 0;

    // Note: Effects with persistsThroughDeath: false are automatically cleared
    // when the champion respawns (effects are cleared in respawn())
  }

  // =====================
  // Stats (see ChampionStats)
  // =====================

  /**
   * Get current stats (with modifiers).
   */
  getStats(): FullChampionStats {
    if (this.cachedStats) {
      return this.cachedStats;
    }

    const stats = calculateChampionStats(this, this.statModifiers);

    // Update cached values
    this.maxHealth = stats.maxHealth;
    this.maxResource = stats.maxResource;
    this.movementSpeed = stats.movementSpeed;

    this.cachedStats = stats;
    return stats;
  }

  /**
   * Drop the cached stats so the next getStats() recalculates them.
   * Call after changing anything stats depend on (level, items, effects, modifiers).
   */
  invalidateStats(): void {
    this.cachedStats = null;
  }

  /**
   * Add a stat modifier.
   */
  addModifier(modifier: StatModifier): void {
    this.statModifiers.push(modifier);
    this.cachedStats = null;
  }

  /**
   * Remove a stat modifier by source.
   */
  removeModifier(source: string): void {
    this.statModifiers = this.statModifiers.filter(m => m.source !== source);
    this.cachedStats = null;
  }

  /**
   * Get a stat modifier by source.
   */
  getModifier(source: string): StatModifier | undefined {
    return this.statModifiers.find(m => m.source === source);
  }

  // =====================
  // Progression
  // =====================

  /**
   * Grant gold to the champion.
   */
  grantGold(amount: number): void {
    if (amount > 0) {
      this.gold += amount;
    }
  }

  /**
   * Gain experience.
   */
  gainExperience(amount: number): void {
    this.experience += amount;

    // Check for level up
    while (this.experience >= this.experienceToNextLevel && this.level < GameConfig.LIMITS.MAX_LEVEL) {
      this.experience -= this.experienceToNextLevel;
      this.levelUp();
    }
  }

  /**
   * Level up.
   */
  private levelUp(): void {
    this.level++;
    this.skillPoints++;
    this.experienceToNextLevel = getExperienceToNextLevel(this.level);

    // Heal percentage of new max health
    const stats = this.getStats();
    this.health = Math.min(stats.maxHealth, this.health + stats.maxHealth * 0.1);
    this.resource = Math.min(stats.maxResource, this.resource + stats.maxResource * 0.1);

    this.cachedStats = null;
  }

  // =====================
  // Abilities (see ChampionAbilities)
  // =====================

  /**
   * Level up an ability.
   */
  levelUpAbility(slot: AbilitySlot): boolean {
    return this.abilities.levelUp(slot);
  }

  /**
   * Schedule an ability projectile to spawn at the animation keyframe time.
   * Called by the generic skillshot path (abilities/generic/Skillshot.ts) for skillshots with animations.
   */
  scheduleAbilityProjectile(
    abilityId: string,
    triggerTime: number,
    projectileConfig: ScheduledAbilityProjectile
  ): void {
    this.abilities.scheduleProjectile(abilityId, triggerTime, projectileConfig);
  }

  /**
   * Enable recast for an ability (called when projectile hits).
   * @param slot - The ability slot to enable recast for
   * @param hitPosition - The position where the projectile hit
   * @param maxRecasts - Maximum number of recasts (default 1)
   * @param recastWindow - Time window for recast in seconds
   */
  enableRecast(slot: AbilitySlot, hitPosition: Vector, maxRecasts: number, recastWindow: number): void {
    this.abilities.enableRecast(slot, hitPosition, maxRecasts, recastWindow);
  }

  /**
   * Check if an ability has recast available.
   */
  hasRecastAvailable(slot: AbilitySlot): boolean {
    return this.abilities.hasRecastAvailable(slot);
  }

  /**
   * Get the recast hit position for an ability.
   * @returns The hit position or undefined if no recast available
   */
  getRecastHitPosition(slot: AbilitySlot): Vector | undefined {
    return this.abilities.getRecastHitPosition(slot);
  }

  /**
   * Consume a recast (called when recast is used).
   */
  consumeRecast(slot: AbilitySlot): void {
    this.abilities.consumeRecast(slot);
  }

  // =====================
  // Effects (see ChampionEffects)
  // =====================

  /**
   * Apply an effect to this champion.
   */
  applyEffect(effectId: string, duration: number, sourceId?: string, stacks = 1): void {
    this.effects.apply(effectId, duration, sourceId, stacks);
  }

  /**
   * Remove an effect from this champion.
   */
  removeEffect(effectId: string): boolean {
    return this.effects.remove(effectId);
  }

  /**
   * Remove all effects matching a category.
   */
  removeEffectsByCategory(category: 'buff' | 'debuff' | 'neutral'): number {
    return this.effects.removeByCategory(category);
  }

  /**
   * Heal it. An allied champion's heal is stronger by the healer's heal and
   * shield power and tells the healer's items (Hymn, Renewal); Verdant makes
   * heals it receives stronger; Wounds and Scorch cut them (the strongest
   * cut counts).
   */
  override heal(amount: number, context?: ServerGameContext, sourceId?: string): number {
    const healer = this.allyGiver(sourceId, context);
    if (healer) amount *= 1 + healer.getStats().healShieldPower;
    amount *= this.itemPassives.receivedMultiplier();
    amount *= 1 - this.effects.healingReduction();
    const healed = super.heal(amount, context, sourceId);
    if (healer && context && healed > 0) healer.itemPassives.onAllyHealedOrShielded(this, healed, context);
    return healed;
  }

  /**
   * Give it a shield. A shield from an allied champion (`giver`) is stronger
   * by the giver's heal and shield power and tells the giver's items;
   * Verdant makes shields it receives stronger.
   * @param styleId What the shield is from (an ability id), for its look on clients
   * @returns The shield's amount
   */
  grantShield(
    amount: number,
    duration: number,
    styleId: string,
    context?: ServerGameContext,
    giver?: ServerChampion,
    shieldType: ActiveShield['shieldType'] = 'normal',
  ): number {
    const fromAlly = giver && giver !== this && giver.side === this.side ? giver : undefined;
    if (fromAlly) amount *= 1 + fromAlly.getStats().healShieldPower;
    amount *= this.itemPassives.receivedMultiplier();
    if (amount <= 0) return 0;
    this.shields.push({ amount, remainingDuration: duration, sourceId: styleId, shieldType });
    if (fromAlly && context) fromAlly.itemPassives.onAllyHealedOrShielded(this, amount, context);
    return amount;
  }

  /** The allied champion (not itself) behind a heal, if one is */
  private allyGiver(sourceId: string | undefined, context: ServerGameContext | undefined): ServerChampion | undefined {
    if (!sourceId || !context || sourceId === this.id) return undefined;
    const source = context.getEntity(sourceId);
    return source instanceof ServerChampion && source.side === this.side ? source : undefined;
  }

  /**
   * Enemy champions that hurt it within the assist window, other than the
   * killer, get an assist, a share of half the kill's gold, and their items'
   * takedown (Soulbinder Tome...).
   */
  private awardAssists(killer: ServerEntity | undefined, context: ServerGameContext): void {
    const now = context.getGameTime();
    const assistants: ServerChampion[] = [];
    for (const [championId, at] of this.recentAttackers) {
      if (championId === killer?.id || now - at > ServerChampion.ASSIST_WINDOW) continue;
      const champion = context.getEntity(championId);
      if (champion instanceof ServerChampion && champion.side !== this.side) assistants.push(champion);
    }
    if (assistants.length === 0) return;
    const gold = Math.round(GameConfig.ECONOMY.CHAMPION_KILL_GOLD_BASE * GameConfig.ECONOMY.ASSIST_GOLD_PERCENT / assistants.length);
    for (const assistant of assistants) {
      assistant.assists++;
      assistant.grantGold(gold);
      context.addEvent(GameEventType.GOLD_EARNED, {
        entityId: assistant.id, amount: gold, sourceType: EntityType.CHAMPION, x: this.position.x, y: this.position.y,
      });
      assistant.itemPassives.onTakedown(this, context);
    }
  }

  /**
   * Cleanse all cleansable debuffs.
   */
  cleanse(): number {
    return this.effects.cleanse();
  }

  /**
   * Check if champion has a specific effect.
   */
  hasEffect(effectId: string): boolean {
    return this.effects.has(effectId);
  }

  /**
   * Get an active effect by ID.
   */
  getEffect(effectId: string): ActiveEffectState | undefined {
    return this.effects.get(effectId);
  }

  /**
   * Break stealth effect (called when attacking or using abilities).
   */
  breakStealth(): void {
    this.effects.breakStealth();
  }

  /**
   * Recompute crowd control and stats after effects were removed from
   * activeEffects directly (e.g. by a cleanse in an ability handler).
   */
  refreshEffectState(): void {
    this.effects.refreshAfterRemoval();
  }

  /**
   * Check if champion is currently invulnerable.
   */
  isInvulnerable(): boolean {
    return this.effects.isInvulnerable();
  }

  /**
   * Check if Ninja Mode is currently active (has vex_ninja_mode effect).
   */
  isInNinjaMode(): boolean {
    return this.hasEffect('vex_ninja_mode');
  }

  /**
   * Extend an effect's duration by the specified amount, with optional max cap.
   * Used for abilities that extend buffs on certain triggers (e.g., takedowns).
   * @param effectId - The effect to extend
   * @param amount - Duration to add in seconds
   * @param maxDuration - Optional maximum total duration cap
   * @returns The actual amount extended (0 if effect not found or at cap)
   */
  extendEffectDuration(effectId: string, amount: number, maxDuration?: number): number {
    return this.effects.extendDuration(effectId, amount, maxDuration);
  }

  // =====================
  // Transform (see ChampionTransform)
  // =====================

  /**
   * Set temporary attack range override during transform.
   * @param range - The new attack range
   * @param duration - Duration in seconds
   */
  setTransformAttackRange(range: number, duration: number): void {
    this.transform.setAttackRange(range, duration);
  }

  /**
   * Start transform aura that deals damage to nearby enemies.
   * @param abilityId - ID of the ability
   * @param aura - Aura configuration
   * @param rank - Ability rank
   * @param duration - Duration in seconds
   */
  startTransformAura(
    abilityId: string,
    aura: TransformAuraConfig,
    rank: number,
    duration: number
  ): void {
    this.transform.startAura(abilityId, aura, rank, duration);
  }

  /**
   * Get current attack range (accounting for transform).
   */
  getAttackRange(): number {
    const range = this.transform.getAttackRange();
    return championHooksRegistry.get(this.definition.id)?.getAttackRange?.(this, range) ?? range;
  }

  /**
   * Check if currently transformed (melee mode for Vile).
   */
  isTransformed(): boolean {
    return this.transform.isTransformed();
  }

  /**
   * Update transform aura (called each tick).
   */
  updateTransformAura(context: ServerGameContext): void {
    this.transform.updateAura(context);
  }

  // =====================
  // Recall (see ChampionRecall)
  // =====================

  /**
   * Start recalling.
   */
  startRecall(): boolean {
    return this.recall.start();
  }

  /**
   * Cancel recall.
   */
  cancelRecall(): void {
    this.recall.cancel();
  }

  // =====================
  // Trinket (see ChampionTrinket)
  // =====================

  /**
   * Check if can place a ward.
   */
  canPlaceWard(): boolean {
    return this.trinket.canPlaceWard();
  }

  /**
   * Consume a trinket charge when placing a ward.
   * Returns true if successful.
   */
  consumeTrinketCharge(): boolean {
    return this.trinket.consumeCharge();
  }

  /**
   * Get trinket recharge progress (0-1).
   */
  getTrinketRechargeProgress(): number {
    return this.trinket.getRechargeProgress();
  }

  // =====================
  // Items (see ChampionInventory)
  // =====================

  /**
   * Buy an item.
   * @returns true if purchase succeeded
   */
  buyItem(itemId: string): boolean {
    if (itemId === CONTROL_WARD_ITEM_ID) return this.buyControlWard();
    return this.inventory.buy(itemId);
  }

  /**
   * Buy a control ward to carry (not an item: it doesn't take a slot).
   * @returns true if bought
   */
  private buyControlWard(): boolean {
    const { CONTROL_WARD_COST, MAX_CONTROL_WARDS_CARRIED } = GameConfig.VISION;
    if (this.controlWards >= MAX_CONTROL_WARDS_CARRIED || this.gold < CONTROL_WARD_COST) return false;
    this.gold -= CONTROL_WARD_COST;
    this.controlWards++;
    return true;
  }

  /**
   * Sell an item from a specific slot.
   * @returns gold gained, or 0 if failed
   */
  sellItem(slot: number): number {
    return this.inventory.sell(slot);
  }

  /**
   * Check if champion has a specific item.
   */
  hasItem(itemId: string): boolean {
    return this.inventory.has(itemId);
  }

  // =====================
  // Collision Interface
  // =====================

  /**
   * Champions participate in collision.
   */
  override isCollidable(): boolean {
    return !this.isDead;
  }

  /**
   * Champion collision radius.
   * Uses the collision shape from champion definition, defaulting to 25.
   * @deprecated Use getCollisionShape() for proper shape-based collision.
   */
  override getRadius(): number {
    const collision = this.definition.collision;
    if (collision && collision.type === 'circle') {
      return collision.radius;
    }
    return 25; // Default if no collision defined
  }

  /**
   * Get the collision shape for this champion.
   * Returns the collision shape from the champion definition, or default circle.
   */
  override getCollisionShape(): EntityCollision {
    return this.definition.collision ?? DEFAULT_CHAMPION_COLLISION;
  }

  /**
   * Champion collision mass.
   * Champions are heavier than minions, so they push minions more.
   */
  override getMass(): number {
    return 100; // Standard champion mass
  }

  // =====================
  // Snapshot (see ChampionSnapshot)
  // =====================

  /**
   * Convert to network snapshot.
   */
  toSnapshot(): ChampionSnapshot {
    return buildChampionSnapshot(this);
  }

  /** For the debug overlay (a bot's decision is added by DebugReport) */
  override debugInfo(context: ServerGameContext): DebugUnit {
    return describeChampion(this, context);
  }
}
