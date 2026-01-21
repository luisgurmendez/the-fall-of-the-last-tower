/**
 * Lyra, The Longbow
 *
 * A ranged marksman with exceptional attack range. Her kit focuses on
 * consistent damage from afar with mobility and area denial.
 *
 * Passive (Steady Hand): Consecutive basic attacks on the same target deal bonus damage
 * Q (Piercing Shot): Skillshot arrow that pierces through enemies
 * W (Focus): Self-buff increasing attack damage and attack speed
 * E (Tumble): Short dash, next basic attack deals bonus damage
 * R (Arrow Storm): Ground-targeted AOE damage over time
 */

import Vector from "@/physics/vector";
import GameContext from "@/core/gameContext";
import { Side } from "@/types";
import { Champion } from "@/champions/Champion";
import { ChampionDefinition } from "@/champions/types";
import RenderUtils from "@/render/utils";

// Effect System Imports
import { CastAbilityDescriptor } from "@/abilities/CastAbilityDescriptor";
import AbilityCost from "@/abilities/AbilityCost";
import {
  SelfTargetAbilityTargetDescription,
  GroundTargetAbilityTargetDescription,
} from "@/abilities/AbilityTargetDescription";
import {
  SemiImmediateEffect,
  DurationEffect,
  EffectTargetType,
  IEffect,
  EffectApplicationContext,
} from "@/effects/EffectDescriptor";
import {
  ScalingDamageEffect,
  ScalingStatBuffEffect,
  calculateScaledValue,
} from "@/effects/ScalingEffect";
import {
  SkillshotAbility,
  SkillshotAbilityConfig,
} from "@/abilities/SkillshotAbility";
import { TargetedProjectile } from "@/abilities/projectiles/TargetedProjectile";
import { AbilityScaling, AbilityCastContext } from "@/abilities/types";

// ===================
// Champion Definition
// ===================

const LyraDefinition: ChampionDefinition = {
  id: "lyra",
  name: "Lyra",
  title: "The Longbow",
  class: "marksman",
  attackType: "ranged",
  resourceType: "mana",

  baseStats: {
    health: 530,
    healthRegen: 4,
    resource: 350, // Mana pool
    resourceRegen: 7, // Mana regen
    attackDamage: 55,
    abilityPower: 0,
    attackSpeed: 0.65,
    attackRange: 650, // Very long attack range!
    armor: 20,
    magicResist: 30,
    movementSpeed: 325,
    critChance: 0,
    critDamage: 2.0,
  },

  growthStats: {
    health: 85,
    healthRegen: 0.5,
    resource: 40,
    resourceRegen: 0.8,
    attackDamage: 3,
    attackSpeed: 3,
    armor: 3,
    magicResist: 0.5,
  },

  abilities: {
    Q: "lyra_piercing_shot",
    W: "lyra_focus",
    E: "lyra_tumble",
    R: "lyra_arrow_storm",
  },
};

// ===================
// Custom Effects
// ===================

/**
 * Effect that adds an empowered basic attack with scaling bonus damage.
 * The bonus damage scales with ability rank and AD ratio.
 */
class ScalingEmpoweredAttackEffect implements IEffect {
  readonly scaling: AbilityScaling;
  readonly duration: number;
  readonly name: string;

  constructor(
    scaling: AbilityScaling,
    duration: number = 3,
    name: string = "Empowered Attack"
  ) {
    this.scaling = scaling;
    this.duration = duration;
    this.name = name;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, abilityRank } = context;

    const rank = abilityRank ?? 1;
    const bonusDamage = calculateScaledValue(this.scaling, caster, rank);

    // Add the empowered attack modifier
    caster.addBasicAttackModifier({
      bonusDamage,
      charges: 1,
      name: this.name,
      duration: this.duration,
    });
  }

  clone(): IEffect {
    return new ScalingEmpoweredAttackEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.duration,
      this.name
    );
  }
}

/**
 * Effect that dashes in the direction of the target position.
 */
class DirectionalDashEffect implements IEffect {
  readonly distance: number;
  readonly speed: number;

