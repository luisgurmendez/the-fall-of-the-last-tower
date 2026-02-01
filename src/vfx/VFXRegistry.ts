/**
 * VFXRegistry - Maps ability IDs to VFX configurations.
 *
 * Defines visual effects for all champion abilities including:
 * - Particle colors and counts
 * - Effect durations and timings
 * - Shape types and parameters
 */

/**
 * Champion color palettes.
 */
export const CHAMPION_COLORS = {
  elara: {
    primary: '#FFD700', // Gold
    secondary: '#FFFFFF', // White
    accent: '#FFF9C4', // Soft Yellow
  },
  gorath: {
    primary: '#8B7355', // Brown
    secondary: '#708090', // Stone Gray
    accent: '#FF8C00', // Orange
  },
  lume: {
    primary: '#FFE566', // Warm Gold
    secondary: '#FFF9E0', // Soft Yellow
    accent: '#FFFFFF', // White
  },
  magnus: {
    primary: '#FF6600', // Fire Orange
    secondary: '#CC3300', // Deep Red
    accent: '#FFDD44', // Yellow Core
  },
  vex: {
    primary: '#8844CC', // Purple
    secondary: '#442266', // Dark Purple
    accent: '#2C3E50', // Shadow
  },
  vile: {
    primary: '#4A0080', // Dark Purple
    secondary: '#1A3A1A', // Green-Black
    accent: '#00FFFF', // Soul Cyan
  },
  warrior: {
    primary: '#4682B4', // Steel Blue
    secondary: '#DAA520', // Gold
    accent: '#708090', // Iron Gray
  },
} as const;

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

/**
 * VFX Registry - stores all ability VFX definitions.
 */
const vfxRegistry: Map<string, AbilityVFXDefinition> = new Map();

/**
 * Register VFX for an ability.
 */
export function registerAbilityVFX(definition: AbilityVFXDefinition): void {
  vfxRegistry.set(definition.abilityId, definition);
}

/**
 * Get VFX definition for an ability.
 */
export function getAbilityVFX(
  abilityId: string
): AbilityVFXDefinition | undefined {
  return vfxRegistry.get(abilityId);
}

// ============================================
// WARRIOR VFX DEFINITIONS
// ============================================

