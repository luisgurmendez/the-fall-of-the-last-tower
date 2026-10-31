/**
 * Generates the map's terrain tilesets with PixelLab: top-down Wang
 * tilesets, each two terrains ("lower" and "upper") in 16 tiles that join
 * by their corners. A map cell takes the tile whose four corners (NW, NE,
 * SW, SE) match the terrain at the cell's corners.
 *
 * Each set goes to public/assets/tiles/<key>.png (the tiles side by side)
 * and <key>.json (each tile's corners, in the same order). Sets after the
 * first take its plain grass tile as a reference, so all grass matches.
 * scripts/tilesets.json keeps the PixelLab ids and seeds of the sets kept.
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-tilesets.ts                     # every set
 *   bun scripts/generate-tilesets.ts --only grass_water --seed 4
 *   bun scripts/generate-tilesets.ts --out /tmp/review   # try without replacing the kept ones
 *   bun scripts/generate-tilesets.ts --mode pro          # PixelLab's richer pipeline (failing as of 2026-10-31)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, createImage, decodePng, encodePng } from './lib/png';

const API = 'https://api.pixellab.ai/v2';
const TILES_DIR = 'public/assets/tiles';
const MANIFEST_PATH = 'scripts/tilesets.json';
const TILE_SIZE = 32;

interface TilesetSpec {
  lower: string;
  upper: string;
  transition: string;
  /** 0 = flat boundary; larger raises the upper terrain (0.25-0.5 reads as a bank or cliff) */
  transitionSize: number;
  seed: number;
  /** Which side is plain grass, to share the first set's grass */
  grass: 'lower' | 'upper';
}

/** In order: the first one's grass is everyone's grass */
export const TILESETS: Record<string, TilesetSpec> = {
  grass_path: {
    lower: 'lush green meadow grass with small tufts',
    upper: 'smooth packed light brown dirt road, plain and even',
    transition: 'patchy grass thinning into dirt',
    transitionSize: 0,
    seed: 5,
    grass: 'lower',
  },
  grass_water: {
    lower: 'clear shallow blue river water with gentle ripples',
    upper: 'lush green meadow grass with small tufts',
    transition: 'muddy sandy riverbank',
    transitionSize: 0.25,
    seed: 1,
    grass: 'upper',
  },
  grass_rock: {
    lower: 'lush green meadow grass with small tufts',
    upper: 'raised mossy grey stone plateau',
    transition: 'steep grey rock cliff face',
    transitionSize: 0.5,
    seed: 1,
    grass: 'lower',
  },
};

type Corner = 'lower' | 'upper' | 'transition';

interface ApiTile {
  image: { base64: string };
  corners: { NW: Corner; NE: Corner; SW: Corner; SE: Corner };
}

interface Options {
  only: string[] | null;
  seed: number | null;
  outDir: string | null;
  mode: 'standard' | 'pro';
}

function parseArgs(argv: string[]): Options {
  const options: Options = { only: null, seed: null, outDir: null, mode: 'standard' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') options.only = argv[++i].split(',');
    else if (argv[i] === '--seed') options.seed = Number(argv[++i]);
    else if (argv[i] === '--out') options.outDir = argv[++i];
    else if (argv[i] === '--mode') options.mode = argv[++i] as Options['mode'];
  }
  return options;
}

function log(message: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
}

async function api(apiKey: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Create a tileset and wait for its tiles.
 */
async function createTileset(apiKey: string, spec: TilesetSpec, seed: number, grassTile: string | null, mode: Options['mode']): Promise<{ id: string; tiles: ApiTile[]; usd: number }> {
  const reference = grassTile ? { type: 'base64', base64: grassTile, format: 'png' } : undefined;
  let response = await requestTileset();
  // PixelLab answers 429 past a few jobs at once
  for (let attempt = 1; response.status === 429 && attempt < 10; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    response = await requestTileset();
  }
  if (!response.ok) throw new Error(`create-tileset: HTTP ${response.status}: ${await response.text()}`);
  const created = await response.json() as { tileset_id: string; usage?: { usd?: number } };

  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const result = await api(apiKey, 'GET', `/tilesets/${created.tileset_id}`);
    if (result.status === 423) continue; // Still generating
    if (!result.ok) throw new Error(`tilesets/${created.tileset_id}: HTTP ${result.status}: ${await result.text()}`);
    const body = await result.json() as { tileset: { tiles: ApiTile[] } };
    return { id: created.tileset_id, tiles: body.tileset.tiles, usd: created.usage?.usd ?? 0 };
  }
  throw new Error(`tileset ${created.tileset_id} took too long`);

  function requestTileset(): Promise<Response> {
    return api(apiKey, 'POST', '/create-tileset', {
      lower_description: spec.lower,
      upper_description: spec.upper,
      transition_description: spec.transition,
      transition_size: spec.transitionSize,
      tile_size: { width: TILE_SIZE, height: TILE_SIZE },
      mode,
      ...(mode === 'standard' ? { shading: 'medium shading', detail: 'highly detailed' } : {}),
      seed,
      ...(reference && spec.grass === 'lower' ? { lower_reference_image: reference } : {}),
      ...(reference && spec.grass === 'upper' ? { upper_reference_image: reference } : {}),
    });
  }
}

