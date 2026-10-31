/**
 * The ground drawn from generated Wang tilesets (scripts/generate-tilesets.ts).
 *
 * The map is a grid of vertices, each grass, path, water or rock: water
 * outside the playable area and along the river, path along the lanes,
 * rock inside the walls. A cell reads its four corner vertices and takes,
 * from a tileset, the tile with matching corners, so neighbors join
 * seamlessly. Layers go grass everywhere, then paths (grass_path), water
 * (grass_water, where grass is the "upper" terrain) and rock (grass_rock).
 * Plain tiles (one terrain at all four corners) are mirrored at random per
 * cell, so their texture doesn't repeat in a visible grid.
 */

import { MOBAConfig } from "@siege/shared";

/** World units per tile: 4 per 64-unit wall cell (smaller steps along diagonal lanes) */
export const TERRAIN_TILE_WORLD_SIZE = 16;

type Terrain = "grass" | "path" | "water" | "rock";
type Corner = "lower" | "upper" | "transition";

interface TileCorners {
  NW: Corner;
  NE: Corner;
  SW: Corner;
  SE: Corner;
}

interface Tileset {
  image: HTMLImageElement;
  tileSize: number;
  /** Tile index by its corners, "NW NE SW SE" */
  byCorners: Map<string, number>;
}

export interface TerrainTilesets {
  grassPath: Tileset;
  grassWater: Tileset;
  grassRock: Tileset;
}

/** Each layer: its tileset and which of its terrains is the layer's terrain */
const LAYERS: Array<{ terrain: Terrain; tileset: keyof TerrainTilesets; side: Corner }> = [
  { terrain: "path", tileset: "grassPath", side: "upper" },
  { terrain: "water", tileset: "grassWater", side: "lower" },
  { terrain: "rock", tileset: "grassRock", side: "upper" },
];

const cornerKey = (c: TileCorners) => `${c.NW} ${c.NE} ${c.SW} ${c.SE}`;

async function loadTileset(name: string): Promise<Tileset | null> {
  try {
    const response = await fetch(`/assets/tiles/${name}.json`);
    if (!response.ok) return null;
    const data = await response.json() as { tileSize: number; tiles: TileCorners[] };
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `/assets/tiles/${name}.png`;
    });
    const byCorners = new Map<string, number>();
    data.tiles.forEach((corners, index) => {
      if (!byCorners.has(cornerKey(corners))) byCorners.set(cornerKey(corners), index);
    });
    return { image, tileSize: data.tileSize, byCorners };
  } catch {
    return null;
  }
}

/**
 * The three tilesets, or null if any is missing (the old ground is drawn then).
 */
export async function loadTerrainTilesets(): Promise<TerrainTilesets | null> {
  const [grassPath, grassWater, grassRock] = await Promise.all([
    loadTileset("grass_path"),
    loadTileset("grass_water"),
    loadTileset("grass_rock"),
  ]);
  return grassPath && grassWater && grassRock ? { grassPath, grassWater, grassRock } : null;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function nearPolyline(x: number, y: number, points: ReadonlyArray<{ x: number; y: number }>, halfWidth: number): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(x, y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y) <= halfWidth) return true;
  }
  return false;
}

/**
 * What the ground is at a point (map coordinates, origin at the center).
 */
export function terrainAt(x: number, y: number): Terrain {
  const playableHalf = MOBAConfig.MAP_SIZE.width / 2 - MOBAConfig.WATER_BORDER_SIZE;
  if (Math.abs(x) > playableHalf || Math.abs(y) > playableHalf) return "water";
  for (const wall of MOBAConfig.WALLS) {
    if (Math.abs(x - wall.position.x) < wall.width / 2 && Math.abs(y - wall.position.y) < wall.height / 2) return "rock";
  }
  if (nearPolyline(x, y, MOBAConfig.RIVER.points, MOBAConfig.RIVER.width / 2)) return "water";
  for (const lane of Object.values(MOBAConfig.LANES)) {
    if (nearPolyline(x, y, lane.waypoints, lane.width / 2)) return "path";
  }
  return "grass";
}

/**
 * Draw the ground over the whole map into `ctx` (origin at the map's
 * center, world units), plus plain water out to `extent` around it.
 */
export function drawTerrain(ctx: CanvasRenderingContext2D, tilesets: TerrainTilesets, extent: number): void {
  const size = TERRAIN_TILE_WORLD_SIZE;
  const half = MOBAConfig.MAP_SIZE.width / 2;
  const cells = Math.ceil((half * 2) / size);
  const origin = -half;

  // Terrain at every vertex
  const vertices: Terrain[][] = [];
  for (let vy = 0; vy <= cells; vy++) {
    const row: Terrain[] = [];
    for (let vx = 0; vx <= cells; vx++) row.push(terrainAt(origin + vx * size, origin + vy * size));
    vertices.push(row);
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Open water beyond the map
  const water = tilesets.grassWater;
  const waterIndex = water.byCorners.get("lower lower lower lower");
  if (waterIndex !== undefined) {
    for (let y = -extent; y < extent; y += size) {
      for (let x = -extent; x < extent; x += size) {
        if (Math.abs(x + size / 2) < half && Math.abs(y + size / 2) < half) continue;
        drawTile(ctx, water, waterIndex, x, y, size);
      }
    }
  }

  // Grass everywhere on the map
  const grass = tilesets.grassPath;
  const grassIndex = grass.byCorners.get("lower lower lower lower");
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      if (grassIndex !== undefined) drawTile(ctx, grass, grassIndex, origin + cx * size, origin + cy * size, size, cellHash(cx, cy));
    }
  }

  // Each layer over the cells that touch its terrain
  for (const layer of LAYERS) {
    const tileset = tilesets[layer.tileset];
    const other: Corner = layer.side === "upper" ? "lower" : "upper";
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const corner = (vx: number, vy: number): Corner => (vertices[vy][vx] === layer.terrain ? layer.side : other);
        const corners: TileCorners = {
          NW: corner(cx, cy),
          NE: corner(cx + 1, cy),
          SW: corner(cx, cy + 1),
          SE: corner(cx + 1, cy + 1),
        };
        if (corners.NW === other && corners.NE === other && corners.SW === other && corners.SE === other) continue;
        const index = tileset.byCorners.get(cornerKey(corners));
        const plain = corners.NW === layer.side && corners.NE === layer.side && corners.SW === layer.side && corners.SE === layer.side;
        if (index !== undefined) drawTile(ctx, tileset, index, origin + cx * size, origin + cy * size, size, plain ? cellHash(cx, cy) : 0);
      }
    }
  }
  ctx.restore();
}

/** A fixed pseudo-random number per cell (0-3: which mirroring a plain tile gets) */
function cellHash(cx: number, cy: number): number {
  let h = Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h >>> 16) & 3;
}

/**
 * Draw a tile at (x, y). `mirror` 1 flips it horizontally, 2 vertically, 3 both.
 */
function drawTile(ctx: CanvasRenderingContext2D, tileset: Tileset, index: number, x: number, y: number, size: number, mirror = 0): void {
  // A hair of overlap so no seams show between tiles at fractional positions
  const drawn = size + 0.5;
  if (mirror === 0) {
    ctx.drawImage(tileset.image, index * tileset.tileSize, 0, tileset.tileSize, tileset.tileSize, x, y, drawn, drawn);
    return;
  }
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.scale(mirror & 1 ? -1 : 1, mirror & 2 ? -1 : 1);
  ctx.drawImage(tileset.image, index * tileset.tileSize, 0, tileset.tileSize, tileset.tileSize, -size / 2, -size / 2, drawn, drawn);
  ctx.restore();
}
