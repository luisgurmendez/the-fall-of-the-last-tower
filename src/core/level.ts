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

class Level {
  objects: BaseObject[] = [];
  camera: Camera;
  worldDimensions: Rectangle;

  private collisionController: CollisionsController =
    new CollisionsController();
  private renderController: RenderController = new RenderController();
  private statusController: LevelStatusController;

  shouldInitialize = true;
  shouldDispose = false;

  constructor(
    objects: BaseObject[],
    criteria: LevelCriterion,
    worldDimensions: Rectangle = new Rectangle(1000, 1000)
  ) {
    this.objects = objects;
    this.camera = new Camera();
    this.worldDimensions = worldDimensions;
    this.statusController = new LevelStatusController(criteria);
    this.objects = [...objects, this.camera];
  }

  update(gameApi: GameApi): void {
    const spatialHasing = this._buildSpatiallyHashedObjects();
    const collisions = this._buildCollisions(spatialHasing);

    const gameContext = this.generateGameContext(gameApi, collisions, spatialHasing);
    if (!gameApi.isPaused) {
      this.initializeObjects(gameContext);
      this.stepObjects(gameContext);

      // Move this to private fn..
      if (!this.statusController.hasWonOrLost) {
        const status = this.statusController.checkLevelCriteria(gameContext);
        if (status !== LevelStatus.PLAYING) {
          console.log(status);
        }
      }
      this.disposeObjects(gameContext);
    }
    this.renderController.render(gameContext);

  }

  private _buildCollisions(spatialHasing: SpatiallyHashedObjects) {
    const collisionableObjects: CollisionableObject[] = this.objects.filter(
      isCollisionableObject
    );
    return this.collisionController.buildCollisions(collisionableObjects, spatialHasing);
  }

  private _buildSpatiallyHashedObjects() {
    const spatialHasing = new SpatiallyHashedObjects(200);
    this.objects.forEach((obj) => {
      spatialHasing.insert(obj);
    });
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
      isDisposable(obj) && obj.dispose && obj.dispose();
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

enum LevelStatus {
  WON,
  LOST,
  PLAYING,
}
class LevelStatusController {
  hasWonOrLost = false;
  criteria: LevelCriterion;

  constructor(criteria: LevelCriterion) {
    this.criteria = criteria;
  }

  checkLevelCriteria(context: GameContext) {
    this.criteria.step(context);
    if (this.criteria.won()) {
      this.hasWonOrLost = true;
      return LevelStatus.WON;
    }

    if (this.criteria.lost()) {
      this.hasWonOrLost = true;
      return LevelStatus.LOST;
    }

    return LevelStatus.PLAYING;
  }
}

// class RestartLevelLabelObject extends BaseObject implements Renderable {
//   render() {
//     const renderFn = (ctx: GameContext) => {
//       ctx.canvasRenderingContext.font = "45px Comic Sans MS";
//       ctx.canvasRenderingContext.fillStyle = "#FFF";
//       RenderUtils.renderText(
//         ctx.canvasRenderingContext,
//         "Press [r] to restart level",
//         new Vector(Dimensions.w / 2, 20)
//       );
//     };
//     const renderEl = new RenderElement(renderFn);
//     renderEl.positionType = "overlay";
//     return renderEl;
//   }
// }

// export class Text extends BaseObject {
//   render() {
//     const renderFn = (ctx: GameContext) => {
//       const canvasRenderingContext = ctx.canvasRenderingContext;
//       canvasRenderingContext.fillStyle = "#FFF";
//       canvasRenderingContext.font = "15px Comic Sans MS";
//       RenderUtils.renderText(
//         canvasRenderingContext,
//         "Press [m] to toggle menu",
//         new Vector(100, Dimensions.h - 30)
//       );
//     };

//     const rEl = new RenderElement(renderFn);
//     rEl.positionType = "overlay";
//     return rEl;
//   }
// }