/** How green a tile is on average (green minus the larger of red and blue) */
function greenness(base64: string): number {
  const image = decodePng(Buffer.from(base64, 'base64'));
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    r += image.data[i];
    g += image.data[i + 1];
    b += image.data[i + 2];
  }
  return g - Math.max(r, b);
}

/**
 * PixelLab sometimes swaps the terrains (the "upper" one comes out as the
 * lower description). If the grass ended up on the wrong side, swap every
 * tile's corner labels so they mean what the spec says.
 */
function fixSwappedTerrains(tiles: ApiTile[], grass: 'lower' | 'upper'): boolean {
  const allOf = (side: Corner) => tiles.find(t => Object.values(t.corners).every(corner => corner === side));
  const lower = allOf('lower');
  const upper = allOf('upper');
  if (!lower || !upper) return false;
  const grassIsLower = greenness(lower.image.base64) > greenness(upper.image.base64);
  if (grassIsLower === (grass === 'lower')) return false;
  const swap = (corner: Corner): Corner => (corner === 'lower' ? 'upper' : corner === 'upper' ? 'lower' : corner);
  for (const tile of tiles) {
    tile.corners = { NW: swap(tile.corners.NW), NE: swap(tile.corners.NE), SW: swap(tile.corners.SW), SE: swap(tile.corners.SE) };
  }
  return true;
}

/** The tile that's all grass, as base64 PNG */
function plainGrassTile(tiles: ApiTile[], grass: 'lower' | 'upper'): string | null {
  const tile = tiles.find(t => Object.values(t.corners).every(corner => corner === grass));
  return tile?.image.base64 ?? null;
}

async function main(): Promise<void> {
  const apiKey = process.env.PIXELLAB_API_KEY;
  if (!apiKey) throw new Error('Set PIXELLAB_API_KEY (for example in .env.local)');
  const options = parseArgs(process.argv.slice(2));
  const manifest: Record<string, { tilesetId: string; seed: number }> =
    existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};
  const outDir = options.outDir ?? TILES_DIR;
  mkdirSync(outDir, { recursive: true });

  // The first set's grass, from this run or from disk
  const [firstKey] = Object.keys(TILESETS);
  let grassTile: string | null = null;
  const firstJson = join(TILES_DIR, `${firstKey}.json`);
  if (existsSync(firstJson)) grassTile = (JSON.parse(readFileSync(firstJson, 'utf8')) as { grassTile?: string }).grassTile ?? null;

  let spent = 0;
  for (const [key, spec] of Object.entries(TILESETS)) {
    if (options.only && !options.only.includes(key)) continue;
    const seed = options.seed ?? spec.seed;
    log(`${key}: generating (seed ${seed})`);
    // PixelLab sometimes fails a generation (HTTP 410) and asks to create it again
    let result: Awaited<ReturnType<typeof createTileset>> | null = null;
    for (let attempt = 1; !result; attempt++) {
      try {
        result = await createTileset(apiKey, spec, seed, key === firstKey ? null : grassTile, options.mode);
      } catch (error) {
        if (attempt >= 3 || !String(error).includes('HTTP 410')) throw error;
        log(`${key}: generation failed, trying again`);
      }
    }
    const { id, tiles, usd } = result;
    spent += usd;
    if (fixSwappedTerrains(tiles, spec.grass)) log(`${key}: terrains came out swapped; relabeled`);

    const atlas = createImage(TILE_SIZE * tiles.length, TILE_SIZE);
    tiles.forEach((tile, index) => blit(atlas, decodePng(Buffer.from(tile.image.base64, 'base64')), index * TILE_SIZE, 0));
    const name = options.outDir ? `${key}.${options.mode}.${seed}` : key;
    writeFileSync(join(outDir, `${name}.png`), encodePng(atlas));
    const ownGrass = plainGrassTile(tiles, spec.grass);
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify({
      tileSize: TILE_SIZE,
      tiles: tiles.map(tile => tile.corners),
      ...(key === firstKey && ownGrass ? { grassTile: ownGrass } : {}),
    }, null, 2));
    if (key === firstKey && ownGrass) grassTile = ownGrass;
    if (!options.outDir) manifest[key] = { tilesetId: id, seed };
    log(`${key}: wrote ${tiles.length} tiles`);
  }

  if (!options.outDir) writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  log(`done, $${spent.toFixed(3)}`);
}

await main();
