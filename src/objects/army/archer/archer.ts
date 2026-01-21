/**
 * Archer - Ranged infantry unit.
 *
 * A backline ranged unit that fires arrows at enemies from a distance.
 * Uses Archer sprites from tiny_sword asset pack.
 * Stats and configuration are defined in UnitConfig.ARCHER.
 */

import GameContext from "@/core/gameContext";
import Vector from "@/physics/vector";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import ImageSpriteSheet from "@/sprites/ImageSpriteSheet";
import Background from "@/objects/background";
import { Square } from "@/objects/shapes";
import Arrow from "./arrow";
import ArmyUnit, { ATTACK_ANIMATION_ID, WALK_ANIMATION_ID } from "../armyUnit";
import { Target } from "../types";
import Cooldown from "@/objects/cooldown";
import { UnitConfig } from "@/config";

const { ARCHER: CONFIG } = UnitConfig;

/** Sprite frame dimensions */
const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 192;
const SPRITE_SCALE = 0.35;

/** Animation frame counts */
const IDLE_FRAMES = 6;
const RUN_FRAMES = 4;
const SHOOT_FRAMES = 8;

// Pre-built sprite sheets for each side (avoid recreating per instance)
const archerSpriteSheetAlly = new ImageSpriteSheet({
  type: 'animations',
  animations: {
    idle: {
      src: '/assets/sprites/units/Archer_Blue/Archer_Idle.png',
      frameCount: IDLE_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
    walk: {
      src: '/assets/sprites/units/Archer_Blue/Archer_Run.png',
      frameCount: RUN_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
    attack: {
      src: '/assets/sprites/units/Archer_Blue/Archer_Shoot.png',
      frameCount: SHOOT_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
  },
  scale: SPRITE_SCALE,
});

const archerSpriteSheetEnemy = new ImageSpriteSheet({
  type: 'animations',
  animations: {
    idle: {
      src: '/assets/sprites/units/Archer_Red/Archer_Idle.png',
      frameCount: IDLE_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
    walk: {
      src: '/assets/sprites/units/Archer_Red/Archer_Run.png',
      frameCount: RUN_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
    attack: {
      src: '/assets/sprites/units/Archer_Red/Archer_Shoot.png',
      frameCount: SHOOT_FRAMES,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    },
  },
  scale: SPRITE_SCALE,
});

/** Vertical offset for arrow spawn position (bow height) */
const ARROW_SPAWN_OFFSET = new Vector(0, 1.5);

/**
 * Archer - Ranged infantry unit.
 *
 * Combat characteristics:
 * - Long attack range (ranged)
 * - Low health (glass cannon)
 * - Spawns arrow projectiles that deal physical damage
 */
class Archer extends ArmyUnit {
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

  /** Damage dealt by arrows */
  protected readonly arrowDamage = CONFIG.DAMAGE;

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
  // Shoot animation has 8 frames (0-7), trigger arrow spawn on frame 5
  protected triggerAttackAnimationFrame = 5;

  /**
   * Create a new Archer.
   * @param position - Starting world position
   * @param side - Team side (0 = ally, 1 = enemy)
   */
  constructor(position: Vector, side: 0 | 1) {
    super(position);
    this.side = side;

    // Set initial facing direction based on side
    this.direction = new Vector(side === 0 ? 1 : -1, 0);

    // Setup collision mask (square for archers)
    this.collisionMask = new Square(CONFIG.COLLISION.SIZE);

    // Setup sprite animator with side-appropriate sprites
    const spriteSheet = side === 0 ? archerSpriteSheetAlly : archerSpriteSheetEnemy;
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
      0.08
    );
  }

  /**
   * Execute ranged attack by spawning an arrow toward the target.
   *
   * Called by the behavior system when attack conditions are met:
   * - Target exists and is valid
   * - Unit is in attack range
   * - Attack cooldown is ready
   *
   * Plays attack animation and spawns arrow on the trigger frame.
   */
  protected performAttack(gctx: GameContext): void {
    const target = this.target;
    if (!target) return;

    // Calculate direction to target and face that way
    const directionToTarget = target.position.clone().sub(this.position).normalize();
    this.direction = directionToTarget.clone();

    // Capture spawn position for the delayed callback
    const spawnPosition = this.position.clone().add(ARROW_SPAWN_OFFSET);

    this.attack((gameContext) => {
      // Spawn arrow at the captured position, traveling toward target
      const arrow = new Arrow(
        spawnPosition.clone(),
        directionToTarget,
        this.side,
        this.arrowDamage
      );
      gameContext.objects.push(arrow);
    });
  }

  /**
   * Generate bloodstain effect when dying.
   */
  chooseTypeOfBloodstainWhenDying(background: Background): (inPosition: Vector) => void {
    return background.drawArcherBloodstain.bind(background);
  }
}

export default Archer;
