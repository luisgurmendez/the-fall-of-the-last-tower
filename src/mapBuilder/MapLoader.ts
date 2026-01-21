/**
 * MapLoader - Converts MapData into playable game objects.
 *
 * Takes a MapData JSON and creates all the game entities needed
 * to play the map (walls, towers, lanes, etc.).
 */

import Vector from '@/physics/vector';
import { MapData, TERRAIN_CELL_SIZE, BushGroupData } from './MapData';
import { Wall } from '@/structures/Wall';
import { Tower } from '@/structures/Tower';
import { Nexus } from '@/structures/Nexus';
import { Lane } from '@/lanes/Lane';
import { JungleCamp } from '@/jungle/JungleCamp';
import BushGroup from '@/vision/BushGroup';
import { Bush, BushType } from '@/vision/Bush';
import NavigationGrid from '@/navigation/NavigationGrid';

/**
 * Result of loading a map.
 */
export interface LoadedMap {
  /** Map dimensions */
  size: { width: number; height: number };

  /** All game objects to add to the level */
  walls: Wall[];
  towers: Tower[];
  nexuses: Nexus[];
  lanes: Lane[];
  jungleCamps: JungleCamp[];
  bushGroups: BushGroup[];

  /** Navigation grid for pathfinding */
  navigationGrid: NavigationGrid;

  /** Spawn points */
  spawnPoints: {
    blue: Vector;
    red: Vector;
  };

  /** Minion wave config */
  minionWaves: {
    spawnInterval: number;
    firstWaveDelay: number;
    spawnDelayBetween: number;
    composition: { swordsmen: number; archers: number };
    spawnOffset: number;
  };

  /** Terrain data for background rendering */
  terrainGrid: string[][];
  terrainCellSize: number;
}

/**
 * Load a map from MapData.
 */
