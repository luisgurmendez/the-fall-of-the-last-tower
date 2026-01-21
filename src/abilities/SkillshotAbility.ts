/**
 * SkillshotAbility - A concrete ability that fires a projectile.
 *
 * This wraps the CastAbilityDescriptor and projectile system
 * while implementing the Ability interface.
 */

import Ability from './Ability';
import { AbilityDefinition, AbilityCastContext, AbilityCastResult, AbilitySlot } from './types';
import type GameContext from '@/core/gameContext';
import type Vector from '@/physics/vector';
import { AbilityProjectile } from './projectiles/AbilityProjectile';
import type { ProjectileConfig } from './projectiles/types';
import { IEffect } from '@/effects/EffectDescriptor';

/**
 * Visual/behavior config for the projectile (without filter/effects which are added at runtime).
 */
export interface SkillshotProjectileConfig {
  speed: number;
  ttl: number;
  radius: number;
  piercing: boolean;
  width?: number;
  color?: string;
}

/**
 * Configuration for creating a skillshot ability.
 */
export interface SkillshotAbilityConfig {
  id: string;
  name: string;
  description: string;
  range: number;
  width: number;
  projectile: SkillshotProjectileConfig;
  onHitEffects: IEffect[];
  manaCost: number[];
  cooldown: number[];
}

/**
 * A skillshot ability that fires a projectile in a direction.
 */
export class SkillshotAbility extends Ability {
  private projectileConfig: SkillshotProjectileConfig;
  private onHitEffects: IEffect[];
  private lastGameContext: GameContext | null = null;

  constructor(config: SkillshotAbilityConfig, slot: AbilitySlot) {
    const definition: AbilityDefinition = {
      id: config.id,
      name: config.name,
      description: config.description,
      type: 'active',
      targetType: 'skillshot',
      maxRank: 5,
      manaCost: config.manaCost,
      cooldown: config.cooldown,
      range: config.range,
      shape: 'line',
    };

    super(definition, slot);

    this.projectileConfig = config.projectile;
    this.onHitEffects = config.onHitEffects;
  }

  /**
   * Store game context for projectile spawning.
   */
  setGameContext(gctx: GameContext): void {
    this.lastGameContext = gctx;
  }

  /**
   * Execute the skillshot - spawn a projectile.
   */
  protected execute(context: AbilityCastContext): void {
    if (!this.owner || !this.lastGameContext) return;

    // Get direction from cast context or calculate from mouse position
    let direction: Vector;
    if (context.direction) {
      direction = context.direction.clone().normalize();
    } else if (context.targetPosition) {
      direction = context.targetPosition.clone().sub(this.owner.getPosition()).normalize();
    } else {
      direction = this.owner.getDirection();
    }

    // Build full projectile config
    const fullConfig: ProjectileConfig = {
      speed: this.projectileConfig.speed,
      ttl: this.projectileConfig.ttl,
      radius: this.projectileConfig.radius,
      piercing: this.projectileConfig.piercing,
      width: this.projectileConfig.width,
      color: this.projectileConfig.color,
      filter: {
        side: this.owner.getSide(),
      },
      effects: this.onHitEffects.map(e => e.clone()),
    };

    // Create projectile
    const startPosition = this.owner.getPosition().clone();
    const projectile = new AbilityProjectile(
      startPosition,
      direction,
      this.owner,
      fullConfig,
      this.rank
    );

    // Add to game objects
    this.lastGameContext.objects.push(projectile);
  }

  /**
   * Update the ability and store game context.
   */
  override update(gctx: GameContext): void {
    super.update(gctx);
    this.lastGameContext = gctx;
  }
}

export default SkillshotAbility;
