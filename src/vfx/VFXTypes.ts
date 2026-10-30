/**
 * VFXTypes - Type definitions for ability VFX: phases, effect types and the
 * configuration of each effect.
 */

/**
 * VFX Effect Phase - timing within an ability cast.
 */
export interface VFXPhase {
  /** Phase name for debugging */
  name: string;
  /** Delay before this phase starts (seconds) */
  delay: number;
  /** Duration of this phase (seconds) */
  duration: number;
  /** Effect type to spawn */
  effect: VFXEffectType;
}

/**
 * VFX Effect Type - what kind of visual to create.
 */
export type VFXEffectType =
  | 'particle_burst'
  | 'expanding_ring'
  | 'cone_slash'
  | 'ground_circle'
  | 'trail'
  | 'beam'
  | 'shockwave'
  | 'screen_flash'
  | 'rising_particles'
  | 'falling_particles'
  | 'orbiting_particles'
  | 'shield_bubble'
  | 'dash_afterimage';

/**
 * Configuration for a particle burst effect.
 */
export interface ParticleBurstConfig {
  type: 'particle_burst';
  count: number;
  color: string;
  colorSecondary?: string;
  size: { min: number; max: number };
  speed: { min: number; max: number };
  lifetime: { min: number; max: number };
  spread: number; // Angle spread in radians (Math.PI * 2 for full circle)
  direction?: number; // Base direction in radians (0 = right)
  gravity?: number;
  friction?: number;
  particleType?: 'circle' | 'square' | 'star' | 'spark';
  glowIntensity?: number;
}

/**
 * Configuration for an expanding ring effect.
 */
export interface ExpandingRingConfig {
  type: 'expanding_ring';
  color: string;
  startRadius: number;
  endRadius: number;
  thickness: number;
  duration: number;
  fadeOut?: boolean;
}

/**
 * Configuration for a cone slash effect.
 */
export interface ConeSlashConfig {
  type: 'cone_slash';
  color: string;
  radius: number;
  arcAngle: number; // In radians
  duration: number;
  innerRadius?: number;
  fadeOut?: boolean;
  sparkCount?: number;
  sparkColor?: string;
}

/**
 * Configuration for a ground circle effect.
 */
export interface GroundCircleConfig {
  type: 'ground_circle';
  color: string;
  fillColor?: string;
  radius: number;
  duration: number;
  dashed?: boolean;
  pulseSpeed?: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
}

/**
 * Configuration for a trail effect.
 */
export interface TrailConfig {
  type: 'trail';
  color: string;
  thickness: number;
  duration: number;
  fadeLength: number;
}

/**
 * Configuration for a beam effect.
 */
export interface BeamConfig {
  type: 'beam';
  color: string;
  colorSecondary?: string;
  thickness: number;
  duration: number;
  glowRadius?: number;
}

/**
 * Configuration for a shockwave effect.
 */
export interface ShockwaveConfig {
  type: 'shockwave';
  color: string;
  startRadius: number;
  endRadius: number;
  thickness: number;
  duration: number;
}

/**
 * Configuration for a screen flash effect.
 */
export interface ScreenFlashConfig {
  type: 'screen_flash';
  color: string;
  duration: number;
  maxAlpha: number;
}

/**
 * Configuration for rising particles.
 */
export interface RisingParticlesConfig {
  type: 'rising_particles';
  count: number;
  color: string;
  size: { min: number; max: number };
  speed: { min: number; max: number };
  spread: number; // Horizontal spread
  lifetime: { min: number; max: number };
  particleType?: 'circle' | 'square' | 'star' | 'spark';
}

/**
 * Configuration for falling particles (rain, debris).
 */
export interface FallingParticlesConfig {
  type: 'falling_particles';
  count: number;
  color: string;
  size: { min: number; max: number };
  speed: { min: number; max: number };
  spread: number;
  lifetime: { min: number; max: number };
  particleType?: 'circle' | 'square' | 'spark';
}

/**
 * Configuration for orbiting particles.
 */
export interface OrbitingParticlesConfig {
  type: 'orbiting_particles';
  count: number;
  color: string;
  size: number;
  orbitRadius: number;
  orbitSpeed: number; // Radians per second
  duration: number;
}

/**
 * Configuration for shield bubble.
 */
export interface ShieldBubbleConfig {
  type: 'shield_bubble';
  color: string;
  radius: number;
  duration: number;
  pulseSpeed?: number;
  hexagonal?: boolean;
}

/**
 * Configuration for dash afterimage.
 */
export interface DashAfterimageConfig {
  type: 'dash_afterimage';
  color: string;
  imageCount: number;
  fadeSpeed: number;
  duration: number;
}

/**
 * Union type for all effect configs.
 */
export type VFXEffectConfig =
  | ParticleBurstConfig
  | ExpandingRingConfig
  | ConeSlashConfig
  | GroundCircleConfig
  | TrailConfig
  | BeamConfig
  | ShockwaveConfig
  | ScreenFlashConfig
  | RisingParticlesConfig
  | FallingParticlesConfig
  | OrbitingParticlesConfig
  | ShieldBubbleConfig
  | DashAfterimageConfig;

/**
 * Complete VFX definition for an ability.
 */
export interface AbilityVFXDefinition {
  /** Ability ID this applies to */
  abilityId: string;
  /** Phases of the VFX (cast, travel, impact, etc.) */
  phases: Array<{
    name: string;
    delay: number;
    duration: number;
    effects: VFXEffectConfig[];
    /** Where to spawn: 'caster', 'target', 'projectile' */
    anchor: 'caster' | 'target' | 'ground_target';
  }>;
}
