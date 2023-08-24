import { Rectangle } from "../objects/shapes";
import { Collisions } from "../controllers/CollisionsController";
import BaseObject from "../objects/baseObject";
import Keyboard from "./keyboard";
import Camera from "./camera";
import Rocket from "../objects/rocket/rocket";

class GameContext {
  readonly collisions: Collisions;
  readonly isPaused: boolean;
  readonly dt: number;

  // Change objects to a map of baseobject lists, separated by object type.
  // objects = {rockets:[], planets: [], ...}
  // With method all(): BaseObject[]
  readonly objects: BaseObject[];
  readonly rocket: Rocket;
  readonly pressedKeys: Keyboard;
  readonly canvasRenderingContext: CanvasRenderingContext2D;
  readonly camera: Camera;
  readonly worldDimensions: Rectangle
  readonly numOfRescuedAstronauts: number;

  rescueAstronaut: () => void;
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
    rocket: Rocket,
    numOfRescuedAstronauts: number,
    rescueAstronaut: () => void,
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
    this.rocket = rocket;
    this.numOfRescuedAstronauts = numOfRescuedAstronauts;
    this.rescueAstronaut = rescueAstronaut;
    this.pause = pause;
    this.unPause = unPause;
  }
}

export default GameContext;