/**
 * Effects drawn around an entity's current position: shield bubbles and
 * orbiting particles.
 */

import type { OnlineStateManager } from '@/core/OnlineStateManager';
import { fxColor, type FXBatch } from '@/gpu/fx/FXBatch';
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

/**
 * Add shield bubbles to a GPU batch: a hex-patterned bubble with a bright
 * rim around the entity, flaring as it comes up and fading at the end.
 */
export function emitShields(batch: FXBatch, shields: ActiveShieldBubble[], stateManager: OnlineStateManager, now: number): void {
  for (const shield of shields) {
    const entity = stateManager.getEntity(shield.entityId);
    if (!entity) continue;
    const elapsed = (now - shield.startTime) / 1000;
    const progress = elapsed / (shield.duration / 1000);
    const pulse = shield.pulseSpeed ? 1 + Math.sin(elapsed * shield.pulseSpeed * Math.PI * 2) * 0.04 : 1;
    const rise = Math.min(1, elapsed / 0.15);
    const fade = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;
    const flare = Math.max(0, 1 - elapsed / 0.3);
    const color = fxColor(shield.color);
    const radius = shield.radius * pulse * (0.7 + 0.3 * rise);
    batch.shield(entity.position.x, entity.position.y - 6, radius, color, (1 + flare * 1.5) * fade, fade, (shield.startTime * 0.37) % 1);
  }
}

/**
 * Add orbiting particles to a GPU batch: motes of light with a short tail.
 */
export function emitOrbitingParticles(batch: FXBatch, orbits: ActiveOrbitingParticles[], stateManager: OnlineStateManager, now: number): void {
  for (const orbit of orbits) {
    const entity = stateManager.getEntity(orbit.entityId);
    if (!entity) continue;
    const progress = (now - orbit.startTime) / orbit.duration;
    const fade = Math.min(1, progress / 0.1, (1 - progress) / 0.2);
    const color = fxColor(orbit.color);
    const { x, y } = entity.position;
    const step = -Math.sign(orbit.orbitSpeed || 1) * 0.12;
    for (const particle of orbit.particles) {
      const at = (angle: number) => ({ x: x + Math.cos(angle) * orbit.orbitRadius, y: y - 6 + Math.sin(angle) * orbit.orbitRadius * 0.55 });
      const head = at(particle.angle);
      batch.ribbon([at(particle.angle + step * 3), at(particle.angle + step * 2), at(particle.angle + step), head], orbit.size * 0.7, color, 1.2 * fade);
      batch.glow(head.x, head.y, orbit.size * 2.2, color, 1.4 * fade, 0.35, 0.7);
    }
  }
}
