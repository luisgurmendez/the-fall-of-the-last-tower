/**
 * Bran, the Footsoldier
 *
 * A melee fighter with simple, reliable abilities.
 * Twenty years in the shield wall taught him one thing: hit hard, don't die.
 *
 * Passive (Veteran's Grit): Regenerates 1% max health/sec when below 30% health
 * Q (Heavy Slash): Frontal cone damage
 * W (Shield Block): Damage reduction with self-slow
 * E (Shoulder Charge): Dash to enemy with stun
 * R (War Cry): Self-buff for attack speed and movement speed
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { Side } from '@/types';
import { Champion } from '@/champions/Champion';
import { ChampionDefinition } from '@/champions/types';

// Effect System Imports
import { CastAbilityDescriptor } from '@/abilities/CastAbilityDescriptor';
import AbilityCost from '@/abilities/AbilityCost';
import {
  SelfTargetAbilityTargetDescription,
  SingleTargetInRangeAbilityTargetDescription,
} from '@/abilities/AbilityTargetDescription';
import {
  SemiImmediateEffect,
  DurationEffect,
  EffectTargetType,
  IEffect,
  EffectApplicationContext,
} from '@/effects/EffectDescriptor';
import { ScalingDamageEffect, ScalingStatBuffEffect, calculateScaledValue } from '@/effects/ScalingEffect';
import { DashEffect } from '@/effects/MovementEffects';
import { CC, StunEffect } from '@/effects/CrowdControlEffects';

// ===================
// Champion Definition
// ===================

const BranDefinition: ChampionDefinition = {
  id: 'bran',
  name: 'Bran',
  title: 'The Footsoldier',
  class: 'warrior',
  attackType: 'melee',
  resourceType: 'mana',

  baseStats: {
    health: 600,
    healthRegen: 6,
    resource: 300,
    resourceRegen: 7,
    attackDamage: 60,
    abilityPower: 0,
    attackSpeed: 0.7,
    attackRange: 150,
    armor: 35,
    magicResist: 30,
    movementSpeed: 340,
    critChance: 0,
    critDamage: 2.0,
  },

  growthStats: {
    health: 90,
    healthRegen: 0.8,
    resource: 35,
    resourceRegen: 0.6,
    attackDamage: 3.5,
    attackSpeed: 2.5,
    armor: 4,
    magicResist: 1.25,
  },

  abilities: {
    Q: 'bran_heavy_slash',
    W: 'bran_shield_block',
    E: 'bran_shoulder_charge',
    R: 'bran_war_cry',
  },
};

// ===================
// Custom Effects
// ===================

/**
 * Cone damage effect - damages all enemies in a frontal cone.
 */
class ConeDamageEffect implements IEffect {
  readonly scaling: { base: number[]; adRatio?: number };
  readonly damageType: 'physical' | 'magic' | 'true';
  readonly coneAngle: number; // in radians
  readonly range: number;
  readonly name: string;

  constructor(
    scaling: { base: number[]; adRatio?: number },
    damageType: 'physical' | 'magic' | 'true',
    range: number,
    coneAngle: number = Math.PI, // 180 degrees default
    name: string = 'Cone Attack'
  ) {
    this.scaling = scaling;
    this.damageType = damageType;
    this.range = range;
    this.coneAngle = coneAngle;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, gameContext, abilityRank } = context;
    if (!gameContext) return;

    const rank = abilityRank ?? 1;
    const damage = calculateScaledValue(this.scaling, caster, rank);
    const casterPos = caster.getPosition();
    const casterDir = caster.getDirection();

    // Find all enemies in cone
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

      // Check if enemy is within cone angle
      const angleToEnemy = Math.atan2(toEnemy.y, toEnemy.x);
      const casterAngle = Math.atan2(casterDir.y, casterDir.x);
      let angleDiff = Math.abs(angleToEnemy - casterAngle);

