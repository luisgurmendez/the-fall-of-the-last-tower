/**
 * CursorManager - Manages custom cursor display.
 *
 * Handles switching between different cursor images based on game state:
 * - Default cursor: Normal pointer
 * - Attack cursor: When hovering over an enemy
 */

/** Cursor types available in the game */
export type CursorType = 'default' | 'attack';

/** Cursor image paths */
const CURSOR_IMAGES = {
  default: '/assets/sprites/Cursor.png',
  attack: '/assets/sprites/Cursor_Attack.png',
} as const;

/** Hotspot offset (where the "click point" is on the cursor image) */
const CURSOR_HOTSPOT = {
  default: { x: 0, y: 0 },    // Top-left corner
  attack: { x: 8, y: 8 },     // Center-ish for attack cursor (32x32 image)
} as const;

/**
 * Singleton cursor manager.
 */
class CursorManager {
  private static instance: CursorManager | null = null;

  private canvas: HTMLCanvasElement | null = null;
  private currentCursor: CursorType = 'default';
  private cursorsLoaded = false;

  private constructor() {}

  /**
   * Get the singleton instance.
   */
  static getInstance(): CursorManager {
    if (!CursorManager.instance) {
      CursorManager.instance = new CursorManager();
    }
    return CursorManager.instance;
  }

  /**
   * Initialize the cursor manager with the game canvas.
   */
  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    // Preload cursor images
    this.preloadCursors();

    // Set initial cursor
    this.setCursor('default');
  }

  /**
   * Preload cursor images to avoid flicker on first use.
   */
  private preloadCursors(): void {
    const promises = Object.values(CURSOR_IMAGES).map((src) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Don't fail on error
        img.src = src;
      });
    });

    Promise.all(promises).then(() => {
      this.cursorsLoaded = true;
    });
  }

  /**
   * Set the cursor type.
   */
  setCursor(type: CursorType): void {
    if (this.currentCursor === type) return;
    if (!this.canvas) return;

    this.currentCursor = type;

    const imagePath = CURSOR_IMAGES[type];
    const hotspot = CURSOR_HOTSPOT[type];

    // CSS cursor with custom image
    // Format: url(image) hotspotX hotspotY, fallback
    this.canvas.style.cursor = `url(${imagePath}) ${hotspot.x} ${hotspot.y}, auto`;
  }

  /**
   * Get the current cursor type.
   */
  getCursor(): CursorType {
    return this.currentCursor;
  }

  /**
   * Reset to default cursor.
   */
  reset(): void {
    this.setCursor('default');
  }
}

export const getCursorManager = () => CursorManager.getInstance();

export default CursorManager;
