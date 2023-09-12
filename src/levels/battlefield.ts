import Level, { LevelCriterion } from "@/core/level";
import Vector from "@/physics/vector";
import GameContext from "@/core/gameContext";
import Background from "@/objects/background";
import { Rectangle, Square } from "@/objects/shapes";
import BaseObject from "@/objects/baseObject";
import Swordsman from "@/objects/army/swordsman/swordsman";
import Castle from "@/objects/castle/castle";
import Archer from "@/objects/army/archer/archer";
import RandomUtils from "@/utils/random";
import Player from "@/objects/player/player";
import WaveController from "@/objects/waveController";
import TimedTextSequence from "@/objects/timedTextSequence";
import RenderElement from "@/render/renderElement";

function generate() {
  const worldDimensions: Rectangle = new Square(5000);
  const level = new Level(
    [
      ...buildArchers(),
      ...buildArchers2(),
      // ...buildSwordsmans(),
      // ...buildSwordsmans2(),

      // new Swordsman(new Vector(-1300, -100), 0),
      // new Swordsman(new Vector(-1300, 200), 1),
      // new Swordsman(new Vector(-900, -200), 1),
      // new Swordsman(new Vector(-900, 200), 1),
      new Castle(),
      new Background(worldDimensions),
      new Player(),
      new Stats(),
      new TimedTextSequenceWithWaveInitializer(["Protect your tower", "use your troops wisely", "good luck!"])
    ],
    worldDimensions
  );
  level.camera.zoom = 0.6;
  return level;
}

export default generate;

function buildArchers2() {
  const soldiers: BaseObject[] = [];
  for (let i = 0; i < 80; i++) {
    const side = 1;
    soldiers.push(
      new Archer(
        new Vector(
          100 * side + 800 + Math.random() * 50,
          Math.random() * 999 - 500
        ),
        side
      )
    );
  }
  return soldiers;
}


function buildArchers() {
  const soldiers: BaseObject[] = [];
  for (let i = 0; i < 80; i++) {
    const side = 0;
    soldiers.push(
      new Archer(
        new Vector(
          100 * side + 800 + Math.random() * 50,
          Math.random() * 999 - 500
        ),
        side
      )
    );
  }
  return soldiers;
}



function buildSwordsmans2() {
  const soldiers: BaseObject[] = [];
  for (let i = 0; i < 20; i++) {
    const side = 1;
    soldiers.push(
      new Swordsman(
        new Vector(
          100 * side - 300 + Math.random() * 50,
          Math.random() * 999 - 500
        ),
        side
      )
    );
  }
  return soldiers;
}



function buildSwordsmans() {
  const soldiers: BaseObject[] = [];
  for (let i = 0; i < 20; i++) {
    const side = 0;
    soldiers.push(
      new Swordsman(
        new Vector(
          100 * side - 300 + Math.random() * 50,
          Math.random() * 999 - 500
        ),
        side
      )
    );
  }
  return soldiers;
}


class TimedTextSequenceWithWaveInitializer extends TimedTextSequence {
  dispose(gameContext: GameContext) {
    gameContext.objects.push(new WaveController());
  }
}



class Stats extends BaseObject {

  render() {
    const renderElement = new RenderElement((gameContext: GameContext) => {
      const { canvasRenderingContext, canvasRenderingContext: { canvas } } = gameContext;
      // canvasRenderingContext.fillText(`(${gameContext.camera.position.x.toFixed(0)},${gameContext.camera.position.y.toFixed(0)})`, canvas.width - 120, 20);
      canvasRenderingContext.fillText(`🏹 🗡️`, canvas.width - 120, 50);
      // canvasRenderingContext.fillText(`(${gameContext.camera.position.x.toFixed(0)},${gameContext.camera.position.y.toFixed(0)})`, canvas.width - 120, 20);
    });

    renderElement.positionType = 'overlay';

    return renderElement;
  }
}