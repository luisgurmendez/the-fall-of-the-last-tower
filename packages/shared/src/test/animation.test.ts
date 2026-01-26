/**
 * Animation System Tests
 *
 * Tests for animation types, keyframe triggers, and timing calculations.
 * These ensure animation-action synchronization works correctly.
 */

import { describe, it, expect } from 'bun:test';
import {
  type AnimationData,
  type AnimationKeyframe,
  type KeyframeTrigger,
  type EntityAnimations,
  type ChampionAnimations,
  type AnimationPlayback,
  isDamageTrigger,
  isProjectileTrigger,
  isEffectTrigger,
  isSoundTrigger,
  isVfxTrigger,
  calculateAnimationPlayback,
  getKeyframeAtTime,
  getKeyframesInRange,
  getTriggerTime,
  scaleAnimationSpeed,
} from '../types/animation';

describe('Animation Keyframe Triggers', () => {
  describe('Type Guards', () => {
    it('should identify damage trigger', () => {
      const trigger: KeyframeTrigger = { type: 'damage' };
      expect(isDamageTrigger(trigger)).toBe(true);
      expect(isProjectileTrigger(trigger)).toBe(false);
    });

    it('should identify projectile trigger', () => {
      const trigger: KeyframeTrigger = { type: 'projectile' };
      expect(isProjectileTrigger(trigger)).toBe(true);
      expect(isDamageTrigger(trigger)).toBe(false);
    });

    it('should identify effect trigger', () => {
      const trigger: KeyframeTrigger = { type: 'effect', effectId: 'stun' };
      expect(isEffectTrigger(trigger)).toBe(true);
      expect(isDamageTrigger(trigger)).toBe(false);
    });

    it('should identify sound trigger', () => {
      const trigger: KeyframeTrigger = { type: 'sound', soundId: 'sword_hit' };
      expect(isSoundTrigger(trigger)).toBe(true);
      expect(isDamageTrigger(trigger)).toBe(false);
    });

    it('should identify vfx trigger', () => {
      const trigger: KeyframeTrigger = { type: 'vfx', vfxId: 'slash_arc' };
      expect(isVfxTrigger(trigger)).toBe(true);
      expect(isDamageTrigger(trigger)).toBe(false);
    });
  });
});

