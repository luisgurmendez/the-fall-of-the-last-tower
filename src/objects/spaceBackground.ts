import GameContext from "../core/gameContext";
import Vector from "../physics/vector";
import RenderUtils from "../render/utils";
import { PositionableMixin } from "../mixins/positional";
import RenderElement from "../render/renderElement";
import BaseObject from "./baseObject";
import { Circle, Rectangle } from "./shapes";
import RandomUtils from "../utils/random";
import { callTimes } from "../utils/fn";
import Intersections from "../utils/intersections";
import Color from "../utils/color";

const SpaceBackgroundMixin = PositionableMixin(BaseObject)

class SpaceBackground extends SpaceBackgroundMixin {

  constructor() {
    super();
    this.id = 'background';
  }

  render() {
    const renderFn = (gameContext: GameContext) => {
      const { canvasRenderingContext } = gameContext;
      canvasRenderingContext.fillStyle = "#000";
      RenderUtils.renderRectangle(canvasRenderingContext,
        new Vector(0, 0),
        new Rectangle(gameContext.worldDimensions.w, gameContext.worldDimensions.h)
      )
      canvasRenderingContext.fill();
    }
    const renderElement = new RenderElement(renderFn);
    renderElement.positionType = 'overlay';
    return renderElement
  }

  step() { }
}

export default SpaceBackground;


class Star extends SpaceBackgroundMixin {
  shape: Circle;
  depth: number;
  constructor(position: Vector) {
    super();
    this.depth = RandomUtils.getValueInRange(0.01, 15);
    this.position = position;
    this.shape = new Circle(RandomUtils.getValueInRange(0.5, 1.5));
  }
}
export class StarPool extends SpaceBackgroundMixin {
  stars: Star[];
  constructor(wd: Rectangle) {
    super();
    this.stars = [];

    callTimes(50000, () => {
      const starPos = new Vector(RandomUtils.getValueInRange(-wd.w, wd.w), RandomUtils.getValueInRange(-wd.h, wd.h));
      this.stars.push(new Star(starPos));
    })
  }

  render() {
    const renderFn = (context: GameContext) => {
      const { canvasRenderingContext, camera } = context;
      const cameraViewport = new Rectangle(camera.viewport.w / camera.zoom, camera.viewport.h / camera.zoom)

      canvasRenderingContext.fillStyle = '#FFF';
      const inCameraBoundsStars = this.stars.filter(s => {
        return Intersections.isPointInsideRectangle(s.position, cameraViewport, camera.position) && s.depth < camera.zoom;
      });

      inCameraBoundsStars.forEach(s => {
        const trasposedStarPosition = s.position.clone()
        canvasRenderingContext.fillStyle = new Color(255, 255, 255, 1 - (s.depth) / camera.zoom).rgba()
        canvasRenderingContext.beginPath();
        canvasRenderingContext.arc(trasposedStarPosition.x, trasposedStarPosition.y, s.shape.radius, 0, 2 * Math.PI);
        canvasRenderingContext.fill();
      })
    }


    const renderElement = new RenderElement(renderFn);
    return renderElement;
  }
}