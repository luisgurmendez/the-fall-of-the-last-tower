/**
 * Describes how an ability selects its targets.
 */

import type { Champion } from '@/champions/Champion';
import type Vector from '@/physics/vector';

/**
 * Base interface for target descriptions.
 */
export interface IAbilityTargetDescription {
  /** Whether this ability requires a target selection */
  requiresTarget: boolean;
  /** Whether this ability targets the ground */
  targetsGround: boolean;
  /** The range of the ability (if applicable) */
  range?: number;
  /** Validate if a target is valid */
  isValidTarget(caster: Champion, target: Champion | null, position: Vector | null): boolean;
  /** Get all valid targets in range */
  getValidTargets(caster: Champion, allChampions: Champion[]): Champion[];
}

/**
 * No target needed - self-cast or auto-targeting.
 */
export class NoTargetAbilityTargetDescription implements IAbilityTargetDescription {
  readonly requiresTarget = false;
  readonly targetsGround = false;

  isValidTarget(): boolean {
    return true;
  }

  getValidTargets(): Champion[] {
    return [];
  }
}

/**
 * Targets self only.
 */
export class SelfTargetAbilityTargetDescription implements IAbilityTargetDescription {
  readonly requiresTarget = false;
  readonly targetsGround = false;

  isValidTarget(caster: Champion, target: Champion | null): boolean {
    return target === null || target === caster;
  }

  getValidTargets(caster: Champion): Champion[] {
    return [caster];
  }
}

/**
 * Targets a single enemy within range.
 */
export class SingleTargetInRangeAbilityTargetDescription implements IAbilityTargetDescription {
  readonly requiresTarget = true;
  readonly targetsGround = false;
  readonly range: number;

  constructor(range: number) {
    this.range = range;
  }

  isValidTarget(caster: Champion, target: Champion | null): boolean {
    if (!target) return false;
    if (target.getSide() === caster.getSide()) return false;

    const distance = caster.getPosition().distanceTo(target.getPosition());
    return distance <= this.range;
  }

  getValidTargets(caster: Champion, allChampions: Champion[]): Champion[] {
    return allChampions.filter(c =>
      c.getSide() !== caster.getSide() &&
      caster.getPosition().distanceTo(c.getPosition()) <= this.range
    );
  }
}

/**
 * Targets a single ally within range.
 */
export class SingleAllyInRangeAbilityTargetDescription implements IAbilityTargetDescription {
  readonly requiresTarget = true;
  readonly targetsGround = false;
  readonly range: number;

  constructor(range: number) {
    this.range = range;
  }

  isValidTarget(caster: Champion, target: Champion | null): boolean {
    if (!target) return false;
    if (target.getSide() !== caster.getSide()) return false;

    const distance = caster.getPosition().distanceTo(target.getPosition());
    return distance <= this.range;
  }

  getValidTargets(caster: Champion, allChampions: Champion[]): Champion[] {
    return allChampions.filter(c =>
      c.getSide() === caster.getSide() &&
      caster.getPosition().distanceTo(c.getPosition()) <= this.range
    );
  }
}

/**
 * Targets any single champion (ally or enemy) within range.
 */
export class SingleAnyTargetInRangeAbilityTargetDescription implements IAbilityTargetDescription {
  readonly requiresTarget = true;
  readonly targetsGround = false;
  readonly range: number;

  constructor(range: number) {
    this.range = range;
  }

  isValidTarget(caster: Champion, target: Champion | null): boolean {
    if (!target) return false;

    const distance = caster.getPosition().distanceTo(target.getPosition());
    return distance <= this.range;
  }

  getValidTargets(caster: Champion, allChampions: Champion[]): Champion[] {
    return allChampions.filter(c =>
      caster.getPosition().distanceTo(c.getPosition()) <= this.range
    );
  }
}

/**
 * Targets a ground position within range.
 */
export class GroundTargetAbilityTargetDescription implements IAbilityTargetDescription {
  readonly requiresTarget = false;
  readonly targetsGround = true;
  readonly range: number;
  readonly aoeRadius: number;

  constructor(range: number, aoeRadius: number = 0) {
    this.range = range;
    this.aoeRadius = aoeRadius;
  }

  isValidTarget(caster: Champion, target: Champion | null, position: Vector | null): boolean {
    if (!position) return false;

    const distance = caster.getPosition().distanceTo(position);
    return distance <= this.range;
  }

  getValidTargets(): Champion[] {
    return [];
  }

  /**
   * Get all champions within the AoE at a given position.
   */
  getChampionsInAoE(position: Vector, allChampions: Champion[]): Champion[] {
    if (this.aoeRadius <= 0) return [];

    return allChampions.filter(c =>
      c.getPosition().distanceTo(position) <= this.aoeRadius
    );
  }
}

/**
 * Skillshot - fires in a direction.
 */
export class SkillshotAbilityTargetDescription implements IAbilityTargetDescription {
  readonly requiresTarget = false;
  readonly targetsGround = true;
  readonly range: number;
  readonly width: number;

  constructor(range: number, width: number = 60) {
    this.range = range;
    this.width = width;
  }

  isValidTarget(caster: Champion, target: Champion | null, position: Vector | null): boolean {
    // Skillshots just need a direction, any position is valid
    return true;
  }

  getValidTargets(): Champion[] {
    return [];
  }
}

/**
 * AoE around the caster.
 */
export class AoEAroundSelfAbilityTargetDescription implements IAbilityTargetDescription {
  readonly requiresTarget = false;
  readonly targetsGround = false;
  readonly range: number;

  constructor(range: number) {
    this.range = range;
  }

  isValidTarget(): boolean {
    return true;
  }

  getValidTargets(caster: Champion, allChampions: Champion[]): Champion[] {
    return allChampions.filter(c =>
      c !== caster &&
      caster.getPosition().distanceTo(c.getPosition()) <= this.range
    );
  }
}
