


import Level, { LevelObjective } from "../core/level";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import GameContext from "../core/gameContext";
import RenderElement from "../render/renderElement";
import RenderUtils from "../render/utils";
import { Dimensions } from "../core/canvas";

function generate() {
  const objects: BaseObject[] = [];
  const level = new Level(objects, new NoObjective());
  level.rocket.hasLaunched = true;
  level.rocket.shouldDispose = true;
  level.rocket.position = new Vector(0, 0);
  const texts = new Text();
  level.objects = [...level.objects, texts];
  return level;
}

export default generate;

export class NoObjective implements LevelObjective {

  step(context: GameContext): void { }
  completed() {
    return false
  }
}


export class Text extends BaseObject {

  render() {
    const renderFn = (ctx: GameContext) => {
      const canvasRenderingContext = ctx.canvasRenderingContext;
      canvasRenderingContext.font = '45px Comic Sans MS';
      canvasRenderingContext.fillStyle = '#FFF';
      RenderUtils.renderText(canvasRenderingContext, 'Thanks for playing!', new Vector(Dimensions.w / 2, Dimensions.h / 2 + 40));
      canvasRenderingContext.fillStyle = '#F00';
      RenderUtils.renderText(canvasRenderingContext, 'By Luis Gurmendez', new Vector(Dimensions.w / 2, Dimensions.h / 2 + 100));
    }

    const rEl = new RenderElement(renderFn);
    rEl.positionType = 'overlay';
    return rEl;
  }
}