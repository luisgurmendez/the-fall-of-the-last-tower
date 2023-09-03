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

function generate() {
  // const tiles = buildTilesGrid();
  const worldDimensions: Rectangle = new Square(5000);
  const level = new Level(
    [
      // ...buildArchers(),
      ...buildSwordsmen(),
      new Castle(),
      new Background(worldDimensions),
    ],
    new Criterion(),
    worldDimensions
  );
  level.camera.zoom = 0.6;
  return level;
}

export default generate;

class Criterion implements LevelCriterion {
  wave = 0;


  won(): boolean {
    return false;
  }
  lost(): boolean {
    return false;
  }
  step(context: GameContext): void {
    if (Math.random() > 0.99) {
      this.buildWave(this.wave, context);
    }
  }

  buildWave(wave: number, context: GameContext) {
    if (wave < 1) {
      const soldiers: BaseObject[] = [];
      for (let i = 0; i < 100; i++) {
        soldiers.push(
          new Swordsman(
            new Vector(
              context.worldDimensions.w / 10 + (Math.random() * 500),
              RandomUtils.getNumberWithVariance(-200, 400),
            ),
            1
          )
        );
      }
      context.objects.push(...soldiers);
      this.wave++;
    }

  }
}

function buildSwordsmen() {
  const soldiers: BaseObject[] = [];
  for (let i = 0; i < 100; i++) {
    const side = 0;
    soldiers.push(
      new Swordsman(
        new Vector(
          Math.random() * 200,
          Math.random() * 600 - 500
        ),
        side
      )
    );
  }
  return soldiers;
}

function buildArchers() {
  const soldiers: BaseObject[] = [];
  for (let i = 0; i < 5; i++) {
    const side = 0;
    soldiers.push(
      new Archer(
        new Vector(
          100 * side - 300 + Math.random() * 50,
          Math.random() * 1000 - 500
        ),
        side
      )
    );
  }
  return soldiers;
}
