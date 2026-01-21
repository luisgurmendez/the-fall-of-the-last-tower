/**
 * MOBAConfig - Central configuration for the MOBA map.
 * Shared between client and server.
 *
 * All constants for map layout, lanes, jungle camps, and minion waves.
 */

import { Vector } from '../math/Vector';

/**
 * Side identifiers.
 * 0 = Blue (bottom-left)
 * 1 = Red (top-right)
 */
export type MapSide = 0 | 1;

export const MOBAConfig = {
  /**
   * Map dimensions in world units.
   * World is centered at (0,0), so coordinates range from -1800 to +1800.
   */
  MAP_SIZE: {
    width: 3600,
    height: 3600,
  },

  /**
   * Width of the water border around the map.
   * This acts as a virtual wall - units cannot walk into water.
   */
  WATER_BORDER_SIZE: 192,

  /**
   * Nexus configuration.
   * Using centered coordinates: (0,0) is center of map.
   * Blue at bottom-left (-1200, 1200), Red at top-right (1200, -1200)
   */
  NEXUS: {
    BLUE: { x: -1200, y: 1200 },
    RED: { x: 1200, y: -1200 },
    RADIUS: 75,
    HEALTH: 5000,
  },

  /**
   * Lane waypoints from Blue base to Red base.
   * Each lane has waypoints that minions follow.
   * Note: In this coordinate system, +Y is DOWN (toward blue), -Y is UP (toward red)
   */
  LANES: {
    TOP: {
      id: 'top' as const,
      waypoints: [
        new Vector(-1200, 1200),   // Blue nexus
        new Vector(-1200, -1000),  // Up along left wall
        new Vector(-1000, -1200),  // Turn at top-left corner
        new Vector(1200, -1200),   // Reach red nexus
      ],
      width: 100,
    },
    MID: {
      id: 'mid' as const,
      waypoints: [
        new Vector(-1200, 1200),   // Blue nexus
        new Vector(-750, 750),     // Start diagonal
        new Vector(0, 0),          // Center of map
        new Vector(750, -750),     // Continue diagonal
        new Vector(1200, -1200),   // Reach red nexus
      ],
      width: 100,
    },
    BOT: {
      id: 'bot' as const,
      waypoints: [
        new Vector(-1200, 1200),   // Blue nexus
        new Vector(1000, 1200),    // Right along bottom wall
        new Vector(1200, 1000),    // Turn at bottom-right corner
        new Vector(1200, -1200),   // Reach red nexus
      ],
      width: 100,
    },
  },

  /**
   * Jungle configuration.
   */
  JUNGLE: {
    /**
     * Camp spawn positions and configurations.
     */
    CAMPS: [
      // ========== BLUE SIDE JUNGLE ==========
      { id: 'blue_gromp', position: new Vector(-750, -550), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },
      { id: 'blue_spiders', position: new Vector(-600, -150), creatureType: 'spider' as const, count: 3, respawnTime: 45 },
      { id: 'blue_gromp_2', position: new Vector(-300, -50), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },
      { id: 'blue_wolves', position: new Vector(-800, 100), creatureType: 'wolf' as const, count: 2, respawnTime: 50 },
      { id: 'blue_gromp_3', position: new Vector(-450, 300), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },

      // ========== RED SIDE JUNGLE ==========
      { id: 'red_gromp', position: new Vector(750, 550), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },
      { id: 'red_spiders', position: new Vector(600, 150), creatureType: 'spider' as const, count: 3, respawnTime: 45 },
      { id: 'red_gromp_2', position: new Vector(300, 50), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },
      { id: 'red_wolves', position: new Vector(800, -100), creatureType: 'wolf' as const, count: 2, respawnTime: 50 },
      { id: 'red_gromp_3', position: new Vector(450, -300), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },
    ],

    /**
     * Stats for each creature type.
     */
    CREATURE_STATS: {
      gromp: {
        health: 500,
        damage: 30,
        attackRange: 80,
        attackCooldown: 1.5,
        movementSpeed: 80,
        sightRange: 180,
        leashRange: 300,
        goldReward: 80,
        expReward: 50,
      },
      wolf: {
        health: 350,
        damage: 25,
        attackRange: 60,
        attackCooldown: 1.0,
        movementSpeed: 120,
        sightRange: 200,
        leashRange: 300,
        goldReward: 60,
        expReward: 40,
      },
      raptor: {
        health: 200,
        damage: 20,
        attackRange: 100,
        attackCooldown: 1.2,
        movementSpeed: 100,
        sightRange: 220,
        leashRange: 300,
        goldReward: 40,
        expReward: 30,
      },
      krug: {
        health: 600,
        damage: 35,
        attackRange: 70,
        attackCooldown: 1.8,
        movementSpeed: 60,
        sightRange: 150,
        leashRange: 300,
        goldReward: 90,
        expReward: 55,
      },
      blue_buff: {
        health: 1200,
        damage: 50,
        attackRange: 100,
        attackCooldown: 1.4,
        movementSpeed: 80,
        sightRange: 220,
        leashRange: 350,
        goldReward: 120,
        expReward: 100,
      },
      red_buff: {
        health: 1200,
        damage: 60,
        attackRange: 80,
        attackCooldown: 1.2,
        movementSpeed: 80,
        sightRange: 220,
        leashRange: 350,
        goldReward: 120,
        expReward: 100,
      },
      dragon: {
        health: 2500,
        damage: 100,
        attackRange: 150,
        attackCooldown: 2.0,
        movementSpeed: 50,
        sightRange: 250,
        leashRange: 400,
        goldReward: 200,
        expReward: 250,
      },
      baron: {
        health: 5000,
        damage: 150,
        attackRange: 200,
        attackCooldown: 2.5,
        movementSpeed: 40,
        sightRange: 300,
        leashRange: 450,
        goldReward: 500,
        expReward: 500,
      },
      spider: {
        health: 300,
        damage: 22,
        attackRange: 70,
        attackCooldown: 0.9,
        movementSpeed: 130,
        sightRange: 180,
        leashRange: 300,
        goldReward: 50,
        expReward: 35,
      },
    },
  },

  /**
   * Minion wave configuration.
   */
  MINION_WAVES: {
    /** Time between wave spawns in seconds */
    SPAWN_INTERVAL: 30,
    /** First wave spawns after this delay */
    FIRST_WAVE_DELAY: 5,
    /** Delay between each minion spawn in a wave */
    SPAWN_DELAY_BETWEEN: 0.3,
    /** Composition of each wave */
    WAVE_COMPOSITION: {
      swordsmen: 3,
      archers: 2,
    },
    /** Offset from nexus for spawn position */
    SPAWN_OFFSET: 100,
  },

  /**
   * Spawning positions for champions.
   */
  CHAMPION_SPAWN: {
    BLUE: new Vector(-1100, 1100),
    RED: new Vector(1100, -1100),
  },

  /**
   * Bush group positions and configuration.
   */
  BUSH_GROUPS: [
    // ========== TOP LANE BUSHES ==========
    { center: new Vector(-900, -900), bushCount: 4, spread: 'horizontal' as const },
    { center: new Vector(0, -1000), bushCount: 3, spread: 'horizontal' as const },
    { center: new Vector(600, -900), bushCount: 4, spread: 'horizontal' as const },

    // ========== MID LANE BUSHES ==========
    { center: new Vector(-500, 500), bushCount: 4, spread: 'diagonal' as const },
    { center: new Vector(500, -500), bushCount: 4, spread: 'diagonal' as const },

    // ========== BOT LANE BUSHES ==========
    { center: new Vector(-600, 900), bushCount: 4, spread: 'horizontal' as const },
    { center: new Vector(0, 1000), bushCount: 3, spread: 'horizontal' as const },
    { center: new Vector(900, 900), bushCount: 4, spread: 'horizontal' as const },

    // ========== BLUE JUNGLE BUSHES ==========
    { center: new Vector(-950, -550), bushCount: 3, spread: 'cluster' as const },
    { center: new Vector(-650, -400), bushCount: 4, spread: 'cluster' as const },
    { center: new Vector(-500, -50), bushCount: 3, spread: 'cluster' as const },
    { center: new Vector(-850, 200), bushCount: 4, spread: 'cluster' as const },
    { center: new Vector(-500, 400), bushCount: 3, spread: 'cluster' as const },

    // ========== RED JUNGLE BUSHES ==========
    { center: new Vector(950, 550), bushCount: 3, spread: 'cluster' as const },
    { center: new Vector(650, 400), bushCount: 4, spread: 'cluster' as const },
    { center: new Vector(500, 50), bushCount: 3, spread: 'cluster' as const },
    { center: new Vector(850, -200), bushCount: 4, spread: 'cluster' as const },
    { center: new Vector(500, -400), bushCount: 3, spread: 'cluster' as const },

    // ========== RIVER/CENTER BUSHES ==========
    { center: new Vector(-150, -100), bushCount: 4, spread: 'cluster' as const },
    { center: new Vector(150, 100), bushCount: 4, spread: 'cluster' as const },
  ],

  /**
   * Bush rendering settings.
   */
  BUSH_SETTINGS: {
    /** Spacing between bushes in a group */
    SPACING: 35,
    /** Random offset variance for natural look */
    OFFSET_VARIANCE: 10,
    /** Large bush hitbox dimensions */
    LARGE_BUSH_WIDTH: 100,
    LARGE_BUSH_HEIGHT: 60,
    /** Small bush hitbox dimensions */
    SMALL_BUSH_WIDTH: 60,
    SMALL_BUSH_HEIGHT: 40,
    /** Extra padding for visibility bounds (accounts for entity collision radius) */
    VISIBILITY_PADDING: 30,
  },

  /**
   * Wall configuration (tile-aligned to 64 unit grid).
   * Currently empty - walls disabled for open map gameplay.
   */
  WALLS: [] as Array<{ position: typeof Vector.prototype; width: number; height: number }>,

  /**
   * Tower positions and configuration.
   */
  TOWERS: {
    /** Default tower stats */
    STATS: {
      health: 3000,
      attackDamage: 150,
      attackRange: 350,
      attackCooldown: 1.0,
      armor: 60,
      magicResist: 60,
    },

    /** Tower positions by side and lane */
    POSITIONS: [
      // ========== BLUE SIDE (0) ==========
      { side: 0 as const, lane: 'top' as const, position: new Vector(-1200, 700) },
      { side: 0 as const, lane: 'top' as const, position: new Vector(-1200, 200) },
      { side: 0 as const, lane: 'mid' as const, position: new Vector(-650, 650) },
      { side: 0 as const, lane: 'mid' as const, position: new Vector(-350, 350) },
      { side: 0 as const, lane: 'bot' as const, position: new Vector(-200, 1200) },
      { side: 0 as const, lane: 'bot' as const, position: new Vector(400, 1200) },

      // ========== RED SIDE (1) ==========
      { side: 1 as const, lane: 'top' as const, position: new Vector(200, -1200) },
      { side: 1 as const, lane: 'top' as const, position: new Vector(-400, -1200) },
      { side: 1 as const, lane: 'mid' as const, position: new Vector(650, -650) },
      { side: 1 as const, lane: 'mid' as const, position: new Vector(350, -350) },
      { side: 1 as const, lane: 'bot' as const, position: new Vector(1200, -700) },
      { side: 1 as const, lane: 'bot' as const, position: new Vector(1200, -200) },
    ],
  },

  /**
   * Map decorations - non-interactive visual elements.
   */
  DECORATIONS: [
    // ========== BLUE JUNGLE DECORATIONS ==========
    { position: new Vector(-850, -600), type: 'rock_big' as const, scale: 0.75 },
    { position: new Vector(-650, -500), type: 'mushroom_mid' as const, scale: 0.55 },
    { position: new Vector(-700, -250), type: 'plant_2' as const, scale: 0.7 },
    { position: new Vector(-500, -200), type: 'rock_small' as const, scale: 0.6 },
    { position: new Vector(-900, 50), type: 'mushroom_big' as const, scale: 0.55 },
    { position: new Vector(-700, 180), type: 'plant_1' as const, scale: 0.6 },
    { position: new Vector(-550, 350), type: 'rock_mid' as const, scale: 0.65 },
    { position: new Vector(-350, 250), type: 'plant_3' as const, scale: 0.5 },

    // ========== RED JUNGLE DECORATIONS ==========
    { position: new Vector(850, 600), type: 'rock_big' as const, scale: 0.75, flipX: true },
    { position: new Vector(650, 500), type: 'mushroom_mid' as const, scale: 0.55 },
    { position: new Vector(700, 250), type: 'plant_2' as const, scale: 0.7, flipX: true },
    { position: new Vector(500, 200), type: 'rock_small' as const, scale: 0.6 },
    { position: new Vector(900, -50), type: 'mushroom_big' as const, scale: 0.55 },
    { position: new Vector(700, -180), type: 'plant_1' as const, scale: 0.6, flipX: true },
    { position: new Vector(550, -350), type: 'rock_mid' as const, scale: 0.65 },
    { position: new Vector(350, -250), type: 'plant_3' as const, scale: 0.5, flipX: true },

    // ========== LANE EDGE DECORATIONS ==========
    { position: new Vector(-500, -1050), type: 'plant_3' as const, scale: 0.5 },
    { position: new Vector(300, -1100), type: 'rock_small' as const, scale: 0.5 },
    { position: new Vector(500, 1050), type: 'plant_3' as const, scale: 0.5, flipX: true },
    { position: new Vector(-300, 1100), type: 'rock_small' as const, scale: 0.5 },

    // ========== RIVER/CENTER DECORATIONS ==========
    { position: new Vector(-300, -150), type: 'rock_small' as const, scale: 0.45 },
    { position: new Vector(300, 150), type: 'rock_small' as const, scale: 0.45 },
    { position: new Vector(0, 0), type: 'plant_1' as const, scale: 0.5 },

    // ========== BASE DECORATIONS ==========
    { position: new Vector(-1050, 1050), type: 'scarecrow' as const, scale: 0.5 },
    { position: new Vector(1050, -1050), type: 'scarecrow' as const, scale: 0.5, flipX: true },
  ],
} as const;

