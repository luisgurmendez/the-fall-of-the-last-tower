/**
 * Thorne, the Sellsword
 *
 * A deadly assassin who excels at eliminating weakened targets.
 *
 * Role: Assassin
 * Attack Type: Melee
 * Resource: Mana
 *
 * Abilities:
 * - Passive (Killer Instinct): 15% bonus damage to enemies below 40% health
 * - Q (Swift Strike): Dash through target enemy, dealing damage
 * - W (Blade Flurry): AoE damage around self
 * - E (Shadow Step): Invisibility + movement speed
 * - R (Deathmark): Mark enemy, deals base + % of damage dealt during mark
 */

import { Champion } from '../Champion';
import { ChampionDefinition } from '../types';
import { CastAbilityDescriptor } from '@/abilities/CastAbilityDescriptor';
import {
  SelfTargetAbilityTargetDescription,
  SingleTargetInRangeAbilityTargetDescription,
  AoEAroundSelfAbilityTargetDescription,
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
 * Swift Strike effect - dash through target dealing damage.
 */
class SwiftStrikeEffect implements IEffect {
  readonly scaling: { base: number[]; adRatio?: number };
  readonly damageType: 'physical';
  readonly name: string;

  constructor(
    scaling: { base: number[]; adRatio?: number },
    name: string = 'Swift Strike'
  ) {
    this.scaling = scaling;
    this.damageType = 'physical';
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target, abilityRank } = context;

    if (!target) return;

    const rank = abilityRank ?? 1;
    const damage = calculateScaledValue(this.scaling, caster, rank);

    // Deal damage
    target.takeDamage(damage, this.damageType, caster, this.name);

    // Dash through target (appear behind them)
    const casterPos = caster.getPosition();
    const targetPos = target.getPosition();
    const direction = targetPos.clone().sub(casterPos).normalize();

    // Position behind the target
    const behindTarget = targetPos.clone().add(direction.scalar(50));
    caster.setPosition(behindTarget);
  }

  clone(): IEffect {
    return new SwiftStrikeEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.name
    );
  }
}

/**
 * Blade Flurry effect - AoE damage around self.
 */
class BladeFlurryEffect implements IEffect {
  readonly scaling: { base: number[]; adRatio?: number };
  readonly damageType: 'physical';
  readonly radius: number;
  readonly name: string;

  constructor(
    scaling: { base: number[]; adRatio?: number },
    radius: number,
    name: string = 'Blade Flurry'
  ) {
    this.scaling = scaling;
    this.damageType = 'physical';
    this.radius = radius;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, abilityRank } = context;

    const rank = abilityRank ?? 1;
    const damage = calculateScaledValue(this.scaling, caster, rank);
    const casterPos = caster.getPosition();

    // Get game context
    const gameContext = (caster as any).gameContext as GameContext;
    if (!gameContext?.objects) return;

    const enemies = gameContext.objects.filter(
      (obj): obj is Champion =>
        obj instanceof Champion &&
        obj !== caster &&
        obj.getTeamId() !== caster.getTeamId() &&
        !obj.isDead()
    );

    for (const enemy of enemies) {
      const distance = casterPos.distanceTo(enemy.getPosition());
      if (distance <= this.radius) {
        enemy.takeDamage(damage, this.damageType, caster, this.name);
      }
    }
  }

  clone(): IEffect {
    return new BladeFlurryEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.radius,
      this.name
    );
  }
}

/**
 * Shadow Step effect - invisibility and movement speed.
 */
class ShadowStepEffect implements IEffect {
  readonly duration: number[];
  readonly speedBonus: number;

  constructor(duration: number[], speedBonus: number) {
    this.duration = duration;
    this.speedBonus = speedBonus;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, abilityRank } = context;

    const rank = abilityRank ?? 1;
    const durationIndex = Math.min(rank - 1, this.duration.length - 1);
    const actualDuration = this.duration[Math.max(0, durationIndex)];

    // Apply invisibility
    (caster as any).setInvisible(true, actualDuration);

    // Apply movement speed buff
    caster.applyBuff(
      'thorne_shadow_step',
      undefined,
      { movementSpeed: this.speedBonus },
      actualDuration
    );
  }

  clone(): IEffect {
    return new ShadowStepEffect([...this.duration], this.speedBonus);
  }
}

/**
 * Deathmark effect - marks enemy and tracks damage.
 */
class DeathmarkEffect implements IEffect {
  readonly scaling: { base: number[]; adRatio?: number };
  readonly damageType: 'physical';
  readonly duration: number;
  readonly damagePercent: number;
  readonly name: string;

  constructor(
    scaling: { base: number[]; adRatio?: number },
    duration: number,
    damagePercent: number,
    name: string = 'Deathmark'
  ) {
    this.scaling = scaling;
    this.damageType = 'physical';
    this.duration = duration;
    this.damagePercent = damagePercent;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target, abilityRank } = context;

    if (!target) return;

    const rank = abilityRank ?? 1;
    const baseDamage = calculateScaledValue(this.scaling, caster, rank);

