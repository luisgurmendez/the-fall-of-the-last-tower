/**
 * AbilityIconLoader - Loads and caches ability icons for HUD display.
 *
 * Icons are src/assets/abilities/{championId}/{slot}.png, where slot is:
 * passive, q, w, e, r, or an ability a slot swaps in, named without the
 * champion's prefix (Nocthar's colossus_w for nocthar_colossus_w:
 * abilityIconKey). Vite bundles them (abilityIconUrl), so they load in a
 * production build too, not only from the dev server's /src.
 */

import { drawPixelArtInBox } from '@/render/pixelArt';

export type AbilityIconSlot = 'passive' | 'q' | 'w' | 'e' | 'r' | (string & {});

/** Every ability icon's URL, by its path under src/assets/abilities */
const ICON_URLS = import.meta.glob('/src/assets/abilities/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/**
 * The icon for a slot: the slot's own, or that of the ability swapped into
 * it (its id without the champion's prefix) when it has one
 */
export function abilityIconKey(championId: string, slot: string, swappedAbilityId?: string | null): AbilityIconSlot {
  const own = slot.toLowerCase();
  if (!swappedAbilityId) return own;
  const key = swappedAbilityId.startsWith(`${championId}_`) ? swappedAbilityId.slice(championId.length + 1) : swappedAbilityId;
  return `/src/assets/abilities/${championId}/${key}.png` in ICON_URLS ? key : own;
}

/** An ability icon's URL (a path that won't load if the icon doesn't exist) */
export function abilityIconUrl(championId: string, slot: AbilityIconSlot): string {
  const path = `/src/assets/abilities/${championId}/${slot}.png`;
  return ICON_URLS[path] ?? path;
}

interface CachedIcon {
  image: HTMLImageElement;
  loaded: boolean;
  error: boolean;
}

class AbilityIconLoader {
  private static instance: AbilityIconLoader;

  /** Cache of loaded icons: championId -> slot -> CachedIcon */
  private iconCache: Map<string, Map<AbilityIconSlot, CachedIcon>> = new Map();

  private constructor() {}

  static getInstance(): AbilityIconLoader {
    if (!AbilityIconLoader.instance) {
      AbilityIconLoader.instance = new AbilityIconLoader();
    }
    return AbilityIconLoader.instance;
  }

  /**
   * Get an ability icon for a champion.
   * Returns the image if loaded, null if not yet loaded or error.
   */
  getIcon(championId: string, slot: AbilityIconSlot): HTMLImageElement | null {
    const champCache = this.iconCache.get(championId);
    if (!champCache) {
      // Start loading icons for this champion
      this.loadChampionIcons(championId);
      return null;
    }

    // An icon of an ability swapped into a slot: loaded the first time it's asked for
    if (!champCache.has(slot)) this.loadIcon(championId.toLowerCase(), champCache, slot);
    const cached = champCache.get(slot);
    if (!cached || !cached.loaded || cached.error) {
      return null;
    }

    return cached.image;
  }

  /**
   * Check if an icon is loaded and ready to use.
   */
  isIconLoaded(championId: string, slot: AbilityIconSlot): boolean {
    const champCache = this.iconCache.get(championId);
    if (!champCache) return false;

    const cached = champCache.get(slot);
    return cached?.loaded === true && cached?.error === false;
  }

  /**
   * Preload all icons for a champion.
   */
  preloadChampion(championId: string): void {
    if (!this.iconCache.has(championId)) {
      this.loadChampionIcons(championId);
    }
  }

  /**
   * Load all ability icons for a champion.
   */
  private loadChampionIcons(championId: string): void {
    const champLower = championId.toLowerCase();
    const champCache = new Map<AbilityIconSlot, CachedIcon>();
    this.iconCache.set(champLower, champCache);

    const slots: AbilityIconSlot[] = ['passive', 'q', 'w', 'e', 'r'];

    for (const slot of slots) this.loadIcon(champLower, champCache, slot);
  }

  /** Start loading one of a champion's icons into its cache */
  private loadIcon(champLower: string, champCache: Map<AbilityIconSlot, CachedIcon>, slot: AbilityIconSlot): void {
    const image = new Image();
    const cached: CachedIcon = {
      image,
      loaded: false,
      error: false,
    };

    champCache.set(slot, cached);

    image.onload = () => {
      cached.loaded = true;
      cached.error = false;
    };

    image.onerror = () => {
      cached.loaded = true;
      cached.error = true;
      console.warn(`Failed to load ability icon: ${champLower}/${slot}.png`);
    };

    // Start loading
    image.src = abilityIconUrl(champLower, slot);
  }

  /**
   * Draw an ability icon to a canvas context.
   * Returns true if icon was drawn, false if not available.
   */
  drawIcon(
    ctx: CanvasRenderingContext2D,
    championId: string,
    slot: AbilityIconSlot,
    x: number,
    y: number,
    size: number
  ): boolean {
    const icon = this.getIcon(championId.toLowerCase(), slot);
    if (!icon) {
      return false;
    }

    drawPixelArtInBox(ctx, icon, x, y, size);
    return true;
  }

  /**
   * Clear the cache (useful for hot reloading).
   */
  clearCache(): void {
    this.iconCache.clear();
  }
}

export default AbilityIconLoader;
