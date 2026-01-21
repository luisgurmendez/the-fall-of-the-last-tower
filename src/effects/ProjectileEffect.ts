/**
 * Effects that spawn projectiles and area zones.
 *
 * These effects are used in ability definitions to create
 * skillshots, ground-targeted abilities, and AoE zones.
 *
 * @example
 * // Skillshot ability that fires a projectile
 * const fireballAbility = new CastAbilityDescriptor({
 *   name: 'Fireball',
 *   target: new SkillshotAbilityTargetDescription(1000),
 *   effects: [
 *     new SemiImmediateEffect(
 *       new SpawnProjectileEffect({
 *         speed: 800,
 *         ttl: 2,
 *         radius: 20,
 *         piercing: false,
 *         effects: [new ScalingDamageEffect({ base: [80, 120] }, 'magic')],
 *       }),
 *       EffectTargetType.self
 *     ),
 *   ],
 *   cooldown: 8,
 * });
 *
 * @example
 * // Ground-targeted explosion
 * const groundSlamAbility = new CastAbilityDescriptor({
 *   name: 'Ground Slam',
 *   target: new GroundTargetAbilityTargetDescription(600, 150),
 *   effects: [
 *     new SemiImmediateEffect(
 *       new SpawnAreaEffect({
 *         shape: 'circle',
 *         radius: 150,
 *         duration: 0, // Instant
 *         effects: [new ScalingDamageEffect({ base: [100, 150] }, 'physical')],
 *       }),
 *       EffectTargetType.ground
 *     ),
 *   ],
 *   cooldown: 10,
 * });
 */

import Vector from '@/physics/vector';
import { IEffect, EffectApplicationContext } from './EffectDescriptor';
import { AbilityProjectile } from '@/abilities/projectiles/AbilityProjectile';
import { AreaOfEffect } from '@/abilities/projectiles/AreaOfEffect';
import { ProjectileConfig, AreaConfig } from '@/abilities/projectiles/types';

/**
 * Configuration for spawning a projectile.
 * Extends ProjectileConfig but effects are optional (can be added later).
 */
export interface SpawnProjectileConfig extends Omit<ProjectileConfig, 'filter' | 'effects'> {
  /** Effects to apply on hit (optional, can clone from scaling effects) */
  effects?: IEffect[];
  /** Override filter (default: hit enemies of caster) */
  filterOverride?: ProjectileConfig['filter'];
}

/**
 * Configuration for spawning an area effect.
 */
export interface SpawnAreaConfig extends Omit<AreaConfig, 'filter' | 'effects'> {
  /** Effects to apply to units in area */
  effects?: IEffect[];
  /** Override filter (default: hit enemies of caster) */
  filterOverride?: AreaConfig['filter'];
}

/**
 * Effect that spawns an ability projectile.
 *
 * When applied, creates an AbilityProjectile traveling in the cast direction.
 * The projectile carries its own effects and applies them on hit.
 */
export class SpawnProjectileEffect implements IEffect {
  constructor(
    protected readonly config: SpawnProjectileConfig,
    /** Effects to apply on projectile hit */
    protected readonly hitEffects: IEffect[] = []
  ) {}

  apply(context: EffectApplicationContext): void {
    const { caster, gameContext, abilityRank } = context;

    // Determine direction
    let direction: Vector;
    if (context.targetPosition) {
      // Skillshot toward target position
      direction = context.targetPosition.clone().sub(caster.getPosition()).normalize();
    } else if (context.target) {
      // Toward target
      direction = context.target.getPosition().clone().sub(caster.getPosition()).normalize();
    } else {
      // Use caster's facing direction
      direction = caster.getDirection();
    }

    // Build full projectile config
    const fullConfig: ProjectileConfig = {
      ...this.config,
      filter: this.config.filterOverride ?? {
        side: caster.getSide(),
      },
      effects: [
        ...(this.config.effects ?? []),
        ...this.hitEffects.map(e => e.clone()),
      ],
    };

    // Create the projectile
    const projectile = new AbilityProjectile(
      caster.getPosition(),
      direction,
      caster,
      fullConfig,
      abilityRank ?? 1
    );

    // Add to game objects
    gameContext.objects.push(projectile);
  }

  clone(): IEffect {
    return new SpawnProjectileEffect(
      { ...this.config },
      this.hitEffects.map(e => e.clone())
    );
  }
}

/**
 * Effect that spawns an area of effect zone.
 *
 * When applied, creates an AreaOfEffect at the target position.
 * The area applies effects to units inside based on its configuration.
 */
export class SpawnAreaEffect implements IEffect {
  constructor(
    protected readonly config: SpawnAreaConfig,
    /** Effects to apply to units in the area */
    protected readonly areaEffects: IEffect[] = []
  ) {}