      // Normalize angle difference
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
      }

      if (angleDiff <= this.coneAngle / 2) {
        enemy.takeDamage(damage, this.damageType, caster, this.name);
      }
    }
  }

  clone(): IEffect {
    return new ConeDamageEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.damageType,
      this.range,
      this.coneAngle,
      this.name
    );
  }
}

/**
 * Damage reduction buff effect - uses armor boost to reduce physical damage.
 * For 30% damage reduction with armor: 100/(100+armor) = 0.7, armor = 42.86
 * But we want the effect on top of existing armor, so we apply a large flat armor boost.
 */
class DamageReductionEffect implements IEffect {
  readonly reductionPercent: number[];
  readonly duration: number;

  constructor(reductionPercent: number[], duration: number) {
    this.reductionPercent = reductionPercent;
    this.duration = duration;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, abilityRank } = context;
    const rank = abilityRank ?? 1;
    const reduction = this.reductionPercent[Math.min(rank - 1, this.reductionPercent.length - 1)];

    // Convert damage reduction to armor: for X% reduction, we need armor such that
    // damage * (100 / (100 + armor)) = damage * (1 - reduction)
    // => 100 / (100 + armor) = 1 - reduction
    // => armor = 100 * (1/(1-reduction) - 1) = 100 * reduction / (1-reduction)
    // For 30% reduction: armor = 100 * 0.3 / 0.7 = 42.86
    const armorBonus = Math.round(100 * reduction / (1 - reduction));

    // Apply armor buff
    caster.applyBuff(
      'bran_shield_block',
      { armor: armorBonus, magicResist: armorBonus },
      undefined,
      this.duration
    );
  }

  remove(context: EffectApplicationContext): void {
    const { caster } = context;
    caster.removeBuff('bran_shield_block');
  }

  clone(): IEffect {
    return new DamageReductionEffect([...this.reductionPercent], this.duration);
  }
}

/**
 * Self slow effect with custom amount.
 */
class SelfSlowEffect implements IEffect {
  readonly slowPercent: number;
  readonly duration: number;

  constructor(slowPercent: number, duration: number) {
    this.slowPercent = slowPercent;
    this.duration = duration;
  }

  apply(context: EffectApplicationContext): void {
    const { caster } = context;

    caster.applyBuff(
      'bran_shield_block_slow',
      undefined,
      { movementSpeed: -this.slowPercent },
      this.duration
    );
  }

  remove(context: EffectApplicationContext): void {
    const { caster } = context;
    caster.removeBuff('bran_shield_block_slow');
  }

  clone(): IEffect {
    return new SelfSlowEffect(this.slowPercent, this.duration);
  }
}

/**
 * Dash with stun effect - dashes to target and stuns on arrival.
 * Uses EffectTargetType.enemy so target is the enemy champion.
 */
class DashAndStunEffect implements IEffect {
  readonly stunDuration: number;
  readonly scaling: { base: number[]; adRatio?: number };
  readonly damageType: 'physical' | 'magic' | 'true';

  constructor(
    scaling: { base: number[]; adRatio?: number },
    damageType: 'physical' | 'magic' | 'true',
    stunDuration: number
  ) {
    this.scaling = scaling;
    this.damageType = damageType;
    this.stunDuration = stunDuration;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target, abilityRank } = context;

    // With EffectTargetType.enemy, target is the enemy champion
    if (!target || target === caster) return;

    const rank = abilityRank ?? 1;
    const damage = calculateScaledValue(this.scaling, caster, rank);

    // Move to target position
    const targetPos = target.getPosition();
    const casterPos = caster.getPosition();
    const direction = targetPos.clone().sub(casterPos).normalize();
    const distance = casterPos.distanceTo(targetPos);

    // Dash toward target, stopping 50 units away
    const dashDistance = Math.max(0, distance - 50);
    caster.startDash(direction, dashDistance, 1000);

    // Deal damage to the enemy target
    target.takeDamage(damage, this.damageType, caster, 'Shoulder Charge');

