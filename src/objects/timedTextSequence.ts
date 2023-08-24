import Disposable from "../behaviors/disposable";
import { Dimensions } from "../core/canvas";
import GameContext from "../core/gameContext";
import Vector from "../physics/vector";
import RenderElement from "../render/renderElement";
import RenderUtils from "../render/utils";
import BaseObject from "./baseObject";

interface TimedText {
  duration: number;
  text: string;
}

type TimedTextType = TimedText | string

class TimedTextSequence extends BaseObject implements Disposable {

  private texts: TimedText[];
  private activeTimedTextIndex: number = 0;
  private activeTimedText: TimedText;
  shouldDispose = false;

  constructor(texts: TimedTextType[]) {
    super();
    this.texts = texts.map(t => {
      if (typeof t === 'object') {
        return t
      } else {
        return { text: t, duration: 4 }
      }
    });

    this.activeTimedText = this.texts[this.activeTimedTextIndex];
  }

  step(context: GameContext) {
    if (this.activeTimedText.duration < 0) {
      this.activeTimedTextIndex++;
      if (this.activeTimedTextIndex > this.texts.length - 1) {
        this.shouldDispose = true;
      } else {
        this.activeTimedText = this.texts[this.activeTimedTextIndex];
      }
    } else {
      this.activeTimedText.duration -= context.dt;
    }

  }

  render() {
    const renderFn = (ctx: GameContext) => {
      const { canvasRenderingContext } = ctx;
      canvasRenderingContext.font = "35px Comic Sans MS";
      canvasRenderingContext.fillStyle = "#FFF";
      RenderUtils.renderText(canvasRenderingContext, this.activeTimedText.text, new Vector(Dimensions.w / 2, Dimensions.h - 80))
    }

    const renderElement = new RenderElement(renderFn);
    renderElement.positionType = 'overlay';
    return renderElement;
  }

}


export default TimedTextSequence;
