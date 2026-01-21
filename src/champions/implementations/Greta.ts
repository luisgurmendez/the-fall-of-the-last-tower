/**
 * Greta, the Warden
 *
 * A supportive healer who protects and sustains her allies.
 *
 * Role: Support
 * Attack Type: Ranged
 * Resource: Mana
 *
 * Abilities:
 * - Passive (Guardian's Blessing): Gains 10% of healing/shielding done as self-shield
 * - Q (Holy Light): Heals ally or damages enemy for 60/90/120/150/180 (+40% AP)
 * - W (Protective Barrier): Shields ally for 80/115/150/185/220 (+50% AP) for 2.5s
 * - E (Binding Light): Roots first enemy hit for 1/1.25/1.5/1.75/2 seconds
 * - R (Divine Grace): AoE heal around self for 150/250/350 (+60% AP)
 */

import { Champion } from '../Champion';
import { ChampionDefinition } from '../types';
import { CastAbilityDescriptor } from '@/abilities/CastAbilityDescriptor';
import {
  SelfTargetAbilityTargetDescription,
  SingleAnyTargetInRangeAbilityTargetDescription,
  SingleAllyInRangeAbilityTargetDescription,
  SingleTargetInRangeAbilityTargetDescription,
} from '@/abilities/AbilityTargetDescription';
import AbilityCost from '@/abilities/AbilityCost';
import {
  SemiImmediateEffect,
  IEffect,
  EffectTargetType,
  EffectApplicationContext,
} from '@/effects/EffectDescriptor';
import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';

// Helper function for calculating scaled damage/heal
function calculateScaledValue(
  scaling: { base: number[]; apRatio?: number },
  caster: Champion,
  rank: number
): number {
  const stats = caster.getStats();
  const baseIndex = Math.min(rank - 1, scaling.base.length - 1);
  let value = scaling.base[Math.max(0, baseIndex)];

  if (scaling.apRatio) {
    value += stats.abilityPower * scaling.apRatio;
  }

  return value;
}

// ===================
// Custom Effects
// ===================

/**
 * Holy Light effect - heals allies or damages enemies.
 */
class HolyLightEffect implements IEffect {
  readonly scaling: { base: number[]; apRatio?: number };
  readonly damageType: 'magic';
  readonly name: string;

  constructor(
    scaling: { base: number[]; apRatio?: number },
    name: string = 'Holy Light'
  ) {
    this.scaling = scaling;
    this.damageType = 'magic';
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target, abilityRank } = context;

    if (!target) return;

    const rank = abilityRank ?? 1;
    const amount = calculateScaledValue(this.scaling, caster, rank);

    // Check if target is ally or enemy
    if (target.getTeamId() === caster.getTeamId()) {
      // Heal ally
      const maxHealth = target.getStats().maxHealth;
      const currentHealth = target.getCurrentHealth();
      const newHealth = Math.min(currentHealth + amount, maxHealth);
      (target as any).state.health = newHealth;
      const actualHeal = newHealth - currentHealth;

      // Trigger passive - 10% of heal as self-shield
      if (actualHeal > 0) {
        const passiveShield = actualHeal * 0.1;
        caster.addShield(passiveShield, 5, 'greta_guardian_blessing');
      }
    } else {
      // Damage enemy
      target.takeDamage(amount, this.damageType, caster, this.name);
    }
  }

  clone(): IEffect {
    return new HolyLightEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.name
    );
  }
}

/**
 * Protective Barrier effect - shields an ally.
 */
class ProtectiveBarrierEffect implements IEffect {
  readonly scaling: { base: number[]; apRatio?: number };
  readonly duration: number;
  readonly name: string;

  constructor(
    scaling: { base: number[]; apRatio?: number },
    duration: number,
    name: string = 'Protective Barrier'
  ) {
    this.scaling = scaling;
    this.duration = duration;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target, abilityRank } = context;

    if (!target) return;

    // Only shield allies
    if (target.getTeamId() !== caster.getTeamId()) return;

    const rank = abilityRank ?? 1;
    const shieldAmount = calculateScaledValue(this.scaling, caster, rank);

    target.addShield(shieldAmount, this.duration, 'greta_protective_barrier');

    // Trigger passive - 10% of shield as self-shield
    const passiveShield = shieldAmount * 0.1;
    caster.addShield(passiveShield, 5, 'greta_guardian_blessing');
  }

  clone(): IEffect {
    return new ProtectiveBarrierEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.duration,
      this.name
    );
  }
}

/**
 * Binding Light effect - roots enemy.
 */