    // Register deathmark on target
    (caster as any).applyDeathmark(target, baseDamage, this.duration, this.damagePercent);
  }

  clone(): IEffect {
    return new DeathmarkEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.duration,
      this.damagePercent,
      this.name
    );
  }
}

// ===================
// Ability Factories
// ===================

function createSwiftStrike(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Swift Strike',
    description: 'Dashes through target enemy, dealing 70/105/140/175/210 (+90% AD) physical damage and appearing behind them.',
    cost: new AbilityCost({
      energy: 45,
      cooldown: 8,
    }),
    target: new SingleTargetInRangeAbilityTargetDescription(450),
    effects: [
      new SemiImmediateEffect(
        new SwiftStrikeEffect(
          { base: [70, 105, 140, 175, 210], adRatio: 0.9 },
          'Swift Strike'
        ),
        EffectTargetType.enemy
      ),
    ],
    castTime: 0,
    cooldown: 8,
    cooldownPerRank: [8, 7.5, 7, 6.5, 6],
  });
}

function createBladeFlurry(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Blade Flurry',
    description: 'Slashes rapidly, dealing 60/95/130/165/200 (+70% AD) physical damage to nearby enemies.',
    cost: new AbilityCost({
      energy: 50,
      cooldown: 9,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      new SemiImmediateEffect(
        new BladeFlurryEffect(
          { base: [60, 95, 130, 165, 200], adRatio: 0.7 },
          200,
          'Blade Flurry'
        ),
        EffectTargetType.self
      ),
    ],
    castTime: 0,
    cooldown: 9,
    cooldownPerRank: [9, 8.5, 8, 7.5, 7],
  });
}

function createShadowStep(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Shadow Step',
    description: 'Becomes invisible for 2/2.25/2.5/2.75/3 seconds and gains 20% movement speed. Attacking breaks invisibility.',
    cost: new AbilityCost({
      energy: 70,
      cooldown: 18,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      new SemiImmediateEffect(
        new ShadowStepEffect([2, 2.25, 2.5, 2.75, 3], 0.2),
        EffectTargetType.self
      ),
    ],
    castTime: 0,
    cooldown: 18,
    cooldownPerRank: [18, 17, 16, 15, 14],
  });
}

