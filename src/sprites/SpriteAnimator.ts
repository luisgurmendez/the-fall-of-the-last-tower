/**
 * Generic sprite animation controller.
 * Works with any ISpriteSheet implementation (PixelArtSpriteSheet, ImageSpriteSheet, etc.).
 */

import Vector from '@/physics/vector';
import { AnimationDefinition, ISpriteSheet, SpriteRenderOptions } from './types';

/**
 * Internal animation state.
 */
interface AnimationState {
  frames: number[];
  frameDuration: number;
  loop: boolean;
}

/**
 * Generic sprite animator that works with any ISpriteSheet.
 */
class SpriteAnimator<T extends ISpriteSheet = ISpriteSheet> {
  /** Registered animations */
  private animations: Map<string, AnimationState> = new Map();

  /** Current animation being played */
  private currentAnimationName: string | null = null;

  /** Current frame index within the animation */
  private currentFrameIndex = 0;

  /** Time elapsed in the current animation */
  private elapsedTime = 0;

  /** The sprite sheet to animate */
  protected spriteSheet: T;

  /** Frame to display when no animation is playing */
  private idleFrame: number;

  /** Whether an animation is currently playing */
  isPlayingAnimation = false;

  /**
   * Create a new sprite animator.
   * @param spriteSheet - The sprite sheet to animate
   * @param idleFrame - The frame index to show when idle (default: 0)
   */
  constructor(spriteSheet: T, idleFrame = 0) {
    this.spriteSheet = spriteSheet;
    this.idleFrame = idleFrame;
  }

  /**
   * Get the current animation name.
   */
  get currentAnimation(): string | null {
    return this.currentAnimationName;
  }

  /**
   * Get the current frame index being displayed.
   */
  get currentFrame(): number {
    if (!this.currentAnimationName) {
      return this.idleFrame;
    }
    const animation = this.animations.get(this.currentAnimationName);
    if (!animation) {
      return this.idleFrame;
    }
    return animation.frames[this.currentFrameIndex];
  }

  /**
   * Get the sprite sheet being animated.
   */
  getSpriteSheet(): T {
    return this.spriteSheet;
  }

  /**
   * Register an animation.
   *
   * @param name - Unique name for the animation
   * @param frames - Array of frame indices in the sprite sheet
   * @param frameDuration - Duration of each frame in seconds
   * @param loop - Whether the animation should loop (default: false)
   */
  addAnimation(
    name: string,
    frames: number[],
    frameDuration: number,
    loop = false
  ): void {
    this.animations.set(name, {
      frames,
      frameDuration,
      loop,
    });
  }

  /**
   * Register an animation from an AnimationDefinition.
   *
   * @param name - Unique name for the animation
   * @param definition - The animation definition
   */
  addAnimationFromDefinition(
    name: string,
    definition: AnimationDefinition
  ): void {
    this.animations.set(name, {
      frames: definition.frames,
      frameDuration: definition.frameDuration,
      loop: definition.loop ?? false,
    });
  }

  /**
   * Register multiple animations from a map.
   *
   * @param animations - Map of animation names to definitions
   */
  addAnimations(animations: Record<string, AnimationDefinition>): void {
    for (const [name, definition] of Object.entries(animations)) {
      this.addAnimationFromDefinition(name, definition);
    }
  }

  /**
   * Stop the current animation and return to idle.
   */
  stopAnimation(): void {
    this.currentAnimationName = null;
    this.isPlayingAnimation = false;
    this.currentFrameIndex = 0;
    this.elapsedTime = 0;
  }

  /**
   * Play an animation.
   *
   * @param name - The name of the animation to play
   * @param options - Play options
   * @param options.interrupt - If true, interrupts any current animation (default: false)
   * @param options.restart - If true, restarts the animation even if already playing (default: false)
   */
  playAnimation(
    name: string,
    options: { interrupt?: boolean; restart?: boolean } = {}
  ): void {
    const { interrupt = false, restart = false } = options;

    // Don't interrupt current animation unless specified
    if (this.isPlayingAnimation && !interrupt) {
      return;
    }

    // Don't restart same animation unless specified
    if (name === this.currentAnimationName && !restart) {
      return;
    }

    const animation = this.animations.get(name);
    if (!animation) {
      console.warn(`SpriteAnimator: Animation '${name}' not found`);
      return;
    }

    this.currentAnimationName = name;
    this.currentFrameIndex = 0;
    this.elapsedTime = 0;
    this.isPlayingAnimation = true;
  }

  /**
   * Update the animation state.
   * Call this every frame with the delta time.
   *
   * @param dt - Time elapsed since last update in seconds
   */
  update(dt: number): void {
    if (!this.currentAnimationName) {
      return;
    }

    const animation = this.animations.get(this.currentAnimationName);
    if (!animation) {
      this.stopAnimation();
      return;
    }

    this.elapsedTime += dt;

    const totalDuration = animation.frames.length * animation.frameDuration;

    if (this.elapsedTime >= totalDuration) {
      if (animation.loop) {
        // Loop: wrap the elapsed time
        this.elapsedTime %= totalDuration;
      } else {
        // Not looping: stop animation
        this.stopAnimation();
        return;
      }
    }

    // Calculate current frame
    this.currentFrameIndex =
      Math.floor(this.elapsedTime / animation.frameDuration) %
      animation.frames.length;
  }

  /**
   * Render the current frame at the specified position.
   *
   * @param ctx - The canvas rendering context
   * @param position - The center position to draw at
   * @param mirrored - Whether to mirror the sprite horizontally
   */
  render(
    ctx: CanvasRenderingContext2D,
    position: Vector | { x: number; y: number },
    mirrored = false
  ): void {
    const frameIndex = this.currentFrame;
    this.spriteSheet.drawSprite(ctx, frameIndex, position, mirrored);
  }

  /**
   * Render with additional options.
   *
   * @param ctx - The canvas rendering context
   * @param position - The center position to draw at
   * @param options - Render options
   */
  renderWithOptions(
    ctx: CanvasRenderingContext2D,
    position: Vector | { x: number; y: number },
    options: SpriteRenderOptions = {}
  ): void {
    const frameIndex = this.currentFrame;
    this.spriteSheet.drawSpriteWithOptions(ctx, frameIndex, position, options);
  }

  /**
   * Check if a specific animation exists.
   * @param name - The animation name to check
   */
  hasAnimation(name: string): boolean {
    return this.animations.has(name);
  }

  /**
   * Get all registered animation names.
   */
  getAnimationNames(): string[] {
    return Array.from(this.animations.keys());
  }

  /**
   * Set the idle frame.
   * @param frame - The frame index to show when idle
   */
  setIdleFrame(frame: number): void {
    this.idleFrame = frame;
  }

  /**
   * Get the idle frame.
   */
  getIdleFrame(): number {
    return this.idleFrame;
  }
}

export default SpriteAnimator;
