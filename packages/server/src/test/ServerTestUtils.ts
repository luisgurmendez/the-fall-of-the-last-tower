/**
 * Server Test Utilities - Reusable helpers for testing game mechanics.
 *
 * Provides:
 * - TestChampion: Champion wrapper with exposed internals for testing
 * - createTestArena: Quick setup for 2-champion combat scenarios
 * - Damage calculation helpers
 * - Effect assertion helpers
 */

import { ServerChampion, type ServerChampionConfig } from '../simulation/ServerChampion';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerTower } from '../simulation/ServerTower';
import { ServerJungleCreature } from '../simulation/ServerJungleCreature';
import { ServerGameContext } from '../game/ServerGameContext';
import { abilityExecutor } from '../simulation/ServerAbilityExecutor';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  getAbilityDefinition,
  type ChampionDefinition,
  type Side,
  type AbilitySlot,
  type MinionType,
  TEAM_BLUE,
  TEAM_RED,
} from '@siege/shared';

// =============================================================================
// Test Champion Wrapper
// =============================================================================

/**
 * Extended ServerChampion with exposed internals for testing.
 * Provides methods to manipulate state and inspect private fields.
 */
export class TestChampion extends ServerChampion {
  /**
   * Force set health for testing.
   */
  setHealth(health: number): void {
    this.health = Math.max(0, Math.min(health, this.maxHealth));
  }

  /**
   * Force set max health for testing.
   */
  setMaxHealth(maxHealth: number): void {
    this.maxHealth = maxHealth;
  }

  /**
   * Force set resource (mana/energy) for testing.
   */
  setResource(resource: number): void {
    this.resource = Math.max(0, Math.min(resource, this.maxResource));
  }

  /**
   * Force set level for testing.
   */
  setLevel(level: number): void {
    this.level = Math.max(1, Math.min(level, 18));
    // Clear stat cache and recalculate - getStats() updates maxHealth as a side effect
    // @ts-ignore - accessing private property for testing
    this['cachedStats'] = null;
    this.getStats();
  }

  /**
   * Get current shields for testing.
   */
  getShields(): Array<{ amount: number; remainingDuration: number; sourceId?: string }> {
    return [...this.shields];
  }

  /**
   * Get total shield amount.
   */
  getTotalShieldAmount(): number {
    return this.shields.reduce((sum, s) => sum + s.amount, 0);
  }

  /**
   * Get active effects for testing.
   */
  getActiveEffects() {
    return [...this.activeEffects];
  }

  /**
   * Check if champion can move (not stunned/rooted).
   */
  canMove(): boolean {
    return this.ccStatus.canMove;
  }

  /**
   * Check if champion can cast abilities.
   */
  canCast(): boolean {
    return this.ccStatus.canCast;
  }

  /**
   * Check if champion can attack.
   */
  canAttack(): boolean {
    return this.ccStatus.canAttack;
  }

  /**
   * Learn all abilities at rank 1.
   * Grants enough skill points to learn all abilities.
   */
  learnAllAbilities(): void {
    // Give enough skill points (champions start with 1 and auto-level Q)
    this.skillPoints = 4;
    // Also set level to 6 to allow R to be learned (R requires level 6)
    this.level = 6;

    // Clear any existing ranks and re-learn
    this.abilityRanks = { Q: 0, W: 0, E: 0, R: 0 };
    this.abilityStates.Q.rank = 0;
    this.abilityStates.W.rank = 0;
    this.abilityStates.E.rank = 0;
    this.abilityStates.R.rank = 0;

    this.levelUpAbility('Q');
    this.levelUpAbility('W');
    this.levelUpAbility('E');
    this.levelUpAbility('R');
  }

  /**
   * Max out an ability (set to max rank).
   */
  maxAbility(slot: AbilitySlot): void {
    const def = this.definition;
    const abilityId = def.abilities[slot];
    const abilityDef = getAbilityDefinition(abilityId);
    if (!abilityDef) return;

    const maxRank = abilityDef.maxRank;
    const currentRank = this.abilityStates[slot].rank;
    const ranksNeeded = maxRank - currentRank;

    // Grant enough skill points to max the ability
    this.skillPoints += ranksNeeded;

    // For R ability, ensure level is high enough for max rank
    if (slot === 'R') {
      this.level = Math.max(this.level, 16);
    }

    while (this.abilityStates[slot].rank < maxRank) {
      this.levelUpAbility(slot);
    }
  }

  /**
   * Reset all cooldowns.
   */
  resetCooldowns(): void {
    for (const slot of ['Q', 'W', 'E', 'R'] as AbilitySlot[]) {
      this.abilityStates[slot].cooldownRemaining = 0;
      this.abilityCooldowns[slot] = 0;
    }
  }

  /**
   * Get ability cooldown remaining.
   */
  getAbilityCooldown(slot: AbilitySlot): number {
    return this.abilityStates[slot].cooldownRemaining;
  }

