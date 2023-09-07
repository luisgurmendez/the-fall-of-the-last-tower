import Keyboard from "@/core/keyboard";
import BaseObject from "../baseObject";
import Vector from "@/physics/vector";
import Initializable from "@/behaviors/initializable";
import Disposable from "@/behaviors/disposable";
import GameContext from "@/core/gameContext";
import RenderElement from "@/render/renderElement";
import { Rectangle } from "../shapes";
import CollisionsController from "@/controllers/CollisionsController";
import { isCollisionableObject } from "@/mixins/collisionable";
import ArmyUnit from "../army/armyUnit";
import RenderUtils from "@/render/utils";
import SpatiallyHashedObjects from "@/utils/spatiallyHashedObjects";
import Intersections from "@/utils/intersections";
import { Target } from "../army/types";

const keyboard = Keyboard.getInstance();

class Player extends BaseObject implements Initializable, Disposable {
    mark: Vector | null;
    shouldInitialize = true;
    shouldDispose = false;
    initialDraggingPosition: Vector | null = null;
    initialDraggingClientPosition: Vector | null = null;
    mouseDown: boolean = false;
    selectedUnits: ArmyUnit[] = [];
    mousePositionInGame: Vector | null = null;
    hoveringTarget: Target | null = null;

    constructor() {
        super();
        this.mark = null;
    }
    dispose?: (() => void | undefined) | undefined;

    init(gameContext: GameContext) {
        this.position = new Vector(-Infinity, -Infinity);
        const { canvasRenderingContext } = gameContext;
        const canvas = canvasRenderingContext.canvas;

        this.initialDraggingPosition = new Vector();
        this.initialDraggingClientPosition = new Vector();

        const handleMouseMove = (event: MouseEvent) => {
            this.mousePositionInGame = this.mouseCoordsToGameCoordsWithZoom(gameContext, canvas, event.clientX, event.clientY, gameContext.camera.zoom);
            if (keyboard.isKeyPressed("s")) {
                if (this.mouseDown) {
                    this.initialDraggingClientPosition = this.mouseCoordsToGameCoordsWithZoom(gameContext, canvas, event.clientX, event.clientY, gameContext.camera.zoom);
                }
            }
        };

        const handleMouseDown = (event: MouseEvent) => {
            if (keyboard.isKeyPressed("s")) {
                this.selectedUnits = [];
                this.mark = null;
                this.mouseDown = true;
                this.initialDraggingPosition = this.mouseCoordsToGameCoordsWithZoom(gameContext, canvas, event.clientX, event.clientY, gameContext.camera.zoom)
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
            if (this.hoveringTarget) {
                this.selectedUnits.forEach(unit => {
                    (unit as any).target = this.hoveringTarget;
                })
            } else {
                const position = this.mouseCoordsToGameCoordsWithZoom(gameContext, canvas, event.clientX, event.clientY, gameContext.camera.zoom);
                this.mark = position;
                this.selectedUnits.forEach(unit => {
                    unit.targetPosition = position;
                })
            }

        }

        canvas.addEventListener("mousedown", handleMouseDown);
        canvas.addEventListener("mouseup", handleCancelMouseDown);
        canvas.addEventListener("mouseover", handleCancelMouseDown);
        canvas.addEventListener("mouseout", handleCancelMouseDown);
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("contextmenu", handleRightClick);


        this.dispose = () => {
            canvas.removeEventListener("mousedown", handleMouseDown);
            canvas.removeEventListener("mouseup", handleCancelMouseDown);
            canvas.removeEventListener("mouseover", handleCancelMouseDown);
            canvas.removeEventListener("mouseout", handleCancelMouseDown);
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("contextmenu", handleRightClick);
        };
    }

    step(gctx: GameContext) {
        const { spatialHashing } = gctx;
        if (this.initialDraggingPosition && this.initialDraggingClientPosition) {
            const selectionCollisionMask = new Rectangle(
                Math.abs(this.initialDraggingClientPosition.x - this.initialDraggingPosition.x),
                Math.abs(this.initialDraggingClientPosition.y - this.initialDraggingPosition.y)
            );

            const leftTopCorner = new Vector(
                Math.min(this.initialDraggingClientPosition.x, this.initialDraggingPosition.x),
                Math.min(this.initialDraggingClientPosition.y, this.initialDraggingPosition.y)
            );

            const selectionCenterPosition = new Vector(
                leftTopCorner.x + selectionCollisionMask.w / 2,
                leftTopCorner.y + selectionCollisionMask.h / 2
            );

            const selection: any = new BaseObject(selectionCenterPosition);
            selection.collisionMask = selectionCollisionMask;

            const posibleObjectsInSelection = spatialHashing.queryInRange(selectionCenterPosition, Math.max(selectionCollisionMask.w / 2, selectionCollisionMask.h / 2));
            posibleObjectsInSelection.forEach(obj => {
                if (isCollisionableObject(obj) && CollisionsController.calculateCollision(selection, obj)) {
                    if (obj instanceof ArmyUnit) {
                        obj.isSelected = true;
                        this.selectedUnits.push(obj);
                    }
                } else {
                    (obj as any).isSelected = false;
                }
            })
        }

        if (this.mousePositionInGame) {
            const hoveringObject = spatialHashing.query(this.mousePositionInGame).find(obj => isCollisionableObject(obj) && Intersections.isPointInsideRectangle(this.mousePositionInGame!, obj.collisionMask as Rectangle, obj.position));
            this.hoveringTarget = hoveringObject as Target ?? null;
            if (hoveringObject) {
                (hoveringObject as any).isBeingHovered = true;
            }
        }
    }

    render(): RenderElement {
        return new RenderElement((gctx) => {

            const { canvasRenderingContext } = gctx;
            if (this.mouseDown && this.initialDraggingPosition && this.initialDraggingClientPosition) {
                canvasRenderingContext.strokeStyle = "white";
                canvasRenderingContext.lineWidth = 4;
                canvasRenderingContext.setLineDash([5, 10]);
                canvasRenderingContext.strokeRect(this.initialDraggingPosition.x, this.initialDraggingPosition.y, this.initialDraggingClientPosition.x - this.initialDraggingPosition.x, this.initialDraggingClientPosition.y - this.initialDraggingPosition.y);
            }

            if (this.mark) {
                canvasRenderingContext.strokeStyle = "black";
                canvasRenderingContext.lineWidth = 2;
                canvasRenderingContext.beginPath();
                canvasRenderingContext.moveTo(this.mark.x, this.mark.y + 5);
                canvasRenderingContext.lineTo(this.mark.x, this.mark.y + 12);
                canvasRenderingContext.stroke();

                canvasRenderingContext.strokeStyle = "transparent";
                canvasRenderingContext.fillStyle = "red";
                RenderUtils.renderCircle(canvasRenderingContext, this.mark, 6);
                canvasRenderingContext.fill();
                canvasRenderingContext.fillStyle = "white";

                RenderUtils.renderCircle(canvasRenderingContext, this.mark.clone().add(new Vector(2, -2)), 2);
                canvasRenderingContext.fill();
                RenderUtils.renderCircle(canvasRenderingContext, this.mark.clone().add(new Vector(3, 2)), 1);
                canvasRenderingContext.fill();

            }
        }, true);
    }

    private mouseCoordsToGameCoordsWithZoom(gctx: GameContext, canvas: HTMLCanvasElement, x: number, y: number, zoom: number): Vector {
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

        return new Vector(worldX, worldY)
    }

}

export default Player;
