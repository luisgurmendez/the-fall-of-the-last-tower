/**
 * Abstract base class for all champions.
 *
 * Champions are powerful units with:
 * - Health and mana (or other resource)
 * - 4 abilities (Q, W, E, R)
 * - Stats that grow with level
 * - Effects/buffs/debuffs system
 *
 * This class uses explicit properties instead of mixins for clarity.
 */

import Vector from '@/physics/vector';
import { Circle, Shape } from '@/objects/shapes';
import GameContext from '@/core/gameContext';
import Disposable from '@/behaviors/disposable';
import Renderable from '@/behaviors/renderable';
import Stepable from '@/behaviors/stepable';
import Initializable from '@/behaviors/initializable';
import RenderElement from '@/render/renderElement';
import RandomUtils from '@/utils/random';
import { Side } from '@/types';
import Ability from '@/abilities/Ability';
import { AbilitySlot, AbilityCastContext } from '@/abilities/types';
import { TargetedProjectile } from '@/abilities/projectiles/TargetedProjectile';
import {
  ChampionDefinition,
  ChampionState,
  ChampionStats,
  ChampionBaseStats,
  StatModifier,
  calculateStat,
  calculateAttackSpeed,
  LEVEL_EXPERIENCE,
} from './types';
import {
  ActiveEffect,
  CrowdControlStatus,
  computeCCStatus,
} from '@/effects/types';
import type { BasicAttackModifier } from '@/effects/BasicAttackEnhancementEffect';
import type {
  ItemDefinition,
  EquippedItem,
  ItemSlot,
  ChampionInventory,
  ItemPassiveTrigger,
  ItemPurchaseResult,
} from '@/items/types';
import type {
  IGameUnit,
  UnitType,
  UnitSide,
  DamageType,
  UnitBaseStats,
  UnitReward,
  TeamId,
} from '@/units/types';
import { Trinket, Ward } from '@/objects/ward';
import {
  TargetingPolicy,
  AutoTargetingPolicy,
  DEFAULT_AI_POLICY,
} from '@/champions/targeting';

/**
 * Represents an active shield on the champion.
 */
export interface ActiveShield {
  amount: number;
  remainingDuration: number;
  source?: string;
}

/**
 * Represents an active dash/knockback movement.
 */
export interface ForcedMovement {
  direction: Vector;
  distance: number;
  duration: number;
  elapsed: number;
  type: 'dash' | 'knockback';
}

/**
 * Abstract base class for all champions.
 * Implements physics, collision, and game entity behaviors explicitly.
 */
export abstract class Champion implements Disposable, Renderable, Stepable, Initializable, IGameUnit {
  // ===================
  // Identity & IGameUnit
  // ===================

  /** Unique identifier */
  readonly id: string;

  /** Unit type for ability targeting */
  readonly unitType: UnitType = 'champion';

  /** Whether this champion needs initialization */
  shouldInitialize: boolean = true;

  // ===================
  // Position & Physics
  // ===================

  /** Current position in world space */
  position: Vector;

  /** Current velocity */
  velocity: Vector = new Vector();

  /** Current acceleration */
  acceleration: Vector = new Vector();

  /** Facing direction (normalized) */
  direction: Vector = new Vector(1, 0);

  /** Friction coefficient (0-1, applied each frame) */
  friction: number = 0.85;

  /** Maximum movement speed */
  maxSpeed: number = 300;

  // ===================
  // Collision
  // ===================

  /** Shape used for collision detection */
  collisionMask: Shape;

  /** List of objects currently colliding with this champion */
  collisions: Champion[] = [];

  // ===================
  // Static Configuration
  // ===================

  /** Champion definition (static data) */
  protected abstract readonly definition: ChampionDefinition;

  // ===================
  // Runtime State
  // ===================

  /** Current champion state */
  protected state: ChampionState;

  /** Active effects on this champion */
  protected activeEffects: ActiveEffect[] = [];

  /** The four abilities */
  protected abilities: Map<AbilitySlot, Ability> = new Map();

  /** Attack cooldown timer */
  protected attackCooldown: number = 0;

  /** Current target for basic attacks */
  protected basicAttackTarget: Champion | null = null;

  /** Targeting policy for basic attacks */
  protected targetingPolicy: TargetingPolicy = DEFAULT_AI_POLICY;

  /** Target position for movement */
  protected moveTargetPosition: Vector | null = null;

  /** Current path for pathfinding */
  protected currentPath: Vector[] = [];

  /** Current index in the path */
  protected currentPathIndex: number = 0;

  /** Last target position used for path calculation */
  protected lastPathTarget: Vector | null = null;

  /** Which side this champion is on */
  protected side: Side;

  /** Disposable interface */
  shouldDispose: boolean = false;

  // ===================
  // New Effect System Support
  // ===================

  /** Active shields */
  protected shields: ActiveShield[] = [];

  /** Active immunities (e.g., 'poison', 'stun') */
  protected immunities: Set<string> = new Set();

  /** Active basic attack modifiers */
  protected basicAttackModifiers: BasicAttackModifier[] = [];

  /** Current forced movement (dash/knockback) */
  protected forcedMovement: ForcedMovement | null = null;

  /** Item inventory */
  protected inventory: ChampionInventory = {
    items: new Map(),
    totalGoldSpent: 0,
  };

  /** Trinket for ward placement */
  protected trinket: Trinket | null = null;

  // ===================
  // Constructor
  // ===================

  constructor(position: Vector, side: Side) {
    this.id = RandomUtils.generateId();
    this.position = position.clone();
    this.side = side;
    this.direction = new Vector(side === 0 ? 1 : -1, 0);

    // Default collision mask - can be overridden in init
    this.collisionMask = new Circle(20);

    // Initialize state
    this.state = this.createInitialState();

    // Initialize trinket (stealth ward by default)
    this.trinket = new Trinket('stealth_trinket', this.side);
  }

  /**
   * Create initial champion state.
   */
  protected createInitialState(): ChampionState {
    return {
      health: 0,  // Set in init after definition is available
      resource: 0,
      level: 1,
      experience: 0,
      experienceToNextLevel: LEVEL_EXPERIENCE[1],
      abilityRanks: { Q: 0, W: 0, E: 0, R: 0 },
      skillPoints: 1,  // Start with 1 skill point
      inCombat: false,
      timeSinceCombat: 0,
      isDead: false,
      respawnTimer: 0,
      modifiers: [],
    };
  }