  /**
   * Get ability rank.
   */
  getAbilityRank(slot: AbilitySlot): number {
    return this.abilityStates[slot].rank;
  }

  /**
   * Check if ability is ready (learned and off cooldown).
   */
  isAbilityReady(slot: AbilitySlot): boolean {
    const ability = this.abilityStates[slot];
    return ability.rank > 0 && ability.cooldownRemaining <= 0;
  }

  /**
   * Trigger update effects manually (for testing time-based effects).
   */
  tickEffects(dt: number): void {
    // @ts-ignore - accessing private method for testing
    this['updateEffects'](dt);
  }
}

// =============================================================================
// Test Arena
// =============================================================================

/**
 * Test arena with two opposing champions and optional minions.
 */
export interface TestArena {
  context: ServerGameContext;
  blue: TestChampion;
  red: TestChampion;

  /** Tick both champions by dt seconds */
  tick: (dt?: number) => void;

  /** Tick multiple frames */
  tickFrames: (frames: number, dt?: number) => void;

  /** Tick all entities including minions, towers, and jungle creatures */
  tickAll: (dt?: number) => void;

  /** Tick all entities for multiple frames */
  tickAllFrames: (frames: number, dt?: number) => void;

  /** Cast ability from one champion */
  castAbility: (
    caster: TestChampion,
    slot: AbilitySlot,
    options?: {
      targetPosition?: Vector;
      targetId?: string;
    }
  ) => ReturnType<typeof abilityExecutor.castAbility>;

  /** Add a minion to the arena */
  addMinion: (side: Side, position: Vector, minionType?: MinionType) => ServerMinion;

  /** Add a tower to the arena */
  addTower: (side: Side, position: Vector, lane?: 'top' | 'mid' | 'bot', tier?: 1 | 2 | 3) => ServerTower;

  /** Add a jungle creature to the arena */
  addJungleCreature: (position: Vector, creatureType?: string) => ServerJungleCreature;
}

export interface TestArenaOptions {
  blueChampion?: string;
  redChampion?: string;
  bluePosition?: Vector;
  redPosition?: Vector;
  /** If true, learn all abilities at rank 1 for both champions */
  learnAbilities?: boolean;
  /** If true, set both champions to max level with full resources */
  maxLevel?: boolean;
}

/**
 * Create a test arena with two opposing champions.
 */
export function createTestArena(options: TestArenaOptions = {}): TestArena {
  const {
    blueChampion = 'warrior',
    redChampion = 'warrior',
    bluePosition = new Vector(0, 0),
    redPosition = new Vector(200, 0),
    learnAbilities = true,
    maxLevel = false,
  } = options;

  const context = new ServerGameContext({ gameId: 'test-game' });

  const blueDef = CHAMPION_DEFINITIONS[blueChampion];
  const redDef = CHAMPION_DEFINITIONS[redChampion];

  if (!blueDef) throw new Error(`Unknown champion: ${blueChampion}`);
  if (!redDef) throw new Error(`Unknown champion: ${redChampion}`);

  const blue = new TestChampion({
    id: 'test-blue',
    position: bluePosition.clone(),
    side: TEAM_BLUE,
    definition: blueDef,
    playerId: 'player-blue',
  });

  const red = new TestChampion({
    id: 'test-red',
    position: redPosition.clone(),
    side: TEAM_RED,
    definition: redDef,
    playerId: 'player-red',
  });

  context.addChampion(blue, 'player-blue');
  context.addChampion(red, 'player-red');

  // Update fog of war so champions can see each other
  context.getFogOfWar().updateVision(context, 1);

  if (learnAbilities) {
    blue.learnAllAbilities();
    red.learnAllAbilities();
  }

  if (maxLevel) {
    blue.setLevel(18);
    red.setLevel(18);
    blue.setResource(blue.maxResource);
    red.setResource(red.maxResource);
  }

  let minionCounter = 0;
  let towerCounter = 0;
  let jungleCreatureCounter = 0;

  return {
    context,
    blue,
    red,

    tick: (dt = 1 / 60) => {
      blue.update(dt, context);
      red.update(dt, context);
    },

    tickFrames: (frames, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) {
        blue.update(dt, context);
        red.update(dt, context);
      }
    },

    tickAll: (dt = 1 / 60) => {
      // Update champions
      blue.update(dt, context);
      red.update(dt, context);
      // Update all entities (minions, towers, jungle creatures, projectiles, zones)
      for (const entity of context.getAllEntities()) {
        if (entity.id !== blue.id && entity.id !== red.id) {
          entity.update(dt, context);
        }
      }
    },

    tickAllFrames: (frames, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) {
        blue.update(dt, context);
        red.update(dt, context);
        for (const entity of context.getAllEntities()) {
          if (entity.id !== blue.id && entity.id !== red.id) {
            entity.update(dt, context);
          }
        }
      }
    },

    castAbility: (caster, slot, castOptions = {}) => {
      const { targetPosition, targetId } = castOptions;
      return abilityExecutor.castAbility({
        champion: caster,
        slot,
        targetPosition: targetPosition ?? red.position.clone(),
        targetEntityId: targetId,
        context,
      });
    },

    addMinion: (side, position, minionType = 'melee') => {
      const minion = new ServerMinion({
        id: `test-minion-${minionCounter++}`,
        position: position.clone(),
        side,
        minionType,
        lane: 'mid',
        waypoints: [],
      });
      context.addEntity(minion);
      return minion;
    },

    addTower: (side, position, lane = 'mid', tier = 1) => {
      const tower = new ServerTower({
        id: `test-tower-${towerCounter++}`,
        position: position.clone(),
        side,
        lane,
        tier,
      });
      context.addEntity(tower);
      return tower;
    },

    addJungleCreature: (position, creatureType = 'gromp') => {
      const creature = new ServerJungleCreature({
        id: `test-jungle-${jungleCreatureCounter++}`,
        position: position.clone(),
        campId: `test-camp-${jungleCreatureCounter}`,
        creatureType: creatureType as any,
        homePosition: position.clone(),
      });
      context.addEntity(creature);
      return creature;
    },
  };
}

