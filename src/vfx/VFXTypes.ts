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
  | 'dash_afterimage'
  | 'ground_light'
  | 'decal'
  | 'lightning'
  | 'swirl'
  | 'spikes'
  | 'rays'
  | 'meteor'
  | 'cut'
  | 'screen_shake';

/**
 * How a particle looks. Flames burn away into smoke, smoke is a puff that
 * covers instead of glowing, embers are small flickering lights. Dark
 * colors (blood, mud) are drawn as puffs too, whatever the type. On the
 * GPU: rocks are tumbling chunks of stone, crystals tumbling shards of
 * light, petals petals of light turning over, leaves solid ones, wisps soul
 * flames flying where they head.
 */
export type VFXParticleType =
  | 'circle' | 'square' | 'star' | 'spark' | 'flame' | 'smoke' | 'ember'
  | 'rock' | 'crystal' | 'petal' | 'leaf' | 'wisp';

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
  particleType?: VFXParticleType;
  glowIntensity?: number;
  /** Start on a ring this far out and fly in to the anchor over their lifetime (gathering power) */
  fromRadius?: number;
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
  /** 'telegraph': a warning on the ground filling up over the effect's life */
  style?: 'slash' | 'telegraph';
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
  /** On the GPU: a magic circle (default) or a warning filling up over the effect's life */
  style?: 'sigil' | 'telegraph';
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
  /** A pillar falling from this high above the anchor instead of a beam to the target */
  fromSky?: number;
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
  particleType?: VFXParticleType;
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
  particleType?: VFXParticleType;
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
  /** On the GPU: motes of light (default), rocks, spinning blades or soul flames */
  style?: 'mote' | 'rock' | 'blade' | 'wisp';
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
  /** On the GPU: hexagons (default), circling steel plates, petals of light, or a ring of stones */
  style?: 'hex' | 'plates' | 'holy' | 'stone';
  /** The light in a stone shield's cracks */
  glowColor?: string;
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
 * A pool of light on the ground, fading in and out (GPU only).
 */
export interface GroundLightConfig {
  type: 'ground_light';
  color: string;
  radius: number;
  intensity: number;
  duration: number;
  /** How much it wavers, 0-1 */
  flicker?: number;
}

/**
 * A scorch or crack mark left on the ground (GPU only).
 */
export interface DecalConfig {
  type: 'decal';
  color: string;
  radius: number;
  duration: number;
  /** Glow in the cracks, 0-1 */
  embers?: number;
  opacity?: number;
}

/**
 * Bolts of lightning from the anchor to the target (GPU only).
 */
export interface LightningConfig {
  type: 'lightning';
  color: string;
  count: number;
  /** How far the bolts wander off the line */
  spread: number;
  thickness: number;
  duration: number;
}

/**
 * A spinning vortex (GPU only).
 */
export interface SwirlConfig {
  type: 'swirl';
  color: string;
  radius: number;
  duration: number;
  /** Turns per second-ish */
  spin?: number;
  arms?: number;
}

/**
 * Spikes bursting out of the ground and sinking back (GPU only): rocks,
 * crystals of light, thorny roots or geysers of lava, in a ring around the
 * anchor, scattered over a circle, or along lines running out from the
 * anchor (fissures, rising one after another outward).
 */
export interface SpikesConfig {
  type: 'spikes';
  style: 'rock' | 'crystal' | 'thorn' | 'geyser';
  color: string;
  /** Rocks: the glow at their base. Thorns: their veins */
  glowColor?: string;
  count: number;
  /** The ring's radius, or the circle they're scattered over */
  radius: number;
  pattern: 'ring' | 'area' | 'lines';
  /** How many lines for the 'lines' pattern (default 5) */
  lines?: number;
  length: { min: number; max: number };
  duration: number;
}

/**
 * The camera shakes (the shake decays over `duration`; `intensity` is the
 * largest offset in world units).
 */
export interface ScreenShakeConfig {
  type: 'screen_shake';
  intensity: number;
  duration: number;
}

/**
 * Rays of light bursting out from the anchor, or (`converge`) gathering
 * into it (GPU only).
 */
export interface RaysConfig {
  type: 'rays';
  color: string;
  radius: number;
  duration: number;
  count?: number;
  spin?: number;
  converge?: boolean;
}

/**
 * Something falling from the sky onto the anchor over `duration` (GPU
 * only): a flaming rock with a trail, or a blade of light.
 */
export interface MeteorConfig {
  type: 'meteor';
  style: 'fire' | 'blade';
  color: string;
  colorSecondary?: string;
  size: number;
  /** How high above the anchor it starts */
  height: number;
  duration: number;
}

/**
 * Straight cuts of light (GPU only): across the anchor at `angles` from
 * the aim (an X with two), or with `path` from the caster's start to the
 * target (a dash).
 */
export interface CutConfig {
  type: 'cut';
  color: string;
  length: number;
  width: number;
  duration: number;
  angles?: number[];
  path?: boolean;
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
  | DashAfterimageConfig
  | GroundLightConfig
  | DecalConfig
  | LightningConfig
  | SwirlConfig
  | SpikesConfig
  | RaysConfig
  | MeteorConfig
  | CutConfig
  | ScreenShakeConfig;

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
