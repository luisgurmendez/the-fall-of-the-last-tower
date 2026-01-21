import { Rectangle } from "@/objects/shapes";
import { GameObject, isInitializable, isDisposable, isStepable } from "./GameObject";
import type Stepable from "@/behaviors/stepable";
import Camera from "./camera";
import GameContext from "./gameContext";
import CollisionsController, {
  CollisionableObject,
  Collisions,
} from "@/controllers/CollisionsController";
import { GameApi } from "./gameContext";
import RenderController from "@/controllers/RenderController";
import { isCollisionableObject } from "@/mixins/collisionable";
import SpatiallyHashedObjects from "@/utils/spatiallyHashedObjects";
import { filterInPlaceAndGetRest } from "@/utils/fn";
import { GameConfig } from "@/config";
import { FogOfWar, FogRevealer } from "@/core/FogOfWar";
import { getShopUI } from "@/ui/shop/ShopUI";
import { profiler } from "@/debug/PerformanceProfiler";
import NavigationGrid from "@/navigation/NavigationGrid";
import { MOBAMap } from "@/map/MOBAMap";

/**
 * Type guard to check if an object can reveal fog of war.
 */
function isFogRevealer(obj: unknown): obj is FogRevealer {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof (obj as any).getPosition === 'function' &&
    typeof (obj as any).getTeamId === 'function' &&
    typeof (obj as any).getSightRange === 'function'
  );
}

class Level {
  /** All game objects in the level */
  objects: GameObject[] = [];
  camera: Camera;
  worldDimensions: Rectangle;
  money = GameConfig.ECONOMY.STARTING_MONEY;
  fogOfWar: FogOfWar;
  /** Local player's team (for fog of war). Set from match data in online mode. */
  localPlayerTeam: number = 0;

  private collisionController: CollisionsController =
    new CollisionsController();
  private renderController: RenderController = new RenderController();

  shouldInitialize = true;
  shouldDispose = false;

  /**
   * Create a Level.
   * @param objects - Game objects to include in the level
   * @param worldDimensions - World size
   * @param options - Optional configuration
   * @param options.localPlayerTeam - Team ID for the local player (default: 0)
   * @param options.disableFog - If true, fog of war is disabled (for online mode where server handles visibility)
   */
  constructor(
    objects: GameObject[],
    worldDimensions: Rectangle,
    options?: { localPlayerTeam?: number; disableFog?: boolean }
  ) {
    this.objects = objects;
    this.camera = new Camera();
    this.worldDimensions = worldDimensions;
    this.objects = [...objects, this.camera];
    this.localPlayerTeam = options?.localPlayerTeam ?? 0;

    // Initialize fog of war with world dimensions
    // In online mode, fog is disabled - server handles visibility filtering
    const fogEnabled = !options?.disableFog && (GameConfig.FOG_OF_WAR?.ENABLED ?? true);
    this.fogOfWar = new FogOfWar({
      worldWidth: worldDimensions.w,
      worldHeight: worldDimensions.h,
      cellSize: GameConfig.FOG_OF_WAR?.CELL_SIZE ?? 50,
      enabled: fogEnabled,
      initialState: GameConfig.FOG_OF_WAR?.INITIAL_STATE ?? 'unexplored',
    });
  }

  update(gameApi: GameApi): void {
    // Record object counts for profiling
    profiler.recordObjectCount('Total Objects', this.objects.length);

    profiler.begin('Collision Filter', { threshold: 2 });
    const collisionableObjects: CollisionableObject[] = this.objects.filter(
      isCollisionableObject
    );
    profiler.end('Collision Filter');
    profiler.recordObjectCount('Collisionable', collisionableObjects.length);

    profiler.begin('Spatial Hashing', { threshold: 3 });
    const spatialHasing = this._buildSpatiallyHashedObjects(collisionableObjects);
    profiler.end('Spatial Hashing');

    profiler.begin('Collision Detection', { threshold: 4 });
    const collisions = this.collisionController.buildCollisions(collisionableObjects, spatialHasing);
    profiler.end('Collision Detection');

    profiler.begin('Fog of War', { threshold: 5, critical: true });
    this.updateFogOfWar();
    profiler.end('Fog of War');

    const gameContext = this.generateGameContext(gameApi, collisions, spatialHasing);

    profiler.begin('Initialize', { threshold: 2 });
    this.initializeObjects(gameContext);
    profiler.end('Initialize');

    profiler.begin('Step (AI/Logic)', { threshold: 8 });
    this.stepObjects(gameContext);
    profiler.end('Step (AI/Logic)');

    this.updateShopUI(gameContext);  // Update shop even when paused

    profiler.begin('Dispose', { threshold: 1 });
    this.disposeObjects(gameContext);
    profiler.end('Dispose');

    profiler.begin('Render', { threshold: 10, critical: true });
    this.renderController.render(gameContext);
    profiler.end('Render');
  }

  private updateFogOfWar(): void {
    // Collect all objects that can reveal fog
    const revealers: FogRevealer[] = [];
    for (const obj of this.objects) {
      if (isFogRevealer(obj)) {
        revealers.push(obj);
      }
    }
    this.fogOfWar.update(revealers);
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
    // Don't update any objects when paused
    if (gameContext.isPaused) return;

    const objects = gameContext.objects;
    objects.forEach((obj) => {
      if (isStepable(obj)) {
        // Profile individual object steps (only track objects that might be slow)
        const objName = obj.constructor?.name || 'Unknown';
        const shouldProfile = [
          'OnlineFogProvider',
          'OnlineInputHandler',
          'OnlineMinimap',
          'ChampionHUD',
          'MOBAMap',
          'BushManager',
          'Camera',
        ].includes(objName);

        if (shouldProfile) {
          profiler.begin(`Step:${objName}`, { threshold: 2 });
        }

        obj.step(gameContext);

        if (shouldProfile) {
          profiler.end(`Step:${objName}`);
        }
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

  private setMoney = (a: number) => {
    this.money = a;
  }

  /**
   * Update the shop UI with current game context.
   * This runs even when paused so the shop remains responsive.
   */
  private updateShopUI(gameContext: GameContext): void {
    const shopUI = getShopUI();
    if (shopUI.isOpen()) {
      shopUI.setGameContext(gameContext);
      shopUI.update();
    }
  }

  /**
   * Find the navigation grid from MOBAMap if present.
   */
  private getNavigationGrid(): NavigationGrid | undefined {
    const mobaMap = this.objects.find(obj => obj instanceof MOBAMap) as MOBAMap | undefined;
    if (mobaMap) {
      return mobaMap.getNavigationGrid();
    }
    return undefined;
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
      this.money,
      this.setMoney,
      api.pause,
      api.unPause,
      this.fogOfWar,
      this.getNavigationGrid(),
      this.localPlayerTeam
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
