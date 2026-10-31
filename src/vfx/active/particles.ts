/**
 * Pooled particles: bursts, rising and falling particles and death
 * particles. They are spawned into the shared particle pool, which keeps
 * them between frames, and moved and drawn from there.
 */

import type { VFXParticlePool, VFXParticle } from '../VFXParticlePool';
import type {
  ParticleBurstConfig,
  RisingParticlesConfig,
  FallingParticlesConfig,
} from '../VFXTypes';
import { drawParticle } from '../effects/VFXPrimitives';
import { fxColor, mixColor, type FXBatch, type RGB } from '@/gpu/fx/FXBatch';

/** Most particles a single effect spawns */
const MAX_PARTICLES_PER_EFFECT = 100;

/**
 * Spawn a burst of particles.
 */
export function spawnParticleBurst(
  pool: VFXParticlePool,
  config: ParticleBurstConfig,
  x: number,
  y: number,
  targetX?: number,
  targetY?: number
): void {
  // Calculate base direction toward target
  let baseDirection = config.direction ?? 0;
  if (targetX !== undefined && targetY !== undefined) {
    baseDirection = Math.atan2(targetY - y, targetX - x);
  }

  const count = Math.min(config.count, MAX_PARTICLES_PER_EFFECT);

  for (let i = 0; i < count; i++) {
    const particle = pool.acquire();
    if (!particle) break;

    // Random angle within spread
    const angleOffset = (Math.random() - 0.5) * config.spread;
    const angle = baseDirection + angleOffset;

    // Random speed
    const speed =
      config.speed.min + Math.random() * (config.speed.max - config.speed.min);

    // Random size
    const size =
      config.size.min + Math.random() * (config.size.max - config.size.min);

    // Random lifetime
    const lifetime =
      config.lifetime.min +
      Math.random() * (config.lifetime.max - config.lifetime.min);

    if (config.fromRadius) {
      // Gathering: from a ring, flying in to arrive as they die
      const inward = config.fromRadius / lifetime;
      particle.x = x + Math.cos(angle) * config.fromRadius;
      particle.y = y + Math.sin(angle) * config.fromRadius;
      particle.vx = -Math.cos(angle) * inward;
      particle.vy = -Math.sin(angle) * inward;
    } else {
      particle.x = x + (Math.random() - 0.5) * 10;
      particle.y = y + (Math.random() - 0.5) * 10;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
    }
    particle.life = lifetime;
    particle.maxLife = lifetime;
    particle.size = size;
    particle.color = config.color;
    particle.colorSecondary = config.colorSecondary;
    particle.gravity = config.gravity ?? 0;
    particle.friction = config.friction ?? 0;
    particle.effectType = config.particleType ?? 'circle';
    particle.glowIntensity = config.glowIntensity;
    particle.rotation = Math.random() * Math.PI * 2;
    particle.rotationSpeed = (Math.random() - 0.5) * 4;
  }
}

/**
 * Spawn rising particles.
 */
export function spawnRisingParticles(
  pool: VFXParticlePool,
  config: RisingParticlesConfig,
  x: number,
  y: number
): void {
  const count = Math.min(config.count, MAX_PARTICLES_PER_EFFECT);

  for (let i = 0; i < count; i++) {
    const particle = pool.acquire();
    if (!particle) break;

    const speed =
      config.speed.min + Math.random() * (config.speed.max - config.speed.min);
    const size =
      config.size.min + Math.random() * (config.size.max - config.size.min);
    const lifetime =
      config.lifetime.min +
      Math.random() * (config.lifetime.max - config.lifetime.min);

    particle.x = x + (Math.random() - 0.5) * config.spread;
    particle.y = y;
    particle.vx = (Math.random() - 0.5) * 20;
    particle.vy = -speed; // Negative = upward
    particle.life = lifetime;
    particle.maxLife = lifetime;
    particle.size = size;
    particle.color = config.color;
    particle.effectType = config.particleType ?? 'circle';
    particle.rotation = Math.random() * Math.PI * 2;
    particle.rotationSpeed = (Math.random() - 0.5) * 2;
  }
}

/**
 * Spawn falling particles.
 */
export function spawnFallingParticles(
  pool: VFXParticlePool,
  config: FallingParticlesConfig,
  x: number,
  y: number
): void {
  const count = Math.min(config.count, MAX_PARTICLES_PER_EFFECT);

  for (let i = 0; i < count; i++) {
    const particle = pool.acquire();
    if (!particle) break;

    const speed =
      config.speed.min + Math.random() * (config.speed.max - config.speed.min);
    const size =
      config.size.min + Math.random() * (config.size.max - config.size.min);
    const lifetime =
      config.lifetime.min +
      Math.random() * (config.lifetime.max - config.lifetime.min);

    particle.x = x + (Math.random() - 0.5) * config.spread;
    particle.y = y - 100 - Math.random() * 50; // Start above
    particle.vx = (Math.random() - 0.5) * 30;
    particle.vy = speed; // Positive = downward
    particle.life = lifetime;
    particle.maxLife = lifetime;
    particle.size = size;
    particle.color = config.color;
    particle.effectType = config.particleType ?? 'spark';
  }
}

/**
 * Spawn death/blood particles at a position.
 * Used for minion deaths.
 */
