/**
 * Elara, the Bowmaiden
 *
 * A skilled archer who relies on range and precision.
 *
 * Role: Marksman
 * Attack Type: Ranged
 * Resource: Mana
 *
 * Abilities:
 * - Passive (Steady Aim): Basic attacks deal 10% bonus damage to targets > 500 units away
 * - Q (Piercing Arrow): Line skillshot that pierces enemies, dealing physical damage
 * - W (Quick Step): Dash + movement speed buff
 * - E (Crippling Shot): Targeted damage + slow
 * - R (Arrow Storm): Delayed AoE damage
 */

import { Champion } from '../Champion';
import { ChampionDefinition } from '../types';
import { CastAbilityDescriptor } from '@/abilities/CastAbilityDescriptor';
import {
  SelfTargetAbilityTargetDescription,
  SingleTargetInRangeAbilityTargetDescription,
  GroundTargetAbilityTargetDescription,
} from '@/abilities/AbilityTargetDescription';
import AbilityCost from '@/abilities/AbilityCost';
import {
  SemiImmediateEffect,
  DurationEffect,
  IEffect,
  EffectTargetType,
  EffectApplicationContext,
} from '@/effects/EffectDescriptor';
import { ScalingDamageEffect, ScalingStatBuffEffect } from '@/effects/ScalingEffect';
import { CC } from '@/effects/CrowdControlEffects';
import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';

// Helper function for calculating scaled damage
function calculateScaledValue(
  scaling: { base: number[]; adRatio?: number; apRatio?: number },
  caster: Champion,
  rank: number
): number {
  const stats = caster.getStats();
  const baseIndex = Math.min(rank - 1, scaling.base.length - 1);
  let value = scaling.base[Math.max(0, baseIndex)];

  if (scaling.adRatio) {
    value += stats.attackDamage * scaling.adRatio;
  }
  if (scaling.apRatio) {
    value += stats.abilityPower * scaling.apRatio;
  }

  return value;
}

// ===================
// Custom Effects
// ===================

/**
 * Piercing projectile effect - damages all enemies in a line.
 */
class PiercingArrowEffect implements IEffect {
  readonly scaling: { base: number[]; adRatio?: number };
  readonly damageType: 'physical' | 'magic' | 'true';
  readonly range: number;
  readonly width: number;
  readonly name: string;

  constructor(
    scaling: { base: number[]; adRatio?: number },
    damageType: 'physical' | 'magic' | 'true',
    range: number,
    width: number = 40,
    name: string = 'Piercing Arrow'
  ) {
    this.scaling = scaling;
    this.damageType = damageType;
    this.range = range;
    this.width = width;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, gameContext, abilityRank } = context;
    if (!gameContext) return;

    const rank = abilityRank ?? 1;
    const damage = calculateScaledValue(this.scaling, caster, rank);
    const casterPos = caster.getPosition();
    const direction = caster.getDirection();

    // Find all enemies in the line path
    const enemies = gameContext.objects.filter((obj): obj is Champion =>
      obj instanceof Champion &&
      obj.getSide() !== caster.getSide() &&
      !obj.isDead()
    );

    for (const enemy of enemies) {
      const enemyPos = enemy.getPosition();
      const toEnemy = enemyPos.clone().sub(casterPos);
      const distance = toEnemy.length();

      if (distance > this.range) continue;

      // Check if enemy is within the line width
      // Project enemy position onto the line direction
      const dot = toEnemy.x * direction.x + toEnemy.y * direction.y;
      if (dot < 0) continue; // Enemy is behind

      // Calculate perpendicular distance from the line
      const projX = casterPos.x + direction.x * dot;
      const projY = casterPos.y + direction.y * dot;
      const perpDist = Math.sqrt(
        Math.pow(enemyPos.x - projX, 2) + Math.pow(enemyPos.y - projY, 2)
      );

      if (perpDist <= this.width / 2) {
        enemy.takeDamage(damage, this.damageType, caster, this.name);
      }
    }
  }

  clone(): IEffect {
    return new PiercingArrowEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.damageType,
      this.range,
      this.width,
      this.name
    );
  }
}