export type LaneId = 'top' | 'mid' | 'bot';
export type JungleCreatureType = keyof typeof MOBAConfig.JUNGLE.CREATURE_STATS;
export type BushSpread = 'horizontal' | 'vertical' | 'diagonal' | 'cluster';

/**
 * Simple seeded random number generator for deterministic bush positions.
 * Uses a linear congruential generator (LCG).
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 0xFFFFFFFF);
  };
}

/**
 * Individual bush position and dimensions.
 */
export interface BushPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate individual bush positions for a group deterministically.
 * Used by both server (for visibility checks) and can be used by client.
 *
 * @param groupIndex - Index of the bush group in BUSH_GROUPS array
 * @returns Array of individual bush positions with their dimensions
 */
export function calculateIndividualBushPositions(groupIndex: number): BushPosition[] {
  const groupConfig = MOBAConfig.BUSH_GROUPS[groupIndex];
  if (!groupConfig) return [];

  const { SPACING, OFFSET_VARIANCE, LARGE_BUSH_WIDTH, LARGE_BUSH_HEIGHT, SMALL_BUSH_WIDTH, SMALL_BUSH_HEIGHT } = MOBAConfig.BUSH_SETTINGS;
  const { center, bushCount, spread } = groupConfig;

  const positions: BushPosition[] = [];
  const halfCount = (bushCount - 1) / 2;

  // Create seeded random for this group (deterministic based on group index)
  const random = seededRandom(groupIndex * 12345 + 67890);

  for (let i = 0; i < bushCount; i++) {
    const offset = (i - halfCount) * SPACING;
    const randX = (random() - 0.5) * OFFSET_VARIANCE * 2;
    const randY = (random() - 0.5) * OFFSET_VARIANCE * 2;

    let x = center.x;
    let y = center.y;

    switch (spread as BushSpread) {
      case 'horizontal':
        x += offset + randX;
        y += randY;
        break;
      case 'vertical':
        x += randX;
        y += offset + randY;
        break;
      case 'diagonal':
        x += offset * 0.7 + randX;
        y += offset * 0.7 + randY;
        break;
      case 'cluster':
        const angle = (i / bushCount) * Math.PI * 2 + random() * 0.5;
        const radius = SPACING * 0.8 + random() * SPACING * 0.4;
        x += Math.cos(angle) * radius + randX;
        y += Math.sin(angle) * radius + randY;
        break;
    }

    // Alternate between small and large bushes (every 3rd is small)
    const isSmall = i % 3 === 0;
    const width = isSmall ? SMALL_BUSH_WIDTH : LARGE_BUSH_WIDTH;
    const height = isSmall ? SMALL_BUSH_HEIGHT : LARGE_BUSH_HEIGHT;

    positions.push({ x, y, width, height });
  }

  return positions;
}