  constructor(distance: number, speed: number = 800) {
    this.distance = distance;
    this.speed = speed;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, targetPosition } = context;

    if (!targetPosition) {
      // Use caster's current direction
      caster.startDash(caster.getDirection(), this.distance, this.speed);
      return;
    }

    // Calculate direction toward target position
    const direction = targetPosition
      .clone()
      .sub(caster.getPosition())
      .normalize();
    caster.startDash(direction, this.distance, this.speed);
  }

  clone(): IEffect {
    return new DirectionalDashEffect(this.distance, this.speed);
  }
}

// ===================
// Q: Piercing Shot
// ===================

function createPiercingShot(): SkillshotAbility {
  const config: SkillshotAbilityConfig = {
    id: "lyra_piercing_shot",
    name: "Piercing Shot",
    description:
      "Fire a piercing arrow that deals 60/95/130/165/200 (+100% AD) physical damage to all enemies hit.",
    range: 900,
    width: 50,
    projectile: {
      speed: 1400,
      ttl: 0.65, // 900 / 1400 ≈ 0.64s travel time
      radius: 25,
      piercing: true,
    },
    onHitEffects: [
      new ScalingDamageEffect(
        {
          base: [60, 95, 130, 165, 200],
          adRatio: 1.0,
        },
        "physical",
        "Piercing Shot"
      ),
    ],
    manaCost: [50, 55, 60, 65, 70],
    cooldown: [10, 9, 8, 7, 6],
  };

  return new SkillshotAbility(config, "Q");
}

// ===================
// W: Focus
// ===================

function createFocus(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: "Focus",
    description:
      "Enter a focused state, gaining 15/20/25/30/35 attack damage and 15/20/25/30/35% attack speed for 4 seconds.",
    cost: new AbilityCost({
      energy: 40, // Uses energy (generic resource) which maps to mana
      cooldown: 16,
    }),
    target: new SelfTargetAbilityTargetDescription(),
    effects: [
      // Attack damage buff
      new DurationEffect(
        new ScalingStatBuffEffect(
          "attackDamage",
          { base: [15, 20, 25, 30, 35] },
          4,
          false // Flat bonus
        ),
        EffectTargetType.self,
        4
      ),
      // Attack speed buff
      new DurationEffect(
        new ScalingStatBuffEffect(
          "attackSpeed",
          { base: [0.15, 0.2, 0.25, 0.3, 0.35] },
          4,
          true // Percent bonus
        ),
        EffectTargetType.self,
        4
      ),
    ],
    castTime: 0,
    cooldown: 16,
    cooldownPerRank: [16, 14.5, 13, 11.5, 10],
  });
}

// ===================
// E: Tumble
// ===================

function createTumble(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: "Tumble",
    description:
      "Dash 300 units in target direction. Your next basic attack within 3 seconds deals 20/35/50/65/80 (+40% AD) bonus physical damage.",
    cost: new AbilityCost({
      energy: 40,
      cooldown: 8,
    }),
    target: new GroundTargetAbilityTargetDescription(300, 0), // Direction target
    effects: [
      // Dash in direction
      new SemiImmediateEffect(
        new DirectionalDashEffect(300, 800),
        EffectTargetType.self
      ),
      // Empowered next attack
      new SemiImmediateEffect(
        new ScalingEmpoweredAttackEffect(
          {
            base: [20, 35, 50, 65, 80],
            adRatio: 0.4,
          },
          3,
          "Tumble"
        ),
        EffectTargetType.self
      ),
    ],
    castTime: 0,
    cooldown: 8,
    cooldownPerRank: [8, 7, 6, 5, 4],
  });
}

// ===================
// R: Arrow Storm
// ===================

/**
 * Arrow Storm zone - a persistent AOE that damages enemies over time.
 */
class ArrowStormZone {
  private position: Vector;
  private radius: number;
  private damage: number;
  private damageType: "physical" | "magic" | "true";
  private caster: Champion;
  private duration: number;
  private tickInterval: number;
  private elapsedTime: number = 0;
  private lastTickTime: number = 0;
  private tickCount: number = 0;
  private totalTicks: number;
  shouldDispose: boolean = false;

