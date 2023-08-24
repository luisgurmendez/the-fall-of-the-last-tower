import Vector from "../../physics/vector";
import Renderable from "../../behaviors/renderable";
import BaseObject from "../../objects/baseObject";
import { CollisionableMixin } from "../../mixins/collisionable";
import { Rectangle } from "../../objects/shapes";
import { PositionableMixin } from "../../mixins/positional";
import RenderElement from "../../render/renderElement";
import GameContext from "../../core/gameContext";
import RandomUtils from "../../utils/random";

const AsteroidMixins =
  CollisionableMixin<Rectangle>()(
    PositionableMixin(BaseObject)
  );

type Polygon = Vector[]

/**
 * @deprecated
 */
class Asteroid extends AsteroidMixins implements Renderable {

  shape: Polygon;

  constructor(position: Vector = new Vector()) {
    super();
    this.position = position
    const w = RandomUtils.getIntegerInRange(20, 50)
    const h = RandomUtils.getIntegerInRange(20, 50)
    this.shape = generateRandomAsteroidShape(w, h, 10);
    this.collisionMask = new Rectangle(w, h)
  }

  render() {
    const renderFn = (context: GameContext) => {
      const { canvasRenderingContext } = context;
      // RenderUtils.renderRectangle(canvasRenderingContext, this.position, this.collisionMask);
      // canvasRenderingContext.fillStyle = 'yellow';
      // canvasRenderingContext.fill();
      canvasRenderingContext.beginPath()
      canvasRenderingContext.moveTo(this.shape[0].x, this.shape[0].y);
      for (let i = 1; i < this.shape.length; i++) {
        const point = this.shape[i];
        canvasRenderingContext.lineTo(this.position.x + point.x, this.position.y + point.y);
      }
      canvasRenderingContext.fillStyle = 'red';
      canvasRenderingContext.fill();



    }

    const renderElement = new RenderElement(renderFn);
    return renderElement;
  }
}


export default Asteroid;


function generateRandomAsteroidShape(w: number, h: number, s: number) {
  const _w = w / 2;
  const _h = h / 2

  const shape = [];

  // left-top cuadrant, (-x,+y) 
  shape.push(new Vector(-1 * RandomUtils.getIntegerInRange(0, _w), RandomUtils.getIntegerInRange(0, _h)))

  // right-top cuadrant, (+x,+y) 
  shape.push(new Vector(RandomUtils.getIntegerInRange(0, _w), RandomUtils.getIntegerInRange(0, _h)))

  // right-bottom cuadrant, (+x,-y) 
  shape.push(new Vector(RandomUtils.getIntegerInRange(0, _w), -1 * RandomUtils.getIntegerInRange(0, _h)))

  // left-bottom cuadrant, (-x,-y) 
  shape.push(new Vector(-1 * RandomUtils.getIntegerInRange(0, _w), -1 * RandomUtils.getIntegerInRange(0, _h)))

  shape.push(shape[0]);
  return shape;
}

