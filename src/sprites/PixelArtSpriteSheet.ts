import PixelArtBuilder, { PixelArt } from "./PixelArtBuilder";

class PixelArtSpriteSheet {
    canvases: HTMLCanvasElement[];
    constructor(sprites: PixelArt[]) {
        this.canvases = sprites.map((pa) => PixelArtBuilder.buildCanvas(pa, 1))
    }

    drawSprite(ctx: CanvasRenderingContext2D, frame: number): void {
        const canvas = this.canvases[frame];
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        ctx.drawImage(canvas, 0, 0);
    }
}

export default PixelArtSpriteSheet;