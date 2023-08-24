
import Level from "../core/level";
import Planet from "../objects/planet/planet";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import LandingOnTargetPlanetObjective from "./shared/LandingOnTargetPlanetObjective";
import generateAstronauts from "./shared/generateAstronauts";
import { targetPlanetColor } from "./shared/targetPlanetColor";
import { generateMoon } from "./shared/generators";
import GameContext from "../core/gameContext";
import RenderUtils from "../render/utils";
import { Dimensions } from "../core/canvas";
import RenderElement from "../render/renderElement";

function generate() {
  const earth = new Planet(new Vector(0, 0), 4500, 140);
  earth.hasRing = false;
  earth.color = targetPlanetColor;

  const astronauts = generateAstronauts(new Vector(0, -220), new Vector(-80, -200), new Vector(-130, -165));
  const moon = generateMoon(new Vector(0, 240), new Vector(60, 0))
  const t = new Text();
  const objects: BaseObject[] = [
    earth,
    moon,
    t,
    ...astronauts
  ];

  const level = new Level(objects, new LandingOnTargetPlanetObjective(earth));
  level.rocket.position = new Vector(0, -earth.collisionMask.radius - 10);
  level.camera.zoom = 1.6;
  return level;

}


export class Text extends BaseObject {

  render() {
    const renderFn = (ctx: GameContext) => {
      const canvasRenderingContext = ctx.canvasRenderingContext;
      canvasRenderingContext.font = '25px Comic Sans MS';
      canvasRenderingContext.fillStyle = '#FFF';
      RenderUtils.renderText(canvasRenderingContext, 'Press [w] and [a,s,d] to use your thrusters, ', new Vector(Dimensions.w / 2, Dimensions.h - 70));
      RenderUtils.renderText(canvasRenderingContext, ' then land in the blue planet', new Vector(Dimensions.w / 2, Dimensions.h - 40));
    }

    const rEl = new RenderElement(renderFn);
    rEl.positionType = 'overlay';
    return rEl;
  }
}



export default generate;
