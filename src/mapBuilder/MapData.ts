/**
 * MapData - Data structures for map serialization.
 *
 * Defines the JSON format for saving/loading custom maps.
 */

/**
 * Terrain types for the terrain grid.
 */
export type TerrainType = 'grass' | 'dirt' | 'stone' | 'water' | 'sand' | 'void';

/**
 * Terrain cell data.
 */
export interface TerrainCell {
  type: TerrainType;
}

/**
 * Wall data.
 */
export interface WallData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Individual bush within a group.
 */
export interface BushData {
  x: number;
  y: number;
  type: 'small' | 'large';
  scale: number;
}

/**
 * Bush group data.
 */
export interface BushGroupData {
  id: string;
  x: number;
  y: number;
  bushCount: number;
  spread: 'horizontal' | 'vertical' | 'diagonal' | 'cluster';
  /** Individual bushes in this group (auto-generated if not provided) */
  bushes?: BushData[];
}

/**
 * Tower data.
 */
export interface TowerData {
  id: string;
  x: number;
  y: number;
  side: 0 | 1;
  lane: 'top' | 'mid' | 'bot';
}

/**
 * Nexus data.
 */
export interface NexusData {
  id: string;
  x: number;
  y: number;
  side: 0 | 1;
}

/**
 * Jungle creature types available.
 */
export type JungleCreatureType = 'gromp' | 'wolf' | 'raptor' | 'krug' | 'blue_buff' | 'red_buff' | 'dragon' | 'baron';

/**
 * Jungle creature display info.
 */
export const JUNGLE_CREATURES: Record<JungleCreatureType, { name: string; icon: string; count: number; respawnTime: number }> = {
  gromp: { name: 'Gromp', icon: '🐸', count: 1, respawnTime: 60 },
  wolf: { name: 'Wolves', icon: '🐺', count: 3, respawnTime: 60 },
  raptor: { name: 'Raptors', icon: '🦅', count: 4, respawnTime: 60 },
  krug: { name: 'Krugs', icon: '🪨', count: 2, respawnTime: 60 },
  blue_buff: { name: 'Blue Sentinel', icon: '🔵', count: 1, respawnTime: 90 },
  red_buff: { name: 'Red Brambleback', icon: '🔴', count: 1, respawnTime: 90 },
  dragon: { name: 'Dragon', icon: '🐉', count: 1, respawnTime: 180 },
  baron: { name: 'Baron Nashor', icon: '👁️', count: 1, respawnTime: 300 },
};

/**
 * Jungle camp data.
 */
export interface JungleCampData {
  id: string;
  x: number;
  y: number;
  creatureType: JungleCreatureType;
  count: number;
  respawnTime: number;
}

/**
 * Lane waypoint.
 */
export interface LaneWaypoint {
  x: number;
  y: number;
}

/**
 * Lane data.
 */
export interface LaneData {
  id: string;
  name: string;
  waypoints: LaneWaypoint[];
  width: number;
}

/**
 * Decoration data.
 */
export interface DecorationData {
  id: string;
  x: number;
  y: number;
  type: 'tree' | 'rock' | 'flower' | 'mushroom' | 'stump';
  scale?: number;
  rotation?: number;
}

/**
 * Champion spawn point.
 */
export interface SpawnPointData {
  side: 0 | 1;
  x: number;
  y: number;
}

/**
 * Minion wave configuration.
 */
export interface MinionWaveConfig {
  spawnInterval: number;
  firstWaveDelay: number;
  spawnDelayBetween: number;
  composition: {
    swordsmen: number;
    archers: number;
  };
  spawnOffset: number;
}

/**
 * Complete map data structure.
 */
export interface MapData {
  /** Format version */
  version: '1.0';

  /** Map name */
  name: string;

  /** Map description */
  description?: string;

  /** Map dimensions in world units */
  size: {
    width: number;
    height: number;
  };

  /** Terrain grid (stored as 2D array of terrain types) */
  /** Grid cell size is defined by TERRAIN_CELL_SIZE */
  terrainGrid: TerrainType[][];

  /** Walls (impassable terrain) */
  walls: WallData[];

  /** Bush groups (vision blocking) */
  bushGroups: BushGroupData[];

  /** Towers */
  towers: TowerData[];

  /** Nexuses (exactly 2 - one per side) */
  nexuses: NexusData[];

  /** Jungle camps */
  jungleCamps: JungleCampData[];

  /** Lanes for minion pathing */
  lanes: LaneData[];

  /** Decorative elements */
  decorations: DecorationData[];

  /** Champion spawn points */
  spawnPoints: SpawnPointData[];

  /** Minion wave configuration */
  minionWaves: MinionWaveConfig;
}

/**
 * Terrain cell size in world units.
 */
export const TERRAIN_CELL_SIZE = 50;

/**
 * Terrain colors for rendering.
 */
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  grass: '#4a7c23',
  dirt: '#8b7355',
  stone: '#808080',
  water: '#4a90d9',
  sand: '#c2b280',
  void: '#1a1a2e',
};

/**
 * Generate a unique ID.
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Create a default empty map.
 */
export function createEmptyMap(width = 3000, height = 3000): MapData {
  const cols = Math.ceil(width / TERRAIN_CELL_SIZE);
  const rows = Math.ceil(height / TERRAIN_CELL_SIZE);

  // Create terrain grid filled with grass
  const terrainGrid: TerrainType[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < cols; x++) {
      row.push('grass');
    }
    terrainGrid.push(row);
  }

  return {
    version: '1.0',
    name: 'Untitled Map',
    description: '',
    size: { width, height },
    terrainGrid,
    walls: [],
    bushGroups: [],
    towers: [],
    nexuses: [],
    jungleCamps: [],
    lanes: [],
    decorations: [],
    spawnPoints: [
      { side: 0, x: -width / 2 + 200, y: height / 2 - 200 },
      { side: 1, x: width / 2 - 200, y: -height / 2 + 200 },
    ],
    minionWaves: {
      spawnInterval: 30,
      firstWaveDelay: 5,
      spawnDelayBetween: 0.3,
      composition: {
        swordsmen: 3,
        archers: 2,
      },
      spawnOffset: 100,
    },
  };
}

/**
 * Validate map data.
 */
export function validateMapData(data: unknown): data is MapData {
  if (!data || typeof data !== 'object') return false;

  const map = data as MapData;

  // Check required fields
  if (map.version !== '1.0') return false;
  if (typeof map.name !== 'string') return false;
  if (!map.size || typeof map.size.width !== 'number' || typeof map.size.height !== 'number') return false;
  if (!Array.isArray(map.terrainGrid)) return false;
  if (!Array.isArray(map.walls)) return false;
  if (!Array.isArray(map.bushGroups)) return false;
  if (!Array.isArray(map.towers)) return false;
  if (!Array.isArray(map.nexuses)) return false;
  if (!Array.isArray(map.jungleCamps)) return false;
  if (!Array.isArray(map.lanes)) return false;

  return true;
}

/**
 * Serialize map data to JSON string.
 */
export function serializeMap(map: MapData): string {
  return JSON.stringify(map, null, 2);
}

/**
 * Deserialize map data from JSON string.
 */
export function deserializeMap(json: string): MapData | null {
  try {
    const data = JSON.parse(json);
    if (validateMapData(data)) {
      return data;
    }
    console.error('Invalid map data format');
    return null;
  } catch (e) {
    console.error('Failed to parse map JSON:', e);
    return null;
  }
}
