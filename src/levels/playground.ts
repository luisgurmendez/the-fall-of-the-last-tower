import Level, { LevelCriterion } from "../core/level";
import Vector from "../physics/vector";
import GameContext from "../core/gameContext";
import Tile from "../objects/tile/tile";
import Background from "../objects/background";
import { Circle, Rectangle, Square } from "../objects/shapes";
import BaseObject from "../objects/baseObject";
import RenderElement from "../render/renderElement";
import RenderUtils from "../render/utils";
import Catapult from "../objects/catapult/catapult";
import Button from "../controls/button";
import Swordsman from "../objects/swordsman/swordsman";

function generate() {
  // const tiles = buildTilesGrid();
  const worldDimensions: Rectangle = new Square(5000);
  const level = new Level(
    [
      // new Catapult(new Vector()),
      // new Catapult(new Vector(25, 25)),
      // new Catapult(new Vector(50, 50)),
      // new Catapult(new Vector(50, 75)),

      // new Soldier(new Vector(Math.random() * 1000 - 500, Math.random() * 1000 - 500), 0),
      // new Soldier(new Vector(Math.random() * 1000 - 500, Math.random() * 1000 - 500), 1),
      ...buildSoldiers(),
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
  won(): boolean {
    return false;
  }
  lost(): boolean {
    return false;
  }
  step(context: GameContext): void { }
}

function buildSoldiers() {
  const soldiers: BaseObject[] = [];
  for (let i = 0; i < 8000; i++) {
    const side = Math.random() > 0.5 ? 0 : 1;
    soldiers.push(
      new Swordsman(
        new Vector(
          100 * side - 10 + Math.random() * 50,
          Math.random() * 1000 - 500
        ),
        side
      )
    );
  }
  return soldiers;
}

function buildTilesGrid() {
  const gridSize = 100;
  const positionOffsetBetweenTiles = Math.sqrt(Tile.SIZE ** 2 + Tile.SIZE ** 2);
  const tiles: Tile[] = [];
  const startingPoint = new Vector(
    (-gridSize / 2) * Tile.SIZE,
    (-gridSize / 2) * Tile.SIZE
  );
  let prevPosition = startingPoint;
  for (let i = 0; i < gridSize * gridSize; i++) {
    const newPosition = prevPosition
      .clone()
      .add(new Vector(positionOffsetBetweenTiles, 0));
    if (i % gridSize === 0) {
      if (i % (gridSize * 2) === 0) {
        newPosition.add(new Vector(0, positionOffsetBetweenTiles / 2));
        newPosition.x = startingPoint.x;
      } else {
        newPosition.add(new Vector(0, positionOffsetBetweenTiles / 2));
        newPosition.x = startingPoint.x + positionOffsetBetweenTiles / 2;
      }
    }
    prevPosition = newPosition;
    if (newPosition.distanceTo(new Vector(0, 0)) <= Tile.SIZE * 40) {
      tiles.push(new Tile(newPosition));
    }
  }

  return tiles;
}
