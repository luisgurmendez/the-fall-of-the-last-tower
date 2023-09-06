import GameContext from "@/core/gameContext";
import { isDisposable } from "@/behaviors/disposable";
import Vector from "@/physics/vector";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import { swordsmanSprites } from "./sprites";
import PixelArtSpriteSheet from "@/sprites/PixelArtSpriteSheet";
import { isAttackable } from "@/behaviors/attackable";
import Background from "@/objects/background";
import BaseObject from "@/objects/baseObject";
import { Rectangle, Square } from "@/objects/shapes";
import ArmyUnit, { ATTACK_ANIMATION_ID, WALK_ANIMATION_ID } from "../armyUnit";
import Cooldown from "@/objects/cooldown";
import { buildArmySpritesWithSideColor } from "../spriteUtils";
import { Target } from "../types";
import CollisionsController from "@/controllers/CollisionsController";
import RandomUtils from "@/utils/random";
import { CASTLE_ID } from "@/objects/castle/castle";

const ATTACK_RANGE = 15;
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
  attackCooldown: Cooldown = new Cooldown(1);

  side: 0 | 1;
  // rotationSpeed: number;
  target: Target | null;
  spriteAnimator: PixelArtSpriteAnimator;
  health = 100;
  maxHealth: number = 100;
  protected triggerAttackAnimationFrame: number;

  constructor(position: Vector, side: 0 | 1) {
    super(position);
    this.direction = new Vector(1, 0);
    /// half the actual size
    this.collisionMask = new Rectangle(12, 16);
    this.side = side;
    // this.rotationSpeed = 2;
    this.target = null;
    this.shouldDispose = false;
    this.spriteAnimator = new PixelArtSpriteAnimator(
      side === 0 ? swordsmanSpriteSheetAlly : swordsmanSpriteSheetEnemy,
      1
    );
    this.spriteAnimator.addAnimation(WALK_ANIMATION_ID, [0, 1, 2], 0.2);
    this.spriteAnimator.addAnimation(ATTACK_ANIMATION_ID, [3, 4, 5, 6, 7, 8, 9], 0.2);
    this.triggerAttackAnimationFrame = 4;
  }

  shouldDispose: boolean;


  step(gctx: GameContext) {
    const { dt } = gctx;
    this.beforeStep(gctx);

    const prevPos = this.position.clone();

    if (this.target && isDisposable(this.target) && this.target.shouldDispose) {
      this.target = null;
    }

    let hasSetAnimation = false;
    this.fixTarget(gctx);

    if (!this.isAttacking) {

      this.adjustDirection(gctx.dt);

      this.acceleration = this.direction.clone().scalar(2000);
      this.velocity = this.calculateVelocity(gctx.dt);
      this.position = this.calculatePosition(gctx.dt);
    }

    if (this.shouldAttack) {
      const target = this.target
      this.attack(() => {
        if (!this.shouldDispose && target && isAttackable(target)) {
          target.applyDamage(30);
        }
      });
      hasSetAnimation = true;
    }

    if (this.target && CollisionsController.calculateCollision(this.target, this)) {
      this.position = prevPos;
    }

    this.afterStep(gctx);
  }

  private adjustDirection(dt: number) {
    const lookAt = this.target?.position.clone()
      .sub(this.position)
      .normalize() ?? new Vector(0, 0);

    this.direction = lookAt;
  }

  private fixTarget(gameContext: GameContext) {
    const { spatialHashing } = gameContext;
    if (this.target && (this.target.id === CASTLE_ID || this.target.position.distanceTo(this.position) > OUT_OF_REACH_RANGE)) {
      this.target = null;
    }

    if (!this.target || this.target.id === CASTLE_ID) {
      const nearByObjs = spatialHashing.queryInRange(this.position, OUT_OF_REACH_RANGE)

      const nearByEnemies = nearByObjs.filter(obj => (obj as any).side !== undefined && (obj as any).side !== this.side && isAttackable(obj));

      if (nearByEnemies.length > 0) {
        this.target = RandomUtils.getRandomValueOf(nearByEnemies) as Target;
      } else if (this.side === 1) {
        this.target = gameContext.objects.find(obj => obj.id === CASTLE_ID) as Target ?? null;
      }
    }
  }

  private getNearestEnemy(enemies: BaseObject[]): Target {
    enemies.sort((a, b) => {
      const aDistance = a.position.distanceTo(this.position);
      const bDistance = b.position.distanceTo(this.position);
      return aDistance - bDistance;
    });
    return enemies[0] as Target;
  }


  chooseTypeOfBloodstainWhenDying = (background: Background) => {
    return background.drawSwordsmanBloodstain.bind(background);
  }

  private get isAttacking() {
    return (
      this.spriteAnimator.currentAnimation === "a" &&
      this.spriteAnimator.isPlayingAnimation
    );
  }

  private get shouldAttack() {
    return this.target && this.canAttack() && this.target.position.distanceTo(this.position) < ATTACK_RANGE + this.target.collisionMask.w / 2;
  }

}

export default Swordsman;
