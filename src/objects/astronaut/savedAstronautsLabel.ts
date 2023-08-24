import { callTimes } from "../../utils/fn";
import GameContext from "../../core/gameContext";
import BaseObject from "../../objects/baseObject";
import RenderElement from "../../render/renderElement";
import AstronautRenderUtils from "./astronautRenderUtils";

class RescuedAstronautsLabel extends BaseObject {

  render() {
    const renderFn = (context: GameContext) => {
      const { canvasRenderingContext, numOfRescuedAstronauts } = context;
      const canvas = AstronautRenderUtils.generateAstronautPixelArt();
      const MARGIN = 20
      callTimes(numOfRescuedAstronauts, (i) => {
        canvasRenderingContext.drawImage(canvas, canvas.width * i + MARGIN, MARGIN);
      })
    }

    const renderEl = new RenderElement(renderFn);
    renderEl.positionType = 'overlay';
    return renderEl;
  }
}

export default RescuedAstronautsLabel;