// =============================================================================
// Damage Calculation Helpers
// =============================================================================

/**
 * Calculate expected physical damage after armor reduction.
 * Formula: damage * (100 / (100 + armor))
 */
export function calculatePhysicalDamage(baseDamage: number, targetArmor: number): number {
  if (targetArmor >= 0) {
    return baseDamage * (100 / (100 + targetArmor));
  } else {
    // Negative armor increases damage
    return baseDamage * (2 - 100 / (100 - targetArmor));
  }
}

/**
 * Calculate expected magic damage after magic resist reduction.
 * Formula: damage * (100 / (100 + magicResist))
 */
export function calculateMagicDamage(baseDamage: number, targetMR: number): number {
  if (targetMR >= 0) {
    return baseDamage * (100 / (100 + targetMR));
  } else {
    // Negative MR increases damage
    return baseDamage * (2 - 100 / (100 - targetMR));
  }
}

/**
 * Calculate ability damage based on scaling.
 */
export function calculateAbilityDamage(
  abilityId: string,
  rank: number,
  stats: { attackDamage?: number; abilityPower?: number; bonusHealth?: number }
): number {
  const def = getAbilityDefinition(abilityId);
  if (!def?.damage?.scaling) return 0;

  const scaling = def.damage.scaling;
  const baseIndex = Math.max(0, rank - 1);
  let damage = scaling.base[baseIndex] ?? scaling.base[0] ?? 0;

  if (scaling.adRatio && stats.attackDamage) {
    damage += stats.attackDamage * scaling.adRatio;
  }
  if (scaling.apRatio && stats.abilityPower) {
    damage += stats.abilityPower * scaling.apRatio;
  }
  if (scaling.bonusHealthRatio && stats.bonusHealth) {
    damage += stats.bonusHealth * scaling.bonusHealthRatio;
  }

  return damage;
}

// =============================================================================
// Effect Assertion Helpers
// =============================================================================

/**
 * Assert that a champion has a specific effect.
 */
export function assertHasEffect(champion: TestChampion, effectId: string): void {
  if (!champion.hasEffect(effectId)) {
    throw new Error(`Expected champion to have effect "${effectId}" but it was not found`);
  }
}

/**
 * Assert that a champion does not have a specific effect.
 */
export function assertNotHasEffect(champion: TestChampion, effectId: string): void {
  if (champion.hasEffect(effectId)) {
    throw new Error(`Expected champion to NOT have effect "${effectId}" but it was found`);
  }
}

/**
 * Assert that a champion is stunned.
 */
export function assertStunned(champion: TestChampion): void {
  if (!champion.ccStatus.isStunned) {
    throw new Error('Expected champion to be stunned');
  }
}

/**
 * Assert that a champion is rooted.
 */
export function assertRooted(champion: TestChampion): void {
  if (!champion.ccStatus.isRooted) {
    throw new Error('Expected champion to be rooted');
  }
}

/**
 * Assert that a champion is silenced.
 */
export function assertSilenced(champion: TestChampion): void {
  if (!champion.ccStatus.isSilenced) {
    throw new Error('Expected champion to be silenced');
  }
}

// =============================================================================
// Position Helpers
// =============================================================================

/**
 * Calculate distance between two champions.
 */
export function getDistance(a: TestChampion, b: TestChampion): number {
  return a.position.distanceTo(b.position);
}

/**
 * Move champion to a specific position.
 */
export function moveTo(champion: TestChampion, position: Vector): void {
  champion.position.x = position.x;
  champion.position.y = position.y;
}

/**
 * Move champion by an offset.
 */
export function moveBy(champion: TestChampion, dx: number, dy: number): void {
  champion.position.x += dx;
  champion.position.y += dy;
}