  apply(context: EffectApplicationContext): void {
    const { caster, gameContext, abilityRank } = context;

    // Determine position
    let position: Vector;
    if (context.targetPosition) {
      position = context.targetPosition.clone();
    } else if (context.target) {
      position = context.target.getPosition();
    } else {
      position = caster.getPosition();
    }

    // Determine direction
    let direction: Vector;
    if (context.targetPosition) {
      direction = context.targetPosition.clone().sub(caster.getPosition()).normalize();
    } else {
      direction = caster.getDirection();
    }

    // Build full area config
    const fullConfig: AreaConfig = {
      ...this.config,
      filter: this.config.filterOverride ?? {
        side: caster.getSide(),
      },
      effects: [
        ...(this.config.effects ?? []),
        ...this.areaEffects.map(e => e.clone()),
      ],
    };

    // Create the area
    const area = new AreaOfEffect(
      position,
      direction,
      caster,
      fullConfig,
      abilityRank ?? 1
    );

    // Add to game objects
    gameContext.objects.push(area);
  }

  clone(): IEffect {
    return new SpawnAreaEffect(
      { ...this.config },
      this.areaEffects.map(e => e.clone())
    );
  }
}

/**
 * Effect that spawns a projectile that explodes on hit or at max range.
 *
 * Combines a projectile with an area effect that triggers when the
 * projectile ends (either by hitting something or timing out).
 */
export class SpawnExplodingProjectileEffect implements IEffect {
  constructor(
    protected readonly projectileConfig: SpawnProjectileConfig,
    protected readonly explosionConfig: SpawnAreaConfig,
    /** Effects to apply on direct projectile hit */
    protected readonly directHitEffects: IEffect[] = [],
    /** Effects to apply in explosion area */
    protected readonly explosionEffects: IEffect[] = []
  ) {}

  apply(context: EffectApplicationContext): void {
    const { caster, gameContext, abilityRank } = context;

    // Determine direction
    let direction: Vector;
    if (context.targetPosition) {
      direction = context.targetPosition.clone().sub(caster.getPosition()).normalize();
    } else if (context.target) {
      direction = context.target.getPosition().clone().sub(caster.getPosition()).normalize();
    } else {
      direction = caster.getDirection();
    }

    // Build explosion area config
    const explosionFullConfig: AreaConfig = {
      ...this.explosionConfig,
      duration: 0, // Instant explosion
      filter: this.explosionConfig.filterOverride ?? {
        side: caster.getSide(),
      },
      effects: [
        ...(this.explosionConfig.effects ?? []),
        ...this.explosionEffects.map(e => e.clone()),
      ],
    };

    // Create a special projectile that spawns explosion on dispose
    const fullProjectileConfig: ProjectileConfig = {
      ...this.projectileConfig,
      filter: this.projectileConfig.filterOverride ?? {
        side: caster.getSide(),
      },
      effects: this.directHitEffects.map(e => e.clone()),
    };

    // Create an exploding projectile
    const projectile = new ExplodingProjectile(
      caster.getPosition(),
      direction,
      caster,
      fullProjectileConfig,
      explosionFullConfig,
      abilityRank ?? 1
    );

    gameContext.objects.push(projectile);
  }

  clone(): IEffect {
    return new SpawnExplodingProjectileEffect(
      { ...this.projectileConfig },
      { ...this.explosionConfig },
      this.directHitEffects.map(e => e.clone()),
      this.explosionEffects.map(e => e.clone())
    );
  }
}

/**
 * Internal class for projectiles that explode on end.
 */
class ExplodingProjectile extends AbilityProjectile {
  protected explosionConfig: AreaConfig;
  protected hasExploded: boolean = false;

  constructor(
    position: Vector,
    direction: Vector,
    caster: import('@/units/types').IGameUnit,
    projectileConfig: ProjectileConfig,
    explosionConfig: AreaConfig,
    abilityRank: number
  ) {
    super(position, direction, caster, projectileConfig, abilityRank);
    this.explosionConfig = explosionConfig;
  }

  step(gctx: import('@/core/gameContext').default): void {
    const wasAlive = !this.shouldDispose;
    super.step(gctx);

    // If projectile just got disposed, spawn explosion
    if (wasAlive && this.shouldDispose && !this.hasExploded) {
      this.explode(gctx);
    }
  }

  protected explode(gctx: import('@/core/gameContext').default): void {
    this.hasExploded = true;

    const explosion = new AreaOfEffect(
      this.position,
      this.direction,
      this.caster,
      this.explosionConfig,
      this.abilityRank
    );

    gctx.objects.push(explosion);
  }
}
