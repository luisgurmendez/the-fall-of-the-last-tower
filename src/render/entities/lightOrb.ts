/**
 * Light Orb renderer (EntityType.LIGHT_ORB): Lume's pixelated orb, its light
 * rays and comet-tail particles, and the ghost shown while it respawns.
 */

import PixelArtDrawUtils from "@/utils/pixelartDrawUtils";
import type { EntityRenderContext } from "@/render/entities/types";

/**
 * Light Orb particle configuration (comet tail effect).
 */
interface LightOrbParticle {
  x: number; // World position X
  y: number; // World position Y
  vx: number; // Velocity X (direction to drift)
  vy: number; // Velocity Y
  life: number; // 0-1, decreases over time
  maxLife: number; // Initial life value for fade calculation
  size: number; // Pixel size
  color: string; // Particle color
}

/**
 * Light Orb position tracking for comet tail.
 */
interface LightOrbPositionTracker {
  prevX: number;
  prevY: number;
  dirX: number; // Normalized movement direction
  dirY: number;
}

/**
 * Light Orb visual configuration.
 */
const LIGHT_ORB_VISUALS = {
  CORE_RADIUS: 8, // Core orb size (pixelated)
  GLOW_RADIUS: 16, // Outer glow radius
  PIXEL_SIZE: 2, // Pixel size for retro look
  CORE_COLOR: "#FFE566", // Warm golden core
  GLOW_COLOR: "#FFF9E0", // Soft yellow glow
  PARTICLE_COUNT: 40, // Max particles in the comet tail
  PARTICLE_SPAWN_RATE: 0.015, // Seconds between particle spawns (faster for more particles)
  PARTICLE_LIFETIME: 0.6, // Seconds particles live
  PARTICLE_DRIFT_SPEED: 40, // How fast particles drift away
  PARTICLE_SPREAD: 10, // Random spread perpendicular to movement
  AURA_COLOR: "rgba(255, 240, 180, 0.08)", // Passive aura indicator
  DESTROYED_ALPHA: 0.3, // Alpha when destroyed
} as const;

/**
 * Renders Lume's Light Orbs. Holds each orb's comet-tail particles between
 * frames, so EntityRenderer keeps one instance for the whole match.
 */
export class LightOrbRenderer {
  private rc: EntityRenderContext;

  // Light Orb particle systems (one per orb)
  private lightOrbParticles: Map<string, LightOrbParticle[]> = new Map();
  private lightOrbLastParticleSpawn: Map<string, number> = new Map();
  private lightOrbPositionTrackers: Map<string, LightOrbPositionTracker> =
    new Map();

  constructor(rc: EntityRenderContext) {
    this.rc = rc;
  }

  /**
   * Render Lume's Light Orb with pixelated visuals and particle effects.
   */
  render(
    ctx: CanvasRenderingContext2D,
    snapshot: any,
    side: number,
  ): void {
    const state = snapshot.state as
      | "orbiting"
      | "traveling"
      | "stationed"
      | "destroyed";
    const orbId = snapshot.entityId;

    // Don't render if destroyed (except for a faint ghost)
    if (state === "destroyed") {
      // Optionally render a faint silhouette to show respawn progress
      if (snapshot.respawnTimeRemaining > 0) {
        this.renderDestroyedOrbGhost(ctx, snapshot);
      }
      return;
    }

    // Update and render particles (comet tail follows movement)
    this.updateLightOrbParticles(orbId, state, snapshot.x, snapshot.y);
    this.renderLightOrbParticles(ctx, orbId, side, snapshot.x, snapshot.y);

    // Calculate pulsing effect based on state
    const pulseSpeed =
      state === "traveling" ? 8 : state === "stationed" ? 3 : 5;
    const pulse = 1 + Math.sin(this.rc.animationTime * pulseSpeed) * 0.15;

    // Pixelated core using PixelArtDrawUtils
    const coreRadius = LIGHT_ORB_VISUALS.CORE_RADIUS * pulse;
    const pixelSize = LIGHT_ORB_VISUALS.PIXEL_SIZE;

    // Outer ring (slightly darker)
    const outerColor = side === 0 ? "#E6C84D" : "#E6A84D";
    const outerDrawer = new PixelArtDrawUtils(ctx, outerColor, pixelSize);
    outerDrawer.drawPixelatedCircleFill(0, 0, coreRadius);

    // Inner bright core
    const innerColor = side === 0 ? LIGHT_ORB_VISUALS.CORE_COLOR : "#FFD066";
    const innerDrawer = new PixelArtDrawUtils(ctx, innerColor, pixelSize);
    innerDrawer.drawPixelatedCircleFill(0, 0, coreRadius * 0.65);

    // Bright center pixel
    const centerColor = LIGHT_ORB_VISUALS.GLOW_COLOR;
    const centerDrawer = new PixelArtDrawUtils(ctx, centerColor, pixelSize);
    centerDrawer.drawPixelatedCircleFill(0, 0, coreRadius * 0.3);

    // Add rotating light rays when stationed or orbiting
    if (state === "stationed" || state === "orbiting") {
      this.renderLightRays(ctx, coreRadius, side);
    }

    // Note: The comet tail particle system now handles the trail effect
    // via updateLightOrbParticles/renderLightOrbParticles
  }

