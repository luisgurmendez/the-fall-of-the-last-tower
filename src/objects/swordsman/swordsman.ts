import GameContext from "../../core/gameContext";
import BaseObject from "../baseObject";
import Disposable, { isDisposable } from "../../behaviors/disposable";
import Vector from "../../physics/vector";
import { PhysicableMixin } from "../../mixins/physics";
import { CollisionableMixin } from "../../mixins/collisionable";
import { Rectangle, Square } from "../shapes";
import RenderElement from "../../render/renderElement";
import PixelArtSpriteAnimator from "../../sprites/PixelArtSpriteAnimator";
import { buildSwordsManSprites } from "./sprites";
import PixelArtSpriteSheet from "../../sprites/PixelArtSpriteSheet";
import Attackable, { isAttackable } from "../../behaviors/attackable";
import { generateSwordsmanBloodBath } from "./ParticleUtils";
import RenderUtils from "../../render/utils";
import Background from "../../objects/background";

const SowrdsmanMixin = PhysicableMixin(
  CollisionableMixin<Square>()(BaseObject)
);

const swordsmanSpriteSheetAlly = new PixelArtSpriteSheet(
  buildSwordsManSprites(0)
);
const swordsmanSpriteSheetEnemy = new PixelArtSpriteSheet(
  buildSwordsManSprites(1)
);

class Swordsman
  extends SowrdsmanMixin
  implements ArmyUnit, Disposable, Attackable {
  side: 0 | 1;
  rotationSpeed: number;
  target: BaseObject | null;
  attackTimeout = 0;
  attackingTimeout = 0;
  spriteAnimator: PixelArtSpriteAnimator;
  health = 10;

  constructor(position: Vector, side: 0 | 1) {
    super(position);
    this.direction = new Vector(1, 0);
    this.collisionMask = new Square(32);
    this.side = side;
    this.rotationSpeed = 2;
    this.target = null;
    this.shouldDispose = false;
    this.attackTimeout = 1;
    this.attackingTimeout = 0;
    this.spriteAnimator = new PixelArtSpriteAnimator(
      side === 0 ? swordsmanSpriteSheetAlly : swordsmanSpriteSheetEnemy,
      1
    );
    this.spriteAnimator.addAnimation("w", [0, 1, 2], 0.2);
    this.spriteAnimator.addAnimation("a", [3, 4, 5, 6, 7, 8, 9], 0.2);
    this.spriteAnimator.playAnimation("w", true);

  }

  shouldDispose: boolean;

  dispose() {
    this.shouldDispose = true;
  }

  render() {
    if (this.isAttacking) {
      this.spriteAnimator.playAnimation("a");
    } else if (this.isMoving()) {
      this.spriteAnimator.playAnimation("w");
    } else {
      this.spriteAnimator.stopAnimation();
    }

    return new RenderElement((gtx) => {
      const { canvasRenderingContext } = gtx;
      this.spriteAnimator.render(
        canvasRenderingContext,
        this.position,
        this.direction.x < 0
      );
    }, true);
  }

  step(gctx: GameContext) {
    if (this.health <= 0) {
      this.die(gctx);
    }

    let hasSetAnimation = false;
    const { dt, spatialHasing } = gctx;
    this.spriteAnimator.update(dt);
    const objs = spatialHasing.query(this.position);
    this.attackingTimeout -= dt;

    if (this.target && isDisposable(this.target) && this.target.shouldDispose) {
      this.target = null;
    }

    if (!this.target) {
      this.target = this.getNearestEnemy(objs);
    }

    if (!this.isAttacking) {
      if (this.target) {
        const directionToEnemy = this.target.position
          .clone()
          .sub(this.position)
          .normalize();
        const angleToEnemy = this.direction.angleTo(directionToEnemy);
        const rotationAmount = this.rotationSpeed * dt;
        const rotationAngle =
          Math.sign(angleToEnemy) *
          Math.min(Math.abs(angleToEnemy), rotationAmount);

        this.direction = this.direction
          .rotate(rotationAngle, false)
          .normalize();
      } else {
        const directionToEnemy = new Vector(0, 0);
        const angleToEnemy = this.direction.angleTo(directionToEnemy);
        const rotationAmount = this.rotationSpeed * dt;
        const rotationAngle =
          Math.sign(angleToEnemy) *
          Math.min(Math.abs(angleToEnemy), rotationAmount);

        this.direction = this.direction
          .rotate(rotationAngle, false)
          .normalize();
      }

      this.acceleration = this.direction.clone().scalar(4);
      this.velocity = this.calculateVelocity(gctx.dt);
      this.position = this.calculatePosition(gctx.dt);
    }

    if (this.target) {
      // Attacks if enemy is near
      if (
        this.canAttack &&
        this.target.position.distanceTo(this.position) < 20
      ) {
        this.attackingTimeout = this.attackTimeout;
        if (Math.random() > 0.5 && isDisposable(this.target)) {
          this.spriteAnimator.playAnimation("a", true);
          hasSetAnimation = true;
          this.acceleration = new Vector(0, 0);
          this.velocity = new Vector(0, 0);
          if (isAttackable(this.target)) {
            this.target.hasBeenAttacked(3);
          }
          // this.target.shouldDispose = true;
          // this.target = null;
        }
      } else {
        // Retargets if enemy is far
        // if (this.target.position.distanceTo(this.position) > 150) {
        // this.target = null;
        // }
      }
    }

    if (!hasSetAnimation) {
      this.spriteAnimator.playAnimation("w", false);
    }
  }

  getNearestEnemy(objs: BaseObject[]) {
    const enemies: BaseObject[] = objs.filter(
      (obj) =>
        (obj as any).side !== undefined && (obj as any).side !== this.side
    );
    enemies.sort((a, b) => {
      const aDistance = a.position.distanceTo(this.position);
      const bDistance = b.position.distanceTo(this.position);
      return aDistance - bDistance;
    });
    return enemies[0];
  }

  hasBeenAttacked(damage: number) {
    if (!this.tryToBlockAttack(damage)) {
      this.health -= damage;
    }
  }

  tryToBlockAttack(damage: number) {
    return false;
  }

  die(gameContext: GameContext) {
    this.shouldDispose = true;
    console.log(this.position);
    gameContext.objects.push(
      ...generateSwordsmanBloodBath(this.position.clone())
    );
    const background = gameContext.objects.find(obj => obj.id === 'background');
    if (background instanceof Background) {
      background.drawBloodStain(this.position.clone().add(new Vector(0, this.collisionMask.h / 2)));
    }
  }

  get isAttacking() {
    return (
      this.spriteAnimator.currentAnimation === "a" &&
      this.spriteAnimator.isPlayingAnimation &&
      this.attackingTimeout > 0
    );
  }

  get canAttack() {
    return this.attackingTimeout <= 0;
  }
}

export default Swordsman;
