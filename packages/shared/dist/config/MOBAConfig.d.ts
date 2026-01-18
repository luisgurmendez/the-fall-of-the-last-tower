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
export declare const MOBAConfig: {
    /**
     * Map dimensions in world units.
     * World is centered at (0,0), so coordinates range from -1800 to +1800.
     */
    readonly MAP_SIZE: {
        readonly width: 3600;
        readonly height: 3600;
    };
    /**
     * Width of the water border around the map.
     * This acts as a virtual wall - units cannot walk into water.
     */
    readonly WATER_BORDER_SIZE: 192;
    /**
     * Nexus configuration.
     * Using centered coordinates: (0,0) is center of map.
     * Blue at bottom-left (-1200, 1200), Red at top-right (1200, -1200)
     */
    readonly NEXUS: {
        readonly BLUE: {
            readonly x: -1200;
            readonly y: 1200;
        };
        readonly RED: {
            readonly x: 1200;
            readonly y: -1200;
        };
        readonly RADIUS: 75;
        readonly HEALTH: 5000;
    };
    /**
     * Lane waypoints from Blue base to Red base.
     * Each lane has waypoints that minions follow.
     * Note: In this coordinate system, +Y is DOWN (toward blue), -Y is UP (toward red)
     */
    readonly LANES: {
        readonly TOP: {
            readonly id: "top";
            readonly waypoints: readonly [Vector, Vector, Vector, Vector];
            readonly width: 100;
        };
        readonly MID: {
            readonly id: "mid";
            readonly waypoints: readonly [Vector, Vector, Vector, Vector, Vector];
            readonly width: 100;
        };
        readonly BOT: {
            readonly id: "bot";
            readonly waypoints: readonly [Vector, Vector, Vector, Vector];
            readonly width: 100;
        };
    };
    /**
     * Jungle configuration.
     */
    readonly JUNGLE: {
        /**
         * Camp spawn positions and configurations.
         */
        readonly CAMPS: readonly [{
            readonly id: "blue_gromp";
            readonly position: Vector;
            readonly creatureType: "gromp";
            readonly count: 1;
            readonly respawnTime: 60;
        }, {
            readonly id: "blue_spiders";
            readonly position: Vector;
            readonly creatureType: "spider";
            readonly count: 3;
            readonly respawnTime: 45;
        }, {
            readonly id: "blue_gromp_2";
            readonly position: Vector;
            readonly creatureType: "gromp";
            readonly count: 1;
            readonly respawnTime: 60;
        }, {
            readonly id: "blue_wolves";
            readonly position: Vector;
            readonly creatureType: "wolf";
            readonly count: 2;
            readonly respawnTime: 50;
        }, {
            readonly id: "blue_gromp_3";
            readonly position: Vector;
            readonly creatureType: "gromp";
            readonly count: 1;
            readonly respawnTime: 60;
        }, {
            readonly id: "red_gromp";
            readonly position: Vector;
            readonly creatureType: "gromp";
            readonly count: 1;
            readonly respawnTime: 60;
        }, {
            readonly id: "red_spiders";
            readonly position: Vector;
            readonly creatureType: "spider";
            readonly count: 3;
            readonly respawnTime: 45;
        }, {
            readonly id: "red_gromp_2";
            readonly position: Vector;
            readonly creatureType: "gromp";
            readonly count: 1;
            readonly respawnTime: 60;
        }, {
            readonly id: "red_wolves";
            readonly position: Vector;
            readonly creatureType: "wolf";
            readonly count: 2;
            readonly respawnTime: 50;
        }, {
            readonly id: "red_gromp_3";
            readonly position: Vector;
            readonly creatureType: "gromp";
            readonly count: 1;
            readonly respawnTime: 60;
        }];
        /**
         * Stats for each creature type.
         */
        readonly CREATURE_STATS: {
            readonly gromp: {
                readonly health: 500;
                readonly damage: 30;
                readonly attackRange: 80;
                readonly attackCooldown: 1.5;
                readonly movementSpeed: 80;
                readonly sightRange: 180;
                readonly leashRange: 300;
                readonly goldReward: 80;
                readonly expReward: 50;
            };
            readonly wolf: {
                readonly health: 350;
                readonly damage: 25;
                readonly attackRange: 60;
                readonly attackCooldown: 1;
                readonly movementSpeed: 120;
                readonly sightRange: 200;
                readonly leashRange: 300;
                readonly goldReward: 60;
                readonly expReward: 40;
            };
            readonly raptor: {
                readonly health: 200;
                readonly damage: 20;
                readonly attackRange: 100;
                readonly attackCooldown: 1.2;
                readonly movementSpeed: 100;
                readonly sightRange: 220;
                readonly leashRange: 300;
                readonly goldReward: 40;
                readonly expReward: 30;
            };
            readonly krug: {
                readonly health: 600;
                readonly damage: 35;
                readonly attackRange: 70;
                readonly attackCooldown: 1.8;
                readonly movementSpeed: 60;
                readonly sightRange: 150;
                readonly leashRange: 300;
                readonly goldReward: 90;
                readonly expReward: 55;
            };
            readonly blue_buff: {
                readonly health: 1200;
                readonly damage: 50;
                readonly attackRange: 100;
                readonly attackCooldown: 1.4;
                readonly movementSpeed: 80;
                readonly sightRange: 220;
                readonly leashRange: 350;
                readonly goldReward: 120;
                readonly expReward: 100;
            };
            readonly red_buff: {
                readonly health: 1200;
                readonly damage: 60;
                readonly attackRange: 80;
                readonly attackCooldown: 1.2;
                readonly movementSpeed: 80;
                readonly sightRange: 220;
                readonly leashRange: 350;
                readonly goldReward: 120;
                readonly expReward: 100;
            };
            readonly dragon: {
                readonly health: 2500;
                readonly damage: 100;
                readonly attackRange: 150;
                readonly attackCooldown: 2;
                readonly movementSpeed: 50;
                readonly sightRange: 250;
                readonly leashRange: 400;
                readonly goldReward: 200;
                readonly expReward: 250;
            };
            readonly baron: {
                readonly health: 5000;
                readonly damage: 150;
                readonly attackRange: 200;
                readonly attackCooldown: 2.5;
                readonly movementSpeed: 40;
                readonly sightRange: 300;
                readonly leashRange: 450;
                readonly goldReward: 500;
                readonly expReward: 500;
            };
            readonly spider: {
                readonly health: 300;
                readonly damage: 22;
                readonly attackRange: 70;
                readonly attackCooldown: 0.9;
                readonly movementSpeed: 130;
                readonly sightRange: 180;
                readonly leashRange: 300;
                readonly goldReward: 50;
                readonly expReward: 35;
            };
        };
    };
    /**
     * Minion wave configuration.
     */
    readonly MINION_WAVES: {
        /** Time between wave spawns in seconds */
        readonly SPAWN_INTERVAL: 30;
        /** First wave spawns after this delay */
        readonly FIRST_WAVE_DELAY: 5;
        /** Delay between each minion spawn in a wave */
        readonly SPAWN_DELAY_BETWEEN: 0.3;
        /** Composition of each wave */
        readonly WAVE_COMPOSITION: {
            readonly swordsmen: 3;
            readonly archers: 2;
        };
        /** Offset from nexus for spawn position */
        readonly SPAWN_OFFSET: 100;
    };
    /**
     * Spawning positions for champions.
     */
    readonly CHAMPION_SPAWN: {
        readonly BLUE: Vector;
        readonly RED: Vector;
    };
    /**
     * Bush group positions and configuration.
     */
    readonly BUSH_GROUPS: readonly [{
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "horizontal";
    }, {
        readonly center: Vector;
        readonly bushCount: 3;
        readonly spread: "horizontal";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "horizontal";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "diagonal";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "diagonal";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "horizontal";
    }, {
        readonly center: Vector;
        readonly bushCount: 3;
        readonly spread: "horizontal";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "horizontal";
    }, {
        readonly center: Vector;
        readonly bushCount: 3;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 3;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 3;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 3;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 3;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 3;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "cluster";
    }, {
        readonly center: Vector;
        readonly bushCount: 4;
        readonly spread: "cluster";
    }];
    /**
     * Bush rendering settings.
     */
    readonly BUSH_SETTINGS: {
        /** Spacing between bushes in a group */
        readonly SPACING: 35;
        /** Random offset variance for natural look */
        readonly OFFSET_VARIANCE: 10;
    };
    /**
     * Wall configuration (tile-aligned to 64 unit grid).
     * Minimum height is 128 (2 tiles) for proper cliff rendering.
     */
    readonly WALLS: readonly [{
        readonly position: Vector;
        readonly width: 384;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 192;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 256;
    }, {
        readonly position: Vector;
        readonly width: 192;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 192;
    }, {
        readonly position: Vector;
        readonly width: 192;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 256;
    }, {
        readonly position: Vector;
        readonly width: 192;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 192;
    }, {
        readonly position: Vector;
        readonly width: 256;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 192;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 192;
    }, {
        readonly position: Vector;
        readonly width: 384;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 192;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 256;
    }, {
        readonly position: Vector;
        readonly width: 192;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 192;
    }, {
        readonly position: Vector;
        readonly width: 192;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 256;
    }, {
        readonly position: Vector;
        readonly width: 192;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 192;
    }, {
        readonly position: Vector;
        readonly width: 256;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 192;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 192;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 128;
    }, {
        readonly position: Vector;
        readonly width: 128;
        readonly height: 128;
    }];
    /**
     * Tower positions and configuration.
     */
    readonly TOWERS: {
        /** Default tower stats */
        readonly STATS: {
            readonly health: 3000;
            readonly attackDamage: 150;
            readonly attackRange: 350;
            readonly attackCooldown: 1;
            readonly armor: 60;
            readonly magicResist: 60;
        };
        /** Tower positions by side and lane */
        readonly POSITIONS: readonly [{
            readonly side: 0;
            readonly lane: "top";
            readonly position: Vector;
        }, {
            readonly side: 0;
            readonly lane: "top";
            readonly position: Vector;
        }, {
            readonly side: 0;
            readonly lane: "mid";
            readonly position: Vector;
        }, {
            readonly side: 0;
            readonly lane: "mid";
            readonly position: Vector;
        }, {
            readonly side: 0;
            readonly lane: "bot";
            readonly position: Vector;
        }, {
            readonly side: 0;
            readonly lane: "bot";
            readonly position: Vector;
        }, {
            readonly side: 1;
            readonly lane: "top";
            readonly position: Vector;
        }, {
            readonly side: 1;
            readonly lane: "top";
            readonly position: Vector;
        }, {
            readonly side: 1;
            readonly lane: "mid";
            readonly position: Vector;
        }, {
            readonly side: 1;
            readonly lane: "mid";
            readonly position: Vector;
        }, {
            readonly side: 1;
            readonly lane: "bot";
            readonly position: Vector;
        }, {
            readonly side: 1;
            readonly lane: "bot";
            readonly position: Vector;
        }];
    };
    /**
     * Map decorations - non-interactive visual elements.
     */
    readonly DECORATIONS: readonly [{
        readonly position: Vector;
        readonly type: "rock_big";
        readonly scale: 0.75;
    }, {
        readonly position: Vector;
        readonly type: "mushroom_mid";
        readonly scale: 0.55;
    }, {
        readonly position: Vector;
        readonly type: "plant_2";
        readonly scale: 0.7;
    }, {
        readonly position: Vector;
        readonly type: "rock_small";
        readonly scale: 0.6;
    }, {
        readonly position: Vector;
        readonly type: "mushroom_big";
        readonly scale: 0.55;
    }, {
        readonly position: Vector;
        readonly type: "plant_1";
        readonly scale: 0.6;
    }, {
        readonly position: Vector;
        readonly type: "rock_mid";
        readonly scale: 0.65;
    }, {
        readonly position: Vector;
        readonly type: "plant_3";
        readonly scale: 0.5;
    }, {
        readonly position: Vector;
        readonly type: "rock_big";
        readonly scale: 0.75;
        readonly flipX: true;
    }, {
        readonly position: Vector;
        readonly type: "mushroom_mid";
        readonly scale: 0.55;
    }, {
        readonly position: Vector;
        readonly type: "plant_2";
        readonly scale: 0.7;
        readonly flipX: true;
    }, {
        readonly position: Vector;
        readonly type: "rock_small";
        readonly scale: 0.6;
    }, {
        readonly position: Vector;
        readonly type: "mushroom_big";
        readonly scale: 0.55;
    }, {
        readonly position: Vector;
        readonly type: "plant_1";
        readonly scale: 0.6;
        readonly flipX: true;
    }, {
        readonly position: Vector;
        readonly type: "rock_mid";
        readonly scale: 0.65;
    }, {
        readonly position: Vector;
        readonly type: "plant_3";
        readonly scale: 0.5;
        readonly flipX: true;
    }, {
        readonly position: Vector;
        readonly type: "plant_3";
        readonly scale: 0.5;
    }, {
        readonly position: Vector;
        readonly type: "rock_small";
        readonly scale: 0.5;
    }, {
        readonly position: Vector;
        readonly type: "plant_3";
        readonly scale: 0.5;
        readonly flipX: true;
    }, {
        readonly position: Vector;
        readonly type: "rock_small";
        readonly scale: 0.5;
    }, {
        readonly position: Vector;
        readonly type: "rock_small";
        readonly scale: 0.45;
    }, {
        readonly position: Vector;
        readonly type: "rock_small";
        readonly scale: 0.45;
    }, {
        readonly position: Vector;
        readonly type: "plant_1";
        readonly scale: 0.5;
    }, {
        readonly position: Vector;
        readonly type: "scarecrow";
        readonly scale: 0.5;
    }, {
        readonly position: Vector;
        readonly type: "scarecrow";
        readonly scale: 0.5;
        readonly flipX: true;
    }];
};
export type LaneId = 'top' | 'mid' | 'bot';
export type JungleCreatureType = keyof typeof MOBAConfig.JUNGLE.CREATURE_STATS;
export default MOBAConfig;
//# sourceMappingURL=MOBAConfig.d.ts.map