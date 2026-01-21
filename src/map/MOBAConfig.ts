/**
 * MOBAConfig - Central configuration for the MOBA map.
 *
 * All constants for map layout, lanes, jungle camps, and minion waves.
 */

import Vector from '@/physics/vector';

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
   *
   * Layout (symmetric for both teams):
   * - Each side has 4 camps in their jungle quadrant
   * - Camps are positioned between lanes with wall protection
   * - River area in center has neutral objectives
   */
  JUNGLE: {
    /**
     * Camp spawn positions and configurations.
     * Positioned within maze pockets created by walls.
     *
     * Blue jungle: Upper-left quadrant (negative X, mixed Y)
     * Red jungle: Lower-right quadrant (positive X, mixed Y)
     *
     * SYMMETRY: Blue camps at (-x, -y) mirror to Red camps at (x, y)
     */
    CAMPS: [
      // ========== BLUE SIDE JUNGLE (upper-left quadrant) ==========
      // Gromp camp - pocket near top lane (between outer walls)
      { id: 'blue_gromp', position: new Vector(-750, -550), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },
      // Spider camp - central maze pocket
      { id: 'blue_spiders', position: new Vector(-600, -150), creatureType: 'spider' as const, count: 3, respawnTime: 45 },
      // Gromp camp - pocket near mid lane entrance
      { id: 'blue_gromp_2', position: new Vector(-300, -50), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },
      // Wolf camp - lower jungle maze pocket
      { id: 'blue_wolves', position: new Vector(-800, 100), creatureType: 'wolf' as const, count: 2, respawnTime: 50 },
      // Gromp camp - pocket near bot lane
      { id: 'blue_gromp_3', position: new Vector(-450, 300), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },

      // ========== RED SIDE JUNGLE (lower-right quadrant) ==========
      // Gromp camp - pocket near bot lane (between outer walls)
      { id: 'red_gromp', position: new Vector(750, 550), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },
      // Spider camp - central maze pocket
      { id: 'red_spiders', position: new Vector(600, 150), creatureType: 'spider' as const, count: 3, respawnTime: 45 },
      // Gromp camp - pocket near mid lane entrance
      { id: 'red_gromp_2', position: new Vector(300, 50), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },
      // Wolf camp - upper jungle maze pocket
      { id: 'red_wolves', position: new Vector(800, -100), creatureType: 'wolf' as const, count: 2, respawnTime: 50 },
      // Gromp camp - pocket near top lane
      { id: 'red_gromp_3', position: new Vector(450, -300), creatureType: 'gromp' as const, count: 1, respawnTime: 60 },

      // ========== RIVER OBJECTIVES (center) ==========
      // These could be dragon/baron equivalents later
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
        sightRange: 180, // Reduced sight range
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
        sightRange: 200, // Reduced sight range
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
        sightRange: 220, // Reduced sight range
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
        sightRange: 150, // Reduced sight range
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
        sightRange: 220, // Reduced sight range
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
        sightRange: 220, // Reduced sight range
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
        sightRange: 250, // Reduced sight range
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
        sightRange: 300, // Reduced sight range
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
        sightRange: 180, // Reduced sight range
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
    /** Offset from nexus for spawn position (must be > NEXUS.RADIUS to spawn outside blocked area) */
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
   * Each group contains multiple bushes placed together to form a larger area.
   * Bushes provide vision cover - units inside are invisible to enemies
   * unless the enemy is in the same bush or a ward reveals the bush.
   *
   * SYMMETRY: Blue bushes at (-x, -y) mirror to Red bushes at (x, y)
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

    // ========== BLUE JUNGLE BUSHES (maze ambush spots) ==========
    { center: new Vector(-950, -550), bushCount: 3, spread: 'cluster' as const },   // Near top entrance
    { center: new Vector(-650, -400), bushCount: 4, spread: 'cluster' as const },   // Central upper jungle
    { center: new Vector(-500, -50), bushCount: 3, spread: 'cluster' as const },    // Near mid lane
    { center: new Vector(-850, 200), bushCount: 4, spread: 'cluster' as const },    // Lower jungle
    { center: new Vector(-500, 400), bushCount: 3, spread: 'cluster' as const },    // Near bot entrance

    // ========== RED JUNGLE BUSHES (maze ambush spots) ==========
    { center: new Vector(950, 550), bushCount: 3, spread: 'cluster' as const },     // Near bot entrance
    { center: new Vector(650, 400), bushCount: 4, spread: 'cluster' as const },     // Central lower jungle
    { center: new Vector(500, 50), bushCount: 3, spread: 'cluster' as const },      // Near mid lane
    { center: new Vector(850, -200), bushCount: 4, spread: 'cluster' as const },    // Upper jungle
    { center: new Vector(500, -400), bushCount: 3, spread: 'cluster' as const },    // Near top entrance

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
  },

  /**
   * Wall configuration.
   * Walls are impassable terrain that block movement.
   * They define the jungle areas and create strategic chokepoints.
   *
   * Layout creates two mirrored jungle quadrants forming a MAZE:
   * - Blue jungle: upper-left (between top lane and mid lane)
   * - Red jungle: lower-right (between mid lane and bot lane)
   *
   * Each jungle has walls that:
   * - Separate jungle from lanes
   * - Create winding paths and chokepoints
   * - Provide strategic cover and ambush spots
   * - Form a maze-like structure
   *
   * SYMMETRY: Blue walls at (-x, -y) mirror to Red walls at (x, y)
   */
  /**
   * Wall sizes are aligned to tile size (64 units).
   * Minimum height is 128 (2 tiles) for proper cliff rendering:
   * - Row 0: grassWithCliffEdge (the grass surface with cliff edge)
   * - Row 1: cliff.top (the visible cliff face)
   *
   * For taller walls (3+ tiles):
   * - Additional cliff.middle and cliff.bottom tiles are added
   * - 4+ tile walls get elevatedGrass on top
   *
   * Note: Walls are currently disabled to simplify the map layout.
   */
  WALLS: [] as { position: Vector; width: number; height: number }[],

  /**
   * Tower positions and configuration.
   * Each lane has 2 towers per side (outer and inner).
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
      // Top lane towers (along left wall going up)
      { side: 0 as const, lane: 'top' as const, position: new Vector(-1200, 700) },
      { side: 0 as const, lane: 'top' as const, position: new Vector(-1200, 200) },

      // Mid lane towers (along diagonal)
      { side: 0 as const, lane: 'mid' as const, position: new Vector(-650, 650) },
      { side: 0 as const, lane: 'mid' as const, position: new Vector(-350, 350) },

      // Bot lane towers (along bottom going right)
      { side: 0 as const, lane: 'bot' as const, position: new Vector(-200, 1200) },
      { side: 0 as const, lane: 'bot' as const, position: new Vector(400, 1200) },

      // ========== RED SIDE (1) ==========
      // Top lane towers (along top going right)
      { side: 1 as const, lane: 'top' as const, position: new Vector(200, -1200) },
      { side: 1 as const, lane: 'top' as const, position: new Vector(-400, -1200) },

      // Mid lane towers (along diagonal)
      { side: 1 as const, lane: 'mid' as const, position: new Vector(650, -650) },
      { side: 1 as const, lane: 'mid' as const, position: new Vector(350, -350) },

      // Bot lane towers (along right wall going down)
      { side: 1 as const, lane: 'bot' as const, position: new Vector(1200, -700) },
      { side: 1 as const, lane: 'bot' as const, position: new Vector(1200, -200) },
    ],
  },

  /**
   * Map decorations - non-interactive visual elements.
   * Positioned to complement the maze jungle layout.
   *
   * SYMMETRY: Blue decorations at (-x, -y) mirror to Red decorations at (x, y)
   */
  DECORATIONS: [
    // ========== BLUE JUNGLE DECORATIONS (maze pockets) ==========
    // Near blue gromp (top pocket)
    { position: new Vector(-850, -600), type: 'rock_big' as const, scale: 0.75 },
    { position: new Vector(-650, -500), type: 'mushroom_mid' as const, scale: 0.55 },
    // Central maze area
    { position: new Vector(-700, -250), type: 'plant_2' as const, scale: 0.7 },
    { position: new Vector(-500, -200), type: 'rock_small' as const, scale: 0.6 },
    // Near blue wolves (lower maze)
    { position: new Vector(-900, 50), type: 'mushroom_big' as const, scale: 0.55 },
    { position: new Vector(-700, 180), type: 'plant_1' as const, scale: 0.6 },
    // Near bot entrance
    { position: new Vector(-550, 350), type: 'rock_mid' as const, scale: 0.65 },
    { position: new Vector(-350, 250), type: 'plant_3' as const, scale: 0.5 },

    // ========== RED JUNGLE DECORATIONS (maze pockets) ==========
    // Near red gromp (bot pocket)
    { position: new Vector(850, 600), type: 'rock_big' as const, scale: 0.75, flipX: true },
    { position: new Vector(650, 500), type: 'mushroom_mid' as const, scale: 0.55 },
    // Central maze area
    { position: new Vector(700, 250), type: 'plant_2' as const, scale: 0.7, flipX: true },
    { position: new Vector(500, 200), type: 'rock_small' as const, scale: 0.6 },
    // Near red wolves (upper maze)
    { position: new Vector(900, -50), type: 'mushroom_big' as const, scale: 0.55 },
    { position: new Vector(700, -180), type: 'plant_1' as const, scale: 0.6, flipX: true },
    // Near top entrance
    { position: new Vector(550, -350), type: 'rock_mid' as const, scale: 0.65 },
    { position: new Vector(350, -250), type: 'plant_3' as const, scale: 0.5, flipX: true },

    // ========== LANE EDGE DECORATIONS ==========
    // Top lane
    { position: new Vector(-500, -1050), type: 'plant_3' as const, scale: 0.5 },
    { position: new Vector(300, -1100), type: 'rock_small' as const, scale: 0.5 },
    // Bot lane
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

export default MOBAConfig;
