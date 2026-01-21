/**
 * Bush - A vision-blocking terrain feature.
 *
 * Units inside bushes are invisible to enemies unless:
 * - The enemy is also in the same bush
 * - A ward is placed inside the bush
 *
 * Bushes render with transparency when the player has allies inside.
 */

import Vector from '@/physics/vector';
import { WorldEntity } from '@/core/GameObject';
import GameContext from '@/core/gameContext';
import RenderElement from '@/render/renderElement';
import ImageSpriteSheet from '@/sprites/ImageSpriteSheet';
import { TeamId, TEAM } from '@/core/Team';
import { IGameUnit } from '@/units/types';
import type { BushGroup } from './BushGroup';

// Sprite paths
const SPRITE_BUSH_1 = '/assets/sprites/Bushes/Bushe1.png';
const SPRITE_BUSH_2 = '/assets/sprites/Bushes/Bushe2.png';

// Frame dimensions (both spritesheets are 1024x128 with 8 frames of 128x128)
const FRAME_SIZE = 128;
const FRAME_COUNT = 8;

/**
 * Bush type determines which sprite to use.
 */
export type BushType = 'large' | 'small';

/**
 * Configuration for creating a bush.
 */
export interface BushConfig {
  position: Vector;
  type: BushType;
  /** Width of the bush hitbox (default: 100 for large, 60 for small) */
  width?: number;
  /** Height of the bush hitbox (default: 60 for large, 40 for small) */
  height?: number;
  /** Random frame index (0-7) for visual variety */
  frameIndex?: number;
  /** Scale factor for rendering (default: 1) */
  scale?: number;
}

/**
 * Static sprite sheets shared across all bushes.
 */
let bushSprite1: ImageSpriteSheet | null = null;
let bushSprite2: ImageSpriteSheet | null = null;
let spritesLoading = false;
let spritesLoaded = false;

/**
 * Load bush sprites (called once).
 */
async function loadBushSprites(): Promise<void> {
  if (spritesLoaded || spritesLoading) return;
  spritesLoading = true;

  bushSprite1 = new ImageSpriteSheet({
    type: 'grid',
    rows: 1,
    cols: FRAME_COUNT,
    spriteWidth: FRAME_SIZE,
    spriteHeight: FRAME_SIZE,
    scale: 1,
  });

  bushSprite2 = new ImageSpriteSheet({
    type: 'grid',
    rows: 1,
    cols: FRAME_COUNT,
    spriteWidth: FRAME_SIZE,
    spriteHeight: FRAME_SIZE,
    scale: 1,
  });

  try {
    await Promise.all([
      bushSprite1.load(SPRITE_BUSH_1),
      bushSprite2.load(SPRITE_BUSH_2),
    ]);
    spritesLoaded = true;
  } catch (error) {
    console.error('Failed to load bush sprites:', error);
  }
}

/**
 * A bush terrain feature.
 */
export class Bush extends WorldEntity {
  /** Unique ID for this bush */
  readonly id: string;

  /** Bush type */
  readonly bushType: BushType;

  /** Hitbox dimensions */
  readonly width: number;
  readonly height: number;

  /** Sprite frame index (0-7) */
  private frameIndex: number;

  /** Scale factor */
  private scale: number;

  /** Units currently inside this bush */
  private unitsInside: Set<IGameUnit> = new Set();

  /** Whether player team has units inside */
  private hasPlayerUnitsInside = false;

  /** Parent bush group (for shared visibility) */
  private group: BushGroup | null = null;

  constructor(config: BushConfig) {
    super(config.position.clone());

    this.id = `bush_${Math.random().toString(36).substr(2, 9)}`;
    this.bushType = config.type;

    // Set dimensions based on type
    if (config.type === 'large') {
      this.width = config.width ?? 100;
      this.height = config.height ?? 60;
      this.scale = config.scale ?? 1.0;
    } else {
      this.width = config.width ?? 60;
      this.height = config.height ?? 40;
      this.scale = config.scale ?? 0.7;
    }

    // Random or specified frame
    this.frameIndex = config.frameIndex ?? Math.floor(Math.random() * FRAME_COUNT);

    // Load sprites
    loadBushSprites();
  }

  /**
   * Check if a point is inside this bush's bounds.
   */
  containsPoint(point: Vector): boolean {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    return (
      point.x >= this.position.x - halfW &&
      point.x <= this.position.x + halfW &&
      point.y >= this.position.y - halfH &&
      point.y <= this.position.y + halfH
    );
  }

