/**
 * Instances of running effects, kept by VFXManager between frames: the
 * scheduled effect list and the effects attached to an entity or the screen.
 */

import type { VFXEffectConfig } from '../VFXTypes';

/**
 * Active effect instance - tracks a running VFX.
 */
export interface ActiveEffect {
  /** Unique ID for this effect instance */
  id: string;
  /** Ability ID this effect is for */
  abilityId: string;
  /** Effect configuration */
  config: VFXEffectConfig;
  /** World position X */
  x: number;
  /** World position Y */
  y: number;
  /** Target position (for directional effects) */
  targetX?: number;
  targetY?: number;
  /** When this effect starts (later than the cast for delayed phases) */
  startTime: number;
  /**
   * Whether its one-shot parts (particles, trails, shields, orbits,
   * afterimages, screen flash) have been created. They are created when the
   * effect starts, not when it's scheduled.
   */
  started: boolean;
  /** Duration of this effect */
  duration: number;
  /** Entity ID of caster */
  casterId?: string;
  /** Current phase progress (0-1) */
  progress: number;
}

/**
 * Trail point for trail effects.
 */
export interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

/**
 * Active trail effect.
 */
export interface ActiveTrail {
  id: string;
  entityId: string;
  color: string;
  thickness: number;
  fadeLength: number;
  points: TrailPoint[];
  duration: number;
  startTime: number;
}

/**
 * Active shield bubble effect.
 */
export interface ActiveShieldBubble {
  id: string;
  entityId: string;
  /** The ability it's for: once the entity has a shield from it, the bubble ends with that shield */
  sourceId: string;
  /** Whether that shield has shown up in the entity's state */
  shieldSeen: boolean;
  color: string;
  radius: number;
  duration: number;
  startTime: number;
  pulseSpeed?: number;
  hexagonal?: boolean;
  style?: 'hex' | 'plates' | 'holy' | 'stone';
  glowColor?: string;
}

/**
 * Active orbiting particles effect.
 */
export interface ActiveOrbitingParticles {
  id: string;
  entityId: string;
  color: string;
  size: number;
  orbitRadius: number;
  orbitSpeed: number;
  count: number;
  duration: number;
  startTime: number;
  style?: 'mote' | 'rock' | 'blade' | 'wisp';
  particles: Array<{ angle: number }>;
}

/**
 * Screen flash state.
 */
export interface ScreenFlashState {
  color: string;
  duration: number;
  maxAlpha: number;
  startTime: number;
}

/**
 * Dash afterimage state.
 */
export interface DashAfterimage {
  x: number;
  y: number;
  alpha: number;
  color: string;
}

/**
 * Active dash afterimage effect.
 */
export interface ActiveDashAfterimage {
  id: string;
  entityId: string;
  color: string;
  images: DashAfterimage[];
  fadeSpeed: number;
  duration: number;
  startTime: number;
  lastImageTime: number;
  imageInterval: number;
}