describe('Animation Data', () => {
  const attackAnimation: AnimationData = {
    id: 'attack',
    totalFrames: 6,
    baseFrameDuration: 0.1, // 100ms per frame, 600ms total
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: 'sound', soundId: 'swing' } },
      { frame: 3, trigger: { type: 'damage' } },
      { frame: 3, trigger: { type: 'sound', soundId: 'hit' } },
      { frame: 5, trigger: { type: 'vfx', vfxId: 'impact' } },
    ],
  };

  describe('calculateAnimationPlayback', () => {
    it('should calculate correct total duration at normal speed', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 1.0);

      expect(playback.totalDuration).toBeCloseTo(0.6, 3); // 6 frames * 0.1s
      expect(playback.frameDuration).toBeCloseTo(0.1, 3);
      expect(playback.speedMultiplier).toBe(1.0);
    });

    it('should calculate faster playback at 2x speed', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 2.0);

      expect(playback.totalDuration).toBeCloseTo(0.3, 3); // Half duration
      expect(playback.frameDuration).toBeCloseTo(0.05, 3); // Half frame duration
      expect(playback.speedMultiplier).toBe(2.0);
    });

    it('should calculate slower playback at 0.5x speed', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 0.5);

      expect(playback.totalDuration).toBeCloseTo(1.2, 3); // Double duration
      expect(playback.frameDuration).toBeCloseTo(0.2, 3); // Double frame duration
      expect(playback.speedMultiplier).toBe(0.5);
    });

    it('should map keyframes to correct times', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 1.0);

      // Frame 0 at time 0
      expect(playback.keyframeTimes.get(0)).toBeCloseTo(0, 3);
      // Frame 3 at time 0.3s
      expect(playback.keyframeTimes.get(3)).toBeCloseTo(0.3, 3);
      // Frame 5 at time 0.5s
      expect(playback.keyframeTimes.get(5)).toBeCloseTo(0.5, 3);
    });

    it('should scale keyframe times with speed', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 2.0);

      // Frame 3 at time 0.15s (half of 0.3s)
      expect(playback.keyframeTimes.get(3)).toBeCloseTo(0.15, 3);
    });
  });

  describe('getTriggerTime', () => {
    it('should return correct time for damage trigger', () => {
      const time = getTriggerTime(attackAnimation, 'damage', 1.0);
      expect(time).toBeCloseTo(0.3, 3); // Frame 3 * 0.1s
    });

    it('should return correct time for first sound trigger', () => {
      const time = getTriggerTime(attackAnimation, 'sound', 1.0);
      expect(time).toBeCloseTo(0, 3); // Frame 0
    });

    it('should return null for non-existent trigger', () => {
      const time = getTriggerTime(attackAnimation, 'effect', 1.0);
      expect(time).toBeNull();
    });

    it('should scale time with speed multiplier', () => {
      const time = getTriggerTime(attackAnimation, 'damage', 2.0);
      expect(time).toBeCloseTo(0.15, 3); // Frame 3 * 0.05s
    });
  });

  describe('getKeyframeAtTime', () => {
    it('should return keyframes at exact time', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 1.0);
      const keyframes = getKeyframeAtTime(attackAnimation, playback, 0.3);

      // Frame 3 has damage and sound
      expect(keyframes).toHaveLength(2);
      expect(keyframes.some(k => k.trigger.type === 'damage')).toBe(true);
      expect(keyframes.some(k => k.trigger.type === 'sound')).toBe(true);
    });

    it('should return empty array for time with no keyframes', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 1.0);
      const keyframes = getKeyframeAtTime(attackAnimation, playback, 0.15);

      expect(keyframes).toHaveLength(0);
    });

    it('should handle time tolerance', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 1.0);
      // Slightly after frame 3
      const keyframes = getKeyframeAtTime(attackAnimation, playback, 0.305, 0.01);

      expect(keyframes).toHaveLength(2);
    });
  });

  describe('getKeyframesInRange', () => {
    it('should return keyframes within time range', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 1.0);
      const keyframes = getKeyframesInRange(attackAnimation, playback, 0.25, 0.35);

      // Should include frame 3 keyframes (at 0.3s)
      expect(keyframes).toHaveLength(2);
    });

    it('should return all keyframes for full range', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 1.0);
      const keyframes = getKeyframesInRange(attackAnimation, playback, 0, 0.6);

      expect(keyframes).toHaveLength(4);
    });

    it('should return empty array for range with no keyframes', () => {
      const playback = calculateAnimationPlayback(attackAnimation, 1.0);
      const keyframes = getKeyframesInRange(attackAnimation, playback, 0.1, 0.2);

      expect(keyframes).toHaveLength(0);
    });
  });

  describe('scaleAnimationSpeed', () => {
    it('should calculate correct speed for target duration', () => {
      // Attack animation is 0.6s at 1.0 speed
      // If we want it to be 0.3s, speed should be 2.0
      const speed = scaleAnimationSpeed(attackAnimation, 0.3);
      expect(speed).toBeCloseTo(2.0, 3);
    });

    it('should calculate speed for slower animation', () => {
      // If we want 1.2s duration, speed should be 0.5
      const speed = scaleAnimationSpeed(attackAnimation, 1.2);
      expect(speed).toBeCloseTo(0.5, 3);
    });

    it('should return 1.0 for base duration', () => {
      const speed = scaleAnimationSpeed(attackAnimation, 0.6);
      expect(speed).toBeCloseTo(1.0, 3);
    });

    it('should clamp to minimum speed', () => {
      // Very long duration should clamp speed
      const speed = scaleAnimationSpeed(attackAnimation, 10, 0.1);
      expect(speed).toBe(0.1);
    });

    it('should clamp to maximum speed', () => {
      // Very short duration should clamp speed
      const speed = scaleAnimationSpeed(attackAnimation, 0.01, 0.1, 5.0);
      expect(speed).toBe(5.0);
    });
  });
});