  // ===================
  // Physics Methods
  // ===================

  /**
   * Get current speed (velocity magnitude).
   */
  get speed(): number {
    return this.velocity.length();
  }

  /**
   * Check if the champion is currently moving.
   */
  isMoving(): boolean {
    return this.speed > 1;
  }

  /**
   * Calculate new velocity based on acceleration and friction.
   */
  calculateVelocity(dt: number): Vector {
    const newVelocity = this.velocity.clone();
    const deltaVelocity = this.acceleration.clone().scalar(dt);
    newVelocity.add(deltaVelocity);

    // Apply friction
    newVelocity.scalar(this.friction);

    // Limit speed to maxSpeed
    if (newVelocity.length() > this.maxSpeed) {
      newVelocity.normalize().scalar(this.maxSpeed);
    }

    return newVelocity;
  }

  /**
   * Calculate new position based on velocity and acceleration.
   */
  calculatePosition(dt: number): Vector {
    const newPosition = this.position.clone();
    const deltaPositionByAcceleration = this.acceleration
      .clone()
      .scalar(0.5 * dt * dt);
    const deltaPosition = this.velocity
      .clone()
      .scalar(dt)
      .add(deltaPositionByAcceleration);
    newPosition.add(deltaPosition);
    return newPosition;
  }

  // ===================
  // Collision Methods
  // ===================

  /**
   * Check if currently colliding with anything.
   */
  get isColliding(): boolean {
    return this.collisions.length > 0;
  }

  /**
   * Set the list of colliding objects.
   */
  setCollisions(collisions: Champion[] | undefined): void {
    this.collisions = collisions || [];
  }

  // ===================
  // Initialization
  // ===================

  /**
   * Initialize the champion (called once after creation).
   */
  init(gctx: GameContext): void {
    // Set initial health and resource from definition base stats
    const baseStats = this.getDefinitionBaseStats();
    this.state.health = baseStats.health;
    this.state.resource = baseStats.resource;

    // Set collision mask based on attack range
    this.collisionMask = new Circle(this.definition.baseStats.attackRange / 5);

    // Set max speed from movement speed stat
    this.maxSpeed = baseStats.movementSpeed;

    // Initialize abilities
    this.initializeAbilities();

    // Set up abilities' owner reference
    for (const ability of this.abilities.values()) {
      ability.setOwner(this);
    }
  }

  /**
   * Subclasses must implement this to create their abilities.
   */
  protected abstract initializeAbilities(): void;

  // ===================
  // Getters
  // ===================

  /**
   * Get the team this champion belongs to.
   */
  getTeamId(): TeamId {
    return this.side;
  }

  /**
   * @deprecated Use getTeamId() instead.
   * Get the champion's side.
   */
  getSide(): Side {
    return this.side;
  }

  /**
   * Get the champion's sight range (for fog of war).
   * Champions have moderate vision range.
   */
  getSightRange(): number {
    // Champions have a base sight range of 550 units
    // This could be modified by abilities or items later
    return 550;
  }

  /**
   * Get the champion's position.
   */
  getPosition(): Vector {
    return this.position.clone();
  }

  /**
   * Set the champion's position (for teleports/forced movements).
   */
  setPosition(pos: Vector): void {
    this.position = pos.clone();
  }

  /**
   * Get the champion's facing direction.
   */
  getDirection(): Vector {
    return this.direction.clone();
  }

  /**
   * Get the champion definition.
   */
  getDefinition(): ChampionDefinition {
    return this.definition;
  }

  /**
   * Get base stats for IGameUnit compatibility.
   * Returns current state stats in UnitBaseStats format.
   */
  getBaseStats(): UnitBaseStats {
    const stats = this.getStats();
    return {
      health: this.state.health,
      maxHealth: stats.maxHealth,
      armor: stats.armor,
      magicResist: stats.magicResist,
      movementSpeed: stats.movementSpeed,
    };
  }

  /**
   * Get definition base stats (level 1, no modifiers).
   * Used internally for scaling calculations.
   */
  getDefinitionBaseStats(): ChampionBaseStats {
    return this.definition.baseStats;
  }

