/**
 * Tower - Defensive structure that attacks enemy units.
 *
 * Towers:
 * - Attack nearby enemy units within range
 * - Have attack cooldown between shots
 * - Prioritize champions over minions
 * - Deal physical damage
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import RenderElement from '@/render/renderElement';
import { UnitType, UnitSide, UnitReward, IGameUnit } from '@/units/types';
import { Structure } from './Structure';
import { Champion } from '@/champions/Champion';

// Sprite paths
const SPRITE_BLUE = '/assets/sprites/Buildings/Tower_Blue.png';
const SPRITE_RED = '/assets/sprites/Buildings/Tower_Red.png';

// Image dimensions (128x256)
const SPRITE_WIDTH = 128;
const SPRITE_HEIGHT = 256;
const SPRITE_SCALE = 0.8;

// Static image cache
let blueImage: HTMLImageElement | null = null;
let redImage: HTMLImageElement | null = null;
let imagesLoaded = false;

/**
 * Load tower images (called once).
 */
function loadTowerImages(): void {
  if (imagesLoaded || blueImage || redImage) return;

  blueImage = new Image();
  blueImage.src = SPRITE_BLUE;

  redImage = new Image();
  redImage.src = SPRITE_RED;

  Promise.all([
    new Promise<void>((resolve) => { blueImage!.onload = () => resolve(); }),
    new Promise<void>((resolve) => { redImage!.onload = () => resolve(); }),
  ]).then(() => {
    imagesLoaded = true;
  }).catch((error) => {
    console.error('Failed to load tower images:', error);
  });
}

/**
 * Configuration for a tower.
 */
export interface TowerConfig {
  position: Vector;
  side: UnitSide;
  health?: number;
  attackDamage?: number;
  attackRange?: number;
  attackCooldown?: number;
  armor?: number;
  magicResist?: number;
}

/**
 * Default tower stats.
 */
const DEFAULT_TOWER_STATS = {
  health: 3000,
  attackDamage: 150,
  attackRange: 400,
  attackCooldown: 1.0, // seconds between attacks
  armor: 60,
  magicResist: 60,
};

/**
 * Tower - Defensive structure that attacks enemies.
 */
export class Tower extends Structure {
  readonly unitType: UnitType = 'creature';

  /** Tower radius for collision */
  private readonly radius: number = 40;

  /** Attack stats */
  private readonly attackDamage: number;
  private readonly attackRange: number;
  private readonly attackCooldown: number;

  /** Current attack cooldown timer */
  private attackTimer: number = 0;

  /** Current target */
  private target: IGameUnit | null = null;

  /** Projectile for visual feedback */
  private projectile: { start: Vector; end: Vector; progress: number } | null = null;

  constructor(config: TowerConfig) {
    super(
      config.position.clone(),
      config.side,
      config.health ?? DEFAULT_TOWER_STATS.health,
      config.armor ?? DEFAULT_TOWER_STATS.armor,
      config.magicResist ?? DEFAULT_TOWER_STATS.magicResist
    );

    this.attackDamage = config.attackDamage ?? DEFAULT_TOWER_STATS.attackDamage;
    this.attackRange = config.attackRange ?? DEFAULT_TOWER_STATS.attackRange;
    this.attackCooldown = config.attackCooldown ?? DEFAULT_TOWER_STATS.attackCooldown;

    // Load images
    loadTowerImages();
  }

  getRadius(): number {
    return this.radius;
  }

  getReward(): UnitReward {
    return {
      gold: 250,
      experience: 200,
    };
  }

  /**
   * Get the attack range of this tower.
   */
  getAttackRange(): number {
    return this.attackRange;
  }

  override step(gctx: GameContext): void {
    // Call parent step for destruction check
    super.step(gctx);

    if (this.destroyed) return;

    const dt = gctx.dt;

    // Update attack cooldown
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
    }

    // Update projectile animation
    if (this.projectile) {
      this.projectile.progress += dt * 5; // Projectile speed
      if (this.projectile.progress >= 1) {
        this.projectile = null;
      }
    }

    // Find and attack targets
    this.updateTarget(gctx);

