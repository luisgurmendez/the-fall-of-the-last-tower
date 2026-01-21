/**
 * Spider - A spider jungle creature.
 *
 * Uses Spider sprite animations with idle, run, and attack states.
 * Sprites face right by default, mirrored when moving left.
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import RenderElement from '@/render/renderElement';
import ImageSpriteSheet from '@/sprites/ImageSpriteSheet';
import SpriteAnimator from '@/sprites/SpriteAnimator';
import { JungleCreature } from '../JungleCreature';

// Sprite paths (served from public/assets/sprites/Spider/)
const SPRITE_IDLE = '/assets/sprites/Spider/Spider_Idle.png';
const SPRITE_RUN = '/assets/sprites/Spider/Spider_Run.png';
const SPRITE_ATTACK = '/assets/sprites/Spider/Spider_Attack.png';

// Frame dimensions (all sprites are 192x192 per frame)
const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 192;
const SPRITE_SCALE = 0.5; // Scale for game

// Animation IDs
const ANIM_IDLE = 'idle';
const ANIM_RUN = 'run';
const ANIM_ATTACK = 'attack';

/**
 * Stats configuration for Spider.
 */
export interface SpiderStats {
  health: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  movementSpeed: number;
  sightRange: number;
  leashRange: number;
  goldReward: number;
  expReward: number;
}

/**
 * Spider jungle creature.
 */
export class Spider extends JungleCreature {
  /** Visual radius for collision/selection */
  private readonly radius: number = 35;

  /** Sprite sheets for each animation */
  private idleSpriteSheet: ImageSpriteSheet;
  private runSpriteSheet: ImageSpriteSheet;
  private attackSpriteSheet: ImageSpriteSheet;

  /** Sprite animators */
  private idleAnimator: SpriteAnimator<ImageSpriteSheet>;
  private runAnimator: SpriteAnimator<ImageSpriteSheet>;
  private attackAnimator: SpriteAnimator<ImageSpriteSheet>;

  /** Current active animator */
  private currentAnimator: SpriteAnimator<ImageSpriteSheet>;

  /** Sprites loaded flag */
  private spritesLoaded = false;

  /** Facing direction for sprite mirroring */
  private facingRight = true;

  /** Previous animation state to prevent flickering */
  private wasMoving = false;

  constructor(position: Vector, stats: SpiderStats) {
    super(position, stats);

    // Create sprite sheets
    // Idle: 8 frames (1536 / 192 = 8)
    this.idleSpriteSheet = new ImageSpriteSheet({
      type: 'grid',
      rows: 1,
      cols: 8,
      spriteWidth: FRAME_WIDTH,
      spriteHeight: FRAME_HEIGHT,
      scale: SPRITE_SCALE,
    });

    // Run: 5 frames (960 / 192 = 5)
    this.runSpriteSheet = new ImageSpriteSheet({
      type: 'grid',
      rows: 1,
      cols: 5,
      spriteWidth: FRAME_WIDTH,
      spriteHeight: FRAME_HEIGHT,
      scale: SPRITE_SCALE,
    });

    // Attack: 8 frames (1536 / 192 = 8)
    this.attackSpriteSheet = new ImageSpriteSheet({
      type: 'grid',
      rows: 1,
      cols: 8,
      spriteWidth: FRAME_WIDTH,
      spriteHeight: FRAME_HEIGHT,
      scale: SPRITE_SCALE,
    });

    // Create animators
    this.idleAnimator = new SpriteAnimator(this.idleSpriteSheet);
    this.runAnimator = new SpriteAnimator(this.runSpriteSheet);
    this.attackAnimator = new SpriteAnimator(this.attackSpriteSheet);

    // Register animations
    // Idle: loop through all 8 frames
    this.idleAnimator.addAnimation(ANIM_IDLE, [0, 1, 2, 3, 4, 5, 6, 7], 0.12, true);

    // Run: loop through all 5 frames
    this.runAnimator.addAnimation(ANIM_RUN, [0, 1, 2, 3, 4], 0.08, true);

    // Attack: play all 8 frames once
    this.attackAnimator.addAnimation(ANIM_ATTACK, [0, 1, 2, 3, 4, 5, 6, 7], 0.07, false);

    // Start with idle
    this.currentAnimator = this.idleAnimator;
    this.idleAnimator.playAnimation(ANIM_IDLE);

    // Load sprites
    this.loadSprites();
  }

