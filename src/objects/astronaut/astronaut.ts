import { PhysicableMixin } from '../../mixins/physics';
import { CollisionableMixin } from '../../mixins/collisionable';
import { PositionableMixin } from '../../mixins/positional';
import BaseObject from '../../objects/baseObject';
import { Rectangle } from '../../objects/shapes';
import RenderElement from '../../render/renderElement';
import AstronautRenderUtils from './astronautRenderUtils';
import GameContext from '../../core/gameContext';
import Vector from '../../physics/vector';
import Disposable from '../../behaviors/disposable';
import { ObjectType } from '../../objects/objectType';
import RandomUtils from '../../utils/random';
import { AffectedByGravitationableMixin } from '../../mixins/affectedByGravitational';

const AstronautMixins =
  PhysicableMixin(
    CollisionableMixin<Rectangle>()(
      PositionableMixin(BaseObject)
    )
  );

class Astronaut extends AstronautMixins implements Disposable {
  shouldDispose: boolean = false;

  constructor(position: Vector) {
    super();
    this.direction = new Vector(1, 0);
    this.collisionMask = new Rectangle(12, 12);
    this.angularVelocity = RandomUtils.getNegativeRandomly(RandomUtils.getIntegerInRange(45, 220));
    this.position = position;
    this.type = ObjectType.ASTRONAUT;
  }

  step(context: GameContext) {
    this.angularVelocity = this.calculateAngularVelocity(context.dt);
    this.direction = this.calculateDirection(context.dt);
    this.position = this.calculatePosition(context.dt);
    this.checkRescued(context.rescueAstronaut);
  }

  checkRescued(rescueAstronaut: () => void) {
    const collideWithRocket = this.collisions.find(obj => obj.type === ObjectType.ROCKET);
    if (collideWithRocket !== undefined) {
      this.rescued(rescueAstronaut);
    }
  }

  render() {
    const renderFn = (context: GameContext) => {
      AstronautRenderUtils.renderAstronaut(context, this);
    }
    const renderElement = new RenderElement(renderFn);
    return renderElement;
  }

  rescued(rescueAstronaut: () => void) {
    this.shouldDispose = true;
    rescueAstronaut();
  }

}

export default Astronaut;