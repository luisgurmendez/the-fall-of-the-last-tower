import Level, { LevelCriterion } from "../core/level";
import Vector from "../physics/vector";
import GameContext from "../core/gameContext";
import Tile from "../objects/tile/tile";
import Background from "../objects/background";
import { Circle, Square } from "../objects/shapes";
import BaseObject from "../objects/baseObject";
import RenderElement from "../render/renderElement";
import RenderUtils from "../render/utils";
import Catapult from "../objects/catapult/catapult";

function generate() {
  // const tiles = buildTilesGrid();
  const level = new Level(
    [
      new Catapult(new Vector()),
      new Catapult(new Vector(25, 25)),
      new Catapult(new Vector(50, 50)),
      new Catapult(new Vector(50, 75)),
      new Background(),
    ],
    new Criterion(),
    new Square(5000)
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
  step(context: GameContext): void {}
}

class Center extends BaseObject {
  render() {
    return new RenderElement((gctx) => {
      const ctx = gctx.canvasRenderingContext;
      ctx.fillStyle = "#FF0";
      RenderUtils.renderCircle(ctx, new Vector(0, 0), new Circle(30));
      ctx.fill();
    });
  }
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
