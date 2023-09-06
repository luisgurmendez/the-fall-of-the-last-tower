import Disposable from "@/behaviors/disposable";
import BaseObject from "@/objects/baseObject";
import Stepable from "@/behaviors/stepable";
import { Positionable } from "@/mixins/positional";
import Vector from "@/physics/vector";
import GameContext from "./gameContext";
import Initializable from "@/behaviors/initializable";
import { Rectangle } from "@/objects/shapes";
import Keyboard from "./keyboard";

const MAX_ZOOM = 14;
const MIN_ZOOM = 0.4;
export const CAMERA_ID = "cmr"
const keyboard = Keyboard.getInstance();

class Camera extends BaseObject implements Stepable, Disposable, Initializable {
  _position: Vector;
  viewport: Rectangle;
  private _zoom: number;
  following: Positionable | null;
  dispose?: () => void = undefined;
  locked = false;
  shouldInitialize = true;
  shouldDispose = false;
  worldDimensions: Rectangle | null = null;
  mousePosition: Vector | null = null;
  // flying: Flying = new Flying();

  constructor() {
    super(new Vector(), CAMERA_ID);
    // this.position = new Vector(document.body.scrollWidth / 2, document.body.scrollHeight / 2);
    this._position = new Vector(0, 0);
    this.viewport = new Rectangle(
      document.body.scrollWidth,
      document.body.scrollHeight
    );
    this._zoom = 1;
    this.following = null;
  }

  init(gameContext: GameContext) {
    const { canvasRenderingContext } = gameContext;
    const canvas = canvasRenderingContext.canvas;
    this.worldDimensions = gameContext.worldDimensions;

    this.viewport.w = canvas.width;
    this.viewport.h = canvas.height;

    let initialDragginPosition = new Vector();
    let initialDraggingClientPosition = new Vector();
    let mouseDown = false;

    const handleCanvasWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (keyboard.isKeyPressed("s")) return;

      const mousex =
        (event.clientX - (canvas.offsetLeft + canvas.width / 2)) * -1;
      const mousey =
        (event.clientY - (canvas.offsetTop + canvas.height / 2)) * -1;
      const wheel = event.deltaY < 0 ? 1 : -1;

      const deltaZoom = Math.exp(wheel * 0.05);

      const oldZoom = this.zoom;
      this.zoom = this.zoom * deltaZoom;

      // Only change positions if there was some actual zooming
      if (oldZoom !== this.zoom && this.following === null) {
        this.position.x +=
          mousex / (this.zoom * deltaZoom) - mousex / this.zoom;
        this.position.y +=
          mousey / (this.zoom * deltaZoom) - mousey / this.zoom;
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (keyboard.isKeyPressed("s")) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      this.mousePosition = new Vector(mouseX, mouseY);

      if (mouseDown) {
        this.unfollow();
        const posDiff = initialDraggingClientPosition
          .clone()
          .sub(new Vector(event.clientX, event.clientY));
        posDiff.scalar(1 / this.zoom);

        this.position = initialDragginPosition.clone().add(posDiff);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (keyboard.isKeyPressed("s")) return;
      mouseDown = true;
      initialDragginPosition = this.position.clone();
      initialDraggingClientPosition = new Vector(event.clientX, event.clientY);
    };

    const handleCancelMouseDown = (event: MouseEvent) => {
      mouseDown = false;
    };

    const handleZoom = (e: KeyboardEvent) => {
      if (keyboard.isKeyPressed("s")) return;
      if (e.key === ".") {
        this.zoomIn();
      }

      if (e.key === ",") {
        this.zoomOut();
      }
    };

    // add event listeners to handle screen drag
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleCancelMouseDown);
    canvas.addEventListener("mouseover", handleCancelMouseDown);
    canvas.addEventListener("mouseout", handleCancelMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("wheel", handleCanvasWheel);
    window.addEventListener("keydown", handleZoom);

    this.dispose = () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleCancelMouseDown);
      canvas.removeEventListener("mouseover", handleCancelMouseDown);
      canvas.removeEventListener("mouseout", handleCancelMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("wheel", handleCanvasWheel);
      window.removeEventListener("keydown", handleZoom);
    };
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
      this._zoom = Math.min(Math.max(_z, this.getMinZoom()), MAX_ZOOM);
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

  getMinZoom() {
    if (this.worldDimensions === null) {
      return MIN_ZOOM;
    }
    const minZoomX = this.viewport.w / this.worldDimensions.w;
    const minZoomY = this.viewport.h / this.worldDimensions.h;
    return Math.max(minZoomX, minZoomY);
  }

  private updatePosition() {
    // How close the mouse needs to be to an edge to start scrolling
    const edgeThreshold = 50;
    // Maximum speed of camera scroll in units per frame
    const maxSpeed = 10;

    // Update the camera position based on mouse coordinates
    if (this.mousePosition !== null) {
      const mouseX = this.mousePosition.x;
      const mouseY = this.mousePosition.y;
      let deltaX = 0, deltaY = 0;

      // Calculate distance from each edge
      const distLeft = mouseX;
      const distRight = this.viewport.w - mouseX;
      const distTop = mouseY;
      const distBottom = this.viewport.h - mouseY;

      // Check if we're near any of the edges and update camera position accordingly
      if (distLeft < edgeThreshold) {
        deltaX = -maxSpeed * Math.pow((edgeThreshold - distLeft) / edgeThreshold, 2);
      }
      if (distRight < edgeThreshold) {
        deltaX = maxSpeed * Math.pow((edgeThreshold - distRight) / edgeThreshold, 2);
      }
      if (distTop < edgeThreshold) {
        deltaY = -maxSpeed * Math.pow((edgeThreshold - distTop) / edgeThreshold, 2);
      }
      if (distBottom < edgeThreshold) {
        deltaY = maxSpeed * Math.pow((edgeThreshold - distBottom) / edgeThreshold, 2);
      }

      // Update the camera position
      this.position.x += deltaX;
      this.position.y += deltaY;
    }

  }

  step(context: GameContext) {
    const { canvasRenderingContext: { canvas } } = context;
    this.viewport.w = canvas.width;
    this.viewport.h = canvas.height;
    this.updatePosition();
    if (this.following !== null) {
      this._position = this.following.position.clone();
    }
    this.adjustPositionIfOutOfWorldsBounds(context.worldDimensions);
  }

  adjustPositionIfOutOfWorldsBounds(world: Rectangle) {
    const viewportWithZoom = new Rectangle(this.viewport.w / this.zoom, this.viewport.h / this.zoom);

    const adjustLeft =
      this.position.clone().x - viewportWithZoom.w / 2 < -world.w / 2;

    const adjustRight =
      this.position.clone().x + viewportWithZoom.w / 2 > world.w / 2;

    const adjustTop =
      this.position.clone().y + viewportWithZoom.h / 2 > world.h / 2;

    const adjustBottom =
      this.position.clone().y - viewportWithZoom.h / 2 < -world.h / 2;

    if (adjustLeft) {
      this.position.x = -world.w / 2 + viewportWithZoom.w / 2;
    }

    if (adjustRight) {
      this.position.x = world.w / 2 - viewportWithZoom.w / 2;
    }

    if (adjustTop) {
      this.position.y = world.w / 2 - viewportWithZoom.h / 2;
    }

    if (adjustBottom) {
      this.position.y = -world.w / 2 + viewportWithZoom.h / 2;
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
