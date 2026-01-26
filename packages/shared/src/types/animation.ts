/**
 * Animation Timing Types
 *
 * Defines animation data structures and keyframe triggers for server-client synchronization.
 * The server uses these to schedule damage/effects at the correct time during animations.
 */

// ============== Keyframe Triggers ==============

export interface DamageTrigger {
  type: 'damage';
}

export interface ProjectileTrigger {
  type: 'projectile';
}

export interface EffectTrigger {
  type: 'effect';
  effectId: string;
}

export interface SoundTrigger {
  type: 'sound';
  soundId: string;
}

export interface VfxTrigger {
  type: 'vfx';
  vfxId: string;
}

export type KeyframeTrigger =
  | DamageTrigger
  | ProjectileTrigger
  | EffectTrigger
  | SoundTrigger
  | VfxTrigger;

// ============== Type Guards ==============

export function isDamageTrigger(trigger: KeyframeTrigger): trigger is DamageTrigger {
  return trigger.type === 'damage';
}

export function isProjectileTrigger(trigger: KeyframeTrigger): trigger is ProjectileTrigger {
  return trigger.type === 'projectile';
}

export function isEffectTrigger(trigger: KeyframeTrigger): trigger is EffectTrigger {
  return trigger.type === 'effect';
}

export function isSoundTrigger(trigger: KeyframeTrigger): trigger is SoundTrigger {
  return trigger.type === 'sound';
}

export function isVfxTrigger(trigger: KeyframeTrigger): trigger is VfxTrigger {
  return trigger.type === 'vfx';
}

// ============== Animation Data ==============

export interface AnimationKeyframe {
  frame: number;           // Frame index where this triggers (0-indexed)
  trigger: KeyframeTrigger;
}

export interface AnimationData {
  id: string;
  totalFrames: number;
  baseFrameDuration: number;  // Duration per frame at 1.0 speed (in seconds)
  loop: boolean;
  keyframes: AnimationKeyframe[];
}

// ============== Entity Animation Collections ==============

export interface EntityAnimations {
  idle: AnimationData;
  walk: AnimationData;
  attack?: AnimationData;        // For entities that can attack
  death?: AnimationData;
}

export interface ChampionAnimations extends EntityAnimations {
  abilities?: Record<string, AnimationData>;  // Keyed by ability ID
}

// ============== Animation Playback ==============

export interface AnimationPlayback {
  animation: AnimationData;
  speedMultiplier: number;
  totalDuration: number;        // Total animation time in seconds
  frameDuration: number;        // Duration per frame in seconds
  keyframeTimes: Map<number, number>;  // frame -> time in seconds
}

/**
 * Calculate animation playback timings based on speed multiplier.
 */
export function calculateAnimationPlayback(
  animation: AnimationData,
  speedMultiplier: number = 1.0
): AnimationPlayback {
  const frameDuration = animation.baseFrameDuration / speedMultiplier;
  const totalDuration = frameDuration * animation.totalFrames;

  // Calculate when each keyframe triggers
  const keyframeTimes = new Map<number, number>();
  for (const keyframe of animation.keyframes) {
    const triggerTime = keyframe.frame * frameDuration;
    keyframeTimes.set(keyframe.frame, triggerTime);
  }

  return {
    animation,
    speedMultiplier,
    totalDuration,
    frameDuration,
    keyframeTimes,
  };
}

/**
 * Get the time in seconds when a specific trigger type first occurs.
 * Returns null if the trigger type doesn't exist in the animation.
 */
export function getTriggerTime(
  animation: AnimationData,
  triggerType: KeyframeTrigger['type'],
  speedMultiplier: number = 1.0
): number | null {
  const keyframe = animation.keyframes.find(k => k.trigger.type === triggerType);
  if (!keyframe) return null;

  const frameDuration = animation.baseFrameDuration / speedMultiplier;
  return keyframe.frame * frameDuration;
}

/**
 * Get all keyframes that trigger at a specific time (within tolerance).
 */