export function loadMap(mapData: MapData): LoadedMap {
  const { size, terrainGrid } = mapData;
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;

  // Create walls
  const walls: Wall[] = mapData.walls.map((wallData) => {
    return new Wall({
      position: new Vector(wallData.x, wallData.y),
      width: wallData.width,
      height: wallData.height,
    });
  });

  // Create towers
  const towers: Tower[] = mapData.towers.map((towerData) => {
    return new Tower({
      position: new Vector(towerData.x, towerData.y),
      side: towerData.side,
      health: 3000,
      attackDamage: 150,
      attackRange: 350,
      attackCooldown: 1.0,
      armor: 60,
      magicResist: 60,
    });
  });

  // Create nexuses
  const nexuses: Nexus[] = mapData.nexuses.map((nexusData) => {
    return new Nexus(nexusData.side, {
      position: new Vector(nexusData.x, nexusData.y),
      health: 5000,
      radius: 75,
    });
  });

  // Create lanes
  const lanes: Lane[] = mapData.lanes.map((laneData) => {
    const waypoints = laneData.waypoints.map((wp) => new Vector(wp.x, wp.y));
    return new Lane(laneData.id as 'top' | 'mid' | 'bot', waypoints, laneData.width);
  });

  // Create jungle camps
  const jungleCamps: JungleCamp[] = mapData.jungleCamps.map((campData) => {
    return new JungleCamp({
      id: campData.id,
      position: new Vector(campData.x, campData.y),
      creatureType: campData.creatureType,
      count: campData.count,
      respawnTime: campData.respawnTime,
    });
  });

  // Create bush groups with individual bushes
  const bushGroups: BushGroup[] = mapData.bushGroups.map((groupData) => {
    const group = new BushGroup(groupData.id, new Vector(groupData.x, groupData.y));

    // Calculate bush positions based on spread type
    const positions = calculateBushPositions(
      new Vector(groupData.x, groupData.y),
      groupData.bushCount,
      groupData.spread,
      35, // spacing
      10  // variance
    );

    // Create bushes and add to group
    for (let i = 0; i < positions.length; i++) {
      const bushType: BushType = i % 3 === 0 ? 'small' : 'large';
      const bush = new Bush({
        position: positions[i],
        type: bushType,
        scale: bushType === 'large' ? 0.9 : 0.7,
      });
      group.addBush(bush);
    }

    return group;
  });

  // Create navigation grid
  const navigationGrid = new NavigationGrid(size.width);

  // Mark walls as blocked
  for (const wall of walls) {
    navigationGrid.blockRectangle(
      wall.getPosition().x,
      wall.getPosition().y,
      wall.width,
      wall.height
    );
  }

  // Mark water terrain as blocked
  for (let y = 0; y < terrainGrid.length; y++) {
    for (let x = 0; x < terrainGrid[y].length; x++) {
      if (terrainGrid[y][x] === 'water' || terrainGrid[y][x] === 'void') {
        const worldX = x * TERRAIN_CELL_SIZE - halfWidth + TERRAIN_CELL_SIZE / 2;
        const worldY = y * TERRAIN_CELL_SIZE - halfHeight + TERRAIN_CELL_SIZE / 2;
        navigationGrid.blockRectangle(
          worldX,
          worldY,
          TERRAIN_CELL_SIZE,
          TERRAIN_CELL_SIZE
        );
      }
    }
  }

  // Mark tower areas as blocked
  for (const tower of towers) {
    navigationGrid.blockCircle(tower.getPosition().x, tower.getPosition().y, 40);
  }

  // Mark nexus areas as blocked
  for (const nexus of nexuses) {
    navigationGrid.blockCircle(nexus.getPosition().x, nexus.getPosition().y, 75);
  }

  // Get spawn points
  const blueSpawn = mapData.spawnPoints.find((sp) => sp.side === 0);
  const redSpawn = mapData.spawnPoints.find((sp) => sp.side === 1);

  return {
    size,
    walls,
    towers,
    nexuses,
    lanes,
    jungleCamps,
    bushGroups,
    navigationGrid,
    spawnPoints: {
      blue: blueSpawn ? new Vector(blueSpawn.x, blueSpawn.y) : new Vector(-halfWidth + 200, halfHeight - 200),
      red: redSpawn ? new Vector(redSpawn.x, redSpawn.y) : new Vector(halfWidth - 200, -halfHeight + 200),
    },
    minionWaves: mapData.minionWaves,
    terrainGrid,
    terrainCellSize: TERRAIN_CELL_SIZE,
  };
}

/**
 * Calculate positions for bushes in a group based on spread type.
 */
function calculateBushPositions(
  center: Vector,
  count: number,
  spread: 'horizontal' | 'vertical' | 'diagonal' | 'cluster',
  spacing: number,
  variance: number
): Vector[] {
  const positions: Vector[] = [];

  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;

    switch (spread) {
      case 'horizontal':
        x = (i - (count - 1) / 2) * spacing;
        break;
      case 'vertical':
        y = (i - (count - 1) / 2) * spacing;
        break;
      case 'diagonal':
        x = (i - (count - 1) / 2) * spacing * 0.7;
        y = (i - (count - 1) / 2) * spacing * 0.7;
        break;
      case 'cluster':
      default:
        // Arrange in a rough circle/cluster
        const angle = (i / count) * Math.PI * 2;
        const radius = spacing * (count > 4 ? 1.5 : 1);
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * radius;
        break;
    }

    // Add some random variance for natural look
    x += (Math.random() - 0.5) * variance * 2;
    y += (Math.random() - 0.5) * variance * 2;

    positions.push(new Vector(center.x + x, center.y + y));
  }

  return positions;
}

/**
 * Convert current MOBAConfig to MapData format.
 * Used to export the default map or as a starting template.
 */
