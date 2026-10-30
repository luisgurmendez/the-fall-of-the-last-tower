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

    particle.x = x + (Math.random() - 0.5) * 10;
    particle.y = y + (Math.random() - 0.5) * 10;
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed;
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