  constructor(
    position: Vector,
    radius: number,
    damage: number,
    damageType: "physical" | "magic" | "true",
    caster: Champion,
    duration: number,
    ticks: number
  ) {
    this.position = position;
    this.radius = radius;
    this.damage = damage;
    this.damageType = damageType;
    this.caster = caster;
    this.duration = duration;
    this.totalTicks = ticks;
    this.tickInterval = duration / ticks;
  }

  step(gctx: GameContext): void {
    if (this.shouldDispose) return;

    this.elapsedTime += gctx.dt;

    // Check if it's time to deal damage
    if (
      this.elapsedTime - this.lastTickTime >= this.tickInterval &&
      this.tickCount < this.totalTicks
    ) {
      this.dealDamage(gctx);
      this.lastTickTime = this.elapsedTime;
      this.tickCount++;
    }

    // Check if duration expired
    if (this.elapsedTime >= this.duration) {
      this.shouldDispose = true;
    }
  }

  private dealDamage(gctx: GameContext): void {
    // Find all enemies in range
    const enemies = gctx.objects.filter(
      (obj): obj is Champion =>
        obj instanceof Champion &&
        obj.getSide() !== this.caster.getSide() &&
        !obj.isDead() &&
        obj.getPosition().distanceTo(this.position) <= this.radius
    );

    const damagePerTick = this.damage / this.totalTicks;

    for (const enemy of enemies) {
      enemy.takeDamage(
        damagePerTick,
        this.damageType,
        this.caster,
        "Arrow Storm"
      );
    }
  }