export function exportDefaultMapToData(): MapData {
  // This would extract data from MOBAConfig
  // For now, we'll create it when needed
  const { MOBAConfig } = require('@/map/MOBAConfig');

  const mapData: MapData = {
    version: '1.0',
    name: 'Default MOBA Map',
    description: 'The default 3-lane MOBA map',
    size: {
      width: MOBAConfig.MAP_SIZE.width,
      height: MOBAConfig.MAP_SIZE.height,
    },
    terrainGrid: [], // Would need to generate
    walls: MOBAConfig.WALLS.map((w: any, i: number) => ({
      id: `wall_${i}`,
      x: w.position.x,
      y: w.position.y,
      width: w.width,
      height: w.height,
    })),
    bushGroups: MOBAConfig.BUSH_GROUPS.map((b: any, i: number) => ({
      id: `bush_${i}`,
      x: b.center.x,
      y: b.center.y,
      bushCount: b.bushCount,
      spread: b.spread,
    })),
    towers: MOBAConfig.TOWERS.POSITIONS.map((t: any, i: number) => ({
      id: `tower_${i}`,
      x: t.position.x,
      y: t.position.y,
      side: t.side,
      lane: t.lane,
    })),
    nexuses: [
      { id: 'nexus_blue', x: MOBAConfig.NEXUS.BLUE.x, y: MOBAConfig.NEXUS.BLUE.y, side: 0 },
      { id: 'nexus_red', x: MOBAConfig.NEXUS.RED.x, y: MOBAConfig.NEXUS.RED.y, side: 1 },
    ],
    jungleCamps: MOBAConfig.JUNGLE.CAMPS.map((c: any) => ({
      id: c.id,
      x: c.position.x,
      y: c.position.y,
      creatureType: c.creatureType,
      count: c.count,
      respawnTime: c.respawnTime,
    })),
    lanes: [
      {
        id: 'top',
        name: 'Top Lane',
        waypoints: MOBAConfig.LANES.TOP.waypoints.map((v: any) => ({ x: v.x, y: v.y })),
        width: MOBAConfig.LANES.TOP.width,
      },
      {
        id: 'mid',
        name: 'Mid Lane',
        waypoints: MOBAConfig.LANES.MID.waypoints.map((v: any) => ({ x: v.x, y: v.y })),
        width: MOBAConfig.LANES.MID.width,
      },
      {
        id: 'bot',
        name: 'Bot Lane',
        waypoints: MOBAConfig.LANES.BOT.waypoints.map((v: any) => ({ x: v.x, y: v.y })),
        width: MOBAConfig.LANES.BOT.width,
      },
    ],
    decorations: [],
    spawnPoints: [
      { side: 0, x: MOBAConfig.CHAMPION_SPAWN.BLUE.x, y: MOBAConfig.CHAMPION_SPAWN.BLUE.y },
      { side: 1, x: MOBAConfig.CHAMPION_SPAWN.RED.x, y: MOBAConfig.CHAMPION_SPAWN.RED.y },
    ],
    minionWaves: {
      spawnInterval: MOBAConfig.MINION_WAVES.SPAWN_INTERVAL,
      firstWaveDelay: MOBAConfig.MINION_WAVES.FIRST_WAVE_DELAY,
      spawnDelayBetween: MOBAConfig.MINION_WAVES.SPAWN_DELAY_BETWEEN,
      composition: MOBAConfig.MINION_WAVES.WAVE_COMPOSITION,
      spawnOffset: MOBAConfig.MINION_WAVES.SPAWN_OFFSET,
    },
  };

  // Generate terrain grid
  const cols = Math.ceil(mapData.size.width / TERRAIN_CELL_SIZE);
  const rows = Math.ceil(mapData.size.height / TERRAIN_CELL_SIZE);
  mapData.terrainGrid = [];
  for (let y = 0; y < rows; y++) {
    const row: string[] = [];
    for (let x = 0; x < cols; x++) {
      row.push('grass');
    }
    mapData.terrainGrid.push(row as any);
  }

  return mapData;
}
