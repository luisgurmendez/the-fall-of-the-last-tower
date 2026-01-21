import BaseObject from "../baseObject";
import Vector from "@/physics/vector";
import Initializable from "@/behaviors/initializable";
import Disposable from "@/behaviors/disposable";
import GameContext from "@/core/gameContext";
import RenderElement from "@/render/renderElement";
import { Rectangle } from "../shapes";
import { isCollisionableObject } from "@/mixins/collisionable";
import ArmyUnit from "../army/armyUnit";
import Intersections from "@/utils/intersections";
import Swordsman from "../army/swordsman/swordsman";
import Cooldown from "../cooldown";
import Archer from "../army/archer/archer";
import RandomUtils from "@/utils/random";
import { GameConfig, UnitConfig } from "@/config";
import { GameMap } from "@/map";

class Player extends BaseObject implements Initializable, Disposable {
  mark: Vector | null;
  shouldInitialize = true;
  shouldDispose = false;
  initialDraggingPosition: Vector | null = null;
  initialDraggingClientPosition: Vector | null = null;
  mouseDown: boolean = false;
  selectedUnits: Set<ArmyUnit> = new Set();
  mousePositionInGame: Vector | null = null;
  hoveringTarget: ArmyUnit | null = null;
  spawnSwordsmanCooldown = new Cooldown(UnitConfig.SWORDSMAN.SPAWN_COOLDOWN);
  spawnArcherCooldown = new Cooldown(UnitConfig.ARCHER.SPAWN_COOLDOWN);
  shouldSpawnSwordsman = false;
  shouldSpawnArcher = false;
  private increaseMoneyCooldown = new Cooldown(
    GameConfig.ECONOMY.PASSIVE_INCOME_INTERVAL
  );
  private gameMap: GameMap | null = null;

  constructor() {
    super();
    this.mark = null;
  }
  dispose?: (() => void | undefined) | undefined;

  init(gameContext: GameContext) {
    this.position = new Vector();
    const { canvasRenderingContext } = gameContext;
    const canvas = canvasRenderingContext.canvas;

    // Store reference to game map for pathfinding
    this.gameMap = gameContext.background.gameMap;

    this.initialDraggingPosition = new Vector();
    this.initialDraggingClientPosition = new Vector();

    const handleMouseMove = (event: MouseEvent) => {
      this.mousePositionInGame = this.mouseCoordsToGameCoordsWithZoom(
        gameContext,
        canvas,
        event.clientX,
        event.clientY
      );
      if (this.mouseDown) {
        this.initialDraggingClientPosition = this.mousePositionInGame.clone();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 2) {
        handleRightClick(event);
        return;
      }

      if (this.hoveringTarget) {
        if (this.hoveringTarget.side === 1) {
          // Sets the target as the hovered target for all selected units
          this.selectedUnits.forEach((unit) => {
            unit.targetPosition = null;
            unit.target = this.hoveringTarget;
            unit.targetHasBeenSetByPlayer = true;
          });
        } else {
          // Selecting a single unit
          this.unselectAllUnits();
          this.hoveringTarget.isSelected = true;
          this.selectedUnits.add(this.hoveringTarget);
        }
      } else {
        this.mouseDown = true;
        this.unselectAllUnits();
        this.mark = null;
        this.initialDraggingPosition = this.mouseCoordsToGameCoordsWithZoom(
          gameContext,
          canvas,
          event.clientX,
          event.clientY
        );
        this.initialDraggingClientPosition = null;
      }
    };

    const handleCancelMouseDown = (event: MouseEvent) => {
      this.mouseDown = false;
      this.initialDraggingClientPosition = null;
      this.initialDraggingPosition = null;
    };

    const handleRightClick = (event: MouseEvent) => {
      event.preventDefault();
      if (this.hoveringTarget && this.hoveringTarget.side === 1) {
        this.selectedUnits.forEach((unit) => {
          unit.targetPosition = null;
          unit.target = this.hoveringTarget;
          unit.targetHasBeenSetByPlayer = true;
        });
      } else {
        const position = this.mouseCoordsToGameCoordsWithZoom(
          gameContext,
          canvas,
          event.clientX,
          event.clientY
        );
        this.mark = position.clone();
        /// sets the target position for each unit making it a line using the `position` as the center and using the
        /// distance between units as the distance between each unit
        let i = 0;
        const distanceBetweenUnits = 25;
        this.selectedUnits.forEach((unit) => {
          // Sets the targetPosition for individual units to form a military formation
          const offsetY = Math.floor(i / 10) * distanceBetweenUnits;
          const offsetX = (i % 10) * distanceBetweenUnits;
          const targetPos = position.clone().add(new Vector(offsetX, offsetY));

          // Use pathfinding if game map is available
          if (this.gameMap) {
            unit.setTargetPositionWithPathfinding(targetPos, this.gameMap);
          } else {
            unit.targetPosition = targetPos;
            unit.targetHasBeenSetByPlayer = true;
          }
          unit.target = null;
          i++;
        });
      }
    };

    const preventDefault = (event: MouseEvent) => {
      event.preventDefault();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleCancelMouseDown);
    canvas.addEventListener("mouseover", handleCancelMouseDown);
    canvas.addEventListener("mouseout", handleCancelMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("contextmenu", preventDefault);

    this.dispose = () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleCancelMouseDown);
      canvas.removeEventListener("mouseover", handleCancelMouseDown);
      canvas.removeEventListener("mouseout", handleCancelMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("contextmenu", preventDefault);
    };
  }

  unselectAllUnits() {
    this.selectedUnits.forEach((unit) => {
      unit.isSelected = false;
    });
    this.selectedUnits = new Set();
  }

