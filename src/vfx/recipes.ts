/**
 * Shorthands for the effect configs the VFX definitions layer (./champions/,
 * ./world.ts), so a definition reads as what it shows: sparks, flames,
 * smoke, a shockwave, light on the ground...
 *
 * Sizes are world units, times seconds. Each takes the few numbers that
 * vary and fills in the rest; spread the result and override for more.
 */

import type {
  AbilityVFXDefinition,
  BeamConfig,
  ConeSlashConfig,
  DecalConfig,
  ExpandingRingConfig,
  GroundCircleConfig,
  GroundLightConfig,
  LightningConfig,
  ParticleBurstConfig,
  RisingParticlesConfig,
  ShockwaveConfig,
  SwirlConfig,
  VFXEffectConfig,
} from './VFXTypes';

type Range = { min: number; max: number };
const range = (min: number, max: number): Range => ({ min, max });

type Phase = AbilityVFXDefinition['phases'][number];

/** A phase: effects spawned `delay` seconds after the cast, at the caster, the target or the ground target */
export function phase(name: string, delay: number, anchor: Phase['anchor'], effects: VFXEffectConfig[], duration = 0.5): Phase {
  return { name, delay, duration, anchor, effects };
}

/** Streaks flying out (all around, or within `spread` radians toward the target) */
export function sparks(color: string, count: number, speed: [number, number] = [150, 320], spread = Math.PI * 2, extra: Partial<ParticleBurstConfig> = {}): ParticleBurstConfig {
  return { type: 'particle_burst', count, color, size: range(2, 3.5), speed: range(...speed), lifetime: range(0.18, 0.35), spread, friction: 3, particleType: 'spark', ...extra };
}

/** Soft motes of light flying out and slowing down */
export function motes(color: string, count: number, speed: [number, number] = [40, 120], extra: Partial<ParticleBurstConfig> = {}): ParticleBurstConfig {
  return { type: 'particle_burst', count, color, size: range(2, 4), speed: range(...speed), lifetime: range(0.4, 0.8), spread: Math.PI * 2, friction: 2.5, particleType: 'circle', ...extra };
}

/** Four-pointed twinkles */
export function twinkles(color: string, count: number, speed: [number, number] = [30, 110], extra: Partial<ParticleBurstConfig> = {}): ParticleBurstConfig {
  return { type: 'particle_burst', count, color, size: range(3, 6), speed: range(...speed), lifetime: range(0.35, 0.7), spread: Math.PI * 2, friction: 2.5, particleType: 'star', ...extra };
}

/** Puffs of fire that burn away into smoke */
export function flames(color: string, count: number, size: [number, number] = [10, 18], speed: [number, number] = [40, 140], extra: Partial<ParticleBurstConfig> = {}): ParticleBurstConfig {
  return { type: 'particle_burst', count, color, size: range(...size), speed: range(...speed), lifetime: range(0.35, 0.6), spread: Math.PI * 2, friction: 3, gravity: -60, particleType: 'flame', ...extra };
}

/** Puffs of smoke or dust that cover instead of glowing */
export function smoke(color: string, count: number, size: [number, number] = [12, 22], speed: [number, number] = [30, 90], extra: Partial<ParticleBurstConfig> = {}): ParticleBurstConfig {
  return { type: 'particle_burst', count, color, size: range(...size), speed: range(...speed), lifetime: range(0.5, 0.9), spread: Math.PI * 2, friction: 2.5, gravity: -15, particleType: 'smoke', ...extra };
}

/** Chunks thrown up and falling back (dark ones are drawn as dust) */
export function debris(color: string, count: number, speed: [number, number] = [90, 200]): ParticleBurstConfig {
  return { type: 'particle_burst', count, color, size: range(2.5, 4.5), speed: range(...speed), lifetime: range(0.35, 0.6), spread: Math.PI * 2, direction: -Math.PI / 2, gravity: 420, friction: 1, particleType: 'square' };
}

/** Embers drifting up */
export function embers(color: string, count: number, spread = 40, extra: Partial<RisingParticlesConfig> = {}): RisingParticlesConfig {
  return { type: 'rising_particles', count, color, size: range(1.5, 3), speed: range(30, 80), spread, lifetime: range(0.6, 1.1), particleType: 'ember', ...extra };
}

/** A ring of light spreading from one radius to another */
export function ring(color: string, from: number, to: number, duration: number, thickness = 4): ExpandingRingConfig {
  return { type: 'expanding_ring', color, startRadius: from, endRadius: to, duration, thickness };
}

/** A shockwave: a thick broken ring with a wake, light on the ground and a crack under it */
export function shockwave(color: string, from: number, to: number, duration: number, thickness = 10): ShockwaveConfig {
  return { type: 'shockwave', color, startRadius: from, endRadius: to, duration, thickness };
}

/** A pool of light on the ground */
export function light(color: string, radius: number, intensity: number, duration: number, flicker = 0): GroundLightConfig {
  // Light adds to the ground's color, so it's kept soft
  return { type: 'ground_light', color, radius, intensity: intensity * 0.5, duration, flicker };
}

/** A scorch or crack mark that fades out; `embers` glow in its cracks */
export function scorch(color: string, radius: number, duration: number, embersGlow = 0, opacity = 1): DecalConfig {
  return { type: 'decal', color, radius, duration, embers: embersGlow, opacity };
}

/** A pillar of light falling from the sky onto the anchor */
export function pillar(color: string, height: number, thickness: number, duration: number, core?: string): BeamConfig {
  return { type: 'beam', color, colorSecondary: core, thickness, duration, fromSky: height };
}

/** A magic circle on the ground */
export function sigil(color: string, radius: number, duration: number, fill?: string): GroundCircleConfig {
  return { type: 'ground_circle', color, fillColor: fill, radius, duration, fadeIn: true, fadeOut: true };
}

/** A warning on the ground filling up over `duration` (a monster winding up an attack) */
export function warning(color: string, radius: number, duration: number): GroundCircleConfig {
  return { type: 'ground_circle', color, radius, duration, style: 'telegraph' };
}

/** A cone-shaped warning toward the target, filling up over `duration` */
export function coneWarning(color: string, radius: number, arcAngle: number, duration: number): ConeSlashConfig {
  return { type: 'cone_slash', color, radius, arcAngle, duration, style: 'telegraph' };
}

/** A crescent swept across `arcAngle` toward the target */
export function slash(color: string, radius: number, arcAngle: number, duration: number, thickness = radius * 0.45): ConeSlashConfig {
  return { type: 'cone_slash', color, radius, arcAngle, duration, innerRadius: radius - thickness };
}

/** A spinning vortex */
export function swirl(color: string, radius: number, duration: number, spin = 1, arms = 3): SwirlConfig {
  return { type: 'swirl', color, radius, duration, spin, arms };
}

/** Jagged bolts from the anchor to the target */
export function bolts(color: string, count: number, duration: number, spread = 22, thickness = 2.5): LightningConfig {
  return { type: 'lightning', color, count, duration, spread, thickness };
}
