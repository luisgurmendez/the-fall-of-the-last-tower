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
  Side,
  DamageType,
  ChampionSnapshot,
  AbilitySlot,
  AbilityState,
  ChampionDefinition,
  ChampionBaseStats,
  ChampionStats,
  ChampionGrowthStats,
  StatModifier,
  ActiveEffectState,
  CrowdControlStatus,
  EquippedItemState,
  ItemSlot,
  PassiveState,
  PassiveStateSnapshot,
  calculateStat,
  calculateAttackSpeed,
  LEVEL_EXPERIENCE,
  defaultCCStatus,
  calculatePhysicalDamage,
  calculateMagicDamage,
  GameConfig,
  GameEventType,
  getPassiveDefinition,
  createDefaultPassiveState,
  getAbilityDefinition,
  calculateAbilityValue,
} from '@siege/shared';
import { ServerEntity, ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import {
  getServerItemById,
  type ServerItemDefinition,
} from '../data/items';
import { AnimationScheduler, type ScheduledAction } from '../systems/AnimationScheduler';
import {
  getServerEffectById,
  isCCEffect,
  isStatEffect,
  isOverTimeEffect,
  isInvulnerabilityEffect,
  type AnyServerEffectDef,
  type ServerCCEffectDef,
  type ServerStatEffectDef,
  type ServerOverTimeEffectDef,
} from '../data/effects';
import { RewardSystem } from '../systems/RewardSystem';
import { passiveTriggerSystem } from '../systems/PassiveTriggerSystem';
import { Logger } from '../utils/Logger';
import { ServerProjectile } from './ServerProjectile';

export interface ServerChampionConfig extends Omit<ServerEntityConfig, 'entityType'> {
  definition: ChampionDefinition;
  playerId: string;
}

export interface ActiveShield {
  amount: number;
  remainingDuration: number;
  sourceId: string;
  /** Shield type for visual styling - defaults to 'normal' if not specified */
  shieldType?: 'normal' | 'magic' | 'physical' | 'passive';
}

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
    const debugLevel = GameConfig.DEBUG?.STARTING_LEVEL ?? 1;
    if (debugLevel > 1) {
      this.level = debugLevel;
      this.skillPoints = GameConfig.DEBUG?.STARTING_SKILL_POINTS ?? debugLevel;
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
    this.updateShields(dt);

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

    // Calculate and deal damage
    const damage = calculatePhysicalDamage(attackDamage, 0); // TODO: Get target armor
    target.takeDamage(damage, 'physical', this.id, context);

    // Check for empowered attack (Vex Shadow Step)
    const empoweredEffect = this.activeEffects.find(e => e.definitionId === 'vex_empowered');
    if (empoweredEffect) {
      const dashAbility = getAbilityDefinition('vex_dash');
      if (dashAbility?.damage) {
        const abilityRank = this.abilityStates.E.rank;
        if (abilityRank > 0) {
          const bonusDamage = calculateAbilityValue(
            dashAbility.damage.scaling,
            abilityRank,
            { attackDamage, abilityPower }
          );
          target.takeDamage(bonusDamage, dashAbility.damage.type, this.id, context);
          Logger.champion.debug(
            `${this.playerId} empowered attack dealt ${bonusDamage} bonus damage`
          );
        }
      }
      // Remove the empowered effect (consumed on attack)
      this.activeEffects = this.activeEffects.filter(e => e.definitionId !== 'vex_empowered');
    }

    // Dispatch on_hit trigger AFTER attack lands
    passiveTriggerSystem.dispatchTrigger('on_hit', this, context, {
      target,
      damageAmount: damage,
      damageType: 'physical',
    });

    this.currentAttackTargetId = null;
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
      direction: new Vector(data.direction.x as number, data.direction.y as number).normalized(),
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
   * Update effects.
   */
  private updateEffects(dt: number, context: ServerGameContext): void {
    // Process over-time effects and update timers
    this.activeEffects = this.activeEffects.filter(effect => {
      const def = getServerEffectById(effect.definitionId);

      // Handle over-time effects (DoT/HoT)
      if (def && isOverTimeEffect(def)) {
        this.processOverTimeEffect(effect, def, dt, context);
      }

      // Update timer
      effect.timeRemaining -= dt;
      return effect.timeRemaining > 0;
    });

    // Recalculate CC status from active effects
    this.ccStatus = this.calculateCCStatus();

    // Invalidate cached stats (effects may modify stats)
    this.cachedStats = null;
  }

  /**
   * Process an over-time effect tick.
   */
  private processOverTimeEffect(
    effect: ActiveEffectState,
    def: ServerOverTimeEffectDef,
    dt: number,
    context: ServerGameContext
  ): void {
    // Initialize nextTickIn if not set
    if (effect.nextTickIn === undefined) {
      effect.nextTickIn = def.tickInterval;
    }

    // Countdown to next tick
    effect.nextTickIn -= dt;

    // Process tick when timer reaches 0
    while (effect.nextTickIn <= 0) {
      const tickValue = def.valuePerTick * effect.stacks;

      switch (def.otType) {
        case 'damage':
          // Apply damage (DoT)
          this.takeDamage(tickValue, def.damageType || 'magic', effect.sourceId, context);
          break;
        case 'heal':
          // Apply healing (HoT)
          this.heal(tickValue);
          break;
        case 'mana_drain':
          // Drain mana
          this.resource = Math.max(0, this.resource - tickValue);
          break;
        case 'mana_restore':
          // Restore mana
          const stats = this.getStats();
          this.resource = Math.min(stats.maxResource, this.resource + tickValue);
          break;
      }

      // Reset tick timer
      effect.nextTickIn += def.tickInterval;
    }
  }

  /**
   * Calculate CC status from active effects.
   */
  private calculateCCStatus(): CrowdControlStatus {
    const status: CrowdControlStatus = {
      isStunned: false,
      isSilenced: false,
      isGrounded: false,
      isRooted: false,
      isDisarmed: false,
      canMove: true,
      canAttack: true,
      canCast: true,
      canUseMobilityAbilities: true,
    };

    for (const effect of this.activeEffects) {
      const def = getServerEffectById(effect.definitionId);
      if (!def || !isCCEffect(def)) continue;

      switch (def.ccType) {
        case 'stun':
        case 'knockup':
        case 'knockback':
        case 'suppress':
          status.isStunned = true;
          break;
        case 'silence':
          status.isSilenced = true;
          break;
        case 'grounded':
          status.isGrounded = true;
          break;
        case 'root':
          status.isRooted = true;
          break;
        case 'disarm':
        case 'blind':
          status.isDisarmed = true;
          break;
        case 'slow':
          // Slow doesn't set a flag, it modifies movement speed via stat effect
          break;
      }
    }

    // Compute ability to act
    status.canMove = !status.isStunned && !status.isRooted;
    status.canAttack = !status.isStunned && !status.isDisarmed;
    status.canCast = !status.isStunned && !status.isSilenced;
    status.canUseMobilityAbilities = status.canMove && status.canCast && !status.isGrounded;

    return status;
  }

  /**
   * Update shields.
   */
  private updateShields(dt: number): void {
    this.shields = this.shields.filter(shield => {
      shield.remainingDuration -= dt;
      return shield.remainingDuration > 0 && shield.amount > 0;
    });
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

  /**
   * Break stealth effect (called when attacking or using abilities).
   */
  breakStealth(): void {
    // Remove stealth effects
    this.activeEffects = this.activeEffects.filter(
      e => e.definitionId !== 'vex_stealth' &&
           !e.definitionId.includes('stealth') &&
           !e.definitionId.includes('invisible')
    );
  }

  /**
   * Check if champion is currently invulnerable.
   */
  isInvulnerable(): boolean {
    for (const effect of this.activeEffects) {
      const def = getServerEffectById(effect.definitionId);
      if (def && isInvulnerabilityEffect(def)) {
        return true;
      }
    }
    return false;
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
    damageType: 'physical' | 'magic' | 'true';
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
    aura: { radius: number; damage: { type: 'physical' | 'magic' | 'true'; scaling: { base: number[] } }; tickRate: number },
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

    // Calculate damage after resistances
    let damage = this.calculateDamage(amount, type);
    const damageAfterResist = damage;

    // Track shield absorption
    let shieldAbsorbed = 0;

    // Apply shields first
    for (const shield of this.shields) {
      if (shield.amount >= damage) {
        shieldAbsorbed += damage;
        shield.amount -= damage;
        damage = 0;
        break;
      } else {
        shieldAbsorbed += shield.amount;
        damage -= shield.amount;
        shield.amount = 0;
      }
    }

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
    this.isRecalling = false;
    this.recallProgress = 0;
  }

  /**
   * Get current stats (with modifiers).
   */
  getStats(): ChampionStats {
    if (this.cachedStats) {
      return this.cachedStats;
    }

    const base = this.definition.baseStats;
    const growth = this.definition.growthStats;
    const level = this.level;

    const stats: ChampionStats = {
      health: this.health,
      maxHealth: calculateStat(base.health, growth.health, level),
      healthRegen: calculateStat(base.healthRegen, growth.healthRegen, level),
      resource: this.resource,
      maxResource: calculateStat(base.resource, growth.resource, level),
      resourceRegen: calculateStat(base.resourceRegen, growth.resourceRegen, level),
      attackDamage: calculateStat(base.attackDamage, growth.attackDamage, level),
      abilityPower: base.abilityPower,
      attackSpeed: calculateAttackSpeed(base.attackSpeed, growth.attackSpeed, level),
      attackRange: base.attackRange,
      armor: calculateStat(base.armor, growth.armor, level),
      magicResist: calculateStat(base.magicResist, growth.magicResist, level),
      movementSpeed: base.movementSpeed,
      critChance: base.critChance,
      critDamage: base.critDamage,
      level,
    };

    // Apply modifiers from abilities/buffs
    for (const modifier of this.statModifiers) {
      this.applyStatModifier(stats, modifier);
    }

    // Apply item stats
    for (const item of this.items) {
      if (item) {
        const itemDef = getServerItemById(item.definitionId);
        if (itemDef) {
          this.applyItemStats(stats, itemDef);
        }
      }
    }

    // Apply effect stat modifiers (buffs/debuffs)
    for (const effect of this.activeEffects) {
      const effectDef = getServerEffectById(effect.definitionId);
      if (effectDef && isStatEffect(effectDef)) {
        this.applyEffectStatModifier(stats, effectDef, effect.stacks);
      }
    }

    // Update cached values
    this.maxHealth = stats.maxHealth;
    this.maxResource = stats.maxResource;
    this.movementSpeed = stats.movementSpeed;

    this.cachedStats = stats;
    return stats;
  }

  /**
   * Apply a stat modifier.
   */
  private applyStatModifier(stats: ChampionStats, modifier: StatModifier): void {
    if (modifier.flat) {
      for (const [key, value] of Object.entries(modifier.flat)) {
        const statKey = key as keyof ChampionBaseStats;
        if (statKey in stats && typeof value === 'number') {
          (stats as unknown as Record<string, number>)[statKey] += value;
        }
      }
    }

    if (modifier.percent) {
      for (const [key, value] of Object.entries(modifier.percent)) {
        const statKey = key as keyof ChampionBaseStats;
        if (statKey in stats && typeof value === 'number') {
          (stats as unknown as Record<string, number>)[statKey] *= value;
        }
      }
    }
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
   * Apply item stats to champion stats.
   */
  private applyItemStats(stats: ChampionStats, itemDef: ServerItemDefinition): void {
    for (const [key, value] of Object.entries(itemDef.stats)) {
      const statKey = key as keyof ChampionBaseStats;
      if (statKey in stats && typeof value === 'number') {
        // Special handling for attack speed (percentage based)
        if (statKey === 'attackSpeed') {
          stats.attackSpeed *= (1 + value);
        } else if (statKey === 'health') {
          stats.maxHealth += value;
        } else if (statKey === 'resource') {
          stats.maxResource += value;
        } else {
          (stats as unknown as Record<string, number>)[statKey] += value;
        }
      }
    }
  }

  /**
   * Apply effect stat modifier to champion stats.
   */
  private applyEffectStatModifier(
    stats: ChampionStats,
    effectDef: ServerStatEffectDef,
    stacks: number
  ): void {
    // Map effect stat type to ChampionStats key
    // Note: lifesteal/spell_vamp/penetration are not in ChampionStats, handled separately
    const statMap: Record<string, keyof ChampionStats> = {
      'attack_damage': 'attackDamage',
      'ability_power': 'abilityPower',
      'armor': 'armor',
      'magic_resist': 'magicResist',
      'attack_speed': 'attackSpeed',
      'movement_speed': 'movementSpeed',
      'health_regen': 'healthRegen',
      'mana_regen': 'resourceRegen',
      'crit_chance': 'critChance',
      'crit_damage': 'critDamage',
    };

    const statKey = statMap[effectDef.stat];
    if (!statKey || !(statKey in stats)) return;

    // Apply flat value (multiplied by stacks)
    if (effectDef.flatValue !== undefined) {
      (stats as unknown as Record<string, number>)[statKey] += effectDef.flatValue * stacks;
    }

    // Apply percent value (compounded by stacks)
    if (effectDef.percentValue !== undefined) {
      const multiplier = Math.pow(1 + effectDef.percentValue, stacks);
      (stats as unknown as Record<string, number>)[statKey] *= multiplier;
    }
  }

  /**
   * Apply an effect to this champion.
   */
  applyEffect(effectId: string, duration: number, sourceId?: string, stacks = 1): void {
    const def = getServerEffectById(effectId);
    if (!def) {
      Logger.champion.warn(`Unknown effect: ${effectId}`);
      return;
    }

    // Check for existing effect
    const existing = this.activeEffects.find(e => e.definitionId === effectId);

    if (existing) {
      // Handle stack behavior
      switch (def.stackBehavior) {
        case 'refresh':
          existing.timeRemaining = duration;
          existing.totalDuration = duration; // Update total for timer display
          break;
        case 'extend':
          existing.timeRemaining += duration;
          existing.totalDuration = existing.timeRemaining; // Total becomes extended duration
          break;
        case 'stack':
          if (!def.maxStacks || existing.stacks < def.maxStacks) {
            existing.stacks += stacks;
          }
          existing.timeRemaining = duration; // Usually refresh on stack
          existing.totalDuration = duration;
          break;
        case 'replace':
          existing.timeRemaining = duration;
          existing.totalDuration = duration;
          existing.stacks = stacks;
          break;
        case 'ignore':
          // Do nothing
          break;
      }
    } else {
      // Add new effect
      const newEffect: ActiveEffectState = {
        definitionId: effectId,
        sourceId,
        timeRemaining: duration,
        totalDuration: duration, // Track initial duration for timer display
        stacks,
        instanceId: `${effectId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // Initialize over-time effect tick timer
      if (isOverTimeEffect(def)) {
        newEffect.nextTickIn = def.tickInterval;
      }

      this.activeEffects.push(newEffect);
    }

    // Invalidate cached stats and recalculate CC status
    this.cachedStats = null;
    this.ccStatus = this.calculateCCStatus();
  }

  /**
   * Remove an effect from this champion.
   */
  removeEffect(effectId: string): boolean {
    const index = this.activeEffects.findIndex(e => e.definitionId === effectId);
    if (index === -1) return false;

    this.activeEffects.splice(index, 1);
    this.cachedStats = null;
    this.ccStatus = this.calculateCCStatus();
    return true;
  }

  /**
   * Remove all effects matching a category.
   */
  removeEffectsByCategory(category: 'buff' | 'debuff' | 'neutral'): number {
    const before = this.activeEffects.length;
    this.activeEffects = this.activeEffects.filter(e => {
      const def = getServerEffectById(e.definitionId);
      return def?.category !== category;
    });
    this.cachedStats = null;
    this.ccStatus = this.calculateCCStatus();
    return before - this.activeEffects.length;
  }

  /**
   * Cleanse all cleansable debuffs.
   */
  cleanse(): number {
    const before = this.activeEffects.length;
    this.activeEffects = this.activeEffects.filter(e => {
      const def = getServerEffectById(e.definitionId);
      // Keep if not a debuff, or if not cleansable
      return def?.category !== 'debuff' || !def.cleansable;
    });
    this.cachedStats = null;
    this.ccStatus = this.calculateCCStatus();
    return before - this.activeEffects.length;
  }

  /**
   * Check if champion has a specific effect.
   */
  hasEffect(effectId: string): boolean {
    return this.activeEffects.some(e => e.definitionId === effectId);
  }

  /**
   * Get an active effect by ID.
   */
  getEffect(effectId: string): ActiveEffectState | undefined {
    return this.activeEffects.find(e => e.definitionId === effectId);
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
    const maxRank = 5; // TODO: Get from ability definition

    // R ability has special level requirements
    if (slot === 'R') {
      const rRequiredLevels = [6, 11, 16];
      const currentRRank = this.abilityRanks.R;
      if (this.level < rRequiredLevels[currentRRank]) {
        return false;
      }
    }

    if (currentRank >= maxRank) {
      return false;
    }

    this.abilityRanks[slot]++;
    this.abilityStates[slot].rank = this.abilityRanks[slot];
    this.skillPoints--;

    Logger.champion.info(`${this.playerId} leveled ${slot} to rank ${this.abilityRanks[slot]}`);
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
   */
  override getRadius(): number {
    const collision = this.definition.collision;
    if (collision && collision.type === 'circle') {
      return collision.radius;
    }
    return 25; // Default if no collision defined
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
      targetX: this.targetPosition?.x,
      targetY: this.targetPosition?.y,
      targetEntityId: this.targetEntityId ?? undefined,

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
