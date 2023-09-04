import GameContext from "@/core/gameContext";
import Vector from "@/physics/vector";
import RenderUtils from "@/render/utils";
import RenderElement from "@/render/renderElement";
import BaseObject from "./baseObject";
import { Circle, Rectangle, Square } from "./shapes";
import PixelArtBuilder from "@/sprites/PixelArtBuilder";
import RandomUtils from "@/utils/random";
import bloodstains1 from "@/art/bloodstains/bloodstains1";
import bloodstains2 from "@/art/bloodstains/bloodstains2";
import bloodstains3 from "@/art/bloodstains/bloodstains3";
import bloodstains4 from "@/art/bloodstains/bloodstains4";
import bloodstains0 from "@/art/bloodstains/bloodstains0";
import tree0 from "@/art/tree0";

class Background extends BaseObject {
  backgroundCanvas: HTMLCanvasElement;
  canvasRenderingContext: CanvasRenderingContext2D | null;
  constructor(worldDimensions: Rectangle) {
    super();
    this.id = "background";

    const canvas = document.createElement("canvas");
    canvas.width = worldDimensions.w;
    canvas.height = worldDimensions.h;
    const ctx = canvas.getContext("2d");
    this.canvasRenderingContext = null;
    ctx!.imageSmoothingEnabled = false;
    ctx!.fillStyle = "#99c555";
    ctx!.fillRect(0, 0, worldDimensions.w, worldDimensions.h);

    forRandomPositionsInside(10000, worldDimensions, (position) => {
      ctx?.save();
      if (RandomUtils.getRandomBoolean()) {
        ctx?.scale(-1, 1);
        position.x *= -1;
      }
      ctx!.drawImage(
        RandomUtils.getRandomValueOf<HTMLCanvasElement>([
          grass,
          tallGrass,
          grass,
          tallGrass,
          flower,
        ]),
        position.x,
        position.y
      );
      ctx?.restore();
    });



    drawTrees(ctx!, worldDimensions);
    // drawBackgroundBitMap(ctx!, backgroundBitMap, worldDimensions)

    this.backgroundCanvas = canvas;
  }

  render() {
    const renderFn = (gameContext: GameContext) => {
      const { canvasRenderingContext, worldDimensions } = gameContext;
      
      // renders a grid in the background of cells of 200x200 pixels
      canvasRenderingContext.drawImage(
        this.backgroundCanvas,
        this.backgroundCanvas.width / -2,
        this.backgroundCanvas.height / -2
      );

      // const cellSize = 200;
      // const cellCountX = Math.ceil(
      //   worldDimensions.w / cellSize
      // );

      // const cellCountY = Math.ceil(
      //   worldDimensions.h / cellSize
      // );
      // canvasRenderingContext.strokeStyle = "#000000";
      // canvasRenderingContext.lineWidth = 1;
      // canvasRenderingContext.beginPath();
      // for (let i = 0; i < cellCountX; i++) {
      //   canvasRenderingContext.moveTo(
      //     i * cellSize - worldDimensions.w / 2,
      //     -worldDimensions.h / 2
      //   );
      //   canvasRenderingContext.lineTo(
      //     i * cellSize - worldDimensions.w / 2,
      //     worldDimensions.h / 2
      //   );
      // }
      // for (let i = 0; i < cellCountY; i++) {
      //   canvasRenderingContext.moveTo(
      //     -worldDimensions.w / 2,
      //     i * cellSize - worldDimensions.h / 2
      //   );
      //   canvasRenderingContext.lineTo(
      //     worldDimensions.w / 2,
      //     i * cellSize - worldDimensions.h / 2
      //   );
      // }
      // canvasRenderingContext.stroke();

      
    };
    const renderElement = new RenderElement(renderFn);
    renderElement.positionType = "normal";
    return renderElement;
  }

  drawSwordsmanBloodstain(position: Vector) {
    const bloodstain = RandomUtils.getRandomValueOf<HTMLCanvasElement>([
      bloodstain1,
      bloodstain2,
      bloodstain3Helmet,
      bloodstain4Sword,
    ]);
    this.drawBloodstain(position, bloodstain);
  }

