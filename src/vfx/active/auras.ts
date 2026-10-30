/**
 * Effects drawn around an entity's current position: shield bubbles and
 * orbiting particles.
 */

import type { OnlineStateManager } from '@/core/OnlineStateManager';
import type { ShieldBubbleConfig, OrbitingParticlesConfig } from '../VFXTypes';
import { drawExpandingRing, drawGlowCircle } from '../effects/VFXPrimitives';
import type { ActiveShieldBubble, ActiveOrbitingParticles } from './types';

/**
 * Create a shield bubble effect attached to an entity.
 */
export function createShieldBubble(
  id: string,
  config: ShieldBubbleConfig,
  entityId: string,
  x: number,
  y: number,
  startTime: number
): ActiveShieldBubble {
  return {
    id,
    entityId,
    color: config.color,
    radius: config.radius,
    duration: config.duration * 1000,
    startTime,
    pulseSpeed: config.pulseSpeed,
    hexagonal: config.hexagonal,
  };
}

/**
 * Update shields. Returns the shields still running.
 */
export function updateShields(
  shields: ActiveShieldBubble[],
  now: number
): ActiveShieldBubble[] {
  return shields.filter((shield) => {
    const elapsed = now - shield.startTime;
    return elapsed < shield.duration;
  });
}

/**
 * Render shield bubbles attached to entities.
 */
export function renderShields(
  ctx: CanvasRenderingContext2D,
  shields: ActiveShieldBubble[],
  stateManager: OnlineStateManager,
  cameraX: number,
  cameraY: number,
  now: number
): void {
  for (const shield of shields) {
    const entity = stateManager.getEntity(shield.entityId);
    if (!entity) continue;

    const screenX = entity.position.x - cameraX;
    const screenY = entity.position.y - cameraY;
    const elapsed = (now - shield.startTime) / 1000;
    const progress = elapsed / (shield.duration / 1000);

    // Pulse effect
    let radius = shield.radius;
    if (shield.pulseSpeed) {
      const pulse = Math.sin(elapsed * shield.pulseSpeed * Math.PI * 2) * 0.1;
      radius *= 1 + pulse;
    }

    // Fade out near end
    let alpha = 0.6;
    if (progress > 0.8) {
      alpha *= 1 - (progress - 0.8) / 0.2;
    }

    if (shield.hexagonal) {
      // Draw hexagonal shield
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = shield.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const px = screenX + Math.cos(angle) * radius;
        const py = screenY + Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    } else {
      // Draw circular shield
      drawGlowCircle(
        ctx,
        screenX,
        screenY,
        radius * 0.9,
        'transparent',
        shield.color,
        radius * 1.2,
        alpha * 0.5
      );
      drawExpandingRing(
        ctx,
        screenX,
        screenY,
        radius,
        2,
        shield.color,
        alpha
      );
    }
  }
}

/**
 * Create orbiting particles effect attached to an entity.
 */
export function createOrbitingParticles(
  id: string,
  config: OrbitingParticlesConfig,
  entityId: string,
  x: number,
  y: number,
  startTime: number
): ActiveOrbitingParticles {
  const particles: Array<{ angle: number }> = [];
  for (let i = 0; i < config.count; i++) {
    particles.push({ angle: (i / config.count) * Math.PI * 2 });
  }

  return {
    id,
    entityId,
    color: config.color,
    size: config.size,
    orbitRadius: config.orbitRadius,
    orbitSpeed: config.orbitSpeed,
    count: config.count,
    duration: config.duration * 1000,
    startTime,
    particles,
  };
}

/**
 * Update orbiting particles: advance their angles. Returns the orbits still
 * running.
 */
export function updateOrbitingParticles(
  orbits: ActiveOrbitingParticles[],
  dt: number,
  now: number
): ActiveOrbitingParticles[] {
  for (const orbit of orbits) {
    for (const particle of orbit.particles) {
      particle.angle += orbit.orbitSpeed * dt;
    }
  }
  return orbits.filter((orbit) => {
    const elapsed = now - orbit.startTime;
    return elapsed < orbit.duration;
  });
}

/**
 * Render orbiting particles attached to entities.
 */
export function renderOrbitingParticles(
  ctx: CanvasRenderingContext2D,
  orbits: ActiveOrbitingParticles[],
  stateManager: OnlineStateManager,
  cameraX: number,
  cameraY: number
): void {
  for (const orbit of orbits) {
    const entity = stateManager.getEntity(orbit.entityId);
    if (!entity) continue;

    const centerX = entity.position.x - cameraX;
    const centerY = entity.position.y - cameraY;

    for (const particle of orbit.particles) {
      const px = centerX + Math.cos(particle.angle) * orbit.orbitRadius;
      const py = centerY + Math.sin(particle.angle) * orbit.orbitRadius;

      ctx.save();
      ctx.fillStyle = orbit.color;
      ctx.beginPath();
      ctx.arc(px, py, orbit.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
