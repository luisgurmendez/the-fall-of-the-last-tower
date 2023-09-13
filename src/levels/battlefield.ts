import Level from "@/core/level";
import Vector from "@/physics/vector";
import GameContext from "@/core/gameContext";
import Background from "@/objects/background";
import { Rectangle, Square } from "@/objects/shapes";
import Swordsman from "@/objects/army/swordsman/swordsman";
import Castle from "@/objects/castle/castle";
import RandomUtils from "@/utils/random";
import Player from "@/objects/player/player";
import WaveController from "@/objects/waveController";
import TimedTextSequence from "@/objects/timedTextSequence";
import RenderUtils from "@/render/utils";
import { Dimensions } from "@/core/canvas";
import RenderElement from "@/render/renderElement";
import BaseObject from "@/objects/baseObject";

function generate() {
  const worldDimensions: Rectangle = new Square(5000);
  const level = new Level(
    [
      new Swordsman(new Vector(-800, 0), 0),
      new Swordsman(new Vector(-800, 32), 0),
      new Swordsman(new Vector(-800, -32), 0),
      new Swordsman(new Vector(800, 0), 1),
      new Castle(),
      new Background(worldDimensions),
      new Player(),
      new Wallet(),
      // new ControlsExplanation(),
      new TimedTextSequenceWithWaveInitializer(["Protect your tower", "from enemy waves"])
    ],
    worldDimensions
  );
  level.camera.zoom = 0.6;
  return level;
}

export default generate;


class TimedTextSequenceWithWaveInitializer extends TimedTextSequence {
  dispose(gameContext: GameContext) {
    gameContext.objects.push(new WaveController());
  }
}


class Wallet extends BaseObject {

  render() {
    const el = new RenderElement((gtx) => {
      RenderUtils.renderText(gtx.canvasRenderingContext, `Money: ${gtx.money}`, new Vector(8, Dimensions.h - 8), false)
    });

    el.positionType = "overlay";

    return el;
  }
}
