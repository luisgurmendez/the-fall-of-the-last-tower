import Disposable from "../behaviors/disposable";
import BaseObject from "../objects/baseObject";
import RenderElement from "../render/renderElement";
import Renderable from "../behaviors/renderable";
import Stepable from "../behaviors/stepable";
import { isPositionable, Positionable } from "../mixins/positional";
import Vector from "../physics/vector";
import GameContext from "./gameContext";
import Initializable from "../behaviors/initializable";
import { Rectangle } from "../objects/shapes";
import { wait } from "../utils/async";

const MAX_ZOOM = 14;
const MIN_ZOOM = 0.01;

class Camera extends BaseObject implements Positionable, Stepable, Disposable, Initializable {

  _position: Vector;
  viewport: Rectangle;
  private _zoom: number;
  following: Positionable | null;
  dispose?: () => void = undefined;
  locked: boolean = false;
  shouldInitialize = true;
  shouldDispose = false;
  // flying: Flying = new Flying();

  constructor() {
    super('camera');
    // this.position = new Vector(document.body.scrollWidth / 2, document.body.scrollHeight / 2);
    this._position = new Vector(0, 0);
    this.viewport = new Rectangle(document.body.scrollWidth, document.body.scrollHeight);
    this._zoom = 1;
    this.following = null;
  }

  init(gameContext: GameContext) {
    const { canvasRenderingContext } = gameContext
    const canvas = canvasRenderingContext.canvas;

    this.viewport.w = canvas.width;
    this.viewport.h = canvas.height;

    let initialDragginPosition = new Vector();
    let initialDraggingClientPosition = new Vector();
    let mouseDown = false;

    const handleCanvasWheel = (event: WheelEvent) => {

      event.preventDefault();

      const mousex = (event.clientX - (canvas.offsetLeft + canvas.width / 2)) * -1
      const mousey = (event.clientY - (canvas.offsetTop + canvas.height / 2)) * -1
      const wheel = event.deltaY < 0 ? 1 : -1;

      const deltaZoom = Math.exp(wheel * 0.02);

      const oldZoom = this.zoom;
      this.zoom = this.zoom * deltaZoom;

      // Only change positions if there was some actual zooming
      if (oldZoom !== this.zoom && this.following === null) {
        this.position.x += mousex / (this.zoom * deltaZoom) - mousex / this.zoom;
        this.position.y += mousey / (this.zoom * deltaZoom) - mousey / this.zoom;
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (mouseDown) {
        this.unfollow();
        const posDiff = initialDraggingClientPosition.clone().sub(new Vector(event.clientX, event.clientY));
        posDiff.scalar(1 / this.zoom);

        this.position = initialDragginPosition.clone().add(posDiff);
      }
    }

    const handleMouseDown = (event: MouseEvent) => {
      mouseDown = true;
      initialDragginPosition = this.position.clone();
      initialDraggingClientPosition = new Vector(event.clientX, event.clientY);
    }

    const handleCancelMouseDown = (event: MouseEvent) => {
      mouseDown = false;
    }

    const handleZoom = (e: KeyboardEvent) => {
      if (e.key === '.') {
        this.zoomIn();
      }

      if (e.key === ',') {
        this.zoomOut();
      }
    }

    // add event listeners to handle screen drag
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleCancelMouseDown);
    canvas.addEventListener("mouseover", handleCancelMouseDown);
    canvas.addEventListener("mouseout", handleCancelMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener('wheel', handleCanvasWheel)
    window.addEventListener('keydown', handleZoom)

    this.dispose = () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleCancelMouseDown);
      canvas.removeEventListener("mouseover", handleCancelMouseDown);
      canvas.removeEventListener("mouseout", handleCancelMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener('wheel', handleCanvasWheel);
      window.removeEventListener('keydown', handleZoom)
    }

  }

  follow(obj: Positionable) {
    this.following = obj;
    // this.flying.clear();
  }

  unfollow() {
    this.following = null;
  }

  zoomIn() {
    this.zoom += 0.5;
  }

  zoomOut() {
    this.zoom -= 0.5;
  }

