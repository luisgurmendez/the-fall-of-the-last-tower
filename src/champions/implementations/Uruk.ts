/**
 * Urûk, The Silver Dragonborn
 *
 * A melee warrior with dragon heritage. His passive grants poison immunity,
 * and his abilities focus on aggressive combat with a spear.
 *
 * Passive (Dragonblood): Immune to poison effects
 * Q (Spear Poke): Quick thrust that deals physical damage
 * W (Dragon's Roar): Shout that increases attack speed
 * E (Leaping Strike): Dash to target, dealing damage on arrival
 * R (Dragon's Wrath): Powerful attack that knocks enemies back
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { Side } from '@/types';
import { Champion } from '@/champions/Champion';
import { ChampionDefinition } from '@/champions/types';

// Effect System Imports
import PassiveAbility from '@/abilities/PassiveAbilityDescriptor';
import { CastAbilityDescriptor } from '@/abilities/CastAbilityDescriptor';
import AbilityCost from '@/abilities/AbilityCost';
import {
  SingleTargetInRangeAbilityTargetDescription,
  SelfTargetAbilityTargetDescription,
} from '@/abilities/AbilityTargetDescription';
import {
  PermanentEffect,
  SemiImmediateEffect,
  DurationEffect,
  EffectTargetType,
} from '@/effects/EffectDescriptor';
import { ScalingDamageEffect, ScalingStatBuffEffect } from '@/effects/ScalingEffect';
import { PoisonCancelingEffect } from '@/effects/CancelingEffects';
import { ToTargetMoveEffect, KnockbackEffect } from '@/effects/MovementEffects';
import { NextBasicAttackPiercingEnhancementEffect } from '@/effects/BasicAttackEnhancementEffect';
import { BasicAttack } from '@/attack/BasicAttack';

// ===================
// Champion Definition
// ===================

const UrukDefinition: ChampionDefinition = {
  id: 'uruk',
  name: 'Urûk',
  title: 'The Silver Dragonborn',
  class: 'warrior',
  attackType: 'melee',
  resourceType: 'energy',

  baseStats: {
    health: 580,
    healthRegen: 8,
    resource: 100,       // Energy pool
    resourceRegen: 10,   // Fast regen
    attackDamage: 60,
    abilityPower: 0,
    attackSpeed: 0.7,
    attackRange: 150,    // Melee range
    armor: 35,
    magicResist: 32,
    movementSpeed: 345,
    critChance: 0,
    critDamage: 2.0,
  },

  growthStats: {
    health: 95,
    healthRegen: 0.8,
    resource: 0,         // Energy doesn't grow
    resourceRegen: 0,
    attackDamage: 3.5,
    attackSpeed: 2.5,
    armor: 4,
    magicResist: 1.25,
  },

  abilities: {
    Q: 'uruk_spear_poke',
    W: 'uruk_dragons_roar',
    E: 'uruk_leaping_strike',
    R: 'uruk_dragons_wrath',
  },
};

// ===================
// Passive: Dragonblood
// ===================

function createDragonblood(): PassiveAbility {
  return new PassiveAbility(
    [
      new PermanentEffect(new PoisonCancelingEffect(), EffectTargetType.self),
    ],
    {
      name: 'Dragonblood',
      description: 'Urûk\'s dragon heritage grants him immunity to all poison effects.',
    }
  );
}

// ===================
// Q: Spear Poke
// ===================

function createSpearPoke(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Spear Poke',
    description: 'Thrust your spear forward, dealing 70/100/130/160/190 (+60% AD) physical damage.',
    cost: new AbilityCost({
      energy: 25,
      cooldown: 4,
    }),
    target: new SingleTargetInRangeAbilityTargetDescription(200),
    effects: [
      new SemiImmediateEffect(
        new ScalingDamageEffect({
          base: [70, 100, 130, 160, 190],
          adRatio: 0.6,
        }, 'physical', 'Spear Poke'),
        EffectTargetType.enemy
      ),
    ],
    castTime: 0,
    cooldown: 4,
    cooldownPerRank: [4, 3.5, 3, 2.5, 2],  // Cooldown decreases with rank
  });
}

// ===================
// W: Dragon's Roar
// ===================

function createDragonsRoar(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: "Dragon's Roar",
    description: 'Let out a mighty roar, increasing your attack speed by 20/30/40/50/60% for 5 seconds.',
    cost: new AbilityCost({
      energy: 40,
      cooldown: 12,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      new DurationEffect(
        new ScalingStatBuffEffect(
          'attackSpeed',
          { base: [0.2, 0.3, 0.4, 0.5, 0.6] },  // 20%/30%/40%/50%/60%
          5,
          true  // isPercent
        ),
        EffectTargetType.self,
        5 // 5 second duration
      ),
    ],
    castTime: 0,
    cooldown: 12,
    cooldownPerRank: [12, 11, 10, 9, 8],
  });
}

// ===================
// E: Leaping Strike
// ===================

function createLeapingStrike(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Leaping Strike',
    description: 'Leap to an enemy, dealing 60/90/120/150/180 (+50% AD) damage and empowering your next attack.',
    cost: new AbilityCost({
      energy: 50,
      cooldown: 10,
    }),
    target: new SingleTargetInRangeAbilityTargetDescription(500),
    effects: [
      new SemiImmediateEffect(new ToTargetMoveEffect(50), EffectTargetType.self),
      new SemiImmediateEffect(
        new ScalingDamageEffect({
          base: [60, 90, 120, 150, 180],
          adRatio: 0.5,
        }, 'physical', 'Leaping Strike'),
        EffectTargetType.enemy
      ),
      new SemiImmediateEffect(new NextBasicAttackPiercingEnhancementEffect(), EffectTargetType.self),
    ],
    castTime: 0,
    cooldown: 10,
    cooldownPerRank: [10, 9, 8, 7, 6],
  });
}

// ===================
// R: Dragon's Wrath
// ===================

function createDragonsWrath(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: "Dragon's Wrath",
    description: 'Unleash your dragon fury, dealing 150/250/350 (+100% AD) damage and knocking the enemy back.',
    cost: new AbilityCost({
      energy: 80,
      cooldown: 60,
    }),
    target: new SingleTargetInRangeAbilityTargetDescription(250),
    effects: [
      new SemiImmediateEffect(
        new ScalingDamageEffect({
          base: [150, 250, 350],
          adRatio: 1.0,
        }, 'physical', "Dragon's Wrath"),
        EffectTargetType.enemy
      ),
      new SemiImmediateEffect(new KnockbackEffect(300, 0.5), EffectTargetType.enemy),
    ],
    castTime: 0.25,
    cooldown: 60,
    cooldownPerRank: [100, 80, 60],  // Ultimate cooldown decreases
    maxRank: 3,  // Ultimate has 3 ranks
  });
}

// ===================
// Uruk Champion Class
// ===================

export class Uruk extends Champion {
  protected readonly definition = UrukDefinition;

  // New ability system references - created per instance to avoid singleton issues
  private dragonblood: PassiveAbility;
  private spearPoke: CastAbilityDescriptor;
  private dragonsRoar: CastAbilityDescriptor;
  private leapingStrike: CastAbilityDescriptor;
  private dragonsWrath: CastAbilityDescriptor;

  // Basic attack configuration
  private basicAttackConfig: BasicAttack;

  constructor(position: Vector, side: Side) {
    super(position, side);

    // Create NEW ability instances for this Uruk (not singletons!)
    this.dragonblood = createDragonblood();
    this.spearPoke = createSpearPoke();
    this.dragonsRoar = createDragonsRoar();
    this.leapingStrike = createLeapingStrike();
    this.dragonsWrath = createDragonsWrath();

    this.basicAttackConfig = new BasicAttack({
      range: 150,
      attackSpeed: 0.7,
      damageType: 'physical',
      isRanged: false,
    });

    // Set up ability owners
    this.dragonblood.setOwner(this);
    this.spearPoke.setOwner(this);
    this.dragonsRoar.setOwner(this);
    this.leapingStrike.setOwner(this);
    this.dragonsWrath.setOwner(this);
    this.basicAttackConfig.setOwner(this);
  }

  /**
   * Initialize abilities (required by Champion).
   * This creates placeholder abilities for the old system.
   */
  protected initializeAbilities(): void {
    // For now, we don't use the old ability system
    // The new descriptors handle ability behavior
  }

  /**
   * Initialize the champion.
   */
  override init(gctx: GameContext): void {
    super.init(gctx);

    // Activate passive
    this.dragonblood.activate(gctx);
  }

  /**
   * Cast an ability by slot.
   */
  castUrukAbility(
    slot: 'Q' | 'W' | 'E' | 'R',
    gctx: GameContext,
    target?: Champion
  ): boolean {
    switch (slot) {
      case 'Q':
        return this.spearPoke.cast(gctx, target).success;
      case 'W':
        return this.dragonsRoar.cast(gctx).success;
      case 'E':
        return this.leapingStrike.cast(gctx, target).success;
      case 'R':
        return this.dragonsWrath.cast(gctx, target).success;
      default:
        return false;
    }
  }

  /**
   * Check if an ability can be cast.
   */
  canCastUrukAbility(slot: 'Q' | 'W' | 'E' | 'R', target?: Champion): boolean {
    switch (slot) {
      case 'Q':
        return this.spearPoke.canCast(target).success;
      case 'W':
        return this.dragonsRoar.canCast().success;
      case 'E':
        return this.leapingStrike.canCast(target).success;
      case 'R':
        return this.dragonsWrath.canCast(target).success;
      default:
        return false;
    }
  }

  /**
   * Get ability cooldown progress.
   */
  getAbilityCooldownProgress(slot: 'Q' | 'W' | 'E' | 'R'): number {
    switch (slot) {
      case 'Q':
        return this.spearPoke.getCooldownProgress();
      case 'W':
        return this.dragonsRoar.getCooldownProgress();
      case 'E':
        return this.leapingStrike.getCooldownProgress();
      case 'R':
        return this.dragonsWrath.getCooldownProgress();
      default:
        return 1;
    }
  }

  /**
   * Override performBasicAttack to use Uruk's BasicAttack config.
   */
  override performBasicAttack(gameContext: GameContext, target?: Champion): void {
    // When called from step() without a target, use the parent's logic
    // which uses this.basicAttackTarget
    if (!target || !target.getPosition) {
      super.performBasicAttack(gameContext, target);
      return;
    }

    // Use Uruk's custom basic attack system
    this.basicAttackConfig.attack(target);
  }

  /**
   * On death, deactivate passive.
   */
  protected override onDeath(killer?: Champion): void {
    super.onDeath(killer);
    // Passive is permanent but we could add death handling here
  }

  /**
   * Override castAbility to use Uruk's new ability system.
   */
  override castAbility(
    slot: 'Q' | 'W' | 'E' | 'R',
    targetUnit?: Champion,
    targetPosition?: Vector
  ): boolean {
    return this.castUrukAbility(slot, this.gameContext!, targetUnit);
  }

  /**
   * Get ability info for UI/input system.
   * Returns an adapter object compatible with the Ability interface.
   */
  override getAbility(slot: 'Q' | 'W' | 'E' | 'R'): any {
    const descriptor = this.getAbilityDescriptor(slot);
    if (!descriptor) return undefined;

    const targetDesc = this.getAbilityTargetDesc(slot);

    // Return an adapter that mimics the Ability interface
    return {
      get isLearned() { return descriptor.isLearned(); },
      get isReady() { return descriptor.isReady(); },
      get rank() { return descriptor.rank; },
      get cooldownProgress() { return descriptor.getCooldownProgress(); },
      get cooldownRemaining() { return descriptor.getCooldownRemaining(); },
      definition: {
        name: descriptor.name,
        description: descriptor.description,
      },
      getTargetDescription: () => targetDesc,
    };
  }

  /**
   * Get the CastAbilityDescriptor for a slot.
   */
  private getAbilityDescriptor(slot: 'Q' | 'W' | 'E' | 'R'): CastAbilityDescriptor | null {
    switch (slot) {
      case 'Q': return this.spearPoke;
      case 'W': return this.dragonsRoar;
      case 'E': return this.leapingStrike;
      case 'R': return this.dragonsWrath;
      default: return null;
    }
  }

  /**
   * Get target description for ability UI.
   */
  private getAbilityTargetDesc(slot: 'Q' | 'W' | 'E' | 'R') {
    switch (slot) {
      case 'Q':
      case 'E':
      case 'R':
        // These require an enemy target
        return {
          requiresTarget: true,
          targetsGround: false,
          isValidTarget: (caster: Champion, target: Champion | null, pos: Vector | null) => {
            if (!target) return false;
            return target.getSide() !== caster.getSide() && !target.isDead();
          },
        };
      case 'W':
        // Self-cast, no targeting needed
        return {
          requiresTarget: false,
          targetsGround: false,
          isValidTarget: () => true,
        };
      default:
        return {
          requiresTarget: false,
          targetsGround: false,
          isValidTarget: () => true,
        };
    }
  }

  // Store game context for ability casting
  private gameContext: GameContext | null = null;

  override step(gctx: GameContext): void {
    this.gameContext = gctx;
    super.step(gctx);

    if (this.state.isDead) return;

    const dt = gctx.dt;

    // Update abilities
    this.spearPoke.update(gctx, dt);
    this.dragonsRoar.update(gctx, dt);
    this.leapingStrike.update(gctx, dt);
    this.dragonsWrath.update(gctx, dt);
    this.dragonblood.update(gctx, dt);

    // Update basic attack
    this.basicAttackConfig.update(dt);
  }

  /**
   * Render the champion.
   */
  protected renderChampion(gctx: GameContext): void {
    const ctx = gctx.canvasRenderingContext;

    // Use world position directly (camera transform is applied by RenderController)
    const pos = this.position;

    // Body (dragon-like silver/gray)
    ctx.fillStyle = this.side === 0 ? '#7B8B9A' : '#5A6A7A';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
    ctx.fill();

    // Dragon eye
    ctx.fillStyle = '#FFD700'; // Gold eyes
    ctx.beginPath();
    ctx.arc(
      pos.x + this.direction.x * 8,
      pos.y + this.direction.y * 8,
      5,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Spear
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(
      pos.x + this.direction.x * 35,
      pos.y + this.direction.y * 35
    );
    ctx.stroke();

    // Spear tip
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.arc(
      pos.x + this.direction.x * 35,
      pos.y + this.direction.y * 35,
      4,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Health bar
    this.renderHealthBar(ctx, pos);

    // Energy bar
    this.renderResourceBar(ctx, pos);
  }

  /**
   * Render health bar.
   */
  private renderHealthBar(ctx: CanvasRenderingContext2D, pos: Vector): void {
    const stats = this.getStats();
    const healthPercent = this.state.health / stats.maxHealth;
    const shieldAmount = this.getTotalShield();
    const shieldPercent = shieldAmount / stats.maxHealth;

    const barWidth = 40;
    const barHeight = 5;
    const barY = pos.y - 30;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, barHeight);

    // Health
    ctx.fillStyle = this.side === 0 ? '#4CAF50' : '#F44336';
    ctx.fillRect(
      pos.x - barWidth / 2,
      barY,
      barWidth * healthPercent,
      barHeight
    );

    // Shield (white overlay)
    if (shieldAmount > 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(
        pos.x - barWidth / 2 + barWidth * healthPercent,
        barY,
        barWidth * Math.min(shieldPercent, 1 - healthPercent),
        barHeight
      );
    }
  }

  /**
   * Render energy bar.
   */
  private renderResourceBar(ctx: CanvasRenderingContext2D, pos: Vector): void {
    const stats = this.getStats();
    const resourcePercent = this.state.resource / stats.maxResource;

    const barWidth = 40;
    const barHeight = 3;
    const barY = pos.y - 24;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, barHeight);

    // Energy (yellow)
    ctx.fillStyle = '#FFC107';
    ctx.fillRect(
      pos.x - barWidth / 2,
      barY,
      barWidth * resourcePercent,
      barHeight
    );
  }
}

export default Uruk;
