import GameContext from "@/core/gameContext";
import Vector from "@/physics/vector";
import { PhysicableMixin } from "@/mixins/physics";
import BaseObject from "@/objects/baseObject";
import RenderElement from "@/render/renderElement";
import Disposable from "@/behaviors/disposable";
import Color from "@/utils/color";

const ParticleMixins = PhysicableMixin(BaseObject);

class Particle extends ParticleMixins implements Disposable {
  ttl: number;
  color: Color;
  shouldDispose = false;
  fade = false;
  private maxTTL: number;
  size: number;
  isVertical = false;

  constructor(ttl = 1) {
    super();
    this.position = new Vector();
    this.velocity = new Vector(0, 0);
    this.direction = new Vector(0, -1);
    this.ttl = ttl;
    this.maxTTL = ttl;
    this.color = new Color(0, 0, 0);
    this.fade = true;
    this.size = 1;
  }

  step(context: GameContext) {
    if (this.isVertical) {
      // changes the size to give an effect that the particles i going up to the camera
      this.size += context.dt * 10;
    }
    // this.acceleration = new Vector();
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
        const alpha = this.ttl / this.maxTTL;
        this.color.a = alpha;
      }
      canvasRenderingContext.fillStyle = this.color.rgba();
      canvasRenderingContext.fillRect(
        this.position.x - this.size / 2,
        this.position.y - this.size / 2,
        this.size * 2,
        this.size * 2
      );
    };
    return new RenderElement(renderFn, true);
  }
}

export default Particle;
