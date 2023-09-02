import GameContext from "@/core/gameContext";
import Disposable, { isDisposable } from "@/behaviors/disposable";
import Vector from "@/physics/vector";
import { PhysicableMixin } from "@/mixins/physics";
import { CollisionableMixin } from "@/mixins/collisionable";
import RenderElement from "@/render/renderElement";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import { buildSwordsManSprites } from "./sprites";
import PixelArtSpriteSheet from "@/sprites/PixelArtSpriteSheet";
import Attackable, { isAttackable } from "@/behaviors/attackable";
import { generateSwordsmanBloodBath } from "./ParticleUtils";
import Background from "@/objects/background";
import BaseObject from "@/objects/baseObject";
import { Square } from "@/objects/shapes";

const ATTACK_RANGE = 20;
const OUT_OF_REACH_RANGE = 350;

const SwordsmanMixin = PhysicableMixin(
  CollisionableMixin<Square>()(BaseObject)
);

const swordsmanSpriteSheetAlly = new PixelArtSpriteSheet(
  buildSwordsManSprites(0)
);
const swordsmanSpriteSheetEnemy = new PixelArtSpriteSheet(
  buildSwordsManSprites(1)
);

class Swordsman
  extends SwordsmanMixin
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
    const { dt } = gctx;

    if (this.health <= 0) {
      this.die(gctx);
    }

    if (this.target && isDisposable(this.target) && this.target.shouldDispose) {
      this.target = null;
    }

    let hasSetAnimation = false;
    this.attackingTimeout -= dt;
    this.spriteAnimator.update(dt);

    this.fixTarget(gctx);

    if (!this.isAttacking) {

      this.adjustDirection(gctx.dt);
      const lookAt = this.target?.position.clone()
        .sub(this.position)
        .normalize() ?? new Vector(0, 0);
      this.acceleration = lookAt.scalar(4);
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

    const angleToEnemy = this.direction.angleTo(lookAt);
    const rotationAmount = this.rotationSpeed * dt;
    const rotationAngle =
      Math.sign(angleToEnemy) *
      Math.min(Math.abs(angleToEnemy), rotationAmount);

    this.direction = this.direction
      .rotate(rotationAngle, false)
      .normalize();
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
      } else {
        this.target = gameContext.objects.find(obj => obj.id === 'castle') ?? null;
      }
    }
  }

  private attack(): boolean {
    this.attackingTimeout = this.attackTimeout;
    if (Math.random() > 0.5 && isDisposable(this.target)) {
      this.spriteAnimator.playAnimation("a", true);
      this.acceleration = new Vector(0, 0);
      this.velocity = new Vector(0, 0);
      if (isAttackable(this.target)) {
        this.target.hasBeenAttacked(3);
      }
      return true
    }
    return false;
  }

  private getNearestEnemy(enemies: BaseObject[]) {
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

  private tryToBlockAttack(damage: number) {
    return false;
  }

  private die(gameContext: GameContext) {
    this.shouldDispose = true;
    gameContext.objects.push(
      ...generateSwordsmanBloodBath(this.position.clone())
    );
    const background = gameContext.objects.find(obj => obj.id === 'background');
    if (background instanceof Background) {
      background.drawSwordsmanBloodstain(this.position.clone().add(new Vector(0, this.collisionMask.h / 2)));
    }
  }

  private get isAttacking() {
    return (
      this.spriteAnimator.currentAnimation === "a" &&
      this.spriteAnimator.isPlayingAnimation &&
      this.attackingTimeout > 0
    );
  }

  private get shouldAttack() {
    return this.target && this.canAttack && this.target.position.distanceTo(this.position) < ATTACK_RANGE;
  }

  private get canAttack() {
    return this.attackingTimeout <= 0;
  }
}

export default Swordsman;
