/**
 * Swordsman - Melee infantry unit.
 *
 * A frontline melee unit that engages enemies at close range.
 * Uses Warrior sprites from tiny_sword asset pack.
 * Stats and configuration are defined in UnitConfig.SWORDSMAN.
 */

import GameContext from "@/core/gameContext";
import Vector from "@/physics/vector";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import ImageSpriteSheet from "@/sprites/ImageSpriteSheet";
import { isAttackable } from "@/behaviors/attackable";
import Background from "@/objects/background";
import { Rectangle } from "@/objects/shapes";
import ArmyUnit, { ATTACK_ANIMATION_ID, WALK_ANIMATION_ID } from "../armyUnit";
import Cooldown from "@/objects/cooldown";
import { Target } from "../types";
import { UnitConfig } from "@/config";

const { SWORDSMAN: CONFIG } = UnitConfig;

/** Sprite frame dimensions */
const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 192;
const SPRITE_SCALE = 0.35;

/** Animation frame counts */
const IDLE_FRAMES = 8;
const RUN_FRAMES = 6;
const ATTACK_FRAMES = 4;

// Pre-built sprite sheets for each side (avoid recreating per instance)
const swordsmanSpriteSheetAlly = new ImageSpriteSheet({
  type: 'animations',
  animations: {
    idle: {
      src: '/assets/sprites/units/Warrior_Blue/Warrior_Idle.png',
      frameCount: IDLE_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
    walk: {
      src: '/assets/sprites/units/Warrior_Blue/Warrior_Run.png',
      frameCount: RUN_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
    attack: {
      src: '/assets/sprites/units/Warrior_Blue/Warrior_Attack1.png',
      frameCount: ATTACK_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
  },
  scale: SPRITE_SCALE,
});

const swordsmanSpriteSheetEnemy = new ImageSpriteSheet({
  type: 'animations',
  animations: {
    idle: {
      src: '/assets/sprites/units/Warrior_Red/Warrior_Idle.png',
      frameCount: IDLE_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
    walk: {
      src: '/assets/sprites/units/Warrior_Red/Warrior_Run.png',
      frameCount: RUN_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
    attack: {
      src: '/assets/sprites/units/Warrior_Red/Warrior_Attack1.png',
      frameCount: ATTACK_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
  },
  scale: SPRITE_SCALE,
});

/**
 * Swordsman - Melee infantry unit.
 *
 * Combat characteristics:
 * - Short attack range (melee)
 * - Moderate health and damage
 * - Deals physical damage on hit
 */
class Swordsman extends ArmyUnit {
  // ==================
  // Stats (from config)
  // ==================

  protected health = CONFIG.HEALTH;
  protected maxHealth = CONFIG.HEALTH;
  protected maxArmor = CONFIG.ARMOR;
  protected armor = CONFIG.ARMOR;
  protected magicResist = CONFIG.MAGIC_RESIST;
  protected attackRange = CONFIG.ATTACK_RANGE;
  protected accelerationRate = CONFIG.ACCELERATION;
  protected outOfSightRange = CONFIG.SIGHT_RANGE;
  protected attackCooldown = new Cooldown(CONFIG.ATTACK_COOLDOWN);

  /** Damage dealt per attack */
  protected readonly attackDamage = CONFIG.DAMAGE;

  // ==================
  // Unit Properties
  // ==================

  readonly side: 0 | 1;
  target: Target | null = null;
  shouldDispose = false;

  // ==================
  // Animation
  // ==================

  protected spriteAnimator: PixelArtSpriteAnimator;
  // Attack animation has 4 frames (0-3), trigger damage on frame 2
  protected triggerAttackAnimationFrame = 2;

  /**
   * Create a new Swordsman.
   * @param position - Starting world position
   * @param side - Team side (0 = ally, 1 = enemy)
   */
  constructor(position: Vector, side: 0 | 1) {
    super(position);
    this.side = side;

    // Set initial facing direction based on side
    this.direction = new Vector(side === 0 ? 1 : -1, 0);

    // Setup collision mask
    this.collisionMask = new Rectangle(
      CONFIG.COLLISION.WIDTH,
      CONFIG.COLLISION.HEIGHT
    );

    // Setup sprite animator with side-appropriate sprites
    const spriteSheet = side === 0 ? swordsmanSpriteSheetAlly : swordsmanSpriteSheetEnemy;
    const idleFrameOffset = spriteSheet.getAnimationFrameOffset('idle');
    this.spriteAnimator = new PixelArtSpriteAnimator(spriteSheet as any, idleFrameOffset);

    // Register animations using ImageSpriteSheet frame indices
    this.spriteAnimator.addAnimation(
      WALK_ANIMATION_ID,
      spriteSheet.getAnimationFrames('walk'),
      0.1,
      true // loop
    );
    this.spriteAnimator.addAnimation(
      ATTACK_ANIMATION_ID,
      spriteSheet.getAnimationFrames('attack'),
      0.1
    );
  }

  /**
   * Execute melee attack against current target.
   *
   * Called by the behavior system when attack conditions are met:
   * - Target exists and is valid
   * - Unit is in attack range
   * - Attack cooldown is ready
   *
   * Plays attack animation and deals damage on the trigger frame.
   */
  protected performAttack(_gctx: GameContext): void {
    // Capture target reference for the delayed callback
    const target = this.target;

    this.attack(() => {
      // Validate target still exists and is attackable when damage frame triggers
      if (this.shouldDispose) return;
      if (!target) return;
      if (!isAttackable(target)) return;

      target.takeDamage(this.attackDamage, 'physical');
    });
  }

  /**
   * Generate bloodstain effect when dying.
   */
  chooseTypeOfBloodstainWhenDying(background: Background) {
    return background.drawSwordsmanBloodstain.bind(background);
  }
}

export default Swordsman;
