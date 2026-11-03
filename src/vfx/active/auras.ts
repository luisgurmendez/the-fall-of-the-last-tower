/**
 * Effects drawn around an entity's current position: shield bubbles and
 * orbiting particles.
 */

import type { OnlineStateManager } from '@/core/OnlineStateManager';
import { fxColor, type FXBatch } from '@/gpu/fx/FXBatch';
import { ShieldStyle } from '@/gpu/fx/fxShader';
import type { ShieldBubbleConfig, OrbitingParticlesConfig } from '../VFXTypes';
import { drawExpandingRing, drawGlowCircle } from '../effects/VFXPrimitives';
import type { ActiveShieldBubble, ActiveOrbitingParticles } from './types';

/**
 * Create a shield bubble effect attached to an entity.
 * @param sourceId The ability it's for (a shield from it ends the bubble when it breaks)
 */
export function createShieldBubble(
  id: string,
  config: ShieldBubbleConfig,
  entityId: string,
  x: number,
  y: number,
  startTime: number,
  sourceId: string
): ActiveShieldBubble {
  return {
    id,
    entityId,
    sourceId,
    shieldSeen: false,
    color: config.color,
    radius: config.radius,
    duration: config.duration * 1000,
    startTime,
    pulseSpeed: config.pulseSpeed,
    hexagonal: config.hexagonal,
    style: config.style,
    glowColor: config.glowColor,
  };
}

/**
 * Update shields. Returns the shields still running: until their time is up
 * or, for a bubble whose shield has shown up in the entity's state, until
 * that shield breaks (a bubble for something else, like Gorath's armor,
 * lasts its time).
 */
export function updateShields(
  shields: ActiveShieldBubble[],
  now: number,
  stateManager: OnlineStateManager
): ActiveShieldBubble[] {
  return shields.filter((shield) => {
    const elapsed = now - shield.startTime;
    if (elapsed >= shield.duration) return false;
    const snapshot = stateManager.getEntity(shield.entityId)?.snapshot as { shields?: { sourceId: string }[] } | undefined;
    const holds = snapshot?.shields?.some(held => held.sourceId === shield.sourceId) ?? false;
    if (holds) shield.shieldSeen = true;
    return holds || !shield.shieldSeen;
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
    style: config.style,
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

const SHIELD_STYLES = { hex: ShieldStyle.HEX, plates: ShieldStyle.PLATES, holy: ShieldStyle.HOLY, stone: ShieldStyle.STONE } as const;

/**
 * Add shield bubbles to a GPU batch, in their style (hexagons, steel
 * plates, petals of light, stones) around the entity, flaring as they come
 * up and fading at the end.
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
    const style = SHIELD_STYLES[shield.style ?? 'hex'];
    const glow = shield.glowColor ? fxColor(shield.glowColor) : undefined;
    batch.shield(entity.position.x, entity.position.y - 6, radius, color, (1 + flare * 1.5) * fade, fade, (shield.startTime * 0.37) % 1, style, glow);
  }
}

const ROCK_GLOW = fxColor('#ff8a2a');
const STEEL = fxColor('#e8f2ff');

/**
 * Add orbiting particles to a GPU batch: motes of light with a short tail,
 * tumbling rocks, spinning blades or soul flames, by style.
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
    const seconds = now / 1000;
    for (const [index, particle] of orbit.particles.entries()) {
      const at = (angle: number) => ({ x: x + Math.cos(angle) * orbit.orbitRadius, y: y - 6 + Math.sin(angle) * orbit.orbitRadius * 0.55 });
      const head = at(particle.angle);
      switch (orbit.style) {
        case 'rock': {
          const spin = seconds * 2 + index * 1.7;
          batch.glow(head.x, head.y, orbit.size * 1.6, ROCK_GLOW, 0.5 * fade, 0, 0);
          batch.shard(head.x - Math.cos(spin) * orbit.size * 0.6, head.y - Math.sin(spin) * orbit.size * 0.6, spin, orbit.size * 1.3, orbit.size * 0.55, color, false, 1, fade, ROCK_GLOW, 0.8);
          break;
        }
        case 'blade': {
          const behind = at(particle.angle + step * 2);
          batch.ribbon([at(particle.angle + step * 4), behind, head], orbit.size * 0.5, color, 0.9 * fade);
          batch.flare(head.x, head.y, orbit.size * 1.8, STEEL, 1.3 * fade, seconds * 18 + index);
          batch.flare(head.x, head.y, orbit.size * 1.2, color, 1.0 * fade, seconds * 18 + index + Math.PI / 4);
          break;
        }
        case 'wisp': {
          const ahead = at(particle.angle - step);
          const heading = Math.atan2(ahead.y - head.y, ahead.x - head.x);
          batch.wisp(head.x, head.y, heading, orbit.size * 3, color, 1.3 * fade, 1, index * 0.31);
          break;
        }
        default:
          batch.ribbon([at(particle.angle + step * 3), at(particle.angle + step * 2), at(particle.angle + step), head], orbit.size * 0.7, color, 1.2 * fade);
          batch.glow(head.x, head.y, orbit.size * 2.2, color, 1.4 * fade, 0.35, 0.7);
      }
    }
  }
}
