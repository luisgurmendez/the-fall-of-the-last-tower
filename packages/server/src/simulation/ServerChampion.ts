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
  calculateStat,
  calculateAttackSpeed,
  LEVEL_EXPERIENCE,
  defaultCCStatus,
  calculatePhysicalDamage,
  calculateMagicDamage,
  GameConfig,
} from '@siege/shared';
import { ServerEntity, ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

export interface ServerChampionConfig extends Omit<ServerEntityConfig, 'entityType'> {
  definition: ChampionDefinition;
  playerId: string;
}

export interface ActiveShield {
  amount: number;
  remainingDuration: number;
  sourceId?: string;
}

export interface ForcedMovement {
  direction: Vector;
  distance: number;
  duration: number;
  elapsed: number;
  type: 'dash' | 'knockback';
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
  kills = 0;
  deaths = 0;
  assists = 0;
  cs = 0;  // Creep score

  // Shields and forced movement
  shields: ActiveShield[] = [];
  forcedMovement: ForcedMovement | null = null;

  // Direction facing
  direction: Vector = new Vector(1, 0);

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
    if (this.isDead) {
      this.updateDead(dt, context);
      return;
    }

    // Update forced movement first
    if (this.forcedMovement) {
      this.updateForcedMovement(dt);
    } else if (this.ccStatus.canMove) {
      // Normal movement
      this.updateMovement(dt, context);
    }

    // Update combat state
    this.updateCombat(dt, context);

    // Update abilities
    this.updateAbilities(dt);

    // Update effects
    this.updateEffects(dt);

    // Update shields
    this.updateShields(dt);

    // Update recall
    if (this.isRecalling) {
      this.updateRecall(dt);
    }

    // Regeneration (out of combat)
    this.updateRegeneration(dt);

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
        this.targetPosition = target.position.clone();
      } else {
        this.targetEntityId = null;
        this.targetPosition = null;
        return;
      }
    }

    if (this.targetPosition) {
      this.moveToward(this.targetPosition, dt);

      // Update facing direction
      const dir = this.targetPosition.subtracted(this.position);
      if (dir.length() > 0.1) {
        this.direction = dir.normalized();
      }
    }
  }

  /**
   * Update forced movement (dash/knockback).
   */
  private updateForcedMovement(dt: number): void {
    if (!this.forcedMovement) return;

    const fm = this.forcedMovement;
    fm.elapsed += dt;

    const progress = Math.min(fm.elapsed / fm.duration, 1);
    const moveDistance = fm.distance * (progress - (fm.elapsed - dt) / fm.duration);

    const movement = fm.direction.clone().scalar(moveDistance);
    this.position.add(movement);

    if (fm.elapsed >= fm.duration) {
      this.forcedMovement = null;
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
   */
  private performBasicAttack(target: ServerEntity, context: ServerGameContext): void {
    const stats = this.getStats();
    const baseDamage = stats.attackDamage;

    // Calculate damage
    const damage = calculatePhysicalDamage(baseDamage, 0); // TODO: Get target armor

    // Deal damage
    target.takeDamage(damage, 'physical', this.id);

    // Set attack cooldown
    this.attackCooldown = 1 / stats.attackSpeed;

    // Enter combat
    this.enterCombat();
  }

  /**
   * Update abilities (cooldowns).
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
    }
  }

  /**
   * Update effects.
   */
  private updateEffects(dt: number): void {
    // Update effect timers
    this.activeEffects = this.activeEffects.filter(effect => {
      effect.timeRemaining -= dt;
      return effect.timeRemaining > 0;
    });

    // Recalculate CC status
    // TODO: Implement proper CC calculation based on effect definitions
    this.ccStatus = defaultCCStatus();
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
  override takeDamage(amount: number, type: DamageType, sourceId?: string): number {
    if (this.isDead) return 0;

    this.enterCombat();

    // Calculate damage after resistances
    let damage = this.calculateDamage(amount, type);

    // Apply shields first
    for (const shield of this.shields) {
      if (shield.amount >= damage) {
        shield.amount -= damage;
        return 0; // All damage absorbed
      } else {
        damage -= shield.amount;
        shield.amount = 0;
      }
    }

    // Apply remaining damage to health
    this.health = Math.max(0, this.health - damage);

    if (this.health <= 0) {
      this.onDeath(sourceId);
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
  protected override onDeath(killerId?: string): void {
    super.onDeath(killerId);
    this.deaths++;

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

    // Apply modifiers
    for (const modifier of this.statModifiers) {
      this.applyStatModifier(stats, modifier);
    }

    // Apply item stats
    for (const item of this.items) {
      if (item) {
        // TODO: Apply item stats
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
    if (this.skillPoints <= 0) return false;

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

    if (currentRank >= maxRank) return false;

    this.abilityRanks[slot]++;
    this.abilityStates[slot].rank = this.abilityRanks[slot];
    this.skillPoints--;

    return true;
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

      abilities: this.abilityStates,
      activeEffects: this.activeEffects,
      items: this.items,
      gold: this.gold,

      kills: this.kills,
      deaths: this.deaths,
      assists: this.assists,
      cs: this.cs,
    };
  }
}
