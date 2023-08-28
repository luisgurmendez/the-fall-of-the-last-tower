import GameContext from "../../core/gameContext";
import BaseObject from "../../objects/baseObject";
import Initializable from "../../behaviors/initializable";
import Disposable from "../../behaviors/disposable";
import Vector from "../../physics/vector";
import { PhysicableMixin } from "../../mixins/physics";
import { CollisionableMixin } from "../../mixins/collisionable";
import { Square } from "../../objects/shapes";
import RenderElement from "../../render/renderElement";
import Assets from "../../controllers/AssetLoader";

const CatapultMixin = PhysicableMixin(CollisionableMixin<Square>()(BaseObject));

class Catapult extends CatapultMixin implements Initializable, Disposable {
  shouldInitialize = true;
  shouldDispose = false;

  constructor(position: Vector) {
    super(position);
    this.direction = new Vector(1, 0);
    this.collisionMask = new Square(50);
    const acc = 5 * Math.random();
    this.acceleration = new Vector(-1 * acc, acc);
    this.velocity = this.calculateVelocity(3);
  }

  render() {
    return new RenderElement((gtx) => {
      const { canvasRenderingContext } = gtx;
      canvasRenderingContext.drawImage(
        Assets.getInstance().images["catapult"],
        this.position.x,
        this.position.y,
        this.collisionMask.w,
        this.collisionMask.h
      );
    }, true);
  }

  step(gctx: GameContext) {
    this.position = this.calculatePosition(gctx.dt);
  }

  init(gameContext: GameContext) {}
  dispose() {}
}

export default Catapult;
