/**
 * Magnus, the Battlemage
 *
 * A powerful mage who excels at burst damage from a distance.
 *
 * Role: Mage
 * Attack Type: Ranged
 * Resource: Mana
 *
 * Abilities:
 * - Passive (Arcane Surge): Abilities generate stacks (max 4) that increase ability damage by 5% each
 * - Q (Fireball): Skillshot that damages first enemy hit
 * - W (Arcane Shield): Self shield
 * - E (Blink): Instant teleport to target location
 * - R (Meteor): Delayed AoE magic damage
 */

import { Champion } from '../Champion';
import { ChampionDefinition } from '../types';
import { CastAbilityDescriptor } from '@/abilities/CastAbilityDescriptor';
import {
  SelfTargetAbilityTargetDescription,
  GroundTargetAbilityTargetDescription,
  SkillshotAbilityTargetDescription,
} from '@/abilities/AbilityTargetDescription';
import AbilityCost from '@/abilities/AbilityCost';
import {
  SemiImmediateEffect,
  IEffect,
  EffectTargetType,
  EffectApplicationContext,
} from '@/effects/EffectDescriptor';
import { ScalingShieldEffect } from '@/effects/ScalingEffect';
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
 * Fireball effect - hits first enemy in a line.
 */
class FireballEffect implements IEffect {
  readonly scaling: { base: number[]; apRatio?: number };
  readonly damageType: 'magic';
  readonly range: number;
  readonly width: number;
  readonly name: string;

  constructor(
    scaling: { base: number[]; apRatio?: number },
    range: number,
    width: number = 50,
    name: string = 'Fireball'
  ) {
    this.scaling = scaling;
    this.damageType = 'magic';
    this.range = range;
    this.width = width;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, abilityRank } = context;

    const rank = abilityRank ?? 1;
    // Get damage multiplier from caster (Magnus's Arcane Surge passive)
    const damageMultiplier = typeof (caster as any).getDamageMultiplier === 'function'
      ? (caster as any).getDamageMultiplier()
      : 1;
    const damage = calculateScaledValue(this.scaling, caster, rank) * damageMultiplier;

    const casterPos = caster.getPosition();
    const direction = caster.getDirection();

    // Find enemies in a line
    const gameContext = (caster as any).gameContext as GameContext;
    if (!gameContext?.objects) return;

    const enemies = gameContext.objects.filter(
      (obj): obj is Champion =>
        obj instanceof Champion &&
        obj !== caster &&
        obj.getTeamId() !== caster.getTeamId() &&
        !obj.isDead()
    );

    // Find the closest enemy in the line
    let closestEnemy: Champion | null = null;
    let closestDistance = Infinity;

    for (const enemy of enemies) {
      const enemyPos = enemy.getPosition();
      const toEnemy = enemyPos.clone().sub(casterPos);
      const distance = toEnemy.length();

      if (distance > this.range) continue;

      // Check if enemy is within the line width
      const dot = toEnemy.x * direction.x + toEnemy.y * direction.y;
      if (dot < 0) continue; // Enemy is behind

      // Calculate perpendicular distance from the line
      const projX = casterPos.x + direction.x * dot;
      const projY = casterPos.y + direction.y * dot;
      const perpDist = Math.sqrt(
        Math.pow(enemyPos.x - projX, 2) + Math.pow(enemyPos.y - projY, 2)
      );

      if (perpDist <= this.width / 2 && dot < closestDistance) {
        closestEnemy = enemy;
        closestDistance = dot;
      }
    }

    // Only hit the first (closest) enemy
    if (closestEnemy) {
      closestEnemy.takeDamage(damage, this.damageType, caster, this.name);
    }
  }

  clone(): IEffect {
    return new FireballEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.range,
      this.width,
      this.name
    );
  }
}

/**
 * Blink effect - instant teleport to target location.
 */
class BlinkEffect implements IEffect {
  readonly maxRange: number;

  constructor(maxRange: number) {
    this.maxRange = maxRange;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, targetPosition } = context;

    if (!targetPosition) return;

    const casterPos = caster.getPosition();
    const toTarget = targetPosition.clone().sub(casterPos);
    const distance = toTarget.length();

    // Clamp to max range
    if (distance > this.maxRange) {
      const direction = toTarget.normalize();
      const newPos = casterPos.clone().add(direction.scalar(this.maxRange));
      caster.setPosition(newPos);
    } else {
      caster.setPosition(targetPosition.clone());
    }
  }

  clone(): IEffect {
    return new BlinkEffect(this.maxRange);
  }
}

/**
 * Delayed AoE damage effect (for Meteor).
 */
class DelayedAoEMagicDamageEffect implements IEffect {
  readonly scaling: { base: number[]; apRatio?: number };
  readonly damageType: 'magic';
  readonly radius: number;
  readonly delay: number; // in seconds
  readonly name: string;

  constructor(
    scaling: { base: number[]; apRatio?: number },
    radius: number,
    delay: number,
    name: string = 'Meteor'
  ) {
    this.scaling = scaling;
    this.damageType = 'magic';
    this.radius = radius;
    this.delay = delay;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, targetPosition, abilityRank } = context;

