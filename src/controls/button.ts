import { Rectangle } from "../objects/shapes";
import GameContext from "../core/gameContext";
import Pressable from "../behaviors/pressable";
import Renderable from "../behaviors/renderable";
import { Positionable } from "../mixins/positional";
import Vector from "../physics/vector";
import BaseObject from "../objects/baseObject";
import { ObjectType } from "../objects/objectType";
import Disposable from "../behaviors/disposable";
import Camera from "../core/camera";
import RenderElement from "../render/renderElement";
import Initializable from "behaviors/initializable";

const defaultButtonStyles: Required<ButtonStyles> = {
  backgroundColor: '#FFF',
  color: '#000',
  font: '30px Comic Sans MS',
  padding: 8,
}

interface ButtonStyles {
  backgroundColor?: string;
  color?: string;
  font?: string;
  padding?: number;
}

// TODO: fix pressing a relatively positioned element
class Button extends BaseObject implements Renderable, Pressable, Positionable, Disposable, Initializable {

  pressArea: Rectangle;
  position: Vector;
  onPress: () => void;
  styles: Required<ButtonStyles>;
  text: string;
  dispose = () => { };
  shouldInitialize = true;
  shouldDispose = false;

  constructor(
    text: string,
    position: Vector,
    onPress: Pressable['onPress'],
    styles: ButtonStyles = defaultButtonStyles,
    id?: string
  ) {
    super(id);
    this.type = ObjectType.BUTTON
    this.position = position;
    this.text = text;
    this.onPress = onPress;
    this.styles = { ...defaultButtonStyles, ...styles };
    this.pressArea = new Rectangle(0, 0);
  }

  init(gameContext: GameContext) {
    const { canvasRenderingContext, camera } = gameContext;
    this.setFont(canvasRenderingContext);
    const width = canvasRenderingContext.measureText(this.text).width;
    // https://stackoverflow.com/a/13318387/5794675
    const height = canvasRenderingContext.measureText('M').width;
    this.pressArea = new Rectangle(width + this.styles.padding, height + this.styles.padding);
    this.setPressListener(canvasRenderingContext, camera);
  }

  render() {
    const renderElement = new RenderElement(this._render)
    renderElement.positionType = 'overlay';
    return renderElement
  }

  _render = (gameContext: GameContext) => {
    const { canvasRenderingContext } = gameContext;
    this.setFont(canvasRenderingContext);

    // draw background
    canvasRenderingContext.fillStyle = this.styles.backgroundColor;
    canvasRenderingContext.fillRect(this.position.x, this.position.y, this.pressArea.w, this.pressArea.h);

    // draw text
    canvasRenderingContext.fillStyle = this.styles.color;
    canvasRenderingContext.fillText(this.text, this.position.x + this.styles.padding / 2, this.position.y + this.pressArea.h - this.styles.padding / 2);
  }

  private handleCanvasPress = (event: HTMLElementEventMap['click']) => {
    const x = event.pageX;
    const y = event.pageY;

    // Collision detection between clicked offset and element.
    if (y > this.position.y && y < this.position.y + this.pressArea.h
      && x > this.position.y && x < this.position.x + this.pressArea.w) {
      this.onPress();
    }
  }

  // TODO: Implement the PressController so that there is just 1 click listener?
  private setPressListener = (canvasRenderingContext: CanvasRenderingContext2D, camera: Camera) => {
    const { canvas } = canvasRenderingContext;
    canvas.addEventListener('click', this.handleCanvasPress, false);
    this.dispose = () => {
      canvas.removeEventListener('click', this.handleCanvasPress, false);
    }
  }

  private setFont = (ctx: CanvasRenderingContext2D) => {
    ctx.font = this.styles.font;
  }

}

export default Button;
