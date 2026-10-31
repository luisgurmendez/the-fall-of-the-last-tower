/**
 * MOBAConfig - Central configuration for the MOBA map.
 * Shared between client and server.
 *
 * All constants for map layout, lanes, jungle camps, and minion waves.
 */

import { Vector } from "../math/Vector";
import { BLUE_NEXUS, DRAGON_PIT, LANE_PATHS, LANE_WIDTH, RIVER_PATH, RIVER_WIDTH, SIEGE_MAP_WALLS } from "./siegeMap";

/**
 * Side identifiers.
 * 0 = Blue (bottom-left)
 * 1 = Red (top-right)
 */
export type MapSide = 0 | 1;

/**
 * Sizes follow the classic MOBA map and its units at 0.4 of their size
 * (1 Siege unit = 2.5 of those; a champion is 25 across its radius). Keep new
 * distances, ranges and speeds on that scale.
 */
export const MOBAConfig = {
  /**
   * Map dimensions in world units.
   * World is centered at (0,0), so coordinates range from -2880 to +2880.
   */
  MAP_SIZE: {
    width: 5760,
    height: 5760,
  },

  /**
   * Width of the water border around the map.
   * This acts as a virtual wall - units cannot walk into water.
   */
  WATER_BORDER_SIZE: 192,

  /**
   * Nexus configuration.
   * Using centered coordinates: (0,0) is center of map.
   * Blue at bottom-left (-2200, 2200), Red at top-right (2200, -2200)
   */
  NEXUS: {
    BLUE: { x: BLUE_NEXUS.x, y: BLUE_NEXUS.y },
    RED: { x: -BLUE_NEXUS.x, y: -BLUE_NEXUS.y },
    RADIUS: 75,
    HEALTH: 5000,
    /** The building's footprint on the ground (the sprite's base is at the position) */
    collision: { type: "rectangle" as const, width: 160, height: 100, offset: { x: 0, y: -46 } },
  },

  /**
   * Lane waypoints from Blue base to Red base.
   * Each lane has waypoints that minions follow.
   * Note: In this coordinate system, +Y is DOWN (toward blue), -Y is UP (toward red)
   */
  LANES: {
    TOP: {
      id: "top" as const,
      waypoints: LANE_PATHS.top.map((p) => new Vector(p.x, p.y)),
      width: LANE_WIDTH,
    },
    MID: {
      id: "mid" as const,
      waypoints: LANE_PATHS.mid.map((p) => new Vector(p.x, p.y)),
      width: LANE_WIDTH,
    },
    BOT: {
      id: "bot" as const,
      waypoints: LANE_PATHS.bot.map((p) => new Vector(p.x, p.y)),
      width: LANE_WIDTH,
    },
  },

  /**
   * The river runs between the lane corners (along y = x), across mid.
   * Walkable; drawn as water. The dragon's pit is cut into blue's bank of the
   * bot river and mirrored into an empty pit on red's bank of the top river
   * (see siegeMap.ts); both open toward the river.
   */
  RIVER: {
    points: RIVER_PATH.map((p) => new Vector(p.x, p.y)),
    width: RIVER_WIDTH,
    pits: [new Vector(DRAGON_PIT.x, DRAGON_PIT.y), new Vector(-DRAGON_PIT.x, -DRAGON_PIT.y)],
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
      // Blue's top-side jungle
      {
        id: "blue_bluebuff",
        position: new Vector(-1440, -200),
        creatureType: "blue_buff" as const,
        count: 1,
        respawnTime: 120,
      },
      {
        id: "blue_thornspitter",
        position: new Vector(-1960, -420),
        creatureType: "thornspitter" as const,
        count: 1,
        respawnTime: 60,
      },
      {
        id: "blue_wolves",
        position: new Vector(-1440, 360),
        creatureType: "wolf" as const,
        count: 2,
        respawnTime: 50,
      },
      // Blue's bot-side jungle
      {
        id: "blue_redbuff",
        position: new Vector(200, 1440),
        creatureType: "red_buff" as const,
        count: 1,
        respawnTime: 120,
      },
      {
        id: "blue_spiders",
        position: new Vector(-360, 1440),
        creatureType: "spider" as const,
        count: 3,
        respawnTime: 45,
      },
      {
        id: "blue_thornspitter_2",
        position: new Vector(420, 1960),
        creatureType: "thornspitter" as const,
        count: 1,
        respawnTime: 60,
      },

      // ========== RED SIDE JUNGLE (mirror of blue) ==========
      {
        id: "red_bluebuff",
        position: new Vector(1440, 200),
        creatureType: "blue_buff" as const,
        count: 1,
        respawnTime: 120,
      },
      {
        id: "red_thornspitter",
        position: new Vector(1960, 420),
        creatureType: "thornspitter" as const,
        count: 1,
        respawnTime: 60,
      },
      {
        id: "red_wolves",
        position: new Vector(1440, -360),
        creatureType: "wolf" as const,
        count: 2,
        respawnTime: 50,
      },
      {
        id: "red_redbuff",
        position: new Vector(-200, -1440),
        creatureType: "red_buff" as const,
        count: 1,
        respawnTime: 120,
      },
      {
        id: "red_spiders",
        position: new Vector(360, -1440),
        creatureType: "spider" as const,
        count: 3,
        respawnTime: 45,
      },
      {
        id: "red_thornspitter_2",
        position: new Vector(-420, -1960),
        creatureType: "thornspitter" as const,
        count: 1,
        respawnTime: 60,
      },

      // ========== RIVER ==========
      {
        id: "dragon",
        position: new Vector(DRAGON_PIT.x, DRAGON_PIT.y),
        creatureType: "dragon" as const,
        count: 1,
        respawnTime: 300,
      },
    ],

    /**
     * Stats for each creature type.
     */
    CREATURE_STATS: {
      thornspitter: {
        health: 500,
        damage: 30,
        attackRange: 100, // Spits from range
        attackCooldown: 1.5,
        movementSpeed: 117,
        sightRange: 180,
        leashRange: 300,
        goldReward: 80,
        expReward: 50,
        collision: {
          type: "circle" as const,
          radius: 20,
          offset: { x: 0, y: 0 },
        },
      },
      wolf: {
        health: 350,
        damage: 25,
        attackRange: 45,
        attackCooldown: 1.0,
        movementSpeed: 144,
        sightRange: 200,
        leashRange: 300,
        goldReward: 60,
        expReward: 40,
        collision: {
          type: "circle" as const,
          radius: 14,
          offset: { x: 0, y: 0 },
        },
      },
      blue_buff: {
        health: 1000,
        damage: 40,
        attackRange: 60,
        attackCooldown: 1.4,
        movementSpeed: 126,
        sightRange: 220,
        leashRange: 350,
        goldReward: 120,
        expReward: 100,
        collision: {
          type: "circle" as const,
          radius: 28,
          offset: { x: 0, y: 0 },
        },
      },
      red_buff: {
        health: 1000,
        damage: 45,
        attackRange: 60,
        attackCooldown: 1.2,
        movementSpeed: 126,
        sightRange: 220,
        leashRange: 350,
        goldReward: 120,
        expReward: 100,
        collision: {
          type: "circle" as const,
          radius: 28,
          offset: { x: 0, y: 0 },
        },
      },
      dragon: {
        health: 2500,
        damage: 100,
        attackRange: 200, // Breathes fire from range
        attackCooldown: 2.0,
        movementSpeed: 126,
        sightRange: 250,
        leashRange: 400,
        goldReward: 200,
        expReward: 250,
        collision: {
          type: "circle" as const,
          radius: 40,
          offset: { x: 0, y: 0 },
        },
      },
      spider: {
        health: 300,
        damage: 22,
        attackRange: 40,
        attackCooldown: 0.9,
        movementSpeed: 135,
        sightRange: 180,
        leashRange: 300,
        goldReward: 50,
        expReward: 35,
        collision: {
          type: "circle" as const,
          radius: 8,
          offset: { x: 0, y: 0 },
        },
      },
    },

    /**
     * Telegraphed area attacks of the big monsters (server:
     * JungleSpecialAttacks.ts, client VFX: src/vfx/world.ts). The monster
     * stands still for `windup` seconds while clients draw the area, then
     * hits every champion still inside. `radius` is the circle radius or
     * the cone length; `coneAngle` is the full cone width in radians.
     *
     * Sizes are tuned to champion speed (about 130 units/s). A melee champion
     * fighting a buff monster stands about 100-130 from its center, inside
     * the slam, and has over half a second to react and step out. The
     * dragon's breath is too wide to outrun up close; stand beside or behind
     * the dragon instead.
     */
    SPECIAL_ATTACKS: {
      blue_buff: {
        abilityId: "jungle_slam_blue",
        shape: "circle" as const,
        radius: 130,
        windup: 1.1,
        cooldown: 8,
        firstUseAfter: 3,
        damage: 80,
        damageType: "magic" as const,
        effects: [{ id: "slow_30", duration: 1.5 }],
      },
      red_buff: {
        abilityId: "jungle_slam_red",
        shape: "circle" as const,
        radius: 130,
        windup: 1.1,
        cooldown: 8,
        firstUseAfter: 3,
        damage: 90,
        damageType: "physical" as const,
        effects: [{ id: "slow_30", duration: 1.5 }],
      },
      dragon: {
        abilityId: "dragon_breath",
        shape: "cone" as const,
        radius: 260,
        coneAngle: (50 * Math.PI) / 180,
        windup: 1.0,
        cooldown: 9,
        firstUseAfter: 4,
        damage: 160,
        damageType: "magic" as const,
        effects: [{ id: "slow_20", duration: 1 }],
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
    /** Every Nth wave brings a siege minion */
    SIEGE_EVERY: 3,
    /** Minion stat growth per minute of game time (0.05 = +5% per minute) */
    SCALING_PER_MINUTE: { health: 0.05, damage: 0.04 },
    /** Scaling stops growing after this many minutes */
    MAX_SCALING_MINUTES: 20,
  },

  /**
   * Spawning positions for champions.
   */
  CHAMPION_SPAWN: {
    BLUE: new Vector(-2560, 2560),
    RED: new Vector(2560, -2560),
  },

  /**
   * The fountain around each spawn point: allied champions inside regain
   * health and mana/energy quickly.
   */
  FOUNTAIN: {
    RADIUS: 360,
    /** Fraction of max health and resource restored per second */
    REGEN_PER_SECOND: 0.12,
  },

  /**
   * Bush group positions and configuration.
   */
  BUSH_GROUPS: [
    // ========== BLUE HALF ==========
    // Top lane, outer side
    { center: new Vector(-2590, -900), bushCount: 3, spread: "vertical" as const },
    // Top lane, at the entrance to the thornspitter
    { center: new Vector(-2250, -1060), bushCount: 3, spread: "vertical" as const },
    // Top lane, at the river corner
    { center: new Vector(-2150, -1650), bushCount: 3, spread: "cluster" as const },
    // Top lane, at the entrance by the base
    { center: new Vector(-2250, 430), bushCount: 3, spread: "vertical" as const },
    // Top-side jungle, between the thornspitter and the blue buff
    { center: new Vector(-1720, -380), bushCount: 3, spread: "cluster" as const },
    // Top-side jungle, on the way from the wolves to the base
    { center: new Vector(-1600, 800), bushCount: 3, spread: "cluster" as const },
    // Mid lane, at the entrance to the wolves
    { center: new Vector(-930, 520), bushCount: 3, spread: "cluster" as const },
    // Mid lane, at the river crossroads, top side
    { center: new Vector(-520, 180), bushCount: 3, spread: "cluster" as const },
    // Top river, at the entrance to the blue buff
    { center: new Vector(-1250, -1010), bushCount: 3, spread: "cluster" as const },
    // Top river, at the crossroads by mid
    { center: new Vector(-560, -250), bushCount: 3, spread: "cluster" as const },
    // Bot river, at the crossroads by mid
    { center: new Vector(250, 560), bushCount: 3, spread: "cluster" as const },
    // Bot river, by the dragon pit
    { center: new Vector(1000, 1130), bushCount: 3, spread: "cluster" as const },
    // Behind the dragon pit
    { center: new Vector(1380, 1710), bushCount: 3, spread: "cluster" as const },
    // Bot lane, outer side
    { center: new Vector(900, 2590), bushCount: 3, spread: "horizontal" as const },
    // Bot lane, at the entrance to the thornspitter
    { center: new Vector(1060, 2250), bushCount: 3, spread: "horizontal" as const },
    // Bot lane, at the river corner
    { center: new Vector(1650, 2150), bushCount: 3, spread: "cluster" as const },
    // Bot lane, at the entrance by the base
    { center: new Vector(-430, 2250), bushCount: 3, spread: "horizontal" as const },
    // Bot-side jungle, between the thornspitter and the red buff
    { center: new Vector(380, 1720), bushCount: 3, spread: "cluster" as const },
    // Bot-side jungle, on the way from the spiders to the base
    { center: new Vector(-800, 1600), bushCount: 3, spread: "cluster" as const },
    // Mid lane, at the entrance to the spiders
    { center: new Vector(-520, 930), bushCount: 3, spread: "cluster" as const },
    // Mid lane, at the river crossroads, bot side
    { center: new Vector(-180, 520), bushCount: 3, spread: "cluster" as const },

    // ========== RED HALF (mirror of blue) ==========
    { center: new Vector(2590, 900), bushCount: 3, spread: "vertical" as const },
    { center: new Vector(2250, 1060), bushCount: 3, spread: "vertical" as const },
    { center: new Vector(2150, 1650), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(2250, -430), bushCount: 3, spread: "vertical" as const },
    { center: new Vector(1720, 380), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(1600, -800), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(930, -520), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(520, -180), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(1250, 1010), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(560, 250), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(-250, -560), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(-1000, -1130), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(-1380, -1710), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(-900, -2590), bushCount: 3, spread: "horizontal" as const },
    { center: new Vector(-1060, -2250), bushCount: 3, spread: "horizontal" as const },
    { center: new Vector(-1650, -2150), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(430, -2250), bushCount: 3, spread: "horizontal" as const },
    { center: new Vector(-380, -1720), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(800, -1600), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(520, -930), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(180, -520), bushCount: 3, spread: "cluster" as const },
  ],

  /**
   * Bush rendering settings.
   */
  BUSH_SETTINGS: {
    /** Spacing between bushes in a group */
    SPACING: 45,
    /** Random offset variance for natural look */
    OFFSET_VARIANCE: 12,
    /** Large bush hitbox dimensions */
    LARGE_BUSH_WIDTH: 130,
    LARGE_BUSH_HEIGHT: 80,
    /** Small bush hitbox dimensions */
    SMALL_BUSH_WIDTH: 85,
    SMALL_BUSH_HEIGHT: 55,
    /** Extra padding for visibility bounds (accounts for entity collision radius) */
    VISIBILITY_PADDING: 35,
  },

  /**
   * Terrain walls (tile-aligned to a 64 unit grid), generated from the layout
   * in siegeMap.ts. Rectangles centered on `position`.
   */
  WALLS: SIEGE_MAP_WALLS as Array<{
    position: typeof Vector.prototype;
    width: number;
    height: number;
  }>,

  /**
   * Tower positions and configuration.
   */
  TOWERS: {
    /** Default tower stats */
    STATS: {
      health: 3000,
      attackDamage: 150,
      attackRange: 300,
      attackCooldown: 1.0,
      armor: 60,
      magicResist: 60,
      collision: {
        type: "circle" as const,
        radius: 50,
        offset: { x: 0, y: 0 },
      },
    },

    /** Tower positions by side and lane (outer tower first: tier 1, then inner: tier 2) */
    POSITIONS: [
      // ========== BLUE SIDE (0) ==========
      {
        side: 0 as const,
        lane: "top" as const,
        position: new Vector(-2420, -1150),
      },
      {
        side: 0 as const,
        lane: "top" as const,
        position: new Vector(-2420, 200),
      },
      {
        side: 0 as const,
        lane: "mid" as const,
        position: new Vector(-560, 560),
      },
      {
        side: 0 as const,
        lane: "mid" as const,
        position: new Vector(-1000, 1000),
      },
      {
        side: 0 as const,
        lane: "bot" as const,
        position: new Vector(1150, 2420),
      },
      {
        side: 0 as const,
        lane: "bot" as const,
        position: new Vector(-200, 2420),
      },

      // ========== RED SIDE (1) (mirror of blue; red's top lane mirrors blue's bot) ==========
      {
        side: 1 as const,
        lane: "top" as const,
        position: new Vector(-1150, -2420),
      },
      {
        side: 1 as const,
        lane: "top" as const,
        position: new Vector(200, -2420),
      },
      {
        side: 1 as const,
        lane: "mid" as const,
        position: new Vector(560, -560),
      },
      {
        side: 1 as const,
        lane: "mid" as const,
        position: new Vector(1000, -1000),
      },
      {
        side: 1 as const,
        lane: "bot" as const,
        position: new Vector(2420, 1150),
      },
      {
        side: 1 as const,
        lane: "bot" as const,
        position: new Vector(2420, -200),
      },
    ],
  },

  /**
   * Map decorations - non-interactive visual elements.
   */
  DECORATIONS: [
    // ========== BLUE HALF ==========
    {
      position: new Vector(-1728, -288),
      type: "plant_3" as const,
      scale: 0.6,
    },
    {
      position: new Vector(1728, 288),
      type: "plant_3" as const,
      scale: 0.6,
      flipX: true,
    },
    {
      position: new Vector(-2620, 1120),
      type: "rock_big" as const,
      scale: 0.75,
    },
    {
      position: new Vector(-1120, 2620),
      type: "rock_big" as const,
      scale: 0.75,
      flipX: true,
    },
    {
      position: new Vector(-2620, -1280),
      type: "plant_3" as const,
      scale: 0.65,
    },
    {
      position: new Vector(1280, 2620),
      type: "plant_3" as const,
      scale: 0.65,
      flipX: true,
    },
    {
      position: new Vector(-2620, 1960),
      type: "scarecrow" as const,
      scale: 0.7,
    },
    {
      position: new Vector(-1960, 2620),
      type: "scarecrow" as const,
      scale: 0.7,
      flipX: true,
    },
    {
      position: new Vector(-2400, -2400),
      type: "rock_mid" as const,
      scale: 0.7,
    },
    {
      position: new Vector(2400, 2400),
      type: "rock_mid" as const,
      scale: 0.7,
      flipX: true,
    },

    // ========== RED HALF (mirror of blue) ==========
    {
      position: new Vector(1728, 288),
      type: "plant_3" as const,
      scale: 0.6,
      flipX: true,
    },
    {
      position: new Vector(-1728, -288),
      type: "plant_3" as const,
      scale: 0.6,
    },
    {
      position: new Vector(2620, -1120),
      type: "rock_big" as const,
      scale: 0.75,
      flipX: true,
    },
    {
      position: new Vector(1120, -2620),
      type: "rock_big" as const,
      scale: 0.75,
    },
    {
      position: new Vector(2620, 1280),
      type: "plant_3" as const,
      scale: 0.65,
      flipX: true,
    },
    {
      position: new Vector(-1280, -2620),
      type: "plant_3" as const,
      scale: 0.65,
    },
    {
      position: new Vector(2620, -1960),
      type: "scarecrow" as const,
      scale: 0.7,
      flipX: true,
    },
    {
      position: new Vector(1960, -2620),
      type: "scarecrow" as const,
      scale: 0.7,
    },
    {
      position: new Vector(2400, 2400),
      type: "rock_mid" as const,
      scale: 0.7,
      flipX: true,
    },
    {
      position: new Vector(-2400, -2400),
      type: "rock_mid" as const,
      scale: 0.7,
    },
  ],
} as const;

export type LaneId = "top" | "mid" | "bot";
export type JungleCreatureType = keyof typeof MOBAConfig.JUNGLE.CREATURE_STATS;
/** How a group's bushes line up: along x, along y, along y = x, along y = -x (beside mid lane), or around the center */
export type BushSpread = "horizontal" | "vertical" | "diagonal" | "antidiagonal" | "cluster";

/**
 * Simple seeded random number generator for deterministic bush positions.
 * Uses a linear congruential generator (LCG).
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
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
export function calculateIndividualBushPositions(
  groupIndex: number,
): BushPosition[] {
  const groupConfig = MOBAConfig.BUSH_GROUPS[groupIndex];
  if (!groupConfig) return [];

  const {
    SPACING,
    OFFSET_VARIANCE,
    LARGE_BUSH_WIDTH,
    LARGE_BUSH_HEIGHT,
    SMALL_BUSH_WIDTH,
    SMALL_BUSH_HEIGHT,
  } = MOBAConfig.BUSH_SETTINGS;
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
      case "horizontal":
        x += offset + randX;
        y += randY;
        break;
      case "vertical":
        x += randX;
        y += offset + randY;
        break;
      case "diagonal":
        x += offset * 0.7 + randX;
        y += offset * 0.7 + randY;
        break;
      case "antidiagonal":
        x += offset * 0.7 + randX;
        y -= offset * 0.7 + randY;
        break;
      case "cluster":
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
export function isPointInBushGroup(
  point: { x: number; y: number },
  groupIndex: number,
): boolean {
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
  spread: BushSpread,
): BushGroupBounds {
  const {
    SPACING,
    OFFSET_VARIANCE,
    LARGE_BUSH_WIDTH,
    LARGE_BUSH_HEIGHT,
    VISIBILITY_PADDING,
  } = MOBAConfig.BUSH_SETTINGS;

  // Padding accounts for random variance in bush positions and entity collision radius
  const padding = OFFSET_VARIANCE + VISIBILITY_PADDING;

  switch (spread) {
    case "horizontal": {
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
    case "vertical": {
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
    case "diagonal":
    case "antidiagonal":
    case "cluster":
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
