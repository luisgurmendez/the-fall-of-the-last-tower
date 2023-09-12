import { Rectangle } from "@/objects/shapes";
import BaseObject from "@/objects/baseObject";
import Camera from "./camera";
import { isInitializable } from "@/behaviors/initializable";
import { isDisposable } from "@/behaviors/disposable";
import GameContext from "./gameContext";
import CollisionsController, {
  CollisionableObject,
  Collisions,
} from "@/controllers/CollisionsController";
import { GameApi } from "./game";
import RenderController from "@/controllers/RenderController";
import { isCollisionableObject } from "@/mixins/collisionable";
import Stepable, { isStepable } from "@/behaviors/stepable";
import SpatiallyHashedObjects from "@/utils/spatiallyHashedObjects";
import { filterInPlaceAndGetRest } from "@/utils/fn";
import Castle, { CASTLE_ID } from "@/objects/castle/castle";

class Level {
  objects: BaseObject[] = [];
  camera: Camera;
  worldDimensions: Rectangle;

  private collisionController: CollisionsController =
    new CollisionsController();
  private renderController: RenderController = new RenderController();

  shouldInitialize = true;
  shouldDispose = false;

  constructor(
    objects: BaseObject[],
    worldDimensions: Rectangle
  ) {
    this.objects = objects;
    this.camera = new Camera();
    this.worldDimensions = worldDimensions;
    this.objects = [...objects, this.camera];
  }

  update(gameApi: GameApi): void {

    if (!gameApi.isPaused) {
      const collisionableObjects: CollisionableObject[] = this.objects.filter(
        isCollisionableObject
      );
      const spatialHasing = this._buildSpatiallyHashedObjects(collisionableObjects);
      const collisions = this.collisionController.buildCollisions(collisionableObjects, spatialHasing);

      const gameContext = this.generateGameContext(gameApi, collisions, spatialHasing);

      this.initializeObjects(gameContext);
      this.stepObjects(gameContext);
      this.disposeObjects(gameContext);
      this.renderController.render(gameContext);
    }
  }

  private _buildSpatiallyHashedObjects(collisionableObjects: CollisionableObject[]) {
    const spatialHasing = new SpatiallyHashedObjects(100);
    collisionableObjects.forEach(spatialHasing.insert);
    return spatialHasing;
  }

  private initializeObjects(gameContext: GameContext) {
    const { objects } = gameContext;

    objects.forEach((obj) => {
      if (isInitializable(obj) && obj.shouldInitialize) {
        obj.init(gameContext);
        obj.shouldInitialize = false;
      }
    });
  }

  private stepObjects(gameContext: GameContext) {
    const objects = gameContext.objects;
    objects.forEach((obj) => {
      if (isStepable(obj)) {
        obj.step(gameContext);
      }
    });
  }

  private disposeObjects(gameContext: GameContext) {
    const { objects } = gameContext;
    const objsToDispose = filterInPlaceAndGetRest(objects, (obj) => {
      return !(isDisposable(obj) && obj.shouldDispose);
    });

    objsToDispose.forEach((obj) => {
      isDisposable(obj) && obj.dispose && obj.dispose(gameContext);
    });
  }


  private generateGameContext(
    api: GameApi,
    collisions: Collisions,
    spatialHasing: SpatiallyHashedObjects
  ): GameContext {
    return new GameContext(
      collisions,
      spatialHasing,
      api.dt,
      api.isPaused,
      this.objects,
      // this.background,
      // pressedKeys,
      api.canvasRenderingContext,
      this.camera,
      this.worldDimensions,
      api.pause,
      api.unPause
    );
  }
}

export default Level;

export interface LevelCriterion extends Stepable {
  won(): boolean;
  lost(): boolean;
}

export interface LevelFailing extends Stepable {
  completed(): boolean;
}
