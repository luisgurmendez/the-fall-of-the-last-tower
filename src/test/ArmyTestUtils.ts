/**
 * Test utilities for army units (Swordsman, Archer, Arrow).
 * Provides helpers for creating test units and verifying combat behavior.
 */

import Vector from '@/physics/vector';
import { createTestGameContext, TestRunner, MockGameContext } from './TestGameContext';
import Swordsman from '@/objects/army/swordsman/swordsman';
import Archer from '@/objects/army/archer/archer';
import Arrow from '@/objects/army/archer/arrow';
import ArmyUnit from '@/objects/army/armyUnit';
import { UnitConfig } from '@/config';

/**
 * Test wrapper for Swordsman that exposes protected state for testing.
 */
export class TestSwordsman extends Swordsman {
  /**
   * Get current health for testing.
   */
  getHealth(): number {
    return this.health;
  }

  /**
   * Set health for testing.
   */
  setHealth(health: number): void {
    (this as any).health = health;
  }

  /**
   * Get max health for testing.
   */
  getMaxHealth(): number {
    return this.maxHealth;
  }

  /**
   * Get armor for testing.
   */
  getArmor(): number {
    return this.armor;
  }

  /**
   * Set armor for testing.
   */
  setArmor(armor: number): void {
    (this as any).armor = armor;
  }

  /**
   * Get magic resist for testing.
   */
  getMagicResist(): number {
    return this.magicResist;
  }

  /**
   * Set magic resist for testing.
   */
  setMagicResist(mr: number): void {
    (this as any).magicResist = mr;
  }

  /**
   * Get attack range for testing.
   */
  getAttackRange(): number {
    return this.attackRange;
  }

  /**
   * Check if unit can attack (off cooldown).
   */
  canAttackNow(): boolean {
    return this.canAttack();
  }

  /**
   * Check if unit is currently attacking.
   */
  isCurrentlyAttacking(): boolean {
    return this.isAttacking;
  }

  /**
   * Get shields for testing.
   */
  getShields() {
    return [...this.shields];
  }

  /**
   * Get total shield amount.
   */
  getShieldAmount(): number {
    return this.getTotalShield();
  }

  /**
   * Get active effects for testing.
   */
  getActiveEffects() {
    return [...this.activeEffects];
  }

  /**
   * Get immunities for testing.
   */
  getImmunities(): Set<string> {
    return new Set(this.immunities);
  }

  /**
   * Check if dead.
   */
  getIsDead(): boolean {
    return this._isDead;
  }

  /**
   * Force set position for testing.
   */
  setPositionXY(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  /**
   * Get position as simple object.
   */
  getPositionXY(): { x: number; y: number } {
    return { x: this.position.x, y: this.position.y };
  }

  /**
   * Expose target for testing.
   */
  getTarget() {
    return this.target;
  }

  /**
   * Set target for testing.
   */
  setTarget(target: any) {
    this.target = target;
  }
}

/**
 * Test wrapper for Archer that exposes protected state for testing.
 */
export class TestArcher extends Archer {
  /**
   * Get current health for testing.
   */
  getHealth(): number {
    return this.health;
  }

  /**
   * Set health for testing.
   */
  setHealth(health: number): void {
    (this as any).health = health;
  }

  /**
   * Get max health for testing.
   */
  getMaxHealth(): number {
    return this.maxHealth;
  }

  /**
   * Get armor for testing.
   */
  getArmor(): number {
    return this.armor;
  }

  /**
   * Set armor for testing.
   */
  setArmor(armor: number): void {
    (this as any).armor = armor;
  }

  /**
   * Get magic resist for testing.
   */
  getMagicResist(): number {
    return this.magicResist;
  }

  /**
   * Set magic resist for testing.
   */
  setMagicResist(mr: number): void {
    (this as any).magicResist = mr;
  }

  /**
   * Get attack range for testing.
   */
  getAttackRange(): number {
    return this.attackRange;
  }

  /**
   * Check if unit can attack (off cooldown).
   */
  canAttackNow(): boolean {
    return this.canAttack();
  }

  /**
   * Check if unit is currently attacking.
   */
  isCurrentlyAttacking(): boolean {
    return this.isAttacking;
  }

  /**
   * Get shields for testing.
   */
  getShields() {
    return [...this.shields];
  }

  /**
   * Get total shield amount.
   */
  getShieldAmount(): number {
    return this.getTotalShield();
  }

  /**
   * Get active effects for testing.
   */
  getActiveEffects() {
    return [...this.activeEffects];
  }