  drawArcherBloodstain(position: Vector) {
    const bloodstain = RandomUtils.getRandomValueOf<HTMLCanvasElement>([
      bloodstain1,
      bloodstain2,
      bloodstainBow,
    ]);
    this.drawBloodstain(position, bloodstain);
  }

  private drawBloodstain(position: Vector, bloodstain: HTMLCanvasElement,) {
    const ctx = this.backgroundCanvas.getContext("2d");
    ctx?.save()
    ctx?.translate(Math.round(this.backgroundCanvas.width / 2), Math.round(this.backgroundCanvas.height / 2));
    ctx?.translate(Math.round(position.x), Math.round(position.y),);

    if (RandomUtils.getRandomBoolean()) {
      // mirror
      ctx?.scale(-1, 1);
    }

    ctx!.drawImage(
      bloodstain,
      -Math.round(bloodstain.width / 2),
      -Math.round(bloodstain.height / 2),
    );
    ctx?.restore()
  }

  drawArrow = (position: Vector, direction: Vector) => {
    const ctx = this.backgroundCanvas.getContext("2d");
    ctx?.save()
    ctx?.translate(Math.round(this.backgroundCanvas.width / 2), Math.round(this.backgroundCanvas.height / 2));
    ctx?.translate(Math.round(position.x), Math.round(position.y));

    if (direction.x < 0) {
      // mirror
      ctx?.scale(-1, 1);
    }
    ctx?.rotate(45 * Math.PI / 180);
    ctx?.beginPath();
    ctx?.moveTo(0, 0);
    ctx?.lineTo(10, 0);
    ctx?.stroke();
    ctx?.restore()
  }

  step() {}
}

export default Background;

function forRandomPositionsInside(
  times: number,
  size: Rectangle,
  fn: (position: Vector) => void,
  offset: Vector = new Vector()
) {
  for (let i = 0; i < times; i++) {
    const x = Math.round(Math.random() * size.w) + offset.x;
    const y = Math.round(Math.random() * size.h) + offset.y;
    fn(new Vector(x, y));
  }
}

const grass = PixelArtBuilder.buildCanvas([
  0x1ean,
  3,
  3,
  2,
  [0x007700, undefined],
]);

const tallGrass = PixelArtBuilder.buildCanvas([
  0x1f9a0c0783d9cn,
  7,
  5,
  3,
  [, 0x007700, 0x87b151],
]);

const flower = PixelArtBuilder.buildCanvas([
  0x337644n,
  3,
  4,
  4,
  [, 0xffffff, 0xecea6b, 0x87b151],
]);

const tree = PixelArtBuilder.buildCanvas(tree0);

const bloodstain1 = PixelArtBuilder.buildCanvas(bloodstains0);
const bloodstain2 = PixelArtBuilder.buildCanvas(bloodstains1);
const bloodstain3Helmet = PixelArtBuilder.buildCanvas(bloodstains2);
const bloodstain4Sword = PixelArtBuilder.buildCanvas(bloodstains3);
const bloodstainBow = PixelArtBuilder.buildCanvas(bloodstains4);

function drawTrees(
  ctx: CanvasRenderingContext2D,
  worldDimensions: Rectangle
) {

  let treesPlanted = 0;
  const fn = (x: number) => 2000 + (-1500 / (1 + Math.E ** (-1 * ((x - 500) / 500))))
  ctx.save();
  ctx.translate(worldDimensions.w / 2, worldDimensions.h / 2);
  while (treesPlanted < 10000) {
    const x = RandomUtils.getIntegerInRange(-worldDimensions.w / 2, worldDimensions.w / 2);
    const y = RandomUtils.getIntegerInRange(-worldDimensions.h / 2, worldDimensions.h / 2);
    // const y = fn(x);
    if (y > 0) {
      if (fn(x) + RandomUtils.getIntegerInRange(-200, 200) < y) {
        treesPlanted++;
        ctx.drawImage(tree, x, y);
      }
    } else {
      if (-fn(x) + RandomUtils.getIntegerInRange(-200, 200) > y) {
        treesPlanted++;
        ctx.drawImage(tree, x, y);
      }
    }
  }
  ctx.restore();
}
