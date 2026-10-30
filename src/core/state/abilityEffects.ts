/**
 * Legacy ability effects: a quick cone, circle, line or point flash for each
 * ability cast, shaped from the shared ability definitions. They're drawn by
 * src/render/overlays/abilityEffects.ts. Newer ability visuals go through the
 * VFX system in src/vfx/.
 */

import { getAbilityDefinition, type AbilityDefinition } from '@siege/shared';
import type { InterpolatedEntity } from './entities';

/**
 * Ability visual effect for rendering.
 */
export interface AbilityEffect {
  /** Entity that cast the ability */
  entityId: string;
  /** Ability ID for determining visual style */
  abilityId: string;
  /** World position where ability was cast from */
  originX: number;
  originY: number;
  /** Target position (for direction) */
  targetX: number;
  targetY: number;
  /** When the effect started (ms) */
  startTime: number;
  /** Duration to display (ms) */
  duration: number;
  /** Shape of the ability (cone, circle, line) */
  shape: 'cone' | 'circle' | 'line' | 'point';
  /** Range/radius of the effect */
  range: number;
  /** Cone angle (for cone shapes) */
  coneAngle?: number;
  /** AoE radius (for circle shapes) */
  aoeRadius?: number;
  /** Width (for line shapes) */
  width?: number;
  /** Color of the effect */
  color: string;
}

/**
 * Active ability effects, oldest first.
 */
export class AbilityEffects {
  private abilityEffects: AbilityEffect[] = [];

  /**
   * Create a visual effect for an ability cast.
   */
  create(
    entity: InterpolatedEntity,
    abilityId: string,
    targetX: number | undefined,
    targetY: number | undefined,
    now: number
  ): void {
    // Skip if no target position
    if (targetX === undefined || targetY === undefined) {
      return;
    }

    // Determine effect properties based on ability ID
    const effectConfig = getAbilityEffectConfig(abilityId);
    if (!effectConfig) {
      return;
    }

    this.abilityEffects.push({
      entityId: entity.snapshot.entityId,
      abilityId,
      originX: entity.position.x,
      originY: entity.position.y,
      targetX,
      targetY,
      startTime: now,
      duration: effectConfig.duration,
      shape: effectConfig.shape,
      range: effectConfig.range,
      coneAngle: effectConfig.coneAngle,
      aoeRadius: effectConfig.aoeRadius,
      width: effectConfig.width,
      color: effectConfig.color,
    });
  }

  /**
   * Get all active ability effects and remove expired ones.
   */
  getActive(): AbilityEffect[] {
    const now = Date.now();

    // Remove expired ability effects
    this.abilityEffects = this.abilityEffects.filter(
      (ae) => now - ae.startTime < ae.duration
    );

    return this.abilityEffects;
  }

  /**
   * Get progress (0-1) for an ability effect animation.
   */
  getProgress(effect: AbilityEffect): number {
    const elapsed = Date.now() - effect.startTime;
    return Math.min(1, elapsed / effect.duration);
  }
}

/**
 * Get visual configuration for an ability.
 * Reads shape/range/angle from shared ability definitions.
 * Returns null if the ability shouldn't have a visual effect.
 */