    if (this.target && this.attackTimer <= 0) {
      this.attackTarget();
    }
  }

  /**
   * Find the best target to attack.
   * Priority: Champions attacking allies > Champions > Closest enemy
   */
  private updateTarget(gctx: GameContext): void {
    // Clear target if invalid
    if (this.target) {
      if (this.target.isDead() ||
          this.position.distanceTo(this.target.getPosition()) > this.attackRange) {
        this.target = null;
      }
    }

    // Find new target if needed
    if (!this.target) {
      const nearbyObjects = gctx.spatialHashing.queryInRange(this.position, this.attackRange);

      let bestTarget: IGameUnit | null = null;
      let bestPriority = -1;

      for (const obj of nearbyObjects) {
        if (!this.isValidTarget(obj)) continue;

        const unit = obj as IGameUnit;
        const distance = this.position.distanceTo(unit.getPosition());

        if (distance > this.attackRange) continue;

        // Priority system: champions > minions, closer > farther
        let priority = 0;

        if (unit instanceof Champion) {
          priority = 1000; // Champions have high base priority
        }

        // Add distance factor (closer = higher priority)
        priority += (this.attackRange - distance) / this.attackRange * 100;

        if (priority > bestPriority) {
          bestPriority = priority;
          bestTarget = unit;
        }
      }

      this.target = bestTarget;
    }
  }

  /**
   * Check if an object is a valid target.
   */
  private isValidTarget(obj: unknown): obj is IGameUnit {
    if (!obj || typeof obj !== 'object') return false;

    // Check if it's a game unit
    if (typeof (obj as any).getTeamId !== 'function') return false;
    if (typeof (obj as any).isDead !== 'function') return false;
    if (typeof (obj as any).takeDamage !== 'function') return false;

    const unit = obj as IGameUnit;

    // Must be alive
    if (unit.isDead()) return false;

    // Must be enemy
    if (unit.getTeamId() === this.side) return false;

    // Don't target other structures
    if (unit instanceof Structure) return false;

    return true;
  }

  /**
   * Attack the current target.
   */
  private attackTarget(): void {
    if (!this.target) return;

    // Deal damage
    this.target.takeDamage(this.attackDamage, 'physical', this);

    // Create projectile visual
    this.projectile = {
      start: this.position.clone(),
      end: this.target.getPosition().clone(),
      progress: 0,
    };

    // Reset cooldown
    this.attackTimer = this.attackCooldown;
  }

  protected override onDestroyed(gctx: GameContext): void {
    console.log(`[TOWER] ${this.side === 0 ? 'Blue' : 'Red'} tower destroyed!`);
  }

  override render(): RenderElement {
    return new RenderElement((gctx) => {
      const ctx = gctx.canvasRenderingContext;

      ctx.save();

      // Get the appropriate image
      const image = this.side === 0 ? blueImage : redImage;

      if (image && imagesLoaded) {
        // Calculate scaled dimensions
        const scaledWidth = SPRITE_WIDTH * SPRITE_SCALE;
        const scaledHeight = SPRITE_HEIGHT * SPRITE_SCALE;

        // Draw centered on position
        ctx.drawImage(
          image,
          this.position.x - scaledWidth / 2,
          this.position.y - scaledHeight + 30, // Offset so base is near position
          scaledWidth,
          scaledHeight
        );
      } else {
        // Fallback: draw a colored rectangle while loading
        const baseColor = this.side === 0 ? '#4488FF' : '#FF4444';
        ctx.fillStyle = baseColor;
        ctx.fillRect(
          this.position.x - 25,
          this.position.y - 60,
          50,
          80
        );
      }

      // Draw attack range indicator (debug)
      // ctx.strokeStyle = 'rgba(255, 255, 0, 0.2)';
      // ctx.beginPath();
      // ctx.arc(this.position.x, this.position.y, this.attackRange, 0, Math.PI * 2);
      // ctx.stroke();

      // Draw projectile
      if (this.projectile) {
        this.renderProjectile(ctx);
      }

      // Draw health bar
      this.renderHealthBar(ctx);

      ctx.restore();
    }, true);
  }

  /**
   * Render tower projectile.
   */
  private renderProjectile(ctx: CanvasRenderingContext2D): void {
    if (!this.projectile) return;

    const { start, end, progress } = this.projectile;

    // Interpolate position
    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;

    // Draw projectile as a glowing orb
    const color = this.side === 0 ? '#88CCFF' : '#FF8888';

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Glow effect
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /**
   * Render health bar above the tower.
   */
  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 60;
    const barHeight = 8;
    const barY = this.position.y - SPRITE_HEIGHT * SPRITE_SCALE + 10;
    const barX = this.position.x - barWidth / 2;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health fill
    const healthPercent = this.getHealthPercent();
    const fillColor = this.side === 0 ? '#4488FF' : '#FF4444';
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

export default Tower;
