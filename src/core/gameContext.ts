import { Rectangle } from "@/objects/shapes";
import { Collisions } from "@/controllers/CollisionsController";
import BaseObject from "@/objects/baseObject";
// import Keyboard from "./keyboard";
import Camera from "./camera";
import SpatiallyHashedObjects from "@/utils/spatiallyHashedObjects";
import Castle, { CASTLE_ID } from "@/objects/castle/castle";
import Background, { BACKGROUND_ID } from "@/objects/background";

class GameContext {
  readonly collisions: Collisions;
  readonly spatialHashing: SpatiallyHashedObjects;
  readonly isPaused: boolean;
  readonly dt: number;
  readonly objects: BaseObject[];
  // readonly pressedKeys: Keyboard;
  readonly canvasRenderingContext: CanvasRenderingContext2D;
  readonly camera: Camera;
  readonly worldDimensions: Rectangle;
  readonly background: Background;
  readonly castle: Castle | undefined;
  readonly money: number;

  setMoney: (a: number) => void;
  pause: () => void;
  unPause: () => void;

  constructor(
    collisions: Collisions,
    spatialHashing: SpatiallyHashedObjects,
    dt: number,
    isPaused: boolean,
    objects: BaseObject[],
    canvasRenderingContext: CanvasRenderingContext2D,
    camera: Camera,
    worldDimensions: Rectangle,
    money: number,
    setMoney: (amount: number) => void,
    pause: () => void,
    unPause: () => void
  ) {
    this.collisions = collisions;
    this.spatialHashing = spatialHashing;
    this.dt = dt;
    this.isPaused = isPaused;
    this.objects = objects;
    // this.pressedKeys = pressedKeys;
    this.canvasRenderingContext = canvasRenderingContext;
    this.camera = camera;
    this.worldDimensions = worldDimensions;
    this.castle = objects.find(o => o.id === CASTLE_ID) as Castle;
    this.background = objects.find(o => o.id === BACKGROUND_ID) as Background;
    this.money = money;
    this.setMoney = setMoney;
    this.pause = pause;
    this.unPause = unPause;
  }
}

export default GameContext;
