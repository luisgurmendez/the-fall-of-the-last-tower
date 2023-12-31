import Disposable from "@/behaviors/disposable";
import BaseObject from "@/objects/baseObject";
import Stepable from "@/behaviors/stepable";
import { Positionable } from "@/mixins/positional";
import Vector from "@/physics/vector";
import GameContext from "./gameContext";
import Initializable from "@/behaviors/initializable";
import { Rectangle } from "@/objects/shapes";

const MAX_ZOOM = 14;
const MIN_ZOOM = 0.4;
export const CAMERA_ID = "cmr"

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

    const handleCanvasWheel = (event: WheelEvent) => {
      event.preventDefault();
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
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      this.mousePosition = new Vector(mouseX, mouseY);
    };

    const handleZoom = (e: KeyboardEvent) => {
      if (e.key === ".") {
        this.zoomIn();
      }

      if (e.key === ",") {
        this.zoomOut();
      }
    };

    // add event listeners to handle screen drag
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("wheel", handleCanvasWheel);
    window.addEventListener("keydown", handleZoom);

    this.dispose = () => {
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
    const edgeThreshold = 150;
    // Maximum speed of camera scroll in units per frame
    const maxSpeed = 20;

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
      this.position.x += deltaX * 1 / this.zoom;
      this.position.y += deltaY * 1 / this.zoom;
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
}

export default Camera;