  set zoom(_z: number) {
    if (!this.locked) {
      this._zoom = Math.min(Math.max(_z, MIN_ZOOM), MAX_ZOOM);
    }
  }

  get zoom() {
    return this._zoom;
  }

  set position(_p: Vector) {
    if (!this.locked) {
      this._position = _p;
    }
  }

  get position() {
    return this._position;
  }


  step(context: GameContext) {
    if (this.following !== null) {
      this._position = this.following.position.clone()
    }
    // this._position.add(this.flying.fly(context.dt, this.position.clone()))
    this.adjutsPositionIfOutOfWorldsBounds(context.worldDimensions);
  }

  //TODO: Double check bounding box of world with zooming, should we adjust viewport on zoom?
  adjutsPositionIfOutOfWorldsBounds(world: Rectangle) {
    const adjutsLeft = this.position.clone().x - this.viewport.w / 2 < -world.w / 2;
    const adjustRight = this.position.clone().x + this.viewport.w / 2 > world.w / 2;
    const adjustTop = this.position.clone().y - this.viewport.h / 2 > world.h / 2;
    const adjustBottom = this.position.clone().y + this.viewport.h / 2 < -world.h / 2;

    if (adjutsLeft) {
      this.position.x = -world.w / 2 + this.viewport.w / 2;
    }

    if (adjustRight) {
      this.position.x = world.w / 2 - this.viewport.w / 2;
    }

    if (adjustTop) {
      this.position.y = world.w / 2 + this.viewport.h / 2;
    }

    if (adjustBottom) {
      this.position.y = -world.w / 2 - this.viewport.h / 2;
    }

  }

  // render() {
  // const renderFn = (gameContext: GameContext) => {
  //   const { canvasRenderingContext, canvasRenderingContext: { canvas } } = gameContext;
  //   canvasRenderingContext.font = "15px Comic Sans MS";
  //   canvasRenderingContext.fillStyle = "#FFF";
  //   canvasRenderingContext.fillText(`(${this.position.x.toFixed(0)},${this.position.y.toFixed(0)})`, canvas.width - 120, 20);
  // }
  // const renderElement = new RenderElement(renderFn);
  // renderElement.positionType = 'overlay';
  // return renderElement
  // }


  // there is a known bug where the promise resolves before the flying duration when the game is on pause
  // flyTo(position: Vector | Positionable, duration: number = 2): Promise<void> {
  //   let _position: Vector;
  //   if (isPositionable(position)) {
  //     _position = position.position.clone();
  //   } else {
  //     _position = position;
  //   }
  //   this.following = null;
  //   this.flying.flyTo(this.position.clone(), _position.clone(), duration);
  //   return wait(duration)
  // }

}

export default Camera;

// class Flying {
//   private toPosition: Vector | null = null;
//   private duration: number | null = null;
//   private elapsedTime: number = 0;
//   private initialPosition: Vector | null = null;


//   flyTo(from: Vector, to: Vector, duration: number) {
//     this.toPosition = to.clone();
//     this.initialPosition = from.clone();
//     this.duration = duration;
//     this.elapsedTime = duration;
//   }

//   fly(dt: number, actualPosition: Vector) {
//     let flyingDelta = new Vector();
//     if (
//       this.toPosition !== null &&
//       this.duration !== null &&
//       this.elapsedTime !== null &&
//       this.initialPosition !== null
//     ) {
//       this.elapsedTime -= dt;
//       const toPositionVector = this.toPosition.clone().sub(actualPosition);
//       const distanceToFlyingPosition = this.initialPosition.distanceTo(this.toPosition);
//       const flyingSpeed = distanceToFlyingPosition / this.duration;
//       flyingDelta = toPositionVector.normalize().scalar(dt * flyingSpeed);
//       if (this.elapsedTime < 0) {
//         flyingDelta = this.toPosition.clone().sub(actualPosition);
//         this.clear();
//       }
//     }


//     return flyingDelta;
//   }

//   clear() {
//     this.toPosition = null;
//     this.duration = null;
//     this.initialPosition = null;
//   }

// }