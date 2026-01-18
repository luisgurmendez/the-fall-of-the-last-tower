/**
 * MOBAConfig - Central configuration for the MOBA map.
 * Shared between client and server.
 *
 * All constants for map layout, lanes, jungle camps, and minion waves.
 */
import { Vector } from '../math/Vector';
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
            id: 'top',
            waypoints: [
                new Vector(-1200, 1200),
                new Vector(-1200, -1000),
                new Vector(-1000, -1200),
                new Vector(1200, -1200), // Reach red nexus
            ],
            width: 100,
        },
        MID: {
            id: 'mid',
            waypoints: [
                new Vector(-1200, 1200),
                new Vector(-750, 750),
                new Vector(0, 0),
                new Vector(750, -750),
                new Vector(1200, -1200), // Reach red nexus
            ],
            width: 100,
        },
        BOT: {
            id: 'bot',
            waypoints: [
                new Vector(-1200, 1200),
                new Vector(1000, 1200),
                new Vector(1200, 1000),
                new Vector(1200, -1200), // Reach red nexus
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
            { id: 'blue_gromp', position: new Vector(-750, -550), creatureType: 'gromp', count: 1, respawnTime: 60 },
            { id: 'blue_spiders', position: new Vector(-600, -150), creatureType: 'spider', count: 3, respawnTime: 45 },
            { id: 'blue_gromp_2', position: new Vector(-300, -50), creatureType: 'gromp', count: 1, respawnTime: 60 },
            { id: 'blue_wolves', position: new Vector(-800, 100), creatureType: 'wolf', count: 2, respawnTime: 50 },
            { id: 'blue_gromp_3', position: new Vector(-450, 300), creatureType: 'gromp', count: 1, respawnTime: 60 },
            // ========== RED SIDE JUNGLE ==========
            { id: 'red_gromp', position: new Vector(750, 550), creatureType: 'gromp', count: 1, respawnTime: 60 },
            { id: 'red_spiders', position: new Vector(600, 150), creatureType: 'spider', count: 3, respawnTime: 45 },
            { id: 'red_gromp_2', position: new Vector(300, 50), creatureType: 'gromp', count: 1, respawnTime: 60 },
            { id: 'red_wolves', position: new Vector(800, -100), creatureType: 'wolf', count: 2, respawnTime: 50 },
            { id: 'red_gromp_3', position: new Vector(450, -300), creatureType: 'gromp', count: 1, respawnTime: 60 },
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
        { center: new Vector(-900, -900), bushCount: 4, spread: 'horizontal' },
        { center: new Vector(0, -1000), bushCount: 3, spread: 'horizontal' },
        { center: new Vector(600, -900), bushCount: 4, spread: 'horizontal' },
        // ========== MID LANE BUSHES ==========
        { center: new Vector(-500, 500), bushCount: 4, spread: 'diagonal' },
        { center: new Vector(500, -500), bushCount: 4, spread: 'diagonal' },
        // ========== BOT LANE BUSHES ==========
        { center: new Vector(-600, 900), bushCount: 4, spread: 'horizontal' },
        { center: new Vector(0, 1000), bushCount: 3, spread: 'horizontal' },
        { center: new Vector(900, 900), bushCount: 4, spread: 'horizontal' },
        // ========== BLUE JUNGLE BUSHES ==========
        { center: new Vector(-950, -550), bushCount: 3, spread: 'cluster' },
        { center: new Vector(-650, -400), bushCount: 4, spread: 'cluster' },
        { center: new Vector(-500, -50), bushCount: 3, spread: 'cluster' },
        { center: new Vector(-850, 200), bushCount: 4, spread: 'cluster' },
        { center: new Vector(-500, 400), bushCount: 3, spread: 'cluster' },
        // ========== RED JUNGLE BUSHES ==========
        { center: new Vector(950, 550), bushCount: 3, spread: 'cluster' },
        { center: new Vector(650, 400), bushCount: 4, spread: 'cluster' },
        { center: new Vector(500, 50), bushCount: 3, spread: 'cluster' },
        { center: new Vector(850, -200), bushCount: 4, spread: 'cluster' },
        { center: new Vector(500, -400), bushCount: 3, spread: 'cluster' },
        // ========== RIVER/CENTER BUSHES ==========
        { center: new Vector(-150, -100), bushCount: 4, spread: 'cluster' },
        { center: new Vector(150, 100), bushCount: 4, spread: 'cluster' },
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
     * Wall configuration (tile-aligned to 64 unit grid).
     * Minimum height is 128 (2 tiles) for proper cliff rendering.
     */
    WALLS: [
        // ========== BLUE SIDE JUNGLE WALLS ==========
        { position: new Vector(-960, -768), width: 384, height: 128 },
        { position: new Vector(-544, -768), width: 192, height: 128 },
        { position: new Vector(-1088, -448), width: 128, height: 256 },
        { position: new Vector(-864, -448), width: 192, height: 128 },
        { position: new Vector(-736, -320), width: 128, height: 192 },
        { position: new Vector(-544, -352), width: 192, height: 128 },
        { position: new Vector(-416, -224), width: 128, height: 256 },
        { position: new Vector(-736, 0), width: 192, height: 128 },
        { position: new Vector(-896, 160), width: 128, height: 192 },
        { position: new Vector(-672, 256), width: 256, height: 128 },
        { position: new Vector(-544, 448), width: 192, height: 128 },
        { position: new Vector(-416, 352), width: 128, height: 192 },
        // ========== RED SIDE JUNGLE WALLS ==========
        { position: new Vector(960, 768), width: 384, height: 128 },
        { position: new Vector(544, 768), width: 192, height: 128 },
        { position: new Vector(1088, 448), width: 128, height: 256 },
        { position: new Vector(864, 448), width: 192, height: 128 },
        { position: new Vector(736, 320), width: 128, height: 192 },
        { position: new Vector(544, 352), width: 192, height: 128 },
        { position: new Vector(416, 224), width: 128, height: 256 },
        { position: new Vector(736, 0), width: 192, height: 128 },
        { position: new Vector(896, -160), width: 128, height: 192 },
        { position: new Vector(672, -256), width: 256, height: 128 },
        { position: new Vector(544, -448), width: 192, height: 128 },
        { position: new Vector(416, -352), width: 128, height: 192 },
        // ========== RIVER AREA WALLS ==========
        { position: new Vector(-192, -192), width: 128, height: 128 },
        { position: new Vector(192, 192), width: 128, height: 128 },
        { position: new Vector(-96, 96), width: 128, height: 128 },
        { position: new Vector(96, -96), width: 128, height: 128 },
    ],
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
            { side: 0, lane: 'top', position: new Vector(-1200, 700) },
            { side: 0, lane: 'top', position: new Vector(-1200, 200) },
            { side: 0, lane: 'mid', position: new Vector(-650, 650) },
            { side: 0, lane: 'mid', position: new Vector(-350, 350) },
            { side: 0, lane: 'bot', position: new Vector(-200, 1200) },
            { side: 0, lane: 'bot', position: new Vector(400, 1200) },
            // ========== RED SIDE (1) ==========
            { side: 1, lane: 'top', position: new Vector(200, -1200) },
            { side: 1, lane: 'top', position: new Vector(-400, -1200) },
            { side: 1, lane: 'mid', position: new Vector(650, -650) },
            { side: 1, lane: 'mid', position: new Vector(350, -350) },
            { side: 1, lane: 'bot', position: new Vector(1200, -700) },
            { side: 1, lane: 'bot', position: new Vector(1200, -200) },
        ],
    },
    /**
     * Map decorations - non-interactive visual elements.
     */
    DECORATIONS: [
        // ========== BLUE JUNGLE DECORATIONS ==========
        { position: new Vector(-850, -600), type: 'rock_big', scale: 0.75 },
        { position: new Vector(-650, -500), type: 'mushroom_mid', scale: 0.55 },
        { position: new Vector(-700, -250), type: 'plant_2', scale: 0.7 },
        { position: new Vector(-500, -200), type: 'rock_small', scale: 0.6 },
        { position: new Vector(-900, 50), type: 'mushroom_big', scale: 0.55 },
        { position: new Vector(-700, 180), type: 'plant_1', scale: 0.6 },
        { position: new Vector(-550, 350), type: 'rock_mid', scale: 0.65 },
        { position: new Vector(-350, 250), type: 'plant_3', scale: 0.5 },
        // ========== RED JUNGLE DECORATIONS ==========
        { position: new Vector(850, 600), type: 'rock_big', scale: 0.75, flipX: true },
        { position: new Vector(650, 500), type: 'mushroom_mid', scale: 0.55 },
        { position: new Vector(700, 250), type: 'plant_2', scale: 0.7, flipX: true },
        { position: new Vector(500, 200), type: 'rock_small', scale: 0.6 },
        { position: new Vector(900, -50), type: 'mushroom_big', scale: 0.55 },
        { position: new Vector(700, -180), type: 'plant_1', scale: 0.6, flipX: true },
        { position: new Vector(550, -350), type: 'rock_mid', scale: 0.65 },
        { position: new Vector(350, -250), type: 'plant_3', scale: 0.5, flipX: true },
        // ========== LANE EDGE DECORATIONS ==========
        { position: new Vector(-500, -1050), type: 'plant_3', scale: 0.5 },
        { position: new Vector(300, -1100), type: 'rock_small', scale: 0.5 },
        { position: new Vector(500, 1050), type: 'plant_3', scale: 0.5, flipX: true },
        { position: new Vector(-300, 1100), type: 'rock_small', scale: 0.5 },
        // ========== RIVER/CENTER DECORATIONS ==========
        { position: new Vector(-300, -150), type: 'rock_small', scale: 0.45 },
        { position: new Vector(300, 150), type: 'rock_small', scale: 0.45 },
        { position: new Vector(0, 0), type: 'plant_1', scale: 0.5 },
        // ========== BASE DECORATIONS ==========
        { position: new Vector(-1050, 1050), type: 'scarecrow', scale: 0.5 },
        { position: new Vector(1050, -1050), type: 'scarecrow', scale: 0.5, flipX: true },
    ],
};
export default MOBAConfig;
//# sourceMappingURL=MOBAConfig.js.map