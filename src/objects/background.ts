import GameContext from "@/core/gameContext";
import Vector from "@/physics/vector";
import RenderElement from "@/render/renderElement";
import BaseObject from "./baseObject";
import { Rectangle } from "./shapes";
import PixelArtBuilder from "@/sprites/PixelArtBuilder";
import RandomUtils from "@/utils/random";

import bloodstains1 from "@/art/bloodstains/bloodstains1";
import bloodstains2 from "@/art/bloodstains/bloodstains2";
import bloodstains3 from "@/art/bloodstains/bloodstains3";
import bloodstains4 from "@/art/bloodstains/bloodstains4";
import bloodstains0 from "@/art/bloodstains/bloodstains0";
import PixelArtDrawUtils from "@/utils/pixelartDrawUtils";


// import tree0 from "@/art/tree0";

export const BACKGROUND_ID = "bg";

class Background extends BaseObject {
  backgroundCanvas: HTMLCanvasElement;
  canvasRenderingContext: CanvasRenderingContext2D | null;
  constructor(worldDimensions: Rectangle) {
    super();
    this.id = BACKGROUND_ID;
    const canvas = document.createElement("canvas");
    canvas.width = worldDimensions.w;
    canvas.height = worldDimensions.h;
    const ctx = canvas.getContext("2d");
    this.canvasRenderingContext = null;
    ctx!.imageSmoothingEnabled = false;
    ctx!.fillStyle = "#99c555";
    ctx!.fillRect(0, 0, worldDimensions.w, worldDimensions.h);


    forRandomPositionsInside(9999, worldDimensions, (position) => {
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
    this.backgroundCanvas = canvas;
  }

  render() {
    const renderFn = (gameContext: GameContext) => {
      const { canvasRenderingContext, worldDimensions } = gameContext;

      canvasRenderingContext.drawImage(
        this.backgroundCanvas,
        this.backgroundCanvas.width / -2,
        this.backgroundCanvas.height / -2
      );


      // const cellSize = 100;
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

  step() { }
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

// const tree = PixelArtBuilder.buildCanvas(tree0);

const bloodstain1 = PixelArtBuilder.buildCanvas(bloodstains0);
const bloodstain2 = PixelArtBuilder.buildCanvas(bloodstains1);
const bloodstain3Helmet = PixelArtBuilder.buildCanvas(bloodstains2);
const bloodstain4Sword = PixelArtBuilder.buildCanvas(bloodstains3);
const bloodstainBow = PixelArtBuilder.buildCanvas(bloodstains4);
const tree0 = buildTreeCanvas();
const tree1 = buildTreeCanvas();
const tree2 = buildTreeCanvas();
const tree3 = buildTreeCanvas();
const tree4 = buildTreeCanvas();


function buildTreeCanvas() {
  const treeCanvas = document.createElement("canvas");
  const treeWidth = 32;
  const treeHeight = 64;
  treeCanvas.width = treeWidth * 2;
  treeCanvas.height = treeHeight * 2;

  const treeBottomPadding = 8;

  const ctx = treeCanvas.getContext("2d")!;
  ctx!.imageSmoothingEnabled = true;
  const green1 = "#428118";
  const green2 = "#5d9a1b";

  const stemWidth = RandomUtils.getIntegerInRange(4, 6) * 2

  // shadow
  let pixelartUtils = new PixelArtDrawUtils(ctx, '#87b151');
  pixelartUtils.drawPixelatedEllipseFill(treeCanvas.width / 2, treeCanvas.height - treeBottomPadding, stemWidth * 2, stemWidth / 2,);

  // stem
  ctx!.fillStyle = "#9b6429";
  ctx!.fillRect(treeCanvas.width / 2 - stemWidth / 2, treeCanvas.height / 2 - treeBottomPadding, stemWidth, treeCanvas.height / 2);

  // bush
  pixelartUtils = new PixelArtDrawUtils(ctx, RandomUtils.getRandomValueOf([green1, green2]), 2);
  pixelartUtils.drawPixelatedEllipseFill(treeCanvas.width / 2, treeCanvas.height / 2, stemWidth * 4, stemWidth * 2,);
  ctx!.strokeStyle = 'transparent';

  return treeCanvas;
}

function drawTrees(
  ctx: CanvasRenderingContext2D,
  worldDimensions: Rectangle
) {

  let treesPlanted = 0;
  const fn = (x: number) => 2000 + (-1500 / (1 + Math.E ** (-1 * ((x - 500) / 500))))
  ctx.save();
  ctx.translate(worldDimensions.w / 2, worldDimensions.h / 2);
  const trees = [];
  while (treesPlanted < 9999) {
    const x = RandomUtils.getIntegerInRange(-worldDimensions.w / 2, worldDimensions.w / 2);
    const y = RandomUtils.getIntegerInRange(-worldDimensions.w / 2, worldDimensions.w / 2);
    // const y = fn(x);
    const tree = RandomUtils.getRandomValueOf([tree0, tree1, tree2, tree3, tree4]);
    if (y > 0) {
      if (fn(x) + RandomUtils.getIntegerInRange(-200, 200) < y) {
        treesPlanted++;
        trees.push({ x, y, tree })
      }
    } else {
      if (-fn(x) + RandomUtils.getIntegerInRange(-200, 200) > y) {
        treesPlanted++;
        trees.push({ x, y, tree })
      }
    }
  }
  trees.sort((a, b) => a.y - b.y).forEach(({ x, y, tree }) => {
    ctx.drawImage(tree, x, y);
  });
  ctx.restore();
}
