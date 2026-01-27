/**
 * Network message type definitions.
 * Shared between client and server.
 */
/**
 * Input message types from client to server.
 */
export var InputType;
(function (InputType) {
    /** Move to position */
    InputType[InputType["MOVE"] = 0] = "MOVE";
    /** Attack-move to position */
    InputType[InputType["ATTACK_MOVE"] = 1] = "ATTACK_MOVE";
    /** Target a specific unit (attack/follow) */
    InputType[InputType["TARGET_UNIT"] = 2] = "TARGET_UNIT";
    /** Stop current action */
    InputType[InputType["STOP"] = 3] = "STOP";
    /** Cast ability */
    InputType[InputType["ABILITY"] = 4] = "ABILITY";
    /** Level up ability */
    InputType[InputType["LEVEL_UP"] = 5] = "LEVEL_UP";
    /** Buy item */
    InputType[InputType["BUY_ITEM"] = 6] = "BUY_ITEM";
    /** Sell item */
    InputType[InputType["SELL_ITEM"] = 7] = "SELL_ITEM";
    /** Recall to base */
    InputType[InputType["RECALL"] = 8] = "RECALL";
    /** Ping map */
    InputType[InputType["PING"] = 9] = "PING";
    /** Chat message */
    InputType[InputType["CHAT"] = 10] = "CHAT";
    /** Place a ward */
    InputType[InputType["PLACE_WARD"] = 11] = "PLACE_WARD";
})(InputType || (InputType = {}));
/**
 * Entity types in the game.
 */
export var EntityType;
(function (EntityType) {
    EntityType[EntityType["CHAMPION"] = 0] = "CHAMPION";
    EntityType[EntityType["MINION"] = 1] = "MINION";
    EntityType[EntityType["TOWER"] = 2] = "TOWER";
    EntityType[EntityType["INHIBITOR"] = 3] = "INHIBITOR";
    EntityType[EntityType["NEXUS"] = 4] = "NEXUS";
    EntityType[EntityType["JUNGLE_CAMP"] = 5] = "JUNGLE_CAMP";
    EntityType[EntityType["PROJECTILE"] = 6] = "PROJECTILE";
    EntityType[EntityType["WARD"] = 7] = "WARD";
    EntityType[EntityType["ZONE"] = 8] = "ZONE";
    EntityType[EntityType["LIGHT_ORB"] = 9] = "LIGHT_ORB";
})(EntityType || (EntityType = {}));
/**
 * Bitmask for which entity fields have changed.
 */
export var EntityChangeMask;
(function (EntityChangeMask) {
    EntityChangeMask[EntityChangeMask["POSITION"] = 1] = "POSITION";
    EntityChangeMask[EntityChangeMask["HEALTH"] = 2] = "HEALTH";
    EntityChangeMask[EntityChangeMask["RESOURCE"] = 4] = "RESOURCE";
    EntityChangeMask[EntityChangeMask["LEVEL"] = 8] = "LEVEL";
    EntityChangeMask[EntityChangeMask["EFFECTS"] = 16] = "EFFECTS";
    EntityChangeMask[EntityChangeMask["ABILITIES"] = 32] = "ABILITIES";
    EntityChangeMask[EntityChangeMask["ITEMS"] = 64] = "ITEMS";
    EntityChangeMask[EntityChangeMask["TARGET"] = 128] = "TARGET";
    EntityChangeMask[EntityChangeMask["STATE"] = 256] = "STATE";
    EntityChangeMask[EntityChangeMask["TRINKET"] = 512] = "TRINKET";
    EntityChangeMask[EntityChangeMask["GOLD"] = 1024] = "GOLD";
    EntityChangeMask[EntityChangeMask["SHIELDS"] = 2048] = "SHIELDS";
    EntityChangeMask[EntityChangeMask["PASSIVE"] = 4096] = "PASSIVE";
})(EntityChangeMask || (EntityChangeMask = {}));
/**
 * Game event types.
 */
export var GameEventType;
(function (GameEventType) {
    GameEventType[GameEventType["CHAMPION_KILL"] = 0] = "CHAMPION_KILL";
    GameEventType[GameEventType["TOWER_DESTROYED"] = 1] = "TOWER_DESTROYED";
    GameEventType[GameEventType["DRAGON_KILLED"] = 2] = "DRAGON_KILLED";
    GameEventType[GameEventType["BARON_KILLED"] = 3] = "BARON_KILLED";
    GameEventType[GameEventType["INHIBITOR_DESTROYED"] = 4] = "INHIBITOR_DESTROYED";
    GameEventType[GameEventType["INHIBITOR_RESPAWNED"] = 5] = "INHIBITOR_RESPAWNED";
    GameEventType[GameEventType["NEXUS_DESTROYED"] = 6] = "NEXUS_DESTROYED";
    GameEventType[GameEventType["FIRST_BLOOD"] = 7] = "FIRST_BLOOD";
    GameEventType[GameEventType["ACE"] = 8] = "ACE";
    GameEventType[GameEventType["MULTI_KILL"] = 9] = "MULTI_KILL";
    GameEventType[GameEventType["ABILITY_CAST"] = 10] = "ABILITY_CAST";
    GameEventType[GameEventType["ITEM_PURCHASED"] = 11] = "ITEM_PURCHASED";
    GameEventType[GameEventType["LEVEL_UP"] = 12] = "LEVEL_UP";
    /** Basic attack animation event */
    GameEventType[GameEventType["BASIC_ATTACK"] = 13] = "BASIC_ATTACK";
    /** Damage dealt to an entity */
    GameEventType[GameEventType["DAMAGE"] = 14] = "DAMAGE";
    /** Gold earned by a champion (non-passive) */
    GameEventType[GameEventType["GOLD_EARNED"] = 15] = "GOLD_EARNED";
    /** XP earned by a champion */
    GameEventType[GameEventType["XP_EARNED"] = 16] = "XP_EARNED";
})(GameEventType || (GameEventType = {}));
/**
 * Server message types.
 */
export var ServerMessageType;
(function (ServerMessageType) {
    /** Full state snapshot */
    ServerMessageType[ServerMessageType["FULL_STATE"] = 0] = "FULL_STATE";
    /** Delta state update */
    ServerMessageType[ServerMessageType["STATE_UPDATE"] = 1] = "STATE_UPDATE";
    /** Game event */
    ServerMessageType[ServerMessageType["EVENT"] = 2] = "EVENT";
    /** Error message */
    ServerMessageType[ServerMessageType["ERROR"] = 3] = "ERROR";
    /** Ping response */
    ServerMessageType[ServerMessageType["PONG"] = 4] = "PONG";
    /** Game start */
    ServerMessageType[ServerMessageType["GAME_START"] = 5] = "GAME_START";
    /** Game end */
    ServerMessageType[ServerMessageType["GAME_END"] = 6] = "GAME_END";
})(ServerMessageType || (ServerMessageType = {}));
/**
 * Client message types.
 */
export var ClientMessageType;
(function (ClientMessageType) {
    /** Player input */
    ClientMessageType[ClientMessageType["INPUT"] = 0] = "INPUT";
    /** Ping request */
    ClientMessageType[ClientMessageType["PING"] = 1] = "PING";
    /** Ready to start */
    ClientMessageType[ClientMessageType["READY"] = 2] = "READY";
    /** Event acknowledgment for reliable delivery */
    ClientMessageType[ClientMessageType["EVENT_ACK"] = 3] = "EVENT_ACK";
})(ClientMessageType || (ClientMessageType = {}));
//# sourceMappingURL=network.js.map