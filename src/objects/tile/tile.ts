import RenderUtils from "../../render/utils";
import BaseObject from "../baseObject";
import RenderElement from "../../render/renderElement";
import Renderable from "../../behaviors/renderable";
import Vector from "../../physics/vector";
import { Square } from "../../objects/shapes";

export enum TileType {
  grass,
  sand,
  water,
}

class Tile extends BaseObject implements Renderable {
  tile: TileType;

  static SIZE = 10;

  constructor(position: Vector, tile = TileType.water) {
    super(position);
    this.tile = tile;
  }

  render() {
    return new RenderElement(({ canvasRenderingContext }) => {
      canvasRenderingContext.strokeStyle = "rgba(200,200,200,0.4)";
      canvasRenderingContext.fillStyle = this.getTileColor();
      canvasRenderingContext.transform(0, 0.6, 1, 0, 0, 0);
      RenderUtils.rotateSelf(
        canvasRenderingContext,
        this.position,
        Math.PI / 4
      );
      RenderUtils.renderRectangle(
        canvasRenderingContext,
        this.position,
        new Square(Tile.SIZE)
      );

      canvasRenderingContext.fill();
    }, true);
  }

  getTileColor() {
    switch (this.tile) {
      case TileType.grass:
        return "#0F0";
      case TileType.sand:
        return "#FF0";
      case TileType.water:
        return "#00F";
    }
  }
}

export default Tile;
