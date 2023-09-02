import Level, { LevelCriterion } from "@/core/level";
import Vector from "@/physics/vector";
import GameContext from "@/core/gameContext";
import Tile from "@/objects/tile/tile";
import Background from "@/objects/background";
import { Rectangle, Square } from "@/objects/shapes";
import BaseObject from "@/objects/baseObject";
import Swordsman from "@/objects/army/swordsman/swordsman";
import Castle from "@/objects/castle/castle";
import Archer from "@/objects/army/archer/archer";

function generate() {
  // const tiles = buildTilesGrid();
  const worldDimensions: Rectangle = new Square(5000);
  const level = new Level(
    [
      ...buildSwordsmen(),
      ...buildArchers(),
      // new Swordsman(new Vector(50, 50), 0),
      // new Swordsman(new Vector(85, 50), 1),
      new Background(worldDimensions),
      new Castle(),
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

function buildSwordsmen() {
  const soldiers: BaseObject[] = [];
  for (let i = 0; i < 1000; i++) {
    const side = Math.random() > 0.5 ? 0 : 1;
    soldiers.push(
      new Swordsman(
        new Vector(
          100 * side - 80 + Math.random() * 50,
          Math.random() * 1000 - 500
        ),
        side
      )
    );
  }
  return soldiers;
}

function buildArchers() {
  const soldiers: BaseObject[] = [];
  for (let i = 0; i < 200; i++) {
    const side = Math.random() > 0.5 ? 0 : 1;
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