registerAbilityVFX({
  abilityId: 'warrior_slash',
  phases: [
    {
      name: 'swing',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'cone_slash',
          color: 'rgba(255, 165, 0, 0.6)',
          radius: 100,
          arcAngle: Math.PI / 2, // 90 degrees
          duration: 0.2,
          sparkCount: 8,
          sparkColor: CHAMPION_COLORS.warrior.secondary,
        },
      ],
    },
    {
      name: 'impact',
      delay: 0.15,
      duration: 0.2,
      anchor: 'target',
      effects: [
        {
          type: 'particle_burst',
          count: 6,
          color: '#FFFFFF',
          size: { min: 2, max: 4 },
          speed: { min: 50, max: 100 },
          lifetime: { min: 0.15, max: 0.25 },
          spread: Math.PI * 2,
          particleType: 'spark',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'warrior_iron_will',
  phases: [
    {
      name: 'activate',
      delay: 0,
      duration: 0.15,
      anchor: 'caster',
      effects: [
        {
          type: 'shield_bubble',
          color: CHAMPION_COLORS.warrior.primary,
          radius: 30,
          duration: 3.0,
        },
        {
          type: 'particle_burst',
          count: 12,
          color: CHAMPION_COLORS.warrior.accent,
          size: { min: 3, max: 5 },
          speed: { min: 30, max: 60 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'square',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'warrior_charge',
  phases: [
    {
      name: 'dash',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'dash_afterimage',
          color: CHAMPION_COLORS.warrior.primary,
          imageCount: 5,
          fadeSpeed: 0.8,
          duration: 0.3,
        },
        {
          type: 'trail',
          color: CHAMPION_COLORS.warrior.accent,
          thickness: 4,
          duration: 0.3,
          fadeLength: 60,
        },
      ],
    },
    {
      name: 'hit',
      delay: 0.25,
      duration: 0.2,
      anchor: 'target',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.warrior.secondary,
          startRadius: 10,
          endRadius: 40,
          thickness: 8,
          duration: 0.2,
        },
        {
          type: 'particle_burst',
          count: 8,
          color: '#87CEEB', // Ice blue for slow
          size: { min: 3, max: 5 },
          speed: { min: 40, max: 80 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'warrior_heroic_strike',
  phases: [
    {
      name: 'leap',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.warrior.secondary,
          thickness: 6,
          duration: 0.3,
          fadeLength: 80,
        },
      ],
    },
    {
      name: 'impact',
      delay: 0.25,
      duration: 0.3,
      anchor: 'ground_target',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.warrior.primary,
          startRadius: 20,
          endRadius: 80,
          thickness: 12,
          duration: 0.3,
        },
        {
          type: 'particle_burst',
          count: 20,
          color: CHAMPION_COLORS.warrior.accent,
          size: { min: 3, max: 6 },
          speed: { min: 80, max: 150 },
          lifetime: { min: 0.4, max: 0.6 },
          spread: Math.PI * 2,
          particleType: 'square',
          gravity: 200,
        },
        {
          type: 'rising_particles',
          count: 6,
          color: '#FFD700', // Stun stars
          size: { min: 4, max: 6 },
          speed: { min: 20, max: 40 },
          spread: 30,
          lifetime: { min: 0.5, max: 0.8 },
          particleType: 'star',
        },
      ],
    },
  ],
});

// ============================================
// MAGNUS VFX DEFINITIONS
// ============================================

registerAbilityVFX({
  abilityId: 'magnus_fireball',
  phases: [
    {
      name: 'travel',
      delay: 0,
      duration: 1.0,
      anchor: 'caster', // Will follow projectile
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.magnus.primary,
          thickness: 8,
          duration: 1.0,
          fadeLength: 40,
        },
        {
          type: 'particle_burst',
          count: 3,
          color: CHAMPION_COLORS.magnus.secondary,
          size: { min: 2, max: 4 },
          speed: { min: 20, max: 40 },
          lifetime: { min: 0.2, max: 0.4 },
          spread: Math.PI,
          direction: Math.PI, // Behind projectile
          particleType: 'circle',
        },
      ],
    },
    {
      name: 'impact',
      delay: 0,
      duration: 0.3,
      anchor: 'target',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.magnus.primary,
          startRadius: 10,
          endRadius: 50,
          thickness: 6,
          duration: 0.25,
        },
        {
          type: 'particle_burst',
          count: 15,
          color: CHAMPION_COLORS.magnus.primary,
          colorSecondary: CHAMPION_COLORS.magnus.accent,
          size: { min: 3, max: 6 },
          speed: { min: 80, max: 140 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'spark',
          gravity: 100,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'magnus_barrier',
  phases: [
    {
      name: 'activate',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'shield_bubble',
          color: '#9370DB', // Purple
          radius: 35,
          duration: 4.0,
          pulseSpeed: 2,
        },
        {
          type: 'particle_burst',
          count: 16,
          color: '#DDA0DD', // Plum
          size: { min: 2, max: 4 },
          speed: { min: 40, max: 70 },
          lifetime: { min: 0.4, max: 0.6 },
          spread: Math.PI * 2,
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'magnus_quagmire',
  phases: [
    {
      name: 'appear',
      delay: 0,
      duration: 0.2,
      anchor: 'ground_target',
      effects: [
        {
          type: 'particle_burst',
          count: 12,
          color: '#8B4513', // Brown
          size: { min: 4, max: 8 },
          speed: { min: 60, max: 100 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          direction: -Math.PI / 2, // Upward
          gravity: 300,
          particleType: 'circle',
        },
      ],
    },
    {
      name: 'active',
      delay: 0.15,
      duration: 2.0,
      anchor: 'ground_target',
      effects: [
        {
          type: 'ground_circle',
          color: '#5D4037', // Dark brown
          fillColor: 'rgba(139, 69, 19, 0.4)',
          radius: 150,
          duration: 2.0,
          pulseSpeed: 1,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'magnus_inferno',
  phases: [
    {
      name: 'summon',
      delay: 0,
      duration: 0.3,
      anchor: 'ground_target',
      effects: [
        {
          type: 'falling_particles',
          count: 20,
          color: CHAMPION_COLORS.magnus.primary,
          size: { min: 4, max: 8 },
          speed: { min: 100, max: 180 },
          spread: 200,
          lifetime: { min: 0.3, max: 0.5 },
          particleType: 'spark',
        },
      ],
    },
    {
      name: 'active',
      delay: 0.2,
      duration: 5.0,
      anchor: 'ground_target',
      effects: [
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.magnus.secondary,
          fillColor: 'rgba(255, 102, 0, 0.3)',
          radius: 200,
          duration: 5.0,
        },
        {
          type: 'rising_particles',
          count: 8,
          color: CHAMPION_COLORS.magnus.primary,
          size: { min: 3, max: 6 },
          speed: { min: 40, max: 80 },
          spread: 180,
          lifetime: { min: 0.5, max: 1.0 },
          particleType: 'spark',
        },
      ],
    },
  ],
});

// ============================================
// ELARA VFX DEFINITIONS
// ============================================

registerAbilityVFX({
  abilityId: 'elara_heal',
  phases: [
    {
      name: 'cast',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 8,
          color: CHAMPION_COLORS.elara.primary,
          size: { min: 3, max: 5 },
          speed: { min: 20, max: 40 },
          lifetime: { min: 0.2, max: 0.3 },
          spread: Math.PI / 2,
          direction: 0,
          particleType: 'star',
          glowIntensity: 1.5,
        },
      ],
    },
    {
      name: 'impact',
      delay: 0.1,
      duration: 0.5,
      anchor: 'target',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.elara.primary,
          startRadius: 0,
          endRadius: 60,
          thickness: 4,
          duration: 0.4,
        },
        {
          type: 'rising_particles',
          count: 10,
          color: CHAMPION_COLORS.elara.accent,
          size: { min: 2, max: 4 },
          speed: { min: 30, max: 60 },
          spread: 30,
          lifetime: { min: 0.4, max: 0.7 },
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'elara_barrier',
  phases: [
    {
      name: 'cast',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.elara.primary,
          startRadius: 20,
          endRadius: 40,
          thickness: 3,
          duration: 0.2,
        },
      ],
    },
    {
      name: 'active',
      delay: 0.15,
      duration: 2.5,
      anchor: 'target',
      effects: [
        {
          type: 'shield_bubble',
          color: CHAMPION_COLORS.elara.primary,
          radius: 28,
          duration: 2.5,
          pulseSpeed: 3,
          hexagonal: true,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'elara_swift_grace',
  phases: [
    {
      name: 'cast',
      delay: 0,
      duration: 0.15,
      anchor: 'caster',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.elara.primary,
          startRadius: 10,
          endRadius: 200,
          thickness: 4,
          duration: 0.4,
        },
      ],
    },
    {
      name: 'active',
      delay: 0.1,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.elara.primary,
          fillColor: 'rgba(255, 215, 0, 0.15)',
          radius: 200,
          duration: 0.5,
          dashed: true,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'elara_divine_intervention',
  phases: [
    {
      name: 'windup',
      delay: 0,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'rising_particles',
          count: 20,
          color: CHAMPION_COLORS.elara.secondary,
          size: { min: 2, max: 4 },
          speed: { min: 80, max: 120 },
          spread: 40,
          lifetime: { min: 0.4, max: 0.6 },
          particleType: 'star',
        },
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.elara.primary,
          radius: 300,
          duration: 0.5,
          fadeIn: true,
        },
      ],
    },
    {
      name: 'burst',
      delay: 0.45,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.elara.secondary,
          startRadius: 20,
          endRadius: 320,
          thickness: 20,
          duration: 0.3,
        },
        {
          type: 'screen_flash',
          color: CHAMPION_COLORS.elara.secondary,
          duration: 0.15,
          maxAlpha: 0.3,
        },
      ],
    },
    {
      name: 'heal',
      delay: 0.5,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'rising_particles',
          count: 30,
          color: CHAMPION_COLORS.elara.primary,
          size: { min: 3, max: 6 },
          speed: { min: 40, max: 80 },
          spread: 280,
          lifetime: { min: 0.5, max: 0.8 },
          particleType: 'star',
        },
      ],
    },
  ],
});

// ============================================
// GORATH VFX DEFINITIONS
// ============================================

registerAbilityVFX({
  abilityId: 'gorath_slam',
  phases: [
    {
      name: 'windup',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 6,
          color: CHAMPION_COLORS.gorath.primary,
          size: { min: 2, max: 4 },
          speed: { min: 10, max: 30 },
          lifetime: { min: 0.2, max: 0.3 },
          spread: Math.PI * 2,
          particleType: 'square',
        },
      ],
    },
    {
      name: 'impact',
      delay: 0.25,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.gorath.primary,
          startRadius: 20,
          endRadius: 150,
          thickness: 10,
          duration: 0.2,
        },
        {
          type: 'particle_burst',
          count: 16,
          color: CHAMPION_COLORS.gorath.secondary,
          size: { min: 4, max: 8 },
          speed: { min: 100, max: 180 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'square',
          gravity: 400,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'gorath_fortify',
  phases: [
    {
      name: 'activate',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'shield_bubble',
          color: CHAMPION_COLORS.gorath.primary,
          radius: 32,
          duration: 4.0,
        },
        {
          type: 'orbiting_particles',
          count: 4,
          color: CHAMPION_COLORS.gorath.secondary,
          size: 6,
          orbitRadius: 40,
          orbitSpeed: 2,
          duration: 4.0,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'gorath_taunt',
  phases: [
    {
      name: 'roar',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.gorath.accent,
          startRadius: 30,
          endRadius: 200,
          thickness: 8,
          duration: 0.3,
        },
        {
          type: 'expanding_ring',
          color: 'rgba(255, 140, 0, 0.5)',
          startRadius: 40,
          endRadius: 180,
          thickness: 3,
          duration: 0.25,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'gorath_earthquake',
  phases: [
    {
      name: 'windup',
      delay: 0,
      duration: 0.5,
      anchor: 'ground_target',
      effects: [
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.gorath.accent,
          radius: 250,
          duration: 0.5,
          pulseSpeed: 4,
        },
      ],
    },
    {
      name: 'eruption',
      delay: 0.45,
      duration: 0.3,
      anchor: 'ground_target',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.gorath.primary,
          startRadius: 30,
          endRadius: 260,
          thickness: 15,
          duration: 0.3,
        },
        {
          type: 'particle_burst',
          count: 30,
          color: CHAMPION_COLORS.gorath.secondary,
          size: { min: 5, max: 10 },
          speed: { min: 120, max: 220 },
          lifetime: { min: 0.5, max: 0.8 },
          spread: Math.PI * 2,
          particleType: 'square',
          gravity: 500,
        },
      ],
    },
  ],
});

// ============================================
// VEX VFX DEFINITIONS
// ============================================

registerAbilityVFX({
  abilityId: 'vex_shuriken',
  phases: [
    {
      name: 'travel',
      delay: 0,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.vex.primary,
          thickness: 4,
          duration: 0.5,
          fadeLength: 30,
        },
      ],
    },
    {
      name: 'hit',
      delay: 0,
      duration: 0.2,
      anchor: 'target',
      effects: [
        {
          type: 'particle_burst',
          count: 8,
          color: CHAMPION_COLORS.vex.primary,
          size: { min: 2, max: 4 },
          speed: { min: 40, max: 80 },
          lifetime: { min: 0.2, max: 0.3 },
          spread: Math.PI * 2,
          particleType: 'spark',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vex_shroud',
  phases: [
    {
      name: 'activate',
      delay: 0,
      duration: 0.15,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 12,
          color: CHAMPION_COLORS.vex.secondary,
          size: { min: 4, max: 8 },
          speed: { min: 60, max: 100 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'circle',
        },
      ],
    },
    {
      name: 'active',
      delay: 0.1,
      duration: 1.5,
      anchor: 'caster',
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.vex.accent,
          thickness: 3,
          duration: 1.5,
          fadeLength: 20,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vex_dash',
  phases: [
    {
      name: 'dash',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        // Sprite-based afterimages are handled by EntityRenderer
        // Just use a subtle trail effect here
        {
          type: 'trail',
          color: CHAMPION_COLORS.vex.primary,
          thickness: 4,
          duration: 0.3,
          fadeLength: 40,
        },
      ],
    },
    {
      name: 'arrive',
      delay: 0.25,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 10,
          color: CHAMPION_COLORS.vex.primary,
          size: { min: 3, max: 5 },
          speed: { min: 50, max: 90 },
          lifetime: { min: 0.2, max: 0.35 },
          spread: Math.PI * 2,
          particleType: 'spark',
          glowIntensity: 1.2,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vex_ninja_mode',
  phases: [
    // Activation burst
    {
      name: 'activate',
      delay: 0,
      duration: 0.4,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: '#9933FF', // Violet
          startRadius: 10,
          endRadius: 60,
          thickness: 8,
          duration: 0.35,
        },
        {
          type: 'particle_burst',
          count: 20,
          color: '#BB66FF', // Bright violet
          colorSecondary: CHAMPION_COLORS.vex.primary,
          size: { min: 4, max: 7 },
          speed: { min: 80, max: 140 },
          lifetime: { min: 0.4, max: 0.6 },
          spread: Math.PI * 2,
          particleType: 'spark',
          glowIntensity: 1.5,
        },
        {
          type: 'rising_particles',
          count: 12,
          color: '#9933FF', // Violet
          size: { min: 3, max: 5 },
          speed: { min: 60, max: 100 },
          spread: 40,
          lifetime: { min: 0.5, max: 0.8 },
          particleType: 'star',
        },
      ],
    },
    // Ongoing aura effect (violet particles emanating from Vex)
    {
      name: 'aura',
      delay: 0.3,
      duration: 15.0, // Full Ninja Mode duration
      anchor: 'caster',
      effects: [
        {
          type: 'orbiting_particles',
          count: 6,
          color: '#9933FF', // Violet
          size: 4,
          orbitRadius: 35,
          orbitSpeed: 3,
          duration: 15.0,
        },
        {
          type: 'rising_particles',
          count: 4,
          color: '#BB66FF', // Bright violet
          size: { min: 2, max: 4 },
          speed: { min: 30, max: 50 },
          spread: 25,
          lifetime: { min: 0.6, max: 1.0 },
          particleType: 'spark',
        },
      ],
    },
  ],
});

// ============================================
// LUME VFX DEFINITIONS
// ============================================

registerAbilityVFX({
  abilityId: 'lume_send_light',
  phases: [
    {
      name: 'cast',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 6,
          color: CHAMPION_COLORS.lume.primary,
          size: { min: 3, max: 5 },
          speed: { min: 40, max: 70 },
          lifetime: { min: 0.2, max: 0.3 },
          spread: Math.PI / 3,
          particleType: 'star',
          glowIntensity: 1.5,
        },
      ],
    },
    {
      name: 'arrive',
      delay: 0.2,
      duration: 0.3,
      anchor: 'ground_target',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.lume.primary,
          startRadius: 5,
          endRadius: 35,
          thickness: 3,
          duration: 0.25,
        },
        {
          type: 'particle_burst',
          count: 8,
          color: CHAMPION_COLORS.lume.accent,
          size: { min: 2, max: 4 },
          speed: { min: 50, max: 90 },
          lifetime: { min: 0.25, max: 0.4 },
          spread: Math.PI * 2,
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'lume_warmth',
  phases: [
    {
      name: 'pulse',
      delay: 0,
      duration: 0.3,
      anchor: 'caster', // From orb position
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.lume.primary,
          startRadius: 10,
          endRadius: 180,
          thickness: 4,
          duration: 0.3,
        },
      ],
    },
    {
      name: 'effect',
      delay: 0.15,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'rising_particles',
          count: 12,
          color: '#90EE90', // Green for heal
          size: { min: 2, max: 4 },
          speed: { min: 30, max: 50 },
          spread: 160,
          lifetime: { min: 0.3, max: 0.5 },
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'lume_dazzle_step',
  phases: [
    {
      name: 'dash',
      delay: 0,
      duration: 0.25,
      anchor: 'caster',
      effects: [
        {
          type: 'dash_afterimage',
          color: CHAMPION_COLORS.lume.primary,
          imageCount: 5,
          fadeSpeed: 0.85,
          duration: 0.25,
        },
        {
          type: 'trail',
          color: CHAMPION_COLORS.lume.accent,
          thickness: 5,
          duration: 0.25,
          fadeLength: 60,
        },
      ],
    },
    {
      name: 'arrive',
      delay: 0.2,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.lume.secondary,
          startRadius: 20,
          endRadius: 100,
          thickness: 5,
          duration: 0.25,
        },
        {
          type: 'screen_flash',
          color: CHAMPION_COLORS.lume.accent,
          duration: 0.1,
          maxAlpha: 0.2,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'lume_r',
  phases: [
    // Phase 1: Charge - energy gathering inward
    {
      name: 'charge',
      delay: 0,
      duration: 0.5,
      anchor: 'target',
      effects: [
        // Pulsing ground indicator
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.lume.primary,
          radius: 220,
          duration: 0.5,
          fadeIn: true,
          pulseSpeed: 6,
        },
        // First wave of inward particles (gold)
        {
          type: 'particle_burst',
          count: 25,
          color: CHAMPION_COLORS.lume.primary,
          size: { min: 3, max: 5 },
          speed: { min: -120, max: -60 },
          lifetime: { min: 0.4, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'star',
          glowIntensity: 1.5,
        },
        // Second wave of inward particles (white/bright)
        {
          type: 'particle_burst',
          count: 15,
          color: CHAMPION_COLORS.lume.accent,
          size: { min: 2, max: 4 },
          speed: { min: -100, max: -50 },
          lifetime: { min: 0.35, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'circle',
          glowIntensity: 2,
        },
      ],
    },
    // Phase 2: Core brightening just before explosion
    {
      name: 'core_brighten',
      delay: 0.35,
      duration: 0.15,
      anchor: 'target',
      effects: [
        // Bright core shrinking circle
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.lume.accent,
          startRadius: 60,
          endRadius: 20,
          thickness: 25,
          duration: 0.15,
          fadeOut: false,
        },
        // Final inward rush
        {
          type: 'particle_burst',
          count: 20,
          color: CHAMPION_COLORS.lume.accent,
          size: { min: 4, max: 6 },
          speed: { min: -200, max: -150 },
          lifetime: { min: 0.12, max: 0.15 },
          spread: Math.PI * 2,
          particleType: 'star',
          glowIntensity: 3,
        },
      ],
    },
    // Phase 3: Main explosion - multiple shockwaves
    {
      name: 'explosion_shockwaves',
      delay: 0.48,
      duration: 0.5,
      anchor: 'target',
      effects: [
        // Inner shockwave (fastest, brightest)
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.lume.accent,
          startRadius: 20,
          endRadius: 200,
          thickness: 25,
          duration: 0.3,
        },
        // Middle shockwave (gold)
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.lume.primary,
          startRadius: 15,
          endRadius: 260,
          thickness: 18,
          duration: 0.4,
        },
        // Outer shockwave (softer)
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.lume.secondary,
          startRadius: 10,
          endRadius: 320,
          thickness: 12,
          duration: 0.5,
        },
      ],
    },
    // Phase 4: Particle explosion bursts
    {
      name: 'explosion_particles',
      delay: 0.48,
      duration: 0.8,
      anchor: 'target',
      effects: [
        // Core flash particles (white, fast)
        {
          type: 'particle_burst',
          count: 30,
          color: CHAMPION_COLORS.lume.accent,
          size: { min: 5, max: 10 },
          speed: { min: 300, max: 450 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'star',
          glowIntensity: 3,
        },
        // Main explosion particles (gold stars)
        {
          type: 'particle_burst',
          count: 50,
          color: CHAMPION_COLORS.lume.primary,
          size: { min: 4, max: 8 },
          speed: { min: 150, max: 300 },
          lifetime: { min: 0.5, max: 0.9 },
          spread: Math.PI * 2,
          particleType: 'star',
          glowIntensity: 2,
        },
        // Slower trailing sparks
        {
          type: 'particle_burst',
          count: 35,
          color: CHAMPION_COLORS.lume.secondary,
          size: { min: 3, max: 6 },
          speed: { min: 80, max: 180 },
          lifetime: { min: 0.7, max: 1.2 },
          spread: Math.PI * 2,
          particleType: 'spark',
          gravity: 50,
          friction: 0.5,
        },
      ],
    },
    // Phase 5: Rising embers (float upward after explosion)
    {
      name: 'rising_embers',
      delay: 0.55,
      duration: 1.5,
      anchor: 'target',
      effects: [
        {
          type: 'rising_particles',
          count: 25,
          color: CHAMPION_COLORS.lume.primary,
          size: { min: 2, max: 5 },
          speed: { min: 40, max: 80 },
          lifetime: { min: 1.0, max: 1.5 },
          spread: 180,
          particleType: 'star',
        },
        {
          type: 'rising_particles',
          count: 15,
          color: CHAMPION_COLORS.lume.accent,
          size: { min: 2, max: 4 },
          speed: { min: 50, max: 100 },
          lifetime: { min: 0.8, max: 1.2 },
          spread: 120,
          particleType: 'circle',
        },
      ],
    },
    // Phase 6: Screen flash for impact
    {
      name: 'screen_impact',
      delay: 0.48,
      duration: 0.35,
      anchor: 'target',
      effects: [
        {
          type: 'screen_flash',
          color: CHAMPION_COLORS.lume.accent,
          duration: 0.35,
          maxAlpha: 0.55,
        },
      ],
    },
  ],
});

// ============================================
// VILE VFX DEFINITIONS
// ============================================

registerAbilityVFX({
  abilityId: 'vile_arrow',
  phases: [
    {
      name: 'travel',
      delay: 0,
      duration: 0.6,
      anchor: 'caster',
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.vile.primary,
          thickness: 4,
          duration: 0.6,
          fadeLength: 35,
        },
      ],
    },
    {
      name: 'hit',
      delay: 0,
      duration: 0.2,
      anchor: 'target',
      effects: [
        {
          type: 'particle_burst',
          count: 10,
          color: CHAMPION_COLORS.vile.primary,
          colorSecondary: CHAMPION_COLORS.vile.accent,
          size: { min: 3, max: 5 },
          speed: { min: 50, max: 90 },
          lifetime: { min: 0.2, max: 0.35 },
          spread: Math.PI * 2,
          particleType: 'spark',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vile_veil',
  phases: [
    {
      name: 'activate',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 16,
          color: CHAMPION_COLORS.vile.secondary,
          size: { min: 4, max: 7 },
          speed: { min: 50, max: 80 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'circle',
        },
      ],
    },
    {
      name: 'active',
      delay: 0.15,
      duration: 2.0,
      anchor: 'caster',
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.vile.primary,
          thickness: 4,
          duration: 2.0,
          fadeLength: 25,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vile_trap',
  phases: [
    {
      name: 'place',
      delay: 0,
      duration: 0.2,
      anchor: 'ground_target',
      effects: [
        {
          type: 'particle_burst',
          count: 8,
          color: CHAMPION_COLORS.vile.secondary,
          size: { min: 2, max: 4 },
          speed: { min: 20, max: 40 },
          lifetime: { min: 0.2, max: 0.35 },
          spread: Math.PI * 2,
          direction: Math.PI / 2, // Downward
          particleType: 'circle',
        },
      ],
    },
    {
      name: 'trigger',
      delay: 0,
      duration: 0.4,
      anchor: 'ground_target',
      effects: [
        {
          type: 'particle_burst',
          count: 15,
          color: CHAMPION_COLORS.vile.primary,
          size: { min: 3, max: 6 },
          speed: { min: 60, max: 100 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          direction: -Math.PI / 2, // Upward
          particleType: 'spark',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vile_restoration',
  phases: [
    {
      name: 'transform',
      delay: 0,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.vile.primary,
          startRadius: 20,
          endRadius: 100,
          thickness: 10,
          duration: 0.4,
        },
        {
          type: 'particle_burst',
          count: 25,
          color: CHAMPION_COLORS.vile.accent,
          size: { min: 3, max: 6 },
          speed: { min: 80, max: 140 },
          lifetime: { min: 0.4, max: 0.6 },
          spread: Math.PI * 2,
          particleType: 'spark',
        },
      ],
    },
    {
      name: 'active',
      delay: 0.4,
      duration: 10.0,
      anchor: 'caster',
      effects: [
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.vile.primary,
          radius: 80,
          duration: 10.0,
          pulseSpeed: 1.5,
        },
        {
          type: 'orbiting_particles',
          count: 6,
          color: CHAMPION_COLORS.vile.accent,
          size: 5,
          orbitRadius: 50,
          orbitSpeed: 1.5,
          duration: 10.0,
        },
      ],
    },
  ],
});

/**
 * Export all registered VFX for debugging.
 */
export function getAllRegisteredVFX(): string[] {
  return Array.from(vfxRegistry.keys());
}
