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
import RenderElement from '../../render/renderElement';
import Color from '../../utils/color';
import RandomUtils from '../../utils/random';
import { AffectedByGravitationableMixin } from '../../mixins/affectedByGravitational';
import { Dimensions } from '../../core/canvas';

const PlanetMixins = AffectedByGravitationableMixin(GravitationalMixin(
  PhysicableMixin(
    CollisionableMixin<Circle>()(
      PositionableMixin(BaseObject)
    )
  )
)
);

class Planet extends PlanetMixins {

  hasRing: boolean = true;
  isMoon: boolean;
  color: Color;
  ringColor: Color;
  rotation: number;

  showGravityThreshold: boolean = true;

  constructor(position: Vector, gravitationalForce: number, radius: number, hasRing: boolean = RandomUtils.getRandomBoolean(0.3), isMoon: boolean = false) {
    super();

    this.position = position;
    this.gravitationalForce = gravitationalForce
    this.type = ObjectType.PLANET;
    this.collisionMask = new Circle(radius);
    this.gravitationalThreshold = radius * 5;
    this.isMoon = isMoon;
    this.hasRing = hasRing;
    this.color = Color.random(255, 255, 30);
    this.rotation = RandomUtils.getValueInRange(-Math.PI / 4, Math.PI / 4);
    this.ringColor = Color.random();
  }

  step(context: GameContext) {
    if (this.isMoon) {
      this.acceleration = this.calculateAcceleration(context);
      this.position = this.calculatePosition(context.dt);
      this.velocity = this.calculateVelocity(context.dt);
    }
  }

  render() {
    return new RenderElement(this._render);
  }

  _render = (context: GameContext) => {
    const canvasRenderingContext = context.canvasRenderingContext;
    canvasRenderingContext.fillStyle = this.color.rgba();
    canvasRenderingContext.strokeStyle = this.color.rgba();

    if (this.showGravityThreshold) {
      canvasRenderingContext.save();
      canvasRenderingContext.beginPath();
      canvasRenderingContext.setLineDash([5, 15]);
      canvasRenderingContext.arc(this.position.x, this.position.y, this.gravitationalThreshold, 0, 2 * Math.PI);
      canvasRenderingContext.stroke();
      canvasRenderingContext.restore();
    }

    RenderUtils.renderCircle(canvasRenderingContext, this.position, this.collisionMask);
    canvasRenderingContext.fill();

    // Renders planet ring
    if (this.hasRing && !this.isMoon) {

      // To rotate the ring :
      RenderUtils.rotateSelf(canvasRenderingContext, this.position, this.rotation);

      canvasRenderingContext.beginPath();
      canvasRenderingContext.strokeStyle = this.ringColor.rgba();
      canvasRenderingContext.lineWidth = 6;
      canvasRenderingContext.moveTo(this.position.x - this.collisionMask.radius, this.position.y);
      canvasRenderingContext.bezierCurveTo(
        this.position.x - this.collisionMask.radius * 4,
        this.position.y + this.collisionMask.radius / 2,
        this.position.x + this.collisionMask.radius * 4,
        this.position.y + this.collisionMask.radius / 2,
        this.position.x + this.collisionMask.radius, this.position.y
      )
      canvasRenderingContext.stroke();
      canvasRenderingContext.strokeStyle = '#8484FF';
      canvasRenderingContext.lineWidth = 1;
      canvasRenderingContext.stroke();
    }
  }

  private calculateAcceleration(context: GameContext) {
    return this.calculateGravitationalAcceleration(context);
  }

}

export default Planet;
