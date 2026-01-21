import Level from "@/core/level";
import Vector from "@/physics/vector";
import Background from "@/objects/background";
import { Rectangle, Square } from "@/objects/shapes";
import Swordsman from "@/objects/army/swordsman/swordsman";
import Castle from "@/objects/castle/castle";
import Player from "@/objects/player/player";
import { GameConfig } from "@/config";
import { GameMap, MapConfig } from "@/map";
import { Uruk } from "@/champions/implementations/Uruk";
import { Lyra } from "@/champions/implementations/Lyra";
import { ChampionController } from "@/core/ChampionController";
import { ChampionHUD } from "@/ui/ChampionHUD";
import { GameStatsHUD } from "@/ui/GameStatsHUD";
import { Minimap } from "@/ui/Minimap";

function generate() {
  // Create the game map with AoE-style terrain
  const gameMap = new GameMap();
  const worldDimensions: Rectangle = new Square(MapConfig.SIZE);

  // Get spawn points from the map
  const team0Spawn = gameMap.getSpawnPoint(0);
  const team1Spawn = gameMap.getSpawnPoint(1);

  // Create player-controlled champion (Lyra at level 18 with all abilities)
  const playerChampion = new Lyra(team0Spawn.clone().add(new Vector(100, 0)), 0);

  // Set level 18 and max abilities
  (playerChampion as any).state.level = 18;

  // Rank up Lyra's abilities to max (Q/W/E have 5 ranks, R has 3)
  const piercingShot = (playerChampion as any).piercingShot;
  const focus = (playerChampion as any).focus;
  const tumble = (playerChampion as any).tumble;
  const arrowStorm = (playerChampion as any).arrowStorm;

  for (let i = 0; i < 5; i++) {
    piercingShot.rankUp();
    focus.rankUp();
    tumble.rankUp();
  }
  for (let i = 0; i < 3; i++) {
    arrowStorm.rankUp();
  }

  // Create enemy champion to test abilities on
  const enemyChampion = new Uruk(team0Spawn.clone().add(new Vector(300, 0)), 1);
  (enemyChampion as any).state.level = 10;  // Lower level enemy

  // Create champion controller for player input
  const championController = new ChampionController();
  championController.setChampion(playerChampion);

  const level = new Level(
    [
      // Player champion (team 0)
      playerChampion,
      // Enemy champion (team 1) - for testing abilities
      enemyChampion,
      // Champion controller for input handling
      championController,
      // Initial allied units (team 0 - left base)
      new Swordsman(team0Spawn.clone().add(new Vector(50, 0)), 0),
      new Swordsman(team0Spawn.clone().add(new Vector(50, 32)), 0),
      new Swordsman(team0Spawn.clone().add(new Vector(50, -32)), 0),
      // Initial enemy unit (team 1 - right base)
      new Swordsman(team1Spawn.clone().add(new Vector(-50, 0)), 1),
      // Core game objects
      new Castle(),
      new Background(worldDimensions, gameMap),
      new Player(),
      new ChampionHUD({
        accentColor: '#00CED1',
        championName: 'Lyra',
        showManaBar: true,
        resourceColor: '#3498db',
        resourceName: 'Mana',
      }, playerChampion),
      // Game stats (time and FPS) in top right
      new GameStatsHUD(),
      // Minimap at bottom left
      new Minimap({
        size: 200,
        margin: 16,
        corner: 'bottom-left',
      })
    ],
    worldDimensions
  );
  level.camera.zoom = GameConfig.CAMERA.INITIAL_ZOOM;
  return level;
}

export default generate;
