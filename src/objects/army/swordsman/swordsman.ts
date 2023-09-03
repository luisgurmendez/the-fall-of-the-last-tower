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
import ArmyUnit from "../armyUnit";
import Cooldown from "@/objects/cooldown";
import { buildArmySpritesWithSideColor } from "../spriteUtils";
import { Target } from "../types";

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
  attackCooldown: Cooldown = new Cooldown(1000);

  side: 0 | 1;
  // rotationSpeed: number;
  target: Target | null;
  spriteAnimator: PixelArtSpriteAnimator;
  health = 100;
  maxHealth: number = 100;

  constructor(position: Vector, side: 0 | 1) {
    super(position);
    this.direction = new Vector(1, 0);
    this.collisionMask = new Rectangle(24, 32);
    this.side = side;
    // this.rotationSpeed = 2;
    this.target = null;
    this.shouldDispose = false;
    this.spriteAnimator = new PixelArtSpriteAnimator(
      side === 0 ? swordsmanSpriteSheetAlly : swordsmanSpriteSheetEnemy,
      1
    );
    this.spriteAnimator.addAnimation("w", [0, 1, 2], 0.2);
    this.spriteAnimator.addAnimation("a", [3, 4, 5, 6, 7, 8, 9], 0.2);

  }

  shouldDispose: boolean;

  render() {
    if (this.isAttacking) {
      this.spriteAnimator.playAnimation("a");
    } else if (this.isMoving()) {
      this.spriteAnimator.playAnimation("w");
    } else {
      this.spriteAnimator.stopAnimation();
    }

    return this.buildRenderElement();
  }

  step(gctx: GameContext) {
    const { dt } = gctx;

    if (this.health <= 0) {
      this.die(gctx);
    }

    if (this.target && isDisposable(this.target) && this.target.shouldDispose) {
      this.target = null;
    }

    let hasSetAnimation = false;
    this.attackCooldown.update(dt);
    this.spriteAnimator.update(dt);

    this.fixTarget(gctx);

    if (!this.isAttacking) {

      this.adjustDirection(gctx.dt);

      const lookAt = this.target?.position.clone()
        .sub(this.position)
        .normalize() ?? new Vector(0, 0);

      this.acceleration = lookAt.scalar(80);
      this.velocity = this.calculateVelocity(gctx.dt);
      this.position = this.calculatePosition(gctx.dt);
    }

    if (this.shouldAttack) {
      hasSetAnimation = this.attack();
    }


    if (!hasSetAnimation) {
      this.spriteAnimator.playAnimation("w", false);
    }
  }

  /// TODO remove, not worth it.
  private adjustDirection(dt: number) {
    const lookAt = this.target?.position.clone()
      .sub(this.position)
      .normalize() ?? new Vector(0, 0);

    this.direction = lookAt;
    // const angleToEnemy = this.direction.angleTo(lookAt);
    // const rotationAmount = this.rotationSpeed * dt;
    // const rotationAngle =
    //   Math.sign(angleToEnemy) *
    //   Math.min(Math.abs(angleToEnemy), rotationAmount);

    // this.direction = this.direction
    //   .rotate(rotationAngle, false)
    //   .normalize();
  }

  private fixTarget(gameContext: GameContext) {
    const { spatialHashing } = gameContext;
    if (this.target && (this.target.id === 'castle' || this.target.position.distanceTo(this.position) > OUT_OF_REACH_RANGE)) {
      this.target = null;
    }

    if (!this.target || this.target.id === 'castle') {
      const nearByObjs = spatialHashing.query(this.position);
      /// TODO fix types
      const nearByEnemies = nearByObjs.filter(obj => (obj as any).side !== undefined && (obj as any).side !== this.side);
      if (nearByEnemies.length > 0) {
        this.target = this.getNearestEnemy(nearByEnemies);
      } else if (this.side === 1) {
        this.target = gameContext.objects.find(obj => obj.id === 'castle') as Target ?? null;
      }
    }
  }

  protected attack(): boolean {
    this.spriteAnimator.playAnimation("a", true);
    this.acceleration = new Vector(0, 0);
    this.velocity = new Vector(0, 0);
    this.attackCooldown.start();
    const target = this.target;
    setTimeout(() => {
      if (!this.shouldDispose && target && isAttackable(target)) {
        target.applyDamage(30);
      }
    }, 800)

    return true
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