function getAbilityEffectConfig(abilityId: string): {
  shape: 'cone' | 'circle' | 'line' | 'point';
  range: number;
  duration: number;
  color: string;
  coneAngle?: number;
  aoeRadius?: number;
  width?: number;
} | null {
  // Get the ability definition from shared registry
  const abilityDef = getAbilityDefinition(abilityId);
  if (!abilityDef) {
    return null;
  }

  // Skip abilities without a visual shape (self-buffs, toggles, etc.)
  if (!abilityDef.shape && abilityDef.targetType === 'self') {
    return null;
  }

  // Visual-only properties: color and duration by damage type or ability
  const visualConfig = getAbilityVisualStyle(abilityId, abilityDef);

  // Check if this is a dash ability
  const hasDash = !!abilityDef.dash;

  // Determine shape - map ability shape to visual shape
  let shape: 'cone' | 'circle' | 'line' | 'point';
  if (abilityDef.shape === 'cone') {
    shape = 'cone';
  } else if (abilityDef.shape === 'line' || abilityDef.targetType === 'skillshot' || hasDash) {
    // Dash abilities and skillshots use line shape
    shape = 'line';
  } else if (abilityDef.shape === 'circle' || abilityDef.aoeRadius) {
    shape = 'circle';
  } else if (abilityDef.targetType === 'target_enemy' || abilityDef.targetType === 'target_ally') {
    shape = 'point';
  } else {
    // Default to circle for ground_target, point for others
    shape = abilityDef.targetType === 'ground_target' ? 'circle' : 'point';
  }

  // Determine effect range
  let effectRange = abilityDef.range ?? 0;
  if (shape === 'cone' && abilityDef.aoeRadius) {
    // For cones, use aoeRadius as the actual damage range
    effectRange = abilityDef.aoeRadius;
  } else if (hasDash && abilityDef.dash) {
    // For dash abilities, use dash distance as the range
    effectRange = abilityDef.dash.distance;
  }

  // Determine width for line effects
  // For dash abilities, aoeRadius is the hitbox width
  const effectWidth = hasDash ? (abilityDef.aoeRadius ?? 60) : (abilityDef.width ?? 60);

  return {
    shape,
    range: effectRange,
    duration: visualConfig.duration,
    color: visualConfig.color,
    coneAngle: abilityDef.coneAngle,
    aoeRadius: abilityDef.aoeRadius,
    width: effectWidth,
  };
}

/**
 * Get visual style (color, duration) for an ability.
 * This is the only place where visual-only properties are defined.
 */
function getAbilityVisualStyle(abilityId: string, abilityDef: AbilityDefinition): {
  color: string;
  duration: number;
} {
  // Color based on damage type
  const damageType = abilityDef.damage?.type;
  let baseColor: string;

  if (damageType === 'physical') {
    baseColor = 'rgba(255, 165, 0, 0.5)'; // Orange for physical
  } else if (damageType === 'magic') {
    baseColor = 'rgba(147, 112, 219, 0.5)'; // Purple for magic
  } else if (damageType === 'true') {
    baseColor = 'rgba(255, 255, 255, 0.5)'; // White for true damage
  } else if (abilityDef.heal) {
    baseColor = 'rgba(144, 238, 144, 0.5)'; // Green for heals
  } else if (abilityDef.shield) {
    baseColor = 'rgba(100, 149, 237, 0.5)'; // Blue for shields
  } else {
    baseColor = 'rgba(200, 200, 200, 0.4)'; // Gray default
  }

  // Override colors for specific abilities if needed
  const colorOverrides: Record<string, string> = {
    // Warrior - warm oranges/golds
    warrior_slash: 'rgba(255, 165, 0, 0.5)',
    warrior_charge: 'rgba(255, 200, 50, 0.4)',
    warrior_ultimate: 'rgba(255, 100, 0, 0.6)',
    // Magnus - fire/arcane
    magnus_fireball: 'rgba(255, 100, 50, 0.5)',
    magnus_meteor: 'rgba(255, 50, 0, 0.5)',
    // Elara - holy gold/green
    elara_heal: 'rgba(255, 215, 0, 0.5)',
    elara_barrier: 'rgba(144, 238, 144, 0.4)',
    // Vex - dark purple/indigo
    vex_shuriken: 'rgba(75, 0, 130, 0.5)',
    vex_dash: 'rgba(50, 0, 80, 0.4)',
    vex_execute: 'rgba(100, 0, 0, 0.6)',
    // Gorath - earthy browns
    gorath_slam: 'rgba(139, 69, 19, 0.5)',
    gorath_taunt: 'rgba(139, 69, 19, 0.4)',
    gorath_earthquake: 'rgba(139, 90, 43, 0.5)',
  };

  // Duration based on ability type
  let duration = 250; // Default
  if (abilityDef.shape === 'cone') {
    duration = 250;
  } else if (abilityDef.targetType === 'skillshot' || abilityDef.shape === 'line') {
    duration = 200;
  } else if (abilityDef.aoeRadius && abilityDef.aoeRadius > 200) {
    duration = 400; // Larger AoE = longer visual
  } else if (abilityDef.targetType === 'target_enemy') {
    duration = 300;
  }

  return {
    color: colorOverrides[abilityId] || baseColor,
    duration,
  };
}