  step(gctx: GameContext) {
    const { spatialHashing } = gctx;
    this.increaseMoneyCooldown.update(gctx.dt);
    this.spawnSwordsmanCooldown.update(gctx.dt);
    this.spawnArcherCooldown.update(gctx.dt);

    if (this.initialDraggingPosition && this.initialDraggingClientPosition) {
      const selectionCollisionMask = new Rectangle(
        Math.abs(
          this.initialDraggingClientPosition.x - this.initialDraggingPosition.x
        ),
        Math.abs(
          this.initialDraggingClientPosition.y - this.initialDraggingPosition.y
        )
      );

      const leftTopCorner = new Vector(
        Math.min(
          this.initialDraggingClientPosition.x,
          this.initialDraggingPosition.x
        ),
        Math.min(
          this.initialDraggingClientPosition.y,
          this.initialDraggingPosition.y
        )
      );

      const selectionCenterPosition = new Vector(
        leftTopCorner.x + selectionCollisionMask.w / 2,
        leftTopCorner.y + selectionCollisionMask.h / 2
      );

      const posibleObjectsInSelection = spatialHashing.queryInRange(
        selectionCenterPosition,
        Math.max(selectionCollisionMask.w, selectionCollisionMask.h)
      );
      posibleObjectsInSelection.forEach((obj) => {
        if (obj instanceof ArmyUnit && isCollisionableObject(obj)) {
          // Check if unit's collision mask intersects with selection rectangle
          const isInSelection = Intersections.isRectangleIntersectingRectangle(
            selectionCollisionMask,
            obj.collisionMask as Rectangle,
            selectionCenterPosition,
            obj.position
          );

          if (isInSelection && obj.side === 0) {
            obj.isSelected = true;
            this.selectedUnits.add(obj);
          } else {
            obj.isSelected = false;
            this.selectedUnits.delete(obj);
          }
        }
      });
    }

    if (this.mousePositionInGame) {
      const hoveringObject = spatialHashing
        .query(this.mousePositionInGame)
        .find(
          (obj) =>
            obj instanceof ArmyUnit &&
            isCollisionableObject(obj) &&
            Intersections.isPointInsideRectangle(
              this.mousePositionInGame!,
              obj.collisionMask as Rectangle,
              obj.position
            )
        ) as ArmyUnit | undefined;

      if (this.hoveringTarget) {
        this.hoveringTarget.isBeingHovered = false;
      }
      this.hoveringTarget = hoveringObject ?? null;
      if (hoveringObject) {
        hoveringObject.isBeingHovered = true;
      }
    }

    // Spawn swordsman
    if (
      this.shouldSpawnSwordsman &&
      !this.spawnSwordsmanCooldown.isCooling() &&
      gctx.money >= UnitConfig.SWORDSMAN.COST
    ) {
      this.spawnSwordsmanCooldown.start();
      gctx.setMoney(gctx.money - UnitConfig.SWORDSMAN.COST);
      const spawnY = RandomUtils.getIntegerInRange(
        -GameConfig.SPAWN.ALLY.Y_VARIANCE,
        GameConfig.SPAWN.ALLY.Y_VARIANCE
      );
      gctx.objects.push(
        new Swordsman(new Vector(GameConfig.SPAWN.ALLY.X, spawnY), 0)
      );
    }

    // Spawn archer
    if (
      this.shouldSpawnArcher &&
      !this.spawnArcherCooldown.isCooling() &&
      gctx.money >= UnitConfig.ARCHER.COST
    ) {
      this.spawnArcherCooldown.start();
      gctx.setMoney(gctx.money - UnitConfig.ARCHER.COST);
      const spawnY = RandomUtils.getIntegerInRange(
        -GameConfig.SPAWN.ALLY.Y_VARIANCE,
        GameConfig.SPAWN.ALLY.Y_VARIANCE
      );
      gctx.objects.push(
        new Archer(new Vector(GameConfig.SPAWN.ALLY.X, spawnY), 0)
      );
    }

    this.shouldSpawnArcher = false;
    this.shouldSpawnSwordsman = false;

    // Passive income
    if (!this.increaseMoneyCooldown.isCooling()) {
      gctx.setMoney(gctx.money + GameConfig.ECONOMY.PASSIVE_INCOME);
      this.increaseMoneyCooldown.start();
    }
  }

  render(): RenderElement {
    return new RenderElement((gctx) => {
      const { canvasRenderingContext } = gctx;
      if (
        this.mouseDown &&
        this.initialDraggingPosition &&
        this.initialDraggingClientPosition
      ) {
        canvasRenderingContext.strokeStyle = "white";
        canvasRenderingContext.lineWidth = 4;
        canvasRenderingContext.setLineDash([5, 10]);
        canvasRenderingContext.strokeRect(
          this.initialDraggingPosition.x,
          this.initialDraggingPosition.y,
          this.initialDraggingClientPosition.x - this.initialDraggingPosition.x,
          this.initialDraggingClientPosition.y - this.initialDraggingPosition.y
        );
      }
    }, true);
  }

  private mouseCoordsToGameCoordsWithZoom(
    gctx: GameContext,
    canvas: HTMLCanvasElement,
    x: number,
    y: number
  ): Vector {
    const zoomFactor = gctx.camera.zoom;
    const cameraX = gctx.camera.position.x;
    const cameraY = gctx.camera.position.y;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (x - rect.left) * scaleX;
    const canvasY = (y - rect.top) * scaleY;

    const trueCanvasX = canvasX / zoomFactor;
    const trueCanvasY = canvasY / zoomFactor;

    const worldX = trueCanvasX + cameraX - canvas.width / (2 * zoomFactor);
    const worldY = trueCanvasY + cameraY - canvas.height / (2 * zoomFactor);

    return new Vector(worldX, worldY);
  }
}

export default Player;