function createDeathmark(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Deathmark',
    description: 'Marks enemy for 3s. On expiry, deals 150/250/350 (+100% AD) + 30% of damage dealt during mark.',
    cost: new AbilityCost({
      energy: 100,
      cooldown: 90,
    }),
    target: new SingleTargetInRangeAbilityTargetDescription(500),
    effects: [
      new SemiImmediateEffect(
        new DeathmarkEffect(
          { base: [150, 250, 350], adRatio: 1.0 },
          3,
          0.3,
          'Deathmark'
        ),
        EffectTargetType.enemy
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

const ThorneDefinition: ChampionDefinition = {
  id: 'thorne',
  name: 'Thorne',
  title: 'the Sellsword',
  class: 'assassin',
  attackType: 'melee',
  resourceType: 'mana',
  baseStats: {
    health: 560,
    healthRegen: 7,
    resource: 300,
    resourceRegen: 7,
    attackDamage: 65,
    abilityPower: 0,
    armor: 28,
    magicResist: 32,
    attackSpeed: 0.70,
    movementSpeed: 345,
    attackRange: 125,
    critChance: 0,
    critDamage: 2.0,
  },
  growthStats: {
    health: 90,
    healthRegen: 0.7,
    resource: 42,
    resourceRegen: 0.7,
    attackDamage: 3.8,
    attackSpeed: 3.0,
    armor: 3.8,
    magicResist: 1.8,
  },
  abilities: {
    Q: 'thorne_swift_strike',
    W: 'thorne_blade_flurry',
    E: 'thorne_shadow_step',
    R: 'thorne_deathmark',
  },
};

// Deathmark tracking
interface DeathmarkInfo {
  target: Champion;
  baseDamage: number;
  damagePercent: number;
  damageDealt: number;
  expiryTime: number;
}

// ===================
// Thorne Class
// ===================

export class Thorne extends Champion {
  protected readonly definition = ThorneDefinition;

  // Abilities
  private swiftStrike: CastAbilityDescriptor;
  private bladeFlurry: CastAbilityDescriptor;
  private shadowStep: CastAbilityDescriptor;
  private deathmark: CastAbilityDescriptor;

  // Passive constants
  private readonly PASSIVE_HEALTH_THRESHOLD = 0.4; // 40%
  private readonly PASSIVE_BONUS_DAMAGE = 0.15; // 15%

  // Invisibility state
  private invisible: boolean = false;
  private invisibilityEndTime: number = 0;

  // Deathmark tracking
  private activeDeathmarks: Map<Champion, DeathmarkInfo> = new Map();

  // Time tracking
  private elapsedTime: number = 0;

  // Game context reference
  private gameContext: GameContext | null = null;

  constructor(position: Vector, side: number) {
    super(position, side as 0 | 1);

    this.swiftStrike = createSwiftStrike();
    this.bladeFlurry = createBladeFlurry();
    this.shadowStep = createShadowStep();
    this.deathmark = createDeathmark();

    this.swiftStrike.setOwner(this);
    this.bladeFlurry.setOwner(this);
    this.shadowStep.setOwner(this);
    this.deathmark.setOwner(this);
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
    this.elapsedTime += dt;

    // Update abilities
    this.swiftStrike.update(gctx, dt);
    this.bladeFlurry.update(gctx, dt);
    this.shadowStep.update(gctx, dt);
    this.deathmark.update(gctx, dt);

    // Update invisibility
    if (this.invisible && this.elapsedTime >= this.invisibilityEndTime) {
      this.invisible = false;
    }

    // Update deathmarks
    this.updateDeathmarks();
  }

  /**
   * Override performBasicAttack to implement passive and break invisibility.
   */
  override performBasicAttack(gameContext: GameContext, target: Champion): void {
    if (!target || !target.getPosition) {
      super.performBasicAttack(gameContext, target);
      return;
    }

    // Check if target is below 40% health for passive
    const targetMaxHealth = target.getStats().maxHealth;
    const healthPercent = target.getCurrentHealth() / targetMaxHealth;

    if (healthPercent < this.PASSIVE_HEALTH_THRESHOLD) {
      // Apply bonus damage via buff
      this.applyBuff(
        'thorne_killer_instinct',
        { attackDamage: this.getStats().attackDamage * this.PASSIVE_BONUS_DAMAGE },
        undefined,
        0.1
      );
    }

    // Break invisibility on attack
    if (this.invisible) {
      this.invisible = false;
    }

    // Track damage for deathmark
    const healthBefore = target.getCurrentHealth();

    super.performBasicAttack(gameContext, target);

    // Calculate damage dealt
    const healthAfter = target.getCurrentHealth();
    const damageDealt = healthBefore - healthAfter;

    // Add to deathmark damage if marked
    const markInfo = this.activeDeathmarks.get(target);
    if (markInfo) {
      markInfo.damageDealt += damageDealt;
    }
  }

  /**
   * Check if target is marked with deathmark.
   */
  hasDeathmark(target: Champion): boolean {
    return this.activeDeathmarks.has(target);
  }

  /**
   * Apply deathmark to target.
   */
  applyDeathmark(target: Champion, baseDamage: number, duration: number, damagePercent: number): void {
    this.activeDeathmarks.set(target, {
      target,
      baseDamage,
      damagePercent,
      damageDealt: 0,
      expiryTime: this.elapsedTime + duration,
    });
  }

  /**
   * Update deathmarks - process expiring marks.
   */
  private updateDeathmarks(): void {
    for (const [target, info] of this.activeDeathmarks) {
      if (this.elapsedTime >= info.expiryTime) {
        // Mark expired - deal damage
        const totalDamage = info.baseDamage + info.damageDealt * info.damagePercent;
        target.takeDamage(totalDamage, 'physical', this, 'Deathmark');
        this.activeDeathmarks.delete(target);
      }
    }
  }

  /**
   * Set invisibility state.
   */
  setInvisible(invisible: boolean, duration: number): void {
    this.invisible = invisible;
    if (invisible) {
      this.invisibilityEndTime = this.elapsedTime + duration;
    }
  }

  /**
   * Check if Thorne is invisible.
   */
  isInvisible(): boolean {
    return this.invisible;
  }

  /**
   * Cast a Thorne ability.
   */
  castThorneAbility(
    abilityKey: 'Q' | 'W' | 'E' | 'R',
    context: GameContext,
    target?: Champion
  ): boolean {
    const ability = this.getThorneAbility(abilityKey);
    if (!ability) return false;

    // Check if ability can be cast
    const cost = ability.getCurrentCost();
    if (this.state.resource < cost) return false;
    if (!ability.isReady()) return false;

    // For targeted abilities, check range
    if ((abilityKey === 'Q' || abilityKey === 'R') && target) {
      const range = abilityKey === 'Q' ? 450 : 500;
      const distance = this.getPosition().distanceTo(target.getPosition());
      if (distance > range) return false;
    }

    // Cast the ability
    const result = ability.cast(context, target);

    // Break invisibility on offensive ability casts (Q, W, R)
    if (result.success && this.invisible && abilityKey !== 'E') {
      this.invisible = false;
    }

    return result.success;
  }

  /**
   * Check if a Thorne ability can be cast.
   */
  canCastThorneAbility(abilityKey: 'Q' | 'W' | 'E' | 'R'): boolean {
    const ability = this.getThorneAbility(abilityKey);
    if (!ability) return false;

    const cost = ability.getCurrentCost();
    return this.state.resource >= cost && ability.isReady();
  }

  /**
   * Get Thorne ability by key.
   */
  private getThorneAbility(key: 'Q' | 'W' | 'E' | 'R'): CastAbilityDescriptor | null {
    switch (key) {
      case 'Q':
        return this.swiftStrike;
      case 'W':
        return this.bladeFlurry;
      case 'E':
        return this.shadowStep;
      case 'R':
        return this.deathmark;
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
   * Render Thorne.
   */
  protected renderChampion(_gctx: GameContext): void {
    // Rendering handled by render system
  }
}

export default Thorne;