export function getKeyframeAtTime(
  animation: AnimationData,
  playback: AnimationPlayback,
  time: number,
  tolerance: number = 0.001
): AnimationKeyframe[] {
  const result: AnimationKeyframe[] = [];

  for (const keyframe of animation.keyframes) {
    const keyframeTime = playback.keyframeTimes.get(keyframe.frame);
    if (keyframeTime !== undefined && Math.abs(keyframeTime - time) <= tolerance) {
      result.push(keyframe);
    }
  }

  return result;
}

/**
 * Get all keyframes that trigger within a time range.
 * Useful for processing keyframes between server ticks.
 */
export function getKeyframesInRange(
  animation: AnimationData,
  playback: AnimationPlayback,
  startTime: number,
  endTime: number
): AnimationKeyframe[] {
  const result: AnimationKeyframe[] = [];

  for (const keyframe of animation.keyframes) {
    const keyframeTime = playback.keyframeTimes.get(keyframe.frame);
    if (keyframeTime !== undefined && keyframeTime >= startTime && keyframeTime < endTime) {
      result.push(keyframe);
    }
  }

  return result;
}

/**
 * Calculate the speed multiplier needed to achieve a target animation duration.
 */
export function scaleAnimationSpeed(
  animation: AnimationData,
  targetDuration: number,
  minSpeed: number = 0.1,
  maxSpeed: number = 10.0
): number {
  const baseDuration = animation.baseFrameDuration * animation.totalFrames;
  const speed = baseDuration / targetDuration;

  return Math.min(maxSpeed, Math.max(minSpeed, speed));
}

/**
 * Get the frame index at a given time.
 */
export function getFrameAtTime(
  playback: AnimationPlayback,
  time: number
): number {
  const frame = Math.floor(time / playback.frameDuration);

  if (playback.animation.loop) {
    return frame % playback.animation.totalFrames;
  }

  return Math.min(frame, playback.animation.totalFrames - 1);
}

/**
 * Check if an animation has completed at a given time.
 */
export function isAnimationComplete(
  playback: AnimationPlayback,
  time: number
): boolean {
  if (playback.animation.loop) {
    return false;
  }
  return time >= playback.totalDuration;
}

// ============== Attack Speed Helpers ==============

/**
 * Calculate animation speed multiplier based on attack speed stat.
 * Attack speed of 1.0 = normal animation speed.
 * Attack speed of 2.0 = 2x animation speed (half duration).
 */
export function getAttackAnimationSpeed(
  attackSpeed: number,
  baseAttackDuration: number = 0.5,
  minDuration: number = 0.15
): number {
  // Target duration based on attack speed
  const targetDuration = baseAttackDuration / attackSpeed;

  // Clamp to minimum duration
  const clampedDuration = Math.max(targetDuration, minDuration);

  // Return speed multiplier to achieve target duration
  return baseAttackDuration / clampedDuration;
}

/**
 * Calculate the expected attack animation duration based on attack speed.
 */
export function getAttackAnimationDuration(
  attackSpeed: number,
  baseAttackDuration: number = 0.5,
  minDuration: number = 0.15
): number {
  const targetDuration = baseAttackDuration / attackSpeed;
  return Math.max(targetDuration, minDuration);
}

// ============== Default Animations ==============

/**
 * Create a simple attack animation with damage at the halfway point.
 */
export function createDefaultAttackAnimation(
  totalFrames: number = 6,
  baseFrameDuration: number = 0.083
): AnimationData {
  const damageFrame = Math.floor(totalFrames / 2);

  return {
    id: 'attack',
    totalFrames,
    baseFrameDuration,
    loop: false,
    keyframes: [
      { frame: damageFrame, trigger: { type: 'damage' } },
    ],
  };
}

/**
 * Create a simple idle animation.
 */
export function createDefaultIdleAnimation(
  totalFrames: number = 4,
  baseFrameDuration: number = 0.2
): AnimationData {
  return {
    id: 'idle',
    totalFrames,
    baseFrameDuration,
    loop: true,
    keyframes: [],
  };
}

/**
 * Create a simple walk animation.
 */
export function createDefaultWalkAnimation(
  totalFrames: number = 8,
  baseFrameDuration: number = 0.1
): AnimationData {
  return {
    id: 'walk',
    totalFrames,
    baseFrameDuration,
    loop: true,
    keyframes: [],
  };
}