/**
 * Check if a point is inside any individual bush in a group.
 * This is the correct way to check bush visibility - not bounding box!
 *
 * @param point - Position to check
 * @param groupIndex - Index of the bush group
 * @returns true if point is inside any bush in the group
 */
export function isPointInBushGroup(point: { x: number; y: number }, groupIndex: number): boolean {
  const bushes = calculateIndividualBushPositions(groupIndex);

  for (const bush of bushes) {
    const halfW = bush.width / 2;
    const halfH = bush.height / 2;

    if (
      point.x >= bush.x - halfW &&
      point.x <= bush.x + halfW &&
      point.y >= bush.y - halfH &&
      point.y <= bush.y + halfH
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Bush group visibility bounds (for fog of war calculations).
 */
export interface BushGroupBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Calculate the visibility bounds for a bush group.
 * Used by both server (for visibility checks) and client (for debug rendering).
 *
 * @param center - Center position of the bush group
 * @param bushCount - Number of bushes in the group
 * @param spread - Layout type of the bushes
 * @returns The bounding box for visibility checks
 */
export function calculateBushGroupBounds(
  center: { x: number; y: number },
  bushCount: number,
  spread: BushSpread
): BushGroupBounds {
  const { SPACING, OFFSET_VARIANCE, LARGE_BUSH_WIDTH, LARGE_BUSH_HEIGHT, VISIBILITY_PADDING } = MOBAConfig.BUSH_SETTINGS;

  // Padding accounts for random variance in bush positions and entity collision radius
  const padding = OFFSET_VARIANCE + VISIBILITY_PADDING;

  switch (spread) {
    case 'horizontal': {
      const totalWidth = bushCount * (LARGE_BUSH_WIDTH + SPACING);
      const halfW = totalWidth / 2 + padding;
      const halfH = LARGE_BUSH_HEIGHT / 2 + padding;
      return {
        minX: center.x - halfW,
        maxX: center.x + halfW,
        minY: center.y - halfH,
        maxY: center.y + halfH,
      };
    }
    case 'vertical': {
      const totalHeight = bushCount * (LARGE_BUSH_HEIGHT + SPACING);
      const halfW = LARGE_BUSH_WIDTH / 2 + padding;
      const halfH = totalHeight / 2 + padding;
      return {
        minX: center.x - halfW,
        maxX: center.x + halfW,
        minY: center.y - halfH,
        maxY: center.y + halfH,
      };
    }
    case 'diagonal':
    case 'cluster':
    default: {
      // For cluster/diagonal, use a circular-ish bounds
      const radius = Math.max(bushCount * SPACING, LARGE_BUSH_WIDTH) + padding;
      return {
        minX: center.x - radius,
        maxX: center.x + radius,
        minY: center.y - radius,
        maxY: center.y + radius,
      };
    }
  }
}

export default MOBAConfig;
