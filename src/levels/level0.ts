import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import generateAstronauts from "./shared/generateAstronauts";
import { targetPlanetColor } from "./shared/targetPlanetColor";
import GameContext from "../core/gameContext";
import RenderUtils from "../render/utils";
import { Dimensions } from "../core/canvas";
import RenderElement from "../render/renderElement";

function generate() {
  const earth = new Planet(new Vector(0, 0), 4000, 150)
  earth.color = targetPlanetColor;
  const astronauts = generateAstronauts(new Vector(0, -230), new Vector(0, -250), new Vector(0, -300))
  const t = new Text();
  const objects: BaseObject[] = [
    earth,
    ...astronauts,
    t
  ];
  const level = new Level(objects, new LandingOnTargetPlanetObjective(earth))
  level.rocket.position = new Vector(0, -160);
  level.camera.zoom = 1.6;
  return level;

}


export class Text extends BaseObject {

  render() {
    const renderFn = (ctx: GameContext) => {
      const canvasRenderingContext = ctx.canvasRenderingContext;
      canvasRenderingContext.font = '25px Comic Sans MS';
      canvasRenderingContext.fillStyle = '#FFF';
      RenderUtils.renderText(canvasRenderingContext, 'Press [w] to use your main thruster, rescue the astronauts', new Vector(Dimensions.w / 2, Dimensions.h - 70));
      RenderUtils.renderText(canvasRenderingContext, ' and then let gravity pull you down and land', new Vector(Dimensions.w / 2, Dimensions.h - 40));
    }

    const rEl = new RenderElement(renderFn);
    rEl.positionType = 'overlay';
    return rEl;
  }
}


export default generate;