  render() {
    return {
      render: (gctx: GameContext) => {
        const ctx = gctx.canvasRenderingContext;
        ctx.save();

        // Draw the arrow storm zone
        const alpha = 0.3 + 0.2 * Math.sin(this.elapsedTime * 10);
        ctx.fillStyle = `rgba(255, 165, 0, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw arrows raining down
        ctx.strokeStyle = "#8B4513";
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const angle = (this.elapsedTime * 3 + i * 1.2) % (Math.PI * 2);
          const dist = (this.elapsedTime * 200 + i * 40) % this.radius;
          const x = this.position.x + Math.cos(angle) * dist;
          const y = this.position.y + Math.sin(angle) * dist;
          ctx.beginPath();
          ctx.moveTo(x, y - 15);
          ctx.lineTo(x, y + 5);
          ctx.stroke();
        }

        ctx.restore();
      },
      isOverlay: false,
    };
  }
}

/**
 * Effect that creates an Arrow Storm zone at target position.
 */
class ArrowStormEffect implements IEffect {
  readonly scaling: AbilityScaling;
  readonly radius: number;
  readonly duration: number;
  readonly ticks: number;

  constructor(
    scaling: AbilityScaling,
    radius: number,
    duration: number,
    ticks: number
  ) {
    this.scaling = scaling;
    this.radius = radius;
    this.duration = duration;
    this.ticks = ticks;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, targetPosition, gameContext, abilityRank } = context;
    if (!targetPosition || !gameContext) return;

    const rank = abilityRank ?? 1;
    const totalDamage = calculateScaledValue(this.scaling, caster, rank);

    // Create the arrow storm zone
    const zone = new ArrowStormZone(
      targetPosition.clone(),
      this.radius,
      totalDamage,
      "physical",
      caster,
      this.duration,
      this.ticks
    );

    // Add to game objects
    gameContext.objects.push(zone as any);
  }

  clone(): IEffect {
    return new ArrowStormEffect(
      { ...this.scaling, base: [...this.scaling.base] },
      this.radius,
      this.duration,
      this.ticks
    );
  }
}

function createArrowStorm(): CastAbilityDescriptor {
  return new CastAbilityDescriptor({
    name: "Arrow Storm",
    description:
      "Rain arrows on target area for 2 seconds, dealing 150/250/350 (+80% AD) physical damage to enemies within.",
    cost: new AbilityCost({
      energy: 100,
      cooldown: 90,
    }),
    target: new GroundTargetAbilityTargetDescription(900, 200),
    effects: [
      new SemiImmediateEffect(
        new ArrowStormEffect(
          {
            base: [150, 250, 350],
            adRatio: 0.8,
          },
          200,
          2,
          4
        ), // 200 radius, 2 second duration, 4 ticks
        EffectTargetType.self // Effect needs caster context
      ),
    ],
    castTime: 0,
    cooldown: 90,
    cooldownPerRank: [90, 75, 60],
    maxRank: 3,
  });
}

// ===================
// Custom Arrow Projectile
// ===================

class LyraArrowProjectile extends TargetedProjectile {
  protected override renderProjectile(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const pos = this.position;
    const angle = Math.atan2(this.direction.y, this.direction.x);

    // Long elegant arrow shaft
    const shaftLength = 30;
    const shaftEnd = new Vector(
      pos.x - Math.cos(angle) * shaftLength,
      pos.y - Math.sin(angle) * shaftLength
    );

    // Shaft (dark wood)
    ctx.strokeStyle = "#5C4033";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(shaftEnd.x, shaftEnd.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // Arrowhead (silver/steel)
    const headLength = 10;
    const headWidth = 6;
    const tipPos = new Vector(
      pos.x + Math.cos(angle) * headLength,
      pos.y + Math.sin(angle) * headLength
    );
    const leftBarb = new Vector(
      pos.x + Math.cos(angle + Math.PI * 0.85) * headWidth,
      pos.y + Math.sin(angle + Math.PI * 0.85) * headWidth
    );
    const rightBarb = new Vector(
      pos.x + Math.cos(angle - Math.PI * 0.85) * headWidth,
      pos.y + Math.sin(angle - Math.PI * 0.85) * headWidth
    );

    ctx.fillStyle = "#C0C0C0";
    ctx.beginPath();
    ctx.moveTo(tipPos.x, tipPos.y);
    ctx.lineTo(leftBarb.x, leftBarb.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.lineTo(rightBarb.x, rightBarb.y);
    ctx.closePath();
    ctx.fill();

    // Fletching (blue feathers to match Lyra's theme)
    const fletchOffset = shaftLength - 5;
    ctx.fillStyle = "#4169E1";
    for (const offset of [-0.4, 0.4]) {
      const fletchBase = new Vector(
        pos.x - Math.cos(angle) * fletchOffset,
        pos.y - Math.sin(angle) * fletchOffset
      );
      const fletchTip = new Vector(
        fletchBase.x + Math.cos(angle + Math.PI / 2 + offset) * 5,
        fletchBase.y + Math.sin(angle + Math.PI / 2 + offset) * 5
      );
      const fletchBack = new Vector(
        pos.x - Math.cos(angle) * (fletchOffset + 8),
        pos.y - Math.sin(angle) * (fletchOffset + 8)
      );

      ctx.beginPath();
      ctx.moveTo(fletchBase.x, fletchBase.y);
      ctx.lineTo(fletchTip.x, fletchTip.y);
      ctx.lineTo(fletchBack.x, fletchBack.y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

// ===================
// Lyra Champion Class
// ===================

export class Lyra extends Champion {
  protected readonly definition = LyraDefinition;

  // Abilities
  private piercingShot: SkillshotAbility;
  private focus: CastAbilityDescriptor;
  private tumble: CastAbilityDescriptor;
  private arrowStorm: CastAbilityDescriptor;

  // Passive: Steady Hand
  private steadyHandStacks: number = 0;
  private steadyHandTarget: Champion | null = null;
  private readonly steadyHandMaxStacks: number = 5;
  private readonly steadyHandBonusPerStack: number = 5;

  // Store game context
  private gameContext: GameContext | null = null;

  constructor(position: Vector, side: Side) {
    super(position, side);

    // Create ability instances
    this.piercingShot = createPiercingShot();
    this.focus = createFocus();
    this.tumble = createTumble();
    this.arrowStorm = createArrowStorm();

    // Set owners
    this.piercingShot.setOwner(this);
    this.focus.setOwner(this);
    this.tumble.setOwner(this);
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
   * Create an ability cast context.
   */
  private createAbilityCastContext(
    targetUnit?: Champion,
    targetPosition?: Vector
  ): AbilityCastContext {
    return {
      caster: this as unknown as Champion,
      targetUnit,
      targetPosition,
      rank: 1, // Default to rank 1
      dt: 1 / 60, // Default dt
    };
  }

  /**
   * Cast an ability by slot.
   */
  castLyraAbility(
    slot: "Q" | "W" | "E" | "R",
    gctx: GameContext,
    target?: Champion,
    targetPosition?: Vector
  ): boolean {
    const context = this.createAbilityCastContext(target, targetPosition);

    switch (slot) {
      case "Q":
        this.piercingShot.setGameContext(gctx);
        const qResult = this.piercingShot.cast(context);
        return qResult.success;
      case "W":
        return this.focus.cast(gctx).success;
      case "E":
        return this.tumble.cast(gctx, undefined, targetPosition).success;
      case "R":
        // Check range for R
        if (targetPosition) {
          const distance = this.position.distanceTo(targetPosition);
          if (distance > 900) {
            return false;
          }
        }
        return this.arrowStorm.cast(gctx, undefined, targetPosition).success;
      default:
        return false;
    }
  }

  /**
   * Check if an ability can be cast.
   * For ground-targeted abilities (E, R), this checks cost/cooldown only.
   * For actual cast validity with a specific position, use castLyraAbility.
   */
  canCastLyraAbility(slot: "Q" | "W" | "E" | "R", target?: Champion): boolean {
    // For ground-targeted abilities, we just check if it's ready (mana + cooldown)
    // rather than validating a specific target position
    switch (slot) {
      case "Q":
        return this.piercingShot.canCast(this.createAbilityCastContext(target))
          .success;
      case "W":
        return this.focus.canCast().success;
      case "E":
        // For Tumble, check mana and cooldown without position validation
        // Pass a dummy position to satisfy GroundTargetAbilityTargetDescription
        return this.tumble.canCast(undefined, this.position.clone()).success;
      case "R":
        // For Arrow Storm, check mana and cooldown with valid position
        return this.arrowStorm.canCast(undefined, this.position.clone())
          .success;
      default:
        return false;
    }
  }

  /**
   * Get passive stacks for testing.
   */
  getPassiveStacks(): number {
    return this.steadyHandStacks;
  }

  /**
   * Set auto-attack target (for testing and AI).
   */
  setBasicAttackTarget(target: Champion | null): void {
    if (this.basicAttackTarget !== target) {
      // Switching targets - check passive stacks
      if (target && target !== this.steadyHandTarget) {
        this.steadyHandStacks = 0;
        this.steadyHandTarget = target;
      }
    }
    this.basicAttackTarget = target;
  }

  /**
   * Override basic attack callback.
   * Note: Passive stacks are updated in createBasicAttackProjectile/updatePassiveForTarget.
   */
  override onBasicAttack(target: Champion): void {
    super.onBasicAttack(target);
  }

  /**
   * Get bonus damage from passive.
   */
  getPassiveBonusDamage(): number {
    return this.steadyHandStacks * this.steadyHandBonusPerStack;
  }

  /**
   * Create custom arrow projectile with passive damage bonus.
   */
  protected override createBasicAttackProjectile(
    target: Champion,
    damage: number,
    isCrit: boolean,
    onHit: (target: Champion, damage: number) => void
  ): TargetedProjectile | null {
    // Add passive bonus damage
    const passiveBonus = this.getPassiveBonusDamage();
    let totalDamage = damage + passiveBonus;

    // Apply basic attack modifiers (like Tumble empowered attack)
    for (const mod of this.basicAttackModifiers) {
      if (mod.bonusDamage) {
        totalDamage += mod.bonusDamage;
      }
      if (mod.damageMultiplier) {
        totalDamage *= mod.damageMultiplier;
      }
    }

    // Consume the attack modifiers (reduces charges, removes exhausted ones)
    this.consumeBasicAttackModifiers();

    // Update passive stacks when projectile is created
    this.updatePassiveForTarget(target);

    return new LyraArrowProjectile(
      this.position.clone(),
      target,
      this as unknown as Champion,
      {
        speed: 1600, // Fast arrows
        damage: totalDamage,
        damageType: "physical",
        onHit,
        damageSource: "Auto Attack",
      }
    );
  }

  /**
   * Update passive stacks for the target.
   */
  private updatePassiveForTarget(target: Champion): void {
    if (target === this.steadyHandTarget) {
      this.steadyHandStacks = Math.min(
        this.steadyHandStacks + 1,
        this.steadyHandMaxStacks
      );
    } else {
      this.steadyHandTarget = target;
      this.steadyHandStacks = 1;
    }
  }

  override step(gctx: GameContext): void {
    this.gameContext = gctx;
    super.step(gctx);

    if (this.state.isDead) return;

    const dt = gctx.dt;

    // Update abilities
    this.piercingShot.update(gctx);
    this.focus.update(gctx, dt);
    this.tumble.update(gctx, dt);
    this.arrowStorm.update(gctx, dt);

    // Update attack modifier durations
    this.updateAttackModifiers(dt);
  }

  /**
   * Update attack modifier durations and remove expired ones.
   */
  private updateAttackModifiers(dt: number): void {
    for (let i = this.basicAttackModifiers.length - 1; i >= 0; i--) {
      const mod = this.basicAttackModifiers[i] as any;
      if (mod.duration !== undefined) {
        mod.duration -= dt;
        if (mod.duration <= 0) {
          this.basicAttackModifiers.splice(i, 1);
        }
      }
    }
  }

  /**
   * Get ability cooldown progress.
   */
  getAbilityCooldownProgress(slot: "Q" | "W" | "E" | "R"): number {
    switch (slot) {
      case "Q":
        return this.piercingShot.cooldownProgress;
      case "W":
        return this.focus.getCooldownProgress();
      case "E":
        return this.tumble.getCooldownProgress();
      case "R":
        return this.arrowStorm.getCooldownProgress();
      default:
        return 1;
    }
  }

  /**
   * Override castAbility for input system compatibility.
   */
  override castAbility(
    slot: "Q" | "W" | "E" | "R",
    targetUnit?: Champion,
    targetPosition?: Vector
  ): boolean {
    return this.castLyraAbility(
      slot,
      this.gameContext!,
      targetUnit,
      targetPosition
    );
  }

  /**
   * Get ability info for UI/input system.
   */
  override getAbility(slot: "Q" | "W" | "E" | "R"): any {
    const descriptor = this.getAbilityDescriptor(slot);
    if (!descriptor) return undefined;

    const targetDesc = this.getAbilityTargetDesc(slot);

    return {
      get isLearned() {
        if (typeof (descriptor as any).isLearned === "function")
          return (descriptor as any).isLearned();
        return (descriptor as any).isLearned ?? (descriptor as any).rank > 0;
      },
      get isReady() {
        // Check if it's a property first (base Ability class uses getter)
        const desc = descriptor as any;
        if (typeof desc.isReady === "boolean") return desc.isReady;
        if (typeof desc.isReady === "function") return desc.isReady();
        // Fallback: check if not on cooldown
        if (typeof desc.isOnCooldown === "boolean") return !desc.isOnCooldown;
        if (typeof desc.isOnCooldown === "function")
          return !desc.isOnCooldown();
        // Final fallback: check cooldown progress
        const progress =
          typeof desc.getCooldownProgress === "function"
            ? desc.getCooldownProgress()
            : desc.cooldownProgress ?? 1;
        return progress >= 1;
      },
      get rank() {
        return (descriptor as any).rank ?? 0;
      },
      get cooldownProgress() {
        if (typeof (descriptor as any).getCooldownProgress === "function")
          return (descriptor as any).getCooldownProgress();
        return (descriptor as any).cooldownProgress ?? 1;
      },
      get cooldownRemaining() {
        if (typeof (descriptor as any).getCooldownRemaining === "function")
          return (descriptor as any).getCooldownRemaining();
        return (descriptor as any).cooldownRemaining ?? 0;
      },
      definition: {
        name: (descriptor as any).name ?? (descriptor as any).definition?.name,
        description:
          (descriptor as any).description ??
          (descriptor as any).definition?.description,
      },
      getTargetDescription: () => targetDesc,
    };
  }

  private getAbilityDescriptor(slot: "Q" | "W" | "E" | "R"): any {
    switch (slot) {
      case "Q":
        return this.piercingShot;
      case "W":
        return this.focus;
      case "E":
        return this.tumble;
      case "R":
        return this.arrowStorm;
      default:
        return null;
    }
  }

  private getAbilityTargetDesc(slot: "Q" | "W" | "E" | "R") {
    switch (slot) {
      case "Q":
        return {
          requiresTarget: false,
          targetsGround: true,
          isValidTarget: () => true,
        };
      case "W":
        return {
          requiresTarget: false,
          targetsGround: false,
          isValidTarget: () => true,
        };
      case "E":
        return {
          requiresTarget: false,
          targetsGround: true,
          isValidTarget: () => true,
        };
      case "R":
        return {
          requiresTarget: false,
          targetsGround: true,
          range: 900,
          isValidTarget: (
            caster: Champion,
            target: Champion | null,
            pos: Vector | null
          ) => {
            if (!pos) return false;
            return caster.getPosition().distanceTo(pos) <= 900;
          },
        };
      default:
        return {
          requiresTarget: false,
          targetsGround: false,
          isValidTarget: () => true,
        };
    }
  }

  /**
   * Render Lyra.
   */
  protected renderChampion(gctx: GameContext): void {
    const ctx = gctx.canvasRenderingContext;
    const pos = this.position;

    // Body (archer - blue/purple theme)
    ctx.fillStyle = this.side === 0 ? "#4169E1" : "#8B008B";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
    ctx.fill();

    // Longbow
    ctx.strokeStyle = "#8B4513";
    ctx.lineWidth = 3;
    const bowAngle = Math.atan2(this.direction.y, this.direction.x);

    // Draw the long curved bow
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 28, bowAngle - 1.0, bowAngle + 1.0);
    ctx.stroke();

    // Bowstring
    ctx.strokeStyle = "#F5F5DC";
    ctx.lineWidth = 1;
    const stringStart = new Vector(
      pos.x + Math.cos(bowAngle - 1.0) * 28,
      pos.y + Math.sin(bowAngle - 1.0) * 28
    );
    const stringEnd = new Vector(
      pos.x + Math.cos(bowAngle + 1.0) * 28,
      pos.y + Math.sin(bowAngle + 1.0) * 28
    );
    ctx.beginPath();
    ctx.moveTo(stringStart.x, stringStart.y);
    ctx.lineTo(stringEnd.x, stringEnd.y);
    ctx.stroke();

    // Arrow nocked
    ctx.strokeStyle = "#5C4033";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + this.direction.x * 35, pos.y + this.direction.y * 35);
    ctx.stroke();

    // Arrow tip
    ctx.fillStyle = "#C0C0C0";
    ctx.beginPath();
    ctx.arc(
      pos.x + this.direction.x * 35,
      pos.y + this.direction.y * 35,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Passive stacks indicator
    if (this.steadyHandStacks > 0) {
      RenderUtils.renderBitmapText(
        ctx,
        `${this.steadyHandStacks}`,
        pos.x,
        pos.y - 45,
        { color: "#FFD700", centered: true, size: 16 }
      );
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

    const barWidth = 40;
    const barHeight = 5;
    const barY = pos.y - 28;

    ctx.fillStyle = "#333";
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, barHeight);

    ctx.fillStyle = this.side === 0 ? "#4CAF50" : "#F44336";
    ctx.fillRect(
      pos.x - barWidth / 2,
      barY,
      barWidth * healthPercent,
      barHeight
    );

    if (shieldAmount > 0) {
      ctx.fillStyle = "#FFFFFF";
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

    const barWidth = 40;
    const barHeight = 3;
    const barY = pos.y - 22;

    ctx.fillStyle = "#333";
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, barHeight);

    // Mana (blue)
    ctx.fillStyle = "#2196F3";
    ctx.fillRect(
      pos.x - barWidth / 2,
      barY,
      barWidth * resourcePercent,
      barHeight
    );
  }
}

export default Lyra;