    if (!targetPosition) return;

    const gameContext = (caster as any).gameContext as GameContext;
    if (!gameContext) return;

    const rank = abilityRank ?? 1;
    // Get damage multiplier from caster (Magnus's Arcane Surge passive)
    const damageMultiplier = typeof (caster as any).getDamageMultiplier === 'function'
      ? (caster as any).getDamageMultiplier()
      : 1;
    const damage = calculateScaledValue(this.scaling, caster, rank) * damageMultiplier;
    const impactPosition = targetPosition.clone();

    // Schedule the damage after delay
    const delayFrames = Math.floor(this.delay * 60);
    let frameCount = 0;

    const checkDamage = () => {
      frameCount++;
      if (frameCount >= delayFrames) {
        // Deal damage to all enemies in radius
        const enemies = gameContext.objects.filter(
          (obj): obj is Champion =>
            obj instanceof Champion &&
            obj !== caster &&
            obj.getTeamId() !== caster.getTeamId() &&
            !obj.isDead()
        );

        for (const enemy of enemies) {
          const enemyPos = enemy.getPosition();
          const dist = enemyPos.distanceTo(impactPosition);

          if (dist <= this.radius) {
            enemy.takeDamage(damage, this.damageType, caster, this.name);
          }
        }
        return true; // Done
      }
      return false; // Continue
    };

    // Register the delayed effect
    if ((caster as any).registerDelayedEffect) {
      (caster as any).registerDelayedEffect(checkDamage);
    } else {
      // Fallback: use internal tracking
      if (!(caster as any)._delayedEffects) {
        (caster as any)._delayedEffects = [];
      }
      (caster as any)._delayedEffects.push(checkDamage);
    }
  }

  clone(): IEffect {
    return new DelayedAoEMagicDamageEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.radius,
      this.delay,
      this.name
    );
  }
}

// ===================
// Ability Factories
// ===================

function createFireball(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Fireball',
    description: 'Hurls a fireball dealing 80/125/170/215/260 (+65% AP) magic damage to the first enemy hit.',
    cost: new AbilityCost({
      energy: 45,
      cooldown: 5,
    }),
    target: new SkillshotAbilityTargetDescription(700, 50),
    effects: [
      new SemiImmediateEffect(
        new FireballEffect(
          { base: [80, 125, 170, 215, 260], apRatio: 0.65 },
          700,
          50,
          'Fireball'
        ),
        EffectTargetType.self
      ),
    ],
    castTime: 0,
    cooldown: 5,
    cooldownPerRank: [5, 5, 5, 5, 5],
  });
}

function createArcaneShield(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Arcane Shield',
    description: 'Gains a shield absorbing 60/100/140/180/220 (+40% AP) damage for 3 seconds.',
    cost: new AbilityCost({
      energy: 60,
      cooldown: 14,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      new SemiImmediateEffect(
        new ScalingShieldEffect(
          { base: [60, 100, 140, 180, 220], apRatio: 0.4 },
          3
        ),
        EffectTargetType.self
      ),
    ],
    castTime: 0,
    cooldown: 14,
    cooldownPerRank: [14, 13, 12, 11, 10],
  });
}

function createBlink(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Blink',
    description: 'Instantly teleports to target location.',
    cost: new AbilityCost({
      energy: 80,
      cooldown: 16,
    }),
    target: new GroundTargetAbilityTargetDescription(400),
    effects: [
      new SemiImmediateEffect(
        new BlinkEffect(400),
        EffectTargetType.self
      ),
    ],
    castTime: 0,
    cooldown: 16,
    cooldownPerRank: [16, 15, 14, 13, 12],
  });
}

function createMeteor(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Meteor',
    description: 'After 1.5s delay, a meteor strikes dealing 250/375/500 (+80% AP) magic damage in an area.',
    cost: new AbilityCost({
      energy: 100,
      cooldown: 100,
    }),
    target: new GroundTargetAbilityTargetDescription(800),
    effects: [
      new SemiImmediateEffect(
        new DelayedAoEMagicDamageEffect(
          { base: [250, 375, 500], apRatio: 0.8 },
          300,
          1.5,
          'Meteor'
        ),
        EffectTargetType.self
      ),
    ],
    castTime: 0,
    cooldown: 100,
    cooldownPerRank: [100, 90, 80],
  });
}

// ===================
// Champion Definition
// ===================

const MagnusDefinition: ChampionDefinition = {
  id: 'magnus',
  name: 'Magnus',
  title: 'the Battlemage',
  class: 'mage',
  attackType: 'ranged',
  resourceType: 'mana',
  baseStats: {
    health: 500,
    healthRegen: 6,
    resource: 400,
    resourceRegen: 8,
    attackDamage: 52,
    abilityPower: 0,
    armor: 22,
    magicResist: 34,
    attackSpeed: 0.63,
    movementSpeed: 330,
    attackRange: 475,
    critChance: 0,
    critDamage: 2.0,
  },
  growthStats: {
    health: 80,
    healthRegen: 0.6,
    resource: 55,
    resourceRegen: 0.8,
    attackDamage: 2.5,
    attackSpeed: 2.0,
    armor: 3.0,
    magicResist: 2.0,
  },
  abilities: {
    Q: 'magnus_fireball',
    W: 'magnus_arcane_shield',
    E: 'magnus_blink',
    R: 'magnus_meteor',
  },
};

