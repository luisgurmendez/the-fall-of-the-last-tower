/**
 * MapDecoration - Non-interactive visual decorations for the map.
 *
 * Renders static sprites like rocks, plants, mushrooms, etc.
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import BaseObject from '@/objects/baseObject';
import RenderElement from '@/render/renderElement';

/**
 * Types of decorations available.
 */
export type DecorationType =
  | 'mushroom_big'
  | 'mushroom_mid'
  | 'mushroom_small'
  | 'plant_1'
  | 'plant_2'
  | 'plant_3'
  | 'rock_big'
  | 'rock_big2'
  | 'rock_mid'
  | 'rock_small'
  | 'scarecrow';

/**
 * Sprite paths for each decoration type.
 */
const DECORATION_SPRITES: Record<DecorationType, string> = {
  mushroom_big: '/assets/sprites/Map/Decoration/Mashroom_Bid.png',
  mushroom_mid: '/assets/sprites/Map/Decoration/Mashroom_Mid.png',
  mushroom_small: '/assets/sprites/Map/Decoration/Mashroom_Small.png',
  plant_1: '/assets/sprites/Map/Decoration/Plant_1.png',
  plant_2: '/assets/sprites/Map/Decoration/Plant_2.png',
  plant_3: '/assets/sprites/Map/Decoration/Plant_3.png',
  rock_big: '/assets/sprites/Map/Decoration/Rock_Big.png',
  rock_big2: '/assets/sprites/Map/Decoration/Rock_Big2.png',
  rock_mid: '/assets/sprites/Map/Decoration/Rock_Mid.png',
  rock_small: '/assets/sprites/Map/Decoration/Rock_Small.png',
  scarecrow: '/assets/sprites/Map/Decoration/Scarecrow.png',
};

/**
 * Default sizes for each decoration type.
 */
const DECORATION_SIZES: Record<DecorationType, { width: number; height: number }> = {
  mushroom_big: { width: 64, height: 64 },
  mushroom_mid: { width: 64, height: 64 },
  mushroom_small: { width: 64, height: 64 },
  plant_1: { width: 64, height: 64 },
  plant_2: { width: 64, height: 64 },
  plant_3: { width: 128, height: 128 },
  rock_big: { width: 64, height: 64 },
  rock_big2: { width: 64, height: 64 },
  rock_mid: { width: 64, height: 64 },
  rock_small: { width: 64, height: 64 },
  scarecrow: { width: 192, height: 192 },
};

/**
 * Image cache for loaded sprites.
 */
const imageCache: Map<string, HTMLImageElement> = new Map();

/**
 * Load an image (with caching).
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Configuration for a map decoration.
 */
export interface MapDecorationConfig {
  position: Vector;
  type: DecorationType;
  scale?: number;
  rotation?: number;
  flipX?: boolean;
}

/**
 * A non-interactive visual decoration on the map.
 */
export class MapDecoration extends BaseObject {
  private type: DecorationType;
  private scale: number;
  private rotation: number;
  private flipX: boolean;
  private image: HTMLImageElement | null = null;
  private loaded: boolean = false;

  constructor(config: MapDecorationConfig) {
    super(config.position.clone(), `decoration-${config.type}-${Math.random().toString(36).substr(2, 9)}`);
    this.type = config.type;
    this.scale = config.scale ?? 1;
    this.rotation = config.rotation ?? 0;
    this.flipX = config.flipX ?? false;

    // Load the sprite
    this.loadSprite();
  }

  private async loadSprite(): Promise<void> {
    try {
      const spritePath = DECORATION_SPRITES[this.type];
      this.image = await loadImage(spritePath);
      this.loaded = true;
    } catch (error) {
      console.error(`Failed to load decoration sprite: ${this.type}`, error);
    }
  }

  step(_gctx: GameContext): void {
    // Static decoration - no update needed
  }

  render(): RenderElement {
    return new RenderElement((gctx) => {
      if (!this.loaded || !this.image) return;

      const ctx = gctx.canvasRenderingContext;
      const size = DECORATION_SIZES[this.type];
      const width = size.width * this.scale;
      const height = size.height * this.scale;

      ctx.save();

      // Move to position
      ctx.translate(this.position.x, this.position.y);

      // Apply rotation
      if (this.rotation !== 0) {
        ctx.rotate(this.rotation);
      }

      // Apply flip
      if (this.flipX) {
        ctx.scale(-1, 1);
      }

      // Draw centered
      ctx.drawImage(
        this.image,
        -width / 2,
        -height / 2,
        width,
        height
      );

      ctx.restore();
    }, true); // isWorldElement = true
  }

  getType(): DecorationType {
    return this.type;
  }
}

export default MapDecoration;
