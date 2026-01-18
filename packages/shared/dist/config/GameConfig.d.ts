/**
 * GameConfig - Core game configuration constants.
 * Shared between client and server.
 */
export declare const GameConfig: {
    /**
     * Tick rate configuration.
     */
    readonly TICK: {
        /** Server tick rate (simulations per second) */
        readonly SERVER_TICK_RATE: 30;
        /** Client render rate (frames per second) */
        readonly CLIENT_RENDER_RATE: 60;
        /** Milliseconds per server tick */
        readonly SERVER_TICK_MS: number;
        /** Input send rate from client */
        readonly INPUT_SEND_RATE: 60;
    };
    /**
     * Network configuration.
     */
    readonly NETWORK: {
        /** Interpolation delay in milliseconds (3 server ticks) */
        readonly INTERPOLATION_DELAY: 100;
        /** Maximum lag compensation rewind in milliseconds */
        readonly MAX_LAG_COMPENSATION: 250;
        /** Position snap threshold (units) */
        readonly SNAP_THRESHOLD: 100;
        /** Position correction threshold (units) */
        readonly CORRECTION_THRESHOLD: 5;
        /** Correction lerp factor */
        readonly CORRECTION_LERP: 0.3;
        /** History buffer size (in ticks) */
        readonly HISTORY_BUFFER_SIZE: 30;
    };
    /**
     * Game timing constants.
     */
    readonly TIMING: {
        /** Game duration before surrender available (seconds) */
        readonly SURRENDER_AVAILABLE_AT: number;
        /** Reconnection grace period (seconds) */
        readonly RECONNECT_GRACE_PERIOD: number;
        /** AFK detection time (seconds) */
        readonly AFK_TIMEOUT: 60;
        /** Recall time (seconds) */
        readonly RECALL_DURATION: 8;
    };
    /**
     * Economy constants.
     */
    readonly ECONOMY: {
        /** Starting gold */
        readonly STARTING_GOLD: 500;
        /** Passive gold per second */
        readonly PASSIVE_GOLD_PER_SECOND: 1.9;
        /** Gold for last-hitting a minion */
        readonly MINION_GOLD: {
            readonly melee: 21;
            readonly caster: 14;
            readonly siege: 60;
            readonly super: 45;
        };
        /** Gold for champion kills (base) */
        readonly CHAMPION_KILL_GOLD_BASE: 300;
        /** Gold for assists */
        readonly ASSIST_GOLD_PERCENT: 0.5;
        /** Gold loss on death */
        readonly DEATH_GOLD_LOSS: 0;
        /** Tower gold reward */
        readonly TOWER_GOLD: {
            readonly global: 50;
            readonly killer: 150;
        };
    };
    /**
     * Experience constants.
     */
    readonly EXPERIENCE: {
        /** XP range for sharing */
        readonly XP_RANGE: 1400;
        /** Minion XP values */
        readonly MINION_XP: {
            readonly melee: 60;
            readonly caster: 29;
            readonly siege: 92;
            readonly super: 97;
        };
        /** Champion kill XP (base) */
        readonly CHAMPION_KILL_XP_BASE: 140;
        /** XP per level difference bonus */
        readonly XP_PER_LEVEL_DIFF: 20;
    };
    /**
     * Combat constants.
     */
    readonly COMBAT: {
        /** In-combat timeout (seconds since last damage dealt/taken) */
        readonly COMBAT_TIMEOUT: 5;
        /** Out of combat health regen multiplier */
        readonly OOC_REGEN_MULTIPLIER: 2.5;
        /** Armor/MR damage reduction formula cap */
        readonly RESIST_CAP: 0.9;
        /** Critical strike damage multiplier */
        readonly CRIT_DAMAGE_MULTIPLIER: 2;
    };
    /**
     * Vision constants.
     */
    readonly VISION: {
        /** Default champion sight range */
        readonly CHAMPION_SIGHT_RANGE: 1200;
        /** Ward sight range */
        readonly WARD_SIGHT_RANGE: 900;
        /** Ward duration (seconds) */
        readonly WARD_DURATION: 180;
        /** Max wards per player */
        readonly MAX_WARDS: 3;
        /** Bush stealth reveal range */
        readonly BUSH_REVEAL_RANGE: 100;
    };
    /**
     * Respawn constants.
     */
    readonly RESPAWN: {
        /** Base respawn time (seconds) */
        readonly BASE_RESPAWN_TIME: 6;
        /** Additional respawn time per level (seconds) */
        readonly RESPAWN_TIME_PER_LEVEL: 2;
        /** Maximum respawn time (seconds) */
        readonly MAX_RESPAWN_TIME: 60;
    };
    /**
     * Minion constants.
     */
    readonly MINIONS: {
        /** Base minion health */
        readonly MELEE_HEALTH: 470;
        readonly CASTER_HEALTH: 290;
        readonly SIEGE_HEALTH: 800;
        readonly SUPER_HEALTH: 800;
        /** Base minion damage */
        readonly MELEE_DAMAGE: 12;
        readonly CASTER_DAMAGE: 23;
        readonly SIEGE_DAMAGE: 40;
        readonly SUPER_DAMAGE: 30;
        /** Minion movement speed */
        readonly MOVEMENT_SPEED: 325;
    };
    /**
     * Maximum values for validation.
     */
    readonly LIMITS: {
        /** Maximum champion level */
        readonly MAX_LEVEL: 18;
        /** Maximum ability rank */
        readonly MAX_ABILITY_RANK: 5;
        /** Maximum item slots */
        readonly MAX_ITEM_SLOTS: 6;
        /** Maximum game duration (seconds) */
        readonly MAX_GAME_DURATION: number;
    };
};
export default GameConfig;
//# sourceMappingURL=GameConfig.d.ts.map