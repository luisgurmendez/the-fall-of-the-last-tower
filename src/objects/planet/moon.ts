



import GameContext from '../../core/gameContext';
import { Circle } from '../shapes';
import Vector from '../../physics/vector';
import { ObjectType } from '../objectType';
import RenderUtils from '../../render/utils';
import { PhysicableMixin } from '../../mixins/physics';
import { CollisionableMixin } from '../../mixins/collisionable';
import { PositionableMixin } from '../../mixins/positional';
import BaseObject from '../../objects/baseObject';
import { Gravitationable, GravitationalMixin, isGravitationable } from '../../mixins/gravitational';
import { AffectedByGravitationableMixin } from '../../mixins/affectedByGravitational';
import RenderElement from '../../render/renderElement';

const MoonMixins = AffectedByGravitationableMixin(
  GravitationalMixin(
    PhysicableMixin(
      CollisionableMixin<Circle>()(
        PositionableMixin(BaseObject)
      )
    )
  )
);

/**
 * @deprecated
 */
class Moon extends MoonMixins {

  constructor(position: Vector) {
    super();
    this.position = position;
    this.gravitationalForce = 700;
    this.type = ObjectType.PLANET;
    this.gravitationalThreshold = 150;
    this.velocity = new Vector(30, 0)
    this.collisionMask = new Circle(4);
    this.direction = new Vector(0, -1);
  }

  step(context: GameContext) {
    this.acceleration = this.calculateAcceleration(context);
    this.position = this.calculatePosition(context.dt);
    this.velocity = this.calculateVelocity(context.dt);
  }

  render() {
    return new RenderElement(this._render);
  }

  _render = (context: GameContext) => {
    const canvasRenderingContext = context.canvasRenderingContext;
    canvasRenderingContext.fillStyle = '#FFF'
    canvasRenderingContext.strokeStyle = '#FFF'

    canvasRenderingContext.save();
    canvasRenderingContext.beginPath();
    canvasRenderingContext.setLineDash([5, 15]);
    canvasRenderingContext.arc(this.position.x, this.position.y, this.gravitationalThreshold, 0, 2 * Math.PI);
    canvasRenderingContext.stroke();
    canvasRenderingContext.restore();

    if (this.isColliding) {
      canvasRenderingContext.strokeStyle = '#F00'
    }
    RenderUtils.renderCircle(canvasRenderingContext, this.position.clone(), this.collisionMask);
    canvasRenderingContext.fill();
  }

  private calculateAcceleration(context: GameContext) {
    return this.calculateGravitationalAcceleration(context);
  }

}

export default Moon;
