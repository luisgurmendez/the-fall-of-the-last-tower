import { Rectangle } from "../objects/shapes";
import { Collisions } from "../controllers/CollisionsController";
import BaseObject from "../objects/baseObject";
import Keyboard from "./keyboard";
import Camera from "./camera";

class GameContext {
  readonly collisions: Collisions;
  readonly isPaused: boolean;
  readonly dt: number;
  readonly objects: BaseObject[];
  readonly pressedKeys: Keyboard;
  readonly canvasRenderingContext: CanvasRenderingContext2D;
  readonly camera: Camera;
  readonly worldDimensions: Rectangle;

  pause: () => void;
  unPause: () => void;

  constructor(
    collisions: Collisions,
    dt: number,
    isPaused: boolean,
    objects: BaseObject[],
    pressedKeys: Keyboard,
    canvasRenderingContext: CanvasRenderingContext2D,
    camera: Camera,
    worldDimensions: Rectangle,
    pause: () => void,
    unPause: () => void
  ) {
    this.collisions = collisions;
    this.dt = dt;
    this.isPaused = isPaused;
    this.objects = objects;
    this.pressedKeys = pressedKeys;
    this.canvasRenderingContext = canvasRenderingContext;
    this.camera = camera;
    this.worldDimensions = worldDimensions;
    this.pause = pause;
    this.unPause = unPause;
  }
}

export default GameContext;
