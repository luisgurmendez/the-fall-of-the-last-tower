/**
 * Unit configuration constants.
 * Contains stats for all unit types in the game.
 */

export const UnitConfig = {
  SWORDSMAN: {
    // Combat stats
    HEALTH: 100,
    ARMOR: 0,
    MAGIC_RESIST: 0,
    DAMAGE: 30,

    // Range and detection
    ATTACK_RANGE: 12,
    SIGHT_RANGE: 200, // Reduced for tighter fog of war

    // Movement
    SPEED: 300,
    ACCELERATION: 400,

    // Timing
    ATTACK_COOLDOWN: 5, // frames
    SPAWN_COOLDOWN: 0.5, // seconds

    // Economy
    COST: 100,

    // Collision
    COLLISION: {
      WIDTH: 18,
      HEIGHT: 26,
    },

    // Animation
    ANIMATION: {
      WALK_FRAMES: [0, 1, 2] as number[],
      ATTACK_FRAMES: [3, 4, 5, 6, 7, 8, 9] as number[],
      FRAME_DURATION: 0.2,
      TRIGGER_ATTACK_FRAME: 4,
      IDLE_FRAME: 3,
    },
  },

  ARCHER: {
    // Combat stats
    HEALTH: 10,
    ARMOR: 0,
    MAGIC_RESIST: 0,
    DAMAGE: 15, // Applied via arrow

    // Range and detection
    ATTACK_RANGE: 800,
    SIGHT_RANGE: 450, // Reduced for tighter fog of war

    // Movement
    SPEED: 300,
    ACCELERATION: 500,

    // Timing
    ATTACK_COOLDOWN: 5, // frames
    SPAWN_COOLDOWN: 1, // seconds

    // Economy
    COST: 60,

    // Collision
    COLLISION: {
      SIZE: 32, // Square collision mask
    },

    // Animation
    ANIMATION: {
      WALK_FRAMES: [0, 1, 2] as number[],
      ATTACK_FRAMES: [3, 4, 5, 6, 7] as number[],
      FRAME_DURATION: 0.2,
      TRIGGER_ATTACK_FRAME: 4,
      IDLE_FRAME: 3,
    },
  },

  ARROW: {
    SPEED: 500,
    TTL: 2, // seconds
    LENGTH: 14,
    FRICTION: 0, // Constant velocity
    ACCELERATION: 1,
    DAMAGE: 15,
  },

  CASTLE: {
    HEALTH: 20000,
    RADIUS: 200,
    BRICK_SIZE: 50,
    POSITION: {
      X: -2000,
      Y: 0,
    },
    SMOKE: {
      DAMAGE_THRESHOLD: 0.8, // Start smoking at 80% health
      SPAWN_CHANCE: 0.05,
      TTL_MIN: 0.1,
      TTL_MAX: 2.5,
      SIZE_MIN: 10,
      SIZE_MAX: 40,
    },
  },
} as const;

export type UnitConfigType = typeof UnitConfig;

// Type helpers for accessing nested configs
export type SwordsmanConfig = typeof UnitConfig.SWORDSMAN;
export type ArcherConfig = typeof UnitConfig.ARCHER;
export type ArrowConfig = typeof UnitConfig.ARROW;
export type CastleConfig = typeof UnitConfig.CASTLE;
