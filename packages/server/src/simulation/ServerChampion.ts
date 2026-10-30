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
  createDefaultPassiveState,
  DEFAULT_CHAMPION_COLLISION,
  type EntityCollision,
} from '@siege/shared';
import { ServerEntity, ServerEntityConfig } from './ServerEntity';
import { ServerTower } from './ServerTower';
import type { ServerGameContext } from '../game/ServerGameContext';
import { getServerItemById } from '../data/items';
import { RewardSystem } from '../systems/RewardSystem';
import { passiveTriggerSystem } from '../systems/PassiveTriggerSystem';
import { championHooksRegistry } from '../abilities/ChampionHooksRegistry';
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
import {
  updateForcedMovement,
  remainingForcedMovementDistance,
  type ForcedMovement,
} from './champion/ChampionForcedMovement';
import { ChampionRecall } from './champion/ChampionRecall';
import { ChampionTrinket } from './champion/ChampionTrinket';

export interface ServerChampionConfig extends Omit<ServerEntityConfig, 'entityType'> {
  definition: ChampionDefinition;
  playerId: string;
}

export type { ActiveShield, ForcedMovement };

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
  private readonly recall = new ChampionRecall(this);

  // Stats
  private statModifiers: StatModifier[] = [];
  private cachedStats: ChampionStats | null = null;

  // Abilities
  abilityRanks: Record<AbilitySlot, number> = { Q: 0, W: 0, E: 0, R: 0 };
  abilityCooldowns: Record<AbilitySlot, number> = { Q: 0, W: 0, E: 0, R: 0 };
  abilityStates: Record<AbilitySlot, AbilityState> = {
    Q: createDefaultAbilityState(),
    W: createDefaultAbilityState(),
    E: createDefaultAbilityState(),
    R: createDefaultAbilityState(),
  };
  private readonly abilities = new ChampionAbilities(this);

  // Transforms (Vile's R: attack range override and damage aura)
  private readonly transform = new ChampionTransform(this);

  // Effects
  activeEffects: ActiveEffectState[] = [];
  ccStatus: CrowdControlStatus = defaultCCStatus();
  private readonly effects = new ChampionEffects(this);

  // Items
  items: (EquippedItemState | null)[] = [null, null, null, null, null, null];
  gold = GameConfig.ECONOMY.STARTING_GOLD;
  totalGoldSpent = 0;

  // Basic attacks (attack timer, pending attack damage)
  private readonly basicAttacks = new ChampionBasicAttacks(this);

  // Combat tracking
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
  private readonly trinket = new ChampionTrinket(this);

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

    // Update forced movement first
    if (this.forcedMovement) {
      updateForcedMovement(this, dt, context);
    } else if (this.ccStatus.canMove) {
      // Normal movement
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
      this.recall.update(dt);
    }

    // Regeneration (out of combat)
    this.updateRegeneration(dt);

    // Update trinket (ward) charges
    this.trinket.update(dt);

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
   * Update combat state.
   */
  private updateCombat(dt: number, context: ServerGameContext): void {
    // Update attack cooldown
    this.basicAttacks.updateCooldown(dt);

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
    this.basicAttacks.attackTargetIfReady(context);
  }

  /**
   * Update effects (durations, over-time ticks, CC status).
   * Kept as a method so tests can tick effects directly.
   */
  private updateEffects(dt: number, context: ServerGameContext): void {
    this.effects.update(dt, context);
  }

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

  /**
   * Enter combat state.
   */
  enterCombat(): void {
    this.inCombat = true;
    this.timeSinceCombat = 0;
    this.cancelRecall();
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
    return this.transform.getAttackRange();
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
   * Called by ServerAbilityExecutor for skillshot abilities with animations.
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
      dashTargetX: this.forcedMovement ? this.position.x + this.forcedMovement.direction.x * remainingForcedMovementDistance(this.forcedMovement) : undefined,
      dashTargetY: this.forcedMovement ? this.position.y + this.forcedMovement.direction.y * remainingForcedMovementDistance(this.forcedMovement) : undefined,
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
