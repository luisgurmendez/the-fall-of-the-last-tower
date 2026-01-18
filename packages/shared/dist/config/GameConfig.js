/**
 * GameConfig - Core game configuration constants.
 * Shared between client and server.
 */
export const GameConfig = {
    /**
     * Tick rate configuration.
     */
    TICK: {
        /** Server tick rate (simulations per second) */
        SERVER_TICK_RATE: 30,
        /** Client render rate (frames per second) */
        CLIENT_RENDER_RATE: 60,
        /** Milliseconds per server tick */
        SERVER_TICK_MS: 1000 / 30,
        /** Input send rate from client */
        INPUT_SEND_RATE: 60,
    },
    /**
     * Network configuration.
     */
    NETWORK: {
        /** Interpolation delay in milliseconds (3 server ticks) */
        INTERPOLATION_DELAY: 100,
        /** Maximum lag compensation rewind in milliseconds */
        MAX_LAG_COMPENSATION: 250,
        /** Position snap threshold (units) */
        SNAP_THRESHOLD: 100,
        /** Position correction threshold (units) */
        CORRECTION_THRESHOLD: 5,
        /** Correction lerp factor */
        CORRECTION_LERP: 0.3,
        /** History buffer size (in ticks) */
        HISTORY_BUFFER_SIZE: 30,
    },
    /**
     * Game timing constants.
     */
    TIMING: {
        /** Game duration before surrender available (seconds) */
        SURRENDER_AVAILABLE_AT: 15 * 60,
        /** Reconnection grace period (seconds) */
        RECONNECT_GRACE_PERIOD: 5 * 60,
        /** AFK detection time (seconds) */
        AFK_TIMEOUT: 60,
        /** Recall time (seconds) */
        RECALL_DURATION: 8,
    },
    /**
     * Economy constants.
     */
    ECONOMY: {
        /** Starting gold */
        STARTING_GOLD: 500,
        /** Passive gold per second */
        PASSIVE_GOLD_PER_SECOND: 1.9,
        /** Gold for last-hitting a minion */
        MINION_GOLD: {
            melee: 21,
            caster: 14,
            siege: 60,
            super: 45,
        },
        /** Gold for champion kills (base) */
        CHAMPION_KILL_GOLD_BASE: 300,
        /** Gold for assists */
        ASSIST_GOLD_PERCENT: 0.5,
        /** Gold loss on death */
        DEATH_GOLD_LOSS: 0,
        /** Tower gold reward */
        TOWER_GOLD: {
            global: 50,
            killer: 150,
        },
    },
    /**
     * Experience constants.
     */
    EXPERIENCE: {
        /** XP range for sharing */
        XP_RANGE: 1400,
        /** Minion XP values */
        MINION_XP: {
            melee: 60,
            caster: 29,
            siege: 92,
            super: 97,
        },
        /** Champion kill XP (base) */
        CHAMPION_KILL_XP_BASE: 140,
        /** XP per level difference bonus */
        XP_PER_LEVEL_DIFF: 20,
    },
    /**
     * Combat constants.
     */
    COMBAT: {
        /** In-combat timeout (seconds since last damage dealt/taken) */
        COMBAT_TIMEOUT: 5,
        /** Out of combat health regen multiplier */
        OOC_REGEN_MULTIPLIER: 2.5,
        /** Armor/MR damage reduction formula cap */
        RESIST_CAP: 0.9,
        /** Critical strike damage multiplier */
        CRIT_DAMAGE_MULTIPLIER: 2.0,
    },
    /**
     * Vision constants.
     */
    VISION: {
        /** Default champion sight range */
        CHAMPION_SIGHT_RANGE: 1200,
        /** Ward sight range */
        WARD_SIGHT_RANGE: 900,
        /** Ward duration (seconds) */
        WARD_DURATION: 180,
        /** Max wards per player */
        MAX_WARDS: 3,
        /** Bush stealth reveal range */
        BUSH_REVEAL_RANGE: 100,
    },
    /**
     * Respawn constants.
     */
    RESPAWN: {
        /** Base respawn time (seconds) */
        BASE_RESPAWN_TIME: 6,
        /** Additional respawn time per level (seconds) */
        RESPAWN_TIME_PER_LEVEL: 2,
        /** Maximum respawn time (seconds) */
        MAX_RESPAWN_TIME: 60,
    },
    /**
     * Minion constants.
     */
    MINIONS: {
        /** Base minion health */
        MELEE_HEALTH: 470,
        CASTER_HEALTH: 290,
        SIEGE_HEALTH: 800,
        SUPER_HEALTH: 800,
        /** Base minion damage */
        MELEE_DAMAGE: 12,
        CASTER_DAMAGE: 23,
        SIEGE_DAMAGE: 40,
        SUPER_DAMAGE: 30,
        /** Minion movement speed */
        MOVEMENT_SPEED: 325,
    },
    /**
     * Maximum values for validation.
     */
    LIMITS: {
        /** Maximum champion level */
        MAX_LEVEL: 18,
        /** Maximum ability rank */
        MAX_ABILITY_RANK: 5,
        /** Maximum item slots */
        MAX_ITEM_SLOTS: 6,
        /** Maximum game duration (seconds) */
        MAX_GAME_DURATION: 60 * 60, // 1 hour
    },
};
export default GameConfig;
//# sourceMappingURL=GameConfig.js.map