/**
 * Dash effect with movement speed buff.
 */
class DashWithSpeedBuffEffect implements IEffect {
  readonly dashDistance: number;
  readonly speedBonus: number;
  readonly duration: number;

  constructor(dashDistance: number, speedBonus: number, duration: number) {
    this.dashDistance = dashDistance;
    this.speedBonus = speedBonus;
    this.duration = duration;
  }

  apply(context: EffectApplicationContext): void {
    const { caster } = context;

    // Get dash direction (facing direction)
    const direction = caster.getDirection();

    // Start dash
    caster.startDash(direction, this.dashDistance, 800);

    // Apply movement speed buff
    caster.applyBuff(
      'elara_quick_step',
      undefined,
      { movementSpeed: this.speedBonus },
      this.duration
    );
  }

  clone(): IEffect {
    return new DashWithSpeedBuffEffect(this.dashDistance, this.speedBonus, this.duration);
  }
}

/**
 * Targeted damage with slow effect.
 */
class CripplingEffect implements IEffect {
  readonly scaling: { base: number[]; adRatio?: number };
  readonly damageType: 'physical' | 'magic' | 'true';
  readonly slowPercent: number[];
  readonly slowDuration: number;

  constructor(
    scaling: { base: number[]; adRatio?: number },
    damageType: 'physical' | 'magic' | 'true',
    slowPercent: number[],
    slowDuration: number
  ) {
    this.scaling = scaling;
    this.damageType = damageType;
    this.slowPercent = slowPercent;
    this.slowDuration = slowDuration;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target, abilityRank } = context;

    if (!target || target === caster) return;

    const rank = abilityRank ?? 1;
    const damage = calculateScaledValue(this.scaling, caster, rank);
    const slowIndex = Math.min(rank - 1, this.slowPercent.length - 1);
    const slow = this.slowPercent[Math.max(0, slowIndex)];

    // Deal damage
    target.takeDamage(damage, this.damageType, caster, 'Crippling Shot');

    // Apply slow
    const slowEffect = CC.slow('elara_e', this.slowDuration, slow);
    slowEffect.apply(target);
  }

  clone(): IEffect {
    return new CripplingEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.damageType,
      [...this.slowPercent],
      this.slowDuration
    );
  }
}

/**
 * Delayed AoE damage effect.
 */
class DelayedAoEDamageEffect implements IEffect {
  readonly scaling: { base: number[]; adRatio?: number };
  readonly damageType: 'physical' | 'magic' | 'true';
  readonly radius: number;
  readonly name: string;

  constructor(
    scaling: { base: number[]; adRatio?: number },
    damageType: 'physical' | 'magic' | 'true',
    radius: number,
    name: string = 'Arrow Storm'
  ) {
    this.scaling = scaling;
    this.damageType = damageType;
    this.radius = radius;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, targetPosition, gameContext, abilityRank } = context;
    if (!gameContext || !targetPosition) return;

    const rank = abilityRank ?? 1;
    const damage = calculateScaledValue(this.scaling, caster, rank);

    // Find all enemies in the area
    const enemies = gameContext.objects.filter((obj): obj is Champion =>
      obj instanceof Champion &&
      obj.getSide() !== caster.getSide() &&
      !obj.isDead()
    );

    for (const enemy of enemies) {
      const distance = enemy.getPosition().distanceTo(targetPosition);

      if (distance <= this.radius) {
        enemy.takeDamage(damage, this.damageType, caster, this.name);
      }
    }
  }

  clone(): IEffect {
    return new DelayedAoEDamageEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.damageType,
      this.radius,
      this.name
    );
  }
}

// ===================
// Ability Creators
// ===================