class BindingLightEffect implements IEffect {
  readonly duration: number[];
  readonly name: string;

  constructor(duration: number[], name: string = 'Binding Light') {
    this.duration = duration;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target, abilityRank } = context;

    if (!target) return;

    // Only root enemies
    if (target.getTeamId() === caster.getTeamId()) return;

    const rank = abilityRank ?? 1;
    const durationIndex = Math.min(rank - 1, this.duration.length - 1);
    const rootDuration = this.duration[Math.max(0, durationIndex)];

    // Apply root (movement speed = 0) using -100% modifier
    target.applyBuff(
      'greta_binding_light',
      undefined,
      { movementSpeed: -1 },
      rootDuration
    );
  }

  clone(): IEffect {
    return new BindingLightEffect([...this.duration], this.name);
  }
}

/**
 * Divine Grace effect - AoE heal around self.
 */
class DivineGraceEffect implements IEffect {
  readonly scaling: { base: number[]; apRatio?: number };
  readonly radius: number;
  readonly name: string;

  constructor(
    scaling: { base: number[]; apRatio?: number },
    radius: number,
    name: string = 'Divine Grace'
  ) {
    this.scaling = scaling;
    this.radius = radius;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, abilityRank } = context;

    const rank = abilityRank ?? 1;
    const healAmount = calculateScaledValue(this.scaling, caster, rank);
    const casterPos = caster.getPosition();

    // Get game context
    const gameContext = (caster as any).gameContext as GameContext;
    if (!gameContext?.objects) return;

    const allies = gameContext.objects.filter(
      (obj): obj is Champion =>
        obj instanceof Champion &&
        obj.getTeamId() === caster.getTeamId() &&
        !obj.isDead()
    );

    for (const ally of allies) {
      const distance = casterPos.distanceTo(ally.getPosition());
      if (distance <= this.radius) {
        const maxHealth = ally.getStats().maxHealth;
        const currentHealth = ally.getCurrentHealth();
        const newHealth = Math.min(currentHealth + healAmount, maxHealth);
        (ally as any).state.health = newHealth;
        const actualHeal = newHealth - currentHealth;

        // Trigger passive for each heal (except self-heal)
        if (ally !== caster && actualHeal > 0) {
          const passiveShield = actualHeal * 0.1;
          caster.addShield(passiveShield, 5, 'greta_guardian_blessing');
        }
      }
    }
  }

  clone(): IEffect {
    return new DivineGraceEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.radius,
      this.name
    );
  }
}

// ===================
// Ability Factories
// ===================

function createHolyLight(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Holy Light',
    description: 'Heals an ally or damages an enemy for 60/90/120/150/180 (+40% AP).',
    cost: new AbilityCost({
      energy: 60,
      cooldown: 8,
    }),
    target: new SingleAnyTargetInRangeAbilityTargetDescription(600),
    effects: [
      new SemiImmediateEffect(
        new HolyLightEffect(
          { base: [60, 90, 120, 150, 180], apRatio: 0.4 },
          'Holy Light'
        ),
        EffectTargetType.enemy // Target type is handled in the effect
      ),
    ],
    castTime: 0,
    cooldown: 8,
    cooldownPerRank: [8, 7.5, 7, 6.5, 6],
  });
}

function createProtectiveBarrier(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Protective Barrier',
    description: 'Shields an ally for 80/115/150/185/220 (+50% AP) for 2.5 seconds.',
    cost: new AbilityCost({
      energy: 80,
      cooldown: 10,
    }),
    target: new SingleAllyInRangeAbilityTargetDescription(700),
    effects: [
      new SemiImmediateEffect(
        new ProtectiveBarrierEffect(
          { base: [80, 115, 150, 185, 220], apRatio: 0.5 },
          2.5,
          'Protective Barrier'
        ),
        EffectTargetType.ally
      ),
    ],
    castTime: 0,
    cooldown: 10,
    cooldownPerRank: [10, 9.5, 9, 8.5, 8],
  });
}

function createBindingLight(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Binding Light',
    description: 'Roots an enemy for 1/1.25/1.5/1.75/2 seconds.',
    cost: new AbilityCost({
      energy: 70,
      cooldown: 12,
    }),
    target: new SingleTargetInRangeAbilityTargetDescription(800),
    effects: [
      new SemiImmediateEffect(
        new BindingLightEffect([1, 1.25, 1.5, 1.75, 2], 'Binding Light'),
        EffectTargetType.enemy
      ),
    ],
    castTime: 0,
    cooldown: 12,
    cooldownPerRank: [12, 11.5, 11, 10.5, 10],
  });
}