// ===================
// Magnus Class
// ===================

export class Magnus extends Champion {
  protected readonly definition = MagnusDefinition;

  // Abilities
  private fireball: CastAbilityDescriptor;
  private arcaneShield: CastAbilityDescriptor;
  private blink: CastAbilityDescriptor;
  private meteor: CastAbilityDescriptor;

  // Passive state
  private arcaneStacks: number = 0;
  private timeSinceLastAbility: number = 0;
  private readonly STACK_DECAY_TIME = 5; // seconds
  private readonly MAX_STACKS = 4;
  private readonly DAMAGE_PER_STACK = 0.05; // 5% per stack

  // Delayed effects tracking
  private _delayedEffects: (() => boolean)[] = [];

  // Game context reference
  private gameContext: GameContext | null = null;

  constructor(position: Vector, side: number) {
    super(position, side as 0 | 1);

    this.fireball = createFireball();
    this.arcaneShield = createArcaneShield();
    this.blink = createBlink();
    this.meteor = createMeteor();

    this.fireball.setOwner(this);
    this.arcaneShield.setOwner(this);
    this.blink.setOwner(this);
    this.meteor.setOwner(this);
  }

  protected initializeAbilities(): void {
    // Using the new ability system
  }

  override init(gctx: GameContext): void {
    super.init(gctx);
    this.gameContext = gctx;
  }

  override step(gctx: GameContext): void {
    this.gameContext = gctx;
    super.step(gctx);

    if (this.isDead()) return;

    const dt = gctx.dt;

    // Update abilities
    this.fireball.update(gctx, dt);
    this.arcaneShield.update(gctx, dt);
    this.blink.update(gctx, dt);
    this.meteor.update(gctx, dt);

    // Update passive stack decay
    if (this.arcaneStacks > 0) {
      this.timeSinceLastAbility += dt;
      if (this.timeSinceLastAbility > this.STACK_DECAY_TIME) {
        this.arcaneStacks = 0;
      }
    }

    // Update delayed effects
    this._delayedEffects = this._delayedEffects.filter(effect => !effect());
  }

  /**
   * Get current arcane surge stacks.
   */
  getArcaneStacks(): number {
    return this.arcaneStacks;
  }

  /**
   * Add an arcane surge stack (called when ability is cast).
   */
  private addArcaneStack(): void {
    if (this.arcaneStacks < this.MAX_STACKS) {
      this.arcaneStacks++;
    }
    this.timeSinceLastAbility = 0; // Reset decay timer
  }

  /**
   * Get the damage multiplier from arcane surge stacks.
   */
  getDamageMultiplier(): number {
    return 1 + this.arcaneStacks * this.DAMAGE_PER_STACK;
  }

  /**
   * Register a delayed effect.
   */
  registerDelayedEffect(effect: () => boolean): void {
    this._delayedEffects.push(effect);
  }

  /**
   * Cast a Magnus ability.
   */
  castMagnusAbility(
    abilityKey: 'Q' | 'W' | 'E' | 'R',
    context: GameContext,
    targetPosition?: Vector
  ): boolean {
    const ability = this.getMagnusAbility(abilityKey);
    if (!ability) return false;

    // Check if ability can be cast
    const cost = ability.getCurrentCost();
    if (this.state.resource < cost) return false;
    if (!ability.isReady()) return false;

    // Set target position if provided or from context
    const pos = targetPosition ?? (context as any).targetPosition;
    if (pos) {
      (context as any).targetPosition = pos;
    }

    // Cast the ability (ability.cast already handles resource cost)
    // Damage multiplier from Arcane Surge is applied in effects via getDamageMultiplier()
    const result = ability.cast(context, undefined, pos);
    if (result.success) {
      this.addArcaneStack();
    }

    return result.success;
  }

  /**
   * Check if a Magnus ability can be cast.
   */
  canCastMagnusAbility(abilityKey: 'Q' | 'W' | 'E' | 'R'): boolean {
    const ability = this.getMagnusAbility(abilityKey);
    if (!ability) return false;

    const cost = ability.getCurrentCost();
    return this.state.resource >= cost && ability.isReady();
  }

  /**
   * Get ability by key.
   */
  private getMagnusAbility(key: 'Q' | 'W' | 'E' | 'R'): CastAbilityDescriptor | null {
    switch (key) {
      case 'Q':
        return this.fireball;
      case 'W':
        return this.arcaneShield;
      case 'E':
        return this.blink;
      case 'R':
        return this.meteor;
      default:
        return null;
    }
  }

  /**
   * Get the current shield amount.
   */
  getCurrentShield(): number {
    return this.getTotalShield();
  }

  /**
   * Get the resource type.
   */
  getResourceType(): string {
    return this.definition.resourceType;
  }

  /**
   * Render Magnus.
   */
  protected renderChampion(_gctx: GameContext): void {
    // Rendering handled by render system
  }
}

export default Magnus;
