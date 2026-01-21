/**
 * Test utilities for champions, abilities, and effects.
 * Provides helpers for creating test champions and verifying ability effects.
 */

import Vector from '@/physics/vector';
import { Side } from '@/types';
import { Champion } from '@/champions/Champion';
import { ChampionDefinition, ChampionBaseStats } from '@/champions/types';
import { createTestGameContext, TestRunner, MockGameContext } from './TestGameContext';
import RenderElement from '@/render/renderElement';

/**
 * A minimal test champion that doesn't require rendering.
 * Used for testing abilities and effects in isolation.
 */
export class TestDummy extends Champion {
  protected readonly definition: ChampionDefinition;

  constructor(
    position: Vector = new Vector(0, 0),
    side: Side = 0,
    overrides: Partial<ChampionBaseStats> = {}
  ) {
    super(position, side);

    // Default test champion definition
    this.definition = {
      id: 'test_dummy',
      name: 'Test Dummy',
      title: 'The Punching Bag',
      class: 'warrior',
      attackType: 'melee',
      resourceType: 'mana',
      baseStats: {
        health: 1000,
        healthRegen: 5,
        resource: 500,
        resourceRegen: 10,
        attackDamage: 50,
        abilityPower: 0,
        attackSpeed: 1.0,
        attackRange: 150,
        armor: 30,
        magicResist: 30,
        movementSpeed: 325,
        critChance: 0,
        critDamage: 2.0,
        ...overrides,
      },
      growthStats: {
        health: 85,
        healthRegen: 0.5,
        resource: 40,
        resourceRegen: 0.5,
        attackDamage: 3,
        attackSpeed: 2,
        armor: 3,
        magicResist: 1,
      },
      abilities: {
        Q: 'test_q',
        W: 'test_w',
        E: 'test_e',
        R: 'test_r',
      },
    };
  }

  protected initializeAbilities(): void {
    // No abilities by default
  }

  protected renderChampion(_gctx: any): void {
    // No-op for testing
  }

  /**
   * Override render to return empty for tests.
   */
  override render(): RenderElement {
    return new RenderElement(() => {}, false);
  }

  /**
   * Force set health for testing.
   */
  setHealth(health: number): void {
    this.state.health = health;
  }

  /**
   * Force set resource for testing.
   */
  setResource(resource: number): void {
    this.state.resource = resource;
  }

  /**
   * Force set level for testing.
   */
  setLevel(level: number): void {
    this.state.level = level;
  }

  /**
   * Get current state for assertions.
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get shields for testing.
   */
  getShields() {
    return [...this.shields];
  }

  /**
   * Get immunities for testing.
   */
  getImmunities(): Set<string> {
    return new Set(this.immunities);
  }

  /**
   * Get active effects for testing.
   */
  getActiveEffects() {
    return [...this.activeEffects];
  }

  /**
   * Get forced movement for testing.
   */
  getForcedMovement() {
    return this.forcedMovement ? { ...this.forcedMovement } : null;
  }

  /**
   * Get basic attack modifiers for testing.
   */
  getAttackModifiers() {
    return [...this.basicAttackModifiers];
  }

  /**
   * Get all active buffs/stat modifiers.
   */
  getBuffs() {
    return [...this.state.modifiers];
  }

  /**
   * Force set position for testing (matches Champion signature).
   */
  override setPosition(pos: Vector): void {
    this.position = pos.clone();
  }