  /**
   * Render the passive aura indicator (subtle ground circle).
   */
  private renderLightOrbAura(
    ctx: CanvasRenderingContext2D,
    radius: number,
    side: number,
  ): void {
    if (radius <= 0) return;

    const auraColor =
      side === 0 ? "rgba(255, 240, 180, 0.06)" : "rgba(255, 200, 150, 0.06)";

    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Subtle pulsing border
    const borderAlpha = 0.1 + Math.sin(this.rc.animationTime * 2) * 0.05;
    ctx.strokeStyle = `rgba(255, 240, 180, ${borderAlpha})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -this.rc.animationTime * 20;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Render rotating light rays from the orb.
   */
  private renderLightRays(
    ctx: CanvasRenderingContext2D,
    coreRadius: number,
    side: number,
  ): void {
    const rayCount = 6;
    const rayLength = coreRadius * 1.8;
    const rayWidth = 2;
    const rotationSpeed = 0.8;
    const baseAngle = this.rc.animationTime * rotationSpeed;

    ctx.save();
    ctx.globalAlpha = 0.3;

    for (let i = 0; i < rayCount; i++) {
      const angle = baseAngle + (i * Math.PI * 2) / rayCount;
      const rayColor = side === 0 ? "#FFE566" : "#FFD066";

      ctx.strokeStyle = rayColor;
      ctx.lineWidth = rayWidth;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * coreRadius, Math.sin(angle) * coreRadius);
      ctx.lineTo(Math.cos(angle) * rayLength, Math.sin(angle) * rayLength);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render a faint ghost of destroyed orb showing respawn progress.
   */
  private renderDestroyedOrbGhost(
    ctx: CanvasRenderingContext2D,
    snapshot: any,
  ): void {
    const respawnProgress = 1 - snapshot.respawnTimeRemaining / 60; // 60s respawn time
    const alpha = LIGHT_ORB_VISUALS.DESTROYED_ALPHA * respawnProgress;

    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Faint outline
    const pixelSize = LIGHT_ORB_VISUALS.PIXEL_SIZE;
    const ghostDrawer = new PixelArtDrawUtils(
      ctx,
      "rgba(200, 200, 200, 0.5)",
      pixelSize,
    );
    ghostDrawer.drawPixelatedCircle(0, 0, LIGHT_ORB_VISUALS.CORE_RADIUS);

    // Respawn progress arc
    ctx.strokeStyle = "#FFE566";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      LIGHT_ORB_VISUALS.CORE_RADIUS + 4,
      -Math.PI / 2,
      -Math.PI / 2 + respawnProgress * Math.PI * 2,
    );
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Update particle system for a light orb (comet tail effect).
   * Particles spawn behind the orb based on its movement direction.
   */
  private updateLightOrbParticles(
    orbId: string,
    state: string,
    orbX: number,
    orbY: number,
  ): void {
    // Get or create particle array for this orb
    if (!this.lightOrbParticles.has(orbId)) {
      this.lightOrbParticles.set(orbId, []);
      this.lightOrbLastParticleSpawn.set(orbId, 0);
    }

    // Get or create position tracker
    if (!this.lightOrbPositionTrackers.has(orbId)) {
      this.lightOrbPositionTrackers.set(orbId, {
        prevX: orbX,
        prevY: orbY,
        dirX: 0,
        dirY: 0,
      });
    }

    const tracker = this.lightOrbPositionTrackers.get(orbId)!;
    const particles = this.lightOrbParticles.get(orbId)!;
    const lastSpawn = this.lightOrbLastParticleSpawn.get(orbId)!;

    // Calculate movement direction
    const dx = orbX - tracker.prevX;
    const dy = orbY - tracker.prevY;
    const moveSpeed = Math.sqrt(dx * dx + dy * dy);

    // Update direction if moving (with smoothing)
    if (moveSpeed > 0.5) {
      const smoothing = 0.3;
      tracker.dirX = tracker.dirX * (1 - smoothing) + (dx / moveSpeed) * smoothing;
      tracker.dirY = tracker.dirY * (1 - smoothing) + (dy / moveSpeed) * smoothing;
      // Renormalize
      const len = Math.sqrt(tracker.dirX * tracker.dirX + tracker.dirY * tracker.dirY);
      if (len > 0) {
        tracker.dirX /= len;
        tracker.dirY /= len;
      }
    }

    // Store current position for next frame
    tracker.prevX = orbX;
    tracker.prevY = orbY;

    // Calculate dt from animation time difference
    const dt = 1 / 60; // Approximate frame time

    // Spawn rate depends on movement speed and state
    const baseSpawnRate = LIGHT_ORB_VISUALS.PARTICLE_SPAWN_RATE;
    const spawnRate =
      state === "traveling"
        ? baseSpawnRate * 0.5 // Spawn faster when traveling
        : moveSpeed > 1
          ? baseSpawnRate
          : baseSpawnRate * 3; // Spawn slower when stationary

    // Spawn new particles in the tail
    if (
      this.rc.animationTime - lastSpawn > spawnRate &&
      particles.length < LIGHT_ORB_VISUALS.PARTICLE_COUNT
    ) {
      this.spawnLightOrbParticle(particles, orbX, orbY, tracker);
      this.lightOrbLastParticleSpawn.set(orbId, this.rc.animationTime);
    }

    // Update existing particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // Decrease life
      p.life -= dt / LIGHT_ORB_VISUALS.PARTICLE_LIFETIME;

      // Particles drift in their velocity direction (away from orb movement)
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Add slight upward drift for ethereal effect
      p.y -= dt * 8;

      // Remove dead particles
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  /**
   * Spawn a new light orb particle behind the orb (comet tail).
   */
  private spawnLightOrbParticle(
    particles: LightOrbParticle[],
    orbX: number,
    orbY: number,
    tracker: LightOrbPositionTracker,
  ): void {
    // Random golden/warm colors
    const colors = ["#FFE566", "#FFF9E0", "#FFD866", "#FFEC99", "#FFF2CC"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    // Spawn behind the orb (opposite of movement direction)
    const spawnOffset = LIGHT_ORB_VISUALS.CORE_RADIUS * 0.5;
    const baseX = orbX - tracker.dirX * spawnOffset;
    const baseY = orbY - tracker.dirY * spawnOffset;

    // Add perpendicular spread for width
    const perpX = -tracker.dirY;
    const perpY = tracker.dirX;
    const spread = (Math.random() - 0.5) * LIGHT_ORB_VISUALS.PARTICLE_SPREAD;

    const spawnX = baseX + perpX * spread;
    const spawnY = baseY + perpY * spread;

    // Velocity points opposite to movement direction (tail drifts back)
    const driftSpeed = LIGHT_ORB_VISUALS.PARTICLE_DRIFT_SPEED;
    const vx = -tracker.dirX * driftSpeed + (Math.random() - 0.5) * 10;
    const vy = -tracker.dirY * driftSpeed + (Math.random() - 0.5) * 10;

    // Normalized life (1 = PARTICLE_LIFETIME seconds), randomized so the tail doesn't fade in lockstep
    const life = 0.7 + Math.random() * 0.3;

    particles.push({
      x: spawnX,
      y: spawnY,
      vx,
      vy,
      life,
      maxLife: life,
      size: LIGHT_ORB_VISUALS.PIXEL_SIZE,
      color,
    });
  }

  /**
   * Render particles for a light orb (comet tail).
   * Particles are rendered at world positions, relative to current orb position.
   */
  private renderLightOrbParticles(
    ctx: CanvasRenderingContext2D,
    orbId: string,
    side: number,
    orbX: number,
    orbY: number,
  ): void {
    const particles = this.lightOrbParticles.get(orbId);
    if (!particles || particles.length === 0) return;

    for (const p of particles) {
      ctx.save();

      // Fade out based on remaining life
      const lifeFraction = p.life / p.maxLife;
      ctx.globalAlpha = lifeFraction * 0.7;

      // Particle position is relative to orb's current screen position (0,0 due to ctx.translate)
      const relX = p.x - orbX;
      const relY = p.y - orbY;

      // Size shrinks as particle fades
      const currentSize = p.size * (0.5 + lifeFraction * 0.5);

      // Use pixel art drawer for particles
      const drawer = new PixelArtDrawUtils(ctx, p.color, p.size);
      drawer.drawPixelatedCircleFill(relX, relY, currentSize);

      ctx.restore();
    }
  }
}
