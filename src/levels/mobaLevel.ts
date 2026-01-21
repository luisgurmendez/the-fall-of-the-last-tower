/**
 * MOBA Level Generator
 *
 * Creates a MOBA-style game with:
 * - Two nexuses (Blue and Red)
 * - Three lanes with minion waves
 * - Jungle camps with neutral monsters
 * - Player-controlled champion
 */

import Level from "@/core/level";
import { Rectangle } from "@/objects/shapes";
import { GameConfig } from "@/config";
import { MOBAMap, MOBAConfig } from "@/map";
import MOBABackground from "@/objects/MOBABackground";
import { Uruk } from "@/champions/implementations/Uruk";
import { Lyra } from "@/champions/implementations/Lyra";
import { ChampionController } from "@/core/ChampionController";
import { ChampionHUD } from "@/ui/ChampionHUD";
import { GameStatsHUD } from "@/ui/GameStatsHUD";
import { Minimap } from "@/ui/Minimap";
// Castle not used in MOBA level
import Player from "@/objects/player/player";

/**
 * Configuration for MOBA level generation.
 */
interface MOBALevelConfig {
  /** Champion type for player (default: 'lyra') */
  playerChampion?: "lyra" | "uruk";
  /** Player's team side (default: 0 = blue) */
  playerSide?: 0 | 1;
  /** Starting level for player champion (default: 1) */
  startingLevel?: number;
  /** Whether to spawn enemy champion (default: true) */
  spawnEnemyChampion?: boolean;
}

/**
 * Generate a MOBA level.
 */
function generate(config: MOBALevelConfig = {}): Level {
  const {
    playerChampion = "lyra",
    playerSide = 0,
    startingLevel = 1,
    spawnEnemyChampion = true,
  } = config;

  // Create the MOBA map
  const mobaMap = new MOBAMap();

  // Create world dimensions
  const { width, height } = MOBAConfig.MAP_SIZE;
  const worldDimensions: Rectangle = new Rectangle(width, height);

  // Get spawn positions
  const playerSpawn = mobaMap.getChampionSpawnPosition(playerSide);
  const enemySide = playerSide === 0 ? 1 : 0;
  const enemySpawn = mobaMap.getChampionSpawnPosition(enemySide);

  // Create player champion
  const player =
    playerChampion === "lyra"
      ? new Lyra(playerSpawn.clone(), playerSide)
      : new Uruk(playerSpawn.clone(), playerSide);

  // Set starting level
  if (startingLevel > 1) {
    (player as any).state.level = startingLevel;
  }

  // Create champion controller
  const championController = new ChampionController();
  championController.setChampion(player);

  // Create HUD config based on champion type
  const hudConfig =
    playerChampion === "lyra"
      ? {
          accentColor: "#00CED1",
          championName: "Lyra",
          showManaBar: true,
          resourceColor: "#3498db",
          resourceName: "Mana",
        }
      : {
          accentColor: "#8B4513",
          championName: "Uruk",
          showManaBar: false,
        };

  // Build objects list
  const objects: any[] = [
    // Background (must be first for rendering order)
    new MOBABackground(worldDimensions, mobaMap),
    // MOBA Map manager (handles nexuses, lanes, camps)
    mobaMap,
    // Player champion
    player,
    // Champion controller
    championController,
    // Player input handler
    new Player(),
    // UI elements
    new ChampionHUD(hudConfig, player),
    new GameStatsHUD(),
    new Minimap({
      size: 200,
      margin: 16,
      corner: "bottom-right",
    }),
  ];

  // Add enemy champion if configured
  if (spawnEnemyChampion) {
    const enemy =
      playerChampion === "lyra"
        ? new Uruk(enemySpawn.clone(), enemySide)
        : new Lyra(enemySpawn.clone(), enemySide);

    objects.push(enemy);
  }

  // Create level
  const level = new Level(objects, worldDimensions);

  // Initialize the MOBA map (spawns nexuses, starts minion waves, spawns jungle)
  // This will be called by the level's initialize phase

  // Set camera zoom and position
  level.camera.zoom = GameConfig.CAMERA.INITIAL_ZOOM;
  level.camera.position = playerSpawn.clone();

  return level;
}

/**
 * Generate a default MOBA level with Lyra on Blue team.
 */
function generateDefault(): Level {
  return generate({
    playerChampion: "lyra",
    playerSide: 0,
    startingLevel: 6,
    spawnEnemyChampion: true,
  });
}

export default generate;
export { generate, generateDefault };