  /**
   * Get current stats (with level scaling and modifiers).
   */
  getStats(): ChampionStats {
    const base = this.definition.baseStats;
    const growth = this.definition.growthStats;
    const level = this.state.level;

    // Calculate base stats at current level
    const stats: ChampionStats = {
      health: this.state.health,
      maxHealth: calculateStat(base.health, growth.health, level),
      healthRegen: calculateStat(base.healthRegen, growth.healthRegen, level),

      resource: this.state.resource,
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

    // Apply stat modifiers
    for (const modifier of this.state.modifiers) {
      this.applyModifier(stats, modifier);
    }

    return stats;
  }

  /**
   * Apply a stat modifier to the stats object.
   */
  private applyModifier(stats: ChampionStats, modifier: StatModifier): void {
    // Apply flat bonuses
    if (modifier.flat) {
      for (const [key, value] of Object.entries(modifier.flat)) {
        const statKey = key as keyof ChampionBaseStats;
        if (statKey in stats && typeof value === 'number') {
          (stats as any)[statKey] += value;
        }
        // Also apply health bonuses to maxHealth
        if (statKey === 'health' && typeof value === 'number') {
          stats.maxHealth += value;
        }
        // Also apply resource bonuses to maxResource
        if (statKey === 'resource' && typeof value === 'number') {
          stats.maxResource += value;
        }
      }
    }

    // Apply percentage bonuses
    if (modifier.percent) {
      for (const [key, value] of Object.entries(modifier.percent)) {
        const statKey = key as keyof ChampionBaseStats;
        if (statKey in stats && typeof value === 'number') {
          (stats as any)[statKey] *= value;
        }
        // Also apply health percentage bonuses to maxHealth
        if (statKey === 'health' && typeof value === 'number') {
          stats.maxHealth *= value;
        }
        // Also apply resource percentage bonuses to maxResource
        if (statKey === 'resource' && typeof value === 'number') {
          stats.maxResource *= value;
        }
      }
    }
  }

  /**
   * Get current health.
   */
  getCurrentHealth(): number {
    return this.state.health;
  }

  /**
   * Get current resource (mana/energy/etc).
   */
  getCurrentResource(): number {
    return this.state.resource;
  }

  /**
   * Get current level.
   */
  getLevel(): number {
    return this.state.level;
  }

  /**
   * Check if the champion is dead.
   */
  isDead(): boolean {
    return this.state.isDead;
  }

  /**
   * Get reward for killing this champion.
   */
  getReward(): UnitReward {
    // Champions give significant rewards based on level
    const level = this.state.level;
    return {
      gold: 300 + (level * 50),  // Base 300 + 50 per level
      experience: 200 + (level * 100),  // Base 200 + 100 per level
    };
  }

  /**
   * Get crowd control status from active effects.
   */
  getCrowdControlStatus(): CrowdControlStatus {
    return computeCCStatus(this.activeEffects);
  }

  /**
   * Get an ability by slot.
   */
  getAbility(slot: AbilitySlot): Ability | undefined {
    return this.abilities.get(slot);
  }

  // ===================
  // Resource Management
  // ===================

  /**
   * Consume resource (mana) for casting abilities.
   */
  consumeResource(amount: number): void {
    this.state.resource = Math.max(0, this.state.resource - amount);
  }

  /**
   * Restore resource.
   */
  restoreResource(amount: number): void {
    const stats = this.getStats();
    this.state.resource = Math.min(stats.maxResource, this.state.resource + amount);
  }

  // ===================
  // Health & Damage
  // ===================

  /**
   * Apply damage to the champion.
   */
  takeDamage(
    rawDamage: number,
    damageType: 'physical' | 'magic' | 'true',
    source?: Champion,
    reason?: string
  ): number {
    if (this.state.isDead) return 0;

    const stats = this.getStats();
    let finalDamage = rawDamage;

    // Apply resistances
    switch (damageType) {
      case 'physical':
        finalDamage = rawDamage * (100 / (100 + stats.armor));
        break;
      case 'magic':
        finalDamage = rawDamage * (100 / (100 + stats.magicResist));
        break;
      case 'true':
        // True damage ignores resistances
        break;
    }

    // Apply shields first
    finalDamage = this.consumeShields(finalDamage);

    // Apply damage to health
    this.state.health = Math.max(0, this.state.health - finalDamage);

    // Verbose damage logging
    const targetName = this.definition?.name ?? 'Unknown';
    const sourceName = source?.definition?.name ?? 'Unknown';
    const reasonStr = reason ?? 'damage';
    console.log(
      `%c[${targetName}] took ${finalDamage.toFixed(1)} ${damageType} damage from [${sourceName}] (${reasonStr})`,
      'color: #ff6b6b'
    );

    // Enter combat
    this.state.inCombat = true;
    this.state.timeSinceCombat = 0;

    // Trigger passive abilities
    this.triggerPassives('on_take_damage', { damage: finalDamage, source });

    // Trigger on_take_damage item passives (like Thornmail)
    if (source) {
      this.triggerItemPassives('on_take_damage', {
        target: source,
        damage: finalDamage,
      });
    }

    // Check death
    if (this.state.health <= 0) {
      this.die(source);
    }

    return finalDamage;
  }

  /**
   * Heal the champion.
   */
  heal(amount: number, source?: IGameUnit): number {
    if (this.state.isDead) return 0;

    const stats = this.getStats();
    const oldHealth = this.state.health;
    this.state.health = Math.min(stats.maxHealth, this.state.health + amount);

    return this.state.health - oldHealth;
  }

  // ===================
  // Shields
  // ===================

  /**
   * Add a shield to the champion.
   */
  addShield(amount: number, duration: number, source?: string): void {
    this.shields.push({
      amount,
      remainingDuration: duration,
      source,
    });
  }

  /**
   * Get total shield amount.
   */
  getTotalShield(): number {
    return this.shields.reduce((total, s) => total + s.amount, 0);
  }

  /**
   * Consume shield when taking damage (call before health damage).
   * Returns remaining damage after shields.
   */
  protected consumeShields(damage: number): number {
    let remainingDamage = damage;

    for (const shield of this.shields) {
      if (remainingDamage <= 0) break;

      if (shield.amount >= remainingDamage) {
        shield.amount -= remainingDamage;
        remainingDamage = 0;
      } else {
        remainingDamage -= shield.amount;
        shield.amount = 0;
      }
    }

    // Remove depleted shields
    this.shields = this.shields.filter(s => s.amount > 0);

    return remainingDamage;
  }

  // ===================
  // Immunities
  // ===================

  /**
   * Add an immunity (e.g., 'poison', 'stun', 'slow').
   */
  addImmunity(type: string): void {
    this.immunities.add(type);
  }

  /**
   * Remove an immunity.
   */
  removeImmunity(type: string): void {
    this.immunities.delete(type);
  }

  /**
   * Check if the champion has an immunity.
   */
  hasImmunity(type: string): boolean {
    return this.immunities.has(type);
  }

  /**
   * Cleanse all crowd control effects.
   */
  cleanseCrowdControl(): void {
    this.cleanse();
    this.forcedMovement = null;
  }

  // ===================
  // Stat Modifiers
  // ===================

  /**
   * Add a stat modifier (legacy method - use applyBuff for new code).
   */
  addStatModifier(
    stat: 'attackDamage' | 'armor' | 'magicResist' | 'attackSpeed' | 'movementSpeed',
    flatBonus: number = 0,
    percentBonus: number = 0
  ): void {
    const modifier: StatModifier = {
      source: `effect_${stat}_${Date.now()}`,
      flat: { [stat]: flatBonus } as Partial<ChampionBaseStats>,
      percent: percentBonus !== 0 ? { [stat]: 1 + percentBonus } : undefined,
    };
    this.state.modifiers.push(modifier);
  }

  /**
   * Remove a stat modifier (legacy method).
   */
  removeStatModifier(
    stat: 'attackDamage' | 'armor' | 'magicResist' | 'attackSpeed' | 'movementSpeed',
    flatBonus: number = 0,
    percentBonus: number = 0
  ): void {
    // Find and remove matching modifier
    const idx = this.state.modifiers.findIndex(m =>
      m.flat?.[stat as keyof ChampionBaseStats] === flatBonus
    );
    if (idx !== -1) {
      this.state.modifiers.splice(idx, 1);
    }
  }

  /**
   * Apply a buff/debuff with full stat support.
   * This is the preferred method for applying stat modifications.
   *
   * @param source - Unique identifier for this buff (used for removal)
   * @param flat - Flat stat bonuses (e.g., { attackDamage: 10, armor: 5 })
   * @param percent - Percentage multipliers (e.g., { movementSpeed: 0.2 } = +20%)
   * @param duration - Duration in seconds (undefined = permanent until removed)
   * @returns The modifier ID for later removal
   */
  applyBuff(
    source: string,
    flat?: Partial<ChampionBaseStats>,
    percent?: Partial<ChampionBaseStats>,
    duration?: number
  ): string {
    // Convert percent values to multipliers (0.2 becomes 1.2)
    const percentMultipliers = percent
      ? Object.fromEntries(
          Object.entries(percent).map(([k, v]) => [k, 1 + (v as number)])
        ) as Partial<Record<keyof ChampionBaseStats, number>>
      : undefined;

    const modifier: StatModifier = {
      source,
      flat,
      percent: percentMultipliers,
      duration,
      timeRemaining: duration,
    };
    this.state.modifiers.push(modifier);
    return source;
  }

  /**
   * Remove a buff/debuff by source ID.
   */
  removeBuff(source: string): boolean {
    const idx = this.state.modifiers.findIndex(m => m.source === source);
    if (idx !== -1) {
      this.state.modifiers.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if a buff is active.
   */
  hasBuff(source: string): boolean {
    return this.state.modifiers.some(m => m.source === source);
  }

  /**
   * Get all active buffs/modifiers.
   */
  getBuffs(): StatModifier[] {
    return [...this.state.modifiers];
  }

  /**
   * Update timed buffs - call each frame.
   */
  protected updateBuffs(dt: number): void {
    // Update durations and remove expired buffs
    this.state.modifiers = this.state.modifiers.filter(mod => {
      if (mod.duration !== undefined && mod.timeRemaining !== undefined) {
        mod.timeRemaining -= dt;
        return mod.timeRemaining > 0;
      }
      return true; // Permanent buffs stay
    });
  }

  // ===================
  // Basic Attack Modifiers
  // ===================

  /**
   * Add a basic attack modifier.
   */
  addBasicAttackModifier(modifier: BasicAttackModifier): void {
    this.basicAttackModifiers.push(modifier);
  }

  /**
   * Get all active basic attack modifiers.
   */
  getBasicAttackModifiers(): BasicAttackModifier[] {
    return [...this.basicAttackModifiers];
  }

  /**
   * Consume basic attack modifiers after an attack.
   * Reduces charges and removes exhausted modifiers.
   */
  consumeBasicAttackModifiers(): void {
    for (const mod of this.basicAttackModifiers) {
      if (mod.charges !== undefined && mod.charges > 0) {
        mod.charges--;
      }
    }

    // Remove modifiers with 0 charges
    this.basicAttackModifiers = this.basicAttackModifiers.filter(
      mod => mod.charges === undefined || mod.charges > 0
    );
  }

  /**
   * Callback when a basic attack lands.
   */
  onBasicAttack(target: Champion): void {
    this.triggerPassives('on_attack', { target });
  }

  // ===================
  // Forced Movement (Dash/Knockback)
  // ===================

  /**
   * Start a dash in a direction.
   * @param direction - The direction to dash
   * @param distance - The distance to travel
   * @param speed - The speed of the dash (units per second)
   */
  startDash(direction: Vector, distance: number, speed: number): void {
    const duration = distance / speed;
    this.forcedMovement = {
      direction: direction.clone().normalize(),
      distance,
      duration,
      elapsed: 0,
      type: 'dash',
    };
  }

  /**
   * Apply a knockback effect.
   */
  applyKnockback(direction: Vector, distance: number, duration: number): void {
    // Check knockback immunity
    if (this.hasImmunity('knockback')) return;

    this.forcedMovement = {
      direction: direction.clone().normalize(),
      distance,
      duration,
      elapsed: 0,
      type: 'knockback',
    };
  }

  /**
   * Check if the champion is in forced movement.
   */
  isInForcedMovement(): boolean {
    return this.forcedMovement !== null;
  }

  /**
   * Update forced movement.
   */
  protected updateForcedMovement(dt: number): void {
    if (!this.forcedMovement) return;

    this.forcedMovement.elapsed += dt;

    const progress = this.forcedMovement.elapsed / this.forcedMovement.duration;

    // Calculate movement for this frame
    const speed = this.forcedMovement.distance / this.forcedMovement.duration;

    if (progress >= 1) {
      // Apply remaining movement to reach exact target distance
      const remainingTime = this.forcedMovement.duration - (this.forcedMovement.elapsed - dt);
      const finalMovement = this.forcedMovement.direction.clone().scalar(speed * remainingTime);
      this.position.add(finalMovement);
      this.forcedMovement = null;
      return;
    }

    const movement = this.forcedMovement.direction.clone().scalar(speed * dt);
    this.position.add(movement);
  }

  // ===================
  // Item Inventory
  // ===================

  /**
   * Get current inventory.
   */
  getInventory(): ChampionInventory {
    return this.inventory;
  }

  /**
   * Check if an item can be purchased.
   */
  canPurchaseItem(item: ItemDefinition, currentGold: number): ItemPurchaseResult {
    // Check gold
    if (currentGold < item.cost) {
      return { success: false, reason: 'not_enough_gold' };
    }

    // Check unique restriction
    if (item.isUnique) {
      for (const equipped of this.inventory.items.values()) {
        if (equipped.definition.id === item.id) {
          return { success: false, reason: 'unique_owned' };
        }
      }
    }

    // Check inventory space
    if (this.inventory.items.size >= 6) {
      return { success: false, reason: 'inventory_full' };
    }

    return { success: true };
  }

  /**
   * Purchase and equip an item.
   * Returns the slot it was equipped to, or -1 if failed.
   */
  purchaseItem(item: ItemDefinition): ItemSlot | -1 {
    // Find empty slot
    let emptySlot: ItemSlot | -1 = -1;
    for (let i = 0; i < 6; i++) {
      if (!this.inventory.items.has(i as ItemSlot)) {
        emptySlot = i as ItemSlot;
        break;
      }
    }

    if (emptySlot === -1) return -1;

    // Create equipped item
    const equipped: EquippedItem = {
      definition: item,
      slot: emptySlot,
      passiveCooldowns: new Map(),
      nextIntervalTick: new Map(),
    };

    // Initialize interval passives
    for (const passive of item.passives) {
      if (passive.trigger === 'on_interval' && passive.interval) {
        equipped.nextIntervalTick.set(passive.id, passive.interval);
      }
    }

    this.inventory.items.set(emptySlot, equipped);
    this.inventory.totalGoldSpent += item.cost;

    // Apply stat bonuses via modifier
    this.applyItemStats(item);

    return emptySlot;
  }

  /**
   * Sell an item from a slot.
   * Returns the gold gained.
   */
  sellItem(slot: ItemSlot): number {
    const equipped = this.inventory.items.get(slot);
    if (!equipped) return 0;

    // Remove stat bonuses
    this.removeItemStats(equipped.definition);

    // Remove from inventory
    this.inventory.items.delete(slot);

    return equipped.definition.sellValue;
  }

  /**
   * Apply item stats as a modifier.
   */
  private applyItemStats(item: ItemDefinition): void {
    const modifier: StatModifier = {
      source: `item_${item.id}`,
      flat: item.stats as Partial<ChampionBaseStats>,
    };
    this.state.modifiers.push(modifier);
  }

  /**
   * Remove item stats modifier.
   */
  private removeItemStats(item: ItemDefinition): void {
    const idx = this.state.modifiers.findIndex(m => m.source === `item_${item.id}`);
    if (idx !== -1) {
      this.state.modifiers.splice(idx, 1);
    }
  }

  /**
   * Get total stats from items.
   */
  getItemStats(): Partial<ChampionBaseStats> {
    const stats: Partial<ChampionBaseStats> = {};

    for (const equipped of this.inventory.items.values()) {
      for (const [key, value] of Object.entries(equipped.definition.stats)) {
        const statKey = key as keyof ChampionBaseStats;
        (stats as any)[statKey] = ((stats as any)[statKey] ?? 0) + (value ?? 0);
      }
    }

    return stats;
  }

  // ===================
  // Trinket / Wards
  // ===================

  /**
   * Get the champion's trinket.
   */
  getTrinket(): Trinket | null {
    return this.trinket;
  }

  /**
   * Check if can place a ward.
   */
  canPlaceWard(): boolean {
    return this.trinket?.canPlace() ?? false;
  }

  /**
   * Place a ward at a target position.
   * @param targetPosition - Where to place the ward
   * @param gctx - Game context
   * @returns The placed ward, or null if placement failed
   */
  placeWard(targetPosition: Vector, gctx: GameContext): Ward | null {
    if (!this.trinket) return null;
    return this.trinket.tryPlaceWard(this.position, targetPosition, gctx);
  }

  /**
   * Swap trinket type.
   */
  swapTrinket(trinketId: string): void {
    if (this.trinket) {
      this.trinket.swapTrinket(trinketId);
    } else {
      this.trinket = new Trinket(trinketId, this.side);
    }
  }

  /**
   * Trigger item passives for a given event.
   */
  triggerItemPassives(
    trigger: ItemPassiveTrigger,
    context: { target?: Champion; damage?: number; gameContext?: GameContext }
  ): void {
    for (const equipped of this.inventory.items.values()) {
      for (const passive of equipped.definition.passives) {
        if (passive.trigger !== trigger) continue;

        // Check cooldown
        const cooldownRemaining = equipped.passiveCooldowns.get(passive.id) ?? 0;
        if (cooldownRemaining > 0) continue;

        // Check health threshold for on_low_health
        if (trigger === 'on_low_health' && passive.healthThreshold) {
          const stats = this.getStats();
          const healthPercent = stats.health / stats.maxHealth;
          if (healthPercent > passive.healthThreshold) continue;
        }

        // Check unique stacking (only first instance triggers)
        if (passive.isUnique) {
          let alreadyTriggered = false;
          for (const otherEquipped of this.inventory.items.values()) {
            if (otherEquipped.slot < equipped.slot) {
              const samePassive = otherEquipped.definition.passives.find(
                p => p.id === passive.id
              );
              if (samePassive) {
                alreadyTriggered = true;
                break;
              }
            }
          }
          if (alreadyTriggered) continue;
        }

        // Apply effect
        const effectContext = {
          caster: this,
          target: context.target,
          affectedTargets: context.target ? [context.target] : [],
          gameContext: context.gameContext!,
          damageDealt: context.damage,
        };
        passive.effect.apply(effectContext);

        // Start cooldown
        if (passive.cooldown > 0) {
          equipped.passiveCooldowns.set(passive.id, passive.cooldown);
        }
      }
    }
  }

  /**
   * Update item passive cooldowns and interval effects.
   */
  protected updateItemPassives(dt: number, gameContext: GameContext): void {
    for (const equipped of this.inventory.items.values()) {
      // Update cooldowns
      for (const [passiveId, remaining] of equipped.passiveCooldowns) {
        if (remaining > 0) {
          equipped.passiveCooldowns.set(passiveId, Math.max(0, remaining - dt));
        }
      }

      // Update interval passives
      for (const [passiveId, remaining] of equipped.nextIntervalTick) {
        const newRemaining = remaining - dt;
        if (newRemaining <= 0) {
          // Trigger the passive
          const passive = equipped.definition.passives.find(p => p.id === passiveId);
          if (passive) {
            const effectContext = {
              caster: this,
              affectedTargets: [] as Champion[],
              gameContext,
            };
            passive.effect.apply(effectContext);
          }
          // Reset timer
          const interval = equipped.definition.passives.find(p => p.id === passiveId)?.interval ?? 1;
          equipped.nextIntervalTick.set(passiveId, interval);
        } else {
          equipped.nextIntervalTick.set(passiveId, newRemaining);
        }
      }
    }
  }

  /**
   * Handle champion death.
   */
  protected die(killer?: Champion): void {
    this.state.isDead = true;
    this.state.respawnTimer = this.calculateRespawnTime();

    // Clear effects that don't persist through death
    this.activeEffects = this.activeEffects.filter(e => e.definition.persistsThroughDeath);

    // Trigger killer's on_kill passives
    if (killer) {
      killer.triggerPassives('on_kill', { victim: this });
    }

    this.onDeath(killer);
  }

  /**
   * Subclass hook for death handling.
   */
  protected onDeath(killer?: Champion): void {
    // Override in subclasses for death effects
  }

  /**
   * Calculate respawn time based on level.
   */
  protected calculateRespawnTime(): number {
    return 10 + this.state.level * 2;
  }

  /**
   * Respawn the champion.
   */
  protected respawn(position: Vector): void {
    this.state.isDead = false;
    this.state.health = this.getStats().maxHealth;
    this.state.resource = this.getStats().maxResource;
    this.position = position;
  }

  // ===================
  // Experience & Leveling
  // ===================

  /**
   * Grant experience to the champion.
   */
  grantExperience(amount: number): void {
    if (this.state.level >= 18) return;

    this.state.experience += amount;

    // Check for level up
    while (
      this.state.level < 18 &&
      this.state.experience >= this.state.experienceToNextLevel
    ) {
      this.levelUp();
    }
  }

  /**
   * Level up the champion.
   */
  protected levelUp(): void {
    this.state.level++;
    this.state.skillPoints++;
    this.state.experienceToNextLevel = LEVEL_EXPERIENCE[this.state.level] ?? Infinity;

    // Heal a portion of the gained health
    const healthGain = this.definition.growthStats.health;
    this.state.health += healthGain;

    this.onLevelUp();
  }

  /**
   * Subclass hook for level up effects.
   */
  protected onLevelUp(): void {
    // Override in subclasses for level up effects
  }

  // ===================
  // Abilities
  // ===================

  /**
   * Rank up an ability.
   */
  rankUpAbility(slot: AbilitySlot): boolean {
    if (this.state.skillPoints <= 0) return false;

    const ability = this.abilities.get(slot);
    if (!ability || !ability.canRankUp) return false;

    // Ultimate (R) has level requirements
    if (slot === 'R') {
      const requiredLevel = [6, 11, 16][ability.rank];
      if (this.state.level < requiredLevel) return false;
    }

    if (ability.rankUp()) {
      this.state.skillPoints--;
      this.state.abilityRanks[slot] = ability.rank;
      return true;
    }

    return false;
  }

  /**
   * Cast an ability.
   */
  castAbility(
    slot: AbilitySlot,
    targetUnit?: Champion,
    targetPosition?: Vector
  ): boolean {
    const ability = this.abilities.get(slot);
    if (!ability) return false;

    const context: AbilityCastContext = {
      caster: this,
      targetUnit,
      targetPosition,
      direction: targetPosition
        ? targetPosition.clone().sub(this.position).normalize()
        : this.direction.clone(),
      rank: ability.rank,
      dt: 0,
    };

    const result = ability.cast(context);
    return result.success;
  }

  /**
   * Trigger passive abilities based on a trigger type.
   */
  triggerPassives(trigger: string, context: any): void {
    for (const ability of this.abilities.values()) {
      // Check if it's a passive with matching trigger
      if ('trigger' in ability && (ability as any).trigger === trigger) {
        (ability as any).tryTrigger({
          caster: this,
          rank: ability.rank,
          dt: 0,
          ...context,
        });
      }
    }
  }

  // ===================
  // Effects
  // ===================

  /**
   * Apply an effect to this champion.
   */
  applyEffect(effect: ActiveEffect): void {
    // Handle stacking
    const existing = this.activeEffects.find(
      e => e.definition.id === effect.definition.id
    );

    switch (effect.definition.stackBehavior) {
      case 'refresh':
        if (existing) {
          existing.timeRemaining = effect.timeRemaining;
        } else {
          this.activeEffects.push(effect);
        }
        break;

      case 'extend':
        if (existing) {
          existing.timeRemaining += effect.timeRemaining;
        } else {
          this.activeEffects.push(effect);
        }
        break;

      case 'stack':
        if (existing && effect.definition.maxStacks) {
          if (existing.stacks < effect.definition.maxStacks) {
            existing.stacks++;
            existing.timeRemaining = effect.timeRemaining;
          }
        } else {
          this.activeEffects.push(effect);
        }
        break;

      case 'replace':
        this.activeEffects = this.activeEffects.filter(
          e => e.definition.id !== effect.definition.id
        );
        this.activeEffects.push(effect);
        break;

      case 'ignore':
        if (!existing) {
          this.activeEffects.push(effect);
        }
        break;
    }
  }

  /**
   * Remove an effect by ID.
   */
  removeEffect(effectId: string): void {
    this.activeEffects = this.activeEffects.filter(
      e => e.definition.id !== effectId
    );
  }

  /**
   * Remove all cleansable debuffs.
   */
  cleanse(): void {
    this.activeEffects = this.activeEffects.filter(
      e => e.definition.category !== 'debuff' || !e.definition.cleansable
    );
  }

  // ===================
  // Combat AI
  // ===================

  /**
   * Set a target for basic attacks.
   */
  setBasicAttackTarget(target: Champion | null): void {
    this.basicAttackTarget = target;
  }

  /**
   * Get the current basic attack target.
   */
  getBasicAttackTarget(): Champion | null {
    return this.basicAttackTarget;
  }

  /**
   * Get the current movement path and path index.
   * Used for minimap visualization.
   */
  getCurrentPath(): { path: Vector[]; pathIndex: number } {
    return {
      path: this.currentPath,
      pathIndex: this.currentPathIndex,
    };
  }

  /**
   * Set a position to move to.
   * If the targeting policy says to clear attack target on move, do so.
   */
  setTargetPosition(position: Vector | null): void {
    this.moveTargetPosition = position;
    // Clear path when target changes so we recalculate
    this.currentPath = [];
    this.currentPathIndex = 0;
    this.lastPathTarget = null;
  }

  /**
   * Handle a move command (called by controller).
   * Uses the targeting policy to decide behavior.
   */
  onMoveCommand(position: Vector): void {
    // Ask the targeting policy if we should clear the attack target
    if (this.targetingPolicy.onMoveCommand(this)) {
      this.basicAttackTarget = null;
    }
    this.moveTargetPosition = position;
  }

  /**
   * Handle an attack command (called by controller).
   * Uses the targeting policy to set the target.
   */
  onAttackCommand(target: Champion): void {
    this.targetingPolicy.onAttackCommand(this, target);
  }

  /**
   * Set the targeting policy for this champion.
   */
  setTargetingPolicy(policy: TargetingPolicy): void {
    this.targetingPolicy = policy;
  }

  /**
   * Get the current targeting policy.
   */
  getTargetingPolicy(): TargetingPolicy {
    return this.targetingPolicy;
  }

  /**
   * Perform a basic attack on the current target.
   * @param gctx - The game context
   * @param target - Optional explicit target (if not provided, uses basicAttackTarget)
   */
  protected performBasicAttack(gctx: GameContext, target?: Champion): void {
    // Use explicit target if provided, otherwise use basicAttackTarget
    const attackTarget = target ?? this.basicAttackTarget;

    if (!attackTarget || attackTarget.isDead()) {
      if (!target) this.basicAttackTarget = null;
      return;
    }

    const stats = this.getStats();
    const distance = this.position.distanceTo(attackTarget.getPosition());

    // Check range
    if (distance > stats.attackRange) {
      return;
    }

    // Check attack cooldown
    if (this.attackCooldown > 0) {
      return;
    }

    // Check CC status
    const ccStatus = this.getCrowdControlStatus();
    if (!ccStatus.canAttack) {
      return;
    }

    // Calculate damage
    let damage = stats.attackDamage;

    // Critical strike
    const isCrit = Math.random() < stats.critChance;
    if (isCrit) {
      damage *= stats.critDamage;
    }

    // Start attack cooldown (before damage, attack is "committed")
    this.attackCooldown = 1 / stats.attackSpeed;

    // Trigger on_attack passives (attack started)
    this.triggerPassives('on_attack', { target: attackTarget });

    // Check if this is a ranged attack
    const isRanged = this.definition.attackType === 'ranged';

    if (isRanged) {
      // Ranged - spawn projectile (damage on arrival)
      this.spawnBasicAttackProjectile(gctx, attackTarget, damage, isCrit);
    } else {
      // Melee - instant damage
      const damageDealt = attackTarget.takeDamage(damage, 'physical', this, 'Basic Attack');

      // Trigger on_hit item passives (for melee, instant)
      this.triggerItemPassives('on_hit', {
        target: attackTarget,
        damage: damageDealt,
        gameContext: gctx,
      });
    }

    // Enter combat
    this.state.inCombat = true;
    this.state.timeSinceCombat = 0;
  }

  /**
   * Create an basic attack projectile for ranged attacks.
   *
   * Override this in ranged champion subclasses to return a custom projectile
   * with champion-specific rendering. Return null for melee champions.
   *
   * @param target - The attack target
   * @param damage - Pre-calculated damage (includes crit)
   * @param isCrit - Whether this is a critical strike
   * @param onHit - Callback to trigger on-hit effects when projectile lands
   * @returns A projectile instance, or null for melee attacks
   */
  protected createBasicAttackProjectile(
    target: Champion,
    damage: number,
    isCrit: boolean,
    onHit: (target: Champion, damage: number) => void
  ): TargetedProjectile | null {
    // Base implementation returns null (melee attack)
    // Ranged champions should override this
    return null;
  }

  /**
   * Spawn the basic attack projectile (internal helper).
   */
  private spawnBasicAttackProjectile(
    gctx: GameContext,
    target: Champion,
    damage: number,
    isCrit: boolean
  ): void {
    const onHit = (hitTarget: Champion, damageDealt: number) => {
      // Trigger on_hit item passives when projectile lands
      this.triggerItemPassives('on_hit', {
        target: hitTarget,
        damage: damageDealt,
        gameContext: gctx,
      });
    };

    const projectile = this.createBasicAttackProjectile(target, damage, isCrit, onHit);

    if (projectile) {
      gctx.objects.push(projectile);
    } else {
      // Ranged champion didn't override createBasicAttackProjectile - fallback to instant
      console.warn(
        `[${this.definition.name}] is ranged but didn't override createBasicAttackProjectile(). ` +
        `Using instant damage as fallback.`
      );
      const damageDealt = target.takeDamage(damage, 'physical', this, 'Basic Attack');
      onHit(target, damageDealt);
    }
  }

  // ===================
  // Movement
  // ===================

  /**
   * Move toward the target position using pathfinding if available.
   */
  protected moveTowardTarget(gctx: GameContext): void {
    const ccStatus = this.getCrowdControlStatus();
    if (!ccStatus.canMove) {
      this.velocity = new Vector(0, 0);
      this.acceleration = new Vector(0, 0);
      return;
    }

    // Determine move target
    let moveTarget: Vector | null = null;

    if (this.moveTargetPosition) {
      moveTarget = this.moveTargetPosition;
    } else if (this.basicAttackTarget && !this.basicAttackTarget.isDead()) {
      const stats = this.getStats();
      const distance = this.position.distanceTo(this.basicAttackTarget.getPosition());

      // Move toward target if out of attack range
      if (distance > stats.attackRange * 0.9) {
        moveTarget = this.basicAttackTarget.getPosition();
      }
    }

    if (moveTarget) {
      const stats = this.getStats();

      // Check if we need to recalculate path
      const needsNewPath = this.currentPath.length === 0 ||
        !this.lastPathTarget ||
        this.lastPathTarget.distanceTo(moveTarget) > 50;

      // Use pathfinding if available
      if (gctx.navigationGrid && needsNewPath) {
        const path = gctx.navigationGrid.findPath(this.position, moveTarget);
        if (path && path.length > 0) {
          this.currentPath = path;
          this.currentPathIndex = 0;
          this.lastPathTarget = moveTarget.clone();
        } else {
          // No path found, clear and move directly (or stay still if blocked)
          this.currentPath = [];
          this.currentPathIndex = 0;
        }
      }

      // Follow path if we have one
      if (this.currentPath.length > 0 && this.currentPathIndex < this.currentPath.length) {
        const nextWaypoint = this.currentPath[this.currentPathIndex];
        const distToWaypoint = this.position.distanceTo(nextWaypoint);

        // Check if we reached current waypoint
        if (distToWaypoint < 15) {
          this.currentPathIndex++;
          // Check if path complete
          if (this.currentPathIndex >= this.currentPath.length) {
            this.moveTargetPosition = null;
            this.velocity = new Vector(0, 0);
            this.currentPath = [];
            this.currentPathIndex = 0;
            this.lastPathTarget = null;
            this.acceleration = new Vector(0, 0);
            return;
          }
        }

        // Move toward current waypoint
        const waypointTarget = this.currentPath[this.currentPathIndex];
        const directionToWaypoint = waypointTarget.clone().sub(this.position).normalize();
        this.direction = directionToWaypoint.clone();
        this.velocity = directionToWaypoint.scalar(stats.movementSpeed);
      } else {
        // No path or no navigation grid - use direct movement (fallback)
        const directionToTarget = moveTarget.clone().sub(this.position).normalize();
        this.direction = directionToTarget.clone();
        this.velocity = directionToTarget.scalar(stats.movementSpeed);

        // Check if reached target
        if (this.position.distanceTo(moveTarget) < 10) {
          this.moveTargetPosition = null;
          this.velocity = new Vector(0, 0);
        }
      }
    } else {
      this.velocity = new Vector(0, 0);
      // Clear path when no target
      this.currentPath = [];
      this.currentPathIndex = 0;
      this.lastPathTarget = null;
    }

    this.acceleration = new Vector(0, 0);
  }

  // ===================
  // Update Loop
  // ===================

  /**
   * Update the champion each frame.
   */
  step(gctx: GameContext): void {
    if (this.state.isDead) {
      this.updateDead(gctx);
      return;
    }

    const dt = gctx.dt;

    // Update abilities
    for (const ability of this.abilities.values()) {
      ability.update(gctx);
    }

    // Update effects
    this.updateEffects(dt);

    // Update timed buffs
    this.updateBuffs(dt);

    // Update shields
    this.updateShields(dt);

    // Update item passives
    this.updateItemPassives(dt, gctx);

    // Update trinket charges
    if (this.trinket) {
      this.trinket.update(dt);
    }

    // Update attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    // Regeneration (only out of combat)
    this.updateRegeneration(dt);

    // AI decision making
    this.updateAI(gctx);

    // Handle forced movement (dash/knockback)
    if (this.forcedMovement) {
      this.updateForcedMovement(dt);
    } else {
      // Normal movement
      this.moveTowardTarget(gctx);
      // Update position
      this.position = this.calculatePosition(dt);
    }

    // Auto-attack (only if not in forced movement)
    if (!this.forcedMovement) {
      this.performBasicAttack(gctx);
    }

    // Update combat timer
    if (this.state.inCombat) {
      this.state.timeSinceCombat += dt;
      if (this.state.timeSinceCombat > 5) {
        this.state.inCombat = false;
      }
    }
  }

  /**
   * Update when dead (respawn timer).
   */
  protected updateDead(gctx: GameContext): void {
    this.state.respawnTimer -= gctx.dt;

    if (this.state.respawnTimer <= 0) {
      // Respawn at base position
      const respawnX = this.side === 0 ? -1500 : 1500;
      this.respawn(new Vector(respawnX, 0));
    }
  }

  /**
   * Update active effects.
   */
  protected updateEffects(dt: number): void {
    // Update effect timers
    for (const effect of this.activeEffects) {
      if (effect.timeRemaining !== undefined) {
        effect.timeRemaining -= dt;
      }

      // Update over-time effects
      if (effect.nextTickIn !== undefined) {
        effect.nextTickIn -= dt;
        if (effect.nextTickIn <= 0) {
          this.processEffectTick(effect);
        }
      }
    }

    // Remove expired effects
    this.activeEffects = this.activeEffects.filter(
      e => e.timeRemaining === undefined || e.timeRemaining > 0
    );
  }

  /**
   * Update shield durations.
   */
  protected updateShields(dt: number): void {
    for (const shield of this.shields) {
      shield.remainingDuration -= dt;
    }

    // Remove expired shields
    this.shields = this.shields.filter(s => s.remainingDuration > 0 && s.amount > 0);
  }

  /**
   * Process an over-time effect tick.
   */
  protected processEffectTick(effect: ActiveEffect): void {
    // To be implemented based on effect type
    // Reset tick timer
    const otEffect = effect.definition as any;
    if (otEffect.tickInterval) {
      effect.nextTickIn = otEffect.tickInterval;
    }
  }

  /**
   * Update health/mana regeneration.
   */
  protected updateRegeneration(dt: number): void {
    // Only regenerate out of combat
    if (this.state.inCombat) return;

    const stats = this.getStats();

    // Health regen
    if (this.state.health < stats.maxHealth) {
      this.state.health = Math.min(
        stats.maxHealth,
        this.state.health + stats.healthRegen * dt
      );
    }

    // Resource regen
    if (this.state.resource < stats.maxResource) {
      this.state.resource = Math.min(
        stats.maxResource,
        this.state.resource + stats.resourceRegen * dt
      );
    }
  }

  /**
   * AI decision making for ability casting and targeting.
   * Uses the targeting policy to determine behavior.
   * Subclasses should override this for champion-specific AI.
   */
  protected updateAI(gctx: GameContext): void {
    // Check if current target is invalid
    if (this.basicAttackTarget && this.basicAttackTarget.isDead()) {
      this.targetingPolicy.onTargetInvalid(this, gctx);
    }

    // Let the targeting policy update (auto-targeting policies will find targets here)
    this.targetingPolicy.update(this, gctx);
  }

  // ===================
  // Rendering
  // ===================

  /**
   * Render the champion.
   */
  render(): RenderElement {
    return new RenderElement((gctx) => {
      this.renderChampion(gctx);
    }, true);
  }

  /**
   * Subclasses implement this for champion-specific rendering.
   */
  protected abstract renderChampion(gctx: GameContext): void;
}

export default Champion;
