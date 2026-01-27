/**
 * AbilityIconLoader - Loads and caches ability icons for HUD display.
 *
 * Icons are loaded from: src/assets/abilities/{championId}/{slot}.png
 * Where slot is: passive, q, w, e, r
 */

export type AbilityIconSlot = 'passive' | 'q' | 'w' | 'e' | 'r';

interface CachedIcon {
  image: HTMLImageElement;
  loaded: boolean;
  error: boolean;
}

class AbilityIconLoader {
  private static instance: AbilityIconLoader;

  /** Cache of loaded icons: championId -> slot -> CachedIcon */
  private iconCache: Map<string, Map<AbilityIconSlot, CachedIcon>> = new Map();

  /** Base path for ability icons */
  private basePath = '/src/assets/abilities';

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

    for (const slot of slots) {
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
      image.src = `${this.basePath}/${champLower}/${slot}.png`;
    }
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

    // Draw the icon scaled to fit the box
    ctx.drawImage(icon, x, y, size, size);
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