describe('Animation Sync Scenarios', () => {
  describe('Attack Animation with Attack Speed', () => {
    const baseAttackAnimation: AnimationData = {
      id: 'attack',
      totalFrames: 6,
      baseFrameDuration: 0.083, // ~500ms total at 1.0 speed
      loop: false,
      keyframes: [
        { frame: 3, trigger: { type: 'damage' } },
      ],
    };

    it('should sync damage at correct time for 1.0 attack speed', () => {
      // Base attack is 500ms, damage at frame 3 = 250ms (halfway)
      const damageTime = getTriggerTime(baseAttackAnimation, 'damage', 1.0);
      expect(damageTime).toBeCloseTo(0.249, 2); // ~250ms
    });

    it('should sync damage at correct time for 1.5 attack speed', () => {
      // 1.5 AS = 1.5x animation speed = 333ms total, damage at ~166ms
      const damageTime = getTriggerTime(baseAttackAnimation, 'damage', 1.5);
      expect(damageTime).toBeCloseTo(0.166, 2);
    });

    it('should sync damage at correct time for 2.0 attack speed', () => {
      // 2.0 AS = 2.0x animation speed = 250ms total, damage at 125ms
      const damageTime = getTriggerTime(baseAttackAnimation, 'damage', 2.0);
      expect(damageTime).toBeCloseTo(0.1245, 2);
    });

    it('should maintain damage at 50% of animation', () => {
      // At any speed, damage should be at 50% (frame 3 of 6)
      for (const speed of [0.5, 1.0, 1.5, 2.0, 2.5]) {
        const playback = calculateAnimationPlayback(baseAttackAnimation, speed);
        const damageTime = getTriggerTime(baseAttackAnimation, 'damage', speed)!;
        const ratio = damageTime / playback.totalDuration;
        expect(ratio).toBeCloseTo(0.5, 2);
      }
    });
  });

  describe('Ability Animation with Cast Point', () => {
    const fireballAnimation: AnimationData = {
      id: 'fireball',
      totalFrames: 8,
      baseFrameDuration: 0.05, // 400ms total
      loop: false,
      keyframes: [
        { frame: 4, trigger: { type: 'projectile' } }, // Cast point at 50%
        { frame: 4, trigger: { type: 'sound', soundId: 'fireball_cast' } },
      ],
    };

    it('should spawn projectile at cast point', () => {
      const projectileTime = getTriggerTime(fireballAnimation, 'projectile', 1.0);
      expect(projectileTime).toBeCloseTo(0.2, 3); // Frame 4 * 0.05s = 200ms
    });

    it('should have sound and projectile at same time', () => {
      const projectileTime = getTriggerTime(fireballAnimation, 'projectile', 1.0);
      const soundTime = getTriggerTime(fireballAnimation, 'sound', 1.0);
      expect(projectileTime).toBe(soundTime);
    });
  });

  describe('Channeled Ability', () => {
    const channelAnimation: AnimationData = {
      id: 'channel',
      totalFrames: 20,
      baseFrameDuration: 0.1, // 2 seconds total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'effect', effectId: 'rooted' } },
        { frame: 5, trigger: { type: 'damage' } },
        { frame: 10, trigger: { type: 'damage' } },
        { frame: 15, trigger: { type: 'damage' } },
        { frame: 19, trigger: { type: 'damage' } },
        { frame: 19, trigger: { type: 'vfx', vfxId: 'channel_complete' } },
      ],
    };

    it('should have multiple damage ticks', () => {
      const playback = calculateAnimationPlayback(channelAnimation, 1.0);
      const damageKeyframes = channelAnimation.keyframes.filter(
        k => k.trigger.type === 'damage'
      );
      expect(damageKeyframes).toHaveLength(4);
    });

    it('should space damage ticks evenly', () => {
      const playback = calculateAnimationPlayback(channelAnimation, 1.0);
      // Frames 5, 10, 15, 19 = times 0.5, 1.0, 1.5, 1.9
      const damageTimes = [0.5, 1.0, 1.5, 1.9];

      for (let i = 0; i < damageTimes.length; i++) {
        const frameTime = channelAnimation.keyframes
          .filter(k => k.trigger.type === 'damage')[i].frame * playback.frameDuration;
        expect(frameTime).toBeCloseTo(damageTimes[i], 2);
      }
    });

    it('should root at start of channel', () => {
      const effectTime = getTriggerTime(channelAnimation, 'effect', 1.0);
      expect(effectTime).toBe(0);
    });
  });
});

describe('Entity Animation Structures', () => {
  it('should support basic entity animations', () => {
    const entityAnims: EntityAnimations = {
      idle: {
        id: 'idle',
        totalFrames: 4,
        baseFrameDuration: 0.2,
        loop: true,
        keyframes: [],
      },
      walk: {
        id: 'walk',
        totalFrames: 8,
        baseFrameDuration: 0.1,
        loop: true,
        keyframes: [],
      },
      attack: {
        id: 'attack',
        totalFrames: 6,
        baseFrameDuration: 0.083,
        loop: false,
        keyframes: [{ frame: 3, trigger: { type: 'damage' } }],
      },
    };

    expect(entityAnims.idle.loop).toBe(true);
    expect(entityAnims.walk.loop).toBe(true);
    expect(entityAnims.attack!.loop).toBe(false);
  });

  it('should support champion animations with abilities', () => {
    const championAnims: ChampionAnimations = {
      idle: {
        id: 'idle',
        totalFrames: 4,
        baseFrameDuration: 0.2,
        loop: true,
        keyframes: [],
      },
      walk: {
        id: 'walk',
        totalFrames: 8,
        baseFrameDuration: 0.1,
        loop: true,
        keyframes: [],
      },
      attack: {
        id: 'attack',
        totalFrames: 6,
        baseFrameDuration: 0.083,
        loop: false,
        keyframes: [{ frame: 3, trigger: { type: 'damage' } }],
      },
      abilities: {
        'warrior_q': {
          id: 'warrior_q',
          totalFrames: 8,
          baseFrameDuration: 0.05,
          loop: false,
          keyframes: [
            { frame: 4, trigger: { type: 'damage' } },
            { frame: 4, trigger: { type: 'vfx', vfxId: 'slash' } },
          ],
        },
      },
    };

    expect(championAnims.abilities).toBeDefined();
    expect(championAnims.abilities!['warrior_q']).toBeDefined();
    expect(championAnims.abilities!['warrior_q'].keyframes).toHaveLength(2);
  });
});
