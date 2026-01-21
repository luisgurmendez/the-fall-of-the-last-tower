/**
 * Wave system configuration.
 * Controls enemy wave spawning and scaling.
 */

export const WaveConfig = {
  // Time between waves (in frames at 60fps)
  SPAWN_INTERVAL: 40,

  // When different unit types start appearing
  ARCHER_START_WAVE: 4,

  // Wave scaling functions
  // These determine how many units spawn per wave
  SCALING: {
    /**
     * Calculate number of swordsmen for a given wave.
     * Formula: (wave - 1) * 5 + 1
     * Wave 1: 1, Wave 2: 6, Wave 3: 11, etc.
     */
    getSwordsmenCount: (wave: number): number => {
      return (wave - 1) * 5 + 1;
    },

    /**
     * Calculate number of archers for a given wave.
     * Formula: max(0, (wave - 4) * 5)
     * Archers start at wave 4: Wave 4: 0, Wave 5: 5, Wave 6: 10, etc.
     */
    getArcherCount: (wave: number): number => {
      return Math.max(0, (wave - 4) * 5);
    },

    /**
     * Get total enemy count for a wave.
     */
    getTotalCount: (wave: number): number => {
      return WaveConfig.SCALING.getSwordsmenCount(wave) +
             WaveConfig.SCALING.getArcherCount(wave);
    },
  },

  // Spawn position variance
  SPAWN: {
    SWORDSMAN_X: 2000,
    ARCHER_X: 2300,
    Y_CENTER: -300,
    Y_RANGE: 600,
  },

  // UI
  DISPLAY: {
    WAVE_TEXT_DURATION: 2, // seconds to show "Wave X" text
  },
} as const;

export type WaveConfigType = typeof WaveConfig;