  /**
   * Get immunities for testing.
   */
  getImmunities(): Set<string> {
    return new Set(this.immunities);
  }

  /**
   * Check if dead.
   */
  getIsDead(): boolean {
    return this._isDead;
  }

  /**
   * Force set position for testing.
   */
  setPositionXY(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  /**
   * Get position as simple object.
   */
  getPositionXY(): { x: number; y: number } {
    return { x: this.position.x, y: this.position.y };
  }

  /**
   * Expose target for testing.
   */
  getTarget() {
    return this.target;
  }

  /**
   * Set target for testing.
   */
  setTarget(target: any) {
    this.target = target;
  }
}

/**
 * Test wrapper for Arrow.
 */
export class TestArrow extends Arrow {
  /**
   * Get TTL for testing.
   */
  getTTL(): number {
    return this.ttl;
  }

  /**
   * Set TTL for testing.
   */
  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  /**
   * Get damage for testing.
   */
  getDamage(): number {
    return this.damage;
  }

  /**
   * Get position as simple object.
   */
  getPositionXY(): { x: number; y: number } {
    return { x: this.position.x, y: this.position.y };
  }

  /**
   * Get velocity for testing.
   */
  getVelocityXY(): { x: number; y: number } {
    return { x: this.velocity.x, y: this.velocity.y };
  }
}

/**
 * Test arena for army unit combat testing.
 */
export interface ArmyTestArena {
  runner: TestRunner;
  context: MockGameContext;
  ally: TestSwordsman | TestArcher;
  enemy: TestSwordsman | TestArcher;
  tick: (dt?: number) => void;
  tickFrames: (frames: number, dt?: number) => void;
  getObjects: () => any[];
}

/**
 * Options for creating an army test arena.
 */
export interface ArmyTestArenaOptions {
  /** Type of ally unit (default: 'swordsman') */
  allyType?: 'swordsman' | 'archer';
  /** Type of enemy unit (default: 'swordsman') */
  enemyType?: 'swordsman' | 'archer';
  /** Ally starting position */
  allyPosition?: Vector;
  /** Enemy starting position */
  enemyPosition?: Vector;
}

/**
 * Create a test arena with two opposing army units.
 */
export function createArmyTestArena(options: ArmyTestArenaOptions = {}): ArmyTestArena {
  const {
    allyType = 'swordsman',
    enemyType = 'swordsman',
    allyPosition = new Vector(0, 0),
    enemyPosition = new Vector(200, 0),
  } = options;

  const ally = allyType === 'swordsman'
    ? new TestSwordsman(allyPosition.clone(), 0)
    : new TestArcher(allyPosition.clone(), 0);

  const enemy = enemyType === 'swordsman'
    ? new TestSwordsman(enemyPosition.clone(), 1)
    : new TestArcher(enemyPosition.clone(), 1);

  const objects: any[] = [ally, enemy];

  const runner = new TestRunner({
    objects,
  });

  return {
    runner,
    context: runner.getContext(),
    ally,
    enemy,
    tick: (dt = 1/60) => runner.tick(dt),
    tickFrames: (frames, dt = 1/60) => runner.tickFrames(frames, dt),
    getObjects: () => objects,
  };
}

/**
 * Create a test arrow for isolated testing.
 */
export function createTestArrow(options: {
  position?: Vector;
  direction?: Vector;
  side?: 0 | 1;
  damage?: number;
} = {}): TestArrow {
  const {
    position = new Vector(0, 0),
    direction = new Vector(1, 0),
    side = 0,
    damage = UnitConfig.ARROW.DAMAGE,
  } = options;

  return new TestArrow(position, direction, side, damage);
}

/**
 * Helper to calculate expected physical damage after armor reduction.
 */
export function calculateExpectedPhysicalDamage(baseDamage: number, targetArmor: number): number {
  return baseDamage * (100 / (100 + targetArmor));
}

/**
 * Helper to calculate expected magic damage after MR reduction.
 */
export function calculateExpectedMagicDamage(baseDamage: number, targetMR: number): number {
  return baseDamage * (100 / (100 + targetMR));
}

/**
 * Get unit config for assertions.
 */
export const Config = {
  Swordsman: UnitConfig.SWORDSMAN,
  Archer: UnitConfig.ARCHER,
  Arrow: UnitConfig.ARROW,
};

export default {
  TestSwordsman,
  TestArcher,
  TestArrow,
  createArmyTestArena,
  createTestArrow,
  calculateExpectedPhysicalDamage,
  calculateExpectedMagicDamage,
  Config,
};