function createDivineGrace(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Divine Grace',
    description: 'Heals all nearby allies for 150/250/350 (+60% AP) in a 400 radius.',
    cost: new AbilityCost({
      energy: 100,
      cooldown: 100,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      new SemiImmediateEffect(
        new DivineGraceEffect(
          { base: [150, 250, 350], apRatio: 0.6 },
          400,
          'Divine Grace'
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

const GretaDefinition: ChampionDefinition = {
  id: 'greta',
  name: 'Greta',
  title: 'the Warden',
  class: 'support',
  attackType: 'ranged',
  resourceType: 'mana',
  baseStats: {
    health: 500,
    healthRegen: 6,
    resource: 400,
    resourceRegen: 8,
    attackDamage: 48,
    abilityPower: 0,
    armor: 22,
    magicResist: 30,
    attackSpeed: 0.60,
    movementSpeed: 335,
    attackRange: 500,
    critChance: 0,
    critDamage: 2.0,
  },
  growthStats: {
    health: 80,
    healthRegen: 0.5,
    resource: 50,
    resourceRegen: 0.8,
    attackDamage: 2.5,
    attackSpeed: 0.02,
    armor: 3.5,
    magicResist: 1.5,
  },
  abilities: {
    Q: 'greta_holy_light',
    W: 'greta_protective_barrier',
    E: 'greta_binding_light',
    R: 'greta_divine_grace',
  },
};

// ===================
// Greta Class
// ===================

export class Greta extends Champion {
  protected readonly definition = GretaDefinition;

  // Abilities
  private holyLight: CastAbilityDescriptor;
  private protectiveBarrier: CastAbilityDescriptor;
  private bindingLight: CastAbilityDescriptor;
  private divineGrace: CastAbilityDescriptor;

  // Game context reference
  private gameContext: GameContext | null = null;

  constructor(position: Vector, side: number) {
    super(position, side as 0 | 1);

    this.holyLight = createHolyLight();
    this.protectiveBarrier = createProtectiveBarrier();
    this.bindingLight = createBindingLight();
    this.divineGrace = createDivineGrace();

    this.holyLight.setOwner(this);
    this.protectiveBarrier.setOwner(this);
    this.bindingLight.setOwner(this);
    this.divineGrace.setOwner(this);
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
    this.holyLight.update(gctx, dt);
    this.protectiveBarrier.update(gctx, dt);
    this.bindingLight.update(gctx, dt);
    this.divineGrace.update(gctx, dt);
  }

  /**
   * Cast a Greta ability.
   */
  castGretaAbility(
    abilityKey: 'Q' | 'W' | 'E' | 'R',
    context: GameContext,
    target?: Champion | Vector
  ): boolean {
    const ability = this.getGretaAbility(abilityKey);
    if (!ability) return false;

    // Check if ability can be cast
    const cost = ability.getCurrentCost();
    if (this.state.resource < cost) return false;
    if (!ability.isReady()) return false;

    // For targeted abilities, check range
    if ((abilityKey === 'Q' || abilityKey === 'W') && target && target instanceof Champion) {
      const range = abilityKey === 'Q' ? 600 : 700;
      const distance = this.getPosition().distanceTo(target.getPosition());
      if (distance > range) return false;
    }

    // Cast the ability - handle different target types
    let result;
    if (target instanceof Vector) {
      // Skillshot or ground-targeted ability
      result = ability.cast(context, undefined, target);
    } else {
      // Champion-targeted ability
      result = ability.cast(context, target);
    }

    return result.success;
  }

  /**
   * Check if a Greta ability can be cast.
   */
  canCastGretaAbility(abilityKey: 'Q' | 'W' | 'E' | 'R'): boolean {
    const ability = this.getGretaAbility(abilityKey);
    if (!ability) return false;

    const cost = ability.getCurrentCost();
    return this.state.resource >= cost && ability.isReady();
  }

  /**
   * Get ability by key.
   */
  private getGretaAbility(key: 'Q' | 'W' | 'E' | 'R'): CastAbilityDescriptor | null {
    switch (key) {
      case 'Q':
        return this.holyLight;
      case 'W':
        return this.protectiveBarrier;
      case 'E':
        return this.bindingLight;
      case 'R':
        return this.divineGrace;
      default:
        return null;
    }
  }

  /**
   * Get the resource type.
   */
  getResourceType(): string {
    return this.definition.resourceType;
  }

  /**
   * Render Greta.
   */
  protected renderChampion(_gctx: GameContext): void {
    // Rendering handled by render system
  }
}

export default Greta;