    // Apply stun
    const stun = CC.stun('bran_e', this.stunDuration);
    stun.apply(target);
  }

  clone(): IEffect {
    return new DashAndStunEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.damageType,
      this.stunDuration
    );
  }
}

// ===================
// Q: Heavy Slash
// ===================

function createHeavySlash(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Heavy Slash',
    description: 'Swing your sword in a frontal arc, dealing 80/120/160/200/240 physical damage.',
    cost: new AbilityCost({
      energy: 40,
      cooldown: 6,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      new SemiImmediateEffect(
        new ConeDamageEffect(
          { base: [80, 120, 160, 200, 240], adRatio: 0.6 },
          'physical',
          250, // Range (increased for reliable hits in melee fights)
          Math.PI, // 180 degree arc
          'Heavy Slash'
        ),
        EffectTargetType.self
      ),
    ],
    castTime: 0,
    cooldown: 6,
    cooldownPerRank: [6, 5.5, 5, 4.5, 4],
  });
}

// ===================
// W: Shield Block
// ===================

function createShieldBlock(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Shield Block',
    description: 'Raise your shield, gaining 30/40/50/60/70% damage reduction for 2 seconds. You are slowed by 20% while blocking.',
    cost: new AbilityCost({
      energy: 50,
      cooldown: 12,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      // Damage reduction
      new DurationEffect(
        new DamageReductionEffect([0.3, 0.4, 0.5, 0.6, 0.7], 2),
        EffectTargetType.self,
        2
      ),
      // Self slow
      new DurationEffect(
        new SelfSlowEffect(0.2, 2),
        EffectTargetType.self,
        2
      ),
    ],
    castTime: 0,
    cooldown: 12,
    cooldownPerRank: [12, 11, 10, 9, 8],
  });
}

// ===================
// E: Shoulder Charge
// ===================

function createShoulderCharge(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'Shoulder Charge',
    description: 'Charge forward, dealing 60/90/120/150/180 physical damage to the first enemy hit and stunning them for 0.75 seconds.',
    cost: new AbilityCost({
      energy: 55,
      cooldown: 10,
    }),
    target: new SingleTargetInRangeAbilityTargetDescription(400),
    effects: [
      new SemiImmediateEffect(
        new DashAndStunEffect(
          { base: [60, 90, 120, 150, 180], adRatio: 0.5 },
          'physical',
          0.75
        ),
        EffectTargetType.enemy // Target the enemy
      ),
    ],
    castTime: 0,
    cooldown: 10,
    cooldownPerRank: [10, 9, 8, 7, 6],
  });
}

// ===================
// R: War Cry
// ===================

function createWarCry(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: 'War Cry',
    description: 'Shout, granting yourself 20/30/40% attack speed and 15/25/35% movement speed for 6 seconds.',
    cost: new AbilityCost({
      energy: 100,
      cooldown: 80,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      // Attack speed buff
      new DurationEffect(
        new ScalingStatBuffEffect(
          'attackSpeed',
          { base: [0.2, 0.3, 0.4] },
          6,
          true // Percent
        ),
        EffectTargetType.self,
        6
      ),
      // Movement speed buff
      new DurationEffect(
        new ScalingStatBuffEffect(
          'movementSpeed',
          { base: [0.15, 0.25, 0.35] },
          6,
          true // Percent
        ),
        EffectTargetType.self,
        6
      ),
    ],
    castTime: 0,
    cooldown: 80,
    cooldownPerRank: [80, 70, 60],
    maxRank: 3,
  });
}

// ===================
// Bran Champion Class
// ===================

export class Bran extends Champion {
  protected readonly definition = BranDefinition;

  // Abilities
  private heavySlash: CastAbilityDescriptor;
  private shieldBlock: CastAbilityDescriptor;
  private shoulderCharge: CastAbilityDescriptor;
  private warCry: CastAbilityDescriptor;

  // Passive tracking
  private passiveActive: boolean = false;

  // Store game context
  private gameContext: GameContext | null = null;

