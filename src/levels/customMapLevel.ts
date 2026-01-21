/**
 * Custom Map Level Generator
 *
 * Creates a playable level from a custom map loaded from localStorage.
 */

import Level from "@/core/level";
import { Rectangle } from "@/objects/shapes";
import { GameConfig } from "@/config";
import { loadMap, MapData } from "@/mapBuilder";
import { CustomMapBackground } from "@/objects/CustomMapBackground";
import { CustomMOBAMap } from "@/map/CustomMOBAMap";
import { Lyra } from "@/champions/implementations/Lyra";
import { ChampionController } from "@/core/ChampionController";
import { ChampionHUD } from "@/ui/ChampionHUD";
import { GameStatsHUD } from "@/ui/GameStatsHUD";
import { Minimap } from "@/ui/Minimap";
import Player from "@/objects/player/player";

/**
 * Generate a level from custom map data stored in localStorage.
 */
export function generateCustomMapLevel(storageKey: string): Level | null {
  // Load map data from localStorage
  const storedData = localStorage.getItem(storageKey);
  if (!storedData) {
    console.error(`No map data found with key: ${storageKey}`);
    return null;
  }

  let mapData: MapData;
  try {
    mapData = JSON.parse(storedData);
  } catch (e) {
    console.error('Failed to parse map data:', e);
    return null;
  }

  // Load the map
  const loadedMap = loadMap(mapData);

  // Create world dimensions
  const worldDimensions = new Rectangle(loadedMap.size.width, loadedMap.size.height);

  // Create the custom MOBA map manager
  const customMap = new CustomMOBAMap(loadedMap);

  // Get player spawn position
  const playerSpawn = loadedMap.spawnPoints.blue;
  const playerSide = 0;

  // Create player champion
  const player = new Lyra(playerSpawn.clone(), playerSide);
  (player as any).state.level = 6;

  // Create champion controller
  const championController = new ChampionController();
  championController.setChampion(player);

  // Create HUD config
  const hudConfig = {
    accentColor: "#00CED1",
    championName: "Lyra",
    showManaBar: true,
    resourceColor: "#3498db",
    resourceName: "Mana",
  };

  // Build objects list
  const objects: any[] = [
    // Background with custom terrain
    new CustomMapBackground(worldDimensions, loadedMap),
    // Custom MOBA Map manager
    customMap,
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

  // Create level
  const level = new Level(objects, worldDimensions);

  // Set camera zoom and position
  level.camera.zoom = GameConfig.CAMERA.INITIAL_ZOOM;
  level.camera.position = playerSpawn.clone();

  return level;
}
