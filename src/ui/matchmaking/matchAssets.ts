/**
 * The art the game draws in its first seconds, preloaded while the loading
 * screen shows so nothing pops in after it: the match's champions (sprite
 * strips and portraits), towers, nexus, minions, jungle creatures, arrows,
 * the ground, bushes, decorations, cursors and item icons. The renderers
 * load the same URLs again when the game starts and get them from the
 * browser's cache.
 */

import { ITEM_CATALOG } from "@siege/shared";
import AbilityIconLoader from "@/ui/AbilityIconLoader";
import { getItemIconUrl } from "@/ui/itemIcons";
import { loadTerrainTilesets } from "@/map/terrainTiles";
import { getChampionRenderer } from "@/render/champions";
import { MINION_IMAGES } from "@/render/entities/minion";
import { TOWER_IMAGES } from "@/render/entities/tower";
import { NEXUS_IMAGES } from "@/render/entities/nexus";
import { JUNGLE_CREATURE_IMAGES } from "@/render/entities/jungleCreature";
import { PROJECTILE_IMAGES } from "@/render/entities/projectile";

/**
 * Art whose modules keep its URLs private, listed here: the ground
 * (MOBABackground.ts), bushes (Bush.ts), decorations (MapDecoration.ts) and
 * cursors (CursorManager.ts). One that moves there only stops being preloaded.
 */
const MAP_IMAGES = [
  "/assets/sprites/Map/Tilemap_Grass.png",
  "/assets/sprites/Map/Water_Background.png",
  "/assets/sprites/Map/Water_Foam.png",
  "/assets/sprites/Bushes/Bushe1.png",
  "/assets/sprites/Bushes/Bushe2.png",
  "/assets/sprites/Map/Decoration/Mashroom_Bid.png",
  "/assets/sprites/Map/Decoration/Mashroom_Mid.png",
  "/assets/sprites/Map/Decoration/Mashroom_Small.png",
  "/assets/sprites/Map/Decoration/Plant_1.png",
  "/assets/sprites/Map/Decoration/Plant_2.png",
  "/assets/sprites/Map/Decoration/Plant_3.png",
  "/assets/sprites/Map/Decoration/Rock_Big.png",
  "/assets/sprites/Map/Decoration/Rock_Big2.png",
  "/assets/sprites/Map/Decoration/Rock_Mid.png",
  "/assets/sprites/Map/Decoration/Rock_Small.png",
  "/assets/sprites/Map/Decoration/Scarecrow.png",
  "/assets/sprites/Cursor.png",
  "/assets/sprites/Cursor_Attack.png",
];

/**
 * Preloaded images by URL, done when loaded or failed. Kept for the page's
 * life, so the browser keeps them cached and a later match finds them ready.
 */
const preloaded = new Map<string, { image: HTMLImageElement; done: Promise<void> }>();
/** The ground's tilesets (fetched JSON and images), loaded once */
let tilesets: Promise<void> | null = null;

/**
 * Every image URL the match needs, without repeats.
 */
export function getMatchImageUrls(championIds: readonly string[]): string[] {
  const urls = championIds.flatMap((championId) => [
    `/assets/champs/${championId}/portrait.png`,
    ...(getChampionRenderer(championId)?.images ?? []),
  ]);
  return [
    ...new Set([
      ...urls,
      ...TOWER_IMAGES,
      ...NEXUS_IMAGES,
      ...MINION_IMAGES,
      ...JUNGLE_CREATURE_IMAGES,
      ...PROJECTILE_IMAGES,
      ...MAP_IMAGES,
      ...ITEM_CATALOG.map((item) => getItemIconUrl(item.id)),
    ]),
  ];
}

function preloadImage(src: string): Promise<void> {
  let entry = preloaded.get(src);
  if (!entry) {
    const image = new Image();
    const done = new Promise<void>((resolve) => {
      image.onload = () => resolve();
      // A missing image counts as done: the game draws without it
      image.onerror = () => resolve();
    });
    image.src = src;
    entry = { image, done };
    preloaded.set(src, entry);
  }
  return entry.done;
}

function preloadTilesets(): Promise<void> {
  tilesets ??= loadTerrainTilesets().then(() => {}, () => {});
  return tilesets;
}

/**
 * Start loading the match's art. onProgress is called with 0 right away,
 * then each time one more asset is done (loaded or failed), until loaded
 * equals total. Ability icons go to the HUD's loader and aren't counted.
 */
export function preloadMatchAssets(
  championIds: readonly string[],
  onProgress: (loaded: number, total: number) => void,
): void {
  const iconLoader = AbilityIconLoader.getInstance();
  for (const championId of championIds) {
    iconLoader.preloadChampion(championId);
  }

  const tasks = [
    ...getMatchImageUrls(championIds).map(preloadImage),
    preloadTilesets(),
  ];
  let loaded = 0;
  onProgress(loaded, tasks.length);
  for (const task of tasks) {
    void task.then(() => onProgress(++loaded, tasks.length));
  }
}