  constructor(position: Vector, side: Side) {
    super(position, side);

    // Create ability instances
    this.heavySlash = createHeavySlash();
    this.shieldBlock = createShieldBlock();
    this.shoulderCharge = createShoulderCharge();
    this.warCry = createWarCry();

    // Set owners
    this.heavySlash.setOwner(this);
    this.shieldBlock.setOwner(this);
    this.shoulderCharge.setOwner(this);
    this.warCry.setOwner(this);
  }

  protected initializeAbilities(): void {
    // Using the new ability system
  }

  override init(gctx: GameContext): void {
    super.init(gctx);
    this.gameContext = gctx;
  }

  /**
   * Cast an ability by slot.
   */
  castBranAbility(
    slot: 'Q' | 'W' | 'E' | 'R',
    gctx: GameContext,
    target?: Champion
  ): boolean {
    switch (slot) {
      case 'Q':
        return this.heavySlash.cast(gctx).success;
      case 'W':
        return this.shieldBlock.cast(gctx).success;
      case 'E':
        return this.shoulderCharge.cast(gctx, target).success;
      case 'R':
        return this.warCry.cast(gctx).success;
      default:
        return false;
    }
  }

  /**
   * Check if an ability can be cast.
   */
  canCastBranAbility(slot: 'Q' | 'W' | 'E' | 'R', target?: Champion): boolean {
    switch (slot) {
      case 'Q':
        return this.heavySlash.canCast().success;
      case 'W':
        return this.shieldBlock.canCast().success;
      case 'E':
        return this.shoulderCharge.canCast(target).success;
      case 'R':
        return this.warCry.canCast().success;
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
        return this.heavySlash.getCooldownProgress();
      case 'W':
        return this.shieldBlock.getCooldownProgress();
      case 'E':
        return this.shoulderCharge.getCooldownProgress();
      case 'R':
        return this.warCry.getCooldownProgress();
      default:
        return 1;
    }
  }

  /**
   * Override castAbility for input system compatibility.
   */
  override castAbility(
    slot: 'Q' | 'W' | 'E' | 'R',
    targetUnit?: Champion,
    _targetPosition?: Vector
  ): boolean {
    return this.castBranAbility(slot, this.gameContext!, targetUnit);
  }

  /**
   * Get ability info for UI/input system.
   */
  override getAbility(slot: 'Q' | 'W' | 'E' | 'R'): any {
    const descriptor = this.getAbilityDescriptor(slot);
    if (!descriptor) return undefined;

    const targetDesc = this.getAbilityTargetDesc(slot);

    return {
      get isLearned() {
        return typeof (descriptor as any).isLearned === 'function'
          ? (descriptor as any).isLearned()
          : (descriptor as any).rank > 0;
      },
      get isReady() {
        const desc = descriptor as any;
        if (typeof desc.isReady === 'boolean') return desc.isReady;
        if (typeof desc.isReady === 'function') return desc.isReady();
        const progress = typeof desc.getCooldownProgress === 'function'
          ? desc.getCooldownProgress()
          : (desc.cooldownProgress ?? 1);
        return progress >= 1;
      },
      get rank() { return (descriptor as any).rank ?? 0; },
      get cooldownProgress() {
        return typeof (descriptor as any).getCooldownProgress === 'function'
          ? (descriptor as any).getCooldownProgress()
          : 1;
      },
      get cooldownRemaining() {
        return typeof (descriptor as any).getCooldownRemaining === 'function'
          ? (descriptor as any).getCooldownRemaining()
          : 0;
      },
      definition: {
        name: (descriptor as any).name,
        description: (descriptor as any).description,
      },
      getTargetDescription: () => targetDesc,
    };
  }

  private getAbilityDescriptor(slot: 'Q' | 'W' | 'E' | 'R'): CastAbilityDescriptor | null {
    switch (slot) {
      case 'Q': return this.heavySlash;
      case 'W': return this.shieldBlock;
      case 'E': return this.shoulderCharge;
      case 'R': return this.warCry;
      default: return null;
    }
  }

