



import GameContext from '../../core/gameContext';
import Vector from '../../physics/vector';
import { ObjectType } from '../objectType';
import { PhysicableMixin } from '../../mixins/physics';
import { PositionableMixin } from '../../mixins/positional';
import BaseObject from '../../objects/baseObject';
import RenderElement from '../../render/renderElement';
import Disposable from '../../behaviors/disposable';
import Color from '../../utils/color';

const ParticleMixins = PhysicableMixin(
  PositionableMixin(BaseObject)
);

class Particle extends ParticleMixins implements Disposable {

  ttl: number;
  color: Color;
  shouldDispose: boolean = false;
  fade = false;
  private maxTTL: number;
  size: number;

  constructor(ttl: number = 1) {
    super();
    this.position = new Vector();
    this.type = ObjectType.PARTICLE;
    this.velocity = new Vector(0, 0)
    this.direction = new Vector(0, -1);
    this.ttl = ttl;
    this.maxTTL = ttl;
    this.color = new Color(0, 0, 0);
    this.fade = true;
    this.size = 1;
  }

  step(context: GameContext) {
    this.acceleration = this.calculateAcceleration(context);
    this.position = this.calculatePosition(context.dt);
    this.velocity = this.calculateVelocity(context.dt);
    this.ttl -= context.dt;
    if (this.ttl < 0) {
      this.shouldDispose = true;
    }
  }

  render() {
    const renderFn = (context: GameContext) => {
      const canvasRenderingContext = context.canvasRenderingContext;
      if (this.fade) {
        let alpha = this.ttl / this.maxTTL;
        this.color.a = alpha;
      }
      canvasRenderingContext.fillStyle = this.color.rgba();
      canvasRenderingContext.beginPath();
      // canvasRenderingContext.rect(this.position.x, this.position.y, this.size * 2, this.size * 2); // square particles?
      canvasRenderingContext.arc(this.position.x, this.position.y, this.size, 0, 2 * Math.PI);
      canvasRenderingContext.fill();
    }
    return new RenderElement(renderFn);
  }

  private calculateAcceleration(context: GameContext) {
    return new Vector()
  }

}

export default Particle;