function createPiercingArrow(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Piercing Arrow',
    description: 'Fire an arrow in a line that passes through enemies, dealing 70/110/150/190/230 physical damage.',
    cost: new AbilityCost({
      energy: 50,
      cooldown: 7,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      new SemiImmediateEffect(
        new PiercingArrowEffect(
          { base: [70, 110, 150, 190, 230], adRatio: 0.7 },
          'physical',
          800,
          60,
          'Piercing Arrow'
        ),
        EffectTargetType.self
      ),
    ],
    castTime: 0,
    cooldown: 7,
    cooldownPerRank: [7, 6.5, 6, 5.5, 5],
  });
}

function createQuickStep(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Quick Step',
    description: 'Dash a short distance and gain 30% movement speed for 2 seconds.',
    cost: new AbilityCost({
      energy: 40,
      cooldown: 14,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      new SemiImmediateEffect(
        new DashWithSpeedBuffEffect(300, 0.3, 2),
        EffectTargetType.self
      ),
    ],
    castTime: 0,
    cooldown: 14,
    cooldownPerRank: [14, 13, 12, 11, 10],
  });
}

function createCripplingShot(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Crippling Shot',
    description: 'Fire an arrow at target enemy, dealing 50/80/110/140/170 physical damage and slowing them by 30/35/40/45/50% for 2 seconds.',
    cost: new AbilityCost({
      energy: 55,
      cooldown: 10,
    }),
    target: new SingleTargetInRangeAbilityTargetDescription(600),
    effects: [
      new SemiImmediateEffect(
        new CripplingEffect(
          { base: [50, 80, 110, 140, 170], adRatio: 0.5 },
          'physical',
          [0.3, 0.35, 0.4, 0.45, 0.5],
          2
        ),
        EffectTargetType.enemy
      ),
    ],
    castTime: 0,
    cooldown: 10,
    cooldownPerRank: [10, 9.5, 9, 8.5, 8],
  });
}

function createArrowStorm(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Arrow Storm',
    description: 'Fire a volley of arrows at a target area, dealing 200/300/400 physical damage to all enemies.',
    cost: new AbilityCost({
      energy: 100,
      cooldown: 90,
    }),
    target: new GroundTargetAbilityTargetDescription(700),
    effects: [
      new SemiImmediateEffect(
        new DelayedAoEDamageEffect(
          { base: [200, 300, 400] },
          'physical',
          250,
          'Arrow Storm'
        ),
        EffectTargetType.self // Effect uses caster context for targetPosition
      ),
    ],
    castTime: 0,
    cooldown: 90,
    cooldownPerRank: [90, 80, 70],
  });
}

// ===================
// Champion Definition
// ===================

const ElaraDefinition: ChampionDefinition = {
  id: 'elara',
  name: 'Elara',
  title: 'The Bowmaiden',
  class: 'marksman',
  attackType: 'ranged',
  resourceType: 'mana',
  baseStats: {
    health: 550,
    healthRegen: 4,
    resource: 300,
    resourceRegen: 7,
    attackDamage: 55,
    abilityPower: 0,
    attackSpeed: 0.7,
    attackRange: 550,
    armor: 25,
    magicResist: 30,
    movementSpeed: 325,
    critChance: 0,
    critDamage: 2.0,
  },
  growthStats: {
    health: 90,
    healthRegen: 0.5,
    resource: 40,
    resourceRegen: 0.5,
    attackDamage: 3,
    attackSpeed: 2.5,
    armor: 3,
    magicResist: 1,
  },
  abilities: {
    Q: 'elara_piercing_arrow',
    W: 'elara_quick_step',
    E: 'elara_crippling_shot',
    R: 'elara_arrow_storm',
  },
};

// ===================
// Elara Champion Class
// ===================

export class Elara extends Champion {
  protected readonly definition = ElaraDefinition;

  // Abilities
  private piercingArrow: CastAbilityDescriptor;
  private quickStep: CastAbilityDescriptor;
  private cripplingShot: CastAbilityDescriptor;
  private arrowStorm: CastAbilityDescriptor;

