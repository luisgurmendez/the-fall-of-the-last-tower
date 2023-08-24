


import Level, { LevelObjective } from "../core/level";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import GameContext from "../core/gameContext";
import RenderElement from "../render/renderElement";
import RenderUtils from "../render/utils";
import { Dimensions } from "../core/canvas";
import Keyboard from "../core/keyboard";
import generateAstronauts from "./shared/generateAstronauts";

function generate() {
  const level = new Level([], new PressAnyKeyObjective());
  const texts = new Text();
  // const astronauts = generateAstronauts();
  level.objects = [...level.objects, texts];
  level.rocket.hasLaunched = true;
  return level;
}

export default generate;

export class PressAnyKeyObjective implements LevelObjective {

  private hasPressedAnyKey: boolean = false;

  step(context: GameContext): void {
    if (Keyboard.getInstance().isPressingAnyKey()) {
      this.hasPressedAnyKey = true;
    }

  }
  completed() {
    return this.hasPressedAnyKey;
  }
}

export class Text extends BaseObject {

  render() {
    const renderFn = (ctx: GameContext) => {
      const canvasRenderingContext = ctx.canvasRenderingContext;
      canvasRenderingContext.font = '75px Comic Sans MS';
      canvasRenderingContext.fillStyle = '#F00';
      RenderUtils.renderText(canvasRenderingContext, 'Rescue Mission', new Vector(Dimensions.w / 2, 40));
      canvasRenderingContext.fillStyle = '#FFF';
      canvasRenderingContext.font = '45px Comic Sans MS';
      RenderUtils.renderText(canvasRenderingContext, '[Press any key]', new Vector(Dimensions.w / 2, Dimensions.h / 2 + 100));
    }

    const rEl = new RenderElement(renderFn);
    rEl.positionType = 'overlay';
    return rEl;
  }
}