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

class Background extends BaseObject {
  backgroundCanvas: HTMLCanvasElement;
  constructor(worldDimensions: Rectangle) {
    super();
    this.id = "background";

    const canvas = document.createElement("canvas");
    canvas.width = worldDimensions.w;
    canvas.height = worldDimensions.h;
    const ctx = canvas.getContext("2d");
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

    forRandomPositionsInside(
      200,
      new Rectangle(worldDimensions.w, worldDimensions.h),
      (position) => {
        ctx!.drawImage(tree, position.x, position.y);
      }
    );

    drawBackgroundBitMap(ctx!, backgroundBitMap, worldDimensions);

    this.backgroundCanvas = canvas;
  }

  render() {
    const renderFn = (gameContext: GameContext) => {
      const { canvasRenderingContext } = gameContext;
      canvasRenderingContext.drawImage(
        this.backgroundCanvas,
        this.backgroundCanvas.width / -2,
        this.backgroundCanvas.height / -2
      );
    };
    const renderElement = new RenderElement(renderFn);
    renderElement.positionType = "normal";
    return renderElement;
  }

  drawBloodStain(position: Vector) {
    console.log('bloodstain')
    const ctx = this.backgroundCanvas.getContext("2d");
    ctx?.save()



    const blodstain = RandomUtils.getRandomValueOf<HTMLCanvasElement>([
      bloodstain1,
      bloodstain2,
      bloodstain3Helmet,
      bloodstain4Sword,
    ]);

    ctx?.translate(Math.round(this.backgroundCanvas.width / 2), Math.round(this.backgroundCanvas.height / 2));
    ctx?.translate(Math.round(position.x), Math.round(position.y),);

    if (RandomUtils.getRandomBoolean()) {
      // mirror
      ctx?.scale(-1, 1);
    }

    ctx!.drawImage(
      blodstain,
      -Math.round(blodstain.width / 2),
      -Math.round(blodstain.height / 2),
    );
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

const grass = PixelArtBuilder.buildCanvas({
  value: 0x1ean,
  width: 3,
  height: 3,
  cardinality: 2,
  palette: [0x007700, undefined],
});

const tallGrass = PixelArtBuilder.buildCanvas({
  value: 0x1f9a0c0783d9cn,
  width: 7,
  height: 5,
  cardinality: 3,
  palette: [, 0x007700, 0x87b151],
});

const flower = PixelArtBuilder.buildCanvas({
  value: 0x337644n,
  width: 3,
  height: 4,
  cardinality: 4,
  palette: [, 0xffffff, 0xecea6b, 0x87b151],
});

const tree = PixelArtBuilder.buildCanvas({
  value:
    0xe1b62e3a8cc1b48f8fbe5a3336535ff0f757dc1a45ffb62da3abd081e6490b4c425f11e530aff6e0a1fd4e8e1cacabb5f9540535eddd46d94eec8e1952525bf02f42fdec201a6f7d86dc0ae08df48f56c28b2a8b2f3c696fd448f733227136118875bb1c5cc430d97073e1b65b59649e88dc7be7971edb4b0638ec1e2bb6bc0195937714ad3900a1616eba1f704b585c476a0bb2fea6cc658805014b0ab3b2495c06c330c5cdf7a023995cf578958327540903478721eed173bc5f6fd42c3415c99a2eebcfc4f653649d83652b95c195a546ea2d58aedbf2c65cfb8c3bd8d5ee73957373409e5698cad01f2d8d034a0c4853c424bcca5c65bcd3fa55c48a516cd38b8d7049955b2830da248a4cb90c2244f1a458fd2c7b0d5d8e5788f52540f1c2f2aafda0036c6aa487af916872961789abeaab96ce039109338c52f666bdfbe5d6113ed6eb24fc82349f065b90ae066365aa0c097ad133eefaad66eaa92641d8cf38ac85d8abe2caea3d0cd2c5bb768b567816ebadc1dea7760949e2c3bf98249bf68a326a4da82e54f53edf22be72f100ded03544dfc47e230b13c2073d4b2a28051f68f9f8c28630be030728d001a641b6281c7d713952888de9a070f0df532f486319d0e294ce717ad939886344c6c757e87b7f3ec47f0421083d685b89eef2d3cd10c353a018cbccab8ee209c85b28cf5c08259eaafd2c9d60b5c3985bf2d8599e66f8c3c6602efa47f14a21c0acabb9553110e64ceae560e3a0bd4d6fd3c7984579fe0dc0d179fa92af7cb53b6fa762b9738bdecb1dd6f7a4877a049df208440709dcf540df9eb073e5831a82551b9bd6186db83289d36ae6a169c010ad3804450a334704n,
  width: 32,
  height: 49,
  cardinality: 9,
  palette: [
    ,
    0x000000,
    0x9b6429,
    0x87b151,
    0xce8636,
    0x428118,
    0x5d9a1b,
    0x7ab420,
    0x9ccd22,
  ],
});

const bloodstain1 = PixelArtBuilder.buildCanvas(bloodstains1);
const bloodstain2 = PixelArtBuilder.buildCanvas(bloodstains2);
const bloodstain3Helmet = PixelArtBuilder.buildCanvas(bloodstains3);
const bloodstain4Sword = PixelArtBuilder.buildCanvas(bloodstains4);

const backgroundBitMap = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

function drawBackgroundBitMap(
  ctx: CanvasRenderingContext2D,
  bitMap: number[][],
  worldDimensions: Rectangle
) {
  const tileWidth = worldDimensions.w / bitMap[0].length;
  const tileHeight = worldDimensions.h / bitMap.length;
  for (let y = 0; y < bitMap.length; y++) {
    for (let x = 0; x < bitMap[y].length; x++) {
      const tile = bitMap[y][x];
      if (tile === 0 || tile === 3) {
        continue;
      }
      const position = new Vector(x * tileWidth, y * tileHeight);
      const tileCanvas = getTileCanvas(tile, tileWidth, tileHeight);
      ctx.drawImage(tileCanvas, position.x, position.y);
    }
  }
}

function buildForestCanvas(w: number, h: number) {
  const forestDensity = 20;
  const canvas = document.createElement("canvas");
  canvas.width = w + tree.width * 2;
  canvas.height = h + tree.height * 2;
  const ctx = canvas.getContext("2d")!;
  forRandomPositionsInside(
    (w * h) / (forestDensity * tree.height),
    new Rectangle(w, h),
    (position) => {
      ctx!.drawImage(tree, position.x, position.y);
    }
  );
  return canvas;
}

function buildSandCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  const sandDensity = 32;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4e6b2";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#000";

  forRandomPositionsInside(
    (w * h) / sandDensity,
    new Rectangle(w, h),
    (position) => {
      ctx.fillRect(position.x, position.y, 1, 1);
    }
  );

  return canvas;
}

function getTileCanvas(
  tile: number,
  tileWidth: number,
  tileHeight: number
): HTMLCanvasElement {
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = tileWidth;
  tileCanvas.height = tileHeight;
  const tileCtx = tileCanvas.getContext("2d")!;
  switch (tile) {
    case 1:
      return buildForestCanvas(tileWidth, tileHeight);
    case 2:
      return buildSandCanvas(tileWidth, tileHeight);
  }
  return tileCanvas;
}