  private getAbilityTargetDesc(slot: 'Q' | 'W' | 'E' | 'R') {
    switch (slot) {
      case 'Q':
      case 'W':
      case 'R':
        // Self-targeted
        return {
          requiresTarget: false,
          targetsGround: false,
          isValidTarget: () => true,
        };
      case 'E':
        // Requires enemy target
        return {
          requiresTarget: true,
          targetsGround: false,
          range: 400,
          isValidTarget: (caster: Champion, target: Champion | null) => {
            if (!target) return false;
            return target.getSide() !== caster.getSide() && !target.isDead();
          },
        };
      default:
        return { requiresTarget: false, targetsGround: false, isValidTarget: () => true };
    }
  }

  /**
   * Update passive and abilities.
   */
  override step(gctx: GameContext): void {
    this.gameContext = gctx;
    super.step(gctx);

    if (this.state.isDead) return;

    const dt = gctx.dt;

    // Update abilities
    this.heavySlash.update(gctx, dt);
    this.shieldBlock.update(gctx, dt);
    this.shoulderCharge.update(gctx, dt);
    this.warCry.update(gctx, dt);

    // Update passive: Veteran's Grit
    this.updatePassive(dt);
  }

  /**
   * Passive: Veteran's Grit - 1% max HP regen per second when below 30% HP.
   */
  private updatePassive(dt: number): void {
    const stats = this.getStats();
    const healthPercent = this.state.health / stats.maxHealth;

    if (healthPercent < 0.30) {
      // Regenerate 1% max health per second
      const regenAmount = stats.maxHealth * 0.01 * dt;
      this.heal(regenAmount);
      this.passiveActive = true;
    } else {
      this.passiveActive = false;
    }
  }

  /**
   * Check if passive is active.
   */
  isPassiveActive(): boolean {
    return this.passiveActive;
  }

  /**
   * Render Bran.
   */
  protected renderChampion(gctx: GameContext): void {
    const ctx = gctx.canvasRenderingContext;
    const pos = this.position;

    // Body (soldier - brown/tan theme)
    ctx.fillStyle = this.side === 0 ? '#8B4513' : '#654321';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
    ctx.fill();

    // Shield (on left side)
    ctx.fillStyle = '#4A4A4A';
    ctx.beginPath();
    const shieldOffsetX = -this.direction.y * 15;
    const shieldOffsetY = this.direction.x * 15;
    ctx.arc(pos.x + shieldOffsetX, pos.y + shieldOffsetY, 12, 0, Math.PI * 2);
    ctx.fill();

    // Sword (in direction)
    ctx.strokeStyle = '#C0C0C0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(
      pos.x + this.direction.x * 35,
      pos.y + this.direction.y * 35
    );
    ctx.stroke();

    // Sword tip
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

    // Passive indicator (gold glow when active)
    if (this.passiveActive) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Health bar
    this.renderHealthBar(ctx, pos);

    // Mana bar
    this.renderResourceBar(ctx, pos);
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D, pos: Vector): void {
    const stats = this.getStats();
    const healthPercent = this.state.health / stats.maxHealth;
    const shieldAmount = this.getTotalShield();
    const shieldPercent = shieldAmount / stats.maxHealth;

    const barWidth = 44;
    const barHeight = 5;
    const barY = pos.y - 32;

    ctx.fillStyle = '#333';
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, barHeight);

    ctx.fillStyle = this.side === 0 ? '#4CAF50' : '#F44336';
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);

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

  private renderResourceBar(ctx: CanvasRenderingContext2D, pos: Vector): void {
    const stats = this.getStats();
    const resourcePercent = this.state.resource / stats.maxResource;

    const barWidth = 44;
    const barHeight = 3;
    const barY = pos.y - 26;

    ctx.fillStyle = '#333';
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, barHeight);

    // Mana (blue)
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth * resourcePercent, barHeight);
  }
}

export default Bran;