  // Passive constants
  private readonly PASSIVE_RANGE_THRESHOLD = 500;
  private readonly PASSIVE_BONUS_DAMAGE = 0.1;

  // Store game context
  private gameContext: GameContext | null = null;

  constructor(position: Vector, side: number) {
    super(position, side as 0 | 1);

    // Create abilities
    this.piercingArrow = createPiercingArrow();
    this.quickStep = createQuickStep();
    this.cripplingShot = createCripplingShot();
    this.arrowStorm = createArrowStorm();

    // Set owners
    this.piercingArrow.setOwner(this);
    this.quickStep.setOwner(this);
    this.cripplingShot.setOwner(this);
    this.arrowStorm.setOwner(this);
  }

  protected initializeAbilities(): void {
    // Using the new ability system
  }

  override init(gctx: GameContext): void {
    super.init(gctx);
    this.gameContext = gctx;
  }

  /**
   * Override basic attack to apply Steady Aim passive.
   */
  override performBasicAttack(gameContext: GameContext, target: Champion): void {
    if (!target || !target.getPosition) {
      super.performBasicAttack(gameContext, target);
      return;
    }

    const distance = this.getPosition().distanceTo(target.getPosition());

    if (distance > this.PASSIVE_RANGE_THRESHOLD) {
      // Apply bonus damage buff temporarily
      this.applyBuff('elara_steady_aim', { attackDamage: this.getStats().attackDamage * this.PASSIVE_BONUS_DAMAGE }, undefined, 0.1);
    }

    super.performBasicAttack(gameContext, target);
  }

  /**
   * Check if Elara can cast an ability.
   */
  canCastElaraAbility(abilityKey: 'Q' | 'W' | 'E' | 'R', target?: Champion | Vector): boolean {
    const ability = this.getElaraAbility(abilityKey);
    if (!ability) return false;

    // Check mana
    const energyCost = ability.getCurrentCost();
    if (this.state.resource < energyCost) return false;

    // Check cooldown
    if (!ability.isReady()) return false;

    // Check target range for E
    if (abilityKey === 'E' && target instanceof Champion) {
      const distance = this.getPosition().distanceTo(target.getPosition());
      if (distance > 600) return false;
    }

    return true;
  }

  /**
   * Cast an ability by key.
   */
  castElaraAbility(abilityKey: 'Q' | 'W' | 'E' | 'R', gctx: GameContext, target?: Champion | Vector): boolean {
    switch (abilityKey) {
      case 'Q':
        return this.piercingArrow.cast(gctx).success;
      case 'W':
        return this.quickStep.cast(gctx).success;
      case 'E':
        if (target instanceof Champion) {
          return this.cripplingShot.cast(gctx, target).success;
        }
        return false;
      case 'R':
        if (target instanceof Vector) {
          return this.arrowStorm.cast(gctx, undefined, target).success;
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Get ability by key.
   */
  private getElaraAbility(key: 'Q' | 'W' | 'E' | 'R'): CastAbilityDescriptor | null {
    switch (key) {
      case 'Q': return this.piercingArrow;
      case 'W': return this.quickStep;
      case 'E': return this.cripplingShot;
      case 'R': return this.arrowStorm;
      default: return null;
    }
  }

  /**
   * Get all abilities for UI/AI.
   */
  getAbilities(): CastAbilityDescriptor[] {
    return [this.piercingArrow, this.quickStep, this.cripplingShot, this.arrowStorm];
  }

  /**
   * Update abilities each frame.
   */
  override step(gctx: GameContext): void {
    this.gameContext = gctx;
    super.step(gctx);

    if (this.isDead()) return;

    const dt = gctx.dt;

    // Update abilities
    this.piercingArrow.update(gctx, dt);
    this.quickStep.update(gctx, dt);
    this.cripplingShot.update(gctx, dt);
    this.arrowStorm.update(gctx, dt);
  }

  /**
   * Render Elara.
   */
  protected renderChampion(_gctx: GameContext): void {
    // Rendering handled by render system
  }
}

export default Elara;