  /**
   * Check if a unit is inside this bush.
   */
  containsUnit(unit: IGameUnit): boolean {
    return this.containsPoint(unit.getPosition());
  }

  /**
   * Get all units currently tracked inside this bush.
   */
  getUnitsInside(): IGameUnit[] {
    return Array.from(this.unitsInside);
  }

  /**
   * Update which units are inside this bush.
   * Called by BushManager each frame.
   */
  updateUnitsInside(units: IGameUnit[]): void {
    this.unitsInside.clear();
    this.hasPlayerUnitsInside = false;

    for (const unit of units) {
      if (this.containsUnit(unit)) {
        this.unitsInside.add(unit);
        if (unit.getTeamId() === TEAM.PLAYER) {
          this.hasPlayerUnitsInside = true;
        }
      }
    }
  }

  /**
   * Check if player team has units inside.
   */
  hasPlayerInside(): boolean {
    return this.hasPlayerUnitsInside;
  }

  /**
   * Check if a specific team has units inside.
   */
  hasTeamInside(teamId: TeamId): boolean {
    for (const unit of this.unitsInside) {
      if (unit.getTeamId() === teamId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get bounds for spatial hashing / collision.
   */
  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.position.x - this.width / 2,
      y: this.position.y - this.height / 2,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Set the parent bush group.
   */
  setGroup(group: BushGroup): void {
    this.group = group;
  }

  /**
   * Get the parent bush group.
   */
  getGroup(): BushGroup | null {
    return this.group;
  }

  // Debug counter for logging
  private static renderDebugCounter = 0;

  /**
   * Check if player has units in this bush's group (or just this bush if no group).
   * Also checks online mode player position via callback if set.
   */
  hasPlayerInsideGroup(): boolean {
    // Debug log every 300 calls (about every 5 seconds at 60fps)
    Bush.renderDebugCounter++;
    const shouldLog = Bush.renderDebugCounter % 300 === 0;

    // Check online mode state first
    if (Bush.onlinePlayerCheckFn && this.group) {
      const result = Bush.onlinePlayerCheckFn(this.group);
      if (shouldLog) {
        console.log(`[Bush] hasPlayerInsideGroup check - group: ${this.group.id}, onlineCheckFn result: ${result}`);
      }
      if (result) {
        return true;
      }
    } else if (shouldLog) {
      console.log(`[Bush] hasPlayerInsideGroup - onlinePlayerCheckFn: ${!!Bush.onlinePlayerCheckFn}, group: ${this.group?.id ?? 'null'}`);
    }

    // Normal offline mode check
    if (this.group) {
      return this.group.hasPlayerInside();
    }
    return this.hasPlayerUnitsInside;
  }

  /**
   * Static callback for checking online player bush state.
   * Set by OnlineFogProvider to enable online mode bush transparency.
   */
  static onlinePlayerCheckFn: ((group: BushGroup) => boolean) | null = null;

  /**
   * Set the online player check function.
   * This is called from OnlineFogProvider to integrate with online mode.
   */
  static setOnlinePlayerCheckFn(fn: ((group: BushGroup) => boolean) | null): void {
    Bush.onlinePlayerCheckFn = fn;
  }

  override step(_gctx: GameContext): void {
    // Bushes don't have any update logic
    // Unit tracking is done by BushManager
  }

  override render(): RenderElement {
    return new RenderElement((gctx) => {
      const ctx = gctx.canvasRenderingContext;

      ctx.save();

      // Get the appropriate sprite sheet
      const sprite = this.bushType === 'large' ? bushSprite1 : bushSprite2;

      // Check if player is in this bush's group (makes whole group transparent)
      const playerInGroup = this.hasPlayerInsideGroup();

      if (sprite && spritesLoaded) {
        // Apply transparency when player allies are inside any bush in group
        const alpha = playerInGroup ? 0.5 : 1.0;

        sprite.drawSpriteWithOptions(ctx, this.frameIndex, this.position, {
          alpha,
          scale: this.scale,
        });
      } else {
        // Fallback: draw a green rectangle while loading
        ctx.fillStyle = playerInGroup
          ? 'rgba(34, 139, 34, 0.5)'
          : 'rgba(34, 139, 34, 0.8)';
        ctx.fillRect(
          this.position.x - this.width / 2,
          this.position.y - this.height / 2,
          this.width,
          this.height
        );
      }

      // Debug: draw hitbox outline
      // ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
      // ctx.strokeRect(
      //   this.position.x - this.width / 2,
      //   this.position.y - this.height / 2,
      //   this.width,
      //   this.height
      // );

      ctx.restore();
    }, true);
  }
}

export default Bush;
