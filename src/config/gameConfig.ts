/**
 * Global game configuration constants.
 * Centralized location for all game-wide settings.
 */

export const GameConfig = {
  // World dimensions
  WORLD: {
    SIZE: 5000,
    PLAYABLE_AREA: {
      MAX_X: 2500,
      MAX_Y: 2500,
    },
  },

  // Camera settings
  CAMERA: {
    /**
     * World units visible across the screen at the start, and the zoom
     * limits (so it's the same on any screen). Like the classic MOBA, the
     * view you start with is as far out as it goes; you can only zoom in.
     */
    DEFAULT_VIEW_WIDTH: 1100,
    MAX_VIEW_WIDTH: 1100,
    MIN_VIEW_WIDTH: 650,
    /** Pixels from the screen edge where the camera pans (only the very edge, like other MOBAs) */
    EDGE_SCROLL_THRESHOLD: 30,
    /** Edge panning speed, in screen pixels per second */
    EDGE_SCROLL_SPEED: 1200,
  },

  // Economy settings (LEGACY - online mode uses packages/shared/src/config/GameConfig.ts)
  ECONOMY: {
    STARTING_MONEY: 300 as number, // Kept in sync with shared GameConfig.ECONOMY.STARTING_GOLD
    PASSIVE_INCOME: 10 as number,
    PASSIVE_INCOME_INTERVAL: 1 as number, // seconds
    KILL_REWARD: 2500 as number,
  },

  // Spawning locations
  SPAWN: {
    ALLY: {
      X: -1500,
      Y_VARIANCE: 400,
    },
    ENEMY: {
      X: 2000,
      ARCHER_X: 2300,
      Y_VARIANCE: 300,
    },
  },

  // Physics
  PHYSICS: {
    DEFAULT_FRICTION: 0.8,
    DEFAULT_MAX_SPEED: 300,
    SPATIAL_HASH_CELL_SIZE: 100,
  },

  // Rendering
  RENDER: {
    TARGET_FPS: 60,
    FONT: "25px Comic Sans MS",
  },

  // Game speed controls
  SPEED: {
    MIN: 0.1,
    MAX: 3,
    INCREMENT: 0.5,
    DECREMENT: 0.5,
  },

  // Storage keys
  STORAGE: {
    WAVE_RECORD: "lg-siege:wr",
  },

  // Debug settings
  DEBUG: {
    SHOW_PATHS: true, // Draw pathfinding lines for selected units
    SHOW_NAVIGATION_GRID: false, // Draw navigation grid overlay
  },

  // Fog of War settings
  FOG_OF_WAR: {
    ENABLED: true, // Enable/disable fog of war
    CELL_SIZE: 10, // Size of each visibility cell in world units (smaller = smoother)
    UNEXPLORED_OPACITY: 1.0, // Opacity for never-seen areas (fully black)
    EXPLORED_OPACITY: 0.45, // Opacity for previously-seen areas (terrain visible but dimmed)
    INITIAL_STATE: 'explored' as 'unexplored' | 'explored', // Start with map explored for MOBA
  },
} as const;

export type GameConfigType = typeof GameConfig;
