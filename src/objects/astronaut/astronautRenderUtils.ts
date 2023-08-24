import RenderUtils from "../../render/utils";
import GameContext from "../../core/gameContext";
import Vector from "../../physics/vector";
import Astronaut from "./astronaut";
import { callTimes } from "../../utils/fn";

class AstronautRenderUtils {

  static renderAstronaut = (context: GameContext, astronaut: Astronaut) => {
    const canvasRenderingContext = context.canvasRenderingContext;
    canvasRenderingContext.strokeStyle = '#FFF'

    // rotate
    RenderUtils.rotateSelf(canvasRenderingContext, astronaut.position, astronaut.direction.angleTo(new Vector(1, 0)))
    const canvas = AstronautRenderUtils.generateAstronautPixelArt()

    canvasRenderingContext.drawImage(
      canvas,
      astronaut.position.x - astronaut.collisionMask.w / 2,
      astronaut.position.y - astronaut.collisionMask.h / 2,
      astronaut.collisionMask.w,
      astronaut.collisionMask.h
    );
  }

  static generateAstronautPixelArt = (colors = "eee000222444888355ccc"): HTMLCanvasElement => {
    const canvas = RenderUtils.generatePixelArt(
      colors,
      // "@@X[[C@@@@{II_@@@XKRRYC@@XQRRJC@@XWRRzC@@XORRyC@@[KIIY[@XMimmMiCkIIyOII]KYIIIIKY[_IaLI{[`[OYKy[D@XOYKyC@@[OYKy[@XIIYKIIC`[[[[[[D",
      // "@@X[[C@@@@{II_@@@XKRRYC@@XQRRJC@@XWRRzC@@XORRyC@@[KIIY[@XMimmMiCkIIyOII]KYIIIIKY[_IIII{[`[OIIy[D@XOYKyC@@[OCXy[@XIYCXKIC`[[@@[[D",
      // "@@X[[C@@@@{II_@@@XKRRYC@@XQRJJC@@XWRRzC@@XORRyC@@[KIIY[@XMimmMiCkIIyOII]KYIIIIKY[_IIII{[X[OIIy[C@XOYKyC@@[OCXy[@XIYCXKICX[[@@[[C",
      // "@@X[[C@@@@{II_@@@XKRRYC@@XQRJJC@@XWRRzC@@XORRyC@@[KIIY[@XMimmMiCkIIyOII]{YLIIaK_[[LIIa[[@@LaLa@@@XOYKyC@@[OCXy[@XIYCXKICX[[@@[[C",
      // "@@X[[C@@@@{II_@@@XKRRYC@@XQRJJC@@XWRRzC@@XORRyC@@[KIIY[@XMimmMiCkIIyOII]{YLIIaK_[[LIIa[[@@LiMa@@@XOYKyC@@[O[[y[@XIiCXMICX[[CX[[C",
      "@@X[[C@@@@{II_@@@XKRRYC@@XQRJJC@@XWRRzC@@XORRyC@@[KIIY[@XMimmMiCkIIyOII]{YLIIaK_[[LIIa[[@@LiMa@@@XOYKyC@@[O[[y[@XMiCXMiCX[[CX[[C",
      16);

    return canvas;
  }

  static generateAstronautRescuesPixelArts = (numOfRescues: number, total = 3) => {
    const astronautEls: HTMLCanvasElement[] = []
    let n = numOfRescues;
    callTimes(total, (i) => {
      if (i >= numOfRescues) {
        astronautEls.push(AstronautRenderUtils.generateAstronautPixelArt("ccc666ccccccccccccccc")) // makes a placeholder of an astronaut
      } else {
        astronautEls.push(AstronautRenderUtils.generateAstronautPixelArt())
      }
    })
    return astronautEls;
  }
}


export default AstronautRenderUtils;
