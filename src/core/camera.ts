import Disposable from "@/behaviors/disposable";
import { GameObject } from "@/core/GameObject";
import Stepable from "@/behaviors/stepable";
import { Positionable } from "@/mixins/positional";
import Vector from "@/physics/vector";
import type GameContext from "./gameContext";
import Initializable from "@/behaviors/initializable";
import { Rectangle } from "@/objects/shapes";
import { GameConfig } from "@/config";
import { Dimensions } from "@/core/canvas";
import { getAudio } from "@/audio/AudioManager";
import { updateAmbience } from "@/audio/ambience";
import { setShakeView } from "@/core/screenShake";
import { getControls } from "@/core/input/controls";
import { normalizeKey } from "@/core/input/keyBindings";
import { isTypingTarget } from "@/core/state/chat";

const { CAMERA: CAMERA_CONFIG } = GameConfig;
export const CAMERA_ID = "camera";

/**
 * Camera - Special game object that controls the viewport.
 *
 * Implements GameObject directly (rather than extending WorldEntity)
 * because it needs custom position accessor behavior for locking.
 */
class Camera implements GameObject, Stepable, Disposable, Initializable {
  readonly id = CAMERA_ID;
  private _position: Vector;
  viewport: Rectangle;
  private _zoom: number;
  following: Positionable | null;
  dispose?: () => void = undefined;
  locked = false;
  shouldInitialize = true;
  shouldDispose = false;
  worldDimensions: Rectangle | null = null;
  mousePosition: Vector | null = null;
  /** Edge panning is skipped while this says the pointer is over UI (e.g. the minimap) */
  isPointerOverUI: ((x: number, y: number) => boolean) | null = null;
  // flying: Flying = new Flying();

  constructor() {
    // this.position = new Vector(document.body.scrollWidth / 2, document.body.scrollHeight / 2);
    this._position = new Vector(0, 0);
    this.viewport = new Rectangle(window.innerWidth, window.innerHeight);
    this._zoom = 1;
    this.following = null;
  }

  init(gameContext: GameContext) {
    const { canvasRenderingContext } = gameContext;
    const canvas = canvasRenderingContext.canvas;
    this.worldDimensions = gameContext.worldDimensions;

    this.viewport.w = Dimensions.w;
    this.viewport.h = Dimensions.h;
    this._zoom = this.getMinZoom();

    const handleCanvasWheel = (event: WheelEvent) => {
      event.preventDefault();
      const mousex =
        (event.clientX - (canvas.offsetLeft + Dimensions.w / 2)) * -1;
      const mousey =
        (event.clientY - (canvas.offsetTop + Dimensions.h / 2)) * -1;
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

    // Leaving the window through an edge keeps panning that way (above the
    // canvas there's only the browser's tab bar), until the pointer comes
    // back or the window loses focus
    const handleMouseLeave = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mousePosition = new Vector(
        Math.min(Math.max(event.clientX - rect.left, 0), rect.width - 1),
        Math.min(Math.max(event.clientY - rect.top, 0), rect.height - 1),
      );
    };
    const handleBlur = () => {
      this.mousePosition = null;
    };

    const handleZoom = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = normalizeKey(e.key);
      if (key === getControls().keyFor("zoom_in")) {
        this.zoomIn();
      }

      if (key === getControls().keyFor("zoom_out")) {
        this.zoomOut();
      }
    };

    // add event listeners to handle screen drag
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("wheel", handleCanvasWheel);
    window.addEventListener("keydown", handleZoom);
    window.addEventListener("blur", handleBlur);

    this.dispose = () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("wheel", handleCanvasWheel);
      window.removeEventListener("keydown", handleZoom);
      window.removeEventListener("blur", handleBlur);
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
      this._zoom = this.clampZoom(_z);
    }
  }

  /**
   * A zoom within the limits: no farther out than getMinZoom, no fewer than
   * MIN_VIEW_WIDTH world units across.
   */
  private clampZoom(zoom: number): number {
    const maxZoom = this.viewport.w / CAMERA_CONFIG.MIN_VIEW_WIDTH;
    return Math.min(Math.max(zoom, this.getMinZoom()), maxZoom);
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

  /** The farthest zoom: MAX_VIEW_WIDTH across, or FAR_VIEW_MIN_HEIGHT tall if that shows more (nor more than the world) */
  getMinZoom() {
    const viewLimit = Math.min(
      this.viewport.w / CAMERA_CONFIG.MAX_VIEW_WIDTH,
      this.viewport.h / CAMERA_CONFIG.FAR_VIEW_MIN_HEIGHT,
    );
    if (this.worldDimensions === null) {
      return viewLimit;
    }
    const minZoomX = this.viewport.w / this.worldDimensions.w;
    const minZoomY = this.viewport.h / this.worldDimensions.h;
    return Math.max(minZoomX, minZoomY, viewLimit);
  }

  private updatePosition(dt: number) {
    const edgeThreshold = CAMERA_CONFIG.EDGE_SCROLL_THRESHOLD;
    // Same speed anywhere within the edge band
    const speed = CAMERA_CONFIG.EDGE_SCROLL_SPEED * dt;

    // Update the camera position based on mouse coordinates
    if (this.mousePosition !== null && !this.isPointerOverUI?.(this.mousePosition.x, this.mousePosition.y)) {
      const mouseX = this.mousePosition.x;
      const mouseY = this.mousePosition.y;
      let deltaX = 0, deltaY = 0;

      // Calculate distance from each edge
      const distLeft = mouseX;
      const distRight = this.viewport.w - mouseX;
      const distTop = mouseY;
      const distBottom = this.viewport.h - mouseY;

      // Check if we're near any of the edges and update camera position accordingly
      if (distLeft < edgeThreshold) deltaX = -speed;
      if (distRight < edgeThreshold) deltaX = speed;
      if (distTop < edgeThreshold) deltaY = -speed;
      if (distBottom < edgeThreshold) deltaY = speed;

      // Update the camera position
      this.position.x += deltaX * 1 / this.zoom;
      this.position.y += deltaY * 1 / this.zoom;
    }

  }

  step(context: GameContext) {
    this.viewport.w = Dimensions.w;
    this.viewport.h = Dimensions.h;
    // The limits depend on the window's size
    this._zoom = this.clampZoom(this._zoom);
    this.updatePosition(context.dt);
    if (this.following !== null) {
      this._position = this.following.position.clone();
    }
    this.adjustPositionIfOutOfWorldsBounds(context.worldDimensions);

    // The camera is what hears the world, and feels it shake
    getAudio().setListener(this._position.x, this._position.y, this.viewport.w / this._zoom);
    setShakeView(this._position.x, this._position.y, this.viewport.w / this._zoom);
    updateAmbience(this._position.x, this._position.y);
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
      this.position.y = world.h / 2 - viewportWithZoom.h / 2;
    }

    if (adjustBottom) {
      this.position.y = -world.h / 2 + viewportWithZoom.h / 2;
    }
  }
}

export default Camera;
