/**
 * ServerChampion - Server-side champion implementation.
 *
 * This class handles the authoritative champion state:
 * - Position, health, mana
 * - Abilities and cooldowns
 * - Effects and crowd control
 * - Items and stats
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
  StatModifier,
  ActiveEffectState,
  CrowdControlStatus,
  EquippedItemState,
  ItemSlot,
  PassiveState,
  LEVEL_EXPERIENCE,
  defaultCCStatus,
  calculatePhysicalDamage,
  calculateMagicDamage,
  GameConfig,
  GameEventType,
  getPassiveDefinition,
  getAbilityDefinition,
  createDefaultPassiveState,
  DEFAULT_CHAMPION_COLLISION,
  type EntityCollision,
} from '@siege/shared';
import { ServerEntity, ServerEntityConfig } from './ServerEntity';
import { ServerTower } from './ServerTower';
import type { ServerGameContext } from '../game/ServerGameContext';
import { getServerItemById } from '../data/items';
import { AnimationScheduler, type ScheduledAction } from '../systems/AnimationScheduler';
import { RewardSystem } from '../systems/RewardSystem';
import { passiveTriggerSystem } from '../systems/PassiveTriggerSystem';
import { championHooksRegistry } from '../abilities/ChampionHooksRegistry';
import { Logger } from '../utils/Logger';
import { ServerProjectile } from './ServerProjectile';
import { ServerTargetedProjectile } from './ServerTargetedProjectile';
import { calculateChampionStats } from './champion/ChampionStats';
import { ChampionEffects, type ActiveShield } from './champion/ChampionEffects';

export interface ServerChampionConfig extends Omit<ServerEntityConfig, 'entityType'> {
  definition: ChampionDefinition;
  playerId: string;
}

export type { ActiveShield };

export interface ForcedMovement {
  direction: Vector;
  distance: number;
  duration: number;
  elapsed: number;
  type: 'dash' | 'knockback';
  // Dash collision data (for abilities that damage/apply effects during dash)
  hitbox?: number;           // Collision radius
  damage?: number;           // Damage to apply on hit
  damageType?: DamageType;   // Type of damage
  appliesEffects?: string[]; // Effect IDs to apply
  effectDuration?: number;   // Duration of applied effects
  hitEntities?: Set<string>; // Track already-hit entities
}

export class ServerChampion extends ServerEntity {
  readonly playerId: string;
  readonly definition: ChampionDefinition;

  // Champion-specific state
  resource = 0;
  maxResource = 0;
  level = 1;
  experience = 0;
  experienceToNextLevel = LEVEL_EXPERIENCE[1];
  skillPoints = 1;

  // Combat state
  inCombat = false;
  timeSinceCombat = 0;
  respawnTimer = 0;
  isRecalling = false;
  recallProgress = 0;

  // Stats
  private statModifiers: StatModifier[] = [];
  private cachedStats: ChampionStats | null = null;

  // Abilities
  abilityRanks: Record<AbilitySlot, number> = { Q: 0, W: 0, E: 0, R: 0 };
  abilityCooldowns: Record<AbilitySlot, number> = { Q: 0, W: 0, E: 0, R: 0 };
  abilityStates: Record<AbilitySlot, AbilityState> = {
    Q: this.createDefaultAbilityState(),
    W: this.createDefaultAbilityState(),
    E: this.createDefaultAbilityState(),
    R: this.createDefaultAbilityState(),
  };

  // Effects
  activeEffects: ActiveEffectState[] = [];
  ccStatus: CrowdControlStatus = defaultCCStatus();
  private readonly effects = new ChampionEffects(this);

  // Items
  items: (EquippedItemState | null)[] = [null, null, null, null, null, null];
  gold = GameConfig.ECONOMY.STARTING_GOLD;
  totalGoldSpent = 0;

  // Combat tracking
  private attackCooldown = 0;
  private animationScheduler = new AnimationScheduler();
  private currentAttackTargetId: string | null = null;  // Track target for pending attack

  // Ability animation tracking
  private abilityAnimationScheduler = new AnimationScheduler();  // Separate scheduler for abilities
  kills = 0;
  deaths = 0;
  assists = 0;
  cs = 0;  // Creep score

  // Shields and forced movement
  shields: ActiveShield[] = [];
  forcedMovement: ForcedMovement | null = null;
  dashAbilityId: string | null = null; // Track which ability caused the current dash

  // Direction facing
  direction: Vector = new Vector(1, 0);

  // Passive ability state
  passiveState: PassiveState = createDefaultPassiveState();

  // Vision - champions provide fog of war vision
  sightRange = 800;

  // Trinket (ward placement) state
  trinketCharges = 2;           // Start with 2 charges
  trinketMaxCharges = 2;
  trinketCooldown = 0;          // Cooldown after placing a ward
  trinketRechargeTimer = 0;     // Time accumulator for next charge
  trinketRechargeTime = 120;    // 120 seconds to recharge one ward

  // Recast tracking - stores hit position for abilities with recast behavior
  private recastHitPositions: Partial<Record<AbilitySlot, Vector>> = {}

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

  private createDefaultAbilityState(): AbilityState {
    return {
      rank: 0,
      cooldownRemaining: 0,
      cooldownTotal: 0,
      isCasting: false,
      castTimeRemaining: 0,
      isToggled: false,
      passiveCooldownRemaining: 0,
    };
  }

  /**
   * Update champion for one tick.
   */
  update(dt: number, context: ServerGameContext): void {
    // Track accumulated game time for transform timing
    this.gameTimeElapsed += dt;

    if (this.isDead) {
      this.updateDead(dt, context);
      return;
    }

    // Update forced movement first
    if (this.forcedMovement) {
      this.updateForcedMovement(dt, context);
    } else if (this.ccStatus.canMove) {
      // Normal movement
      this.updateMovement(dt, context);
    }

    // Update combat state
    this.updateCombat(dt, context);

    // Process scheduled animation actions (attack damage, etc.)
    this.processScheduledActions(dt, context);

    // Process scheduled ability actions (projectile spawns, etc.)
    this.processScheduledAbilityActions(dt, context);

    // Update abilities
    this.updateAbilities(dt);

    // Update effects
    this.updateEffects(dt, context);

    // Update transform aura (Vile's R)
    this.updateTransformAura(context);

    // Update shields
    this.effects.updateShields(dt);

    // Update recall
    if (this.isRecalling) {
      this.updateRecall(dt);
    }

    // Regeneration (out of combat)
    this.updateRegeneration(dt);

    // Update trinket (ward) charges
    this.updateTrinket(dt);

    // Update passive state
    this.updatePassiveState(dt, context);

    // Passive gold income
    this.gold += GameConfig.ECONOMY.PASSIVE_GOLD_PER_SECOND * dt;

    // Invalidate cached stats
    this.cachedStats = null;
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

    // Clear effects
    this.activeEffects = [];
    this.shields = [];
    this.ccStatus = defaultCCStatus();
    this.forcedMovement = null;
    this.dashAbilityId = null;
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

        // Check if we're in attack range - if so, stop moving to attack
        const attackRange = this.getStats().attackRange;
        if (this.isInRange(target, attackRange)) {
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
   * Update forced movement (dash/knockback).
   */
  private updateForcedMovement(dt: number, context: ServerGameContext): void {
    if (!this.forcedMovement) return;

    const fm = this.forcedMovement;
    fm.elapsed += dt;

    const progress = Math.min(fm.elapsed / fm.duration, 1);
    const moveDistance = fm.distance * (progress - (fm.elapsed - dt) / fm.duration);

    const movement = fm.direction.clone().scalar(moveDistance);
    this.position.add(movement);

    // Check for collisions during dash (not knockback)
    if (fm.type === 'dash' && fm.hitbox && fm.hitbox > 0) {
      this.checkDashCollisions(context, fm);
    }

    if (fm.elapsed >= fm.duration) {
      this.forcedMovement = null;
      this.dashAbilityId = null;
    }
  }

  /**
   * Check for collisions during dash and apply damage/effects.
   */
  private checkDashCollisions(context: ServerGameContext, fm: ForcedMovement): void {
    if (!fm.hitEntities) {
      fm.hitEntities = new Set();
    }

    const entities = context.getEntitiesInRadius(this.position, fm.hitbox!);

    for (const entity of entities) {
      if (entity.side === this.side) continue;
      if (entity.isDead) continue;
      if (entity.id === this.id) continue;
      if (fm.hitEntities.has(entity.id)) continue; // Already hit

      // Mark as hit
      fm.hitEntities.add(entity.id);

      // Apply damage
      if (fm.damage && fm.damage > 0 && fm.damageType) {
        entity.takeDamage(fm.damage, fm.damageType, this.id, context);
      }

      // Apply effects
      if (fm.appliesEffects && fm.effectDuration && 'applyEffect' in entity) {
        const applyEffect = (entity as { applyEffect: (id: string, duration: number, sourceId?: string) => void }).applyEffect;
        for (const effectId of fm.appliesEffects) {
          applyEffect.call(entity, effectId, fm.effectDuration, this.id);
        }
      }
    }
  }

  /**
   * Update combat state.
   */
  private updateCombat(dt: number, context: ServerGameContext): void {
    // Update attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

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

    // Auto-attack target if in range and can attack
    if (this.targetEntityId && this.attackCooldown <= 0 && this.ccStatus.canAttack) {
      const target = context.getEntity(this.targetEntityId);
      if (target && !target.isDead && this.isInRange(target, this.getStats().attackRange)) {
        this.performBasicAttack(target, context);
      }
    }
  }

  /**
   * Perform a basic attack on a target.
   * Schedules damage to occur at the attack animation's damage keyframe.
   */
  private performBasicAttack(target: ServerEntity, context: ServerGameContext): void {
    // Break stealth on attack (Vex's Shadow Shroud)
    this.breakStealth();

    const stats = this.getStats();

    // Dispatch on_attack trigger BEFORE attack (immediately when attack starts)
    passiveTriggerSystem.dispatchTrigger('on_attack', this, context, { target });

    // Set attack cooldown immediately (can't attack again until cooldown expires)
    this.attackCooldown = 1 / stats.attackSpeed;

    // Store target for pending attack damage
    this.currentAttackTargetId = target.id;

    // Get attack animation and schedule damage at keyframe
    const attackAnim = this.definition.animations?.attack;
    let damageDelay = 0;

    if (attackAnim) {
      // Find the damage keyframe
      const damageKeyframe = attackAnim.keyframes.find(k => k.trigger.type === 'damage');
      if (damageKeyframe) {
        // Calculate animation speed (scales with attack speed if enabled)
        const animSpeed = this.definition.attackAnimationSpeedScale ? stats.attackSpeed : 1.0;
        damageDelay = (damageKeyframe.frame * attackAnim.baseFrameDuration) / animSpeed;
      }
    }

    // If no animation or keyframe, use a default delay (50% of attack animation)
    if (damageDelay === 0) {
      const animationDuration = Math.max(0.15, 0.4 / stats.attackSpeed);
      damageDelay = animationDuration * 0.5;
    }

    // Schedule the damage action
    this.animationScheduler.schedule({
      entityId: this.id,
      actionType: 'damage',
      triggerTime: damageDelay,
      data: {
        targetId: target.id,
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
      },
    });

    // Attack animation duration scales with attack speed
    const animationDuration = Math.max(0.15, 0.4 / stats.attackSpeed);

    // Emit attack event for client-side animation
    context.addEvent(GameEventType.BASIC_ATTACK, {
      entityId: this.id,
      targetId: target.id,
      animationDuration,
    });

    // Enter combat
    this.enterCombat();
  }

  /**
   * Process scheduled animation actions (attack damage, etc.)
   */
  private processScheduledActions(dt: number, context: ServerGameContext): void {
    // Cancel pending attacks if stunned or can't attack
    if (!this.ccStatus.canAttack) {
      this.animationScheduler.cancelForEntity(this.id, 'damage');
      this.currentAttackTargetId = null;
      return;
    }

    // Process scheduled actions
    this.animationScheduler.update(dt, (action) => {
      if (action.actionType === 'damage') {
        this.applyScheduledAttackDamage(action, context);
      }
    });
  }

  /**
   * Apply damage from a scheduled attack action.
   * For ranged champions, spawns a projectile that deals damage on hit.
   * For melee champions, deals damage instantly.
   */
  private applyScheduledAttackDamage(action: ScheduledAction, context: ServerGameContext): void {
    const targetId = action.data.targetId as string;
    const target = context.getEntity(targetId);

    // Validate target is still valid
    if (!target || target.isDead) {
      this.currentAttackTargetId = null;
      return;
    }

    // Check if target is still in range (leeway for movement during animation)
    const attackRange = this.getStats().attackRange;
    const leewayRange = attackRange + 50; // Small leeway for target movement
    if (!this.isInRange(target, leewayRange)) {
      this.currentAttackTargetId = null;
      return;
    }

    const attackDamage = action.data.attackDamage as number;
    const abilityPower = action.data.abilityPower as number;

    // Raw damage; the target applies its armor in takeDamage()
    const damage = attackDamage;

    // Check if this champion is ranged
    const isRanged = this.definition.attackType === 'ranged';

    if (isRanged) {
      // Ranged champions fire a projectile that deals damage on hit
      this.fireBasicAttackProjectile(target, damage, context);
    } else {
      // Melee champions deal damage instantly
      this.applyMeleeAttackDamage(target, damage, attackDamage, abilityPower, context);
    }

    this.currentAttackTargetId = null;
  }

  /**
   * Fire a basic attack projectile for ranged champions.
   */
  private fireBasicAttackProjectile(
    target: ServerEntity,
    damage: number,
    context: ServerGameContext
  ): void {
    // Projectile speed varies by champion (Lume has light-based fast projectiles)
    const projectileSpeed = this.definition.basicAttackProjectileSpeed ?? 800;

    // Determine projectile type for rendering
    const projectileType = `${this.definition.id}_auto`;

    // Create callback to handle on-hit effects when projectile lands
    const onHitCallback = (hitTarget: ServerEntity, hitDamage: number, hitContext: ServerGameContext) => {
      this.applyOnHitBuffs(hitTarget);

      // Dispatch on_hit trigger for passives
      passiveTriggerSystem.dispatchTrigger('on_hit', this, hitContext, {
        target: hitTarget,
        damageAmount: hitDamage,
        damageType: 'physical',
      });
    };

    const projectile = new ServerTargetedProjectile({
      id: context.generateEntityId(),
      position: this.position.clone(),
      side: this.side,
      targetId: target.id,
      speed: projectileSpeed,
      radius: 5, // Small projectile for ranged basic attacks
      sourceId: this.id,
      projectileType,
      damage,
      damageType: 'physical',
      onHitCallback,
    });

    context.addEntity(projectile);

    Logger.champion.debug(
      `${this.playerId} fired basic attack projectile at ${target.id}`
    );
  }

  /**
   * Apply instant melee attack damage.
   */
  private applyMeleeAttackDamage(
    target: ServerEntity,
    damage: number,
    attackDamage: number,
    abilityPower: number,
    context: ServerGameContext
  ): void {
    target.takeDamage(damage, 'physical', this.id, context);

    // Champion-specific on-attack rules (e.g., Vex's empowered attack)
    championHooksRegistry.get(this.definition.id)?.onMeleeAttackHit?.(
      this,
      target,
      { attackDamage, abilityPower },
      context
    );

    this.applyOnHitBuffs(target);

    // Dispatch on_hit trigger AFTER attack lands
    passiveTriggerSystem.dispatchTrigger('on_hit', this, context, {
      target,
      damageAmount: damage,
      damageType: 'physical',
    });
  }

  /**
   * Schedule an ability projectile to spawn at the animation keyframe time.
   * Called by ServerAbilityExecutor for skillshot abilities with animations.
   */
  scheduleAbilityProjectile(
    abilityId: string,
    triggerTime: number,
    projectileConfig: {
      direction: Vector;
      speed: number;
      radius: number;
      maxDistance: number;
      damage: number;
      damageType: DamageType;
      piercing: boolean;
      appliesEffects?: string[];
      effectDuration?: number;
    }
  ): void {
    this.abilityAnimationScheduler.schedule({
      entityId: this.id,
      actionType: 'projectile',
      triggerTime,
      data: {
        abilityId,
        direction: { x: projectileConfig.direction.x, y: projectileConfig.direction.y },
        speed: projectileConfig.speed,
        radius: projectileConfig.radius,
        maxDistance: projectileConfig.maxDistance,
        damage: projectileConfig.damage,
        damageType: projectileConfig.damageType,
        piercing: projectileConfig.piercing,
        appliesEffects: projectileConfig.appliesEffects,
        effectDuration: projectileConfig.effectDuration,
        // Store caster position at time of scheduling for projectile spawn position
        spawnPosition: { x: this.position.x, y: this.position.y },
      },
    });
  }

  /**
   * Process scheduled ability actions (projectile spawns, etc.)
   */
  private processScheduledAbilityActions(dt: number, context: ServerGameContext): void {
    // Cancel pending ability actions if silenced or stunned
    if (!this.ccStatus.canCast) {
      this.abilityAnimationScheduler.cancelForEntity(this.id, 'projectile');
      return;
    }

    // Process scheduled ability actions
    this.abilityAnimationScheduler.update(dt, (action) => {
      if (action.actionType === 'projectile') {
        this.spawnScheduledProjectile(action, context);
      }
    });
  }

  /**
   * Spawn a projectile from a scheduled ability action.
   */
  private spawnScheduledProjectile(action: ScheduledAction, context: ServerGameContext): void {
    const data = action.data;

    // Create projectile at the caster's current position (not where they were when cast started)
    // This allows "leading" shots if the caster moves during cast
    const projectile = new ServerProjectile({
      id: context.generateEntityId(),
      position: this.position.clone(),
      side: this.side,
      direction: new Vector(
        (data.direction as { x: number; y: number }).x,
        (data.direction as { x: number; y: number }).y,
      ).normalized(),
      speed: data.speed as number,
      radius: data.radius as number,
      maxDistance: data.maxDistance as number,
      sourceId: this.id,
      abilityId: data.abilityId as string,
      damage: data.damage as number,
      damageType: data.damageType as DamageType,
      piercing: data.piercing as boolean,
      appliesEffects: data.appliesEffects as string[] | undefined,
      effectDuration: data.effectDuration as number | undefined,
    });

    context.addEntity(projectile);
  }

  /**
   * Update abilities (cooldowns and recast windows).
   */
  private updateAbilities(dt: number): void {
    const slots: AbilitySlot[] = ['Q', 'W', 'E', 'R'];
    for (const slot of slots) {
      const state = this.abilityStates[slot];
      if (state.cooldownRemaining > 0) {
        // Cooldowns tick at normal rate - CDR is applied upfront when ability is cast
        state.cooldownRemaining = Math.max(0, state.cooldownRemaining - dt);
      }
      if (state.castTimeRemaining > 0) {
        state.castTimeRemaining = Math.max(0, state.castTimeRemaining - dt);
        if (state.castTimeRemaining <= 0) {
          state.isCasting = false;
        }
      }
      // Update recast window
      if (state.recastWindowRemaining !== undefined && state.recastWindowRemaining > 0) {
        state.recastWindowRemaining = Math.max(0, state.recastWindowRemaining - dt);
        // Clear recast state when window expires
        if (state.recastWindowRemaining <= 0) {
          state.recastCount = undefined;
          state.recastWindowRemaining = undefined;
          delete this.recastHitPositions[slot];
        }
      }
    }
  }

  /**
   * Update effects (durations, over-time ticks, CC status).
   * Kept as a method so tests can tick effects directly.
   */
  private updateEffects(dt: number, context: ServerGameContext): void {
    this.effects.update(dt, context);
  }

  /**
   * Update recall.
   */
  private updateRecall(dt: number): void {
    this.recallProgress += dt;
    if (this.recallProgress >= GameConfig.TIMING.RECALL_DURATION) {
      this.completeRecall();
    }
  }

  /**
   * Start recalling.
   */
  startRecall(): boolean {
    if (this.isRecalling || this.isDead || this.inCombat) {
      return false;
    }
    this.isRecalling = true;
    this.recallProgress = 0;
    return true;
  }

  /**
   * Cancel recall.
   */
  cancelRecall(): void {
    this.isRecalling = false;
    this.recallProgress = 0;
  }

  /**
   * Complete recall (teleport to base).
   */
  private completeRecall(): void {
    this.isRecalling = false;
    this.recallProgress = 0;

    // Teleport to spawn
    const spawnPos = this.side === 0
      ? new Vector(-1100, 1100)
      : new Vector(1100, -1100);
    this.position.setFrom(spawnPos);

    // Restore health and mana
    const stats = this.getStats();
    this.health = stats.maxHealth;
    this.resource = stats.maxResource;
  }

  /**
   * Update regeneration.
   */
  private updateRegeneration(dt: number): void {
    const stats = this.getStats();
    const regenMultiplier = this.inCombat ? 1 : GameConfig.COMBAT.OOC_REGEN_MULTIPLIER;

    // Health regen
    if (this.health < stats.maxHealth) {
      this.health = Math.min(
        stats.maxHealth,
        this.health + stats.healthRegen * regenMultiplier * dt
      );
    }

    // Resource regen
    if (this.resource < stats.maxResource) {
      this.resource = Math.min(
        stats.maxResource,
        this.resource + stats.resourceRegen * regenMultiplier * dt
      );
    }
  }

  /**
   * Update trinket (ward) charges.
   */
  private updateTrinket(dt: number): void {
    // Update cooldown
    if (this.trinketCooldown > 0) {
      this.trinketCooldown = Math.max(0, this.trinketCooldown - dt);
    }

    // Recharge if not at max charges
    if (this.trinketCharges < this.trinketMaxCharges) {
      this.trinketRechargeTimer += dt;

      if (this.trinketRechargeTimer >= this.trinketRechargeTime) {
        this.trinketCharges++;
        this.trinketRechargeTimer = 0;
      }
    }
  }

  /**
   * Check if can place a ward.
   */
  canPlaceWard(): boolean {
    return this.trinketCharges > 0 && this.trinketCooldown <= 0 && !this.isDead;
  }

  /**
   * Consume a trinket charge when placing a ward.
   * Returns true if successful.
   */
  consumeTrinketCharge(): boolean {
    if (!this.canPlaceWard()) {
      return false;
    }

    this.trinketCharges--;
    this.trinketCooldown = 1; // 1 second cooldown after placing

    return true;
  }

  /**
   * Get trinket recharge progress (0-1).
   */
  getTrinketRechargeProgress(): number {
    if (this.trinketCharges >= this.trinketMaxCharges) return 1;
    return this.trinketRechargeTimer / this.trinketRechargeTime;
  }

  /**
   * Enter combat state.
   */
  enterCombat(): void {
    this.inCombat = true;
    this.timeSinceCombat = 0;
    this.cancelRecall();
  }

  // Transform state for stat transforms (like Vile's R)
  // Uses accumulated game time instead of Date.now() for testability
  private gameTimeElapsed: number = 0; // Total elapsed game time in seconds
  private transformAttackRange: number | null = null;
  private transformAttackRangeExpiry: number = 0; // Game time when transform expires
  private transformAura: {
    abilityId: string;
    radius: number;
    damage: number;
    damageType: DamageType;
    tickRate: number;
    lastTickTime: number; // Game time of last tick
    expiry: number; // Game time when aura expires
  } | null = null;

  /**
   * Set temporary attack range override during transform.
   * @param range - The new attack range
   * @param duration - Duration in seconds
   */
  setTransformAttackRange(range: number, duration: number): void {
    this.transformAttackRange = range;
    this.transformAttackRangeExpiry = this.gameTimeElapsed + duration;
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
    aura: { radius: number; damage: { type: DamageType; scaling: { base: number[] } }; tickRate: number },
    rank: number,
    duration: number
  ): void {
    const damagePerTick = aura.damage.scaling.base[rank - 1] ?? 0;

    this.transformAura = {
      abilityId,
      radius: aura.radius,
      damage: damagePerTick,
      damageType: aura.damage.type,
      tickRate: aura.tickRate,
      lastTickTime: this.gameTimeElapsed,
      expiry: this.gameTimeElapsed + duration,
    };
  }

  /**
   * Get current attack range (accounting for transform).
   */
  getAttackRange(): number {
    // Check if transform attack range is still active
    if (this.transformAttackRange !== null && this.gameTimeElapsed < this.transformAttackRangeExpiry) {
      return this.transformAttackRange;
    }
    // Clear expired transform
    if (this.transformAttackRange !== null && this.gameTimeElapsed >= this.transformAttackRangeExpiry) {
      this.transformAttackRange = null;
    }
    return this.getStats().attackRange;
  }

  /**
   * Check if currently transformed (melee mode for Vile).
   */
  isTransformed(): boolean {
    return this.transformAttackRange !== null && this.gameTimeElapsed < this.transformAttackRangeExpiry;
  }

  /**
   * Update transform aura (called each tick).
   */
  updateTransformAura(context: ServerGameContext): void {
    if (!this.transformAura) return;

    // Check if aura has expired
    if (this.gameTimeElapsed >= this.transformAura.expiry) {
      this.transformAura = null;
      return;
    }

    // Check if it's time for a tick
    const timeSinceLastTick = this.gameTimeElapsed - this.transformAura.lastTickTime;
    if (timeSinceLastTick < this.transformAura.tickRate) return;

    this.transformAura.lastTickTime = this.gameTimeElapsed;

    // Deal damage to all nearby enemies
    const entities = context.getEntitiesInRadius(this.position, this.transformAura.radius);
    for (const entity of entities) {
      if (entity.side === this.side) continue;
      if (entity.isDead) continue;
      if (entity.id === this.id) continue;

      entity.takeDamage(this.transformAura.damage, this.transformAura.damageType, this.id, context);
    }
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

    // Dispatch on_take_damage trigger
    if (context) {
      passiveTriggerSystem.dispatchTrigger('on_take_damage', this, context, {
        damageAmount: amount,
        damageType: type,
        sourceId,
      });
    }

    // Calculate damage after resistances, then let shields absorb what they can
    const { damage, absorbed: shieldAbsorbed } = this.effects.absorbDamage(
      this.calculateDamage(amount, type)
    );

    // Apply remaining damage to health
    if (damage > 0) {
      this.health = Math.max(0, this.health - damage);
    }

    // Emit damage event for client-side floating numbers
    if (context && (damage > 0 || shieldAbsorbed > 0)) {
      context.addEvent(GameEventType.DAMAGE, {
        entityId: this.id,
        amount: damage,
        damageType: type,
        sourceId,
        shieldAbsorbed,
      });
    }

    if (this.health <= 0) {
      this.onDeath(sourceId, context);
    }

    // Tower aggro: if damaged by enemy champion, trigger aggro on allied towers
    if (context && sourceId && damage > 0) {
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
            if (tower.isInRange(sourceEntity)) {
              tower.triggerAggro(sourceId);
            }
          }
        }
      }
    }

    return damage;
  }

  /**
   * Calculate damage after resistances.
   */
  protected override calculateDamage(amount: number, type: DamageType): number {
    if (type === 'true' || type === 'pure') {
      return amount;
    }

    const stats = this.getStats();
    if (type === 'physical') {
      return calculatePhysicalDamage(amount, stats.armor);
    } else if (type === 'magic') {
      return calculateMagicDamage(amount, stats.magicResist);
    }

    return amount;
  }

  /**
   * Handle death.
   */
  protected override onDeath(killerId?: string, context?: ServerGameContext): void {
    super.onDeath(killerId, context);
    this.deaths++;

    // Award XP/gold to killer and nearby allies
    if (context) {
      RewardSystem.awardKillRewards(this, killerId, context);
    }

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

  /**
   * Get current stats (with modifiers).
   */
  getStats(): ChampionStats {
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

  /**
   * On-hit effects from jungle buffs: with red buff, basic attacks burn and
   * slow champions and minions.
   */
  private applyOnHitBuffs(target: ServerEntity): void {
    if (!this.getEffect('crest_of_cinders') || target.isDead) return;
    if (target.entityType !== EntityType.CHAMPION && target.entityType !== EntityType.MINION) return;

    const affected = target as ServerEntity & { applyEffect(effectId: string, duration: number, sourceId?: string): void };
    affected.applyEffect('cinders_burn', 3, this.id);
    affected.applyEffect('slow_10', 1.5, this.id);
  }

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

  /**
   * Level up an ability.
   */
  levelUpAbility(slot: AbilitySlot): boolean {
    if (this.skillPoints <= 0) {
      return false;
    }

    const currentRank = this.abilityRanks[slot];
    const maxRank = getAbilityDefinition(this.definition.abilities[slot])?.maxRank ?? (slot === 'R' ? 3 : 5);

    // R ability has special level requirements (and stops at the last one)
    if (slot === 'R') {
      const rRequiredLevels = [6, 11, 16];
      if (currentRank >= rRequiredLevels.length || this.level < rRequiredLevels[currentRank]) {
        return false;
      }
    }

    if (currentRank >= maxRank) {
      return false;
    }

    this.abilityRanks[slot]++;
    this.abilityStates[slot].rank = this.abilityRanks[slot];
    this.skillPoints--;

    // Logger.champion.info(`${this.playerId} leveled ${slot} to rank ${this.abilityRanks[slot]}`);
    return true;
  }

  // =====================
  // Recast System
  // =====================

  /**
   * Enable recast for an ability (called when projectile hits).
   * @param slot - The ability slot to enable recast for
   * @param hitPosition - The position where the projectile hit
   * @param maxRecasts - Maximum number of recasts (default 1)
   * @param recastWindow - Time window for recast in seconds
   */
  enableRecast(slot: AbilitySlot, hitPosition: Vector, maxRecasts: number, recastWindow: number): void {
    const state = this.abilityStates[slot];
    state.recastCount = maxRecasts;
    state.recastWindowRemaining = recastWindow;
    this.recastHitPositions[slot] = hitPosition.clone();
    Logger.champion.debug(`${this.playerId} ${slot} recast enabled at (${hitPosition.x.toFixed(0)}, ${hitPosition.y.toFixed(0)}) for ${recastWindow}s`);
  }

  /**
   * Check if an ability has recast available.
   */
  hasRecastAvailable(slot: AbilitySlot): boolean {
    const state = this.abilityStates[slot];
    return (state.recastCount ?? 0) > 0 && (state.recastWindowRemaining ?? 0) > 0;
  }

  /**
   * Get the recast hit position for an ability.
   * @returns The hit position or undefined if no recast available
   */
  getRecastHitPosition(slot: AbilitySlot): Vector | undefined {
    return this.recastHitPositions[slot];
  }

  /**
   * Consume a recast (called when recast is used).
   */
  consumeRecast(slot: AbilitySlot): void {
    const state = this.abilityStates[slot];
    if (state.recastCount !== undefined && state.recastCount > 0) {
      state.recastCount--;
      if (state.recastCount <= 0) {
        state.recastCount = undefined;
        state.recastWindowRemaining = undefined;
        delete this.recastHitPositions[slot];
      }
    }
  }

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
    this.experienceToNextLevel = LEVEL_EXPERIENCE[this.level] ?? LEVEL_EXPERIENCE[17];

    // Heal percentage of new max health
    const stats = this.getStats();
    this.health = Math.min(stats.maxHealth, this.health + stats.maxHealth * 0.1);
    this.resource = Math.min(stats.maxResource, this.resource + stats.maxResource * 0.1);

    this.cachedStats = null;
  }

  // =====================
  // Item System
  // =====================

  /**
   * Buy an item.
   * @returns true if purchase succeeded
   */
  buyItem(itemId: string): boolean {
    const itemDef = getServerItemById(itemId);
    if (!itemDef) {
      return false;
    }

    // Check gold
    if (this.gold < itemDef.cost) {
      return false;
    }

    // Check if unique and already owned
    if (itemDef.isUnique && this.hasItem(itemId)) {
      return false;
    }

    // Find empty slot
    const emptySlot = this.findEmptySlot();
    if (emptySlot === null) {
      return false;
    }

    // Deduct gold and add item
    this.gold -= itemDef.cost;
    this.totalGoldSpent += itemDef.cost;
    this.items[emptySlot] = {
      definitionId: itemId,
      slot: emptySlot as ItemSlot,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    // Invalidate cached stats
    this.cachedStats = null;

    Logger.champion.info(`${this.playerId} bought ${itemDef.name} for ${itemDef.cost}g`);
    return true;
  }

  /**
   * Sell an item from a specific slot.
   * @returns gold gained, or 0 if failed
   */
  sellItem(slot: number): number {
    if (slot < 0 || slot >= 6) {
      return 0;
    }

    const item = this.items[slot];
    if (!item) {
      return 0;
    }

    const itemDef = getServerItemById(item.definitionId);
    if (!itemDef) {
      return 0;
    }

    // Add gold and remove item
    const goldGained = itemDef.sellValue;
    this.gold += goldGained;
    this.items[slot] = null;

    // Invalidate cached stats
    this.cachedStats = null;

    Logger.champion.info(`${this.playerId} sold ${itemDef.name} for ${goldGained}g`);
    return goldGained;
  }

  /**
   * Check if champion has a specific item.
   */
  hasItem(itemId: string): boolean {
    return this.items.some(item => item?.definitionId === itemId);
  }

  /**
   * Find first empty inventory slot.
   */
  private findEmptySlot(): ItemSlot | null {
    for (let i = 0; i < 6; i++) {
      if (!this.items[i]) {
        return i as ItemSlot;
      }
    }
    return null;
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

  /**
   * Convert to network snapshot.
   */
  toSnapshot(): ChampionSnapshot {
    const stats = this.getStats();

    return {
      entityId: this.id,
      entityType: EntityType.CHAMPION,
      side: this.side,
      championId: this.definition.id,
      playerId: this.playerId,

      x: this.position.x,
      y: this.position.y,
      // Use null for cleared values (not undefined) for proper delta updates
      targetX: this.targetPosition?.x ?? null,
      targetY: this.targetPosition?.y ?? null,
      targetEntityId: this.targetEntityId,

      health: this.health,
      maxHealth: stats.maxHealth,
      resource: this.resource,
      maxResource: stats.maxResource,
      level: this.level,
      experience: this.experience,
      experienceToNextLevel: this.experienceToNextLevel,
      skillPoints: this.skillPoints,

      attackDamage: stats.attackDamage,
      abilityPower: stats.abilityPower,
      armor: stats.armor,
      magicResist: stats.magicResist,
      attackSpeed: stats.attackSpeed,
      movementSpeed: stats.movementSpeed,

      isDead: this.isDead,
      respawnTimer: this.respawnTimer,
      isRecalling: this.isRecalling,
      recallProgress: this.recallProgress,

      // Dash state for ability animations
      isDashing: this.forcedMovement?.type === 'dash' && this.dashAbilityId != null,
      dashTargetX: this.forcedMovement ? this.position.x + this.forcedMovement.direction.x * (this.forcedMovement.distance - this.forcedMovement.elapsed * (this.forcedMovement.distance / this.forcedMovement.duration)) : undefined,
      dashTargetY: this.forcedMovement ? this.position.y + this.forcedMovement.direction.y * (this.forcedMovement.distance - this.forcedMovement.elapsed * (this.forcedMovement.distance / this.forcedMovement.duration)) : undefined,
      dashAbilityId: this.dashAbilityId ?? undefined,

      abilities: {
        Q: { ...this.abilityStates.Q },
        W: { ...this.abilityStates.W },
        E: { ...this.abilityStates.E },
        R: { ...this.abilityStates.R },
      },
      passive: {
        isActive: this.passiveState.isActive,
        cooldownRemaining: this.passiveState.cooldownRemaining,
        stacks: this.passiveState.stacks,
        stackTimeRemaining: this.passiveState.stackTimeRemaining,
      },
      activeEffects: this.activeEffects.map(e => ({ ...e })),
      shields: this.shields.map(s => ({
        amount: s.amount,
        remainingDuration: s.remainingDuration,
        sourceId: s.sourceId ?? 'unknown',
        shieldType: s.shieldType ?? 'normal',
      })),
      items: this.items.map(i => i ? { ...i } : null),
      gold: this.gold,

      kills: this.kills,
      deaths: this.deaths,
      assists: this.assists,
      cs: this.cs,

      trinketCharges: this.trinketCharges,
      trinketMaxCharges: this.trinketMaxCharges,
      trinketCooldown: this.trinketCooldown,
      trinketRechargeProgress: this.getTrinketRechargeProgress(),
    };
  }
}
