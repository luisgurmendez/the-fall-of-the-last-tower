import Vector from "@/physics/vector";
import PixelArtBuilder, { PixelArt } from "./PixelArtBuilder";
import RenderUtils from "@/render/utils";

class PixelArtSpriteSheet {
  canvases: HTMLCanvasElement[];
  constructor(sprites: PixelArt[]) {
    this.canvases = sprites.map((pa) => PixelArtBuilder.buildCanvas(pa, 1));
  }

  drawSprite(
    ctx: CanvasRenderingContext2D,
    frame: number,
    position: Vector,
    mirrored: boolean
  ): void {
    const canvas = this.canvases[frame];

    ctx.translate(position.x, position.y);
    if (mirrored) {
      ctx.scale(-1, 1);
    }
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.drawImage(canvas, 0, 0);
  }
}

export default PixelArtSpriteSheet;
