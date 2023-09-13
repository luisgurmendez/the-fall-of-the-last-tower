import GameContext from "@/core/gameContext";
import Vector from "@/physics/vector";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import { swordsmanSprites } from "./sprites";
import PixelArtSpriteSheet from "@/sprites/PixelArtSpriteSheet";
import { isAttackable } from "@/behaviors/attackable";
import Background from "@/objects/background";
import { Rectangle } from "@/objects/shapes";
import ArmyUnit, { ATTACK_ANIMATION_ID, WALK_ANIMATION_ID } from "../armyUnit";
import Cooldown from "@/objects/cooldown";
import { buildArmySpritesWithSideColor } from "../spriteUtils";
import { Target } from "../types";

const ATTACK_RANGE = 12;
const OUT_OF_REACH_RANGE = 350;

const swordsmanSpriteSheetAlly = new PixelArtSpriteSheet(
  buildArmySpritesWithSideColor(swordsmanSprites, 0)
);
const swordsmanSpriteSheetEnemy = new PixelArtSpriteSheet(
  buildArmySpritesWithSideColor(swordsmanSprites, 1)
);

class Swordsman
  extends ArmyUnit {
  maxArmor: number = 0;
  armor: number = 0;
  attackCooldown: Cooldown = new Cooldown(5);

  side: 0 | 1;
  // rotationSpeed: number;
  target: Target | null;
  spriteAnimator: PixelArtSpriteAnimator;
  health = 100;
  maxHealth: number = 100;
  protected outOfSightRange: number = OUT_OF_REACH_RANGE;
  protected triggerAttackAnimationFrame: number;
  protected attackRange = ATTACK_RANGE;
  protected accelerationRate = 400;

  constructor(position: Vector, side: 0 | 1) {
    super(position);
    this.direction = new Vector(1, 0);
    /// half the actual size
    this.collisionMask = new Rectangle(18, 26);
    this.side = side;
    this.target = null;
    this.shouldDispose = false;
    this.spriteAnimator = new PixelArtSpriteAnimator(
      side === 0 ? swordsmanSpriteSheetAlly : swordsmanSpriteSheetEnemy,
      3
    );
    this.spriteAnimator.addAnimation(WALK_ANIMATION_ID, [0, 1, 2], 0.2);
    this.spriteAnimator.addAnimation(ATTACK_ANIMATION_ID, [3, 4, 5, 6, 7, 8, 9], 0.2);
    this.triggerAttackAnimationFrame = 4;

  }

  shouldDispose: boolean;

  // move(g: GameContext) {

  //   if (!this.isAttacking) {
  //     let _lookingAtDirection = new Vector();

  //     if (this.targetPosition) {
  //       _lookingAtDirection = this.targetPosition.clone().sub(this.position).normalize();
  //     } else if (this.target) {
  //       _lookingAtDirection = this.target.position.clone().sub(this.position.clone()).normalize();
  //     } else {
  //       this.velocity = new Vector(0, 0);
  //       this.acceleration = new Vector(0, 0);
  //       return;
  //     }

  //     this.direction = _lookingAtDirection.clone();
  //     this.acceleration = _lookingAtDirection.scalar(this.accelerationRate);
  //     this.velocity = this.calculateVelocity(g.dt);
  //   }
  // }

  attackIfPossible(g: GameContext) {
    if (this.shouldAttack) {
      const target = this.target;
      this.attack(() => {
        if (!this.shouldDispose && target && isAttackable(target)) {
          target.applyDamage(30);
        }
      });
    }
  }

  chooseTypeOfBloodstainWhenDying = (background: Background) => {
    return background.drawSwordsmanBloodstain.bind(background);
  }

  private get shouldAttack() {
    return this.target && this.canAttack() && this.isNearTargetWithThreashold(ATTACK_RANGE);
  }

  private isNearTargetWithThreashold(threshold: number) {
    return this.target && this.target.position.distanceTo(this.position) < threshold + this.target.collisionMask.maxDistanceToCenter;
  }
}

export default Swordsman;
