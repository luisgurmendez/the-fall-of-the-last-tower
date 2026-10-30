/**
 * MOBAConfig - Central configuration for the MOBA map.
 * Shared between client and server.
 *
 * All constants for map layout, lanes, jungle camps, and minion waves.
 */

import { Vector } from "../math/Vector";
import { SIEGE_MAP_WALLS } from "./siegeMap";

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
   * Blue at bottom-left (-1300, 1300), Red at top-right (1300, -1300)
   */
  NEXUS: {
    BLUE: { x: -1300, y: 1300 },
    RED: { x: 1300, y: -1300 },
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
      waypoints: [
        new Vector(-1300, 1300), // Blue nexus
        new Vector(-1330, 900), // Out of blue base
        new Vector(-1330, -1100), // Up along the left edge
        new Vector(-1100, -1330), // Round the top-left corner
        new Vector(900, -1330), // Along the top edge
        new Vector(1300, -1300), // Red nexus
      ],
      width: 200,
    },
    MID: {
      id: "mid" as const,
      waypoints: [
        new Vector(-1300, 1300), // Blue nexus
        new Vector(0, 0), // Center of map
        new Vector(1300, -1300), // Red nexus
      ],
      width: 200,
    },
    BOT: {
      id: "bot" as const,
      waypoints: [
        new Vector(-1300, 1300), // Blue nexus
        new Vector(-900, 1330), // Out of blue base
        new Vector(1100, 1330), // Right along the bottom edge
        new Vector(1330, 1100), // Round the bottom-right corner
        new Vector(1330, -900), // Up the right edge
        new Vector(1300, -1300), // Red nexus
      ],
      width: 200,
    },
  },

  /**
   * The river runs between the corners, across mid. Walkable; drawn as
   * shallow water. The dragon pit sits in the bot river.
   */
  RIVER: {
    points: [new Vector(-1250, -1250), new Vector(1250, 1250)],
    width: 260,
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
        position: new Vector(-820, -150),
        creatureType: "blue_buff" as const,
        count: 1,
        respawnTime: 120,
      },
      {
        id: "blue_gromp",
        position: new Vector(-980, -400),
        creatureType: "gromp" as const,
        count: 1,
        respawnTime: 60,
      },
      {
        id: "blue_wolves",
        position: new Vector(-760, 160),
        creatureType: "wolf" as const,
        count: 2,
        respawnTime: 50,
      },
      // Blue's bot-side jungle
      {
        id: "blue_redbuff",
        position: new Vector(150, 820),
        creatureType: "red_buff" as const,
        count: 1,
        respawnTime: 120,
      },
      {
        id: "blue_spiders",
        position: new Vector(400, 980),
        creatureType: "spider" as const,
        count: 3,
        respawnTime: 45,
      },
      {
        id: "blue_gromp_2",
        position: new Vector(-160, 760),
        creatureType: "gromp" as const,
        count: 1,
        respawnTime: 60,
      },

      // ========== RED SIDE JUNGLE (mirror of blue) ==========
      {
        id: "red_bluebuff",
        position: new Vector(820, 150),
        creatureType: "blue_buff" as const,
        count: 1,
        respawnTime: 120,
      },
      {
        id: "red_gromp",
        position: new Vector(980, 400),
        creatureType: "gromp" as const,
        count: 1,
        respawnTime: 60,
      },
      {
        id: "red_wolves",
        position: new Vector(760, -160),
        creatureType: "wolf" as const,
        count: 2,
        respawnTime: 50,
      },
      {
        id: "red_redbuff",
        position: new Vector(-150, -820),
        creatureType: "red_buff" as const,
        count: 1,
        respawnTime: 120,
      },
      {
        id: "red_spiders",
        position: new Vector(-400, -980),
        creatureType: "spider" as const,
        count: 3,
        respawnTime: 45,
      },
      {
        id: "red_gromp_2",
        position: new Vector(160, -760),
        creatureType: "gromp" as const,
        count: 1,
        respawnTime: 60,
      },

      // ========== RIVER ==========
      {
        id: "dragon",
        position: new Vector(720, 720),
        creatureType: "dragon" as const,
        count: 1,
        respawnTime: 300,
      },
    ],

    /**
     * Stats for each creature type.
     */
    CREATURE_STATS: {
      gromp: {
        health: 500,
        damage: 30,
        attackRange: 200, // Spits from range
        attackCooldown: 1.5,
        movementSpeed: 40,
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
        attackRange: 30,
        attackCooldown: 1.0,
        movementSpeed: 40,
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
      raptor: {
        health: 200,
        damage: 20,
        attackRange: 35,
        attackCooldown: 1.2,
        movementSpeed: 42,
        sightRange: 220,
        leashRange: 300,
        goldReward: 40,
        expReward: 30,
        collision: {
          type: "circle" as const,
          radius: 10,
          offset: { x: 0, y: 0 },
        },
      },
      krug: {
        health: 600,
        damage: 35,
        attackRange: 35,
        attackCooldown: 1.8,
        movementSpeed: 60,
        sightRange: 150,
        leashRange: 300,
        goldReward: 90,
        expReward: 55,
        collision: {
          type: "circle" as const,
          radius: 22,
          offset: { x: 0, y: 0 },
        },
      },
      blue_buff: {
        health: 1000,
        damage: 40,
        attackRange: 45,
        attackCooldown: 1.4,
        movementSpeed: 80,
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
        attackRange: 45,
        attackCooldown: 1.2,
        movementSpeed: 80,
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
        attackRange: 250, // Breathes fire from range
        attackCooldown: 2.0,
        movementSpeed: 50,
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
      baron: {
        health: 5000,
        damage: 150,
        attackRange: 100,
        attackCooldown: 2.5,
        movementSpeed: 40,
        sightRange: 300,
        leashRange: 450,
        goldReward: 500,
        expReward: 500,
        collision: {
          type: "circle" as const,
          radius: 55,
          offset: { x: 0, y: 0 },
        },
      },
      spider: {
        health: 300,
        damage: 22,
        attackRange: 30,
        attackCooldown: 0.9,
        movementSpeed: 30,
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
     * Sizes are tuned to champion speed (about 60 units/s). A melee champion
     * fighting a buff monster stands 125-170 from its center, inside the
     * slam, and has at least half a second to react and step out. The
     * dragon's breath is too wide to outrun up close; stand beside or behind
     * the dragon instead.
     */
    SPECIAL_ATTACKS: {
      blue_buff: {
        abilityId: "jungle_slam_blue",
        shape: "circle" as const,
        radius: 130,
        windup: 1.5,
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
        windup: 1.5,
        cooldown: 8,
        firstUseAfter: 3,
        damage: 90,
        damageType: "physical" as const,
        effects: [{ id: "slow_30", duration: 1.5 }],
      },
      dragon: {
        abilityId: "dragon_breath",
        shape: "cone" as const,
        radius: 300,
        coneAngle: (50 * Math.PI) / 180,
        windup: 1.3,
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
    BLUE: new Vector(-1440, 1440),
    RED: new Vector(1440, -1440),
  },

  /**
   * The fountain around each spawn point: allied champions inside regain
   * health and mana/energy quickly.
   */
  FOUNTAIN: {
    RADIUS: 300,
    /** Fraction of max health and resource restored per second */
    REGEN_PER_SECOND: 0.12,
  },

  /**
   * Bush group positions and configuration.
   */
  BUSH_GROUPS: [
    // ========== BLUE HALF ==========
    // Top river, blue bank
    { center: new Vector(-520, -350), bushCount: 3, spread: "cluster" as const },
    // Bot river, blue bank
    { center: new Vector(350, 520), bushCount: 3, spread: "cluster" as const },
    // Outside top lane
    { center: new Vector(-1500, -300), bushCount: 3, spread: "vertical" as const },
    // Top-side jungle entrance from top lane
    { center: new Vector(-1150, -75), bushCount: 3, spread: "vertical" as const },
    // Bot-side jungle entrance from bot lane
    { center: new Vector(75, 1150), bushCount: 3, spread: "horizontal" as const },
    // Mid entrance to top-side jungle
    { center: new Vector(-560, 220), bushCount: 3, spread: "diagonal" as const },
    // Mid entrance to bot-side jungle
    { center: new Vector(-220, 560), bushCount: 3, spread: "diagonal" as const },
    // Top-side jungle entrance from the river
    { center: new Vector(-695, -369), bushCount: 3, spread: "cluster" as const },
    // Bot-side jungle entrance from the river
    { center: new Vector(369, 695), bushCount: 3, spread: "cluster" as const },
    // Outside bot lane
    { center: new Vector(-300, 1500), bushCount: 3, spread: "horizontal" as const },

    // ========== RED HALF (mirror of blue) ==========
    { center: new Vector(520, 350), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(-350, -520), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(1500, 300), bushCount: 3, spread: "vertical" as const },
    { center: new Vector(1150, 75), bushCount: 3, spread: "vertical" as const },
    { center: new Vector(-75, -1150), bushCount: 3, spread: "horizontal" as const },
    { center: new Vector(560, -220), bushCount: 3, spread: "diagonal" as const },
    { center: new Vector(220, -560), bushCount: 3, spread: "diagonal" as const },
    { center: new Vector(695, 369), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(-369, -695), bushCount: 3, spread: "cluster" as const },
    { center: new Vector(300, -1500), bushCount: 3, spread: "horizontal" as const },
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
      attackRange: 450,
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
        position: new Vector(-1330, -540),
      },
      {
        side: 0 as const,
        lane: "top" as const,
        position: new Vector(-1330, 200),
      },
      {
        side: 0 as const,
        lane: "mid" as const,
        position: new Vector(-487, 487),
      },
      {
        side: 0 as const,
        lane: "mid" as const,
        position: new Vector(-840, 840),
      },
      {
        side: 0 as const,
        lane: "bot" as const,
        position: new Vector(540, 1330),
      },
      {
        side: 0 as const,
        lane: "bot" as const,
        position: new Vector(-200, 1330),
      },

      // ========== RED SIDE (1) (mirror of blue; red's top lane mirrors blue's bot) ==========
      {
        side: 1 as const,
        lane: "top" as const,
        position: new Vector(-540, -1330),
      },
      {
        side: 1 as const,
        lane: "top" as const,
        position: new Vector(200, -1330),
      },
      {
        side: 1 as const,
        lane: "mid" as const,
        position: new Vector(487, -487),
      },
      {
        side: 1 as const,
        lane: "mid" as const,
        position: new Vector(840, -840),
      },
      {
        side: 1 as const,
        lane: "bot" as const,
        position: new Vector(1330, 540),
      },
      {
        side: 1 as const,
        lane: "bot" as const,
        position: new Vector(1330, -200),
      },
    ],
  },

  /**
   * Map decorations - non-interactive visual elements.
   */
  DECORATIONS: [
    // ========== BLUE HALF ==========
    {
      position: new Vector(-900, -280),
      type: "mushroom_mid" as const,
      scale: 0.55,
    },
    {
      position: new Vector(-640, 40),
      type: "plant_2" as const,
      scale: 0.7,
    },
    {
      position: new Vector(-1010, 10),
      type: "rock_small" as const,
      scale: 0.6,
    },
    {
      position: new Vector(-880, 420),
      type: "mushroom_big" as const,
      scale: 0.6,
    },
    {
      position: new Vector(-1040, -560),
      type: "rock_mid" as const,
      scale: 0.65,
    },
    {
      position: new Vector(-1080, -180),
      type: "plant_3" as const,
      scale: 0.6,
    },
    {
      position: new Vector(280, 900),
      type: "mushroom_mid" as const,
      scale: 0.55,
      flipX: true,
    },
    {
      position: new Vector(-40, 640),
      type: "plant_2" as const,
      scale: 0.7,
      flipX: true,
    },
    {
      position: new Vector(-10, 1010),
      type: "rock_small" as const,
      scale: 0.6,
      flipX: true,
    },
    {
      position: new Vector(-420, 880),
      type: "mushroom_big" as const,
      scale: 0.6,
      flipX: true,
    },
    {
      position: new Vector(560, 1040),
      type: "rock_mid" as const,
      scale: 0.65,
      flipX: true,
    },
    {
      position: new Vector(1080, 180),
      type: "plant_3" as const,
      scale: 0.6,
      flipX: true,
    },
    {
      position: new Vector(-1500, 700),
      type: "rock_big" as const,
      scale: 0.75,
    },
    {
      position: new Vector(-700, 1500),
      type: "rock_big" as const,
      scale: 0.75,
      flipX: true,
    },
    {
      position: new Vector(-1500, -800),
      type: "plant_3" as const,
      scale: 0.65,
    },
    {
      position: new Vector(800, 1500),
      type: "plant_3" as const,
      scale: 0.65,
      flipX: true,
    },
    {
      position: new Vector(-1520, 1250),
      type: "scarecrow" as const,
      scale: 0.7,
    },
    {
      position: new Vector(-1250, 1520),
      type: "scarecrow" as const,
      scale: 0.7,
      flipX: true,
    },
    {
      position: new Vector(-1500, -1500),
      type: "rock_mid" as const,
      scale: 0.7,
    },
    {
      position: new Vector(1500, 1500),
      type: "rock_mid" as const,
      scale: 0.7,
      flipX: true,
    },

    // ========== RED HALF (mirror of blue) ==========
    {
      position: new Vector(900, 280),
      type: "mushroom_mid" as const,
      scale: 0.55,
      flipX: true,
    },
    {
      position: new Vector(640, -40),
      type: "plant_2" as const,
      scale: 0.7,
      flipX: true,
    },
    {
      position: new Vector(1010, -10),
      type: "rock_small" as const,
      scale: 0.6,
      flipX: true,
    },
    {
      position: new Vector(880, -420),
      type: "mushroom_big" as const,
      scale: 0.6,
      flipX: true,
    },
    {
      position: new Vector(1040, 560),
      type: "rock_mid" as const,
      scale: 0.65,
      flipX: true,
    },
    {
      position: new Vector(1080, 180),
      type: "plant_3" as const,
      scale: 0.6,
      flipX: true,
    },
    {
      position: new Vector(-280, -900),
      type: "mushroom_mid" as const,
      scale: 0.55,
    },
    {
      position: new Vector(40, -640),
      type: "plant_2" as const,
      scale: 0.7,
    },
    {
      position: new Vector(10, -1010),
      type: "rock_small" as const,
      scale: 0.6,
    },
    {
      position: new Vector(420, -880),
      type: "mushroom_big" as const,
      scale: 0.6,
    },
    {
      position: new Vector(-560, -1040),
      type: "rock_mid" as const,
      scale: 0.65,
    },
    {
      position: new Vector(-1080, -180),
      type: "plant_3" as const,
      scale: 0.6,
    },
    {
      position: new Vector(1500, -700),
      type: "rock_big" as const,
      scale: 0.75,
      flipX: true,
    },
    {
      position: new Vector(700, -1500),
      type: "rock_big" as const,
      scale: 0.75,
    },
    {
      position: new Vector(1500, 800),
      type: "plant_3" as const,
      scale: 0.65,
      flipX: true,
    },
    {
      position: new Vector(-800, -1500),
      type: "plant_3" as const,
      scale: 0.65,
    },
    {
      position: new Vector(1520, -1250),
      type: "scarecrow" as const,
      scale: 0.7,
      flipX: true,
    },
    {
      position: new Vector(1250, -1520),
      type: "scarecrow" as const,
      scale: 0.7,
    },
    {
      position: new Vector(1500, 1500),
      type: "rock_mid" as const,
      scale: 0.7,
      flipX: true,
    },
    {
      position: new Vector(-1500, -1500),
      type: "rock_mid" as const,
      scale: 0.7,
    },
  ],
} as const;

export type LaneId = "top" | "mid" | "bot";
export type JungleCreatureType = keyof typeof MOBAConfig.JUNGLE.CREATURE_STATS;
export type BushSpread = "horizontal" | "vertical" | "diagonal" | "cluster";

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
