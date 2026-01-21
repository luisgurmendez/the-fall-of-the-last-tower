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
    MIN_ZOOM: 0.4,
    MAX_ZOOM: 14,
    INITIAL_ZOOM: 0.6,
    EDGE_SCROLL_THRESHOLD: 150,
    EDGE_SCROLL_SPEED: 20,
  },

  // Economy settings
  ECONOMY: {
    STARTING_MONEY: 8000 as number,
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