  /**
   * Load all sprite images.
   */
  private async loadSprites(): Promise<void> {
    try {
      await Promise.all([
        this.idleSpriteSheet.load(SPRITE_IDLE),
        this.runSpriteSheet.load(SPRITE_RUN),
        this.attackSpriteSheet.load(SPRITE_ATTACK),
      ]);
      this.spritesLoaded = true;
    } catch (error) {
      console.error('Failed to load Spider sprites:', error);
    }
  }

  getRadius(): number {
    return this.radius;
  }

  getName(): string {
    return 'Spider';
  }

  /**
   * Override step to handle animation state transitions.
   */
  override step(gctx: GameContext): void {
    // Call parent step for AI logic
    super.step(gctx);

    if (this._isDead) return;

    const dt = gctx.dt;

    // Update facing direction based on velocity (only when actually moving)
    const speed = this.velocity.length();
    if (speed > 5) {
      this.facingRight = this.velocity.x >= 0;
    } else if (this.target && !this._isAttacking) {
      // Face toward target when stationary (but not during attack)
      const targetPos = this.target.getPosition();
      this.facingRight = targetPos.x >= this.position.x;
    }

    // Determine which animation should be playing
    this.updateAnimationState();

    // Update current animator
    this.currentAnimator.update(dt);

    // Check if attack animation finished - clear the attacking flag
    if (this._isAttacking && !this.attackAnimator.isPlayingAnimation) {
      this._isAttacking = false;
    }
  }

  /**
   * Update animation based on current state.
   */
  private updateAnimationState(): void {
    // Attack animation takes priority - use base class flag
    if (this._isAttacking) {
      if (this.currentAnimator !== this.attackAnimator) {
        this.currentAnimator = this.attackAnimator;
        this.attackAnimator.playAnimation(ANIM_ATTACK, { interrupt: true, restart: true });
      }
      return;
    }

    // Check if moving with hysteresis to prevent flickering
    // Use higher threshold to start running, lower to stop
    const speed = this.velocity.length();
    const isMoving = this.wasMoving ? speed > 3 : speed > 10;
    this.wasMoving = isMoving;

    if (isMoving) {
      if (this.currentAnimator !== this.runAnimator) {
        this.currentAnimator = this.runAnimator;
        this.runAnimator.playAnimation(ANIM_RUN, { interrupt: true });
      }
    } else {
      // Idle
      if (this.currentAnimator !== this.idleAnimator) {
        this.currentAnimator = this.idleAnimator;
        this.idleAnimator.playAnimation(ANIM_IDLE, { interrupt: true });
      }
    }
  }

  /**
   * Override to trigger attack animation.
   */
  protected override performAttack(target: any): void {
    // Set attacking flag (prevents movement in base class)
    this._isAttacking = true;

    // Trigger attack animation
    this.currentAnimator = this.attackAnimator;
    this.attackAnimator.playAnimation(ANIM_ATTACK, { interrupt: true, restart: true });

    // Call parent to deal damage
    super.performAttack(target);
  }

  override render(): RenderElement {
    return new RenderElement((gctx) => {
      if (this._isDead) return;

      const ctx = gctx.canvasRenderingContext;

      ctx.save();

      if (this.spritesLoaded) {
        // Sprites face RIGHT by default, mirror when facing left
        const mirrored = !this.facingRight;

        // Render current animation frame
        this.currentAnimator.render(ctx, this.position, mirrored);
      } else {
        // Fallback: draw a placeholder circle while loading
        ctx.fillStyle = '#4A0080'; // Purple for spider
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw health bar
      this.renderHealthBar(ctx);

      ctx.restore();
    }, true);
  }
}

export default Spider;