export function spawnDeathParticles(
  pool: VFXParticlePool,
  x: number,
  y: number,
  color: string
): void {
  const count = 8 + Math.floor(Math.random() * 5); // 8-12 particles

  for (let i = 0; i < count; i++) {
    const particle = pool.acquire();
    if (!particle) break;

    // Random angle for explosion effect
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 60;

    particle.x = x + (Math.random() - 0.5) * 8;
    particle.y = y + (Math.random() - 0.5) * 8;
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed - 20; // Slight upward bias
    particle.life = 0.3 + Math.random() * 0.3;
    particle.maxLife = particle.life;
    particle.size = 2 + Math.random() * 3;
    particle.color = color;
    particle.gravity = 200; // Fall down
    particle.friction = 2;
    particle.effectType = 'circle';
  }
}

/**
 * Update a particle: move it, apply gravity, friction and rotation, and age
 * it. Returns false when it has expired.
 */
export function updateParticle(particle: VFXParticle, deltaTime: number): boolean {
  // Apply velocity
  particle.x += particle.vx * deltaTime;
  particle.y += particle.vy * deltaTime;

  // Apply gravity
  if (particle.gravity) {
    particle.vy += particle.gravity * deltaTime;
  }

  // Apply friction
  if (particle.friction) {
    const factor = 1 - particle.friction * deltaTime;
    particle.vx *= factor;
    particle.vy *= factor;
  }

  // Apply rotation
  if (particle.rotationSpeed) {
    particle.rotation =
      (particle.rotation ?? 0) + particle.rotationSpeed * deltaTime;
  }

  // Update trail positions
  if (particle.effectType === 'trail' && particle.trailPositions) {
    particle.trailPositions.unshift({ x: particle.x, y: particle.y });
    if (particle.trailPositions.length > (particle.trailLength ?? 10)) {
      particle.trailPositions.pop();
    }
  }

  // Decrease life
  particle.life -= deltaTime;
  return particle.life > 0;
}

/**
 * Render every active particle in the pool, in screen space.
 */
export function renderParticles(
  ctx: CanvasRenderingContext2D,
  pool: VFXParticlePool,
  cameraX: number,
  cameraY: number
): void {
  pool.forEachActive((particle) => {
    // Translate particle to screen space
    const screenParticle = {
      ...particle,
      x: particle.x - cameraX,
      y: particle.y - cameraY,
    };
    drawParticle(ctx, screenParticle as VFXParticle);
  });
}

/** Dark colors (blood, mud) cover instead of glowing */
function isDark(color: RGB): boolean {
  return color[0] * 0.3 + color[1] * 0.59 + color[2] * 0.11 < 0.3;
}

/**
 * Add every active particle to a GPU effects batch: bright ones as light
 * (glows, streaks, twinkles, flames, embers), dark ones and smoke as puffs
 * that cover what's under them.
 */
export function emitParticles(batch: FXBatch, pool: VFXParticlePool): void {
  pool.forEachActive((particle) => {
    const remaining = Math.max(0, particle.life / particle.maxLife);
    const age = 1 - remaining;
    const base = fxColor(particle.color);
    const color = particle.colorSecondary ? mixColor(base, fxColor(particle.colorSecondary), age) : base;
    const seed = particle.seed ?? 0;
    const { x, y, size } = particle;

    switch (particle.effectType) {
      case 'flame':
        batch.flame(x, y, size, color, 1.7, age, 0.55, 2.5, seed);
        break;
      case 'smoke':
        batch.dust(x, y, size * (0.7 + age * 0.8), color, 0.55 * remaining, seed);
        break;
      case 'spark': {
        const speed = Math.hypot(particle.vx, particle.vy);
        const length = Math.min(size * 9, Math.max(size * 2, speed * 0.06));
        batch.spark(x, y, Math.atan2(particle.vy, particle.vx), length, size * 0.55, color, 0.3 + 1.8 * remaining);
        break;
      }
      case 'star':
        batch.flare(x, y, size * 2.6, color, 0.3 + 1.5 * remaining, particle.rotation ?? 0);
        break;
      case 'ember':
        batch.glow(x, y, size * 2.2, color, 1.6 * remaining, 0.45, 0.5, 0.9, seed);
        break;
      case 'rock': {
        const angle = particle.rotation ?? 0;
        batch.shard(x - Math.cos(angle) * size * 0.7, y - Math.sin(angle) * size * 0.7, angle, size * 1.4, size * 0.6, color, false, 1, Math.min(1, remaining * 4));
        break;
      }
      case 'crystal': {
        const angle = particle.rotation ?? 0;
        batch.shard(x - Math.cos(angle) * size * 0.7, y - Math.sin(angle) * size * 0.7, angle, size * 1.4, size * 0.55, color, true, 0.4 + 1.4 * remaining, remaining);
        break;
      }
      case 'petal':
        batch.petal(x, y, particle.rotation ?? 0, size, color, 0.3 + 1.2 * remaining, false, 5, 1, seed);
        break;
      case 'leaf':
        batch.petal(x, y, particle.rotation ?? 0, size, color, 1, true, 5, Math.min(1, remaining * 3), seed);
        break;
      case 'wisp':
        batch.wisp(x, y, Math.atan2(particle.vy, particle.vx), size * 2.5, color, 0.4 + 1.3 * remaining, 1, seed);
        break;
      default:
        if (isDark(color)) batch.dust(x, y, size * 1.4, color, 0.85 * remaining, seed);
        else batch.glow(x, y, size * 2.4, color, 0.15 + 1.3 * remaining, 0.35, 0.6, 0, seed);
    }
  });
}