  /**
   * Force set position for testing using x, y coordinates.
   */
  setPositionXY(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  /**
   * Force set velocity for testing.
   */
  setVelocity(x: number, y: number): void {
    this.velocity.x = x;
    this.velocity.y = y;
  }

  /**
   * Get velocity for testing.
   */
  getVelocity(): { x: number; y: number } {
    return { x: this.velocity.x, y: this.velocity.y };
  }

  /**
   * Get current position for testing.
   */
  getPositionXY(): { x: number; y: number } {
    return { x: this.position.x, y: this.position.y };
  }

  /**
   * Get computed stats for testing.
   */
  getComputedStats() {
    return this.getStats();
  }

  /**
   * Get definition for testing.
   */
  getDefinition() {
    return this.definition;
  }

  /**
   * Check if champion can move (not stunned/rooted).
   */
  canMove(): boolean {
    const ccStatus = this.getCrowdControlStatus();
    return ccStatus.canMove;
  }

  /**
   * Check if champion can cast abilities (not stunned/silenced).
   */
  canCast(): boolean {
    const ccStatus = this.getCrowdControlStatus();
    return ccStatus.canCast;
  }

  /**
   * Check if champion can attack (not stunned).
   */
  canAttack(): boolean {
    const ccStatus = this.getCrowdControlStatus();
    return ccStatus.canAttack;
  }
}

/**
 * Create a test arena with two opposing champions.
 */
export interface TestArena {
  runner: TestRunner;
  context: any; // Cast as any for compatibility with GameContext
  ally: TestDummy;
  enemy: TestDummy;
  tick: (dt?: number) => void;
  tickFrames: (frames: number, dt?: number) => void;
}

/**
 * Create a test arena with two opposing champions.
 */
export function createTestArena(options: {
  allyStats?: Partial<ChampionBaseStats>;
  enemyStats?: Partial<ChampionBaseStats>;
  allyPosition?: Vector;
  enemyPosition?: Vector;
} = {}): TestArena {
  const {
    allyStats = {},
    enemyStats = {},
    allyPosition = new Vector(0, 0),
    enemyPosition = new Vector(200, 0),
  } = options;

  const ally = new TestDummy(allyPosition, 0, allyStats);
  const enemy = new TestDummy(enemyPosition, 1, enemyStats);

  const runner = new TestRunner({
    objects: [ally, enemy],
  });

  // Initialize champions
  const context = runner.getContext();
  ally.init(context as any);
  enemy.init(context as any);

  return {
    runner,
    context,
    ally,
    enemy,
    tick: (dt = 1/60) => runner.tick(dt),
    tickFrames: (frames, dt = 1/60) => runner.tickFrames(frames, dt),
  };
}

/**
 * Assertion helpers for testing.
 */
export const assert = {
  /**
   * Assert a value equals expected.
   */
  equals<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        `Assertion failed: ${message ?? ''}\nExpected: ${expected}\nActual: ${actual}`
      );
    }
  },

  /**
   * Assert a value is approximately equal (for floating point).
   */
  approxEquals(actual: number, expected: number, epsilon: number = 0.01, message?: string): void {
    if (Math.abs(actual - expected) > epsilon) {
      throw new Error(
        `Assertion failed: ${message ?? ''}\nExpected: ~${expected}\nActual: ${actual}\n(epsilon: ${epsilon})`
      );
    }
  },

  /**
   * Assert value is true.
   */
  isTrue(value: boolean, message?: string): void {
    if (!value) {
      throw new Error(`Assertion failed: expected true. ${message ?? ''}`);
    }
  },

  /**
   * Assert value is false.
   */
  isFalse(value: boolean, message?: string): void {
    if (value) {
      throw new Error(`Assertion failed: expected false. ${message ?? ''}`);
    }
  },

  /**
   * Assert a value is greater than another.
   */
  greaterThan(actual: number, expected: number, message?: string): void {
    if (actual <= expected) {
      throw new Error(
        `Assertion failed: ${message ?? ''}\nExpected ${actual} > ${expected}`
      );
    }
  },

  /**
   * Assert a value is less than another.
   */
  lessThan(actual: number, expected: number, message?: string): void {
    if (actual >= expected) {
      throw new Error(
        `Assertion failed: ${message ?? ''}\nExpected ${actual} < ${expected}`
      );
    }
  },

  /**
   * Assert array/set contains an element.
   */
  contains<T>(collection: T[] | Set<T>, element: T, message?: string): void {
    const has = Array.isArray(collection)
      ? collection.includes(element)
      : collection.has(element);

    if (!has) {
      throw new Error(`Assertion failed: collection does not contain ${element}. ${message ?? ''}`);
    }
  },

  /**
   * Assert a function throws an error.
   */
  throws(fn: () => void, message?: string): void {
    try {
      fn();
      throw new Error(`Assertion failed: expected function to throw. ${message ?? ''}`);
    } catch (e) {
      // Expected
    }
  },
};

/**
 * Helper to calculate expected damage after armor reduction.
 */
export function calculateExpectedPhysicalDamage(baseDamage: number, targetArmor: number): number {
  return baseDamage * (100 / (100 + targetArmor));
}

/**
 * Helper to calculate expected damage after magic resist reduction.
 */
export function calculateExpectedMagicDamage(baseDamage: number, targetMR: number): number {
  return baseDamage * (100 / (100 + targetMR));
}

export default {
  TestDummy,
  createTestArena,
  assert,
  calculateExpectedPhysicalDamage,
  calculateExpectedMagicDamage,
};
