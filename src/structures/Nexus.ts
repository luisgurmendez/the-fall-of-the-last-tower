/**
 * Nexus - The main base structure for each team.
 *
 * When a team's nexus is destroyed, that team loses the game.
 * Rendered using Barracks sprite images.
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import RenderElement from '@/render/renderElement';
import { UnitType, UnitSide, UnitReward } from '@/units/types';
import { Structure } from './Structure';
import { MOBAConfig } from '@/map/MOBAConfig';

// Sprite paths
const SPRITE_BLUE = '/assets/sprites/Buildings/Barracks_Blue.png';
const SPRITE_RED = '/assets/sprites/Buildings/Barracks_Red.png';

// Image dimensions (192x256)
const SPRITE_WIDTH = 192;
const SPRITE_HEIGHT = 256;
const SPRITE_SCALE = 1.0;

// Static image cache
let blueImage: HTMLImageElement | null = null;
let redImage: HTMLImageElement | null = null;
let imagesLoaded = false;

/**
 * Load nexus images (called once).
 */
function loadNexusImages(): void {
  if (imagesLoaded || blueImage || redImage) return;

  blueImage = new Image();
  blueImage.src = SPRITE_BLUE;

  redImage = new Image();
  redImage.src = SPRITE_RED;

  Promise.all([
    new Promise<void>((resolve) => { blueImage!.onload = () => resolve(); }),
    new Promise<void>((resolve) => { redImage!.onload = () => resolve(); }),
  ]).then(() => {
    imagesLoaded = true;
  }).catch((error) => {
    console.error('Failed to load nexus images:', error);
  });
}

/**
 * Optional config for creating a Nexus with custom position.
 */
export interface NexusConfig {
  position?: Vector;
  health?: number;
  radius?: number;
}

/**
 * Nexus - The main base structure.
 */
export class Nexus extends Structure {
  readonly unitType: UnitType = 'creature'; // Using 'creature' as structures behave like neutral units

  /** Nexus radius for rendering and collision */
  private readonly radius: number;

  /**
   * Create a new Nexus.
   * @param side - Team side (0 = blue, 1 = red)
   * @param config - Optional config for custom position/health
   */
  constructor(side: UnitSide, config?: NexusConfig) {
    const mobaConfig = MOBAConfig.NEXUS;
    const position = config?.position
      ? config.position.clone()
      : (side === 0
          ? new Vector(mobaConfig.BLUE.x, mobaConfig.BLUE.y)
          : new Vector(mobaConfig.RED.x, mobaConfig.RED.y));

    super(
      position,
      side,
      config?.health ?? mobaConfig.HEALTH,
      50,  // armor
      50   // magic resist
    );

    this.radius = config?.radius ?? mobaConfig.RADIUS;

    // Load images
    loadNexusImages();
  }

  getRadius(): number {
    return this.radius;
  }

  getReward(): UnitReward {
    return {
      gold: 500,
      experience: 500,
    };
  }

  protected override onDestroyed(gctx: GameContext): void {
    // TODO: Trigger game end
    console.log(`[NEXUS] ${this.side === 0 ? 'Blue' : 'Red'} nexus destroyed!`);
  }

  override render(): RenderElement {
    return new RenderElement((gctx) => {
      const ctx = gctx.canvasRenderingContext;

      ctx.save();

      // Get the appropriate image
      const image = this.side === 0 ? blueImage : redImage;

      if (image && imagesLoaded) {
        // Calculate scaled dimensions
        const scaledWidth = SPRITE_WIDTH * SPRITE_SCALE;
        const scaledHeight = SPRITE_HEIGHT * SPRITE_SCALE;

        // Draw centered on position (offset Y up since building base should be at position)
        ctx.drawImage(
          image,
          this.position.x - scaledWidth / 2,
          this.position.y - scaledHeight + 20, // Offset so base is near position
          scaledWidth,
          scaledHeight
        );
      } else {
        // Fallback: draw a colored rectangle while loading
        const baseColor = this.side === 0 ? '#4488FF' : '#FF4444';
        ctx.fillStyle = baseColor;
        ctx.fillRect(
          this.position.x - 50,
          this.position.y - 80,
          100,
          100
        );
      }

      // Draw health bar above nexus
      this.renderHealthBar(ctx);

      ctx.restore();
    }, true);
  }

  /**
   * Render health bar above the nexus.
   */
  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = this.radius * 2;
    const barHeight = 12;
    const barY = this.position.y - this.radius - 30;
    const barX = this.position.x - barWidth / 2;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health fill
    const healthPercent = this.getHealthPercent();
    const fillColor = this.side === 0 ? '#4488FF' : '#FF4444';
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Health text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${Math.ceil(this.health)} / ${this.maxHealth}`,
      this.position.x,
      barY + barHeight / 2
    );
  }
}

export default Nexus;
